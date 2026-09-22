import { readFile, access, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const root = fileURLToPath(rootUrl);
const config = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

function fail(message) {
  console.error(`Deploy blocked: ${message}`);
  process.exit(1);
}

if (config.includes('REPLACE_WITH_D1_DATABASE_ID')) {
  fail('wrangler.jsonc의 D1 database_id를 실제 Cloudflare D1 ID로 교체하세요.');
}

for (const secretName of ['PLANET_KEY_PEPPER', 'SESSION_PEPPER', 'AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY']) {
  if (!config.includes(`"${secretName}"`)) fail(`wrangler.jsonc secrets.required에 ${secretName}가 없습니다.`);
}
if (/"vars"\s*:\s*\{[\s\S]*?(API_KEY|PEPPER|TOKEN|PASSWORD)/i.test(config)) {
  fail('민감값을 wrangler vars에 두지 마세요. Cloudflare Secrets를 사용하세요.');
}

const forbiddenDirNames = new Set(['.git', 'node_modules', '.wrangler', 'private', 'secret-exports']);
const secretFilePatterns = [
  /^\.env(?:\..+)?$/i,
  /^\.dev\.vars(?:\..+)?$/i,
  /^(?:bootstrap-keys|studyworld-keys|planet-keys).*\.json$/i,
  /^(?:secrets?)(?:\..+)?$/i,
];
const secretExtensions = new Set(['.pem', '.key', '.p12', '.pfx']);
const files = [];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (forbiddenDirNames.has(name)) {
      if (['private', 'secret-exports'].includes(name)) fail(`${relative(root, join(dir, name))}/ 디렉터리는 release에 포함할 수 없습니다.`);
      continue;
    }
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);

for (const path of files) {
  const name = basename(path);
  if (secretFilePatterns.some((pattern) => pattern.test(name)) || secretExtensions.has(extname(name).toLowerCase())) {
    fail(`secret 가능성이 있는 파일이 포함되어 있습니다: ${relative(root, path)}`);
  }
}

for (const required of ['0001_initial.sql', '0002_learning_preference_signals.sql', '0003_study_room_visits.sql']) {
  try { await access(new URL(`../migrations/${required}`, import.meta.url)); }
  catch { fail(`migrations/${required} 누락`); }
}

const publicFiles = await readdir(new URL('../public', import.meta.url));
for (const required of ['index.html', 'favicon-32.png', 'favicon-192.png', 'favicon-512.png', 'manifest.webmanifest']) {
  if (!publicFiles.includes(required)) fail(`public/${required} 누락`);
}

try {
  await access(new URL('../pnpm-lock.yaml', import.meta.url));
} catch {
  console.warn('Warning: pnpm-lock.yaml이 아직 없습니다. 네트워크 가능한 Codespace에서 pnpm install 후 생성·커밋하면 재현성이 높아집니다.');
}

console.log('Predeploy contract OK: D1 binding, required Cloudflare secrets declaration, migrations, public assets, and secret-file policy validated.');
