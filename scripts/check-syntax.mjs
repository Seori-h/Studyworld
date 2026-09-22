import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const roots = ['src', 'test', 'public/assets'];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (['.js', '.mjs'].includes(extname(path))) files.push(path);
  }
}
for (const root of roots) walk(root);
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
const html = readFileSync('public/index.html', 'utf8');
for (const required of ['/assets/styles.css', '/assets/study-runtime.js', '/assets/app.js', '/favicon-32.png', '/manifest.webmanifest']) {
  if (!html.includes(required)) throw new Error(`Missing HTML reference: ${required}`);
}
if (/<script(?![^>]*\bsrc=)/i.test(html)) throw new Error('Inline script detected: CSP would block it.');
console.log(`Syntax/static references OK (${files.length} JS modules checked).`);
