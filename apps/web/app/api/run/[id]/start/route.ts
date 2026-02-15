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
  isDemoMode,
  type ExtractorConfig,
  type OrchestratorConfig,
} from '@simvibe/engine';

interface StartRunBody {
  runtimeOverrides?: {
    llmProvider?: 'gemini';
    geminiApiKey?: string;
    llmModel?: string;
  };
}

interface RuntimeOverrides {
  llmProvider?: 'gemini';
  geminiApiKey?: string;
  llmModel?: string;
}

function getExtractorConfig(): ExtractorConfig {
  const demoMode = isDemoMode();
  return {
    provider: demoMode
      ? 'pasted'
      : (process.env.EXTRACTOR_PROVIDER as 'firecrawl' | 'jina' | 'pasted') || 'jina',
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
    jinaApiKey: process.env.JINA_API_KEY,
  };
}

function getOrchestratorConfig(overrides?: RuntimeOverrides): OrchestratorConfig {
  const providerOverride = overrides?.geminiApiKey ? 'gemini' : overrides?.llmProvider;
  const provider = providerOverride || (process.env.LLM_PROVIDER as 'anthropic' | 'openai' | 'gemini') || 'gemini';
  const apiKeyMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: overrides?.geminiApiKey || process.env.GEMINI_API_KEY,
  };
  const apiKey = apiKeyMap[provider];
  const demoMode = isDemoMode();

  if (!apiKey && !demoMode) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is required`);
  }

  return {
    llm: {
      provider,
      apiKey: apiKey || 'demo-mode-key',
      model: overrides?.llmModel || process.env.LLM_MODEL || undefined,
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let runtimeOverrides: RuntimeOverrides | undefined;

  try {
    const body = await request.json() as StartRunBody;
    if (body?.runtimeOverrides) {
      runtimeOverrides = {
        llmProvider: body.runtimeOverrides.llmProvider,
        geminiApiKey: body.runtimeOverrides.geminiApiKey?.trim() || undefined,
        llmModel: body.runtimeOverrides.llmModel?.trim() || undefined,
      };
    }
  } catch {
    // Body is optional for backward compatibility with existing clients.
  }

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
    const hasByokGemini = !!runtimeOverrides?.geminiApiKey;
    const shouldForceInline = hasByokGemini;

    // Async mode: enqueue to pg-boss, return immediately
    if (queueConfig.type === 'pgboss' && !shouldForceInline) {
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

        if (!jobId) {
          throw new Error(`Failed to enqueue ${JOB_RUN_EXECUTE} job`);
        }

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
      orchestratorConfig: getOrchestratorConfig(runtimeOverrides),
    });

    return NextResponse.json({
      success: result.success,
      durationMs: result.durationMs,
      error: result.error,
      usedByokGemini: hasByokGemini,
      forcedInline: queueConfig.type === 'pgboss' && shouldForceInline,
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
