#!/usr/bin/env bash
set -euo pipefail

if [[ "${DATABASE_URL:-}" == postgres://* || "${DATABASE_URL:-}" == postgresql://* ]]; then
  echo "[run-migrations] Running Postgres migrations"
  pnpm db:migrate
else
  echo "[run-migrations] DATABASE_URL is not postgres, skipping migration step"
fi
