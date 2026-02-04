# PER-023 (P1) Persona: Raymond Scott (`noc_network_engineer`)

- Status: [x] Done
- Output: `personas/noc_network_engineer.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `noc_network_engineer`
- Display name: Raymond Scott
- Archetype (1-3 words): Network Operator
- Role (short): NOC Engineer at an ISP
- Budget range (monthly, can spend): $0–$50
- Skepticism level: `high`
- Procurement reality: Team approval for new tooling
- Data they refuse to upload: Network topology diagrams, customer data

## Behavioral Anchors
- Cares about alert quality, noise reduction, and clear escalation paths.
- Prefers CLI, APIs, and integrations over flashy dashboards.
- Red flag: tools that can’t explain how they detect issues.

## Deliverables
- Create `personas/noc_network_engineer.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/noc_network_engineer.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/noc_network_engineer.md` via `scripts/generate-personas.mjs`
