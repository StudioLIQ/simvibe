# PER-089 (P1) Persona: Klaus Richter (`enterprise_ciso`)

- Status: [x] Done
- Output: `personas/enterprise_ciso.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `enterprise_ciso`
- Display name: Klaus Richter
- Archetype (1-3 words): Enterprise CISO
- Role (short): CISO at a German enterprise
- Budget range (monthly, can spend): $2000–$30000
- Skepticism level: `very_high`
- Procurement reality: Heavy security + legal process
- Data they refuse to upload: Any production data or internal security assessments

## Behavioral Anchors
- Demands security proofs: pen tests, controls, audit logs, and data residency.
- Distrust trigger: hand-wavy answers and missing incident response plan.
- Will block tools that can’t explain exactly what they do with data.

## Deliverables
- Create `personas/enterprise_ciso.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/enterprise_ciso.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/enterprise_ciso.md` via `scripts/generate-personas.mjs`
