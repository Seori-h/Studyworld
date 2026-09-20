# Initial managed users & discovery rooms

이 절차는 **새 D1에 실제 일반 사용자가 들어오기 전 딱 한 번** 실행합니다.

초기화 결과:

- 관리자 1명
- 일반 사용자 20명 (`role=user`)
- 공개 스터디룸 48개
- 각 룸은 실제 사용자 `owner_profile_id`와 owner membership을 가짐
- 커뮤니티 초기 글 작성자도 실제 profile ID에 연결됨
- 각 사용자의 공개 행성 이미지는 R2에 생성됨

초기 사용자들은 기능상 일반 사용자입니다. `managed_seed` 표시는 운영자가 초기 계정임을 식별하고 수정/Key rotation을 할 수 있게 하는 내부 provenance입니다.

## 1. 운영 secret과 migration이 먼저여야 합니다

`PLANET_KEY_PEPPER`, `SESSION_PEPPER`를 Cloudflare Secrets에 등록하고 D1 migration을 적용한 뒤 Worker를 배포합니다.

서비스 공개 전에 `/api/v1/health`는 `ready:false`일 수 있습니다. 이 상태에서는 새 Planet Key 발급이 서버에서 차단됩니다.

## 2. 임시 bootstrap secret 등록

고엔트로피 임시 값을 Cloudflare의 `BOOTSTRAP_TOKEN` secret으로 등록합니다. 저장소/.env 파일에는 넣지 않습니다.

```bash
pnpm exec wrangler secret put BOOTSTRAP_TOKEN
```

## 3. one-time bootstrap 실행

쉘 history에 token을 직접 남기지 않도록 interactive 입력을 권장합니다.

```bash
read -s BOOTSTRAP_TOKEN
printf '\n'
mkdir -p "$HOME/studyworld-private"
chmod 700 "$HOME/studyworld-private"

curl -fsS -X POST "https://YOUR_DOMAIN/api/v1/system/bootstrap" \
  -H "Content-Type: application/json" \
  -H "x-studyworld-bootstrap-token: ${BOOTSTRAP_TOKEN}" \
  --data '{"adminNickname":"서리"}' \
  > "$HOME/studyworld-private/bootstrap-keys-2026-09-20.json"

chmod 600 "$HOME/studyworld-private/bootstrap-keys-2026-09-20.json"
unset BOOTSTRAP_TOKEN
```

`adminNickname`은 실제 운영에 사용할 닉네임으로 바꿀 수 있습니다.

이 JSON에는 **21개의 Planet Key 원문**이 들어 있으므로 Git 저장소, 메신저, 일반 클라우드 폴더에 올리지 마세요. 조직 secret manager 또는 암호화된 오프라인 보관소로 이동하세요.

서버에는 이 원문 Key가 저장되지 않습니다.

## 4. 임시 token 즉시 삭제

Bootstrap 성공 후:

```bash
pnpm exec wrangler secret delete BOOTSTRAP_TOKEN
```

DB의 `system_state.initial_bootstrap_completed` marker 때문에 token이 남아 있더라도 동일 bootstrap은 다시 실행되지 않지만, 공격 표면을 줄이기 위해 secret도 삭제합니다.

## 5. 관리자 Key로 로그인

Bootstrap JSON의 `admin.planetKey`를 사이트의 `행성 입장`에 입력합니다.

관리자 profile 메뉴의 `초기 사용자·룸 관리`에서 다음을 수정할 수 있습니다.

- 초기 계정 닉네임
- 활성/정지 상태
- Key rotation
- 공개룸 제목/카테고리/템플릿/공개 여부
- 관리되는 다른 사용자로 방장 이전

기존 초기 사용자 Key를 화면에서 다시 조회하는 API는 없습니다. Key를 잃어버렸다면 `열쇠 재발급`을 사용하세요. 재발급 시 이전 Key와 해당 계정의 기존 세션은 즉시 폐기됩니다.

## 6. 초기 계정으로 직접 들어가기

각 초기 사용자 Key도 일반 `행성 입장`에서 사용할 수 있습니다. 로그인 이후 해당 profile은 정상 일반 사용자로 취급됩니다.

따라서 그 계정은:

- 자신에게 배정된 공개 스터디룸의 실제 owner
- 별도의 개인룸은 일반 정책에 따라 72시간에 1개, 활성 최대 1개
- 타인 스터디 참여 최대 5개
- 일반 사용자 AI 수정 quota 적용

초기 공개룸 3개를 소유한 것은 `group` ownership이며 개인룸 1개 제한과 별도로 계산됩니다.

## 7. 완료 확인

```bash
curl -fsS https://YOUR_DOMAIN/api/v1/health
```

`"ready":true`인지 확인합니다. 광장에서 48개의 룸이 실제 API/D1에서 표시되는지, 관리자 UI에서 20명의 초기 사용자가 표시되는지도 확인합니다.
