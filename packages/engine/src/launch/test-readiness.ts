/**
 * Fixture tests for launch-readiness gate.
 * Run: pnpm --filter @simvibe/engine test:readiness
 */

import type { Report } from '@simvibe/shared';
import { evaluateLaunchReadiness, type ReadinessPolicyConfig } from './readiness-gate';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

// --- Fixtures ---

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    runId: 'run_test123',
    generatedAt: new Date().toISOString(),
    tractionBand: 'moderate',
    confidence: 'medium',
    metrics: {
      expectedUpvotes: 50,
      expectedSignups: 0.3,
      expectedPays: 0.1,
      bounceRate: 0.4,
      shareRate: 0.15,
      disagreementScore: 0.3,
      uncertaintyScore: 0.3,
    },
    scores: {
      clarity: 65,
      credibility: 55,
      differentiation: 50,
      pricingFraming: 60,
      conversionReadiness: 45,
    },
    overallScore: 55,
    frictionList: [],
    personaReports: [
      {
        personaId: 'cynical_engineer',
        primaryAction: 'SIGNUP',
        actionProbabilities: { SIGNUP: 0.4, BOUNCE: 0.3, UPVOTE: 0.2, COMMENT: 0.1 },
        primaryFriction: 'Vague technical claims',
        oneLineFix: 'Add concrete benchmarks',
        trustBoosters: ['Open source'],
        trustKillers: ['No demo'],
        isFallback: false,
      },
    ],
    oneLineFixes: [],
    warnings: [],
    calibrationApplied: false,
    ...overrides,
  };
}

const defaultPolicy: ReadinessPolicyConfig = {
  minOverallScore: 40,
  maxUncertaintyScore: 0.7,
  maxDisagreementScore: 0.8,
  maxFallbackCount: 0,
  minClarityScore: 30,
  minCredibilityScore: 25,
  maxBounceRate: 0.85,
  forceOverride: false,
};

// --- Tests ---

console.log('\n--- 1. Passing report: all gates pass ---');
{
  const report = makeReport();
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'ready', 'Status is ready');
  assert(result.blockers.length === 0, 'No blockers');
  assert(result.confidence > 0, 'Confidence > 0');
  assert(result.evaluatedAt.length > 0, 'Has evaluatedAt timestamp');
}

console.log('\n--- 2. Low overall score: critical blocker ---');
{
  const report = makeReport({ overallScore: 20 });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'not_ready', 'Status is not_ready');
  assert(result.blockers.some(b => b.code === 'low_overall_score'), 'Has low_overall_score blocker');
  assert(result.blockers.find(b => b.code === 'low_overall_score')?.severity === 'critical', 'Is critical');
}

console.log('\n--- 3. High uncertainty: warning blocker ---');
{
  const report = makeReport({
    metrics: {
      expectedUpvotes: 50,
      expectedSignups: 0.3,
      expectedPays: 0.1,
      bounceRate: 0.4,
      shareRate: 0.15,
      disagreementScore: 0.3,
      uncertaintyScore: 0.85,
    },
  });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'ready', 'Still ready (warning, not critical)');
  assert(result.blockers.some(b => b.code === 'high_uncertainty'), 'Has high_uncertainty blocker');
  assert(result.blockers.find(b => b.code === 'high_uncertainty')?.severity === 'warning', 'Is warning');
}

console.log('\n--- 4. Run not completed: critical blocker ---');
{
  const report = makeReport();
  const result = evaluateLaunchReadiness(report, 'running', defaultPolicy);
  assert(result.status === 'not_ready', 'Status is not_ready');
  assert(result.blockers.some(b => b.code === 'run_not_completed'), 'Has run_not_completed blocker');
}

console.log('\n--- 5. Fallback agents: critical blocker ---');
{
  const report = makeReport({
    personaReports: [
      {
        personaId: 'cynical_engineer',
        primaryAction: 'BOUNCE',
        actionProbabilities: { BOUNCE: 0.8 },
        primaryFriction: 'Fallback',
        oneLineFix: 'N/A',
        trustBoosters: [],
        trustKillers: [],
        isFallback: true,
      },
    ],
  });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'not_ready', 'Status is not_ready with fallback');
  assert(result.blockers.some(b => b.code === 'too_many_fallbacks'), 'Has too_many_fallbacks blocker');
}

console.log('\n--- 6. Force override: bypasses critical blockers ---');
{
  const report = makeReport({ overallScore: 10 });
  const overridePolicy = { ...defaultPolicy, forceOverride: true };
  const result = evaluateLaunchReadiness(report, 'completed', overridePolicy);
  assert(result.status === 'ready', 'Status is ready (forced)');
  assert(result.blockers.some(b => b.code === 'low_overall_score'), 'Still has blockers listed');
}

console.log('\n--- 7. Boundary: score exactly at threshold ---');
{
  const report = makeReport({ overallScore: 40 });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'ready', 'Status is ready at exact threshold');
  assert(!result.blockers.some(b => b.code === 'low_overall_score'), 'No low_overall_score blocker');
}

console.log('\n--- 8. Boundary: score just below threshold ---');
{
  const report = makeReport({ overallScore: 39 });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'not_ready', 'Status is not_ready just below threshold');
}

console.log('\n--- 9. Multiple blockers accumulate ---');
{
  const report = makeReport({
    overallScore: 15,
    scores: { clarity: 10, credibility: 10, differentiation: 20, pricingFraming: 15, conversionReadiness: 10 },
    metrics: {
      expectedUpvotes: 5,
      expectedSignups: 0.02,
      expectedPays: 0.01,
      bounceRate: 0.95,
      shareRate: 0.01,
      disagreementScore: 0.9,
      uncertaintyScore: 0.9,
    },
  });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.status === 'not_ready', 'Status is not_ready');
  assert(result.blockers.length >= 5, `Has ${result.blockers.length} blockers (expected >= 5)`);
  assert(result.recommendedActions.length >= 3, `Has ${result.recommendedActions.length} actions (expected >= 3)`);
}

console.log('\n--- 10. Deterministic: same input = same output ---');
{
  const report = makeReport({ overallScore: 55 });
  const r1 = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  const r2 = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(r1.status === r2.status, 'Same status');
  assert(r1.blockers.length === r2.blockers.length, 'Same blocker count');
  assert(r1.confidence === r2.confidence, 'Same confidence');
}

console.log('\n--- 11. Early stop reason: warning ---');
{
  const report = makeReport({ earlyStopReason: 'Time budget exhausted' });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.blockers.some(b => b.code === 'early_stop'), 'Has early_stop blocker');
  assert(result.blockers.find(b => b.code === 'early_stop')?.severity === 'warning', 'Is warning');
}

console.log('\n--- 12. High bounce rate: warning ---');
{
  const report = makeReport({
    metrics: {
      expectedUpvotes: 50,
      expectedSignups: 0.3,
      expectedPays: 0.1,
      bounceRate: 0.90,
      shareRate: 0.15,
      disagreementScore: 0.3,
      uncertaintyScore: 0.3,
    },
  });
  const result = evaluateLaunchReadiness(report, 'completed', defaultPolicy);
  assert(result.blockers.some(b => b.code === 'high_bounce_rate'), 'Has high_bounce_rate blocker');
}

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
