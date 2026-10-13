'use strict';

const { db } = require('../database');

const PRIVATE_SCOPE = 'private';
const scopeOf = (ctx) => (ctx.isGroup ? ctx.jid : PRIVATE_SCOPE);

function record(number, scope, game, { win = false, points = 0 } = {}) {
  db.prepare(
    `INSERT INTO game_scores (number, scope, game, plays, wins, points) VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(number, scope, game) DO UPDATE SET plays = plays + 1, wins = wins + excluded.wins, points = points + excluded.points`
  ).run(number, scope, game, win ? 1 : 0, points);
}

function statsFor(number, scope = null) {
  const where = scope ? 'AND scope = ?' : '';
  const params = scope ? [number, scope] : [number];
  const total = db.prepare(`SELECT COALESCE(SUM(plays),0) AS plays, COALESCE(SUM(wins),0) AS wins, COALESCE(SUM(points),0) AS points FROM game_scores WHERE number = ? ${where}`).get(...params);
  const games = db.prepare(`SELECT game, SUM(plays) AS plays, SUM(wins) AS wins, SUM(points) AS points FROM game_scores WHERE number = ? ${where} GROUP BY game ORDER BY points DESC`).all(...params);
  return { ...total, games };
}

const leaderboard = (scope, limit = 10) =>
  db.prepare('SELECT number, SUM(points) AS points, SUM(wins) AS wins, SUM(plays) AS plays FROM game_scores WHERE scope = ? GROUP BY number ORDER BY points DESC, wins DESC LIMIT ?').all(scope, limit);

const globalLeaderboard = (limit = 10) =>
  db.prepare('SELECT number, SUM(points) AS points, SUM(wins) AS wins, SUM(plays) AS plays FROM game_scores GROUP BY number ORDER BY points DESC, wins DESC LIMIT ?').all(limit);

function groupSummary(scope) {
  const t = db.prepare('SELECT COALESCE(SUM(plays),0) AS plays, COALESCE(SUM(wins),0) AS wins, COALESCE(SUM(points),0) AS points, COUNT(DISTINCT number) AS players FROM game_scores WHERE scope = ?').get(scope);
  const byGame = db.prepare('SELECT game, SUM(plays) AS plays FROM game_scores WHERE scope = ? GROUP BY game ORDER BY plays DESC').all(scope);
  return { ...t, byGame };
}

/** Lencana dihitung dari statistik nyata (tidak ada lencana yang "diberikan" tanpa syarat). */
function badges(number) {
  const s = statsFor(number);
  const out = [];
  if (s.plays >= 1) out.push('🎮 Pemula — main 1 game');
  if (s.plays >= 25) out.push('🔥 Pemain Aktif — 25 game');
  if (s.plays >= 100) out.push('🏅 Veteran — 100 game');
  if (s.wins >= 10) out.push('🏆 Juara — 10 kemenangan');
  if (s.wins >= 50) out.push('👑 Raja Game — 50 kemenangan');
  if (s.points >= 1000) out.push('💎 Kolektor Poin — 1000 poin');
  if (s.games.length >= 5) out.push('🧩 Serba Bisa — 5 jenis game');
  return out;
}

module.exports = { PRIVATE_SCOPE, scopeOf, record, statsFor, leaderboard, globalLeaderboard, groupSummary, badges };
