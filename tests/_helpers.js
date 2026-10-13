'use strict';

// Env HARUS diset sebelum modul aplikasi dimuat. Tiap file tes berjalan di proses terpisah.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'floch-test-'));
process.env.DATA_DIR = tmp;
process.env.OWNER_NUMBERS = '6281111111111';
process.env.COMMAND_COOLDOWN_MS = '0';
process.env.ADMIN_CAN_MANAGE_PREMIUM = 'false';
process.env.MENU_IMAGE_PATH = path.join(tmp, 'menu.jpg');
for (const k of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'GEMMA_API_KEY', 'LLM_API_KEY']) delete process.env[k];

const OWNER = '6281111111111';
const USER = '6282222222222';
const OTHER = '6283333333333';
const BOT = '6289999999999';

let n = 0;
function makeSock({ participants = [], subject = 'Grup Tes' } = {}) {
  const sent = [];
  const calls = [];
  const sock = {
    user: { id: `${BOT}:1@s.whatsapp.net` },
    sent,
    calls,
    groupAdmins: new Set(),
    participantsResult: null,
    async sendMessage(jid, content) { sent.push({ jid, content }); return { key: { id: `m${++n}` } }; },
    async readMessages() {},
    async groupMetadata(jid) {
      const admins = sock.groupAdmins;
      return {
        id: jid, subject, desc: 'deskripsi', creation: 1700000000,
        participants: [BOT, OWNER, USER, OTHER, ...participants].map((num) => ({ id: `${num}@s.whatsapp.net`, admin: admins.has(num) ? 'admin' : null })),
      };
    },
    async groupParticipantsUpdate(jid, ids, action) { calls.push(['participants', action, ids]); return sock.participantsResult || ids.map((j) => ({ jid: j, status: '200' })); },
    async groupSettingUpdate(jid, v) { calls.push(['setting', v]); },
    async groupUpdateSubject(jid, v) { calls.push(['subject', v]); },
    async groupInviteCode() { return 'ABC123'; },
    async fetchPrivacySettings() { return { last: 'all' }; },
  };
  sock.texts = () => sent.map((s) => s.content.text || s.content.caption || '').join('\n---\n');
  return sock;
}

const session = (over = {}) => ({ sid: `sid${++n}`, status: 'connected', ownNumber: BOT, connectedAt: Date.now() - 65_000, isOwnSent: () => false, markSent() {}, ...over });

/** Kirim satu pesan lewat pipeline penuh (handleIncoming). */
async function say(text, { from = USER, group = null, sock = makeSock(), quoted = null, mentions = [], sess = session() } = {}) {
  const { handleIncoming } = require('../src/whatsapp/message-handler');
  const jid = group || `${from}@s.whatsapp.net`;
  const ctxInfo = {};
  if (mentions.length) ctxInfo.mentionedJid = mentions.map((m) => `${m}@s.whatsapp.net`);
  if (quoted) { ctxInfo.quotedMessage = { conversation: quoted.text || 'x' }; ctxInfo.stanzaId = 'Q1'; ctxInfo.participant = `${quoted.sender}@s.whatsapp.net`; }
  const msg = {
    key: { remoteJid: jid, id: `id${++n}`, fromMe: false, ...(group ? { participant: `${from}@s.whatsapp.net` } : {}) },
    message: Object.keys(ctxInfo).length ? { extendedTextMessage: { text, contextInfo: ctxInfo } } : { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Tester',
  };
  const before = sock.sent.length;
  const result = await handleIncoming({ sock, msg, session: sess });
  const out = sock.sent.slice(before).map((x) => x.content.text || x.content.caption || '').join('\n---\n');
  return { result, sock, text: out };
}

module.exports = { say, makeSock, session, OWNER, USER, OTHER, BOT, tmp, GROUP: '120363000000000000@g.us' };
