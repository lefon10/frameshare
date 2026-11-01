'use strict';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const pathParts = location.pathname.split('/').filter(Boolean);
const role = pathParts[0] === 'host' || pathParts[0] === 'watch' ? pathParts[0] : null;
const roomId = role ? pathParts[1] : null;
const hostToken = location.hash.slice(1);
const viewerUrl = roomId ? `${location.origin}/watch/${roomId}` : '';
const iceConfig = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

const icons = {
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1l1.2-1.2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 22 7-4V6l-7-4-7 4v12z"/><path d="m9 12 2 2 4-4"/></svg>',
  audioOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9H5v6h4l5 4V5l-2 1.6M3 3l18 18"/><path d="M17 9a4 4 0 0 1 .6 4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h6v6m0-6-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/></svg>'
};

let toastTimeout;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3400);
}

function setStatus(message, level = '') {
  const el = document.getElementById('status');
  if (!el) return;
  el.className = 'stream-status' + (level ? ` ${level}` : '');
  el.querySelector('span:last-child').textContent = message;
}

function setPlaceholder(title, message) {
  const titleEl = document.getElementById('placeholder-title');
  const descriptionEl = document.getElementById('placeholder-description');
  if (titleEl) titleEl.textContent = title;
  if (descriptionEl) descriptionEl.textContent = message;
}

function setVideoVisible(visible) {
  document.getElementById('stage')?.classList.toggle('has-video', visible);
}

function landingPage() {
  app.innerHTML = `
    <section class="landing">
      <div class="eyebrow">THE SIMPLEST WAY TO SHOW SOMEONE</div>
      <h1>Your screen.<br><span class="gradient-text">Their window.</span></h1>
      <p class="lead">Share exactly what’s on your computer, instantly. One link, no downloads, no sign-ups, and absolutely no audio.</p>
      <div class="actions"><button class="btn btn-primary" id="create-room">${icons.monitor} Create a sharing room ${icons.arrow}</button></div>
      <div class="landing-features">
        <div class="feature"><div class="feature-icon">${icons.link}</div><strong>One simple link</strong><p>Send a viewer link and they can watch in their browser.</p></div>
        <div class="feature"><div class="feature-icon">${icons.audioOff}</div><strong>Screen only</strong><p>Just your screen. No microphone or audio tracks.</p></div>
        <div class="feature"><div class="feature-icon">${icons.shield}</div><strong>You're in control</strong><p>Choose a screen or window, and stop whenever you want.</p></div>
      </div>
    </section>`;
  document.getElementById('create-room').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Creating your room…';
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create room');
      location.href = `/host/${data.roomId}#${data.token}`;
    } catch (error) {
      toast(error.message || 'Could not create a room.');
      button.disabled = false;
      button.innerHTML = `${icons.monitor} Create a sharing room ${icons.arrow}`;
    }
  });
}

