import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const roomService = await readFile(new URL('../src/services/room-service.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/0003_study_room_visits.sql', import.meta.url), 'utf8');

test('study room enter and exit API routes are wired to RoomService', () => {
  assert.match(indexSource, /\/enter\$\/\);/);
  assert.match(indexSource, /rooms\.enter\(profile/);
  assert.match(indexSource, /\/exit\$\/\);/);
  assert.match(indexSource, /rooms\.exit\(profile/);
});

test('room visits have persistent sessions and one active visit per profile', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS study_room_visits/);
  assert.match(migration, /duration_seconds INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_study_room_visits_open_profile/);
  assert.match(migration, /WHERE exited_at IS NULL/);
});

test('room lists expose accumulated study seconds and exit is idempotent', () => {
  assert.match(roomService, /AS totalStudySeconds/);
  assert.match(roomService, /COALESCE\(SUM\(duration_seconds\),0\) AS total/);
  assert.match(roomService, /if \(!visit\.exited_at\)/);
  assert.match(roomService, /ROOM_VISIT_NOT_FOUND/);
});
