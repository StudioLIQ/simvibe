#!/usr/bin/env tsx
/**
 * E2E test: nad.fun-first critical path
 *
 * create nad_fun run -> simulate -> report (nadFunForecast) -> launch readiness -> launch execution
 *
 * Usage:
 *   pnpm e2e:nad:fun
 *   DEMO_MODE=true DATABASE_URL=memory:// pnpm ci:e2e:nad:fun
 *   E2E_RUN_MODE=deep PRODUCT_COUNT=2 MIN_READY_LAUNCHES=1 pnpm e2e:nad:fun
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildE2ENadScenarios, type E2ERunMode } from './fixtures/e2e-nad-products';

const ROOT_DIR = path.resolve(process.cwd());
const DEFAULT_PORT = Number(process.env.E2E_PORT || '5555');
const DEFAULT_BASE_URL = `http://localhost:${DEFAULT_PORT}`;
const BASE_URL = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const RUN_MODE: E2ERunMode = process.env.E2E_RUN_MODE === 'deep' ? 'deep' : 'quick';
const PRODUCT_COUNT = Math.max(1, Number.parseInt(process.env.PRODUCT_COUNT || '3', 10) || 3);
const MIN_READY_LAUNCHES = Math.max(0, Number.parseInt(process.env.MIN_READY_LAUNCHES || '1', 10) || 1);
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180;
const REQUEST_TIMEOUT_MS = 30000;
const STARTUP_TIMEOUT_MS = 120000;
const OUTPUT_PATH = process.env.E2E_OUTPUT_PATH || path.join(ROOT_DIR, 'artifacts_runs', 'e2e-nad-fun-summary.json');

type ReadinessStatus = 'ready' | 'not_ready';
type LaunchStatus = 'draft' | 'confirmed' | 'submitted' | 'success' | 'failed';

interface ScenarioResult {
  scenarioId: string;
  label: string;
  runId: string;
  reportScore: number;
  tractionBand: string;
  readiness: ReadinessStatus;
  launchStatus: LaunchStatus | 'blocked';
  launchBlockedReason?: string;
  nadFunForecastOk: boolean;
}

interface HttpJsonResult {
  _httpStatus: number;
  [key: string]: any;
}

function log(message: string) {
  console.log(`[e2e-nad-fun] ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeHex(char: string, length: number): string {
  return `0x${char.repeat(length)}`;
}

function chooseHexChar(index: number): string {
  const chars = ['a', 'b', 'c', 'd', 'e', 'f', '1', '2', '3', '4', '5', '6'];
  return chars[index % chars.length];
}

async function requestJSON(url: string, init?: RequestInit, allowError = false): Promise<HttpJsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: any;

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    const result: HttpJsonResult = {
      _httpStatus: response.status,
      ...(body && typeof body === 'object' ? body : { body }),
    };

    if (!response.ok && !allowError) {
      throw new Error(`HTTP ${response.status} ${url}: ${text}`);
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForDiagnostics(baseUrl: string, timeoutMs: number) {
  const start = Date.now();
  let lastError = 'not started';

  while (Date.now() - start < timeoutMs) {
    try {
      const diagnostics = await requestJSON(`${baseUrl}/api/diagnostics`);
      if (diagnostics.storage?.activeBackend) {
        log(`Diagnostics ready: storage=${diagnostics.storage.activeBackend}, personas=${diagnostics.personaRegistry?.count ?? 'n/a'}`);
        return;
      }
      lastError = 'diagnostics missing storage payload';
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
  if (process.env.BASE_URL) {
    log(`Using external server: ${BASE_URL}`);
    await waitForDiagnostics(BASE_URL, STARTUP_TIMEOUT_MS);
    return { baseUrl: BASE_URL };
  }

  const args = ['--filter', '@simvibe/web', 'dev', '--port', String(DEFAULT_PORT)];
  const env = {
    ...process.env,
    DEMO_MODE: process.env.DEMO_MODE || 'true',
    DATABASE_URL: process.env.DATABASE_URL || 'memory://',
  };

  log(`Starting internal Next server on ${BASE_URL}`);
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

  await waitForDiagnostics(BASE_URL, STARTUP_TIMEOUT_MS);
  return { baseUrl: BASE_URL, child };
}

async function pollRunCompleted(baseUrl: string, runId: string): Promise<any> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const data = await requestJSON(`${baseUrl}/api/run/${runId}`);
    const status = data.run?.status || data.status;

    if (status === 'completed') return data.run;
    if (status === 'failed') {
      throw new Error(`Run failed: ${data.run?.error || 'unknown error'}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Run ${runId} timed out after ${MAX_POLL_ATTEMPTS} polls`);
}

async function runScenario(
  baseUrl: string,
  scenario: ReturnType<typeof buildE2ENadScenarios>[number],
  index: number,
): Promise<ScenarioResult> {
  log(`Scenario ${index + 1}/${PRODUCT_COUNT}: ${scenario.label}`);

  // Step 1: Create nad.fun run
  const created = await requestJSON(`${baseUrl}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario.input),
  });
  if (!created.runId) {
    throw new Error(`Create run failed for ${scenario.id}: missing runId`);
  }
  const runId = created.runId as string;
  log(`  created runId=${runId}`);

  // Step 2: Start simulation
  await requestJSON(`${baseUrl}/api/run/${runId}/start`, {
    method: 'POST',
  });

  // Step 3: Poll to completion
  const completedRun = await pollRunCompleted(baseUrl, runId);
  const report = completedRun.report;
  if (!report) throw new Error(`Run ${runId} completed without report`);
  if (typeof report.overallScore !== 'number') throw new Error(`Run ${runId} report missing overallScore`);

  // Step 4: Assert nad.fun forecast
  const hasNadFunForecast = !!report.nadFunForecast;
  if (!hasNadFunForecast) {
    throw new Error(`Run ${runId} report missing nadFunForecast (expected for platformMode=nad_fun)`);
  }

  // Step 5: Check launch readiness
  const launchData = await requestJSON(`${baseUrl}/api/run/${runId}/launch`);
  const readiness = launchData.readiness?.status as ReadinessStatus | undefined;
  if (!readiness) throw new Error(`Run ${runId} launch readiness missing`);

  // Step 6: Save launch payload
  const launchPayload = {
    ...(launchData.launchInput || {}),
    name: scenario.input.nadFunSubmission.tokenName,
    symbol: scenario.input.nadFunSubmission.tokenSymbol,
    description: scenario.input.description,
    website: 'https://example.com/token',
    x: 'https://x.com/simvibe',
    telegram: 'https://t.me/simvibe',
    antiSnipe: scenario.input.nadFunSubmission.antiSnipe,
    bundled: scenario.input.nadFunSubmission.bundled,
  };

  const savedLaunch = await requestJSON(`${baseUrl}/api/run/${runId}/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(launchPayload),
  });
  if (!savedLaunch.success || !savedLaunch.launchRecord) {
    throw new Error(`Run ${runId} launch payload save failed`);
  }

  // Step 7: Handle not_ready path
  if (readiness === 'not_ready') {
    const blockedExec = await requestJSON(`${baseUrl}/api/run/${runId}/launch/execute`, { method: 'POST' }, true);
    if (blockedExec._httpStatus !== 403) {
      throw new Error(`Run ${runId} expected execute 403 when not_ready, got ${blockedExec._httpStatus}`);
    }

    return {
      scenarioId: scenario.id,
      label: scenario.label,
      runId,
      reportScore: report.overallScore,
      tractionBand: report.tractionBand,
      readiness,
      launchStatus: 'blocked',
      launchBlockedReason: blockedExec.error || 'Launch blocked by readiness gate',
      nadFunForecastOk: hasNadFunForecast,
    };
  }

  // Step 8: Execute launch
  const execute = await requestJSON(`${baseUrl}/api/run/${runId}/launch/execute`, { method: 'POST' });
  if (!execute.success || !execute.plan) {
    throw new Error(`Run ${runId} launch execute failed`);
  }

  // Step 9: Confirm launch (submitted -> success)
  const hex = chooseHexChar(index);
  const txHash = makeHex(hex, 64);
  const tokenAddress = makeHex(hex === 'f' ? 'e' : hex, 40);

  const confirmSubmitted = await requestJSON(`${baseUrl}/api/run/${runId}/launch/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash, status: 'submitted' }),
  });
  if (!confirmSubmitted.success || confirmSubmitted.launchRecord?.status !== 'submitted') {
    throw new Error(`Run ${runId} launch submit confirm failed`);
  }

  const confirmSuccess = await requestJSON(`${baseUrl}/api/run/${runId}/launch/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash, tokenAddress, status: 'success' }),
  });
  if (!confirmSuccess.success || confirmSuccess.launchRecord?.status !== 'success') {
    throw new Error(`Run ${runId} launch success confirm failed`);
  }

  // Step 10: Verify final status + events
  const status = await requestJSON(`${baseUrl}/api/run/${runId}/launch/status`);
  if (status.launchRecord?.status !== 'success') {
    throw new Error(`Run ${runId} launch status not success`);
  }
  const eventTypes = (status.events || []).map((e: any) => e.type);
  if (!eventTypes.includes('LAUNCH_SUBMITTED') || !eventTypes.includes('LAUNCH_CONFIRMED')) {
    throw new Error(`Run ${runId} launch events missing submit/confirm`);
  }

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    runId,
    reportScore: report.overallScore,
    tractionBand: report.tractionBand,
    readiness,
    launchStatus: 'success',
    nadFunForecastOk: hasNadFunForecast,
  };
}

async function writeSummary(results: ScenarioResult[]) {
  const readyCount = results.filter((r) => r.readiness === 'ready').length;
  const launchedCount = results.filter((r) => r.launchStatus === 'success').length;
  const blockedCount = results.filter((r) => r.launchStatus === 'blocked').length;
  const allNadForecastOk = results.every((r) => r.nadFunForecastOk);

  const payload = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      runMode: RUN_MODE,
      productCount: PRODUCT_COUNT,
      minReadyLaunches: MIN_READY_LAUNCHES,
    },
    summary: {
      totalRuns: results.length,
      readyCount,
      launchedCount,
      blockedCount,
      allNadFunForecastPresent: allNadForecastOk,
    },
    results,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  log(`Summary written: ${OUTPUT_PATH}`);
  log(`Ready=${readyCount}, launched=${launchedCount}, blocked=${blockedCount}, nadFunForecast=${allNadForecastOk ? 'ALL_OK' : 'MISSING'}`);
}

async function main() {
  log(`Config: baseUrl=${BASE_URL}, runMode=${RUN_MODE}, productCount=${PRODUCT_COUNT}`);
  log(`Platform: nad_fun (primary critical path)`);

  const scenarios = buildE2ENadScenarios(PRODUCT_COUNT, RUN_MODE);
  const { baseUrl, child } = await ensureServer();

  try {
    const results: ScenarioResult[] = [];
    for (let i = 0; i < scenarios.length; i++) {
      const result = await runScenario(baseUrl, scenarios[i], i);
      results.push(result);
      log(`  result: runId=${result.runId}, score=${result.reportScore}, readiness=${result.readiness}, launch=${result.launchStatus}, nadForecast=${result.nadFunForecastOk}`);
    }

    // Assert minimum ready launches
    const launchedCount = results.filter((r) => r.launchStatus === 'success').length;
    if (launchedCount < MIN_READY_LAUNCHES) {
      throw new Error(`Ready launch count ${launchedCount} is below required minimum ${MIN_READY_LAUNCHES}`);
    }

    // Assert all runs have nad.fun forecast
    const missingForecast = results.filter((r) => !r.nadFunForecastOk);
    if (missingForecast.length > 0) {
      throw new Error(`${missingForecast.length} runs missing nadFunForecast: ${missingForecast.map(r => r.runId).join(', ')}`);
    }

    await writeSummary(results);
    log('nad.fun E2E PASSED');
  } finally {
    await stopServer(child);
  }
}

main().catch((error) => {
  console.error('[e2e-nad-fun] Fatal error:', error);
  process.exit(1);
});
