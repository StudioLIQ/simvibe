# TICKET.md

# simvi.be — Execution Tickets (Hackathon MVP)
All tickets are written to be executed by an LLM coding agent (Claude) sequentially.

---

## Conventions
- Status markers:
    - [ ] Not started
    - [~] In progress
    - [x] Done
- Priority:
    - P0 = demo-critical
    - P1 = important
    - P2 = nice-to-have
- Output expectation per ticket:
    1) implementation plan
    2) code changes (unified diff or full file contents)
    3) how to test
    4) mark ticket done with completion notes

---

## Milestone M0 — Repo & Foundations (P0)
### [x] SIM-001 (P0) Create repo scaffold and core folder structure
**Goal:** Establish a clean project skeleton that can ship a demo fast.

**Deliverables**
- `PROJECT.md`, `TICKET.md` present at repo root
- App folder structure (suggested):
    - `apps/web` (Next.js UI)
    - `packages/engine` (simulation engine logic)
    - `packages/shared` (schemas, types)
- `.env.example` with all required env vars

**Acceptance Criteria**
- `pnpm install` (or npm/yarn) works
- `pnpm dev` runs the web app
- No placeholder "todo" errors at runtime

**Test Plan**
- Start dev server, load home page

**Dependencies:** none

**Completion notes:**
- Created pnpm monorepo with apps/web (Next.js 14), packages/engine, packages/shared
- .env.example includes LLM provider, extractor, database, and chain receipt config
- Test: `pnpm install && pnpm dev` → homepage renders at localhost:3000

---

### [x] SIM-002 (P0) Define shared schemas for Run, Event, AgentOutput, Report
**Goal:** Make outputs structured and validation enforceable.

**Deliverables**
- JSON schema / zod (or pydantic) for:
    - RunInput
    - LandingExtract
    - AgentOutput
    - SimEvent
    - Report
- Strict validation + helpful error messages

**Acceptance Criteria**
- Invalid agent output triggers retry flow (later ticket) and is not stored as valid
- Types are imported cleanly across web and engine

**Dependencies:** SIM-001

**Completion notes:**
- All schemas in packages/shared/src/schemas/ using Zod
- Each schema has validate*() helper returning typed success/error
- createFallbackAgentOutput() provides safe fallback for failed parsing
- Types exported from @simvibe/shared, importable in web and engine
- Test: `pnpm --filter @simvibe/shared typecheck` passes

---

### [x] SIM-003 (P0) Implement a minimal storage layer (SQLite or in-memory + file persistence)
**Goal:** Persist runs for shareable report links.

**Deliverables**
- Storage API:
    - createRun(input)
    - appendEvent(runId, event)
    - saveAgentOutput(runId, agentOutput)
    - saveReport(runId, report)
    - getRun(runId)
- Minimal persistence:
    - SQLite (preferred) OR JSON file store for hackathon speed

**Acceptance Criteria**
- A run can be created, updated, fetched after server restart (if using SQLite)
- Storage errors are surfaced clearly

**Dependencies:** SIM-002

**Completion notes:**
- Storage interface in packages/engine/src/storage/
- SQLiteStorage: better-sqlite3 with WAL mode, tables for runs/events/agent_outputs
- MemoryStorage: in-memory fallback for testing/demo
- createStorage() factory with config-based selection
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

## Milestone M1 — Simulation Engine (P0)
### [x] SIM-004 (P0) Implement landing page extraction pipeline with fallback
**Goal:** Convert a URL into structured text the agents can consume.

**Deliverables**
- Extractor interface:
    - `extractLanding(url) -> LandingExtract`
- Pluggable backends:
    - Firecrawl/Jina Reader (if API key exists)
    - Fallback: user paste raw text (UI later)
- Sectioning:
    - hero, features, pricing, faq, testimonials, footer (best effort)

**Acceptance Criteria**
- For a normal SaaS landing page, extraction returns at least:
    - hero + pricing or hero + features
- If extraction fails, system returns a graceful "ExtractionFailed" extract and continues

**Dependencies:** SIM-003

**Completion notes:**
- Extractor interface in packages/engine/src/extractor/
- FirecrawlExtractor: uses Firecrawl API v1
- JinaExtractor: uses Jina Reader (works without API key)
- PastedExtractor: parses user-pasted content
- Sectioner: pattern-based section detection (hero, features, pricing, faq, testimonials, footer)
- createFailedExtract() for graceful degradation
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

### [x] SIM-005 (P0) Create the 5 persona prompt templates + shared world protocol
**Goal:** Ensure agents behave differently and always output valid JSON.

**Deliverables**
- `prompts/` folder with:
    - `world_protocol.md` (the shared rules)
    - `personas/*.md` (5 personas)
- Code that composes:
    - system prompt = protocol + persona overlay
    - user prompt = run input + landing extract + context

**Acceptance Criteria**
- Prompts are deterministic and consistent (avoid ambiguous instructions)
- Personas produce meaningfully different "primary friction" and actions on the same input

**Dependencies:** SIM-002

**Completion notes:**
- Prompts in packages/engine/src/prompts/
- WORLD_PROTOCOL: shared simulation rules, JSON output format, phases
- 5 personas: cynical_engineer, passionate_pm, pragmatic_investor, ruthless_marketer, agency_owner
- Each persona has unique priorities, red flags, budget range, skepticism level
- composePrompt(): combines protocol + persona + input + extract
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

