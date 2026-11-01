'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { WebSocket } = require('ws');
const { server } = require('../server');

let base;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
});

function connect() {
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', {
    origin: base
  });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function getMessage(ws, expectedType) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', receive); reject(new Error(`Timed out waiting for ${expectedType}`)); }, 4000);
    function receive(raw) {
      const message = JSON.parse(raw.toString());
      if (message.type === expectedType) {
        clearTimeout(timer);
        ws.off('message', receive);
        resolve(message);
      }
    }
    ws.on('message', receive);
  });
}

function say(ws, obj) { ws.send(JSON.stringify(obj)); }

test('creates rooms, serves the website, and keeps host and viewer routes separate', async () => {
  const created = await fetch(base + '/api/rooms', { method: 'POST' });
  assert.equal(created.status, 201);
  const { roomId, token } = await created.json();
  assert.match(roomId, /^[A-F0-9]{10}$/);
  assert.ok(token.length > 30);
  for (const route of ['/', `/host/${roomId}`, `/watch/${roomId}`, '/app.js', '/styles.css']) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200, route);
  }
  assert.equal((await fetch(base + '/missing')).status, 404);
});

test('host and viewers exchange WebRTC signaling and learn when sharing stops', async () => {
  const { roomId, token } = await (await fetch(base + '/api/rooms', { method: 'POST' })).json();
  const host = await connect();
  const joinedHost = getMessage(host, 'joined');
  say(host, { type: 'join', roomId, role: 'host', token });
  assert.deepEqual((await joinedHost).viewerIds, []);

  const viewer = await connect();
  const joinedViewer = getMessage(viewer, 'joined');
  const viewerAnnounced = getMessage(host, 'viewer-joined');
  say(viewer, { type: 'join', roomId, role: 'viewer' });
  const viewerInfo = await joinedViewer;
  const viewerId = (await viewerAnnounced).viewerId;
  assert.equal(viewerInfo.hostOnline, true);
  assert.equal(viewerInfo.sharing, false);

  const started = getMessage(viewer, 'sharing-started');
  say(host, { type: 'sharing-started' });
  await started;

  const offer = getMessage(viewer, 'signal');
  say(host, { type: 'signal', to: viewerId, data: { description: { type: 'offer', sdp: 'example-offer' } } });
  assert.equal((await offer).data.description.sdp, 'example-offer');

  const answer = getMessage(host, 'signal');
  say(viewer, { type: 'signal', to: 'host', data: { description: { type: 'answer', sdp: 'example-answer' } } });
  assert.equal((await answer).from, viewerId);

  const stopped = getMessage(viewer, 'sharing-stopped');
  say(host, { type: 'sharing-stopped' });
  await stopped;

  const hostLeft = getMessage(viewer, 'host-left');
  host.close();
  await hostLeft;
  viewer.close();
});

test('rejects unauthorized hosting attempts', async () => {
  const { roomId } = await (await fetch(base + '/api/rooms', { method: 'POST' })).json();
  const attacker = await connect();
  const error = getMessage(attacker, 'error');
  say(attacker, { type: 'join', roomId, role: 'host', token: 'not-the-key' });
  assert.equal((await error).message, 'Invalid host link.');
  attacker.close();
});
