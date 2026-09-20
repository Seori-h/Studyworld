import { POLICY, ROOM_TEMPLATE_KEYS } from '../config.js';
import { HttpError } from '../lib/http.js';
import { cleanText, requireEnum, safeJson } from '../lib/validation.js';
import { canCreatePersonalRoom, canJoinRoom } from './room-policy-service.js';
import { sanitizePersistentStudyState } from './study-state-sanitizer.js';

function plusMs(iso, ms) { return new Date(Date.parse(iso) + ms).toISOString(); }
function asBool(value) { return Number(value || 0) === 1; }

export class RoomService {
  constructor(env) { this.db = env.DB; }

  async expirePendingDeletes(profileId) {
    const now = new Date().toISOString();
    await this.db.prepare("UPDATE study_spaces SET status='deleted',recovery_expires_at=NULL,updated_at=? WHERE owner_profile_id=? AND space_kind='personal' AND status='deleted_pending' AND recovery_expires_at IS NOT NULL AND recovery_expires_at<=?")
      .bind(now, profileId, now).run();
  }

  async listFor(profile) {
    await this.expirePendingDeletes(profile.id);
    const owned = await this.db.prepare(`
      SELECT id,space_kind AS spaceKind,template_key AS templateKey,title,prompt,category,description,meta_label AS meta,
             visibility,discoverable,status,created_at AS createdAt,updated_at AS updatedAt,recovery_expires_at AS recoveryExpiresAt
      FROM study_spaces
      WHERE owner_profile_id=? AND status IN ('active','deleted_pending')
      ORDER BY CASE space_kind WHEN 'personal' THEN 0 ELSE 1 END, created_at DESC
    `).bind(profile.id).all();
    const joined = await this.db.prepare(`
      SELECT s.id,s.space_kind AS spaceKind,s.template_key AS templateKey,s.title,s.category,s.description,s.meta_label AS meta,
             s.visibility,m.role,m.joined_at AS joinedAt,p.nickname AS ownerNickname
      FROM space_members m
      JOIN study_spaces s ON s.id=m.space_id
      JOIN profiles p ON p.id=s.owner_profile_id
      WHERE m.profile_id=? AND m.status='active' AND s.owner_profile_id<>? AND s.status='active'
      ORDER BY m.joined_at DESC LIMIT 5
    `).bind(profile.id, profile.id).all();
    const quota = await this.db.prepare('SELECT cycle_started_at,next_allowed_at,correction_used,correction_available FROM room_creation_state WHERE profile_id=?')
      .bind(profile.id).first();
    return {
      owned: owned.results || [],
      joined: joined.results || [],
      limits: {
        ownedPersonalMax: profile.role === 'admin' ? null : 1,
        joinedMax: POLICY.maxJoinedRooms,
        nextAllowedAt: quota?.next_allowed_at || null,
        correctionUsed: asBool(quota?.correction_used),
        correctionAvailable: asBool(quota?.correction_available),
      },
    };
  }

