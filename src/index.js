import {
  json,
  readJson,
  assertSameOriginForMutation,
  errorResponse,
  clearSessionCookie,
  withSecurityHeaders,
  HttpError,
} from './lib/http.js';
import { AuthService } from './services/auth-service.js';
import { PlanetKeyService } from './services/planet-key-service.js';
import { RoomService } from './services/room-service.js';
import { AiUsageService } from './services/ai-usage-service.js';
import { IntentService } from './services/intent-service.js';
import { CommunityService } from './services/community-service.js';
import { UploadService } from './services/upload-service.js';
import { BootstrapService } from './services/bootstrap-service.js';
import { DiscoveryService } from './services/discovery-service.js';
import { AdminService } from './services/admin-service.js';
import { ProfileRepository } from './repositories/profile-repository.js';
import { AiCoreService } from './services/ai-core-service.js';
import { LearningPreferenceService } from './services/learning-preference-service.js';
import { aiConfigurationStatus } from './services/ai-gateway.js';
import { sanitizeStudyDraftPayload } from './services/study-state-sanitizer.js';

async function throttle(binding, key, message) {
  if (!binding) return;
  const result = await binding.limit({ key });
  if (!result.success) throw new HttpError(429, 'RATE_LIMITED', message);
}

function anonymousRateKey(request, scope) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return `${scope}:${ip}`;
}

function assertRequiredBindings(env) {
  if (!env.DB) throw new Error('D1_BINDING_MISSING');
  if (!env.UPLOADS) throw new Error('R2_BINDING_MISSING');
  if (!env.ASSETS) throw new Error('ASSETS_BINDING_MISSING');
  if (!env.PLANET_KEY_PEPPER) throw new Error('PLANET_KEY_PEPPER_MISSING');
  if (!env.SESSION_PEPPER) throw new Error('SESSION_PEPPER_MISSING');
}


async function systemReady(env) {
  const row = await env.DB.prepare("SELECT value FROM system_state WHERE key='initial_bootstrap_completed' LIMIT 1").first();
  return Boolean(row);
}

async function requireSystemReady(env) {
  if (!(await systemReady(env))) throw new HttpError(503, 'SERVICE_INITIALIZING', '초기 사용자와 스터디룸 구성이 아직 완료되지 않았습니다.');
}

async function health(env) {
  assertRequiredBindings(env);
  const db = await env.DB.prepare('SELECT 1 AS ok').first();
  const bootstrapReady = Number(db?.ok || 0) === 1 ? await systemReady(env) : false;
  const ai = aiConfigurationStatus(env);
  return json({
    ok: Number(db?.ok || 0) === 1,
    ready: bootstrapReady && ai.configured,
    bootstrapReady,
    service: 'studyworld',
    storage: { d1: Number(db?.ok || 0) === 1, r2: Boolean(env.UPLOADS) },
    ai,
    time: new Date().toISOString(),
  });
}