function sessionPage(isHost) {
  app.innerHTML = `
    <section class="session">
      <div class="session-heading">
        <div><div class="eyebrow">${isHost ? 'YOUR SHARING ROOM' : 'VIEWER MODE'}</div>
          <h1>${isHost ? 'Ready when you are.' : 'A front-row seat.'}</h1>
          <p class="session-subtitle">${isHost ? 'Choose what to share. Send your link. Stay in control.' : 'The shared screen will appear here as soon as the host starts.'}</p>
        </div>
        <div class="room-badge">ROOM <b>${roomId}</b></div>
      </div>
      <div class="session-layout">
        <div>
          <div id="stage" class="screen-stage">
            <div class="stage-placeholder">
              <div class="stage-illustration">${icons.monitor}</div>
              <h2 id="placeholder-title">${isHost ? 'Your screen goes here' : 'Waiting for screen share'}</h2>
              <p id="placeholder-description">${isHost ? 'Hit the Start sharing button, then choose the screen, tab, or window you want to show.' : 'When the host starts sharing, their screen will appear automatically.'}</p>
            </div>
            <video id="screen-video" autoplay playsinline muted></video>
            <div class="stage-live"><span class="green-dot"></span>${isHost ? 'YOU ARE SHARING' : 'LIVE SCREEN'}</div>
          </div>
          <div id="status" class="stream-status"><span class="status-light"></span><span>${isHost ? 'Not sharing yet' : 'Connecting to room…'}</span></div>
          <div class="info-strip"><b>${isHost ? 'A quick heads-up:' : 'Good to know:'}</b> ${isHost ? 'Only share a window or screen you’re comfortable showing. Anyone with the viewer link can watch while you share.' : 'This is a one-way screen share, with no audio, chat, or remote control.'}</div>
        </div>
        <aside>
          ${isHost ? `
          <div class="session-panel">
            <div class="panel-kicker">01 / SHARE YOUR SCREEN</div>
            <h2 class="panel-title">Start presenting</h2>
            <p class="panel-copy">Your browser will let you pick a display, tab, or window. You can stop at any time.</p>
            <button class="btn btn-primary wide" disabled id="start-share">${icons.monitor} Start sharing</button>
            <button class="btn btn-danger wide initially-hidden" id="stop-share">${icons.stop} Stop sharing</button>
            <div class="panel-divider"></div>
            <div class="viewer-count"><span>People watching</span><strong id="viewer-count">0</strong></div>
          </div>
          <div class="session-panel">
            <div class="panel-kicker">02 / INVITE SOMEONE</div>
            <h2 class="panel-title">Send this link</h2>
            <p class="panel-copy">People who open it can see your screen, but can't control your computer.</p>
            <div class="link-field"><input id="share-url" aria-label="Viewer link" readonly><button class="btn btn-secondary btn-compact" id="copy-link">${icons.copy} Copy</button></div>
            <p class="panel-note">Keep this host tab open while sharing. Send only the viewer link — not the address of this page.</p>
          </div>` : `
          <div class="session-panel">
            <div class="panel-kicker">WATCH MODE</div>
            <h2 class="panel-title">You're connected to a room</h2>
            <p class="panel-copy">As soon as the host shares, the video will play here. No audio is transmitted.</p>
            <button class="btn btn-primary wide" id="fullscreen">${icons.expand} View fullscreen</button>
            <div class="panel-divider"></div>
            <div class="panel-kicker">INVITE LINK</div>
            <p class="panel-note">You can share this viewer link with someone else.</p>
            <div class="link-field link-field--spaced"><input id="share-url" aria-label="Viewer link" readonly><button class="btn btn-secondary btn-compact" id="copy-link">${icons.copy} Copy</button></div>
          </div>`}
        </aside>
      </div>
    </section>`;
  document.getElementById('share-url').value = viewerUrl;
  document.getElementById('copy-link').addEventListener('click', copyLink);
  if (!isHost) document.getElementById('fullscreen').addEventListener('click', () => {
    const video = document.getElementById('screen-video');
    if (!video.srcObject) { toast('The host has not started sharing yet.'); return; }
    const target = document.getElementById('stage');
    if (target.requestFullscreen) target.requestFullscreen().catch(() => toast('Fullscreen is unavailable.'));
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else toast('Fullscreen is unavailable in this browser.');
  });
}

async function copyLink() {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(viewerUrl);
    else {
      const input = document.getElementById('share-url');
      input.select();
      if (!document.execCommand('copy')) throw new Error('Copy failed');
      input.blur();
    }
    toast('Viewer link copied!');
  } catch { toast('Select the link and copy it manually.'); }
}

let socket = null;
let joined = false;
let displayStream = null;
const viewerIds = new Set();
const hostPeers = new Map();
let viewerPeer = null;
let preOfferCandidates = [];
let hostIsSharing = false;

