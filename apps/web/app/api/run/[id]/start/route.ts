import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  storageConfigFromEnv,
  executeRun,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const storage = createStorage(storageConfigFromEnv());

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

    // Execute inline (will be replaced by queue enqueue in SIM-018C)
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

    await storage.updateRunStatus(id, 'failed', errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    await storage.close();
  }
}