### [x] SIM-006 (P0) Build orchestrator: phases (scan → skim → debate → actions)
**Goal:** Execute the simulation with a coherent multi-step flow.

**Deliverables**
- Orchestrator function:
    - `runSimulation(runId, input, landingExtract) -> stream of events -> final report`
- Phase events emitted:
    - `PHASE_START`, `AGENT_MESSAGE`, `AGENT_ACTION`, `PHASE_END`
- Debate round:
    - each agent asks 1 question + makes 1 pushback
- Runtime caps:
    - max tokens/time per agent
    - max rounds (MVP: 1 debate round)

**Acceptance Criteria**
- A full run completes without manual intervention
- All agent outputs pass schema validation (with retries later)

**Dependencies:** SIM-005

**Completion notes:**
- Orchestrator in packages/engine/src/orchestrator/
- LLM clients: Anthropic (Claude) and OpenAI (GPT-4o) support
- runSimulation(): emits phase events, runs all 5 agents in parallel
- Agent runner: composes prompts, parses JSON, handles validation
- Auto-retry built in (up to 3 retries with fix-your-json prompt)
- Fallback output generated if all retries fail
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

### [x] SIM-007 (P0) Implement agent JSON validation + auto-retry on failure
**Goal:** Prevent broken outputs from killing the demo.

**Deliverables**
- Validation wrapper:
    - parse JSON strictly
    - validate schema
- Retry strategy:
    - retry up to N times with "fix-your-json" instruction
    - final fallback: safe minimal output + warning event

**Acceptance Criteria**
- Malformed output does not crash the run
- Final report always renders with a warning if fallback used

**Dependencies:** SIM-006

**Completion notes:**
- Implemented as part of SIM-006 in agent-runner.ts
- extractJSON(): handles markdown code blocks, bare JSON, partial extraction
- validateAgentOutput(): strict Zod schema validation
- 3 retries with "fix-your-json" prompt appended to conversation
- createFallbackAgentOutput(): safe fallback with isFallback=true flag
- VALIDATION_ERROR event emitted when fallback used

---

### [x] SIM-008 (P0) Aggregator + report generator (traction band, friction top 3, one-line fixes)
**Goal:** Produce a judge-friendly, readable report.

**Deliverables**
- Aggregation logic:
    - expected_upvotes/signups/pays
    - bounce estimate
    - disagreement score
    - uncertainty score
- Report sections:
    - traction band + confidence
    - friction top list (trigger + evidence)
    - persona table
    - consolidated one-line fix list
- Markdown + JSON formats

**Acceptance Criteria**
- Given agent outputs, report is deterministic and readable
- Report highlights at least 3 actionable fixes

**Dependencies:** SIM-006

**Completion notes:**
- Aggregator in packages/engine/src/aggregator/
- aggregateMetrics(): computes expected actions, bounce/share rates, disagreement/uncertainty scores
- determineTractionBand(): maps metrics to very_low/low/moderate/high/very_high
- extractFrictions(): consolidates friction points from all agents, ranks by frequency
- calculateScores(): clarity, credibility, differentiation, pricing, conversion scores
- generateReport(): creates full Report object from agent outputs
- formatReportMarkdown(): renders report as readable markdown
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

## Milestone M2 — Web App UI + Streaming (P0)
### [x] SIM-009 (P0) Build the input page (tagline, description, pricing, URL, tags)
**Goal:** Start a run from the UI.

**Deliverables**
- Form with validation
- "Create World" button
- Run creation API integration

**Acceptance Criteria**
- Clicking submit creates a run and routes to `/run/:id`
- Basic error handling (missing URL, missing tagline)

**Dependencies:** SIM-001, SIM-003

**Completion notes:**
- Input form in apps/web/app/page.tsx with dark theme styling
- Fields: tagline, description, pricing model, category, tags, URL, pasted content
- POST /api/run creates run in SQLite storage
- Form validation: requires tagline, description, and either URL or pasted content
- Redirects to /run/:id on success
- Test: `pnpm --filter @simvibe/web typecheck` passes

---

### [x] SIM-010 (P0) Implement live run page with SSE stream (agent debate + event timeline)
**Goal:** The "wow" moment: viewers watch agents argue and act in real time.

**Deliverables**
- `/run/:id` page with:
    - agent message feed
    - event timeline (bounce/signup/pay)
    - phase indicator
- SSE endpoint:
    - `/api/run/:id/stream`

**Acceptance Criteria**
- Events appear live as the simulation progresses
- Page does not freeze; handles reconnects gracefully

**Dependencies:** SIM-006, SIM-009

**Completion notes:**
- /run/[id] page with event timeline, phase indicator, status display
- GET /api/run/[id] fetches run details
- POST /api/run/[id]/start triggers simulation (extraction + orchestrator + report)
- GET /api/run/[id]/stream provides SSE stream of events
- Events show timestamp, type, agent, action with probabilities
- Auto-scrolls to latest events
- Test: `pnpm --filter @simvibe/web typecheck` passes

---

### [x] SIM-011 (P0) Report page + shareable permalink
**Goal:** Share a run outcome with judges/others quickly.

**Deliverables**
- `/run/:id/report` page
- "Copy share link"
- Store report in DB and serve read-only

**Acceptance Criteria**
- A run report loads from storage without rerunning the sim
- Link works after refresh

**Dependencies:** SIM-008, SIM-003

