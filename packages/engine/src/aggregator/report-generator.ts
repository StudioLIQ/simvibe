import type {
  AgentOutput,
  Report,
  PersonaReport,
  PersonaId,
  ActionType,
  CalibrationPrior,
  AggregatedMetrics,
  RunMode,
} from '@simvibe/shared';
import { applyCalibration } from '@simvibe/shared';
import { aggregateOutputs, type AggregationResult } from './aggregator';

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
  executedPersonaIds?: string[]
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
