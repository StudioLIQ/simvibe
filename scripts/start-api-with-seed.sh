#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5555}"
AUTO_SEED_RAW="${AUTO_SEED_NAD_ON_START:-true}"
AUTO_SEED_WAIT_SECONDS="${AUTO_SEED_WAIT_SECONDS:-180}"
SEED_ONLY_MISSING_VALUE="${SEED_ONLY_MISSING:-true}"
PRODUCT_COUNT_VALUE="${PRODUCT_COUNT:-20}"
RUN_MODE_VALUE="${RUN_MODE:-quick}"

normalize_url() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%/}"
  printf '%s' "$value"
}

infer_api_base_url() {
  if [[ -n "${API_BASE_URL:-}" ]]; then
    printf '%s' "${API_BASE_URL%/}"
    return
  fi

  if [[ -n "${API_ORIGIN:-}" ]]; then
    printf '%s' "${API_ORIGIN%/}"
    return
  fi

  if [[ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]]; then
    local host
    host="$(normalize_url "$RAILWAY_PUBLIC_DOMAIN")"
    printf 'https://%s' "$host"
    return
  fi

  printf 'http://127.0.0.1:%s' "$PORT"
}

infer_web_base_url() {
  if [[ -n "${WEB_BASE_URL:-}" ]]; then
    printf '%s' "${WEB_BASE_URL%/}"
    return
  fi

  if [[ -n "${WEB_ORIGIN:-}" ]]; then
    printf '%s' "${WEB_ORIGIN%/}"
    return
  fi

  if [[ -n "${PUBLIC_BASE_URL:-}" ]]; then
    printf '%s' "${PUBLIC_BASE_URL%/}"
    return
  fi

  printf '%s' "$API_BASE_URL_INFERRED"
}

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" ]]
}

API_BASE_URL_INFERRED="$(infer_api_base_url)"
WEB_BASE_URL_INFERRED="$(infer_web_base_url)"

echo "[start-with-seed] Starting API server on port ${PORT}"
echo "[start-with-seed] Inferred API_BASE_URL=${API_BASE_URL_INFERRED}"
echo "[start-with-seed] Inferred WEB_BASE_URL=${WEB_BASE_URL_INFERRED}"
pnpm --filter @simvibe/web start --port "${PORT}" &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup INT TERM

if is_truthy "$AUTO_SEED_RAW"; then
  (
    set +e
    echo "[start-with-seed] Auto seeding enabled (PRODUCT_COUNT=${PRODUCT_COUNT_VALUE}, RUN_MODE=${RUN_MODE_VALUE})"
    API_BASE_URL="${API_BASE_URL_INFERRED}" \
    WEB_BASE_URL="${WEB_BASE_URL_INFERRED}" \
    WAIT_FOR_SERVER_SECONDS="${AUTO_SEED_WAIT_SECONDS}" \
    SEED_ONLY_MISSING="${SEED_ONLY_MISSING_VALUE}" \
    PRODUCT_COUNT="${PRODUCT_COUNT_VALUE}" \
    RUN_MODE="${RUN_MODE_VALUE}" \
    pnpm seed:nad
    EXIT_CODE=$?
    if [[ $EXIT_CODE -ne 0 ]]; then
      echo "[start-with-seed] Warning: seed:nad failed with code ${EXIT_CODE} (server continues running)"
    else
      echo "[start-with-seed] seed:nad completed"
    fi
  ) &
else
  echo "[start-with-seed] Auto seeding disabled (AUTO_SEED_NAD_ON_START=${AUTO_SEED_RAW})"
fi

wait "$SERVER_PID"
