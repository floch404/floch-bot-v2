'use strict';

const groupService = require('../../services/group.service');
const statsService = require('../../services/stats.service');
const { warnMember } = require('../../core/moderation');
const { firstTarget } = require('../../core/targets');
const { UserError } = require('../../core/executor');
const { toJid } = require('../../utils/jid');
const { participantsAction } = require('./_helpers');

const base = { category: 'GROUP', groupOnly: true, groupAdmin: true };
const target = (ctx) => {
  const t = firstTarget(ctx);
  if (!t) throw new UserError(`Target tidak ditemukan. Tag/reply pengguna atau tulis nomornya.\nPenggunaan: ${ctx.prefix}${ctx.commandName} <@tag|nomor>`);
  return t;
};
/** Admin grup / bot / Owner tidak boleh menjadi target hukuman. */
async function guardTarget(ctx, n) {
  const g = await ctx.group();
  if (n === ctx.session.ownNumber) throw new UserError('Tidak bisa menindak bot sendiri.');
  if (g.adminNumbers.has(n)) throw new UserError('Tidak bisa menindak admin grup.');
  if (require('../../services/role.service').resolve(n).isOwner) throw new UserError('Tidak bisa menindak Owner bot.');
  return g;
}
const mention = (n) => ({ mentions: [toJid(n)] });
const list = (rows, label) => (rows.length ? `*${label} (${rows.length})*\n${rows.map((r) => `• @${r.number}${r.count ? ` — ${r.count}` : ''}`).join('\n')}` : `Tidak ada ${label.toLowerCase()}.`);

