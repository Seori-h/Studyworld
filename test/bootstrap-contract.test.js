import test from 'node:test';
import assert from 'node:assert/strict';
import { BootstrapService } from '../src/services/bootstrap-service.js';
import { INITIAL_DISCOVERY_ROOMS, INITIAL_MANAGED_NICKNAMES } from '../src/bootstrap/initial-catalog.js';
import { readFile } from 'node:fs/promises';

class FakeStatement {
  constructor(sql) { this.sql = sql; this.bindings = []; }
  bind(...bindings) {
    const count = (this.sql.match(/\?/g) || []).length;
    assert.equal(bindings.length, count, `placeholder mismatch: ${this.sql}`);
    this.bindings = bindings;
    return this;
  }
  async first() { return null; }
}

class FakeDb {
  constructor() { this.batches = []; }
  prepare(sql) { return new FakeStatement(sql); }
  async batch(statements) { this.batches.push(statements); return statements.map(() => ({ success: true })); }
}

class FakeR2 {
  constructor() { this.objects = []; }
  async put(key, value, options) { this.objects.push({ key, value: String(value), options }); }
}

test('one-time bootstrap creates first-class users and real owned study rooms without persisting plaintext keys', async () => {
  const DB = new FakeDb();
  const UPLOADS = new FakeR2();
  const env = { DB, UPLOADS, PLANET_KEY_PEPPER: 'test-planet-pepper', BOOTSTRAP_TOKEN: 'test-bootstrap-token' };
  const request = new Request('https://study.example/api/v1/system/bootstrap', { method: 'POST', headers: { 'x-studyworld-bootstrap-token': 'test-bootstrap-token' } });
  const result = await new BootstrapService(env).run(request, { adminNickname: '서리관리자' });

  assert.equal(result.totals.managedUsers, INITIAL_MANAGED_NICKNAMES.length);
  assert.equal(result.totals.discoveryRooms, INITIAL_DISCOVERY_ROOMS.length);
  assert.equal(result.managedUsers.length, 20);
  assert.equal(result.managedUsers.filter((x) => x.rooms.length > 0).length, 16);
  assert.equal(result.managedUsers.reduce((sum, x) => sum + x.rooms.length, 0), 48);
  assert.equal(UPLOADS.objects.length, 21);
  assert.equal(DB.batches.length, 1);
  assert.ok(DB.batches[0].length <= 50, `bootstrap uses ${DB.batches[0].length} D1 statements`);

  const plaintextKeys = [result.admin.planetKey, ...result.managedUsers.map((x) => x.planetKey)];
  const persistedBindings = DB.batches[0].flatMap((statement) => statement.bindings.map(String));
  for (const key of plaintextKeys) {
    assert.equal(persistedBindings.includes(key), false, 'plaintext Planet Key must not be bound into D1 statements');
    assert.equal(UPLOADS.objects.some((object) => object.value.includes(key)), false, 'plaintext Planet Key must not appear in planet SVG');
  }
  assert.ok(result.managedUsers.every((x) => x.role === 'user' && x.managedSeed === true));
  assert.ok(result.managedUsers.every((x) => /^PL-[A-HJ-NP-Z2-9]{10}$/.test(x.publicCode)));
});


test('public account issuance is gated until bootstrap completes', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const issueRoute = source.indexOf("path === '/api/v1/planet-keys/issue'");
  const readinessCall = source.indexOf('await requireSystemReady(env);', issueRoute);
  const issueCall = source.indexOf('keys.issue(body.nickname)', issueRoute);
  assert.ok(issueRoute >= 0 && readinessCall > issueRoute && issueCall > readinessCall);
});


test('bootstrap attempts R2 cleanup when image upload or the transactional D1 batch fails', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/services/bootstrap-service.js', import.meta.url), 'utf8'));
  assert.match(source, /uploadedObjectKeys\.map\(\(key\) => this\.env\.UPLOADS\.delete\(key\)\)/);
  assert.match(source, /BOOTSTRAP_R2_CLEANUP_ATTEMPTED/);
});
