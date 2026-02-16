# Railway Deployment Runbook

Last updated: 2026-02-16

This project is typically deployed as:

- `apps/web`: Next.js web + API routes (public)
- `apps/worker`: background worker (private)
- Railway Postgres: shared database for both services

## 1) Prerequisites

- Railway project created
- GitHub repo connected
- PostgreSQL provisioned in the same Railway project

## 2) Required Architecture Rules

- `DATABASE_URL` must be a real Postgres URL
- Web/API service and worker service must share the same `DATABASE_URL`
- Do not hardcode a fixed web port in Railway env; let Railway inject `PORT`

## 3) Deploy Web/API Service

Recommended service settings:

- Root directory: `/`
- Build command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @simvibe/web build
```

- Start command:

```bash
pnpm start:api:seed
```

Required env vars (minimum):

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
EXTRACTOR_PROVIDER=jina

WEB_BASE_URL=https://simvibe.studioliq.com
AUTO_SEED_NAD_ON_START=true
AUTO_SEED_WAIT_SECONDS=180
SEED_ONLY_MISSING=true
PRODUCT_COUNT=20
RUN_MODE=quick
```

## 4) Deploy Worker Service

Recommended service settings:

- Dockerfile: `apps/worker/Dockerfile`
- No public domain required

Required env vars (minimum):

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
EXTRACTOR_PROVIDER=jina

WORKER_RUN_TIMEOUT_MS=600000
```

## 5) One-Time Initialization

Run once against production DB:

```bash
pnpm db:migrate
pnpm personas:sync
```

## 6) Post-Deploy Verification

Health checks:

- `https://simvibe.studioliq.com/`
- `https://simvibe.studioliq.com/api/diagnostics`

Expected diagnostics:

- `storage.activeBackend = postgres`
- persona registry loaded

## 7) 502 Troubleshooting Checklist

If Railway returns `502 Application failed to respond`:

1. Confirm service is healthy in Railway logs (build and start both succeeded)
2. Remove fixed `PORT` env var if set
3. Verify `DATABASE_URL` is valid and reachable
4. Temporarily disable auto-seed:

```env
AUTO_SEED_NAD_ON_START=false
```

5. Redeploy and re-check `/api/diagnostics`

## 8) Optional Manual Seed

```bash
API_BASE_URL=https://simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
SEED_ONLY_MISSING=true \
SEED_NAMESPACE=nad-live-v1 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
WAIT_FOR_SERVER_SECONDS=180 \
pnpm seed:nad:railway
```
