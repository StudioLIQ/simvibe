# Product Hunt Seed Catalog

이 문서는 데모용 Product Hunt 시드 데이터와 자동 시딩 실행 방법을 정리합니다.

## Seed Set

- Namespace 기본값: `ph-demo-v1`
- 기본 개수: `7`개
- 기본 모드: `quick`
- 기본 동작: `SEED_ONLY_MISSING=true`일 때 기존 시드가 있으면 건너뜀

| Slug | Product | Category | Pricing | Source |
|---|---|---|---|---|
| `conva-ai` | Conva.AI | Developer Tools | freemium | https://www.producthunt.com/posts/473299 |
| `my-askai` | My AskAI | Customer Support | subscription | https://www.producthunt.com/posts/ultimategpt |
| `ariana-ai` | Ariana AI | Artificial Intelligence | freemium | https://www.producthunt.com/posts/ariana-ai |
| `get-productive` | Get Productive | Productivity | free | https://www.producthunt.com/posts/get-productive |
| `productivehub` | ProductiveHub | Productivity | free | https://www.producthunt.com/posts/productivehub |
| `artificial-intelligence-tools` | Artificial Intelligence Tools | Artificial Intelligence | freemium | https://www.producthunt.com/posts/artificial-intelligence-tools |
| `instaprompt-ai` | instaprompt.ai | Productivity | freemium | https://www.producthunt.com/posts/instaprompt-ai |

## Local Seeding

```bash
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
PRODUCT_COUNT=7 \
RUN_MODE=quick \
pnpm seed:ph
```

출력 파일:
- `artifacts_runs/ph-seed-summary.json`
- `artifacts_runs/ph-seed-report-links.md`

## Railway Auto Seeding

`web` 서비스가 살아난 뒤 실행되는 one-off/cron job에서 아래 명령을 사용하면 됩니다.

```bash
API_BASE_URL=https://api-simvibe.studioliq.com \
WEB_BASE_URL=https://simvibe.studioliq.com \
WAIT_FOR_SERVER_SECONDS=180 \
SEED_ONLY_MISSING=true \
SEED_NAMESPACE=ph-demo-v1 \
PRODUCT_COUNT=7 \
RUN_MODE=quick \
pnpm seed:ph:railway
```

권장 환경변수:
- `SEED_ONLY_MISSING=true`: 기존 시드가 있으면 건너뜀
- `SEED_NAMESPACE=ph-demo-v1`: 시드 버전 식별자
- `SEED_LOOKBACK_LIMIT=200`: 최근 런 조회 범위
- `WAIT_FOR_SERVER_SECONDS=180`: API 준비 대기
- `RAILWAY_PUBLIC_DOMAIN`가 있으면 `API_BASE_URL`/`WEB_BASE_URL`를 생략해도 자동으로 `https://<domain>`를 사용

## Re-seed (강제)

이미 시드가 있어도 다시 만들고 싶으면:

```bash
SEED_ONLY_MISSING=false \
API_BASE_URL=http://localhost:5555 \
WEB_BASE_URL=http://localhost:5556 \
pnpm seed:ph
```
