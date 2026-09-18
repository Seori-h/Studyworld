# Security policy

## Secrets

## Dependency policy

- pnpm only; exact package-manager version.
- Direct dependencies use exact versions only.
- `pnpm-lock.yaml` is mandatory and reviewed.
- New releases use a 7-day cooling period by default.
- Dependency lifecycle scripts are denied unless explicitly allowed in `pnpm-workspace.yaml`.
- Arbitrary `npx`, unversioned `pnpm dlx`, `latest`, caret and tilde dependency ranges are not accepted.
- Package and GitHub Action security advisories are reviewed before upgrades. If GitHub Actions are introduced later, third-party actions must be pinned to full commit SHAs.

## Application boundaries

- Browser talks only to same-origin `/api/v1/*` endpoints.
- Member access uses user JWT + Postgres/Storage RLS.
- Server secret is reserved for authoritative server-only operations.
- State-changing endpoints enforce same-origin checks and cookies are `HttpOnly; Secure; SameSite=Lax`.
- Official guest identity is random, signed, temporary and not exposed through leaderboard APIs.
- OAuth profile names are not published by default; leaderboard uses generated aliases.

## Files

Initial uploads accept private PDF files up to 10MB. The Worker checks declared content type, byte size and PDF magic bytes; Storage and metadata remain owner-restricted. Treat uploaded files as untrusted. Future document parsing must use an isolated processing path and must not serve untrusted files inline.

## Incident response

Rotate any suspected runtime secret immediately, invalidate affected sessions where appropriate, inspect Cloudflare and application logs, and do not paste secret values into issues, pull requests, build logs or chat messages.

## Repository secret policy

This repository intentionally does **not** include `.env.example`, `.dev.vars.example`, provider endpoints, project IDs, or credential samples. Runtime values belong in Cloudflare Worker runtime secrets. Local values belong only in ignored `.dev.vars`/`.env` files. Build jobs must not receive production database credentials.
