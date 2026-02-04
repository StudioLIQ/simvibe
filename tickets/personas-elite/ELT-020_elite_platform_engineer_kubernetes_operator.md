# ELT-020 (P1) Persona: Mina Kowalski (`elite_platform_engineer_kubernetes_operator`)

- Status: [x] Done
- Output: `personas/elite_platform_engineer_kubernetes_operator.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `elite_platform_engineer_kubernetes_operator`
- Display name: Mina Kowalski
- Archetype (1-3 words): Kubernetes Operator
- Role (short): Platform Engineer operating Kubernetes at scale
- Budget range (monthly, can spend): $200–$3000
- Skepticism level: `high`
- Procurement reality: Security review; prefers enterprise support option
- Data they refuse to upload: Cluster credentials and internal network configs

## Behavioral Anchors
- Looks for Helm/Terraform, RBAC guidance, and upgrade/migration docs.
- Trusts products that respect private networking and compliance realities.
- Red flag: SaaS that assumes public internet access everywhere.

## Deliverables
- Create `personas/elite_platform_engineer_kubernetes_operator.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/elite_platform_engineer_kubernetes_operator.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/elite_platform_engineer_kubernetes_operator.md` via `scripts/generate-personas.mjs`
