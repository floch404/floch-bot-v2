'use strict';

const { toJid } = require('../../utils/jid');
const { normalizePhone } = require('../../utils/format');
const { UserError } = require('../../core/executor');
const { deleteMessage } = require('../../core/moderation');
const { participantsAction, report, groupTargets, cooldown } = require('./_helpers');

const base = { category: 'GROUP', groupOnly: true, groupAdmin: true, status: 'implemented' };
const needsBot = { botAdmin: true };

const memberAction = (name, display, action, verb, description) => ({
  ...base,
  ...needsBot,
  name,
  display,
  description,
  usage: `.${name} <@tag|nomor>`,
  async run(ctx) {
    let numbers = groupTargets(ctx);
    if (name === 'add') numbers = ctx.args.map((a) => normalizePhone(a.replace(/^\+/, ''))).filter((n) => /^\d{8,15}$/.test(n));
    const g = await ctx.group();
    if (action === 'remove') {
      const protectedNumbers = numbers.filter((n) => n === ctx.session.ownNumber || (g.adminNumbers.has(n) && !ctx.role.isOwner));
      if (protectedNumbers.length) throw new UserError('Tidak bisa mengeluarkan bot sendiri atau admin grup lain lewat command ini.');
    }
    const { ok, failed } = await participantsAction(ctx, numbers, action);
    await ctx.send({ text: report(ok, failed, verb), mentions: ok.map(toJid) });
  },
});

const settingsUpdate = (name, display, value, text, description) => ({
  ...base,
  ...needsBot,
  name,
  display,
  description,
  async run(ctx) {
    try {
      await ctx.sock.groupSettingUpdate(ctx.jid, value);
    } catch (err) {
      throw new UserError(`WhatsApp menolak permintaan: ${String(err.message || err).slice(0, 120)}`);
    }
    ctx.invalidateGroup();
    await ctx.reply(text);
  },
});

