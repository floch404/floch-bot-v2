'use strict';

const groupService = require('../../services/group.service');
const { UserError } = require('../../core/executor');
const { renderTemplate } = require('../../whatsapp/group-events');
const { toJid } = require('../../utils/jid');

const base = { category: 'GROUP', groupOnly: true, groupAdmin: true };
const onOff = (v) => (v ? 'AKTIF' : 'mati');

function parseSwitch(ctx) {
  const a = (ctx.args[0] || '').toLowerCase();
  if (['on', 'aktif', 'ya', '1'].includes(a)) return true;
  if (['off', 'mati', 'tidak', '0'].includes(a)) return false;
  throw new UserError(`Gunakan: ${ctx.prefix}${ctx.commandName} on|off`);
}

const toggle = (name, display, key, description, extra = '', status = 'tested') => ({
  ...base,
  name,
  display,
  description,
  usage: `.${name} <on|off>`,
  status,
  tests: 'tests/group.test.js',
  async run(ctx) {
    if (!ctx.args.length) return ctx.reply(`${display}: ${onOff(groupService.get(ctx.jid)[key])}\nUbah dengan .${name} on|off${extra}`);
    const v = parseSwitch(ctx);
    groupService.update(ctx.jid, { [key]: v });
    await ctx.reply(`✅ ${display} ${v ? 'diaktifkan' : 'dimatikan'}.${v && extra ? extra : ''}`);
  },
});

const textSetting = (name, display, key, description) => ({
  ...base,
  name,
  display,
  description,
  usage: `.${name} <teks> (pakai @user dan @group)`,
  minArgs: 1,
  status: 'tested',
  tests: 'tests/group.test.js',
  async run(ctx) {
    if (ctx.argText.length > 500) throw new UserError('Teks maksimal 500 karakter.');
    groupService.update(ctx.jid, { [key]: ctx.argText });
    await ctx.reply(`✅ Teks ${display} disimpan. Aktifkan dengan .${key.startsWith('welcome') ? 'welcome' : 'goodbye'} on`);
  },
});

const simulate = (name, display, key, label) => ({
  ...base,
  name,
  display,
  description: `Pratinjau pesan ${label} (tidak mengirim ke anggota lain)`,
  status: 'tested',
  tests: 'tests/group.test.js',
  async run(ctx) {
    const g = await ctx.group();
    const n = ctx.sender || 'pengguna';
    await ctx.send({ text: renderTemplate(groupService.get(ctx.jid)[key], { number: n, subject: g.subject }), mentions: ctx.sender ? [toJid(ctx.sender)] : [] });
  },
});

const TZ = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Tokyo', 'UTC'];

