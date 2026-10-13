'use strict';

const permissions = require('./permissions');
const limits = require('../services/limit.service');
const stats = require('../services/stats.service');
const settings = require('../services/settings.service');
const registry = require('./registry');
const { sleep } = require('../utils/format');

/**
 * Menjalankan satu command: status → izin → argumen → limit → pacing → handler (dengan penanganan error).
 * Error di satu command TIDAK boleh menjatuhkan bot.
 */
async function execute(def, ctx) {
  try {
    if (def.status === 'planned') {
      await ctx.reply(`Command .${def.display || def.name} belum diimplementasikan.`);
      return { ran: false, reason: 'planned' };
    }
    if (def.status === 'needs_config' && !def.isConfigured()) {
      await ctx.reply(def.notConfiguredMessage || `Command .${def.display || def.name} belum aktif: konfigurasi belum lengkap (${(def.requires || []).join(', ') || 'lihat README'}).`);
      return { ran: false, reason: 'not_configured' };
    }

    const perm = await permissions.check(def, ctx);
    if (!perm.ok) {
      await ctx.reply(perm.message);
      return { ran: false, reason: 'denied' };
    }

    if (def.minArgs && ctx.args.length < def.minArgs) {
      await ctx.reply(`Parameter kurang.\nPenggunaan: ${def.usage || `.${def.name}`}`);
      return { ran: false, reason: 'usage' };
    }

    let consumed = 0;
    if (def.limit > 0 && ctx.sender) {
      const res = limits.consume(ctx.sender, def.limitKind, def.limit, { unlimited: ctx.role.isOwner });
      if (!res.ok) {
        await ctx.reply(`Limit harian ${def.limitKind === 'game' ? 'game' : 'command'} habis.\nCek .limit, klaim bonus dengan .daily, atau upgrade lewat .premium.`);
        return { ran: false, reason: 'limit' };
      }
      consumed = ctx.role.isOwner ? 0 : def.limit;
    }

    const pacing = settings.get('pacing_ms');
    if (pacing > 0) await sleep(pacing);

    try {
      await def.run(ctx);
      stats.recordCommand(def.key, ctx.sender, true);
      return { ran: true };
    } catch (err) {
      if (consumed) limits.refund(ctx.sender, def.limitKind, consumed);
      stats.recordCommand(def.key, ctx.sender, false);
      if (err && err.userMessage) {
        await ctx.reply(err.userMessage);
      } else {
        console.error(`[command:${def.key}]`, err);
        await ctx.reply('Terjadi kesalahan saat menjalankan command. Coba lagi nanti.');
      }
      return { ran: false, reason: 'error' };
    }
  } catch (err) {
    console.error('[executor] gagal membalas:', err.message);
    return { ran: false, reason: 'fatal' };
  }
}

/** Error yang aman ditampilkan ke pengguna (dipakai command untuk pesan kegagalan yang jelas). */
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.userMessage = message;
  }
}

module.exports = { execute, UserError, registry };
