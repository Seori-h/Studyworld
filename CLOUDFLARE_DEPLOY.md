# Cloudflare production deploy

이 저장소에는 production secret 파일이 없습니다.

## 1. Toolchain

```bash
corepack enable
pnpm install
pnpm exec wrangler login
```

## 2. Cloudflare resources

```bash
pnpm exec wrangler d1 create studyworld-prod
pnpm exec wrangler r2 bucket create studyworld-uploads
```

D1 `database_id`를 `wrangler.jsonc`에 반영합니다.

## 3. D1 schema first

Cloudflare `wrangler secret put`은 Worker의 새 버전을 배포할 수 있으므로, 첫 운영 설정에서는 secret을 넣기 전에 D1 schema를 먼저 적용합니다.

```bash
pnpm run db:migrate:remote
```

## 4. Production secrets

```bash
pnpm exec wrangler secret put PLANET_KEY_PEPPER
pnpm exec wrangler secret put SESSION_PEPPER
pnpm exec wrangler secret put AI_PROVIDER
pnpm exec wrangler secret put AI_MODEL
pnpm exec wrangler secret put AI_API_KEY
```

`AI_PROVIDER`는 `openai` 또는 `gemini`입니다. `AI_MODEL`에는 해당 제공자 계정에서 실제 사용 가능한 모델 ID를 넣습니다. repo/.env/.dev.vars에 secret을 작성하지 않습니다.

## 5. Quality gates and deploy

```bash
pnpm run check
pnpm run lighthouse
pnpm run predeploy
pnpm run deploy
```

`pnpm run predeploy`는 D1 placeholder와 로컬 secret-file 정책을 확인합니다.

## 6. One-time initial accounts

**서비스 공개 전** `INITIAL_ACCOUNTS.md`의 bootstrap을 실행합니다.

Bootstrap 전 `/api/v1/health`:

```json
{"ok":true,"ready":false}
```

Bootstrap 후:

```json
{"ok":true,"ready":true}
```

`ready:true`가 된 뒤 공개 트래픽을 연결합니다.

## 7. Production smoke test

최소 확인 항목:

- admin Planet Key login
- 초기 사용자 20명 admin 화면 표시
- 실제 D1 공개룸 48개 광장 표시
- 초기 사용자 Key 1개로 직접 로그인 → 자신의 공개룸 ownership 확인
- 일반 신규 user issuance/restore
- full Key가 localStorage / 공개 SVG / 공유 카드에 없음
- own/admin-managed key rotation 후 이전 Key 실패
- 개인룸 1개/72h/삭제/복구/1회 정정
- joined room 5개 / kick rejoin block
- community write/upload
- AI Intent가 업로드 텍스트 실제 내용을 읽고 protocol schema 반환
- AI flashcard / 3줄 요약 / 문단 설명 / Canvas 노드 / 코드 리뷰 실제 호출
- PDF 8MB 이하 분석 → Focus Reader 구간 추출, D1/R2에 원 PDF가 남지 않음
- AI timeout/provider 오류 시 fallback UI가 유지되고 `ai_request_logs`에 본문 없이 status/latency/token 기록
- 일반 학습 Intent는 룸 수정 quota를 소모하지 않고 `자연어로 수정`에서 무장한 요청만 minor/layout/feature quota 사용
- `/media/planets/PL-.../planet.svg` security headers
- 모바일/키보드 접근성
- 실제 도메인 Lighthouse
