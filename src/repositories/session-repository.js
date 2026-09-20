import { POLICY } from '../config.js';

export class SessionRepository {
  constructor(db) { this.db = db; }

  async create({ digest, profileId, expiresAt, now }) {
    await this.db.batch([
      this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
      this.db.prepare('INSERT INTO sessions (session_digest,profile_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)')
        .bind(digest, profileId, expiresAt, now, now),
      this.db.prepare('DELETE FROM sessions WHERE profile_id=? AND session_digest NOT IN (SELECT session_digest FROM sessions WHERE profile_id=? ORDER BY created_at DESC LIMIT ?)')
        .bind(profileId, profileId, POLICY.maxActiveSessionsPerProfile),
    ]);
  }

  findActive(digest, now) {
    return this.db.prepare("SELECT s.session_digest,s.profile_id,s.expires_at,p.nickname,p.public_code,p.role,p.account_origin,p.status FROM sessions s JOIN profiles p ON p.id=s.profile_id WHERE s.session_digest=? AND s.expires_at>? AND p.status='active' LIMIT 1")
      .bind(digest, now)
      .first();
  }

  touch(digest, now) {
    return this.db.prepare('UPDATE sessions SET last_seen_at=? WHERE session_digest=? AND last_seen_at<?')
      .bind(now, digest, new Date(Date.parse(now) - 15 * 60 * 1000).toISOString())
      .run();
  }

  delete(digest) {
    return this.db.prepare('DELETE FROM sessions WHERE session_digest=?').bind(digest).run();
  }

  deleteForProfile(profileId) {
    return this.db.prepare('DELETE FROM sessions WHERE profile_id=?').bind(profileId).run();
  }
}
