# nad.fun Seed Catalog

이 문서는 nad.fun 실데이터 기반 데모 시딩 방법을 정리합니다.

## Default Behavior

- Source: `https://api.nadapp.net/order/market_cap?sort=desc&offset=0&limit=20`
- Namespace default: `nad-live-v1`
- Default count: `20`
- Default mode: `quick`
- Default dedupe: `SEED_ONLY_MISSING=true`일 때 기존 시드 런은 건너뜀
- Fallback: live API 실패 시 `scripts/fixtures/nad-seed-products.ts` 사용

## Local Seeding

```bash
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad
```

출력 파일:
- `artifacts_runs/nad-seed-summary.json`
- `artifacts_runs/nad-seed-report-links.md`

## Railway Auto Seeding

```bash
API_BASE_URL=https://api-simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
WAIT_FOR_SERVER_SECONDS=180 \
SEED_ONLY_MISSING=true \
SEED_NAMESPACE=nad-live-v1 \
PRODUCT_COUNT=20 \
RUN_MODE=quick \
pnpm seed:nad:railway
```

권장 환경변수:
- `SEED_ONLY_MISSING=true`
- `SEED_NAMESPACE=nad-live-v1`
- `SEED_LOOKBACK_LIMIT=200`
- `WAIT_FOR_SERVER_SECONDS=180`
- `NAD_SOURCE_URL` (optional): live source endpoint override
- `RAILWAY_PUBLIC_DOMAIN`가 있으면 `API_BASE_URL`/`WEB_BASE_URL` 생략 가능

## Force Re-seed

이미 시드가 있어도 다시 생성하려면:

```bash
SEED_ONLY_MISSING=false \
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
pnpm seed:nad
```
