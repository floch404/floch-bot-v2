'use strict';

/**
 * Mesin sesi game. Satu chat (grup atau pribadi) hanya boleh punya SATU game berjalan, sehingga game baru
 * tidak menimpa game yang sedang berlangsung. Sesi disimpan di memori (hilang saat restart); SKOR disimpan
 * permanen di database (services/game.service.js).
 */

const sessions = new Map(); // `${sid}|${jid}` -> sesi

const keyOf = (ctx) => `${ctx.session.sid}|${ctx.jid}`;
const get = (ctx) => sessions.get(keyOf(ctx)) || null;

/**
 * @param def { game, timeoutMs, data, onMessage(ctx, s) -> Promise<boolean consumed>, onExpire(s) -> string|null }
 * @returns sesi baru, atau null jika sudah ada game berjalan di chat ini
 */
function start(ctx, def) {
  const key = keyOf(ctx);
  if (sessions.has(key)) return null;
  const s = { ...def, key, sock: ctx.sock, jid: ctx.jid, startedAt: Date.now(), starter: ctx.sender, isGroup: ctx.isGroup };
  s.timer = setTimeout(async () => {
    if (sessions.get(key) !== s) return;
    sessions.delete(key);
    try {
      const text = def.onExpire?.(s);
      if (text) await ctx.sock.sendMessage(ctx.jid, { text });
    } catch {
      /* tidak kritis */
    }
  }, def.timeoutMs ?? 60_000);
  s.timer.unref?.();
  sessions.set(key, s);
  return s;
}

function end(ctx) {
  const key = keyOf(ctx);
  const s = sessions.get(key);
  if (s) clearTimeout(s.timer);
  sessions.delete(key);
  return s || null;
}

async function handleMessage(ctx) {
  const s = get(ctx);
  if (!s || typeof s.onMessage !== 'function') return false;
  return !!(await s.onMessage(ctx, s));
}

const activeCount = () => sessions.size;
function clearAll() {
  for (const s of sessions.values()) clearTimeout(s.timer);
  sessions.clear();
}

/** Teks standar bila sudah ada game berjalan. */
const BUSY_MESSAGE = 'Masih ada game yang sedang berjalan di chat ini. Selesaikan dulu atau tunggu waktunya habis.';

module.exports = { start, end, get, handleMessage, activeCount, clearAll, BUSY_MESSAGE };
