# STUDYWORLD — Cloudflare production package

Cloudflare Workers + Static Assets + D1 + R2 기반 상용 배포 패키지입니다. 운영 비밀값은 저장소나 로컬 환경파일에 두지 않고 **Cloudflare Secrets에만** 등록하도록 구성되어 있습니다.

## 핵심 운영 정책

- 일반 회원: 활성 개인룸 최대 1개, 정상 신규 생성 72시간에 1회
- 일반 회원: 단체/그룹룸 신규 생성 불가
- 관리자: rolling 24시간 최대 3개 개인룸 생성
- 타인 스터디 참여: 최대 5개 (본인 소유 룸 제외)
- 삭제는 72시간 생성 시계를 초기화하지 않음
- 삭제 직후 15분 복구 창 + 생성 초기 조건을 충족할 때 생성 주기당 1회 정정
- AI 룸 변경 사용량은 `minor / layout / feature`로 독립 계측
- 비즈니스 quota는 서비스 코드 + D1 constraint/trigger로 이중 방어

## Planet identity 구조

Planet Key와 공개 행성 식별자를 분리했습니다.

- **Planet Key**: 인증/복구용 비밀 자격증명. `ST-XXXXX-XXXXX-XXXXX-XXXXX`
- **Public Planet Code**: 프로필/행성 이미지에 표시 가능한 공개 식별자. `PL-XXXXXXXXXX`
- **Planet Art**: `public_code + visual_seed`로 서버가 생성하는 공개용 SVG. 인증 키는 포함하지 않음

D1 구조도 분리되어 있습니다.

- `profiles`: 닉네임, 공개 코드, 역할 등 공개/계정 메타데이터
- `planet_credentials`: Planet Key의 HMAC-SHA-256 digest와 key version/revoke 상태
- `planet_credential_events`: 발급/교체/폐기 감사 이벤트. 원문 키는 기록하지 않음
- `planet_assets`: R2에 저장된 공개 행성 이미지의 메타데이터
- `sessions`: 세션 토큰의 HMAC digest만 저장

전체 Planet Key는 발급 또는 재발급 응답에서 **한 번만** 전달됩니다. DB, R2 행성 이미지, localStorage, 공유 카드에는 원문이나 일부 조각을 저장하지 않습니다.

## 초기 사용자와 공개 스터디룸

기존 화면에 있던 공개 스터디룸은 더 이상 프런트 fixture가 아닙니다. 최초 배포 시 one-time bootstrap으로 D1에 실제 계정/소유관계를 생성합니다.

- 관리자 1명
- 초기 관리 사용자 20명: 모두 `role='user'`인 정상 사용자 계정
- 그중 16명이 공개 스터디룸 48개의 실제 `owner_profile_id`를 가짐
- 4명은 초기 커뮤니티 게시물 작성자 계정
- 모든 공개룸에는 owner membership이 실제 D1 row로 존재
- 프런트 광장은 `/api/v1/discovery/spaces`에서 실제 D1 룸을 읽음

`account_origin='managed_seed'`와 `managed_by_profile_id`는 **초기 운영자가 관리할 수 있도록 남기는 내부 provenance**일 뿐, 해당 계정은 인증/방 참여/개인룸 정책에서 일반 사용자와 동일하게 동작합니다.

초기 사용자의 Planet Key 원문은 bootstrap 응답에서만 나옵니다. 운영자가 별도로 안전하게 보관하며, 잃어버린 경우 관리자 화면에서 새 Key를 발급하면 이전 Key와 모든 기존 세션이 즉시 폐기됩니다.

자세한 절차는 `INITIAL_ACCOUNTS.md`를 확인하세요.

## 보안 구조

- Planet Key: CSPRNG 약 100-bit entropy
- 인증 저장: HMAC-SHA-256 digest only
- 공개 이미지에는 Public Planet Code만 표시
- Key rotation/revoke 지원, rotation 시 기존 모든 세션 폐기
- 세션: `__Host-sw_session; HttpOnly; Secure; SameSite=Strict`
- profile 당 활성 세션 최대 10개
- CSRF 보조 방어: Origin/Referer/Sec-Fetch-Site same-origin 검사
- 업로드: PNG/JPEG/WebP/GIF, 최대 5MB, MIME + magic-byte 검사, 사용자 SVG 업로드 금지
- 서버 생성 Planet SVG만 고정 템플릿으로 허용하며 응답에 sandbox CSP 적용
- CSP/HSTS/nosniff/frame denial/COOP/CORP/Permissions-Policy 적용
- 학습자료 원문 텍스트는 브라우저의 임시 학습 컨텍스트에만 두고 D1 동기화 시 제거
- AI Intent/학습 액션 사용 시 필요한 텍스트 구간은 설정된 AI 제공자에 일시 전송; PDF 분석은 PDF 파일 자체를 제공자에 전송해 읽기용 구간을 추출
- AI 요청 전 Planet Key/API key/session/Bearer 등 자격증명 패턴을 서버에서 redaction (PDF 바이너리 내부는 사전 redaction 불가하므로 비밀정보가 든 PDF 업로드 금지)
- AI telemetry는 성공/실패/fallback, 지연시간, 모델, token 사용량만 저장하고 prompt/source 본문은 저장하지 않음
- 공개 계정 발급 API는 bootstrap 완료 전 `503 SERVICE_INITIALIZING`으로 차단

## AI Core

AI 기능은 더 이상 키워드 UI 전환만 수행하지 않습니다. 서버의 고정 프로토콜과 Persona 정의 안에서 실제 모델 호출을 사용합니다.

