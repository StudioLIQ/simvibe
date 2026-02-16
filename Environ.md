# Environ (Railway deployment copy-paste)

Target domain: `https://simvibe.studioliq.com`  
All values are organized for copy-paste into each Railway service's Env tab.

---

## 1) Web + API service (apps/web, Railway one service)

```env
# Core
DATABASE_URL=
NODE_ENV=production
DEMO_MODE=false

# LLM
LLM_PROVIDER=gemini
GEMINI_API_KEY=
# LLM_MODEL=gemini-2.0-flash
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00

# Extractor
EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=
# FIRECRAWL_API_KEY=

# Seeding (recommended)
AUTO_SEED_NAD_ON_START=false
AUTO_SEED_WAIT_SECONDS=180
SEED_ONLY_MISSING=true
PRODUCT_COUNT=20
RUN_MODE=quick
WAIT_FOR_SERVER_SECONDS=180
SEED_NAMESPACE=nad-live-v1
SEED_LOOKBACK_LIMIT=200
NAD_SOURCE_URL=https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20

# URLs (single service)
API_BASE_URL=https://simvibe.studioliq.com
WEB_BASE_URL=https://simvibe.studioliq.com
WEB_ORIGIN=https://simvibe.studioliq.com
API_ORIGIN=https://simvibe.studioliq.com

# Chain options (optional)
# ENABLE_CHAIN_RECEIPT=false
# RECEIPT_CONTRACT_ADDRESS=
# RECEIPT_CHAIN_ID=
# RECEIPT_RPC_URL=
# RECEIPT_PUBLISHER_KEY=

# NAD launch options (optional)
# NAD_TOKEN_FACTORY_ADDRESS=
# NAD_CHAIN_ID=
# NAD_RPC_URL=
# NAD_LAUNCH_FEE_MON=0
# NAD_CREATE_BASE_URL=https://nad.fun/create
# NAD_DEFAULT_WEBSITE_URL=
# NAD_DEFAULT_X_URL=
# NAD_DEFAULT_TELEGRAM_URL=
# NAD_DEFAULT_IMAGE_URL=
# NAD_DEFAULT_ANTI_SNIPE=false
# NAD_DEFAULT_BUNDLED=false

# Internal API routing
# (For single service, leave empty or remove this line)
API_SERVER_ORIGIN=
```

> `API_SERVER_ORIGIN` is only required when FE is deployed separately on Railway.  
> For FE + API in one service (current setup), leave it empty.

---

## 2) Worker service (apps/worker, Railway)

```env
DATABASE_URL=
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=
# LLM_MODEL=gemini-2.0-flash
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00

EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=
# FIRECRAWL_API_KEY=

WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000

# Chain options (optional)
# ENABLE_CHAIN_RECEIPT=false
# RECEIPT_CONTRACT_ADDRESS=
# RECEIPT_CHAIN_ID=
# RECEIPT_RPC_URL=
# RECEIPT_PUBLISHER_KEY=
# CHAIN_CONTRACT_ADDRESS=
# CHAIN_RPC_URL=
# CHAIN_ID=
# CHAIN_PRIVATE_KEY=

# NAD launch options (optional)
# GATE_CONTRACT_ADDRESS=
# NAD_TOKEN_FACTORY_ADDRESS=
# NAD_CHAIN_ID=
# NAD_RPC_URL=
# NAD_LAUNCH_FEE_MON=0
# NAD_CREATE_BASE_URL=https://nad.fun/create
```

> Worker has no externally reachable URL.  
> All external traffic for API routing, seed workflows, and webhooks is handled only by the Web+API service.

---

## 3) Seed / local override vars (copy as needed)

```env
# Local dev
API_BASE_URL=http://localhost:5555
WEB_BASE_URL=http://localhost:5556
```

```env
# Railway seed via API
API_BASE_URL=https://simvibe.studioliq.com
WEB_BASE_URL=https://simvibe.studioliq.com
SEED_ONLY_MISSING=true
SEED_NAMESPACE=nad-live-v1
PRODUCT_COUNT=20
RUN_MODE=quick
WAIT_FOR_SERVER_SECONDS=180
```

---

## 4) URL/port connection rules (important)

- Public access URL:
  - `https://simvibe.studioliq.com` (do not append a port)
- API/seeding base:
  - `https://simvibe.studioliq.com`  
  - Example: `https://simvibe.studioliq.com/api/diagnostics`
- Local/dev environment:
  - API: `http://localhost:5555`
  - FE dev proxy: `http://localhost:5556`
- Railway injects the service `PORT` automatically, so do not manually append `:<port>` to public URLs.
