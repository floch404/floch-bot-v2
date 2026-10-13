'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../../config');
const registry = require('../../core/registry');
const { formatDuration } = require('../../utils/format');

const CAPTION_LIMIT = 1000; // batas aman caption gambar WhatsApp (~1024)
const TEXT_LIMIT = 3500;
const STATUS_LABEL = {
  connected: 'Online',
  connecting: 'Connecting',
  waiting_pairing: 'Waiting for Pairing',
  reconnecting: 'Reconnecting',
  disconnected: 'Offline',
  error: 'Error',
};
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const LEGEND = '★ Premium · ✦ Admin bot · ♛ Owner · ⚑ Khusus grup';

function mark(def) {
  let m = '';
  if (def.permission === 'premium') m += ' ★';
  if (def.permission === 'admin') m += ' ✦';
  if (def.permission === 'owner') m += ' ♛';
  if (def.groupOnly || def.groupAdmin) m += ' ⚑';
  return m;
}

/** Header persis sesuai format, dengan data aktual: runtime, total command aktif di registry, dan status sesi. */
function buildHeader(ctx) {
  const { identity } = config;
  const since = ctx.session.connectedAt || null;
  const runtime = formatDuration(since ? Date.now() - since : process.uptime() * 1000);
  return [
    `╭─「 ${identity.botName} 」`,
    `│ Owner: ${identity.owner}`,
    `│ Developer: ${identity.developer}`,
    `│ Runtime: ${runtime}`,
    `│ Total Cmd: ${registry.active().length}`,
    `│ Status: ${STATUS_LABEL[ctx.session.status] || ctx.session.status}`,
    '╰────────────',
  ];
}

function buildBody(ctx, only) {
  const lines = [];
  for (const cat of registry.categories()) {
    if (only && cat.name !== only) continue;
    const cmds = config.menuShowRestricted
      ? cat.commands
      : cat.commands.filter((d) => d.permission === 'public' || (d.permission === 'premium' && ctx.role.hasPremiumAccess) || (d.permission === 'admin' && (ctx.role.isAdmin || ctx.role.isOwner)) || (d.permission === 'owner' && ctx.role.isOwner));
    if (!cmds.length) continue;
    lines.push(`╭─「 ${cat.name} 」`);
    for (const d of cmds) lines.push(`│ ${config.prefix}${d.display}${mark(d)}`);
    lines.push('╰────────────');
  }
  return lines;
}

/** Pecah menu menjadi beberapa pesan berurutan: pesan pertama (caption gambar) <= 1000 karakter. */
function buildMessages(ctx, only = null) {
  const header = buildHeader(ctx);
  const body = buildBody(ctx, only);
  const all = [...header, ...(body.length ? ['', ...body, '', LEGEND] : [])];

  let first = '';
  let i = 0;
  for (; i < all.length; i++) {
    const next = first ? `${first}\n${all[i]}` : all[i];
    if (next.length > CAPTION_LIMIT) break;
    first = next;
  }
  const rest = all.slice(i);
  const parts = [first];
  let cur = '';
  for (const line of rest) {
    if (cur && cur.length + line.length + 1 > TEXT_LIMIT) {
      parts.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur.trim()) parts.push(cur);
  return parts.length > 1 ? parts.map((p, n) => (n === 0 ? p : `${p}\n\n(bagian ${n + 1}/${parts.length})`)) : parts;
}

let warnedMissingImage = false;

module.exports = {
  name: 'menu',
  display: 'Menu',
  category: 'GENERAL',
  description: 'Tampilkan daftar command aktif (.menu <kategori> untuk satu kategori)',
  usage: '.menu [kategori]',
  status: 'tested',
  buildMessages,
  buildHeader,
  STATUS_LABEL,

  async run(ctx) {
    let only = null;
    if (ctx.args[0]) {
      only = ctx.args[0].toUpperCase();
      const names = registry.categories().map((c) => c.name);
      if (!names.includes(only)) {
        await ctx.reply(`Kategori tidak ditemukan.\nKategori tersedia: ${names.join(', ')}`);
        return;
      }
    }
    const parts = buildMessages(ctx, only);

    let image = null;
    try {
      image = await fs.readFile(config.menuImagePath);
    } catch {
      if (!warnedMissingImage) {
        warnedMissingImage = true;
        console.warn(`[menu] Gambar menu tidak ditemukan di ${config.menuImagePath}. Memakai fallback teks.`);
      }
    }

    let sentImage = false;
    if (image) {
      try {
        // Gambar dikirim sebagai MEDIA WhatsApp (buffer), dengan caption = bagian pertama menu.
        await ctx.send({ image, caption: parts[0], mimetype: MIME[path.extname(config.menuImagePath).toLowerCase()] || 'image/jpeg' });
        sentImage = true;
      } catch (err) {
        console.error('[menu] gagal mengirim gambar, memakai fallback teks:', err.message);
      }
    }
    if (!sentImage) await ctx.reply(parts[0]);
    for (const p of parts.slice(1)) await ctx.reply(p);
  },
};
