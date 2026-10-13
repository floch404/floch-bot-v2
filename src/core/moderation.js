'use strict';

const groupService = require('../services/group.service');
const { toJid } = require('../utils/jid');

/** Hapus satu pesan di grup (butuh bot admin). Mengembalikan true jika permintaan dikirim tanpa error. */
async function deleteMessage(ctx, key = ctx.msg.key) {
  try {
    await ctx.sock.sendMessage(ctx.jid, { delete: key });
    return true;
  } catch {
    return false;
  }
}

/**
 * Beri peringatan. Jika mencapai batas, anggota dikeluarkan (jika bot admin).
 * Tidak pernah mengklaim berhasil mengeluarkan jika WhatsApp menolak.
 */
async function warnMember(ctx, number, reason) {
  const g = groupService.get(ctx.jid);
  const count = groupService.addWarning(ctx.jid, number);
  const limit = g.warnLimit;
  const tag = { mentions: [toJid(number)] };
  if (count < limit) {
    await ctx.send({ text: `⚠️ @${number} mendapat peringatan ${count}/${limit}.\nAlasan: ${reason}`, ...tag });
    return { count, kicked: false };
  }
  const info = await ctx.group();
  if (!info.botIsAdmin) {
    await ctx.send({ text: `⚠️ @${number} mencapai batas peringatan (${count}/${limit}), tetapi bot bukan admin sehingga tidak bisa mengeluarkan.`, ...tag });
    return { count, kicked: false };
  }
  try {
    const res = await ctx.sock.groupParticipantsUpdate(ctx.jid, [toJid(number)], 'remove');
    const failed = Array.isArray(res) && res.some((r) => r && r.status && String(r.status) !== '200');
    if (failed) {
      await ctx.send({ text: `⚠️ @${number} mencapai batas peringatan, tetapi WhatsApp menolak permintaan mengeluarkan.`, ...tag });
      return { count, kicked: false };
    }
    groupService.resetWarnings(ctx.jid, number);
    await ctx.send({ text: `🚫 @${number} dikeluarkan karena mencapai batas peringatan (${limit}).`, ...tag });
    return { count, kicked: true };
  } catch {
    await ctx.send({ text: `⚠️ @${number} mencapai batas peringatan, tetapi gagal dikeluarkan.`, ...tag });
    return { count, kicked: false };
  }
}

module.exports = { deleteMessage, warnMember };
