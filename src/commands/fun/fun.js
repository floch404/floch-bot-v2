'use strict';

const crypto = require('node:crypto');
const { UserError } = require('../../core/executor');
const { firstTarget, targetsOf } = require('../../core/targets');
const { toJid } = require('../../utils/jid');

const rand = (n) => crypto.randomInt(n);
const pick = (arr) => arr[rand(arr.length)];
/** Angka 0-100 yang stabil untuk teks yang sama (agar .cek/.ship konsisten, bukan acak tiap kali). */
const stable = (s) => crypto.createHash('sha256').update(s.toLowerCase().trim()).digest().readUInt16BE(0) % 101;

// Fakta umum yang stabil dan mudah diverifikasi.
const FACTS = [
  'Madu hampir tidak pernah basi; madu berusia ribuan tahun yang ditemukan di makam Mesir kuno masih bisa dimakan.',
  'Gurita punya tiga jantung dan darahnya berwarna biru.',
  'Venus berputar searah jarum jam (terbalik dibanding kebanyakan planet) dan satu harinya lebih panjang dari satu tahunnya.',
  'Pisang secara botani termasuk buah beri, sedangkan stroberi bukan.',
  'Menara Eiffel bisa bertambah tinggi hingga sekitar 15 cm di musim panas karena logamnya memuai.',
  'Hiu sudah ada lebih lama daripada pohon.',
  'Otak manusia menggunakan sekitar 20% energi tubuh meski beratnya hanya sekitar 2% dari berat badan.',
  'Wombat menghasilkan kotoran berbentuk kubus.',
  'Indonesia adalah negara kepulauan terbesar di dunia dengan belasan ribu pulau.',
  'Cahaya Matahari butuh sekitar 8 menit untuk sampai ke Bumi.',
  'Sidik jari koala sangat mirip dengan sidik jari manusia.',
  'Air panas bisa membeku lebih cepat daripada air dingin dalam kondisi tertentu (efek Mpemba), meski penyebabnya masih diperdebatkan.',
  'Kupu-kupu merasakan rasa dengan kakinya.',
  'Samudra Pasifik lebih luas daripada seluruh daratan Bumi jika digabungkan.',
  'Jantung udang berada di kepalanya.',
  'Candi Borobudur di Jawa Tengah adalah candi Buddha terbesar di dunia.',
  'Lebah madu dapat mengenali wajah manusia.',
  'Satu hari di Merkurius (satu rotasi terhadap Matahari) berlangsung sekitar 176 hari Bumi.',
];

const ROASTS = [
  'kamu tuh kayak sinyal di lift: ada, tapi pas dibutuhin malah hilang.',
  'kalau rencanamu secerah niat bangun pagi, semuanya pasti berjalan... besok.',
  'kamu itu kayak baterai 1%: semua orang khawatir, tapi tetap dipakai sampai habis.',
  'niat kamu kuat banget, sayang eksekusinya masih loading dari tadi.',
  'kamu kayak wifi gratisan: semua senang, tapi nggak ada yang percaya kecepatannya.',
  'kalau prokrastinasi itu olahraga, kamu pasti sudah atlet nasional.',
  'kamu tuh kayak tombol "snooze": paling sering ditekan, paling jarang berubah.',
  'kamu bukan telat, kamu cuma punya zona waktu sendiri.',
];

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];
const emojiRe = /^\p{Extended_Pictographic}(️)?$/u;

const SUIT = { batu: '✊', gunting: '✌️', kertas: '🖐️' };
const BEATS = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };

