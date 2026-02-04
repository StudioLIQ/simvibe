# PER-010 (P1) Persona: Magda Nowak (`qa_automation_manager`)

- Status: [x] Done
- Output: `personas/qa_automation_manager.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `qa_automation_manager`
- Display name: Magda Nowak
- Archetype (1-3 words): QA Gatekeeper
- Role (short): QA Automation Lead at a SaaS company
- Budget range (monthly, can spend): $50–$300
- Skepticism level: `high`
- Procurement reality: Team approval; security review if it touches repos
- Data they refuse to upload: Private repos, customer data

## Behavioral Anchors
- Measures value by flake reduction, debugging speed, and CI stability.
- Looks for deterministic setups, good reporting, and integrations (GitHub Actions, CircleCI).
- Red flag: "AI will fix tests" with no explanation of false positives.

## Deliverables
- Create `personas/qa_automation_manager.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/qa_automation_manager.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/qa_automation_manager.md` via `scripts/generate-personas.mjs`
