import { access, readFile } from 'node:fs/promises';
import process from 'node:process';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const failures = [];
const packageManager = String(pkg.packageManager ?? '');
if (!/^pnpm@\d+\.\d+\.\d+$/u.test(packageManager)) failures.push('packageManager must pin one exact pnpm version.');

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, version] of Object.entries(pkg[section] ?? {})) {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(String(version))) {
      failures.push(`${section}.${name} must be an exact version, found ${String(version)}`);
    }
  }
}

try { await access(new URL('../pnpm-lock.yaml', import.meta.url)); }
catch { failures.push('pnpm-lock.yaml is missing. Generate and review it before deployment.'); }

if (failures.length) {
  console.error(`Supply-chain check failed:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log('Supply-chain manifest check passed.');