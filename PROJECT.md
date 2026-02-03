# PROJECT.md

# simvi.be — The First Agentic Market Simulator for Vibe-coders
**Subtitle:** Launch into a synthetic market before you launch into the real one.

---

## 0) TL;DR
Vibe-coding collapsed build cost toward zero, but **validation cost (PMF discovery, positioning, early marketing) stayed expensive and risky**. simvi.be is an **agentic “launch world”**: you deploy your product *into a synthetic market* of opinionated, resource-constrained agents that behave like real launch-day users (scan → click → doubt → discuss → bounce / signup / pay). You get a **behavioral simulation + friction map + conversion forecast**, then iterate with “what-if” reruns.

This is not “chat with personas.” This is a **multi-agent behavior engine** with:
- explicit constraints (attention span, budget, skepticism threshold),
- a discussion phase that changes outcomes,
- action selection with probabilities,
- structured event logs that power a data flywheel.

---

## 1) Why Now (The Inevitability of Vibe-coding)
### 1.1 Build is cheap, validation is not
Modern tooling (LLMs, templates, infra) makes it easy to ship. The bottleneck moved to:
- finding the right ICP,
- nailing positioning and messaging,
- de-risking pricing and onboarding,
- validating distribution assumptions before spending real money.

When build is cheap, the main failure mode becomes: **shipping the wrong product faster**.

### 1.2 “Vibe” is a first-class variable now
On launch platforms and social distribution, users decide in seconds. Success often depends on:
- first-screen clarity,
- credibility cues,
- precise targeting language,
- perceived differentiation,
- pricing framing.

Traditional research is slow/expensive. simvi.be makes this “vibe validation” repeatable and measurable.

---

## 2) Product Definition
### 2.1 What simvi.be does
Given:
- Tagline + description + pricing model
- Landing page URL (or pasted landing content)
- Category/tags + competitors (optional)
  simvi.be runs a **Launch World Simulation**:
1) Agents scan the feed card (like launch platforms).
2) Agents “browse” the landing page extract.
3) Agents debate each other (discussion alters beliefs).
4) Agents choose actions: UPVOTE, COMMENT, SIGNUP, PAY, SHARE, or BOUNCE.
5) The system aggregates outcomes into a report:
    - Predicted traction band / rank band (platform-agnostic)
    - Conversion forecast (synthetic CVR + uncertainty)
    - Top friction triggers (copy/positioning/pricing/trust gaps)
    - Persona-specific one-line fixes
6) You rerun “what-if” variants to converge fast.

### 2.2 What simvi.be is NOT
- Not a generic chatbot panel.
- Not a “survey generator.”
- Not a guaranteed predictor of real outcomes.
- Not a replacement for real-world testing; it is a **pre-test** that reduces waste.

---

## 3) Target Users & Use Cases
### 3.1 Primary ICP: Indie builders (solo / small teams)
**Jobs-to-be-done**
- “Before I ship, tell me what will make users bounce.”
- “Help me choose the best tagline/pricing framing.”
- “Give me a fast iteration loop I can run nightly.”

### 3.2 Secondary ICP: Marketing agencies (growth / launch ops)
**Jobs-to-be-done**
- “Produce client-ready research artifacts quickly.”
- “De-risk positioning and landing pages before ad spend.”
- “Show iterative improvement with before/after simulation diffs.”
- “White-label or shareable reports.”

---

## 4) Core Features (MVP)
### 4.1 Launch World Simulation (the Sim Engine)
**Inputs**
- Tagline
- Description
- Pricing model + price points
- Landing content (scraped or pasted)
- Category/tags
- Optional: competitor summaries

**Outputs**
- Agent actions with probabilities
- Event timeline (what triggered bounce/signup)
- Aggregated metrics + uncertainty
- Report + shareable link

### 4.2 Synthetic Focus Group (Multi-Agent Network)
- 5 opinionated agents with distinct incentives and constraints.
- Each agent has:
    - budget_usd
    - attention_span_sec
    - risk_profile (skepticism threshold)
    - preferences & dislikes
- Each agent must output structured JSON:
    - suspicions, trust boosters/killers
    - primary friction
    - actions (with probabilities)
    - “one-line fix”

