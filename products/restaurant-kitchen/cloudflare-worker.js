import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { getBridgeOutboxSummary, flushOutbox } from './modules/reception-bridge.js';
import { getQrTarget } from './lib/qr-targets.js';

process.env.CLOUDFLARE_WORKER = '1';
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
globalThis.__MODULE_D1 = env.DB;
globalThis.__RECEPTION_SERVICE = env.RECEPTION_SERVICE;

const { getDb } = await import('./db.js');
const nodeVersion = process.versions?.node;
if (process.versions) delete process.versions.node;
const { default: app } = await import('./server.js');
if (nodeVersion && process.versions) process.versions.node = nodeVersion;
app.listen(3000);

const appHandler = httpServerHandler({ port: 3000 });
const pageAliases = new Map([
  ['/', '/login.html'],
  ['/restaurant', '/guest.html'],
  ['/restaurant/', '/guest.html'],
  ['/menu', '/guest.html'],
  ['/menu/', '/guest.html'],
  ['/room', '/guest.html'],
  ['/room/', '/guest.html'],
  ['/guest', '/guest.html'],
  ['/guest/', '/guest.html'],
  ['/restaurant-staff', '/staff-restaurant.html'],
  ['/kitchen', '/staff-kitchen.html'],
  ['/kitchen/', '/staff-kitchen.html']
]);

function assetRequest(request, runtimeEnv, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
}

function moduleAuthorized(request, runtimeEnv) {
  const expected = String(runtimeEnv.RECEPTION_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-module-token') || '').trim();
  return Boolean(expected && received && expected === received);
}

async function handleAdminOverview(request, runtimeEnv) {
  if (!moduleAuthorized(request, runtimeEnv)) return new Response(JSON.stringify({ error: 'Modül bağlantı yetkisi geçersiz.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'restaurant_kitchen');
    const [orders, tables, kitchen, bar, menu, outbox] = await Promise.all([
      db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status NOT IN ('completed', 'paid', 'cancelled', 'rejected') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status IN ('ready', 'served') THEN 1 ELSE 0 END) AS ready FROM requests WHERE type = 'order'"),
      db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status <> 'empty' THEN 1 ELSE 0 END) AS open FROM tables"),
      db.get("SELECT SUM(CASE WHEN l.status IN ('pending', 'accepted', 'preparing') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN l.status = 'ready' THEN 1 ELSE 0 END) AS ready FROM kitchen_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE r.status NOT IN ('completed', 'paid', 'cancelled', 'rejected')"),
      db.get("SELECT SUM(CASE WHEN l.status IN ('pending', 'accepted', 'preparing') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN l.status = 'ready' THEN 1 ELSE 0 END) AS ready FROM bar_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE r.status NOT IN ('completed', 'paid', 'cancelled', 'rejected')"),
      db.get("SELECT SUM(CASE WHEN in_stock = 0 THEN 1 ELSE 0 END) AS unavailable, COUNT(*) AS total FROM catalog_items"),
      getBridgeOutboxSummary(db)
    ]);
    return new Response(JSON.stringify({ success: true, generated_at: new Date().toISOString(), module: 'restaurant-kitchen', orders: { total: Number(orders?.total || 0), open: Number(orders?.open || 0), ready: Number(orders?.ready || 0) }, tables: { total: Number(tables?.total || 0), open: Number(tables?.open || 0) }, kitchen: { active: Number(kitchen?.active || 0), ready: Number(kitchen?.ready || 0) }, bar: { active: Number(bar?.active || 0), ready: Number(bar?.ready || 0) }, menu: { total: Number(menu?.total || 0), unavailable: Number(menu?.unavailable || 0) }, outbox }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Restoran özeti oluşturulamadı.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export default {
  async scheduled(controller, runtimeEnv, context) {
    try {
      const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'restaurant_kitchen');
      await flushOutbox(db);
    } catch (error) {
      console.error('[restaurant→reception] scheduled retry:', error.message);
    }
  },
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
    const qrMatch = url.pathname.match(/^\/(?:q|room-qr|restaurant-qr)\/([^/]+)$/i);
    if ((request.method === 'GET' || request.method === 'HEAD') && qrMatch) {
      const target = getQrTarget(decodeURIComponent(qrMatch[1]));
      if (!target) return new Response('QR bulunamadı.', { status: 404 });
      const portal = target.type === 'room' ? '/room' : '/restaurant';
      const destination = new URL(portal, url.origin);
      destination.searchParams.set('type', target.type);
      destination.searchParams.set('target', target.target);
      destination.searchParams.set('tenant_id', process.env.MODULE_DEFAULT_TENANT || 'restaurant_kitchen');
      return Response.redirect(destination.toString(), 302);
    }
    if (request.method === 'GET' && url.pathname === '/api/module/admin/overview') return handleAdminOverview(request, runtimeEnv);
    if (request.method === 'GET' || request.method === 'HEAD') {
      const page = pageAliases.get(url.pathname);
      if (page) return assetRequest(request, runtimeEnv, page);
      if (!url.pathname.startsWith('/api/')) {
        const asset = await runtimeEnv.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }
    }
    return appHandler.fetch(request, runtimeEnv, context);
  }
};
