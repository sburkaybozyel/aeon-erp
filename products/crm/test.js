// AEON Tourism CRM — fonksiyonel test paketi.
// Sunucuyu geçici bir port + izole veri dizininde başlatır, gerçek HTTP istekleriyle
// temel akışları doğrular. Reception (dış Worker) bağımlılığı, DATA_CONTRACT.md'de
// tanımlanan sözleşmeye uyan minimal bir yerel mock ile karşılanır — bu paket yalnızca
// bu ürünün (CRM) kendi davranışını test eder, Reception'ın gerçek uygulamasını değil.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const TEST_PORT = 3179;
const BASE = `http://localhost:${TEST_PORT}`;

let mockReception;
let mockPort;
let dataDir;

function startMockReception() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        const send = (code, obj) => {
          res.writeHead(code, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(obj));
        };
        if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
        if (req.method === 'POST' && req.url === '/availability') {
          return send(200, { available: true, total: 1234.5, currency: 'EUR' });
        }
        if (req.method === 'POST' && req.url === '/reservations') {
          return send(200, { erp_reservation_id: 'res_mock_1', reservation_no: 'RES-0001', status: 'confirmed' });
        }
        if (req.method === 'GET' && req.url?.startsWith('/reservations/')) {
          return send(200, { status: 'checked_out', reservation_no: 'RES-0001', stay: null });
        }
        if (req.method === 'POST' && req.url === '/guests/upsert') return send(200, { success: true });
        send(404, { error: 'not_found' });
      });
    });
    server.listen(0, () => resolve(server));
  });
}

async function api(p, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  mockReception = await startMockReception();
  mockPort = mockReception.address().port;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeon-crm-test-'));

  process.env.CRM_PORT = String(TEST_PORT);
  process.env.CRM_DATA_PATH = dataDir;
  process.env.RECEPTION_MODULE_URL = `http://localhost:${mockPort}`;
  process.env.CRM_ADMIN_EMAIL = 'admin@aeon.local';
  process.env.CRM_ADMIN_PASSWORD = 'admin123';

  // server.js side-effects (app.listen) on import — env above must be set first, since
  // integration.js reads RECEPTION_MODULE_URL at module-load time.
  await import('./server.js');
  // give the listener a tick
  await new Promise(r => setTimeout(r, 100));
});

after(async () => {
  mockReception?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
  // server.js's app.listen() and the SSE heartbeat interval have no handle exposed to close
  // here, so without an explicit exit the process would hang forever after the last test.
  setTimeout(() => process.exit(0), 50);
});

let token;

test('auth: rejects wrong password', async () => {
  const r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@aeon.local', password: 'wrong' } });
  assert.equal(r.status, 401);
});

test('auth: logs in with seeded admin and returns a session token', async () => {
  const r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@aeon.local', password: 'admin123' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(r.data.token);
  assert.equal(r.data.user.role, 'yönetici');
  token = r.data.token;
});

test('auth: session endpoint reflects logged-in user', async () => {
  const r = await api('/api/auth/session', { token });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.email, 'admin@aeon.local');
});

test('401: protected route rejects requests with no token', async () => {
  const r = await api('/api/crm/firms');
  assert.equal(r.status, 401);
});

test('404: unknown /api route returns not_found', async () => {
  const r = await api('/api/crm/does-not-exist', { token });
  assert.equal(r.status, 404);
  assert.equal(r.data.error, 'not_found');
});

let firmId, contactId, oppId;

test('firms: rejects creation without a name', async () => {
  const r = await api('/api/crm/firms', { token, method: 'POST', body: {} });
  assert.equal(r.status, 400);
});

