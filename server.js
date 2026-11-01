'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = __dirname;
const rooms = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function serveFile(res, filename) {
  const filepath = path.join(PUBLIC_DIR, filename);
  fs.readFile(filepath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const type = MIME[path.extname(filename)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': filename === 'index.html' ? 'no-store' : 'public, max-age=3600',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(data);
  });
}

function makeRoomId() {
  let id;
  do { id = crypto.randomBytes(5).toString('hex').toUpperCase(); }
  while (rooms.has(id));
  return id;
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'POST' && pathname === '/api/rooms') {
    if (rooms.size >= 10000) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many active rooms. Try again later.' }));
      return;
    }
    const roomId = makeRoomId();
    const token = crypto.randomBytes(32).toString('base64url');
    rooms.set(roomId, { token, host: null, viewers: new Map(), sharing: false, emptySince: Date.now() });
    res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ roomId, token }));
    return;
  }
  if (req.method === 'GET') {
    if (pathname === '/' || /^\/(host|watch)\/[A-F0-9]{10}$/.test(pathname)) {
      serveFile(res, 'index.html');
      return;
    }
    if (pathname === '/app.js') { serveFile(res, 'app.js'); return; }
    if (pathname === '/styles.css') { serveFile(res, 'styles.css'); return; }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  let originHost;
  try { originHost = new URL(origin).host; } catch { socket.destroy(); return; }
  if (originHost !== req.headers.host || req.url !== '/ws') {
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});
  let membership = null;

  ws.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'join') {
      if (membership) return;
      const roomId = typeof message.roomId === 'string' ? message.roomId : '';
      const room = rooms.get(roomId);
      if (!room) { send(ws, { type: 'error', message: 'This room no longer exists. Ask for a new link.' }); return; }
      if (message.role === 'host') {
        if (typeof message.token !== 'string' || message.token !== room.token) {
          send(ws, { type: 'error', message: 'Invalid host link.' }); return;
        }
        if (room.host && room.host.readyState === WebSocket.OPEN) {
          send(ws, { type: 'error', message: 'This room is already open in another host tab.' }); return;
        }
        room.host = ws;
        room.sharing = false;
        membership = { roomId, role: 'host' };
        room.emptySince = null;
        send(ws, { type: 'joined', role: 'host', viewerIds: [...room.viewers.keys()] });
        for (const viewer of room.viewers.values()) send(viewer, { type: 'host-online' });
      } else if (message.role === 'viewer') {
        if (room.viewers.size >= 40) {
          send(ws, { type: 'error', message: 'This room has reached its viewer limit.' }); return;
        }
        const viewerId = crypto.randomUUID();
        room.viewers.set(viewerId, ws);
        membership = { roomId, role: 'viewer', viewerId };
        room.emptySince = null;
        send(ws, { type: 'joined', role: 'viewer', hostOnline: !!room.host, sharing: room.sharing });
        send(room.host, { type: 'viewer-joined', viewerId, count: room.viewers.size });
      } else {
        send(ws, { type: 'error', message: 'Invalid role.' });
      }
      return;
    }

    if (!membership) return;
    const room = rooms.get(membership.roomId);
    if (!room) return;

    if (message.type === 'signal') {
      if (!message.data || typeof message.data !== 'object') return;
      if (membership.role === 'host') {
        if (typeof message.to === 'string' && room.viewers.has(message.to)) {
          send(room.viewers.get(message.to), { type: 'signal', data: message.data });
        }
      } else {
        send(room.host, { type: 'signal', from: membership.viewerId, data: message.data });
      }
      return;
    }

    if (membership.role === 'host' && message.type === 'sharing-started') {
      room.sharing = true;
      for (const viewer of room.viewers.values()) send(viewer, { type: 'sharing-started' });
    }
    if (membership.role === 'host' && message.type === 'sharing-stopped') {
      room.sharing = false;
      for (const viewer of room.viewers.values()) send(viewer, { type: 'sharing-stopped' });
    }
  });

  ws.on('close', () => {
    if (!membership) return;
    const room = rooms.get(membership.roomId);
    if (!room) return;
    if (membership.role === 'host' && room.host === ws) {
      room.host = null;
      room.sharing = false;
      for (const viewer of room.viewers.values()) send(viewer, { type: 'host-left' });
    } else if (membership.role === 'viewer') {
      room.viewers.delete(membership.viewerId);
      send(room.host, { type: 'viewer-left', viewerId: membership.viewerId, count: room.viewers.size });
    }
    if (!room.host && room.viewers.size === 0) room.emptySince = Date.now();
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  for (const [id, room] of rooms) {
    if (room.emptySince && Date.now() - room.emptySince > 60 * 60 * 1000) rooms.delete(id);
  }
}, 30000);
heartbeat.unref();

if (require.main === module) server.listen(PORT, '0.0.0.0', () => {
  console.log(`FrameShare running at http://localhost:${PORT}`);
});

module.exports = { server, rooms };
