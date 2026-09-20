const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomChars(length, alphabet = KEY_ALPHABET) {
  const out = [];
  const range = alphabet.length;
  const cutoff = 256 - (256 % range);
  while (out.length < length) {
    const bytes = new Uint8Array(Math.max(length * 2, 32));
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= cutoff) continue;
      out.push(alphabet[byte % range]);
      if (out.length === length) break;
    }
  }
  return out.join('');
}

export function generatePlanetKey() {
  const raw = randomChars(20);
  return `ST-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
}

export function generatePublicPlanetCode() {
  return `PL-${randomChars(10, PUBLIC_CODE_ALPHABET)}`;
}

export function generateVisualSeed() {
  return generateOpaqueToken(18);
}

export function normalizePlanetKey(value = '') {
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidPlanetKey(value = '') {
  return /^ST-[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/.test(normalizePlanetKey(value));
}

// Authentication secrets are never partially exposed. Use a separate public planet code for display.
export function maskPlanetKey() {
  return 'ST-•••••-•••••-•••••-•••••';
}

export function generateOpaqueToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function hmacDigest(secret, value) {
  if (!secret) throw new Error('HMAC_SECRET_MISSING');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToHex(sig);
}

export async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(digest);
}

export function constantTimeStringEqual(a = '', b = '') {
  const aa = encoder.encode(String(a));
  const bb = encoder.encode(String(b));
  const max = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < max; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}
