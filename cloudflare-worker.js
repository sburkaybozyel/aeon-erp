import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';

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

export default httpServerHandler({ port: 3000 });
