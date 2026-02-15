# simvi.be Demo Script (2 minutes)

## Setup (Before Demo)
1. Ensure `DEMO_MODE=true` in `.env` (uses cached extracts, no API calls)
2. Start API server: `pnpm dev:api` (port `5555`)
3. Start FE server: `pnpm dev:web` (port `5556`, proxies `/api/*` to `5555`)
4. Open http://localhost:5556 (허브 랜딩)
5. New Simulation 진입: `http://localhost:5556/new`
5. (Optional) Seed nad.fun-style runs for instant report links:
   - `API_BASE_URL=http://localhost:5555 WEB_BASE_URL=http://localhost:5556 PRODUCT_COUNT=5 pnpm seed:nad`
   - links saved at `artifacts_runs/nad-seed-report-links.md`
   - (Legacy PH seeds: `pnpm seed:ph`)

---

## Demo Flow (2 minutes)

### [0:00-0:15] Introduction
"This is simvi.be - an agentic market simulator. Instead of guessing how users will react to your product, you deploy it into a synthetic market of AI agents that behave like real launch-day users."

### [0:15-0:45] Create a World
1. 허브(`/`)에서 `새 시뮬레이션` 클릭 (또는 `/new` 직접 이동)
2. Enter example product:
   - **Tagline:** "Ship code reviews 10x faster with AI"
   - **Description:** "AI-powered code review tool that catches bugs before they hit production"
   - **Pricing:** Freemium
   - **Category:** Developer Tools
   - **URL:** (leave empty, use pasted content toggle)
   - **Pasted Content:** "CodeReviewer - AI Code Review..."

3. Click "Create World"

### [보너스] 누적 리포트 보기
- 허브(`/`)에서 `누적 리포트` 클릭 (또는 `/reports` 직접 이동)
- 기존 시딩/완료 런의 report 링크를 한 번에 확인

### [0:45-1:15] Watch Simulation
"Now watch as 5 different personas - a Cynical Engineer, a Product Manager, an Investor, a Growth Marketer, and an Agency Owner - each evaluate the product from their unique perspective."

- Point out the event timeline updating in real-time
- Highlight different agents taking different actions
- Note the phase progression (scan → skim → action)

### [1:15-1:45] Review Results
Click "View Report" when complete:
- "Here's the overall score and traction band prediction"
- "These are the top friction points identified across all personas"
- "And here are specific one-line fixes prioritized by consensus"

### [1:45-2:00] What-if Rerun
1. Scroll to "What-if Rerun" section
2. Change tagline to: "Catch bugs before your users do"
3. Click "Run With New Tagline"
4. "In seconds, you can test a different positioning and see how it changes outcomes"

---

## Key Demo Products (Cached)

### Product 1: CodeReviewer (Developer Tool)
- **Tagline:** Ship code reviews 10x faster with AI
- **Category:** Developer Tools, AI
- **Pricing:** Freemium ($0/free, $29/mo Pro)

### Product 2: LaunchPad (Marketing Tool)
- **Tagline:** Launch your product on 50+ platforms in one click
- **Category:** Marketing, Launch
- **Pricing:** Subscription ($49/mo)

### Product 3: InvoiceBot (B2B SaaS)
- **Tagline:** Never chase payments again
- **Category:** Finance, Automation
- **Pricing:** Usage-based ($5 per 100 invoices)

---

## Talking Points

- "Not a chatbot - this is a behavior simulation engine"
- "Each agent has resource constraints - limited attention, budget, and skepticism"
- "The discussion phase changes outcomes - agents influence each other"
- "Structured event logs power a data flywheel for continuous improvement"
- "What-if reruns let you converge on winning messaging fast"

---

## Backup: Demo Mode

If API keys are missing or rate-limited, enable demo mode:

```bash
DEMO_MODE=true DATABASE_URL=memory:// pnpm dev:api
pnpm dev:web
```

This uses cached landing extracts and deterministic agent outputs.
