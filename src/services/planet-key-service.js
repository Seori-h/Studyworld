import { HttpError } from '../lib/http.js';
import {
  generatePlanetKey,
  generatePublicPlanetCode,
  generateVisualSeed,
  hmacDigest,
  isValidPlanetKey,
  maskPlanetKey,
  normalizePlanetKey,
} from '../lib/security.js';
import { nicknameKey, validateNickname } from '../lib/validation.js';
import { ProfileRepository } from '../repositories/profile-repository.js';
import { CredentialRepository } from '../repositories/credential-repository.js';
import { AuthService } from './auth-service.js';
import { PlanetArtService } from './planet-art-service.js';

export class PlanetKeyService {
  constructor(env) {
    this.env = env;
    this.profiles = new ProfileRepository(env.DB);
    this.credentials = new CredentialRepository(env.DB);
    this.auth = new AuthService(env);
    this.art = new PlanetArtService(env);
  }

  async nicknameAvailability(raw) {
    let nickname;
    try { nickname = validateNickname(raw); } catch (error) { return { available: false, reason: error.message }; }
    const existing = await this.profiles.findByNicknameKey(nicknameKey(nickname));
    return existing
      ? { available: false, reason: '이미 사용 중인 닉네임입니다.' }
      : { available: true, reason: '사용 가능한 닉네임입니다.' };
  }

  async issue(raw) {
    const nickname = validateNickname(raw);
    const normalizedNickname = nicknameKey(nickname);
    if (await this.profiles.findByNicknameKey(normalizedNickname)) {
      throw new HttpError(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임입니다.');
    }

    const planetKey = generatePlanetKey();
    const digest = await hmacDigest(this.env.PLANET_KEY_PEPPER, `planet:${normalizePlanetKey(planetKey)}`);
    const profileId = crypto.randomUUID();
    const credentialId = crypto.randomUUID();
    const publicCode = generatePublicPlanetCode();
    const visualSeed = generateVisualSeed();
    const now = new Date().toISOString();

    try {
      await this.env.DB.batch([
        this.env.DB.prepare("INSERT INTO profiles (id,nickname,nickname_key,public_code,visual_seed,role,account_origin,managed_by_profile_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'user','member',NULL,'active',?,?)")
          .bind(profileId, nickname, normalizedNickname, publicCode, visualSeed, now, now),
        this.env.DB.prepare("INSERT INTO planet_credentials (id,profile_id,key_digest,key_version,status,issued_at,created_by_profile_id) VALUES (?,?,?,1,'active',?,NULL)")
          .bind(credentialId, profileId, digest, now),
        this.env.DB.prepare("INSERT INTO planet_credential_events (id,profile_id,credential_id,actor_profile_id,action,context_json,created_at) VALUES (?,?,?,NULL,'issued','{}',?)")
          .bind(crypto.randomUUID(), profileId, credentialId, now),
      ]);
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        throw new HttpError(409, 'PROFILE_CONFLICT', '닉네임 또는 공개 코드가 이미 사용 중입니다. 다시 시도해 주세요.');
      }
      throw error;
    }

    const profile = { id: profileId, nickname, public_code: publicCode, visual_seed: visualSeed, role: 'user', account_origin: 'member', created_at: now };
    const asset = await this.art.ensureGenerated(profile, now).catch(() => null);
    const session = await this.auth.createSession(profileId);
    return {
      profile: this.profileShape(profile, asset),
      planetKey,
      sessionCookie: session.cookie,
    };
  }

