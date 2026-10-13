'use strict';

const { normalizePhone } = require('../utils/format');

/** Target tindakan: pengguna yang di-tag, pengirim pesan yang di-reply, atau nomor yang diketik. Urutan tetap, tanpa duplikat. */
function targetsOf(ctx, { fromArgs = true } = {}) {
  const out = [];
  const add = (n) => n && !out.includes(n) && out.push(n);
  ctx.mentioned.forEach(add);
  add(ctx.quoted?.sender);
  if (fromArgs) {
    for (const a of ctx.args) {
      const cleaned = a.replace(/^@/, '');
      if (/^\+?\d[\d\s-]{6,}$/.test(cleaned) || /^\d{8,15}$/.test(cleaned)) add(normalizePhone(cleaned));
    }
  }
  return out;
}

const firstTarget = (ctx, opts) => targetsOf(ctx, opts)[0] || null;

module.exports = { targetsOf, firstTarget };
