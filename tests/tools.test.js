'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

let n = 0;
const run = async (cmd) => (await h.say(cmd, { from: `62895${String(++n).padStart(8, '0')}` })).text;

test('encode/decode: vektor uji standar untuk setiap format', async () => {
  assert.equal(await run('.b64 halo'), 'aGFsbw==');
  assert.equal(await run('.base64 halo'), 'aGFsbw==');
  assert.equal(await run('.b64 decode aGFsbw=='), 'halo');
  assert.equal(await run('.b32 foobar'), 'MZXW6YTBOI======');
  assert.equal(await run('.base32 foobar'), 'MZXW6YTBOI======');
  assert.equal(await run('.base32 decode MZXW6YTBOI======'), 'foobar');
  assert.equal(await run('.ascii85 Man'), '9jqo');
  assert.equal(await run('.base85 Man'), '9jqo');
  assert.equal(await run('.hex halo'), '68616c6f');
  assert.equal(await run('.bin A'), '01000001');
  assert.equal(await run('.binary A'), '01000001');
  assert.equal(await run('.bin decode 01000001'), 'A');
  assert.equal(await run('.oct A'), '101');
  assert.equal(await run('.octal A'), '101');
  assert.equal(await run('.morse SOS'), '... --- ...');
  assert.equal(await run('.morse decode ... --- ...'), 'SOS');
  assert.equal(await run('.rot13 Hello'), 'Uryyb');
  assert.equal(await run('.atbash abc'), 'zyx');
  assert.equal(await run('.url a b&c'), 'a%20b%26c');
  assert.equal(await run('.html <a>'), '&lt;a&gt;');
});

test('round-trip semua codec untuk teks Unicode', async () => {
  const text = 'Halo dunia 你好 🚀';
  for (const f of ['base64', 'base32', 'hex', 'binary', 'octal', 'ascii85', 'url', 'html']) {
    const enc = await run(`.encode ${f} ${text}`);
    const dec = await run(`.decode ${f} ${enc}`);
    assert.equal(dec, text, f);
  }
});

test('input rusak ditolak dengan pesan jelas (tidak crash)', async () => {
  assert.match(await run('.b64 decode !!!'), /tidak valid|bukan/i);
  assert.match(await run('.hex decode zz'), /tidak valid|bukan/i);
  assert.match(await run('.encode xyz halo'), /Format tidak dikenal/);
  assert.match(await run('.b64 ' + 'a'.repeat(5000)), /terlalu panjang/);
});

test('.calculator aman: hanya aritmetika, menolak kode', async () => {
  assert.match(await run('.calculator 2+3*4'), /= 14$/);
  assert.match(await run('.calculator (1+2)^3'), /27/);
  for (const evil of ['process.exit()', 'require("fs")', '1;2', 'constructor', '`x`']) {
    assert.doesNotMatch(await run(`.calculator ${evil}`), /= -?\d/, evil);
  }
});

test('.color .jwt .lorem .upper .lower .reverse .readmore .getmsgid', async () => {
  assert.match(await run('.color #ff0000'), /rgb\(255, 0, 0\)|255, 0, 0/i);
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
  assert.match(await run(`.jwt ${jwt}`), /HS256[\s\S]*"sub"/);
  assert.match(await run('.lorem 5'), /\w+/);
  assert.equal(await run('.upper abc'), 'ABC');
  assert.equal(await run('.lower ABC'), 'abc');
  assert.equal(await run('.reverse abc'), 'cba');
  assert.match(await run('.readmore a|b'), /^a.+b$/s);
  assert.match(await run('.getmsgid'), /id\d+|ID/i);
});

test('.fun: .dadu .koin .suit .cek .ship .fact .roast .reaction menghasilkan balasan valid', async () => {
  assert.match(await run('.dadu'), /[1-6]/);
  assert.match(await run('.koin'), /Gambar|Angka/i);
  assert.match(await run('.suit batu'), /batu|gunting|kertas/i);
  assert.match(await run('.cek ganteng'), /\d+%|%/);
  assert.match(await run('.ship a b'), /\d+%/);
  assert.ok((await run('.fact')).length > 5);
  assert.ok((await run('.roast')).length > 3);
});
