const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return toBase64(data);
}

export async function sha256Base64Url(value: string): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export async function signObject(value: Record<string, unknown>, secret: string): Promise<string> {
  const payload = toBase64(encoder.encode(JSON.stringify(value)));
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyObject<T extends Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = await hmac(payload, secret);
  const a = encoder.encode(signature);
  const b = encoder.encode(expected);
  if (a.length !== b.length) return null;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  if (mismatch !== 0) return null;
  try { return JSON.parse(decoder.decode(fromBase64(payload))) as T; }
  catch { return null; }
}
