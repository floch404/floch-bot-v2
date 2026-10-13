'use strict';

const groupService = require('../../services/group.service');
const { deleteMessage, warnMember } = require('../../core/moderation');

const INVITE_LINK = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i;
const MEDIA_TYPES = new Set(['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage', 'audioMessage']);

const spamWindow = new Map(); // `${jid}|${number}` -> timestamps
const noticeAt = new Map(); // `${jid}|${hook}` -> waktu pemberitahuan terakhir

async function notifyOnce(ctx, hook, text) {
  const k = `${ctx.jid}|${hook}`;
  const now = Date.now();
  if (now - (noticeAt.get(k) || 0) < 10 * 60_000) return;
  noticeAt.set(k, now);
  await ctx.reply(text);
}

/** Pengecualian: admin grup & Owner tidak terkena filter. */
async function exempt(ctx) {
  if (ctx.role.isOwner) return true;
  const g = await ctx.group();
  return g.senderIsAdmin;
}

/**
 * Jalankan hook moderasi grup. Mengembalikan true jika pesan sudah "dikonsumsi"
 * (mis. dihapus) sehingga tidak diproses sebagai command.
 */
async function runGroupHooks(ctx) {
  const cfg = groupService.get(ctx.jid);
  const sender = ctx.sender;
  if (!sender) return false;

  // 1) anggota yang di-mute: pesannya dihapus jika bot admin
  if (groupService.isMuted(ctx.jid, sender) && !(await exempt(ctx))) {
    const g = await ctx.group();
    if (g.botIsAdmin) await deleteMessage(ctx);
    return true;
  }

  const needsInspection = cfg.antilink || cfg.antispam || cfg.badword || cfg.antimedia;
  if (!needsInspection) return false;
  if (await exempt(ctx)) return false;

  const violate = async (hook, reason) => {
    const g = await ctx.group();
    if (!g.botIsAdmin) {
      await notifyOnce(ctx, hook, `Fitur ${hook} aktif, tetapi bot bukan admin grup sehingga tidak dapat menghapus pesan. Jadikan bot admin.`);
      return false;
    }
    await deleteMessage(ctx);
    await warnMember(ctx, sender, reason);
    return true;
  };

  if (cfg.antilink && INVITE_LINK.test(ctx.text)) return violate('AntiLink', 'mengirim link undangan grup');

  if (cfg.antispam) {
    const k = `${ctx.jid}|${sender}`;
    const now = Date.now();
    const arr = (spamWindow.get(k) || []).filter((t) => now - t < 8000);
    arr.push(now);
    spamWindow.set(k, arr);
    if (spamWindow.size > 5000) for (const [key, v] of spamWindow) if (!v.length || now - v[v.length - 1] > 60_000) spamWindow.delete(key);
    if (arr.length > 5) {
      spamWindow.set(k, []);
      return violate('AntiSpam', 'spam pesan');
    }
  }

  if (cfg.badword && cfg.badwords.length && ctx.text) {
    const words = ctx.text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (cfg.badwords.some((w) => words.includes(w))) return violate('BadWord', 'menggunakan kata terlarang');
  }

  if (cfg.antimedia && MEDIA_TYPES.has(ctx.type)) {
    const g = await ctx.group();
    if (!g.botIsAdmin) {
      await notifyOnce(ctx, 'AntiMedia', 'Fitur AntiMedia aktif, tetapi bot bukan admin grup.');
      return false;
    }
    await deleteMessage(ctx);
    return true;
  }
  return false;
}

module.exports = { runGroupHooks, INVITE_LINK };
