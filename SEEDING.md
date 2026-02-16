# nad.fun Seed Catalog

This document describes how to run nad.fun live-data demo seeding.

## Default Behavior

- Source: `https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20`
- Namespace default: `nad-live-v1`
- Default count: `20`
- Default mode: `quick`
- Default dedupe: if `SEED_ONLY_MISSING=true`, existing seeded runs are skipped.
- Fallback: if live API fails, `scripts/fixtures/nad-seed-products.ts` is used.

## Local Seeding

```bash
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad
```

Generated artifacts:
- `artifacts_runs/nad-seed-summary.json`
- `artifacts_runs/nad-seed-report-links.md`

## Railway Auto Seeding

Set API start command to `pnpm start:api:seed` to run background seeding automatically on startup.

Required/recommended env vars:
- `AUTO_SEED_NAD_ON_START=true`
- `AUTO_SEED_WAIT_SECONDS=180`
- `SEED_ONLY_MISSING=true`
- `PRODUCT_COUNT=20`
- `RUN_MODE=quick`
- `WEB_BASE_URL=https://simvibe.studioliq.com`

Run once manually with:

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

Recommended env vars:
- `SEED_ONLY_MISSING=true`
- `SEED_NAMESPACE=nad-live-v1`
- `SEED_LOOKBACK_LIMIT=200`
- `WAIT_FOR_SERVER_SECONDS=180`
- `NAD_SOURCE_URL` (optional): live source endpoint override
- `API_BASE_URL`/`WEB_BASE_URL` are optional when `RAILWAY_PUBLIC_DOMAIN` is set.

## Force Re-seed

To re-seed even when entries already exist:

```bash
SEED_ONLY_MISSING=false \
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
pnpm seed:nad
```
