import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolvePortalEntry } from '../public/js/guest-entry-routing.js';

process.env.AEON_DISABLE_LISTEN = 'true';
const { default: app } = await import('../server.js?public-portal-isolation');

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const cloudflareWorkerSource = await readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');

test.after(() => new Promise(resolve => server.close(resolve)));

test('customer restaurant aliases always serve the public menu shell', async () => {
  for (const pathname of ['/restaurant', '/restaurant.html', '/menu', '/menu.html', '/restaurant-menu', '/restaurant-menu/']) {
    const response = await fetch(`${origin}${pathname}?tenant_id=aeon&target=Table-Garden%201&qr=test`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /id="guest-target-select"/);
    assert.doesNotMatch(html, /window\.location\.(?:replace|assign)|<iframe/i);
    assert.doesNotMatch(html, /panel-admin|Modüler Yönetici Paneli/);
  }
});

test('room aliases use the same single public shell without a redirect engine', async () => {
  for (const pathname of ['/room', '/room.html', '/room-portal', '/room-portal.html', '/guest', '/guest.html']) {
    const response = await fetch(`${origin}${pathname}?tenant_id=aeon&target=Room-1`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /id="guest-target-select"/);
    assert.doesNotMatch(html, /window\.location\.(?:replace|assign)|<iframe/i);
    assert.doesNotMatch(html, /panel-admin|Modüler Yönetici Paneli/);
  }
});

test('portal entry mode is isolated by canonical path and rejects mixed targets', () => {
  assert.deepEqual(resolvePortalEntry('/room', '?target=Room-1'), { mode: 'room', target: 'Room-1' });
  assert.deepEqual(resolvePortalEntry('/restaurant', '?target=Table-Garden%201'), { mode: 'restaurant', target: 'Table-Garden 1' });
  assert.deepEqual(resolvePortalEntry('/room', '?target=Table-Garden%201'), { mode: 'room', target: '' });
  assert.deepEqual(resolvePortalEntry('/restaurant', '?target=Room-1'), { mode: 'restaurant', target: '' });
  assert.deepEqual(resolvePortalEntry('/guest.html', '?type=restaurant&target=Table-Bar%201'), { mode: 'restaurant', target: 'Table-Bar 1' });
});

test('legacy QR routes hand off to the independent guest module', async () => {
  const independentOrigin = 'https://aeon-restaurant-kitchen.aeon-global.workers.dev';
  const cases = [
    ['/q/oda-01', '/q/oda-01'],
    ['/room-qr/oda-12', '/room-qr/oda-12'],
    ['/q/garden-01', '/q/garden-01'],
    ['/restaurant-qr/bar-qr-01', '/restaurant-qr/bar-qr-01']
  ];
  for (const [pathname, suffix] of cases) {
    const response = await fetch(`${origin}${pathname}`, { redirect: 'manual' });
    assert.equal(response.status, 303);
    const location = response.headers.get('location');
    assert.equal(location, `${independentOrigin}${suffix}`);
  }
  assert.equal((await fetch(`${origin}/restaurant-qr/oda-01`, { redirect: 'manual' })).status, 404);
  assert.equal((await fetch(`${origin}/room-qr/garden-01`, { redirect: 'manual' })).status, 404);
  const health = await (await fetch(`${origin}/qr-health`)).json();
  assert.deepEqual(health, { ok: true, total: 25, rooms: 12, restaurants: 13 });
});

test('Cloudflare QR handler uses the same independent handoff', () => {
  assert.match(cloudflareWorkerSource, /aeon-restaurant-kitchen\.aeon-global\.workers\.dev/);
  assert.match(cloudflareWorkerSource, /Location: `\$\{publicDiningOrigin\}\/\$\{path\}\//);
  assert.doesNotMatch(cloudflareWorkerSource, /Location: `\/\$\{target\.type/);
});

test('unknown public paths return 404 instead of opening ERP', async () => {
  const response = await fetch(`${origin}/customer-menu-unknown-path`);
  const html = await response.text();
  assert.equal(response.status, 404);
  assert.doesNotMatch(html, /panel-admin|Modüler Yönetici Paneli/);
});

test('guest shell has no staff PWA manifest or staff service worker enrollment', async () => {
  const response = await fetch(`${origin}/guest.html?tenant_id=aeon&type=restaurant&target=Table-Garden%201`);
  const html = await response.text();
  assert.doesNotMatch(html, /manifest_guest\.json|navigator\.serviceWorker\.register/);
  const boot = await (await fetch(`${origin}/js/boot.js`)).text();
  assert.match(boot, /const isGuestSurface/);
  assert.match(boot, /window\.aeonSessionToken = isGuestSurface \? ''/);
  assert.match(boot, /if \(isGuestSurface\) \{\s*revealPage\(\);\s*return null;/);
  assert.match(boot, /const isPublicPage = isLoginPage \|\| isPublicPortalPath\(\)/);
});
