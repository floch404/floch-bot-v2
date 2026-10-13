'use strict';

const jwsService = require('../../services/jws.service');
const { UserError } = require('../../core/executor');

/**
 * .jws — fitur PREMIUM, hanya di bot WhatsApp (tidak ada di website).
 * Izin Premium diperiksa di core/permissions.js setiap command dipanggil (Owner boleh sesuai PREMIUM_BYPASS_ROLES).
 * Status needs_config: tampil aktif di .menu hanya setelah `npm run check:jws` menguji API sungguhan dengan sukses.
 */
module.exports = {
  name: 'jws',
  display: 'jws',
  category: 'JWS',
  description: 'Random Waifu Search (gambar acak) — khusus Premium',
  usage: '.jws',
  permission: 'premium',
  status: 'needs_config',
  api: 'https://randomwaifu.com/get/api/',
  requires: ['jws-verified (npm run check:jws)'],
  isConfigured: () => jwsService.isVerified(),
  notConfiguredMessage: 'Fitur JWS belum aktif: integrasi API belum diverifikasi. Owner perlu menjalankan `npm run check:jws` di server.',

  async run(ctx) {
    try {
      const { buffer, mime } = await jwsService.getImage(ctx.sender || ctx.jid);
      // Dikirim sebagai MEDIA WhatsApp (buffer gambar), bukan tautan.
      await ctx.send({ image: buffer, mimetype: mime, caption: 'JWS • Random Waifu Search' });
    } catch (err) {
      if (err.name === 'JwsError') throw new UserError(`⚠️ ${err.message}`);
      throw err;
    }
  },
};
