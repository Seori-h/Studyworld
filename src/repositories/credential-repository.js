export class CredentialRepository {
  constructor(db) { this.db = db; }

  findProfileByActiveDigest(digest) {
    return this.db.prepare(`
      SELECT p.id,p.nickname,p.nickname_key,p.public_code,p.visual_seed,p.role,p.account_origin,p.status,p.created_at,
             c.id AS credential_id,c.key_version,c.issued_at,c.last_used_at
      FROM planet_credentials c
      JOIN profiles p ON p.id=c.profile_id
      WHERE c.key_digest=? AND c.status='active' AND p.status='active'
      LIMIT 1
    `).bind(digest).first();
  }

  findActiveByProfile(profileId) {
    return this.db.prepare("SELECT id,profile_id,key_digest,key_version,status,issued_at,last_used_at FROM planet_credentials WHERE profile_id=? AND status='active' LIMIT 1").bind(profileId).first();
  }

  maxVersion(profileId) {
    return this.db.prepare('SELECT COALESCE(MAX(key_version),0) AS version FROM planet_credentials WHERE profile_id=?').bind(profileId).first();
  }

  create({ id, profileId, keyDigest, keyVersion, issuedAt, createdByProfileId = null }) {
    return this.db.prepare("INSERT INTO planet_credentials (id,profile_id,key_digest,key_version,status,issued_at,created_by_profile_id) VALUES (?,?,?,?,'active',?,?)")
      .bind(id, profileId, keyDigest, keyVersion, issuedAt, createdByProfileId)
      .run();
  }

  revokeActive(profileId, now) {
    return this.db.prepare("UPDATE planet_credentials SET status='revoked',revoked_at=?,rotated_at=? WHERE profile_id=? AND status='active'")
      .bind(now, now, profileId)
      .run();
  }

  touch(id, now) {
    return this.db.prepare('UPDATE planet_credentials SET last_used_at=? WHERE id=?').bind(now, id).run();
  }

  replaceDigest(id, digest, now) {
    return this.db.prepare('UPDATE planet_credentials SET key_digest=?,last_used_at=? WHERE id=?').bind(digest, now, id).run();
  }
}
