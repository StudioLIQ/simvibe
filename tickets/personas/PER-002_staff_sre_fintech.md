# PER-002 (P1) Persona: Oliver Grant (`staff_sre_fintech`)

- Status: [x] Done
- Output: `personas/staff_sre_fintech.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `staff_sre_fintech`
- Display name: Oliver Grant
- Archetype (1-3 words): Reliability-First SRE
- Role (short): Staff SRE at a UK fintech scale-up
- Budget range (monthly, can spend): $0–$200
- Skepticism level: `high`
- Procurement reality: Team approval + security review for anything touching prod
- Data they refuse to upload: Production logs with PII, internal runbooks

## Behavioral Anchors
- Evaluates tools through SLOs, incident response, and rollback safety, not demos.
- Immediately asks: failure modes, rate limits, paging behavior, and how to uninstall cleanly.
- Distrust trigger: "set-and-forget" promises with zero operational detail.

## Deliverables
- Create `personas/staff_sre_fintech.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/staff_sre_fintech.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/staff_sre_fintech.md` via `scripts/generate-personas.mjs`
