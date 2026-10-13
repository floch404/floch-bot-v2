'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns').promises;
const premium = require('../src/services/premium.service');
const settings = require('../src/services/settings.service');
const jwsService = require('../src/services/jws.service');
const registry = require('../src/core/registry');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const ACTIVE = '6284000000001';
const EXPIRED = '6284000000002';
const NOBODY = '6284000000003';
let fetchCalls = 0;
let mode = 'image';

dns.lookup = async () => [{ address: '93.184.216.34' }]; // jaringan tidak dipakai di tes
globalThis.fetch = async (url) => {
  fetchCalls++;
  if (mode === 'down') throw new Error('ECONNRESET');
  if (mode === 'html') return new Response('<html>', { headers: { 'content-type': 'text/html' } });
  if (mode === 'json') {
    return String(url).endsWith('.png')
      ? new Response(PNG, { headers: { 'content-type': 'image/png' } })
      : new Response(JSON.stringify({ url: 'https://img.example.com/a.png' }), { headers: { 'content-type': 'application/json' } });
  }
  return new Response(PNG, { headers: { 'content-type': 'image/png' } });
};

const jws = (from, extra = {}) => h.say('.jws', { from, ...extra });
const imageSent = (r) => r.sock.sent.find((s) => Buffer.isBuffer(s.content.image));

test.before(() => {
  settings.update({ jws_cooldown_seconds: 0 });
  premium.grant(ACTIVE, 5, h.OWNER);
  premium.grant(EXPIRED, 1, h.OWNER, 'manual', Date.now() - 3 * 86_400_000); // sudah lewat
});

test('.jws belum aktif sebelum API diverifikasi (semua role, termasuk Owner)', async () => {
  assert.equal(jwsService.isVerified(), false);
  assert.equal(registry.isActive(registry.find('jws')), false);
  const r = await jws(h.OWNER);
  assert.match(r.text, /belum aktif/);
  assert.equal(imageSent(r), undefined);
  assert.equal(fetchCalls, 0, 'tidak ada panggilan jaringan sebelum terverifikasi');
});

test('setelah check:jws (markVerified) JWS aktif dan tampil di registry', () => {
  jwsService.markVerified({ via: 'tes' });
  assert.equal(jwsService.isVerified(), true);
  assert.equal(registry.isActive(registry.find('jws')), true);
});

test('Owner: berhasil, gambar dikirim sebagai media (buffer), bukan tautan', async () => {
  const r = await jws(h.OWNER);
  const img = imageSent(r);
  assert.ok(img, r.text);
  assert.equal(img.content.mimetype, 'image/png');
  assert.deepEqual(img.content.image, PNG);
});

test('Premium aktif: berhasil', async () => {
  const r = await jws(ACTIVE);
  assert.ok(imageSent(r), r.text);
});

test('Premium kedaluwarsa: ditolak dengan pesan kedaluwarsa, tanpa panggilan jaringan', async () => {
  const before = fetchCalls;
  const r = await jws(EXPIRED);
  assert.match(r.text, /kedaluwarsa/);
  assert.equal(imageSent(r), undefined);
  assert.equal(fetchCalls, before);
});

test('User biasa: ditolak, tanpa panggilan jaringan', async () => {
  const before = fetchCalls;
  const r = await jws(NOBODY);
  assert.match(r.text, /khusus Premium/);
  assert.equal(imageSent(r), undefined);
  assert.equal(fetchCalls, before);
});

test('Admin bot (bukan Owner/Premium) juga ditolak', async () => {
  require('../src/services/role.service').addAdmin(h.OWNER, '6284000000004');
  const r = await jws('6284000000004');
  assert.match(r.text, /khusus Premium/);
});

test('API mati / format tidak dikenal / JSON berisi URL: pesan jelas, tidak crash', async () => {
  mode = 'down';
  assert.match((await jws(h.OWNER)).text, /tidak dapat dijangkau/);
  mode = 'html';
  assert.match((await jws(h.OWNER)).text, /tidak didukung|Format/);
  mode = 'json';
  const r = await jws(h.OWNER);
  assert.ok(imageSent(r), r.text);
  mode = 'image';
});

test('saklar Owner menonaktifkan JWS; cooldown per nomor bekerja', async () => {
  settings.update({ jws_enabled: false });
  assert.match((await jws(h.OWNER)).text, /dinonaktifkan/);
  settings.update({ jws_enabled: true, jws_cooldown_seconds: 60 });
  premium.grant('6284000000005', 5, h.OWNER);
  assert.ok(imageSent(await jws('6284000000005')));
  assert.match((await jws('6284000000005')).text, /Tunggu \d+ detik/);
  settings.update({ jws_cooldown_seconds: 0 });
});

test('perlindungan SSRF: host privat/HTTP ditolak', async () => {
  assert.equal(jwsService.isPrivateIp('127.0.0.1'), true);
  assert.equal(jwsService.isPrivateIp('10.1.2.3'), true);
  assert.equal(jwsService.isPrivateIp('192.168.0.9'), true);
  assert.equal(jwsService.isPrivateIp('169.254.169.254'), true);
  assert.equal(jwsService.isPrivateIp('93.184.216.34'), false);
  assert.equal(jwsService.extractImageUrl({ data: { url: 'https://x.test/a.png' } }, 'data.url'), 'https://x.test/a.png');
  assert.equal(jwsService.extractImageUrl({ url: 'javascript:alert(1)' }), null);
});
