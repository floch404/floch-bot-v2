'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const { db, transaction } = require('../database');

const DAY = 86_400_000;
const MAX_DAYS = 3650;

class PremiumError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PremiumError';
  }
}

function status(number, now = Date.now()) {
  const row = number ? db.prepare('SELECT * FROM premium WHERE number = ?').get(String(number)) : null;
  if (!row) return { active: false, expired: false, startedAt: null, expiresAt: null, remainingMs: 0, source: null };
  const active = row.expires_at > now;
  return {
    active,
    expired: !active,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    remainingMs: Math.max(0, row.expires_at - now),
    source: row.source,
    grantedBy: row.granted_by,
  };
}

function checkDays(days) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new PremiumError(`Jumlah hari harus bilangan bulat 1-${MAX_DAYS}.`);
}

/** Beri/perpanjang Premium. Jika masih aktif, masa berlaku ditambahkan di atas sisa waktu. */
function grant(number, days, grantedBy = null, source = 'manual', now = Date.now()) {
  checkDays(days);
  return transaction(() => {
    const cur = db.prepare('SELECT * FROM premium WHERE number = ?').get(number);
    const base = cur && cur.expires_at > now ? cur.expires_at : now;
    const startedAt = cur && cur.expires_at > now ? cur.started_at : now;
    const expiresAt = base + days * DAY;
    db.prepare(
      `INSERT INTO premium (number, started_at, expires_at, granted_by, source) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(number) DO UPDATE SET started_at = excluded.started_at, expires_at = excluded.expires_at,
         granted_by = excluded.granted_by, source = excluded.source`
    ).run(number, startedAt, expiresAt, grantedBy, source);
    return { number, startedAt, expiresAt };
  });
}

function revoke(number) {
  return db.prepare('DELETE FROM premium WHERE number = ?').run(number).changes > 0;
}

function list({ activeOnly = false, limit = 50 } = {}, now = Date.now()) {
  const where = activeOnly ? 'WHERE expires_at > ?' : '';
  const params = activeOnly ? [now, limit] : [limit];
  return db.prepare(`SELECT number, started_at, expires_at, source FROM premium ${where} ORDER BY expires_at DESC LIMIT ?`).all(...params);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode() {
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `FLOCH-${pick(4)}-${pick(4)}`;
}

function createRedeem(createdBy, days, maxUses = 1, validDays = 30, now = Date.now()) {
  checkDays(days);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) throw new PremiumError('Jumlah pemakaian harus 1-1000.');
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) throw new PremiumError('Masa berlaku kode harus 1-365 hari.');
  const code = randomCode();
  db.prepare('INSERT INTO redeem_codes (code, days, max_uses, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    code,
    days,
    maxUses,
    createdBy,
    now,
    now + validDays * DAY
  );
  return { code, days, maxUses, expiresAt: now + validDays * DAY };
}

/** Tukar kode redeem menjadi hari Premium. Semua pemeriksaan dilakukan di dalam transaksi. */
function redeem(number, rawCode, now = Date.now()) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,30}$/.test(code)) throw new PremiumError('Format kode tidak valid.');
  return transaction(() => {
    const row = db.prepare('SELECT * FROM redeem_codes WHERE code = ?').get(code);
    if (!row) throw new PremiumError('Kode tidak ditemukan.');
    if (row.expires_at && row.expires_at < now) throw new PremiumError('Kode sudah kedaluwarsa.');
    if (row.uses >= row.max_uses) throw new PremiumError('Kode sudah habis dipakai.');
    if (db.prepare('SELECT 1 AS x FROM redemptions WHERE code = ? AND number = ?').get(code, number)) {
      throw new PremiumError('Kamu sudah pernah memakai kode ini.');
    }
    db.prepare('INSERT INTO redemptions (code, number, at) VALUES (?, ?, ?)').run(code, number, now);
    db.prepare('UPDATE redeem_codes SET uses = uses + 1 WHERE code = ?').run(code);
    const res = grant(number, row.days, null, 'redeem', now);
    return { days: row.days, expiresAt: res.expiresAt };
  });
}

/** Benefit Premium yang benar-benar diterapkan oleh kode (bukan klaim kosong). */
function benefits() {
  const l = config.limits;
  return [
    { title: 'Akses command Premium', text: 'Command bertanda ★ (mis. .jws) hanya dapat dipakai Premium aktif.' },
    { title: 'Limit harian lebih besar', text: `Command: ${l.dailyPremium}/hari (Free: ${l.dailyFree}). Game: ${l.gamePremium}/hari (Free: ${l.gameFree}).` },
    { title: 'Bonus .daily lebih besar', text: `+${l.dailyBonusPremium} limit per klaim (Free: +${l.dailyBonusFree}).` },
  ];
}

module.exports = { status, grant, revoke, list, createRedeem, redeem, benefits, PremiumError, DAY, MAX_DAYS };
