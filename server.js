import express from 'express';
import { getDb, commitDb } from './db.js';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';

// Import Pluggable Modules
import { initDining } from './modules/dining.js';
import { initStay } from './modules/stay.js';
import { initMarina } from './modules/marina.js';
import { initReception } from './modules/reception.js';
import { initHotelRunner } from './modules/hotelrunner.js';
import { initBar } from './modules/bar.js';
import { initPrinting } from './modules/printing.js';

import {
  isCloudflareWorker, __dirname, publicDir, PORT, isHostedRuntime,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
} from './server-config.js';
import { eventBus, hookRegistry } from './lib/event-bus.js';
import { tenantDbResolver, resolveSession, authorizeOperation, requireDurableStorage, broadcastSSE } from './server-middleware.js';
import { registerOperationsRoutes } from './routes/operations.js';
import { registerTenantRoutes } from './routes/tenant.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerInventoryRoutes } from './routes/inventory.js';
import { getQrTarget } from './lib/qr-targets.js';

const app = express();
const roomPortalPage = '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><meta name="theme-color" content="#c29d5b"><title>Bozburun Yacht Club Portal</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#10213d}iframe{display:block}</style></head><body><iframe id="room-guest-portal" title="Bozburun Yacht Club Portal"></iframe><script>const params=new URLSearchParams(window.location.search);const tenant=params.get("tenant_id")||"aeon";const target=params.get("target")||"";const qr=params.get("qr")||"";if(!/^Room-[^&?#]+$/i.test(target))document.body.textContent="Geçersiz oda QR kodu.";else document.getElementById("room-guest-portal").src=`/guest.html?tenant_id=${encodeURIComponent(tenant)}&type=room&target=${encodeURIComponent(target)}&qr=${encodeURIComponent(qr)}&entry=room-qr`;</script></body></html>';

