'use strict';

const { toJid } = require('../../utils/jid');
const { targetsOf } = require('../../core/targets');
const { UserError } = require('../../core/executor');

/** Ubah anggota grup (add/remove/promote/demote) dan laporkan hasil NYATA per nomor dari WhatsApp. */
async function participantsAction(ctx, numbers, action) {
  if (!numbers.length) throw new UserError(`Target tidak ditemukan. Tag/reply pengguna atau tulis nomornya.\nPenggunaan: ${ctx.prefix}${ctx.commandName} <@tag|nomor>`);
  if (numbers.length > 10) throw new UserError('Maksimal 10 target sekali jalan.');
  let res;
  try {
    res = await ctx.sock.groupParticipantsUpdate(ctx.jid, numbers.map(toJid), action);
  } catch (err) {
    throw new UserError(`WhatsApp menolak permintaan: ${String(err.message || err).slice(0, 120)}`);
  }
  ctx.invalidateGroup();
  const list = Array.isArray(res) ? res : [];
  const ok = [];
  const failed = [];
  for (const n of numbers) {
    const r = list.find((x) => String(x?.jid || '').startsWith(`${n}@`));
    if (!r || String(r.status) === '200') ok.push(n);
    else failed.push(`${n} (kode ${r.status})`);
  }
  return { ok, failed };
}

const report = (ok, failed, verb) => [
  ok.length ? `✅ ${verb}: ${ok.map((n) => `@${n}`).join(', ')}` : null,
  failed.length ? `⚠️ Gagal: ${failed.join(', ')}` : null,
].filter(Boolean).join('\n');

const groupTargets = (ctx) => targetsOf(ctx);

/** Pembatasan sederhana per grup agar tidak spam mention. */
const lastUse = new Map();
function cooldown(ctx, key, ms) {
  const k = `${ctx.session.sid}|${ctx.jid}|${key}`;
  const left = ms - (Date.now() - (lastUse.get(k) || 0));
  if (left > 0) throw new UserError(`Tunggu ${Math.ceil(left / 1000)} detik sebelum memakai .${key} lagi di grup ini.`);
  lastUse.set(k, Date.now());
}

module.exports = { participantsAction, report, groupTargets, cooldown };