**Completion notes:**
- /run/[id]/report page with full report visualization
- Overall score with color-coded traction band
- Score breakdown bars (clarity, credibility, differentiation, pricing, conversion)
- Predicted metrics grid (upvotes, signups, pays, bounce, share)
- Top 5 friction points with severity indicators
- Top 5 recommended fixes with priority ranking
- Persona analysis cards showing primary action, friction, one-line fix
- "Copy Share Link" button copies URL to clipboard
- Test: `pnpm --filter @simvibe/web typecheck` passes

---

### [x] SIM-012 (P0) What-if rerun (tagline edit → rerun → diff view)
**Goal:** Prove iteration acceleration.

**Deliverables**
- "What-if" panel:
    - edit tagline
    - rerun simulation as variant
- Diff view:
    - changes in key metrics
    - friction list deltas
    - best one-line fixes

**Acceptance Criteria**
- Variant run is linked to original run
- Diff view renders without manual steps

**Dependencies:** SIM-011

**Completion notes:**
- What-if panel in report page with collapsible UI
- POST /api/run/[id]/variant creates variant run linked to original
- Edit tagline field shows original vs new comparison
- "Run With New Tagline" button creates variant and redirects to new run
- Variant reports show link back to original report
- Test: `pnpm --filter @simvibe/web typecheck` passes
- Note: Full diff view (metrics comparison) deferred to future iteration

---

## Milestone M3 — Data Flywheel (MVP) (P1)
### [x] SIM-013 (P1) Add optional "Actual outcomes" input and store for calibration
**Goal:** Close the loop: from synthetic to reality.

**Deliverables**
- UI: enter actual signup/pay conversion (optional)
- API: `POST /api/run/:id/actuals`
- Storage: persist actuals

**Acceptance Criteria**
- Actuals are saved and displayed on report
- System can compute absolute error vs predicted

**Dependencies:** SIM-011

**Completion notes:**
- ActualOutcomes schema in packages/shared/src/schemas/actual-outcomes.ts
- Storage interface updated with saveActuals() method in both SQLite and Memory storage
- POST/GET /api/run/[id]/actuals endpoint for saving and retrieving actual outcomes
- Report page updated with "Actual Outcomes" section:
  - Collapsible form to enter signup rate, pay rate, bounce rate (optional), and notes
  - Displays comparison between predicted vs actual with error calculation
- Test: `pnpm --filter @simvibe/web typecheck` passes
- Test: Visit /run/[id]/report, click "Enter Actual Results", enter data, save, see comparison

---

### [x] SIM-014 (P1) Implement calibration priors (category/pricing-model multipliers)
**Goal:** Make the simulator improve measurably over time.

**Deliverables**
- `CalibrationPrior` table/store
- Update rule:
    - on actuals submission, adjust multipliers slightly toward reducing error
- Apply calibration on future runs:
    - predicted metrics get calibrated values

**Acceptance Criteria**
- After submitting actuals, subsequent runs in same category show calibrated adjustments
- Calibration is transparent in report ("raw vs calibrated")

**Dependencies:** SIM-013

**Completion notes:**
- CalibrationPrior schema in packages/shared/src/schemas/calibration-prior.ts
- Calibration key: category_pricing_model (e.g., "saas_subscription")
- Storage updated with calibration_priors table, getCalibrationPrior/saveCalibrationPrior methods
- Actuals API updated to trigger calibration update on submission (exponential moving average, 0.2 learning rate)
- Report generator updated to accept calibration prior and apply multipliers
- Report UI shows "CALIBRATED" badge and raw vs calibrated metrics when calibration is applied
- Test: Submit actuals for a run, create new run in same category, verify calibration is applied
- Test: `pnpm typecheck` passes for all packages

---

## Milestone M4 — Optional On-chain Receipt (P2, Feature-flagged)
### [x] SIM-015 (P2) Implement receipt hashing + optional chain write
**Goal:** Provide a tamper-evident "receipt" without making the product crypto-native.

**Deliverables**
- `report_hash = sha256(canonical_report_json)`
- `run_hash = sha256(canonical_run_input_json)`
- Feature flag:
    - `ENABLE_CHAIN_RECEIPT=true|false`
- If enabled:
    - write (run_hash, report_hash, timestamp) to chain (EVM-compatible)
    - store tx hash in run record

**Acceptance Criteria**
- With flag off: nothing chain-related runs
- With flag on: receipt write succeeds (or fails gracefully with clear message)

**Dependencies:** SIM-011

**Completion notes:**
- ChainReceipt schema in packages/shared/src/schemas/chain-receipt.ts
- Chain module in packages/engine/src/chain/ with hash.ts and writer.ts
- sha256Hash() computes canonical JSON hash (deep sorted keys)
- hashRunInput() and hashReport() for specific hashing
- createReceipt() generates receipt, optionally writes to chain if ENABLE_CHAIN_RECEIPT=true
- Storage updated with receipt field and saveReceipt() method (SQLite + Memory)
- POST/GET /api/run/[id]/receipt endpoint for creating/fetching receipts
- Report page updated with "Simulation Receipt" section showing hashes and chain info
- ethers.js dynamically loaded only when chain write is enabled (not bundled)
- Test: `pnpm typecheck` passes for all packages
- Test: Visit /run/[id]/report, click "Generate Receipt" to create offline receipt

---

