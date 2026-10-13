'use strict';

const config = require('../config');
const { formatDate } = require('../utils/format');

/**
 * Pemeriksaan izin command. SELALU dipanggil di backend setiap command dijalankan
 * (menyembunyikan command dari menu BUKAN mekanisme keamanan).
 *
 * Lima status yang dipisahkan:
 *   Owner bot (OWNER_NUMBERS) · Admin bot (tabel bot_admins) · Admin grup WhatsApp (dari metadata grup)
 *   · Premium aktif (tabel premium) · User biasa.
 * Admin grup WhatsApp TIDAK otomatis Admin bot, dan sebaliknya.
 *
 * @returns {Promise<{ok:true}|{ok:false,message:string}>}
 */
async function check(def, ctx) {
  const role = ctx.role;

  if (def.permission === 'owner' && !role.isOwner) {
    return deny('Command ini khusus Owner bot.');
  }
  if (def.permission === 'admin' && !(role.isOwner || role.isAdmin)) {
    return deny('Command ini khusus Admin bot atau Owner.');
  }
  if (def.permission === 'premium' && !role.hasPremiumAccess) {
    if (role.premium.expired) {
      return deny(`Command ini khusus Premium. Premium kamu sudah kedaluwarsa pada ${formatDate(role.premium.expiresAt, config.timezone)}.\nPerpanjang dengan .redeem <kode> atau hubungi Owner.`);
    }
    return deny('Command ini khusus Premium aktif. Lihat .premium untuk info atau .redeem <kode> jika punya kode.');
  }

  if (def.groupOnly && !ctx.isGroup) return deny('Command ini hanya dapat dipakai di dalam grup.');
  if (def.privateOnly && ctx.isGroup) return deny('Command ini hanya dapat dipakai di chat pribadi.');

  if (def.groupAdmin || def.botAdmin) {
    if (!ctx.isGroup) return deny('Command ini hanya dapat dipakai di dalam grup.');
    let g;
    try {
      g = await ctx.group();
    } catch {
      return deny('Gagal membaca data grup dari WhatsApp. Coba lagi sebentar lagi.');
    }
    if (def.groupAdmin) {
      const ownerOverride = role.isOwner && config.ownerBypassGroupAdmin;
      if (!g.senderIsAdmin && !ownerOverride) return deny('Command ini khusus admin grup WhatsApp.');
    }
    if (def.botAdmin && !g.botIsAdmin) return deny('Jadikan bot sebagai admin grup terlebih dahulu agar command ini bisa dijalankan.');
  }
  return { ok: true };
}

const deny = (message) => ({ ok: false, message });

module.exports = { check };