module.exports = [
  {
    ...base,
    name: 'warn',
    display: 'Warn',
    description: 'Beri peringatan ke anggota (mencapai batas = dikeluarkan jika bot admin)',
    usage: '.warn <@tag|nomor> [alasan]',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = target(ctx);
      await guardTarget(ctx, t);
      const reason = ctx.args.filter((a) => !/^@?\+?\d{6,}$/.test(a)).join(' ') || 'tanpa alasan';
      await warnMember(ctx, t, reason.slice(0, 100));
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    name: 'warnings',
    display: 'Warnings',
    description: 'Cek jumlah peringatan seorang anggota (atau dirimu)',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = firstTarget(ctx) || ctx.sender;
      if (!t) throw new UserError('Pengguna tidak dapat dikenali.');
      await ctx.send({ text: `@${t}: ${groupService.getWarnings(ctx.jid, t)}/${groupService.get(ctx.jid).warnLimit} peringatan.`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'resetwarn',
    display: 'ResetWarn',
    description: 'Reset peringatan anggota',
    usage: '.resetwarn <@tag|nomor>',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = target(ctx);
      const had = groupService.resetWarnings(ctx.jid, t);
      await ctx.send({ text: had ? `✅ Peringatan @${t} direset.` : `@${t} tidak punya peringatan.`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'listwarning',
    display: 'ListWarning',
    description: 'Daftar anggota yang punya peringatan',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const rows = groupService.listWarnings(ctx.jid);
      await ctx.send({ text: list(rows, 'Peringatan'), mentions: rows.map((r) => toJid(r.number)) });
    },
  },
  {
    ...base,
    name: 'mutemember',
    display: 'MuteMember',
    description: 'Bisukan anggota: pesannya dihapus otomatis (bot harus admin)',
    usage: '.mutemember <@tag|nomor>',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = target(ctx);
      const g = await guardTarget(ctx, t);
      groupService.addMute(ctx.jid, t, ctx.sender);
      await ctx.send({ text: `🔇 @${t} dibisukan.${g.botIsAdmin ? '' : '\n⚠️ Bot bukan admin sehingga belum bisa menghapus pesannya.'}`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'unmutemember',
    display: 'UnmuteMember',
    description: 'Cabut pembisuan anggota',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = target(ctx);
      await ctx.send({ text: groupService.removeMute(ctx.jid, t) ? `🔊 @${t} tidak lagi dibisukan.` : `@${t} tidak sedang dibisukan.`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'listmute',
    display: 'ListMute',
    description: 'Daftar anggota yang dibisukan',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const rows = groupService.listMutes(ctx.jid);
      await ctx.send({ text: list(rows, 'Dibisukan'), mentions: rows.map((r) => toJid(r.number)) });
    },
  },
  {
    ...base,
    name: 'banmember',
    display: 'BanMember',
    description: 'Ban anggota dari grup: dikeluarkan dan dikeluarkan lagi bila masuk (bot admin)',
    usage: '.banmember <@tag|nomor>',
    botAdmin: true,
    status: 'implemented',
    async run(ctx) {
      const t = target(ctx);
      await guardTarget(ctx, t);
      groupService.addBan(ctx.jid, t, ctx.sender);
      let removed = false;
      try {
        const { ok } = await participantsAction(ctx, [t], 'remove');
        removed = ok.includes(t);
      } catch {
        /* mungkin sudah tidak di grup */
      }
      await ctx.send({ text: `⛔ @${t} masuk daftar ban grup.${removed ? ' Dan dikeluarkan.' : ''}`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'unbanmember',
    display: 'UnbanMember',
    description: 'Cabut ban anggota grup',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const t = target(ctx);
      await ctx.send({ text: groupService.removeBan(ctx.jid, t) ? `✅ Ban @${t} dicabut.` : `@${t} tidak ada di daftar ban.`, ...mention(t) });
    },
  },
  {
    ...base,
    name: 'listbanmember',
    display: 'ListBanMember',
    description: 'Daftar anggota yang di-ban dari grup ini',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const rows = groupService.listBans(ctx.jid);
      await ctx.send({ text: list(rows, 'Ban grup'), mentions: rows.map((r) => toJid(r.number)) });
    },
  },
  {
    ...base,
    name: 'banchat',
    display: 'BanChat',
    description: 'Bot mengabaikan semua command di grup ini (hanya Owner yang dapat memakai bot)',
    permission: 'public',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      groupService.banChat(ctx.jid, ctx.sender);
      await ctx.reply('⛔ Chat ini diban. Bot hanya merespons Owner. Cabut dengan .unbanchat (Owner).');
    },
  },
  {
    category: 'GROUP',
    name: 'unbanchat',
    display: 'UnbanChat',
    description: 'Cabut ban chat (Owner)',
    permission: 'owner',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const jid = ctx.args[0]?.includes('@') ? ctx.args[0] : ctx.jid;
      await ctx.reply(groupService.unbanChat(jid) ? '✅ Ban chat dicabut.' : 'Chat ini tidak sedang diban.');
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    name: 'topactive',
    display: 'TopActive',
    description: 'Anggota paling aktif (jumlah pesan sejak bot bergabung)',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const rows = statsService.topActive(ctx.jid, 10);
      if (!rows.length) return ctx.reply('Belum ada data aktivitas.');
      await ctx.send({ text: `*Paling aktif*\n${rows.map((r, i) => `${i + 1}. @${r.number} — ${r.count} pesan`).join('\n')}`, mentions: rows.map((r) => toJid(r.number)) });
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    groupAdmin: true,
    name: 'listaktif',
    display: 'ListAktif',
    description: 'Anggota yang pernah terlihat mengirim pesan (data sejak bot bergabung)',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const rows = statsService.topActive(ctx.jid, 30);
      await ctx.send({ text: rows.length ? `*Aktif (${rows.length})*\n${rows.map((r) => `• @${r.number} (${r.count})`).join('\n')}` : 'Belum ada data aktivitas.', mentions: rows.map((r) => toJid(r.number)) });
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    groupAdmin: true,
    name: 'sider',
    display: 'Sider',
    description: 'Anggota yang belum pernah terlihat mengirim pesan sejak bot bergabung',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const g = await ctx.group();
      const seen = statsService.chatMessageCounts(ctx.jid);
      const silent = g.participants.filter((p) => p.number && !seen.has(p.number) && p.number !== ctx.session.ownNumber).slice(0, 50);
      await ctx.send({ text: silent.length ? `*Belum terlihat aktif (${silent.length})*\n${silent.map((p) => `• @${p.number}`).join('\n')}\n\nCatatan: hanya berdasarkan pesan yang dilihat bot sejak bergabung.` : 'Semua anggota pernah terlihat aktif.', mentions: silent.map((p) => toJid(p.number)) });
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    name: 'gstats',
    display: 'GStats',
    description: 'Statistik pesan grup ini',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const g = await ctx.group();
      await ctx.reply(`*${g.subject}*\nAnggota: ${g.size}\nTotal pesan terlihat: ${statsService.chatTotal(ctx.jid)}\nPesanmu: ${ctx.sender ? statsService.messageCount(ctx.jid, ctx.sender) : 0}`);
    },
  },
];
