'use strict';

const config = require('../config');

function securityHeaders(req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' blob: data:",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Perlindungan CSRF untuk request yang mengubah data:
 * - cookie sesi sudah SameSite=Strict
 * - wajib header kustom (browser lintas-origin tidak bisa mengirimnya tanpa preflight, dan CORS tidak diaktifkan)
 * - jika header Origin ada, hostnya harus sama dengan Host
 */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'floch-web') {
    return res.status(403).json({ error: 'Permintaan ditolak (header keamanan tidak ada).' });
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) throw new Error('mismatch');
    } catch {
      return res.status(403).json({ error: 'Permintaan ditolak (origin tidak cocok).' });
    }
  }
  next();
}

module.exports = { securityHeaders, csrfGuard };
