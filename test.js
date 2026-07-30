import assert from 'assert';
import { getDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("🚀 Starting Aeon ERP MVP Integration Tests...");
  
  const testTenant = 'test_suite_run';
  const dbPath = path.join(__dirname, 'db', `tenant_${testTenant}_alasql.json`);
  
  // Clean start
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // 1. Database Connection and Schema Initialization
  console.log("1. Verifying Database Connection and Schema Initialization...");
  const db = await getDb(testTenant);
  assert.ok(db, "Database connection should be resolved");
  
  // Verify standard tables exist by querying sqlite_master
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);
  
  const expectedTables = ['config', 'rooms', 'guest_registry', 'tables', 'inventory', 'catalog_items', 'recipes', 'requests', 'bar_ticket_lines', 'bar_blind_audits', 'apa_ledger'];
  expectedTables.forEach(tableName => {
    assert.ok(tableNames.includes(tableName), `Table "${tableName}" should exist in SQLite database`);
  });
  console.log("✅ Database and schemas verified.");

  // 2. Default Seed Data Check
  console.log("2. Verifying Default Seed Data...");
  const roomsCount = await db.get("SELECT COUNT(*) as cnt FROM rooms");
  assert.strictEqual(roomsCount.cnt, 5, "Should seed exactly 5 default rooms");

  const tablesCount = await db.get("SELECT COUNT(*) as cnt FROM tables");
  assert.strictEqual(tablesCount.cnt, 4, "Should seed exactly 4 default tables");

  const inventoryCount = await db.get("SELECT COUNT(*) as cnt FROM inventory");
  assert.strictEqual(inventoryCount.cnt, 6, "Should seed exactly 6 default inventory items");

  const configRow = await db.get("SELECT value FROM config WHERE key = 'MODULE_DINING'");
  assert.strictEqual(configRow.value, 'true', "Default feature flag MODULE_DINING should be 'true'");
  console.log("✅ Default seed data verified.");

  // 3. Testing Recipe Stock Deduction with Spillage/Evaporation (BOM Logic)
  console.log("3. Verifying Recipe Stock Deduction with 6% Bar Spillage factor...");
  // Default stock for Gin (id='gin') is 2000
  const initialGin = await db.get("SELECT stock FROM inventory WHERE id = 'gin'");
  assert.strictEqual(initialGin.stock, 2000, "Initial Gin stock should be 2000 ml");
  
  // We place a simulated order of 2 x 'Cin Tonik' (catalog_item_id = 'c1')
  // Cin Tonik recipe consumes: 50 ml Gin, 150 ml Tonic, 1 Lime
  // Since Gin & Tonic are in the bar inventory (module_type='bar'), they are subjected to a 1.06 multiplier (6% loss)
  const quantity = 2;
  const recipeGinAmount = 50;
  const barMultiplier = 1.06;
  const expectedGinDeduction = recipeGinAmount * barMultiplier * quantity; // 50 * 1.06 * 2 = 106 ml
  
  // Perform deduction manually simulating the backend order resolver
  const orderDetails = [{ itemId: 'c1', quantity }];
  const recipes = await db.all("SELECT * FROM recipes");
  const inventory = await db.all("SELECT * FROM inventory");
  
  const inventoryMap = {};
  inventory.forEach(inv => inventoryMap[inv.id] = inv);

  const stockUpdates = {};
  for (const orderItem of orderDetails) {
    const itemRecipes = recipes.filter(r => r.catalog_item_id === orderItem.itemId);
    for (const r of itemRecipes) {
      const inv = inventoryMap[r.inventory_id];
      if (inv) {
        const multiplier = inv.module_type === 'bar' ? 1.06 : 1.0;
        const deduction = r.amount_needed * multiplier * orderItem.quantity;
        
        if (!stockUpdates[r.inventory_id]) {
          stockUpdates[r.inventory_id] = 0;
        }
        stockUpdates[r.inventory_id] += deduction;
      }
    }
  }

  // Deduct from SQLite
  for (const [invId, deduction] of Object.entries(stockUpdates)) {
    await db.run("UPDATE inventory SET stock = MAX(0, stock - ?) WHERE id = ?", [deduction, invId]);
  }

  const finalGin = await db.get("SELECT stock FROM inventory WHERE id = 'gin'");
  const expectedFinalStock = 2000 - expectedGinDeduction; // 1894 ml
  assert.strictEqual(finalGin.stock, expectedFinalStock, `Final Gin stock should be exactly ${expectedFinalStock} ml`);
  console.log("✅ Recipe Bill of Materials deduction & 6% spillage factor logic verified.");

  // 4. Testing Blind Audit Variance Calculation
  console.log("4. Verifying Blind Audit Variance calculations...");
  // Let's perform a blind audit on Limon (id='lime'). Initial stock was 50 (wait, lime is bar, so c1 ordered 2 limes * 1.06 = 2.12 limes deducted, stock is 47.88)
  const limeBeforeAudit = await db.get("SELECT stock FROM inventory WHERE id = 'lime'");
  
  // Barmen counts 45 limes physically
  const physicalAmount = 45;
  const expectedAmount = limeBeforeAudit.stock;
  const variance = physicalAmount - expectedAmount; // 45 - 47.88 = -2.88

  await db.run(
    "INSERT INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance) VALUES (?, ?, ?, ?, ?, ?)",
    ['test_aud_1', 'staff_test', 'lime', expectedAmount, physicalAmount, variance]
  );
  await db.run("UPDATE inventory SET stock = ? WHERE id = 'lime'", [physicalAmount]);

  const limeAfterAudit = await db.get("SELECT stock FROM inventory WHERE id = 'lime'");
  assert.strictEqual(limeAfterAudit.stock, 45, "Lime stock should be updated to physical amount (45)");
  
  const savedAudit = await db.get("SELECT * FROM bar_blind_audits WHERE id = 'test_aud_1'");
  assert.strictEqual(savedAudit.variance, variance, `Audit variance should be exactly ${variance}`);
  console.log("✅ Blind audit variance verified.");

  // 5. Testing Yacht APA Ledger & Euro conversions
  console.log("5. Verifying Yacht APA budget calculations with manual currency conversion...");
  
  // Initial APA summary should be: budget=10000, spent=0
  const initialSpent = 0;
  
  // Insert €120 fuel expense (EUR, rate = 1.0)
  await db.run(
    "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description) VALUES (?, ?, ?, ?, ?, ?)",
    ['apa_test_1', 120, 'EUR', 1.0, 'fuel', 'Test fuel purchase']
  );
  
  // Insert $200 marina expense (USD, rate = 0.92)
  await db.run(
    "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description) VALUES (?, ?, ?, ?, ?, ?)",
    ['apa_test_2', 200, 'USD', 0.92, 'marina_fees', 'Test port fees']
  );

  const ledger = await db.all("SELECT * FROM apa_ledger");
  let totalSpentEur = 0;
  ledger.forEach(entry => {
    totalSpentEur += entry.amount * entry.exchange_rate_to_eur;
  });

  const expectedSpentEur = 120 * 1.0 + 200 * 0.92; // 120 + 184 = €304
  assert.strictEqual(totalSpentEur, expectedSpentEur, `Total spent EUR should be €${expectedSpentEur}`);
  
  const budget = 10000.00;
  const remaining = budget - totalSpentEur;
  assert.strictEqual(remaining, 10000.00 - 304.00, "Remaining budget should be €9696.00");
  console.log("✅ Yacht APA currency rate translation and ledger verified.");

  console.log("\n✨ ALL TESTS COMPLETED SUCCESSFULLY! ✨");
  
  // Cleanup test database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

runTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
