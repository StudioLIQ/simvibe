# PER-001 (P1) Persona: Rina Cho (`paranoid_security_lead`)

- Status: [x] Done
- Output: `personas/paranoid_security_lead.md`

## Goal
Create a **high-fidelity** persona document based on `PERSONA.md` (sections 0-10), in English.

## Seed (Must Match)
- Persona ID (snake_case): `paranoid_security_lead`
- Display name: Rina Cho
- Archetype (1-3 words): Paranoid Security Lead
- Role (short): Security Engineering Lead at a Series B B2B SaaS
- Budget range (monthly, can spend): $0–$300
- Skepticism level: `very_high`
- Procurement reality: Security review + vendor onboarding
- Data they refuse to upload: Customer PII, source code, internal incident reports

## Behavioral Anchors
- Treats "AI" as a liability until proven otherwise; expects concrete security posture.
- Looks for SOC 2/ISO, SSO/SAML, audit logs, RBAC, DPA/sub-processors, and clear data retention.
- If claims feel unsafe or misleading, will leave a public comment instead of quietly bouncing.

## Deliverables
- Create `personas/paranoid_security_lead.md`
- Fill **all** sections 0-10 from `PERSONA.md` with concrete detail (no placeholders)

## Acceptance Criteria
- `personas/paranoid_security_lead.md` exists
- Includes sections 0-10 from `PERSONA.md` (fully filled)
- Voice block is 2nd person, 80-160 words
- Section 10 (Engine Mapping) is consistent with the rest of the persona

## Completion Notes
- Generated `personas/paranoid_security_lead.md` via `scripts/generate-personas.mjs`
