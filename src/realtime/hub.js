'use strict';

const { WebSocketServer } = require('ws');
const visitors = require('../visitors/visitors');

/**
 * WebSocket untuk status koneksi real-time. Setiap koneksi hanya menerima status MILIK pengunjung itu sendiri
 * (termasuk pairing code), diautentikasi lewat cookie dan dicek Origin-nya.
 */
function attachHub(server, manager) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const bySid = new Map(); // sid -> Set<ws>

  const reject = (socket, code, text) => {
    socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws') return reject(socket, 404, 'Not Found');

    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) return reject(socket, 403, 'Forbidden');
      } catch {
        return reject(socket, 403, 'Forbidden');
      }
    }
    const sid = visitors.idFromCookieHeader(req.headers.cookie);
    if (!sid) return reject(socket, 401, 'Unauthorized');

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.sid = sid;
      ws.isAlive = true;
      if (!bySid.has(sid)) bySid.set(sid, new Set());
      bySid.get(sid).add(ws);
      ws.on('pong', () => (ws.isAlive = true));
      ws.on('error', () => ws.terminate());
      ws.on('close', () => {
        const set = bySid.get(sid);
        if (set) {
          set.delete(ws);
          if (!set.size) bySid.delete(sid);
        }
      });
      ws.send(JSON.stringify({ type: 'status', data: manager.publicInfo(sid) }));
    });
  });

  const onUpdate = (sid, info) => {
    const set = bySid.get(sid);
    if (!set) return;
    const payload = JSON.stringify({ type: 'status', data: info });
    for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(payload);
  };
  manager.on('update', onUpdate);

  const timer = setInterval(() => {
    for (const set of bySid.values()) {
      for (const ws of set) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30_000);
  timer.unref();

  return {
    close() {
      clearInterval(timer);
      manager.off('update', onUpdate);
      for (const set of bySid.values()) for (const ws of set) ws.terminate();
      wss.close();
    },
  };
}

module.exports = { attachHub };
