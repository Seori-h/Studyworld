import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INITIAL_DISCOVERY_ROOMS, INITIAL_MANAGED_NICKNAMES } from '../src/bootstrap/initial-catalog.js';

const migration = await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
const preferenceMigration = await readFile(new URL('../migrations/0002_learning_preference_signals.sql', import.meta.url), 'utf8');

test('credentials are separated from profiles and plaintext keys have no schema column', () => {
  const profileBlock = migration.match(/CREATE TABLE IF NOT EXISTS profiles \([\s\S]*?\n\);/)?.[0] || '';
  assert.ok(profileBlock);
  assert.doesNotMatch(profileBlock, /planet_key|key_digest/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS planet_credentials/);
  assert.match(migration, /key_digest TEXT NOT NULL UNIQUE/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_planet_credentials_active_profile/);
});

test('persistent planet art is metadata in D1 and bytes belong in R2', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS planet_assets/);
  assert.match(migration, /r2_object_key TEXT NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /image_blob|planet_image_blob|BLOB/i);
});

test('initial catalog maps 48 discovery rooms onto 20 normal managed user accounts', () => {
  assert.equal(INITIAL_MANAGED_NICKNAMES.length, 20);
  assert.equal(INITIAL_DISCOVERY_ROOMS.length, 48);
  const owners = new Set(INITIAL_DISCOVERY_ROOMS.map((room) => room.ownerNickname));
  assert.equal(owners.size, 16);
  for (const owner of owners) assert.equal(INITIAL_MANAGED_NICKNAMES.includes(owner), true);
});

test('AI observability and preference learning have dedicated metadata tables without prompt bodies', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_request_logs/);
  assert.match(migration, /latency_ms INTEGER NOT NULL/);
  assert.match(migration, /input_tokens INTEGER NOT NULL/);
  assert.match(migration, /output_tokens INTEGER NOT NULL/);
  const logBlock = migration.match(/CREATE TABLE IF NOT EXISTS ai_request_logs \([\s\S]*?\n\);/)?.[0] || '';
  assert.doesNotMatch(logBlock, /prompt|context_text|source_text/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS learning_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS learning_preferences/);
});


test('learning preference migration adds aggregate-only signals needed by adaptive study UX', () => {
  for (const column of ['hint_use_count', 'attempt_before_answer_count', 'recommendation_accept_count', 'ai_action_count']) {
    assert.match(preferenceMigration, new RegExp(`ADD COLUMN ${column}`));
  }
  const sqlOnly = preferenceMigration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sqlOnly, /prompt|source_text|context_text/i);
});
