# simvi.be 배포 런북 (Vercel + Railway)

마지막 업데이트: 2026-02-15

이 문서는 현재 코드 기준의 실제 운영 절차를 정리한 배포 기준 문서다.

## 1) 운영 아키텍처

```text
[User]
  -> Vercel Web (apps/web)
       -> /api/* rewrite
            -> Railway API (apps/web Next server, route handlers)
                 -> Postgres (Railway)
                 -> pg-boss queue
                      -> Railway Worker (apps/worker)
```

핵심 원칙:
- 운영 DB는 반드시 `Postgres` (`DATABASE_URL=postgres://...`).
- API/Worker는 같은 `DATABASE_URL`을 공유.
- Web은 Vercel에서 `/api/*`를 Railway API로 프록시(`API_SERVER_ORIGIN`).
- 계약(Receipt/Gate/NAD on-chain)은 옵션. 미설정 시 오프체인 경로로 동작.

---

## 2) 배포 전 필수 체크 (로컬)

Node/pnpm:
- Node `>=18` (권장 20/22)
- pnpm `>=9`

필수 검증:

```bash
pnpm typecheck
pnpm ci:e2e:all
```

주의:
- `ci:e2e:services`는 Docker 필요(Postgres 컨테이너 기동).
- launch 실행은 report lifecycle이 `frozen` 또는 `published`여야 통과한다.

---

## 3) 환경변수 기준

기준 샘플: `.env.example`

### 3-1. API 서비스 (Railway, 필수)

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
# 또는 ANTHROPIC_API_KEY / OPENAI_API_KEY

EXTRACTOR_PROVIDER=jina
# JINA_API_KEY=... (선택)
# FIRECRAWL_API_KEY=... (firecrawl 선택 시 필수)

LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
```

### 3-2. Worker 서비스 (Railway, 필수)

```env
DATABASE_URL=postgres://...
NODE_ENV=production
DEMO_MODE=false

LLM_PROVIDER=gemini
GEMINI_API_KEY=...
EXTRACTOR_PROVIDER=jina

WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000

LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
```

### 3-3. Web 서비스 (Vercel, 필수)

```env
API_SERVER_ORIGIN=https://api-simvibe.example.com
NODE_ENV=production
```

보안 권장:
- Vercel에는 API/DB/지갑 비밀키를 두지 않는다.
- API/Worker에만 LLM/DB/체인 키를 둔다.

### 3-4. 옵션 (체인/런치)

Receipt publish (Monad):
- `RECEIPT_CONTRACT_ADDRESS`
- `RECEIPT_RPC_URL`
- `RECEIPT_PUBLISHER_KEY`
- `RECEIPT_CHAIN_ID` (선택)

nad.fun launch 설정:
- `NAD_TOKEN_FACTORY_ADDRESS`
- `NAD_CHAIN_ID`
- `NAD_RPC_URL`
- `NAD_CREATE_BASE_URL`
- `NAD_LAUNCH_FEE_MON`

Readiness 정책:
- `LAUNCH_FORCE_OVERRIDE` (운영에서는 `false` 권장)
- `LAUNCH_MIN_OVERALL_SCORE` 등 (`packages/engine/src/launch/readiness-gate.ts` 참고)

---

## 4) Railway 배포

### 4-1. Postgres 생성
1. Railway Project -> `New` -> `Database` -> PostgreSQL
2. `DATABASE_URL` 확보

### 4-2. API 서비스 생성
1. `New` -> GitHub Repo 연결
2. Service 이름: `simvibe-api` (권장)
3. Root Directory: `/`
4. Build Command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @simvibe/web build
```

5. Start Command:

```bash
pnpm --filter @simvibe/web start --port $PORT
```

6. 환경변수(3-1) 설정

### 4-3. Worker 서비스 생성
1. `New` -> GitHub Repo 연결
2. Service 이름: `simvibe-worker` (권장)
3. Dockerfile Path: `apps/worker/Dockerfile`
4. Public Domain 불필요 (내부 서비스로 운영)
5. 환경변수(3-2) 설정

### 4-4. API 도메인 연결
예: `api-simvibe.example.com`

