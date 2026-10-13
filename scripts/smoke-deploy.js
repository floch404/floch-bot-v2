'use strict';

/**
 * Uji asap setelah deploy. Tidak membuat sesi WhatsApp dan tidak membutuhkan nomor.
 *   npm run smoke -- https://domain-kamu
 */
const CHECKS = [
  ['GET /api/health', async (b, f) => { const r = await f(`${b}/api/health`); return r.ok && (await r.json()).ok === true; }],
  ['GET /api/status memuat Owner/Developer floch', async (b, f) => { const j = await (await f(`${b}/api/status`, { headers: { 'X-Requested-With': 'floch-web' } })).json(); return j.owner === 'floch' && j.developer === 'floch' && j.service === 'online'; }],
  ['Halaman utama adalah antarmuka pairing (bukan README)', async (b, f) => { const t = await (await f(`${b}/`)).text(); return /CONNECT WHATSAPP/.test(t) && /id="generate"/.test(t) && !/Termux/.test(t); }],
  ['Header CSP terpasang', async (b, f) => /script-src 'self'/.test((await f(`${b}/`)).headers.get('content-security-policy') || '')],
  ['POST tanpa header keamanan ditolak (CSRF)', async (b, f) => (await f(`${b}/api/pairing/connect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status === 403],
  ['Nomor tidak valid ditolak 400', async (b, f) => (await f(`${b}/api/pairing/connect`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Requested-With': 'floch-web' }, body: JSON.stringify({ country: '62', number: 'abc' }) })).status === 400],
  ['Status tanpa cookie = Disconnected (tidak membocorkan sesi orang lain)', async (b, f) => { const j = await (await f(`${b}/api/pairing/status`)).json(); return j.session.status === 'disconnected' && !j.session.code; }],
  ['Folder data/.env tidak bisa diunduh', async (b, f) => { for (const p of ['/.env', '/data/floch.db', '/../.env', '/src/config/index.js']) { const r = await f(`${b}${p}`); const t = await r.text(); if (r.ok && !/<html/i.test(t)) return false; } return true; }],
];

async function run(base, fetchImpl = fetch) {
  const results = [];
  for (const [name, fn] of CHECKS) {
    let ok = false;
    let note = '';
    try { ok = await fn(base.replace(/\/+$/, ''), fetchImpl); } catch (e) { note = e.message; }
    results.push({ name, ok, note });
  }
  return results;
}

if (require.main === module) {
  const base = process.argv[2];
  if (!/^https?:\/\//.test(base || '')) { console.error('Pemakaian: npm run smoke -- https://domain-kamu'); process.exit(2); }
  run(base).then((rs) => {
    for (const r of rs) console.log(`${r.ok ? 'LULUS' : 'GAGAL'}  ${r.name}${r.note ? ` (${r.note})` : ''}`);
    console.log('\nCatatan: ini TIDAK menguji pairing sungguhan. Uji itu manual dengan nomor kamu (lihat README).');
    process.exit(rs.every((r) => r.ok) ? 0 : 1);
  });
}

module.exports = { run };
