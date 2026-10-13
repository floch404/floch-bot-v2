'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const premium = require('../src/services/premium.service');
const role = require('../src/services/role.service');
const limits = require('../src/services/limit.service');
const { db } = require('../src/database');

const A = '6286000000001'; // calon admin
const U = '6286000000002';
const T = '6286000000003';

test('resolve(): Owner/Admin/Premium/Expired/User dipisahkan; Admin bukan Owner', () => {
  assert.equal(role.resolve(h.OWNER).isOwner, true);
  assert.equal(role.resolve(U).role, 'user');
  role.addAdmin(h.OWNER, A);
  const a = role.resolve(A);
  assert.equal(a.isAdmin, true);
  assert.equal(a.isOwner, false);
  premium.grant(T, 3, h.OWNER);
  assert.equal(role.resolve(T).hasPremiumAccess, true);
  premium.grant('6286000000009', 1, h.OWNER, 'manual', Date.now() - 5 * 86_400_000);
  const e = role.resolve('6286000000009');
  assert.equal(e.hasPremiumAccess, false);
  assert.equal(e.premium.expired, true);
});

test('.addadmin/.deladmin/.listadmin: hanya Owner (user biasa dan Admin ditolak)', async () => {
  assert.match((await h.say(`.addadmin ${U}`, { from: U })).text, /khusus Owner/);
  assert.match((await h.say(`.addadmin ${U}`, { from: A })).text, /khusus Owner/);
  assert.match((await h.say(`.addadmin ${U}`, { from: h.OWNER })).text, /✅/);
  assert.match((await h.say('.listadmin', { from: h.OWNER })).text, /2860000000/);
  assert.match((await h.say(`.deladmin ${U}`, { from: h.OWNER })).text, /Konfirmasi/);
  assert.equal(role.resolve(U).isAdmin, true, 'belum dicabut tanpa konfirmasi');
  assert.match((await h.say(`.deladmin ${U} ya`, { from: h.OWNER })).text, /✅/);
  assert.equal(role.resolve(U).isAdmin, false);
});

test('.addpremium/.delpremium/.listpremium: Admin dilarang jika ADMIN_CAN_MANAGE_PREMIUM=false; Owner boleh', async () => {
  assert.match((await h.say(`.addpremium ${U} 7`, { from: U })).text, /khusus Admin/);
  assert.match((await h.say(`.addpremium ${U} 7`, { from: A })).text, /dinonaktifkan/);
  const ok = await h.say(`.addpremium ${U} 7`, { from: h.OWNER });
  assert.match(ok.text, /\+7 hari/);
  assert.equal(role.resolve(U).hasPremiumAccess, true);
  assert.match((await h.say('.listpremium', { from: h.OWNER })).text, /2860000000/);
  assert.match((await h.say(`.cekpremium`, { from: U })).text, /Premium AKTIF/);
  assert.match((await h.say(`.delpremium ${U} ya`, { from: h.OWNER })).text, /✅/);
  assert.equal(role.resolve(U).hasPremiumAccess, false);
  assert.match((await h.say(`.addpremium ${h.OWNER} 7`, { from: h.OWNER })).text, /Owner tidak memerlukan/);
  assert.match((await h.say(`.addpremium ${U} 99999`, { from: h.OWNER })).text, /1-3650/);
});

test('Admin boleh mengelola Premium bila Owner mengizinkan (flag config)', async () => {
  const config = require('../src/config');
  config.adminCanManagePremium = true;
  try {
    assert.match((await h.say(`.addpremium ${U} 2`, { from: A })).text, /\+2 hari/);
    assert.match((await h.say(`.addpremium ${A} 2`, { from: A })).text, /akun sendiri/);
  } finally {
    config.adminCanManagePremium = false;
    premium.revoke(U);
  }
});

test('.genredeem + .redeem: kode sekali pakai, tidak bisa dipakai ulang, perpanjang Premium, kode salah ditolak', async () => {
  assert.match((await h.say('.genredeem 5', { from: U })).text, /khusus Owner/);
  const g = await h.say('.genredeem 5 1 30', { from: h.OWNER });
  const code = g.text.match(/\*([A-Z0-9-]+)\*/)[1];
  assert.match((await h.say(`.redeem ${code}`, { from: U })).text, /\+5 hari Premium/);
  assert.equal(role.resolve(U).hasPremiumAccess, true);
  assert.match((await h.say(`.redeem ${code}`, { from: T })).text, /❌/);
  assert.match((await h.say(`.redeem ${code}`, { from: U })).text, /❌/);
  assert.match((await h.say('.redeem SALAH-KODE', { from: T })).text, /❌/);
  const before = premium.status(U).expiresAt;
  const g2 = await h.say('.genredeem 2', { from: h.OWNER });
  await h.say(`.redeem ${g2.text.match(/\*([A-Z0-9-]+)\*/)[1]}`, { from: U });
  assert.equal(premium.status(U).expiresAt - before, 2 * 86_400_000, 'perpanjangan ditambah di atas sisa waktu');
});