### 4.3 Platform Mirroring (UI/UX priors)
For MVP, “platform mirroring” means:
- Simulating a feed card scan step (5–10 seconds)
- Enforcing attention constraints (max clicks / max reading)
- Injecting “launch-day context” priors:
    - novelty bias,
    - proof requirements,
    - skepticism toward vague AI claims,
    - preference for crisp ICP + differentiation.

(Exact platform cloning is optional; the engine is platform-agnostic.)

### 4.4 Insight Report (Synthetic Data Report)
Report sections:
- **Predicted traction band** (not absolute claims; use bands + confidence)
- **Friction map** (Top 3–10 bounce triggers)
- **Conversion forecast** (signup/pay probabilities with uncertainty)
- **Persona table** (agent-by-agent)
- **One-line fixes** (copy edits / missing proof / pricing framing)
- **What-if diffs** (before/after comparison)

---

## 5) Agent Design (Prompts + Constraints)
### 5.1 Shared World Protocol (all agents)
All agents follow:
1) 10-second scan: define product, list 3 suspicions
2) Landing skim: trust boosters/killers, primary friction
3) Debate: ask 1 question, challenge 1 claim
4) Action selection: UPVOTE/COMMENT/SIGNUP/PAY/BOUNCE/SHARE with probabilities
5) One-line fix

All outputs must be valid JSON and schema-checked.

### 5.2 The 5 Core Personas (MVP)
1) **Cynical Engineer**
    - distrusts hype, demands specificity, cares about feasibility, privacy, integration
2) **Passionate Product Manager**
    - obsessed with ICP clarity, narrative coherence, onboarding flow
3) **Pragmatic Investor**
    - evaluates revenue logic, pricing, defensibility, distribution leverage
4) **Ruthless Growth Marketer**
    - cares about hook, CTA, first-screen conversion, proof and copy
5) **Marketing Agency Owner**
    - cares about reusability, client deliverables, workflows, white-label sharing

### 5.3 Discussion Mechanics (why outcomes change)
- Agents post initial stance → debate → update stance → choose final actions.
- Orchestrator introduces “conflict hooks” to force real disagreement:
    - e.g., raise price vs trust, narrow ICP vs volume, freemium vs paid.
- Outcomes are aggregated across agents and optionally a lightweight “crowd” layer.

---

## 6) Metrics & Scoring
### 6.1 Action probabilities
Each agent outputs probabilities (0–1) for actions. The system aggregates:
- expected_upvotes, expected_signups, expected_pays
- bounce_rate estimate
- share likelihood

### 6.2 Confidence / uncertainty
For MVP:
- Provide a qualitative confidence label + numeric “uncertainty score”
  based on:
    - missing info (no pricing, no proof, vague ICP),
    - landing extraction quality,
    - agent disagreement magnitude.

### 6.3 Report score (0–100)
A composite score used for quick iteration:
- clarity score
- credibility score
- differentiation score
- pricing framing score
- conversion readiness score

---

## 7) Data Flywheel (Gets Smarter Over Time)
### 7.1 Why it improves
simvi.be logs **structured simulation events** (not just text).
As more simulations run:
- The system learns which triggers reliably correlate with bounce/signup patterns.
- Calibration improves per category/pricing model.

### 7.2 Minimum viable flywheel (MVP)
1) Log each run:
    - inputs, extracted landing sections, agent outputs, event triggers, aggregated metrics
2) Ask users to optionally provide actual outcomes later:
    - actual_CVR_signup, actual_CVR_pay, actual_bounce proxies
3) Compute error and update calibration:
    - category-based multipliers,
    - pricing-model-based adjustments,
    - “skepticism threshold” tuning for personas
4) Next run uses the calibration priors.

### 7.3 Longer-term flywheel (post-MVP)
- Retrieval of similar past launches (RAG):
    - “products like yours typically fail due to X”
- Backtesting against historical public data (if available)
- Self-improving persona parameters (Bayesian updates)
- Automated experiment design suggestions

---

## 8) Business Model (3 Revenue Streams)
### Model A — Credits per Simulation Run (Usage-based)
- Charge per run + premium analysis add-ons.
- Great for indie builders (low commit, high perceived ROI).
- Scales with agencies (more clients → more runs).

