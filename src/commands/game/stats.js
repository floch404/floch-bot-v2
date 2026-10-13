'use strict';

const config = require('../../config');
const gameService = require('../../services/game.service');
const limitService = require('../../services/limit.service');
const { maskNumber } = require('../../utils/format');
const { firstTarget } = require('../../core/targets');
const { UserError } = require('../../core/executor');

const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
const board = (rows) => rows.map((r, i) => `${medal(i)} ${maskNumber(r.number)} — ${r.points} poin · ${r.wins} menang / ${r.plays} main`).join('\n');
const who = (ctx) => firstTarget(ctx, { fromArgs: false }) || ctx.sender;

module.exports = [
  {
    name: 'gamestats',
    display: 'GameStats',
    category: 'GAME',
    description: 'Statistik game kamu (atau yang di-tag)',
    status: 'tested',
    examples: [{ args: '', expect: /Statistik game[\s\S]*Main: \d+/ }],
    async run(ctx) {
      const t = who(ctx);
      if (!t) throw new UserError('Pengguna tidak dapat dikenali.');
      const s = gameService.statsFor(t);
      const lines = [`*Statistik game ${maskNumber(t)}*`, `Main: ${s.plays} · Menang: ${s.wins} · Poin: ${s.points}`];
      for (const g of s.games.slice(0, 8)) lines.push(`• ${g.game}: ${g.points} poin (${g.wins}/${g.plays})`);
      await ctx.reply(lines.join('\n'));
    },
  },
  {
    name: 'profilegame',
    display: 'ProfileGame',
    category: 'GAME',
    description: 'Profil game: statistik + lencana',
    status: 'tested',
    examples: [{ args: '', expect: /Profil game[\s\S]*Lencana/ }],
    async run(ctx) {
      const t = who(ctx);
      if (!t) throw new UserError('Pengguna tidak dapat dikenali.');
      const s = gameService.statsFor(t);
      const b = gameService.badges(t);
      await ctx.reply([`*Profil game ${maskNumber(t)}*`, `Main ${s.plays} · Menang ${s.wins} · Poin ${s.points}`, '', '*Lencana*', ...(b.length ? b : ['Belum ada lencana. Mainkan game untuk mendapatkannya!'])].join('\n'));
    },
  },
  {
    name: 'badges',
    display: 'Badges',
    category: 'GAME',
    description: 'Lencana game (dihitung dari statistik nyata)',
    status: 'tested',
    examples: [{ args: '', expect: /Lencana/ }],
    async run(ctx) {
      const t = who(ctx);
      if (!t) throw new UserError('Pengguna tidak dapat dikenali.');
      const b = gameService.badges(t);
      await ctx.reply(['*Lencana*', ...(b.length ? b : ['Belum ada lencana.'])].join('\n'));
    },
  },
  {
    name: 'gamelimit',
    display: 'GameLimit',
    category: 'GAME',
    description: 'Sisa limit game harianmu',
    status: 'tested',
    examples: [{ args: '', expect: /Limit game: \d+\/\d+/ }],
    async run(ctx) {
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali.');
      const s = limitService.status(ctx.sender, 'game', { unlimited: ctx.role.isOwner });
      await ctx.reply(`Limit game: ${s.unlimited ? 'tanpa batas' : `${s.remaining}/${s.cap}`}\nReset harian 00:00 (${config.timezone}). Klaim bonus: .daily`);
    },
  },
  {
    name: 'leaderboard',
    display: 'Leaderboard',
    category: 'GAME',
    description: 'Peringkat poin di grup ini / chat pribadi',
    status: 'tested',
    examples: [{ args: '', expect: /Leaderboard|Belum ada data/ }],
    async run(ctx) {
      const rows = gameService.leaderboard(gameService.scopeOf(ctx), 10);
      await ctx.reply(rows.length ? `*Leaderboard ${ctx.isGroup ? 'grup' : 'pribadi'}*\n${board(rows)}` : 'Belum ada data skor di sini. Mainkan game dulu!');
    },
  },
  {
    name: 'globalleaderboard',
    display: 'GlobalLeaderboard',
    category: 'GAME',
    description: 'Peringkat poin seluruh pengguna bot',
    status: 'tested',
    examples: [{ args: '', expect: /Leaderboard global|Belum ada data/ }],
    async run(ctx) {
      const rows = gameService.globalLeaderboard(10);
      await ctx.reply(rows.length ? `*Leaderboard global*\n${board(rows)}` : 'Belum ada data skor.');
    },
  },
  {
    name: 'groupstats',
    display: 'GroupStats',
    category: 'GAME',
    description: 'Statistik game grup ini',
    groupOnly: true,
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const s = gameService.groupSummary(ctx.jid);
      if (!s.plays) return ctx.reply('Belum ada aktivitas game di grup ini.');
      await ctx.reply([`*Statistik game grup*`, `Pemain: ${s.players} · Total main: ${s.plays} · Total menang: ${s.wins} · Total poin: ${s.points}`, ...s.byGame.slice(0, 6).map((g) => `• ${g.game}: ${g.plays}x`)].join('\n'));
    },
  },
  {
    name: 'groupmvp',
    display: 'GroupMVP',
    category: 'GAME',
    description: 'Pemain dengan poin terbanyak di grup ini',
    groupOnly: true,
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const [top] = gameService.leaderboard(ctx.jid, 1);
      if (!top) return ctx.reply('Belum ada data game di grup ini.');
      await ctx.reply(`🏆 *MVP grup*: ${maskNumber(top.number)}\n${top.points} poin · ${top.wins} menang / ${top.plays} main`);
    },
  },
];
