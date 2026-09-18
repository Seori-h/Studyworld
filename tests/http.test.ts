import { describe, expect, it } from 'vitest';
import { assertSameOrigin, failure, json } from '../worker/lib/http';

describe('HTTP security boundary', () => {
  it('rejects cross-origin state changes', () => {
    const request = new Request('https://studyworld.example/api/v1/rooms', {
      method: 'POST', headers: { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(assertSameOrigin(request)?.status).toBe(403);
  });

  it('allows same-origin state changes', () => {
    const request = new Request('https://studyworld.example/api/v1/rooms', {
      method: 'POST', headers: { Origin: 'https://studyworld.example', 'Sec-Fetch-Site': 'same-origin' },
    });
    expect(assertSameOrigin(request)).toBeNull();
  });

  it('applies no-store and nosniff to API responses', () => {
    const response = json({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('does not expose internal details in public failures', async () => {
    const response = failure(500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
    expect(await response.text()).not.toContain('postgres');
  });
});
