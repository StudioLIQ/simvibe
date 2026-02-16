#!/usr/bin/env tsx
/**
 * Seed nad.fun-style demo runs so report pages are ready to view.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 pnpm seed:nad
 *   API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 PRODUCT_COUNT=5 RUN_MODE=quick pnpm seed:nad
 *   API_BASE_URL=https://simvibe.studioliq.com WEB_BASE_URL=https://simvibe.studioliq.com \
 *     WAIT_FOR_SERVER_SECONDS=180 SEED_ONLY_MISSING=true pnpm seed:nad
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NAD_SEED_PRODUCTS, type NadSeedProduct } from './fixtures/nad-seed-products';

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
const REQUESTED_PRODUCT_COUNT = Math.max(
  1,
  Number.parseInt(process.env.PRODUCT_COUNT || '20', 10) || 20,
);
const WAIT_FOR_SERVER_SECONDS = Math.max(
  0,
  Number.parseInt(process.env.WAIT_FOR_SERVER_SECONDS || '0', 10) || 0,
);
const SEED_ONLY_MISSING = process.env.SEED_ONLY_MISSING !== 'false';
const SEED_LOOKBACK_LIMIT = Math.max(
  10,
  Number.parseInt(process.env.SEED_LOOKBACK_LIMIT || '200', 10) || 200,
);
const SEED_NAMESPACE = (process.env.SEED_NAMESPACE || 'nad-live-v1')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9:_-]+/g, '-')
  .replace(/-+/g, '-');
const SEED_TAG = `seed:${SEED_NAMESPACE}`;
const SEED_NAD_TAG = 'seed:nad';
const SEED_SLUG_TAG_PREFIX = `${SEED_TAG}:slug:`;
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = RUN_MODE === 'deep' ? 420 : 240;
const REQUEST_TIMEOUT_MS = 30000;
const NAD_LIVE_SOURCE_URL = process.env.NAD_SOURCE_URL || 'https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20';
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts_runs');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'nad-seed-summary.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'nad-seed-report-links.md');

interface SeededRun {
  slug: string;
  tokenName: string;
  tokenSymbol: string;
  runId: string;
  reportUrl: string;
  status: string;
  tractionBand?: string;
  overallScore?: number;
}

interface ExistingRunLite {
  status?: string;
  input?: {
    tags?: string[];
    platformMode?: string;
    nadFunSubmission?: {
      tokenName?: string;
    };
  };
}

interface HttpResult {
  _httpStatus: number;
  [key: string]: any;
}

function shouldPreserveSeed(runStatus?: string): boolean {
  const normalized = (runStatus || '').trim().toLowerCase();

  // Re-seed failed launches while keeping currently active/finished successful seeds.
  return normalized !== 'failed';
}

interface NadLiveApiToken {
  token_info?: {
    token_id?: string;
    name?: string;
    symbol?: string;
    description?: string;
    website?: string;
  };
  market_info?: {
    market_type?: string;
    holder_count?: number;
  };
  percent?: number;
}

interface NadLiveApiResponse {
  tokens?: NadLiveApiToken[];
  total_count?: number;
}

function log(message: string) {
  console.log(`[seed-nad] ${message}`);
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

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function oneLine(value: string | undefined, fallback: string): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 190 ? `${normalized.slice(0, 187)}...` : normalized;
}

function toLiveSeedProduct(item: NadLiveApiToken, index: number): NadSeedProduct | null {
  const token = item.token_info;
  const market = item.market_info;
  const tokenId = token?.token_id?.trim();
  const tokenName = token?.name?.trim();
  const rawSymbol = token?.symbol?.trim();

  if (!tokenId || !tokenName || !rawSymbol) {
    return null;
  }

  const tokenSymbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || `TKN${index + 1}`;
  const shortId = tokenId.toLowerCase().replace(/^0x/, '').slice(0, 8);
  const slugBase = toSlug(`${tokenName}-${tokenSymbol}`);
  const slug = shortId ? `${slugBase}-${shortId}` : slugBase;
  const description = oneLine(token?.description, `${tokenName} token on nad.fun.`);
  const marketType = market?.market_type || 'TOKEN';
  const holderCount = Number.isFinite(market?.holder_count) ? Number(market?.holder_count) : 0;
  const changePercent = typeof item.percent === 'number' && Number.isFinite(item.percent) ? item.percent : 0;
  const changeLabel = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

  return {
    slug,
    tokenName,
    tokenSymbol,
    tagline: oneLine(
      token?.description,
      `${tokenName} on nad.fun (${marketType.toUpperCase()})`,
    ),
    description,
    launchThesis: `${tokenName} is already trading on nad.fun with ${holderCount.toLocaleString('en-US')} holders and ${changeLabel} recent momentum.`,
    tokenNarrative: `${tokenName} (${tokenSymbol}) is positioned as a ${marketType.toLowerCase()}-market token in the Monad ecosystem.`,
    distributionPlan: `Focus launch ops on current holders (${holderCount.toLocaleString('en-US')}) and social proof from live nad.fun market activity.`,
    riskAssumptions: `Live market tokens face volatility, holder concentration risk, and short-term speculation cycles.`,
    antiSnipe: marketType.toUpperCase() !== 'DEX',
    bundled: false,
    pricingModel: 'free',
    category: marketType,
    tags: unique([
      'nad.fun',
      'live-seed',
      'market-cap',
      tokenSymbol.toLowerCase(),
      marketType.toLowerCase(),
    ]),
    website: token?.website?.trim() || undefined,
  };
}

async function fetchLiveSeedProducts(): Promise<NadSeedProduct[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(NAD_LIVE_SOURCE_URL, { signal: controller.signal }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = (await res.json()) as NadLiveApiResponse;
    const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
    const mapped = tokens
      .map((item, index) => toLiveSeedProduct(item, index))
      .filter((item): item is NadSeedProduct => item !== null);

    if (mapped.length === 0) {
      throw new Error('No valid tokens in response');
    }

    const deduped = Array.from(
      mapped.reduce((acc, product) => acc.set(product.slug, product), new Map<string, NadSeedProduct>()).values(),
    );

    log(`Loaded ${deduped.length} live products from nad.fun source.`);
    return deduped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Warning: failed to load live nad.fun products (${message}). Falling back to local fixture.`);
    return null;
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

function buildSeedTags(product: NadSeedProduct): string[] {
  return unique([
    ...product.tags,
    SEED_NAD_TAG,
    SEED_TAG,
    `${SEED_SLUG_TAG_PREFIX}${product.slug}`,
  ]);
}

function toRunInput(product: NadSeedProduct) {
  const syntheticLanding = [
    product.tokenName,
    `$${product.tokenSymbol}`,
    '',
    product.tagline,
    '',
    product.description,
    '',
    `Launch Thesis: ${product.launchThesis}`,
    '',
    `Token Narrative: ${product.tokenNarrative}`,
    '',
    `Distribution Plan: ${product.distributionPlan}`,
    '',
    `Risk Assumptions: ${product.riskAssumptions}`,
    '',
    product.website ? `Website: ${product.website}` : '',
  ].filter(Boolean).join('\n');

  return {
    tagline: product.tagline,
    description: product.description,
    pricingModel: product.pricingModel,
    category: product.category,
    tags: buildSeedTags(product),
    runMode: RUN_MODE,
    platformMode: 'nad_fun' as const,
    pastedContent: syntheticLanding,
    nadFunSubmission: {
      tokenName: product.tokenName,
      tokenSymbol: product.tokenSymbol,
      launchThesis: product.launchThesis,
      distributionPlan: product.distributionPlan,
      tokenNarrative: product.tokenNarrative,
      riskAssumptions: product.riskAssumptions,
      antiSnipe: product.antiSnipe,
      bundled: product.bundled,
    },
  };
}

function inferLegacySlug(run: ExistingRunLite, tokenNameToSlug: Map<string, string>): string | null {
  if (run.input?.platformMode !== 'nad_fun') return null;
  const tokenName = run.input?.nadFunSubmission?.tokenName?.trim().toLowerCase();
  if (!tokenName) return null;
  return tokenNameToSlug.get(tokenName) || null;
}

async function fetchExistingSeededSlugs(tokenNameToSlug: Map<string, string>): Promise<Set<string>> {
  const existingSlugs = new Set<string>();

  if (!SEED_ONLY_MISSING) {
    return existingSlugs;
  }

  try {
    const data = await requestJSON(`${API_BASE_URL}/api/run?limit=${SEED_LOOKBACK_LIMIT}`);
    const runs = Array.isArray(data.runs) ? (data.runs as ExistingRunLite[]) : [];

    for (const run of runs) {
      const tags = Array.isArray(run.input?.tags) ? run.input!.tags! : [];
      const preserveSeed = shouldPreserveSeed(run.status);
      const seedSlugs: string[] = [];

      for (const tag of tags) {
        if (tag.startsWith(SEED_SLUG_TAG_PREFIX)) {
          const slug = tag.slice(SEED_SLUG_TAG_PREFIX.length).trim();
          if (slug) seedSlugs.push(slug);
        }
      }

      const legacySlug = inferLegacySlug(run, tokenNameToSlug);
      if (legacySlug) {
        seedSlugs.push(legacySlug);
      }

      if (seedSlugs.length > 0) {
        if (preserveSeed) {
          for (const slug of seedSlugs) {
            if (slug) existingSlugs.add(slug);
          }
        } else {
          const status = run.status || 'unknown';
          log(`Found failed seed run (status=${status}); will re-seed slugs: ${seedSlugs.join(', ')}`);
        }
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
  product: NadSeedProduct,
  index: number,
  total: number,
): Promise<SeededRun> {
  log(`(${index + 1}/${total}) create run: ${product.tokenName} ($${product.tokenSymbol})`);

  const created = await requestJSON(`${API_BASE_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toRunInput(product)),
  });

  if (!created.runId) {
    throw new Error(`Missing runId for ${product.tokenName}`);
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
        tokenName: product.tokenName,
        tokenSymbol: product.tokenSymbol,
        runId,
        reportUrl: `${WEB_BASE_URL}/run/${runId}/report`,
        status,
        tractionBand: report?.tractionBand,
        overallScore: report?.overallScore,
      };
    }
    if (status === 'failed') {
      throw new Error(`Run failed (${runId}) for ${product.tokenName}: ${runData.run?.error || 'unknown'}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Run timeout for ${product.tokenName}`);
}

async function writeOutputs(
  results: SeededRun[],
  skippedExisting: NadSeedProduct[],
  productSource: string,
) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    runMode: RUN_MODE,
    seedNamespace: SEED_NAMESPACE,
    seedOnlyMissing: SEED_ONLY_MISSING,
    productSource,
    liveSourceUrl: NAD_LIVE_SOURCE_URL,
    skippedExistingCount: skippedExisting.length,
    skippedExistingSlugs: skippedExisting.map((product) => product.slug),
    count: results.length,
    results,
  }, null, 2), 'utf-8');

  const mdLines: string[] = [];
  mdLines.push('# Seeded nad.fun Token Launch Reports');
  mdLines.push('');
  mdLines.push(`- Generated: ${new Date().toISOString()}`);
  mdLines.push(`- API Base URL: ${API_BASE_URL}`);
  mdLines.push(`- Web Base URL: ${WEB_BASE_URL}`);
  mdLines.push(`- Run mode: ${RUN_MODE}`);
  mdLines.push(`- Product source: ${productSource}`);
  mdLines.push(`- Seed namespace: ${SEED_NAMESPACE}`);
  mdLines.push(`- Seed only missing: ${SEED_ONLY_MISSING}`);
  mdLines.push(`- Skipped existing: ${skippedExisting.length}`);
  mdLines.push('');
  mdLines.push('| Token | Symbol | Run ID | Score | Traction | Report |');
  mdLines.push('|---|---|---|---:|---|---|');
  for (const r of results) {
    mdLines.push(
      `| ${r.tokenName} | $${r.tokenSymbol} | \`${r.runId}\` | ${r.overallScore ?? '-'} | ${r.tractionBand ?? '-'} | ${r.reportUrl} |`
    );
  }
  mdLines.push('');
  if (skippedExisting.length > 0) {
    mdLines.push('## Skipped (Already Seeded)');
    mdLines.push('');
    for (const product of skippedExisting) {
      mdLines.push(`- ${product.tokenName} ($${product.tokenSymbol}, \`${product.slug}\`)`);
    }
    mdLines.push('');
  }

  await writeFile(OUTPUT_MD, mdLines.join('\n'), 'utf-8');
}

async function main() {
  const liveProducts = await fetchLiveSeedProducts();
  const allProducts = liveProducts && liveProducts.length > 0 ? liveProducts : NAD_SEED_PRODUCTS;
  const sourceLabel = liveProducts && liveProducts.length > 0 ? 'nad.fun live API' : 'local fixture';
  const productCount = Math.max(1, Math.min(allProducts.length, REQUESTED_PRODUCT_COUNT));
  const tokenNameToSlug = new Map(
    allProducts.map((product) => [product.tokenName.trim().toLowerCase(), product.slug]),
  );

  log(`API: ${API_BASE_URL}`);
  log(`Web: ${WEB_BASE_URL}`);
  log(`Product source: ${sourceLabel}`);
  log(`Live source URL: ${NAD_LIVE_SOURCE_URL}`);
  log(`Seed namespace: ${SEED_NAMESPACE}`);
  log(`Seed only missing: ${SEED_ONLY_MISSING}`);
  log(`Run mode: ${RUN_MODE}, productCount: ${productCount}`);

  await ensureServer();
  const existingSlugs = await fetchExistingSeededSlugs(tokenNameToSlug);

  const initialTargets = allProducts.slice(0, productCount);
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
    log(`  done: ${seeded.tokenName} ($${seeded.tokenSymbol}) -> ${seeded.reportUrl} (score=${seeded.overallScore ?? '-'})`);
  }

  await writeOutputs(results, skippedExisting, sourceLabel);
  log(`Seed complete. Reports: ${results.length}`);
  if (skippedExisting.length > 0) {
    log(`Skipped existing: ${skippedExisting.length}`);
  }
  log(`Saved: ${OUTPUT_JSON}`);
  log(`Saved: ${OUTPUT_MD}`);
}

main().catch((error) => {
  console.error('[seed-nad] Fatal error:', error);
  process.exit(1);
});
