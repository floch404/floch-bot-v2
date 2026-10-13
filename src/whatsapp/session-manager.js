'use strict';

const EventEmitter = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { db } = require('../database');
const { openSocket } = require('./connection');
const { handleIncoming } = require('./message-handler');
const { handleParticipants, handleCalls } = require('./group-events');

const STATUS = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  WAITING: 'waiting_pairing',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
});
const ACTIVE = new Set([STATUS.CONNECTING, STATUS.WAITING, STATUS.CONNECTED, STATUS.RECONNECTING]);

const PAIRING_TIMEOUT_MS = 120_000;
const ABANDON_MS = 10 * 60_000;
const MAX_RECONNECT_ATTEMPTS = 8;
const MAX_MESSAGE_AGE_S = 60;

class ManagerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ManagerError';
    this.status = status;
    this.expose = true;
  }
}

/** Satu sesi bot. `sid` = ID pengunjung website yang memiliki sesi ini (bukan akun, tidak ada login). */
class Session {
  constructor(sid) {
    this.sid = sid;
    this.status = STATUS.DISCONNECTED;
    this.phone = null; // nomor yang diminta untuk pairing
    this.ownNumber = null; // nomor aktual setelah terhubung (dari WhatsApp)
    this.code = null;
    this.error = null;
    this.connectedAt = null;
    this.updatedAt = Date.now();
    this.sock = null;
    this.gen = 0; // penanda generasi socket agar event socket lama diabaikan
    this.attempts = 0;
    this.stopping = false;
    this.needPairing = false;
    this.pairingPhase = false;
    this.codeRequested = false;
    this.timers = new Set();
    this.sentIds = new Set();
  }
  markSent(id) {
    this.sentIds.add(id);
    if (this.sentIds.size > 500) this.sentIds.delete(this.sentIds.values().next().value);
  }
  isOwnSent(id) {
    return this.sentIds.has(id);
  }
  setTimer(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.reasons = { loggedOut: 401, restartRequired: 515, connectionReplaced: 440, badSession: 500 };
    this.startedAt = Date.now();
  }

  authDir(sid) {
    return path.join(config.waSessionsDir, String(sid));
  }

  /** Info aman untuk frontend: tanpa kredensial; pairing code hanya untuk pemilik sesi. */
  publicInfo(sid) {
    const s = sid ? this.sessions.get(sid) : null;
    if (!s) return { status: STATUS.DISCONNECTED, phone: null, number: null, code: null, error: null, connectedAt: null };
    return {
      status: s.status,
      phone: s.phone,
      number: s.ownNumber,
      code: s.status === STATUS.WAITING ? s.code : null,
      error: s.error,
      connectedAt: s.connectedAt,
    };
  }

  /** Ringkasan semua sesi (untuk command Owner). Tidak memuat pairing code atau kredensial. */
  overview() {
    return [...this.sessions.values()].map((s) => ({
      sid: s.sid.slice(0, 8),
      status: s.status,
      number: s.ownNumber,
      connectedAt: s.connectedAt,
    }));
  }

  connectedSessions() {
    return [...this.sessions.values()].filter((s) => s.status === STATUS.CONNECTED);
  }
  activeCount() {
    return [...this.sessions.values()].filter((s) => ACTIVE.has(s.status)).length;
  }
  /** Status untuk .menu / .bot: dari sesi yang sedang melayani pesan. */
  get(sid) {
    return this.sessions.get(sid) || null;
  }

  _session(sid) {
    let s = this.sessions.get(sid);
    if (!s) {
      s = new Session(sid);
      this.sessions.set(sid, s);
    }
    return s;
  }

  _set(s, patch) {
    Object.assign(s, patch, { updatedAt: Date.now() });
    try {
      db.prepare(
        `INSERT INTO wa_sessions (id, phone, own_number, status, last_error, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET phone = excluded.phone, own_number = excluded.own_number, status = excluded.status,
           last_error = excluded.last_error, connected_at = excluded.connected_at, updated_at = excluded.updated_at`
      ).run(s.sid, s.phone, s.ownNumber, s.status, s.error, s.connectedAt, s.updatedAt);
    } catch (err) {
      console.error('[wa] gagal menyimpan status:', err.message);
    }
    this.emit('update', s.sid, this.publicInfo(s.sid));
  }

  _wipeAuth(sid) {
    fs.rmSync(this.authDir(sid), { recursive: true, force: true });
  }