- Intent AI: `prompt + 실제 임시 context excerpt + 현재 schema + 누적 학습 선호`를 보고 `study_type/layout/persona/tools` 선택
- AI Learning Actions: 플래시카드, 3줄 요약, 선택 문단 설명, Canvas 노드 추천, 코드 리뷰
- Persona: 모델이 system prompt를 만들지 않고 `persona_id`만 선택; 실제 system instruction은 서버의 allowlist 정의 사용
- PDF: 최대 8MB, `%PDF-` signature 확인 후 AI 제공자가 읽기용 최대 20구간을 구조화 추출; 원 PDF/추출 원문은 D1/R2에 저장하지 않음
- Learning Preference: 모드 선택/전환, 추천 수락, 회상 전 시도, 힌트, 타이머, AI action 등 aggregate signal만 누적
- 실패 대응: timeout/retry + structured schema validation + safe local fallback. 코드 화면의 “빠른 정적 체크”는 실제 실행 sandbox가 아니며 UI에도 그렇게 표시

AI 공급자 설정은 `openai` 또는 `gemini`를 지원합니다. 운영 키/모델명은 Cloudflare Secrets에만 둡니다. OpenAI 경로는 Responses API 요청에 `store:false`를 지정합니다. 제3자 AI 제공자의 별도 abuse monitoring/retention 정책까지 STUDYWORLD가 제어하는 것은 아니므로 사용자 UI에도 제공자 전송 사실을 명시합니다.

## 최초 Cloudflare 설정

Node.js 22.13+ / pnpm 12.x 기준입니다.

```bash
corepack enable
pnpm install
pnpm exec wrangler login
```

현재 패키지에는 실제 Cloudflare account ID, D1 ID, secret 값이 포함되어 있지 않습니다.

### 1. D1 / R2 생성

```bash
pnpm exec wrangler d1 create studyworld-prod
pnpm exec wrangler r2 bucket create studyworld-uploads
```

D1 생성 결과의 `database_id`를 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`와 교체합니다. 이 ID는 secret이 아니라 Cloudflare resource binding ID입니다.

### 2. migration 적용

첫 secret 등록 명령이 Worker 버전을 배포할 수 있으므로, 운영 D1을 먼저 준비합니다.

```bash
pnpm run db:migrate:remote
```

### 3. 운영 secret 등록

`.env`, `.dev.vars`를 만들지 않습니다. Cloudflare Dashboard 또는 다음 Wrangler prompt를 사용합니다.

```bash
pnpm exec wrangler secret put PLANET_KEY_PEPPER
pnpm exec wrangler secret put SESSION_PEPPER
pnpm exec wrangler secret put AI_PROVIDER   # openai 또는 gemini
pnpm exec wrangler secret put AI_MODEL      # 선택한 공급자의 실제 모델 ID
pnpm exec wrangler secret put AI_API_KEY    # 공급자 API key
```

인증용 두 pepper는 서로 다른 고엔트로피 랜덤값을 사용합니다. 특히 `PLANET_KEY_PEPPER`는 별도의 조직용 secret manager에도 안전하게 백업하세요.

계획적 pepper 교체 중에는 optional secret `PLANET_KEY_PEPPER_PREVIOUS`를 잠시 사용할 수 있습니다. 이전 Key로 로그인 성공 시 새 pepper digest로 자동 승격됩니다.

### 4. quality gate → deploy → bootstrap

```bash
pnpm run check
pnpm run lighthouse
pnpm run predeploy
pnpm run deploy
```

그 다음 **공개 트래픽을 열기 전에** `INITIAL_ACCOUNTS.md` 절차대로 one-time bootstrap을 수행합니다. Bootstrap은 사용자 row가 이미 하나라도 있으면 거부되며, 완료 후 DB marker로 영구 잠깁니다.

`/api/v1/health`의 `ready`가 `true`인지 확인한 뒤 서비스를 공개하세요.

```bash
curl -fsS https://YOUR_DOMAIN/api/v1/health
```

## 관리자 UI

Bootstrap에서 생성된 관리자 Key로 일반 `행성 입장`을 하면 profile 메뉴에 `초기 사용자·룸 관리` 메뉴가 나타납니다.

관리자는 여기서 다음 작업을 할 수 있습니다.

- 초기 사용자 닉네임 변경
- 초기 사용자 활성/정지
- 초기 사용자 Planet Key 재발급 (새 원문은 1회만 표시)
- 공개 스터디룸 제목/카테고리/템플릿/광장 공개 여부 수정
- 관리 중인 초기 사용자 사이에서 방장 이전

기존 Key 원문을 조회하는 기능은 의도적으로 없습니다. **조회 대신 rotation**만 제공합니다.

## 품질 명령

```bash
pnpm run syntax
pnpm run lint
pnpm run test
pnpm run lighthouse
pnpm run quality
```

Lighthouse CI 설정은 Performance / Accessibility / Best Practices / SEO 모두 `1.00`을 gate로 요구합니다. 배포 후 실제 custom domain에서도 다시 측정하세요.

## 저장소에 넣지 말아야 하는 것

`.gitignore`는 다음을 제외합니다.

- `.env*`, `.dev.vars*`, `.wrangler/`
- 로컬 DB/로그/테스트 및 Lighthouse 결과
- 인증서/키/secret 파일
- `bootstrap-keys*.json`, `studyworld-keys*.json`, `planet-keys*.json`
- `private/`, `secret-exports/`

운영 Planet Key export나 Cloudflare secret을 저장소에 커밋하지 마세요.

## 관련 문서

- `INITIAL_ACCOUNTS.md`: 최초 21개 계정 + 48개 공개룸 bootstrap
- `CLOUDFLARE_DEPLOY.md`: 배포 순서
- `SECURITY.md`: Key/R2/session/incident 보안 원칙
- `RELEASE_NOTES.md`: 이 handoff의 검증 내역
