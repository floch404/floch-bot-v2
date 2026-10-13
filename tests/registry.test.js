'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../src/core/registry');
const inventory = require('../src/commands/_inventory');

registry.ensureLoaded();
const all = registry.all();

test('registry termuat tanpa nama/alias bentrok dan semua inventaris terwakili', () => {
  const names = new Set(all.map((d) => d.key));
  for (const list of Object.values(inventory)) for (const n of list) assert.ok(registry.find(n), `inventaris ${n} tidak ada di registry`);
  assert.equal(names.size, all.length);
});

test('command non-planned punya handler; planned tidak aktif dan tidak dihitung', () => {
  for (const d of all) {
    if (d.status === 'planned') assert.equal(registry.isActive(d), false, d.key);
    else assert.equal(typeof d.run, 'function', d.key);
  }
  assert.equal(registry.active().length, all.filter((d) => registry.isActive(d)).length);
});

test('status "tested" hanya jika ada contoh otomatis atau tes yang memanggil command (".nama") ', () => {
  const dir = __dirname;
  const corpus = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js') && f !== 'registry.test.js').map((f) => fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase()).join('\n');
  const missing = all.filter((d) => d.status === 'tested' && !d.examples.length && !new RegExp(`[.](${[d.key, ...d.aliases].map((x) => x.toLowerCase()).join('|')})\\b`).test(corpus)).map((d) => d.key);
  assert.deepEqual(missing, []);
});

test('jws: premium, needs_config, nonaktif sebelum diverifikasi', () => {
  const d = registry.find('jws');
  assert.equal(d.permission, 'premium');
  assert.equal(d.status, 'needs_config');
  assert.equal(registry.isActive(d), false);
});
