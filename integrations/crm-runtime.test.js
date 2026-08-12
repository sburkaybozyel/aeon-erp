import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataPath = await mkdtemp(join(tmpdir(), 'aeon-crm-runtime-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  AEON_DISABLE_LISTEN: 'true',
  AEON_ALLOW_TENANT_OVERRIDE: 'true',
  INITIAL_ADMIN_PIN: '9999',
  CRM_DATA_PATH: dataPath
});

const { default: app } = await import('../server.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

let token;

test('ERP yöneticisi aynı oturumla CRM çalışma zamanına erişir', async () => {
  const login = await request('/api/auth/login?tenant_id=aeon', { method: 'POST', body: JSON.stringify({ pin: '9999' }) });
  assert.equal(login.response.status, 200);
  token = login.body.token;
  const config = await request('/api/crm/config?tenant_id=aeon', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(config.response.status, 200);
  assert.ok(config.body.config.pipeline_stages.includes('won'));
  assert.ok(config.body.users.some(user => user.id === 'staff_manager'));
});

test('CRM firma kaydı kalıcı katmanda oluşturulup geri okunur', async () => {
  const created = await request('/api/crm/firms?tenant_id=aeon', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'AEON Runtime Test', type: 'kurumsal' })
  });
  assert.equal(created.response.status, 200);
  const firms = await request('/api/crm/firms?tenant_id=aeon', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(firms.response.status, 200);
  assert.ok(firms.body.some(firm => firm.id === created.body.id));
});

test('CRM arayüzü ana Worker statik yüzeyinden sunulur', async () => {
  const response = await fetch(`${base}/crm`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /AEON Turizm CRM/);
  assert.match(html, /\/crm-assets\/app\.js/);
});

test('misafir hedefleri ve folyo özeti personel oturumu olmadan güvenli alanlarla çalışır', async () => {
  const targets = await request('/api/guest/targets?tenant_id=aeon');
  assert.equal(targets.response.status, 200);
  assert.ok(targets.body.rooms.length > 0);
  const folio = await request(`/api/guest/folio?tenant_id=aeon&target=${encodeURIComponent(`Room-${targets.body.rooms[0]}`)}`);
  assert.equal(folio.response.status, 200);
  assert.deepEqual(Object.keys(folio.body.room).sort(), ['id', 'room_number', 'status']);
});

test('sistem sağlık sözleşmesi ERP ve CRM veri katmanlarını raporlar', async () => {
  const health = await request('/api/system/health?tenant_id=aeon');
  assert.equal(health.response.status, 200, JSON.stringify(health.body));
  assert.equal(health.body.ok, true);
  assert.ok(health.body.databases.erp.rooms > 0);
  assert.equal(health.body.databases.crm.schema_version, '1');
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(dataPath, { recursive: true, force: true });
});
