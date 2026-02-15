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
cp .env.example .env
# Fill in GEMINI_API_KEY

pnpm install
pnpm dev          # http://localhost:3000
```

For zero-cost local testing:

```bash
DEMO_MODE=true DATABASE_URL=memory:// pnpm dev
```

## 5. Monitoring

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
