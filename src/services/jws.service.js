'use strict';

/**
 * Adapter JWS (Random Waifu Search) — dipakai HANYA oleh command bot ".jws" (bukan oleh website).
 *
 * CATATAN: saat proyek ini dibuat, https://randomwaifu.com/get/api/ tidak dapat diverifikasi
 * (akses otomatis dari lingkungan pengembangan diblokir). Adapter TIDAK mengarang format. Ia menangani:
 *   1. API langsung membalas gambar (Content-Type image/*)  -> dipakai apa adanya.
 *   2. API membalas JSON berisi URL gambar                   -> URL dari JWS_JSON_PATH, atau kunci umum
 *      (url, image, image_url, imageUrl, link, file).
 * Format lain ditolak dengan pesan jelas. Jalankan `npm run check:jws` di server kamu: skrip itu menguji API
 * sungguhan dan, jika berhasil, menandai JWS sebagai "terverifikasi" sehingga tampil aktif di .menu.
 */

const fs = require('node:fs');
const dns = require('node:dns').promises;
const net = require('node:net');
const config = require('../config');
const settings = require('./settings.service');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const COMMON_KEYS = ['url', 'image', 'image_url', 'imageUrl', 'link', 'file'];

class JwsError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'JwsError';
    this.code = code; // DISABLED | COOLDOWN | UNAVAILABLE | BAD_FORMAT
    this.status = status;
  }
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  return true;
}

async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new JwsError('URL dari API tidak valid.', 'BAD_FORMAT', 502);
  }
  if (url.protocol !== 'https:' && !(config.jws.allowHttp && url.protocol === 'http:')) {
    throw new JwsError('Sumber gambar harus memakai HTTPS.', 'BAD_FORMAT', 502);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new JwsError('Host tidak diizinkan.', 'BAD_FORMAT', 502);
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new JwsError('Host tidak diizinkan.', 'BAD_FORMAT', 502);
  return url;
}

async function safeFetch(rawUrl, accept, hops = 3) {
  let current = rawUrl;
  for (let i = 0; i <= hops; i++) {
    const url = await assertSafeUrl(current);
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(config.jws.timeoutMs),
        headers: { Accept: accept, 'User-Agent': 'FlochBot/1.0' },
      });
    } catch {
      throw new JwsError('API JWS tidak dapat dijangkau (timeout/jaringan). Coba lagi nanti.', 'UNAVAILABLE', 503);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString();
      continue;
    }
    if (!res.ok) throw new JwsError(`API JWS membalas status ${res.status}.`, 'UNAVAILABLE', 503);
    return res;
  }
  throw new JwsError('Terlalu banyak pengalihan dari API JWS.', 'UNAVAILABLE', 503);
}

async function readLimited(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'));
  if (declared && declared > maxBytes) throw new JwsError('Gambar terlalu besar.', 'BAD_FORMAT', 502);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) throw new JwsError('Gambar terlalu besar.', 'BAD_FORMAT', 502);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const getByPath = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

/** Ambil URL gambar dari JSON. Diekspor agar mudah diuji/disesuaikan. */
function extractImageUrl(json, jsonPath = config.jws.jsonPath) {
  const pick = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
  if (jsonPath) return pick(getByPath(json, jsonPath));
  if (typeof json === 'string') return pick(json);
  const root = Array.isArray(json) ? json[0] : json;
  if (root && typeof root === 'object') {
    for (const key of COMMON_KEYS) {
      const found = pick(root[key]);
      if (found) return found;
    }
  }
  return null;
}

const mimeOf = (res) => (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

async function downloadImage(res) {
  const mime = mimeOf(res);
  if (!ALLOWED_MIME.has(mime)) throw new JwsError('Format gambar dari API tidak didukung.', 'BAD_FORMAT', 502);
  const buffer = await readLimited(res, config.jws.maxBytes);
  if (!buffer.length) throw new JwsError('API membalas gambar kosong.', 'BAD_FORMAT', 502);
  return { buffer, mime };
}

/** Ambil satu gambar dari API. Tidak pernah mengembalikan data palsu: gagal = melempar JwsError. */
async function fetchRandomImage() {
  const res = await safeFetch(config.jws.apiUrl, 'image/*,application/json');
  const mime = mimeOf(res);

  if (mime.startsWith('image/')) {
    return { ...(await downloadImage(res)), sourceUrl: config.jws.apiUrl, via: 'direct-image' };
  }
  if (mime.includes('json')) {
    let json;
    try {
      json = JSON.parse((await readLimited(res, 256 * 1024)).toString('utf8'));
    } catch (err) {
      if (err instanceof JwsError) throw err;
      throw new JwsError('Respons JSON dari API tidak dapat dibaca.', 'BAD_FORMAT', 502);
    }
    const imageUrl = extractImageUrl(json);
    if (!imageUrl) throw new JwsError('Format JSON API belum dikenali. Atur JWS_JSON_PATH di .env (lihat README).', 'BAD_FORMAT', 502);
    const img = await downloadImage(await safeFetch(imageUrl, 'image/*'));
    return { ...img, sourceUrl: imageUrl, via: 'json-url' };
  }
  throw new JwsError('API JWS membalas format yang tidak didukung adapter. Lihat README.', 'BAD_FORMAT', 502);
}

// ----- penanda "terverifikasi" (dibuat oleh `npm run check:jws` setelah uji sungguhan) -----
function readVerification() {
  try {
    const v = JSON.parse(fs.readFileSync(config.jws.verifiedFile, 'utf8'));
    return v && v.apiUrl === config.jws.apiUrl ? v : null;
  } catch {
    return null;
  }
}
function markVerified(info) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(config.jws.verifiedFile, JSON.stringify({ apiUrl: config.jws.apiUrl, verifiedAt: Date.now(), ...info }), { mode: 0o600 });
}
const isVerified = () => !!readVerification();

const lastUse = new Map(); // number -> timestamp

/**
 * Dipanggil oleh command .jws SETELAH izin Premium diperiksa di core/permissions.
 * Memeriksa saklar fitur dan cooldown per nomor, lalu mengambil gambar.
 */
async function getImage(number) {
  if (!settings.get('jws_enabled')) throw new JwsError('Fitur JWS sedang dinonaktifkan oleh Owner.', 'DISABLED', 503);
  const cooldown = settings.get('jws_cooldown_seconds') * 1000;
  const now = Date.now();
  const wait = (lastUse.get(number) || 0) + cooldown - now;
  if (wait > 0) throw new JwsError(`Tunggu ${Math.ceil(wait / 1000)} detik sebelum meminta gambar lagi.`, 'COOLDOWN', 429);
  lastUse.set(number, now);
  try {
    return await fetchRandomImage();
  } catch (err) {
    lastUse.delete(number); // permintaan gagal tidak menghabiskan cooldown
    throw err;
  }
}

module.exports = { getImage, fetchRandomImage, extractImageUrl, isPrivateIp, isVerified, markVerified, readVerification, JwsError };
