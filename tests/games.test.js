'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/games/engine');
const gameService = require('../src/services/game.service');
const games = require('../src/commands/game/games');

const P1 = '6285000000001';
const P2 = '6285000000002';
const mk = () => ({ sock: h.makeSock(), sess: h.session() });
const sa = (t, from, e, group) => h.say(t, { from, sock: e.sock, sess: e.sess, group });
const live = (e, jid) => engine.get({ session: e.sess, jid });
const lastText = (e) => e.sock.sent.at(-1).content.text;

test('.math: jawaban benar memberi poin, salah diabaikan, game kedua ditolak saat berjalan', async () => {
  const e = mk();
  const jid = `${P1}@s.whatsapp.net`;
  await sa('.math', P1, e);
  assert.match(lastText(e), /Math \(easy\)/);
  assert.match((await sa('.math', P1, e)).text, /Masih ada game/);
  const ans = live(e, jid).data.answer;
  await sa(String(ans + 1), P1, e);
  assert.ok(live(e, jid), 'jawaban salah tidak mengakhiri game');
  await sa(String(ans), P1, e);
  assert.match(lastText(e), /benar! \+10 poin/);
  assert.equal(live(e, jid), null);
  assert.equal(gameService.statsFor(P1).wins, 1);
  assert.equal(gameService.statsFor(P1).points, 10);
});

test('.math level tidak valid ditolak; makeMath menghasilkan jawaban yang benar', async () => {
  const e = mk();
  assert.match((await sa('.math impossible', P1, e)).text, /Level:/);
  for (const lv of ['easy', 'medium', 'hard']) for (let i = 0; i < 50; i++) {
    const { q, a } = games.makeMath(lv);
    assert.equal(Function(`"use strict";return (${q.replace(/×/g, '*')})`)(), a, q);
  }
});

for (const [cmd, pts] of [['susunkata', 15], ['tebakkata', 15], ['tebakbendera', 15]]) {
  test(`.${cmd}: jawaban benar menang +${pts}`, async () => {
    const e = mk();
    const from = `62860${Math.floor(Math.random() * 1e8)}`;
    await sa(`.${cmd}`, from, e);
    const s = live(e, `${from}@s.whatsapp.net`);
    assert.ok(s, 'game berjalan');
    await sa('jawabanngawur', from, e);
    assert.ok(live(e, `${from}@s.whatsapp.net`));
    await sa(s.data.answer, from, e);
    assert.match(lastText(e), new RegExp(`\\+${pts} poin`));
    assert.equal(gameService.statsFor(from).wins, 1);
  });
}

test('.tictactoe: lawan bot sampai selesai; stop oleh pemulai', async () => {
  const e = mk();
  const jid = `${P1}@s.whatsapp.net`;
  await sa('.tictactoe', P1, e);
  for (let i = 0; i < 9 && live(e, jid); i++) {
    const b = live(e, jid).data.board;
    const free = b.findIndex((c) => !c);
    await sa(String(free + 1), P1, e);
  }
  assert.equal(live(e, jid), null, 'game selesai');
  assert.match(e.sock.texts(), /menang|seri|Bot menang/);
  await sa('.tictactoe', P1, e);
  assert.match((await sa('.tictactoe stop', P1, e)).text, /dihentikan/);
});

test('tictactoe: winnerOf dan botMove (menang/blok)', () => {
  assert.equal(games.winnerOf(['X', 'X', 'X', null, null, null, null, null, null]), 'X');
  assert.equal(games.winnerOf(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), 'draw');
  assert.equal(games.botMove(['O', 'O', null, 'X', 'X', null, null, null, null]), 2, 'bot menang dulu');
  assert.equal(games.botMove(['X', 'X', null, 'O', null, null, null, null, null]), 2, 'bot memblok');
});

test('.tebakbom: bom kalah, semua aman menang +30; orang lain tidak bisa ikut main', async () => {
  const e = mk();
  const jid = `${P2}@s.whatsapp.net`;
  await sa('.tebakbom', P2, e);
  const { bomb } = live(e, jid).data;
  await sa(String(bomb + 1), P2, e);
  assert.match(lastText(e), /BOOM/);
  await sa('.tebakbom', P2, e);
  const b2 = live(e, jid).data.bomb;
  for (let i = 0; i < 9; i++) if (i !== b2) await sa(String(i + 1), P2, e);
  assert.match(lastText(e), /\+30 poin/);
});

test('.gamestats .profilegame .badges .gamelimit .leaderboard .globalleaderboard', async () => {
  const e = mk();
  const r = await sa('.gamestats', P1, e);
  assert.match(r.text, /Statistik game[\s\S]*Main: \d+/);
  assert.match((await sa('.profilegame', P1, e)).text, /Lencana/);
  assert.match((await sa('.badges', P1, e)).text, /Lencana/);
  assert.match((await sa('.gamelimit', P1, e)).text, /Limit game: \d+\/\d+/);
  assert.match((await sa('.leaderboard', P1, e)).text, /Leaderboard|Belum ada/);
  assert.match((await sa('.globalleaderboard', P1, e)).text, /Leaderboard global/);
});

test('.groupstats dan .groupmvp memakai data grup nyata; ditolak di chat pribadi', async () => {
  const e = mk();
  assert.match((await sa('.groupstats', P1, e)).text, /hanya dapat dipakai di dalam grup/);
  const G = '120363111111111111@g.us';
  const e2 = mk();
  assert.match((await sa('.groupstats', P1, e2, G)).text, /Belum ada aktivitas/);
  assert.match((await sa('.groupmvp', P1, e2, G)).text, /Belum ada data/);
  gameService.record(P1, G, 'math', { win: true, points: 10 });
  gameService.record(P2, G, 'math', { win: true, points: 30 });
  assert.match((await sa('.groupstats', P1, e2, G)).text, /Pemain: 2 · Total main: 2/);
  assert.match((await sa('.groupmvp', P1, e2, G)).text, /MVP grup[\s\S]*30 poin/);
});

test('limit game habis menolak game baru dan tidak menghabisi limit saat game gagal dimulai', async () => {
  const e = mk();
  const from = '6285000000099';
  await sa('.math', from, e);
  await sa('.math', from, e); // ditolak: game masih berjalan -> limit dikembalikan
  const s = require('../src/services/limit.service').status(from, 'game');
  assert.equal(s.remaining, s.cap - 1);
});

test('.susunkata .tebakkata .tebakbendera menampilkan soal; game kedua di chat yang sama ditolak', async () => {
  for (const c of ['.susunkata', '.tebakkata', '.tebakbendera']) {
    const e = mk();
    const from = `62861${Math.floor(Math.random() * 1e7)}`;
    assert.match((await sa(c, from, e)).text, /detik/, c);
    assert.match((await sa(c, from, e)).text, /Masih ada game/, c);
  }
});
