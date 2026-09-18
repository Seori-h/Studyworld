export const COOKIE = {
  access: '__Host-sw_at',
  refresh: '__Host-sw_rt',
  pkce: '__Host-sw_pkce',
  guest: '__Host-sw_guest',
} as const;

export function cookies(request: Request): Map<string, string> {
  const map = new Map<string, string>();
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    map.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return map;
}

export function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string): string { return setCookie(name, '', 0); }
