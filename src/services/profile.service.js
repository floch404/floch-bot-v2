'use strict';

const { db } = require('../database');

class ProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileError';
  }
}

const levelFromXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
const xpForLevel = (level) => 100 * (level - 1) ** 2;

function ensure(number) {
  db.prepare('INSERT OR IGNORE INTO profiles (number, created_at) VALUES (?, ?)').run(number, Date.now());
}

function get(number) {
  ensure(number);
  const p = db.prepare('SELECT * FROM profiles WHERE number = ?').get(number);
  return { ...p, level: levelFromXp(p.xp) };
}

function setField(number, field, value) {
  ensure(number);
  db.prepare(`UPDATE profiles SET ${field} = ? WHERE number = ?`).run(value, number); // field berasal dari kode, bukan input
  return get(number);
}

// Teks bebas hanya disimpan sebagai teks; kontrol/zero-width dibuang agar tampilan tidak dapat dimanipulasi.
const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').trim();

function setName(number, text) {
  const v = clean(text);
  if (v.length < 2 || v.length > 30) throw new ProfileError('Nama harus 2-30 karakter.');
  return setField(number, 'name', v);
}

function setAge(number, text) {
  if (!/^\d{1,3}$/.test(String(text).trim())) throw new ProfileError('Umur harus berupa angka.');
  const n = parseInt(text, 10);
  if (n < 5 || n > 100) throw new ProfileError('Umur harus 5-100.');
  return setField(number, 'age', n);
}

const GENDERS = { pria: 'Pria', laki: 'Pria', cowok: 'Pria', male: 'Pria', wanita: 'Wanita', perempuan: 'Wanita', cewek: 'Wanita', female: 'Wanita', lainnya: 'Lainnya', other: 'Lainnya' };
function setGender(number, text) {
  const g = GENDERS[String(text).trim().toLowerCase()];
  if (!g) throw new ProfileError('Pilih: pria, wanita, atau lainnya.');
  return setField(number, 'gender', g);
}

function setBio(number, text) {
  const v = clean(text);
  if (!v || v.length > 150) throw new ProfileError('Bio harus 1-150 karakter.');
  return setField(number, 'bio', v);
}

// Prefix pribadi hanya mengubah cara bot membaca pesan DARI pengguna ini. Prefix global "." tetap berlaku.
const PREFIX_RE = /^[!#$%&*+,\-./:;<=>?@^_~|\\]{1,2}$/;
function setPrefix(number, text) {
  const v = String(text).trim();
  if (v.toLowerCase() === 'reset') return setField(number, 'prefix', null);
  if (!PREFIX_RE.test(v)) throw new ProfileError('Prefix: 1-2 simbol, mis. ! # $ ? atau ketik "reset".');
  return setField(number, 'prefix', v);
}

function setAfk(number, reason) {
  ensure(number);
  db.prepare('UPDATE profiles SET afk_reason = ?, afk_since = ? WHERE number = ?').run(clean(reason || 'AFK').slice(0, 100) || 'AFK', Date.now(), number);
}
function clearAfk(number) {
  const p = db.prepare('SELECT afk_reason, afk_since FROM profiles WHERE number = ?').get(number);
  if (!p || !p.afk_since) return null;
  db.prepare('UPDATE profiles SET afk_reason = NULL, afk_since = NULL WHERE number = ?').run(number);
  return { reason: p.afk_reason, since: p.afk_since };
}
function getAfk(number) {
  const p = db.prepare('SELECT afk_reason, afk_since FROM profiles WHERE number = ?').get(number);
  return p && p.afk_since ? { reason: p.afk_reason, since: p.afk_since } : null;
}

function addXp(number, amount) {
  ensure(number);
  const before = db.prepare('SELECT xp FROM profiles WHERE number = ?').get(number).xp;
  db.prepare('UPDATE profiles SET xp = xp + ? WHERE number = ?').run(amount, number);
  const after = before + amount;
  return { xp: after, level: levelFromXp(after), leveledUp: levelFromXp(after) > levelFromXp(before) };
}

function getPrefix(number) {
  if (!number) return null;
  return db.prepare('SELECT prefix FROM profiles WHERE number = ?').get(number)?.prefix || null;
}

module.exports = { ProfileError, get, setName, setAge, setGender, setBio, setPrefix, setAfk, clearAfk, getAfk, addXp, getPrefix, levelFromXp, xpForLevel };
