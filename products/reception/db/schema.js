import { CORE_SCHEMA_SQL } from './schema-sql.js';
import { ensureReceptionSchema } from './migrations.js';
import { seedDefaultStaff, hashUnhashedPins, ensureDefaultDiningMasterData, ensureDefaultKitchenMasterData, ensureDefaultMarinaMasterData } from './master-data.js';
import { seedTestSuiteData } from './seed-test-data.js';

export async function initSchema(db, tenantId = 'default') {
  try {
    await db.run("SELECT idempotency_key FROM idempotency_records LIMIT 0");
  } catch (e) {
    try {
      await db.run("DROP TABLE idempotency_records");
    } catch (err) {}
  }

  // Schema creation
  const schema = CORE_SCHEMA_SQL;

  await db.exec(schema);
  await ensureReceptionSchema(db);

  // Alter/Migration to ensure campaigns table and completed_at column exist for copied databases
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        discount_rate REAL NOT NULL,
        catalog_item_id TEXT NOT NULL,
        active INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id)
      );

      CREATE TABLE IF NOT EXISTS laundry_orders (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        guest_name TEXT,
        items TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        total_price REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      );

      CREATE TABLE IF NOT EXISTS lost_and_found (
        id TEXT PRIMARY KEY,
        item_name TEXT NOT NULL,
        description TEXT,
        found_location TEXT,
        status TEXT DEFAULT 'found',
        found_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        claimed_at TIMESTAMP,
        reported_by TEXT
      );
    `);
  } catch (e) {
    console.error("Migration error creating premium tables:", e);
  }

  try {
    await db.run("ALTER TABLE requests ADD COLUMN completed_at TIMESTAMP");
  } catch (e) {
    // Column might already exist
  }

  try { await db.run("ALTER TABLE purchase_requests ADD COLUMN department TEXT DEFAULT 'General'"); } catch (e) {}
  try { await db.run("ALTER TABLE purchase_requests ADD COLUMN priority TEXT DEFAULT 'normal'"); } catch (e) {}
  try { await db.run("ALTER TABLE purchase_requests ADD COLUMN notes TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE staff ADD COLUMN pin_encrypted TEXT"); } catch (e) {}

  try {
    await db.run("ALTER TABLE requests ADD COLUMN created_by TEXT");
  } catch (e) {}

  try {
    await db.run("ALTER TABLE requests ADD COLUMN completed_by TEXT");
  } catch (e) {}

  try {
    await db.run("ALTER TABLE rooms ADD COLUMN updated_by TEXT");
  } catch (e) {}

  try {
    await db.run("ALTER TABLE rooms ADD COLUMN updated_at TIMESTAMP");
  } catch (e) {}

  try {
    await db.run("ALTER TABLE rooms ADD COLUMN vip INTEGER DEFAULT 0");
  } catch (e) {}

  try {
    await db.run("ALTER TABLE rooms ADD COLUMN late_checkout INTEGER DEFAULT 0");
  } catch (e) {}

  await seedDefaultStaff(db);
  await hashUnhashedPins(db);
  await db.run("DELETE FROM sessions WHERE staff_id = ?", ['staff_rest_manager']);
  await db.run("DELETE FROM staff WHERE id = ?", ['staff_rest_manager']);

  // Insert config based on tenant
  const isBaseTenant = tenantId === 'aeon' || tenantId === 'default'; // 'default' is always the base tenant
  const isDefaultProfile = tenantId === 'default_profile';
  const isSecondaryProfile = tenantId === 'secondary_profile';
  const isMarinaProfile = tenantId === 'marina_profile';
  const isYachtProfile = tenantId === 'yacht_profile';

  const moduleId = String(process.env.MODULE_ID || '');
  const diningVal = moduleId === 'restaurant-kitchen' ? 'true' : 'false';
  const stayVal = 'true';
  const cruiseVal = 'false';

  await db.run("DELETE FROM config WHERE key = 'MODULE_DINING'");
  await db.run("INSERT INTO config (key, value) VALUES ('MODULE_DINING', ?)", [diningVal]);
  await db.run("DELETE FROM config WHERE key = 'MODULE_BAR'");
  await db.run("INSERT INTO config (key, value) VALUES ('MODULE_BAR', 'false')");
  await db.run("DELETE FROM config WHERE key = 'MODULE_STAY'");
  await db.run("INSERT INTO config (key, value) VALUES ('MODULE_STAY', ?)", [stayVal]);
  await db.run("DELETE FROM config WHERE key = 'MODULE_CRUISE'");
  await db.run("INSERT INTO config (key, value) VALUES ('MODULE_CRUISE', ?)", [cruiseVal]);
  await db.run("DELETE FROM config WHERE key = 'MODULE_PRINTER'");
  await db.run("INSERT INTO config (key, value) VALUES ('MODULE_PRINTER', 'false')");

  if (isBaseTenant) await ensureDefaultDiningMasterData(db);
  if (isBaseTenant) await ensureDefaultKitchenMasterData(db);
  if (isBaseTenant) await ensureDefaultMarinaMasterData(db);

  const shouldSeedOperationalData = tenantId === 'test_suite_run';
  if (!shouldSeedOperationalData) return;

  await seedTestSuiteData(db, tenantId);
}
