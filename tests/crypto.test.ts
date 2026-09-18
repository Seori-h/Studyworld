import { describe, expect, it } from 'vitest';
import { randomToken, sha256Base64Url, signObject, verifyObject } from '../worker/lib/crypto';

describe('signed session payloads', () => {
  it('round-trips a signed payload', async () => {
    const token = await signObject({ id: 'guest', exp: 123 }, 'test-secret-with-enough-entropy');
    await expect(verifyObject(token, 'test-secret-with-enough-entropy')).resolves.toEqual({ id: 'guest', exp: 123 });
  });

  it('rejects tampering', async () => {
    const token = await signObject({ id: 'guest', exp: 123 }, 'test-secret-with-enough-entropy');
    await expect(verifyObject(`${token}x`, 'test-secret-with-enough-entropy')).resolves.toBeNull();
  });

  it('creates non-repeating random tokens', () => {
    expect(randomToken()).not.toBe(randomToken());
  });

  it('creates deterministic PKCE challenges', async () => {
    await expect(sha256Base64Url('studyworld')).resolves.toBe(await sha256Base64Url('studyworld'));
  });
});
