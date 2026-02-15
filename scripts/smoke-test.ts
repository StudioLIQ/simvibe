#!/usr/bin/env tsx
/**
 * End-to-end smoke test for the simvibe web API path.
 * Runs with DEMO_MODE=true and DATABASE_URL=memory:// (no external deps).
 *
 * Usage:
 *   DEMO_MODE=true DATABASE_URL=memory:// pnpm smoke
 *   # Or with a running dev server:
 *   BASE_URL=http://localhost:3000 pnpm smoke
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 120; // 2 minutes max

interface SmokeResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

const results: SmokeResult[] = [];
let runId: string | undefined;

function log(msg: string) {
  console.log(`[smoke] ${msg}`);
}

function fail(step: string, msg: string): never {
  console.error(`[smoke] FAIL at ${step}: ${msg}`);
  printSummary();
  process.exit(1);
}

async function step(name: string, fn: () => Promise<string | void>) {
  const start = Date.now();
  try {
    const detail = await fn();
    const dur = Date.now() - start;
    results.push({ step: name, ok: true, durationMs: dur, detail: detail || undefined });
    log(`PASS: ${name} (${dur}ms)${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const dur = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: name, ok: false, durationMs: dur, detail: msg });
    fail(name, msg);
  }
}

function printSummary() {
  console.log('\n=== Smoke Test Summary ===');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}: ${r.step} (${r.durationMs}ms)${r.detail ? ` — ${r.detail}` : ''}`);
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed, ${totalMs}ms`);
  if (runId) console.log(`Run ID: ${runId}`);
}

async function fetchJSON(url: string, options?: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  log(`Base URL: ${BASE_URL}`);
  log(`DEMO_MODE: ${process.env.DEMO_MODE || '(not set)'}`);
  log(`DATABASE_URL: ${process.env.DATABASE_URL || '(not set)'}`);
  console.log('');

  // Step 1: Check diagnostics endpoint
  await step('GET /api/diagnostics', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/diagnostics`);
    return `node=${data.nodeVersion}, storage=${data.storage?.activeBackend}, personas=${data.personaRegistry?.count}`;
  });

  // Step 2: Create a run
  await step('POST /api/run (create)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagline: 'Smoke Test Product — AI code review for teams',
        description: 'An automated code review tool that helps teams ship better code faster. Uses AI to catch bugs, suggest improvements, and enforce coding standards.',
        pricingModel: 'freemium',
        url: 'https://example.com',
        category: 'Developer Tools',
        tags: ['AI', 'DevTools'],
        runMode: 'quick',
      }),
    });

    if (!data.runId) throw new Error('No runId in response');
    runId = data.runId;
    return `runId=${runId}, status=${data.status}`;
  });

  // Step 3: Start the run
  await step('POST /api/run/:id/start', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/start`, {
      method: 'POST',
    });
    return `queued=${data.queued ?? 'inline'}, status=${data.status ?? 'started'}`;
  });

  // Step 4: Poll until completed
  await step('Poll /api/run/:id until completed', async () => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const data = await fetchJSON(`${BASE_URL}/api/run/${runId}`);
      const status = data.run?.status || data.status;

      if (status === 'completed') {
        return `completed after ${attempt + 1} polls`;
      }
      if (status === 'failed') {
        throw new Error(`Run failed: ${data.run?.error || 'unknown'}`);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`Timed out after ${MAX_POLL_ATTEMPTS} polls`);
  });

  // Step 5: Assert report presence
  await step('Assert report present', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}`);
    const report = data.run?.report;

    if (!report) throw new Error('No report in run data');
    if (!report.runId) throw new Error('Report missing runId');
    if (typeof report.overallScore !== 'number') throw new Error('Report missing overallScore');
    if (!report.tractionBand) throw new Error('Report missing tractionBand');
    if (!report.metrics) throw new Error('Report missing metrics');
    if (!report.frictionList || report.frictionList.length === 0) throw new Error('Report has no friction items');
    if (!report.personaReports || report.personaReports.length === 0) throw new Error('Report has no persona reports');

    return `score=${report.overallScore}, traction=${report.tractionBand}, personas=${report.personaReports.length}, frictions=${report.frictionList.length}`;
  });

  // Step 6: Assert metrics shape
  await step('Assert metrics shape', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}`);
    const m = data.run?.report?.metrics;

    if (typeof m.expectedUpvotes !== 'number') throw new Error('Missing expectedUpvotes');
    if (typeof m.expectedSignups !== 'number') throw new Error('Missing expectedSignups');
    if (typeof m.expectedPays !== 'number') throw new Error('Missing expectedPays');
    if (typeof m.bounceRate !== 'number') throw new Error('Missing bounceRate');
    if (typeof m.shareRate !== 'number') throw new Error('Missing shareRate');

    return `upvotes=${m.expectedUpvotes.toFixed(2)}, signups=${(m.expectedSignups * 100).toFixed(1)}%, bounce=${(m.bounceRate * 100).toFixed(1)}%`;
  });

  // Summary
  printSummary();
  const allPassed = results.every(r => r.ok);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('[smoke] Fatal error:', err);
  process.exit(1);
});
