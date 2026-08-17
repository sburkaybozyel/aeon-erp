import { D1Db } from './d1-db.js';

const connections = new Map();
const initializations = new Map();

function crmRole(actor) {
  const value = String(actor?.role || '').toLocaleLowerCase('tr-TR');
  return ['manager', 'admin', 'yönetici'].includes(value) ? 'yönetici' : 'satis';
}

async function initializeD1(tenantId) {
  const db = new D1Db(globalThis.__AEON_CRM_D1, `crm:${tenantId}`);
  let marker = null;
  try {
    marker = await db.get("SELECT value FROM config WHERE key = 'crm_schema_version'");
  } catch {}
  if (!marker) {
    const { SCHEMA, seedDefaults } = await import('./db.js');
    await db.exec(SCHEMA);
    await seedDefaults(db, { seedAdmin: true });
    await db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('crm_schema_version', '1')");
  }
  await db.exec(`CREATE TABLE IF NOT EXISTS reception_reservations (id TEXT PRIMARY KEY, reception_reservation_id TEXT NOT NULL UNIQUE, reservation_number TEXT, contact_id TEXT, status TEXT NOT NULL DEFAULT 'confirmed', check_in TEXT, check_out TEXT, room_type TEXT, room_number TEXT, total_amount REAL DEFAULT 0, currency TEXT DEFAULT 'TRY', stay_id TEXT, source TEXT, source_id TEXT, payload TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS reception_event_log (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, reception_reservation_id TEXT, contact_id TEXT, stay_id TEXT, folio_id TEXT, request_id TEXT, invoice_id TEXT, amount REAL, currency TEXT, payload TEXT, occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
  try { await db.run('ALTER TABLE reception_reservations ADD COLUMN source_id TEXT'); } catch {}
  for (const column of ['nationality TEXT', 'identity_number TEXT', 'passport_number TEXT', 'address TEXT', 'vehicle_plate TEXT', 'date_of_birth TEXT', 'last_reception_sync_at TEXT']) {
    try { await db.run(`ALTER TABLE contacts ADD COLUMN ${column}`); } catch {}
  }
  connections.set(tenantId, db);
  return db;
}

async function d1Db(tenantId) {
  if (connections.has(tenantId)) return connections.get(tenantId);
  if (initializations.has(tenantId)) return initializations.get(tenantId);
  const pending = initializeD1(tenantId).finally(() => initializations.delete(tenantId));
  initializations.set(tenantId, pending);
  return pending;
}

async function syncActor(db, actor) {
  if (!actor?.id) return;
  const email = `${String(actor.id).replace(/[^a-z0-9._-]/gi, '_')}@staff.aeon.local`;
  const existing = await db.get('SELECT id FROM users WHERE id = ?', [actor.id]);
  if (existing) {
    await db.run('UPDATE users SET name = ?, email = ?, role = ?, active = 1 WHERE id = ?', [actor.name || actor.id, email, crmRole(actor), actor.id]);
  } else {
    await db.run('INSERT INTO users (id, name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, 1)', [actor.id, actor.name || actor.id, email, 'erp-session', crmRole(actor)]);
  }
}

export async function getCrmDbForRequest(req) {
  const tenantId = req?.tenantId || process.env.CRM_TENANT_ID || 'reception';
  // Both branches must scope by tenantId: on Cloudflare (D1 configured) each tenant already gets
  // its own D1-backed namespace. Without D1 (local dev, or any non-Cloudflare deployment) we used
  // to fall back to a single shared local CRM file for every tenant, silently pooling all
  // tenants' CRM data together even though the main ERP db correctly isolates them — see
  // getCrmDb(tenantId) in ./db.js, which now keys its connection/file per tenant the same way.
  let db;
  if (globalThis.__AEON_CRM_D1) db = await d1Db(tenantId);
  else {
    const { getCrmDb } = await import('./db.js');
    db = await getCrmDb(tenantId);
  }
  await syncActor(db, req?.actor);
  return db;
}
