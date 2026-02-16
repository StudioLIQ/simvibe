# Local Development Guide

This guide runs simvi.be locally in demo-friendly mode.

## 1) Prerequisites

- macOS or Linux
- Node.js `>=18`
- pnpm `>=9`

## 2) Install

```bash
pnpm install
```

## 3) Environment

Create `.env` using `.env.example` as reference.
Minimum setup for local demo:

```env
DEMO_MODE=true
DATABASE_URL=memory://
LLM_PROVIDER=gemini
```

Optional server key:

```env
GEMINI_API_KEY=your_server_key
```

## 4) Run

Start API and web in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

URLs:
- App: `http://localhost:5556`
- Diagnostics: `http://localhost:5555/api/diagnostics`

## 5) Quick Demo Run

1. Open `/new`
2. Click **Autofill Example**
3. Click **Simulate Launch Reaction**
4. On the run page, click **Start Simulation**
5. Open the final report

## 6) Generate Seeded Demo Reports (Optional)

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

## 7) Validation (Optional)

```bash
pnpm typecheck
pnpm ci:e2e:all
```

Notes:
- `ci:e2e:all` includes Docker-dependent checks.
- If you only need a fast sanity run, use `pnpm typecheck` first.

## 8) Troubleshooting

### App does not start
- Confirm ports `5555` and `5556` are free.
- Re-run `pnpm install`.

### `/api/run/:id/start` fails
- Check `http://localhost:5555/api/diagnostics`.
- Verify `.env` values (`DEMO_MODE`, `DATABASE_URL`, provider key).

### Seeding fails
- Confirm API server is running.
- Verify `API_BASE_URL` and `WEB_BASE_URL` values.