// Trust the first hop reverse proxy (Cloudflare/Vercel/nginx) so req.ip and
// req.secure reflect the real client instead of the proxy, which the login
// rate limiter and session cookie's `secure` flag both depend on.
if (isHostedRuntime || process.env.AEON_TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && /^(mailto:|https?:\/\/)/i.test(String(process.env.VAPID_SUBJECT || ''))) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use(express.json());
app.get('/room-qr/:code', (req, res) => {
  const target = getQrTarget(req.params.code);
  if (!target || target.type !== 'room') return res.status(404).send('Oda QR hedefi bulunamadı.');
  const params = new URLSearchParams({ tenant_id: 'aeon', target: target.target, qr: target.code });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.redirect(303, `/room-portal?${params.toString()}`);
});
app.get('/restaurant-qr/:code', (req, res) => {
  const target = getQrTarget(req.params.code);
  if (!target || target.type !== 'restaurant') return res.status(404).send('Restoran QR hedefi bulunamadı.');
  const params = new URLSearchParams({ tenant_id: 'aeon', target: target.target, qr: target.code });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.redirect(303, `/restaurant.html?${params.toString()}`);
});
app.get('/room-portal', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.type('html').send(roomPortalPage);
});
app.get('/q/:code', (req, res) => {
  const target = getQrTarget(req.params.code);
  if (!target) return res.status(404).send('QR hedefi bulunamadı.');
  res.redirect(302, `/${target.type === 'room' ? 'room-qr' : 'restaurant-qr'}/${encodeURIComponent(target.code)}`);
});
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/api', (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = payload => {
    if (!payload || typeof payload.error !== 'string') return sendJson(payload);
    const status = res.statusCode;
    const code = status === 400 ? 'validation_error'
      : status === 401 ? 'unauthorized'
        : status === 403 ? 'forbidden'
          : status === 404 ? 'not_found'
            : status === 409 ? 'conflict'
              : status === 429 ? 'rate_limited'
                : status === 503 ? 'service_unavailable'
                  : 'internal_error';
    const error = status >= 500 ? 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.' : payload.error;
    return sendJson({ ...payload, success: false, error, error_code: code });
  };
  next();
});
if (!isCloudflareWorker) {
  app.get('/css/:file', (req, res) => {
    const file = path.join(publicDir, 'css', req.params.file);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(file);
  });
  app.get('/js/*', (req, res) => {
    // Wildcard (not :file) so nested ES module imports like /js/admin/kpi.js
    // resolve too — in production the Cloudflare assets binding serves the
    // whole public/ tree natively, but this local/non-Worker path previously
    // only matched a single path segment and silently 404'd on subdirectories.
    const jsRoot = path.join(publicDir, 'js');
    const file = path.join(jsRoot, req.params[0]);
    if (!file.startsWith(jsRoot) || !fs.existsSync(file)) return res.status(404).end();
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(file);
  });
  app.get('/print-bridge/:file', (req, res) => {
    const file = path.basename(req.params.file);
    if (!['AeonPrintBridge.ps1', 'Install-AeonPrintBridge.ps1'].includes(file)) return res.status(404).end();
    res.type('text/plain').sendFile(path.join(publicDir, 'print-bridge', file));
  });
  app.get('/brands/:tenant/logo.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(path.join(publicDir, 'brands', req.params.tenant, 'logo.svg'));
  });
  app.get('/qr/:file', (req, res) => {
    const file = path.basename(req.params.file);
    if (!/^[a-z0-9_-]+\.png$/i.test(file)) return res.status(404).end();
    const asset = path.join(publicDir, 'qr', file);
    if (!fs.existsSync(asset)) return res.status(404).end();
    res.type('png').sendFile(asset);
  });
  app.use('/images', express.static(path.join(publicDir, 'images')));

  const htmlFiles = [
    'index.html', 'login.html', 'guest.html',
    'staff-reception.html', 'staff-housekeeping.html',
    'staff-restaurant.html', 'staff-kitchen.html', 'staff-bar.html',
    'staff-maintenance.html', 'staff-marina.html', 'room.html', 'room-portal.html', 'restaurant.html', 'precheckin.html', 'channel-manager.html'
  ];
  htmlFiles.forEach(file => {
    app.get(`/${file}`, (req, res) => {
      res.sendFile(path.join(publicDir, file));
    });
  });

  app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(publicDir, 'sw.js'));
  });
  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(publicDir, 'manifest.json'));
  });
  app.get('/manifest_guest.json', (req, res) => {
    res.sendFile(path.join(publicDir, 'manifest_guest.json'));
  });
} else {
  app.use(express.static(publicDir));
}

app.use('/api', tenantDbResolver);
app.use('/api', resolveSession, authorizeOperation, requireDurableStorage);

// --- INITIALIZE PLUGGABLE MODULES ---
initDining({ app, eventBus, hookRegistry, getDb, broadcastSSE });
initBar({ app, eventBus, broadcastSSE });
initPrinting({ app, eventBus, getDb, broadcastSSE });
initStay({ app, eventBus, hookRegistry, getDb, broadcastSSE });
initMarina({ app, eventBus, hookRegistry, getDb });
initReception({ app, eventBus, hookRegistry, getDb });
initHotelRunner({ app, eventBus, commitDb });

// --- CORE SYSTEM ROUTES ---
registerOperationsRoutes(app);
registerTenantRoutes(app);
registerAuditRoutes(app);
registerAuthRoutes(app);
registerStaffRoutes(app);
registerInventoryRoutes(app);

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'İşlem şu anda tamamlanamadı.' });
  res.status(500).send('İşlem şu anda tamamlanamadı.');
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  const hasExtension = path.extname(req.path) !== '';
  if (hasExtension) {
    res.status(404).end();
  } else {
    res.sendFile(path.join(publicDir, 'index.html'));
  }
});

if (!isHostedRuntime && process.env.AEON_DISABLE_LISTEN !== 'true') {
  app.listen(PORT, () => {
    console.log(`Aeon ERP Server is running on http://localhost:${PORT}`);
  });
}

export default app;
