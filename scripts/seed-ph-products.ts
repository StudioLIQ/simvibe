#!/usr/bin/env tsx
/**
 * Seed Product Hunt-style demo runs so report pages are ready to view.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 pnpm seed:ph
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 PRODUCT_COUNT=6 RUN_MODE=quick pnpm seed:ph
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PH_SEED_PRODUCTS } from './fixtures/ph-seed-products';

const API_BASE_URL = (process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5555').replace(/\/+$/, '');
const WEB_BASE_URL = (process.env.WEB_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:5556').replace(/\/+$/, '');
const RUN_MODE = process.env.RUN_MODE === 'deep' ? 'deep' : 'quick';
const PRODUCT_COUNT = Math.max(1, Math.min(
  PH_SEED_PRODUCTS.length,
  Number.parseInt(process.env.PRODUCT_COUNT || '7', 10) || 7,
));
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = RUN_MODE === 'deep' ? 420 : 240;
const REQUEST_TIMEOUT_MS = 30000;
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts_runs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'ph-seed-summary.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'ph-seed-report-links.md');

interface SeededRun {
  productName: string;
  sourceUrl: string;
  runId: string;
  reportUrl: string;
  status: string;
  tractionBand?: string;
  overallScore?: number;
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
  try {
    await requestJSON(`${API_BASE_URL}/api/diagnostics`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach API server at ${API_BASE_URL}. Start API app first (e.g. pnpm dev:api).\n` +
      `Original error: ${msg}`
    );
  }
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
    tags: product.tags,
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

async function createAndRun(product: typeof PH_SEED_PRODUCTS[number], index: number): Promise<SeededRun> {
  log(`(${index + 1}/${PRODUCT_COUNT}) create run: ${product.productName}`);

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

async function writeOutputs(results: SeededRun[]) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    runMode: RUN_MODE,
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
  mdLines.push('');
  mdLines.push('| Product | Run ID | Score | Traction | Report | Source |');
  mdLines.push('|---|---|---:|---|---|---|');
  for (const r of results) {
    mdLines.push(
      `| ${r.productName} | \`${r.runId}\` | ${r.overallScore ?? '-'} | ${r.tractionBand ?? '-'} | ${r.reportUrl} | ${r.sourceUrl} |`
    );
  }
  mdLines.push('');

  await writeFile(OUTPUT_MD, mdLines.join('\n'), 'utf-8');
}

async function main() {
  log(`API: ${API_BASE_URL}`);
  log(`Web: ${WEB_BASE_URL}`);
  log(`Run mode: ${RUN_MODE}, productCount: ${PRODUCT_COUNT}`);

  await ensureServer();

  const targets = PH_SEED_PRODUCTS.slice(0, PRODUCT_COUNT);
  const results: SeededRun[] = [];
  for (let i = 0; i < targets.length; i++) {
    const seeded = await createAndRun(targets[i], i);
    results.push(seeded);
    log(`  done: ${seeded.productName} -> ${seeded.reportUrl} (score=${seeded.overallScore ?? '-'})`);
  }

  await writeOutputs(results);
  log(`Seed complete. Reports: ${results.length}`);
  log(`Saved: ${OUTPUT_JSON}`);
  log(`Saved: ${OUTPUT_MD}`);
}

main().catch((error) => {
  console.error('[seed-ph] Fatal error:', error);
  process.exit(1);
});
