import type { RunDiagnostics, PhaseTiming } from '@simvibe/shared';
import { createInitialDiagnostics, getCalibrationKey } from '@simvibe/shared';
import type { Storage } from '../storage/types';
import { createExtractor, type ExtractorConfig } from '../extractor';
import { createOrchestrator, type OrchestratorConfig } from '../orchestrator';
import { generateReport } from '../aggregator';
import { getRunModeConfig } from '../config';

export interface ExecuteRunConfig {
  storage: Storage;
  extractorConfig: ExtractorConfig;
  orchestratorConfig: OrchestratorConfig;
}

export interface ExecuteRunResult {
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Execute a full simulation run: extraction -> orchestration -> report generation.
 * This function encapsulates the complete run lifecycle and can be called from
 * either the web API route (inline) or a worker process (async).
 */
export async function executeRun(
  runId: string,
  config: ExecuteRunConfig
): Promise<ExecuteRunResult> {
  const { storage, extractorConfig, orchestratorConfig } = config;

  const diagnostics: RunDiagnostics = createInitialDiagnostics(runId);
  let currentPhase: PhaseTiming | null = null;

  try {
    const run = await storage.getRun(runId);

    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    if (run.status !== 'pending' && run.status !== 'queued') {
      throw new Error(`Run already ${run.status}`);
    }

    await storage.updateRunStatus(runId, 'running');

    // Phase 1: Extraction
    currentPhase = { phase: 'extraction', startedAt: new Date().toISOString() };
    const extractor = createExtractor(extractorConfig);

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

    await storage.saveLandingExtract(runId, landingExtract);

    // Phase 2: Simulation — apply run mode config
    currentPhase = { phase: 'simulation', startedAt: new Date().toISOString() };
    const modeConfig = getRunModeConfig(run.input.runMode);
    const modeAwareConfig: typeof orchestratorConfig = {
      ...orchestratorConfig,
      llm: {
        ...orchestratorConfig.llm,
        maxTokens: orchestratorConfig.llm.maxTokens ?? modeConfig.maxTokensPerAgent,
        temperature: orchestratorConfig.llm.temperature ?? modeConfig.temperature,
      },
      enableDebate: orchestratorConfig.enableDebate ?? modeConfig.enableDebate,
      personaIds: modeConfig.personaIds,
      timeBudgetMs: modeConfig.timeBudgetMs,
    };
    const orchestrator = createOrchestrator(modeAwareConfig);

    orchestrator.onEvent(async (event) => {
      await storage.appendEvent(runId, event);
    });

    const result = await orchestrator.runSimulation(runId, run.input, landingExtract);

    currentPhase.endedAt = new Date().toISOString();
    currentPhase.durationMs = new Date(currentPhase.endedAt).getTime() - new Date(currentPhase.startedAt).getTime();
    diagnostics.phaseTimings.push(currentPhase);

    diagnostics.llmCalls = result.agentResults.length;
    diagnostics.fallbacksUsed = result.agentResults.filter(r => r.output.isFallback).length;

    for (const agentResult of result.agentResults) {
      await storage.saveAgentOutput(runId, agentResult.output);
      if (agentResult.output.isFallback) {
        diagnostics.agentWarnings.push({
          agentId: agentResult.output.personaId,
          warning: `Used fallback output: ${agentResult.output.fallbackReason || 'Unknown reason'}`,
        });
      }
    }

    // Phase 3: Report generation
    if (!result.error) {
      currentPhase = { phase: 'report_generation', startedAt: new Date().toISOString() };

      const category = run.input.category || 'general';
      const pricingModel = run.input.pricingModel || 'unknown';
      const calibrationKey = getCalibrationKey(category, pricingModel);
      const calibrationPrior = await storage.getCalibrationPrior(calibrationKey);

      const report = generateReport(
        runId,
        result.agentResults.map(r => r.output),
        run.variantOf,
        calibrationPrior,
        run.input.runMode || 'quick'
      );

      currentPhase.endedAt = new Date().toISOString();
      currentPhase.durationMs = new Date(currentPhase.endedAt).getTime() - new Date(currentPhase.startedAt).getTime();
      diagnostics.phaseTimings.push(currentPhase);

      await storage.saveReport(runId, report);
      await storage.updateRunStatus(runId, 'completed');
    } else {
      diagnostics.errors.push({
        timestamp: new Date().toISOString(),
        message: result.error,
        phase: 'simulation',
      });
      await storage.updateRunStatus(runId, 'failed', result.error);
    }

    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = new Date(diagnostics.completedAt).getTime() - new Date(diagnostics.startedAt).getTime();
    await storage.saveDiagnostics(runId, diagnostics);

    return {
      success: !result.error,
      durationMs: result.durationMs,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    diagnostics.errors.push({
      timestamp: new Date().toISOString(),
      message: errorMessage,
      phase: currentPhase?.phase,
    });
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = new Date(diagnostics.completedAt).getTime() - new Date(diagnostics.startedAt).getTime();

    try {
      await storage.saveDiagnostics(runId, diagnostics);
    } catch {
      console.error('Failed to save diagnostics');
    }

    try {
      await storage.updateRunStatus(runId, 'failed', errorMessage);
    } catch {
      console.error('Failed to update run status');
    }

    return {
      success: false,
      durationMs: Date.now() - new Date(diagnostics.startedAt).getTime(),
      error: errorMessage,
    };
  }
}
