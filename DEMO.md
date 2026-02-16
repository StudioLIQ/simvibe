# simvi.be Demo Script (2 Minutes)

## Pre-Demo Setup

1. Install dependencies: `pnpm install`
2. Start API server: `pnpm dev:api` (port `5555`)
3. Start web server: `pnpm dev:web` (port `5556`)
4. Open `http://localhost:5556`
5. Verify health: `http://localhost:5555/api/diagnostics`

Optional (prepare multiple report links in advance):

```bash
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad
```

Generated links:
- `artifacts_runs/nad-seed-report-links.md`

---

## Live Demo Flow

### 0:00-0:20 - Framing
"simvi.be predicts launch reaction before going live by simulating high-signal persona behavior."

### 0:20-0:45 - Input
1. Open `/new`
2. Click **Autofill Example**
3. Show that launch fields are populated instantly

### 0:45-1:20 - Run
1. Click **Simulate Launch Reaction**
2. On the run page, click **Start Simulation**
3. Highlight live status progression and event stream behavior

### 1:20-1:50 - Report
1. Open the report
2. Walk through score, risk/fix summary, and go/no-go framing
3. Show how this converts intuition into actionable launch decisions

### 1:50-2:00 - Iteration Value
"You can rerun with revised messaging and compare outcomes quickly before real launch spend."

---

## Backup Mode (If External Providers Fail)

```bash
DEMO_MODE=true DATABASE_URL=memory:// pnpm dev:api
pnpm dev:web
```

This keeps the demo operational with resilient fallback behavior.
