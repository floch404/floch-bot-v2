'use strict';

const config = require('../config');
const registry = require('../core/registry');
const executor = require('../core/executor');
const roleService = require('../services/role.service');
const groupService = require('../services/group.service');
const profileService = require('../services/profile.service');
const settings = require('../services/settings.service');
const stats = require('../services/stats.service');
const engine = require('../games/engine');
const { runGroupHooks } = require('./hooks/group-hooks');
const { toNumber, toJid, isGroupJid } = require('../utils/jid');
const { formatDuration } = require('../utils/format');

const MAX_MESSAGE_AGE_S = 60;
const SKIP_TYPES = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'pollUpdateMessage', 'messageContextInfo']);
const GROUP_CACHE_MS = 30_000;
const groupCache = new Map();

function unwrap(message) {
  let m = message;
  for (let i = 0; i < 4 && m; i++) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

/** Ringkas isi pesan: tipe, teks, contextInfo. Mengembalikan null untuk pesan yang tidak relevan. */
function describe(message) {
  const m = unwrap(message);
  if (!m) return null;
  const type = Object.keys(m).find((k) => !SKIP_TYPES.has(k) || false);
  if (!type) return null;
  const c = m[type];
  const text = typeof c === 'string' ? c : c?.text || c?.caption || '';
  return { type, text: String(text || ''), contextInfo: typeof c === 'object' ? c?.contextInfo : undefined, content: c };
}

async function resolveSender(sock, msg, session, isGroup) {
  const key = msg.key;
  if (key.fromMe) return session.ownNumber || null;
  const cands = isGroup ? [key.participantPn, key.participantAlt, key.participant] : [key.senderPn, key.remoteJidAlt, key.participantPn, key.remoteJid];
  for (const c of cands) {
    const n = toNumber(c);
    if (n) return n;
  }
  // Fallback: pemetaan LID -> nomor jika library menyediakannya (tidak semua versi punya).
  const lid = [key.participant, key.remoteJid].find((j) => typeof j === 'string' && j.endsWith('@lid'));
  if (lid && sock?.signalRepository?.lidMapping?.getPNForLID) {
    try {
      return toNumber(await sock.signalRepository.lidMapping.getPNForLID(lid));
    } catch {
      /* tidak dapat dipetakan */
    }
  }
  return null;
}

async function loadGroup(sock, session, jid, msg, sender) {
  const ck = `${session.sid}|${jid}`;
  let cached = groupCache.get(ck);
  if (!cached || Date.now() - cached.at > GROUP_CACHE_MS) {
    const meta = await sock.groupMetadata(jid);
    const participants = (meta.participants || []).map((p) => ({
      id: p.id,
      number: toNumber(p),
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin === true,
    }));
    cached = { at: Date.now(), meta, participants };
    groupCache.set(ck, cached);
    if (groupCache.size > 500) for (const [k, v] of groupCache) if (Date.now() - v.at > GROUP_CACHE_MS * 4) groupCache.delete(k);
  }
  const { meta, participants } = cached;
  const ownIds = new Set([sock.user?.id, sock.user?.lid].filter(Boolean).map((j) => String(j).split(':')[0].split('@')[0]));
  if (session.ownNumber) ownIds.add(session.ownNumber);
  const isBot = (p) => (p.number && ownIds.has(p.number)) || ownIds.has(String(p.id).split(':')[0].split('@')[0]);
  const rawSender = msg?.key?.participant;
  const isSender = (p) => (sender && p.number === sender) || (rawSender && p.id === rawSender);
  return {
    meta,
    subject: meta.subject || '',
    desc: meta.desc || '',
    size: participants.length,
    participants,
    adminNumbers: new Set(participants.filter((p) => p.isAdmin && p.number).map((p) => p.number)),
    botIsAdmin: participants.some((p) => p.isAdmin && isBot(p)),
    senderIsAdmin: participants.some((p) => p.isAdmin && isSender(p)),
  };
}

function invalidateGroup(session, jid) {
  groupCache.delete(`${session.sid}|${jid}`);
}

const xpCooldown = new Map();
function maybeXp(number, amount, cooldownMs) {
  const now = Date.now();
  if (now - (xpCooldown.get(number) || 0) < cooldownMs) return null;
  xpCooldown.set(number, now);
  if (xpCooldown.size > 10000) for (const [k, t] of xpCooldown) if (now - t > 600_000) xpCooldown.delete(k);
  return profileService.addXp(number, amount);
}

const cmdCooldown = new Map();
function onCooldown(key, ms = config.commandCooldownMs) {
  if (ms <= 0) return false;
  const now = Date.now();
  if (now - (cmdCooldown.get(key) || 0) < ms) return true;
  cmdCooldown.set(key, now);
  if (cmdCooldown.size > 5000) for (const [k, t] of cmdCooldown) if (now - t > 60_000) cmdCooldown.delete(k);
  return false;
}

/** Cocokkan prefix yang berlaku: global ".", prefix grup, dan prefix pribadi pengirim. Prefix terpanjang didahulukan. */
function matchPrefix(text, prefixes) {
  for (const p of [...new Set(prefixes.filter(Boolean))].sort((a, b) => b.length - a.length)) {
    if (text.startsWith(p)) return p;
  }
  return null;
}

/**
 * Proses satu pesan masuk untuk satu sesi bot. Tidak pernah melempar error ke pemanggil.
 * @returns {Promise<object>} ringkasan (dipakai pengujian)
 */
async function handleIncoming({ sock, msg, session }) {
  try {
    if (!msg?.message || !msg.key) return { skipped: 'empty' };
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return { skipped: 'broadcast' };
    if (msg.key.id && session.isOwnSent?.(msg.key.id)) return { skipped: 'own' };
    const ts = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp);
    if (ts && Date.now() / 1000 - ts > MAX_MESSAGE_AGE_S) return { skipped: 'old' };

    const info = describe(msg.message);
    if (!info) return { skipped: 'no-content' };

    const isGroup = isGroupJid(jid);
    const sender = await resolveSender(sock, msg, session, isGroup);
    const role = roleService.resolve(sender);

    if (sender) {
      stats.recordMessage(jid, sender);
      maybeXp(sender, 1, 60_000);
    }
    if (settings.get('auto_read')) {
      try {
        await sock.readMessages([msg.key]);
      } catch {
        /* tidak kritis */
      }
    }

    // ----- gerbang global -----
    if (sender && groupService.isUserBanned(sender) && !role.isOwner) return { skipped: 'banned-user' };
    if (groupService.isChatBanned(jid) && !role.isOwner) return { skipped: 'banned-chat' };
    if (settings.get('self_mode') && !role.isOwner && !msg.key.fromMe) return { skipped: 'self-mode' };
    if (settings.get('group_only') && !isGroup && !role.isOwner) return { skipped: 'group-mode' };

    const quotedCtx = info.contextInfo;
    const quoted = quotedCtx?.quotedMessage
      ? (() => {
          const qd = describe(quotedCtx.quotedMessage);
          return {
            key: { remoteJid: jid, id: quotedCtx.stanzaId, participant: quotedCtx.participant, fromMe: false },
            message: quotedCtx.quotedMessage,
            sender: toNumber(quotedCtx.participant),
            text: qd?.text || '',
            type: qd?.type || null,
          };
        })()
      : null;
    const mentioned = (quotedCtx?.mentionedJid || []).map(toNumber).filter(Boolean);

    const send = async (content, opts = {}) => {
      const res = await sock.sendMessage(jid, content, { quoted: msg, ...opts });
      if (res?.key?.id) session.markSent?.(res.key.id);
      return res;
    };

    const ctx = {
      sock,
      session,
      msg,
      jid,
      isGroup,
      sender,
      senderJid: isGroup ? msg.key.participant : jid,
      pushName: msg.pushName || null,
      type: info.type,
      text: info.text,
      args: [],
      argText: '',
      prefix: config.prefix,
      commandName: null,
      role,
      quoted,
      mentioned,
      send,
      reply: (t) => send({ text: String(t) }),
      react: (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
      group: () => loadGroup(sock, session, jid, msg, sender),
      invalidateGroup: () => invalidateGroup(session, jid),
      registry,
    };

    // ----- moderasi grup (anti-link/spam/badword/media, mute) -----
    if (isGroup) {
      try {
        if (await runGroupHooks(ctx)) return { handled: 'moderation' };
      } catch (err) {
        console.error('[hooks]', err.message);
      }
    }

    // ----- AFK -----
    if (sender) {
      const back = profileService.clearAfk(sender);
      const isAfkCmd = /^\S?afk\b/i.test(info.text.trim());
      if (back && !isAfkCmd) {
        await ctx.send({ text: `👋 @${sender} kembali dari AFK setelah ${formatDuration(Date.now() - back.since)}.`, mentions: [toJid(sender)] });
      }
    }
    for (const n of new Set([...mentioned, quoted?.sender].filter(Boolean))) {
      if (n === sender) continue;
      const afk = profileService.getAfk(n);
      if (afk) await ctx.send({ text: `😴 @${n} sedang AFK${afk.reason ? `: ${afk.reason}` : ''} (${formatDuration(Date.now() - afk.since)} lalu).`, mentions: [toJid(n)] });
    }

    // ----- jawaban game yang sedang berjalan -----
    const cfg = isGroup ? groupService.get(jid) : null;
    const userPrefix = sender ? profileService.getPrefix(sender) : null;
    const prefixes = [config.prefix, cfg?.prefix, userPrefix];
    const text = info.text.trim();
    const prefix = text ? matchPrefix(text, prefixes) : null;

    if (!prefix && text) {
      try {
        if (await engine.handleMessage(ctx)) return { handled: 'game' };
      } catch (err) {
        console.error('[game]', err.message);
      }
      if (cfg?.autorespon?.length) {
        const hit = cfg.autorespon.find((r) => r.trigger === text.toLowerCase());
        if (hit) {
          await ctx.reply(hit.reply);
          return { handled: 'autorespon' };
        }
      }
      return { skipped: 'not-command' };
    }
    if (!prefix) return { skipped: 'no-text' };

    // ----- command -----
    const [rawName, ...args] = text.slice(prefix.length).trim().split(/\s+/);
    if (!rawName) return { skipped: 'empty-command' };
    const def = registry.find(rawName);
    if (!def) {
      if (!isGroup && prefix === config.prefix) await ctx.reply(`Command .${rawName.slice(0, 30)} tidak dikenal. Ketik .menu untuk daftar command.`);
      return { skipped: 'unknown-command' };
    }
    if (onCooldown(`${session.sid}:${sender || jid}`)) return { skipped: 'cooldown' };

    if (isGroup && sender && groupService.isBanned(jid, sender) && !role.isOwner) return { skipped: 'banned-member' };
    if (isGroup && cfg.adminOnly && !role.isOwner) {
      const g = await ctx.group().catch(() => null);
      if (!g || !g.senderIsAdmin) return { skipped: 'admin-only-mode' };
    }

    ctx.commandName = def.key;
    ctx.prefix = prefix;
    ctx.args = args;
    ctx.argText = text.slice(prefix.length).trim().slice(rawName.length).trim();

    const result = await executor.execute(def, ctx);
    if (sender && result.ran) {
      const lv = maybeXp(sender, 5, 0);
      if (lv?.leveledUp) await ctx.reply(`🎉 Level up! Kamu sekarang level ${lv.level}.`).catch(() => {});
    }
    return { handled: 'command', command: def.key, ...result };
  } catch (err) {
    console.error('[message-handler] error:', err);
    return { error: err.message };
  }
}

module.exports = { handleIncoming, describe, resolveSender, matchPrefix, loadGroup, invalidateGroup };
