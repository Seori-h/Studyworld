import { describe, expect, it } from 'vitest';
import { clearCookie, cookies, setCookie } from '../worker/lib/cookies';

describe('secure cookies', () => {
  it('always applies the baseline security attributes', () => {
    const value = setCookie('__Host-test', 'value', 60);
    expect(value).toContain('Path=/');
    expect(value).toContain('HttpOnly');
    expect(value).toContain('Secure');
    expect(value).toContain('SameSite=Lax');
  });

  it('expires cleared cookies immediately', () => {
    expect(clearCookie('__Host-test')).toContain('Max-Age=0');
  });

  it('parses encoded cookie values', () => {
    const request = new Request('https://studyworld.example', { headers: { Cookie: 'a=hello%20world; b=2' } });
    expect(cookies(request).get('a')).toBe('hello world');
    expect(cookies(request).get('b')).toBe('2');
  });
});
