'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Ganti ./connection (Baileys) dengan versi tiruan. Ini menguji LOGIKA session manager, bukan WhatsApp sungguhan.
const connPath = require.resolve('../src/whatsapp/connection');
const opened = [];
let pairingBehaviour = async () => 'ABCD1234';
const REASONS = { loggedOut: 401, restartRequired: 515, connectionReplaced: 440, badSession: 500 };
require.cache[connPath] = {
  id: connPath, filename: connPath, loaded: true, children: [], paths: [],
  exports: {
    loadBaileys: () => ({}),
    async openSocket(handlers) {
      const sock = {
        user: null, ended: false, loggedOut: false,
        requestPairingCode: (phone) => pairingBehaviour(phone),
        async logout() { sock.loggedOut = true; },
        end() { sock.ended = true; },
      };
      fs.mkdirSync(handlers.authDir, { recursive: true });
      fs.writeFileSync(path.join(handlers.authDir, 'creds.json'), '{"registered":false}');
      opened.push({ handlers, sock });
      return { sock, DisconnectReason: REASONS };
    },
  },
};
const config = require('../src/config');
const { SessionManager, STATUS } = require('../src/whatsapp/session-manager');
const { issue } = require('../src/visitors/visitors');

const SID = 'a'.repeat(32);
const PHONE = '6281234567890';
const { db: testDb } = require('../src/database');
const origConnect = SessionManager.prototype.connect;
SessionManager.prototype.connect = function (sid, ...rest) {
  testDb.prepare('INSERT OR IGNORE INTO visitors (id, created_at, last_seen) VALUES (?, ?, ?)').run(sid, Date.now(), Date.now());
  return origConnect.call(this, sid, ...rest);
};
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const last = () => opened.at(-1);
const closeWith = (o, code) => o.handlers.onUpdate({ connection: 'close', lastDisconnect: { error: { output: { statusCode: code } } } });

test('alur pairing: connecting -> waiting_pairing (kode nyata dari socket) -> connected', async () => {
  const m = new SessionManager();
  const events = [];
  m.on('update', (sid, info) => events.push(info.status));
  const info = m.connect(SID, PHONE);
  assert.equal((await info).status, STATUS.CONNECTING);
  await tick();
  const o = last();
  assert.equal(m.publicInfo(SID).code, null, 'belum ada kode sebelum diminta');
  o.handlers.onUpdate({ connection: 'connecting', qr: 'qr-data' });
  await tick();
  assert.equal(m.publicInfo(SID).status, STATUS.WAITING);
  assert.equal(m.publicInfo(SID).code, 'ABCD1234');
  o.sock.user = { id: `${PHONE}:7@s.whatsapp.net` };
  o.handlers.onUpdate({ connection: 'open' });
  const pi = m.publicInfo(SID);
  assert.equal(pi.status, STATUS.CONNECTED);
  assert.equal(pi.code, null, 'kode dihapus setelah terhubung');
  assert.equal(pi.number, PHONE);
  assert.ok(events.includes(STATUS.WAITING) && events.at(-1) === STATUS.CONNECTED);
  assert.equal(m.connectedSessions().length, 1);
  await m.disconnect(SID);
});

test('restartRequired setelah pairing membuka socket baru; loggedOut menghapus kredensial', async () => {
  const m = new SessionManager();
  const sid = 'b'.repeat(32);
  await m.connect(sid, PHONE);
  await tick();
  const o = last();
  const n = opened.length;
  closeWith(o, REASONS.restartRequired);
  await tick();
  assert.equal(opened.length, n + 1);
  const o2 = last();
  o2.sock.user = { id: `${PHONE}:1@s.whatsapp.net` };
  o2.handlers.onUpdate({ connection: 'open' });
  assert.equal(m.publicInfo(sid).status, STATUS.CONNECTED);
  closeWith(o2, REASONS.loggedOut);
  await tick(30);
  assert.equal(m.publicInfo(sid).status, STATUS.DISCONNECTED);
  assert.match(m.publicInfo(sid).error, /dikeluarkan/);
  assert.equal(fs.existsSync(m.authDir(sid)), false, 'kredensial dihapus');
});

test('putus sementara setelah terhubung -> reconnecting; event socket lama diabaikan setelah disconnect', async () => {
  const m = new SessionManager();
  const sid = 'c'.repeat(32);
  await m.connect(sid, PHONE);
  await tick();
  const o = last();
  o.sock.user = { id: `${PHONE}:1@s.whatsapp.net` };
  o.handlers.onUpdate({ connection: 'open' });
  closeWith(o, 428);
  await tick();
  assert.equal(m.publicInfo(sid).status, STATUS.RECONNECTING);
  await m.disconnect(sid);
  const before = opened.length;
  closeWith(o, 428);
  o.handlers.onUpdate({ connection: 'open' });
  await tick();
  assert.equal(m.publicInfo(sid).status, STATUS.DISCONNECTED);
  assert.equal(opened.length, before, 'tidak ada socket baru dari event lama');
});

test('nomor yang terhubung berbeda dari yang dimasukkan -> ditolak', async () => {
  const m = new SessionManager();
  const sid = 'd'.repeat(32);
  await m.connect(sid, PHONE);
  await tick();
  const o = last();
  o.sock.user = { id: '6289999999999:1@s.whatsapp.net' };
  o.handlers.onUpdate({ connection: 'open' });
  await tick(30);
  assert.equal(m.publicInfo(sid).status, STATUS.DISCONNECTED);
  assert.match(m.publicInfo(sid).error, /berbeda/);
});

