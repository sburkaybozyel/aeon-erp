import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { getQrTarget, qrTargets } from './lib/qr-targets.js';

process.env.CLOUDFLARE_WORKER = '1';
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
globalThis.__AEON_D1 = env.AEON_DB;
globalThis.__AEON_CRM_D1 = env.AEON_CRM_DB;
const nodeVersion = process.versions?.node;
if (process.versions) delete process.versions.node;
const { default: app } = await import('./server.js');
if (nodeVersion && process.versions) process.versions.node = nodeVersion;
app.listen(3000);

const appHandler = httpServerHandler({ port: 3000 });
const portalPaths = new Set(['/restaurant', '/restaurant/', '/restaurant.html', '/menu', '/menu/', '/menu.html', '/restaurant-menu', '/restaurant-menu/', '/room', '/room/', '/room.html', '/room-portal', '/room-portal/', '/room-portal.html', '/guest', '/guest/', '/guest.html']);

function redirectForTarget(target) {
  const params = new URLSearchParams({ tenant_id: 'aeon', type: target.type, target: target.target, qr: target.code });
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/${target.type === 'room' ? 'room' : 'restaurant'}?${params.toString()}`,
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/qr-health') {
        return Response.json({
          ok: true,
          total: qrTargets.length,
          rooms: qrTargets.filter(target => target.type === 'room').length,
          restaurants: qrTargets.filter(target => target.type === 'restaurant').length
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
      const qrMatch = url.pathname.match(/^\/(q|room-qr|restaurant-qr)\/([^/]+)$/);
      if (qrMatch) {
        const target = getQrTarget(decodeURIComponent(qrMatch[2]));
        const expectedType = qrMatch[1] === 'room-qr' ? 'room' : qrMatch[1] === 'restaurant-qr' ? 'restaurant' : '';
        if (!target || (expectedType && target.type !== expectedType)) return new Response('QR hedefi bulunamadı.', { status: 404 });
        return redirectForTarget(target);
      }
      if (portalPaths.has(url.pathname)) {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = '/guest.html';
        return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
      }
    }
    return appHandler.fetch(request, runtimeEnv, context);
  }
};