  async create(profile, payload) {
    await this.expirePendingDeletes(profile.id);
    const now = new Date().toISOString();
    const prompt = cleanText(payload.prompt || payload.tagPrompt || '', 4000, 'prompt');
    const templateKey = requireEnum(cleanText(payload.templateKey || payload.template_key || 'teach', 32, 'templateKey') || 'teach', ROOM_TEMPLATE_KEYS, 'templateKey');
    const title = cleanText(payload.title || prompt.slice(0, 60) || '나의 학습 행성', 80, 'title');

    // Public/group creation is intentionally unavailable to ordinary members in this release.
    // The initial discovery rooms are first-class DB rooms imported by the one-time bootstrap only.
    const visibility = 'private';
    const spaceKind = 'personal';

    const active = await this.db.prepare("SELECT COUNT(*) AS count FROM study_spaces WHERE owner_profile_id=? AND space_kind='personal' AND status='active'")
      .bind(profile.id).first();
    const quota = await this.db.prepare('SELECT * FROM room_creation_state WHERE profile_id=? LIMIT 1').bind(profile.id).first();
    const adminRecent = profile.role === 'admin'
      ? await this.db.prepare('SELECT COUNT(*) AS count FROM room_creation_events WHERE profile_id=? AND created_at>?')
        .bind(profile.id, new Date(Date.now() - POLICY.adminRoomWindowMs).toISOString()).first()
      : { count: 0 };

    const decision = canCreatePersonalRoom({
      role: profile.role,
      activeOwnedCount: Number(active?.count || 0),
      quota,
      nowMs: Date.now(),
      adminRecentCount: Number(adminRecent?.count || 0),
    });

    if (!decision.allowed) {
      const messages = {
        ACTIVE_PERSONAL_ROOM_EXISTS: '현재 운영 중인 개인 스터디룸이 있습니다.',
        ROOM_CREATION_COOLDOWN: '개인 스터디룸은 3일에 한 번 만들 수 있습니다.',
        ADMIN_ROOM_DAILY_LIMIT: '관리자는 24시간 동안 최대 3개의 룸을 만들 수 있습니다.',
      };
      const status = decision.code === 'ACTIVE_PERSONAL_ROOM_EXISTS' ? 409 : 429;
      throw new HttpError(status, decision.code, messages[decision.code] || '룸을 만들 수 없습니다.', {
        nextAllowedAt: decision.nextAllowedAt || quota?.next_allowed_at || null,
      });
    }

    const id = crypto.randomUUID();
    const cycleId = decision.mode === 'correction' && quota?.cycle_id ? quota.cycle_id : crypto.randomUUID();
    const statements = [
      this.db.prepare("INSERT INTO study_spaces (id,owner_profile_id,space_kind,template_key,title,prompt,visibility,discoverable,status,creation_cycle_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'private',0,'active',?,?,?)")
        .bind(id, profile.id, spaceKind, templateKey, title, prompt, cycleId, now, now),
      this.db.prepare("INSERT INTO space_members (space_id,profile_id,role,status,joined_at,updated_at) VALUES (?,?,'owner','active',?,?)")
        .bind(id, profile.id, now, now),
      this.db.prepare('INSERT INTO room_creation_events (id,profile_id,space_id,event_type,created_at) VALUES (?,?,?,?,?)')
        .bind(crypto.randomUUID(), profile.id, id, decision.mode === 'correction' ? 'correction_create' : 'create', now),
    ];

    if (profile.role !== 'admin') {
      if (decision.mode === 'correction') {
        statements.push(this.db.prepare('UPDATE room_creation_state SET correction_used=1,correction_available=0,last_space_id=?,updated_at=? WHERE profile_id=?')
          .bind(id, now, profile.id));
      } else {
        statements.push(this.db.prepare('INSERT INTO room_creation_state (profile_id,cycle_id,cycle_started_at,next_allowed_at,correction_used,correction_available,last_space_id,updated_at) VALUES (?,?,?,?,0,0,?,?) ON CONFLICT(profile_id) DO UPDATE SET cycle_id=excluded.cycle_id,cycle_started_at=excluded.cycle_started_at,next_allowed_at=excluded.next_allowed_at,correction_used=0,correction_available=0,last_space_id=excluded.last_space_id,updated_at=excluded.updated_at')
          .bind(profile.id, cycleId, now, plusMs(now, POLICY.personalRoomCooldownMs), id, now));
      }
    }

    try {
      await this.db.batch(statements);
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('ROOM_CREATION_COOLDOWN')) throw new HttpError(429, 'ROOM_CREATION_COOLDOWN', '개인 스터디룸은 3일에 한 번 만들 수 있습니다.', { nextAllowedAt: quota?.next_allowed_at || null });
      if (message.includes('CORRECTION_ALREADY_USED')) throw new HttpError(409, 'CORRECTION_ALREADY_USED', '이번 생성 주기의 정정 기회를 이미 사용했습니다.');
      if (message.includes('ADMIN_ROOM_DAILY_LIMIT')) throw new HttpError(429, 'ADMIN_ROOM_DAILY_LIMIT', '관리자는 24시간 동안 최대 3개의 룸을 만들 수 있습니다.');
      if (message.includes('USER_ACTIVE_ROOM_LIMIT') || message.includes('UNIQUE')) throw new HttpError(409, 'ROOM_CONFLICT', '동시에 다른 룸이 생성되었습니다. 새로고침 후 확인해 주세요.');
      throw error;
    }