function signal(to, data) { sendWs({ type: 'signal', to, data }); }
function sendWs(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function makePeer(to, isHost) {
  const pc = new RTCPeerConnection(iceConfig);
  const entry = { pc, remoteReady: false, pendingCandidates: [] };
  pc.onicecandidate = event => {
    if (event.candidate) signal(to, { candidate: event.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      if (!isHost) setStatus('Connection failed. Try refreshing the page.', 'warning');
    } else if (!isHost && pc.connectionState === 'connected') {
      setStatus('Watching live screen', 'live');
    }
  };
  if (!isHost) {
    pc.ontrack = event => {
      const video = document.getElementById('screen-video');
      video.srcObject = event.streams[0] || new MediaStream([event.track]);
      video.play().catch(() => {});
      setVideoVisible(true);
      setStatus('Watching live screen', 'live');
      event.track.addEventListener('ended', () => {
        if (viewerPeer === entry) clearViewerVideo();
      }, { once: true });
    };
  }
  return entry;
}

function closeEntry(entry) {
  if (!entry) return;
  entry.pc.onicecandidate = null;
  entry.pc.ontrack = null;
  entry.pc.onconnectionstatechange = null;
  entry.pc.close();
}

function clearHostPeers() {
  for (const entry of hostPeers.values()) closeEntry(entry);
  hostPeers.clear();
}

function clearViewerVideo() {
  const video = document.getElementById('screen-video');
  video.pause();
  video.srcObject = null;
  setVideoVisible(false);
}

function clearViewerPeer() {
  closeEntry(viewerPeer);
  viewerPeer = null;
  preOfferCandidates = [];
  clearViewerVideo();
}

async function applyCandidate(entry, candidate) {
  if (!entry.remoteReady) { entry.pendingCandidates.push(candidate); return; }
  try { await entry.pc.addIceCandidate(candidate); } catch (error) {
    if (entry.pc.signalingState !== 'closed') console.warn('ICE candidate failed:', error);
  }
}

async function applyDescription(entry, description) {
  await entry.pc.setRemoteDescription(description);
  entry.remoteReady = true;
  for (const candidate of entry.pendingCandidates.splice(0)) await applyCandidate(entry, candidate);
}

async function offerToViewer(id) {
  if (!displayStream || !viewerIds.has(id) || !joined) return;
  closeEntry(hostPeers.get(id));
  const entry = makePeer(id, true);
  hostPeers.set(id, entry);
  try {
    for (const track of displayStream.getVideoTracks()) entry.pc.addTrack(track, displayStream);
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    if (hostPeers.get(id) === entry) signal(id, { description: entry.pc.localDescription });
  } catch (error) {
    console.error('Unable to offer screen to viewer:', error);
    closeEntry(entry);
    if (hostPeers.get(id) === entry) hostPeers.delete(id);
  }
}

async function handleHostSignal(from, data) {
  const entry = hostPeers.get(from);
  if (!entry) return;
  try {
    if (data.description?.type === 'answer') await applyDescription(entry, data.description);
    else if (data.candidate) await applyCandidate(entry, data.candidate);
  } catch (error) { console.warn('Host signaling error:', error); }
}

async function handleViewerSignal(data) {
  try {
    if (data.description?.type === 'offer') {
      const earlyCandidates = preOfferCandidates;
      clearViewerPeer();
      const entry = makePeer('host', false);
      viewerPeer = entry;
      entry.pendingCandidates.push(...earlyCandidates);
      await applyDescription(entry, data.description);
      if (viewerPeer !== entry) return;
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      if (viewerPeer === entry) signal('host', { description: entry.pc.localDescription });
    } else if (data.candidate) {
      if (viewerPeer) await applyCandidate(viewerPeer, data.candidate);
      else preOfferCandidates.push(data.candidate);
    }
  } catch (error) {
    console.warn('Viewer signaling error:', error);
    setStatus('Unable to connect. Try refreshing the page.', 'warning');
  }
}

async function startSharing() {
  if (displayStream || !joined) return;
  const startButton = document.getElementById('start-share');
  startButton.disabled = true;
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing needs a supported browser and HTTPS (or localhost).');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 24 }, audio: false });
    if (!joined) { stream.getTracks().forEach(track => track.stop()); return; }
    displayStream = stream;
    document.getElementById('screen-video').srcObject = stream;
    document.getElementById('screen-video').play().catch(() => {});
    setVideoVisible(true);
    setStatus('You are sharing your screen', 'live');
    startButton.style.display = 'none';
    document.getElementById('stop-share').style.display = 'inline-flex';
    stream.getVideoTracks()[0]?.addEventListener('ended', () => stopSharing(), { once: true });
    sendWs({ type: 'sharing-started' });
    for (const id of viewerIds) offerToViewer(id);
  } catch (error) {
    if (error.name !== 'NotAllowedError') toast(error.message || 'Unable to start sharing.');
    else toast('Screen selection was cancelled.');
  } finally { startButton.disabled = !joined; }
}

function stopSharing(notify = true) {
  if (!displayStream) return;
  const stream = displayStream;
  displayStream = null;
  clearHostPeers();
  stream.getTracks().forEach(track => track.stop());
  const video = document.getElementById('screen-video');
  video.pause();
  video.srcObject = null;
  setVideoVisible(false);
  setStatus('Not sharing yet');
  document.getElementById('start-share').style.display = 'inline-flex';
  document.getElementById('stop-share').style.display = 'none';
  if (notify) sendWs({ type: 'sharing-stopped' });
}

function connectRoom(isHost) {
  if (isHost && !hostToken) {
    setStatus('Host access key missing. Create a new sharing room.', 'warning');
    toast('This host link is missing its access key.');
    return;
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener('open', () => {
    sendWs({ type: 'join', role: isHost ? 'host' : 'viewer', roomId, ...(isHost ? { token: hostToken } : {}) });
  });
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'error') {
      setStatus(message.message, 'warning');
      toast(message.message);
      socket.close();
      return;
    }
    if (message.type === 'joined') {
      joined = true;
      if (isHost) {
        for (const id of message.viewerIds) viewerIds.add(id);
        document.getElementById('viewer-count').textContent = String(viewerIds.size);
        document.getElementById('start-share').disabled = false;
        setStatus('Not sharing yet');
      } else if (message.sharing) {
        hostIsSharing = true;
        setStatus('Host is sharing. Connecting…');
      } else if (message.hostOnline) {
        setStatus('Waiting for host to share…');
      } else {
        setStatus('Waiting for the host to join…', 'warning');
      }
      return;
    }
    if (isHost) {
      if (message.type === 'viewer-joined') {
        viewerIds.add(message.viewerId);
        document.getElementById('viewer-count').textContent = String(viewerIds.size);
        if (displayStream) offerToViewer(message.viewerId);
      } else if (message.type === 'viewer-left') {
        viewerIds.delete(message.viewerId);
        closeEntry(hostPeers.get(message.viewerId));
        hostPeers.delete(message.viewerId);
        document.getElementById('viewer-count').textContent = String(viewerIds.size);
      } else if (message.type === 'signal') {
        handleHostSignal(message.from, message.data);
      }
    } else {
      if (message.type === 'sharing-started') {
        hostIsSharing = true;
        setStatus('Host is sharing. Connecting…');
      } else if (message.type === 'sharing-stopped') {
        hostIsSharing = false;
        clearViewerPeer();
        setStatus('Host stopped sharing. Waiting…');
      } else if (message.type === 'host-online') {
        hostIsSharing = false;
        clearViewerPeer();
        setStatus('Host joined. Waiting for screen share…');
      } else if (message.type === 'host-left') {
        hostIsSharing = false;
        clearViewerPeer();
        setStatus('Host disconnected. Waiting for them to return…', 'warning');
      } else if (message.type === 'signal') {
        handleViewerSignal(message.data);
      }
    }
  });
  socket.addEventListener('close', () => {
    if (isHost) {
      if (joined) stopSharing(false);
      document.getElementById('start-share').disabled = true;
      clearHostPeers();
      viewerIds.clear();
      document.getElementById('viewer-count').textContent = '0';
    } else clearViewerPeer();
    if (joined) setStatus('Connection lost. Refresh to reconnect.', 'warning');
    else if (document.getElementById('status')?.textContent.includes('Connecting')) setStatus('Room unavailable. Refresh or ask for a new link.', 'warning');
    joined = false;
  });
  socket.addEventListener('error', () => { setStatus('Connection error. Check your internet.', 'warning'); });
}

if (role && roomId) {
  const isHost = role === 'host';
  sessionPage(isHost);
  if (isHost) {
    document.getElementById('start-share').addEventListener('click', startSharing);
    document.getElementById('stop-share').addEventListener('click', () => stopSharing());
  }
  connectRoom(isHost);
} else landingPage();
