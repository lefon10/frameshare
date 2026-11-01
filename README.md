# FrameShare

A small website that lets one person **share their computer screen** and other people **watch using a link**. No microphone, system audio, chat, recording, accounts, or remote control.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm start
```

Open **http://localhost:3000** in Chrome or Edge. Click **Create a sharing room**, then **Start sharing**. Select the screen, tab, or window you want to display.

Copy the **viewer link** and open it in another tab to test. In a public deployment, you can send that link to people on different computers.

**Important:** When running on localhost, a link containing `localhost:3000` only works on your own computer. To share with someone elsewhere, deploy the app to a public HTTPS URL.

## Deploy to the internet

This is a Node.js website, not a static-only page; the WebSocket server is used for connecting viewers to the sharer.

**Render** (example):
1. Upload this project to a GitHub repository.
2. In [Render](https://render.com/), create a new **Web Service** connected to that repository (or deploy using the included `render.yaml` blueprint).
3. Choose Node, use **Build Command** `npm install`, and **Start Command** `npm start`.
4. Use Render's HTTPS URL. Open it, create a room, start sharing, and send viewers the provided link.

Other Node.js hosts that support persistent WebSocket connections and HTTPS also work. On a custom server, run `npm start` behind an HTTPS reverse proxy and forward WebSocket upgrades. The server listens on the `PORT` environment variable (default 3000).

## How it works

- The sharer explicitly chooses a display/window in the browser. Screen capture uses `navigator.mediaDevices.getDisplayMedia({ video: ..., audio: false })`.
- A tiny WebSocket server exchanges WebRTC connection descriptions and ICE candidates. The screen video travels over an encrypted WebRTC media connection between browsers; the app server **does not receive or record the video**.
- Each room has a viewer link (`/watch/ROOM`) and a separate, private host link (`/host/ROOM#SECRET`). **Never share the host link**. Anyone who has the viewer link can watch while you share.
- One host can share to at most 40 viewers; the host establishes a separate WebRTC connection for each viewer. Bandwidth and CPU usage increase with the number of viewers; small groups are the intended use.
- Screen sharing works in secure contexts (HTTPS or localhost) on supported browsers. Desktop Chrome and Edge are recommended. Browsers always require the sharer to approve screen capture.
- STUN servers are configured for typical network conditions. Some corporate, school, or restrictive NAT networks require a **TURN relay** to work reliably. Set up TURN and add its credentials to `iceConfig` in `public/app.js` for such networks; be aware TURN traffic is relayed by your TURN server.
- Empty rooms are removed after approximately one hour. Active room state is in memory, so server restarts invalidate existing links.

## Privacy / scope

No audio track is requested or transmitted. No video is stored, uploaded to the signaling server, or recorded by this app. WebRTC negotiates peer connections using Google's public STUN servers. Viewers still have the technical ability to record what they see using their own devices. Use HTTPS for public sharing and avoid displaying sensitive information on shared screens.

## Test

```bash
npm test
```