module.exports = [
  toggle('antilink', 'AntiLink', 'antilink', 'Hapus pesan berisi tautan dari non-admin dan beri peringatan', '\nBot harus admin agar bisa menghapus pesan.'),
  toggle('antispam', 'AntiSpam', 'antispam', 'Peringatkan anggota yang mengirim pesan terlalu cepat'),
  toggle('antimedia', 'AntiMedia', 'antimedia', 'Hapus media (gambar/video/stiker) dari non-admin', '\nBot harus admin agar bisa menghapus pesan.'),
  toggle('welcome', 'Welcome', 'welcome', 'Sambut anggota baru'),
  toggle('goodbye', 'Goodbye', 'goodbye', 'Pesan perpisahan saat anggota keluar'),
  toggle('adminonly', 'AdminOnly', 'adminOnly', 'Bot hanya merespons admin grup di grup ini'),
  textSetting('setwelcome', 'SetWelcome', 'welcomeText', 'Atur teks sambutan'),
  textSetting('setgoodbye', 'SetGoodbye', 'goodbyeText', 'Atur teks perpisahan'),
  simulate('simulatewelcome', 'SimulateWelcome', 'welcomeText', 'sambutan'),
  simulate('simulategoodbye', 'SimulateGoodbye', 'goodbyeText', 'perpisahan'),
  {
    ...base,
    name: 'badword',
    display: 'BadWord',
    description: 'Kelola kata terlarang: .badword on|off|add <kata>|del <kata>|list',
    usage: '.badword <on|off|add|del|list>',
    minArgs: 1,
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const cfg = groupService.get(ctx.jid);
      const sub = ctx.args[0].toLowerCase();
      const word = ctx.args.slice(1).join(' ').toLowerCase().trim();
      if (sub === 'on' || sub === 'off') {
        groupService.update(ctx.jid, { badword: sub === 'on' });
        return ctx.reply(`✅ BadWord ${sub === 'on' ? 'diaktifkan' : 'dimatikan'}.`);
      }
      if (sub === 'list') return ctx.reply(cfg.badwords.length ? `Kata terlarang (${cfg.badwords.length}):\n${cfg.badwords.map((w) => `• ${w}`).join('\n')}` : 'Belum ada kata terlarang.');
      if (!word || word.length > 30) throw new UserError('Tulis satu kata/frasa (maks 30 karakter).');
      if (sub === 'add') {
        if (cfg.badwords.length >= 100) throw new UserError('Maksimal 100 kata.');
        if (cfg.badwords.includes(word)) throw new UserError('Kata itu sudah ada.');
        groupService.update(ctx.jid, { badwords: [...cfg.badwords, word] });
        return ctx.reply(`✅ Ditambahkan: ${word}`);
      }
      if (sub === 'del') {
        if (!cfg.badwords.includes(word)) throw new UserError('Kata itu tidak ada di daftar.');
        groupService.update(ctx.jid, { badwords: cfg.badwords.filter((w) => w !== word) });
        return ctx.reply(`✅ Dihapus: ${word}`);
      }
      throw new UserError('Subperintah: on, off, add, del, list.');
    },
  },
  {
    ...base,
    name: 'autorespon',
    display: 'AutoRespon',
    description: 'Balasan otomatis: .autorespon add <pemicu> | <balasan>, del <pemicu>, list',
    usage: '.autorespon <add|del|list>',
    minArgs: 1,
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const cfg = groupService.get(ctx.jid);
      const sub = ctx.args[0].toLowerCase();
      const rest = ctx.argText.slice(ctx.args[0].length).trim();
      if (sub === 'list') return ctx.reply(cfg.autorespon.length ? cfg.autorespon.map((r) => `• ${r.trigger} → ${r.reply.slice(0, 60)}`).join('\n') : 'Belum ada autorespon.');
      if (sub === 'add') {
        const [trigger, ...replyParts] = rest.split('|');
        const t = (trigger || '').trim().toLowerCase();
        const reply = replyParts.join('|').trim();
        if (!t || !reply) throw new UserError('Format: .autorespon add <pemicu> | <balasan>');
        if (t.length > 40 || reply.length > 500) throw new UserError('Pemicu maks 40 dan balasan maks 500 karakter.');
        if (cfg.autorespon.length >= 50 && !cfg.autorespon.some((r) => r.trigger === t)) throw new UserError('Maksimal 50 autorespon.');
        groupService.update(ctx.jid, { autorespon: [...cfg.autorespon.filter((r) => r.trigger !== t), { trigger: t, reply }] });
        return ctx.reply(`✅ Autorespon disimpan untuk "${t}".`);
      }
      if (sub === 'del') {
        const t = rest.toLowerCase();
        if (!cfg.autorespon.some((r) => r.trigger === t)) throw new UserError('Pemicu tidak ditemukan.');
        groupService.update(ctx.jid, { autorespon: cfg.autorespon.filter((r) => r.trigger !== t) });
        return ctx.reply('✅ Autorespon dihapus.');
      }
      throw new UserError('Subperintah: add, del, list.');
    },
  },
  {
    ...base,
    name: 'groupprefix',
    display: 'GroupPrefix',
    description: 'Atur prefix tambahan khusus grup ("reset" untuk menghapus)',
    usage: '.groupprefix <prefix|reset>',
    minArgs: 1,
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const p = ctx.args[0];
      if (p.toLowerCase() === 'reset') {
        groupService.update(ctx.jid, { prefix: null });
        return ctx.reply('✅ Prefix grup dihapus.');
      }
      if (p.length > 3 || /[\s\p{L}\p{N}]/u.test(p)) throw new UserError('Prefix 1-3 karakter simbol (bukan huruf/angka/spasi).');
      groupService.update(ctx.jid, { prefix: p });
      await ctx.reply(`✅ Prefix grup: ${p} (prefix global tetap berlaku).`);
    },
  },
  {
    ...base,
    name: 'settimezone',
    display: 'SetTimezone',
    description: 'Atur zona waktu grup (lihat .listtimezone)',
    usage: '.settimezone <zona>',
    minArgs: 1,
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const tz = TZ.find((z) => z.toLowerCase() === ctx.args[0].toLowerCase());
      if (!tz) throw new UserError('Zona tidak tersedia. Lihat .listtimezone');
      groupService.update(ctx.jid, { timezone: tz });
      await ctx.reply(`✅ Zona waktu grup: ${tz}`);
    },
  },
  {
    category: 'GROUP',
    name: 'listtimezone',
    display: 'ListTimezone',
    description: 'Daftar zona waktu yang didukung',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      await ctx.reply(`*Zona waktu*\n${TZ.map((z) => `• ${z}`).join('\n')}`);
    },
  },
  {
    ...base,
    name: 'setlang',
    display: 'SetLang',
    description: 'Atur bahasa grup (saat ini hanya id)',
    usage: '.setlang id',
    minArgs: 1,
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      if (ctx.args[0].toLowerCase() !== 'id') throw new UserError('Saat ini hanya bahasa Indonesia (id) yang tersedia.');
      groupService.update(ctx.jid, { lang: 'id' });
      await ctx.reply('✅ Bahasa grup: id');
    },
  },
  {
    category: 'GROUP',
    groupOnly: true,
    name: 'groupsettings',
    display: 'GroupSettings',
    description: 'Ringkasan pengaturan bot di grup ini',
    status: 'tested',
    tests: 'tests/group.test.js',
    async run(ctx) {
      const c = groupService.get(ctx.jid);
      await ctx.reply([
        '*Pengaturan grup*',
        `AntiLink: ${onOff(c.antilink)} · AntiSpam: ${onOff(c.antispam)} · AntiMedia: ${onOff(c.antimedia)}`,
        `BadWord: ${onOff(c.badword)} (${c.badwords.length} kata)`,
        `Welcome: ${onOff(c.welcome)} · Goodbye: ${onOff(c.goodbye)}`,
        `AdminOnly: ${onOff(c.adminOnly)}`,
        `Prefix grup: ${c.prefix || '-'} · Zona: ${c.timezone} · Bahasa: ${c.lang}`,
        `Batas peringatan: ${c.warnLimit} · Autorespon: ${c.autorespon.length}`,
      ].join('\n'));
    },
  },
];
