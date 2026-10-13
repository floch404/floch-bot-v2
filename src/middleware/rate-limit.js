'use strict';

/**
 * Rate limiter in-memory (cukup untuk satu proses/instance).
 * Jika menjalankan beberapa instance, pindahkan penyimpanan ke Redis/DB.
 */
function rateLimit({ windowMs, max, key, message = 'Terlalu banyak permintaan. Coba lagi nanti.' }) {
  const hits = new Map(); // key -> { count, resetAt }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  timer.unref();

  const middleware = (req, res, next) => {
    const k = key ? key(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `${message} (coba lagi dalam ${retry} detik)` });
    }
    next();
  };
  middleware.reset = () => hits.clear();
  return middleware;
}

module.exports = { rateLimit };
