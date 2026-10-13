'use strict';

const express = require('express');
const config = require('./config');
const visitors = require('./visitors/visitors');
const { securityHeaders, csrfGuard } = require('./middleware/security');
const { rateLimit } = require('./middleware/rate-limit');
const { notFound, errorHandler } = require('./middleware/error');
const { createPairingRouter } = require('./routes/pairing.routes');
const { createStatusRouter } = require('./routes/status.routes');

/** Website HANYA untuk pairing WhatsApp dan informasi koneksi. Tidak ada login, admin, premium, atau JWS di sini. */
function createApp({ manager }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders);
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', rateLimit({ windowMs: 60_000, max: config.site.apiRatePerMin }));
  app.use('/api', express.json({ limit: '5kb' }));
  app.use('/api', csrfGuard);
  app.use('/api', visitors.attach);

  app.use('/api/status', createStatusRouter({ manager }));
  app.use('/api/pairing', createPairingRouter({ manager }));
  app.use('/api', notFound);

  // Hanya folder public yang disajikan. data/, .env, dan sesi WhatsApp berada di luar folder ini.
  app.use(express.static(config.publicDir, { dotfiles: 'ignore', index: 'index.html', maxAge: '1h' }));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
