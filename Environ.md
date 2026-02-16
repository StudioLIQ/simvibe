# Environment Template (Railway, Submission-Safe)

Target domain: `https://simvibe.studioliq.com`

`DATABASE_URL` is intentionally omitted below. Set it directly in Railway using your Postgres service value.

## 1) Web/API Service (`apps/web`)

```env
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
GEMINI_API_KEY=your_gemini_api_key

EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=
# FIRECRAWL_API_KEY=

AUTO_SEED_NAD_ON_START=true
AUTO_SEED_WAIT_SECONDS=180
SEED_ONLY_MISSING=true
SEED_NAMESPACE=nad-live-v1
SEED_LOOKBACK_LIMIT=200
PRODUCT_COUNT=20
RUN_MODE=quick
WAIT_FOR_SERVER_SECONDS=180

NAD_SOURCE_URL=https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20

API_BASE_URL=https://simvibe.studioliq.com
WEB_BASE_URL=https://simvibe.studioliq.com
WEB_ORIGIN=https://simvibe.studioliq.com
API_ORIGIN=https://simvibe.studioliq.com
API_SERVER_ORIGIN=

NAD_CREATE_BASE_URL=https://nad.fun/create
NAD_DEFAULT_ANTI_SNIPE=false
NAD_DEFAULT_BUNDLED=false
# NAD_DEFAULT_WEBSITE_URL=
# NAD_DEFAULT_X_URL=
# NAD_DEFAULT_TELEGRAM_URL=
# NAD_DEFAULT_IMAGE_URL=

# Optional chain / launch
# ENABLE_CHAIN_RECEIPT=false
# RECEIPT_CONTRACT_ADDRESS=
# RECEIPT_CHAIN_ID=
# RECEIPT_RPC_URL=
# RECEIPT_PUBLISHER_KEY=
# GATE_CONTRACT_ADDRESS=
# CHAIN_CONTRACT_ADDRESS=
# CHAIN_RPC_URL=
# CHAIN_ID=
# CHAIN_PRIVATE_KEY=
```

Notes:
- Do not set a fixed `PORT` value in Railway for web/API. Railway injects `PORT` automatically.
- Keep `API_SERVER_ORIGIN` blank for single-service web+API deployment.

## 2) Worker Service (`apps/worker`)

```env
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
GEMINI_API_KEY=your_gemini_api_key

EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=
# FIRECRAWL_API_KEY=

WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000
```

## 3) One-Off Railway Seed Command

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

## 4) Local Fallback

```env
API_BASE_URL=http://localhost:5555
WEB_BASE_URL=http://localhost:5556
```
