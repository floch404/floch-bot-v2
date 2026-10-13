'use strict';

const pkg = require('../../../package.json');
const config = require('../../config');
const registry = require('../../core/registry');
const premiumService = require('../../services/premium.service');
const limitService = require('../../services/limit.service');
const stats = require('../../services/stats.service');
const settings = require('../../services/settings.service');
const { formatDuration, formatDate, maskNumber } = require('../../utils/format');
const { UserError } = require('../../core/executor');

const PERM_LABEL = { public: 'Semua pengguna', premium: 'Premium aktif', admin: 'Admin bot / Owner', owner: 'Owner' };
const STATUS_LABEL = { tested: 'teruji (otomatis)', implemented: 'terimplementasi (uji dengan tiruan)', needs_config: 'butuh konfigurasi', planned: 'belum diimplementasikan' };

function premiumLines(role) {
  const p = role.premium;
  if (role.isOwner) return ['Status: Owner (akses penuh)'];
  if (p.active) return ['Status: Premium AKTIF', `Mulai: ${formatDate(p.startedAt, config.timezone)}`, `Berakhir: ${formatDate(p.expiresAt, config.timezone)}`, `Sisa: ${formatDuration(p.remainingMs)}`];
  if (p.expired) return ['Status: Premium KEDALUWARSA', `Berakhir: ${formatDate(p.expiresAt, config.timezone)}`];
  return ['Status: Belum Premium'];
}

