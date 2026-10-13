'use strict';

const config = require('../../config');
const roleService = require('../../services/role.service');
const premiumService = require('../../services/premium.service');
const groupService = require('../../services/group.service');
const { firstTarget } = require('../../core/targets');
const { formatDate } = require('../../utils/format');
const { UserError } = require('../../core/executor');

/**
 * Command administrasi role. Aturan akses sebenarnya ada di services/role.service.js (dicek ulang di sana),
 * bukan hanya di metadata command.
 */

const wrap = (fn) => {
  try {
    return fn();
  } catch (err) {
    if (err instanceof roleService.RoleError) throw new UserError(`❌ ${err.message}`);
    throw err;
  }
};

/** Tindakan yang mencabut/menghukum meminta konfirmasi: tambahkan kata "ya" di akhir. */
const confirmed = (ctx) => ctx.args[ctx.args.length - 1]?.toLowerCase() === 'ya';
const askConfirm = (ctx, what, target) => ctx.reply(`⚠️ Konfirmasi: ${what} ${target}?\nUlangi command yang sama dengan tambahan kata *ya* di akhir.\nContoh: ${ctx.prefix}${ctx.commandName} ${target} ya`);

const needTarget = (ctx) => {
  const t = firstTarget(ctx);
  if (!t) throw new UserError(`Target tidak ditemukan. Tag/reply pengguna atau tulis nomornya (628xxx).\nPenggunaan: ${ctx.prefix}${ctx.commandName} <@tag|nomor>`);
  return t;
};

