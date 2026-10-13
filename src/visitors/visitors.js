'use strict';

/**
 * Sesi pengunjung ANONIM untuk website pairing. Tidak ada akun/login: setiap pengunjung yang memulai pairing
 * mendapat cookie acak (HttpOnly, SameSite=Strict). Cookie itulah satu-satunya "kunci" ke sesi WhatsApp miliknya,
 * sehingga pengunjung lain tidak bisa melihat atau mengendalikan sesi tersebut.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const config = require('../config');
const { db } = require('../database');

const COOKIE_NAME = 'fb_vid';
const TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

// ID di database/disk adalah HMAC dari token: pencuri database tidak mendapat token yang berlaku.
const idOf = (token) => crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex').slice(0, 32);

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k && !(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

function cookieAttrs(maxAgeSec) {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
  if (config.cookieSecure) attrs.push('Secure');
  return attrs.join('; ');
}

/** ID pengunjung dari header Cookie, atau null jika tidak ada/tidak dikenal. */
function idFromCookieHeader(header) {
  const token = parseCookies(header)[COOKIE_NAME];
  if (!token || !TOKEN_RE.test(token)) return null;
  const id = idOf(token);
  const row = db.prepare('SELECT id, last_seen FROM visitors WHERE id = ?').get(id);
  if (!row) return null;
  const now = Date.now();
  if (now - row.last_seen > 60_000) db.prepare('UPDATE visitors SET last_seen = ? WHERE id = ?').run(now, id);
  return id;
}

/** Buat pengunjung baru dan pasang cookie pada response. */
function issue(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = idOf(token);
  const now = Date.now();
  db.prepare('INSERT INTO visitors (id, created_at, last_seen) VALUES (?, ?, ?)').run(id, now, now);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${cookieAttrs(Math.floor(config.site.visitorTtlMs / 1000))}`);
  return id;
}

/** Middleware: isi req.visitorId (atau null). Tidak membuat pengunjung baru. */
function attach(req, res, next) {
  req.visitorId = idFromCookieHeader(req.headers.cookie);
  next();
}

/** Hapus pengunjung kedaluwarsa yang tidak punya sesi bot aktif, beserta sisa file autentikasinya. */
function sweep(now = Date.now()) {
  const cutoff = now - config.site.visitorTtlMs;
  const stale = db
    .prepare(
      `SELECT v.id FROM visitors v LEFT JOIN wa_sessions w ON w.id = v.id
       WHERE v.last_seen < ? AND (w.status IS NULL OR w.status NOT IN ('connected','reconnecting','connecting','waiting_pairing'))`
    )
    .all(cutoff);
  for (const { id } of stale) {
    db.prepare('DELETE FROM visitors WHERE id = ?').run(id);
    fs.rmSync(`${config.waSessionsDir}/${id}`, { recursive: true, force: true });
  }
  return stale.length;
}

module.exports = { COOKIE_NAME, idOf, parseCookies, idFromCookieHeader, issue, attach, sweep };
