'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let inRepo = true;
try { git('rev-parse', '--is-inside-work-tree'); } catch { inRepo = false; }

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const ignored = (rel) => { try { git('check-ignore', '-q', rel); return true; } catch { return false; } };

test('SEMUA file kode sumber, tes, skrip, dan website TIDAK diabaikan .gitignore', { skip: !inRepo && 'bukan repositori git' }, () => {
  const bad = [];
  for (const d of ['src', 'tests', 'scripts', 'public']) for (const f of walk(path.join(root, d))) { const rel = path.relative(root, f); if (ignored(rel)) bad.push(rel); }
  for (const f of ['package.json', 'README.md', '.env.example', '.gitignore']) if (ignored(f)) bad.push(f);
  assert.deepEqual(bad, [], 'file ini tidak akan ter-upload ke GitHub');
});

test('rahasia dan data sesi WAJIB diabaikan .gitignore', { skip: !inRepo && 'bukan repositori git' }, () => {
  for (const f of ['.env', '.env.production', 'data/floch.db', 'data/floch.db-wal', 'data/.session_secret', 'data/wa-sessions/abc/creds.json', 'data/wa-sessions/abc/app-state-sync-key-1.json', 'server.pem', 'x.key', 'node_modules/x/y.js']) {
    assert.equal(ignored(f), true, `${f} harus diabaikan`);
  }
  assert.equal(ignored('.env.example'), false);
  assert.equal(ignored('data/.gitkeep'), false);
});

test('tidak ada rahasia/kredensial yang ter-track di git', { skip: !inRepo && 'bukan repositori git' }, () => {
  const tracked = git('ls-files').split('\n').filter(Boolean);
  assert.deepEqual(tracked.filter((f) => /(^|\/)(\.env|creds\.json|\.session_secret)$|\.db(-wal|-shm)?$|wa-sessions/.test(f)), []);
});

test('runtime: engines Node >= 22.13 dan Baileys dipatok ke versi tertentu (bukan rentang/RC)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.engines.node, '>=22.13.0');
  assert.match(pkg.dependencies['@whiskeysockets/baileys'], /^\d+\.\d+\.\d+$/);
  assert.doesNotMatch(pkg.dependencies['@whiskeysockets/baileys'], /rc|beta|latest/);
  assert.equal(pkg.scripts.start.includes('src/server.js'), true);
});

test('semua require() relatif di src/ menunjuk ke file yang ada', () => {
  const missing = [];
  for (const f of walk(path.join(root, 'src')).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/require\('(\.[^']+)'\)/g)) {
      const base = path.resolve(path.dirname(f), m[1]);
      if (![base, `${base}.js`, path.join(base, 'index.js')].some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) missing.push(`${path.relative(root, f)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
