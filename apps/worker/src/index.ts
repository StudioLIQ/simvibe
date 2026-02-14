/**
 * simvi.be Worker — Long-running simulation executor
 *
 * This worker process executes simulation runs that can take 2-10 minutes.
 * It provides a health endpoint for Railway and supports graceful shutdown.
 *
 * Architecture:
 *   - apps/web: creates runs, enqueues jobs, serves UI
 *   - apps/worker: executes runs using @simvibe/engine
 *
 * Modes:
 *   - CLI: `pnpm --filter @simvibe/worker start <run_id>` — execute one run
 *   - Service: `pnpm --filter @simvibe/worker start` — start health server, await jobs (SIM-018C)
 */

import * as http from 'http';
import {
  createStorage,
  storageConfigFromEnv,
  executeRun,
  type ExecuteRunConfig,
  type ExtractorConfig,
  type OrchestratorConfig,
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

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is required`);
  }

  return {
    llm: { provider, apiKey },
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

    log('info', `Executing run`, { runId });

    // Time-budget enforcement
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Run timed out after ${RUN_TIMEOUT_MS}ms`)), RUN_TIMEOUT_MS);
    });

    const result = await Promise.race([
      executeRun(runId, config),
      timeoutPromise,
    ]);

    if (result.success) {
      log('info', `Run completed`, { runId, durationMs: result.durationMs });
    } else {
      log('error', `Run failed`, { runId, error: result.error, durationMs: result.durationMs });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', `Run execution error`, { runId, error: errorMessage });

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

// --- Health endpoint ---

function createHealthServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      const status = {
        status: shutdownRequested ? 'draining' : 'healthy',
        service: 'simvibe-worker',
        activeRun: activeRunId,
        uptime: process.uptime(),
        storage: storageConfigFromEnv().type,
      };
      res.writeHead(shutdownRequested ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    log('info', `Health endpoint listening`, { port, path: '/health' });
  });

  return server;
}

// --- Graceful shutdown ---

function setupGracefulShutdown(server: http.Server) {
  const shutdown = (signal: string) => {
    log('info', `Received ${signal}, shutting down gracefully`);
    shutdownRequested = true;

    server.close(() => {
      log('info', 'Health server closed');
    });

    if (activeRunId) {
      log('info', `Waiting for active run to complete`, { runId: activeRunId });
      // The run will finish naturally; process exit happens in main()
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
  log('info', 'Worker starting', { storage: storageConfig.type });

  // CLI mode: execute a single run ID
  const runId = process.argv[2];
  if (runId) {
    const result = await executeRunById(runId);
    process.exit(result.success ? 0 : 1);
  }

  // Service mode: start health server, await job queue (SIM-018C)
  const port = parseInt(process.env.WORKER_PORT || '8080', 10);
  const server = createHealthServer(port);
  setupGracefulShutdown(server);

  log('info', 'Worker ready — awaiting jobs (job queue: SIM-018C)');
}

main().catch((error) => {
  log('error', 'Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