test('firms: creates a firm (core CRM entity)', async () => {
  const r = await api('/api/crm/firms', { token, method: 'POST', body: { name: 'Test Travel', type: 'acente', city: 'Muğla' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  assert.ok(r.data.id);
  firmId = r.data.id;
});

test('contacts: creates a contact under the firm', async () => {
  const r = await api('/api/crm/contacts', { token, method: 'POST', body: { firm_id: firmId, first_name: 'Ada', last_name: 'Test', email: 'ada@test.com' } });
  assert.equal(r.status, 200);
  contactId = r.data.id;
  assert.ok(contactId);
});

test('opportunities: creates an opportunity and it appears in the listing', async () => {
  const r = await api('/api/crm/opportunities', { token, method: 'POST', body: { firm_id: firmId, contact_id: contactId, title: '5 Nights Bozburun', amount: 2500, currency: 'EUR' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  oppId = r.data.id;

  const list = await api('/api/crm/opportunities', { token });
  assert.ok(list.data.some(o => o.id === oppId));
});

test('opportunities: moving to lost requires a lost_reason', async () => {
  const r = await api(`/api/crm/opportunities/${oppId}/stage`, { token, method: 'POST', body: { pipeline_stage: 'lost' } });
  assert.equal(r.status, 400);
});

test('reception integration: convert refuses a non-won opportunity', async () => {
  const r = await api(`/api/crm/integration/opportunities/${oppId}/convert`, { token, method: 'POST' });
  assert.equal(r.status, 400);
});

test('reception integration: convert 404s for an unknown opportunity', async () => {
  const r = await api('/api/crm/integration/opportunities/does-not-exist/convert', { token, method: 'POST' });
  assert.equal(r.status, 404);
});

let offerId;

test('offers: creating an offer with dates, then approving it, moves the opportunity to won', async () => {
  let r = await api('/api/crm/offers', { token, method: 'POST', body: { opportunity_id: oppId, title: 'Bozburun Package', check_in: '2026-09-10', check_out: '2026-09-16', room_type: 'rt_dlx', board_type: 'HB', guests: 2, currency: 'EUR' } });
  assert.equal(r.status, 200);
  offerId = r.data.id;

  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'sent' } });
  assert.equal(r.status, 200);
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'waiting' } });
  assert.equal(r.status, 200);
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'approved' } });
  assert.equal(r.status, 200);

  r = await api(`/api/crm/opportunities/${oppId}`, { token });
  assert.equal(r.data.pipeline_stage, 'won');
});

test('reception integration: converts a won opportunity and writes back erp_reservation_id/erp_status (DATA_CONTRACT §3.2)', async () => {
  const r = await api(`/api/crm/integration/opportunities/${oppId}/convert`, { token, method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(r.data.duplicate, false);
  assert.ok(r.data.erp_reservation_id);
  assert.ok(r.data.reservation_no);

  const opp = await api(`/api/crm/opportunities/${oppId}`, { token });
  assert.equal(opp.data.erp_reservation_id, r.data.erp_reservation_id);
  assert.equal(opp.data.erp_reservation_no, r.data.reservation_no);
  assert.equal(opp.data.integration_status, 'synced');
  assert.ok(opp.data.erp_status);
});

test('reception integration: converting the same opportunity again is idempotent (DATA_CONTRACT §3, rule 3)', async () => {
  const first = await api(`/api/crm/integration/opportunities/${oppId}/convert`, { token, method: 'POST' });
  const second = await api(`/api/crm/integration/opportunities/${oppId}/convert`, { token, method: 'POST' });
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.erp_reservation_id, first.data.erp_reservation_id);
});

test('reception integration: refresh-status pulls the reservation status back onto the opportunity', async () => {
  const r = await api(`/api/crm/integration/opportunities/${oppId}/refresh-status`, { token, method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(typeof r.data.erp_status, 'string');
});

test('reception integration: refresh-status 400s when the opportunity has no reservation yet', async () => {
  const opp = await api('/api/crm/opportunities', { token, method: 'POST', body: { title: 'No reservation yet', currency: 'EUR' } });
  const r = await api(`/api/crm/integration/opportunities/${opp.data.id}/refresh-status`, { token, method: 'POST' });
  assert.equal(r.status, 400);
});

test('reports: pipeline breakdown reflects the won opportunity', async () => {
  const r = await api('/api/crm/reports/pipeline', { token });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data.breakdown));
  assert.ok(r.data.total_opportunities >= 1);
  assert.ok(r.data.breakdown.some(x => x.pipeline_stage === 'won' && x.cnt >= 1));
});

test('reports: conversion funnel reports a win_rate between 0 and 100', async () => {
  const r = await api('/api/crm/reports/conversion', { token });
  assert.equal(r.status, 200);
  assert.ok(r.data.won >= 1);
  assert.ok(r.data.win_rate > 0 && r.data.win_rate <= 100);
});

test('reports: reconciliation compares CRM amount vs ERP amount for converted opportunities', async () => {
  const r = await api('/api/crm/reports/reconciliation', { token });
  assert.equal(r.status, 200);
  assert.ok(r.data.count >= 1);
  assert.equal(typeof r.data.difference, 'number');
});
