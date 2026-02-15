import type { RunDiagnostics, PhaseTiming, PersonaSnapshots } from '@simvibe/shared';
import { createInitialDiagnostics, getCalibrationKey } from '@simvibe/shared';
import type { Storage } from '../storage/types';
import { createExtractor, type ExtractorConfig } from '../extractor';
import { createOrchestrator, type OrchestratorConfig } from '../orchestrator';
import { generateReport } from '../aggregator';
import { getRunModeConfig, getPersonaSetIds } from '../config';
import { getPersonaRegistry } from '../personas/registry';
import { runDiffusionSimulation } from '../diffusion';
import { generateConversationDynamics } from '../interactions';

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

function buildSyntheticLandingContent(input: {
  tagline: string;
  description: string;
  phSubmission?: {
    productName?: string;
    phTagline?: string;
    phDescription?: string;
    makerFirstComment?: string;
  };
}): string {
  let syntheticContent = `${input.tagline}\n\n${input.description}`;
  if (input.phSubmission) {
    const ph = input.phSubmission;
    if (ph.productName) syntheticContent += `\n\nProduct: ${ph.productName}`;
    if (ph.phTagline) syntheticContent += `\nPH Tagline: ${ph.phTagline}`;
    if (ph.phDescription) syntheticContent += `\n${ph.phDescription}`;
    if (ph.makerFirstComment) syntheticContent += `\n\nMaker Comment:\n${ph.makerFirstComment}`;
  }
  return syntheticContent;
}

/**
 * Build a persona snapshot from the registry for the given persona IDs.
 * Captures the exact definitions used at run time so historical reports don't drift.
 */
function buildPersonaSnapshots(personaIds: string[]): PersonaSnapshots {
  const registry = getPersonaRegistry();
  const snapshots: PersonaSnapshots = {};

  for (const id of personaIds) {
    const persona = registry.get(id);
    if (persona) {
      snapshots[id] = {
        id: persona.id,
        name: persona.name,
        role: persona.role,
        context: persona.context,
        priorities: persona.priorities,
        redFlags: persona.redFlags,
        budgetRange: persona.budgetRange,
        skepticismLevel: persona.skepticismLevel,
        decisionStyle: persona.decisionStyle,
      };
    }
  }

  return snapshots;
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
    const syntheticContent = buildSyntheticLandingContent(run.input);

    let landingExtract;
    if (extractorConfig.provider === 'pasted') {
      // Demo/local mode: intentionally skip remote URL extraction calls.
      landingExtract = await extractor.parseContent(
        run.input.pastedContent || syntheticContent
      );
    } else if (run.input.url) {
      landingExtract = await extractor.extract(run.input.url);
    } else if (run.input.pastedContent) {
      landingExtract = await extractor.parseContent(run.input.pastedContent);
    } else {
      landingExtract = await extractor.parseContent(syntheticContent);
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

    // Resolve persona IDs: explicit personaIds > personaSet > mode defaults
    let resolvedPersonaIds: string[];
    let resolvedSetName = modeConfig.personaSetName;

    if (run.input.personaIds && run.input.personaIds.length > 0) {
      resolvedPersonaIds = run.input.personaIds;
      resolvedSetName = 'custom';
    } else if (run.input.personaSet && run.input.personaSet !== 'custom') {
      const setIds = getPersonaSetIds(run.input.personaSet);
      resolvedPersonaIds = setIds ?? modeConfig.personaIds;
      resolvedSetName = run.input.personaSet;
    } else {
      resolvedPersonaIds = modeConfig.personaIds;
    }

    // Validate persona IDs against registry before running
    const registry = getPersonaRegistry();
    const missingIds = resolvedPersonaIds.filter(id => !registry.has(id));
    if (missingIds.length > 0) {
      throw new Error(
        `Unknown persona IDs: ${missingIds.join(', ')}. ` +
        `Registry has ${registry.size} personas. ` +
        `Available: ${registry.getAllIds().slice(0, 10).join(', ')}...`
      );
    }

    // Snapshot persona definitions for reproducibility
    const personaSnapshots = buildPersonaSnapshots(resolvedPersonaIds);
    await storage.savePersonaSnapshots(runId, personaSnapshots);

    const modeAwareConfig: typeof orchestratorConfig = {
      ...orchestratorConfig,
      llm: {
        ...orchestratorConfig.llm,
        maxTokens: orchestratorConfig.llm.maxTokens ?? modeConfig.maxTokensPerAgent,
        temperature: orchestratorConfig.llm.temperature ?? modeConfig.temperature,
      },
      enableDebate: orchestratorConfig.enableDebate ?? modeConfig.enableDebate,
      debateRounds: orchestratorConfig.debateRounds ?? modeConfig.debateRounds,
      personaIds: resolvedPersonaIds,
      timeBudgetMs: modeConfig.timeBudgetMs,
      maxAgentConcurrency: modeConfig.maxAgentConcurrency,
      perAgentTimeoutMs: modeConfig.perAgentTimeoutMs,
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

    if (result.earlyStopReason) {
      diagnostics.agentWarnings.push({
        agentId: 'orchestrator',
        warning: `Early stop: ${result.earlyStopReason}`,
      });
    }

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

      // Run diffusion simulation for deep mode
      const runMode = run.input.runMode || 'quick';
      const agentOutputs = result.agentResults.map(r => r.output);
      let diffusionTimeline;
      let outputsForReport = agentOutputs;

      if (runMode === 'deep' && agentOutputs.length > 1) {
        const diffusionResult = runDiffusionSimulation(agentOutputs);
        diffusionTimeline = diffusionResult.timeline;
        outputsForReport = diffusionResult.adjustedOutputs;
      }

      // Generate conversation dynamics for runs with 10+ personas or deep mode
      let conversationDynamics;
      if (agentOutputs.length >= 10 || runMode === 'deep') {
        conversationDynamics = generateConversationDynamics(agentOutputs);
      }

      const report = generateReport(
        runId,
        outputsForReport,
        run.variantOf,
        calibrationPrior,
        runMode,
        result.earlyStopReason,
        resolvedPersonaIds,
        diffusionTimeline,
        resolvedSetName,
        personaSnapshots,
        run.input.platformMode,
        run.input.phSubmission,
        conversationDynamics,
        run.input
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
