# STUDYWORLD production handoff

Release date: 2026-09-20
Target: Cloudflare Workers + Static Assets + D1 + R2

## Identity / database redesign

- `profiles`에서 인증 credential을 분리했습니다.
- `planet_credentials`: HMAC digest, version, active/revoked lifecycle.
- `planet_credential_events`: issued/revoked/rotated/bootstrap/pepper rehash 감사 이벤트.
- `public_code`를 별도 도입해 인증 Key 조각을 UI/이미지 식별자로 재사용하지 않습니다.
- `planet_assets` + R2에 사용자별 공개 행성 이미지를 영구 관리합니다.
- 공유용/공개 행성 이미지에는 Planet Key가 전혀 들어가지 않습니다.
- 사용자 자신의 Key rotation과 관리자-managed account rotation을 구현했습니다. rotation은 이전 credential과 기존 session을 폐기합니다.

## Initial real-account bootstrap

- 프런트에 하드코딩되었던 공개룸 fixture를 제거했습니다.
- one-time bootstrap이 관리자 1명 + 일반 사용자 20명을 실제 D1 profile로 생성합니다.
- 48개 공개 스터디룸을 실제 `study_spaces.owner_profile_id` + owner membership으로 연결합니다.
- 초기 community 작성자도 실제 profile ID로 연결합니다.
- 초기 user들은 `role=user`; `managed_seed`는 내부 관리 provenance입니다.
- Bootstrap은 빈 user DB에서만 허용되고 완료 후 DB marker로 영구 잠깁니다.
- Bootstrap 완료 전 일반 user Key issuance는 503으로 차단됩니다.
- 관리자 UI에서 초기 user nickname/status/Key rotation과 room metadata/owner를 수정할 수 있습니다.

## AI core completion

- `/api/v1/study/intent`가 실제 AI provider를 호출하고 `prompt + ephemeral source excerpt + current schema + preference hint`를 구조화 판단합니다.
- 플래시카드, 3줄 요약, 선택 문단 설명, Canvas 노드 추천, 코드 리뷰를 `/api/v1/study/actions` 실제 모델 호출에 연결했습니다.
- Persona는 모델이 임의 prompt를 생성하지 않고 서버 allowlist의 `persona_id`만 선택합니다.
- PDF는 최대 8MB/signature 검증 후 provider의 PDF 입력으로 읽기용 구간을 추출하며 Focus Reader에 공급합니다.
- source text/PDF는 Studyworld D1/R2에 저장하지 않으며 AI telemetry에도 prompt/source 본문을 기록하지 않습니다.
- 텍스트 AI context와 사용자 AI prompt에서 credential-like 문자열을 provider 전송 전에 redaction합니다.
- OpenAI Responses adapter는 structured JSON schema와 `store:false`; Gemini adapter는 JSON response schema를 사용합니다.
- AI timeout/retry/schema 오류 시 local fallback을 유지합니다.
- 룸 AI 수정 quota는 일반 AI 학습 요청과 분리되어 `자연어로 수정`에서 명시적으로 무장된 요청만 소모합니다.
- 누적 Learning Preference는 mode, recommendation acceptance, hint/attempt, timer, AI action 같은 aggregate signal만 저장합니다.
- 업로드/AI UI에 provider forwarding 고지를 상시 노출했습니다.

## Room policy

- 일반 user: active personal room 1개, 정상 생성 rolling 72h 1회.
- 초기 공개 group ownership은 personal room quota와 분리됩니다.
- 일반 user의 신규 group-room creation은 현재 disabled.
- admin: rolling 24h 최대 3개 personal room creation.
- joined rooms: 타인 소유 최대 5개.
- accidental delete recovery 15분, generation cycle당 조건부 correction 1회.
- AI room modification usage는 minor/layout/feature 독립 계측.

## Security

- Planet Key 약 100-bit CSPRNG.
- Planet/session 원문 token은 D1에 저장하지 않음.
- 인증 secret 일부를 마스킹 문자열에 노출하지 않음.
- Planet Key 입력은 password field 기본값 + 사용자가 선택한 일시 보기.
- server-generated SVG만 Planet Art로 사용, XML escaping + sandbox CSP.
- session cookie: `__Host-`, HttpOnly, Secure, SameSite=Strict.
- profile당 최대 10 active sessions.
- Cloudflare rate limits + same-origin mutation checks + CSP/HSTS/nosniff/frame denial.
- 사용자 upload SVG 차단, bitmap MIME + magic-byte 검증.
- bootstrap/key export 파일 패턴을 `.gitignore`에 추가.

## Verification performed in this environment

- `node scripts/check-syntax.mjs`: PASS.
- `node --test test/*.test.js`: PASS (test count is regenerated at release packaging time; see final handoff message).
- AI contract tests cover source-context forwarding, fixed Persona application, credential redaction, OpenAI `store:false`, schema constraints, and material-required guards.
- D1 migrations are applied sequentially to SQLite during release verification.
- credential/profile and R2-asset schema separation contract: PASS.
- bootstrap contract: 20 managed users + 48 actual-owned rooms + 21 generated planet images; plaintext keys absent from captured D1 bindings/R2 SVG content: PASS.
- user-supplied favicon/PWA assets remain included.
- no production `.env` / `.dev.vars` / key export file is included.

## Tooling limitation of this sandbox

The sandbox cannot currently resolve `registry.npmjs.org` (`EAI_AGAIN`), so pnpm 12.4.2 / ESLint / Lighthouse packages could not be downloaded and executed here. The repo keeps pinned tool versions and the Lighthouse 1.00 gates; run `pnpm install`, `pnpm run check`, and `pnpm run lighthouse` in the connected Codespace/CI before production cutover.
