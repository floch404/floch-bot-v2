'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const { normalizePhone } = require('../utils/format');

class PairingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PairingError';
    this.status = status;
    this.expose = true;
  }
}

/** Gabungkan kode negara + nomor lokal menjadi nomor internasional (digit saja). Null jika tidak valid. */
function buildPhone(body) {
  const country = String(body?.country ?? '').replace(/\D/g, '');
  const raw = String(body?.number ?? '');
  if (!/^\d{1,3}$/.test(country) || !/^[\d\s\-().]{6,20}$/.test(raw)) return null;
  let local = raw.replace(/\D/g, '').replace(/^0+/, '');
  // Pengguna kadang mengetik kode negara lagi (mis. 62812... dengan +62): jangan digandakan.
  if (local.startsWith(country) && local.length >= country.length + 9) local = local.slice(country.length);
  return normalizePhone(`${country}${local}`);
}

function checkAccessCode(provided) {
  const required = config.site.accessCode;
  if (!required) return true;
  const a = crypto.createHash('sha256').update(String(provided ?? '')).digest();
  const b = crypto.createHash('sha256').update(required).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validasi permintaan pairing lalu minta manager membuat sesi.
 * @param {object} p { sid, issue(): sid baru, body, manager }
 */
async function connect({ sid, issue, body, manager }) {
  if (!checkAccessCode(body?.accessCode)) throw new PairingError('Kode akses salah.', 403);
  const phone = buildPhone(body);
  if (!phone) throw new PairingError('Nomor tidak valid. Pilih kode negara dan isi nomor tanpa 0 di depan, mis. 812 3456 7890.');
  const id = sid || issue();
  return manager.connect(id, phone);
}

module.exports = { PairingError, buildPhone, checkAccessCode, connect };
