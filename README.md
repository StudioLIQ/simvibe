# simvi.be

simvi.be is an agentic launch simulator for nad.fun-style token launches.
It predicts launch-day reaction before you go live by running a multi-agent simulation and producing a decision-ready report.

## What You Get

- Multi-agent simulation of launch reactions
- Structured report with risks, confidence, and recommendations
- What-if iteration loop for messaging and launch strategy
- Optional on-chain receipt publishing flow

## Submission Docs

- `SUBMISSION.md` - project summary for reviewers
- `DEMO.md` - 2-minute demo script
- `DEMO_INPUT_ONE.md` - single example input set
- `LOCAL.md` - local setup and run guide
- `DEPLOY.md` - Railway deployment runbook
- `Environ.md` - Railway env template (sanitized)
- `SEEDING.md` - nad.fun seed generation guide

## Quick Start (Local)

```bash
pnpm install
pnpm dev:api
pnpm dev:web
```

- App: `http://localhost:5556`
- Diagnostics: `http://localhost:5555/api/diagnostics`

## Demo Shortcut

Open `/new` and click **Autofill Example** to populate a full nad.fun launch input set instantly.

## Stack

- Next.js (`apps/web`) for UI + API routes
- Shared schemas (`packages/shared`)
- Simulation engine (`packages/engine`)
- Optional worker (`apps/worker`) for queue processing

## License

No license file is currently included in this repository.
