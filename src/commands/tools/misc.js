'use strict';

const { UserError } = require('../../core/executor');

const text = (ctx) => ctx.argText || ctx.quoted?.text || '';

// ---------- kalkulator aman (parser rekursif, TANPA eval) ----------
const FUNCS = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil };
const CONSTS = { pi: Math.PI, e: Math.E };

function calculate(src) {
  if (src.length > 200) throw new UserError('Ekspresi terlalu panjang (maks 200 karakter).');
  const s = src.toLowerCase().replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!s) throw new UserError('Ekspresi kosong.');
  let i = 0;
  let depth = 0;
  const fail = () => new UserError('Ekspresi tidak valid.');
  const peek = () => s[i];

  function number() {
    const m = s.slice(i).match(/^\d+(\.\d+)?(e[+-]?\d+)?/);
    if (!m) throw fail();
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function primary() {
    if (++depth > 40) throw new UserError('Ekspresi terlalu bersarang.');
    let v;
    if (peek() === '(') {
      i++;
      v = expr();
      if (peek() !== ')') throw fail();
      i++;
    } else if (/[a-z]/.test(peek() || '')) {
      const m = s.slice(i).match(/^[a-z]+/)[0];
      i += m.length;
      if (m in CONSTS) v = CONSTS[m];
      else if (m in FUNCS) {
        if (peek() !== '(') throw fail();
        i++;
        const arg = expr();
        if (peek() !== ')') throw fail();
        i++;
        v = FUNCS[m](arg);
      } else throw fail();
    } else v = number();
    depth--;
    return v;
  }
  function unary() {
    if (peek() === '-') { i++; return -unary(); }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (s.startsWith('**', i) || peek() === '^') {
      i += peek() === '^' ? 1 : 2;
      return base ** unary(); // asosiatif kanan
    }
    return base;
  }
  function term() {
    let v = unary();
    while (peek() === '*' && s[i + 1] !== '*' || peek() === '/' || peek() === '%') {
      const op = s[i++];
      const r = unary();
      if (op === '*') v *= r;
      else if (op === '/') v /= r;
      else v %= r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') v = s[i++] === '+' ? v + term() : v - term();
    return v;
  }
  const result = expr();
  if (i !== s.length) throw fail();
  if (!Number.isFinite(result)) throw new UserError('Hasil tidak terdefinisi (mis. pembagian dengan nol).');
  return result;
}

// ---------- warna ----------
function parseColor(input) {
  const t = input.trim().toLowerCase();
  let m = t.match(/^#?([0-9a-f]{6})$/) || t.match(/^#?([0-9a-f]{3})$/);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = t.match(/^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map(Number);
    if (rgb.every((n) => n <= 255)) return rgb;
  }
  return null;
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

// ---------- JWT (hanya decode lokal; tanda tangan TIDAK diverifikasi) ----------
function decodeJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((p, i) => i < 2 && !/^[A-Za-z0-9_-]+$/.test(p))) throw new UserError('Format JWT tidak valid (harus 3 bagian dipisah titik).');
  const dec = (p) => {
    try {
      return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch {
      throw new UserError('Header/payload JWT bukan JSON yang valid.');
    }
  };
  return { header: dec(parts[0]), payload: dec(parts[1]) };
}

// ---------- lorem ----------
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

module.exports = [
  {
    name: 'calculator',
    display: 'Calculator',
    aliases: ['calc'],
    category: 'TOOLS',
    description: 'Kalkulator aman: + - * / % ^ ( ) sqrt abs sin cos tan log ln round floor ceil pi e',
    usage: '.calculator <ekspresi>',
    minArgs: 1,
    status: 'tested',
    examples: [
      { args: '2+3*4', expect: /= 14$/ },
      { args: '(1+2)^3', expect: /= 27$/ },
      { args: 'sqrt(144)+abs(-3)', expect: /= 15$/ },
      { args: '1/0', expect: /tidak terdefinisi/ },
      { args: 'process.exit()', expect: /tidak valid/ },
    ],
    async run(ctx) {
      const r = calculate(ctx.argText);
      await ctx.reply(`${ctx.argText} = ${Number.isInteger(r) ? r : parseFloat(r.toPrecision(12))}`);
    },
  },
  {
    name: 'color',
    display: 'Color',
    category: 'TOOLS',
    description: 'Konversi warna HEX/RGB ke HEX, RGB, HSL',
    usage: '.color #ff8800 | .color 255 136 0',
    minArgs: 1,
    status: 'tested',
    examples: [{ args: '#ff8800', expect: /HEX: #ff8800\nRGB: 255, 136, 0\nHSL: 32°, 100%, 50%/ }, { args: 'bukanwarna', expect: /tidak dikenali/ }],
    async run(ctx) {
      const rgb = parseColor(ctx.argText);
      if (!rgb) throw new UserError('Format warna tidak dikenali. Contoh: #ff8800 atau 255 136 0');
      const [h, s, l] = rgbToHsl(rgb);
      const hex = `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      await ctx.reply(`HEX: ${hex}\nRGB: ${rgb.join(', ')}\nHSL: ${h}°, ${s}%, ${l}%`);
    },
  },
  {
    name: 'jwt',
    display: 'JWT',
    category: 'TOOLS',
    description: 'Decode header & payload JWT secara lokal (tanda tangan tidak diverifikasi)',
    usage: '.jwt <token>',
    minArgs: 1,
    status: 'tested',
    examples: [
      { args: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiVGVzdCJ9.sig', expect: /"alg": "HS256"[\s\S]*"name": "Test"[\s\S]*tidak diverifikasi/ },
      { args: 'abc', expect: /tidak valid/ },
    ],
    async run(ctx) {
      const { header, payload } = decodeJwt(ctx.args[0]);
      const lines = ['*Header*', JSON.stringify(header, null, 2), '*Payload*', JSON.stringify(payload, null, 2)];
      if (typeof payload.exp === 'number') lines.push(payload.exp * 1000 < Date.now() ? '⚠️ Token sudah kedaluwarsa (exp).' : 'Token belum kedaluwarsa (exp).');
      lines.push('Catatan: decode dilakukan lokal di bot; tanda tangan tidak diverifikasi dan token tidak disimpan/dikirim ke layanan lain. Jangan membagikan token sensitif di grup.');
      await ctx.reply(lines.join('\n'));
    },
  },
  {
    name: 'lorem',
    display: 'Lorem',
    category: 'TOOLS',
    description: 'Buat teks lorem ipsum (default 30 kata, maks 200)',
    usage: '.lorem [jumlah kata]',
    status: 'tested',
    examples: [{ args: '5', expect: /^Lorem ipsum dolor sit amet\.$/ }, { args: '500', expect: /maks 200/ }],
    async run(ctx) {
      const n = ctx.args[0] ? parseInt(ctx.args[0], 10) : 30;
      if (!Number.isInteger(n) || n < 1 || n > 200) throw new UserError('Jumlah kata harus 1-200 (maks 200).');
      const words = Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]);
      const out = words.join(' ');
      await ctx.reply(`${out[0].toUpperCase()}${out.slice(1)}.`);
    },
  },
  {
    name: 'upper',
    display: 'Upper',
    category: 'TOOLS',
    description: 'Ubah teks menjadi huruf besar',
    usage: '.upper <teks> (atau reply pesan)',
    status: 'tested',
    examples: [{ args: 'halo Dunia', expect: /^HALO DUNIA$/ }],
    async run(ctx) {
      const t = text(ctx);
      if (!t) throw new UserError('Teks kosong. Tulis teks atau reply pesan.');
      await ctx.reply(t.toUpperCase());
    },
  },
  {
    name: 'lower',
    display: 'Lower',
    category: 'TOOLS',
    description: 'Ubah teks menjadi huruf kecil',
    usage: '.lower <teks> (atau reply pesan)',
    status: 'tested',
    examples: [{ args: 'HALO Dunia', expect: /^halo dunia$/ }],
    async run(ctx) {
      const t = text(ctx);
      if (!t) throw new UserError('Teks kosong. Tulis teks atau reply pesan.');
      await ctx.reply(t.toLowerCase());
    },
  },
  {
    name: 'reverse',
    display: 'Reverse',
    category: 'TOOLS',
    description: 'Balik urutan teks',
    usage: '.reverse <teks> (atau reply pesan)',
    status: 'tested',
    examples: [{ args: 'halo', expect: /^olah$/ }],
    async run(ctx) {
      const t = text(ctx);
      if (!t) throw new UserError('Teks kosong. Tulis teks atau reply pesan.');
      await ctx.reply([...t].reverse().join(''));
    },
  },
  {
    name: 'readmore',
    display: 'ReadMore',
    category: 'TOOLS',
    description: 'Buat pesan "Baca selengkapnya": pisahkan bagian dengan |',
    usage: '.readmore <teks awal>|<teks tersembunyi>',
    minArgs: 1,
    status: 'tested',
    examples: [{ args: 'depan|belakang', expect: /^depan‎{4001}belakang$/ }, { args: 'tanpa pemisah', expect: /Pisahkan dengan/ }],
    async run(ctx) {
      const i = ctx.argText.indexOf('|');
      if (i < 0) throw new UserError('Pisahkan dengan |. Contoh: .readmore teks awal|teks tersembunyi');
      await ctx.reply(`${ctx.argText.slice(0, i).trim()}${'‎'.repeat(4001)}${ctx.argText.slice(i + 1).trim()}`);
    },
  },
  {
    name: 'getmsgid',
    display: 'GetMsgID',
    category: 'TOOLS',
    description: 'Tampilkan ID pesan yang di-reply',
    status: 'tested',
    examples: [{ args: '', expect: /Reply sebuah pesan/ }],
    async run(ctx) {
      if (!ctx.quoted?.key?.id) throw new UserError('Reply sebuah pesan lalu ketik .getmsgid');
      await ctx.reply(`ID pesan: ${ctx.quoted.key.id}\nChat: ${ctx.jid}`);
    },
  },
];

module.exports.calculate = calculate;
