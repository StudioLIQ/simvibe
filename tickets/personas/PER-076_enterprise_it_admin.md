# PER-076 (P1) Persona: Peter Novak (`enterprise_it_admin`)

- Status: [x] Done
- Output: `personas/enterprise_it_admin.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `enterprise_it_admin`
- Display name: Peter Novak
- Archetype (1-3 words): IT Admin
- Role (short): IT Administrator at a 5,000-employee company
- Budget range (monthly, can spend): $200–$2000
- Skepticism level: `medium`
- Procurement reality: IT + security review
- Data they refuse to upload: Employee data and internal configs

## Behavioral Anchors
- Needs SSO, role-based access, and good admin controls.
- Cares about support quality and clear deployment/rollback steps.
- Red flag: consumer-grade security and unclear permissions.

## Deliverables
- Create `personas/enterprise_it_admin.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/enterprise_it_admin.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/enterprise_it_admin.md` via `scripts/generate-personas.mjs`
