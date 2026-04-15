/**
 * Run from server/: node scripts/check-syntax.mjs
 * Finds truncated/corrupt .js files (fixes "SyntaxError: Unexpected end of input" on deploy).
 */
import { spawnSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) walk(p, files);
      else if (name.endsWith('.js')) files.push(p);
    } catch {
      /* skip */
    }
  }
  return files;
}

let bad = 0;
for (const f of walk(serverRoot)) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('FAIL', f);
    if (r.stderr) console.error(r.stderr);
    bad += 1;
  }
}

if (bad) {
  console.error(`\n${bad} file(s) failed. Fix or re-checkout from git: git checkout -- server/`);
  process.exit(1);
}
console.log('All server .js files pass node --check');
process.exit(0);
