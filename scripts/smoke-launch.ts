#!/usr/bin/env tsx
/**
 * End-to-end smoke test for the full launch pipeline:
 *   simulate -> readiness -> launch-prep -> launch-exec -> confirm
 *
 * Runs with DEMO_MODE=true and DATABASE_URL=memory:// (no external deps).
 *
 * Usage:
 *   pnpm ci:smoke:launch   (starts server internally)
 *   BASE_URL=http://localhost:3000 pnpm smoke:launch  (against running server)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 120;

interface SmokeResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

const results: SmokeResult[] = [];
let runId: string | undefined;

function log(msg: string) {
  console.log(`[smoke-launch] ${msg}`);
}

function fail(step: string, msg: string): never {
  console.error(`[smoke-launch] FAIL at ${step}: ${msg}`);
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
  console.log('\n=== Launch Smoke Test Summary ===');
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
    // Return body for expected error assertions
    return { _httpStatus: res.status, ...body };
  }
  return body;
}

async function main() {
  log(`Base URL: ${BASE_URL}`);
  log(`DEMO_MODE: ${process.env.DEMO_MODE || '(not set)'}`);
  console.log('');

  // Step 1: Create and complete a run
  await step('1. Create run', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagline: 'Launch Smoke Test — Token launcher for DAOs',
        description: 'A tool that helps DAOs launch governance tokens with simulation-validated parameters.',
        pricingModel: 'freemium',
        url: 'https://example.com',
        category: 'Web3',
        tags: ['DeFi', 'DAO'],
        runMode: 'quick',
      }),
    });
    if (!data.runId) throw new Error('No runId');
    runId = data.runId;
    return `runId=${runId}`;
  });

  // Step 2: Start simulation
  await step('2. Start simulation', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/start`, { method: 'POST' });
    return `status=${data.status ?? data.queued ?? 'started'}`;
  });

  // Step 3: Poll until completed
  await step('3. Poll until completed', async () => {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await fetchJSON(`${BASE_URL}/api/run/${runId}`);
      const status = data.run?.status || data.status;
      if (status === 'completed') return `completed after ${i + 1} polls`;
      if (status === 'failed') throw new Error(`Run failed: ${data.run?.error}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('Timed out');
  });

  // Step 4: Fetch readiness + launch draft
  await step('4. GET /api/run/:id/launch (readiness + draft)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch`);
    if (!data.readiness) throw new Error('No readiness data');
    if (!data.launchInput) throw new Error('No launch input draft');
    if (!data.readiness.status) throw new Error('Readiness missing status');
    if (typeof data.readiness.confidence !== 'number') throw new Error('Readiness missing confidence');
    return `readiness=${data.readiness.status}, confidence=${(data.readiness.confidence * 100).toFixed(0)}%, blockers=${data.readiness.blockers?.length ?? 0}`;
  });

  // Step 5: Submit launch payload
  await step('5. POST /api/run/:id/launch (submit payload)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'DAO Launch Token',
        symbol: 'DLT',
        description: 'Governance token for DAO Launch Smoke Test',
        website: 'https://example.com',
        antiSnipe: false,
        bundled: false,
      }),
    });
    if (!data.success) throw new Error('Save failed');
    if (!data.launchRecord) throw new Error('No launch record');
    if (!data.launchRecord.idempotencyKey) throw new Error('Missing idempotency key');
    return `record=${data.launchRecord.status}, key=${data.launchRecord.idempotencyKey}`;
  });

  // Step 6: Execute launch (gets deep-link or tx data)
  await step('6. POST /api/run/:id/launch/execute', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch/execute`, { method: 'POST' });
    if (!data.success) throw new Error(`Execute failed: ${data.error}`);
    if (!data.plan) throw new Error('No execution plan');
    if (!data.plan.mode) throw new Error('Plan missing mode');
    return `mode=${data.plan.mode}, record=${data.launchRecord?.status}`;
  });

  // Step 7: Confirm with mock tx hash
  const mockTxHash = '0x' + 'a'.repeat(64);
  await step('7. POST /api/run/:id/launch/confirm (mock tx)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: mockTxHash,
        status: 'submitted',
      }),
    });
    if (!data.success) throw new Error('Confirm failed');
    if (data.launchRecord?.status !== 'submitted') throw new Error(`Expected status=submitted, got ${data.launchRecord?.status}`);
    if (data.launchRecord?.txHash !== mockTxHash) throw new Error('TX hash mismatch');
    return `status=${data.launchRecord.status}, txHash=${mockTxHash.slice(0, 10)}...`;
  });

  // Step 8: Confirm success
  const mockTokenAddr = '0x' + 'b'.repeat(40);
  await step('8. POST /api/run/:id/launch/confirm (success)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: mockTxHash,
        tokenAddress: mockTokenAddr,
        status: 'success',
      }),
    });
    if (!data.success) throw new Error('Confirm success failed');
    if (data.launchRecord?.status !== 'success') throw new Error(`Expected status=success, got ${data.launchRecord?.status}`);
    if (data.launchRecord?.tokenAddress !== mockTokenAddr) throw new Error('Token address mismatch');
    return `status=${data.launchRecord.status}, token=${mockTokenAddr.slice(0, 10)}...`;
  });

  // Step 9: Verify launch status endpoint
  await step('9. GET /api/run/:id/launch/status', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch/status`);
    if (!data.launchRecord) throw new Error('No launch record');
    if (data.launchRecord.status !== 'success') throw new Error(`Expected success, got ${data.launchRecord.status}`);
    if (!data.events || data.events.length === 0) throw new Error('No launch events');

    const eventTypes = data.events.map((e: any) => e.type);
    if (!eventTypes.includes('LAUNCH_SUBMITTED')) throw new Error('Missing LAUNCH_SUBMITTED event');
    if (!eventTypes.includes('LAUNCH_CONFIRMED')) throw new Error('Missing LAUNCH_CONFIRMED event');

    return `status=${data.launchRecord.status}, events=${data.events.length}`;
  });

  // Step 10: Verify re-execution blocked (idempotency)
  await step('10. POST execute blocked for success (idempotency)', async () => {
    const data = await fetchJSON(`${BASE_URL}/api/run/${runId}/launch/execute`, { method: 'POST' });
    if (data._httpStatus !== 409) throw new Error(`Expected 409 Conflict, got ${data._httpStatus || 'success'}`);
    return `correctly blocked with 409`;
  });

  // Summary
  printSummary();
  const allPassed = results.every(r => r.ok);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('[smoke-launch] Fatal error:', err);
  process.exit(1);
});
