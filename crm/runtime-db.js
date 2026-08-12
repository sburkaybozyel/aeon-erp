import { D1Db } from '../db/async-db.js';
import { getCrmDb as getLocalCrmDb, SCHEMA, seedDefaults } from './db.js';

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
    await db.exec(SCHEMA);
    await seedDefaults(db, { seedAdmin: false });
    await db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('crm_schema_version', '1')");
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
  const db = globalThis.__AEON_CRM_D1 ? await d1Db(req?.tenantId || 'aeon') : await getLocalCrmDb();
  await syncActor(db, req?.actor);
  return db;
}
