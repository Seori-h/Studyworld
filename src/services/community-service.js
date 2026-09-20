import { HttpError } from '../lib/http.js';
import { cleanText } from '../lib/validation.js';

function parseTags(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

export class CommunityService {
  constructor(env) { this.db = env.DB; }

  async list(board = 'all', sort = 'new') {
    const safeBoard = ['all', 'cert', 'qa', 'share'].includes(board) ? board : 'all';
    const order = sort === 'popular' ? 'likes DESC, created_at DESC' : 'created_at DESC';
    const where = safeBoard === 'all' ? '' : 'WHERE board=?';
    const statement = this.db.prepare(`SELECT id,board,title,body,author,created_at AS createdAt,views,likes,image_url AS image,tags_json AS tags,status,comment_count AS commentCount FROM community_posts ${where} ORDER BY ${order} LIMIT 100`);
    const rows = safeBoard === 'all' ? await statement.all() : await statement.bind(safeBoard).all();
    return { items: (rows.results || []).map((row) => ({ ...row, tags: parseTags(row.tags) })) };
  }

  async get(id) {
    const row = await this.db.prepare('SELECT id,board,title,body,author,created_at AS createdAt,views,likes,image_url AS image,tags_json AS tags,status,comment_count AS commentCount FROM community_posts WHERE id=? LIMIT 1').bind(id).first();
    if (!row) throw new HttpError(404, 'POST_NOT_FOUND', '게시물을 찾을 수 없습니다.');
    await this.db.prepare('UPDATE community_posts SET views=views+1 WHERE id=?').bind(id).run();
    return { ...row, views: Number(row.views || 0) + 1, tags: parseTags(row.tags) };
  }

  async create(profile, payload) {
    const board = ['cert', 'qa', 'share'].includes(payload.board) ? payload.board : 'qa';
    const title = cleanText(payload.title, 120, 'title');
    const body = cleanText(payload.body, 5000, 'body');
    if (!title || !body) throw new HttpError(400, 'POST_REQUIRED_FIELDS', '제목과 내용을 입력해 주세요.');

    const tags = Array.isArray(payload.tags) ? payload.tags.slice(0, 8).map((item) => cleanText(item, 24, 'tag')).filter(Boolean) : [];
    const image = cleanText(payload.image || '', 500, 'image');
    if (image && !image.startsWith(`/media/community/${profile.id}/`)) {
      throw new HttpError(400, 'INVALID_IMAGE_URL', '본인이 업로드한 이미지만 게시물에 첨부할 수 있습니다.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = board === 'qa' ? 'waiting' : '';
    await this.db.prepare("INSERT INTO community_posts (id,board,title,body,author_profile_id,author,created_at,views,likes,image_url,tags_json,status,comment_count) VALUES (?,?,?,?,?,?,?,0,0,?,?,?,0)")
      .bind(id, board, title, body, profile.id, profile.nickname, now, image, JSON.stringify(tags), status)
      .run();
    return { id, board, title, body, author: profile.nickname, createdAt: now, views: 0, likes: 0, image, tags, status, commentCount: 0 };
  }

  async comments(postId) {
    const exists = await this.db.prepare('SELECT id FROM community_posts WHERE id=? LIMIT 1').bind(postId).first();
    if (!exists) throw new HttpError(404, 'POST_NOT_FOUND', '게시물을 찾을 수 없습니다.');
    const rows = await this.db.prepare('SELECT id,author,body,created_at AS createdAt FROM community_comments WHERE post_id=? ORDER BY created_at ASC LIMIT 200').bind(postId).all();
    return { items: rows.results || [] };
  }

  async comment(profile, postId, payload) {
    const exists = await this.db.prepare('SELECT id FROM community_posts WHERE id=? LIMIT 1').bind(postId).first();
    if (!exists) throw new HttpError(404, 'POST_NOT_FOUND', '게시물을 찾을 수 없습니다.');
    const body = cleanText(payload.body || payload.text || '', 2000, 'comment');
    if (!body) throw new HttpError(400, 'COMMENT_REQUIRED', '댓글 내용을 입력해 주세요.');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare('INSERT INTO community_comments (id,post_id,author_profile_id,author,body,created_at) VALUES (?,?,?,?,?,?)').bind(id, postId, profile.id, profile.nickname, body, now),
      this.db.prepare('UPDATE community_posts SET comment_count=comment_count+1 WHERE id=?').bind(postId),
    ]);
    return { id, postId, author: profile.nickname, body, createdAt: now };
  }
}
