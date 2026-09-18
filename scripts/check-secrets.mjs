import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.wrangler', '.pnpm-store']);
const forbiddenFiles = [/(^|\/)\.env(\.|$)/u, /(^|\/)\.dev\.vars(\.|$)/u, /(^|\/)\.npmrc$/u];
const allowedExamples = new Set(['.env.example', '.dev.vars.example']);
const contentRules = [
  ['Supabase project URL', /https:\/\/[a-z0-9]{12,}\.supabase\.co/iu],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9._-]{12,}/u],
  ['Supabase publishable key', /sb_publishable_[A-Za-z0-9._-]{12,}/u],
  ['JWT-like credential', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/u],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['Cloudflare token assignment', /CLOUDFLARE_(?:API_)?TOKEN\s*=\s*\S+/iu],
  ['Runtime secret assignment', /(?:UPSTREAM_(?:ORIGIN|PUBLIC_KEY|SECRET_KEY)|SESSION_KEY)\s*=\s*\S+/u],
  ['Client infrastructure variable', /VITE_(?:SUPABASE|DATABASE|DB)_/u],
];

const failures = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (ignoredDirs.has(name)) continue;
    const full = join(dir, name);
    const info = await stat(full);
    const rel = relative(root, full).replaceAll('\\', '/');
    if (info.isDirectory()) { await walk(full); continue; }
    if (allowedExamples.has(rel)) continue;
    if (forbiddenFiles.some((rule) => rule.test(`/${rel}`))) failures.push(`${rel}: forbidden secret-bearing filename`);
    if (info.size > 2_000_000) continue;
    let text;
    try { text = await readFile(full, 'utf8'); } catch { continue; }
    for (const [label, rule] of contentRules) if (rule.test(text)) failures.push(`${rel}: ${label}`);
  }
}
await walk(root);
if (failures.length) {
  console.error(`Secret scan failed:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('Secret scan passed.');