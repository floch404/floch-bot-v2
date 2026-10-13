'use strict';

const express = require('express');
const config = require('../config');

/** Informasi layanan publik (tidak sensitif). Semua nilai berasal dari kondisi server yang sebenarnya. */
function createStatusRouter({ manager }) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({
      name: config.identity.botName,
      owner: config.identity.owner,
      developer: config.identity.developer,
      service: 'online',
      uptimeSeconds: Math.floor(process.uptime()),
      sessions: { active: manager.activeCount(), connected: manager.connectedSessions().length, capacity: config.site.maxSessions },
      requiresAccessCode: !!config.site.accessCode,
    });
  });
  return router;
}

module.exports = { createStatusRouter };
