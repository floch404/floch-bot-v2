'use strict';

const { db } = require('../database');

const DEFAULTS = Object.freeze({
  welcome: false,
  welcomeText: 'Selamat datang @user di *@group*! 👋',
  goodbye: false,
  goodbyeText: 'Sampai jumpa @user.',
  antilink: false,
  antispam: false,
  antimedia: false,
  badword: false,
  badwords: [],
  adminOnly: false,
  prefix: null,
  timezone: 'Asia/Jakarta',
  lang: 'id',
  warnLimit: 3,
  autorespon: [],
});

const cache = new Map();

function get(jid) {
  if (cache.has(jid)) return cache.get(jid);
  const row = db.prepare('SELECT settings FROM groups WHERE jid = ?').get(jid);
  let parsed = {};
  try {
    parsed = row ? JSON.parse(row.settings) : {};
  } catch {
    parsed = {};
  }
  const merged = { ...DEFAULTS, ...parsed };
  cache.set(jid, merged);
  return merged;
}

function update(jid, patch) {
  const next = { ...get(jid), ...patch };
  const toStore = {};
  for (const k of Object.keys(DEFAULTS)) if (JSON.stringify(next[k]) !== JSON.stringify(DEFAULTS[k])) toStore[k] = next[k];
  db.prepare('INSERT INTO groups (jid, settings) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET settings = excluded.settings').run(jid, JSON.stringify(toStore));
  cache.set(jid, next);
  return next;
}

function resetCache() {
  cache.clear();
}

// ----- warning -----
function addWarning(jid, number) {
  db.prepare(
    `INSERT INTO group_warnings (group_jid, number, count, updated_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(group_jid, number) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
  ).run(jid, number, Date.now());
  return db.prepare('SELECT count FROM group_warnings WHERE group_jid = ? AND number = ?').get(jid, number).count;
}
const getWarnings = (jid, number) => db.prepare('SELECT count FROM group_warnings WHERE group_jid = ? AND number = ?').get(jid, number)?.count || 0;
const resetWarnings = (jid, number) => db.prepare('DELETE FROM group_warnings WHERE group_jid = ? AND number = ?').run(jid, number).changes > 0;
const listWarnings = (jid) => db.prepare('SELECT number, count FROM group_warnings WHERE group_jid = ? AND count > 0 ORDER BY count DESC').all(jid);

// ----- mute & ban anggota -----
const addMute = (jid, number, by) => db.prepare('INSERT OR REPLACE INTO group_mutes (group_jid, number, by, at) VALUES (?, ?, ?, ?)').run(jid, number, by, Date.now());
const removeMute = (jid, number) => db.prepare('DELETE FROM group_mutes WHERE group_jid = ? AND number = ?').run(jid, number).changes > 0;
const isMuted = (jid, number) => !!db.prepare('SELECT 1 AS x FROM group_mutes WHERE group_jid = ? AND number = ?').get(jid, number);
const listMutes = (jid) => db.prepare('SELECT number, at FROM group_mutes WHERE group_jid = ? ORDER BY at').all(jid);

const addBan = (jid, number, by) => db.prepare('INSERT OR REPLACE INTO group_bans (group_jid, number, by, at) VALUES (?, ?, ?, ?)').run(jid, number, by, Date.now());
const removeBan = (jid, number) => db.prepare('DELETE FROM group_bans WHERE group_jid = ? AND number = ?').run(jid, number).changes > 0;
const isBanned = (jid, number) => !!db.prepare('SELECT 1 AS x FROM group_bans WHERE group_jid = ? AND number = ?').get(jid, number);
const listBans = (jid) => db.prepare('SELECT number, at FROM group_bans WHERE group_jid = ? ORDER BY at').all(jid);

// ----- ban chat / ban pengguna global (Owner) -----
const banChat = (jid, by) => db.prepare('INSERT OR REPLACE INTO banned_chats (jid, by, at) VALUES (?, ?, ?)').run(jid, by, Date.now());
const unbanChat = (jid) => db.prepare('DELETE FROM banned_chats WHERE jid = ?').run(jid).changes > 0;
const isChatBanned = (jid) => !!db.prepare('SELECT 1 AS x FROM banned_chats WHERE jid = ?').get(jid);
const listBannedChats = () => db.prepare('SELECT jid, at FROM banned_chats ORDER BY at').all();

const banUser = (number, reason, by) => db.prepare('INSERT OR REPLACE INTO banned_users (number, reason, by, at) VALUES (?, ?, ?, ?)').run(number, reason || null, by, Date.now());
const unbanUser = (number) => db.prepare('DELETE FROM banned_users WHERE number = ?').run(number).changes > 0;
const isUserBanned = (number) => !!number && !!db.prepare('SELECT 1 AS x FROM banned_users WHERE number = ?').get(number);
const listBannedUsers = () => db.prepare('SELECT number, reason, at FROM banned_users ORDER BY at').all();

module.exports = {
  DEFAULTS, get, update, resetCache,
  addWarning, getWarnings, resetWarnings, listWarnings,
  addMute, removeMute, isMuted, listMutes,
  addBan, removeBan, isBanned, listBans,
  banChat, unbanChat, isChatBanned, listBannedChats,
  banUser, unbanUser, isUserBanned, listBannedUsers,
};
