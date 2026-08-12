import { existsSync, readFileSync } from 'node:fs';

const requiredPaths = [
  'server.js',
  'server-config.js',
  'server-middleware.js',
  'cloudflare-worker.js',
  'wrangler.jsonc',
  'routes/auth.js',
  'routes/tenant.js',
  'routes/operations.js',
  'routes/staff.js',
  'routes/inventory.js',
  'routes/audit.js',
  'modules/crm.js',
  'crm/runtime-db.js',
  'crm/schema.sql',
  'public/index.html',
  'public/login.html',
  'public/guest.html',
  'public/js/guest-entry-routing.js',
  'public/crm.html',
  'public/crm-assets/style.css',
  'public/crm-assets/app.js'
];

const failures = requiredPaths.filter(path => !existsSync(path)).map(path => `required path missing: ${path}`);
const server = readFileSync('server.js', 'utf8');
const middleware = readFileSync('server-middleware.js', 'utf8');
const guest = readFileSync('public/guest.html', 'utf8');
const boot = readFileSync('public/js/boot.js', 'utf8');

for (const registration of ['registerAuthRoutes', 'registerTenantRoutes', 'registerOperationsRoutes', 'initDining', 'initStay', 'initReception', 'initHotelRunner', 'initCrmBridge', 'initCrmModule']) {
  if (!server.includes(`${registration}(`)) failures.push(`backend registration missing: ${registration}`);
}
if (server.includes("app.post('/api/system/reset'")) failures.push('legacy destructive reset route is still registered');
if (!middleware.includes('AEON_ALLOWED_TENANTS')) failures.push('tenant allowlist is not configured');
if (!middleware.includes('authorizeOperation')) failures.push('authorization middleware is missing');
if (/manifest_guest\.json|navigator\.serviceWorker\.register/.test(guest)) failures.push('guest portal enrolls into staff PWA');
if (!boot.includes('const isGuestSurface') || !boot.includes("window.aeonSessionToken = isGuestSurface ? ''")) failures.push('guest authentication isolation is missing');
if (!server.includes("app.get('/q/:code'") || !server.includes("app.get('/room-qr/:code'") || !server.includes("app.get('/restaurant-qr/:code'")) failures.push('canonical QR routes are missing');
if (!server.includes('app.get(portalAliases')) failures.push('single portal shell routing is missing');
if (!server.includes("app.get(['/crm', '/crm/']")) failures.push('CRM static surface is not registered');
if (server.includes('crmPublicDir')) failures.push('CRM still depends on a runtime filesystem path');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Canonical runtime verification passed');
