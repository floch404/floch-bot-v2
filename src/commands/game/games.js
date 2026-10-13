'use strict';

const crypto = require('node:crypto');
const engine = require('../../games/engine');
const gameService = require('../../services/game.service');
const { WORDS, FLAGS, norm } = require('../../games/data');
const { UserError } = require('../../core/executor');
const { targetsOf } = require('../../core/targets');
const { toJid } = require('../../utils/jid');

const rand = (n) => crypto.randomInt(n);
const pick = (a) => a[rand(a.length)];
const tag = (n) => ({ mentions: [toJid(n)] });

function begin(ctx, def) {
  const s = engine.start(ctx, def);
  if (!s) throw new UserError(engine.BUSY_MESSAGE);
  return s;
}

/** Pemenang mendapat poin & kemenangan; sesi berakhir. */
async function award(ctx, s, points) {
  engine.end(ctx);
  gameService.record(ctx.sender, gameService.scopeOf(ctx), s.game, { win: true, points });
  await ctx.send({ text: `✅ @${ctx.sender} benar! +${points} poin`, ...tag(ctx.sender) });
}
/** Waktu habis: pemulai game tetap tercatat bermain (tanpa poin). */
const expire = (s, text) => {
  if (s.starter) gameService.record(s.starter, s.isGroup ? s.jid : gameService.PRIVATE_SCOPE, s.game, { win: false, points: 0 });
  return text;
};

// ---------- Math ----------
const LEVELS = { easy: 10, medium: 20, hard: 30 };
function makeMath(level = 'easy', rnd = rand) {
  const r = (a, b) => a + rnd(b - a + 1);
  if (level === 'easy') {
    const a = r(1, 30);
    const b = r(1, 30);
    const sub = rnd(2) === 1;
    return sub ? { q: `${Math.max(a, b)} - ${Math.min(a, b)}`, a: Math.abs(a - b) } : { q: `${a} + ${b}`, a: a + b };
  }
  if (level === 'medium') {
    const a = r(2, 12);
    const b = r(2, 12);
    const c = r(1, 50);
    return { q: `${a} × ${b} + ${c}`, a: a * b + c };
  }
  const a = r(2, 15);
  const b = r(2, 15);
  const c = r(2, 9);
  const d = r(1, 40);
  return { q: `(${a} + ${b}) × ${c} - ${d}`, a: (a + b) * c - d };
}

// ---------- Tic Tac Toe ----------
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winnerOf = (b) => {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
  return b.every(Boolean) ? 'draw' : null;
};
/** Bot: menang jika bisa, blok lawan, ambil tengah, sudut, lalu sisanya. */
function botMove(board, me = 'O', foe = 'X', rnd = rand) {
  const tryLine = (who) => {
    for (const line of LINES) {
      const cells = line.map((i) => board[i]);
      if (cells.filter((c) => c === who).length === 2 && cells.includes(null)) return line[cells.indexOf(null)];
    }
    return -1;
  };
  let m = tryLine(me);
  if (m < 0) m = tryLine(foe);
  if (m < 0 && !board[4]) m = 4;
  if (m < 0) {
    const corners = [0, 2, 6, 8].filter((i) => !board[i]);
    if (corners.length) m = corners[rnd(corners.length)];
  }
  if (m < 0) {
    const free = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    m = free[rnd(free.length)];
  }
  return m;
}
const renderBoard = (b) => {
  const sym = (c, i) => (c === 'X' ? '❌' : c === 'O' ? '⭕' : ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][i]);
  return [0, 3, 6].map((r) => [0, 1, 2].map((c) => sym(b[r + c], r + c)).join('')).join('\n');
};

// ---------- Tebak Bom ----------
const BOMB_CELLS = 9;
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const renderBombs = (opened, bomb, reveal) => [0, 3, 6].map((r) => [0, 1, 2].map((c) => {
  const i = r + c;
  if (reveal && i === bomb) return '💥';
  return opened.has(i) ? '✅' : NUM[i];
}).join('')).join('\n');

