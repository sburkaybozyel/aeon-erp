import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { hasFirebasePersistence, getFirebaseRef } from './firebase.js';

const isCloudflareWorker = process.env.CLOUDFLARE_WORKER === '1';
const __dirname = isCloudflareWorker ? '/' : dirname(fileURLToPath(import.meta.url));
const isEphemeralRuntime = isCloudflareWorker;
// This file lives in <repo>/db, so the repo root is one level up.
const repoRoot = isCloudflareWorker ? __dirname : join(__dirname, '..');
const dbDir = isEphemeralRuntime ? join('/tmp', 'db') : join(repoRoot, 'db');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export function hasD1Persistence() {
  return Boolean(globalThis.__AEON_D1);
}

export function getSavePath(tenantId) {
  if (tenantId === 'aeon') {
    let aeonDir = process.env.AEON_DATA_PATH || join(repoRoot, 'aeon');
    if (isEphemeralRuntime) aeonDir = join('/tmp', 'aeon');
    if (!fs.existsSync(aeonDir)) {
      fs.mkdirSync(aeonDir, { recursive: true });
    }
    return join(aeonDir, 'db_alasql.json');
  } else {
    return join(dbDir, `tenant_${tenantId}_alasql.json`);
  }
}

export const SAVE_TABLES = ['config', 'rooms', 'guest_registry', 'tables', 'inventory', 'catalog_items', 'recipes', 'purchase_requests', 'requests', 'bar_blind_audits', 'bar_ticket_lines', 'apa_ledger', 'campaigns', 'staff', 'sessions', 'idempotency_records', 'push_subscriptions', 'audit_logs', 'laundry_orders', 'lost_and_found', 'inventory_receipts', 'inventory_receipt_items', 'folios', 'registrations', 'pms_migrations', 'guest_profiles', 'reservations', 'reservation_guests', 'room_assignments', 'stays', 'stay_guests', 'folio_transactions', 'payments', 'invoices', 'invoice_items', 'cash_shifts', 'reception_tasks', 'identity_notifications', 'documents_metadata', 'audit_events', 'room_status_history', 'room_blocks', 'night_audits', 'guest_precheckins', 'guest_precheckin_submissions', 'channel_connections', 'channel_room_mappings', 'channel_reservation_events', 'channel_reservation_links', 'channel_sync_operations', 'channel_notifications', 'channel_cache', 'kitchen_stations', 'menu_kitchen_profiles', 'kitchen_ticket_lines', 'inventory_lots', 'kitchen_waste_logs', 'kitchen_temperature_logs', 'kitchen_stock_counts', 'kitchen_stock_count_lines', 'technical_assets', 'technical_work_orders', 'technical_work_order_parts', 'technical_maintenance_plans', 'technical_meter_readings', 'housekeeping_inspections', 'housekeeping_linen_counts', 'public_areas'];

// Concurrent requests share one in-memory alasql instance per tenant, so two overlapping
// saves used to race on the actual persistence I/O (especially the awaited Firebase `set()`
// call): whichever write finished last on the wire won, even if it had captured an older
// snapshot, silently reverting a newer commit. Chaining every save for a tenant onto a single
// promise queue forces persistence to happen strictly in call order, so the last save queued
// is always the last (and therefore winning) write.
const saveQueues = new Map();

function queueSave(tenantId, task) {
  const prior = saveQueues.get(tenantId) || Promise.resolve();
  const chained = prior.then(task, task);
  // Keep the queue alive even if a save fails, but still let this call's own rejection propagate.
  saveQueues.set(tenantId, chained.catch(() => {}));
  return chained;
}

export async function saveToDisk(tenantId, dbInstance) {
  if (hasD1Persistence()) return;
  return queueSave(tenantId, () => persistDump(tenantId, dbInstance));
}

async function persistDump(tenantId, dbInstance) {
  const dump = {};
  for (const table of SAVE_TABLES) {
    try {
      const data = dbInstance.exec(`SELECT * FROM [${table}]`);
      dump[table] = data;
    } catch (e) {
      // Table might not exist yet
    }
  }

  const isTest = tenantId === 'test_suite_run';
  if (hasFirebasePersistence() && !isTest) {
    try {
      const cleanDump = JSON.parse(JSON.stringify(dump));
      await getFirebaseRef(tenantId, 'tenant').set({
        updatedAt: new Date().toISOString(),
        ...cleanDump
      });
    } catch (err) {
      console.error("Failed to save to Firebase Realtime Database:", err);
      throw err;
    }
  } else {
    // Fallback local file — write to a temp file and rename into place so a crash/kill mid-write
    // can never leave a truncated/corrupt JSON file behind (rename is atomic on the same filesystem).
    const savePath = getSavePath(tenantId);
    const tmpPath = `${savePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(dump, null, 2), 'utf8');
    fs.renameSync(tmpPath, savePath);
  }
}

export async function loadFromDisk(tenantId, dbInstance) {
  const isTest = tenantId === 'test_suite_run';
  if (hasFirebasePersistence() && !isTest) {
    try {
      const snapshot = await getFirebaseRef(tenantId, 'tenant').get();
      if (!snapshot.exists()) {
        return false;
      }
      const dump = snapshot.val();
      // Remove metadata keys
      delete dump.updatedAt;

      for (const [table, rows] of Object.entries(dump)) {
        try {
          dbInstance.exec(`DELETE FROM [${table}]`);
        } catch (e) {
          continue;
        }
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => '?').join(', ');
            const values = Object.values(row);
            const sql = `INSERT INTO [${table}] (${keys.map(k => `[${k}]`).join(', ')}) VALUES (${placeholders})`;
            dbInstance.exec(sql, values);
          }
        }
      }
      return true;
    } catch (err) {
      console.error("Failed to load from Firebase Realtime Database:", err);
      throw err;
    }
  } else {
    // Fallback local file
    const savePath = getSavePath(tenantId);
    if (!fs.existsSync(savePath)) {
      return false;
    }
    try {
      const raw = fs.readFileSync(savePath, 'utf8');
      const dump = JSON.parse(raw);
      for (const [table, rows] of Object.entries(dump)) {
        try {
          dbInstance.exec(`DELETE FROM [${table}]`);
        } catch (e) {
          continue;
        }
        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(row);
          const sql = `INSERT INTO [${table}] (${keys.map(k => `[${k}]`).join(', ')}) VALUES (${placeholders})`;
          dbInstance.exec(sql, values);
        }
      }
      return true;
    } catch (e) {
      console.error("Error loading AlaSQL from disk:", e);
      throw e;
    }
  }
}

export async function loadFirebaseDumpToD1(tenantId, db) {
  if (!hasFirebasePersistence()) throw new Error('Firebase source persistence is unavailable.');
  const snapshot = await getFirebaseRef(tenantId, 'tenant').get();
  if (!snapshot.exists()) throw new Error(`Firebase source data is unavailable for ${tenantId}.`);
  const dump = snapshot.val() || {};
  delete dump.updatedAt;
  for (const [table, rows] of Object.entries(dump)) {
    try {
      await db.exec(`DELETE FROM [${table}]`);
    } catch {
      continue;
    }
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const keys = Object.keys(row);
      if (!keys.length) continue;
      const placeholders = keys.map(() => '?').join(', ');
      await db.run(`INSERT OR IGNORE INTO [${table}] (${keys.map(key => `[${key}]`).join(', ')}) VALUES (${placeholders})`, Object.values(row));
    }
  }
}
