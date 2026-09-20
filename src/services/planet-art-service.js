import { PlanetAssetRepository } from '../repositories/planet-asset-repository.js';
import { sha256Hex } from '../lib/security.js';

const PALETTES = Object.freeze([
  ['#0d4939', '#86b67c', '#f3e8a1'],
  ['#244c66', '#8ab6cc', '#f0d7a5'],
  ['#65434d', '#c68e9d', '#e9d9a8'],
  ['#4c4c32', '#a9b879', '#e7c66d'],
  ['#3f486d', '#8f9ac7', '#e8d8b2'],
  ['#6b4b2f', '#c79b6e', '#e8dcb6'],
]);

function xml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function hashInt(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function renderPlanetSvg({ nickname, publicCode, visualSeed }) {
  const seed = hashInt(`${visualSeed}:${publicCode}`);
  const [dark, planet, ring] = PALETTES[seed % PALETTES.length];
  const moonX = 162 + (seed % 90);
  const moonY = 152 + ((seed >>> 4) % 70);
  const safeName = xml(nickname.slice(0, 16));
  const safeCode = xml(publicCode);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-labelledby="title desc">
  <title id="title">${safeName}님의 STUDYWORLD 행성</title>
  <desc id="desc">인증 열쇠가 포함되지 않은 공개용 행성 이미지</desc>
  <rect width="640" height="640" rx="96" fill="#f7f4ea"/>
  <circle cx="320" cy="300" r="156" fill="${planet}"/>
  <circle cx="${moonX}" cy="${moonY}" r="34" fill="#f7f4ea" opacity=".7"/>
  <ellipse cx="320" cy="300" rx="238" ry="76" transform="rotate(-14 320 300)" fill="none" stroke="${ring}" stroke-width="24"/>
  <circle cx="320" cy="300" r="156" fill="none" stroke="${dark}" stroke-width="12"/>
  <text x="320" y="520" text-anchor="middle" fill="${dark}" font-family="system-ui, sans-serif" font-size="34" font-weight="700">${safeName}</text>
  <text x="320" y="563" text-anchor="middle" fill="#66766e" font-family="ui-monospace, monospace" font-size="22">${safeCode}</text>
  <text x="320" y="603" text-anchor="middle" fill="#829088" font-family="system-ui, sans-serif" font-size="16">STUDYWORLD · PUBLIC PLANET</text>
</svg>`;
}

export class PlanetArtService {
  constructor(env) {
    this.env = env;
    this.assets = new PlanetAssetRepository(env.DB);
  }

  async ensureGenerated(profile, now = new Date().toISOString()) {
    const existing = await this.assets.findCurrent(profile.id);
    if (existing) return this.publicShape(profile, existing);
    return this.regenerate(profile, now);
  }

  async regenerate(profile, now = new Date().toISOString()) {
    const svg = renderPlanetSvg(profile);
    const objectKey = `planets/${profile.public_code}/planet.svg`;
    const sha256 = await sha256Hex(svg);
    await this.env.UPLOADS.put(objectKey, svg, {
      httpMetadata: {
        contentType: 'image/svg+xml; charset=utf-8',
        cacheControl: 'public, max-age=300, stale-while-revalidate=86400',
      },
      customMetadata: { profileId: profile.id, kind: 'planet_art', source: 'generated' },
    });
    const id = crypto.randomUUID();
    await this.assets.upsertGenerated({ id, profileId: profile.id, objectKey, contentType: 'image/svg+xml; charset=utf-8', visibility: 'public', sha256, now });
    const asset = await this.assets.findCurrent(profile.id);
    return this.publicShape(profile, asset || { id, profile_id: profile.id, r2_object_key: objectKey, content_type: 'image/svg+xml; charset=utf-8', visibility: 'public', sha256, source: 'generated', created_at: now, updated_at: now });
  }

  publicShape(profile, asset) {
    return { ...asset, url: `/media/${asset.r2_object_key}`, publicCode: profile.public_code };
  }
}
