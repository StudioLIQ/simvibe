# ELT-019 (P1) Persona: Maya Dubois (`elite_sre_incident_commander`)

- Status: [x] Done
- Output: `personas/elite_sre_incident_commander.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `elite_sre_incident_commander`
- Display name: Maya Dubois
- Archetype (1-3 words): Incident Commander
- Role (short): Senior SRE who runs incident response
- Budget range (monthly, can spend): $50–$1000
- Skepticism level: `high`
- Procurement reality: Team approval; must integrate with paging and logs
- Data they refuse to upload: Incident reports and production logs

## Behavioral Anchors
- Evaluates tools by how they behave on the worst day, not the best day.
- Cares about noise reduction, runbooks, and clear escalation.
- Distrust trigger: black-box alerts with no explainability.

## Deliverables
- Create `personas/elite_sre_incident_commander.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/elite_sre_incident_commander.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/elite_sre_incident_commander.md` via `scripts/generate-personas.mjs`
