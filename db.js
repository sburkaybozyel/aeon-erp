import alasql from 'alasql';
import fs from 'fs';
import { AsyncDb, D1Db } from './db/async-db.js';
import { initSchema } from './db/schema.js';
import { runMigrations } from './db/migrations.js';
import { ensureDefaultRoomInventory, ensureDefaultDiningMasterData, ensureDefaultKitchenMasterData, ensureDefaultMarinaMasterData } from './db/master-data.js';
import { checkAndApplyPinMigration } from './db/pin-migration.js';
import {
  hasFirebasePersistence,
  setSimulateFirebaseFailure,
  getFirebaseRef,
  savePersistentSession,
  getPersistentSession,
  revokePersistentSession,
  acquireTenantLock,
  releaseTenantLock,
  renewTenantLock
} from './db/firebase.js';
import { hasD1Persistence, getSavePath, saveToDisk, loadFromDisk } from './db/persistence.js';
import { hashPin } from './db/hash.js';
import admin from 'firebase-admin';

// Re-export the public db.js API — every other file in the app imports these names from
// './db.js' (or '../db.js'), so the export surface must stay exactly as it was before this
// module was split into db/*.js.
export {
  hasD1Persistence,
  hasFirebasePersistence,
  setSimulateFirebaseFailure,
  getFirebaseRef,
  savePersistentSession,
  getPersistentSession,
  revokePersistentSession,
  hashPin,
  acquireTenantLock,
  releaseTenantLock,
  renewTenantLock,
  checkAndApplyPinMigration,
  initSchema
};

const connections = new Map();
const initializationPromises = new Map();

async function initializeD1Db(tenantId) {
  const db = new D1Db(globalThis.__AEON_D1, tenantId);
  const imported = await db.get("SELECT value FROM config WHERE key = 'cloudflare_d1_imported'");
  if (!imported) throw new Error('Cloudflare D1 migration is not complete.');
  connections.set(tenantId, db);
  return db;
}

async function initializeDb(tenantId) {
  const dbInstance = new alasql.Database();
  const db = new AsyncDb(dbInstance, tenantId);

  const shouldLoadRemote = admin.apps.length && tenantId !== 'test_suite_run';
  const savePath = getSavePath(tenantId);
  const isNew = shouldLoadRemote ? false : !fs.existsSync(savePath);

  db.suspendSave = true;
  await initSchema(db, tenantId);
  db.suspendSave = false;

  const loaded = !isNew ? await loadFromDisk(tenantId, dbInstance) : false;
  db.suspendSave = true;
  await runMigrations(db, tenantId);
  if (tenantId === 'aeon') {
    await ensureDefaultRoomInventory(db);
    await ensureDefaultDiningMasterData(db);
    await ensureDefaultKitchenMasterData(db);
    await ensureDefaultMarinaMasterData(db);
  }
  db.suspendSave = false;

  if (loaded) {
    await checkAndApplyPinMigration(db, tenantId);
    await saveToDisk(tenantId, dbInstance);
  } else {
    const envVersion = Number(process.env.AEON_PIN_MIGRATION_VERSION || 0);
    if (envVersion > 0) {
      db.suspendSave = true;
      await db.run("DELETE FROM config WHERE key = 'pin_migration_version'");
      await db.run("INSERT INTO config (key, value) VALUES ('pin_migration_version', ?)", [String(envVersion)]);
      db.suspendSave = false;
    }
    await saveToDisk(tenantId, dbInstance);
  }

  connections.set(tenantId, db);
  return db;
}

export async function getDb(tenantId) {
  if (connections.has(tenantId)) return connections.get(tenantId);
  if (initializationPromises.has(tenantId)) return initializationPromises.get(tenantId);
  const initialization = (hasD1Persistence() ? initializeD1Db(tenantId) : initializeDb(tenantId))
    .finally(() => initializationPromises.delete(tenantId));
  initializationPromises.set(tenantId, initialization);
  return initialization;
}

export async function refreshDb(tenantId) {
  const db = await getDb(tenantId);
  if (hasD1Persistence()) return db;
  if (!hasFirebasePersistence() || tenantId === 'test_suite_run') return db;
  const previousSuspendSave = db.suspendSave;
  db.suspendSave = true;
  try {
    const loaded = await loadFromDisk(tenantId, db.db);
    if (!loaded) {
      console.warn(`[refreshDb] Datastore not found yet for ${tenantId}, using initialized memory DB.`);
    }
    return db;
  } finally {
    db.suspendSave = previousSuspendSave;
  }
}

export async function commitDb(tenantId) {
  const db = await getDb(tenantId);
  if (hasD1Persistence()) return db;
  await saveToDisk(tenantId, db.db);
}
