'use strict';

const config = require('../config');
const { db, transaction } = require('../database');
const premiumService = require('./premium.service');

/**
 * Role bot, semuanya berbasis NOMOR WhatsApp:
 *  - Owner  : nomor di OWNER_NUMBERS (konfigurasi server; tidak dapat diubah lewat command)
 *  - Admin  : tersimpan di tabel bot_admins (hanya Owner yang dapat mengubah)
 *  - Premium: tersimpan di tabel premium dengan masa berlaku
 *  - Admin grup WhatsApp: BUKAN role bot; dicek per grup di core/permissions.js
 */

class RoleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RoleError';
  }
}

const isOwner = (number) => !!number && config.ownerNumbers.includes(String(number));
const isAdmin = (number) => !!number && !!db.prepare('SELECT 1 AS x FROM bot_admins WHERE number = ?').get(String(number));

/** Kumpulan status role untuk satu nomor. Dipanggil di backend setiap command dijalankan. */
function resolve(number) {
  const n = number ? String(number) : null;
  const owner = isOwner(n);
  const admin = owner ? false : isAdmin(n); // Owner tidak diperlakukan sebagai Admin biasa
  const prem = premiumService.status(n);
  const role = owner ? 'owner' : admin ? 'admin' : prem.active ? 'premium' : 'user';
  const bypass = (owner && config.premiumBypassRoles.has('owner')) || (admin && config.premiumBypassRoles.has('admin'));
  return {
    number: n,
    role,
    isOwner: owner,
    isAdmin: admin,
    isPremium: prem.active,
    premium: prem,
    hasPremiumAccess: prem.active || bypass,
  };
}

function log(number, action, actor, detail = null) {
  db.prepare('INSERT INTO role_log (number, action, actor, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(number, action, actor, detail, Date.now());
}

function requireValidTarget(target) {
  if (!target || !/^\d{8,15}$/.test(String(target))) throw new RoleError('Nomor target tidak valid. Gunakan format 628xxx atau tag/reply pengguna.');
}

function addAdmin(actor, target) {
  if (!isOwner(actor)) throw new RoleError('Hanya Owner yang dapat mengangkat Admin.');
  requireValidTarget(target);
  if (isOwner(target)) throw new RoleError('Owner tidak perlu diangkat menjadi Admin.');
  return transaction(() => {
    if (isAdmin(target)) throw new RoleError('Pengguna ini sudah Admin bot.');
    db.prepare('INSERT INTO bot_admins (number, added_by, added_at) VALUES (?, ?, ?)').run(target, actor, Date.now());
    log(target, 'admin_add', actor);
    return { number: target };
  });
}

function removeAdmin(actor, target) {
  if (!isOwner(actor)) throw new RoleError('Hanya Owner yang dapat mencabut Admin.');
  requireValidTarget(target);
  return transaction(() => {
    if (db.prepare('DELETE FROM bot_admins WHERE number = ?').run(target).changes === 0) throw new RoleError('Pengguna ini bukan Admin bot.');
    log(target, 'admin_remove', actor);
    return { number: target };
  });
}

function listAdmins() {
  return db.prepare('SELECT number, added_by, added_at FROM bot_admins ORDER BY added_at').all();
}

function requirePremiumManager(actor, target) {
  const owner = isOwner(actor);
  const admin = isAdmin(actor);
  if (!owner && !admin) throw new RoleError('Hanya Owner atau Admin bot yang dapat mengelola Premium.');
  if (!owner && !config.adminCanManagePremium) throw new RoleError('Pengelolaan Premium oleh Admin dinonaktifkan Owner.');
  requireValidTarget(target);
  if (!owner && String(actor) === String(target)) throw new RoleError('Tidak dapat mengubah Premium akun sendiri.');
  if (isOwner(target)) throw new RoleError('Owner tidak memerlukan Premium.');
}

function grantPremium(actor, target, days) {
  requirePremiumManager(actor, target);
  try {
    const res = premiumService.grant(target, days, actor, isOwner(actor) ? 'owner' : 'admin');
    log(target, 'premium_grant', actor, `${days} hari`);
    return res;
  } catch (err) {
    if (err instanceof premiumService.PremiumError) throw new RoleError(err.message);
    throw err;
  }
}

function revokePremium(actor, target) {
  requirePremiumManager(actor, target);
  if (!premiumService.revoke(target)) throw new RoleError('Pengguna ini tidak punya data Premium.');
  log(target, 'premium_revoke', actor);
  return { number: target };
}

function history(limit = 20) {
  return db.prepare('SELECT number, action, actor, detail, created_at FROM role_log ORDER BY id DESC LIMIT ?').all(limit);
}

module.exports = { RoleError, isOwner, isAdmin, resolve, addAdmin, removeAdmin, listAdmins, grantPremium, revokePremium, history, log };
