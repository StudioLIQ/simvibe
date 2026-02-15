import type { AgentOutput, DiffusionTimeline, DiffusionTick, DiffusionForecast } from '@simvibe/shared';
import {
  createInitialWorldState,
  computeSocialProofScore,
  adjustActionProbabilities,
  updateWorldState,
  DEFAULT_CONTAGION_CONFIG,
  type ContagionConfig,
  type WorldState,
} from './world-state';

export interface DiffusionResult {
  timeline: DiffusionTimeline;
  adjustedOutputs: AgentOutput[];
}

/**
 * Run a post-processing diffusion simulation over agent outputs.
 *
 * Agents are ordered randomly to simulate arrival timing.
 * Each agent's actions update the world state, and subsequent agents'
 * probabilities are adjusted based on accumulated social proof.
 */
export function runDiffusionSimulation(
  outputs: AgentOutput[],
  config: ContagionConfig = DEFAULT_CONTAGION_CONFIG
): DiffusionResult {
  // Shuffle agents to simulate random arrival order
  const shuffled = [...outputs].sort(() => Math.random() - 0.5);

  let worldState = createInitialWorldState();
  const ticks: DiffusionTick[] = [];
  const inflectionPoints: { tick: number; reason: string; impact: 'positive' | 'negative' }[] = [];
  const adjustedOutputs: AgentOutput[] = [];

  // Baseline metrics (pre-diffusion)
  const baselineMetrics = computeBaselineMetrics(outputs);

  let prevSocialProofScore = 0;

  for (let i = 0; i < shuffled.length; i++) {
    const output = shuffled[i];
    const socialProofScore = computeSocialProofScore(worldState);

    // Adjust this agent's probabilities based on current social proof
    const adjustedActions = adjustActionProbabilities(
      output.action.actions,
      socialProofScore,
      config
    );

    // Determine the adjusted primary action (highest probability)
    const sortedActions = [...adjustedActions].sort((a, b) => b.probability - a.probability);
    const adjustedPrimaryAction = sortedActions[0].action;
    const originalPrimaryProb = output.action.actions.find(
      a => a.action === output.action.primaryAction
    )?.probability ?? 0;
    const adjustedPrimaryProb = sortedActions[0].probability;

    // Create adjusted output
    const adjustedOutput: AgentOutput = {
      ...output,
      action: {
        ...output.action,
        actions: adjustedActions,
        primaryAction: adjustedPrimaryAction,
      },
    };
    adjustedOutputs.push(adjustedOutput);

    // Record tick
    ticks.push({
      tick: i,
      personaId: output.personaId,
      action: adjustedPrimaryAction,
      originalProbability: originalPrimaryProb,
      adjustedProbability: adjustedPrimaryProb,
      socialProofScore,
      worldState: { ...worldState },
      inflectionReason: undefined,
    });

    // Detect inflection points
    const scoreDelta = socialProofScore - prevSocialProofScore;
    if (Math.abs(scoreDelta) >= 1.5 && i > 0) {
      const reason = scoreDelta > 0
        ? `${output.personaId} boosted social proof (${shuffled[i - 1].action.primaryAction} triggered uplift)`
        : `${output.personaId} saw negative signals (social proof dropped)`;
      inflectionPoints.push({
        tick: i,
        reason,
        impact: scoreDelta > 0 ? 'positive' : 'negative',
      });
      ticks[i].inflectionReason = reason;
    }

    // Update world state with this agent's action
    worldState = updateWorldState(worldState, adjustedOutput);
    prevSocialProofScore = socialProofScore;
  }

  // Compute diffusion-adjusted metrics
  const adjustedMetrics = computeBaselineMetrics(adjustedOutputs);

  const forecast: DiffusionForecast = {
    baseline: baselineMetrics,
    diffusionAdjusted: adjustedMetrics,
    upliftSignups: adjustedMetrics.expectedSignups - baselineMetrics.expectedSignups,
    upliftPays: adjustedMetrics.expectedPays - baselineMetrics.expectedPays,
    upliftBounce: adjustedMetrics.bounceRate - baselineMetrics.bounceRate,
  };

  return {
    timeline: {
      ticks,
      forecast,
      inflectionPoints,
      totalTicks: ticks.length,
    },
    adjustedOutputs,
  };
}

function computeBaselineMetrics(outputs: AgentOutput[]): {
  expectedSignups: number;
  expectedPays: number;
  bounceRate: number;
  expectedUpvotes: number;
} {
  if (outputs.length === 0) {
    return { expectedSignups: 0, expectedPays: 0, bounceRate: 1, expectedUpvotes: 0 };
  }

  let totalSignup = 0;
  let totalPay = 0;
  let totalBounce = 0;
  let totalUpvote = 0;

  for (const output of outputs) {
    for (const action of output.action.actions) {
      switch (action.action) {
        case 'SIGNUP': totalSignup += action.probability; break;
        case 'PAY': totalPay += action.probability; break;
        case 'BOUNCE': totalBounce += action.probability; break;
        case 'UPVOTE': totalUpvote += action.probability; break;
      }
    }
  }

  const count = outputs.length;
  return {
    expectedSignups: totalSignup / count,
    expectedPays: totalPay / count,
    bounceRate: totalBounce / count,
    expectedUpvotes: totalUpvote / count,
  };
}
