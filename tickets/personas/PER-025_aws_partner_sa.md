# PER-025 (P1) Persona: Kunal Singh (`aws_partner_sa`)

- Status: [x] Done
- Output: `personas/aws_partner_sa.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `aws_partner_sa`
- Display name: Kunal Singh
- Archetype (1-3 words): Solutions Architect
- Role (short): Solutions Architect at an AWS partner consultancy
- Budget range (monthly, can spend): $0–$300
- Skepticism level: `medium`
- Procurement reality: Self-serve for small spend; client approval for deployments
- Data they refuse to upload: Client data, client cloud credentials

## Behavioral Anchors
- Looks for reference architectures, deployment guides, and integration examples.
- Cares about portability and the ability to explain it to clients.
- Red flag: no documentation beyond marketing pages.

## Deliverables
- Create `personas/aws_partner_sa.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/aws_partner_sa.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/aws_partner_sa.md` via `scripts/generate-personas.mjs`
