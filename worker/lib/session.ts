import type { AuthUser, Env } from '../types';
import { COOKIE, cookies, setCookie } from './cookies';
import { getUser, refreshSession } from './upstream';
import { signObject, verifyObject } from './crypto';

export interface MemberSession {
  user: AuthUser;
  accessToken: string;
  responseCookies: string[];
}

interface GuestPayload extends Record<string, unknown> { id: string; exp: number }

export async function memberSession(request: Request, env: Env): Promise<MemberSession | null> {
  const jar = cookies(request);
  const access = jar.get(COOKIE.access);
  if (access) {
    const user = await getUser(env, access);
    if (user) return { user, accessToken: access, responseCookies: [] };
  }
  const refresh = jar.get(COOKIE.refresh);
  if (!refresh) return null;
  const renewed = await refreshSession(env, refresh);
  if (!renewed) return null;
  return {
    user: renewed.user,
    accessToken: renewed.access_token,
    responseCookies: [
      setCookie(COOKIE.access, renewed.access_token, Math.max(60, renewed.expires_in - 30)),
      setCookie(COOKIE.refresh, renewed.refresh_token, 60 * 60 * 24 * 30),
    ],
  };
}

export async function guestId(request: Request, env: Env): Promise<string | null> {
  const raw = cookies(request).get(COOKIE.guest);
  if (!raw) return null;
  const value = await verifyObject<GuestPayload>(raw, env.SESSION_KEY);
  if (!value || typeof value.id !== 'string' || typeof value.exp !== 'number' || value.exp <= Date.now()) return null;
  return value.id;
}


export async function guestCookieForId(id: string, env: Env): Promise<string> {
  const maxAge = 60 * 60 * 24 * 3;
  const signed = await signObject({ id, exp: Date.now() + maxAge * 1000 }, env.SESSION_KEY);
  return setCookie(COOKIE.guest, signed, maxAge);
}

export async function newGuestCookie(env: Env): Promise<{ id: string; cookie: string }> {
  const id = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 3;
  const signed = await signObject({ id, exp: Date.now() + maxAge * 1000 }, env.SESSION_KEY);
  return { id, cookie: setCookie(COOKIE.guest, signed, maxAge) };
}

export function appendCookies(headers: Headers, values: string[]): void {
  for (const value of values) headers.append('Set-Cookie', value);
}
