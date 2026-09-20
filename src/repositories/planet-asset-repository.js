export class PlanetAssetRepository {
  constructor(db) { this.db = db; }

  findCurrent(profileId) {
    return this.db.prepare("SELECT id,profile_id,r2_object_key,content_type,visibility,sha256,source,created_at,updated_at FROM planet_assets WHERE profile_id=? AND kind='planet_art' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
      .bind(profileId).first();
  }

  upsertGenerated({ id, profileId, objectKey, contentType, visibility = 'public', sha256, now }) {
    return this.db.prepare(`
      INSERT INTO planet_assets (id,profile_id,kind,r2_object_key,content_type,visibility,sha256,source,created_at,updated_at)
      VALUES (?,?,'planet_art',?,?,?,?, 'generated',?,?)
      ON CONFLICT(r2_object_key) DO UPDATE SET sha256=excluded.sha256,updated_at=excluded.updated_at,deleted_at=NULL
    `).bind(id, profileId, objectKey, contentType, visibility, sha256, now, now).run();
  }
}
