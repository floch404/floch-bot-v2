'use strict';

/** Tulis docs/COMMAND_STATUS.md dari registry (sumber kebenaran). `npm run report` */
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../src/core/registry');

registry.ensureLoaded();
const all = registry.all();
const cnt = (s) => all.filter((d) => d.status === s).length;
const out = [
  '# Status Command FLOCH BOT',
  '',
  '_Dibuat otomatis oleh `npm run report` dari registry. Jangan edit manual._',
  '',
  `- Terdaftar: **${all.length}** nama · Aktif (tampil di menu): **${registry.active().length}**`,
  `- tested: ${cnt('tested')} · implemented: ${cnt('implemented')} · needs_config: ${cnt('needs_config')} · planned: ${cnt('planned')}`,
  '',
  '**tested** = kode lengkap + lulus tes otomatis (WhatsApp/jaringan disimulasikan). **implemented** = kode lengkap, hanya diuji dengan tiruan; belum dicoba ke layanan sungguhan.',
  '**needs_config** = butuh API key/verifikasi; aktif hanya jika dikonfigurasi. **planned** = BELUM ada; tidak tampil di menu dan tidak dihitung.',
  '',
];
for (const cat of registry.CATEGORY_ORDER) {
  const list = all.filter((d) => d.categories.includes(cat)).sort((a, b) => a.display.localeCompare(b.display));
  if (!list.length) continue;
  out.push(`## ${cat} (${list.filter(registry.isActive).length}/${list.length} aktif)`, '', '| Command | Status | Akses | Keterangan |', '|---|---|---|---|');
  for (const d of list) {
    const acc = [d.permission, d.groupOnly && 'grup', d.groupAdmin && 'admin grup', d.botAdmin && 'bot admin'].filter(Boolean).join(', ');
    const st = d.status === 'needs_config' ? `needs_config (${registry.isActive(d) ? 'aktif' : 'nonaktif'})` : d.status;
    out.push(`| .${d.display} | ${st} | ${acc} | ${(d.description || '').replace(/\|/g, '/')} |`);
  }
  out.push('');
}
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'COMMAND_STATUS.md'), out.join('\n'));
console.log('docs/COMMAND_STATUS.md ditulis.');