  /** Mulai proses pairing. Kode asli datang dari Baileys secara asinkron (status waiting_pairing). */
  async connect(sid, phone, { maxSessions = config.site.maxSessions } = {}) {
    const s = this._session(sid);
    if (ACTIVE.has(s.status)) throw new ManagerError('Sesi WhatsApp sudah berjalan. Tekan Disconnect terlebih dahulu.', 409);

    const others = [...this.sessions.values()].filter((o) => o !== s && ACTIVE.has(o.status));
    if (others.some((o) => o.phone === phone || o.ownNumber === phone)) throw new ManagerError('Nomor ini sedang dipakai oleh sesi lain.', 409);
    if (others.length >= maxSessions) throw new ManagerError('Kapasitas sesi bot penuh. Coba lagi nanti.', 503);

    this._wipeAuth(sid); // pairing selalu dimulai dari sesi bersih
    s.clearTimers();
    Object.assign(s, {
      phone,
      ownNumber: null,
      code: null,
      attempts: 0,
      stopping: false,
      needPairing: true,
      pairingPhase: true,
      codeRequested: false,
      connectedAt: null,
    });
    this._set(s, { status: STATUS.CONNECTING, error: null });
    this._start(s).catch((err) => this._fail(s, `Gagal memulai koneksi: ${err.message}`));
    return this.publicInfo(sid);
  }

