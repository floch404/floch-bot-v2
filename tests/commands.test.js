'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../src/core/registry');

registry.ensureLoaded();
let seq = 0;

// Semua `examples` dijalankan lewat pipeline penuh (izin, limit, handler) dengan socket tiruan.
for (const d of registry.all().filter((x) => x.examples.length)) {
  test(`contoh .${d.key}`, async () => {
    for (const ex of d.examples) {
      const from = d.permission === 'owner' || d.permission === 'admin' ? h.OWNER : `62877${String(++seq).padStart(7, '0')}`; // pengguna baru: XP/limit terisolasi
      const r = await h.say(`.${d.key} ${ex.args || ''}`.trim(), { from });
      const parts = r.sock.sent.map((x) => x.content.text || x.content.caption || '');
      assert.ok(parts.some((t) => ex.expect.test(t)), `${d.key}: ${r.text}`);
    }
  });
}

test('command tidak dikenal di chat pribadi dijawab; planned dijawab jujur', async () => {
  assert.match((await h.say('.zzzunknown')).text, /tidak dikenal/);
  const planned = registry.all().find((d) => d.status === 'planned');
  assert.match((await h.say(`.${planned.key}`)).text, /belum diimplementasikan/);
});

test('error handler command tidak menjatuhkan bot', async () => {
  const d = registry.register({ name: 'boomtest', category: 'TOOLS', status: 'implemented', async run() { throw new Error('rahasia'); } });
  const r = await h.say('.boomtest');
  assert.match(r.text, /Terjadi kesalahan/);
  assert.doesNotMatch(r.text, /rahasia/);
  assert.ok(d);
});