test('kode redeem kedaluwarsa ditolak', async () => {
  const r = premium.createRedeem(h.OWNER, 1, 1, 1);
  db.prepare('UPDATE redeem_codes SET expires_at = ? WHERE code = ?').run(Date.now() - 1000, r.code);
  assert.throws(() => premium.redeem(T, r.code), /kedaluwarsa|tidak valid|tidak berlaku/i);
});

test('data Premium dan role bertahan di database (persisten) dan tercatat di log', async () => {
  const row = db.prepare('SELECT expires_at FROM premium WHERE number = ?').get(U);
  assert.ok(row && row.expires_at > Date.now());
  const log = await h.say('.rolelog', { from: h.OWNER });
  assert.match(log.text, /premium_grant|admin_add/);
  assert.match((await h.say('.rolelog', { from: U })).text, /khusus Owner/);
});

test('.banuser/.unbanuser/.banlist (Owner): pengguna yang diban diabaikan bot', async () => {
  const B = '6286000000050';
  assert.match((await h.say(`.banuser ${B} spam`, { from: h.OWNER })).text, /Konfirmasi/);
  assert.match((await h.say(`.banuser ${B} spam ya`, { from: h.OWNER })).text, /diblokir/);
  const r = await h.say('.ping', { from: B });
  assert.equal(r.result.skipped, 'banned-user');
  assert.match((await h.say('.banlist', { from: h.OWNER })).text, /2860000000/);
  assert.match((await h.say(`.unbanuser ${B}`, { from: h.OWNER })).text, /✅/);
  assert.match((await h.say('.ping', { from: B })).text, /Pong|pong/i);
  assert.match((await h.say(`.banuser ${h.OWNER} x ya`, { from: h.OWNER })).text, /Owner/);
});

test('.limit .daily: klaim sekali sehari; limit command habis menolak, .daily menambah; Owner tak terbatas', async () => {
  const L = '6286000000060';
  assert.match((await h.say('.daily', { from: L })).text, /Bonus harian: \+\d+ limit/);
  assert.match((await h.say('.daily', { from: L })).text, /sudah klaim/);
  const st = limits.status(L, 'cmd');
  for (let i = 0; i < st.remaining; i++) assert.equal(limits.consume(L, 'cmd', 1).ok, true);
  assert.equal(limits.consume(L, 'cmd', 1).ok, false);
  assert.equal(limits.consume(L, 'cmd', 1, { unlimited: true }).ok, true);
  assert.match((await h.say('.limit', { from: L })).text, /0/);
});

test('.ping .runtime .menu tersedia; .cekbenefit .premium memakai data nyata', async () => {
  assert.match((await h.say('.ping')).text, /pong/i);
  assert.match((await h.say('.runtime')).text, /Bot aktif: .*1 menit|Bot aktif/);
  assert.match((await h.say('.premium')).text, /Premium/);
  assert.match((await h.say('.cekbenefit')).text, /Premium|Benefit/i);
});

test('profil: .setname .setage .setgender .setbio .setprefix tersimpan dan divalidasi', async () => {
  const P = '6286000000070';
  assert.match((await h.say('.setname Floch Tes', { from: P })).text, /✅|Nama/);
  assert.match((await h.say('.setage 25', { from: P })).text, /✅|Umur/);
  assert.match((await h.say('.setgender pria', { from: P })).text, /✅|Gender/);
  assert.match((await h.say('.setbio halo dunia', { from: P })).text, /✅|Bio/);
  const prof = (await h.say('.profile', { from: P })).text;
  assert.match(prof, /Floch Tes/);
  assert.match(prof, /25/);
  assert.match((await h.say('.setage -5', { from: P })).text, /tidak valid|Umur|1-/i);
  assert.match((await h.say('.setprefix !', { from: P })).text, /✅|Prefix/);
  assert.match((await h.say('!ping', { from: P })).text, /pong/i);
});
