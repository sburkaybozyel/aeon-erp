import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AEON_DISABLE_LISTEN = 'true';
const { default: app } = await import('../server.js?public-portal-isolation');

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

test.after(() => new Promise(resolve => server.close(resolve)));

test('customer restaurant aliases always serve the public menu shell', async () => {
  for (const pathname of ['/restaurant', '/menu', '/restaurant-menu']) {
    const response = await fetch(`${origin}${pathname}?tenant_id=aeon&target=Table-Garden%201&qr=test`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /restaurant-guest-portal/);
    assert.doesNotMatch(html, /panel-admin|Modüler Yönetici Paneli/);
  }
});

test('customer guest aliases never fall through to the ERP shell', async () => {
  const response = await fetch(`${origin}/guest?tenant_id=aeon&type=restaurant&target=Table-Garden%201`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Misafir Portalı/);
  assert.doesNotMatch(html, /panel-admin|Modüler Yönetici Paneli/);
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
});
