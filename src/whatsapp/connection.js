'use strict';

/**
 * Pembungkus tipis untuk Baileys (library WhatsApp TIDAK RESMI, bukan WhatsApp Business API).
 * Dimuat lewat import() dinamis agar bekerja untuk Baileys 6.x (CommonJS) maupun 7.x (ESM).
 */

const fs = require('node:fs');
const config = require('../config');

let baileysPromise = null;

function loadBaileys() {
  if (!baileysPromise) {
    baileysPromise = import('@whiskeysockets/baileys').then((m) => {
      const pick = (name) => m[name] ?? m.default?.[name];
      const makeWASocket =
        typeof m.makeWASocket === 'function' ? m.makeWASocket : typeof m.default === 'function' ? m.default : m.default?.default;
      if (typeof makeWASocket !== 'function') throw new Error('Baileys: fungsi makeWASocket tidak ditemukan (versi tidak kompatibel?).');
      return {
        makeWASocket,
        useMultiFileAuthState: pick('useMultiFileAuthState'),
        makeCacheableSignalKeyStore: pick('makeCacheableSignalKeyStore'),
        fetchLatestBaileysVersion: pick('fetchLatestBaileysVersion'),
        DisconnectReason: pick('DisconnectReason') || { loggedOut: 401, restartRequired: 515, connectionReplaced: 440, badSession: 500 },
        Browsers: pick('Browsers'),
      };
    });
  }
  return baileysPromise;
}

function makeLogger(level) {
  const order = ['silent', 'error', 'warn', 'info'];
  const lvl = order.indexOf(level) < 0 ? 0 : order.indexOf(level);
  const noop = () => {};
  const out = (name, rank) => (lvl >= rank ? (...a) => console[name === 'error' ? 'error' : 'log']('[baileys]', ...a) : noop);
  const logger = {
    level: order[lvl],
    child: () => logger,
    trace: noop,
    debug: noop,
    info: out('info', 3),
    warn: out('warn', 2),
    error: out('error', 1),
    fatal: out('error', 1),
  };
  return logger;
}

let cachedVersion;

/**
 * Buka satu socket WhatsApp untuk direktori autentikasi tertentu.
 * Kredensial disimpan di authDir (di luar folder public, tidak pernah dikirim ke frontend).
 */
async function openSocket({ authDir, onUpdate, onMessages, onGroupParticipants, onCalls }) {
  const b = await loadBaileys();
  fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
  const logger = makeLogger(config.waLogLevel);
  const { state, saveCreds } = await b.useMultiFileAuthState(authDir);

  if (cachedVersion === undefined) {
    try {
      cachedVersion = (await b.fetchLatestBaileysVersion()).version;
    } catch {
      cachedVersion = null; // pakai versi bawaan library
    }
  }

  const opts = {
    auth: {
      creds: state.creds,
      keys: b.makeCacheableSignalKeyStore ? b.makeCacheableSignalKeyStore(state.keys, logger) : state.keys,
    },
    logger,
    browser: b.Browsers?.ubuntu ? b.Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04.4'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  };
  if (cachedVersion) opts.version = cachedVersion;

  const sock = b.makeWASocket(opts);
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => onUpdate?.(u));
  sock.ev.on('messages.upsert', (u) => onMessages?.(u));
  sock.ev.on('group-participants.update', (u) => onGroupParticipants?.(u));
  sock.ev.on('call', (c) => onCalls?.(c));
  return { sock, DisconnectReason: b.DisconnectReason };
}

module.exports = { openSocket, loadBaileys };
