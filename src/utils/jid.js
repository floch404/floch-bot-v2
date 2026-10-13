'use strict';

/**
 * Ambil nomor telepon (digit) dari JID atau objek peserta. Mengembalikan null jika tidak dapat ditentukan
 * (mis. hanya ada LID, yang BUKAN nomor telepon).
 */
function toNumber(x) {
  if (!x) return null;
  if (typeof x === 'object') {
    for (const k of ['phoneNumber', 'pn', 'jid', 'id']) {
      const n = toNumber(x[k]);
      if (n) return n;
    }
    return null;
  }
  const s = String(x);
  if (s.includes('@lid')) return null;
  const m = s.match(/^(\d{6,20})(?::\d+)?(?:@(?:s\.whatsapp\.net|c\.us))?$/);
  return m ? m[1] : null;
}

const toJid = (number) => `${number}@s.whatsapp.net`;
const isGroupJid = (jid) => typeof jid === 'string' && jid.endsWith('@g.us');
const mention = (number) => `@${number}`;

module.exports = { toNumber, toJid, isGroupJid, mention };