  async restore(raw) {
    const planetKey = normalizePlanetKey(raw);
    if (!isValidPlanetKey(planetKey)) throw new HttpError(400, 'INVALID_PLANET_KEY', '행성 열쇠 형식이 올바르지 않습니다.');

    const now = new Date().toISOString();
    const currentDigest = await hmacDigest(this.env.PLANET_KEY_PEPPER, `planet:${planetKey}`);
    let profile = await this.credentials.findProfileByActiveDigest(currentDigest);

    if (!profile && this.env.PLANET_KEY_PEPPER_PREVIOUS) {
      const previousDigest = await hmacDigest(this.env.PLANET_KEY_PEPPER_PREVIOUS, `planet:${planetKey}`);
      profile = await this.credentials.findProfileByActiveDigest(previousDigest);
      if (profile) {
        await this.env.DB.batch([
          this.env.DB.prepare('UPDATE planet_credentials SET key_digest=?,last_used_at=? WHERE id=?').bind(currentDigest, now, profile.credential_id),
          this.env.DB.prepare("INSERT INTO planet_credential_events (id,profile_id,credential_id,actor_profile_id,action,context_json,created_at) VALUES (?,?,?,NULL,'pepper_rehashed','{}',?)")
            .bind(crypto.randomUUID(), profile.id, profile.credential_id, now),
        ]);
      }
    }

    if (!profile) throw new HttpError(404, 'PLANET_KEY_NOT_FOUND', '일치하는 행성 열쇠를 찾지 못했습니다.');
    await this.credentials.touch(profile.credential_id, now).catch(() => {});
    const asset = await this.art.ensureGenerated(profile, now).catch(() => null);
    const session = await this.auth.createSession(profile.id);
    return { profile: this.profileShape(profile, asset), sessionCookie: session.cookie };
  }

  async rotateForProfile(targetProfile, actorProfile = targetProfile, { createSession = false } = {}) {
    if (!targetProfile?.id) throw new HttpError(404, 'PROFILE_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const planetKey = generatePlanetKey();
    const digest = await hmacDigest(this.env.PLANET_KEY_PEPPER, `planet:${normalizePlanetKey(planetKey)}`);
    const versionRow = await this.credentials.maxVersion(targetProfile.id);
    const previous = await this.credentials.findActiveByProfile(targetProfile.id);
    const version = Number(versionRow?.version || 0) + 1;
    const credentialId = crypto.randomUUID();
    const statements = [
      this.env.DB.prepare("UPDATE planet_credentials SET status='revoked',revoked_at=?,rotated_at=? WHERE profile_id=? AND status='active'")
        .bind(now, now, targetProfile.id),
      this.env.DB.prepare("INSERT INTO planet_credentials (id,profile_id,key_digest,key_version,status,issued_at,created_by_profile_id) VALUES (?,?,?,?,'active',?,?)")
        .bind(credentialId, targetProfile.id, digest, version, now, actorProfile?.id || null),
    ];
    if (previous?.id) {
      statements.push(this.env.DB.prepare("INSERT INTO planet_credential_events (id,profile_id,credential_id,actor_profile_id,action,context_json,created_at) VALUES (?,?,?,?, 'revoked','{}',?)")
        .bind(crypto.randomUUID(), targetProfile.id, previous.id, actorProfile?.id || null, now));
    }
    statements.push(
      this.env.DB.prepare("INSERT INTO planet_credential_events (id,profile_id,credential_id,actor_profile_id,action,context_json,created_at) VALUES (?,?,?,?, 'rotated','{}',?)")
        .bind(crypto.randomUUID(), targetProfile.id, credentialId, actorProfile?.id || null, now),
      this.env.DB.prepare('DELETE FROM sessions WHERE profile_id=?').bind(targetProfile.id),
    );
    await this.env.DB.batch(statements);

    let sessionCookie = null;
    if (createSession) sessionCookie = (await this.auth.createSession(targetProfile.id)).cookie;
    return { planetKey, credentialVersion: version, issuedAt: now, sessionCookie };
  }

  profileShape(profile, asset = null) {
    const publicCode = profile.public_code || profile.publicCode;
    return {
      id: profile.id,
      nickname: profile.nickname,
      role: profile.role || 'user',
      accountOrigin: profile.account_origin || 'member',
      publicCode,
      planetImageUrl: asset?.url || (publicCode ? `/media/planets/${publicCode}/planet.svg` : null),
      maskedPlanetKey: maskPlanetKey(),
      createdAt: profile.created_at || profile.createdAt,
    };
  }
}
