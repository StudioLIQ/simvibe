import type {
  AgentOutput,
  Report,
  PersonaReport,
  PersonaId,
  ActionType,
  CalibrationPrior,
  AggregatedMetrics,
  RunMode,
  PlatformMode,
  PHSubmission,
  PHForecast,
  DiffusionTimeline,
  PersonaSetName,
  PersonaSnapshots,
} from '@simvibe/shared';
import { applyCalibration } from '@simvibe/shared';
import { aggregateOutputs, type AggregationResult } from './aggregator';
import { computePHForecast } from './ph-forecast';

function createPersonaReport(output: AgentOutput): PersonaReport {
  const actionProbabilities: Partial<Record<ActionType, number>> = {};
  for (const action of output.action.actions) {
    actionProbabilities[action.action] = action.probability;
  }

  return {
    personaId: output.personaId,
    primaryAction: output.action.primaryAction,
    actionProbabilities: actionProbabilities as Record<ActionType, number>,
    primaryFriction: output.skim.primaryFriction,
    oneLineFix: output.action.oneLineFix,
    trustBoosters: output.skim.trustBoosters,
    trustKillers: output.skim.trustKillers,
    isFallback: output.isFallback ?? false,
  };
}

function prioritizeFixes(outputs: AgentOutput[]): { fix: string; source: PersonaId; priority: number }[] {
  const validOutputs = outputs.filter(o => !o.isFallback);

  const fixes = validOutputs.map((output, index) => ({
    fix: output.action.oneLineFix,
    source: output.personaId,
    priority: index + 1,
  }));

  const fixFrequency = new Map<string, number>();
  for (const f of fixes) {
    const normalized = f.fix.toLowerCase().trim().slice(0, 100);
    fixFrequency.set(normalized, (fixFrequency.get(normalized) || 0) + 1);
  }

  fixes.sort((a, b) => {
    const freqA = fixFrequency.get(a.fix.toLowerCase().trim().slice(0, 100)) || 1;
    const freqB = fixFrequency.get(b.fix.toLowerCase().trim().slice(0, 100)) || 1;
    return freqB - freqA;
  });

  return fixes.map((f, i) => ({ ...f, priority: i + 1 }));
}

export interface GenerateReportOptions {
  runId: string;
  outputs: AgentOutput[];
  variantOf?: string;
  calibrationPrior?: CalibrationPrior | null;
}

export function generateReport(
  runId: string,
  outputs: AgentOutput[],
  variantOf?: string,
  calibrationPrior?: CalibrationPrior | null,
  runMode?: RunMode,
  earlyStopReason?: string,
  executedPersonaIds?: string[],
  diffusion?: DiffusionTimeline,
  personaSet?: PersonaSetName,
  personaSnapshots?: PersonaSnapshots,
  platformMode?: PlatformMode,
  phSubmission?: PHSubmission
): Report {
  const aggregation = aggregateOutputs(outputs);

  const personaReports = outputs.map(createPersonaReport);
  const oneLineFixes = prioritizeFixes(outputs);

  const calibrated = applyCalibration(
    {
      signupRate: aggregation.metrics.expectedSignups,
      payRate: aggregation.metrics.expectedPays,
      bounceRate: aggregation.metrics.bounceRate,
    },
    calibrationPrior ?? null
  );

  const calibratedMetrics: AggregatedMetrics = calibrated.calibrationApplied
    ? {
        ...aggregation.metrics,
        expectedSignups: calibrated.calibratedSignups,
        expectedPays: calibrated.calibratedPays,
        bounceRate: calibrated.calibratedBounce,
      }
    : aggregation.metrics;

  const rawMetrics: AggregatedMetrics = calibrated.calibrationApplied
    ? aggregation.metrics
    : undefined as unknown as AggregatedMetrics;

  const warnings = [...aggregation.warnings];
  if (calibrated.calibrationApplied) {
    warnings.push(`Calibration applied based on ${calibrated.sampleCount} previous actual outcomes (key: ${calibrated.priorKey})`);
  }

  // PH-specific forecast
  let phForecast: PHForecast | undefined;
  if (platformMode === 'product_hunt') {
    phForecast = computePHForecast(outputs, calibratedMetrics, phSubmission);
  }

  return {
    runId,
    generatedAt: new Date().toISOString(),
    tractionBand: aggregation.tractionBand,
    confidence: aggregation.confidence,
    metrics: calibratedMetrics,
    scores: aggregation.scores,
    overallScore: aggregation.overallScore,
    frictionList: aggregation.frictionList,
    personaReports,
    oneLineFixes,
    warnings: warnings.length > 0 ? warnings : undefined,
    calibrationApplied: calibrated.calibrationApplied,
    rawMetrics: calibrated.calibrationApplied ? rawMetrics : undefined,
    variantOf,
    runMode,
    earlyStopReason,
    executedPersonaIds,
    personaSet,
    personaSnapshots,
    diffusion,
    platformMode,
    phForecast,
  };
}

