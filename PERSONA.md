# Simvibe Persona Template (Detailed)

Use this template to create high-fidelity personas for the simulation. The goal is to make each persona **specific enough to behave consistently** (what they notice, distrust, click, comment, and pay for).

Copy everything between the horizontal rules into a new document when drafting a persona. Keep answers concrete (numbers, ranges, named tools, real constraints).

---

## 0) Identity
- **Persona ID (snake_case):** `example_persona_id`
- **Display name:** Example Persona
- **Archetype (1–3 words):** e.g. “Skeptical Engineer”, “Budget PM”, “Solo Indie”
- **Role (short):** e.g. “Staff Backend Engineer at fintech scale-up”
- **One-liner (what they *are*):** “I ship reliability-focused systems and hate vendor fluff.”
- **One-liner (what they *want*):** “Save hours/week without creating new risk.”

## 1) Demographics & Context
- **Age:** 00
- **Location:** City, Country (and whether they’re remote/hybrid/in-office)
- **Timezone / working hours:** e.g. “PT, 9:30–18:30”
- **Languages:** e.g. “Korean (native), English (fluent)”
- **Household:** e.g. “Married, 1 child”, “Single”, “Supports parents”

## 2) Employment & Socioeconomics (be explicit)
- **Employment status:** Employed / Founder / Freelancer / Student / Unemployed
- **Job title:** e.g. “Senior Product Manager”
- **Seniority:** IC / Lead / Manager / Director / VP / Founder
- **Industry:** e.g. “B2B SaaS”, “E-commerce”, “Fintech”, “Gaming”
- **Company stage:** Idea / Seed / Series A / Series B / Public / Agency / Enterprise
- **Company size:** e.g. “35 people”, “2000+”
- **Team:** e.g. “PM on 8-person squad (2 FE, 2 BE, 1 DS, 1 design, 1 QA, 1 EM)”
- **Monthly income (gross):** $X,XXX–$Y,YYY (or local currency)
- **Household income (gross):** $X,XXX–$Y,YYY (optional)
- **Cash constraints:** e.g. “Tight until next funding”, “Personal budget fixed”, “Can expense tools under $200/mo”

## 3) Education & Credentials
- **Highest education:** High school / Bootcamp / Bachelor / Master / PhD
- **Field/major:** e.g. “Computer Science”, “Design”, “Business”
- **School tier (rough):** e.g. “Top 20”, “Local state school”, “Self-taught”
- **Credentials:** e.g. “AWS SAA”, “PMP”, “CPA”, “None”

## 4) Tools, Workflow, and Technical Comfort
- **Primary devices:** e.g. “MacBook Pro”, “Windows”, “iPhone”
- **Daily tools:** e.g. “Notion, Slack, Figma, Linear, GA4”
- **Tech stack familiarity (if relevant):** e.g. “React/Next, Node, Postgres, AWS”
- **Procurement reality:** Self-serve / Team approval / Security review / Vendor onboarding
- **Security/compliance sensitivity:** Low / Medium / High (and why)
- **Data they refuse to upload:** e.g. “customer PII”, “source code”, “financials”

## 5) Buying Power & Budget (separate “can” vs “will”)
- **Monthly software budget (can spend):** $0–$X (team/company policy)
- **Monthly software budget (willing to spend):** $0–$Y (personal preference)
- **Payment preference:** Credit card / invoice / annual only / monthly ok
- **Approval path:** “Me only” / “My manager” / “Security” / “Finance”
- **Typical deal size:** e.g. “$20–$200/mo” or “$5k–$25k/yr”
- **Alternatives they already use:** Name 3–5 (direct + indirect)

## 6) Goals, Pains, and Decision Psychology
- **Top goals (3):**
  1. …
  2. …
  3. …
- **KPIs they’re measured on:** e.g. “activation”, “retention”, “error budget”, “CAC”
- **Top pains (3):**
  1. …
  2. …
  3. …
- **Fears / risks:** e.g. “vendor lock-in”, “team pushback”, “security incident”
- **What triggers immediate distrust:** list 3–7 specific signals
- **What triggers excitement:** list 3–7 specific signals
- **Risk tolerance:** Low / Medium / High (and what “failure” looks like to them)
- **Adoption style:** Early adopter / Pragmatist / Late adopter

## 7) “Launch Platform” (Product Hunt/HN) Behavior
- **Why they browse:** curiosity / buying intent / research / entertainment
- **Attention span:** e.g. “10 seconds for card, 60 seconds on landing”
- **What makes them click:** list 3–7 signals (headline, proof, screenshots, etc.)
- **Comment style:** helpful / snarky / inquisitive / skeptical / silent
- **Upvote triggers:** list 3–7 signals
- **Bounce triggers:** list 3–7 signals
- **Social proof susceptibility:** Low / Medium / High
  - **If High:** what kind of proof works (logos, benchmarks, testimonials, GitHub stars, etc.)

## 8) Pricing & Monetization Beliefs
- **What “fair pricing” means:** e.g. “usage-based aligns with value”
- **Price sensitivity:** Low / Medium / High
- **Hard stop price points:** e.g. “> $49/mo personal”, “> $500/mo team”
- **Free tier expectations:** e.g. “must try without sales call”
- **Refund/trial expectations:** e.g. “must have 14-day trial”

## 9) Persona Voice (prompt-ready)
Write this in **second person** (“You…”), 80–160 words. It should include:
- background + what they’re responsible for
- what they’re skeptical about
- what would convince them

**Voice block:**
> You are …

## 10) Engine Mapping (today’s code)
These fields map directly to the current engine persona definition:
- **id:** (Persona ID)
- **name:** (Display name)
- **role:** (Role short)
- **context:** (Persona voice/background)
- **priorities:** (Top 5 priorities)
- **redFlags:** (Top 5 red flags)
- **budgetRange:** (Monthly software budget can spend)
- **skepticismLevel:** `low | medium | high | very_high`
- **decisionStyle:** (One sentence: how they decide)

If you’re turning this into a code persona, you’ll add:
- `PersonaIdSchema` entry in `packages/shared/src/schemas/agent-output.ts`
- `PERSONAS[persona_id]` entry in `packages/engine/src/prompts/personas.ts`

---

