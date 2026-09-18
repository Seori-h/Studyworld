const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export interface ApiErrorShape { code: string; message: string }

export function json<T>(data: T, status = 200, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) out.set(key, value);
  return new Response(JSON.stringify({ data, error: null }), { status, headers: out });
}

export function failure(status: number, code: string, message: string, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) out.set(key, value);
  return new Response(JSON.stringify({ data: null, error: { code, message } satisfies ApiErrorShape }), { status, headers: out });
}

export function redirect(location: string, status = 302, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set('Location', location);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) out.set(key, value);
  return new Response(null, { status, headers: out });
}

export function assertSameOrigin(request: Request): Response | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null;
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  if (origin !== expected) return failure(403, 'CSRF_REJECTED', '허용되지 않은 요청입니다.');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin') return failure(403, 'CSRF_REJECTED', '허용되지 않은 요청입니다.');
  return null;
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  return JSON.parse(text) as T;
}

export function requestId(request: Request): string {
  return request.headers.get('cf-ray') ?? crypto.randomUUID();
}
