# simvibe 배포 가이드 (WEB=Vercel, API/Worker/DB=Railway)

이 문서는 아래 운영 도메인 기준으로, 배포를 처음부터 끝까지 따라할 수 있게 정리한 실전 가이드입니다.

- FE(웹): `https://simvibe.studioliq.com` (Vercel)
- API: `https://api-simvibe.studioliq.com` (Railway)

---

## 0. 최종 아키텍처

```text
[User Browser]
  -> https://simvibe.studioliq.com  (Vercel, Next.js web)
       -> /api/* 는 API_SERVER_ORIGIN 으로 rewrite
          -> https://api-simvibe.studioliq.com/api/*

[Railway]
  1) Postgres
  2) API 서비스    (Next.js @simvibe/web, API 전용)
  3) Worker 서비스 (apps/worker, pg-boss 소비)
```

핵심:
- WEB은 Vercel에서만 배포
- API/Worker/Postgres는 Railway에서 운영
- API와 Worker는 같은 Postgres(`DATABASE_URL`)를 공유

---

## 1. 사전 준비

1. GitHub 저장소 최신 반영
2. Railway 프로젝트 생성 권한
3. Vercel 프로젝트 생성 권한
4. Gemini API Key
5. DNS 관리 권한 (`studioliq.com`)

---

## 2. Railway 설정 (API + Worker + Postgres)

## 2-1. Postgres 생성

1. Railway 프로젝트에서 `New` -> `Database` -> `PostgreSQL`
2. 생성 후 `DATABASE_URL` 확인

## 2-2. API 서비스 생성

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

## 2-3. Worker 서비스 생성

1. `New` -> `GitHub Repo`로 동일 저장소 연결
2. Service 이름: `simvibe-worker` (권장)
3. Root Directory: `/`
4. Dockerfile Path: `apps/worker/Dockerfile`
5. Public Domain은 불필요

## 2-4. Railway 환경변수

### API 서비스

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
LLM_PROVIDER=gemini
GEMINI_API_KEY=<YOUR_GEMINI_KEY>
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
EXTRACTOR_PROVIDER=pasted
```

참고:
- 운영에서 URL 추출을 쓰려면 `EXTRACTOR_PROVIDER=jina`로 변경
- 필요 시 `JINA_API_KEY` 추가

### Worker 서비스

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
LLM_PROVIDER=gemini
GEMINI_API_KEY=<YOUR_GEMINI_KEY>
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
EXTRACTOR_PROVIDER=pasted
WORKER_PORT=8080
WORKER_RUN_TIMEOUT_MS=600000
```

---

## 3. Railway 도메인 연결 (API)

Railway `simvibe-api` 서비스에서:

1. `Settings` -> `Domains`
2. `api-simvibe.studioliq.com` 연결
3. Railway 안내대로 DNS(CNAME/TXT) 반영
4. SSL 발급 완료 확인

검증:
- `https://api-simvibe.studioliq.com/api/diagnostics`

---

## 4. DB 마이그레이션 + 페르소나 동기화 (필수)

최초 1회 실행:

```bash
pnpm db:migrate
pnpm personas:sync
```

실행 위치:
- Railway API 서비스 Shell/One-off command
- 또는 로컬에서 Railway `DATABASE_URL` 지정 후 실행

예시(로컬):

```bash
DATABASE_URL='<RAILWAY_POSTGRES_URL>' pnpm db:migrate
DATABASE_URL='<RAILWAY_POSTGRES_URL>' pnpm personas:sync
```

---

## 5. Vercel 설정 (WEB)

## 5-1. 프로젝트 생성

1. Vercel에서 GitHub 저장소 Import
2. Framework: Next.js
3. Root Directory: `apps/web`

Build 설정:
- Install Command:

```bash
cd ../.. && pnpm install --frozen-lockfile
```

- Build Command:

```bash
cd ../.. && pnpm --filter @simvibe/web build
```

(프로젝트 설정에 따라 기본 Next 빌드가 동작하면 위 커맨드는 생략 가능)

## 5-2. Vercel 환경변수

```env
DATABASE_URL=<RAILWAY_POSTGRES_EXTERNAL_URL>
NODE_ENV=production
LLM_PROVIDER=gemini
GEMINI_API_KEY=<YOUR_GEMINI_KEY>
LLM_DAILY_TOKEN_LIMIT=2000000
LLM_DAILY_COST_LIMIT_USD=5.00
EXTRACTOR_PROVIDER=pasted
API_SERVER_ORIGIN=https://api-simvibe.studioliq.com
```

중요:
- `API_SERVER_ORIGIN`이 정확해야 `/api/*`가 Railway API로 프록시됩니다.

## 5-3. Vercel 도메인 연결

1. Vercel 프로젝트 `Settings` -> `Domains`
2. `simvibe.studioliq.com` 연결
3. DNS 반영 + SSL 확인

---

## 6. 배포 후 검증 체크리스트

1. API 진단
- `https://api-simvibe.studioliq.com/api/diagnostics`
- `storage.activeBackend=postgres` 확인

2. WEB 접속
- `https://simvibe.studioliq.com`
- 월드 생성 -> 시뮬레이션 시작 -> 리포트 조회

3. Worker 동작
- Worker 로그에서 job consume 시작 로그 확인
- run 실행 시 처리 로그 확인

---

## 7. Product Hunt 시드 자동화

시드 카탈로그: `SEEDING.md`

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

### 7-2. 자동 시딩 (Railway Job/Cron)

권장:
- 배포 직후 1회 실행
- 필요 시 1일 1회 재실행
- `SEED_ONLY_MISSING=true`로 중복 방지

---

## 8. 비용/안정성 운영 팁

1. 비용 제한은 항상 켜두기
- `LLM_DAILY_TOKEN_LIMIT`
- `LLM_DAILY_COST_LIMIT_USD`

2. 데모 안정성 우선이면 추출기 `pasted`
- 외부 추출기 의존성 감소

3. 장애 최다 원인
- Vercel의 `API_SERVER_ORIGIN` 오타
- Railway API 도메인 SSL 미완료
- 마이그레이션/페르소나 sync 누락

---

## 9. 장애 대응 순서

1. API `/api/diagnostics` 확인
2. Railway Postgres 연결 확인 (`DATABASE_URL`)
3. Worker 로그(큐 소비/에러) 확인
4. Vercel 환경변수 `API_SERVER_ORIGIN` 재확인
5. DNS/SSL 상태 확인