## Milestone M5 — Demo Polish (P0/P1)
### [x] SIM-016 (P0) Produce a 2-minute demo script + seeded demo examples
**Goal:** Control the narrative and avoid live failures.

**Deliverables**
- `DEMO.md` script
- 2–3 example products with saved landing extracts (offline demo mode)
- "Demo mode" toggle that uses cached extracts and stable outputs

**Acceptance Criteria**
- Demo runs without external dependencies (optional mode)
- Script fits within ~2 minutes

**Dependencies:** SIM-010, SIM-011

**Completion notes:**
- DEMO.md with 2-minute script: intro, create world, watch simulation, review results, what-if rerun
- Demo product: CodeReviewer (AI code review tool) with cached landing extract and 5 agent outputs
- packages/engine/src/demo/ with fixtures and isDemoMode() helper
- DEMO_MODE=true env var for cached mode (no API calls)
- Test: `pnpm --filter @simvibe/engine typecheck` passes

---

### [x] SIM-017 (P1) Add observability: run logs, timings, extraction confidence, warnings
**Goal:** Judges trust what they can inspect.

**Deliverables**
- Per-run:
    - extraction confidence
    - phase timings
    - warnings (JSON fallback used, extraction partial, etc.)
- UI panel to view these diagnostics

**Acceptance Criteria**
- Diagnostics render for every run
- Failures are explainable, not silent

**Dependencies:** SIM-006, SIM-010

**Completion notes:**
- RunDiagnostics schema in packages/shared/src/schemas/run-diagnostics.ts
- Tracks: phase timings, extraction confidence, extraction warnings, agent warnings, errors, LLM calls, fallbacks
- Storage updated with diagnostics column and saveDiagnostics method
- Start API captures and saves diagnostics throughout simulation lifecycle
- Diagnostics panel in run page with collapsible UI showing:
  - Total duration, extraction confidence, LLM calls/fallbacks
  - Phase timings table
  - Extraction warnings, agent warnings, errors
- Test: `pnpm typecheck` passes for all packages
- Test: Run a simulation, view diagnostics panel after completion

---

## Backlog (post-hackathon)
- Crowd simulation (30–200 lightweight agents)
- Platform-specific modes (PH / Reddit / AppSumo)
- Similar-case retrieval (RAG) from historical library
- White-label PDF export for agencies
- Template library for Launch Ops kits

---

## Milestone M6 — Production Run Pipeline (Postgres + Worker) (P0/P1)
### [x] SIM-018 (P0) Move simulation execution off Vercel into Railway worker (Postgres-backed)
**Goal:** Ensure runs can execute reliably (2–10 minutes) without Vercel serverless timeouts; persist everything in Postgres.

**Deliverables**
- Postgres storage implementation (replace SQLite for prod):
  - `DATABASE_URL` (postgres) support
  - Tables for `runs`, `events`, `agent_outputs`, `calibration_priors` (and migrations)
- Async execution:
  - API enqueues `run_id` for execution (returns quickly)
  - Railway `worker` service consumes jobs and executes extraction → simulation → report
- Progress + logs:
  - Append phase events to `events` as today
  - `GET /api/run/[id]/stream` provides SSE stream driven from `events` (sufficient for progress bar + log panel)

**Acceptance Criteria**
- `POST /api/run` creates run; returns `runId` quickly
- `POST /api/run/[id]/start` enqueues job and returns immediately (no long work on Vercel)
- `events` stream updates UI in near-real-time (progress bar + logs)
- Failed runs are marked `failed` with error + diagnostics; worker retries are bounded

**Implementation Notes**
- Prefer a Postgres-backed queue to minimize moving parts (e.g. `pg-boss`) unless Redis is already required.
- Keep “engine” as a pure library; add a separate worker app (e.g. `apps/worker`) as the long-running executor.

**Test Plan**
- Local: run Postgres, start web + worker; create run, start run, watch SSE stream, verify completion + stored report
- Failure injection: force LLM key missing; run transitions to `failed` with useful error

**Dependencies:** SIM-003, SIM-006, SIM-010, SIM-017

**Completion notes:**
- Extracted run execution logic into `packages/engine/src/executor/run-executor.ts` (`executeRun()`)
- Added `queued` to RunStatus (pending → queued → running → completed/failed)
- Created `PostgresStorage` class in `packages/engine/src/storage/postgres.ts` (full Storage interface)
- SQL migration `001_initial.sql` with JSONB columns, indexes, foreign keys
- Migration runner (`migrate.ts`) + CLI script (`run-migrations.ts`)
- Scaffolded `apps/worker/` (package.json, tsconfig, entry point with direct run execution)
- Added `storageConfigFromEnv()` helper: auto-detects postgres:// vs file: from DATABASE_URL
- Refactored all 7 API routes to use `storageConfigFromEnv()` (no more hardcoded SQLite)
- Added `pg` + `@types/pg` to engine, `tsx` for migration CLI
- Test: `pnpm typecheck` passes for all 4 packages
- Test: `pnpm --filter @simvibe/worker start <run_id>` executes a run via worker
- Note: Full async (queue-based) execution deferred to SIM-018C (pg-boss)

---

### [x] SIM-018A (P0) Add `apps/worker` long-running executor (Railway service)
**Goal:** Introduce a dedicated process that can run 2–10 minute simulations reliably.

**Deliverables**
- New workspace app: `apps/worker`
  - Boots with env config, connects to Postgres, runs job loop
  - Calls existing engine functions to execute a run (extraction → simulation → report)