module.exports = [
  {
    name: 'dadu',
    display: 'Dadu',
    category: 'FUN',
    description: 'Lempar dadu (1-5 dadu)',
    usage: '.dadu [jumlah]',
    status: 'tested',
    examples: [{ args: '', expect: /^🎲 Hasil: [1-6]$/ }, { args: '3', expect: /^🎲 Hasil: [1-6] \+ [1-6] \+ [1-6] = \d+$/ }, { args: '9', expect: /1-5/ }],
    async run(ctx) {
      const n = ctx.args[0] ? parseInt(ctx.args[0], 10) : 1;
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new UserError('Jumlah dadu harus 1-5.');
      const rolls = Array.from({ length: n }, () => rand(6) + 1);
      await ctx.reply(n === 1 ? `🎲 Hasil: ${rolls[0]}` : `🎲 Hasil: ${rolls.join(' + ')} = ${rolls.reduce((a, b) => a + b, 0)}`);
    },
  },
  {
    name: 'koin',
    display: 'Koin',
    category: 'FUN',
    description: 'Lempar koin',
    status: 'tested',
    examples: [{ args: '', expect: /^🪙 (Gambar|Angka)$/ }],
    async run(ctx) {
      await ctx.reply(`🪙 ${rand(2) ? 'Gambar' : 'Angka'}`);
    },
  },
  {
    name: 'suit',
    display: 'Suit',
    category: 'FUN',
    description: 'Suit batu-gunting-kertas lawan bot',
    usage: '.suit <batu|gunting|kertas>',
    minArgs: 1,
    status: 'tested',
    examples: [{ args: 'batu', expect: /Kamu: ✊ batu\nBot: .* \w+\n(Seri!|Kamu menang!|Bot menang!)/ }, { args: 'sumur', expect: /Pilih: batu, gunting, atau kertas/ }],
    async run(ctx) {
      const me = ctx.args[0].toLowerCase();
      if (!SUIT[me]) throw new UserError('Pilih: batu, gunting, atau kertas.');
      const bot = pick(Object.keys(SUIT));
      const verdict = me === bot ? 'Seri!' : BEATS[me] === bot ? 'Kamu menang!' : 'Bot menang!';
      await ctx.reply(`Kamu: ${SUIT[me]} ${me}\nBot: ${SUIT[bot]} ${bot}\n${verdict}`);
    },
  },
  {
    name: 'cek',
    display: 'Cek',
    category: 'FUN',
    description: 'Cek "seberapa" sesuatu (hiburan, hasil stabil per teks)',
    usage: '.cek <sesuatu>',
    minArgs: 1,
    status: 'tested',
    examples: [{ args: 'ganteng', expect: /^Seberapa ganteng\? \d{1,3}%/ }],
    async run(ctx) {
      const what = ctx.argText.slice(0, 40);
      await ctx.reply(`Seberapa ${what}? ${stable(`${ctx.sender}|${what}`)}%\n(hanya hiburan 😄)`);
    },
  },
  {
    name: 'ship',
    display: 'Ship',
    category: 'FUN',
    description: 'Kecocokan dua orang (hiburan)',
    usage: '.ship <@tag1> <@tag2>',
    status: 'tested',
    examples: [{ args: 'Andi Budi', expect: /Andi ❤️ Budi: \d{1,3}%/ }, { args: '', expect: /Penggunaan: \.ship/ }],
    async run(ctx) {
      const tagged = targetsOf(ctx, { fromArgs: false });
      let a;
      let b;
      if (tagged.length >= 2) [a, b] = tagged;
      else if (tagged.length === 1 && ctx.sender) [a, b] = [ctx.sender, tagged[0]];
      else {
        const words = ctx.args.filter((w) => !w.startsWith('@'));
        if (words.length < 2) throw new UserError('Penggunaan: .ship <@tag1> <@tag2> atau .ship <nama1> <nama2>');
        [a, b] = words;
      }
      const label = (x) => (/^\d{8,15}$/.test(x) ? `@${x}` : x);
      const pct = stable([a, b].map(String).sort().join('+'));
      const mentions = [a, b].filter((x) => /^\d{8,15}$/.test(x)).map(toJid);
      await ctx.send({ text: `${label(a)} ❤️ ${label(b)}: ${pct}%\n(hanya hiburan 😄)`, mentions });
    },
  },
  {
    name: 'fact',
    display: 'Fact',
    category: 'FUN',
    description: 'Fakta acak',
    status: 'tested',
    examples: [{ args: '', expect: /^💡 / }],
    async run(ctx) {
      await ctx.reply(`💡 ${pick(FACTS)}`);
    },
  },
  {
    name: 'roast',
    display: 'Roast',
    category: 'FUN',
    description: 'Ledekan ringan dan lucu (aman, tanpa menyerang identitas)',
    usage: '.roast [@tag]',
    status: 'tested',
    examples: [{ args: '', expect: /^🔥 @\d+, / }],
    async run(ctx) {
      const t = firstTarget(ctx, { fromArgs: false }) || ctx.sender;
      if (!t) throw new UserError('Target tidak dapat dikenali.');
      await ctx.send({ text: `🔥 @${t}, ${pick(ROASTS)}\n(bercanda, ya 😄)`, mentions: [toJid(t)] });
    },
  },
  {
    name: 'reaction',
    display: 'Reaction',
    category: 'FUN',
    description: 'Bot memberi reaksi emoji pada pesan yang di-reply',
    usage: '.reaction [emoji] (reply pesan)',
    status: 'implemented',
    async run(ctx) {
      if (!ctx.quoted?.key?.id) throw new UserError('Reply pesan yang ingin diberi reaksi.');
      const emoji = ctx.args[0] || pick(REACTIONS);
      if (!emojiRe.test(emoji)) throw new UserError('Gunakan satu emoji.');
      await ctx.sock.sendMessage(ctx.jid, { react: { text: emoji, key: ctx.quoted.key } });
    },
  },
];
