'use strict';

const config = require('../../config');
const registry = require('../../core/registry');
const settings = require('../../services/settings.service');
const stats = require('../../services/stats.service');
const { UserError } = require('../../core/executor');
const { formatDuration, maskNumber } = require('../../utils/format');

const STATUS_ID = { connected: 'Connected', connecting: 'Connecting', open: 'Connected' };

const ownerSwitch = (name, display, key, description) => ({
  name,
  display,
  category: 'BOT',
  description,
  usage: `.${name} <on|off>`,
  permission: 'owner',
  status: 'tested',
  tests: 'tests/bot.test.js',
  async run(ctx) {
    if (!ctx.args.length) return ctx.reply(`${display}: ${settings.get(key) ? 'AKTIF' : 'mati'}\nUbah: .${name} on|off`);
    let v;
    try {
      v = settings.coerce(key, ctx.args[0]);
    } catch (err) {
      throw new UserError(err.message);
    }
    settings.update({ [key]: v });
    await ctx.reply(`✅ ${display}: ${v ? 'AKTIF' : 'mati'}`);
  },
});

module.exports = [
  {
    name: 'bot',
    display: 'Bot',
    category: 'BOT',
    description: 'Cek apakah bot aktif',
    status: 'tested',
    examples: [{ args: '', expect: /Bot aktif|FLOCH BOT/i }],
    async run(ctx) {
      await ctx.reply(`${config.identity.botName} aktif ✅\nStatus: ${STATUS_ID[ctx.session.status] || ctx.session.status}\nKetik .menu untuk daftar command.`);
    },
  },
  {
    name: 'botinfo',
    display: 'BotInfo',
    category: 'BOT',
    description: 'Informasi bot: versi, runtime, jumlah command aktif',
    status: 'tested',
    examples: [{ args: '', expect: /Total command aktif: \d+/ }],
    async run(ctx) {
      const c = registry.all();
      const by = (s) => c.filter((d) => d.status === s).length;
      await ctx.reply([
        `*${config.identity.botName}*`,
        `Owner: ${config.identity.owner}`,
        `Developer: ${config.identity.developer}`,
        `Runtime: ${formatDuration(ctx.session.connectedAt ? Date.now() - ctx.session.connectedAt : process.uptime() * 1000)}`,
        `Total command aktif: ${registry.active().length}`,
        `Belum diimplementasikan: ${by('planned')}`,
        `Node: ${process.version}`,
      ].join('\n'));
    },
  },
  {
    name: 'stats',
    display: 'Stats',
    category: 'BOT',
    description: 'Statistik pemakaian bot (nyata dari database)',
    status: 'tested',
    examples: [{ args: '', expect: /Command dijalankan: \d+/ }],
    async run(ctx) {
      const t = stats.totals();
      const top = stats.topCommands(5);
      await ctx.reply([`*Statistik bot*`, `Command dijalankan: ${t.commands}`, `Error command: ${t.errors}`, `Pesan terlihat: ${t.messages}`, '', ...(top.length ? ['*Command terpopuler*', ...top.map((r, i) => `${i + 1}. .${r.name} — ${r.count}`)] : [])].join('\n'));
    },
  },
  {
    name: 'msgstats',
    display: 'MsgStats',
    category: 'BOT',
    description: 'Statistik pesan di chat ini',
    status: 'tested',
    examples: [{ args: '', expect: /Pesan terlihat di chat ini: \d+/ }],
    async run(ctx) {
      await ctx.reply(`Pesan terlihat di chat ini: ${stats.chatTotal(ctx.jid)}\nPesanmu: ${ctx.sender ? stats.messageCount(ctx.jid, ctx.sender) : 0}`);
    },
  },
  {
    name: 'botsettings',
    display: 'BotSettings',
    category: 'BOT',
    description: 'Lihat atau ubah pengaturan global bot (Owner)',
    usage: '.botsettings [kunci nilai]',
    permission: 'owner',
    status: 'tested',
    tests: 'tests/bot.test.js',
    async run(ctx) {
      if (ctx.args.length >= 2) {
        const [key, val] = ctx.args;
        if (!settings.DEFINITIONS[key]) throw new UserError(`Kunci tidak dikenal. Kunci: ${Object.keys(settings.DEFINITIONS).join(', ')}`);
        let v;
        try {
          v = settings.coerce(key, val);
        } catch (err) {
          throw new UserError(err.message);
        }
        settings.update({ [key]: v });
      }
      const all = settings.all();
      await ctx.reply(['*Pengaturan bot*', ...Object.entries(all).map(([k, v]) => `• ${k}: ${typeof v === 'boolean' ? (v ? 'on' : 'off') : v}`), '', 'Ubah: .botsettings <kunci> <nilai>'].join('\n'));
    },
  },
  ownerSwitch('selfmode', 'SelfMode', 'self_mode', 'Self mode: hanya Owner yang dilayani'),
  ownerSwitch('groupmode', 'GroupMode', 'group_only', 'Group mode: chat pribadi diabaikan (kecuali Owner)'),
  ownerSwitch('joinmode', 'JoinMode', 'join_enabled', 'Aktif/nonaktifkan command .join'),
  ownerSwitch('autoread', 'AutoRead', 'auto_read', 'Tandai pesan masuk sebagai sudah dibaca'),
  ownerSwitch('rejectcall', 'RejectCall', 'reject_call', 'Tolak panggilan masuk otomatis'),
  {
    name: 'pacing',
    display: 'Pacing',
    category: 'BOT',
    description: 'Jeda sebelum membalas (ms, 0-5000) agar tidak terlalu cepat',
    usage: '.pacing <ms>',
    permission: 'owner',
    status: 'tested',
    tests: 'tests/bot.test.js',
    async run(ctx) {
      if (!ctx.args.length) return ctx.reply(`Pacing: ${settings.get('pacing_ms')} ms`);
      let v;
      try {
        v = settings.coerce('pacing_ms', ctx.args[0]);
      } catch (err) {
        throw new UserError(err.message);
      }
      settings.update({ pacing_ms: v });
      await ctx.reply(`✅ Pacing: ${v} ms`);
    },
  },
  {
    name: 'listgroup',
    display: 'ListGroup',
    category: 'BOT',
    description: 'Daftar grup tempat bot bergabung (Owner)',
    permission: 'owner',
    status: 'implemented',
    async run(ctx) {
      let groups;
      try {
        groups = Object.values(await ctx.sock.groupFetchAllParticipating());
      } catch {
        throw new UserError('Gagal mengambil daftar grup dari WhatsApp.');
      }
      if (!groups.length) return ctx.reply('Bot belum bergabung di grup mana pun.');
      await ctx.reply([`*Grup (${groups.length})*`, ...groups.slice(0, 40).map((g, i) => `${i + 1}. ${g.subject} — ${g.participants?.length || '?'} anggota`)].join('\n'));
    },
  },
  {
    name: 'getprivacysetting',
    display: 'GetPrivacySetting',
    category: 'BOT',
    description: 'Lihat pengaturan privasi akun WhatsApp bot (Owner)',
    permission: 'owner',
    status: 'implemented',
    async run(ctx) {
      let p;
      try {
        p = await ctx.sock.fetchPrivacySettings(true);
      } catch {
        throw new UserError('Gagal mengambil pengaturan privasi dari WhatsApp.');
      }
      await ctx.reply(['*Privasi akun bot*', ...Object.entries(p || {}).map(([k, v]) => `• ${k}: ${v}`)].join('\n'));
    },
  },
  {
    name: 'scanbot',
    display: 'ScanBot',
    category: 'BOT',
    description: 'Pemeriksaan kesehatan bot: sesi, database, registry (Owner)',
    permission: 'owner',
    status: 'tested',
    tests: 'tests/bot.test.js',
    async run(ctx) {
      const { db } = require('../../database');
      let dbOk = 'ok';
      try {
        db.prepare('SELECT 1').get();
      } catch {
        dbOk = 'GAGAL';
      }
      const all = registry.all();
      await ctx.reply([
        '*Scan bot*',
        `Sesi: ${ctx.session.status}${ctx.session.ownNumber ? ` (${maskNumber(ctx.session.ownNumber)})` : ''}`,
        `Database: ${dbOk}`,
        `Command aktif: ${registry.active().length} dari ${all.length} terdaftar`,
        `Butuh konfigurasi: ${all.filter((d) => d.status === 'needs_config' && !registry.isActive(d)).map((d) => d.display).join(', ') || '-'}`,
        `Memori: ${Math.round(process.memoryUsage().rss / 1048576)} MB`,
      ].join('\n'));
    },
  },
];