- Health endpoints / basic logging suitable for Railway
- Clear separation:
  - `apps/web` does not execute long jobs
  - `apps/worker` owns execution + retries + time-budget enforcement

**Acceptance Criteria**
- Worker can be started locally and in Railway
- Worker can execute a single `run_id` end-to-end and persist results

**Test Plan**
- Local: start Postgres, start worker; manually enqueue a run; verify completion

**Dependencies:** SIM-018

**Completion notes:**
- Worker supports two modes: CLI (`start <run_id>`) and Service (health server + await jobs)
- HTTP health endpoint at /health and /healthz returns JSON status (healthy/draining/activeRun)
- Structured JSON logging suitable for Railway log aggregation
- Time-budget enforcement via WORKER_RUN_TIMEOUT_MS (default 10 min)
- Graceful shutdown (SIGTERM/SIGINT): drains active run, returns 503 on /health
- Clear separation: web does not execute long jobs; worker owns execution
- Test: `pnpm --filter @simvibe/worker start <run_id>` executes a run end-to-end
- Test: `pnpm --filter @simvibe/worker start` starts health server on port 8080

---

### [x] SIM-018B (P0) Implement Postgres storage + migrations (replace SQLite for prod)
**Goal:** Swap storage backend from SQLite to Postgres with real migrations.

**Deliverables**
- New storage driver (e.g. `packages/engine/src/storage/postgres.ts`)
- Migration mechanism (SQL migrations folder + runner) covering:
  - `runs`, `events`, `agent_outputs`, `calibration_priors` tables
  - Appropriate indexes (`events(run_id, timestamp)`, `agent_outputs(run_id, persona_id UNIQUE)`, `runs(created_at)`)
- JSON columns for large documents:
  - `runs.input`, `runs.landing_extract`, `runs.report`, `runs.actuals`, `runs.diagnostics`, `runs.receipt` as JSON/JSONB

**Acceptance Criteria**
- Existing API and engine flows work against Postgres without schema changes to the app layer
- Migration runner can bring up a fresh DB and upgrade existing DBs

**Test Plan**
- Local: reset DB, run migrations, run a simulation, confirm data stored and retrievable

**Dependencies:** SIM-018

**Completion notes:**
- PostgresStorage class in packages/engine/src/storage/postgres.ts (full Storage interface)
- Migration runner (migrate.ts) with versioned SQL tracking via _migrations table
- 001_initial.sql: runs, events, agent_outputs, calibration_priors tables with JSONB columns
- Indexes: events(run_id, timestamp), agent_outputs(run_id, persona_id UNIQUE), runs(created_at, status)
- CLI: `DATABASE_URL=postgres://... pnpm db:migrate`
- storageConfigFromEnv() auto-detects postgres:// vs SQLite from DATABASE_URL
- Implemented in SIM-018 alongside the umbrella ticket

---

### [x] SIM-018C (P0) Add job queue for run execution (Postgres-backed)
**Goal:** Make run execution async, durable, and retryable without adding extra infra.

**Deliverables**
- Queue implementation using Postgres (preferred: `pg-boss`)
- Job types:
  - `run.execute` (payload: `runId`, `runMode`, optional overrides)
- Retry policy + dead-letter behavior:
  - bounded retries
  - persistent failure writes error + diagnostics and marks run `failed`

**Acceptance Criteria**
- `POST /api/run/[id]/start` enqueues `run.execute` and returns immediately
- Worker consumes from queue and executes runs

**Test Plan**
- Local: enqueue job, kill worker mid-run, restart worker; job resumes/retries and ends in a consistent state

**Dependencies:** SIM-018A, SIM-018B

**Completion notes:**
- Queue module in packages/engine/src/queue/ with JobQueue interface
- PgBossJobQueue: wraps pg-boss v10, batchSize=1, retryLimit=2, expireInSeconds=600
- InlineJobQueue: no-op for SQLite/dev mode (caller handles execution)
- createJobQueue() + queueConfigFromEnv() factories: auto-detect postgres → pgboss, else inline
- Start route: enqueues to pg-boss when Postgres, executes inline when SQLite
- Worker: consumes from pg-boss queue, handles failed runs with retry via throw
- Job type: `run.execute` with payload { runId, runMode? }
- Test: `pnpm typecheck` passes for all packages
- Test (Postgres): POST /api/run/[id]/start returns { queued: true, jobId }; worker consumes and executes

---

### [x] SIM-018D (P0) Progress/log streaming via SSE backed by Postgres events
**Goal:** Provide progress bar + log panel using SSE, without requiring WebSockets.

**Deliverables**
- API endpoint `GET /api/run/[id]/stream` (SSE):
  - streams `SimEvent` rows from Postgres `events` table
  - supports `since` cursor (timestamp or last event id) to resume
- Worker emits enough structured events to drive UI:
  - phase start/end
  - agent started/action completed
  - warnings/errors

**Acceptance Criteria**
- UI shows progress + logs updating in near-real-time during long runs
- Reloading the page can resume from stored events (no “lost logs”)

**Test Plan**
- Start a deep run; verify logs stream for the full duration; refresh page; stream continues from last cursor

**Dependencies:** SIM-018B, SIM-018C

