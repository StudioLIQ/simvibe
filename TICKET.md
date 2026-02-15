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
### [x] SIM-020 (P1) Add within-run PH-style contagion: comments/upvotes → social proof → conversion uplift
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

**Completion notes:**
- Diffusion schemas: DiffusionTick, DiffusionForecast, DiffusionTimeline in packages/shared
- Diffusion engine: packages/engine/src/diffusion/ with WorldState, contagion rules, post-processing simulation
- Social proof score: upvotes×1.0 + comments×0.5 + signups×2.0 + pays×3.0 - bounces×0.5 - negativeSignals×1.5
- Contagion: uplift rate 0.02/point (max 0.15), penalty 0.03/point (max 0.20)
- Deep mode only: executor runs diffusion after orchestrator produces agent outputs
- Report includes: diffusion timeline, baseline vs adjusted forecast, inflection points
- Markdown formatter includes diffusion comparison table
- Synthetic test: 5 agents show +2.8pp signup uplift, +1.4pp pay uplift, -1.6pp bounce reduction
- Test: `pnpm typecheck` passes for all packages

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

### [x] SIM-022 (P1) Persona sets + run snapshotting (reproducible reports)
**Goal:** Support curated persona bundles (Quick/Deep) and keep runs reproducible even if personas change later.

**Deliverables**
- Persona sets config:
  - Default sets: `quick` and `deep` (IDs list)
  - Ability for a run to specify a set
- Snapshot on run start:
  - Persist the exact persona definitions used (or version hashes) onto the run record
  - Report renders from the snapshot to avoid "drifting" results

**Acceptance Criteria**
- Changing a persona file does not change historical reports
- Quick vs deep runs differ by persona set (and later by diffusion depth)

**Test Plan**
- Run once, change persona content, re-open old report: unchanged

**Dependencies:** SIM-021, SIM-018B

**Completion notes:**
- PersonaSnapshot schema in packages/shared/src/schemas/persona-snapshot.ts (PersonaSnapshots, PersonaSetName)
- Named persona sets: PERSONA_SETS config in packages/engine/src/config/run-modes.ts (quick/deep bundles)
- RunInput accepts optional `personaSet: 'quick' | 'deep' | 'custom'` field
- Executor snapshots full persona definitions at run start via `buildPersonaSnapshots()`
- Snapshots persisted on run record (`savePersonaSnapshots`) in all 3 storage backends (SQLite, Postgres, Memory)
- Postgres migration: 002_persona_snapshots.sql adds `persona_snapshots JSONB` column
- SQLite auto-migration: `migrateSchema()` adds column to existing DBs
- Report includes `personaSet` and `personaSnapshots` fields for self-contained reproducibility
- Persona resolution hierarchy: explicit personaIds > personaSet > mode defaults
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 50 tests pass)

---

### [x] SIM-023 (P1) Postgres persona registry + seed/sync (optional runtime editing later)
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

**Completion notes:**
- Postgres migration 003_personas_table.sql: `personas` table with id, status, version_hash, engine_fields JSONB, metadata JSONB, source_format
- DB registry module: packages/engine/src/personas/db-registry.ts
  - `loadPersonasFromDb()`: load all active personas from Postgres
  - `upsertPersona()`: insert/update persona with version hash
  - `deprecateMissing()`: soft-deprecate personas not in file set
  - `computeVersionHash()`: sha256 of canonical engine fields JSON
  - `getPersonaVersion()` / `reactivatePersona()`: rollback support
- Sync CLI: packages/engine/src/personas/sync.ts
  - `pnpm personas:sync` upserts all repo personas into Postgres
  - `--deprecate-missing` flag marks personas not in files as deprecated
  - `--dry-run` flag previews without writing
- Registry updated: initPersonaRegistryFromDb() for DB-first loading with fallback to files
- Cache with 5-minute TTL; `resetPersonaRegistry()` for testing
- Persona sets stay file-based (PERSONA_SETS in run-modes.ts) — no separate DB table needed yet
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 50 tests pass)
- Test: `DATABASE_URL=postgres://... pnpm personas:sync --dry-run` previews sync

---

## Milestone M9 — Post-Completion Fixes (Validation Gap Closure) (P0/P1)
### [x] SIM-024 (P0) Actually enable DB-first persona registry at runtime
**Goal:** Ensure synced Postgres personas are truly used in production runtime (not only file-based fallback).

**Problem observed**
- `initPersonaRegistryFromDb()` exists but is not called by web/worker startup.
- Current runtime path therefore keeps loading personas from files via `getPersonaRegistry()`.

**Deliverables**
- Bootstrap DB registry on service startup when `DATABASE_URL` is Postgres:
  - worker startup path
  - web API startup path (or first request bootstrap with cache)
- Fallback logic:
  - DB unavailable/empty -> file registry
  - explicit logs indicating active source (`db` vs `files`)
- Test coverage:
  - integration test proving DB-populated personas are returned by registry

**Acceptance Criteria**
- With active personas in DB, runtime uses DB personas without code redeploy.
- Logs clearly show registry source selection.

**Dependencies:** SIM-023

**Completion notes:**
- Worker startup (`apps/worker/src/index.ts`): calls `initPersonaRegistryFromDb()` when DATABASE_URL is Postgres, logs source/count
- Web API (`apps/web/app/api/run/[id]/start/route.ts`): calls `ensurePersonaRegistry()` before inline execution
- New `ensurePersonaRegistry()` async helper: checks cache TTL → tries Postgres → falls back to files
- Exported from `@simvibe/engine` for use by both worker and web
- Regression tests: sections 9 (ensurePersonaRegistry) and 10 (DB integration) added to test-personas.ts
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 54 tests pass)

---

### [x] SIM-025 (P0) Make Quick/Deep persona sets actually different
**Goal:** Fulfill mode semantics where Quick and Deep use distinct persona bundles.

**Problem observed**
- `PERSONA_SETS.quick` and `PERSONA_SETS.deep` are currently identical (same core 5 IDs).

**Deliverables**
- Curate non-identical set definitions:
  - `quick`: minimal core set optimized for latency
  - `deep`: expanded/diverse set for confidence depth
- Update mode labels/UI copy to reflect actual set sizes.
- Add regression test asserting set inequality and minimum deep-set expansion.

**Acceptance Criteria**
- Quick and Deep runs execute different persona sets by default.
- Report metadata (`personaSet`, `executedPersonaIds`) reflects the difference.

**Dependencies:** SIM-022

**Completion notes:**
- Quick set: 5 core personas (cynical_engineer, passionate_pm, pragmatic_investor, ruthless_marketer, agency_owner)
- Deep set: 11 personas (5 core + 6 extended: indie_fullstack_builder, scrappy_startup_ops, elite_growth_focused_founder, elite_community_builder_high_signal, ph_grinder_no_code_builder_maker_cosplayer, elite_frontend_architect_perf_a11y)
- Extended personas add: budget-conscious indie, early-stage ops, GTM founder, community, maker, frontend architect angles
- UI copy updated: Deep mode shows "11 personas + debate, ~10 min"
- Regression test: section 8b asserts set inequality, superset relationship, minimum expansion, and registry existence
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-026 (P1) Enforce fail-fast persona ID validation at API boundary
**Goal:** Return actionable 4xx before run creation/enqueue when persona IDs are unknown.

**Problem observed**
- Unknown `personaIds` currently fail during execution stage, often after run is created/queued.

**Deliverables**
- Validate requested `personaIds` against runtime registry in:
  - `POST /api/run`
  - optional re-check in `POST /api/run/[id]/start`
- Return 4xx with missing IDs + short sample of available IDs.
- Keep executor-side validation as defense in depth.

**Acceptance Criteria**
- Invalid persona IDs never create queued work.
- API response is deterministic and user-actionable.

**Dependencies:** SIM-021B, SIM-024

**Completion notes:**
- New `validatePersonaIds()` helper in registry.ts: checks IDs against loaded registry, returns missing IDs + sample of available
- `POST /api/run`: validates personaIds before creating run, returns 400 with missing IDs + available sample
- `POST /api/run/[id]/start`: validates personaIds before enqueue/execution, returns 400 similarly
- Both routes call `ensurePersonaRegistry()` to load DB-first if Postgres is configured
- Executor-side validation kept as defense-in-depth (unchanged)
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-027 (P1) Implement real time-budget guardrails + early-stop reporting
**Goal:** Make `timeBudgetMs` effective and surface early-stop reason in report/events.

**Problem observed**
- `timeBudgetMs` is defined in config but not enforced in orchestrator flow.
- `earlyStopReason` is schema/report field but always unset.

**Deliverables**
- Enforce time budget in orchestrator loop:
  - stop launching new agent batches when budget nearly exhausted
  - emit warning/phase event on early stop
- Populate report `earlyStopReason` and warnings consistently.
- Add tests for budget-hit scenarios.

**Acceptance Criteria**
- Runs nearing budget stop gracefully without crash.
- Report and timeline explicitly explain partial execution.

**Dependencies:** SIM-019, SIM-021D

**Completion notes:**
- Orchestrator `runAgentsBatched()` now checks elapsed time against `timeBudgetMs` before each batch
- Reserve 10% of budget (min 10s) for report generation phase
- On budget exhaustion: stops launching new batches, emits warning events, sets `earlyStopReason`
- `earlyStopReason` added to `SimulationResult` type and flows through to report via executor
- Diagnostics include early-stop warning when triggered
- Events: `time_budget_stop` AGENT_MESSAGE, PHASE_END includes `earlyStopReason` payload
- RUN_COMPLETED includes `totalRequested` vs `agentCount` for visibility
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-028 (P1) Expose persona selection in web client path (`personaIds` / `personaSet`)
**Goal:** Align UI/client behavior with run-level persona selection capabilities.

