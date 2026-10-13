'use strict';
const h = require('./_helpers');
process.env.OPENAI_API_KEY = 'test-key';
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/services/ai.service');
const pairing = require('../src/services/pairing.service');
const visitors = require('../src/visitors/visitors');
const { db } = require('../src/database');
const jadwal = require('../src/commands/search/jadwalsholat');
const registry = require('../src/core/registry');

const U = '6289200000001';
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

test('AI: provider belum dikonfigurasi menolak jelas dan command tidak aktif di registry', async () => {
  assert.equal(registry.isActive(registry.find('deepseek')), false);
  assert.match((await h.say('.deepseek halo')).text, /belum aktif/);
  await assert.rejects(() => ai.chat('deepseek', 'k', 'hai'), /belum dikonfigurasi/);
});

test('AI (.ai/.gpt) dengan fetch tiruan: jawaban, konteks tersimpan per pengguna, .resetai menghapus', async () => {
  let body;
  globalThis.fetch = async (url, opts) => { body = JSON.parse(opts.body); return json({ choices: [{ message: { content: 'Halo juga!' } }] }); };
  assert.equal(registry.isActive(registry.find('gpt')), true);
  const sess = h.session();
  const r = await h.say('.gpt halo', { from: U, sess });
  assert.equal(r.text, 'Halo juga!');
  assert.equal(body.messages.at(-1).content, 'halo');
  await h.say('.gpt lanjut', { from: U, sess });
  assert.equal(body.messages.filter((m) => m.role === 'user').length, 2, 'konteks percakapan ikut terkirim');
  assert.match((await h.say('.resetai', { from: U, sess })).text, /dihapus/);
  await h.say('.gpt baru', { from: U, sess });
  assert.equal(body.messages.filter((m) => m.role === 'user').length, 1);
  assert.match((await h.say('.resetai', { from: '6289200000009' })).text, /Tidak ada konteks/);
});

test('AI: konteks grup terpisah dari pribadi; .resetaigroup hanya admin grup', async () => {
  globalThis.fetch = async () => json({ choices: [{ message: { content: 'ok' } }] });
  const G = '120363777777777777@g.us';
  const sock = h.makeSock({ participants: [U, '6289200000002'] });
  sock.groupAdmins = new Set(['6289200000002']);
  const sess = h.session();
  await h.say('.ai tanya', { from: U, group: G, sock, sess });
  assert.match((await h.say('.resetaigroup', { from: U, group: G, sock, sess })).text, /khusus admin grup/);
  assert.match((await h.say('.resetaigroup', { from: '6289200000002', group: G, sock, sess })).text, /dihapus/);
});

test('AI: error provider (429, 401, timeout, kosong) -> pesan jelas, limit dikembalikan', async () => {
  const limit = require('../src/services/limit.service');
  const before = limit.status(U, 'cmd').remaining;
  for (const [mk, re] of [
    [() => json({}, 429), /rate limit/],
    [() => json({}, 401), /ditolak/],
    [() => json({ choices: [{ message: { content: '' } }] }), /kosong/],
    [() => { throw new Error('ECONNRESET'); }, /tidak dapat dijangkau/],
  ]) {
    globalThis.fetch = async () => mk();
    assert.match((await h.say('.gpt tes', { from: U })).text, re);
  }
  assert.equal(limit.status(U, 'cmd').remaining, before, 'limit tidak terpotong untuk permintaan gagal');
});

