import type {
  Env,
  TokenResponse,
} from '../types';

import {
  COOKIE,
  clearCookie,
  cookies,
  setCookie,
} from '../lib/cookies';

import {
  randomToken,
  sha256Base64Url,
  signObject,
  verifyObject,
} from '../lib/crypto';

import {
  failure,
  json,
  redirect,
} from '../lib/http';

import { authFetch } from '../lib/upstream';

import {
  appendCookies,
  guestId,
  memberSession,
} from '../lib/session';

interface PkcePayload
  extends Record<string, unknown> {
  verifier: string;
  exp: number;
}

const OAUTH_PROVIDERS = {
  google: 'google',
  kakao: 'custom:kakao-minimal',
} as const;

type PublicProvider =
  keyof typeof OAUTH_PROVIDERS;

function resolveProvider(
  provider: string,
): string | null {
  if (
    !Object.prototype.hasOwnProperty.call(
      OAUTH_PROVIDERS,
      provider,
    )
  ) {
    return null;
  }

  return OAUTH_PROVIDERS[
    provider as PublicProvider
  ];
}

export async function sessionRoute(
  request: Request,
  env: Env,
): Promise<Response> {
  const member =
    await memberSession(request, env);

  if (member) {
    const headers = new Headers();

    appendCookies(
      headers,
      member.responseCookies,
    );

    const metadata =
      member.user.user_metadata ?? {};

    const displayName = String(
      metadata['name']
        ?? metadata['full_name']
        ?? metadata['user_name']
        ?? 'STUDYER',
    );

    return json(
      {
        kind: 'member',
        user: {
          id: member.user.id,
          displayName,
        },
      },
      200,
      headers,
    );
  }

  const guest =
    await guestId(request, env);

  return json(
    guest
      ? { kind: 'guest' }
      : { kind: 'none' },
  );
}

export async function oauthStart(
  request: Request,
  env: Env,
  provider: string,
): Promise<Response> {
  const upstreamProvider =
    resolveProvider(provider);

  if (!upstreamProvider) {
    return failure(
      404,
      'PROVIDER_NOT_FOUND',
      '지원하지 않는 로그인 방식입니다.',
    );
  }

  const verifier =
    randomToken(48);

  const challenge =
    await sha256Base64Url(verifier);

  const callback =
    `${new URL(request.url).origin}`
    + '/api/v1/auth/callback';

  const upstream = new URL(
    `${env.UPSTREAM_ORIGIN.replace(
      /\/$/u,
      '',
    )}/auth/v1/authorize`,
  );

  upstream.searchParams.set(
    'provider',
    upstreamProvider,
  );

  upstream.searchParams.set(
    'redirect_to',
    callback,
  );

  upstream.searchParams.set(
    'code_challenge',
    challenge,
  );

  upstream.searchParams.set(
    'code_challenge_method',
    's256',
  );

  const authResponse = await fetch(
    upstream,
    {
      headers: {
        apikey:
          env.UPSTREAM_PUBLIC_KEY,
      },
      redirect: 'manual',
    },
  );

  const destination =
    authResponse.headers.get(
      'Location',
    );

  if (!destination) {
    return failure(
      502,
      'AUTH_UPSTREAM_FAILED',
      '로그인 연결을 시작하지 못했습니다.',
    );
  }

  const signed =
    await signObject(
      {
        verifier,
        exp:
          Date.now()
          + 10 * 60 * 1000,
      },
      env.SESSION_KEY,
    );

  const headers =
    new Headers({
      'Set-Cookie': setCookie(
        COOKIE.pkce,
        signed,
        10 * 60,
      ),
    });

  return redirect(
    destination,
    302,
    headers,
  );
}

export async function oauthCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url =
    new URL(request.url);

  if (
    url.searchParams.get('error')
  ) {
    return redirect(
      '/login?error=oauth_denied',
    );
  }

  const code =
    url.searchParams.get('code');

  const raw =
    cookies(request).get(
      COOKIE.pkce,
    );

  if (!code || !raw) {
    return redirect(
      '/login?error=oauth_state',
    );
  }

  const pkce =
    await verifyObject<PkcePayload>(
      raw,
      env.SESSION_KEY,
    );

  if (
    !pkce
    || typeof pkce.verifier
      !== 'string'
    || typeof pkce.exp
      !== 'number'
    || pkce.exp <= Date.now()
  ) {
    return redirect(
      '/login?error=oauth_state',
    );
  }

  const response =
    await authFetch(
      env,
      '/token?grant_type=pkce',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          auth_code: code,
          code_verifier:
            pkce.verifier,
        }),
      },
    );

  if (!response.ok) {
    return redirect(
      '/login?error=oauth_exchange',
    );
  }

  const tokens: TokenResponse =
    await response.json();

  const headers =
    new Headers();

  headers.append(
    'Set-Cookie',
    setCookie(
      COOKIE.access,
      tokens.access_token,
      Math.max(
        60,
        tokens.expires_in - 30,
      ),
    ),
  );

  headers.append(
    'Set-Cookie',
    setCookie(
      COOKIE.refresh,
      tokens.refresh_token,
      60 * 60 * 24 * 30,
    ),
  );

  headers.append(
    'Set-Cookie',
    clearCookie(COOKIE.pkce),
  );

  headers.append(
    'Set-Cookie',
    clearCookie(COOKIE.guest),
  );

  return redirect(
    '/rooms',
    302,
    headers,
  );
}

export async function logoutRoute(
  request: Request,
  env: Env,
): Promise<Response> {
  const member =
    await memberSession(
      request,
      env,
    );

  if (member) {
    await authFetch(
      env,
      '/logout',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${member.accessToken}`,
        },
      },
    );
  }

  const headers =
    new Headers();

  headers.append(
    'Set-Cookie',
    clearCookie(COOKIE.access),
  );

  headers.append(
    'Set-Cookie',
    clearCookie(COOKIE.refresh),
  );

  return json(
    { signed_out: true },
    200,
    headers,
  );
}