test('gagal meminta pairing code -> status error dengan pesan jelas; bisa diulang', async () => {
  const m = new SessionManager();
  const sid = 'e'.repeat(32);
  pairingBehaviour = async () => { throw new Error('rate-overlimit'); };
  await m.connect(sid, PHONE);
  await tick();
  last().handlers.onUpdate({ qr: 'x', connection: 'connecting' });
  await tick();
  assert.equal(m.publicInfo(sid).status, STATUS.ERROR);
  assert.match(m.publicInfo(sid).error, /pairing code/);
  pairingBehaviour = async () => 'ZZZZ9999';
  await m.disconnect(sid);
  await m.connect(sid, PHONE);
  await tick();
  last().handlers.onUpdate({ qr: 'x', connection: 'connecting' });
  await tick();
  assert.equal(m.publicInfo(sid).code, 'ZZZZ9999');
  await m.disconnect(sid);
});

test('batasan: sesi ganda 409, nomor dipakai sesi lain 409, kapasitas 503; connect ulang setelah disconnect berhasil', async () => {
  const m = new SessionManager();
  const s1 = '1'.repeat(32);
  const s2 = '2'.repeat(32);
  await m.connect(s1, PHONE, { maxSessions: 1 });
  await assert.rejects(() => m.connect(s1, PHONE), (e) => e.status === 409);
  await assert.rejects(() => m.connect(s2, PHONE), (e) => e.status === 409);
  await assert.rejects(() => m.connect(s2, '6280000000042', { maxSessions: 1 }), (e) => e.status === 503);
  await m.disconnect(s1);
  await m.connect(s2, PHONE, { maxSessions: 1 });
  await m.disconnect(s2);
});

test('sesi hanya terlihat oleh pemiliknya: publicInfo(sid lain) kosong', async () => {
  const m = new SessionManager();
  const sid = '3'.repeat(32);
  await m.connect(sid, PHONE);
  assert.equal(m.publicInfo('f'.repeat(32)).status, STATUS.DISCONNECTED);
  assert.equal(m.publicInfo('f'.repeat(32)).phone, null);
  await m.disconnect(sid);
});

test('pesan masuk (type notify) diteruskan ke pipeline command dengan sesi yang benar', async () => {
  const m = new SessionManager();
  const sid = '4'.repeat(32);
  await m.connect(sid, PHONE);
  await tick();
  const o = last();
  o.sock.user = { id: `${PHONE}:1@s.whatsapp.net` };
  o.handlers.onUpdate({ connection: 'open' });
  const s = m.get(sid);
  s.sock = Object.assign(h.makeSock(), { user: o.sock.user });
  o.handlers.onMessages({ type: 'notify', messages: [{ key: { remoteJid: `${h.USER}@s.whatsapp.net`, id: 'zz1' }, message: { conversation: '.ping' }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
  await tick(50);
  assert.match(s.sock.texts(), /pong/i);
  o.handlers.onMessages({ type: 'append', messages: [{ key: { remoteJid: `${h.USER}@s.whatsapp.net`, id: 'zz2' }, message: { conversation: '.ping' }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
  await tick(30);
  assert.equal(s.sock.sent.length, 2, `type append diabaikan: ${JSON.stringify(s.sock.sent.map((x) => x.content))}`);
  await m.disconnect(sid);
});

test('restoreAll: pulihkan sesi sah; bersihkan sisa pairing; JANGAN hapus login sah tanpa pemilik; karantina kredensial rusak', async () => {
  const m = new SessionManager();
  const { db } = require('../src/database');
  const good = '5'.repeat(32);
  const junk = '6'.repeat(32);
  for (const [sid, reg] of [[good, true], [junk, false]]) {
    fs.mkdirSync(m.authDir(sid), { recursive: true });
    fs.writeFileSync(path.join(m.authDir(sid), 'creds.json'), JSON.stringify({ registered: reg }));
  }
  db.prepare('INSERT OR REPLACE INTO visitors (id, created_at, last_seen) VALUES (?, ?, ?)').run(good, Date.now(), Date.now());
  const orphan = '7'.repeat(32);
  const broken = '8'.repeat(32);
  fs.mkdirSync(m.authDir(orphan), { recursive: true });
  fs.writeFileSync(path.join(m.authDir(orphan), 'creds.json'), JSON.stringify({ registered: true }));
  fs.mkdirSync(m.authDir(broken), { recursive: true });
  fs.writeFileSync(path.join(m.authDir(broken), 'creds.json'), '{rusak');
  const n = await m.restoreAll();
  assert.equal(n, 1);
  assert.equal(fs.existsSync(m.authDir(orphan)), true, 'login sah tanpa pemilik tidak dihapus');
  assert.equal(fs.existsSync(m.authDir(broken)), false);
  assert.ok(fs.readdirSync(config.waSessionsDir).some((d) => d.startsWith(`${broken}.corrupt-`)), 'kredensial rusak dikarantina');
  assert.equal(m.publicInfo(good).status, STATUS.RECONNECTING);
  assert.equal(fs.existsSync(m.authDir(junk)), false);
  await m.shutdown();
  assert.ok(typeof issue === 'function');
});
