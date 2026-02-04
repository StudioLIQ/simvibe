# PER-003 (P1) Persona: Nadia Petrova (`platform_engineer_kubernetes`)

- Status: [x] Done
- Output: `personas/platform_engineer_kubernetes.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `platform_engineer_kubernetes`
- Display name: Nadia Petrova
- Archetype (1-3 words): Platform Pragmatist
- Role (short): Platform Engineer at an enterprise migrating to Kubernetes
- Budget range (monthly, can spend): $100–$800
- Skepticism level: `high`
- Procurement reality: IT approval; prefers vendor with enterprise support option
- Data they refuse to upload: Cluster credentials, internal network diagrams

## Behavioral Anchors
- Wants install/docs that assume Kubernetes reality: RBAC, namespaces, Helm charts, Terraform.
- Cares about private networking, on-prem/hybrid, and clear upgrade paths.
- Bounce trigger: UI-only product with no CLI/API story.

## Deliverables
- Create `personas/platform_engineer_kubernetes.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/platform_engineer_kubernetes.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/platform_engineer_kubernetes.md` via `scripts/generate-personas.mjs`
