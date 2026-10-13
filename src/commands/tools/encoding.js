'use strict';

const codecs = require('./_codecs');
const { UserError } = require('../../core/executor');

const MAX_INPUT = 2000;
const MAX_OUTPUT = 3500;

/** Teks input: argumen, atau isi pesan yang di-reply. */
const inputText = (ctx, text) => (text !== undefined ? text : ctx.argText || ctx.quoted?.text || '');

function parseMode(ctx) {
  const first = (ctx.args[0] || '').toLowerCase();
  if (['decode', 'dec', 'd'].includes(first) && ctx.args.length > 1) return { mode: 'decode', text: ctx.argText.slice(ctx.args[0].length).trim() };
  if (['encode', 'enc', 'e'].includes(first) && ctx.args.length > 1) return { mode: 'encode', text: ctx.argText.slice(ctx.args[0].length).trim() };
  return { mode: 'encode', text: ctx.argText || ctx.quoted?.text || '' };
}

async function runCodec(ctx, codec, forced = null) {
  let { mode, text } = forced ? { mode: forced, text: ctx.argText } : parseMode(ctx);
  if (!text) text = ctx.quoted?.text || '';
  if (!text) throw new UserError('Teks kosong. Tulis teksnya atau reply pesan.');
  if (text.length > MAX_INPUT) throw new UserError(`Teks terlalu panjang (maks ${MAX_INPUT} karakter).`);
  const out = codec[mode](text);
  await ctx.reply(out.length > MAX_OUTPUT ? `${out.slice(0, MAX_OUTPUT)}\n…(dipotong)` : out || '(hasil kosong)');
}

const usageOf = (n) => `.${n} <teks>  atau  .${n} decode <teks>`;

/** Satu entri registry per ejaan (B64 dan BASE64 adalah dua command terpisah dengan codec yang sama). */
const make = (names, codec, desc, examples) =>
  names.map((display, i) => ({
    name: display.toLowerCase(),
    display,
    category: 'TOOLS',
    description: desc,
    usage: usageOf(display.toLowerCase()),
    status: 'tested',
    examples: i === 0 ? examples : [],
    tests: i === 0 ? undefined : 'tests/tools.test.js',
    run: (ctx) => runCodec(ctx, codec),
  }));

const same = (cmd) => ({ args: cmd[0], expect: cmd[1] });

const defs = [
  ...make(['B64', 'BASE64'], codecs.b64, 'Encode/decode Base64', [same(['halo dunia', /^aGFsbyBkdW5pYQ==$/]), same(['decode aGFsbyBkdW5pYQ==', /^halo dunia$/]), same(['decode @@@', /bukan Base64/])]),
  ...make(['B32', 'BASE32'], codecs.b32, 'Encode/decode Base32', [same(['halo', /^NBQWY3Y=$/]), same(['decode NBQWY3Y=', /^halo$/])]),
  ...make(['ASCII85', 'BASE85'], codecs.a85, 'Encode/decode Ascii85 (BASE85 = Ascii85)', [same(['Man', /^9jqo$/]), same(['decode 9jqo', /^Man$/])]),
  ...make(['HEX'], codecs.hex, 'Encode/decode heksadesimal', [same(['halo', /^68616c6f$/]), same(['decode 68 61 6c 6f', /^halo$/])]),
  ...make(['BIN', 'BINARY'], codecs.bin, 'Encode/decode biner', [same(['A', /^01000001$/]), same(['decode 01001000 01101001', /^Hi$/])]),
  ...make(['OCT', 'OCTAL'], codecs.oct, 'Encode/decode oktal (per byte)', [same(['Hi', /^110 151$/]), same(['decode 110 151', /^Hi$/])]),
  ...make(['MORSE'], codecs.morse, 'Encode/decode kode Morse', [same(['SOS', /^\.\.\. --- \.\.\.$/]), same(['decode ... --- ...', /^SOS$/])]),
  ...make(['ROT13'], codecs.rot13, 'Cipher ROT13 (encode = decode)', [same(['Hello', /^Uryyb$/])]),
  ...make(['ATBASH'], codecs.atbash, 'Cipher Atbash (encode = decode)', [same(['abc', /^zyx$/])]),
  ...make(['URL'], codecs.url, 'Encode/decode URL (percent-encoding)', [same(['a b&c', /^a%20b%26c$/]), same(['decode a%20b%26c', /^a b&c$/])]),
  ...make(['HTML'], codecs.html, 'Escape/unescape HTML', [same(['<b>"x"</b>', /^&lt;b&gt;&quot;x&quot;&lt;\/b&gt;$/]), same(['decode &lt;i&gt;', /^<i>$/])]),
];

const FORMATS = { base64: codecs.b64, b64: codecs.b64, base32: codecs.b32, b32: codecs.b32, ascii85: codecs.a85, base85: codecs.a85, hex: codecs.hex, bin: codecs.bin, binary: codecs.bin, oct: codecs.oct, octal: codecs.oct, morse: codecs.morse, rot13: codecs.rot13, atbash: codecs.atbash, url: codecs.url, html: codecs.html };

const generic = (mode) => ({
  name: mode,
  display: mode === 'encode' ? 'Encode' : 'Decode',
  category: 'TOOLS',
  description: `${mode === 'encode' ? 'Encode' : 'Decode'} teks dengan format pilihan`,
  usage: `.${mode} <format> <teks>  (format: ${[...new Set(Object.keys(FORMATS))].join(', ')})`,
  minArgs: 2,
  status: 'tested',
  examples:
    mode === 'encode'
      ? [{ args: 'base64 halo', expect: /^aGFsbw==$/ }, { args: 'xyz halo', expect: /Format tidak dikenal/ }]
      : [{ args: 'hex 68616c6f', expect: /^halo$/ }],
  async run(ctx) {
    const codec = FORMATS[ctx.args[0].toLowerCase()];
    if (!codec) throw new UserError(`Format tidak dikenal. Pilih: ${[...new Set(Object.keys(FORMATS))].join(', ')}`);
    const text = ctx.argText.slice(ctx.args[0].length).trim();
    if (!text) throw new UserError('Teks kosong.');
    if (text.length > MAX_INPUT) throw new UserError(`Teks terlalu panjang (maks ${MAX_INPUT} karakter).`);
    const out = codec[mode](text);
    await ctx.reply(out.length > MAX_OUTPUT ? `${out.slice(0, MAX_OUTPUT)}\n…(dipotong)` : out);
  },
});

module.exports = [...defs, generic('encode'), generic('decode')];
module.exports.inputText = inputText;