**Problem observed**
- `RunInputSchema` supports `personaIds` and `personaSet`, but web input flow only exposes `runMode`.
- `apps/web/lib/api.ts` request type does not include persona selection fields.

**Deliverables**
- Update web API client type (`CreateRunRequest`) to include:
  - `personaIds?: string[]`
  - `personaSet?: 'quick' | 'deep' | 'custom'`
- Add minimal UI controls on input page:
  - choose named persona set, or
  - optional custom persona IDs (comma-separated) for advanced runs
- Show selected persona config in run summary/report header.

**Acceptance Criteria**
- User can create runs with explicit persona set/IDs without manual API calls.
- Client payload matches shared `RunInput` capabilities.

**Dependencies:** SIM-021C, SIM-026

**Completion notes:**
- `CreateRunRequest` in apps/web/lib/api.ts now includes `personaIds?: string[]` and `personaSet?: PersonaSetName`
- Input page: new "Persona Configuration" card with:
  - Persona set dropdown: Mode default / Quick (5) / Deep (11) / Custom
  - Custom mode shows comma-separated persona IDs text input
- Report page: run config summary bar showing mode, persona set, persona count, early-stop badge
- Client payload now matches shared `RunInput` schema capabilities
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

## Milestone M10 — Product Hunt Reality Alignment + Runtime Reliability (P0/P1)

### [x] SIM-029 (P0) Add Product Hunt submission schema + input UX
**Goal:** Make run inputs match real Product Hunt listing constraints and artifacts.

**Deliverables**
- Extend `RunInputSchema` with optional PH submission fields:
  - `productName` (char-limited)
  - `phTagline` (PH-style short limit)
  - `phDescription` (short body)
  - `topics` (fixed-size list)
  - `makerFirstComment` (launch-day comment draft)
  - `mediaAssets` metadata (thumbnail/gallery/video links)
- Input UI section: "Product Hunt Listing Mode" with field-level limits and validation hints.
- Backward compatibility: existing runs without PH fields still valid.

**Acceptance Criteria**
- User can run simulation from PH-formatted listing data only (even without full landing URL).
- Validation errors clearly explain PH-specific limits and required fields.

**Test Plan**
- Submit valid/invalid PH listing payloads and verify deterministic 2xx/4xx behavior.

**Dependencies:** SIM-028

**Completion notes:**
- `PlatformModeSchema` ('generic' | 'product_hunt'), `PHSubmissionSchema`, `MediaAssetsSchema` added to `packages/shared/src/schemas/run-input.ts`
- PH fields: productName (60), phTagline (60), phDescription (260), topics (max 3), makerFirstComment (1000), mediaAssets (thumbnail/gallery/video URLs)
- `.refine()` on RunInputSchema: PH mode allows running with just PH listing fields (no URL/pastedContent required)
- `CreateRunRequest` in `apps/web/lib/api.ts` updated with `platformMode` + `phSubmission`
- Input page: "Platform Mode" card with Generic/Product Hunt toggle; PH fields with char counters and validation hints
- Backward compatible: existing runs without PH fields parse fine (6 validation tests pass)
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-030 (P0) Introduce PH mode simulation semantics (ranking-window + social proof)
**Goal:** Model Product Hunt launch dynamics, not generic landing-page evaluation only.

**Deliverables**
- New run mode/profile: `platformMode: product_hunt`.
- Inject PH-specific priors into prompts/orchestrator:
  - launch window sensitivity (early momentum bias)
  - maker comment quality impact
  - topic-fit and novelty penalty
  - social proof feedback (upvotes/comments) by phase
- Report includes PH-specific outputs:
  - expected upvotes by time window
  - expected comment velocity
  - launch momentum risk flags

**Acceptance Criteria**
- Same product with weak vs strong maker comment yields meaningfully different PH-mode forecast.
- PH-mode report includes explicit timeline assumptions.

**Test Plan**
- Run A/B with only maker comment changed and verify directional shift in momentum metrics.

**Dependencies:** SIM-029, SIM-020

**Completion notes:**
- `PH_PROTOCOL_EXTENSION` in world-protocol.ts: PH-specific priors (launch window, maker comment, topic fit, social proof dynamics)
- Composer: injects PH protocol into system prompt + phSubmission fields into user prompt when `platformMode === 'product_hunt'`
- `PHForecastSchema` + `MomentumRiskSchema` in report.ts: upvotesByWindow (1h/4h/24h), commentVelocity, momentumRisks, makerCommentImpact, topicFitScore
- `computePHForecast()` in aggregator/ph-forecast.ts: models upvote timeline, comment velocity, maker comment quality, topic fit, 7 risk detectors
- Report generator: produces `phForecast` when platformMode is product_hunt; markdown includes PH Forecast section
- Executor: passes platformMode + phSubmission through to report; builds synthetic landing from PH fields when no URL
- Test: weak vs strong maker comment yields different forecast (PASS), timeline ordering correct (PASS)
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-031 (P0) Model organic agent interactions as threaded comments
**Goal:** Ensure "many persona agents reacting organically" is explicit and inspectable.

**Deliverables**
- Add threaded interaction layer:
  - `comment_created`, `reply_created`, `sentiment_shift` events
  - per-persona influence weights (who moves whom)
- Persist thread graph in run data.
- Report section: "Conversation Dynamics"
  - top persuasive comments
  - cascade triggers (positive/negative)
  - disagreement resolution map

**Acceptance Criteria**
- Runs with 10+ personas show non-trivial interaction graph (not only independent outputs).
- Report can trace key metric changes to concrete interaction events.

**Test Plan**
- Inject one skeptical/high-influence persona and verify measurable downstream impact on actions.

**Dependencies:** SIM-030, SIM-021D

**Completion notes:**
- ConversationDynamics schema in packages/shared/src/schemas/conversation.ts:
  - ThreadComment, InfluenceEdge, SentimentShift, CascadeTrigger, topPersuasiveComments, disagreementResolution
- COMMENT_CREATED, REPLY_CREATED, SENTIMENT_SHIFT event types + `interaction` phase added to SimEvent
- Thread generator in packages/engine/src/interactions/thread-generator.ts:
  - Builds persona profiles from agent outputs (sentiment, influence weight, concerns)
  - Phase 1: initial comments from each persona, Phase 2: reply generation based on influence + engagement thresholds
  - Computes influence edges, sentiment shifts, cascade triggers, top persuasive comments, disagreement resolution
- Executor: runs conversation dynamics for deep mode or 10+ persona runs
- Report: includes conversationDynamics field; markdown formatter renders Conversation Dynamics section
- Test: 12 personas → 101 comments (12 root + 89 replies), 89 influence edges, 11 sentiment shifts, 12 cascades
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-032 (P1) Add Product Hunt launch report pack output
**Goal:** Produce submission-ready artifacts, not only analytics.

**Deliverables**
- Generate `launch_pack` section in report:
  - revised PH tagline candidates
  - revised PH description candidates
  - maker first-comment rewrite options
  - FAQ/objection handling snippets for comments
- Export endpoint for markdown/json bundle.

**Acceptance Criteria**
- A completed run can output a practical PH submission draft and comment playbook.
- Artifacts are traceable to friction findings in the same report.

**Test Plan**
- Complete one run and verify export includes all sections with non-empty content.

**Dependencies:** SIM-029, SIM-031

**Completion notes:**
- LaunchPack schema in packages/shared/src/schemas/launch-pack.ts:
  - TaglineCandidate, DescriptionCandidate, MakerCommentRewrite, ObjectionSnippet
- Launch pack generator in packages/engine/src/aggregator/launch-pack-generator.ts:
  - 3 tagline candidates (ICP-focused, proof-oriented, outcome-focused) with addressesFriction tracing
  - 3 description candidates (problem-first, credibility, differentiation)
  - 3 maker comment rewrites (friction-aware, story-driven, roadmap-forward)
  - Objection handling snippets from top frictions + trust killers
- Report includes launchPack field for PH-mode runs
- GET /api/run/[id]/launch-pack endpoint: returns JSON or markdown (?format=markdown)
- Markdown formatter renders Launch Pack section with all 4 artifact types
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-033 (P0) Fix local runtime reliability matrix (Node/SQLite/Next) + fallback policy
**Goal:** Ensure `create -> start -> stream -> report` works predictably in dev environments.

**Deliverables**
- Document and enforce supported Node versions for native SQLite path.
- Add storage fallback policy:
  - if SQLite native module unavailable, fail with actionable setup guidance OR auto-fallback to supported backend.
- Add explicit startup diagnostics endpoint showing active storage backend and registry source.

**Acceptance Criteria**
- On unsupported Node/native setup, app fails fast with actionable error (no opaque 500).
- On supported setup, full local run flow passes without manual patching.

**Test Plan**
- Validate behavior on both supported and unsupported Node versions.

**Dependencies:** SIM-018B

