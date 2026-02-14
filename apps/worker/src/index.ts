/**
 * simvi.be Worker — Long-running simulation executor
 *
 * This worker process consumes run jobs from a queue (Postgres-backed)
 * and executes simulations that can take 2-10 minutes.
 *
 * Architecture:
 *   - apps/web: creates runs, enqueues jobs, serves UI
 *   - apps/worker: dequeues and executes runs using @simvibe/engine
 *
 * For now this is a scaffold. Full job queue (pg-boss) will be added in SIM-018C.
 */

import {
  createStorage,
  storageConfigFromEnv,
  executeRun,
  type ExecuteRunConfig,
  type ExtractorConfig,
  type OrchestratorConfig,
} from '@simvibe/engine';

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
    llm: {
      provider,
      apiKey,
    },
    enableDebate: false,
  };
}

/**
 * Execute a single run by ID (for manual/direct invocation).
 * Full queue-based consumption will be added in SIM-018C.
 */
export async function executeRunById(runId: string): Promise<void> {
  const storageConfig = storageConfigFromEnv();
  const storage = createStorage(storageConfig);

  try {
    const config: ExecuteRunConfig = {
      storage,
      extractorConfig: getExtractorConfig(),
      orchestratorConfig: getOrchestratorConfig(),
    };

    console.log(`[worker] Executing run: ${runId}`);
    const result = await executeRun(runId, config);

    if (result.success) {
      console.log(`[worker] Run ${runId} completed in ${result.durationMs}ms`);
    } else {
      console.error(`[worker] Run ${runId} failed: ${result.error}`);
    }
  } finally {
    await storage.close();
  }
}

async function main() {
  console.log('[worker] simvi.be Worker starting...');
  console.log(`[worker] Storage: ${storageConfigFromEnv().type}`);

  // If a run ID is passed as CLI arg, execute it directly
  const runId = process.argv[2];
  if (runId) {
    await executeRunById(runId);
    process.exit(0);
  }

  // Otherwise, wait for job queue (SIM-018C)
  console.log('[worker] No run ID provided. Job queue not yet implemented (SIM-018C).');
  console.log('[worker] Usage: pnpm --filter @simvibe/worker start <run_id>');
  process.exit(0);
}

main().catch((error) => {
  console.error('[worker] Fatal error:', error);
  process.exit(1);
});
