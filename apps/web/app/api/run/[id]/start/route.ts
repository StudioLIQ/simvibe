import { NextRequest, NextResponse } from 'next/server';
import {
  createStorage,
  createExtractor,
  createOrchestrator,
  generateReport,
  type StorageConfig,
  type ExtractorConfig,
  type OrchestratorConfig,
} from '@simvibe/engine';
import { getCalibrationKey } from '@simvibe/shared';

function getStorageConfig(): StorageConfig {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/simvibe.db';
  return {
    type: 'sqlite',
    sqlitePath: dbPath,
  };
}

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

  const storage = createStorage(getStorageConfig());

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

    await storage.updateRunStatus(id, 'running');

    const extractor = createExtractor(getExtractorConfig());

    let landingExtract;
    if (run.input.url) {
      landingExtract = await extractor.extract(run.input.url);
    } else if (run.input.pastedContent) {
      landingExtract = await extractor.parseContent(run.input.pastedContent);
    } else {
      landingExtract = await extractor.parseContent(
        `${run.input.tagline}\n\n${run.input.description}`
      );
    }

    await storage.saveLandingExtract(id, landingExtract);

    const orchestrator = createOrchestrator(getOrchestratorConfig());

    orchestrator.onEvent(async (event) => {
      await storage.appendEvent(id, event);
    });

    const result = await orchestrator.runSimulation(id, run.input, landingExtract);

    for (const agentResult of result.agentResults) {
      await storage.saveAgentOutput(id, agentResult.output);
    }

    if (!result.error) {
      const category = run.input.category || 'general';
      const pricingModel = run.input.pricingModel || 'unknown';
      const calibrationKey = getCalibrationKey(category, pricingModel);
      const calibrationPrior = await storage.getCalibrationPrior(calibrationKey);

      const report = generateReport(
        id,
        result.agentResults.map(r => r.output),
        run.variantOf,
        calibrationPrior
      );
      await storage.saveReport(id, report);
      await storage.updateRunStatus(id, 'completed');
    } else {
      await storage.updateRunStatus(id, 'failed', result.error);
    }

    return NextResponse.json({
      success: !result.error,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (error) {
    console.error('Error starting run:', error);
    await storage.updateRunStatus(id, 'failed', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await storage.close();
  }
}
