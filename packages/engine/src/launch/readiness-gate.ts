import type {
  Report,
  LaunchReadiness,
  LaunchBlocker,
} from '@simvibe/shared';

/**
 * Launch readiness policy configuration.
 * Values can be overridden via environment variables.
 */
export interface ReadinessPolicyConfig {
  /** Minimum overall score (0-100) to be launch-ready. Default: 40 */
  minOverallScore: number;
  /** Maximum allowed uncertainty score (0-1). Default: 0.7 */
  maxUncertaintyScore: number;
  /** Maximum allowed disagreement score (0-1). Default: 0.8 */
  maxDisagreementScore: number;
  /** Maximum allowed fallback agent count. Default: 0 */
  maxFallbackCount: number;
  /** Minimum clarity score (0-100). Default: 30 */
  minClarityScore: number;
  /** Minimum credibility score (0-100). Default: 25 */
  minCredibilityScore: number;
  /** Maximum allowed bounce rate (0-1). Default: 0.85 */
  maxBounceRate: number;
  /** If true, bypass all gates (force ready). Default: false */
  forceOverride: boolean;
}

const DEFAULT_POLICY: ReadinessPolicyConfig = {
  minOverallScore: 40,
  maxUncertaintyScore: 0.7,
  maxDisagreementScore: 0.8,
  maxFallbackCount: 0,
  minClarityScore: 30,
  minCredibilityScore: 25,
  maxBounceRate: 0.85,
  forceOverride: false,
};

/**
 * Read readiness policy from env, falling back to defaults.
 */
export function readinessPolicyFromEnv(): ReadinessPolicyConfig {
  const env = process.env;
  return {
    minOverallScore: num(env.LAUNCH_MIN_OVERALL_SCORE, DEFAULT_POLICY.minOverallScore),
    maxUncertaintyScore: num(env.LAUNCH_MAX_UNCERTAINTY, DEFAULT_POLICY.maxUncertaintyScore),
    maxDisagreementScore: num(env.LAUNCH_MAX_DISAGREEMENT, DEFAULT_POLICY.maxDisagreementScore),
    maxFallbackCount: num(env.LAUNCH_MAX_FALLBACK_COUNT, DEFAULT_POLICY.maxFallbackCount),
    minClarityScore: num(env.LAUNCH_MIN_CLARITY, DEFAULT_POLICY.minClarityScore),
    minCredibilityScore: num(env.LAUNCH_MIN_CREDIBILITY, DEFAULT_POLICY.minCredibilityScore),
    maxBounceRate: num(env.LAUNCH_MAX_BOUNCE_RATE, DEFAULT_POLICY.maxBounceRate),
    forceOverride: env.LAUNCH_FORCE_OVERRIDE === 'true',
  };
}

