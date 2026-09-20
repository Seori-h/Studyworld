import { HttpError } from '../lib/http.js';
import { cleanText, requireEnum, validateNickname, nicknameKey } from '../lib/validation.js';
import { ProfileRepository } from '../repositories/profile-repository.js';
import { PlanetKeyService } from './planet-key-service.js';
import { PlanetArtService } from './planet-art-service.js';

export class AdminService {
  constructor(env) {
    this.env = env;
    this.db = env.DB;
    this.profiles = new ProfileRepository(env.DB);
    this.keys = new PlanetKeyService(env);
    this.art = new PlanetArtService(env);
  }

  async listManaged(admin) {
    const profileRows = await this.db.prepare(`
      SELECT p.id,p.nickname,p.public_code,p.role,p.account_origin,p.status,p.created_at,
             c.key_version,c.issued_at,c.last_used_at
      FROM profiles p
      LEFT JOIN planet_credentials c ON c.profile_id=p.id AND c.status='active'
      WHERE p.managed_by_profile_id=? AND p.account_origin='managed_seed'
      ORDER BY p.nickname COLLATE NOCASE
    `).bind(admin.id).all();
    const roomRows = await this.db.prepare(`
      SELECT s.id,s.owner_profile_id,s.title,s.category,s.description,s.meta_label,s.template_key,s.visibility,s.discoverable,s.status,s.visit_count
      FROM study_spaces s
      JOIN profiles p ON p.id=s.owner_profile_id
      WHERE p.managed_by_profile_id=? AND p.account_origin='managed_seed'
      ORDER BY s.category,s.created_at DESC
    `).bind(admin.id).all();
    const byOwner = new Map();
    for (const room of roomRows.results || []) {
      if (!byOwner.has(room.owner_profile_id)) byOwner.set(room.owner_profile_id, []);
      byOwner.get(room.owner_profile_id).push({
        id: room.id,
        title: room.title,
        category: room.category,
        description: room.description,
        meta: room.meta_label,
        templateKey: room.template_key,
        visibility: room.visibility,
        discoverable: Number(room.discoverable) === 1,
        status: room.status,
        visits: room.visit_count,
      });
    }
    return (profileRows.results || []).map((row) => ({
      id: row.id,
      nickname: row.nickname,
      publicCode: row.public_code,
      status: row.status,
      credentialVersion: row.key_version || null,
      credentialIssuedAt: row.issued_at || null,
      credentialLastUsedAt: row.last_used_at || null,
      planetImageUrl: `/media/planets/${row.public_code}/planet.svg`,
      rooms: byOwner.get(row.id) || [],
    }));
  }

  async getManaged(admin, profileId) {
    const profile = await this.db.prepare("SELECT * FROM profiles WHERE id=? AND managed_by_profile_id=? AND account_origin='managed_seed' LIMIT 1")
      .bind(profileId, admin.id).first();
    if (!profile) throw new HttpError(404, 'MANAGED_PROFILE_NOT_FOUND', '관리 중인 초기 사용자를 찾을 수 없습니다.');
    return profile;
  }

