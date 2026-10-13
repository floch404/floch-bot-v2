'use strict';

module.exports = `
-- ===== Website (hanya pairing) =====
CREATE TABLE IF NOT EXISTS visitors (
  id         TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wa_sessions (
  id           TEXT PRIMARY KEY REFERENCES visitors(id) ON DELETE CASCADE,
  phone        TEXT,
  own_number   TEXT,
  status       TEXT NOT NULL DEFAULT 'disconnected',
  last_error   TEXT,
  connected_at INTEGER,
  updated_at   INTEGER NOT NULL
);

-- ===== Role bot (berbasis NOMOR WhatsApp) =====
CREATE TABLE IF NOT EXISTS bot_admins (
  number   TEXT PRIMARY KEY,
  added_by TEXT,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS premium (
  number     TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  granted_by TEXT,
  source     TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS role_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  number     TEXT NOT NULL,
  action     TEXT NOT NULL,
  actor      TEXT,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_role_log_time ON role_log(created_at DESC);

CREATE TABLE IF NOT EXISTS redeem_codes (
  code       TEXT PRIMARY KEY,
  days       INTEGER NOT NULL,
  max_uses   INTEGER NOT NULL DEFAULT 1,
  uses       INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS redemptions (
  code   TEXT NOT NULL REFERENCES redeem_codes(code) ON DELETE CASCADE,
  number TEXT NOT NULL,
  at     INTEGER NOT NULL,
  PRIMARY KEY (code, number)
);

-- ===== Pengguna =====
CREATE TABLE IF NOT EXISTS profiles (
  number      TEXT PRIMARY KEY,
  name        TEXT,
  age         INTEGER,
  gender      TEXT,
  bio         TEXT,
  prefix      TEXT,
  afk_reason  TEXT,
  afk_since   INTEGER,
  xp          INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage (
  number TEXT NOT NULL,
  day    TEXT NOT NULL,
  kind   TEXT NOT NULL,
  used   INTEGER NOT NULL DEFAULT 0,
  bonus  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (number, day, kind)
);

CREATE TABLE IF NOT EXISTS daily_claims (
  number     TEXT PRIMARY KEY,
  last_day   TEXT NOT NULL,
  streak     INTEGER NOT NULL DEFAULT 1,
  total      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banned_users (
  number TEXT PRIMARY KEY,
  reason TEXT,
  by     TEXT,
  at     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS banned_chats (
  jid TEXT PRIMARY KEY,
  by  TEXT,
  at  INTEGER NOT NULL
);

-- ===== Statistik =====
CREATE TABLE IF NOT EXISTS command_stats (
  name      TEXT PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  errors    INTEGER NOT NULL DEFAULT 0,
  last_used INTEGER
);
CREATE TABLE IF NOT EXISTS user_command_stats (
  number TEXT NOT NULL,
  name   TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (number, name)
);
CREATE TABLE IF NOT EXISTS msg_stats (
  chat    TEXT NOT NULL,
  number  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (chat, number)
);

-- ===== Konfigurasi =====
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  jid      TEXT PRIMARY KEY,
  settings TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS group_warnings (
  group_jid  TEXT NOT NULL,
  number     TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (group_jid, number)
);
CREATE TABLE IF NOT EXISTS group_bans (
  group_jid TEXT NOT NULL,
  number    TEXT NOT NULL,
  by        TEXT,
  at        INTEGER NOT NULL,
  PRIMARY KEY (group_jid, number)
);
CREATE TABLE IF NOT EXISTS group_mutes (
  group_jid TEXT NOT NULL,
  number    TEXT NOT NULL,
  by        TEXT,
  at        INTEGER NOT NULL,
  PRIMARY KEY (group_jid, number)
);

-- ===== Game =====
CREATE TABLE IF NOT EXISTS game_scores (
  number TEXT NOT NULL,
  scope  TEXT NOT NULL,
  game   TEXT NOT NULL,
  plays  INTEGER NOT NULL DEFAULT 0,
  wins   INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (number, scope, game)
);

-- ===== AI =====
CREATE TABLE IF NOT EXISTS ai_context (
  key        TEXT PRIMARY KEY,
  messages   TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
