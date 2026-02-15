#!/usr/bin/env tsx
/**
 * Migration Analytics: Compare PH-era vs nad.fun-era report quality.
 *
 * Fetches completed runs and computes per-era summary metrics.
 * Outputs JSON + console summary showing whether the nad.fun pivot
 * improved actionable output quality.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:5555 pnpm analytics:migration
 *   API_BASE_URL=https://api-simvibe.studioliq.com pnpm analytics:migration
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE_URL = (process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5555').replace(/\/+$/, '');
const FETCH_LIMIT = Number(process.env.FETCH_LIMIT || '500');
const REQUEST_TIMEOUT_MS = 30000;
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts_runs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'migration-analytics.json');

interface RunData {
  id: string;
  status: string;
  createdAt: string;
  input: {
    platformMode?: string;
    runMode?: string;
    tags?: string[];
  };
  report?: {
    overallScore?: number;
    tractionBand?: string;
    frictionList?: Array<{ trigger?: string; evidence?: string }>;
    oneLineFixes?: Array<{ fix?: string }>;
    scores?: {
      clarity?: number;
      credibility?: number;
      differentiation?: number;
      pricingFraming?: number;
      conversionReadiness?: number;
    };
    nadFunForecast?: {
      launchViabilityScore?: number;
      buyIntent?: number;
      holdIntent?: number;
      earlyChurnRisk?: number;
      snipeDumpRisk?: number;
      communitySpreadPotential?: number;
    };
    phForecast?: Record<string, unknown>;
    warnings?: string[];
    personaReports?: Array<{ personaId?: string }>;
  };
}

interface EraMetrics {
  era: string;
  runCount: number;
  avgOverallScore: number;
  avgFrictionCount: number;
  avgFixCount: number;
  avgPersonaCount: number;
  avgClarity: number;
  avgCredibility: number;
  avgDifferentiation: number;
  fallbackWarningRate: number;
  tractionBands: Record<string, number>;
}

function log(message: string) {
  console.log(`[analytics] ${message}`);
}

async function fetchRuns(): Promise<RunData[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/api/run?limit=${FETCH_LIMIT}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.runs) ? data.runs : [];
  } finally {
    clearTimeout(timeout);
  }
}

function classifyEra(run: RunData): 'nad_fun' | 'product_hunt' | 'generic' {
  const mode = run.input?.platformMode;
  if (mode === 'nad_fun') return 'nad_fun';
  if (mode === 'product_hunt') return 'product_hunt';
  return 'generic';
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeEraMetrics(era: string, runs: RunData[]): EraMetrics {
  const completedRuns = runs.filter(r => r.status === 'completed' && r.report);

  const scores = completedRuns.map(r => r.report?.overallScore ?? 0);
  const frictionCounts = completedRuns.map(r => (r.report?.frictionList || []).length);
  const fixCounts = completedRuns.map(r => (r.report?.oneLineFixes || []).length);
  const personaCounts = completedRuns.map(r => (r.report?.personaReports || []).length);
  const claritys = completedRuns.map(r => r.report?.scores?.clarity ?? 0);
  const credibilitys = completedRuns.map(r => r.report?.scores?.credibility ?? 0);
  const differentiations = completedRuns.map(r => r.report?.scores?.differentiation ?? 0);

  const withFallbackWarning = completedRuns.filter(r =>
    (r.report?.warnings || []).some(w => w.toLowerCase().includes('fallback'))
  ).length;

  const tractionBands: Record<string, number> = {};
  for (const run of completedRuns) {
    const band = run.report?.tractionBand || 'unknown';
    tractionBands[band] = (tractionBands[band] || 0) + 1;
  }

  return {
    era,
    runCount: completedRuns.length,
    avgOverallScore: Math.round(avg(scores) * 10) / 10,
    avgFrictionCount: Math.round(avg(frictionCounts) * 10) / 10,
    avgFixCount: Math.round(avg(fixCounts) * 10) / 10,
    avgPersonaCount: Math.round(avg(personaCounts) * 10) / 10,
    avgClarity: Math.round(avg(claritys) * 10) / 10,
    avgCredibility: Math.round(avg(credibilitys) * 10) / 10,
    avgDifferentiation: Math.round(avg(differentiations) * 10) / 10,
    fallbackWarningRate: completedRuns.length > 0
      ? Math.round((withFallbackWarning / completedRuns.length) * 100)
      : 0,
    tractionBands,
  };
}

function printComparison(nadFun: EraMetrics, ph: EraMetrics, generic: EraMetrics) {
  console.log('\n========================================');
  console.log(' Migration Analytics: PH vs nad.fun');
  console.log('========================================\n');

  const rows = [
    ['Metric', 'nad.fun', 'PH (legacy)', 'Generic'],
    ['---', '---', '---', '---'],
    ['Completed Runs', String(nadFun.runCount), String(ph.runCount), String(generic.runCount)],
    ['Avg Overall Score', String(nadFun.avgOverallScore), String(ph.avgOverallScore), String(generic.avgOverallScore)],
    ['Avg Friction Points', String(nadFun.avgFrictionCount), String(ph.avgFrictionCount), String(generic.avgFrictionCount)],
    ['Avg Fixes', String(nadFun.avgFixCount), String(ph.avgFixCount), String(generic.avgFixCount)],
    ['Avg Personas/Run', String(nadFun.avgPersonaCount), String(ph.avgPersonaCount), String(generic.avgPersonaCount)],
    ['Avg Clarity', String(nadFun.avgClarity), String(ph.avgClarity), String(generic.avgClarity)],
    ['Avg Credibility', String(nadFun.avgCredibility), String(ph.avgCredibility), String(generic.avgCredibility)],
    ['Avg Differentiation', String(nadFun.avgDifferentiation), String(ph.avgDifferentiation), String(generic.avgDifferentiation)],
    ['Fallback Warning %', `${nadFun.fallbackWarningRate}%`, `${ph.fallbackWarningRate}%`, `${generic.fallbackWarningRate}%`],
  ];

  for (const row of rows) {
    console.log(`| ${row.join(' | ')} |`);
  }

  console.log('\nTraction Band Distribution:');
  for (const era of [nadFun, ph, generic]) {
    if (era.runCount === 0) continue;
    const bands = Object.entries(era.tractionBands)
      .sort((a, b) => b[1] - a[1])
      .map(([band, count]) => `${band}=${count}`)
      .join(', ');
    console.log(`  ${era.era}: ${bands}`);
  }

  // Quality delta
  if (nadFun.runCount > 0 && ph.runCount > 0) {
    const scoreDelta = nadFun.avgOverallScore - ph.avgOverallScore;
    const frictionDelta = nadFun.avgFrictionCount - ph.avgFrictionCount;
    console.log(`\nQuality Delta (nad.fun - PH):`);
    console.log(`  Score: ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)}`);
    console.log(`  Friction depth: ${frictionDelta > 0 ? '+' : ''}${frictionDelta.toFixed(1)} points/run`);
    console.log(`  Fallback rate: ${nadFun.fallbackWarningRate - ph.fallbackWarningRate > 0 ? '+' : ''}${nadFun.fallbackWarningRate - ph.fallbackWarningRate}pp`);
  }
  console.log('');
}

async function main() {
  log(`Fetching runs from ${API_BASE_URL} (limit=${FETCH_LIMIT})`);

  const allRuns = await fetchRuns();
  log(`Total runs fetched: ${allRuns.length}`);

  const byEra: Record<string, RunData[]> = { nad_fun: [], product_hunt: [], generic: [] };
  for (const run of allRuns) {
    const era = classifyEra(run);
    byEra[era].push(run);
  }

  const nadFunMetrics = computeEraMetrics('nad_fun', byEra.nad_fun);
  const phMetrics = computeEraMetrics('product_hunt', byEra.product_hunt);
  const genericMetrics = computeEraMetrics('generic', byEra.generic);

  printComparison(nadFunMetrics, phMetrics, genericMetrics);

  const output = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    totalRunsFetched: allRuns.length,
    eras: { nad_fun: nadFunMetrics, product_hunt: phMetrics, generic: genericMetrics },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf-8');
  log(`Saved: ${OUTPUT_JSON}`);
}

main().catch((error) => {
  console.error('[analytics] Fatal error:', error);
  process.exit(1);
});
