import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSameOriginForMutation, readJson, withSecurityHeaders, HttpError } from '../src/lib/http.js';

test('cross-site mutation is rejected', () => {
  const request = new Request('https://study.example/api/v1/test', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } });
  assert.throws(() => assertSameOriginForMutation(request), (error) => error instanceof HttpError && error.status === 403);
});

test('same-origin JSON mutation is accepted and parsed', async () => {
  const request = new Request('https://study.example/api/v1/test', { method: 'POST', headers: { origin: 'https://study.example', 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
  assert.doesNotThrow(() => assertSameOriginForMutation(request));
  assert.deepEqual(await readJson(request), { ok: true });
});

test('security headers include CSP, frame denial and nosniff', () => {
  const response = withSecurityHeaders(new Response('ok'), 'https://study.example/');
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