async function api(request, env) {
  assertRequiredBindings(env);
  assertSameOriginForMutation(request);

  const url = new URL(request.url);
  const path = url.pathname;
  const auth = new AuthService(env);
  const keys = new PlanetKeyService(env);
  const rooms = new RoomService(env);
  const community = new CommunityService(env);
  const discovery = new DiscoveryService(env);

  if (request.method === 'GET' && path === '/api/v1/health') return health(env);

  // One-time bootstrap: requires a temporary Cloudflare secret and is permanently locked by DB state after success.
  if (request.method === 'POST' && path === '/api/v1/system/bootstrap') {
    await throttle(env.KEY_ISSUE_RATE, anonymousRateKey(request, 'bootstrap'), '초기화 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await new BootstrapService(env).run(request, await readJson(request)), 201);
  }

  if (request.method === 'GET' && path === '/api/v1/profiles/nickname-availability') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'nickname'), '닉네임 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await keys.nicknameAvailability(url.searchParams.get('nickname') || ''));
  }

  if (request.method === 'POST' && path === '/api/v1/planet-keys/issue') {
    await requireSystemReady(env);
    await throttle(env.KEY_ISSUE_RATE, anonymousRateKey(request, 'issue'), '행성 열쇠 발급 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const body = await readJson(request);
    const result = await keys.issue(body.nickname);
    return json({ profile: result.profile, planetKey: result.planetKey }, 201, { 'set-cookie': result.sessionCookie });
  }

  if (request.method === 'POST' && path === '/api/v1/planet-keys/restore') {
    await throttle(env.KEY_RESTORE_RATE, anonymousRateKey(request, 'restore'), '행성 열쇠 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const body = await readJson(request);
    const result = await keys.restore(body.planetKey);
    return json({ profile: result.profile }, 200, { 'set-cookie': result.sessionCookie });
  }

  if (request.method === 'GET' && path === '/api/v1/session') {
    const profile = await auth.optionalProfile(request);
    return json({ authenticated: Boolean(profile), profile });
  }

  if (request.method === 'POST' && path === '/api/v1/session/logout') {
    await auth.logout(request);
    return json({ loggedOut: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  // Public discovery reads from actual D1 room/user rows, never from a front-end fixture list.
  if (request.method === 'GET' && path === '/api/v1/discovery/spaces') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'discovery'), '조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await discovery.list(url.searchParams.get('category') || '', url.searchParams.get('sort') || 'recent'));
  }

  let match = path.match(/^\/api\/v1\/discovery\/spaces\/([^/]+)\/visit$/);
  if (match && request.method === 'POST') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'discovery-visit'), '방문 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await discovery.recordVisit(decodeURIComponent(match[1])));
  }

  // Community reading is public. Writing requires a session below.
  if (request.method === 'GET' && path === '/api/v1/community/posts') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'community-list'), '조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await community.list(url.searchParams.get('board') || 'all', url.searchParams.get('sort') || 'new'));
  }

  match = path.match(/^\/api\/v1\/community\/posts\/([^/]+)$/);
  if (match && request.method === 'GET') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'community-post'), '조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await community.get(decodeURIComponent(match[1])));
  }

  match = path.match(/^\/api\/v1\/community\/posts\/([^/]+)\/comments$/);
  if (match && request.method === 'GET') {
    await throttle(env.PUBLIC_READ_RATE, anonymousRateKey(request, 'community-comments'), '조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await community.comments(decodeURIComponent(match[1])));
  }

  const profile = await auth.requireProfile(request);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    await throttle(env.WRITE_RATE, `write:${profile.id}`, '요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.');
  }

  if (request.method === 'POST' && path === '/api/v1/planet-keys/rotate') {
    const target = await new ProfileRepository(env.DB).findById(profile.id);
    const result = await keys.rotateForProfile(target, profile, { createSession: true });
    return json({ planetKey: result.planetKey, credentialVersion: result.credentialVersion, issuedAt: result.issuedAt }, 200, { 'set-cookie': result.sessionCookie });
  }

  if (request.method === 'POST' && path === '/api/v1/study-drafts') {
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const draft = sanitizeStudyDraftPayload(body);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO study_drafts (id, profile_id, payload_json, created_at) VALUES (?, ?, ?, ?)').bind(id, profile.id, JSON.stringify(draft), now),
      env.DB.prepare('DELETE FROM study_drafts WHERE profile_id=? AND id NOT IN (SELECT id FROM study_drafts WHERE profile_id=? ORDER BY created_at DESC LIMIT 50)').bind(profile.id, profile.id),
    ]);
    return json({ id, ...draft, createdAt: now }, 201);
  }

  if (request.method === 'GET' && path === '/api/v1/study-spaces') return json(await rooms.listFor(profile));
  if (request.method === 'POST' && path === '/api/v1/study-spaces') return json(await rooms.create(profile, await readJson(request)), 201);

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)$/);
  if (match && request.method === 'DELETE') {
    const body = await readJson(request);
    return json(await rooms.delete(profile, decodeURIComponent(match[1]), body.reason || 'normal'));
  }

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/restore$/);
  if (match && request.method === 'POST') return json(await rooms.restore(profile, decodeURIComponent(match[1])));

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/join$/);
  if (match && request.method === 'POST') return json(await rooms.join(profile, decodeURIComponent(match[1])));

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/leave$/);
  if (match && request.method === 'POST') return json(await rooms.leave(profile, decodeURIComponent(match[1])));

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/members\/([^/]+)\/kick$/);
  if (match && request.method === 'POST') return json(await rooms.kick(profile, decodeURIComponent(match[1]), decodeURIComponent(match[2])));

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/state$/);
  if (match && request.method === 'GET') return json(await rooms.getState(profile, decodeURIComponent(match[1])));
  if (match && request.method === 'PUT') return json(await rooms.putState(profile, decodeURIComponent(match[1]), await readJson(request)));

  match = path.match(/^\/api\/v1\/study-spaces\/([^/]+)\/rules$/);
  if (match && request.method === 'GET') return json(await rooms.getRules(profile, decodeURIComponent(match[1])));
  if (match && request.method === 'PUT') {
    const body = await readJson(request);
    return json(await rooms.putRules(profile, decodeURIComponent(match[1]), body.rules || {}));
  }

  if (request.method === 'POST' && path === '/api/v1/study/intent') {
    await throttle(env.AI_RATE, `ai:${profile.id}`, 'AI 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.');
    const body = await readJson(request);
    let usage = null;
    if (body.spaceId) await rooms.assertRoomAccess(profile, String(body.spaceId));
    if (body.spaceId && body.roomModification === true) {
      usage = await new AiUsageService(env).consume(profile.id, String(body.spaceId), body.prompt || '', body.modificationKind || '');
    }
    const resolved = await new IntentService(env).resolve(profile, body);
    return json({ ...resolved, usage });
  }

  if (request.method === 'POST' && path === '/api/v1/study/actions') {
    await throttle(env.AI_RATE, `ai:${profile.id}`, 'AI 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.');
    const body = await readJson(request);
    if (body.spaceId) await rooms.assertRoomAccess(profile, String(body.spaceId));
    return json(await new AiCoreService(env).action(profile, body));
  }

  if (request.method === 'POST' && path === '/api/v1/study/context/pdf') {
    await throttle(env.AI_RATE, `ai:${profile.id}`, 'AI 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.');
    await throttle(env.UPLOAD_RATE, `pdf:${profile.id}`, 'PDF 분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const form = await request.formData();
    const file = form.get('file');
    const spaceId = String(form.get('spaceId') || '');
    if (spaceId) await rooms.assertRoomAccess(profile, spaceId);
    return json(await new AiCoreService(env).extractPdf(profile, file, spaceId || null));
  }

  if (request.method === 'GET' && path === '/api/v1/learning/preferences') {
    return json(await new LearningPreferenceService(env.DB).get(profile.id));
  }

  if (request.method === 'POST' && path === '/api/v1/learning/events') {
    return json(await new LearningPreferenceService(env.DB).record(profile.id, await readJson(request)), 201);
  }

  if (request.method === 'POST' && path === '/api/v1/community/posts') return json(await community.create(profile, await readJson(request)), 201);

  match = path.match(/^\/api\/v1\/community\/posts\/([^/]+)\/comments$/);
  if (match && request.method === 'POST') return json(await community.comment(profile, decodeURIComponent(match[1]), await readJson(request)), 201);

  if (request.method === 'POST' && path === '/api/v1/uploads') {
    await throttle(env.UPLOAD_RATE, `upload:${profile.id}`, '이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return json(await new UploadService(env).uploadImage(profile, request), 201);
  }

  // Admin management for managed seed users/rooms. No plaintext keys are listed; rotation returns a new key once.
  if (path.startsWith('/api/v1/admin/')) {
    if (profile.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', '관리자 권한이 필요합니다.');
    const admin = new AdminService(env);
    if (request.method === 'GET' && path === '/api/v1/admin/managed-profiles') return json(await admin.listManaged(profile));

    match = path.match(/^\/api\/v1\/admin\/managed-profiles\/([^/]+)$/);
    if (match && request.method === 'PATCH') return json(await admin.updateManagedProfile(profile, decodeURIComponent(match[1]), await readJson(request)));

    match = path.match(/^\/api\/v1\/admin\/managed-profiles\/([^/]+)\/planet-key\/rotate$/);
    if (match && request.method === 'POST') return json(await admin.rotateManagedKey(profile, decodeURIComponent(match[1])));

    match = path.match(/^\/api\/v1\/admin\/study-spaces\/([^/]+)$/);
    if (match && request.method === 'PATCH') return json(await admin.updateSpace(profile, decodeURIComponent(match[1]), await readJson(request)));

    match = path.match(/^\/api\/v1\/admin\/study-spaces\/([^/]+)\/transfer$/);
    if (match && request.method === 'POST') {
      const body = await readJson(request);
      return json(await admin.transferSpace(profile, decodeURIComponent(match[1]), String(body.ownerProfileId || '')));
    }
  }

  throw new HttpError(404, 'API_NOT_FOUND', 'API 경로를 찾을 수 없습니다.');
}

async function media(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '허용되지 않은 요청 방식입니다.');
  const url = new URL(request.url);
  let key = '';
  try { key = decodeURIComponent(url.pathname.replace(/^\/media\//, '')); } catch { throw new HttpError(404, 'MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.'); }
  const allowed = key.startsWith('community/') || /^planets\/PL-[A-HJ-NP-Z2-9]{10}\/planet\.svg$/.test(key);
  if (!key || key.includes('..') || !allowed) throw new HttpError(404, 'MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');

  const object = await env.UPLOADS.get(key);
  if (!object) throw new HttpError(404, 'MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-disposition', 'inline');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (key.endsWith('.svg')) headers.set('content-security-policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      let response;
      if (url.pathname.startsWith('/api/')) response = await api(request, env);
      else if (url.pathname.startsWith('/media/')) response = await media(request, env);
      else response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, request.url);
    } catch (error) {
      return withSecurityHeaders(errorResponse(error), request.url);
    }
  },
};
