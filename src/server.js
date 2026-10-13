'use strict';

const http = require('node:http');
const config = require('./config');
const registry = require('./core/registry');
const { createApp } = require('./app');
const { manager } = require('./whatsapp/session-manager');
const { attachHub } = require('./realtime/hub');
const visitors = require('./visitors/visitors');

async function main() {
  registry.ensureLoaded();
  const active = registry.active().length;
  const total = registry.all().length;

  const server = http.createServer(createApp({ manager }));
  const hub = attachHub(server, manager);

  server.listen(config.port, config.host, () => {
    console.log(`[server] ${config.identity.botName} berjalan di http://${config.host}:${config.port}`);
    console.log(`[server] command aktif: ${active} (inventaris ${total}; sisanya belum diimplementasikan/belum dikonfigurasi)`);
    if (!config.ownerNumbers.length) console.warn('[server] OWNER_NUMBERS belum diisi: command Owner tidak dapat dipakai siapa pun.');
    if (!config.cookieSecure) console.warn('[server] COOKIE_SECURE=false. Aktifkan "true" jika memakai HTTPS (wajib di produksi).');
    if (!config.site.accessCode) console.warn('[server] PAIRING_ACCESS_CODE kosong: siapa pun yang membuka website dapat memulai sesi bot (batas: MAX_SESSIONS).');
  });

  const sweepTimer = setInterval(() => {
    visitors.sweep();
    manager.sweep().catch((err) => console.error('[sweep]', err.message));
  }, 5 * 60_000);
  sweepTimer.unref();

  manager
    .restoreAll()
    .then((n) => n && console.log(`[wa] ${n} sesi WhatsApp dipulihkan`))
    .catch((err) => console.error('[wa] gagal memulihkan sesi:', err));

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[server] ${signal} diterima, menutup...`);
    hub.close();
    await manager.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Error tak terduga di library WhatsApp tidak boleh menjatuhkan seluruh proses.
  process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
  process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