module.exports = [
  {
    name: 'math',
    display: 'Math',
    category: 'GAME',
    description: 'Soal matematika cepat (easy/medium/hard)',
    usage: '.math [easy|medium|hard]',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const level = (ctx.args[0] || 'easy').toLowerCase();
      if (!LEVELS[level]) throw new UserError('Level: easy, medium, atau hard.');
      const { q, a } = makeMath(level);
      begin(ctx, {
        game: 'math',
        timeoutMs: 45_000,
        data: { answer: a },
        onMessage: async (c, s) => {
          if (!c.sender || !/^-?\d{1,9}$/.test(c.text.trim())) return false;
          if (parseInt(c.text.trim(), 10) !== s.data.answer) return false;
          await award(c, s, LEVELS[level]);
          return true;
        },
        onExpire: (s) => expire(s, `⏰ Waktu habis! Jawabannya: ${a}`),
      });
      await ctx.reply(`🧮 *Math (${level})* — 45 detik\nBerapa hasil dari: *${q}* ?\nKetik jawabannya langsung (angka).`);
    },
  },
  {
    name: 'susunkata',
    display: 'SusunKata',
    category: 'GAME',
    description: 'Susun huruf acak menjadi kata yang benar',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const [word, hint] = pick(WORDS);
      let scr = word;
      for (let i = 0; i < 10 && scr === word; i++) scr = [...word].sort(() => rand(3) - 1).join('');
      begin(ctx, {
        game: 'susunkata',
        timeoutMs: 60_000,
        data: { answer: word },
        onMessage: async (c, s) => {
          if (!c.sender || norm(c.text) !== s.data.answer) return false;
          await award(c, s, 15);
          return true;
        },
        onExpire: (s) => expire(s, `⏰ Waktu habis! Jawabannya: *${word}*`),
      });
      await ctx.reply(`🔤 *Susun Kata* — 60 detik\nHuruf: *${scr.toUpperCase()}*\nPetunjuk: ${hint}\nKetik kata yang benar.`);
    },
  },
  {
    name: 'tebakkata',
    display: 'TebakKata',
    category: 'GAME',
    description: 'Tebak kata dari petunjuk dan huruf pertama',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const [word, hint] = pick(WORDS);
      const mask = [...word].map((ch, i) => (i === 0 ? ch.toUpperCase() : '_')).join(' ');
      begin(ctx, {
        game: 'tebakkata',
        timeoutMs: 60_000,
        data: { answer: word },
        onMessage: async (c, s) => {
          if (!c.sender || norm(c.text) !== s.data.answer) return false;
          await award(c, s, 15);
          return true;
        },
        onExpire: (s) => expire(s, `⏰ Waktu habis! Jawabannya: *${word}*`),
      });
      await ctx.reply(`❓ *Tebak Kata* — 60 detik\nPetunjuk: ${hint}\n${mask} (${word.length} huruf)`);
    },
  },
  {
    name: 'tebakbendera',
    display: 'TebakBendera',
    category: 'GAME',
    description: 'Tebak negara dari emoji bendera',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      const f = pick(FLAGS);
      const accepted = f.names.map(norm);
      begin(ctx, {
        game: 'tebakbendera',
        timeoutMs: 45_000,
        data: { answer: f.names[0] },
        onMessage: async (c, s) => {
          if (!c.sender || !accepted.includes(norm(c.text))) return false;
          await award(c, s, 15);
          return true;
        },
        onExpire: (s) => expire(s, `⏰ Waktu habis! Itu bendera *${f.names[0]}* ${f.flag}`),
      });
      await ctx.reply(`🏳️ *Tebak Bendera* — 45 detik\nBendera negara apa ini? ${f.flag}`);
    },
  },
  {
    name: 'tictactoe',
    display: 'TicTacToe',
    category: 'GAME',
    description: 'Tic-tac-toe melawan bot, atau lawan teman dengan tag',
    usage: '.tictactoe [@lawan] | .tictactoe stop',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      if (ctx.args[0]?.toLowerCase() === 'stop') {
        const s = engine.get(ctx);
        if (!s || s.game !== 'tictactoe') throw new UserError('Tidak ada permainan tic-tac-toe yang berjalan.');
        if (ctx.sender !== s.starter && !ctx.role.isOwner) throw new UserError('Hanya pemulai game yang dapat menghentikannya.');
        engine.end(ctx);
        await ctx.reply('Permainan dihentikan.');
        return;
      }
      const opp = targetsOf(ctx, { fromArgs: false })[0] || null;
      if (opp && opp === ctx.sender) throw new UserError('Tidak bisa melawan diri sendiri.');
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot.');
      const players = { X: ctx.sender, O: opp }; // O = null berarti bot
      const state = { board: Array(9).fill(null), turn: 'X' };
      const text = (extra = '') => `⭕❌ *Tic Tac Toe*\n${renderBoard(state.board)}\n${extra}`;
      begin(ctx, {
        game: 'tictactoe',
        timeoutMs: 180_000,
        data: state,
        onMessage: async (c, s) => {
          const mark = state.turn;
          if (c.sender !== players[mark]) return false;
          const m = c.text.trim();
          if (!/^[1-9]$/.test(m)) return false;
          const idx = parseInt(m, 10) - 1;
          if (state.board[idx]) {
            await c.reply('Kotak itu sudah terisi. Pilih angka lain.');
            return true;
          }
          state.board[idx] = mark;
          const finish = async (w) => {
            engine.end(c);
            const scope = gameService.scopeOf(c);
            if (w === 'draw') {
              for (const p of [players.X, players.O].filter(Boolean)) gameService.record(p, scope, 'tictactoe', { win: false, points: 5 });
              await c.send({ text: `${text('Hasil: seri 🤝 (+5 poin untuk pemain)')}` });
            } else if (players[w]) {
              gameService.record(players[w], scope, 'tictactoe', { win: true, points: 25 });
              const loser = players[w === 'X' ? 'O' : 'X'];
              if (loser) gameService.record(loser, scope, 'tictactoe', { win: false, points: 0 });
              await c.send({ text: text(`@${players[w]} menang! +25 poin`), mentions: [toJid(players[w])] });
            } else {
              gameService.record(players.X, scope, 'tictactoe', { win: false, points: 0 });
              await c.send({ text: text('Bot menang 🤖') });
            }
          };
          let w = winnerOf(state.board);
          if (w) {
            await finish(w);
            return true;
          }
          state.turn = mark === 'X' ? 'O' : 'X';
          if (players[state.turn] === null) {
            state.board[botMove(state.board, 'O', 'X')] = 'O';
            w = winnerOf(state.board);
            if (w) {
              await finish(w);
              return true;
            }
            state.turn = 'X';
          }
          await c.send({ text: text(`Giliran: @${players[state.turn]} (ketik angka 1-9)`), mentions: [toJid(players[state.turn])] });
          return true;
        },
        onExpire: (s) => expire(s, '⏰ Tic-tac-toe dihentikan karena tidak ada aktivitas.'),
      });
      await ctx.send({ text: text(`${opp ? `@${opp}` : 'Bot'} sebagai ⭕. Giliran: @${ctx.sender} (ketik angka 1-9)`), mentions: [ctx.sender, opp].filter(Boolean).map(toJid) });
    },
  },
  {
    name: 'tebakbom',
    display: 'TebakBom',
    category: 'GAME',
    description: 'Pilih kotak aman; hindari bom virtual 💥',
    limit: 1,
    limitKind: 'game',
    status: 'tested',
    tests: 'tests/games.test.js',
    async run(ctx) {
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot.');
      const bomb = rand(BOMB_CELLS);
      const opened = new Set();
      begin(ctx, {
        game: 'tebakbom',
        timeoutMs: 120_000,
        data: { bomb, opened },
        onMessage: async (c, s) => {
          if (c.sender !== s.starter || !/^[1-9]$/.test(c.text.trim())) return false;
          const i = parseInt(c.text.trim(), 10) - 1;
          if (opened.has(i)) {
            await c.reply('Kotak itu sudah dibuka.');
            return true;
          }
          const scope = gameService.scopeOf(c);
          if (i === bomb) {
            engine.end(c);
            gameService.record(c.sender, scope, 'tebakbom', { win: false, points: 0 });
            await c.reply(`💥 BOOM! Kamu kalah.\n${renderBombs(opened, bomb, true)}`);
            return true;
          }
          opened.add(i);
          if (opened.size === BOMB_CELLS - 1) {
            engine.end(c);
            gameService.record(c.sender, scope, 'tebakbom', { win: true, points: 30 });
            await c.reply(`🎉 Semua kotak aman terbuka! +30 poin\n${renderBombs(opened, bomb, true)}`);
            return true;
          }
          await c.reply(`✅ Aman! (${opened.size}/${BOMB_CELLS - 1})\n${renderBombs(opened, bomb, false)}`);
          return true;
        },
        onExpire: (s) => expire(s, '⏰ Tebak Bom berakhir karena tidak ada aktivitas.'),
      });
      await ctx.reply(`💣 *Tebak Bom* (virtual)\nAda 1 bom di antara 9 kotak. Buka semua kotak aman!\n${renderBombs(opened, bomb, false)}\nKetik angka 1-9.`);
    },
  },
];

module.exports.makeMath = makeMath;
module.exports.winnerOf = winnerOf;
module.exports.botMove = botMove;
