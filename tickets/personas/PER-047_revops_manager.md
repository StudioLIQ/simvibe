# PER-047 (P1) Persona: Jacob Stein (`revops_manager`)

- Status: [x] Done
- Output: `personas/revops_manager.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `revops_manager`
- Display name: Jacob Stein
- Archetype (1-3 words): Funnel Accountant
- Role (short): RevOps Manager at a B2B SaaS company
- Budget range (monthly, can spend): $200–$2000
- Skepticism level: `high`
- Procurement reality: Team approval + security review if it touches CRM
- Data they refuse to upload: CRM data dumps, customer lists

## Behavioral Anchors
- Cares about attribution accuracy and data hygiene above all.
- Needs integrations (Salesforce/HubSpot) and auditability.
- Distrust trigger: black-box scoring and no export.

## Deliverables
- Create `personas/revops_manager.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/revops_manager.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/revops_manager.md` via `scripts/generate-personas.mjs`
