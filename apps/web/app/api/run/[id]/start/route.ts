import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  executeRun,
  createJobQueue,
  queueConfigFromEnv,
  JOB_RUN_EXECUTE,
  ensurePersonaRegistry,
  validatePersonaIds,
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
    llm: { provider, apiKey },
    enableDebate: false,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const storageConfig = storageConfigFromEnv();
  const storage = createStorage(storageConfig);

  try {
    const run = await storage.getRun(id);

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    if (run.status !== 'pending') {
      return NextResponse.json(
        { error: `Run already ${run.status}` },
        { status: 400 }
      );
    }

    // Validate persona IDs against registry before enqueue/execution
    await ensurePersonaRegistry();
    if (run.input.personaIds && run.input.personaIds.length > 0) {
      const check = validatePersonaIds(run.input.personaIds);
      if (!check.valid) {
        return NextResponse.json(
          {
            error: `Unknown persona IDs: ${check.missing.join(', ')}`,
            availablePersonas: check.available,
            totalAvailable: check.total,
          },
          { status: 400 }
        );
      }
    }

    const queueConfig = queueConfigFromEnv();

    // Async mode: enqueue to pg-boss, return immediately
    if (queueConfig.type === 'pgboss') {
      await storage.updateRunStatus(id, 'queued');

      const queue = createJobQueue(queueConfig);
      await queue.start();

      try {
        const jobId = await queue.enqueue(JOB_RUN_EXECUTE, {
          runId: id,
        }, {
          retryLimit: 2,
          expireInSeconds: 600,
        });

        return NextResponse.json({
          queued: true,
          runId: id,
          jobId,
        });
      } finally {
        await queue.stop();
      }
    }

    // Ensure persona registry is loaded (DB-first if Postgres, else files)
    await ensurePersonaRegistry();

    // Inline mode: execute synchronously (SQLite/dev)
    const result = await executeRun(id, {
      storage,
      extractorConfig: getExtractorConfig(),
      orchestratorConfig: getOrchestratorConfig(),
    });

    return NextResponse.json({
      success: result.success,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (error) {
    console.error('Error starting run:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      await storage.updateRunStatus(id, 'failed', errorMessage);
    } catch {
      console.error('Failed to update run status');
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    await storage.close();
  }
}
