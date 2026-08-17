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

function assetRequest(request, runtimeEnv, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
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
