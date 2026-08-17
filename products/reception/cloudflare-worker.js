import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';

process.env.CLOUDFLARE_WORKER = '1';
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
globalThis.__MODULE_D1 = env.DB;

const nodeVersion = process.versions?.node;
if (process.versions) delete process.versions.node;
const { default: app } = await import('./server.js');
if (nodeVersion && process.versions) process.versions.node = nodeVersion;
app.listen(3000);

const appHandler = httpServerHandler({ port: 3000 });
const pageAliases = new Map([
  ['/', '/login.html'],
  ['/reception', '/staff-reception.html'],
  ['/reception/', '/staff-reception.html'],
  ['/precheckin', '/precheckin.html'],
  ['/precheckin/', '/precheckin.html']
]);

const bridgeRequestTypes = new Set([
  'waiter_call',
  'bill_call',
  'room_service_call',
  'towel_request',
  'cleaning_request',
  'linen_request',
  'amenity_request',
  'maintenance_request',
  'water_request',
  'transport_request',
  'room_dnd_change'
]);

function bridgeJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function handleModuleGuestRequest(request, runtimeEnv) {
  const expected = String(runtimeEnv.RECEPTION_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-module-token') || '').trim();
  if (!expected || !received || expected !== received) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400);
  }

  const type = String(body?.type || '').trim();
  if (!bridgeRequestTypes.has(type)) return bridgeJson({ error: 'Bu istek resepsiyon modülünde desteklenmiyor.' }, 400);

  const rawTarget = String(body?.target_identifier || '').trim();
  let target = null;
  if (rawTarget.startsWith('Room-')) {
    const requested = rawTarget.slice('Room-'.length).trim();
    const exact = await runtimeEnv.DB.prepare('SELECT room_number FROM rooms WHERE room_number = ?').bind(requested).first();
    if (exact) target = `Room-${exact.room_number}`;
    if (!target) {
      const number = requested.match(/^\d+/)?.[0];
      if (number) {
        const room = await runtimeEnv.DB.prepare('SELECT room_number FROM rooms WHERE room_number LIKE ?').bind(`${number} %`).first();
        if (room) target = `Room-${room.room_number}`;
      }
    }
  } else if (rawTarget.startsWith('Table-')) {
    const requested = rawTarget.slice('Table-'.length).trim();
    const exact = await runtimeEnv.DB.prepare('SELECT table_number FROM tables WHERE table_number = ?').bind(requested).first();
    if (exact) target = `Table-${exact.table_number}`;
    if (!target) {
      const number = requested.match(/\d+/)?.[0];
      if (number) {
        const table = await runtimeEnv.DB.prepare('SELECT table_number FROM tables WHERE table_number LIKE ?').bind(`%${number}`).first();
        if (table) target = `Table-${table.table_number}`;
      }
    }
  }
  if (!target) return bridgeJson({ error: 'Geçerli oda veya masa hedefi bulunamadı.' }, 404);

  const requestId = String(body?.request_id || body?.requestId || '').trim() || `req_${crypto.randomUUID()}`;
  if (requestId.length > 120) return bridgeJson({ error: 'İstek kimliği çok uzun.' }, 400);
  const existing = await runtimeEnv.DB.prepare('SELECT id, total_amount, payment_method FROM requests WHERE id = ?').bind(requestId).first();
  if (existing) return bridgeJson({ success: true, requestId: existing.id, totalAmount: Number(existing.total_amount || 0), payment_method: existing.payment_method || null, idempotent: true });

  const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 2000) : JSON.stringify(body?.details ?? 'Misafir talebi').slice(0, 2000);
  await runtimeEnv.DB.prepare(
    "INSERT INTO requests (id, type, department, target_identifier, status, details, total_amount, payment_method, created_by) VALUES (?, ?, 'Reception', ?, 'pending', ?, 0, NULL, ?)"
  ).bind(requestId, type, target, details || 'Misafir talebi', 'Misafir QR · AEON Restaurant & Kitchen').run();

  return bridgeJson({ success: true, requestId, totalAmount: 0, payment_method: null, forwardedTo: 'reception' }, 201);
}

function assetRequest(request, runtimeEnv, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/module/guest-requests') {
      return handleModuleGuestRequest(request, runtimeEnv);
    }
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
