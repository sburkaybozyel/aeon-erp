import { AEON_CATALOG_SEED } from '../catalog-seed.js';
import { AEON_INGREDIENT_SEED, AEON_RECIPE_SEED } from '../ingredient-seed.js';
import { hashPin } from './hash.js';

export async function seedDefaultStaff(db) {
  const existing = await db.get("SELECT COUNT(*) AS cnt FROM staff");
  if (Number(existing?.cnt || 0) > 0) return;

  const defaultStaff = [
    { id: 'staff_reception', name: 'Reception', role: 'Reception', department: 'Reception', pin: hashPin(process.env.INITIAL_RECEPTION_PIN || '1234') },
    { id: 'staff_manager', name: 'Manager', role: 'Manager', department: 'Management', pin: hashPin(process.env.INITIAL_ADMIN_PIN || '9999') },
    { id: 'staff_housekeeping', name: 'Housekeeping Staff', role: 'Housekeeping', department: 'Housekeeping', pin: hashPin(process.env.INITIAL_HOUSEKEEPING_PIN || '1111') },
    { id: 'staff_waiter', name: 'Waiter', role: 'Waiter', department: 'Restaurant', pin: hashPin(process.env.INITIAL_RESTAURANT_PIN || '2222') },
    { id: 'staff_chef', name: 'Chef', role: 'Chef', department: 'Kitchen', pin: hashPin(process.env.INITIAL_KITCHEN_PIN || '3333') },
    { id: 'staff_maintenance', name: 'Maintenance', role: 'Maintenance', department: 'Maintenance', pin: hashPin(process.env.INITIAL_MAINTENANCE_PIN || '5555') }
  ];

  for (const staff of defaultStaff) {
    await db.run(
      "INSERT INTO staff (id, name, role, department, pin) VALUES (?, ?, ?, ?, ?)",
      [staff.id, staff.name, staff.role, staff.department, staff.pin]
    );
  }
}

export async function hashUnhashedPins(db) {
  const staff = await db.all("SELECT id, pin FROM staff");
  for (const person of staff) {
    if (!String(person.pin || '').startsWith('sha256:')) {
      await db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashPin(person.pin), person.id]);
    }
  }
}

export async function ensureDefaultDiningMasterData(db) {
  const [tableRow, catalogRow] = await Promise.all([db.get('SELECT COUNT(*) AS cnt FROM tables'), db.get('SELECT COUNT(*) AS cnt FROM catalog_items')]);
  if (Number(tableRow?.cnt || 0) === 0) {
    const tables = [['tbl_terrace_1','Terrace 1','Terrace'],['tbl_terrace_2','Terrace 2','Terrace'],['tbl_terrace_3','Terrace 3','Terrace'],['tbl_terrace_4','Terrace 4','Terrace'],['tbl_garden_1','Garden 1','Garden'],['tbl_garden_2','Garden 2','Garden'],['tbl_garden_3','Garden 3','Garden'],['tbl_garden_4','Garden 4','Garden'],['tbl_bar_1','Bar 1','Bar'],['tbl_bar_2','Bar 2','Bar'],['tbl_bar_3','Bar 3','Bar'],['tbl_bar_4','Bar 4','Bar']];
    for (const [id, tableNumber, section] of tables) await db.run("INSERT OR IGNORE INTO tables (id, table_number, status, section) VALUES (?, ?, 'empty', ?)", [id, tableNumber, section]);
  }
  const barQrTable = await db.get("SELECT id FROM tables WHERE id = ? OR table_number = ?", ['tbl_bar_qr_1', 'Bar QR 1']);
  if (!barQrTable) await db.run("INSERT INTO tables (id, table_number, status, section) VALUES (?, ?, 'empty', ?)", ['tbl_bar_qr_1', 'Bar QR 1', 'Bar']);
  const minibarItems = [
    ['menu_minibar_cola', 'Minibar Cola', 90, '/images/menu/minibar-cola.svg'],
    ['menu_minibar_water', 'Minibar Water', 30, '/images/menu/minibar-water.svg'],
    ['menu_minibar_beer', 'Minibar Beer', 130, '/images/menu/minibar-beer.svg']
  ];
  for (const [id, name, price, imageUrl] of minibarItems) {
    const existing = await db.get('SELECT id FROM catalog_items WHERE category = ? AND LOWER(name) = LOWER(?)', ['minibar', name]);
    if (!existing) await db.run('INSERT INTO catalog_items (id, name, price, category, module_type, image_url) VALUES (?, ?, ?, ?, ?, ?)', [id, name, price, 'minibar', 'hotel', imageUrl]);
    else await db.run("UPDATE catalog_items SET image_url = COALESCE(NULLIF(image_url, ''), ?) WHERE id = ?", [imageUrl, existing.id]);
  }
  for (const item of AEON_CATALOG_SEED) {
    const existing = await db.get('SELECT id FROM catalog_items WHERE id = ?', [item.id]);
    if (!existing) {
      await db.run(
        'INSERT INTO catalog_items (id, name, price, category, module_type, in_stock, image_url, ingredients, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.price, item.category, item.module_type, item.in_stock, item.image_url || '', item.ingredients || '', item.calories || 0, item.protein || 0, item.carbs || 0, item.fat || 0]
      );
    } else {
      await db.run(
        'UPDATE catalog_items SET ingredients = ?, calories = ?, protein = ?, carbs = ?, fat = ?, image_url = ? WHERE id = ?',
        [item.ingredients || '', item.calories || 0, item.protein || 0, item.carbs || 0, item.fat || 0, item.image_url || '', item.id]
      );
    }
  }

  // Explicit kitchen-station routing for the demo catalog's food items. Order-creation falls
  // back to matching Turkish dish-name keywords when no profile exists, which never matches
  // this generic English demo menu — every food order would silently land on the same
  // default station otherwise.
  const stationByCatalogItem = {
    menu_demo_garden_salad: 'kit_cold',
    menu_demo_caesar_salad: 'kit_cold',
    menu_demo_fruit_plate: 'kit_cold',
    menu_demo_grilled_chicken: 'kit_grill',
    menu_demo_grilled_seabass: 'kit_grill',
    menu_demo_beef_burger: 'kit_hot',
    menu_demo_margherita_pizza: 'kit_hot',
    menu_demo_tiramisu: 'kit_pastry',
    menu_demo_cheesecake: 'kit_pastry'
  };
  for (const [catalogItemId, stationId] of Object.entries(stationByCatalogItem)) {
    const existing = await db.get('SELECT catalog_item_id FROM menu_kitchen_profiles WHERE catalog_item_id = ?', [catalogItemId]);
    if (!existing) {
      await db.run(
        "INSERT INTO menu_kitchen_profiles (catalog_item_id, station_id, course, allergens, prep_minutes, active) VALUES (?, ?, 'main', '', 15, 1)",
        [catalogItemId, stationId]
      );
    }
  }

  for (const item of AEON_INGREDIENT_SEED) {
    const existing = await db.get('SELECT id FROM inventory WHERE id = ?', [item.id]);
    if (!existing) {
      await db.run(
        "INSERT INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type, purchase_unit, purchase_unit_amount, sub_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.unit, item.stock ?? 0, item.par_level, item.unit_cost ?? 0, item.module_type, item.purchase_unit || '', item.purchase_unit_amount || 0, item.sub_category || '']
      );
    } else {
      await db.run(
        "UPDATE inventory SET purchase_unit = ?, purchase_unit_amount = ?, sub_category = ? WHERE id = ?",
        [item.purchase_unit || '', item.purchase_unit_amount || 0, item.sub_category || '', item.id]
      );
    }
  }

  const recipeCnt = await db.get("SELECT COUNT(*) AS cnt FROM recipes");
  if (Number(recipeCnt?.cnt || 0) === 0) {
    const recipes = AEON_RECIPE_SEED.map((r, i) => ({
      id: `rc_${r.catalog_item_id}_${r.inventory_id}_${i}`,
      ...r
    }));
    for (const rec of recipes) {
      try {
        await db.run(
          "INSERT INTO recipes (id, catalog_item_id, inventory_id, amount_needed) VALUES (?, ?, ?, ?)",
          [rec.id, rec.catalog_item_id, rec.inventory_id, rec.amount_needed]
        );
      } catch (e) {}
    }
  }
}

