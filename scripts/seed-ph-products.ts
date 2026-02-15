#!/usr/bin/env tsx
/**
 * Seed Product Hunt-style demo runs so report pages are ready to view.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 pnpm seed:ph
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 PRODUCT_COUNT=6 RUN_MODE=quick pnpm seed:ph
 *   API_BASE_URL=https://your-web.up.railway.app WEB_BASE_URL=https://your-web.up.railway.app \
 *     WAIT_FOR_SERVER_SECONDS=180 SEED_ONLY_MISSING=true pnpm seed:ph
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PH_SEED_PRODUCTS } from './fixtures/ph-seed-products';

const RAILWAY_PUBLIC_ORIGIN = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
  : undefined;
const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.BASE_URL ||
  RAILWAY_PUBLIC_ORIGIN ||
  'http://localhost:5555'
).replace(/\/+$/, '');
const WEB_BASE_URL = (
  process.env.WEB_BASE_URL ||
  process.env.PUBLIC_BASE_URL ||
  RAILWAY_PUBLIC_ORIGIN ||
  'http://localhost:5556'
).replace(/\/+$/, '');
const RUN_MODE = process.env.RUN_MODE === 'deep' ? 'deep' : 'quick';
const PRODUCT_COUNT = Math.max(1, Math.min(
  PH_SEED_PRODUCTS.length,
  Number.parseInt(process.env.PRODUCT_COUNT || '7', 10) || 7,
));
const WAIT_FOR_SERVER_SECONDS = Math.max(
  0,
  Number.parseInt(process.env.WAIT_FOR_SERVER_SECONDS || '0', 10) || 0,
);
const SEED_ONLY_MISSING = process.env.SEED_ONLY_MISSING !== 'false';
const SEED_LOOKBACK_LIMIT = Math.max(
  10,
  Number.parseInt(process.env.SEED_LOOKBACK_LIMIT || '200', 10) || 200,
);
const SEED_NAMESPACE = (process.env.SEED_NAMESPACE || 'ph-demo-v1')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9:_-]+/g, '-')
  .replace(/-+/g, '-');
const SEED_TAG = `seed:${SEED_NAMESPACE}`;
const SEED_PH_TAG = 'seed:ph';
const SEED_SLUG_TAG_PREFIX = `${SEED_TAG}:slug:`;
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = RUN_MODE === 'deep' ? 420 : 240;
const REQUEST_TIMEOUT_MS = 30000;
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts_runs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'ph-seed-summary.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'ph-seed-report-links.md');
const PRODUCT_NAME_TO_SLUG = new Map(
  PH_SEED_PRODUCTS.map((product) => [product.productName.trim().toLowerCase(), product.slug]),
);

interface SeededRun {
  slug: string;
  productName: string;
  sourceUrl: string;
  runId: string;
  reportUrl: string;
  status: string;
  tractionBand?: string;
  overallScore?: number;
}

interface ExistingRunLite {
  input?: {
    tags?: string[];
    platformMode?: string;
    phSubmission?: {
      productName?: string;
    };
  };
}

interface HttpResult {
  _httpStatus: number;
  [key: string]: any;
}

function log(message: string) {
  console.log(`[seed-ph] ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJSON(url: string, init?: RequestInit): Promise<HttpResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    const result: HttpResult = { _httpStatus: res.status, ...(body || {}) };
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${url}: ${text}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureServer() {
  const startedAt = Date.now();
  const maxWaitMs = WAIT_FOR_SERVER_SECONDS * 1000;
  let attempts = 0;
  let lastError = 'unknown';

  while (true) {
    attempts += 1;
    try {
      await requestJSON(`${API_BASE_URL}/api/diagnostics`);
      if (attempts > 1) {
        log(`API became ready after ${attempts} checks.`);
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= maxWaitMs) {
        throw new Error(
          `Cannot reach API server at ${API_BASE_URL}.\n` +
          `Waited ${Math.round(elapsedMs / 1000)}s (${attempts} checks).\n` +
          `Last error: ${lastError}`
        );
      }
      const waitRemaining = Math.max(0, maxWaitMs - elapsedMs);
      log(`API not ready yet (${Math.ceil(waitRemaining / 1000)}s left)...`);
      await sleep(Math.min(3000, waitRemaining));
    }
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildSeedTags(product: typeof PH_SEED_PRODUCTS[number]): string[] {
  return unique([
    ...product.tags,
    SEED_PH_TAG,
    SEED_TAG,
    `${SEED_SLUG_TAG_PREFIX}${product.slug}`,
  ]);
}

function toRunInput(product: typeof PH_SEED_PRODUCTS[number]) {
  const phTagline = product.phTagline.slice(0, 60);
  const phDescription = product.phDescription.slice(0, 260);
  const makerFirstComment = product.makerFirstComment.slice(0, 1000);
  const topics = product.topics.slice(0, 3);

  const syntheticLanding = [
    product.productName,
    '',
    phTagline,
    '',
    phDescription,
    '',
    `Maker comment: ${makerFirstComment}`,
    '',
    `Source: ${product.sourceUrl}`,
  ].join('\n');

  return {
    tagline: phTagline,
    description: phDescription,
    pricingModel: product.pricingModel,
    category: product.category,
    tags: buildSeedTags(product),
    runMode: RUN_MODE,
    platformMode: 'product_hunt' as const,
    pastedContent: syntheticLanding,
    phSubmission: {
      productName: product.productName.slice(0, 60),
      phTagline,
      phDescription,
      topics,
      makerFirstComment,
      mediaAssets: product.website ? { thumbnailUrl: `${product.website.replace(/\/+$/, '')}/favicon.ico` } : undefined,
    },
  };
}

function inferLegacySlug(run: ExistingRunLite): string | null {
  if (run.input?.platformMode !== 'product_hunt') return null;
  const productName = run.input?.phSubmission?.productName?.trim().toLowerCase();
  if (!productName) return null;
  return PRODUCT_NAME_TO_SLUG.get(productName) || null;
}

async function fetchExistingSeededSlugs(): Promise<Set<string>> {
  const existingSlugs = new Set<string>();

  if (!SEED_ONLY_MISSING) {
    return existingSlugs;
  }

  try {
    const data = await requestJSON(`${API_BASE_URL}/api/run?limit=${SEED_LOOKBACK_LIMIT}`);
    const runs = Array.isArray(data.runs) ? (data.runs as ExistingRunLite[]) : [];

    for (const run of runs) {
      const tags = Array.isArray(run.input?.tags) ? run.input!.tags! : [];

      for (const tag of tags) {
        if (tag.startsWith(SEED_SLUG_TAG_PREFIX)) {
          const slug = tag.slice(SEED_SLUG_TAG_PREFIX.length).trim();
          if (slug) existingSlugs.add(slug);
        }
      }

      // Backward compatibility for older seeded runs before slug tags were introduced.
      const legacySlug = inferLegacySlug(run);
      if (legacySlug) {
        existingSlugs.add(legacySlug);
      }
    }

    log(
      `Detected ${existingSlugs.size} existing seed products in last ${runs.length} runs ` +
      `(limit=${SEED_LOOKBACK_LIMIT}).`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Warning: failed to inspect existing runs; proceeding without dedupe. (${msg})`);
  }

  return existingSlugs;
}

async function createAndRun(
  product: typeof PH_SEED_PRODUCTS[number],
  index: number,
  total: number,
): Promise<SeededRun> {
  log(`(${index + 1}/${total}) create run: ${product.productName}`);

  const created = await requestJSON(`${API_BASE_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRunInput(product)),
  });

  if (!created.runId) {
    throw new Error(`Missing runId for ${product.productName}`);
  }

  const runId = created.runId as string;
  await requestJSON(`${API_BASE_URL}/api/run/${runId}/start`, { method: 'POST' });

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const runData = await requestJSON(`${API_BASE_URL}/api/run/${runId}`);
    const status = runData.run?.status || runData.status;

    if (status === 'completed') {
      const report = runData.run?.report;
      return {
        slug: product.slug,
        productName: product.productName,
        sourceUrl: product.sourceUrl,
        runId,
        reportUrl: `${WEB_BASE_URL}/run/${runId}/report`,
        status,
        tractionBand: report?.tractionBand,
        overallScore: report?.overallScore,
      };
    }
    if (status === 'failed') {
      throw new Error(`Run failed (${runId}) for ${product.productName}: ${runData.run?.error || 'unknown'}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Run timeout for ${product.productName}`);
}

async function writeOutputs(results: SeededRun[], skippedExisting: typeof PH_SEED_PRODUCTS) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    runMode: RUN_MODE,
    seedNamespace: SEED_NAMESPACE,
    seedOnlyMissing: SEED_ONLY_MISSING,
    skippedExistingCount: skippedExisting.length,
    skippedExistingSlugs: skippedExisting.map((product) => product.slug),
    count: results.length,
    results,
  }, null, 2), 'utf-8');

  const mdLines: string[] = [];
  mdLines.push('# Seeded Product Hunt Reports');
  mdLines.push('');
  mdLines.push(`- Generated: ${new Date().toISOString()}`);
  mdLines.push(`- API Base URL: ${API_BASE_URL}`);
  mdLines.push(`- Web Base URL: ${WEB_BASE_URL}`);
  mdLines.push(`- Run mode: ${RUN_MODE}`);
  mdLines.push(`- Seed namespace: ${SEED_NAMESPACE}`);
  mdLines.push(`- Seed only missing: ${SEED_ONLY_MISSING}`);
  mdLines.push(`- Skipped existing: ${skippedExisting.length}`);
  mdLines.push('');
  mdLines.push('| Product | Run ID | Score | Traction | Report | Source |');
  mdLines.push('|---|---|---:|---|---|---|');
  for (const r of results) {
    mdLines.push(
      `| ${r.productName} | \`${r.runId}\` | ${r.overallScore ?? '-'} | ${r.tractionBand ?? '-'} | ${r.reportUrl} | ${r.sourceUrl} |`
    );
  }
  mdLines.push('');
  if (skippedExisting.length > 0) {
    mdLines.push('## Skipped (Already Seeded)');
    mdLines.push('');
    for (const product of skippedExisting) {
      mdLines.push(`- ${product.productName} (\`${product.slug}\`)`);
    }
    mdLines.push('');
  }

  await writeFile(OUTPUT_MD, mdLines.join('\n'), 'utf-8');
}

async function main() {
  log(`API: ${API_BASE_URL}`);
  log(`Web: ${WEB_BASE_URL}`);
  log(`Seed namespace: ${SEED_NAMESPACE}`);
  log(`Seed only missing: ${SEED_ONLY_MISSING}`);
  log(`Run mode: ${RUN_MODE}, productCount: ${PRODUCT_COUNT}`);

  await ensureServer();
  const existingSlugs = await fetchExistingSeededSlugs();

  const initialTargets = PH_SEED_PRODUCTS.slice(0, PRODUCT_COUNT);
  const skippedExisting = SEED_ONLY_MISSING
    ? initialTargets.filter((product) => existingSlugs.has(product.slug))
    : [];
  const targets = SEED_ONLY_MISSING
    ? initialTargets.filter((product) => !existingSlugs.has(product.slug))
    : initialTargets;

  if (skippedExisting.length > 0) {
    log(`Skipping ${skippedExisting.length} already-seeded products.`);
  }

  const results: SeededRun[] = [];
  for (let i = 0; i < targets.length; i++) {
    const seeded = await createAndRun(targets[i], i, targets.length);
    results.push(seeded);
    log(`  done: ${seeded.productName} -> ${seeded.reportUrl} (score=${seeded.overallScore ?? '-'})`);
  }

  await writeOutputs(results, skippedExisting);
  log(`Seed complete. Reports: ${results.length}`);
  if (skippedExisting.length > 0) {
    log(`Skipped existing: ${skippedExisting.length}`);
  }
  log(`Saved: ${OUTPUT_JSON}`);
  log(`Saved: ${OUTPUT_MD}`);
}

main().catch((error) => {
  console.error('[seed-ph] Fatal error:', error);
  process.exit(1);
});