  async updateManagedProfile(admin, profileId, payload) {
    const profile = await this.getManaged(admin, profileId);
    const now = new Date().toISOString();
    const statements = [];
    let nickname = profile.nickname;
    if (payload.nickname !== undefined) {
      nickname = validateNickname(payload.nickname);
      const normalized = nicknameKey(nickname);
      const conflict = await this.profiles.findByNicknameKey(normalized);
      if (conflict && conflict.id !== profile.id) throw new HttpError(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임입니다.');
      statements.push(this.db.prepare('UPDATE profiles SET nickname=?,nickname_key=?,updated_at=? WHERE id=?').bind(nickname, normalized, now, profile.id));
      statements.push(this.db.prepare('UPDATE community_posts SET author=? WHERE author_profile_id=?').bind(nickname, profile.id));
      statements.push(this.db.prepare('UPDATE community_comments SET author=? WHERE author_profile_id=?').bind(nickname, profile.id));
    }
    if (payload.status !== undefined) {
      const status = requireEnum(String(payload.status), ['active', 'suspended'], 'status');
      statements.push(this.db.prepare('UPDATE profiles SET status=?,updated_at=? WHERE id=?').bind(status, now, profile.id));
      if (status === 'suspended') statements.push(this.db.prepare('DELETE FROM sessions WHERE profile_id=?').bind(profile.id));
    }
    if (statements.length) await this.db.batch(statements);
    const updated = await this.profiles.findById(profile.id);
    if (payload.nickname !== undefined) await this.art.regenerate(updated, now);
    return { id: updated.id, nickname: updated.nickname, publicCode: updated.public_code, status: updated.status, planetImageUrl: `/media/planets/${updated.public_code}/planet.svg` };
  }

  async rotateManagedKey(admin, profileId) {
    const profile = await this.getManaged(admin, profileId);
    const result = await this.keys.rotateForProfile(profile, admin, { createSession: false });
    return {
      profile: { id: profile.id, nickname: profile.nickname, publicCode: profile.public_code },
      planetKey: result.planetKey,
      credentialVersion: result.credentialVersion,
      issuedAt: result.issuedAt,
      warning: '새 열쇠는 이번 응답에서만 확인할 수 있습니다. 이전 열쇠와 기존 세션은 즉시 폐기되었습니다.',
    };
  }

  async updateSpace(admin, spaceId, payload) {
    const room = await this.db.prepare(`
      SELECT s.*,p.managed_by_profile_id,p.account_origin
      FROM study_spaces s JOIN profiles p ON p.id=s.owner_profile_id
      WHERE s.id=? LIMIT 1
    `).bind(spaceId).first();
    if (!room || room.account_origin !== 'managed_seed' || room.managed_by_profile_id !== admin.id) {
      throw new HttpError(404, 'MANAGED_ROOM_NOT_FOUND', '관리 중인 초기 스터디룸을 찾을 수 없습니다.');
    }
    const title = payload.title === undefined ? room.title : cleanText(payload.title, 80, 'title');
    const category = payload.category === undefined ? room.category : cleanText(payload.category, 40, 'category');
    const description = payload.description === undefined ? room.description : cleanText(payload.description, 500, 'description');
    const meta = payload.meta === undefined ? room.meta_label : cleanText(payload.meta, 80, 'meta');
    const templateKey = payload.templateKey === undefined ? room.template_key : requireEnum(String(payload.templateKey), ['paper','coding','language','teach','exam','memory','essay'], 'templateKey');
    const discoverable = payload.discoverable === undefined ? Number(room.discoverable) : (payload.discoverable ? 1 : 0);
    const status = payload.status === undefined ? room.status : requireEnum(String(payload.status), ['active','closed','suspended'], 'status');
    const now = new Date().toISOString();
    await this.db.prepare('UPDATE study_spaces SET title=?,category=?,description=?,prompt=?,meta_label=?,template_key=?,discoverable=?,status=?,updated_at=? WHERE id=?')
      .bind(title, category, description, description, meta, templateKey, discoverable, status, now, spaceId).run();
    return { id: spaceId, title, category, description, meta, templateKey, discoverable: Boolean(discoverable), status };
  }

  async transferSpace(admin, spaceId, newOwnerProfileId) {
    const room = await this.db.prepare(`
      SELECT s.id,s.owner_profile_id,p.managed_by_profile_id,p.account_origin
      FROM study_spaces s JOIN profiles p ON p.id=s.owner_profile_id WHERE s.id=? LIMIT 1
    `).bind(spaceId).first();
    if (!room || room.account_origin !== 'managed_seed' || room.managed_by_profile_id !== admin.id) {
      throw new HttpError(404, 'MANAGED_ROOM_NOT_FOUND', '관리 중인 초기 스터디룸을 찾을 수 없습니다.');
    }
    const newOwner = await this.profiles.findById(newOwnerProfileId);
    if (!newOwner || newOwner.status !== 'active') throw new HttpError(404, 'NEW_OWNER_NOT_FOUND', '새 방장 사용자를 찾을 수 없습니다.');
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("UPDATE space_members SET role='member',status='left',updated_at=? WHERE space_id=? AND profile_id=?").bind(now, spaceId, room.owner_profile_id),
      this.db.prepare("INSERT INTO space_members (space_id,profile_id,role,status,joined_at,updated_at) VALUES (?,?,'owner','active',?,?) ON CONFLICT(space_id,profile_id) DO UPDATE SET role='owner',status='active',joined_at=excluded.joined_at,updated_at=excluded.updated_at,kicked_at=NULL")
        .bind(spaceId, newOwnerProfileId, now, now),
      this.db.prepare('UPDATE study_spaces SET owner_profile_id=?,updated_at=? WHERE id=?').bind(newOwnerProfileId, now, spaceId),
    ]);
    return { transferred: true, spaceId, previousOwnerProfileId: room.owner_profile_id, newOwnerProfileId };
  }
}
