# simvibe Railway 배포 가이드 (한글)

이 문서는 아래 운영 도메인 기준으로, **Railway에 실제 배포**하는 절차를 처음부터 끝까지 정리한 가이드입니다.

- FE(웹): `https://simvibe.studioliq.com`
- API: `https://api-simvibe.studioliq.com`

---

## 0. 최종 구조

```text
[User Browser]
   └─ https://simvibe.studioliq.com   (web 서비스)
         └─ /api/* 요청은 서버 리라이트로
            https://api-simvibe.studioliq.com/api/* 로 전달

[Railway Project]
  1) Postgres 서비스
  2) API 서비스    (Next.js @simvibe/web)
  3) WEB 서비스    (Next.js @simvibe/web, API_SERVER_ORIGIN 사용)
  4) Worker 서비스 (apps/worker, pg-boss consumer)
```

핵심 포인트:
- API/WEB을 분리해서 도메인을 명확히 나눕니다.
- Worker는 공개 도메인 없이 내부에서 큐만 소비합니다.
- DB는 Postgres 하나를 API/WEB/Worker가 공용으로 사용합니다.

---

## 1. 사전 준비

1. Railway 계정 + 프로젝트 생성 권한
2. GitHub repo 연결 가능 상태
3. Gemini API Key 준비
4. DNS 제어 권한 (`studioliq.com`)

---

## 2. Railway 서비스 생성

### 2-1. Postgres

1. Railway 프로젝트에서 `New` -> `Database` -> `PostgreSQL` 추가
2. 생성 후 `DATABASE_URL`이 발급되는지 확인

### 2-2. API 서비스

1. `New` -> `GitHub Repo`로 현재 저장소 연결
2. Service 이름: `simvibe-api` (권장)
3. Root Directory: `/`
4. Build Command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

5. Start Command:

```bash
pnpm --filter @simvibe/web start --port $PORT
```

### 2-3. WEB 서비스

1. `New` -> `GitHub Repo`로 동일 저장소 재연결
2. Service 이름: `simvibe-web` (권장)
3. Root Directory: `/`
4. Build Command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

5. Start Command:

```bash
pnpm --filter @simvibe/web start --port $PORT
```

### 2-4. Worker 서비스

1. `New` -> `GitHub Repo`로 동일 저장소 재연결
2. Service 이름: `simvibe-worker` (권장)
3. Root Directory: `/`
4. Dockerfile Path: `apps/worker/Dockerfile`
5. 공개 도메인 불필요

---

## 3. 환경변수 설정

아래 값은 서비스별로 설정합니다.

### 3-1. 공통(최소)

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `NODE_ENV=production`
- `LLM_PROVIDER=gemini`
- `GEMINI_API_KEY=<실제 키>`
- `LLM_DAILY_TOKEN_LIMIT=2000000`
- `LLM_DAILY_COST_LIMIT_USD=5.00`

### 3-2. 추출기(데모/운영 선택)

데모 위주(외부 추출기 호출 최소화):
- `EXTRACTOR_PROVIDER=pasted`

운영 위주(URL 추출 사용):
- `EXTRACTOR_PROVIDER=jina`
- (선택) `JINA_API_KEY=<key>`

### 3-3. API 서비스 전용

- (선택) `PORT`는 Railway가 자동 주입
- 추가 설정 없음

### 3-4. WEB 서비스 전용

- `API_SERVER_ORIGIN=https://api-simvibe.studioliq.com`

설명:
- WEB 서비스는 `/api/*` 요청을 API 도메인으로 프록시합니다.

### 3-5. Worker 서비스 전용

- `WORKER_PORT=8080`
- `WORKER_RUN_TIMEOUT_MS=600000`

---

## 4. 도메인 연결

Railway 각 서비스의 `Settings -> Domains`에서 연결:

1. WEB 서비스 -> `simvibe.studioliq.com`
2. API 서비스 -> `api-simvibe.studioliq.com`

Railway가 안내하는 CNAME/TXT 값을 DNS에 추가하고, SSL 발급 완료까지 대기합니다.

---

## 5. DB 마이그레이션 + 페르소나 동기화 (필수)

배포 후 **한 번** 실행:

```bash
pnpm db:migrate
pnpm personas:sync
```

실행 방법:
- Railway 대시보드에서 API 서비스 `Shell` 또는 One-off command로 실행
- 반드시 `DATABASE_URL`이 Postgres를 바라보는 상태여야 함

---

## 6. 배포 검증 체크리스트

### 6-1. API 확인

- `https://api-simvibe.studioliq.com/api/diagnostics`
- 기대값:
  - `storage.activeBackend`가 `postgres`
  - persona registry count 표시

### 6-2. WEB 확인

- `https://simvibe.studioliq.com` 접속
- 월드 생성/시뮬레이션 시작/리포트 조회까지 동작 확인

### 6-3. Worker 확인

- Worker 로그에서 큐 소비 시작 로그 확인
- 시뮬레이션 실행 시 Worker에서 run 처리 로그 확인

---

## 7. Product Hunt 시드 자동화 (권장)

시드 상세 목록은 `SEEDING.md` 참고.

### 7-1. 수동 1회 시딩

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

### 7-2. 자동 시딩(크론)

Railway Cron/Job 서비스에서 위 명령을 스케줄 실행.

권장:
- 배포 직후 1회 실행
- 필요 시 하루 1회 재실행(중복은 `SEED_ONLY_MISSING=true`로 방지)

---

## 8. 운영 팁

1. 비용 보호는 반드시 켜두세요.
- `LLM_DAILY_TOKEN_LIMIT`
- `LLM_DAILY_COST_LIMIT_USD`

2. 데모 안정성이 최우선이면 추출기를 `pasted`로 유지하세요.
- URL 추출 의존도가 줄어 장애 지점이 감소합니다.

3. API/WEB 분리 도메인에서는 WEB의 `API_SERVER_ORIGIN` 오타가 가장 흔한 장애 원인입니다.
- 값이 정확히 `https://api-simvibe.studioliq.com`인지 확인하세요.

---

## 9. 장애 시 빠른 점검 순서

1. API `/api/diagnostics` 정상 여부
2. Postgres 연결 여부(`DATABASE_URL`)
3. Worker 로그에서 큐 소비 여부
4. WEB의 `API_SERVER_ORIGIN` 값 확인
5. 도메인 DNS/SSL 상태 확인

