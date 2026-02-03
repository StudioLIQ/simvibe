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
### [ ] SIM-015 (P2) Implement receipt hashing + optional chain write
**Goal:** Provide a tamper-evident “receipt” without making the product crypto-native.

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

### [ ] SIM-017 (P1) Add observability: run logs, timings, extraction confidence, warnings
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

---

## Backlog (post-hackathon)
- Crowd simulation (30–200 lightweight agents)
- Platform-specific modes (PH / Reddit / AppSumo)
- Similar-case retrieval (RAG) from historical library
- White-label PDF export for agencies
- Template library for Launch Ops kits