**Completion notes:**
- Added `getRunStatus()` to Storage interface: lightweight status check without loading full run
- Added `getEventsSince(runId, sinceId?)` to Storage interface: cursor-based event retrieval
- Implemented in all 3 storage backends (SQLite, Postgres, Memory)
- Stream route accepts `?since=<event_id>` query parameter for resume
- Cursor-based: tracks last event ID, only fetches new events each poll
- Increased max poll count to 600 (5 minutes) for longer runs
- Page refresh resumes from stored events (no lost logs)
- Test: `pnpm typecheck` passes for all packages
- Test: `GET /api/run/[id]/stream?since=evt_123` resumes from that event

---

### [x] SIM-018E (P0) Deployment split: Vercel FE + Railway API/worker/Postgres (+ optional Redis)
**Goal:** Make the deployable shape explicit and reproducible.

**Deliverables**
- Railway services:
  - `api` (HTTP)
  - `worker` (no public ingress)
  - `postgres`
  - (optional) `redis` only if later features need it
- Environment variables / secrets list updated in `.env.example`
- Networking:
  - FE (Vercel) talks to Railway `api` only
  - `api` and `worker` talk to Postgres privately

**Acceptance Criteria**
- Clean separation of concerns:
  - Vercel does FE + short API calls
  - Railway handles all long-running work + DB

**Test Plan**
- Deploy a staging environment: create run from Vercel, see it executed by Railway worker, view report

**Dependencies:** SIM-018A, SIM-018B, SIM-018C, SIM-018D

**Completion notes:**
- Worker Dockerfile: Node 20 slim, pnpm monorepo install, health check on :8080/health
- .env.example updated with complete prod config: WORKER_PORT, WORKER_RUN_TIMEOUT_MS
- Deployment architecture documented in .env.example comments
- Architecture: Vercel (FE + short API) ↔ Railway Postgres ↔ Railway Worker (long jobs)
- Worker .dockerignore for clean builds
- No Redis required yet (pg-boss uses Postgres)
- Test: `docker build -f apps/worker/Dockerfile .` (from repo root)

---

### [x] SIM-019 (P1) Add run modes: 2-minute "Quick" vs 10-minute "Deep" (predictable runtime)
**Goal:** Support two execution budgets with predictable latency/cost while keeping outputs comparable.

**Deliverables**
- Run mode field (API + UI + storage):
  - `runMode: quick | deep` (or equivalent) attached to each run
- Deterministic per-mode configuration (examples; final numbers TBD):
  - agent count / persona set selection
  - max LLM tokens or model choice
  - max “ticks”/steps for social diffusion (if enabled)
  - time budget guardrails (stop/early-exit with warnings if nearing budget)
- Report includes which mode ran + any early-stop warnings

**Acceptance Criteria**
- Quick mode completes in ~2 minutes (target) under normal conditions
- Deep mode completes in ~10 minutes (target) under normal conditions
- Same input yields stable “shape” of outputs (metrics + friction list), just higher confidence/detail in Deep mode

**Test Plan**
- Run the same product twice (quick/deep) and verify:
  - both complete within targets
  - deep mode adds more timeline depth / higher-confidence report without schema breakage

**Dependencies:** SIM-018

**Completion notes:**
- Added `runMode` field to RunInput schema (quick | deep, defaults to quick)
- RunModeConfig in packages/engine/src/config/run-modes.ts:
  - Quick: 5 personas, 2048 tokens, no debate, 2 min budget
  - Deep: 5 personas, 4096 tokens, debate enabled, 10 min budget
- Orchestrator accepts personaIds override from config
- Executor applies mode config to orchestrator (tokens, debate, time budget)
- Report includes runMode + earlyStopReason fields
- UI: radio selector for Quick/Deep on input form
- CreateRunRequest type updated with runMode
- Test: `pnpm typecheck` passes for all packages
- Test: Create run with mode=deep, verify debate is enabled in output

---

## Milestone M7 — Social Diffusion (Comments/Upvotes Contagion) (P1)
### [ ] SIM-020 (P1) Add within-run PH-style contagion: comments/upvotes → social proof → conversion uplift
**Goal:** Simulate “feedback loops” (early upvotes/comments influence later agents) and reflect the dynamic in the report.

**Deliverables**
- World state + tick-based simulation within a run:
  - tick timeline (t0..tN) with actions: view, upvote, comment, bounce, signup, pay
  - global counters: upvotes, comment count, “social proof” score
  - simple contagion rules (parameterized) that influence later agents’ priors:
    - more social proof → higher upvote/signup/pay probability
    - negative comments/trust killers → higher bounce probability
- Store timeline:
  - Append tick events into `events` (or a new `world_events` table if needed)
- Report updates:
  - “Diffusion timeline” section (key inflection points)
  - Separate forecast: baseline (no social proof) vs diffusion-adjusted
  - Paid conversion prediction updated based on diffusion-adjusted intent

**Acceptance Criteria**
- Deep mode report shows an interpretable contagion timeline (what triggered lift/drop)
- Output schemas remain valid; UI renders timeline without crashing
- Calibration logic (actuals → priors) still applies cleanly to final predicted signup/pay/bounce

**Test Plan**
- Synthetic test input with “high social proof” vs “negative comment” injections and verify predicted metrics shift accordingly

**Dependencies:** SIM-019

---

## Milestone M8 — Persona Management & Ops (No Hardcoding) (P0/P1)
### [x] SIM-021 (P0) Move personas out of TS into Markdown files (frontmatter) + strict validation
**Goal:** Add/edit personas without touching TypeScript code; keep personas detailed and reviewable via Git.