module.exports = [
  settingsUpdate('open', 'Open', 'not_announcement', '🔓 Grup dibuka: semua anggota bisa mengirim pesan.', 'Buka grup (semua anggota boleh kirim pesan)'),
  settingsUpdate('close', 'Close', 'announcement', '🔒 Grup ditutup: hanya admin yang bisa mengirim pesan.', 'Tutup grup (hanya admin boleh kirim pesan)'),
  memberAction('add', 'Add', 'add', 'Ditambahkan', 'Tambahkan anggota lewat nomor'),
  memberAction('remove', 'Remove', 'remove', 'Dikeluarkan', 'Keluarkan anggota'),
  memberAction('promote', 'Promote', 'promote', 'Dijadikan admin grup', 'Jadikan anggota admin grup'),
  memberAction('demote', 'Demote', 'demote', 'Dicabut dari admin grup', 'Cabut admin grup'),
  {
    ...base,
    ...needsBot,
    name: 'delete',
    display: 'Delete',
    description: 'Hapus pesan yang di-reply (bot harus admin)',
    usage: '.delete (reply pesan)',
    async run(ctx) {
      if (!ctx.quoted?.key?.id) throw new UserError('Reply pesan yang ingin dihapus.');
      const ok = await deleteMessage(ctx, ctx.quoted.key);
      if (!ok) throw new UserError('WhatsApp menolak penghapusan pesan itu.');
    },
  },
  {
    ...base,
    name: 'tagall',
    display: 'TagAll',
    description: 'Mention semua anggota grup (batas 1x per 60 detik)',
    async run(ctx) {
      cooldown(ctx, 'tagall', 60_000);
      const g = await ctx.group();
      const nums = g.participants.map((p) => p.number).filter(Boolean).slice(0, 500);
      const text = [`📢 ${ctx.argText || 'Perhatian semua anggota!'}`, '', ...nums.map((n) => `• @${n}`)].join('\n');
      await ctx.send({ text, mentions: nums.map(toJid) });
    },
  },
  {
    ...base,
    name: 'hidetag',
    display: 'HideTag',
    description: 'Kirim pesan yang me-mention semua anggota tanpa menampilkan daftar (batas 1x per 60 detik)',
    usage: '.hidetag <teks>',
    minArgs: 1,
    async run(ctx) {
      cooldown(ctx, 'hidetag', 60_000);
      const g = await ctx.group();
      await ctx.sock.sendMessage(ctx.jid, { text: ctx.argText.slice(0, 1000), mentions: g.participants.map((p) => toJid(p.number || p.id)).slice(0, 1000) });
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    status: 'implemented',
    name: 'groupinfo',
    display: 'GroupInfo',
    description: 'Info grup ini',
    async run(ctx) {
      const g = await ctx.group();
      const created = g.meta.creation ? new Date(g.meta.creation * 1000).toLocaleDateString('id-ID') : '-';
      await ctx.reply([`*${g.subject}*`, `ID: ${ctx.jid}`, `Anggota: ${g.size}`, `Admin: ${g.adminNumbers.size}`, `Dibuat: ${created}`, `Bot admin: ${g.botIsAdmin ? 'ya' : 'tidak'}`, g.desc ? `\nDeskripsi:\n${g.desc.slice(0, 500)}` : ''].filter(Boolean).join('\n'));
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    status: 'tested',
    name: 'groupid',
    display: 'GroupID',
    description: 'Tampilkan ID grup',
    tests: 'tests/group.test.js',
    async run(ctx) {
      await ctx.reply(ctx.jid);
    },
  },
  {
    ...base,
    ...needsBot,
    name: 'linkgc',
    display: 'LinkGC',
    description: 'Tampilkan tautan undangan grup',
    async run(ctx) {
      let code;
      try {
        code = await ctx.sock.groupInviteCode(ctx.jid);
      } catch {
        throw new UserError('Gagal mengambil tautan undangan dari WhatsApp.');
      }
      if (!code) throw new UserError('WhatsApp tidak mengembalikan tautan undangan.');
      await ctx.reply(`https://chat.whatsapp.com/${code}`);
    },
  },
  {
    ...base,
    ...needsBot,
    name: 'revoke',
    display: 'Revoke',
    description: 'Reset tautan undangan grup (tautan lama tidak berlaku)',
    async run(ctx) {
      let code;
      try {
        code = await ctx.sock.groupRevokeInvite(ctx.jid);
      } catch {
        throw new UserError('WhatsApp menolak mereset tautan undangan.');
      }
      await ctx.reply(code ? `✅ Tautan baru: https://chat.whatsapp.com/${code}` : '✅ Tautan undangan direset.');
    },
  },
  {
    ...base,
    ...needsBot,
    name: 'setsubject',
    display: 'SetSubject',
    description: 'Ubah nama grup',
    usage: '.setsubject <nama baru>',
    minArgs: 1,
    async run(ctx) {
      if (ctx.argText.length > 100) throw new UserError('Nama grup maksimal 100 karakter.');
      try {
        await ctx.sock.groupUpdateSubject(ctx.jid, ctx.argText);
      } catch {
        throw new UserError('WhatsApp menolak mengubah nama grup.');
      }
      ctx.invalidateGroup();
      await ctx.reply('✅ Nama grup diperbarui.');
    },
  },
  {
    ...base,
    ...needsBot,
    name: 'setdesc',
    display: 'SetDesc',
    description: 'Ubah deskripsi grup',
    usage: '.setdesc <deskripsi>',
    minArgs: 1,
    async run(ctx) {
      if (ctx.argText.length > 2000) throw new UserError('Deskripsi maksimal 2000 karakter.');
      try {
        await ctx.sock.groupUpdateDescription(ctx.jid, ctx.argText);
      } catch {
        throw new UserError('WhatsApp menolak mengubah deskripsi grup.');
      }
      ctx.invalidateGroup();
      await ctx.reply('✅ Deskripsi grup diperbarui.');
    },
  },
  {
    ...base,
    ...needsBot,
    name: 'ephemeral',
    display: 'Ephemeral',
    description: 'Atur pesan sementara: off, 24h, 7d, 90d',
    usage: '.ephemeral <off|24h|7d|90d>',
    minArgs: 1,
    async run(ctx) {
      const map = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 };
      const v = map[ctx.args[0].toLowerCase()];
      if (v === undefined) throw new UserError('Pilihan: off, 24h, 7d, 90d.');
      try {
        await ctx.sock.groupToggleEphemeral(ctx.jid, v);
      } catch {
        throw new UserError('WhatsApp menolak mengubah pesan sementara.');
      }
      await ctx.reply(v ? `✅ Pesan sementara: ${ctx.args[0]}` : '✅ Pesan sementara dimatikan.');
    },
  },
  {
    ...base,
    name: 'leavegroup',
    display: 'LeaveGroup',
    description: 'Bot keluar dari grup ini (tambahkan "ya" untuk konfirmasi)',
    usage: '.leavegroup ya',
    async run(ctx) {
      if (ctx.args[0]?.toLowerCase() !== 'ya') return ctx.reply('⚠️ Bot akan keluar dari grup ini. Ketik *.leavegroup ya* untuk konfirmasi.');
      await ctx.reply('Sampai jumpa 👋');
      await ctx.sock.groupLeave(ctx.jid);
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    status: 'tested',
    name: 'cekbotadmin',
    display: 'CekBotAdmin',
    description: 'Cek apakah bot admin di grup ini',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const g = await ctx.group();
      await ctx.reply(g.botIsAdmin ? '✅ Bot adalah admin grup ini.' : '❌ Bot bukan admin grup. Jadikan admin agar command moderasi berfungsi.');
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    groupAdmin: true,
    status: 'tested',
    name: 'syncgroup',
    display: 'SyncGroup',
    description: 'Muat ulang data grup dari WhatsApp (bersihkan cache)',
    tests: 'tests/group.test.js',
    async run(ctx) {
      ctx.invalidateGroup();
      const g = await ctx.group();
      await ctx.reply(`✅ Data grup dimuat ulang: ${g.size} anggota, ${g.adminNumbers.size} admin.`);
    },
  },
];