test('.jadwalsholat dengan respons Aladhan tiruan, validasi kota, dan penanganan error', async () => {
  let url;
  globalThis.fetch = async (u) => { url = String(u); return json({ data: { timings: { Fajr: '04:30 (WIB)', Sunrise: '05:45', Dhuhr: '11:55', Asr: '15:15', Maghrib: '18:00', Isha: '19:10' }, date: { readable: '11 Oct 2026' } } }); };
  const r = await h.say('.jadwalsholat Jakarta', { from: U });
  assert.match(r.text, /Subuh: 04:30\n/);
  assert.match(r.text, /Isya: 19:10/);
  assert.match(url, /city=Jakarta&country=Indonesia&method=20/);
  assert.match((await h.say('.jadwalsholat <script>', { from: U })).text, /tidak valid/);
  globalThis.fetch = async () => json({}, 400);
  assert.match((await h.say('.jadwalsholat Xyz', { from: U })).text, /tidak ditemukan/);
  globalThis.fetch = async () => json({ data: {} });
  assert.match((await h.say('.jadwalsholat Xyz', { from: U })).text, /tidak sesuai format/);
  assert.ok(jadwal.fetchTimings);
});

test('pairing.buildPhone: gabung kode negara, buang 0 depan, tidak menggandakan kode negara, tolak input buruk', () => {
  assert.equal(pairing.buildPhone({ country: '62', number: '812 3456 7890' }), '6281234567890');
  assert.equal(pairing.buildPhone({ country: '+62', number: '0812-3456-7890' }), '6281234567890');
  assert.equal(pairing.buildPhone({ country: '62', number: '6281234567890' }), '6281234567890');
  assert.equal(pairing.buildPhone({ country: '1', number: '(415) 555-0132' }), '14155550132');
  for (const bad of [{ country: '', number: '812' }, { country: '62', number: 'abc' }, { country: '62', number: '' }, { country: '6200', number: '8123456789' }, {}, null]) {
    assert.equal(pairing.buildPhone(bad), null, JSON.stringify(bad));
  }
});

test('pairing.connect: kode akses (jika diatur) diperiksa; nomor tidak valid ditolak sebelum menyentuh manager', async () => {
  const config = require('../src/config');
  const calls = [];
  const manager = { connect: async (sid, phone) => { calls.push([sid, phone]); return { status: 'connecting' }; } };
  const issue = () => 'newsid';
  const r = await pairing.connect({ sid: null, issue, body: { country: '62', number: '81234567890' }, manager });
  assert.equal(r.status, 'connecting');
  assert.deepEqual(calls[0], ['newsid', '6281234567890']);
  await assert.rejects(() => pairing.connect({ sid: 's', issue, body: { country: '62', number: 'x' }, manager }), /Nomor tidak valid/);
  config.site.accessCode = 'rahasia';
  try {
    await assert.rejects(() => pairing.connect({ sid: 's', issue, body: { country: '62', number: '81234567890', accessCode: 'salah' }, manager }), /Kode akses salah/);
    await pairing.connect({ sid: 's', issue, body: { country: '62', number: '81234567890', accessCode: 'rahasia' }, manager });
  } finally { config.site.accessCode = ''; }
  assert.equal(calls.length, 2);
});

test('visitors: cookie HttpOnly+SameSite=Strict, ID = HMAC (bukan token), cookie palsu ditolak, sweep membersihkan', () => {
  let header;
  const res = { setHeader: (k, v) => { header = v; } };
  const id = visitors.issue(res);
  assert.match(header, /^fb_vid=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+/);
  const token = header.match(/fb_vid=([^;]+)/)[1];
  assert.notEqual(id, token);
  assert.equal(id.length, 32);
  assert.equal(visitors.idFromCookieHeader(`a=1; fb_vid=${token}`), id);
  assert.equal(visitors.idFromCookieHeader('fb_vid=' + 'A'.repeat(43)), null);
  assert.equal(visitors.idFromCookieHeader('fb_vid=short'), null);
  assert.equal(visitors.idFromCookieHeader(undefined), null);
  assert.equal(db.prepare('SELECT id FROM visitors WHERE id = ?').get(token), undefined, 'token mentah tidak disimpan');
  db.prepare('UPDATE visitors SET last_seen = 1 WHERE id = ?').run(id);
  assert.ok(visitors.sweep() >= 1);
  assert.equal(visitors.idFromCookieHeader(`fb_vid=${token}`), null);
});
