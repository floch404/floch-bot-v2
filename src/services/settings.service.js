'use strict';

const { db, transaction } = require('../database');

/** Konfigurasi global bot (hanya Owner yang boleh mengubah, lewat command .BotSettings dan sejenisnya). */
const DEFINITIONS = {
  self_mode: { type: 'bool', default: false, label: 'Self mode (hanya Owner yang dilayani)' },
  group_only: { type: 'bool', default: false, label: 'Group mode (chat pribadi diabaikan, kecuali Owner)' },
  join_enabled: { type: 'bool', default: true, label: 'Join mode (command .join aktif)' },
  auto_read: { type: 'bool', default: false, label: 'Auto read (tandai pesan sudah dibaca)' },
  reject_call: { type: 'bool', default: false, label: 'Tolak panggilan masuk otomatis' },
  pacing_ms: { type: 'int', default: 0, min: 0, max: 5000, label: 'Pacing: jeda sebelum membalas (ms)' },
  jws_enabled: { type: 'bool', default: true, label: 'Fitur JWS aktif' },
  jws_cooldown_seconds: { type: 'int', default: 5, min: 0, max: 3600, label: 'Jeda antar permintaan JWS (detik)' },
};

function parse(def, raw) {
  if (raw === undefined || raw === null) return def.default;
  if (def.type === 'bool') return raw === 'true';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : def.default;
}

function get(key) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Pengaturan tidak dikenal: ${key}`);
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return parse(def, row?.value);
}

function all() {
  const out = {};
  for (const key of Object.keys(DEFINITIONS)) out[key] = get(key);
  return out;
}

/** Ubah nilai teks dari command (mis. "on", "off", "250") menjadi nilai bertipe lalu validasi. */
function coerce(key, text) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Pengaturan tidak dikenal: ${key}`);
  const t = String(text).trim().toLowerCase();
  if (def.type === 'bool') {
    if (['on', 'true', '1', 'ya', 'aktif'].includes(t)) return true;
    if (['off', 'false', '0', 'tidak', 'mati'].includes(t)) return false;
    throw new Error(`${key}: gunakan on atau off.`);
  }
  if (!/^-?\d+$/.test(t)) throw new Error(`${key}: harus berupa angka.`);
  const n = parseInt(t, 10);
  if (n < def.min || n > def.max) throw new Error(`${key}: harus ${def.min}-${def.max}.`);
  return n;
}

function update(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Data pengaturan tidak valid.');
  const clean = {};
  for (const [key, value] of Object.entries(patch)) {
    const def = DEFINITIONS[key];
    if (!def) throw new Error(`Pengaturan tidak dikenal: ${key}`);
    if (def.type === 'bool') {
      if (typeof value !== 'boolean') throw new Error(`${key}: harus true/false.`);
    } else if (!Number.isInteger(value) || value < def.min || value > def.max) {
      throw new Error(`${key}: harus bilangan bulat ${def.min}-${def.max}.`);
    }
    clean[key] = String(value);
  }
  transaction(() => {
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(clean)) stmt.run(k, v);
  });
  return all();
}

module.exports = { get, all, update, coerce, DEFINITIONS };