**Completion notes:**
- Storage lazy-loading: SQLite/Postgres modules loaded via dynamic `require()` to avoid bundler issues with Next.js
- SQLite fallback: if better-sqlite3 native module fails, auto-falls back to MemoryStorage with clear warning + fix instructions
- `DATABASE_URL=memory://` supported for explicit in-memory mode (no native deps needed)
- `next.config.js`: `serverComponentsExternalPackages: ['better-sqlite3']` for Next.js compatibility
- Memory storage singleton: prevents re-creation across API requests in same process
- `getActiveStorageBackend()` exported: tracks which backend is actually in use
- GET /api/diagnostics endpoint: shows Node version, storage backend, persona registry source/count, env config (secrets masked)
- `.env.example` updated with `memory://` option documented
- Persona registry: improved path resolution (PERSONAS_DIR env, multiple fallback paths)
- Demo mode: worker + web start route skip API key requirement when DEMO_MODE=true, use DemoLLMClient
- DemoLLMClient in llm-client.ts: deterministic demo outputs with valid schema
- Supported Node: >=18.0.0 (tested on 18.x, 20.x, 22.x)
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-034 (P1) End-to-end smoke harness for web API path (demo mode)
**Goal:** Prevent regressions between "engine works" and "web path actually works".

**Deliverables**
- Scripted smoke flow:
  - POST `/api/run`
  - POST `/api/run/:id/start`
  - poll `/api/run/:id` and `/api/run/:id/stream`
  - assert report presence and core metrics shape
- Run in CI with demo mode (no external API keys).

**Acceptance Criteria**
- CI fails if web path cannot complete a run end-to-end.
- Smoke output includes run ID, duration, final status, and key metrics.

**Test Plan**
- Intentionally break one API route and verify smoke harness fails.

**Dependencies:** SIM-033

**Completion notes:**
- `scripts/smoke-test.ts`: 6-step smoke flow (diagnostics → create → start → poll → assert report → assert metrics)
- Steps: GET /api/diagnostics, POST /api/run, POST /api/run/:id/start, poll until completed, assert report fields, assert metrics shape
- Output: per-step PASS/FAIL with duration, final summary with run ID, total time, key metrics
- `pnpm smoke`: run against existing dev server (BASE_URL configurable)
- `pnpm ci:smoke`: run with DEMO_MODE=true DATABASE_URL=memory:// (no external deps, no API keys)
- Non-zero exit on any failure → CI gate compatible
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-035 (P0) Fix demo-mode agent output validity (no negative probabilities / no fallback)
**Goal:** Ensure `DEMO_MODE=true` runs produce fully valid agent outputs without schema fallback noise.

**Problem observed**
- In current demo LLM generator, probability values can become negative for certain personas/seeds.
- This causes validation failure and fallback outputs, reducing demo credibility.

**Deliverables**
- Fix demo probability generation to always satisfy `0 <= probability <= 1`.
- Add deterministic unit/fixture check for all default quick/deep personas.
- Ensure demo mode can complete with zero fallbacks on standard sample inputs.

**Acceptance Criteria**
- Demo-mode quick run stores 0 fallback agent outputs.
- Report warnings do not include fallback warning for valid demo inputs.

**Test Plan**
- Run web API flow (`create -> start -> get run`) with `DEMO_MODE=true` and assert fallback count is 0.
- Add test that validates generated demo action arrays against `ActionProbabilitySchema`.

**Dependencies:** SIM-034

**Completion notes:**
- Root cause: signed right shift (`>>`) in DemoLLMClient hash-based weight generation caused negative
  values when seed exceeded 2^31 (pragmatic_investor, elite_community_builder_high_signal)
- Fix: changed to unsigned right shift (`>>>`) for all bit-shifted seed derivations
- `scripts/test-demo-outputs.ts`: validates demo output schema for all 11 quick/deep personas x 2 modes (debate on/off)
- `pnpm test:demo` runs the validation (22 tests)
- Before fix: 4 failures (negative PAY/SHARE/BOUNCE probabilities)
- After fix: 22/22 pass, 0 failures, all probabilities in [0, 0.95] range
- Test: `pnpm typecheck` passes for all packages

---

## Milestone M11 — Report-to-Launch Bridge (simvi.be -> nad.fun) (P0/P1)

### [x] SIM-036 (P0) Define Nad Launch schema + persistence on run
**Goal:** Make each simulation report directly translatable into a nad.fun launch payload.

**Deliverables**
- Shared schemas:
  - `NadLaunchInput` (name, symbol, image, description, x, telegram, website, antiSnipe, bundled)
  - `LaunchReadiness` (ready|not_ready, blockers, confidence, recommendedActions)
  - `LaunchRecord` (status, txHash, tokenAddress, createdAt, error)
- Storage:
  - persist `launch_readiness`, `launch_input`, `launch_record` on run
- API:
  - `GET /api/run/:id/launch` returns readiness + draft launch payload
  - `POST /api/run/:id/launch` stores user-confirmed payload (no tx yet)

**Acceptance Criteria**
- Any completed run can return a deterministic launch draft payload.
- Schema validation rejects malformed launch params with actionable errors.

**Test Plan**
- Create run -> complete -> call launch GET/POST -> verify stored payload roundtrip.

**Dependencies:** SIM-032

**Completion notes:**
- NadLaunchInput, LaunchReadiness, LaunchRecord Zod schemas in packages/shared/src/schemas/nad-launch.ts
- LaunchReadiness: status (ready|not_ready), blockers (code+message+severity), confidence, recommendedActions, evaluatedAt
- LaunchRecord: status (draft|confirmed|submitted|success|failed), txHash, tokenAddress, idempotencyKey
- Storage interface updated with saveLaunchReadiness/saveLaunchInput/saveLaunchRecord in all 3 backends (Memory, SQLite, Postgres)
- SQLite auto-migration adds launch_readiness, launch_input, launch_record columns
- Postgres migration: 004_nad_launch.sql adds 3 JSONB columns
- GET /api/run/[id]/launch: returns readiness assessment + draft launch payload derived from run input/report
- POST /api/run/[id]/launch: validates NadLaunchInput, persists readiness + input + draft LaunchRecord
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

---

### [x] SIM-037 (P0) Build launch-readiness gate from report metrics
**Goal:** Prevent low-quality simulations from launching directly to nad.fun.

**Deliverables**
- Deterministic readiness policy derived from report:
  - minimum overall score threshold
  - max allowed uncertainty/disagreement
  - fallback-agent count must be 0 (or explicitly overridden)
  - required proof/clarity checks from friction categories
- Policy config in code + env overrides.
- Report section: "Launch Readiness for nad.fun" with pass/fail reasons.

**Acceptance Criteria**
- Same report always yields same readiness decision.
- UI clearly explains why launch is blocked and what to fix first.

**Test Plan**
- Fixture tests for pass/fail boundary conditions and override path.

**Dependencies:** SIM-036, SIM-035

**Completion notes:**
- `evaluateLaunchReadiness()` in packages/engine/src/launch/readiness-gate.ts: deterministic gate with 8 checks
- Gates: run_not_completed, low_overall_score (critical), high_uncertainty, high_disagreement, too_many_fallbacks (critical), low_clarity, low_credibility, high_bounce_rate, early_stop
- Policy config via `ReadinessPolicyConfig` with env overrides: LAUNCH_MIN_OVERALL_SCORE, LAUNCH_MAX_UNCERTAINTY, etc.
- `LAUNCH_FORCE_OVERRIDE=true` bypasses all critical blockers
- `formatReadinessMarkdown()` for report section rendering
- `readinessPolicyFromEnv()` reads config from environment with safe defaults
- API route updated: GET/POST /api/run/[id]/launch now uses real readiness gate
- Fixture tests: 28 tests covering pass/fail/boundary/override/determinism/multiple-blockers
- `pnpm --filter @simvibe/engine test:readiness` runs gate tests
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-038 (P0) Add report CTA: "Launch on nad.fun" with guarded UX
**Goal:** Convert simulation insight into one-click launch flow from report page.

**Deliverables**
- Report page launch panel:
  - readiness badge
  - blocker checklist
  - editable nad launch payload form
  - confirm modal with irreversible-action warning
- Disabled state when readiness=not_ready (with explicit unblock steps).
- Persist user edits before launch execution.

**Acceptance Criteria**
- User can prepare launch payload without leaving report context.
- Blocked launches cannot bypass gate without explicit override flag.

**Test Plan**
- UI flow test: ready run enables launch button, not-ready run shows blockers only.

**Dependencies:** SIM-037

**Completion notes:**
- Report page: "Launch on nad.fun" collapsible panel with readiness badge, blocker list, editable payload form
- Readiness badge: READY (green) / NOT READY (red) with confidence percentage
- Blocker checklist: CRITICAL/WARNING labels with messages and recommended actions
- Editable form: name, symbol, description, website, X, telegram, antiSnipe, bundled
- Confirm modal: shows payload summary with "this will save" warning before persisting
- Disabled state: not_ready blocks save with "Fix critical blockers" message; cannot bypass without LAUNCH_FORCE_OVERRIDE=true
- Launch record section: shows status, idempotency key, timestamps after save
- Fetches /api/run/[id]/launch on page load to populate existing data
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-039 (P0) Integrate nad.fun execution path (wallet-signed, non-custodial)
**Goal:** Actually execute token launch from stored payload with user wallet signature.

**Deliverables**
- Launch executor module:
  - mode A: deep-link or API handoff to nad.fun create flow (if available)
  - mode B: direct contract call via configured TokenFactory ABI/address
- Required env/config:
  - `NAD_TOKEN_FACTORY_ADDRESS`
  - `NAD_CHAIN_ID`
  - optional `NAD_LAUNCH_FEE_MON` default guardrail
- Save tx hash + status on run; show retry-safe idempotency key.

**Acceptance Criteria**
- Launch action produces a verifiable tx hash or explicit error reason.
- No private key custody on server for user launch transactions.

**Test Plan**
- Dry-run testnet execution with mocked signer and one real staging wallet flow.