export function formatReportMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push(`# Simulation Report`);
  lines.push(`\nRun ID: ${report.runId}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  if (report.variantOf) {
    lines.push(`Variant of: ${report.variantOf}`);
  }

  lines.push(`\n## Overall Score: ${report.overallScore}/100`);
  lines.push(`\n**Traction Band:** ${report.tractionBand.replace('_', ' ').toUpperCase()}`);
  lines.push(`**Confidence:** ${report.confidence.toUpperCase()}`);

  if (report.warnings && report.warnings.length > 0) {
    lines.push(`\n### Warnings`);
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(`\n## Score Breakdown`);
  lines.push(`| Category | Score |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Clarity | ${report.scores.clarity}/100 |`);
  lines.push(`| Credibility | ${report.scores.credibility}/100 |`);
  lines.push(`| Differentiation | ${report.scores.differentiation}/100 |`);
  lines.push(`| Pricing Framing | ${report.scores.pricingFraming}/100 |`);
  lines.push(`| Conversion Readiness | ${report.scores.conversionReadiness}/100 |`);

  lines.push(`\n## Predicted Metrics`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Expected Upvotes | ${report.metrics.expectedUpvotes.toFixed(2)} |`);
  lines.push(`| Expected Signups | ${(report.metrics.expectedSignups * 100).toFixed(1)}% |`);
  lines.push(`| Expected Pays | ${(report.metrics.expectedPays * 100).toFixed(1)}% |`);
  lines.push(`| Bounce Rate | ${(report.metrics.bounceRate * 100).toFixed(1)}% |`);
  lines.push(`| Share Rate | ${(report.metrics.shareRate * 100).toFixed(1)}% |`);

  lines.push(`\n## Top Friction Points`);
  for (const friction of report.frictionList.slice(0, 5)) {
    lines.push(`\n### ${friction.rank}. ${friction.trigger}`);
    lines.push(`**Category:** ${friction.category}`);
    lines.push(`**Severity:** ${(friction.severity * 100).toFixed(0)}%`);
    lines.push(`**Cited by:** ${friction.agentsCiting.join(', ')}`);
  }

  lines.push(`\n## Recommended Fixes`);
  for (const fix of report.oneLineFixes.slice(0, 5)) {
    lines.push(`${fix.priority}. **[${fix.source}]** ${fix.fix}`);
  }

  if (report.diffusion) {
    lines.push(`\n## Social Diffusion Timeline`);
    lines.push(`\n**Baseline vs Diffusion-Adjusted Forecast:**`);
    lines.push(`| Metric | Baseline | Adjusted | Uplift |`);
    lines.push(`|--------|----------|----------|--------|`);
    const d = report.diffusion.forecast;
    lines.push(`| Signups | ${(d.baseline.expectedSignups * 100).toFixed(1)}% | ${(d.diffusionAdjusted.expectedSignups * 100).toFixed(1)}% | ${(d.upliftSignups * 100).toFixed(1)}pp |`);
    lines.push(`| Pays | ${(d.baseline.expectedPays * 100).toFixed(1)}% | ${(d.diffusionAdjusted.expectedPays * 100).toFixed(1)}% | ${(d.upliftPays * 100).toFixed(1)}pp |`);
    lines.push(`| Bounce | ${(d.baseline.bounceRate * 100).toFixed(1)}% | ${(d.diffusionAdjusted.bounceRate * 100).toFixed(1)}% | ${(d.upliftBounce * 100).toFixed(1)}pp |`);

    if (report.diffusion.inflectionPoints.length > 0) {
      lines.push(`\n**Inflection Points:**`);
      for (const ip of report.diffusion.inflectionPoints) {
        lines.push(`- Tick ${ip.tick} (${ip.impact}): ${ip.reason}`);
      }
    }
  }

  if (report.phForecast) {
    const ph = report.phForecast;
    lines.push(`\n## Product Hunt Forecast`);
    lines.push(`\n### Expected Upvotes by Window`);
    lines.push(`| Window | Expected |`);
    lines.push(`|--------|----------|`);
    lines.push(`| First hour | ${ph.upvotesByWindow.firstHour} |`);
    lines.push(`| First 4 hours | ${ph.upvotesByWindow.first4Hours} |`);
    lines.push(`| First 24 hours | ${ph.upvotesByWindow.first24Hours} |`);
    lines.push(`\n### Comment Velocity`);
    lines.push(`- Expected comments (24h): ${ph.commentVelocity.expectedComments24h}`);
    lines.push(`- Peak activity hour: ${ph.commentVelocity.peakHour}:00 PT`);
    if (ph.makerCommentImpact) {
      lines.push(`\n### Maker Comment Impact: **${ph.makerCommentImpact.toUpperCase()}**`);
    }
    if (ph.topicFitScore !== undefined) {
      lines.push(`### Topic Fit Score: ${(ph.topicFitScore * 100).toFixed(0)}%`);
    }
    if (ph.momentumRisks.length > 0) {
      lines.push(`\n### Momentum Risks`);
      for (const risk of ph.momentumRisks) {
        const icon = risk.severity === 'high' ? '[HIGH]' : risk.severity === 'medium' ? '[MED]' : '[LOW]';
        lines.push(`- ${icon} **${risk.flag}**: ${risk.detail}`);
      }
    }
  }

  lines.push(`\n## Persona Reports`);
  for (const persona of report.personaReports) {
    lines.push(`\n### ${persona.personaId}${persona.isFallback ? ' (FALLBACK)' : ''}`);
    lines.push(`**Primary Action:** ${persona.primaryAction}`);
    lines.push(`**Primary Friction:** ${persona.primaryFriction}`);
    lines.push(`**One-line Fix:** ${persona.oneLineFix}`);

    if (persona.trustBoosters.length > 0) {
      lines.push(`**Trust Boosters:** ${persona.trustBoosters.join('; ')}`);
    }
    if (persona.trustKillers.length > 0) {
      lines.push(`**Trust Killers:** ${persona.trustKillers.join('; ')}`);
    }
  }

  return lines.join('\n');
}
