import express from 'express';
import webpush from 'web-push';
import { getDb, commitDb } from './db.js';
import { PORT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, publicDir, crmPublicDir, shouldListen, trustProxy } from './server-config.js';
import { eventBus, hookRegistry } from './lib/event-bus.js';
import { tenantDbResolver, resolveSession, authorizeOperation, requireDurableStorage, broadcastSSE } from './server-middleware.js';
import { registerOperationsRoutes } from './routes/operations.js';
import { registerTenantRoutes } from './routes/tenant.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerInventoryRoutes } from './routes/inventory.js';
import { initDining } from './modules/dining.js';
import { initStay } from './modules/stay.js';
import { initMarina } from './modules/marina.js';
import { initBar } from './modules/bar.js';
import { initReception } from './modules/reception.js';
import { initPrinting } from './modules/printing.js';
import { initHotelRunner } from './modules/hotelrunner.js';
import { initCrmBridge } from './modules/crm_bridge.js';

const app = express();

if (trustProxy) app.set('trust proxy', 1);
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const sendJson = res.json.bind(res);
  res.json = payload => {
    if (!payload || typeof payload.error !== 'string') return sendJson(payload);
    const codes = { 400: 'validation_error', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 413: 'payload_too_large', 429: 'rate_limited', 502: 'upstream_error', 503: 'service_unavailable' };
    const status = res.statusCode;
    const error = status >= 500 ? 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.' : payload.error;
    return sendJson({ ...payload, success: false, error, error_code: payload.error_code || codes[status] || 'internal_error' });
  };
  next();
});
app.use((req, res, next) => {
  if (/\.(?:css|html|js)$/.test(req.path)) res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});
app.get(['/restaurant', '/menu', '/restaurant-menu'], (req, res) => res.sendFile(`${publicDir}/restaurant.html`));
app.get(['/guest', '/room-portal'], (req, res) => res.sendFile(`${publicDir}/guest.html`));
app.use(express.static(publicDir, { maxAge: 0 }));
app.use('/crm', express.static(crmPublicDir, { maxAge: 0 }));

app.use('/api', tenantDbResolver, resolveSession, authorizeOperation, requireDurableStorage);

registerOperationsRoutes(app);
registerTenantRoutes(app);
registerAuditRoutes(app);
registerAuthRoutes(app);
registerStaffRoutes(app);
registerInventoryRoutes(app);

const moduleContext = { app, eventBus, hookRegistry, getDb, commitDb, broadcastSSE };
initDining(moduleContext);
initStay(moduleContext);
initMarina(moduleContext);
initBar(moduleContext);
initReception(moduleContext);
initPrinting(moduleContext);
initHotelRunner(moduleContext);
initCrmBridge(moduleContext);

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return res.status(err.type === 'entity.too.large' ? 413 : 500).json({ error: 'İşlem şu anda tamamlanamadı.' });
  return res.status(500).send('İşlem şu anda tamamlanamadı.');
});

app.get('*', (req, res) => {
  return res.status(404).end();
});

if (shouldListen) app.listen(PORT, () => console.log(`AEON ERP Server is running on http://localhost:${PORT}`));

export default app;
