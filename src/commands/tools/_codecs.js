'use strict';

/** Codec teks murni (tanpa dependensi, tanpa shell, tanpa jaringan). Setiap codec: { encode, decode }. */

const { UserError } = require('../../core/executor');

const bad = (what) => new UserError(`Input bukan ${what} yang valid.`);

// ---------- base64 / base32 ----------
const b64 = {
  encode: (s) => Buffer.from(s, 'utf8').toString('base64'),
  decode: (s) => {
    const t = s.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(t) || !t) throw bad('Base64');
    return Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  },
};

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = {
  encode(s) {
    const bytes = Buffer.from(s, 'utf8');
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += B32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
      value &= (1 << bits) - 1;
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    while (out.length % 8) out += '=';
    return out;
  },
  decode(s) {
    const t = s.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
    if (!t || /[^A-Z2-7]/.test(t)) throw bad('Base32');
    let bits = 0;
    let value = 0;
    const out = [];
    for (const ch of t) {
      value = (value << 5) | B32.indexOf(ch);
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
      value &= (1 << bits) - 1;
    }
    return Buffer.from(out).toString('utf8');
  },
};

// ---------- ascii85 (Adobe/btoa, tanpa delimiter <~ ~>) ----------
const a85 = {
  encode(s) {
    const b = Buffer.from(s, 'utf8');
    let out = '';
    for (let i = 0; i < b.length; i += 4) {
      const n = Math.min(4, b.length - i);
      let v = 0;
      for (let j = 0; j < 4; j++) v = v * 256 + (j < n ? b[i + j] : 0);
      if (v === 0 && n === 4) {
        out += 'z';
        continue;
      }
      const chars = [];
      for (let j = 0; j < 5; j++) {
        chars.unshift(String.fromCharCode((v % 85) + 33));
        v = Math.floor(v / 85);
      }
      out += chars.join('').slice(0, n + 1);
    }
    return out;
  },
  decode(s) {
    let t = s.replace(/\s+/g, '');
    if (t.startsWith('<~')) t = t.slice(2);
    if (t.endsWith('~>')) t = t.slice(0, -2);
    if (!t || /[^!-uz]/.test(t)) throw bad('ASCII85');
    const bytes = [];
    let group = [];
    const flush = (n) => {
      const pad = 5 - group.length;
      const g = [...group, ...Array(pad).fill(84)];
      let v = 0;
      for (const c of g) v = v * 85 + c;
      if (v > 0xffffffff) throw bad('ASCII85');
      const four = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
      bytes.push(...four.slice(0, n ?? 4 - pad));
    };
    for (const ch of t) {
      if (ch === 'z') {
        if (group.length) throw bad('ASCII85');
        bytes.push(0, 0, 0, 0);
        continue;
      }
      group.push(ch.charCodeAt(0) - 33);
      if (group.length === 5) {
        flush(4);
        group = [];
      }
    }
    if (group.length === 1) throw bad('ASCII85');
    if (group.length) flush();
    return Buffer.from(bytes).toString('utf8');
  },
};

// ---------- hex / biner / oktal ----------
const hex = {
  encode: (s) => Buffer.from(s, 'utf8').toString('hex'),
  decode: (s) => {
    const t = s.replace(/0x/gi, '').replace(/[\s:,-]+/g, '');
    if (!t || t.length % 2 || /[^0-9a-f]/i.test(t)) throw bad('Hex');
    return Buffer.from(t, 'hex').toString('utf8');
  },
};
const bin = {
  encode: (s) => [...Buffer.from(s, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' '),
  decode: (s) => {
    const t = s.replace(/\s+/g, '');
    if (!t || t.length % 8 || /[^01]/.test(t)) throw bad('biner (kelipatan 8 bit)');
    return Buffer.from(t.match(/.{8}/g).map((b) => parseInt(b, 2))).toString('utf8');
  },
};
const oct = {
  encode: (s) => [...Buffer.from(s, 'utf8')].map((b) => b.toString(8).padStart(3, '0')).join(' '),
  decode: (s) => {
    const parts = s.trim().split(/\s+/);
    if (!parts.length || parts.some((p) => !/^[0-7]{1,3}$/.test(p) || parseInt(p, 8) > 255)) throw bad('oktal (per byte, mis. 150 145)');
    return Buffer.from(parts.map((p) => parseInt(p, 8))).toString('utf8');
  },
};

// ---------- morse ----------
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '-': '-....-', ':': '---...', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const morse = {
  encode: (s) => s.toUpperCase().split(/\s+/).filter(Boolean).map((w) => [...w].map((c) => MORSE[c] || '?').join(' ')).join(' / '),
  decode: (s) => {
    if (/[^.\-/\s]/.test(s) || !s.trim()) throw bad('kode Morse (titik, garis, spasi, dan /)');
    return s.trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).map((c) => MORSE_REV[c] || '?').join('')).join(' ');
  },
};

// ---------- cipher huruf ----------
const shift = (s, fn) => s.replace(/[a-z]/gi, (c) => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(fn(c.charCodeAt(0) - base) + base);
});
const rot13Fn = (s) => shift(s, (n) => (n + 13) % 26);
const rot13 = { encode: rot13Fn, decode: rot13Fn };
const atbashFn = (s) => shift(s, (n) => 25 - n);
const atbash = { encode: atbashFn, decode: atbashFn };

// ---------- url / html ----------
const url = {
  encode: (s) => encodeURIComponent(s),
  decode: (s) => {
    try {
      return decodeURIComponent(s.trim());
    } catch {
      throw bad('URL-encoded');
    }
  },
};
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const html = {
  encode: (s) => s.replace(/[&<>"']/g, (c) => ENT[c]),
  decode: (s) =>
    s.replace(/&(amp|lt|gt|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === 'amp') return '&';
      if (k === 'lt') return '<';
      if (k === 'gt') return '>';
      if (k === 'quot') return '"';
      if (k === 'apos' || k === '#39') return "'";
      const cp = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
    }),
};

module.exports = { b64, b32, a85, hex, bin, oct, morse, rot13, atbash, url, html };
