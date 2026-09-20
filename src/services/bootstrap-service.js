import { HttpError } from '../lib/http.js';
import {
  constantTimeStringEqual,
  generatePlanetKey,
  generatePublicPlanetCode,
  generateVisualSeed,
  hmacDigest,
  normalizePlanetKey,
  sha256Hex,
} from '../lib/security.js';
import { nicknameKey, validateNickname } from '../lib/validation.js';
import { renderPlanetSvg } from './planet-art-service.js';
import { INITIAL_COMMUNITY_AUTHOR_MAP, INITIAL_DISCOVERY_ROOMS, INITIAL_MANAGED_NICKNAMES } from '../bootstrap/initial-catalog.js';

const BOOTSTRAP_STATE_KEY = 'initial_bootstrap_completed';

function chunks(rows, maxRows) {
  const out = [];
  for (let i = 0; i < rows.length; i += maxRows) out.push(rows.slice(i, i + maxRows));
  return out;
}

function multiInsert(db, table, columns, rows) {
  if (!rows.length) return [];
  const maxRows = Math.max(1, Math.floor(100 / columns.length));
  return chunks(rows, maxRows).map((group) => {
    const placeholders = `(${columns.map(() => '?').join(',')})`;
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${group.map(() => placeholders).join(',')}`;
    return db.prepare(sql).bind(...group.flat());
  });
}

function profileRecord({ id, nickname, publicCode, visualSeed, role, accountOrigin, managedBy, now }) {
  return [id, nickname, nicknameKey(nickname), publicCode, visualSeed, role, accountOrigin, managedBy, 'active', now, now];
}

export class BootstrapService {
  constructor(env) { this.env = env; }

  assertToken(request) {
    const expected = String(this.env.BOOTSTRAP_TOKEN || '');
    const provided = String(request.headers.get('x-studyworld-bootstrap-token') || '');
    if (!expected || !provided || !constantTimeStringEqual(expected, provided)) {
      throw new HttpError(404, 'NOT_FOUND', '경로를 찾을 수 없습니다.');
    }
  }

  async run(request, payload = {}) {
    this.assertToken(request);
    const already = await this.env.DB.prepare('SELECT value FROM system_state WHERE key=? LIMIT 1').bind(BOOTSTRAP_STATE_KEY).first();
    if (already) throw new HttpError(409, 'BOOTSTRAP_ALREADY_COMPLETED', '초기 사용자 구성이 이미 완료되었습니다.');
    const existingProfiles = await this.env.DB.prepare('SELECT COUNT(*) AS count FROM profiles').first();
    if (Number(existingProfiles?.count || 0) > 0) {
      throw new HttpError(409, 'BOOTSTRAP_REQUIRES_EMPTY_DATABASE', '초기 사용자 구성은 실제 회원이 생기기 전 빈 사용자 DB에서만 실행할 수 있습니다.');
    }

    const adminNickname = validateNickname(payload.adminNickname || '서리');
    const allNicknames = [adminNickname, ...INITIAL_MANAGED_NICKNAMES];
    if (new Set(allNicknames.map(nicknameKey)).size !== allNicknames.length) {
      throw new HttpError(409, 'BOOTSTRAP_NICKNAME_CONFLICT', '초기 사용자 닉네임이 서로 겹칩니다. 관리자 닉네임을 바꿔 주세요.');
    }

    const now = new Date().toISOString();
    const profiles = [];
    const credentials = [];
    const events = [];
    const assets = [];
    const secretExport = [];
    const usedPublicCodes = new Set();
    const uploadedObjectKeys = [];

    const adminId = crypto.randomUUID();
    const specs = [
      { nickname: adminNickname, id: adminId, role: 'admin', accountOrigin: 'member', managedBy: null },
      ...INITIAL_MANAGED_NICKNAMES.map((nickname) => ({ nickname, id: crypto.randomUUID(), role: 'user', accountOrigin: 'managed_seed', managedBy: adminId })),
    ];

    const profileByNickname = new Map();
    for (const spec of specs) {
      let publicCode;
      do { publicCode = generatePublicPlanetCode(); } while (usedPublicCodes.has(publicCode));
      usedPublicCodes.add(publicCode);
      const visualSeed = generateVisualSeed();
      const planetKey = generatePlanetKey();
      const keyDigest = await hmacDigest(this.env.PLANET_KEY_PEPPER, `planet:${normalizePlanetKey(planetKey)}`);
      const credentialId = crypto.randomUUID();
      const assetId = crypto.randomUUID();
      const objectKey = `planets/${publicCode}/planet.svg`;
      const profile = { ...spec, publicCode, visualSeed, createdAt: now, objectKey };
      profileByNickname.set(spec.nickname, profile);
      profiles.push(profileRecord({ ...profile, now }));
      credentials.push([credentialId, spec.id, keyDigest, 1, 'active', now, null, null, spec.managedBy || spec.id]);
      events.push([crypto.randomUUID(), spec.id, credentialId, spec.managedBy || spec.id, 'bootstrap_issued', '{}', now]);

      const svg = renderPlanetSvg({ nickname: spec.nickname, publicCode, visualSeed });
      const sha256 = await sha256Hex(svg);
      try {
        await this.env.UPLOADS.put(objectKey, svg, {
          httpMetadata: { contentType: 'image/svg+xml; charset=utf-8', cacheControl: 'public, max-age=300, stale-while-revalidate=86400' },
          customMetadata: { profileId: spec.id, kind: 'planet_art', source: 'generated' },
        });
        uploadedObjectKeys.push(objectKey);
      } catch (error) {
        await Promise.allSettled(uploadedObjectKeys.map((key) => this.env.UPLOADS.delete(key)));
        error.bootstrapCleanup = 'BOOTSTRAP_R2_CLEANUP_ATTEMPTED';
        throw error;
      }
      assets.push([assetId, spec.id, 'planet_art', objectKey, 'image/svg+xml; charset=utf-8', 'public', sha256, 'generated', now, now, null]);
      secretExport.push({
        nickname: spec.nickname,
        profileId: spec.id,
        role: spec.role,
        managedSeed: spec.accountOrigin === 'managed_seed',
        publicCode,
        planetKey,
        planetImageUrl: `/media/${objectKey}`,
      });
    }

    const spaces = [];
    const members = [];
    const roomsByOwner = new Map();
    for (const room of INITIAL_DISCOVERY_ROOMS) {
      const owner = profileByNickname.get(room.ownerNickname);
      if (!owner) throw new Error(`BOOTSTRAP_OWNER_MISSING:${room.ownerNickname}`);
      const roomId = crypto.randomUUID();
      spaces.push([
        roomId,
        owner.id,
        'group',
        room.templateKey,
        room.title,
        room.description,
        room.category,
        room.description,
        room.meta,
        'group',
        1,
        'active',
        null,
        room.recommendScore,
        room.popularScore,
        room.visitCount,
        room.createdAt,
        room.createdAt,
        null,
        null,
      ]);
      members.push([roomId, owner.id, 'owner', 'active', room.createdAt, room.createdAt, null]);
      if (!roomsByOwner.has(owner.nickname)) roomsByOwner.set(owner.nickname, []);
      roomsByOwner.get(owner.nickname).push({ id: roomId, title: room.title, category: room.category });
    }

    const statements = [
      ...multiInsert(this.env.DB, 'profiles', ['id','nickname','nickname_key','public_code','visual_seed','role','account_origin','managed_by_profile_id','status','created_at','updated_at'], profiles),
      ...multiInsert(this.env.DB, 'planet_credentials', ['id','profile_id','key_digest','key_version','status','issued_at','rotated_at','revoked_at','created_by_profile_id'], credentials),
      ...multiInsert(this.env.DB, 'planet_credential_events', ['id','profile_id','credential_id','actor_profile_id','action','context_json','created_at'], events),
      ...multiInsert(this.env.DB, 'planet_assets', ['id','profile_id','kind','r2_object_key','content_type','visibility','sha256','source','created_at','updated_at','deleted_at'], assets),
      ...multiInsert(this.env.DB, 'study_spaces', ['id','owner_profile_id','space_kind','template_key','title','prompt','category','description','meta_label','visibility','discoverable','status','creation_cycle_id','recommend_score','popular_score','visit_count','created_at','updated_at','deleted_at','recovery_expires_at'], spaces),
      ...multiInsert(this.env.DB, 'space_members', ['space_id','profile_id','role','status','joined_at','updated_at','kicked_at'], members),
    ];

    const postEntries = Object.entries(INITIAL_COMMUNITY_AUTHOR_MAP);
    if (postEntries.length) {
      const caseSql = postEntries.map(() => 'WHEN ? THEN ?').join(' ');
      const inSql = postEntries.map(() => '?').join(',');
      const bindings = [];
      for (const [postId, nickname] of postEntries) bindings.push(postId, profileByNickname.get(nickname)?.id || null);
      for (const [postId] of postEntries) bindings.push(postId);
      statements.push(this.env.DB.prepare(`UPDATE community_posts SET author_profile_id=CASE id ${caseSql} ELSE author_profile_id END WHERE id IN (${inSql})`).bind(...bindings));
    }

    statements.push(this.env.DB.prepare('INSERT INTO system_state (key,value,updated_at) VALUES (?,?,?)')
      .bind(BOOTSTRAP_STATE_KEY, JSON.stringify({ adminProfileId: adminId, managedProfiles: INITIAL_MANAGED_NICKNAMES.length, discoveryRooms: INITIAL_DISCOVERY_ROOMS.length }), now));

    try {
      await this.env.DB.batch(statements);
    } catch (error) {
      // D1 batch is transactional; if the DB transaction fails, remove the R2 objects created for this one-time bootstrap.
      await Promise.allSettled(uploadedObjectKeys.map((key) => this.env.UPLOADS.delete(key)));
      error.bootstrapCleanup = 'BOOTSTRAP_R2_CLEANUP_ATTEMPTED';
      throw error;
    }

    for (const item of secretExport) item.rooms = roomsByOwner.get(item.nickname) || [];
    return {
      completedAt: now,
      warning: 'planetKey 값은 이 응답에서만 제공됩니다. 서버와 DB에는 원문 열쇠가 저장되지 않습니다.',
      admin: secretExport.find((x) => x.role === 'admin'),
      managedUsers: secretExport.filter((x) => x.managedSeed),
      totals: { profiles: secretExport.length, managedUsers: INITIAL_MANAGED_NICKNAMES.length, discoveryRooms: INITIAL_DISCOVERY_ROOMS.length },
    };
  }
}
