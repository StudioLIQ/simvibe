# nad.fun Seeding Guide

This guide explains how to generate seeded simulation runs for demos.

## Default Source and Behavior

- Default source endpoint:
  `https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20`
- Default namespace: `nad-live-v1`
- Default count: `20`
- Default mode: `quick`
- If `SEED_ONLY_MISSING=true`, existing seeded runs are skipped
- If live source fails, fallback fixtures are used (`scripts/fixtures/nad-seed-products.ts`)

## Local Seeding

```bash
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad
```

Artifacts:
- `artifacts_runs/nad-seed-summary.json`
- `artifacts_runs/nad-seed-report-links.md`

## Railway Auto-Seeding on Startup

Use API start command:

```bash
pnpm start:api:seed
```

Recommended env vars:

```env
AUTO_SEED_NAD_ON_START=true
AUTO_SEED_WAIT_SECONDS=180
SEED_ONLY_MISSING=true
SEED_NAMESPACE=nad-live-v1
SEED_LOOKBACK_LIMIT=200
PRODUCT_COUNT=20
RUN_MODE=quick
WEB_BASE_URL=https://simvibe.studioliq.com
```

## Manual Railway Seeding

```bash
API_BASE_URL=https://simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
WAIT_FOR_SERVER_SECONDS=180 \
SEED_ONLY_MISSING=true \
SEED_NAMESPACE=nad-live-v1 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad:railway
```

## Force Re-Seed

To seed even if matching entries already exist:

```bash
SEED_ONLY_MISSING=false \
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
pnpm seed:nad
```