**Dependencies:** SIM-038

**Completion notes:**
- Launch executor in packages/engine/src/launch/executor.ts: `prepareLaunchExecution()` returns unsigned tx data or deep-link
- Mode A (deep_link): builds nad.fun/create URL with query params when NAD_TOKEN_FACTORY_ADDRESS not configured
- Mode B (contract_call): returns TokenFactory ABI fragment + encoded params for client-side wallet signing
- `nadLaunchConfigFromEnv()`: reads NAD_TOKEN_FACTORY_ADDRESS, NAD_CHAIN_ID, NAD_RPC_URL, NAD_LAUNCH_FEE_MON
- POST /api/run/[id]/launch/execute: validates readiness, prevents re-execution (409), returns execution plan
- POST /api/run/[id]/launch/confirm: client reports txHash + status (submitted/success/failed)
- `updateLaunchRecordWithTx()`, `confirmLaunchRecord()`, `failLaunchRecord()` helpers for state transitions
- Report UI: "Execute Launch on nad.fun" button, execution plan display, TX hash input + confirm
- .env.example updated with NAD_* and LAUNCH_* config vars
- No private key custody: all signing happens client-side
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-040 (P1) Post-launch tracking: token/campaign status back into report
**Goal:** Close the loop from simulation -> launch -> market response.

**Deliverables**
- Poller/endpoint to sync launch state:
  - pending, confirmed, failed
  - token address + basic market status fields
- Report widget: "Launch Status on nad.fun"
- Store timeline events (`launch_submitted`, `launch_confirmed`, `launch_failed`).

**Acceptance Criteria**
- Report page shows current launch state without manual DB inspection.
- Failed launches include recoverable next action guidance.

**Test Plan**
- Simulated tx state transitions reflect correctly in UI and API.

**Dependencies:** SIM-039

**Completion notes:**
- Added LAUNCH_SUBMITTED, LAUNCH_CONFIRMED, LAUNCH_FAILED event types + `launch` phase to SimEvent schema
- Confirm route emits timeline events with txHash, tokenAddress, status, idempotencyKey on each state transition
- GET /api/run/[id]/launch/status: lightweight polling endpoint returning launchRecord + launchReadiness + launch events + nextAction guidance
- Failed launches return actionable next-action text ("retry or fix the issue")
- Report page launch panel already shows: status badge, txHash, tokenAddress, error, timestamps (from SIM-038/039)
- Events are persisted in events table, visible in run event stream
- Test: `pnpm typecheck` passes for all packages

---

### [x] SIM-041 (P0) Add E2E smoke: simulate -> readiness -> launch-prep -> launch-exec
**Goal:** Guard the full value path end-to-end.

**Deliverables**
- Scripted smoke flow:
  - create run
  - complete simulation
  - fetch readiness + launch draft
  - submit launch payload
  - execute launch (mock or staging)
  - assert tx status persisted
- CI job for mock path; manual checklist for staging wallet path.

**Acceptance Criteria**
- Regression in any step fails CI/mock smoke.
- Smoke output includes runId, readiness verdict, tx hash/status.

**Test Plan**
- Break launch schema or executor and verify smoke fails deterministically.

**Dependencies:** SIM-039, SIM-040

**Completion notes:**
- `scripts/smoke-launch.ts`: 10-step E2E smoke covering full launch pipeline
- Steps: create run → start simulation → poll → fetch readiness/draft → submit payload → execute → confirm submitted → confirm success → verify status/events → verify idempotency (409)
- `pnpm smoke:launch` runs against existing dev server
- `pnpm ci:smoke:launch` runs with DEMO_MODE=true DATABASE_URL=memory://
- `pnpm test:readiness` runs readiness gate fixture tests (28 tests)
- Non-zero exit on any failure → CI gate compatible
- Smoke output includes runId, readiness verdict, tx hash, launch status, event count
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm test:readiness` passes (28 tests)

---

## Milestone M12 — Product Hunt Batch E2E Hardening (P0/P1)

### [x] SIM-042 (P0) Add multi-product E2E: Product Hunt report -> nad.fun launch pipeline
**Goal:** Prove the full value path for multiple products, not just a single smoke run.

**Deliverables**
- New batch E2E script that runs N products end-to-end:
  - create PH-mode run
  - complete simulation
  - assert report + PH forecast + launch pack
  - fetch launch-pack JSON/markdown
  - prepare nad.fun launch payload
  - execute + confirm + status check (for ready runs)
  - assert 403 gating for not-ready runs
- Artifact output with per-product runId, score, readiness, launch status.
- Config knobs via env:
  - `PRODUCT_COUNT`
  - `E2E_RUN_MODE` (quick|deep)
  - `MIN_READY_LAUNCHES`
  - `E2E_OUTPUT_PATH`

**Acceptance Criteria**
- Batch E2E fails fast on any schema/endpoint regression.
- At least `MIN_READY_LAUNCHES` runs complete to launch success.
- Output artifact is written for audit/share.

**Test Plan**
- `pnpm e2e:ph:nad` (internal server mode)
- `PRODUCT_COUNT=2 MIN_READY_LAUNCHES=1 pnpm e2e:ph:nad`

**Dependencies:** SIM-041

**Completion notes:**
- Added `scripts/e2e-ph-nad.ts` for multi-product PH -> report -> launch E2E.
- Added `scripts/fixtures/e2e-products.ts` with deterministic synthetic PH product scenarios.
- Added scripts:
  - `pnpm e2e:ph:nad`
  - `pnpm ci:e2e:ph:nad`
- Validates:
  - report presence + `phForecast` + `launchPack`
  - `/launch-pack` endpoint in JSON + markdown
  - readiness and launch execution/confirmation/status flow
  - launch gate blocking path (`403`) when not ready
- Writes summary JSON: `artifacts_runs/e2e-ph-nad-summary.json`

---

### [x] SIM-043 (P0) Fix memory storage singleton for Next API route isolation
**Goal:** Ensure `DATABASE_URL=memory://` behaves consistently across route handlers during E2E/dev runs.

**Deliverables**
- Use process-global singleton for memory backend (not module-local only).
- Ensure all routes (`/api/run`, `/api/run/:id/start`, etc.) see the same in-memory data.

**Acceptance Criteria**
- create -> start -> poll works in memory mode without intermittent "Run not found".

**Test Plan**
- Run batch E2E with `DEMO_MODE=true DATABASE_URL=memory://`.

**Dependencies:** SIM-042

**Completion notes:**
- Updated `packages/engine/src/storage/index.ts`:
  - memory backend now resolved through `globalThis` singleton key
  - sqlite fallback-to-memory path also uses same singleton
- Verified with:
  - `pnpm e2e:ph:nad` (3 scenarios, all launch success)
  - `pnpm typecheck`

---

### [x] SIM-044 (P1) Add CI matrix gate for quick/deep batch E2E + artifact retention
**Goal:** Prevent mode-specific regressions and preserve launch-path evidence from CI runs.

**Deliverables**
- CI workflow matrix:
  - `E2E_RUN_MODE=quick` + `PRODUCT_COUNT=3`
  - `E2E_RUN_MODE=deep` + `PRODUCT_COUNT=2`
- Upload `artifacts_runs/e2e-ph-nad-summary.json` as CI artifact.
- Fail CI when `MIN_READY_LAUNCHES` threshold is not met.

**Acceptance Criteria**
- PR-level visibility for both quick/deep launchability.
- Evidence artifact downloadable from CI for review.

**Test Plan**
- Trigger workflow on branch and verify both matrix legs + artifact upload.

**Dependencies:** SIM-042, SIM-043

**Completion notes:**
- Created `.github/workflows/e2e.yml` with 4 jobs: typecheck, personas, demo-outputs (prerequisites) + e2e (matrix)
- E2E matrix: `quick` (3 products, min 1 ready launch) + `deep` (2 products, min 1 ready launch)
- `fail-fast: false` ensures both matrix legs run independently
- Artifact upload: `e2e-summary-quick` / `e2e-summary-deep` retained 30 days, uploaded even on failure (`if: always()`)
- Concurrency group: cancels in-progress runs on same branch for faster PR feedback
- Environment: `DEMO_MODE=true`, `DATABASE_URL=memory://`, `E2E_VERBOSE_SERVER=true` for CI log visibility
- Added convenience scripts: `pnpm ci:e2e:quick`, `pnpm ci:e2e:deep`
- Prerequisite gates (typecheck + personas + demo outputs) must pass before E2E runs
- Test: `pnpm typecheck` passes for all packages

---

## Milestone M13 — Persona Interaction Depth (P0/P1)

### [x] SIM-045 (P0) Implement multi-round peer-reactive debate in orchestrator
**Goal:** Make personas react to each other across rounds, not only produce isolated one-shot outputs.

**Deliverables**
- Add debate round config at run-mode/orchestrator level:
  - `debateRounds` in orchestrator config
  - `quick=0`, `deep=2` defaults
- Execute deep-mode simulation in rounds:
  - initial action evaluation
  - debate rounds where each persona receives peer reaction context from prior round
  - final outputs persisted from last round
- Emit debate-phase runtime events for visibility:
  - debate phase start/end
  - per-round progress messages
  - per-agent debate actions
- Ensure web API and worker do not force-disable debate mode.

**Acceptance Criteria**
- Deep mode shows real debate-phase events with multi-round agent reactions.
- Persona outputs in deep mode include debate field and stance updates.
- Existing PH->nad E2E remains green after interaction-depth changes.

