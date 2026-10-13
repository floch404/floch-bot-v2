'use strict';

const fs = require('node:fs');
const path = require('node:path');
const inventory = require('../commands/_inventory');

/**
 * REGISTRY COMMAND PUSAT. Satu-satunya sumber kebenaran untuk command handler, .menu, .help, izin, dan laporan status.
 *
 * Metadata command:
 *   name, aliases[], category, alsoIn[], description, usage, handler (run), params (minArgs),
 *   api / requires[] (kebutuhan konfigurasi/API), permission, groupOnly, privateOnly, groupAdmin, botAdmin,
 *   limit (biaya limit harian), limitKind ('cmd'|'game'), status, examples[] (pengujian otomatis).
 *
 * status:
 *   tested       kode lengkap + diuji otomatis lewat `examples`/file tes (tanpa WhatsApp/jaringan sungguhan)
 *   implemented  kode lengkap, diuji dengan socket/API tiruan; BELUM diuji ke WhatsApp/API sungguhan
 *   needs_config butuh konfigurasi (API key / verifikasi). Aktif di menu hanya jika isConfigured() true
 *   planned      belum diimplementasikan (tidak tampil di menu, tidak dihitung di Total Cmd)
 */

const CATEGORY_ORDER = Object.keys(inventory);
const PERMISSIONS = ['public', 'premium', 'admin', 'owner'];
const STATUSES = ['tested', 'implemented', 'needs_config', 'planned'];

const byName = new Map(); // nama kecil -> definisi
const aliasToName = new Map();
let finalized = false;

function normalize(def, source) {
  const where = source ? ` (${source})` : '';
  if (!def || typeof def.name !== 'string' || !def.name) throw new Error(`Command tanpa "name"${where}`);
  const d = {
    aliases: [],
    alsoIn: [],
    description: '',
    usage: '',
    permission: 'public',
    groupOnly: false,
    privateOnly: false,
    groupAdmin: false,
    botAdmin: false,
    minArgs: 0,
    limit: 0,
    limitKind: 'cmd',
    status: 'implemented',
    requires: [],
    api: null,
    examples: [],
    display: null,
    ...def,
  };
  d.category = String(d.category || 'GENERAL').toUpperCase();
  d.key = d.name.toLowerCase();
  if (!PERMISSIONS.includes(d.permission)) throw new Error(`Permission tidak valid pada ${d.name}${where}`);
  if (!STATUSES.includes(d.status)) throw new Error(`Status tidak valid pada ${d.name}${where}`);
  if (d.status !== 'planned' && typeof d.run !== 'function') throw new Error(`Command ${d.name} wajib punya run()${where}`);
  if (d.status === 'needs_config' && typeof d.isConfigured !== 'function') {
    d.isConfigured = () => d.requires.every((k) => !!process.env[k]);
  }
  return d;
}

function register(def, source) {
  const d = normalize(def, source);
  const keys = [d.key, ...d.aliases.map((a) => a.toLowerCase())];
  for (const k of keys) {
    if (byName.has(k) || aliasToName.has(k)) throw new Error(`Nama/alias command bentrok: "${k}"${source ? ` (${source})` : ''}`);
  }
  if (finalized) {
    d.display = d.display || d.name;
    d.categories = [...new Set([d.category, ...d.alsoIn.map((c) => c.toUpperCase())])];
  }
  byName.set(d.key, d);
  for (const a of d.aliases) aliasToName.set(a.toLowerCase(), d.key);
  return d;
}

function loadDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) loadDir(full);
    else if (entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
      const exported = require(full);
      for (const def of Array.isArray(exported) ? exported : [exported]) register(def, path.relative(path.join(__dirname, '..'), full));
    }
  }
}

/** Tambahkan stub "planned" untuk nama pada inventaris yang belum punya implementasi, dan hitung kategori tiap command. */
function finalize() {
  const invCats = new Map(); // nama kecil -> {display, categories:Set}
  for (const [cat, names] of Object.entries(inventory)) {
    for (const n of names) {
      const k = n.toLowerCase();
      if (!invCats.has(k)) invCats.set(k, { display: n, categories: new Set() });
      invCats.get(k).categories.add(cat);
    }
  }
  for (const [k, info] of invCats) {
    if (!byName.has(k) && !aliasToName.has(k)) {
      byName.set(k, normalize({ name: info.display, category: [...info.categories][0], status: 'planned', description: 'Belum diimplementasikan.' }));
    }
  }
  for (const d of byName.values()) {
    const inv = invCats.get(d.key);
    if (!d.display) d.display = inv?.display || d.name;
    d.categories = [...new Set([d.category, ...d.alsoIn.map((c) => c.toUpperCase()), ...(inv ? inv.categories : [])])];
  }
  finalized = true;
}

let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  loadDir(path.join(__dirname, '..', 'commands'));
  finalize();
}

function find(name) {
  ensureLoaded();
  const k = String(name || '').toLowerCase();
  return byName.get(k) || byName.get(aliasToName.get(k)) || null;
}

function isActive(def) {
  if (def.status === 'planned') return false;
  if (def.status === 'needs_config') return !!def.isConfigured();
  return true;
}

const all = () => (ensureLoaded(), [...byName.values()]);
const active = () => all().filter(isActive);

/** Daftar kategori berurutan sesuai spesifikasi, berisi command AKTIF. Kategori kosong dilewati. */
function categories({ includeEmpty = false } = {}) {
  const act = active();
  const names = [...new Set([...CATEGORY_ORDER, ...act.flatMap((d) => d.categories)])];
  return names
    .map((name) => ({ name, commands: act.filter((d) => d.categories.includes(name)).sort((a, b) => a.display.localeCompare(b.display, 'en', { sensitivity: 'base' })) }))
    .filter((c) => includeEmpty || c.commands.length);
}

module.exports = { register, find, all, active, isActive, categories, CATEGORY_ORDER, PERMISSIONS, STATUSES, ensureLoaded };