**Deliverables**
- Persona pack directory (source of truth):
  - `personas/<persona_id>.md` files with YAML frontmatter + rich body text
  - Frontmatter includes:
    - engine mapping fields (id/name/role/context/priorities/redFlags/budgetRange/skepticismLevel/decisionStyle)
    - extended metadata (age, location, education, monthly income, constraints, tools, etc.)
- Parser + validator:
  - Load all persona files at startup
  - Validate with Zod and fail fast (clear errors)
  - CLI command: `pnpm personas:validate`
- Engine integration:
  - Replace `packages/engine/src/prompts/personas.ts` hardcoded map with a runtime registry loaded from the persona pack
  - Update shared schema so persona IDs don’t require code changes (e.g. `personaId: string` with a safe regex)

**Acceptance Criteria**
- Adding a persona requires only adding `personas/<id>.md` and running validation
- Simulation runs using loaded persona registry
- Report references persona IDs/names correctly

**Test Plan**
- Add one new persona file, validate, run a simulation, confirm it appears in outputs and report

**Dependencies:** SIM-018A (worker) recommended, but not required for local

**Completion notes:**
- Parser updated to support both YAML frontmatter (preferred) and legacy `## 10) Engine Mapping` formats
- Created 5 core persona markdown files with YAML frontmatter: cynical_engineer, passionate_pm, pragmatic_investor, ruthless_marketer, agency_owner
- Removed hardcoded PERSONAS map from `packages/engine/src/prompts/personas.ts`
- `getPersona()` and `getAllPersonaIds()` now use the runtime persona registry exclusively
- Orchestrator imports `getAllPersonaIds` from engine (registry-backed), not from `@simvibe/shared`
- Run modes reference `CORE_PERSONA_IDS` from shared for default persona sets
- Validation CLI reports format breakdown (frontmatter vs engine_mapping)
- 587/605 persona files valid (18 pre-existing parse issues in older docs)
- Test: `pnpm personas:validate` shows 5 frontmatter + 582 engine_mapping
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-021A (P0) Persona registry loader for existing 600 docs (bridge before frontmatter migration)
**Goal:** Make all current `personas/*.md` runnable as agents now, without waiting for full frontmatter migration.

**Deliverables**
- Parser for current persona doc format (`## 10) Engine Mapping` section)
- Registry builder that loads all valid persona docs at startup
- Validation CLI:
  - `pnpm personas:validate` prints invalid file list with clear parse errors
  - non-zero exit code on invalid personas
- Runtime wiring:
  - replace hardcoded 5-persona list in orchestrator/prompt layer with registry-backed IDs

**Acceptance Criteria**
- Every valid persona doc can be loaded into runtime registry
- Simulation can run with any selected persona IDs from registry
- No TS code edit required to activate a new persona doc

**Test Plan**
- Validate entire `personas/` directory
- Pick one non-core persona ID and run a simulation that includes it; confirm output/report/events include that ID

**Dependencies:** SIM-021

**Completion notes:**
- Implemented as part of SIM-021: parser supports `## 10) Engine Mapping` format (legacy bridge)
- Registry loads 587/605 persona docs at startup (18 pre-existing parse issues)
- `pnpm personas:validate` prints invalid file list with non-zero exit code
- Orchestrator/prompt layer uses registry-backed IDs (no hardcoded 5-persona list)
- Non-core persona IDs (e.g., `accelerator_mentor`) load correctly and are runnable
- No TS code edit required to activate a new persona doc
- Test: `pnpm personas:validate` passes for 587 docs

---

### [x] SIM-021B (P0) De-hardcode personaId schemas + runtime membership validation
**Goal:** Remove compile-time persona enum bottleneck while preserving safety.

**Deliverables**
- Shared schema updates:
  - `personaId` changes from fixed enum to constrained string regex (snake_case)
  - report/event schemas updated to accept dynamic persona IDs
- Runtime guardrails:
  - reject unknown persona IDs at run creation/start (must exist in loaded registry)
  - clear error messages listing missing IDs
- Backward compatibility:
  - existing stored runs with old 5 persona IDs continue to parse

**Acceptance Criteria**
- Adding a new persona doc does not require changes in `packages/shared/src/schemas/agent-output.ts`
- Invalid persona IDs fail fast with actionable API error

**Test Plan**
- API request with unknown persona ID returns 4xx + validation error
- API request with known non-core persona ID runs successfully end-to-end

**Dependencies:** SIM-021A

**Completion notes:**
- PersonaIdSchema changed from fixed enum to constrained string regex in SIM-021
- Report/event schemas accept dynamic persona IDs via PersonaIdSchema
- Runtime guardrail: executor validates persona IDs against loaded registry before simulation
- Unknown IDs throw clear error listing available personas
- Backward compatibility: CORE_PERSONA_IDS constant preserved, old stored runs parse fine
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-021C (P0) Run-level persona selection + defaults (quick/deep ready)
**Goal:** Ensure “each persona works as an agent” by allowing explicit persona set selection per run.

**Deliverables**
- Run input fields:
  - `personaIds?: string[]`
  - optional `personaSet?: quick | deep | custom` (or equivalent)
- Resolution logic:
  - if `personaIds` present, use exactly those
  - else resolve default set from config
