const http = require('http');
const fs = require('fs');
const path = require('path');
const webPush = require('web-push');

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '0.0.0.0';
const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS || 15000);
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 3000);
const PUBLIC_DIR = __dirname;

const vapidKeys =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
      }
    : webPush.generateVAPIDKeys();

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@trackmate.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const heartbeats = new Map();
const watches = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function upsertWatch({ monitorId, targetId, subscription }) {
  if (!monitorId || !subscription?.endpoint) {
    throw new Error('monitorId and subscription are required');
  }

  watches.set(monitorId, {
    monitorId,
    targetId,
    subscription,
    notifiedTargets: new Set(),
    updatedAt: Date.now()
  });
}

function recordHeartbeat(payload) {
  if (!payload.peerId) throw new Error('peerId is required');

  const peerId = String(payload.peerId).toUpperCase();
  heartbeats.set(peerId, {
    peerId,
    connectedTo: payload.connectedTo || null,
    locationShared: Boolean(payload.locationShared),
    lat: Number.isFinite(payload.lat) ? payload.lat : null,
    lng: Number.isFinite(payload.lng) ? payload.lng : null,
    receivedAt: Date.now()
  });

  for (const watch of watches.values()) {
    if (watch.targetId === peerId) {
      watch.notifiedTargets.delete(peerId);
    }
  }
}

async function notifyHeartbeatLost(watch, heartbeat) {
  const peerId = watch.targetId;
  if (!peerId || watch.notifiedTargets.has(peerId)) return;

  watch.notifiedTargets.add(peerId);
  await webPush.sendNotification(
    watch.subscription,
    JSON.stringify({
      title: 'TrackMate Heartbeat Lost',
      body: `User B (${peerId}) tidak mengirim heartbeat. Periksa perangkat User B.`,
      tag: `trackmate-heartbeat-${peerId}`,
      url: './trackmate.html',
      lastSeenAt: heartbeat?.receivedAt || null
    })
  );
}

async function checkHeartbeats() {
  const now = Date.now();

  for (const watch of watches.values()) {
    if (!watch.targetId) continue;

    const peerId = watch.targetId;
    const heartbeat = heartbeats.get(peerId);
    const isExpired = !heartbeat || now - heartbeat.receivedAt > HEARTBEAT_TIMEOUT_MS;

    if (!isExpired) continue;

    try {
      await notifyHeartbeatLost(watch, heartbeat);
    } catch (err) {
      console.warn(`Push failed for monitor ${watch.monitorId}:`, err.statusCode || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        watches.delete(watch.monitorId);
      }
    }
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === '/' ? '/trackmate.html' : requestUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, file) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': pathname === '/sw.js' ? 'no-cache' : 'public, max-age=60'
    });
    res.end(file);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/push/public-key') {
      sendJson(res, 200, { publicKey: vapidKeys.publicKey });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/push/subscribe') {
      const body = await readBody(req);
      upsertWatch({
        monitorId: String(body.monitorId || ''),
        targetId: body.targetId ? String(body.targetId).toUpperCase() : null,
        subscription: body.subscription
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/heartbeat') {
      const body = await readBody(req);
      recordHeartbeat(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        watches: watches.size,
        heartbeats: heartbeats.size,
        heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS
      });
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

setInterval(checkHeartbeats, CHECK_INTERVAL_MS);

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`TrackMate running at http://${displayHost}:${PORT}/trackmate.html`);
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('Using temporary VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for production.');
  }
});