  async disconnect(sid, { reason = null } = {}) {
    const s = this.sessions.get(sid);
    if (!s && !fs.existsSync(this.authDir(sid))) return this.publicInfo(sid);
    const sess = s || this._session(sid);

    sess.stopping = true;
    sess.gen += 1; // abaikan event dari socket yang sedang ditutup
    sess.clearTimers();
    const sock = sess.sock;
    sess.sock = null;
    if (sock) {
      try {
        await Promise.race([sock.logout(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
      } catch {
        try {
          sock.end(undefined);
        } catch {
          /* abaikan */
        }
      }
    }
    this._wipeAuth(sid);
    this._set(sess, { status: STATUS.DISCONNECTED, code: null, ownNumber: null, connectedAt: null, error: reason, needPairing: false, pairingPhase: false });
    return this.publicInfo(sid);
  }

  /** Pulihkan sesi yang sudah terdaftar setelah server restart. */
  async restoreAll() {
    let entries = [];
    try {
      entries = fs.readdirSync(config.waSessionsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^[a-f0-9]{16,64}$/.test(e.name));
    } catch {
      return 0;
    }
    let restored = 0;
    for (const e of entries) {
      const sid = e.name;
      let registered = false;
      let corrupt = false;
      try {
        registered = JSON.parse(fs.readFileSync(path.join(config.waSessionsDir, sid, 'creds.json'), 'utf8')).registered === true;
      } catch (err) {
        corrupt = err.code !== 'ENOENT'; // file ada tetapi rusak (bukan sekadar belum ada)
      }
      if (corrupt) {
        // Jangan menghapus data yang mungkin masih berguna: pindahkan ke karantina (tidak dipulihkan otomatis).
        try {
          fs.renameSync(this.authDir(sid), `${this.authDir(sid)}.corrupt-${Date.now()}`);
          console.warn(`[wa] kredensial ${sid.slice(0, 8)} rusak; dipindahkan ke karantina`);
        } catch {
          /* abaikan */
        }
        continue;
      }
      if (!registered) {
        this._wipeAuth(sid); // sisa pairing yang tidak pernah selesai: tidak ada login yang hilang
        continue;
      }
      const known = db.prepare('SELECT 1 AS x FROM visitors WHERE id = ?').get(sid);
      if (!known) {
        // Login sah tetapi pemiliknya tidak ada di database (mis. database hilang): JANGAN dihapus, hanya tidak dipulihkan.
        console.warn(`[wa] sesi ${sid.slice(0, 8)} terdaftar tetapi tidak ada di database; dibiarkan di disk`);
        continue;
      }
      const s = this._session(sid);
      Object.assign(s, { stopping: false, needPairing: false, pairingPhase: false, attempts: 0 });
      this._set(s, { status: STATUS.RECONNECTING, error: null });
      this._start(s).catch((err) => this._fail(s, `Gagal memulihkan sesi: ${err.message}`));
      restored++;
      await new Promise((r) => setTimeout(r, 500)); // jeda antar sesi
    }
    return restored;
  }

  /** Bersihkan sesi pairing yang ditinggalkan (tidak pernah tersambung). */
  async sweep() {
    const now = Date.now();
    for (const s of [...this.sessions.values()]) {
      const stale = now - s.updatedAt > ABANDON_MS;
      if (stale && s.pairingPhase && [STATUS.CONNECTING, STATUS.WAITING, STATUS.ERROR].includes(s.status)) {
        await this.disconnect(s.sid, { reason: 'Pairing tidak diselesaikan, sesi dibersihkan.' });
      }
    }
  }

  /** Tutup semua socket tanpa logout (kredensial tetap tersimpan untuk dipulihkan). */
  async shutdown() {
    for (const s of this.sessions.values()) {
      s.stopping = true;
      s.gen += 1;
      s.clearTimers();
      try {
        s.sock?.end(undefined);
      } catch {
        /* abaikan */
      }
    }
  }

  async _start(s) {
    const gen = ++s.gen;
    const alive = () => gen === s.gen && !s.stopping;
    const { sock, DisconnectReason } = await openSocket({
      authDir: this.authDir(s.sid),
      onUpdate: (u) => alive() && this._onUpdate(s, u),
      onMessages: (m) => alive() && this._onMessages(s, m),
      onGroupParticipants: (u) => alive() && handleParticipants({ sock: s.sock, session: s, update: u }),
      onCalls: (c) => alive() && handleCalls({ sock: s.sock, calls: c }),
    });
    this.reasons = { ...this.reasons, ...DisconnectReason };
    if (!alive()) {
      try {
        sock.end(undefined);
      } catch {
        /* abaikan */
      }
      return;
    }
    s.sock = sock;
  }

  _onUpdate(s, update) {
    const { connection, lastDisconnect, qr } = update;

    if (s.needPairing && !s.codeRequested) {
      if (qr) this._requestCode(s); // QR muncul = handshake selesai, siap meminta pairing code
      else if (connection === 'connecting') {
        const gen = s.gen;
        s.setTimer(() => gen === s.gen && !s.codeRequested && this._requestCode(s), 4000);
      }
    }
    if (connection === 'open') this._onOpen(s);
    else if (connection === 'close') this._onClose(s, lastDisconnect);
  }

  async _requestCode(s) {
    if (s.codeRequested || !s.sock) return;
    s.codeRequested = true;
    const gen = s.gen;
    try {
      const code = await s.sock.requestPairingCode(s.phone);
      if (gen !== s.gen) return;
      this._set(s, { status: STATUS.WAITING, code, error: null });
      s.setTimer(() => {
        if (s.status === STATUS.WAITING) this._fail(s, 'Kode pairing kedaluwarsa. Buat kode baru.');
      }, PAIRING_TIMEOUT_MS);
    } catch (err) {
      if (gen === s.gen) this._fail(s, `Gagal meminta pairing code: ${err.message}`);
    }
  }

  _onOpen(s) {
    const jid = s.sock?.user?.id || '';
    const number = jid.split('@')[0].split(':')[0];
    if (!/^\d{6,20}$/.test(number)) {
      this._fail(s, 'Tidak dapat membaca nomor WhatsApp yang terhubung.');
      return;
    }
    if (s.pairingPhase && s.phone && number !== s.phone) {
      this.disconnect(s.sid, { reason: 'Nomor yang terhubung berbeda dari nomor yang dimasukkan.' });
      return;
    }
    s.clearTimers();
    s.attempts = 0;
    s.needPairing = false;
    s.pairingPhase = false;
    this._set(s, { status: STATUS.CONNECTED, ownNumber: number, phone: number, code: null, error: null, connectedAt: Date.now() });
  }

  async _onClose(s, lastDisconnect) {
    if (s.stopping) return;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const r = this.reasons;

    if (statusCode === r.loggedOut) {
      await this.disconnect(s.sid, { reason: 'Perangkat dikeluarkan dari WhatsApp. Lakukan pairing ulang.' });
      return;
    }
    if (statusCode === r.restartRequired) {
      // Normal setelah pairing berhasil: WhatsApp meminta socket baru dengan kredensial yang sama.
      s.needPairing = false;
      s.clearTimers();
      this._start(s).catch((err) => this._fail(s, `Gagal memulai ulang koneksi: ${err.message}`));
      return;
    }
    if (s.pairingPhase) {
      this._fail(s, 'Koneksi terputus saat pairing. Coba lagi.');
      return;
    }
    if (statusCode === r.connectionReplaced) {
      this._fail(s, 'Sesi digantikan oleh koneksi lain.');
      return;
    }
    if (statusCode === r.badSession) {
      this._fail(s, 'Sesi rusak. Lakukan Disconnect lalu pairing ulang.');
      return;
    }

    s.attempts += 1;
    if (s.attempts > MAX_RECONNECT_ATTEMPTS) {
      this._fail(s, 'Gagal tersambung kembali setelah beberapa percobaan.');
      return;
    }
    this._set(s, { status: STATUS.RECONNECTING, connectedAt: null, error: null });
    const delay = Math.min(30_000, 1000 * 2 ** s.attempts);
    s.setTimer(() => this._start(s).catch((err) => this._fail(s, `Gagal tersambung kembali: ${err.message}`)), delay);
  }

  _fail(s, message) {
    s.gen += 1;
    s.clearTimers();
    const sock = s.sock;
    s.sock = null;
    try {
      sock?.end(undefined);
    } catch {
      /* abaikan */
    }
    this._set(s, { status: STATUS.ERROR, code: null, connectedAt: null, error: message, needPairing: false, pairingPhase: false });
  }

  _onMessages(s, { messages, type }) {
    if (type !== 'notify') return;
    for (const msg of messages || []) {
      handleIncoming({ sock: s.sock, msg, session: s }).catch((err) => console.error('[wa] handler error:', err));
    }
  }
}

const manager = new SessionManager();

module.exports = { manager, SessionManager, Session, ManagerError, STATUS, MAX_MESSAGE_AGE_S };
