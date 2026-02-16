# simvi.be Deployment Runbook (Railway)

Last updated: 2026-02-15

This runbook reflects the current production architecture and operational flow.

## 1) Architecture

```text
[User]
  -> Railway Web + API (apps/web Next server + route handlers + React UI)
       -> Postgres (Railway)
       -> pg-boss queue
            -> Railway Worker (apps/worker)
```

Key rules:
- Production storage must be Postgres (`DATABASE_URL=postgres://...`).
- API and Worker must share the same `DATABASE_URL`.
- API requests are handled on the same Railway service as the web UI (`apps/web`).
- On-chain features (Receipt/Gate/NAD launch) are optional. System still works in off-chain mode.

---

## 2) Pre-deploy Validation (Local)

Requirements:
- Node `>=18` (recommended: 20 or 22)
- pnpm `>=9`

Run before every deploy:

```bash
pnpm typecheck
pnpm ci:e2e:all
```

Notes:
- `ci:e2e:services` (included in `ci:e2e:all`) requires Docker.
- Launch execution requires report lifecycle to be `frozen` or `published`.

---

## 3) Environment Variables

Source of truth: `.env.example`

### 3-1. API service (Railway, required)

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
# or ANTHROPIC_API_KEY / OPENAI_API_KEY

EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=... (optional)
# FIRECRAWL_API_KEY=... (required only if provider=firecrawl)

LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00

# Auto-seed on API boot (recommended)
AUTO_SEED_NAD_ON_START=true
AUTO_SEED_WAIT_SECONDS=180
SEED_ONLY_MISSING=true
PRODUCT_COUNT=20
RUN_MODE=quick
WEB_BASE_URL=https://simvibe.studioliq.com
# NAD_SOURCE_URL=https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20
```

### 3-2. Worker service (Railway, required)

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
EXTRACTOR_PROVIDER=jina

WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000

LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
```

### 3-3. Web/API service (Railway)

```env
# API and web run together, so leave API_SERVER_ORIGIN unset unless split deployment.
API_SERVER_ORIGIN=
NODE_ENV=production
WEB_ORIGIN=https://simvibe.studioliq.com
```

Security recommendation:
- Keep all API/web secrets in Railway service only.

### 3-4. Optional chain/launch variables

Receipt publish (Monad):
- `RECEIPT_CONTRACT_ADDRESS`
- `RECEIPT_RPC_URL`
- `RECEIPT_PUBLISHER_KEY`
- `RECEIPT_CHAIN_ID` (optional)

nad.fun launch config:
- `NAD_TOKEN_FACTORY_ADDRESS`
- `NAD_CHAIN_ID`
- `NAD_RPC_URL`
- `NAD_CREATE_BASE_URL`
- `NAD_LAUNCH_FEE_MON`

Readiness policy:
- `LAUNCH_FORCE_OVERRIDE` (should be `false` in production)
- `LAUNCH_MIN_OVERALL_SCORE`, etc. (see `packages/engine/src/launch/readiness-gate.ts`)

---

## 4) Railway Deployment

### 4-1. Create Postgres
1. Railway Project -> `New` -> `Database` -> PostgreSQL
2. Copy `DATABASE_URL`

### 4-2. Create API service
1. `New` -> Connect GitHub repo
2. Service name: `simvibe-api` (recommended)
3. Root Directory: `/`
4. Build command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @simvibe/web build
```

5. Start command:

```bash
pnpm start:api:seed
```

6. Set API env vars from section 3-1

### 4-3. Create Worker service
1. `New` -> Connect same GitHub repo
2. Service name: `simvibe-worker` (recommended)
3. Dockerfile path: `apps/worker/Dockerfile`
4. No public domain needed
5. Set Worker env vars from section 3-2

### 4-4. Connect API domain
Example: `simvibe.studioliq.com`

Verify:
- `https://simvibe.studioliq.com/api/diagnostics`
- Check `storage.activeBackend=postgres`

---

## 5) First-time Initialization (Required)

Run once in API environment:

```bash
pnpm db:migrate
pnpm personas:sync
```

Verify migration and persona sync logs are successful.

---

## 6) Optional: Dedicated FE Split (only if needed)

1. If you still want FE-only split, import project from repo
2. Root Directory: `apps/web`
3. Install command:

```bash
cd ../.. && pnpm install --frozen-lockfile
```

4. Build command:

```bash
cd ../.. && pnpm --filter @simvibe/web build
```

5. Set Web env vars from section 3-3
6. Connect domain (example: `simvibe.studioliq.com`)

Verify:
- `https://simvibe.studioliq.com` loads
- `/api/*` route handlers are on same Next.js origin

---

## 7) Post-deploy Verification

### 7-1. Service health
- API: `GET /api/diagnostics`
- Worker log contains: `Worker consuming jobs from pg-boss queue`

### 7-2. Run lifecycle
1. `POST /api/run` -> get `runId`
2. `POST /api/run/:id/start` -> expect `queued=true`
3. Poll `GET /api/run/:id` -> `queued -> running -> completed`

### 7-3. Launch lifecycle (important)
Before launch execute, freeze lifecycle:
- `POST /api/run/:id/report/lifecycle` with `targetStatus=frozen`

Then:
1. `GET /api/run/:id/launch`
2. `POST /api/run/:id/launch`
3. `POST /api/run/:id/launch/execute`
4. `POST /api/run/:id/launch/confirm`
5. `GET /api/run/:id/launch/status`

---

## 8) E2E for Operations

### 8-1. Full E2E chain
```bash
pnpm ci:e2e:all
```

This runs:
- `ci:smoke`
- `ci:smoke:launch`
- `ci:e2e:nad:fun`
- `ci:e2e:monad`
- `ci:e2e:services`

### 8-2. Cross-service E2E only
```bash
pnpm ci:e2e:services
```

It validates in one pass:
- API enqueue
- pg-boss queue delivery
- Worker execution
- report patch/lifecycle
- launch execute/confirm
- receipt persistence

Artifact:
- `artifacts_runs/e2e-services-flow-summary.json`

---

## 9) Seeding (Auto + Manual)

Default recommendation:
- API start command uses `pnpm start:api:seed`
- Server starts immediately and `seed:nad` runs in background
- Seeding failure does not stop API process

Disable auto-seed if needed:

```env
AUTO_SEED_NAD_ON_START=false
```

nad.fun demo seeding:

```bash
API_BASE_URL=https://simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
SEED_ONLY_MISSING=true \
WAIT_FOR_SERVER_SECONDS=180 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad:railway
```

---

## 10) Incident Triage Order

1. Check API `GET /api/diagnostics`
2. Validate `DATABASE_URL` and Postgres connectivity
3. Check Worker logs (queue consumption, execution errors)
4. Validate split-FE `API_SERVER_ORIGIN` (only if running FE separately)
5. If launch returns 403, check report lifecycle status first

---

## 11) Rollback

Principle:
- Keep DB as-is, roll back API/Web/Worker to previous release.
- Immediately run `pnpm ci:smoke` and `pnpm ci:smoke:launch` after rollback.

Recommended:
- Store `artifacts_runs/*summary.json` per release.
- Record deployed commit hashes in ops notes.