function num(val: string | undefined, fallback: number): number {
  if (val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Evaluate launch readiness from a completed report.
 * This is deterministic: same report + same policy = same result.
 */
export function evaluateLaunchReadiness(
  report: Report,
  runStatus: string,
  policy: ReadinessPolicyConfig = DEFAULT_POLICY,
): LaunchReadiness {
  const blockers: LaunchBlocker[] = [];
  const recommendedActions: string[] = [];

  // Gate 0: Run must be completed
  if (runStatus !== 'completed') {
    blockers.push({
      code: 'run_not_completed',
      message: `Run status is "${runStatus}"; must be "completed".`,
      severity: 'critical',
    });
    recommendedActions.push('Wait for the simulation run to complete before launching.');
  }

  // Gate 1: Minimum overall score
  if (report.overallScore < policy.minOverallScore) {
    blockers.push({
      code: 'low_overall_score',
      message: `Overall score ${report.overallScore} is below minimum ${policy.minOverallScore}.`,
      severity: 'critical',
    });
    recommendedActions.push(
      `Improve positioning, clarity, or credibility to raise score above ${policy.minOverallScore}.`
    );
  }

  // Gate 2: Uncertainty score
  if (report.metrics.uncertaintyScore > policy.maxUncertaintyScore) {
    blockers.push({
      code: 'high_uncertainty',
      message: `Uncertainty score ${report.metrics.uncertaintyScore.toFixed(2)} exceeds max ${policy.maxUncertaintyScore}.`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Provide more complete inputs (pricing, landing content, proof) to reduce uncertainty.'
    );
  }

  // Gate 3: Disagreement score
  if (report.metrics.disagreementScore > policy.maxDisagreementScore) {
    blockers.push({
      code: 'high_disagreement',
      message: `Disagreement score ${report.metrics.disagreementScore.toFixed(2)} exceeds max ${policy.maxDisagreementScore}.`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Address top friction points to build consensus among simulated personas.'
    );
  }

  // Gate 4: Fallback agent count
  const fallbackCount = report.personaReports.filter(p => p.isFallback).length;
  if (fallbackCount > policy.maxFallbackCount) {
    blockers.push({
      code: 'too_many_fallbacks',
      message: `${fallbackCount} agent(s) produced fallback outputs (max allowed: ${policy.maxFallbackCount}).`,
      severity: 'critical',
    });
    recommendedActions.push(
      'Re-run the simulation to ensure all agents produce valid outputs.'
    );
  }

  // Gate 5: Clarity score
  if (report.scores.clarity < policy.minClarityScore) {
    blockers.push({
      code: 'low_clarity',
      message: `Clarity score ${report.scores.clarity} is below minimum ${policy.minClarityScore}.`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Sharpen tagline and description to clearly communicate what the product does.'
    );
  }

  // Gate 6: Credibility score
  if (report.scores.credibility < policy.minCredibilityScore) {
    blockers.push({
      code: 'low_credibility',
      message: `Credibility score ${report.scores.credibility} is below minimum ${policy.minCredibilityScore}.`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Add social proof, testimonials, or concrete metrics to boost credibility.'
    );
  }

  // Gate 7: Bounce rate
  if (report.metrics.bounceRate > policy.maxBounceRate) {
    blockers.push({
      code: 'high_bounce_rate',
      message: `Predicted bounce rate ${(report.metrics.bounceRate * 100).toFixed(1)}% exceeds max ${(policy.maxBounceRate * 100).toFixed(1)}%.`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Address top friction triggers to reduce predicted bounce rate.'
    );
  }

  // Gate 8: Early stop warning
  if (report.earlyStopReason) {
    blockers.push({
      code: 'early_stop',
      message: `Simulation ended early: ${report.earlyStopReason}`,
      severity: 'warning',
    });
    recommendedActions.push(
      'Consider re-running with more time budget for a complete simulation.'
    );
  }

  // Determine final status
  const hasCriticalBlockers = blockers.some(b => b.severity === 'critical');
  const isReady = policy.forceOverride || !hasCriticalBlockers;

  // Compute confidence from report signals
  const confidence = computeReadinessConfidence(report, blockers.length);

  return {
    status: isReady ? 'ready' : 'not_ready',
    blockers,
    confidence,
    recommendedActions: recommendedActions.length > 0
      ? recommendedActions
      : ['All readiness checks passed. Review the report before launching.'],
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Compute a 0-1 confidence score for the readiness assessment.
 */
function computeReadinessConfidence(report: Report, blockerCount: number): number {
  // Base confidence from overall score (normalized 0-1)
  let confidence = report.overallScore / 100;

  // Penalize for uncertainty
  confidence *= (1 - report.metrics.uncertaintyScore * 0.3);

  // Penalize for disagreement
  confidence *= (1 - report.metrics.disagreementScore * 0.2);

  // Penalize for each blocker
  confidence *= Math.max(0.1, 1 - blockerCount * 0.1);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Number(confidence.toFixed(3))));
}

/**
 * Format readiness as a markdown section for inclusion in reports.
 */
export function formatReadinessMarkdown(readiness: LaunchReadiness): string {
  const lines: string[] = [];

  lines.push('## Launch Readiness for nad.fun');
  lines.push('');

  const badge = readiness.status === 'ready' ? 'READY' : 'NOT READY';
  lines.push(`**Status:** ${badge} (confidence: ${(readiness.confidence * 100).toFixed(0)}%)`);
  lines.push('');

  if (readiness.blockers.length > 0) {
    lines.push('### Blockers');
    for (const b of readiness.blockers) {
      const icon = b.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
      lines.push(`- ${icon} **${b.code}**: ${b.message}`);
    }
    lines.push('');
  }

  if (readiness.recommendedActions.length > 0) {
    lines.push('### Recommended Actions');
    for (const action of readiness.recommendedActions) {
      lines.push(`- ${action}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