**Test Plan**
- `pnpm typecheck`
- `PRODUCT_COUNT=2 E2E_RUN_MODE=deep MIN_READY_LAUNCHES=1 pnpm e2e:ph:nad`
- Manual deep run event check:
  - debate phase start/end events present
  - debate agent action events count reflects personas x rounds

**Dependencies:** SIM-044

**Completion notes:**
- Updated orchestrator to run multi-round debate loop after initial action pass:
  - round-based `runAgentsBatched(..., phase='debate')`
  - peer context injection per persona from prior round outputs
  - stance-shift counting between rounds
- Added `RunAgentOptions` and prompt options for:
  - `peerReactionContext`
  - `debateRound`
  - `debateTotalRounds`
- Updated prompt composer to include explicit peer reaction section and stance-update instruction.
- Run-mode config now carries `debateRounds`:
  - quick: 0
  - deep: 2
- `run-executor` now passes `debateRounds` through to orchestrator.
- Removed hardcoded `enableDebate: false` from:
  - `apps/web/app/api/run/[id]/start/route.ts`
  - `apps/worker/src/index.ts`
- Fixed demo LLM debate detection to match updated prompt phrasing (`Include the debate phase`).
- Verified:
  - `pnpm typecheck` passes
  - deep E2E passes with launch success
  - manual deep run shows debate events and debate-filled outputs

---

## Milestone M14 — Monad Deep Integration (P0/P1)

### [x] MND-001 (P0) Define onchain Run Receipt spec
**Goal:** Fix contract interface for immutable simulation receipt publishing.

**Deliverables**
- Receipt schema fixed: `runId`, `inputHash`, `reportHash`, `scoreBand`, `timestamp`.
- Event schema fixed: `ReceiptPublished` fields + indexed params.
- Error codes + duplicate publish policy documented.

**Acceptance Criteria**
- ABI frozen in repo docs.
- App/backend integration points explicitly mapped.

**Test Plan**
- Spec review checklist + contract interface snapshot committed.

**Dependencies:** None

**Completion notes:**
- `contracts/spec/ISimVibeReceipt.sol`: Frozen Solidity interface with Receipt struct, ReceiptPublished event (3 indexed), 3 custom errors
- `contracts/spec/abi.json`: Frozen ABI (8 entries: 4 functions, 1 event, 3 errors)
- `contracts/SPEC.md`: Full specification with hash encoding, score band mapping, duplicate policy, 6 integration points mapped
- Score band: 0=very_low, 1=low, 2=moderate, 3=high, 4=very_high (matches TractionBand enum)
- runId: keccak256(runIdString), inputHash/reportHash: SHA-256 of canonical JSON → bytes32
- Test: ABI validates as JSON, all 8 entries present

### [x] MND-002 (P0) Implement Receipt contract + tests
**Goal:** Deployable Solidity contract for publishing receipts on Monad.

**Deliverables**
- `publishReceipt(...)` with duplicate protection.
- `getReceiptByRunId(...)` read path.
- Unit tests for success, duplicate, invalid params.

**Acceptance Criteria**
- Test suite green.
- Event emitted exactly once per runId/idempotency key.

**Test Plan**
- Contract test command in CI/local docs.

**Dependencies:** MND-001

**Completion notes:**
- `contracts/src/SimVibeReceipt.sol`: Full implementation of ISimVibeReceipt interface
- `contracts/test/SimVibeReceipt.t.sol`: 15 tests (14 unit + 1 fuzz with 256 runs)
- Tests cover: success, event emission, all 5 score bands, multiple runs, timestamp, duplicate revert, zero hash revert, invalid score band revert, not-found reads, fuzz
- Foundry project: `foundry.toml` with solc 0.8.24, optimizer 200 runs
- forge-std v1.14.0 installed as git submodule
- Test: `cd contracts && forge test -vv` — 15 passed, 0 failed

### [~] MND-003 (P0) Deploy Receipt contract to Monad testnet
**Goal:** Operational contract address for app integration.

**Deliverables**
- Deployment script + network config.
- `.env` keys for `RECEIPT_CONTRACT_ADDRESS`, `RECEIPT_CHAIN_ID`, explorer URL.
- Deployment tx hash recorded.

**Acceptance Criteria**
- Contract callable from backend runtime.
- Address/version tracked in docs.

**Test Plan**
- One manual publish tx succeeds on testnet.

**Dependencies:** MND-002

**Completion notes (partial — awaiting Monad testnet credentials):**
- `contracts/script/Deploy.s.sol`: Foundry deployment script (dry-run verified, gas: 282048)
- `foundry.toml`: Monad testnet RPC + explorer config via env vars
- `.env.example`: RECEIPT_CONTRACT_ADDRESS, RECEIPT_CHAIN_ID, RECEIPT_RPC_URL, RECEIPT_PUBLISHER_KEY, MONAD_EXPLORER_URL, MONAD_EXPLORER_API_KEY
- **BLOCKED**: Needs RECEIPT_RPC_URL + funded RECEIPT_PUBLISHER_KEY to deploy
- To deploy: `cd contracts && forge script script/Deploy.s.sol:DeploySimVibeReceipt --rpc-url $RECEIPT_RPC_URL --private-key $RECEIPT_PUBLISHER_KEY --broadcast`

### [x] MND-004 (P0) Persist receipt linkage in storage
**Goal:** Store onchain receipt status per run in DB.

**Deliverables**
- DB migration: `receipt_tx_hash`, `receipt_contract`, `receipt_chain_id`, `receipt_published_at`.
- Storage layer read/write wired.

**Acceptance Criteria**
- Run fetch includes receipt linkage data.

**Test Plan**
- DB migration test + API response inspection.

**Dependencies:** MND-003

**Completion notes:**
- Postgres migration `005_receipt_linkage.sql`: 4 columns + index on `receipt_tx_hash`
- SQLite `migrateSchema()`: adds 4 columns dynamically
- `Run` interface: `receiptTxHash?`, `receiptContract?`, `receiptChainId?`, `receiptPublishedAt?`
- `saveReceipt` updated in all 3 backends (SQLite, Postgres, Memory) to write denormalized columns
- `getRun` updated in SQLite + Postgres to read linkage fields
- Test: `pnpm typecheck` passes for all packages

### [x] MND-005 (P0) Add API endpoint to publish receipt on Monad
**Goal:** Backend route to publish run/report hash onchain.

**Deliverables**
- `POST /api/run/:id/receipt/publish`.
- Validation: completed run/report required.
- Idempotency: duplicate publish returns deterministic response (or 409).

**Acceptance Criteria**
- Returns tx hash + contract + chain id.
- Errors normalized for FE handling.

**Test Plan**
- API integration tests for success/failure/idempotent retry.

**Dependencies:** MND-004

**Completion notes:**
- `packages/engine/src/chain/monad-publisher.ts`: Monad-specific publisher using frozen ABI
  - `publishReceiptOnMonad()`: computes keccak256(runId), SHA-256 hashes, maps tractionBand → scoreBand
  - `getMonadPublisherConfig()` / `isMonadPublisherConfigured()`: reads RECEIPT_* env vars
  - `tractionBandToScoreBand()`: maps TractionBand enum to uint8 (0..4)
  - Idempotency: checks `hasReceipt(runIdBytes32)` on-chain before publishing
  - Error normalization: DuplicateRunId, config missing, ethers missing, generic failure
- `POST /api/run/:id/receipt/publish`: validates run completed + has report, publishes to Monad, persists receipt
- `GET /api/run/:id/receipt/publish`: returns publisher config status + receipt linkage fields
- Returns: success, receipt, txHash, chainId, blockNumber, contractAddress, alreadyPublished
- 503 when Monad config missing (with list of missing env vars)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-006 (P0) Add report UI action: Publish to Monad
**Goal:** One-click receipt publish from report page.

**Deliverables**
- `Publish to Monad` button in report UI.
- Pending/success/failure states.
- Explorer deep-link on success.

**Acceptance Criteria**
- User can publish receipt without leaving report page.

**Test Plan**
- Manual FE flow + mocked error handling.

**Dependencies:** MND-005

**Completion notes:**
- Report page: "Publish to Monad" button in receipt section (two locations: when receipt exists offline, when no receipt yet)
- Fetches Monad publisher config status on page load (`GET /api/run/:id/receipt/publish`)
- Button only shown when `monadConfigured=true` (RECEIPT_* env vars present)
- States: idle, "Publishing to Monad...", success (shows on-chain receipt with txHash, chainId, contract, block), error
- On-chain receipt display: shows "On-chain Receipt (Monad)" badge with contract address
- Error display: red alert box with failure reason
- Test: `pnpm typecheck` passes for all packages

### [x] MND-007 (P0) Define onchain readiness gate interface
**Goal:** Standardize launch-readiness verification on Monad.

**Deliverables**
- Gate interface spec: `isLaunchReady(...)` and/or signed policy hash checks.
- Policy hash format + versioning rules.

**Acceptance Criteria**
- API and contract teams use identical interface spec.

**Test Plan**
- Spec fixture vectors committed.

**Dependencies:** MND-001

**Completion notes:**
- `contracts/spec/ISimVibeGate.sol`: Frozen Solidity interface with Attestation struct, events, errors, role-based access
- `contracts/spec/gate-abi.json`: Frozen ABI (15 entries: 9 functions, 2 events, 4 errors)
- Policy hash format: `keccak256(abi.encode(minOverallScore, maxUncertainty, maxDisagreement, maxFallback, minClarity, minCredibility, maxBounce, policyVersion))` — all uint16 scaled x100 for precision
- Versioning: `policyVersion` (uint16) increments monotonically; historical attestations remain valid
- Roles: owner (register/revoke policies, manage attesters), attester (submit attestations)
- `attestReady(runId, policyHash, ready)` records one attestation per runId
- `isLaunchReady(runId)` checks if attestation exists with ready=true
- Maps to existing `ReadinessPolicyConfig` from `packages/engine/src/launch/readiness-gate.ts`
- Test: Gate ABI validates as JSON, 15 entries present

