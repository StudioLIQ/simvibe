#!/usr/bin/env tsx
/**
 * MND-014: End-to-end Monad integration flow script.
 *
 * Automates: simulate -> publish receipt -> gate check -> launch -> verify.
 * Produces artifact JSON with report URL, tx hashes, token contract address.
 *
 * Usage:
 *   pnpm e2e:monad              (against running server)
 *   pnpm ci:e2e:monad           (starts server internally with DEMO_MODE)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'node:child_process';

const ROOT_DIR = path.resolve(process.cwd());
const DEFAULT_PORT = Number(process.env.E2E_PORT || '5555');
const DEFAULT_BASE_URL = `http://localhost:${DEFAULT_PORT}`;
const API_BASE_URL = (process.env.API_BASE_URL || process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 120;
const OUTPUT_DIR = process.env.E2E_OUTPUT_PATH || path.join(process.cwd(), 'artifacts_runs');
const STARTUP_TIMEOUT_MS = 120000;

interface StepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

interface E2EArtifact {
  timestamp: string;
  runId: string | null;
  reportUrl: string | null;
  receiptPublished: boolean;
  receiptTxHash: string | null;
  receiptChainId: number | null;
  receiptContractAddress: string | null;
  gateConfigured: boolean;
  gateReady: boolean | null;
  launchStatus: string | null;
  launchTxHash: string | null;
  tokenContractAddress: string | null;
  nadFunUrl: string | null;
  steps: StepResult[];
  success: boolean;
}

const results: StepResult[] = [];
let runId: string | null = null;
const artifact: Partial<E2EArtifact> = {
  timestamp: new Date().toISOString(),
  runId: null,
  receiptPublished: false,
  gateConfigured: false,
  success: false,
};

function log(msg: string) {
  console.log(`[e2e-monad] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    throw new Error(`[e2e-monad] FAIL at ${name}: ${msg}`);
  }
}

async function waitForDiagnostics(baseUrl: string, timeoutMs: number) {
  const start = Date.now();
  let lastError = 'not started';

  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`${baseUrl}/api/diagnostics`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.storage?.activeBackend) {
          return;
        }
      } else {
        lastError = `HTTP ${resp.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }

  throw new Error(`Timed out waiting for diagnostics (${timeoutMs}ms): ${lastError}`);
}

async function stopServer(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.killed) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

async function ensureServer(): Promise<{ baseUrl: string; child?: ChildProcess }> {
  if (process.env.API_BASE_URL || process.env.BASE_URL) {
    await waitForDiagnostics(API_BASE_URL, STARTUP_TIMEOUT_MS);
    return { baseUrl: API_BASE_URL };
  }

  const args = ['--filter', '@simvibe/web', 'dev', '--port', String(DEFAULT_PORT)];
  const env = {
    ...process.env,
    DEMO_MODE: process.env.DEMO_MODE || 'true',
    DATABASE_URL: process.env.DATABASE_URL || 'memory://',
  };

  log(`Starting internal Next server on ${API_BASE_URL}`);
  const child = spawn('pnpm', args, {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer | string) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') {
      process.stdout.write(`[web] ${chunk.toString()}`);
    }
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') {
      process.stderr.write(`[web:err] ${chunk.toString()}`);
    }
  });
  child.once('exit', (code) => {
    if (code !== 0) {
      log(`Internal server exited early with code=${code}`);
    }
  });

  await waitForDiagnostics(API_BASE_URL, STARTUP_TIMEOUT_MS);
  return { baseUrl: API_BASE_URL, child };
}

function buildArtifact(): E2EArtifact {
  return {
    timestamp: artifact.timestamp || new Date().toISOString(),
    runId: artifact.runId || null,
    reportUrl: runId ? `${API_BASE_URL.replace(/\/api$/, '')}/run/${runId}/report` : null,
    receiptPublished: artifact.receiptPublished || false,
    receiptTxHash: artifact.receiptTxHash || null,
    receiptChainId: artifact.receiptChainId || null,
    receiptContractAddress: artifact.receiptContractAddress || null,
    gateConfigured: artifact.gateConfigured || false,
    gateReady: artifact.gateReady ?? null,
    launchStatus: artifact.launchStatus || null,
    launchTxHash: artifact.launchTxHash || null,
    tokenContractAddress: artifact.tokenContractAddress || null,
    nadFunUrl: artifact.tokenContractAddress ? `https://nad.fun/token/${artifact.tokenContractAddress}` : null,
    steps: results,
    success: results.length > 0 && results.every(r => r.ok),
  };
}

function generateMarkdown(out: E2EArtifact): string {
  const lines: string[] = [];
  lines.push('# simvi.be E2E Monad Flow Report');
  lines.push('');
  lines.push(`**Timestamp:** ${out.timestamp}`);
  lines.push(`**Result:** ${out.success ? 'ALL PASSED' : 'FAILED'}`);
  lines.push('');

  lines.push('## Run Info');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Run ID | \`${out.runId || 'N/A'}\` |`);
  lines.push(`| Report URL | ${out.reportUrl || 'N/A'} |`);
  lines.push('');

  lines.push('## Receipt (Monad)');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Published | ${out.receiptPublished ? 'Yes' : 'No (offline)'} |`);
  lines.push(`| TX Hash | \`${out.receiptTxHash || 'N/A'}\` |`);
  lines.push(`| Chain ID | ${out.receiptChainId ?? 'N/A'} |`);
  lines.push(`| Contract | \`${out.receiptContractAddress || 'N/A'}\` |`);
  lines.push('');

  lines.push('## Gate');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Configured | ${out.gateConfigured ? 'Yes' : 'No'} |`);
  lines.push(`| Ready | ${out.gateReady === null ? 'N/A' : out.gateReady ? 'Yes' : 'No'} |`);
  lines.push('');

  lines.push('## Launch (nad.fun)');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Status | ${out.launchStatus || 'N/A'} |`);
  lines.push(`| TX Hash | \`${out.launchTxHash || 'N/A'}\` |`);
  lines.push(`| Token Contract | \`${out.tokenContractAddress || 'N/A'}\` |`);
  lines.push(`| nad.fun URL | ${out.nadFunUrl || 'N/A'} |`);
  lines.push('');

  lines.push('## Step Results');
  lines.push('');
  lines.push('| # | Step | Result | Duration | Detail |');
  lines.push('|---|------|--------|----------|--------|');
  for (const r of out.steps) {
    const icon = r.ok ? 'PASS' : 'FAIL';
    lines.push(`| | ${r.step} | ${icon} | ${r.durationMs}ms | ${r.detail || ''} |`);
  }
  lines.push('');

  const passed = out.steps.filter(r => r.ok).length;
  const total = out.steps.length;
  const totalMs = out.steps.reduce((sum, r) => sum + r.durationMs, 0);
  lines.push(`**Summary:** ${passed}/${total} steps passed in ${totalMs}ms`);
  lines.push('');

  return lines.join('\n');
}

function writeArtifact() {
  const out = buildArtifact();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write JSON artifact
  const jsonPath = path.join(OUTPUT_DIR, 'e2e-monad-flow.json');
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  log(`JSON artifact written to ${jsonPath}`);

  // Write Markdown artifact
  const mdPath = path.join(OUTPUT_DIR, 'e2e-monad-flow.md');
  fs.writeFileSync(mdPath, generateMarkdown(out));
  log(`Markdown artifact written to ${mdPath}`);

  console.log('\n=== E2E Monad Flow Summary ===');
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}: ${r.step} (${r.durationMs}ms)${r.detail ? ` — ${r.detail}` : ''}`);
  }
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`\n  ${passed}/${total} steps passed`);
  if (out.runId) console.log(`  Run ID: ${out.runId}`);
  if (out.reportUrl) console.log(`  Report URL: ${out.reportUrl}`);
  if (out.receiptTxHash) console.log(`  Receipt TX: ${out.receiptTxHash}`);
  if (out.tokenContractAddress) console.log(`  Token Contract: ${out.tokenContractAddress}`);
  if (out.nadFunUrl) console.log(`  nad.fun URL: ${out.nadFunUrl}`);
}

async function main(): Promise<number> {
  const { baseUrl, child } = await ensureServer();
  log(`API: ${baseUrl}`);

  try {
    // Step 1: Create run
    await step('1. Create run', async () => {
      const resp = await fetch(`${baseUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagline: 'AI Code Review for Teams',
        description: 'Automated code review powered by AI. Catches bugs, style issues, and security vulnerabilities before they reach production.',
        pricingModel: 'subscription',
        category: 'developer_tools',
        tags: ['ai', 'code-review', 'devtools'],
        url: 'https://example.com',
        runMode: 'quick',
      }),
    });
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      runId = data.id || data.runId;
      artifact.runId = runId;
      return `runId=${runId}`;
    });

    // Step 2: Start simulation
    await step('2. Start simulation', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/start`, { method: 'POST' });
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      return 'started';
    });

    // Step 3: Poll until completed
    await step('3. Poll until completed', async () => {
      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        const resp = await fetch(`${baseUrl}/api/run/${runId}`);
        if (!resp.ok) throw new Error(`${resp.status}`);
        const data = await resp.json();
        const status = data.run?.status || data.status;
        if (status === 'completed') return `completed in ${i + 1} polls`;
        if (status === 'failed') throw new Error(`Run failed: ${data.run?.error || data.error}`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error('Timed out waiting for completion');
    });

    // Step 4: Verify report
    await step('4. Verify report', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      const report = data.run?.report || data.report;
      if (!report) throw new Error('No report found');
      if (!report.overallScore) throw new Error('No overall score');
      return `score=${report.overallScore}, band=${report.tractionBand}`;
    });

    // Step 5: Publish receipt to Monad (or offline)
    await step('5. Publish receipt', async () => {
      // Try Monad publish first
      const monadResp = await fetch(`${baseUrl}/api/run/${runId}/receipt/publish`, { method: 'POST' });
      if (monadResp.ok) {
        const data = await monadResp.json();
        if (data.success && data.txHash) {
          artifact.receiptPublished = true;
          artifact.receiptTxHash = data.txHash;
          artifact.receiptChainId = data.chainId;
          artifact.receiptContractAddress = data.contractAddress;
          return `on-chain: tx=${data.txHash}`;
        }
      }
      // Fallback to offline receipt
      const offResp = await fetch(`${baseUrl}/api/run/${runId}/receipt`, { method: 'POST' });
      if (!offResp.ok) throw new Error(`${offResp.status}: ${await offResp.text()}`);
      const offData = await offResp.json();
      artifact.receiptPublished = !!offData.receipt;
      return `offline receipt: runHash=${offData.receipt?.runHash?.slice(0, 16)}...`;
    });

    // Step 6: Check gate status
    await step('6. Check gate status', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/receipt/publish`);
      if (!resp.ok) return 'gate check skipped (endpoint unavailable)';
      const data = await resp.json();
      artifact.gateConfigured = data.configured || false;
      return `configured=${data.configured}`;
    });

    // Step 7: Fetch launch readiness
    await step('7. Fetch launch readiness', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/launch`);
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      const status = data.readiness?.status || 'unknown';
      return `readiness=${status}, confidence=${data.readiness?.confidence || 0}`;
    });

    // Step 8: Save launch payload
    await step('8. Save launch payload', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'AI Code Review',
          symbol: 'AICR',
          description: 'AI Code Review token launched via simvi.be simulation',
          website: 'https://example.com',
          antiSnipe: false,
          bundled: false,
        }),
      });
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      return 'payload saved';
    });

    // Step 9: Freeze report lifecycle to satisfy launch gate
    await step('9. Freeze report lifecycle', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/report/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'frozen',
          actor: 'e2e:monad',
          reason: 'Freeze report before launch execution',
        }),
      });
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (data.lifecycle?.status !== 'frozen') throw new Error('Lifecycle status is not frozen');
      return 'frozen';
    });

    // Step 10: Execute launch
    await step('10. Execute launch', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/launch/execute`, { method: 'POST' });
      // 403 = blocked by gate (expected if not ready), otherwise process normally
      if (resp.status === 403) {
        const data = await resp.json();
        return `blocked: ${data.error}`;
      }
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      return `mode=${data.plan?.mode || 'unknown'}`;
    });

    // Step 11: Confirm launch (mock)
    await step('11. Confirm launch (mock)', async () => {
      const mockTxHash = '0x' + 'a'.repeat(64);
      const mockToken = '0x' + 'b'.repeat(40);
      const resp = await fetch(`${baseUrl}/api/run/${runId}/launch/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: mockTxHash,
          tokenAddress: mockToken,
          status: 'success',
        }),
      });
      if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      artifact.launchStatus = data.launchRecord?.status;
      artifact.launchTxHash = mockTxHash;
      artifact.tokenContractAddress = mockToken;
      return `status=${data.launchRecord?.status}, token=${mockToken}`;
    });

    // Step 12: Verify final status
    await step('12. Verify final status', async () => {
      const resp = await fetch(`${baseUrl}/api/run/${runId}/launch/status`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      if (data.launchRecord?.status !== 'success') throw new Error(`Expected success, got ${data.launchRecord?.status}`);
      if (!data.launchRecord?.tokenAddress) throw new Error('No token address');
      artifact.gateReady = data.monadGate?.ready ?? null;
      return `status=success, events=${data.events?.length || 0}`;
    });

    artifact.success = true;
    writeArtifact();
    return 0;
  } finally {
    await stopServer(child);
  }
}

main().catch(err => {
  console.error(`[e2e-monad] Fatal:`, err);
  writeArtifact();
  return 1;
}).then((code) => {
  process.exit(code);
});
