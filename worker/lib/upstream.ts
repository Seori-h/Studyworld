import type { Env, TokenResponse, AuthUser } from '../types';

function base(env: Env): string { return env.UPSTREAM_ORIGIN.replace(/\/$/u, ''); }

function userHeaders(env: Env, accessToken?: string): Headers {
  const headers = new Headers({ apikey: env.UPSTREAM_PUBLIC_KEY });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export async function authFetch(env: Env, path: string, init?: RequestInit, secret = false): Promise<Response> {
  const headers = new Headers(init?.headers);
  const key = secret ? env.UPSTREAM_SECRET_KEY : env.UPSTREAM_PUBLIC_KEY;
  headers.set('apikey', key);
  return fetch(`${base(env)}/auth/v1${path}`, { ...init, headers });
}

export async function getUser(env: Env, accessToken: string): Promise<AuthUser | null> {
  const headers = userHeaders(env, accessToken);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${base(env)}/auth/v1/user`, { headers });
  if (!response.ok) return null;
  return await response.json() as AuthUser;
}

export async function refreshSession(env: Env, refreshToken: string): Promise<TokenResponse | null> {
  const response = await authFetch(env, '/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return await response.json() as TokenResponse;
}

export async function restFetch(env: Env, path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('apikey', env.UPSTREAM_PUBLIC_KEY);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${base(env)}/rest/v1${path}`, { ...init, headers });
}

export async function publicRpc(env: Env, name: string, body: unknown, secret = false): Promise<Response> {
  const key = secret ? env.UPSTREAM_SECRET_KEY : env.UPSTREAM_PUBLIC_KEY;
  return fetch(`${base(env)}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function storageFetch(env: Env, path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('apikey', env.UPSTREAM_PUBLIC_KEY);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${base(env)}/storage/v1${path}`, { ...init, headers });
}
