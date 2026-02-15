/**
 * simvi.be Worker — Long-running simulation executor
 *
 * This worker process executes simulation runs that can take 2-10 minutes.
 * It provides a health endpoint for Railway and supports graceful shutdown.
 *
 * Architecture:
 *   - apps/web: creates runs, enqueues jobs via pg-boss, serves UI
 *   - apps/worker: consumes jobs from pg-boss, executes runs using @simvibe/engine
 *
 * Modes:
 *   - CLI: `pnpm --filter @simvibe/worker start <run_id>` — execute one run
 *   - Service: `pnpm --filter @simvibe/worker start` — consume from job queue
 */

import * as http from 'http';
import {
  createStorage,
  storageConfigFromEnv,
  executeRun,
  createJobQueue,
  queueConfigFromEnv,
  JOB_RUN_EXECUTE,
  initPersonaRegistryFromDb,
  getPersonaRegistry,
  isDemoMode,
  type ExecuteRunConfig,
  type ExtractorConfig,
  type OrchestratorConfig,
  type JobQueue,
  type Job,
  type RunExecutePayload,
} from '@simvibe/engine';

// --- Config helpers ---

function getExtractorConfig(): ExtractorConfig {
  return {
    provider: (process.env.EXTRACTOR_PROVIDER as 'firecrawl' | 'jina' | 'pasted') || 'jina',
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
    jinaApiKey: process.env.JINA_API_KEY,
  };
}

function getOrchestratorConfig(): OrchestratorConfig {
  const provider = (process.env.LLM_PROVIDER as 'anthropic' | 'openai') || 'anthropic';
  const apiKey = provider === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;
  const demoMode = isDemoMode();

  if (!apiKey && !demoMode) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is required`);
  }

  return {
    llm: { provider, apiKey: apiKey || 'demo-mode-key' },
    enableDebate: false,
  };
}

// --- Logging ---

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'simvibe-worker',
    message,
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// --- Worker state ---

let activeRunId: string | null = null;
let shutdownRequested = false;
let jobQueue: JobQueue | null = null;

// --- Run execution ---

const RUN_TIMEOUT_MS = parseInt(process.env.WORKER_RUN_TIMEOUT_MS || '600000', 10); // 10 min default

export async function executeRunById(runId: string): Promise<{ success: boolean; durationMs: number; error?: string }> {
  activeRunId = runId;
  const storageConfig = storageConfigFromEnv();
  const storage = createStorage(storageConfig);

  try {
    const config: ExecuteRunConfig = {
      storage,
      extractorConfig: getExtractorConfig(),
      orchestratorConfig: getOrchestratorConfig(),
    };

    log('info', 'Executing run', { runId });

    // Time-budget enforcement
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Run timed out after ${RUN_TIMEOUT_MS}ms`)), RUN_TIMEOUT_MS);
    });

    const result = await Promise.race([
      executeRun(runId, config),
      timeoutPromise,
    ]);

    if (result.success) {
      log('info', 'Run completed', { runId, durationMs: result.durationMs });
    } else {
      log('error', 'Run failed', { runId, error: result.error, durationMs: result.durationMs });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Run execution error', { runId, error: errorMessage });

    try {
      await storage.updateRunStatus(runId, 'failed', errorMessage);
    } catch {
      log('error', 'Failed to update run status after error', { runId });
    }

    return { success: false, durationMs: 0, error: errorMessage };
  } finally {
    activeRunId = null;
    await storage.close();
  }
}

// --- Job handler ---

async function handleRunExecuteJob(job: Job<RunExecutePayload>): Promise<void> {
  const { runId } = job.data;
  log('info', 'Processing job', { jobId: job.id, runId });

  const result = await executeRunById(runId);

  if (!result.success) {
    // Throw to trigger pg-boss retry
    throw new Error(result.error || 'Run execution failed');
  }
}

// --- Health endpoint ---

function createHealthServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      const queueConfig = queueConfigFromEnv();
      const status = {
        status: shutdownRequested ? 'draining' : 'healthy',
        service: 'simvibe-worker',
        activeRun: activeRunId,
        uptime: process.uptime(),
        storage: storageConfigFromEnv().type,
        queue: queueConfig.type,
      };
      res.writeHead(shutdownRequested ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    log('info', 'Health endpoint listening', { port, path: '/health' });
  });

  return server;
}

// --- Graceful shutdown ---

function setupGracefulShutdown(server: http.Server) {
  const shutdown = async (signal: string) => {
    log('info', `Received ${signal}, shutting down gracefully`);
    shutdownRequested = true;

    server.close(() => {
      log('info', 'Health server closed');
    });

    if (jobQueue) {
      await jobQueue.stop();
      log('info', 'Job queue stopped');
    }

    if (activeRunId) {
      log('info', 'Waiting for active run to complete', { runId: activeRunId });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// --- Main ---

async function main() {
  const storageConfig = storageConfigFromEnv();
  const queueConfig = queueConfigFromEnv();
  log('info', 'Worker starting', { storage: storageConfig.type, queue: queueConfig.type });

  // Bootstrap persona registry from Postgres if available
  if (storageConfig.type === 'postgres' && storageConfig.postgresUrl) {
    try {
      const registry = await initPersonaRegistryFromDb(storageConfig.postgresUrl);
      log('info', 'Persona registry initialized', {
        source: registry.source,
        count: registry.size,
      });
    } catch (error) {
      log('warn', 'Persona registry DB init failed, using file fallback', {
        error: error instanceof Error ? error.message : String(error),
        source: getPersonaRegistry().source,
        count: getPersonaRegistry().size,
      });
    }
  } else {
    const registry = getPersonaRegistry();
    log('info', 'Persona registry initialized from files', {
      source: registry.source,
      count: registry.size,
    });
  }

  // CLI mode: execute a single run ID
  const runId = process.argv[2];
  if (runId) {
    const result = await executeRunById(runId);
    process.exit(result.success ? 0 : 1);
  }

  // Service mode: start health server + job queue consumer
  const port = parseInt(process.env.WORKER_PORT || '8080', 10);
  const server = createHealthServer(port);
  setupGracefulShutdown(server);

  if (queueConfig.type === 'pgboss') {
    jobQueue = createJobQueue(queueConfig);
    await jobQueue.start();
    await jobQueue.work(JOB_RUN_EXECUTE, handleRunExecuteJob);
    log('info', 'Worker consuming jobs from pg-boss queue');
  } else {
    log('warn', 'No Postgres configured — queue consumer disabled. Use CLI mode to execute runs.');
  }
}

main().catch((error) => {
  log('error', 'Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
