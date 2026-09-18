# STUDYWORLD

맞춤형 개인 학습공간 서비스의 production baseline입니다.

현재 제품 정책은 다음과 같습니다.

- 광장 Basic Test: 누구나 공개 랭킹을 조회할 수 있습니다. 비회원은 Worker가 발급한 임시 게스트 세션과 닉네임을 사용하며 기록은 마지막 활동 3일 후 삭제됩니다.
- 공개 랭킹: 회원/비회원 모두 조회 가능. 개인정보 대신 공개 별칭만 노출합니다.
- 개인룸/파일: Google 또는 Kakao 간편로그인 회원만 사용합니다.
- 초대하기: UI에는 잠금 상태로 노출하지만 API 권한은 아직 열지 않습니다.

## 구조

Browser → Cloudflare Worker BFF → upstream Auth / Data / Storage 구조입니다. 프론트엔드 bundle에는 upstream URL이나 API key를 넣지 않습니다. production credential은 Cloudflare Worker Runtime Secrets에만 둡니다.

이 저장소는 의도적으로 single-package 구조입니다. `package.json`과 `pnpm-lock.yaml`을 하나씩만 유지하며, 독립 배포 앱이 실제로 늘어날 때만 pnpm workspace monorepo로 확장합니다.

## 처음 한 번 해야 하는 작업

이 스냅샷을 만든 환경에서는 package registry 접근이 차단되어 `pnpm-lock.yaml`을 생성할 수 없었습니다. **lockfile 없이 production 배포하지 마세요.** 네트워크가 가능한 신뢰된 개발 환경에서 정확히 다음 순서로 생성하고 검토한 뒤 Git에 커밋합니다.

```bash
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check`는 secret scan → supply-chain manifest check → ESLint(warning 0) → TypeScript strict → unit tests → production build 순서로 실패 즉시 중단합니다.

## 로컬 Runtime Secrets

실제 값은 Git에 넣지 않습니다. 로컬 개발이 필요한 경우 `.dev.vars`를 로컬에서만 만들고 다음 binding에 값을 설정합니다.

- `UPSTREAM_ORIGIN`
- `UPSTREAM_PUBLIC_KEY`
- `UPSTREAM_SECRET_KEY`
- `SESSION_KEY`

`.dev.vars`, `.env*`, `.npmrc`, 키/인증서/credential 파일은 `.gitignore`와 `scripts/check-secrets.mjs` 양쪽에서 방어합니다.

## Supabase 설정

`supabase/migrations`를 순서대로 적용합니다. Production Dashboard에서 임의로 schema를 수정하지 않습니다. Auth provider에는 Google과 Kakao를 활성화하고, 허용 redirect URL에는 실제 배포 도메인의 `/api/v1/auth/callback`을 등록합니다.

회원 데이터는 사용자 JWT + RLS로 접근합니다. 서버용 secret key는 Basic Test authoritative scoring과 문의 ticket 저장처럼 서버만 수행해야 하는 경로로 제한합니다. Storage bucket은 private이며 PDF 10MB 제한을 기본값으로 사용합니다.

## Cloudflare Workers Builds

GitHub repository를 Cloudflare Workers Builds에 연결한 뒤 다음처럼 운영합니다.

- Production branch: `main`
- Root directory: repository root
- Build variable: `PNPM_VERSION`은 `12.4.2`로 고정
- Build command: `pnpm install --frozen-lockfile && pnpm run check`
- Deploy command: `pnpm exec wrangler deploy`
- Production DB/API credential은 **Build Variables/Secrets에 넣지 않음**
- 실제 runtime 값은 Worker의 **Settings → Variables & Secrets**에만 저장

`wrangler.jsonc`에는 실제 secret 값도 project/account id도 없습니다. Runtime 설정 전에도 Worker 자체는 bootstrap 배포할 수 있고, `/api/v1/health` 외 API는 `503 CONFIG_NOT_READY`로 닫힙니다.
