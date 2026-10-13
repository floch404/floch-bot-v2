'use strict';

const express = require('express');
const config = require('../config');
const visitors = require('../visitors/visitors');
const pairing = require('../services/pairing.service');
const { rateLimit } = require('../middleware/rate-limit');
const { asyncHandler } = require('../middleware/error');

/** Semua operasi memakai req.visitorId dari cookie: pengunjung hanya dapat menyentuh sesi miliknya sendiri. */
function createPairingRouter({ manager }) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json({ session: manager.publicInfo(req.visitorId) });
  });

  router.post(
    '/connect',
    rateLimit({ windowMs: 10 * 60_000, max: config.site.pairingRatePer10Min, message: 'Terlalu banyak permintaan pairing.' }),
    asyncHandler(async (req, res) => {
      const session = await pairing.connect({ sid: req.visitorId, issue: () => visitors.issue(res), body: req.body, manager });
      res.status(202).json({ session });
    })
  );

  router.post(
    '/disconnect',
    asyncHandler(async (req, res) => {
      if (!req.visitorId) return res.json({ session: manager.publicInfo(null) });
      res.json({ session: await manager.disconnect(req.visitorId) });
    })
  );

  return router;
}

module.exports = { createPairingRouter };
