'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { run } = require('../scripts/smoke-deploy');

function fakeServer({ good }) {
  return http.createServer((req, res) => {
    const json = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'");
    if (req.url === '/api/health') return json({ ok: true });
    if (req.url === '/api/status') return json({ owner: 'floch', developer: 'floch', service: 'online' });
    if (req.url === '/api/pairing/status') return json({ session: { status: 'disconnected', code: null } });
    if (req.url === '/api/pairing/connect') return req.headers['x-requested-with'] ? json({ error: 'Nomor tidak valid' }, 400) : json({ error: 'csrf' }, 403);
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); return res.end(good ? '<html><button id="generate">CONNECT WHATSAPP</button></html>' : '<html><h1>README Termux</h1></html>'); }
    res.writeHead(404); res.end('nf');
  });
}
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));

test('smoke-deploy: server sehat lulus semua pemeriksaan', async () => {
  const s = fakeServer({ good: true }); const base = await listen(s);
  const rs = await run(base);
  s.close();
  assert.deepEqual(rs.filter((r) => !r.ok), []);
});

test('smoke-deploy: mendeteksi bila halaman utama bukan antarmuka pairing', async () => {
  const s = fakeServer({ good: false }); const base = await listen(s);
  const rs = await run(base);
  s.close();
  assert.equal(rs.find((r) => /bukan README/.test(r.name)).ok, false);
});
