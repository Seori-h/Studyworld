import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNickname, safeJson } from '../src/lib/validation.js';

test('닉네임은 NFKC 정규화되고 2~16자 정책을 지킨다', () => {
  assert.equal(validateNickname('  별빛 탐험가  '), '별빛 탐험가');
  assert.throws(() => validateNickname('a'));
  assert.throws(() => validateNickname('x'.repeat(17)));
});

test('HTML 경계에 위험한 꺾쇠 문자가 있는 닉네임은 거절된다', () => {
  assert.throws(() => validateNickname('<admin>'));
});

test('저장 상태 JSON은 크기 상한을 적용한다', () => {
  assert.equal(safeJson({ ok: true }), '{"ok":true}');
  assert.throws(() => safeJson({ value: 'x'.repeat(100) }, 10));
});
