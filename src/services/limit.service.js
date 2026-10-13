'use strict';

const config = require('../config');
const { db, transaction } = require('../database');
const premiumService = require('./premium.service');
const { dayKey } = require('../utils/format');

const today = (date = new Date()) => dayKey(date, config.timezone);

function capFor(number, kind) {
  const prem = premiumService.status(number).active;
  const l = config.limits;
  if (kind === 'game') return prem ? l.gamePremium : l.gameFree;
  return prem ? l.dailyPremium : l.dailyFree;
}

function row(number, kind, day) {
  return db.prepare('SELECT used, bonus FROM usage WHERE number = ? AND day = ? AND kind = ?').get(number, day, kind) || { used: 0, bonus: 0 };
}

/** unlimited=true untuk Owner. */
function status(number, kind = 'cmd', { unlimited = false } = {}) {
  if (unlimited) return { unlimited: true, used: 0, cap: Infinity, remaining: Infinity, kind };
  const day = today();
  const r = row(number, kind, day);
  const cap = capFor(number, kind) + r.bonus;
  return { unlimited: false, used: r.used, bonus: r.bonus, cap, remaining: Math.max(0, cap - r.used), kind };
}

/** Pakai `cost` limit secara atomik. Mengembalikan { ok, remaining }. */
function consume(number, kind, cost = 1, { unlimited = false } = {}) {
  if (unlimited || cost <= 0) return { ok: true, remaining: unlimited ? Infinity : status(number, kind).remaining };
  return transaction(() => {
    const day = today();
    const r = row(number, kind, day);
    const cap = capFor(number, kind) + r.bonus;
    if (r.used + cost > cap) return { ok: false, remaining: Math.max(0, cap - r.used) };
    db.prepare(
      `INSERT INTO usage (number, day, kind, used, bonus) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(number, day, kind) DO UPDATE SET used = used + excluded.used`
    ).run(number, day, kind, cost);
    return { ok: true, remaining: cap - r.used - cost };
  });
}

/** Kembalikan limit jika command gagal sebelum memberi hasil. */
function refund(number, kind, cost = 1) {
  if (cost <= 0) return;
  db.prepare('UPDATE usage SET used = MAX(0, used - ?) WHERE number = ? AND day = ? AND kind = ?').run(cost, number, today(), kind);
}

function addBonus(number, amount, kind = 'cmd') {
  db.prepare(
    `INSERT INTO usage (number, day, kind, used, bonus) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(number, day, kind) DO UPDATE SET bonus = bonus + excluded.bonus`
  ).run(number, today(), kind, amount);
}

/** Klaim harian: sekali per hari (zona waktu bot). Mengembalikan { ok, amount, streak } atau { ok:false, ... }. */
function claimDaily(number, date = new Date()) {
  return transaction(() => {
    const day = today(date);
    const cur = db.prepare('SELECT * FROM daily_claims WHERE number = ?').get(number);
    if (cur && cur.last_day === day) return { ok: false, streak: cur.streak, total: cur.total };
    const yesterday = today(new Date(date.getTime() - 86_400_000));
    const streak = cur && cur.last_day === yesterday ? cur.streak + 1 : 1;
    const total = (cur?.total || 0) + 1;
    const prem = premiumService.status(number).active;
    const base = prem ? config.limits.dailyBonusPremium : config.limits.dailyBonusFree;
    const amount = base + Math.min(streak - 1, 6) * 2;
    db.prepare(
      `INSERT INTO daily_claims (number, last_day, streak, total) VALUES (?, ?, ?, ?)
       ON CONFLICT(number) DO UPDATE SET last_day = excluded.last_day, streak = excluded.streak, total = excluded.total`
    ).run(number, day, streak, total);
    db.prepare(
      `INSERT INTO usage (number, day, kind, used, bonus) VALUES (?, ?, 'cmd', 0, ?)
       ON CONFLICT(number, day, kind) DO UPDATE SET bonus = bonus + excluded.bonus`
    ).run(number, day, amount);
    return { ok: true, amount, streak, total };
  });
}

module.exports = { status, consume, refund, addBonus, claimDaily, capFor, today };
