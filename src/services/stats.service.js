'use strict';

const { db } = require('../database');

function recordCommand(name, number, ok = true) {
  db.prepare(
    `INSERT INTO command_stats (name, count, errors, last_used) VALUES (?, 1, ?, ?)
     ON CONFLICT(name) DO UPDATE SET count = count + 1, errors = errors + excluded.errors, last_used = excluded.last_used`
  ).run(name, ok ? 0 : 1, Date.now());
  if (number) {
    db.prepare(
      `INSERT INTO user_command_stats (number, name, count) VALUES (?, ?, 1)
       ON CONFLICT(number, name) DO UPDATE SET count = count + 1`
    ).run(number, name);
  }
}

function recordMessage(chat, number) {
  db.prepare(
    `INSERT INTO msg_stats (chat, number, count, last_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(chat, number) DO UPDATE SET count = count + 1, last_at = excluded.last_at`
  ).run(chat, number, Date.now());
}

const topCommands = (limit = 10) => db.prepare('SELECT name, count FROM command_stats ORDER BY count DESC, name LIMIT ?').all(limit);
const topUsers = (limit = 10) =>
  db.prepare('SELECT number, SUM(count) AS total FROM user_command_stats GROUP BY number ORDER BY total DESC LIMIT ?').all(limit);
const totals = () => {
  const c = db.prepare('SELECT COALESCE(SUM(count),0) AS commands, COALESCE(SUM(errors),0) AS errors FROM command_stats').get();
  const m = db.prepare('SELECT COALESCE(SUM(count),0) AS messages FROM msg_stats').get();
  return { commands: c.commands, errors: c.errors, messages: m.messages };
};
const topActive = (chat, limit = 10) => db.prepare('SELECT number, count FROM msg_stats WHERE chat = ? ORDER BY count DESC LIMIT ?').all(chat, limit);
const chatMessageCounts = (chat) => new Map(db.prepare('SELECT number, count FROM msg_stats WHERE chat = ?').all(chat).map((r) => [r.number, r.count]));
const messageCount = (chat, number) => db.prepare('SELECT count FROM msg_stats WHERE chat = ? AND number = ?').get(chat, number)?.count || 0;
const chatTotal = (chat) => db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM msg_stats WHERE chat = ?').get(chat).n;
const userCommandCount = (number) => db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM user_command_stats WHERE number = ?').get(number).n;

module.exports = { recordCommand, recordMessage, topCommands, topUsers, totals, topActive, chatMessageCounts, messageCount, chatTotal, userCommandCount };