검증:
- `https://api-simvibe.example.com/api/diagnostics`
- `storage.activeBackend=postgres` 확인

---

## 5) 초기화 작업 (필수, 최초 1회)

API 서비스 환경으로 one-off 실행:

```bash
pnpm db:migrate
pnpm personas:sync
```

검증:
- 마이그레이션 성공 로그
- `personas:sync` 성공 로그

---

## 6) Vercel 배포 (Web)

1. Project Import (repo)
2. Root Directory: `apps/web`
3. Install Command:

```bash
cd ../.. && pnpm install --frozen-lockfile
```

4. Build Command:

```bash
cd ../.. && pnpm --filter @simvibe/web build
```

5. 환경변수(3-3) 설정
6. 도메인 연결(예: `simvibe.example.com`)

검증:
- `https://simvibe.example.com` 접속
- 브라우저 DevTools에서 `/api/*` 요청이 `API_SERVER_ORIGIN`으로 프록시되는지 확인

---

## 7) 배포 직후 검증

### 7-1. 서비스 헬스
- API: `GET /api/diagnostics`
- Worker: 로그에서 `Worker consuming jobs from pg-boss queue` 확인

### 7-2. 런 실행 플로우
1. `POST /api/run` -> `runId`
2. `POST /api/run/:id/start` -> `queued=true`
3. `GET /api/run/:id` polling -> `queued -> running -> completed`

### 7-3. launch 플로우 (중요)
launch execute 전 필수:
- `POST /api/run/:id/report/lifecycle` with `targetStatus=frozen`

그 후:
1. `GET /api/run/:id/launch`
2. `POST /api/run/:id/launch`
3. `POST /api/run/:id/launch/execute`
4. `POST /api/run/:id/launch/confirm`
5. `GET /api/run/:id/launch/status`

---

## 8) 운영용 E2E

### 8-1. 메모리 모드(빠른 회귀)
```bash
pnpm ci:e2e:all
```

이 명령은 아래를 순서대로 실행한다:
- `ci:smoke`
- `ci:smoke:launch`
- `ci:e2e:ph:nad`
- `ci:e2e:nad:fun`
- `ci:e2e:monad`
- `ci:e2e:services`

### 8-2. 실제 서비스 연결 E2E 단독 실행
```bash
pnpm ci:e2e:services
```

이 테스트는 다음을 한 번에 검증한다:
- API enqueue
- pg-boss 큐 전달
- Worker 실행
- report patch/lifecycle
- launch execute/confirm
- receipt 저장

결과 파일:
- `artifacts_runs/e2e-services-flow-summary.json`

---

## 9) 시딩 (옵션)

nad.fun 데모 시딩:

```bash
API_BASE_URL=https://api-simvibe.example.com \
WEB_BASE_URL=https://simvibe.example.com \
SEED_ONLY_MISSING=true \
WAIT_FOR_SERVER_SECONDS=180 \
PRODUCT_COUNT=8 \
RUN_MODE=quick \
pnpm seed:nad:railway
```

Legacy PH 시딩:

```bash
API_BASE_URL=https://api-simvibe.example.com \
WEB_BASE_URL=https://simvibe.example.com \
SEED_ONLY_MISSING=true \
WAIT_FOR_SERVER_SECONDS=180 \
PRODUCT_COUNT=7 \
RUN_MODE=quick \
pnpm seed:ph:railway
```

---

## 10) 장애 대응 순서

1. API `GET /api/diagnostics`
2. `DATABASE_URL`/Postgres 연결 확인
3. Worker 로그(큐 소비, 실행 실패) 확인
4. Vercel `API_SERVER_ORIGIN` 확인
5. launch 403이면 report lifecycle 상태(`open/review/frozen/published`) 먼저 확인

---

## 11) 롤백

원칙:
- DB는 유지하고, API/Web/Worker를 이전 릴리스로 롤백
- 롤백 후 즉시 `ci:smoke`, `ci:smoke:launch` 최소 검증

권장:
- 릴리스마다 `artifacts_runs/*summary.json` 보관
- 배포 태그/커밋 해시를 운영 기록에 남길 것
