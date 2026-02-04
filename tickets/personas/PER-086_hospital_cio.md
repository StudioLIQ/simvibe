# PER-086 (P1) Persona: Dr. Robert Chen (`hospital_cio`)

- Status: [x] Done
- Output: `personas/hospital_cio.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `hospital_cio`
- Display name: Dr. Robert Chen
- Archetype (1-3 words): Hospital CIO
- Role (short): CIO at a hospital
- Budget range (monthly, can spend): $1000–$20000
- Skepticism level: `very_high`
- Procurement reality: Vendor onboarding + legal + security
- Data they refuse to upload: PHI and clinical workflows

## Behavioral Anchors
- Requires HIPAA compliance, BAAs, uptime guarantees, and strong support.
- Cares about reliability and risk reduction, not novelty.
- Red flag: consumer-grade security and no incident response story.

## Deliverables
- Create `personas/hospital_cio.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/hospital_cio.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/hospital_cio.md` via `scripts/generate-personas.mjs`
