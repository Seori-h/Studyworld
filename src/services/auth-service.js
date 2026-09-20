import { POLICY } from '../config.js';
import { HttpError, getCookie, setSessionCookie, SESSION_COOKIE_NAME } from '../lib/http.js';
import { generateOpaqueToken, hmacDigest } from '../lib/security.js';
import { SessionRepository } from '../repositories/session-repository.js';

function isoAfter(seconds) { return new Date(Date.now() + seconds * 1000).toISOString(); }

export class AuthService {
  constructor(env) {
    this.env = env;
    this.sessions = new SessionRepository(env.DB);
  }

  async createSession(profileId) {
    const token = generateOpaqueToken();
    const digest = await hmacDigest(this.env.SESSION_PEPPER, `session:${token}`);
    const now = new Date().toISOString();
    await this.sessions.create({ digest, profileId, expiresAt: isoAfter(POLICY.sessionTtlSeconds), now });
    return { token, cookie: setSessionCookie(token, POLICY.sessionTtlSeconds) };
  }

  async optionalProfile(request) {
    const token = getCookie(request, SESSION_COOKIE_NAME);
    if (!token) return null;
    const digest = await hmacDigest(this.env.SESSION_PEPPER, `session:${token}`);
    const now = new Date().toISOString();
    const row = await this.sessions.findActive(digest, now);
    if (!row) return null;
    await this.sessions.touch(digest, now).catch(() => {});
    return {
      id: row.profile_id,
      nickname: row.nickname,
      publicCode: row.public_code,
      role: row.role,
      accountOrigin: row.account_origin,
      planetImageUrl: row.public_code ? `/media/planets/${row.public_code}/planet.svg` : null,
    };
  }

  async requireProfile(request) {
    const profile = await this.optionalProfile(request);
    if (!profile) throw new HttpError(401, 'AUTH_REQUIRED', '행성 열쇠로 연결해 주세요.');
    return profile;
  }

  async requireAdmin(request) {
    const profile = await this.requireProfile(request);
    if (profile.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', '관리자 권한이 필요합니다.');
    return profile;
  }

  async logout(request) {
    const token = getCookie(request, SESSION_COOKIE_NAME);
    if (!token) return;
    const digest = await hmacDigest(this.env.SESSION_PEPPER, `session:${token}`);
    await this.sessions.delete(digest);
  }
}
