import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlanetKey, generatePublicPlanetCode, isValidPlanetKey, maskPlanetKey, normalizePlanetKey, hmacDigest } from '../src/lib/security.js';

test('행성 열쇠는 서버용 강한 랜덤 포맷으로 생성된다', () => {
  const keys = new Set();
  for (let i = 0; i < 500; i += 1) {
    const key = generatePlanetKey();
    assert.equal(isValidPlanetKey(key), true);
    keys.add(key);
  }
  assert.equal(keys.size, 500);
});

test('마스킹 문자열에는 복구용 열쇠의 어떤 조각도 노출되지 않는다', () => {
  const key = 'ST-ABCDE-FGHJK-LMNPQ-RSTUV';
  const masked = maskPlanetKey(key);
  assert.equal(masked, 'ST-•••••-•••••-•••••-•••••');
  assert.equal(masked.includes('ABCDE'), false);
  assert.equal(masked.includes('FGHJK'), false);
  assert.notEqual(masked, key);
});

test('공개 행성 코드는 인증 열쇠와 별도 포맷으로 생성된다', () => {
  const codes = new Set();
  for (let i = 0; i < 300; i += 1) {
    const code = generatePublicPlanetCode();
    assert.match(code, /^PL-[A-HJ-NP-Z2-9]{10}$/);
    codes.add(code);
  }
  assert.equal(codes.size, 300);
});

test('키 정규화는 공백과 대소문자만 정리한다', () => {
  assert.equal(normalizePlanetKey(' st-abcde-fghjk-lmnpq-rstuv '), 'ST-ABCDE-FGHJK-LMNPQ-RSTUV');
});

test('HMAC digest는 같은 secret/value에 결정적이며 원문과 다르다', async () => {
  const a = await hmacDigest('test-only-pepper', 'planet:ST-ABCDE-FGHJK-LMNPQ-RSTUV');
  const b = await hmacDigest('test-only-pepper', 'planet:ST-ABCDE-FGHJK-LMNPQ-RSTUV');
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.equal(a.includes('ST-ABCDE'), false);
});