export async function ensureDefaultRoomInventory(db) {
  const rooms = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const profile = number <= 4
      ? { roomType: 'Standard Room', floor: 1, bedType: 'double', capacity: 2, viewType: 'Garden' }
      : number <= 8
        ? { roomType: 'Deluxe Room', floor: 2, bedType: 'double', capacity: 2, viewType: 'Sea' }
        : { roomType: 'Suite', floor: 3, bedType: 'king', capacity: 2, viewType: 'Panoramic' };
    return { id: `room_${String(number).padStart(2, '0')}`, roomNumber: String(number), ...profile };
  });
  for (const room of rooms) {
    const existing = await db.get('SELECT id FROM rooms WHERE id = ? OR room_number = ?', [room.id, room.roomNumber]);
    if (existing) continue;
    await db.run("INSERT OR IGNORE INTO rooms (id, room_number, status, eta, guest_name, dnd_active, room_type, floor, bed_type, capacity, view_type) VALUES (?, ?, 'clean_vacant', 'Ready', '', 0, ?, ?, ?, ?, ?)", [room.id, room.roomNumber, room.roomType, room.floor, room.bedType, room.capacity, room.viewType]);
  }
}

export async function ensureDefaultKitchenMasterData(db) {
  const stationRow = await db.get('SELECT COUNT(*) AS cnt FROM kitchen_stations');
  if (Number(stationRow?.cnt || 0) > 0) return;
  const stations = [['kit_cold','Cold & Appetizers',10],['kit_hot','Hot Kitchen',20],['kit_grill','Grill',30],['kit_pastry','Pastry',40],['kit_expo','Expo',90]];
  for (const [id, name, sortOrder] of stations) await db.run('INSERT INTO kitchen_stations (id, name, sort_order, active) VALUES (?, ?, ?, 1)', [id, name, sortOrder]);
}

export async function ensureDefaultMarinaMasterData(db) {
  const berthRow = await db.get('SELECT COUNT(*) AS cnt FROM berths');
  if (Number(berthRow?.cnt || 0) > 0) return;
  const berths = [
    ['A1', 12, 2.5], ['A2', 12, 2.5], ['A3', 15, 3], ['A4', 15, 3],
    ['B1', 20, 3.5], ['B2', 20, 3.5], ['B3', 25, 4],
    ['C1', 35, 4.5], ['C2', 45, 5]
  ];
  for (const [berthNumber, maxLoaM, maxDraftM] of berths) {
    const id = `berth_${berthNumber.toLowerCase()}`;
    await db.run(
      "INSERT OR IGNORE INTO berths (id, berth_number, status, max_loa_m, max_draft_m) VALUES (?, ?, 'vacant', ?, ?)",
      [id, berthNumber, maxLoaM, maxDraftM]
    );
  }
}