module.exports = [
  {
    name: 'ping',
    display: 'Ping',
    category: 'GENERAL',
    description: 'Cek respons bot dan waktu responsnya',
    status: 'tested',
    async run(ctx) {
      const started = Date.now();
      const sent = await ctx.reply('Pinging...');
      const text = `Pong! Waktu respons: ${Date.now() - started} ms`;
      try {
        await ctx.sock.sendMessage(ctx.jid, { text, edit: sent.key }); // ubah pesan "Pinging..." menjadi hasil
      } catch {
        await ctx.reply(text);
      }
    },
  },
  {
    name: 'runtime',
    category: 'BOT',
    alsoIn: ['GENERAL'],
    description: 'Lama bot berjalan',
    status: 'tested',
    async run(ctx) {
      const since = ctx.session.connectedAt;
      await ctx.reply([`Bot aktif: ${since ? formatDuration(Date.now() - since) : 'belum terhubung'}`, `Server aktif: ${formatDuration(process.uptime() * 1000)}`].join('\n'));
    },
  },
  {
    name: 'owner',
    display: 'Owner',
    category: 'GENERAL',
    description: 'Info Owner dan Developer',
    status: 'tested',
    examples: [{ args: '', expect: /^Owner: floch\nDeveloper: floch$/ }],
    async run(ctx) {
      await ctx.reply(`Owner: ${config.identity.owner}\nDeveloper: ${config.identity.developer}`);
    },
  },
  {
    name: 'about',
    display: 'About',
    category: 'GENERAL',
    description: 'Tentang FLOCH BOT',
    status: 'tested',
    examples: [{ args: '', expect: /FLOCH BOT[\s\S]*Owner: floch[\s\S]*Developer: floch[\s\S]*tidak resmi/ }],
    async run(ctx) {
      await ctx.reply(
        [
          `*${config.identity.botName}* v${pkg.version}`,
          `Owner: ${config.identity.owner}`,
          `Developer: ${config.identity.developer}`,
          `Command aktif: ${registry.active().length}`,
          'Runtime: Node.js + library WhatsApp tidak resmi (Baileys). Bukan WhatsApp Business API resmi; ada risiko pembatasan nomor oleh WhatsApp.',
        ].join('\n')
      );
    },
  },
  {
    name: 'help',
    display: 'Help',
    category: 'GENERAL',
    description: 'Bantuan otomatis dari registry command',
    usage: '.help [nama command]',
    status: 'tested',
    examples: [{ args: 'ping', expect: /\.Ping[\s\S]*Kategori: GENERAL/ }, { args: 'tidakada', expect: /tidak ditemukan/ }],
    async run(ctx) {
      const q = ctx.args[0];
      if (!q) {
        await ctx.reply(`Ketik .menu untuk daftar command aktif (${registry.active().length} command), atau .help <nama> untuk detail satu command.\nContoh: .help ping`);
        return;
      }
      const d = registry.find(q.replace(/^[.!#]/, ''));
      if (!d) {
        await ctx.reply(`Command "${q.slice(0, 30)}" tidak ditemukan di registry.`);
        return;
      }
      const lines = [
        `*.${d.display}*`,
        `Kategori: ${d.categories.join(', ')}`,
        `Deskripsi: ${d.description || '-'}`,
        `Penggunaan: ${d.usage || `.${d.name}`}`,
        `Izin: ${PERM_LABEL[d.permission]}${d.groupOnly ? ' · khusus grup' : ''}${d.groupAdmin ? ' · admin grup WhatsApp' : ''}${d.botAdmin ? ' · bot harus admin grup' : ''}`,
        `Status: ${STATUS_LABEL[d.status]}${d.status === 'needs_config' && !d.isConfigured() ? ' (BELUM aktif)' : ''}`,
      ];
      if (d.aliases.length) lines.push(`Alias: ${d.aliases.map((a) => `.${a}`).join(', ')}`);
      if (d.limit) lines.push(`Biaya limit: ${d.limit}`);
      await ctx.reply(lines.join('\n'));
    },
  },
  {
    name: 'premium',
    display: 'Premium',
    category: 'GENERAL',
    description: 'Info Premium dan cara mendapatkannya',
    status: 'tested',
    examples: [{ args: '', expect: /Belum Premium[\s\S]*Benefit[\s\S]*tidak memproses pembayaran/ }],
    async run(ctx) {
      const lines = ['*Premium FLOCH BOT*', ...premiumLines(ctx.role), '', '*Benefit*', ...premiumService.benefits().map((b) => `• ${b.title}: ${b.text}`)];
      lines.push('', 'Cara mendapatkan: Owner/Admin bot memberikannya, atau tukarkan kode dengan .redeem <kode>.', 'Bot ini tidak memproses pembayaran; transaksi dilakukan di luar bot lewat Owner.');
      await ctx.reply(lines.join('\n'));
    },
  },
  {
    name: 'cekbenefit',
    display: 'CekBenefit',
    category: 'GENERAL',
    description: 'Benefit Premium dan limit harian kamu',
    status: 'tested',
    examples: [{ args: '', expect: /Benefit[\s\S]*Limit command/ }],
    async run(ctx) {
      const owner = ctx.role.isOwner;
      const c = limitService.status(ctx.sender, 'cmd', { unlimited: owner });
      const g = limitService.status(ctx.sender, 'game', { unlimited: owner });
      const fmt = (s) => (s.unlimited ? 'tanpa batas' : `${s.remaining}/${s.cap}`);
      await ctx.reply(['*Benefit Premium*', ...premiumService.benefits().map((b) => `• ${b.title}: ${b.text}`), '', '*Milikmu sekarang*', ...premiumLines(ctx.role), `Limit command tersisa: ${fmt(c)}`, `Limit game tersisa: ${fmt(g)}`].join('\n'));
    },
  },
  {
    name: 'limit',
    display: 'Limit',
    category: 'GENERAL',
    description: 'Cek sisa limit harian',
    status: 'tested',
    examples: [{ args: '', expect: /Limit command: \d+\/\d+[\s\S]*Limit game: \d+\/\d+/ }],
    async run(ctx) {
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot (hanya ID pribadi). Coba lagi di chat pribadi.');
      const owner = ctx.role.isOwner;
      const c = limitService.status(ctx.sender, 'cmd', { unlimited: owner });
      const g = limitService.status(ctx.sender, 'game', { unlimited: owner });
      const fmt = (s) => (s.unlimited ? 'tanpa batas' : `${s.remaining}/${s.cap}`);
      await ctx.reply(`Limit command: ${fmt(c)}\nLimit game: ${fmt(g)}\nReset harian pukul 00:00 (${config.timezone}). Klaim bonus: .daily`);
    },
  },
  {
    name: 'daily',
    display: 'Daily',
    category: 'GENERAL',
    description: 'Klaim bonus limit harian',
    status: 'tested',
    examples: [{ args: '', expect: /Bonus harian: \+\d+ limit/ }],
    async run(ctx) {
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot. Coba di chat pribadi.');
      const r = limitService.claimDaily(ctx.sender);
      if (!r.ok) {
        await ctx.reply(`Kamu sudah klaim hari ini. Streak: ${r.streak} hari. Kembali lagi besok!`);
        return;
      }
      await ctx.reply(`Bonus harian: +${r.amount} limit\nStreak: ${r.streak} hari (total klaim ${r.total})`);
    },
  },
  {
    name: 'donatur',
    display: 'Donatur',
    category: 'GENERAL',
    description: 'Info dukungan/donasi untuk bot',
    status: 'tested',
    examples: [{ args: '', expect: /tidak memproses donasi/ }],
    async run(ctx) {
      await ctx.reply(
        [
          '*Dukung FLOCH BOT*',
          config.donation || 'Info donasi belum dikonfigurasi Owner (DONATION_INFO).',
          '',
          'Bot ini tidak memproses donasi atau pembayaran dan tidak otomatis memberi Premium. Hubungi Owner bila ingin mendukung.',
        ].join('\n')
      );
    },
  },
  {
    name: 'redeem',
    display: 'Redeem',
    category: 'GENERAL',
    description: 'Tukar kode redeem menjadi Premium',
    usage: '.redeem <kode>',
    minArgs: 1,
    status: 'tested',
    async run(ctx) {
      if (!ctx.sender) throw new UserError('Nomor kamu tidak dapat dikenali oleh bot. Coba di chat pribadi.');
      try {
        const r = premiumService.redeem(ctx.sender, ctx.args[0]);
        await ctx.reply(`✅ Kode berhasil ditukar: +${r.days} hari Premium.\nBerlaku sampai ${formatDate(r.expiresAt, config.timezone)}.`);
      } catch (err) {
        if (err instanceof premiumService.PremiumError) throw new UserError(`❌ ${err.message}`);
        throw err;
      }
    },
  },
  {
    name: 'sc',
    display: 'sc',
    category: 'GENERAL',
    description: 'Informasi source code',
    status: 'tested',
    examples: [{ args: '', expect: /Source code|source code/ }],
    async run(ctx) {
      await ctx.reply(config.sourceUrl ? `Source code: ${config.sourceUrl}` : 'Source code bot ini tidak dipublikasikan (SOURCE_URL belum diisi Owner).');
    },
  },
  {
    name: 'top',
    display: 'Top',
    category: 'GENERAL',
    description: 'Command dan pengguna paling aktif (statistik nyata)',
    status: 'tested',
    examples: [{ args: '', expect: /Command terpopuler|Belum ada statistik/ }],
    async run(ctx) {
      const cmds = stats.topCommands(10);
      if (!cmds.length) {
        await ctx.reply('Belum ada statistik pemakaian.');
        return;
      }
      const users = stats.topUsers(5);
      await ctx.reply(
        ['*Command terpopuler*', ...cmds.map((c, i) => `${i + 1}. .${c.name} — ${c.count}x`), '', '*Pengguna teraktif*', ...users.map((u, i) => `${i + 1}. ${maskNumber(u.number)} — ${u.total} command`)].join('\n')
      );
    },
  },
  {
    name: 'join',
    display: 'Join',
    category: 'GENERAL',
    description: 'Minta bot bergabung ke grup lewat link undangan',
    usage: '.join <link grup>',
    permission: 'premium',
    minArgs: 1,
    status: 'implemented',
    async run(ctx) {
      if (!settings.get('join_enabled')) throw new UserError('Fitur join sedang dinonaktifkan Owner.');
      const m = ctx.args[0].match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/);
      if (!m) throw new UserError('Link grup tidak valid. Contoh: https://chat.whatsapp.com/XXXXXXXXXXXX');
      try {
        await ctx.sock.groupAcceptInvite(m[1]);
        await ctx.reply('✅ Permintaan bergabung dikirim. Jika grup memakai persetujuan admin, tunggu disetujui.');
      } catch (err) {
        throw new UserError(`Gagal bergabung ke grup (${String(err.message || 'ditolak WhatsApp').slice(0, 80)}).`);
      }
    },
  },
  {
    name: 'nsfw',
    display: 'NSFW',
    category: 'GENERAL',
    alsoIn: ['BOT', 'GROUP'],
    description: 'Kebijakan konten dewasa bot (kontrol moderasi, bukan konten)',
    status: 'tested',
    examples: [{ args: '', expect: /tidak menyediakan konten NSFW/ }],
    async run(ctx) {
      await ctx.reply('Kebijakan: FLOCH BOT *tidak menyediakan konten NSFW* dan tidak punya perintah untuk mengaktifkannya. Filter ini selalu aktif dan tidak dapat dimatikan. Deteksi otomatis gambar NSFW (AntiNSFWMedia) belum diimplementasikan.');
    },
  },
];