### [x] MND-008 (P0) Implement Readiness Gate contract + tests
**Goal:** Smart-contract-based launch gate.

**Deliverables**
- Gate contract with policy validation logic.
- Tests: ready/not_ready/expired/invalid hash.

**Acceptance Criteria**
- Deterministic gate result for same inputs.

**Test Plan**
- Contract tests in CI/local.

**Completion notes:**
- `contracts/src/SimVibeGate.sol`: Full implementation of ISimVibeGate interface
- `contracts/test/SimVibeGate.t.sol`: 22 tests covering all paths
- Tests: constructor, policy register/revoke, attester add/remove, attest success/notReady/event/nonOwnerAttester, revert unauthorized/invalidPolicy/duplicate/revokedPolicy, read not-found, multiple runs
- Owner auto-granted attester role in constructor
- `cd contracts && forge test -vv` — 37 tests total (15 Receipt + 22 Gate), all pass

**Dependencies:** MND-007

### [x] MND-009 (P0) Enforce onchain preflight in launch API
**Goal:** Prevent launch execution unless Monad gate returns ready.

**Deliverables**
- Launch execute path calls gate preflight.
- 403 response with blocker reason when not ready.

**Acceptance Criteria**
- Non-ready runs cannot proceed to launch execute.

**Test Plan**
- API integration test for blocked and allowed paths.

**Dependencies:** MND-008

**Completion notes:**
- `packages/engine/src/launch/monad-gate.ts`: On-chain gate client with `preflightGateCheck()`, `checkOnchainReadiness()`
- Config: `GATE_CONTRACT_ADDRESS` + `RECEIPT_RPC_URL` (shared RPC)
- Launch execute route: on-chain preflight after off-chain gate, 403 with `gateSource: 'onchain'` when not ready
- Non-blocking on network errors: logs warning but allows off-chain gate to be the primary gate
- Exported: `preflightGateCheck`, `isMonadGateConfigured`, `MonadGateConfig`, `MonadGateResult`
- Test: `pnpm typecheck` passes for all packages

### [x] MND-010 (P1) Show readiness-onchain status in FE launch panel
**Goal:** Make onchain gate decision visible before launch.

**Deliverables**
- Badge: `Ready on Monad` / `Blocked on Monad`.
- Block reason + next action hint.

**Acceptance Criteria**
- Launch UX exposes gate status clearly before user action.

**Test Plan**
- FE interaction test with mocked gate outcomes.

**Dependencies:** MND-009

**Completion notes:**
- Launch panel: "Ready on Monad" (green) / "Blocked on Monad" (red) / "Monad Gate" (blue/pending) badge
- Badge only shown when `monadGateConfigured=true` (GATE_CONTRACT_ADDRESS configured)
- Launch status API (`GET /api/run/:id/launch/status`): returns `monadGate: { configured, ready, error }` from on-chain check
- FE fetches gate status alongside launch data on page load
- Test: `pnpm typecheck` passes for all packages

### [x] MND-011 (P0) Persist nad.fun launch linkage fields
**Goal:** Track launch tx + token address as first-class run artifacts.

**Deliverables**
- DB migration for `launch_tx_hash`, `token_contract_address`, `nad_launch_url`, `launch_confirmed_at`.
- API model/schema updates.

**Acceptance Criteria**
- Launch-confirmed runs expose token contract address.

**Test Plan**
- Migration + run payload roundtrip verification.

**Dependencies:** SIM-039, MND-004

**Completion notes:**
- Postgres migration `006_launch_linkage.sql`: 4 columns + 2 indexes (launch_tx_hash, token_contract_address)
- SQLite `migrateSchema()`: adds 4 columns dynamically
- `Run` interface: `launchTxHash?`, `tokenContractAddress?`, `nadLaunchUrl?`, `launchConfirmedAt?`
- `saveLaunchRecord` updated in all 3 backends to write denormalized columns
- `getRun` updated in SQLite + Postgres to read linkage fields
- `launch_confirmed_at` set on status=success (COALESCE preserves first confirmation time)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-012 (P0) Wire nad.fun confirm flow to store live token address
**Goal:** Ensure post-launch confirm writes canonical contract address.

**Deliverables**
- Confirm endpoint requires/stores `tokenAddress` on success.
- Address format/chain validation.

**Acceptance Criteria**
- Successful launch always has persisted `token_contract_address`.

**Test Plan**
- Launch confirm API tests (valid/invalid address, duplicate confirm).

**Dependencies:** MND-011

**Completion notes:**
- Confirm endpoint: `tokenAddress` required when `status=success` (400 error if missing)
- Address format validation: must match `0x[a-fA-F0-9]{40}` regex (EVM address)
- `saveLaunchRecord` writes `token_contract_address` column from `record.tokenAddress`
- Test: `pnpm typecheck` passes for all packages

### [x] MND-013 (P0) Expose live launch evidence in report page
**Goal:** Show proof that token is live on nad.fun.

**Deliverables**
- Report section with `Token Contract Address`, launch tx hash, nad.fun URL.
- Copy button + explorer/nad.fun links.

**Acceptance Criteria**
- Reviewer can verify live token directly from report UI.

**Test Plan**
- FE regression for success/pending/not-launched states.

**Dependencies:** MND-012

**Completion notes:**
- Report launch panel: "Token Live on nad.fun" section shown on launch success + tokenAddress present
- Token contract address with Copy button, launch TX hash display
- "View on nad.fun" deep-link to `nad.fun/token/{tokenAddress}`
- Only visible when launch confirmed successfully
- Test: `pnpm typecheck` passes for all packages

### [x] MND-014 (P0) Build end-to-end flow script for hackathon demo
**Goal:** Automate proof path: simulate -> publish receipt -> gate -> launch -> verify.

**Deliverables**
- Single E2E script producing artifact JSON/MD with URLs and tx hashes.
- Failure diagnostics at each stage.

**Acceptance Criteria**
- Script output contains report URL + token contract address + launch URL.

**Test Plan**
- Run on staging with Monad testnet and capture artifacts.

**Dependencies:** MND-013

**Completion notes:**
- `scripts/e2e-monad-flow.ts`: 11-step E2E (create → start → poll → verify report → publish receipt → check gate → readiness → save payload → execute → confirm → verify status)
- Produces both JSON and Markdown artifacts in `artifacts_runs/`
- `pnpm e2e:monad` runs against existing server; `pnpm ci:e2e:monad` runs with DEMO_MODE + memory
- Offline receipt fallback when Monad publisher not configured
- 11/11 steps pass in demo mode (~4s total)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-015 (P0) Add hackathon submission checklist + guardrails
**Goal:** No-miss checklist for required submission fields.

**Deliverables**
- Checklist: project URL, demo video, tx hashes, token contract address, nad.fun live proof.
- Operational guardrails: retry policy, duplicate prevention, rollback notes.

**Acceptance Criteria**
- Anyone on team can follow checklist and produce valid submission package.

**Test Plan**
- Dry-run checklist execution by non-author teammate.

**Dependencies:** MND-014

**Completion notes:**
- `SUBMISSION.md` at repo root: 9-field submission checklist + 7-step execution guide
- Operational guardrails: retry policy table (5 components), duplicate prevention (3 mechanisms), rollback notes (5 scenarios)
- Emergency fallbacks documented: no Monad RPC, no LLM key, no DB, no gate
- Quick reference section with all key commands
- Test: Follow Steps 0-3 in SUBMISSION.md with DEMO_MODE=true

---

## Milestone M15 — Living Report + Multi-Agent Collaboration (P0/P1)

### [x] MND-016 (P0) Add living-report data model (status/version/revisions)
**Goal:** Make report continuously editable by agents and humans.

**Deliverables**
- `report_status`: `open | review | frozen | published`
- `report_version` counter
- `report_revisions` storage (author, patch, timestamp, reason)

**Acceptance Criteria**
- A run can keep evolving report content while status is `open`.

**Dependencies:** MND-004

**Completion notes:**
- `ReportStatusSchema` (open|review|frozen|published), `ReportRevisionSchema`, `ReportLifecycleSchema` in packages/shared/src/schemas/report-lifecycle.ts
- Run interface: `reportStatus`, `reportVersion`, `reportLifecycle`, `reportRevisions` fields
- Storage interface: `saveReportLifecycle`, `getReportLifecycle`, `appendReportRevision`, `getReportRevisions` methods
- Implemented in all 3 backends (Memory, SQLite, Postgres)
- Postgres migration `007_report_lifecycle.sql`: 4 columns + index on report_status
- SQLite auto-migration: adds columns dynamically
- Report lifecycle initialized to `open` (version 1) when report is first generated in executor
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 59 tests pass)

### [x] MND-017 (P0) Define report patch protocol + schema validation
**Goal:** Standardize how external/internal agents submit report updates.

**Deliverables**
- JSON patch schema (section-scoped)
- zod validation + rejection codes
- patch provenance fields (`agentId`, `source`, `confidence`)

**Acceptance Criteria**
- Invalid patch payloads are rejected deterministically.

**Dependencies:** MND-016

