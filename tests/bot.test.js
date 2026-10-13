'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../src/services/settings.service');

test('.botsettings .selfmode .groupmode .joinmode .autoread .rejectcall .pacing .scanbot: hanya Owner', async () => {
  for (const c of ['.botsettings', '.selfmode on', '.groupmode on', '.joinmode off', '.autoread on', '.rejectcall on', '.pacing 100', '.scanbot', '.listgroup', '.getprivacysetting']) {
    assert.match((await h.say(c, { from: '6289100000001' })).text, /khusus Owner/, c);
  }
  assert.equal(settings.get('self_mode'), false);
});

test('Owner mengubah pengaturan dan nilai tersimpan di database', async () => {
  assert.match((await h.say('.selfmode on', { from: h.OWNER })).text, /AKTIF/);
  assert.equal(settings.get('self_mode'), true);
  assert.equal((await h.say('.ping', { from: '6289100000002' })).result.skipped, 'self-mode');
  assert.match((await h.say('.ping', { from: h.OWNER })).text, /pong/i);
  await h.say('.selfmode off', { from: h.OWNER });
  assert.equal(settings.get('self_mode'), false);

  await h.say('.groupmode on', { from: h.OWNER });
  assert.equal((await h.say('.ping', { from: '6289100000002' })).result.skipped, 'group-mode');
  await h.say('.groupmode off', { from: h.OWNER });

  await h.say('.autoread on', { from: h.OWNER });
  const s = h.makeSock();
  let read = 0;
  s.readMessages = async () => { read++; };
  await h.say('.ping', { from: '6289100000003', sock: s });
  assert.equal(read, 1);
  await h.say('.autoread off', { from: h.OWNER });

  assert.match((await h.say('.pacing 50', { from: h.OWNER })).text, /50 ms/);
  assert.equal(settings.get('pacing_ms'), 50);
  assert.match((await h.say('.pacing 99999', { from: h.OWNER })).text, /0-5000/);
  assert.match((await h.say('.pacing abc', { from: h.OWNER })).text, /angka/);
  await h.say('.pacing 0', { from: h.OWNER });
  assert.match((await h.say('.selfmode maybe', { from: h.OWNER })).text, /on atau off/);
  assert.match((await h.say('.rejectcall on', { from: h.OWNER })).text, /AKTIF/);
  assert.equal(settings.get('reject_call'), true);
  await h.say('.rejectcall off', { from: h.OWNER });
  assert.match((await h.say('.joinmode off', { from: h.OWNER })).text, /mati/);
  await h.say('.joinmode on', { from: h.OWNER });
});

test('.botsettings daftar dan ubah lewat kunci; kunci salah ditolak', async () => {
  assert.match((await h.say('.botsettings', { from: h.OWNER })).text, /self_mode: off/);
  assert.match((await h.say('.botsettings jws_cooldown_seconds 7', { from: h.OWNER })).text, /jws_cooldown_seconds: 7/);
  assert.match((await h.say('.botsettings bukan_kunci 1', { from: h.OWNER })).text, /Kunci tidak dikenal/);
});

test('penolakan panggilan hanya jika diaktifkan Owner', async () => {
  const { handleCalls } = require('../src/whatsapp/group-events');
  const s = h.makeSock();
  const rejected = [];
  s.rejectCall = async (id, from) => rejected.push([id, from]);
  settings.update({ reject_call: false });
  await handleCalls({ sock: s, calls: [{ id: 'c1', from: 'x@s.whatsapp.net', status: 'offer' }] });
  assert.equal(rejected.length, 0);
  settings.update({ reject_call: true });
  await handleCalls({ sock: s, calls: [{ id: 'c1', from: 'x@s.whatsapp.net', status: 'offer' }, { id: 'c2', from: 'y@s.whatsapp.net', status: 'ringing' }] });
  assert.deepEqual(rejected, [['c1', 'x@s.whatsapp.net']]);
  settings.update({ reject_call: false });
});

test('.scanbot .listgroup .getprivacysetting (Owner) dengan socket tiruan', async () => {
  assert.match((await h.say('.scanbot', { from: h.OWNER })).text, /Database: ok[\s\S]*Command aktif: \d+ dari \d+/);
  const s = h.makeSock();
  s.groupFetchAllParticipating = async () => ({ a: { subject: 'Grup A', participants: [1, 2] } });
  assert.match((await h.say('.listgroup', { from: h.OWNER, sock: s })).text, /Grup A — 2 anggota/);
  assert.match((await h.say('.getprivacysetting', { from: h.OWNER, sock: s })).text, /last: all/);
  const bad = h.makeSock();
  bad.groupFetchAllParticipating = async () => { throw new Error('x'); };
  assert.match((await h.say('.listgroup', { from: h.OWNER, sock: bad })).text, /Gagal mengambil/);
});
