import { POLICY } from '../config.js';

export const SESSION_COOKIE_NAME = '__Host-sw_session';

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function readJson(request, maxBytes = POLICY.maxJsonBytes) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (request.body && contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new HttpError(415, 'JSON_CONTENT_TYPE_REQUIRED', 'JSON 요청은 application/json 형식으로 보내 주세요.');
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '요청 데이터가 너무 큽니다.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '요청 데이터가 너무 큽니다.');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'JSON 형식이 올바르지 않습니다.');
  }
}

export function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  for (const part of cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

export function setSessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function assertSameOriginForMutation(request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

  const targetOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new HttpError(403, 'CROSS_SITE_REQUEST_BLOCKED', '허용되지 않은 외부 사이트 요청입니다.');

  const origin = request.headers.get('origin');
  if (origin && origin !== targetOrigin) throw new HttpError(403, 'ORIGIN_MISMATCH', '허용되지 않은 요청 출처입니다.');

  if (!origin) {
    const referer = request.headers.get('referer');
    if (referer) {
      let refererOrigin = '';
      try { refererOrigin = new URL(referer).origin; } catch { /* invalid referer is rejected below */ }
      if (refererOrigin !== targetOrigin) throw new HttpError(403, 'REFERER_MISMATCH', '허용되지 않은 요청 출처입니다.');
    }
  }
}

const SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'strict-transport-security': 'max-age=15552000',
  'content-security-policy': "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
});

export function withSecurityHeaders(response, requestUrl = '') {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) { if (!headers.has(key)) headers.set(key, value); }
  if (requestUrl) {
    const path = new URL(requestUrl).pathname;
    if (/^\/assets\/.+\.(?:png|webp|jpg|jpeg|gif|css|js)$/i.test(path) || /^\/favicon(?:-|\.).+/i.test(path)) {
      headers.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
    } else if (path === '/' || path.endsWith('.html')) {
      headers.set('cache-control', 'no-cache');
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
  console.error('UNHANDLED_ERROR', error?.name || 'Error', error?.message || 'unknown');
  return json({ error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' } }, 500);
}