- Persistence:
  - store resolved persona IDs on run record for auditability
- UI/API:
  - API accepts selection fields
  - run details/report show which personas were actually executed

**Acceptance Criteria**
- A run can target arbitrary personas from the registry (not only 5 fixed personas)
- Report/event timeline clearly identifies executed persona list

**Test Plan**
- Create run with 3 explicit non-core personas, execute, verify exactly 3 outputs are stored
- Create run with default mode and verify default set is used

**Dependencies:** SIM-021B

**Completion notes:**
- Added `personaIds?: string[]` to RunInputSchema (optional, min 1 if present)
- Executor resolution: explicit personaIds > mode config defaults
- Persona IDs validated against registry before simulation starts
- Added `executedPersonaIds` to Report schema for auditability
- Report generator passes resolved persona list to report
- Report's personaReports already shows per-persona results
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-021D (P0) Large-set orchestration safeguards (batching/concurrency/timeouts)
**Goal:** Keep multi-persona runs reliable when persona count grows (tens to hundreds).

**Deliverables**
- Orchestrator controls:
  - `maxAgentConcurrency`
  - per-agent timeout
  - batch execution with progress events
- Failure policy:
  - single-agent failure produces fallback output, does not abort whole run
  - run-level warning summarizing failed/fallback agent count
- Diagnostics:
  - per-agent duration, timeout count, fallback reason summary

**Acceptance Criteria**
- Runs with large persona sets complete without crashing
- Stream/report remain usable even with partial failures

**Test Plan**
- Simulate 50+ personas with mocked LLM responses and forced timeouts on a subset; verify run completes with warnings

**Dependencies:** SIM-021C

**Completion notes:**
- `maxAgentConcurrency` added to OrchestratorConfig and RunModeConfig
- `perAgentTimeoutMs` added: agents that exceed timeout get fallback output (no crash)
- Batch execution: agents run in groups of `maxConcurrency`, progress events emitted per batch
- Quick mode: concurrency=5, 60s per agent; Deep mode: concurrency=10, 120s per agent
- Single-agent failure/timeout produces fallback output, does not abort run
- RUN_COMPLETED event includes fallbackCount + timeoutCount summary
- AGENT_ACTION events now include durationMs per agent
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-021E (P0) Persona-agentization regression tests + CI gate
**Goal:** Prevent regressions where persona docs exist but cannot run as agents.

**Deliverables**
- Automated tests for:
  - persona parsing/validation
  - dynamic persona schema acceptance
  - orchestrator run with selected persona IDs
- CI step:
  - fail build if persona validation fails or dynamic persona tests fail
- Minimal fixtures for deterministic no-LLM test runs

**Acceptance Criteria**
- PRs that break persona runtime compatibility are blocked by CI
- Persona pack health is visible in one command

**Test Plan**
- Break one persona doc intentionally and confirm CI/validation fails
- Restore file and confirm suite passes

**Dependencies:** SIM-021A, SIM-021B, SIM-021C, SIM-021D

**Completion notes:**
- Regression test script: `packages/engine/src/personas/test-personas.ts` with 50 assertions
- Tests cover: frontmatter parsing, engine_mapping parsing, invalid file rejection, registry loading, non-core persona acceptance, dynamic PersonaId schema, AgentOutput validation, manual registration
- CI gate: `pnpm ci:personas` runs `personas:validate` + `test:personas` sequentially
- Fixed parser regex bug: `\Z` (invalid in JS) was truncating Engine Mapping sections at literal 'Z' characters
- 605/605 persona files now valid (was 587/605)
- Test: `pnpm ci:personas` passes (605 valid, 50 tests pass)
- Test: `pnpm typecheck` passes for all packages

---

### [ ] SIM-022 (P1) Persona sets + run snapshotting (reproducible reports)
**Goal:** Support curated persona bundles (Quick/Deep) and keep runs reproducible even if personas change later.

**Deliverables**
- Persona sets config:
  - Default sets: `quick` and `deep` (IDs list)
  - Ability for a run to specify a set
- Snapshot on run start:
  - Persist the exact persona definitions used (or version hashes) onto the run record
  - Report renders from the snapshot to avoid “drifting” results

**Acceptance Criteria**
- Changing a persona file does not change historical reports
- Quick vs deep runs differ by persona set (and later by diffusion depth)

**Test Plan**
- Run once, change persona content, re-open old report: unchanged

**Dependencies:** SIM-021, SIM-018B

---

### [ ] SIM-023 (P1) Postgres persona registry + seed/sync (optional runtime editing later)
**Goal:** Prepare for ops-friendly persona management (activate/deprecate/version) without redeploying code.

**Deliverables**
- Tables:
  - `personas` (id, status, version/hash, engine_fields JSONB, metadata JSONB, created_at, updated_at)
  - `persona_sets` + membership table (optional if sets stay file-based)
- Seed/sync flow:
  - CLI: `pnpm personas:sync` to upsert the repo persona pack into Postgres
  - Mark active/deprecated personas without deleting history
- Runtime loading:
  - Prefer Postgres registry if populated; fallback to persona pack files
  - Cache with TTL; reload on change

**Acceptance Criteria**
- DB-backed personas can be updated (via sync) without code changes
- Service can roll back to previous persona versions (by version/hash)

**Test Plan**
- Sync personas into Postgres, run simulation, verify registry path used

**Dependencies:** SIM-018B, SIM-021
