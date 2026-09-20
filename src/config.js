export const POLICY = Object.freeze({
  personalRoomCooldownMs: 72 * 60 * 60 * 1000,
  adminRoomWindowMs: 24 * 60 * 60 * 1000,
  adminRoomMaxPerWindow: 3,
  maxJoinedRooms: 5,
  correctionWindowMs: 60 * 60 * 1000,
  accidentalRecoveryMs: 15 * 60 * 1000,
  sessionTtlSeconds: 30 * 24 * 60 * 60,
  maxActiveSessionsPerProfile: 10,
  maxJsonBytes: 128 * 1024,
  maxImageBytes: 5 * 1024 * 1024,
  aiDailyLimits: Object.freeze({ minor: 20, layout: 5, feature: 3 }),
  aiDailyRequestMax: 120,
});


export const ROOM_TEMPLATE_KEYS = Object.freeze(['paper', 'coding', 'language', 'teach', 'exam', 'memory', 'essay']);

export const ALLOWED_IMAGE_TYPES = Object.freeze({
  'image/png': ['89504e470d0a1a0a'],
  'image/jpeg': ['ffd8ff'],
  'image/webp': ['52494646'],
  'image/gif': ['474946383761', '474946383961'],
});

export const RESERVED_NICKNAMES = new Set([
  '관리자', '운영자', 'admin', 'administrator', 'studyworld', 'hope',
]);