### Model B — Subscription Workspace (Seats + Client Workspaces)
- Charge per seat and per client workspace.
- Agency-friendly:
    - collaboration
    - shareable links
    - white-label reports
    - iteration history

### Model C — Launch Ops Kits (Outcome-focused bundles)
- Sell “simulation + deliverables” as a package:
    - tagline variants
    - pricing framing suggestions
    - FAQ rewrite
    - objection handling copy
    - A/B plan for 2 weeks
- Agencies can resell artifacts to clients.

---

## 9) Hackathon Demo Definition (2-minute “wow”)
### 9.1 Demo script (must-have)
1) Input product URL + tagline/pricing
2) Create a “World” (run_id)
3) Live simulation stream:
    - agents scan → debate → action timeline updates live
4) Generate report:
    - traction band, friction top 3, one-line fixes
5) What-if rerun:
    - change tagline → rerun → show diff

### 9.2 Optional: on-chain “receipt”
To align with an Agent track / infra narrative while staying crypto-agnostic:
- Write a “Simulation Receipt”:
    - run_id, report_hash, timestamp
- Record hash on-chain for:
    - reproducibility
    - anti-cherry-picking
    - public demos

This stays optional and behind a feature flag.

---

## 10) Technical Architecture (MVP)
### 10.1 High-level components
- **Web App (UI)**
    - Input form
    - Live simulation view (agent chat + event timeline)
    - Report view + share link
    - What-if diff view
- **Backend API**
    - Create run / fetch run / stream run
    - Landing extractor
    - Report generator
    - Storage
- **Simulation Engine**
    - Orchestrator (phases)
    - Persona prompts
    - JSON schema validation
    - Aggregator (metrics, confidence)
- **Storage**
    - runs, artifacts, events, reports, calibration priors
- **Optional Chain Module**
    - writeReceipt(run_id_hash, report_hash)

### 10.2 Recommended stack (pragmatic)
- Frontend: Next.js + TypeScript
- Streaming: Server-Sent Events (SSE) or WebSocket
- Backend: Next.js API routes OR separate FastAPI service
- DB: SQLite (local) or Postgres (hosted)
- LLM provider: configurable (Anthropic Claude / OpenAI etc.)
- Scraping: Firecrawl or Jina Reader; fallback: user paste content
- Schema validation: zod (TS) or pydantic (Python)

### 10.3 API sketch
- `POST /api/run` → create run, start simulation
- `GET /api/run/:id` → get run state + report
- `GET /api/run/:id/stream` → SSE stream of events
- `POST /api/run/:id/actuals` → user-provided real outcomes
- `GET /api/library/similar` → (future) retrieve similar cases
- `POST /api/receipt` → (optional) chain receipt

### 10.4 Data model (minimal)
- Run
    - id, created_at
    - input: tagline, desc, pricing, url, tags
    - extraction: landing_sections
    - outputs: agent_json[], events[], report
- Event
    - run_id, t, agent, type, trigger, payload
- CalibrationPrior
    - key: category/pricing_model
    - multipliers: signup, pay, bounce adjustments

---

## 11) Quality Bar (Definition of Done for MVP)
- One-click run that completes reliably in <2 minutes (demo mode).
- Agents always return valid JSON (auto-retry on schema failure).
- Report always renders even if extraction is partial (graceful degradation).
- What-if rerun supports at least tagline changes.
- Shareable report link works.
- Logs are inspectable (for judge confidence).

---

## 12) Risks & Mitigations
- **LLM variability** → enforce schemas, retries, temperature control, deterministic seeds when possible.
- **Scraping failures** → fallback to manual paste; show extraction confidence.
- **Overclaiming accuracy** → use bands + uncertainty; position as “pre-test.”
- **Long runtime** → cap tokens, compress landing extracts, limit debate rounds.

---

## 13) Roadmap (Post-hackathon)
- Crowd simulation layer (30–200 lightweight agents)
- Platform-specific modes (PH / Reddit / AppSumo)
- RAG from historical launches + competitor intelligence
- Automated experiment plans
- Agent-to-agent economy primitives (optional future)
