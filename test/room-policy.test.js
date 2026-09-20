import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY } from '../src/config.js';
import { canCreatePersonalRoom, canJoinRoom, classifyModification } from '../src/services/room-policy-service.js';

test('일반 회원은 활성 개인룸이 있으면 추가 생성할 수 없다', () => {
  assert.deepEqual(canCreatePersonalRoom({ activeOwnedCount: 1 }), { allowed: false, code: 'ACTIVE_PERSONAL_ROOM_EXISTS' });
});

test('일반 회원은 72시간 쿨다운 중 새 룸을 만들 수 없다', () => {
  const nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
  const result = canCreatePersonalRoom({ quota: { next_allowed_at: nextAllowedAt, correction_available: 0, correction_used: 0 } });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'ROOM_CREATION_COOLDOWN');
  assert.equal(result.nextAllowedAt, nextAllowedAt);
});

test('정정 가능 플래그는 같은 생성 주기에서 딱 한 번 즉시 생성을 허용한다', () => {
  const result = canCreatePersonalRoom({ quota: { next_allowed_at: new Date(Date.now() + POLICY.personalRoomCooldownMs).toISOString(), correction_available: 1, correction_used: 0 } });
  assert.deepEqual(result, { allowed: true, mode: 'correction' });
});

test('이미 정정권을 사용한 사용자는 정정 우회를 할 수 없다', () => {
  const result = canCreatePersonalRoom({ quota: { next_allowed_at: new Date(Date.now() + 60_000).toISOString(), correction_available: 1, correction_used: 1 } });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'ROOM_CREATION_COOLDOWN');
});

test('관리자는 24시간 생성 이벤트 3개 이후 네 번째 생성이 차단된다', () => {
  assert.deepEqual(canCreatePersonalRoom({ role: 'admin', adminRecentCount: 3 }), { allowed: false, code: 'ADMIN_ROOM_DAILY_LIMIT' });
  assert.deepEqual(canCreatePersonalRoom({ role: 'admin', adminRecentCount: 2 }), { allowed: true, mode: 'admin' });
});

test('타인 스터디 참여는 5개까지이며 방장 본인 룸은 참여 슬롯이 아니다', () => {
  assert.equal(canJoinRoom({ joinedCount: 4 }).allowed, true);
  assert.deepEqual(canJoinRoom({ joinedCount: 5 }), { allowed: false, code: 'JOINED_ROOM_LIMIT' });
  assert.deepEqual(canJoinRoom({ joinedCount: 0, isOwner: true }), { allowed: false, code: 'OWNER_ALREADY_HAS_ACCESS' });
});

test('AI 룸 수정은 minor/layout/feature로 분리된다', () => {
  assert.equal(classifyModification('방 설명 문구를 조금 바꿔줘'), 'minor');
  assert.equal(classifyModification('화면 레이아웃과 위젯 배치를 바꿔줘'), 'layout');
  assert.equal(classifyModification('새로운 주간 랭킹 기능 추가해줘'), 'feature');
});

test('72시간이 지나면 남아 있던 정정 플래그보다 새 정상 생성 주기를 우선한다', () => {
  const result = canCreatePersonalRoom({ quota: { next_allowed_at: new Date(Date.now() - 1_000).toISOString(), correction_available: 1, correction_used: 0 } });
  assert.deepEqual(result, { allowed: true, mode: 'normal' });
});
