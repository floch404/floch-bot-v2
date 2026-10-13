'use strict';

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (d || h) parts.push(`${h}h`);
  parts.push(`${m}m`, `${s}s`);
  return parts.join(' ');
}

/** 628123456789 -> 6281****6789 */
function maskNumber(number) {
  if (!number) return null;
  const s = String(number);
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}${'*'.repeat(s.length - 8)}${s.slice(-4)}`;
}

/** Normalisasi nomor: hanya digit, 8-15 digit, tidak diawali 0 (wajib kode negara). null jika tidak valid. */
function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[\s\-().+]/g, '');
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith('0')) return null;
  return digits;
}

function truncate(text, max) {
  const s = String(text);
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Pecah teks panjang menjadi potongan <= max karakter pada batas baris. */
function chunkLines(lines, max) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const piece = line.length > max ? truncate(line, max) : line;
    if (cur && cur.length + piece.length + 1 > max) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur = cur ? `${cur}\n${piece}` : piece;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hari saat ini (YYYY-MM-DD) pada zona waktu tertentu. */
function dayKey(date = new Date(), timeZone = 'Asia/Jakarta') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDate(ms, timeZone = 'Asia/Jakarta') {
  if (!ms) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

module.exports = { formatDuration, maskNumber, normalizePhone, truncate, chunkLines, sleep, dayKey, formatDate };
