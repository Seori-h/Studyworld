import { HttpError } from '../lib/http.js';

const SORT_SQL = Object.freeze({
  recent: 's.created_at DESC',
  recommend: 's.recommend_score DESC, s.popular_score DESC, s.created_at DESC',
  popular: 's.popular_score DESC, s.visit_count DESC, s.created_at DESC',
  visits: 's.visit_count DESC, s.created_at DESC',
});

export class DiscoveryService {
  constructor(env) { this.db = env.DB; }

  async list(category = '', sort = 'recent') {
    const order = SORT_SQL[sort] || SORT_SQL.recent;
    const categoryValue = String(category || '').trim();
    const whereCategory = categoryValue && categoryValue !== '전체' ? ' AND s.category=?' : '';
    const stmt = this.db.prepare(`
      SELECT s.id,s.template_key,s.title,s.category,s.description,s.meta_label,s.recommend_score,s.popular_score,
             s.visit_count,s.created_at,p.nickname AS owner_nickname,p.public_code AS owner_public_code
      FROM study_spaces s
      JOIN profiles p ON p.id=s.owner_profile_id
      WHERE s.status='active' AND s.discoverable=1 AND s.visibility IN ('group','class') AND p.status='active'${whereCategory}
      ORDER BY ${order}
      LIMIT 200
    `);
    const result = categoryValue && categoryValue !== '전체' ? await stmt.bind(categoryValue).all() : await stmt.all();
    return (result.results || []).map((row) => ({
      id: row.id,
      templateKey: row.template_key,
      title: row.title,
      category: row.category,
      description: row.description,
      meta: row.meta_label,
      recommend: row.recommend_score,
      popular: row.popular_score,
      visits: row.visit_count,
      createdAt: String(row.created_at).slice(0, 10),
      owner: {
        nickname: row.owner_nickname,
        publicCode: row.owner_public_code,
        planetImageUrl: `/media/planets/${row.owner_public_code}/planet.svg`,
      },
    }));
  }

  async recordVisit(id) {
    const now = new Date().toISOString();
    const result = await this.db.prepare("UPDATE study_spaces SET visit_count=visit_count+1,updated_at=? WHERE id=? AND status='active' AND discoverable=1")
      .bind(now, id).run();
    if (!result.meta?.changes) throw new HttpError(404, 'ROOM_NOT_FOUND', '공개 스터디룸을 찾을 수 없습니다.');
    return { visited: true };
  }
}
