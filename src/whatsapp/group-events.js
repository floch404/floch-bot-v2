'use strict';

const groupService = require('../services/group.service');
const settings = require('../services/settings.service');
const { toNumber, toJid } = require('../utils/jid');
const { invalidateGroup } = require('./message-handler');

function renderTemplate(template, { number, subject }) {
  return String(template).replaceAll('@user', `@${number}`).replaceAll('@group', subject || 'grup');
}

/** Event anggota grup (add/remove/promote/demote): welcome, goodbye, dan penegakan ban anggota. */
async function handleParticipants({ sock, session, update }) {
  try {
    const jid = update?.id;
    if (!jid || !jid.endsWith('@g.us')) return;
    invalidateGroup(session, jid);
    const cfg = groupService.get(jid);
    const numbers = (update.participants || []).map(toNumber).filter(Boolean);
    if (!numbers.length) return;
    let subject = '';
    try {
      subject = (await sock.groupMetadata(jid)).subject || '';
    } catch {
      /* subject opsional */
    }

    for (const number of numbers) {
      if (update.action === 'add') {
        if (groupService.isBanned(jid, number)) {
          try {
            await sock.groupParticipantsUpdate(jid, [toJid(number)], 'remove');
            await sock.sendMessage(jid, { text: `🚫 @${number} masuk ke daftar ban grup dan dikeluarkan.`, mentions: [toJid(number)] });
          } catch {
            await sock.sendMessage(jid, { text: `@${number} ada di daftar ban grup, tetapi bot gagal mengeluarkan (pastikan bot admin).`, mentions: [toJid(number)] }).catch(() => {});
          }
          continue;
        }
        if (cfg.welcome) {
          await sock.sendMessage(jid, { text: renderTemplate(cfg.welcomeText, { number, subject }), mentions: [toJid(number)] }).catch(() => {});
        }
      } else if (update.action === 'remove' && cfg.goodbye) {
        await sock.sendMessage(jid, { text: renderTemplate(cfg.goodbyeText, { number, subject }), mentions: [toJid(number)] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[group-events]', err.message);
  }
}

/** Panggilan masuk: ditolak otomatis jika diaktifkan Owner (.RejectCall). */
async function handleCalls({ sock, calls }) {
  try {
    if (!settings.get('reject_call')) return;
    for (const call of calls || []) {
      if (call.status === 'offer' && call.id && call.from) await sock.rejectCall(call.id, call.from).catch(() => {});
    }
  } catch (err) {
    console.error('[calls]', err.message);
  }
}

module.exports = { handleParticipants, handleCalls, renderTemplate };
