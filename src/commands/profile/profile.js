'use strict';

const config = require('../../config');
const profileService = require('../../services/profile.service');
const premiumService = require('../../services/premium.service');
const stats = require('../../services/stats.service');
const { formatDate, formatDuration } = require('../../utils/format');
const { UserError } = require('../../core/executor');
const { firstTarget } = require('../../core/targets');
const { toJid } = require('../../utils/jid');

const needSender = (ctx) => {
  if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot (hanya ID pribadi). Coba di chat pribadi dengan bot.');
  return ctx.sender;
};

/** Pembungkus setter profil: validasi dilakukan service, hanya mengubah data profil pengguna ini. */
const setter = (name, display, fn, usage, okMsg) => ({
  name,
  display,
  category: 'PROFILE',
  description: `Atur ${display.replace(/^Set/, '').toLowerCase()} profil kamu`,
  usage,
  minArgs: 1,
  status: 'tested',
  async run(ctx) {
    const n = needSender(ctx);
    try {
      const p = fn(n, ctx.argText);
      await ctx.reply(okMsg(p));
    } catch (err) {
      if (err instanceof profileService.ProfileError) throw new UserError(err.message);
      throw err;
    }
  },
});

module.exports = [
  {
    name: 'profile',
    display: 'Profile',
    category: 'PROFILE',
    description: 'Lihat profil kamu',
    status: 'tested',
    examples: [{ args: '', expect: /Role: user[\s\S]*Level: 1/ }],
    async run(ctx) {
      const n = needSender(ctx);
      const p = profileService.get(n);
      const lines = [
        '*Profil*',
        `Nama: ${p.name || ctx.pushName || '-'}`,
        `Nomor: ${n}`,
        `Role: ${ctx.role.role}`,
        `Umur: ${p.age ?? '-'}`,
        `Gender: ${p.gender || '-'}`,
        `Bio: ${p.bio || '-'}`,
        `Level: ${p.level} (${p.xp} XP)`,
        `Total command: ${stats.userCommandCount(n)}`,
      ];
      if (p.prefix) lines.push(`Prefix pribadi: ${p.prefix}`);
      await ctx.reply(lines.join('\n'));
    },
  },
  {
    name: 'level',
    display: 'Level',
    category: 'PROFILE',
    description: 'Level dan XP kamu',
    status: 'tested',
    examples: [{ args: '', expect: /Level \d+[\s\S]*XP/ }],
    async run(ctx) {
      const p = profileService.get(needSender(ctx));
      const next = profileService.xpForLevel(p.level + 1);
      await ctx.reply(`Level ${p.level}\nXP: ${p.xp}/${next} (butuh ${Math.max(0, next - p.xp)} lagi untuk level ${p.level + 1})\nXP didapat dari mengobrol dan memakai command.`);
    },
  },
  {
    name: 'cekpremium',
    display: 'CekPremium',
    category: 'PROFILE',
    description: 'Cek status Premium kamu',
    status: 'tested',
    examples: [{ args: '', expect: /Belum Premium/ }],
    async run(ctx) {
      const p = premiumService.status(ctx.sender);
      if (ctx.role.isOwner) return ctx.reply('Kamu Owner: akses penuh, tidak memerlukan Premium.');
      if (p.active) return ctx.reply(`Premium AKTIF\nMulai: ${formatDate(p.startedAt, config.timezone)}\nBerakhir: ${formatDate(p.expiresAt, config.timezone)}\nSisa: ${formatDuration(p.remainingMs)}`);
      if (p.expired) return ctx.reply(`Premium KEDALUWARSA pada ${formatDate(p.expiresAt, config.timezone)}.\nPerpanjang dengan .redeem <kode> atau hubungi Owner.`);
      return ctx.reply('Belum Premium. Lihat .premium untuk info.');
    },
  },
  {
    name: 'afk',
    display: 'AFK',
    category: 'PROFILE',
    description: 'Tandai dirimu sedang AFK',
    usage: '.afk [alasan]',
    status: 'tested',
    examples: [{ args: 'tidur', expect: /AFK.*tidur/ }],
    async run(ctx) {
      profileService.setAfk(needSender(ctx), ctx.argText);
      await ctx.reply(`😴 Kamu sekarang AFK${ctx.argText ? `: ${ctx.argText.slice(0, 100)}` : ''}. Kirim pesan apa saja untuk kembali.`);
    },
  },
  {
    name: 'changepassword',
    display: 'ChangePassword',
    category: 'PROFILE',
    description: 'Info: bot tidak memakai password',
    status: 'tested',
    examples: [{ args: '', expect: /tidak memakai password/ }],
    async run(ctx) {
      await ctx.reply('FLOCH BOT tidak memakai password untuk pengguna, jadi tidak ada yang bisa diubah. Identitasmu = nomor WhatsApp. Bot juga tidak pernah meminta/menyimpan password, OTP, atau PIN WhatsApp-mu.');
    },
  },
  {
    name: 'getpp',
    display: 'GetPP',
    category: 'PROFILE',
    description: 'Ambil foto profil (diri sendiri / yang di-tag / di-reply)',
    usage: '.getpp [@tag]',
    status: 'implemented',
    async run(ctx) {
      const target = firstTarget(ctx, { fromArgs: false }) || ctx.sender;
      if (!target) throw new UserError('Target tidak dapat dikenali.');
      let url;
      try {
        url = await ctx.sock.profilePictureUrl(toJid(target), 'image');
      } catch {
        throw new UserError('Foto profil tidak tersedia (kosong atau disembunyikan).');
      }
      if (!url) throw new UserError('Foto profil tidak tersedia.');
      await ctx.send({ image: { url }, caption: `Foto profil @${target}`, mentions: [toJid(target)] });
    },
  },
  setter('setname', 'SetName', profileService.setName, '.setname <nama>', (p) => `✅ Nama diubah menjadi ${p.name}.`),
  setter('setage', 'SetAge', profileService.setAge, '.setage <umur>', (p) => `✅ Umur diubah menjadi ${p.age}.`),
  setter('setgender', 'SetGender', profileService.setGender, '.setgender pria|wanita|lainnya', (p) => `✅ Gender diubah menjadi ${p.gender}.`),
  setter('setbio', 'SetBio', profileService.setBio, '.setbio <teks>', () => '✅ Bio diperbarui.'),
  setter('setprefix', 'SetPrefix', profileService.setPrefix, '.setprefix <simbol> | reset', (p) => (p.prefix ? `✅ Prefix pribadi: ${p.prefix} (prefix "." tetap berlaku). Hanya memengaruhi pesanmu.` : '✅ Prefix pribadi direset.')),
];
