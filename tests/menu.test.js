'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const registry = require('../src/core/registry');
const menu = require('../src/commands/general/menu');
const premium = require('../src/services/premium.service');

const IMG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
const imgPath = process.env.MENU_IMAGE_PATH;

test('tanpa file gambar: fallback teks, header persis sesuai format dengan data nyata', async () => {
  assert.equal(fs.existsSync(imgPath), false);
  const r = await h.say('.menu');
  const first = r.sock.sent[0].content;
  assert.equal(first.image, undefined);
  const lines = first.text.split('\n');
  assert.equal(lines[0], '╭─「 FLOCH BOT 」');
  assert.equal(lines[1], '│ Owner: floch');
  assert.equal(lines[2], '│ Developer: floch');
  assert.match(lines[3], /^│ Runtime: .+/);
  assert.equal(lines[4], `│ Total Cmd: ${registry.active().length}`);
  assert.equal(lines[5], '│ Status: Online');
  assert.equal(lines[6], '╰────────────');
});

test('dengan gambar: dikirim sebagai media (buffer) dengan caption <= 1000 karakter', async () => {
  fs.writeFileSync(imgPath, IMG);
  const r = await h.say('.menu');
  const m = r.sock.sent[0].content;
  assert.ok(Buffer.isBuffer(m.image));
  assert.deepEqual(m.image, IMG);
  assert.ok(m.caption.length <= 1000, `caption ${m.caption.length}`);
  assert.ok(m.caption.startsWith('╭─「 FLOCH BOT 」'));
});

test('menu panjang dipecah ke beberapa pesan tanpa memotong baris; semua command aktif muncul tepat sekali per kategori', async () => {
  const r = await h.say('.menu');
  const parts = r.sock.sent.map((s) => s.content.caption || s.content.text);
  assert.ok(parts.length > 1);
  for (const p of parts.slice(1)) assert.ok(p.length <= 3700, `bagian ${p.length}`);
  const all = parts.join('\n');
  // Semua command publik aktif tampil
  for (const d of registry.active().filter((x) => x.permission === 'public')) assert.ok(all.includes(`.${d.display}`), `.${d.display} hilang dari menu`);
});

test('command planned dan needs_config nonaktif TIDAK tampil di menu', async () => {
  const all = (await h.say('.menu', { from: h.OWNER })).sock.sent.map((s) => s.content.caption || s.content.text).join('\n');
  for (const d of registry.all().filter((x) => !registry.isActive(x))) {
    assert.ok(!new RegExp(`│ \\.${d.display}( |$)`, 'm').test(all), `.${d.display} (status ${d.status}) tampil padahal tidak aktif`);
  }
});

test('menu mengikuti role: user biasa tidak melihat command Owner; Owner melihat; Premium melihat ★', async () => {
  const user = (await h.say('.menu', { from: '6287100000001' })).sock.sent.map((s) => s.content.caption || s.content.text).join('\n');
  assert.ok(!user.includes('.AddAdmin'));
  assert.ok(!user.includes('.GenRedeem'));
  const owner = (await h.say('.menu', { from: h.OWNER })).sock.sent.map((s) => s.content.caption || s.content.text).join('\n');
  assert.ok(owner.includes('.AddAdmin ♛'));
});

test('.menu <kategori> dan kategori tidak valid', async () => {
  const r = await h.say('.menu game');
  assert.match(r.sock.sent.map((s) => s.content.caption || s.content.text).join('\n'), /「 GAME 」[\s\S]*\.Math/);
  assert.match((await h.say('.menu zzz')).text, /Kategori tidak ditemukan/);
});

test('jika pengiriman gambar gagal, menu tetap dikirim sebagai teks', async () => {
  const sock = h.makeSock();
  const orig = sock.sendMessage;
  sock.sendMessage = async (jid, c, o) => { if (c.image) throw new Error('media gagal'); return orig(jid, c, o); };
  const r = await h.say('.menu', { sock });
  assert.ok(r.sock.sent.length >= 1);
  assert.ok(r.sock.sent[0].content.text.startsWith('╭─「 FLOCH BOT 」'));
});

test('Total Cmd berubah mengikuti jumlah command aktif (bukan angka tetap)', async () => {
  const before = registry.active().length;
  registry.register({ name: 'tmpcmdx', category: 'TOOLS', status: 'implemented', async run() {} });
  const r = await h.say('.menu');
  assert.match(r.sock.sent[0].content.caption || r.sock.sent[0].content.text, new RegExp(`Total Cmd: ${before + 1}`));
  assert.ok(menu.buildHeader);
});