module.exports = [
  {
    name: 'addadmin',
    display: 'AddAdmin',
    category: 'OWNER',
    description: 'Angkat pengguna menjadi Admin bot',
    usage: '.addadmin <@tag|nomor>',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      wrap(() => roleService.addAdmin(ctx.sender, t));
      await ctx.reply(`✅ ${t} sekarang Admin bot.`);
    },
  },
  {
    name: 'deladmin',
    display: 'DelAdmin',
    category: 'OWNER',
    description: 'Cabut Admin bot (perlu konfirmasi)',
    usage: '.deladmin <@tag|nomor> ya',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      if (!confirmed(ctx)) return askConfirm(ctx, 'mencabut Admin bot dari', t);
      wrap(() => roleService.removeAdmin(ctx.sender, t));
      await ctx.reply(`✅ Admin bot dicabut dari ${t}.`);
    },
  },
  {
    name: 'listadmin',
    display: 'ListAdmin',
    category: 'OWNER',
    description: 'Daftar Admin bot',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const list = roleService.listAdmins();
      await ctx.reply(list.length ? ['*Admin bot*', ...list.map((a, i) => `${i + 1}. ${a.number}`)].join('\n') : 'Belum ada Admin bot.');
    },
  },
  {
    name: 'addpremium',
    display: 'AddPremium',
    category: 'OWNER',
    alsoIn: ['ADMIN'],
    description: 'Beri/perpanjang Premium (default 30 hari)',
    usage: '.addpremium <@tag|nomor> [hari]',
    permission: 'admin',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      const dayArg = ctx.args.find((a) => /^\d{1,6}$/.test(a));
      const days = dayArg ? parseInt(dayArg, 10) : 30;
      const r = wrap(() => roleService.grantPremium(ctx.sender, t, days));
      await ctx.reply(`✅ Premium ${t} aktif sampai ${formatDate(r.expiresAt, config.timezone)} (+${days} hari).`);
    },
  },
  {
    name: 'delpremium',
    display: 'DelPremium',
    category: 'OWNER',
    alsoIn: ['ADMIN'],
    description: 'Cabut Premium (perlu konfirmasi)',
    usage: '.delpremium <@tag|nomor> ya',
    permission: 'admin',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      if (!confirmed(ctx)) return askConfirm(ctx, 'mencabut Premium dari', t);
      wrap(() => roleService.revokePremium(ctx.sender, t));
      await ctx.reply(`✅ Premium dicabut dari ${t}.`);
    },
  },
  {
    name: 'listpremium',
    display: 'ListPremium',
    category: 'OWNER',
    alsoIn: ['ADMIN'],
    description: 'Daftar Premium aktif',
    permission: 'admin',
    status: 'tested',
    async run(ctx) {
      const list = premiumService.list({ activeOnly: true, limit: 50 });
      await ctx.reply(list.length ? ['*Premium aktif*', ...list.map((p, i) => `${i + 1}. ${p.number} — s/d ${formatDate(p.expires_at, config.timezone)}`)].join('\n') : 'Tidak ada Premium aktif.');
    },
  },
  {
    name: 'genredeem',
    display: 'GenRedeem',
    category: 'OWNER',
    description: 'Buat kode redeem Premium',
    usage: '.genredeem <hari> [jumlah pemakaian] [masa berlaku kode (hari)]',
    permission: 'owner',
    minArgs: 1,
    status: 'tested',
    async run(ctx) {
      const [days, uses = 1, valid = 30] = ctx.args.map((a) => parseInt(a, 10));
      try {
        const r = premiumService.createRedeem(ctx.sender, days, uses, valid);
        await ctx.reply(`✅ Kode dibuat:\n*${r.code}*\n+${r.days} hari Premium · ${r.maxUses}x pakai · berlaku s/d ${formatDate(r.expiresAt, config.timezone)}\nBagikan lewat chat pribadi.`);
      } catch (err) {
        if (err instanceof premiumService.PremiumError) throw new UserError(`❌ ${err.message}`);
        throw err;
      }
    },
  },
  {
    name: 'rolelog',
    display: 'RoleLog',
    category: 'OWNER',
    description: 'Riwayat perubahan role/Premium',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const rows = roleService.history(15);
      await ctx.reply(rows.length ? ['*Riwayat role*', ...rows.map((r) => `• ${formatDate(r.created_at, config.timezone)} — ${r.action} ${r.number}${r.detail ? ` (${r.detail})` : ''} oleh ${r.actor || 'sistem'}`)].join('\n') : 'Belum ada riwayat.');
    },
  },
  {
    name: 'banuser',
    display: 'BanUser',
    category: 'OWNER',
    description: 'Blokir pengguna dari semua command bot (perlu konfirmasi)',
    usage: '.banuser <@tag|nomor> [alasan] ya',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      if (roleService.isOwner(t)) throw new UserError('❌ Owner tidak dapat diblokir.');
      if (!confirmed(ctx)) return askConfirm(ctx, 'memblokir', t);
      const reason = ctx.args.filter((a) => !/^@?\+?\d{8,15}$/.test(a) && a.toLowerCase() !== 'ya').join(' ').slice(0, 100);
      groupService.banUser(t, reason, ctx.sender);
      roleService.log(t, 'ban_user', ctx.sender, reason || null);
      await ctx.reply(`🚫 ${t} diblokir dari bot.`);
    },
  },
  {
    name: 'unbanuser',
    display: 'UnbanUser',
    category: 'OWNER',
    description: 'Buka blokir pengguna',
    usage: '.unbanuser <@tag|nomor>',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const t = needTarget(ctx);
      if (!groupService.unbanUser(t)) throw new UserError('Pengguna ini tidak sedang diblokir.');
      roleService.log(t, 'unban_user', ctx.sender);
      await ctx.reply(`✅ Blokir ${t} dibuka.`);
    },
  },
  {
    name: 'banlist',
    display: 'BanList',
    category: 'OWNER',
    description: 'Daftar pengguna dan chat yang diblokir secara global',
    permission: 'owner',
    status: 'tested',
    async run(ctx) {
      const users = groupService.listBannedUsers();
      const chats = groupService.listBannedChats();
      if (!users.length && !chats.length) return ctx.reply('Tidak ada pengguna/chat yang diblokir.');
      await ctx.reply(
        [
          '*Pengguna diblokir*',
          ...(users.length ? users.map((u, i) => `${i + 1}. ${u.number}${u.reason ? ` — ${u.reason}` : ''}`) : ['-']),
          '',
          '*Chat diblokir*',
          ...(chats.length ? chats.map((c, i) => `${i + 1}. ${c.jid}`) : ['-']),
        ].join('\n')
      );
    },
  },
];

