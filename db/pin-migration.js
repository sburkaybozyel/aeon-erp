import crypto from 'crypto';
import { acquireTenantLock, releaseTenantLock } from './firebase.js';
import { loadFromDisk, saveToDisk } from './persistence.js';
import { hashPin } from './hash.js';

export async function checkAndApplyPinMigration(db, tenantId) {
  const envVersion = Number(process.env.AEON_PIN_MIGRATION_VERSION || 0);
  if (!envVersion) return;

  // Read current version from database config
  let currentVersion = 0;
  try {
    const row = await db.get("SELECT value FROM config WHERE key = 'pin_migration_version'");
    if (row) currentVersion = Number(row.value || 0);
  } catch (e) {
    // Config table might not exist yet or key not found
  }

  if (envVersion > currentVersion) {
    const lockOwner = crypto.randomUUID();
    let lockAcquired = false;
    try {
      lockAcquired = await acquireTenantLock(tenantId, lockOwner);
      if (!lockAcquired) {
        console.warn(`[Migration] Lock busy for tenant ${tenantId}, skipping/retrying migration.`);
        return;
      }

      // Refresh to ensure we have the absolute latest state
      await loadFromDisk(tenantId, db.db);

      // Double check version again after refresh
      let freshVersion = 0;
      try {
        const row = await db.get("SELECT value FROM config WHERE key = 'pin_migration_version'");
        if (row) freshVersion = Number(row.value || 0);
      } catch (e) {}

      if (envVersion > freshVersion) {
        console.log(`[Migration] Running PIN migration version ${envVersion} for tenant ${tenantId}...`);

        if (process.env.INITIAL_RECEPTION_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_RECEPTION_PIN), 'staff_reception']);
        }
        if (process.env.INITIAL_ADMIN_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_ADMIN_PIN), 'staff_manager']);
        }
        if (process.env.INITIAL_HOUSEKEEPING_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_HOUSEKEEPING_PIN), 'staff_ahmet']);
        }
        if (process.env.INITIAL_RESTAURANT_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_RESTAURANT_PIN), 'staff_mehmet']);
        }
        if (process.env.INITIAL_KITCHEN_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_KITCHEN_PIN), 'staff_can']);
        }
        if (process.env.INITIAL_MAINTENANCE_PIN) {
          await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(process.env.INITIAL_MAINTENANCE_PIN), 'staff_veli']);
        }

        // Write the version to config table
        await db.run("DELETE FROM config WHERE key = 'pin_migration_version'");
        await db.run("INSERT INTO config (key, value) VALUES ('pin_migration_version', ?)", [String(envVersion)]);

        // Save to disk immediately
        await saveToDisk(tenantId, db.db);
        console.log(`[Migration] PIN migration version ${envVersion} completed successfully.`);
      }
    } finally {
      if (lockAcquired) {
        await releaseTenantLock(tenantId, lockOwner);
      }
    }
  }
}
