export class ProfileRepository {
  constructor(db) { this.db = db; }

  findByNicknameKey(key) {
    return this.db.prepare('SELECT id,nickname,nickname_key,public_code,visual_seed,role,account_origin,managed_by_profile_id,status,created_at FROM profiles WHERE nickname_key=? LIMIT 1').bind(key).first();
  }

  findById(id) {
    return this.db.prepare('SELECT id,nickname,nickname_key,public_code,visual_seed,role,account_origin,managed_by_profile_id,status,created_at FROM profiles WHERE id=? LIMIT 1').bind(id).first();
  }

  findPublicById(id) {
    return this.db.prepare("SELECT id,nickname,public_code,role,status,created_at FROM profiles WHERE id=? AND status='active' LIMIT 1").bind(id).first();
  }

  create({ id, nickname, nicknameKey, publicCode, visualSeed, role = 'user', accountOrigin = 'member', managedByProfileId = null, now }) {
    return this.db.prepare("INSERT INTO profiles (id,nickname,nickname_key,public_code,visual_seed,role,account_origin,managed_by_profile_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',?,?)")
      .bind(id, nickname, nicknameKey, publicCode, visualSeed, role, accountOrigin, managedByProfileId, now, now)
      .run();
  }

  updateNickname(id, nickname, nicknameKey, now) {
    return this.db.prepare('UPDATE profiles SET nickname=?,nickname_key=?,updated_at=? WHERE id=?').bind(nickname, nicknameKey, now, id).run();
  }

  updateStatus(id, status, now) {
    return this.db.prepare('UPDATE profiles SET status=?,updated_at=? WHERE id=?').bind(status, now, id).run();
  }
}
