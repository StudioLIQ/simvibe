# Deploying simvi.be on Railway

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────┐
│  Vercel      │     │  Railway                         │
│  (Frontend)  │────▶│  ┌──────────┐  ┌──────────────┐ │
│  apps/web    │     │  │ Postgres │◀─│ Worker       │ │
│  Next.js     │────▶│  │          │  │ apps/worker  │ │
│              │     │  └──────────┘  └──────────────┘ │
└─────────────┘     └──────────────────────────────────┘

Vercel: UI + short API calls (run creation, report fetch)
Worker: long-running simulation execution (2-10 min)
Both share the same Postgres via DATABASE_URL.

## Target Production URLs

- Frontend: `https://simvibe.studioliq.com`
- API: `https://api-simvibe.studioliq.com`
```

## 1. Railway Setup

### Create services

1. **Postgres** — Add Postgres plugin from Railway dashboard.
2. **Worker** — New service from GitHub repo.
   - Root directory: `/` (monorepo root)
   - Dockerfile path: `apps/worker/Dockerfile`
   - No public domain needed (internal only).

### Worker environment variables

Set these in Railway dashboard for the Worker service:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
EXTRACTOR_PROVIDER=jina
WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000
NODE_ENV=production
```

### Run migrations

After Postgres is up, run from local machine:

```bash
DATABASE_URL=<railway-postgres-url> pnpm db:migrate
DATABASE_URL=<railway-postgres-url> pnpm personas:sync
```

## 2. Vercel Setup

### Deploy

1. Import repo on Vercel.
2. Framework: **Next.js**
3. Root directory: `apps/web`
4. Build command: `cd ../.. && pnpm install && pnpm --filter @simvibe/web build`
5. Output directory: `apps/web/.next`

### Vercel environment variables

```
DATABASE_URL=<railway-postgres-external-url>
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
EXTRACTOR_PROVIDER=jina
API_SERVER_ORIGIN=https://api-simvibe.studioliq.com
NODE_ENV=production
```

> Vercel handles inline execution for SQLite/dev mode. In production with
> Postgres, it enqueues jobs to pg-boss and Railway Worker picks them up.

## 3. Gemini Cost Protection

Three layers of defense against billing spikes:

### Layer 1: Daily token cap

```
LLM_DAILY_TOKEN_LIMIT=2000000   # 2M tokens/day
```

Once cumulative input+output tokens exceed this, all new LLM calls are rejected
until midnight (server time) reset. A run in progress will fail gracefully
(fallback agent outputs + partial report).

### Layer 2: Daily USD cap

```
LLM_DAILY_COST_LIMIT_USD=5.00   # $5/day
```

Tracks estimated cost using known model pricing. Same rejection behavior.
Works alongside token cap (whichever hits first).

### Layer 3: Per-run token budget (built-in)

Already enforced by run mode configs:
- **Quick**: 2048 max tokens/agent, 5 agents = ~10K output tokens max
- **Deep**: 4096 max tokens/agent, 11 agents = ~45K output tokens max

### Gemini model pricing reference

| Model | Input $/M | Output $/M | Notes |
|-------|-----------|------------|-------|
| gemini-2.0-flash | $0.10 | $0.40 | Default, cheapest |
| gemini-2.5-flash | $0.15 | $0.60 | Thinking model |
| gemini-1.5-pro | $1.25 | $5.00 | Higher quality |
| gemini-2.5-pro | $1.25 | $10.00 | Best quality |

With `gemini-2.0-flash` at defaults:
- One quick run (~10K in + ~10K out) ≈ **$0.005** (~0.5 cents)
- One deep run (~50K in + ~45K out) ≈ **$0.023** (~2.3 cents)
- $5/day cap ≈ **~200 deep runs** before cutoff

### Override model

```
LLM_MODEL=gemini-2.5-flash   # use a different model
```

## 4. Local Development

```bash
pnpm install
cp .env.example .env
# Fill in GEMINI_API_KEY and DATABASE_URL
```

### Local Postgres (recommended)

```bash
docker run --name simvibe-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=simvibe \
  -p 5432:5432 \
  -d postgres:16
```

`.env` example:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/simvibe
PORT=5555
NODE_ENV=development
```

Run migrations + persona sync:

```bash
pnpm db:migrate
pnpm personas:sync
```

Start split dev servers:

```bash
# Terminal 1 (API server)
pnpm dev:api      # http://localhost:5555

# Terminal 2 (FE)
pnpm dev:web      # http://localhost:5556
```

Open:
- `http://localhost:5556` (UI)
- `http://localhost:5555/api/diagnostics` (API health)

### Zero-cost demo mode

In demo mode, landing extraction is forced to `pasted` (Jina/Firecrawl are not called).

```bash
DEMO_MODE=true DATABASE_URL=memory:// pnpm dev:api
pnpm dev:web
```

## 5. Railway Auto Seeding (Optional)

데모용 Product Hunt 리포트를 배포 직후 자동으로 채우고 싶을 때 사용합니다.

시드 상세 목록:
- `SEEDING.md`

권장 방식:
1. `web` 서비스가 healthy 된 뒤 실행되는 one-off job 또는 cron job에서 실행
2. 아래 명령으로 시딩

```bash
API_BASE_URL=https://api-simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
WAIT_FOR_SERVER_SECONDS=180 \
SEED_ONLY_MISSING=true \
SEED_NAMESPACE=ph-demo-v1 \
PRODUCT_COUNT=7 \
RUN_MODE=quick \
pnpm seed:ph:railway
```

메모:
- `SEED_ONLY_MISSING=true`면 기존 시드 런을 감지해서 중복 생성을 건너뜁니다.
- 강제 재시딩은 `SEED_ONLY_MISSING=false`로 실행합니다.
- `RAILWAY_PUBLIC_DOMAIN` 환경변수가 있으면 `API_BASE_URL`/`WEB_BASE_URL` 생략 시 자동 사용됩니다.

## 6. Monitoring

### Cost guard state

The `/api/diagnostics` endpoint shows current cost guard status.

### Worker health

Worker exposes `/health` on `WORKER_PORT`:

```json
{
  "status": "healthy",
  "activeRun": null,
  "uptime": 3600,
  "storage": "postgres",
  "queue": "pgboss"
}
```

### Logs

Worker outputs structured JSON logs suitable for Railway log aggregation:

```json
{"ts":"...","level":"info","service":"simvibe-worker","message":"Run completed","runId":"...","durationMs":12345}
```
