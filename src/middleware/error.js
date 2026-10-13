'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON tidak valid.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data terlalu besar.' });
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  // Pesan internal tidak dibocorkan untuk error 5xx yang tidak kita buat sendiri.
  const expose = status < 500 || err.expose === true || err.name === 'JwsError';
  res.status(status).json({ error: expose ? err.message : 'Terjadi kesalahan pada server.' });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
