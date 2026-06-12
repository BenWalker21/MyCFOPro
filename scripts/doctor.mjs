#!/usr/bin/env node
/** Local diagnostics — run: node scripts/doctor.mjs */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const base = `http://127.0.0.1:${port}`;

const requiredFiles = [
  'server.mjs',
  'cashqueue/routes.mjs',
  'collections/app/index.html',
  'collections/index.html'
];

console.log('\n=== MyCFOPro / CashQueue doctor ===\n');
console.log('Node:', process.version);
console.log('Project folder:', root);
console.log('');

let ok = true;
for (const rel of requiredFiles) {
  const path = join(root, rel);
  const exists = existsSync(path);
  console.log(exists ? '  OK' : '  MISSING', rel);
  if (!exists) ok = false;
}

console.log('\n--- Syntax check ---');
try {
  const { execSync } = await import('node:child_process');
  execSync('node --check server.mjs', { cwd: root, stdio: 'inherit' });
} catch {
  ok = false;
}

console.log('\n--- HTTP check (server must be running) ---');
for (const path of ['/', '/health', '/collections/app/']) {
  try {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(3000) });
    console.log(`  ${res.status}`, path);
  } catch (error) {
    console.log('  FAIL', path, '—', error.message);
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log('       ^ Server is not running. Start Open MyCFOPro.bat first.');
    }
    ok = false;
  }
}

console.log('');
if (ok) {
  console.log('All file checks passed. If browser still fails, try http://127.0.0.1:' + port + '/collections/app/');
} else {
  console.log('Fix missing files: git pull origin main');
  console.log('Then restart: close the black window and run Open MyCFOPro.bat again.');
}
console.log('');