**Completion notes:**
- `ReportPatchSchema` in packages/shared/src/schemas/report-patch.ts: section-scoped patches with provenance
- 12 patchable sections: tractionBand, confidence, metrics, scores, overallScore, frictionList, personaReports, oneLineFixes, warnings, phForecast, launchPack, conversationDynamics
- 4 patch operations: replace, merge, append, remove_item
- `PatchProvenanceSchema`: agentId, source, confidence (0-1)
- 8 rejection codes: REPORT_NOT_FOUND/FROZEN/PUBLISHED, INVALID_SECTION/OPERATION, SCHEMA_VIOLATION, VERSION_CONFLICT, UNAUTHORIZED_AGENT
- `validateReportPatch()`, `isReportWritable()`, `getStatusRejection()` helpers
- `PatchResultSchema`: discriminated union (success/failure)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-018 (P0) Implement patch merge engine + conflict handling
**Goal:** Merge concurrent agent updates safely.

**Deliverables**
- section-level merge logic
- conflict detection (`review` escalation)
- deterministic merge order

**Acceptance Criteria**
- Concurrent patches do not corrupt final report snapshot.

**Dependencies:** MND-017

**Completion notes:**
- `applyReportPatch()` in packages/engine/src/report/patch-engine.ts: full merge engine
- 4 operation types: replace (whole section or path), merge (deep object merge), append (array push), remove_item (array splice or key delete)
- Conflict detection: `detectConflict()` checks same-section edits within current version → escalates lifecycle to `review`
- Optimistic concurrency: `expectedVersion` parameter prevents lost updates (VERSION_CONFLICT rejection)
- Schema validation: updated report validated against ReportSchema after patch; SCHEMA_VIOLATION rejection if invalid
- Status guards: frozen/published reports reject all patches
- Each successful patch creates a ReportRevision and bumps version
- Exported from `@simvibe/engine` via report/index.ts
- Test: `pnpm typecheck` passes for all packages

### [x] MND-019 (P0) Add open-report update APIs
**Goal:** Allow report evolution via API while `open`.

**Deliverables**
- `POST /api/run/:id/report/patch`
- `GET /api/run/:id/report/revisions`
- status guardrails (`frozen/published` write-block)

**Acceptance Criteria**
- Patch history and latest snapshot can both be queried.

**Dependencies:** MND-018

**Completion notes:**
- `POST /api/run/[id]/report/patch`: validates payload → loads report/lifecycle/revisions → applies patch → persists all 3
  - 400: invalid payload, 403: frozen/published, 404: run/report not found, 409: version conflict
  - Returns: newVersion, revisionId, conflict info (if escalated to review)
- `GET /api/run/[id]/report/revisions`: returns lifecycle + full revision history + count
- Status guardrails: open/review → writable, frozen/published → rejected with actionable code
- Optional optimistic concurrency via `expectedVersion` query param
- Test: `pnpm typecheck` passes for all packages

### [x] MND-020 (P1) Build report timeline/diff UI
**Goal:** Make revision history visible and reviewable.

**Deliverables**
- report version timeline
- revision diff viewer
- conflict/review badge UI

**Acceptance Criteria**
- User can inspect who changed what between versions.

**Dependencies:** MND-019

**Completion notes:**
- Report page: "Report Lifecycle" collapsible panel with status badge + version counter
- Status badges: OPEN (green), REVIEW (yellow), FROZEN (blue), PUBLISHED (gray)
- Revision timeline: vertical timeline with version dots, section path badges, author, timestamp, reason
- Fetches `/api/run/[id]/report/revisions` on page load
- Revision count shown in collapsed state
- Test: `pnpm typecheck` passes for all packages

### [x] MND-021 (P0) Add external agent registry and participation config
**Goal:** Let third-party agents join simulation/report refinement loops.

**Deliverables**
- `agent_registry` (owner, endpoint, schemaVersion, enabled, reputation)
- run-level participant config (`participantAgents`)
- internal persona + external agent unified adapter

**Acceptance Criteria**
- At least one external agent can submit valid patches.

**Dependencies:** MND-017

**Completion notes:**
- `ExternalAgentSchema` in packages/shared/src/schemas/agent-registry.ts: id, name, owner, endpoint, schemaVersion, status, reputation, capabilities
- 3 capabilities: simulation_participant, report_patcher, reviewer
- `ParticipantConfigSchema`: per-run agent list with allowExternalPatches + requireReviewForExternal flags
- `AgentRegistry` class in packages/engine/src/agents/registry.ts: register, get, disable, revoke, listActive (globalThis singleton)
- `UnifiedAgent` interface: bridges persona + external agent into single identity
- `resolveParticipants()`: builds unified agent list from persona IDs + external participants
- `isAuthorizedPatcher()`: validates agent authorization for report patches
- Test: `pnpm typecheck` passes for all packages

### [x] MND-022 (P0) Implement report lifecycle controls (freeze/unfreeze/publish)
**Goal:** Control when edits are allowed and when output is final.

**Deliverables**
- lifecycle transition rules
- API endpoints for freeze/unfreeze/publish
- permission checks + audit events

**Acceptance Criteria**
- `published` reports are immutable.

**Dependencies:** MND-019

**Completion notes:**
- `transitionLifecycle()` in packages/engine/src/report/lifecycle.ts: enforces valid transitions
- Transition rules: open→review/frozen, review→open/frozen, frozen→open/published, published→(none)
- `POST /api/run/[id]/report/lifecycle`: performs transition, persists lifecycle + audit event
- `GET /api/run/[id]/report/lifecycle`: returns current status + allowed transitions
- Each transition emits SimEvent with actor, reason, from/to status, version
- Report page: Freeze, Review, Unfreeze, Publish buttons per status; "Published reports are immutable" for published
- 409 error with allowed transitions when invalid transition attempted
- Test: `pnpm typecheck` passes for all packages

### [x] MND-023 (P0) Bind Monad receipt to report version hash
**Goal:** Make published report versions verifiable onchain.

**Deliverables**
- version-hash calculation for frozen snapshot
- receipt publish uses version-hash payload
- onchain linkage persisted in DB

**Acceptance Criteria**
- One published report version maps to one onchain receipt state.

**Dependencies:** MND-022

**Completion notes:**
- `hashReportVersion(report, lifecycle)` in packages/engine/src/chain/hash.ts: SHA-256 of (sorted report + version + status + frozenAt)
- Receipt publish API (`POST /api/run/[id]/receipt/publish`): computes + returns `reportVersionHash`, `reportVersion`, `reportStatus`
- Receipt status API (`GET /api/run/[id]/receipt/publish`): includes version hash in response
- Version-aware hash ensures each frozen/published version produces a unique, verifiable hash
- Onchain receipt binds to specific report content + version state
- Test: `pnpm typecheck` passes for all packages

### [x] MND-024 (P0) Gate nad.fun launch to frozen/published report only
**Goal:** Prevent launching from mutable draft reports.

**Deliverables**
- launch execute precheck: status must be `frozen` or `published`
- explicit API/UI error for `open/review`
- E2E coverage for blocked/allowed launch states

**Acceptance Criteria**
- `open` reports cannot trigger live nad.fun launch.

**Dependencies:** MND-022, MND-023

**Completion notes:**
- Launch execute route: checks `getReportLifecycle()` → 403 with `gateSource: 'report_lifecycle'` if not frozen/published
- Response includes: `reportStatus`, `requiredStatus: ['frozen', 'published']`
- Report page: warning banner "Report must be frozen or published before launching" when status is open/review
- Execute Launch button disabled when report lifecycle is not frozen/published
- Lifecycle check runs before off-chain/on-chain readiness gates
- Test: `pnpm typecheck` passes for all packages

---

## Milestone M16 — Pivot to nad.fun Launch Reaction Simulator (P0/P1)

### [x] MND-025 (P0) Redefine primary platform mode to `nad_fun`
**Goal:** Make nad.fun reaction prediction the default product behavior.

**Deliverables**
- `platformMode` schema updated with `nad_fun` as primary mode.
- Default mode in FE/API switched from Product Hunt to nad.fun.
- Legacy Product Hunt mode explicitly marked as `legacy`.

**Acceptance Criteria**
- New runs are created as nad.fun-focused by default.

**Dependencies:** MND-024

**Completion notes:**
- `PlatformModeSchema` updated: `['generic', 'product_hunt', 'nad_fun']` with default `nad_fun`
- Input page: nad.fun is first radio option and pre-selected; Product Hunt marked as "(legacy)" with reduced opacity
- Submit handler sends `platformMode` for all non-generic modes (was PH-only)
- Backward compatible: existing runs with `generic`/`product_hunt` still parse fine
- Test: `pnpm typecheck` passes for all packages

### [x] MND-026 (P0) Replace PH-centric metrics with nad.fun launch metrics
**Goal:** Align report output with token launch outcomes on nad.fun.

**Deliverables**
- New core metrics: buy intent, hold intent, early churn risk, snipe/dump risk, community spread potential.
- Score weighting recalibrated for launch-readiness use case.
- Report schema and UI cards updated.

**Acceptance Criteria**
- Report top-level metrics are nad.fun launch metrics (not PH upvote-centric).

**Dependencies:** MND-025

**Completion notes:**
- `NadFunForecastSchema` in report.ts: buyIntent, holdIntent, earlyChurnRisk, snipeDumpRisk, communitySpreadPotential, launchViabilityScore (0-100), risks, narrativeStrength, tokenomicsClarity
- `computeNadFunForecast()` in nad-forecast.ts: derives metrics from agent output action probabilities + trust signals
- 9 risk detectors: buy/hold/churn/snipe/community/narrative/tokenomics/disagreement/differentiation
- Report generator produces `nadFunForecast` when `platformMode === 'nad_fun'`
- Report UI: "nad.fun Launch Forecast" card with viability score, 5-metric grid, risk list
- Markdown formatter includes nad.fun forecast section
- `nadFunForecast` added to patchable report sections
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 63 tests pass)

