# simvi.be Submission Summary

## Problem

Token launch teams move fast on build, but validation is still expensive and risky.
Most failures happen because narrative, trust signals, and launch strategy are weak before launch day.

## Solution

simvi.be runs a synthetic launch simulation before going live.
Instead of relying on intuition, teams get structured feedback from multiple simulated personas, then iterate quickly.

## Core Flow

1. Ingest launch input (tagline, narrative, thesis, distribution plan, risks)
2. Simulate reactions across persona profiles
3. Score readiness and surface high-impact friction points
4. Suggest targeted fixes
5. Produce a report for go/no-go decisions

## Why It Matters

- Reduces costly launch mistakes
- Shortens feedback loops
- Improves message clarity and launch readiness before spending real distribution budget

## Technical Highlights

- Monorepo with shared schemas and strict validation
- Next.js app for UI + API routes
- Deterministic fallback behavior for resilient demos
- Optional queue/worker architecture for async execution
- Optional on-chain receipt publishing path for verifiable result anchoring

## Demo Readiness

- One-click form autofill via **Autofill Example** on `/new`
- Seed script for generating multiple ready-to-open report links
- Local and Railway guides included in this repo

## Primary Links

- Web: `https://simvibe.studioliq.com`
- Diagnostics: `https://simvibe.studioliq.com/api/diagnostics`
