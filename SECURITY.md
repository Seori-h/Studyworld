# Security notes

## 1. Planet Key는 비밀번호와 같은 인증 자격증명입니다

- 포맷: `ST-XXXXX-XXXXX-XXXXX-XXXXX`
- 32문자 alphabet × 20자리 ≈ 100-bit entropy
- 생성: Web Crypto CSPRNG
- D1 저장: HMAC-SHA-256 digest only
- browser persistence: 원문/부분 문자열 모두 저장하지 않음
- 화면용 mask: 항상 `ST-•••••-•••••-•••••-•••••`

공개 프로필에는 별도의 `PL-XXXXXXXXXX` public code를 사용합니다. 인증 Key의 일부를 공개 식별자로 재사용하지 않습니다.

## 2. Credential lifecycle

`planet_credentials`는 profile과 분리되어 key version/status를 관리합니다.

Key rotation 시:

1. 기존 active credential → revoked
2. 새 random Key + 새 digest 생성
3. revoke/rotate audit event 기록
4. 대상 profile의 기존 session 전부 삭제
5. 새 Key 원문은 응답에서 딱 한 번 반환

관리자 역시 초기 사용자의 기존 원문 Key를 조회할 수 없습니다. 잃어버린 경우 새 Key로 rotation합니다.

`PLANET_KEY_PEPPER`는 Cloudflare Secret으로만 관리하고 별도 조직 secret manager에 백업합니다. 계획적 교체 시 `PLANET_KEY_PEPPER_PREVIOUS`를 잠시 사용하고 로그인 성공 시 digest를 새 pepper 기준으로 rehash합니다.

## 3. Public Planet Art

행성 이미지는 고정 서버 템플릿으로 생성되며 `nickname + publicCode + visualSeed`만 사용합니다.

- Planet Key 원문/조각 사용 금지
- R2: `planets/PL-XXXXXXXXXX/planet.svg`
- D1: `planet_assets`에는 R2 object key/hash/메타데이터만 저장
- 사용자 SVG upload는 금지
- 서버 생성 SVG 응답은 `sandbox; default-src 'none'` CSP 적용
- 닉네임은 XML escape 후 삽입

이미지 object path는 동일 public code에서 갱신될 수 있으므로 장기 immutable cache를 사용하지 않습니다.

## 4. Initial managed users

초기 20개 계정은 `role=user`인 first-class user rows입니다. 공개 스터디룸도 실제 owner/membership row를 갖습니다.

보안을 위해:

- bootstrap은 빈 profile DB에서만 1회 허용
- bootstrap 완료 전 일반 Planet Key 발급을 차단
- 임시 `BOOTSTRAP_TOKEN` 필요
- 완료 후 DB marker로 재실행 차단
- bootstrap response의 plaintext keys는 DB/R2에 저장하지 않음
- 운영자는 export를 repo 밖 암호화 저장소에 보관
- 관리자 화면에서 기존 Key 조회는 불가, rotation만 가능

## 5. Sessions

- Cookie: `__Host-sw_session`
- `HttpOnly; Secure; SameSite=Strict; Path=/`
- DB는 session token 원문 대신 HMAC digest 저장
- profile 당 최대 10개 활성 session 유지
- Key rotation 또는 account suspension 시 기존 session 삭제

## 6. Uploads

사용자 community upload는 PNG/JPEG/WebP/GIF만 허용합니다.

- 최대 5 MB
- Content-Type + magic bytes 확인
- R2 object key는 서버 생성
- 사용자 제공 SVG 거부

## 7. Browser/local learning data

전체 Planet Key는 localStorage에 들어가지 않습니다.

동적 학습자료의 원문 텍스트는 브라우저의 임시 workspace에만 유지하고, D1 `space_state` 동기화 전 `context.text` / `contextText`는 제거합니다. 다만 **AI 기능은 자료를 실제로 읽어야 하므로** Intent/요약/플래시카드/문단 설명/노드 추천/코드 리뷰 요청 시 필요한 범위의 텍스트가 설정된 AI 제공자에 일시 전송됩니다. PDF 분석은 최대 8MB의 PDF 파일 자체를 AI 제공자에 전달해 읽기용 구간을 추출하며, PDF 원본이나 추출 원문을 D1/R2에 저장하지 않습니다.

텍스트 기반 AI 요청 전 서버는 Planet Key, session cookie, OpenAI/Google/GitHub/AWS credential, Bearer token과 유사한 패턴을 `[REDACTED_CREDENTIAL]`로 치환합니다. 모델 출력에도 동일한 text sanitizer를 거칩니다. **PDF 바이너리 내부를 전송 전에 안전하게 redaction하는 기능은 없으므로, 비밀번호/API key/개인 비밀이 포함된 PDF를 업로드하면 안 됩니다.** UI에 이 제공자 전송 사실을 상시 표시합니다.

`ai_request_logs`에는 prompt/source 본문을 저장하지 않고 action/provider/model/status/latency/token count/error code/provider request id만 기록합니다. OpenAI Responses 경로는 `store:false`로 요청합니다. 다만 외부 AI 제공자의 abuse monitoring/retention은 제공자의 계약·계정·프로젝트 설정에 따르므로 “제공자가 절대로 보관하지 않는다”고 표현하지 않습니다.

이 구조는 브라우저 로컬 데이터까지 완전한 secret vault로 만든다는 의미는 아닙니다. XSS/기기 탈취 위협을 줄이기 위해 CSP와 logout cleanup을 유지하고, 민감한 원문을 장기 보관하는 기능으로 확장할 경우 IndexedDB 암호화/retention 정책을 별도 설계해야 합니다.

## 8. AI safety / prompt injection

- 학습자료는 untrusted data로 취급하며 자료 안의 “시스템 지침/역할 변경/비밀 요구/도구 실행” 문구를 따르지 않도록 서버 system instruction에서 명시
- 모델은 임의 system prompt를 반환하지 않고 allowlist `persona_id`만 선택
- Structured JSON schema + 서버 allowlist/길이 재검증 적용
- OpenAI/Gemini adapter에 timeout, 제한된 retry, schema invalid/empty response 처리
- AI 실패 시 UI를 중단하지 않고 안전한 local fallback 사용
- 실제 code execution sandbox는 현재 제공하지 않으며 정적 체크를 실행 결과처럼 표현하지 않음

## 9. Authorization / abuse

- private room state는 서버에서 membership을 검증
- room quota는 클라이언트 표시가 아니라 D1/service가 source of truth
- 일반 개인룸: active 1, 정상 생성 72시간 1회
- admin: rolling 24h 3개
- joined rooms: 최대 5
- correction: creation cycle 당 1회
- AI modifications: minor/layout/feature 별도 quota
- Cloudflare rate limit은 burst abuse용 보조 방어

## 10. Incident response

Planet Key 노출 의심 시 해당 계정에서 즉시 Key rotation을 수행합니다. Cloudflare secret 노출이면 session/Planet pepper 영향범위를 판단해 secret rotation, 필요 시 전체 session invalidation, 감사로그 검토를 수행해야 합니다.

운영 전 Cloudflare 계정 MFA, 최소권한 API token, D1/R2 백업/복구 정책, 로그 보존기간을 별도로 확정하세요.
