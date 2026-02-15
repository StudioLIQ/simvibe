#!/usr/bin/env tsx
/**
 * Cross-service E2E: web API <-> queue(pg-boss) <-> worker <-> storage(Postgres)
 *
 * This test boots all services and verifies the end-to-end flow:
 * create run -> queue -> worker execution -> report patch/lifecycle -> launch -> receipt.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(process.cwd());

const WEB_PORT = Number(process.env.E2E_WEB_PORT || '5565');
const WORKER_PORT = Number(process.env.E2E_WORKER_PORT || '8091');
const POSTGRES_PORT = Number(process.env.E2E_PG_PORT || '55432');
const POSTGRES_USER = process.env.E2E_PG_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.E2E_PG_PASSWORD || 'postgres';
const POSTGRES_DB = process.env.E2E_PG_DB || 'simvibe';
const POSTGRES_IMAGE = process.env.E2E_PG_IMAGE || 'postgres:16-alpine';

const API_BASE_URL = `http://localhost:${WEB_PORT}`;
const WORKER_BASE_URL = `http://localhost:${WORKER_PORT}`;
const DATABASE_URL = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`;

const REQUEST_TIMEOUT_MS = 30_000;
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_ATTEMPTS = 180;

const OUTPUT_PATH = process.env.E2E_OUTPUT_PATH
  || path.join(ROOT_DIR, 'artifacts_runs', 'e2e-services-flow-summary.json');

interface StepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

interface E2ESummary {
  generatedAt: string;
  config: {
    webPort: number;
    workerPort: number;
    postgresPort: number;
    apiBaseUrl: string;
    workerBaseUrl: string;
    postgresImage: string;
    databaseUrlMasked: string;
  };
  runId: string | null;
  jobId: string | null;
  statusesSeen: string[];
  reportScore: number | null;
  tractionBand: string | null;
  readiness: string | null;
  launchStatus: string | null;
  receiptPublished: boolean;
  steps: StepResult[];
  success: boolean;
}

interface HttpJsonResult {
  _httpStatus: number;
  [key: string]: any;
}

function log(message: string) {
  console.log(`[e2e-services] ${message}`);
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeHex(char: string, length: number): string {
  return `0x${char.repeat(length)}`;
}

async function spawnOnce(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; allowFailure?: boolean }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => reject(error));

    child.on('exit', (code) => {
      const exitCode = code ?? -1;
      if (exitCode !== 0 && !options?.allowFailure) {
        const stderrTail = stderr.trim().split('\n').slice(-20).join('\n');
        reject(
          new Error(
            `Command failed (${command} ${args.join(' ')}), code=${exitCode}` +
            `${stderrTail ? `\n${stderrTail}` : ''}`
          )
        );
        return;
      }

      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

function startService(
  name: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer | string) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') {
      process.stdout.write(`[${name}] ${chunk.toString()}`);
    }
  });

  child.stderr?.on('data', (chunk: Buffer | string) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') {
      process.stderr.write(`[${name}:err] ${chunk.toString()}`);
    }
  });

  child.once('exit', (code) => {
    if (code !== 0) {
      log(`${name} exited with code=${code}`);
    }
  });

  return child;
}

async function stopService(child?: ChildProcess) {
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

async function waitForEndpoint(
  name: string,
  url: string,
  validate: (data: HttpJsonResult) => boolean,
  timeoutMs = STARTUP_TIMEOUT_MS,
): Promise<HttpJsonResult> {
  const start = Date.now();
  let lastError = 'not started';

  while (Date.now() - start < timeoutMs) {
    try {
      const data = await requestJSON(url, undefined, true);
      if (data._httpStatus >= 200 && data._httpStatus < 300 && validate(data)) {
        return data;
      }
      lastError = `HTTP ${data._httpStatus}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for ${name} (${timeoutMs}ms): ${lastError}`);
}

async function waitForPostgres(containerName: string): Promise<void> {
  const start = Date.now();
  let lastError = 'not ready';

  while (Date.now() - start < STARTUP_TIMEOUT_MS) {
    try {
      const check = await spawnOnce(
        'docker',
        ['exec', containerName, 'pg_isready', '-U', POSTGRES_USER, '-d', POSTGRES_DB],
        { allowFailure: true }
      );

      if (check.code === 0) {
        return;
      }

      lastError = check.stderr || check.stdout || `exit=${check.code}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(1000);
  }

  throw new Error(`Postgres did not become ready: ${lastError}`);
}

function printSummary(steps: StepResult[], runId: string | null) {
  console.log('\n=== Cross-Service E2E Summary ===');
  for (const step of steps) {
    console.log(`  ${step.ok ? 'PASS' : 'FAIL'}: ${step.step} (${step.durationMs}ms)${step.detail ? ` — ${step.detail}` : ''}`);
  }

  const passed = steps.filter((s) => s.ok).length;
  const total = steps.length;
  console.log(`\n  ${passed}/${total} steps passed`);
  if (runId) console.log(`  Run ID: ${runId}`);
}

async function run() {
  const steps: StepResult[] = [];
  let postgresContainerName: string | null = null;
  let webProcess: ChildProcess | undefined;
  let workerProcess: ChildProcess | undefined;

  let runId: string | null = null;
  let jobId: string | null = null;
  let reportScore: number | null = null;
  let tractionBand: string | null = null;
  let readiness: string | null = null;
  let launchStatus: string | null = null;
  let receiptPublished = false;
  const statusesSeen = new Set<string>();

  const step = async (name: string, fn: () => Promise<string | void>) => {
    const startedAt = Date.now();
    try {
      const detail = await fn();
      const durationMs = Date.now() - startedAt;
      steps.push({ step: name, ok: true, durationMs, detail: detail || undefined });
      log(`PASS: ${name} (${durationMs}ms)${detail ? ` — ${detail}` : ''}`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const msg = error instanceof Error ? error.message : String(error);
      steps.push({ step: name, ok: false, durationMs, detail: msg });
      throw error;
    }
  };

  try {
    log(`Config: web=${WEB_PORT}, worker=${WORKER_PORT}, pg=${POSTGRES_PORT}`);

    await step('1. Start Postgres container', async () => {
      postgresContainerName = `simvibe-e2e-${Date.now().toString(36)}`;

      await spawnOnce('docker', [
        'run',
        '--rm',
        '-d',
        '--name', postgresContainerName,
        '-e', `POSTGRES_USER=${POSTGRES_USER}`,
        '-e', `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
        '-e', `POSTGRES_DB=${POSTGRES_DB}`,
        '-p', `${POSTGRES_PORT}:5432`,
        POSTGRES_IMAGE,
      ]);

      await waitForPostgres(postgresContainerName);
      return `${postgresContainerName} ready`;
    });

    await step('2. Run Postgres migrations', async () => {
      await spawnOnce(
        'pnpm',
        ['--filter', '@simvibe/engine', 'db:migrate'],
        {
          cwd: ROOT_DIR,
          env: {
            ...process.env,
            DATABASE_URL,
          },
        }
      );
      return 'migrations applied';
    });

    await step('3. Start web service', async () => {
      webProcess = startService(
        'web',
        'pnpm',
        ['--filter', '@simvibe/web', 'dev', '--port', String(WEB_PORT)],
        {
          ...process.env,
          DEMO_MODE: 'true',
          DATABASE_URL,
          LAUNCH_FORCE_OVERRIDE: 'true',
        },
      );

      const diagnostics = await waitForEndpoint(
        'web diagnostics',
        `${API_BASE_URL}/api/diagnostics`,
        (data) => typeof data.storage?.activeBackend === 'string'
      );

      if (!String(diagnostics.storage?.activeBackend).includes('postgres')) {
        throw new Error(`Web storage backend is not postgres: ${diagnostics.storage?.activeBackend}`);
      }

      return `storage=${diagnostics.storage?.activeBackend}, personas=${diagnostics.personaRegistry?.count ?? 'n/a'}`;
    });

    await step('4. Start worker service', async () => {
      workerProcess = startService(
        'worker',
        'pnpm',
        ['--filter', '@simvibe/worker', 'start'],
        {
          ...process.env,
          DEMO_MODE: 'true',
          DATABASE_URL,
          WORKER_PORT: String(WORKER_PORT),
          LAUNCH_FORCE_OVERRIDE: 'true',
        },
      );

      const health = await waitForEndpoint(
        'worker health',
        `${WORKER_BASE_URL}/health`,
        (data) => data.status === 'healthy' && data.queue === 'pgboss'
      );

      return `status=${health.status}, queue=${health.queue}`;
    });

    await step('5. Create run', async () => {
      const created = await requestJSON(`${API_BASE_URL}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline: 'Cross-service E2E Launch Optimizer',
          description: 'Validates queue-driven worker execution, report lifecycle transitions, launch flow, and receipt persistence end-to-end.',
          pricingModel: 'freemium',
          category: 'Web3',
          tags: ['e2e', 'cross-service', 'queue', 'worker'],
          url: 'https://example.com',
          runMode: 'quick',
          platformMode: 'nad_fun',
          nadFunSubmission: {
            tokenName: 'Cross Service Token',
            tokenSymbol: 'XSV',
            launchThesis: 'Strong ops and explicit launch sequencing improve trust before launch.',
            antiSnipe: false,
            bundled: false,
          },
        }),
      });

      if (!created.runId) {
        throw new Error('Create run response missing runId');
      }

      runId = created.runId;
      return `runId=${runId}`;
    });

    await step('6. Start run and enqueue job', async () => {
      if (!runId) throw new Error('runId missing');

      const started = await requestJSON(`${API_BASE_URL}/api/run/${runId}/start`, {
        method: 'POST',
      });

      if (!started.queued) {
        throw new Error(`Expected queued=true from start route, got: ${JSON.stringify(started)}`);
      }

      jobId = started.jobId ?? null;
      return `queued=true, jobId=${jobId ?? 'n/a'}`;
    });

    await step('7. Poll run to completed (processed by worker)', async () => {
      if (!runId) throw new Error('runId missing');

      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        const data = await requestJSON(`${API_BASE_URL}/api/run/${runId}`);
        const status = data.run?.status || data.status;
        if (status) statusesSeen.add(status);

        if (status === 'completed') {
          if (!statusesSeen.has('queued')) {
            throw new Error(`Status sequence missing 'queued': ${Array.from(statusesSeen).join(', ')}`);
          }
          return `completed after ${i + 1} polls`;
        }

        if (status === 'failed') {
          throw new Error(`Run failed: ${data.run?.error || 'unknown error'}`);
        }

        await sleep(POLL_INTERVAL_MS);
      }

      throw new Error(`Timed out after ${MAX_POLL_ATTEMPTS} polls`);
    });

    await step('8. Verify report generated', async () => {
      if (!runId) throw new Error('runId missing');

      const data = await requestJSON(`${API_BASE_URL}/api/run/${runId}`);
      const report = data.run?.report;
      if (!report) throw new Error('Missing report');
      if (typeof report.overallScore !== 'number') throw new Error('Report missing overallScore');
      if (!report.nadFunForecast) throw new Error('Report missing nadFunForecast');

      reportScore = report.overallScore;
      tractionBand = report.tractionBand;

      return `score=${reportScore}, traction=${tractionBand}`;
    });

    await step('9. Apply report patch', async () => {
      if (!runId) throw new Error('runId missing');

      const patch = await requestJSON(`${API_BASE_URL}/api/run/${runId}/report/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'warnings',
          operations: [
            {
              op: 'replace',
              path: '',
              value: ['Cross-service E2E patched warning'],
            },
          ],
          reason: 'Verify patch endpoint in cross-service E2E',
          provenance: {
            agentId: 'e2e:services',
            source: 'cross_service_test',
            confidence: 0.99,
          },
        }),
      });

      if (!patch.success || typeof patch.newVersion !== 'number') {
        throw new Error(`Patch failed: ${JSON.stringify(patch)}`);
      }

      return `newVersion=${patch.newVersion}, revisionId=${patch.revisionId}`;
    });

    await step('10. Freeze report lifecycle', async () => {
      if (!runId) throw new Error('runId missing');

      const frozen = await requestJSON(`${API_BASE_URL}/api/run/${runId}/report/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'frozen',
          actor: 'e2e:services',
          reason: 'Cross-service launch gate requirement',
        }),
      });

      if (!frozen.success || frozen.lifecycle?.status !== 'frozen') {
        throw new Error(`Lifecycle freeze failed: ${JSON.stringify(frozen)}`);
      }

      return `status=${frozen.lifecycle.status}, version=${frozen.lifecycle.version}`;
    });

    await step('11. Fetch launch readiness and draft', async () => {
      if (!runId) throw new Error('runId missing');

      const launchData = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch`);
      if (!launchData.readiness || !launchData.launchInput) {
        throw new Error('Launch data missing readiness or draft input');
      }

      readiness = launchData.readiness.status;
      return `readiness=${readiness}, confidence=${launchData.readiness.confidence}`;
    });

    await step('12. Save launch payload', async () => {
      if (!runId) throw new Error('runId missing');

      const saved = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Cross Service Token',
          symbol: 'XSV',
          description: 'Cross-service launch payload from e2e-services-flow',
          website: 'https://example.com/xsv',
          x: 'https://x.com/simvibe',
          telegram: 'https://t.me/simvibe',
          antiSnipe: false,
          bundled: false,
        }),
      });

      if (!saved.success || !saved.launchRecord?.idempotencyKey) {
        throw new Error('Launch payload save failed');
      }

      return `record=${saved.launchRecord.status}`;
    });

    await step('13. Execute launch', async () => {
      if (!runId) throw new Error('runId missing');

      const execute = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch/execute` , {
        method: 'POST',
      });

      if (!execute.success || !execute.plan) {
        throw new Error(`Launch execute failed: ${JSON.stringify(execute)}`);
      }

      return `mode=${execute.plan.mode}`;
    });

    await step('14. Confirm launch submitted', async () => {
      if (!runId) throw new Error('runId missing');

      const txHash = makeHex('a', 64);
      const submitted = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          status: 'submitted',
        }),
      });

      if (!submitted.success || submitted.launchRecord?.status !== 'submitted') {
        throw new Error(`Launch submit confirm failed: ${JSON.stringify(submitted)}`);
      }

      return `status=${submitted.launchRecord.status}`;
    });

    await step('15. Confirm launch success', async () => {
      if (!runId) throw new Error('runId missing');

      const txHash = makeHex('a', 64);
      const tokenAddress = makeHex('b', 40);
      const confirmed = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          tokenAddress,
          status: 'success',
        }),
      });

      if (!confirmed.success || confirmed.launchRecord?.status !== 'success') {
        throw new Error(`Launch success confirm failed: ${JSON.stringify(confirmed)}`);
      }

      return `status=${confirmed.launchRecord.status}`;
    });

    await step('16. Verify launch status and events', async () => {
      if (!runId) throw new Error('runId missing');

      const status = await requestJSON(`${API_BASE_URL}/api/run/${runId}/launch/status`);
      if (status.launchRecord?.status !== 'success') {
        throw new Error(`Expected launch success, got ${status.launchRecord?.status}`);
      }

      const eventTypes = (status.events || []).map((event: any) => event.type);
      if (!eventTypes.includes('LAUNCH_SUBMITTED') || !eventTypes.includes('LAUNCH_CONFIRMED')) {
        throw new Error('Launch events missing submit/confirm');
      }

      launchStatus = status.launchRecord.status;
      return `events=${status.events?.length || 0}`;
    });

    await step('17. Create receipt (offline fallback)', async () => {
      if (!runId) throw new Error('runId missing');

      const receipt = await requestJSON(`${API_BASE_URL}/api/run/${runId}/receipt`, {
        method: 'POST',
      });

      if (!receipt.success || !receipt.receipt?.runHash || !receipt.receipt?.reportHash) {
        throw new Error(`Receipt creation failed: ${JSON.stringify(receipt)}`);
      }

      receiptPublished = !!receipt.receipt.txHash;
      return `runHash=${receipt.receipt.runHash.slice(0, 12)}..., onchain=${receiptPublished}`;
    });

    await step('18. Check receipt publish status endpoint', async () => {
      if (!runId) throw new Error('runId missing');

      const publishStatus = await requestJSON(`${API_BASE_URL}/api/run/${runId}/receipt/publish`, undefined, true);
      if (publishStatus._httpStatus !== 200) {
        throw new Error(`Publish status endpoint failed: HTTP ${publishStatus._httpStatus}`);
      }

      return `configured=${publishStatus.configured}, reportStatus=${publishStatus.reportStatus ?? 'n/a'}`;
    });
  } finally {
    await stopService(workerProcess);
    await stopService(webProcess);

    if (postgresContainerName) {
      try {
        await spawnOnce('docker', ['rm', '-f', postgresContainerName], { allowFailure: true });
      } catch {
        // Ignore cleanup errors.
      }
    }

    const success = steps.length > 0 && steps.every((s) => s.ok);
    const summary: E2ESummary = {
      generatedAt: new Date().toISOString(),
      config: {
        webPort: WEB_PORT,
        workerPort: WORKER_PORT,
        postgresPort: POSTGRES_PORT,
        apiBaseUrl: API_BASE_URL,
        workerBaseUrl: WORKER_BASE_URL,
        postgresImage: POSTGRES_IMAGE,
        databaseUrlMasked: maskDatabaseUrl(DATABASE_URL),
      },
      runId,
      jobId,
      statusesSeen: Array.from(statusesSeen),
      reportScore,
      tractionBand,
      readiness,
      launchStatus,
      receiptPublished,
      steps,
      success,
    };

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(summary, null, 2), 'utf-8');

    printSummary(steps, runId);
    log(`Summary written: ${OUTPUT_PATH}`);
    process.exit(success ? 0 : 1);
  }
}

run().catch((error) => {
  console.error('[e2e-services] Fatal error:', error);
  process.exit(1);
});
