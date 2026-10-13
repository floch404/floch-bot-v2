'use strict';

/**
 * Uji NYATA API JWS dari mesin ini (butuh internet). Jika berhasil mengunduh gambar valid,
 * command .jws ditandai terverifikasi dan aktif di menu. Jika gagal, command tetap nonaktif.
 *   npm run check:jws
 */
const jwsService = require('../src/services/jws.service');
const config = require('../src/config');

(async () => {
  console.log(`Menguji ${config.jws.apiUrl} ...`);
  try {
    const r = await jwsService.fetchRandomImage();
    console.log(`Cara: ${r.via}\nSumber gambar: ${r.sourceUrl}\nTipe: ${r.mime}\nUkuran: ${r.buffer.length} byte`);
    jwsService.markVerified({ via: r.via, mime: r.mime, bytes: r.buffer.length });
    console.log('\nBERHASIL. Command .jws sekarang aktif (Premium/Owner). Restart bot.');
  } catch (err) {
    console.error(`\nGAGAL: ${err.message}`);
    console.error('Command .jws tetap nonaktif. Periksa JWS_API_URL / JWS_JSON_PATH di .env dan lihat README.');
    process.exitCode = 1;
  }
})();