    return { id, spaceKind, templateKey, title, prompt, visibility, status: 'active', createdAt: now, creationMode: decision.mode };
  }

  async getOwnedRoom(profile, id) {
    const room = await this.db.prepare('SELECT * FROM study_spaces WHERE id=? AND owner_profile_id=? LIMIT 1').bind(id, profile.id).first();
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', '스터디룸을 찾을 수 없습니다.');
    return room;
  }

  async delete(profile, id, reason = 'normal') {
    requireEnum(reason, ['normal', 'accidental', 'wrong_room'], 'reason');
    const room = await this.getOwnedRoom(profile, id);
    const personal = room.space_kind === 'personal';
    if (!personal && reason !== 'normal') throw new HttpError(400, 'PERSONAL_ROOM_ONLY_ACTION', '복구/정정 기능은 개인룸에만 적용됩니다.');
    const canResolvePending = room.status === 'deleted_pending' && (reason === 'normal' || reason === 'wrong_room');
    if (room.status !== 'active' && !canResolvePending) throw new HttpError(409, 'ROOM_NOT_ACTIVE', '삭제할 수 있는 상태의 룸이 아닙니다.');

    const now = new Date().toISOString();
    if (reason === 'accidental') {
      if (room.status !== 'active') throw new HttpError(409, 'ROOM_ALREADY_PENDING_DELETE', '이미 삭제 확인 중인 룸입니다.');
      const expires = plusMs(now, POLICY.accidentalRecoveryMs);
      await this.db.prepare("UPDATE study_spaces SET status='deleted_pending',deleted_at=?,recovery_expires_at=?,updated_at=? WHERE id=? AND owner_profile_id=?")
        .bind(now, expires, now, id, profile.id).run();
      return { id, status: 'deleted_pending', recoveryExpiresAt: expires, canRestore: true };
    }

    if (reason === 'wrong_room' && profile.role !== 'admin') {
      const ageMs = Date.now() - Date.parse(room.created_at);
      const external = await this.db.prepare("SELECT COUNT(*) AS count FROM space_members WHERE space_id=? AND profile_id<>? AND status='active'").bind(id, profile.id).first();
      const usage = await this.db.prepare('SELECT COUNT(*) AS count FROM ai_usage_events WHERE space_id=?').bind(id).first();
      const quota = await this.db.prepare('SELECT * FROM room_creation_state WHERE profile_id=?').bind(profile.id).first();
      if (ageMs > POLICY.correctionWindowMs || Number(external?.count || 0) > 0 || Number(usage?.count || 0) > 5 || asBool(quota?.correction_used)) {
        throw new HttpError(409, 'CORRECTION_NOT_AVAILABLE', '이 룸은 1회 정정 조건을 충족하지 않습니다.');
      }
      await this.db.batch([
        this.db.prepare("UPDATE study_spaces SET status='deleted',deleted_at=?,recovery_expires_at=NULL,updated_at=? WHERE id=? AND owner_profile_id=?").bind(now, now, id, profile.id),
        this.db.prepare('UPDATE room_creation_state SET correction_available=1,last_space_id=?,updated_at=? WHERE profile_id=? AND correction_used=0').bind(id, now, profile.id),
      ]);
      return { id, status: 'deleted', correctionAvailable: true, nextAllowedAt: quota?.next_allowed_at || null };
    }

    await this.db.prepare("UPDATE study_spaces SET status='deleted',deleted_at=?,recovery_expires_at=NULL,updated_at=? WHERE id=? AND owner_profile_id=?")
      .bind(now, now, id, profile.id).run();
    return { id, status: 'deleted', correctionAvailable: false };
  }

  async restore(profile, id) {
    const room = await this.getOwnedRoom(profile, id);
    if (room.space_kind !== 'personal') throw new HttpError(400, 'PERSONAL_ROOM_ONLY_ACTION', '복구 기능은 개인룸에만 적용됩니다.');
    if (room.status !== 'deleted_pending') throw new HttpError(409, 'ROOM_NOT_RECOVERABLE', '복구할 수 있는 상태가 아닙니다.');
    if (!room.recovery_expires_at || Date.now() > Date.parse(room.recovery_expires_at)) {
      await this.db.prepare("UPDATE study_spaces SET status='deleted',recovery_expires_at=NULL,updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
      throw new HttpError(410, 'RECOVERY_EXPIRED', '실수 삭제 복구 시간이 지났습니다.');
    }
    if (profile.role !== 'admin') {
      const active = await this.db.prepare("SELECT COUNT(*) AS count FROM study_spaces WHERE owner_profile_id=? AND space_kind='personal' AND status='active'").bind(profile.id).first();
      if (Number(active?.count || 0) > 0) throw new HttpError(409, 'ACTIVE_PERSONAL_ROOM_EXISTS', '이미 활성 개인룸이 있어 복구할 수 없습니다.');
    }
    const now = new Date().toISOString();
    await this.db.prepare("UPDATE study_spaces SET status='active',deleted_at=NULL,recovery_expires_at=NULL,updated_at=? WHERE id=? AND owner_profile_id=?")
      .bind(now, id, profile.id).run();
    return { id, status: 'active', restored: true };
  }

  async join(profile, id) {
    const room = await this.db.prepare('SELECT id,owner_profile_id,status,visibility FROM study_spaces WHERE id=? LIMIT 1').bind(id).first();
    if (!room || room.status !== 'active') throw new HttpError(404, 'ROOM_NOT_FOUND', '참여할 수 있는 스터디룸을 찾을 수 없습니다.');
    if (room.visibility === 'private' && room.owner_profile_id !== profile.id) throw new HttpError(403, 'PRIVATE_ROOM_NOT_JOINABLE', '개인룸에는 다른 사용자가 참여할 수 없습니다.');

    const existing = await this.db.prepare('SELECT status FROM space_members WHERE space_id=? AND profile_id=? LIMIT 1').bind(id, profile.id).first();
    if (existing?.status === 'kicked' || existing?.status === 'banned') throw new HttpError(403, 'ROOM_REJOIN_BLOCKED', '방장 또는 운영자에 의해 재가입이 제한된 스터디입니다.');

    const count = await this.db.prepare("SELECT COUNT(*) AS count FROM space_members m JOIN study_spaces s ON s.id=m.space_id WHERE m.profile_id=? AND m.status='active' AND s.owner_profile_id<>?").bind(profile.id, profile.id).first();
    const decision = canJoinRoom({ joinedCount: Number(count?.count || 0), isOwner: room.owner_profile_id === profile.id, alreadyMember: existing?.status === 'active' });
    if (!decision.allowed) throw new HttpError(409, decision.code, decision.code === 'JOINED_ROOM_LIMIT' ? '참여 가능한 스터디 5개를 모두 사용하고 있습니다.' : '이미 이 공간에 접근할 수 있습니다.');
    if (decision.mode === 'existing') return { joined: true, existing: true };

    const now = new Date().toISOString();
    try {
      await this.db.prepare("INSERT INTO space_members (space_id,profile_id,role,status,joined_at,updated_at) VALUES (?,?,'member','active',?,?) ON CONFLICT(space_id,profile_id) DO UPDATE SET status='active',role='member',joined_at=excluded.joined_at,updated_at=excluded.updated_at,kicked_at=NULL")
        .bind(id, profile.id, now, now).run();
    } catch (error) {
      if (String(error?.message || '').includes('JOINED_ROOM_LIMIT')) throw new HttpError(409, 'JOINED_ROOM_LIMIT', '참여 가능한 스터디 5개를 모두 사용하고 있습니다.');
      throw error;
    }
    return { joined: true, existing: false };
  }

  async leave(profile, id) {
    const room = await this.db.prepare('SELECT owner_profile_id FROM study_spaces WHERE id=? LIMIT 1').bind(id).first();
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', '스터디룸을 찾을 수 없습니다.');
    if (room.owner_profile_id === profile.id) throw new HttpError(400, 'OWNER_CANNOT_LEAVE', '방장은 자신의 룸에서 탈퇴할 수 없습니다. 룸 종료 또는 삭제 기능을 사용해 주세요.');
    const now = new Date().toISOString();
    const result = await this.db.prepare("UPDATE space_members SET status='left',updated_at=? WHERE space_id=? AND profile_id=? AND status='active'").bind(now, id, profile.id).run();
    if (!result.meta?.changes) throw new HttpError(404, 'MEMBERSHIP_NOT_FOUND', '활성 참여 기록을 찾을 수 없습니다.');
    return { left: true, id };
  }

  async kick(profile, id, memberId) {
    const room = await this.getOwnedRoom(profile, id);
    if (memberId === room.owner_profile_id) throw new HttpError(400, 'OWNER_CANNOT_BE_KICKED', '방장은 강퇴할 수 없습니다.');
    const now = new Date().toISOString();
    const result = await this.db.prepare("UPDATE space_members SET status='kicked',kicked_at=?,updated_at=? WHERE space_id=? AND profile_id=? AND status='active'").bind(now, now, id, memberId).run();
    if (!result.meta?.changes) throw new HttpError(404, 'MEMBER_NOT_FOUND', '활성 멤버를 찾을 수 없습니다.');
    return { kicked: true, memberId };
  }

  async assertRoomAccess(profile, id) {
    const access = await this.db.prepare("SELECT s.id,s.owner_profile_id,m.role FROM study_spaces s LEFT JOIN space_members m ON m.space_id=s.id AND m.profile_id=? WHERE s.id=? AND s.status='active' AND (s.owner_profile_id=? OR m.status='active') LIMIT 1")
      .bind(profile.id, id, profile.id).first();
    if (!access) throw new HttpError(403, 'ROOM_ACCESS_DENIED', '이 스터디룸에 접근할 권한이 없습니다.');
    return access;
  }

  async getState(profile, id) {
    await this.assertRoomAccess(profile, id);
    const row = await this.db.prepare('SELECT schema_json,context_json,workspace_json,updated_at FROM space_state WHERE space_id=? AND profile_id=? LIMIT 1').bind(id, profile.id).first();
    if (!row) return { schema: null, context: null, workspace: null, updatedAt: null };
    return { schema: JSON.parse(row.schema_json || 'null'), context: JSON.parse(row.context_json || 'null'), workspace: JSON.parse(row.workspace_json || 'null'), updatedAt: row.updated_at };
  }

  async putState(profile, id, payload) {
    await this.assertRoomAccess(profile, id);
    const now = new Date().toISOString();
    const sanitized = sanitizePersistentStudyState(payload);
    const schema = safeJson(sanitized.schema, 30000);
    const context = safeJson(sanitized.context, 30000);
    const workspace = safeJson(sanitized.workspace, 100000);
    await this.db.prepare('INSERT INTO space_state (space_id,profile_id,schema_json,context_json,workspace_json,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(space_id,profile_id) DO UPDATE SET schema_json=excluded.schema_json,context_json=excluded.context_json,workspace_json=excluded.workspace_json,updated_at=excluded.updated_at')
      .bind(id, profile.id, schema, context, workspace, now).run();
    return { saved: true, updatedAt: now };
  }

  async getRules(profile, id) {
    await this.assertRoomAccess(profile, id);
    const row = await this.db.prepare('SELECT rules_json,updated_at FROM space_rules WHERE space_id=? LIMIT 1').bind(id).first();
    return { rules: row ? JSON.parse(row.rules_json) : {}, updatedAt: row?.updated_at || null };
  }

  async putRules(profile, id, rules) {
    await this.getOwnedRoom(profile, id);
    const now = new Date().toISOString();
    const rulesJson = safeJson(rules, 12000);
    await this.db.prepare('INSERT INTO space_rules (space_id,rules_json,updated_at) VALUES (?,?,?) ON CONFLICT(space_id) DO UPDATE SET rules_json=excluded.rules_json,updated_at=excluded.updated_at')
      .bind(id, rulesJson, now).run();
    return { saved: true, updatedAt: now };
  }
}
