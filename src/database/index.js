'use strict';

const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const schema = require('./schema');

fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(config.waSessionsDir, { recursive: true, mode: 0o700 });

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(schema);
try {
  fs.chmodSync(config.dbFile, 0o600);
} catch {
  /* tidak kritis (mis. filesystem tanpa chmod) */
}

let depth = 0;

/** Jalankan fn di dalam transaksi. Boleh bersarang (memakai SAVEPOINT). Rollback otomatis jika fn melempar error. */
function transaction(fn) {
  const outer = depth === 0;
  const sp = `sp_${depth}`;
  db.exec(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  depth++;
  try {
    const result = fn();
    depth--;
    db.exec(outer ? 'COMMIT' : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    depth--;
    try {
      db.exec(outer ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    } catch {
      /* abaikan */
    }
    throw err;
  }
}

module.exports = { db, transaction };
