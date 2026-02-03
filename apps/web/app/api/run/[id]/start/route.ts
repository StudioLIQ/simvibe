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
import {
  getCalibrationKey,
  createInitialDiagnostics,
  type RunDiagnostics,
  type PhaseTiming,
} from '@simvibe/shared';

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

  const diagnostics: RunDiagnostics = createInitialDiagnostics(id);
  let currentPhase: PhaseTiming | null = null;

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

    currentPhase = { phase: 'extraction', startedAt: new Date().toISOString() };
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

    currentPhase.endedAt = new Date().toISOString();
    currentPhase.durationMs = new Date(currentPhase.endedAt).getTime() - new Date(currentPhase.startedAt).getTime();
    diagnostics.phaseTimings.push(currentPhase);

    diagnostics.extractionConfidence = landingExtract.confidence;
    if (landingExtract.warnings) {
      diagnostics.extractionWarnings = landingExtract.warnings;
    }
    if (landingExtract.failed) {
      diagnostics.extractionWarnings.push(`Extraction failed: ${landingExtract.failureReason || 'Unknown reason'}`);
    }

    await storage.saveLandingExtract(id, landingExtract);

    currentPhase = { phase: 'simulation', startedAt: new Date().toISOString() };
    const orchestrator = createOrchestrator(getOrchestratorConfig());

    orchestrator.onEvent(async (event) => {
      await storage.appendEvent(id, event);
    });

    const result = await orchestrator.runSimulation(id, run.input, landingExtract);

    currentPhase.endedAt = new Date().toISOString();
    currentPhase.durationMs = new Date(currentPhase.endedAt).getTime() - new Date(currentPhase.startedAt).getTime();
    diagnostics.phaseTimings.push(currentPhase);

    diagnostics.llmCalls = result.agentResults.length;
    diagnostics.fallbacksUsed = result.agentResults.filter(r => r.output.isFallback).length;

    for (const agentResult of result.agentResults) {
      await storage.saveAgentOutput(id, agentResult.output);
      if (agentResult.output.isFallback) {
        diagnostics.agentWarnings.push({
          agentId: agentResult.output.personaId,
          warning: `Used fallback output: ${agentResult.output.fallbackReason || 'Unknown reason'}`,
        });
      }
    }

    if (!result.error) {
      currentPhase = { phase: 'report_generation', startedAt: new Date().toISOString() };

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

      currentPhase.endedAt = new Date().toISOString();
      currentPhase.durationMs = new Date(currentPhase.endedAt).getTime() - new Date(currentPhase.startedAt).getTime();
      diagnostics.phaseTimings.push(currentPhase);

      await storage.saveReport(id, report);
      await storage.updateRunStatus(id, 'completed');
    } else {
      diagnostics.errors.push({
        timestamp: new Date().toISOString(),
        message: result.error,
        phase: 'simulation',
      });
      await storage.updateRunStatus(id, 'failed', result.error);
    }

    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = new Date(diagnostics.completedAt).getTime() - new Date(diagnostics.startedAt).getTime();
    await storage.saveDiagnostics(id, diagnostics);

    return NextResponse.json({
      success: !result.error,
      durationMs: result.durationMs,
      error: result.error,
    });
  } catch (error) {
    console.error('Error starting run:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    diagnostics.errors.push({
      timestamp: new Date().toISOString(),
      message: errorMessage,
      phase: currentPhase?.phase,
    });
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = new Date(diagnostics.completedAt).getTime() - new Date(diagnostics.startedAt).getTime();

    try {
      await storage.saveDiagnostics(id, diagnostics);
    } catch (diagError) {
      console.error('Failed to save diagnostics:', diagError);
    }

    await storage.updateRunStatus(id, 'failed', errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    await storage.close();
  }
}