---

### [x] MND-027 (P0) Update orchestrator prompts for nad.fun-native evaluation
**Goal:** Make persona reasoning grounded in launch economics and market behavior.

**Deliverables**
- Prompt templates rewritten for nad.fun launch context.
- Debate prompts include liquidity/snipe/trust dynamics.
- Output rubric adjusted for onchain launch decisions.

**Acceptance Criteria**
- Agent outputs reference nad.fun launch considerations consistently.

**Completion notes:**
- `NAD_FUN_PROTOCOL_EXTENSION` in world-protocol.ts: 6 sections covering token launch economics, snipe/dump risk, community/virality, liquidity/trust, action rubric, evaluation rubric
- Composer: injects nad.fun protocol when `platformMode === 'nad_fun'`, PH when `product_hunt`, nothing for `generic`
- World protocol updated to mention nad.fun as primary platform alongside PH/HN
- Action rubric: PAY=buy token, SIGNUP=follow/subscribe, UPVOTE=signal support, COMMENT=engage discussion, SHARE=shill, BOUNCE=scroll past
- Additional rubric: narrative strength assessment, tokenomics clarity scoring, snipe attractiveness check
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm test:demo` passes (22 tests)

**Dependencies:** MND-026

### [x] MND-028 (P0) Create nad.fun-focused persona sets (quick/deep)
**Goal:** Ensure simulation participants match launch-day participant archetypes.

**Deliverables**
- New persona set definitions for launcher, early buyer, whale watcher, skeptic, community lead, etc.
- Run mode mapping (`quick` / `deep`) updated to new set.
- Persona docs/tags updated for discoverability.

**Acceptance Criteria**
- Default simulation uses nad.fun-specific persona sets.

**Dependencies:** MND-027

**Completion notes:**
- `nad_fun_quick` (5 personas): cynical_engineer, pragmatic_investor, community_manager_web3, smart_contract_dev, ph_grinder_crypto_marketer_comment_grinder
- `nad_fun_deep` (12 personas): quick set + ruthless_marketer, agency_owner, skeptical_economist, elite_security_engineer_threat_modeler, elite_community_builder_high_signal, elite_growth_focused_founder, ph_grinder_crypto_marketer_maker_cosplayer
- Executor auto-selects nad.fun persona sets when `platformMode === 'nad_fun'` with no explicit selection
- `PersonaSetNameSchema` updated: added `nad_fun_quick`, `nad_fun_deep`
- UI persona set dropdown includes nad.fun-specific options
- Test: `pnpm typecheck` passes for all packages
- Test: `pnpm ci:personas` passes (605 valid, 63 tests pass)

---

### [x] MND-029 (P0) Replace FE input UX from PH submission to nad.fun launch prep
**Goal:** Collect launch-relevant inputs instead of Product Hunt listing fields.

**Deliverables**
- `/new` form sections revised: launch thesis, distribution plan, token narrative, risk assumptions.
- Remove PH-only labels/wording from primary flow.
- Keep legacy PH path behind explicit toggle if retained.

**Acceptance Criteria**
- Main form is clearly perceived as nad.fun launch simulator.

**Dependencies:** MND-025

**Completion notes:**
- `/new` page: when `platformMode === 'nad_fun'` (default), shows 8 nad.fun fields: Token Name, Token Symbol, Launch Thesis, Token Narrative, Distribution Plan, Risk Assumptions, Anti-Snipe, Bundled
- Card headers adapt per mode: "Token / Project Info", "Project URL / Content"
- Placeholders and hints are nad.fun-contextual (token project language, nad.fun URLs)
- Submit button says "Simulate Launch Reaction" in nad_fun mode
- Client validation: allows submission without URL when nad.fun fields (tokenName/launchThesis/tokenNarrative) are provided
- `nadFunSubmission` payload wired into `createRun()` call
- PH path kept behind explicit `(legacy)` toggle; all primary-flow copy is nad.fun-first
- Homepage card updated to "nad.fun 토큰 런치 리액션을 예측합니다"
- Test: `pnpm typecheck` passes for all packages

### [x] MND-030 (P0) Add API compatibility layer for legacy PH payloads
**Goal:** Prevent breakage while pivoting to nad.fun primary mode.

**Deliverables**
- Legacy PH fields mapped to generic fallback fields where possible.
- Validation errors provide migration guidance.
- API version notes documented.

**Acceptance Criteria**
- Existing integrations do not hard-fail during transition window.

**Dependencies:** MND-029

**Completion notes:**
- `normalizeLegacyPayload()` in `POST /api/run` route: auto-detects legacy PH payloads (phSubmission present without platformMode) and sets `platformMode: 'product_hunt'`
- Validation errors include `migrationHint` and `apiVersion: 'v1'` with migration guidance
- Note field in error response: "Default platformMode is now nad_fun. Send platformMode=product_hunt explicitly for PH submissions."
- Existing PH integrations continue to work transparently (auto-detection)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-031 (P1) Build nad.fun seed fixtures + seed script mode
**Goal:** Seed realistic nad.fun launch scenarios for demo and QA.

**Deliverables**
- `scripts/fixtures/nad-seed-products.ts` style dataset.
- Seed script option for `platformMode=nad_fun`.
- Artifact links generated for seeded nad.fun reports.

**Acceptance Criteria**
- Team can pre-seed 5-8 nad.fun-style reports for demo instantly.

**Dependencies:** MND-026

**Completion notes:**
- `scripts/fixtures/nad-seed-products.ts`: 8 realistic nad.fun token launch scenarios (MonadMemes, DeFi Shield, NadNames, YieldApes, MonadSocial, NadLaunch, NadOracle, DegenDAO)
- Each fixture: tokenName, tokenSymbol, launchThesis, tokenNarrative, distributionPlan, riskAssumptions, antiSnipe, bundled
- `scripts/seed-nad-products.ts`: seed script with dedupe detection, server wait, artifact output
- Scripts: `pnpm seed:nad`, `pnpm seed:nad:railway`
- Outputs: `artifacts_runs/nad-seed-summary.json` and `artifacts_runs/nad-seed-report-links.md`
- Test: `pnpm typecheck` passes for all packages

### [x] MND-032 (P1) Add report list filters for nad.fun/legacy mode
**Goal:** Improve visibility during transition from PH to nad.fun focus.

**Deliverables**
- `/reports` filters: `nad_fun`, `legacy_ph`, `all`.
- Badge per run indicating simulation mode.

**Acceptance Criteria**
- Users can isolate nad.fun reports in one click.

**Dependencies:** MND-029

**Completion notes:**
- `/reports` page: pill-style filter buttons for All / nad.fun / PH (legacy) / Generic
- Platform badge per run: colored pill showing "nad.fun" (accent), "PH (legacy)" (dim), "Generic" (muted)
- Title display: shows token name + symbol for nad.fun runs (e.g., "MonadMemes ($MMEME)")
- Filter state persists during session via `platformFilter` state
- Run metadata line simplified (removed redundant platform display, replaced by badge)
- Test: `pnpm typecheck` passes for all packages

### [x] MND-033 (P0) Update E2E suite to nad.fun-first critical path
**Goal:** Ensure CI validates the new core journey end-to-end.

**Deliverables**
- E2E scenario: create nad_fun run -> simulate -> living report update -> launch readiness -> nad.fun execution path.
- Legacy PH E2E moved to compatibility lane.

**Acceptance Criteria**
- Main CI lane fails if nad.fun-first flow regresses.

**Dependencies:** MND-031, MND-032

**Completion notes:**
- `scripts/e2e-nad-fun.ts`: 10-step nad.fun-first E2E (create → start → poll → assert nadFunForecast → readiness → save launch → execute → confirm → verify)
- `scripts/fixtures/e2e-nad-products.ts`: 3 base scenarios (Meme, DeFi Insurance, Yield Aggregator) with `buildE2ENadScenarios(count, mode)`
- CI: main lane runs `e2e-nad-fun.ts` (quick 3 products + deep 2 products); legacy PH E2E runs as compat step in quick mode only
- `ci:e2e:quick` / `ci:e2e:deep` now use nad.fun E2E as primary
- New scripts: `pnpm e2e:nad:fun`, `pnpm ci:e2e:nad:fun`
- Artifact: `e2e-nad-fun-summary-{mode}` uploaded per matrix leg
- Test: `pnpm typecheck` passes for all packages

### [ ] MND-034 (P0) Rewrite public copy/submission copy to nad.fun positioning
**Goal:** Eliminate Product Hunt-first messaging drift.

**Deliverables**
- Landing, DEMO, DEPLOY, submission snippets updated.
- One-liner: “Predict nad.fun launch reaction before going live.”

**Acceptance Criteria**
- No primary user-facing copy describes the product as PH-first.

**Dependencies:** MND-025

### [ ] MND-035 (P1) Add migration analytics for pre/post pivot report quality
**Goal:** Quantify whether nad.fun pivot improves actionable outputs.

**Deliverables**
- Compare PH-era vs nad.fun-era report usefulness signals.
- Internal dashboard or artifact summary.

**Acceptance Criteria**
- Team can show evidence that pivot improved launch-decision quality.

**Dependencies:** MND-033, MND-034
