import { AEON_INGREDIENT_SEED, AEON_RECIPE_SEED } from '../ingredient-seed.js';

// Seeds the large demo/test dataset used only when tenantId === 'test_suite_run'. Extracted
// verbatim out of initSchema() purely to keep file sizes under control — pure relocation,
// same tenantId-derived branching as before.
export async function seedTestSuiteData(db, tenantId) {
  const isBaseTenant = tenantId === 'aeon' || tenantId === 'default'; // 'default' is always the base tenant
  const isDefaultProfile = tenantId === 'default_profile';
  const isSecondaryProfile = tenantId === 'secondary_profile';
  const isMarinaProfile = tenantId === 'marina_profile';
  const isYachtProfile = tenantId === 'yacht_profile';

  // Insert rooms
  let rooms = [];
  if (isDefaultProfile || isBaseTenant) {
    rooms = [
      // Panoramik Odalar (1. Kat - Deniz Manzarali)
      { id: 'r101', room_number: '101 - Panoramik', status: 'occupied',      eta: 'Kahvalt\u0131 istedi', guest_name: 'Mehmet & Ay\u015fe K\u0131l\u0131\u00e7', dnd_active: 0 },
      { id: 'r102', room_number: '102 - Panoramik', status: 'occupied',      eta: 'Havlu de\u011fi\u015fikli\u011fi talep etti', guest_name: 'Fatma Demir', dnd_active: 1 },
      { id: 'r103', room_number: '103 - Panoramik', status: 'clean_vacant',  eta: 'Haz\u0131r', guest_name: '', dnd_active: 0 },
      { id: 'r104', room_number: '104 - Panoramik', status: 'dirty_vacant',  eta: 'Temizlik Bekleniyor', guest_name: '', dnd_active: 0 },
      { id: 'r105', room_number: '105 - Panoramik', status: 'occupied',      eta: 'Check-out 11:00', guest_name: 'Can Yilmaz (2 Ki\u015fi)', dnd_active: 0 },
      // Deluxe Odalar (2. Kat)
      { id: 'r201', room_number: '201 - Deluxe',    status: 'occupied',      eta: 'Akli\u006datizasyon Ar\u0131za', guest_name: 'Serkan \u00d6zkan', dnd_active: 0 },
      { id: 'r202', room_number: '202 - Deluxe',    status: 'clean_vacant',  eta: 'Haz\u0131r', guest_name: '', dnd_active: 0 },
      { id: 'r203', room_number: '203 - Deluxe',    status: 'occupied',      eta: 'Ekstra Yatak \u0130stendi', guest_name: 'Ali & Zeynep Ak\u015f\u0131t (3 Ki\u015fi)', dnd_active: 0 },
      { id: 'r204', room_number: '204 - Deluxe',    status: 'dirty_vacant',  eta: 'Temizlik Bekleniyor', guest_name: '', dnd_active: 0 },
      { id: 'r205', room_number: '205 - Deluxe',    status: 'maintenance',   eta: 'Duvar Boyas\u0131 Tadilatl', guest_name: '', dnd_active: 0 },
      { id: 'r206', room_number: '206 - Deluxe',    status: 'clean_vacant',  eta: 'Haz\u0131r', guest_name: '', dnd_active: 0 },
      // Aile Odalar\u0131 (2. Kat - Geni\u015f)
      { id: 'r207', room_number: '207 - Aile Odas\u0131', status: 'occupied', eta: 'Bebek Bezi Talebi', guest_name: 'Yilmaz Ailesi (2+2)', dnd_active: 0 },
      { id: 'r208', room_number: '208 - Aile Odas\u0131', status: 'clean_vacant', eta: 'Haz\u0131r', guest_name: '', dnd_active: 0 },
      { id: 'r209', room_number: '209 - Aile Odas\u0131', status: 'occupied', eta: 'Check-in Bug\u00fcn 14:00', guest_name: '\u015eahin Ailesi (2+3)', dnd_active: 0 },
      { id: 'r210', room_number: '210 - Aile Odas\u0131', status: 'dirty_vacant', eta: 'Temizlik Bekleniyor', guest_name: '', dnd_active: 0 },
      // Kral Dairesi (3. Kat - Suit)
      { id: 'r301', room_number: '301 - Kral Dairesi', status: 'occupied',   eta: '\u015farap & Meyve Tabag\u0131 \u0130stedi', guest_name: 'Burak & Selin \u00c7elik (Bal Ay\u0131)', dnd_active: 1 },
      { id: 'r302', room_number: '302 - Kral Dairesi', status: 'clean_vacant', eta: 'Haz\u0131r', guest_name: '', dnd_active: 0 },
    ];
    if (isBaseTenant) {
      rooms.forEach(r => {
        r.status = 'clean_vacant';
        r.guest_name = '';
        r.eta = 'Hazır';
        r.dnd_active = 0;
      });
    }
  } else if (isSecondaryProfile) {
    rooms = [
      { id: 'r101', room_number: 'Villa Marina 101', status: 'occupied', eta: '12:00', guest_name: 'Ahmet Yılmaz (Yılmaz Ailesi)', dnd_active: 0 },
      { id: 'r102', room_number: 'Villa Marina 102', status: 'clean_vacant', eta: '', guest_name: '', dnd_active: 0 },
      { id: 'r201', room_number: 'Bungalow Lagoon 201', status: 'occupied', eta: '11:00', guest_name: 'John Harrison', dnd_active: 1 },
      { id: 'r202', room_number: 'Bungalow Lagoon 202', status: 'dirty_vacant', eta: '14:30', guest_name: '', dnd_active: 0 },
      { id: 'r301', room_number: 'Sunset Suite 301', status: 'maintenance', eta: 'Tadilat (Klima)', guest_name: '', dnd_active: 0 },
      { id: 'r302', room_number: 'Sunset Suite 302', status: 'clean_vacant', eta: '', guest_name: '', dnd_active: 0 }
    ];
  } else if (isMarinaProfile) {
    rooms = [
      { id: 'r101', room_number: 'Marina Suite 101', status: 'occupied', eta: '10:00', guest_name: 'Robert De Niro', dnd_active: 0 },
      { id: 'r102', room_number: 'Marina Suite 102', status: 'clean_vacant', eta: '', guest_name: '', dnd_active: 0 },
      { id: 'r201', room_number: 'Harbor View 201', status: 'dirty_vacant', eta: '13:00', guest_name: '', dnd_active: 0 },
      { id: 'r202', room_number: 'Harbor View 202', status: 'occupied', eta: '11:00', guest_name: 'Selin Demir', dnd_active: 1 },
      { id: 'r301', room_number: 'Royal Loft 301', status: 'maintenance', eta: 'Tadilat (Boya)', guest_name: '', dnd_active: 0 }
    ];
  } else if (isYachtProfile) {
    rooms = [
      { id: 'r101', room_number: 'VIP Cabana 1', status: 'occupied', eta: '09:00', guest_name: 'James Bond', dnd_active: 0 },
      { id: 'r102', room_number: 'VIP Cabana 2', status: 'clean_vacant', eta: '', guest_name: '', dnd_active: 0 },
      { id: 'r201', room_number: 'Oceanfront Suite 201', status: 'dirty_vacant', eta: '12:30', guest_name: '', dnd_active: 0 },
      { id: 'r202', room_number: 'Oceanfront Suite 202', status: 'occupied', eta: '11:00', guest_name: 'Sarah Jenkins', dnd_active: 1 },
      { id: 'r301', room_number: 'Presidential Villa', status: 'maintenance', eta: 'Tadilat (Havuz)', guest_name: '', dnd_active: 0 }
    ];
  } else {
    rooms = [
      { id: 'r101', room_number: '101', status: 'occupied', eta: '12:00', guest_name: 'Ahmet Yılmaz', dnd_active: 0 },
      { id: 'r102', room_number: '102', status: 'clean_vacant', eta: '', guest_name: '', dnd_active: 0 },
      { id: 'r103', room_number: '103', status: 'dirty_vacant', eta: '14:30', guest_name: '', dnd_active: 0 },
      { id: 'r104', room_number: '104', status: 'maintenance', eta: '', guest_name: '', dnd_active: 0 },
      { id: 'r105', room_number: '105', status: 'occupied', eta: '11:00', guest_name: 'Zeynep Kaya', dnd_active: 1 }
    ];
  }
  for (const r of rooms) {
    await db.run(
      "INSERT OR IGNORE INTO rooms (id, room_number, status, eta, guest_name, dnd_active) VALUES (?, ?, ?, ?, ?, ?)",
      [r.id, r.room_number, r.status, r.eta, r.guest_name, r.dnd_active]
    );
  }

  // Insert guest registry for occupied rooms
  let guests = [];
  if (isDefaultProfile) {
    guests = [
      { id: 'g1', room_id: 'r101', first_name: 'Mehmet', last_name: 'K\u0131l\u0131\u00e7', phone: '+905302218765' },
      { id: 'g2', room_id: 'r102', first_name: 'Fatma', last_name: 'Demir', phone: '+905411234567' },
      { id: 'g3', room_id: 'r105', first_name: 'Can', last_name: 'Yilmaz', phone: '+905321112233' },
      { id: 'g4', room_id: 'r201', first_name: 'Serkan', last_name: '\u00d6zkan', phone: '+905559876543' },
      { id: 'g5', room_id: 'r203', first_name: 'Ali', last_name: 'Ak\u015f\u0131t', phone: '+905444332211' },
      { id: 'g6', room_id: 'r207', first_name: 'Murat', last_name: 'Yilmaz', phone: '+905336677889' },
      { id: 'g7', room_id: 'r209', first_name: 'Hasan', last_name: '\u015eahin', phone: '+905224455667' },
      { id: 'g8', room_id: 'r301', first_name: 'Burak', last_name: '\u00c7elik', phone: '+905507654321' },
    ];
  } else if (isSecondaryProfile) {
    guests = [
      { id: 'g1', room_id: 'r101', first_name: 'Ahmet', last_name: 'Yılmaz', phone: '+905551234567' },
      { id: 'g2', room_id: 'r201', first_name: 'John', last_name: 'Harrison', phone: '+447700900077' }
    ];
  } else if (isMarinaProfile) {
    guests = [
      { id: 'g1', room_id: 'r101', first_name: 'Robert', last_name: 'De Niro', phone: '+12025550143' },
      { id: 'g2', room_id: 'r202', first_name: 'Selin', last_name: 'Demir', phone: '+905553334455' }
    ];
  } else if (isYachtProfile) {
    guests = [
      { id: 'g1', room_id: 'r101', first_name: 'James', last_name: 'Bond', phone: '+44700007007' },
      { id: 'g2', room_id: 'r202', first_name: 'Sarah', last_name: 'Sarah', phone: '+13125550189' }
    ];
  } else {
    guests = [
      { id: 'g1', room_id: 'r101', first_name: 'Ahmet', last_name: 'Yılmaz', phone: '+905551112233' },
      { id: 'g2', room_id: 'r105', first_name: 'Zeynep', last_name: 'Kaya', phone: '+905554445566' }
    ];
  }
  for (const g of guests) {
    await db.run(
      "INSERT OR IGNORE INTO guest_registry (id, room_id, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)",
      [g.id, g.room_id, g.first_name, g.last_name, g.phone]
    );
  }

  // Insert tables
  let tables = [];
  if (isDefaultProfile || isBaseTenant) {
    tables = [
      // \u0130skele (Deniz Üzerinde)
      { id: 't_is1', table_number: '\u0130skele 1', status: 'occupied',          section: '\u0130skele (Deniz Üzeri)' },
      { id: 't_is2', table_number: '\u0130skele 2', status: 'occupied',          section: '\u0130skele (Deniz Üzeri)' },
      { id: 't_is3', table_number: '\u0130skele 3', status: 'requested_bill',    section: '\u0130skele (Deniz Üzeri)' },
      { id: 't_is4', table_number: '\u0130skele 4', status: 'empty',             section: '\u0130skele (Deniz Üzeri)' },
      { id: 't_is5', table_number: '\u0130skele 5', status: 'empty',             section: '\u0130skele (Deniz Üzeri)' },
      { id: 't_is6', table_number: '\u0130skele 6', status: 'empty',             section: '\u0130skele (Deniz Üzeri)' },
      // Teras (A La Carte)
      { id: 't_tr1', table_number: 'Teras 1',    status: 'occupied',          section: 'Teras' },
      { id: 't_tr2', table_number: 'Teras 2',    status: 'requested_service', section: 'Teras' },
      { id: 't_tr3', table_number: 'Teras 3',    status: 'empty',             section: 'Teras' },
      { id: 't_tr4', table_number: 'Teras 4',    status: 'empty',             section: 'Teras' },
      // Bah\u00e7e
      { id: 't_bh1', table_number: 'Bah\u00e7e 1',  status: 'occupied',          section: 'Bah\u00e7e' },
      { id: 't_bh2', table_number: 'Bah\u00e7e 2',  status: 'empty',             section: 'Bah\u00e7e' },
      { id: 't_bh3', table_number: 'Bah\u00e7e 3',  status: 'empty',             section: 'Bah\u00e7e' },
      { id: 't_bh4', table_number: 'Bah\u00e7e 4',  status: 'empty',             section: 'Bah\u00e7e' },
      // Korsan Beach Bar
      { id: 't_kb1', table_number: 'Korsan Bar 1', status: 'occupied',         section: 'Korsan Beach Bar' },
      { id: 't_kb2', table_number: 'Korsan Bar 2', status: 'requested_service',section: 'Korsan Beach Bar' },
      { id: 't_kb3', table_number: 'Korsan Bar 3', status: 'empty',            section: 'Korsan Beach Bar' },
      { id: 't_kb4', table_number: 'Korsan Bar 4', status: 'empty',            section: 'Korsan Beach Bar' },
    ];
    if (isBaseTenant) {
      tables.forEach(t => {
        t.status = 'empty';
      });
    }
  } else if (isSecondaryProfile) {
    tables = [
      { id: 't1', table_number: 'Sunset Masa 1', status: 'occupied', section: 'Deniz İskelesi' },
      { id: 't2', table_number: 'Sunset Masa 2', status: 'empty', section: 'Deniz İskelesi' },
      { id: 't3', table_number: 'Beach Masa 3', status: 'requested_service', section: 'Kumsal' },
      { id: 't4', table_number: 'Beach Masa 4', status: 'requested_bill', section: 'Kumsal' },
      { id: 't5', table_number: 'Pier VIP Lounge 5', status: 'occupied', section: 'İskele Ucu' }
    ];
  } else if (isMarinaProfile) {
    tables = [
      { id: 't1', table_number: 'Deck Table 1', status: 'occupied', section: 'Rıhtım' },
      { id: 't2', table_number: 'Deck Table 2', status: 'empty', section: 'Rıhtım' },
      { id: 't3', table_number: 'Marina Bar 3', status: 'requested_service', section: 'Marina Bar' },
      { id: 't4', table_number: 'Marina Bar 4', status: 'requested_bill', section: 'Marina Bar' }
    ];
  } else if (isYachtProfile) {
    tables = [
      { id: 't1', table_number: 'Yacht Lounge 1', status: 'occupied', section: 'Lounge' },
      { id: 't2', table_number: 'Yacht Lounge 2', status: 'empty', section: 'Lounge' },
      { id: 't3', table_number: 'Pier Table 3', status: 'requested_service', section: 'Liman' },
      { id: 't4', table_number: 'Pier Table 4', status: 'requested_bill', section: 'Liman' }
    ];
  } else {
    tables = [
      { id: 't1', table_number: 'Masa 1', status: 'occupied', section: 'Bahçe' },
      { id: 't2', table_number: 'Masa 2', status: 'empty', section: 'Bahçe' },
      { id: 't3', table_number: 'Masa 3', status: 'requested_service', section: 'Teras' },
      { id: 't4', table_number: 'Masa 4', status: 'requested_bill', section: 'İç Salon' }
    ];
  }
  for (const t of tables) {
    await db.run(
      "INSERT OR IGNORE INTO tables (id, table_number, status, section) VALUES (?, ?, ?, ?)",
      [t.id, t.table_number, t.status, t.section]
    );
  }

  // Insert inventory
  let inventoryItems = [];
  if (isDefaultProfile || isBaseTenant) {
    inventoryItems = AEON_INGREDIENT_SEED;
  } else if (isSecondaryProfile) {
    inventoryItems = [
      { id: 'gin_premium', name: 'Bodrum Tangerine Gin', unit: 'ml', stock: 1200, par_level: 5000, unit_cost: 0.15, module_type: 'bar' },
      { id: 'rum_aged', name: 'Aged Caribbean Rum', unit: 'ml', stock: 4000, par_level: 8000, unit_cost: 0.18, module_type: 'bar' },
      { id: 'whisky_malt', name: 'Single Malt Scotch Whisky', unit: 'ml', stock: 5000, par_level: 8000, unit_cost: 0.35, module_type: 'bar' },
      { id: 'tonic_artisan', name: 'Artisan Tonic Water', unit: 'ml', stock: 12000, par_level: 20000, unit_cost: 0.02, module_type: 'bar' },
      { id: 'lime', name: 'Misket Limonu', unit: 'adet', stock: 25, par_level: 100, unit_cost: 1.50, module_type: 'bar' },
      { id: 'mint', name: 'Taze Nane Yaprağı', unit: 'gram', stock: 1500, par_level: 3000, unit_cost: 0.05, module_type: 'bar' },
      { id: 'octopus', name: 'Taze Ege Ahtapotu', unit: 'gram', stock: 8000, par_level: 15000, unit_cost: 0.30, module_type: 'kitchen' },
      { id: 'fish_seabass', name: 'Deniz Levreği', unit: 'adet', stock: 35, par_level: 60, unit_cost: 220.0, module_type: 'kitchen' },
      { id: 'beer_premium', name: 'Soğuk Corona Extra', unit: 'adet', stock: 120, par_level: 200, unit_cost: 75.0, module_type: 'bar' }
    ];
  } else if (isMarinaProfile) {
    inventoryItems = [
      { id: 'gin', name: 'Dry Gin', unit: 'ml', stock: 1400, par_level: 5000, unit_cost: 0.10, module_type: 'bar' },
      { id: 'tonic', name: 'Tonic Water', unit: 'ml', stock: 8000, par_level: 15000, unit_cost: 0.02, module_type: 'bar' },
      { id: 'lime', name: 'Limon', unit: 'adet', stock: 18, par_level: 100, unit_cost: 1.00, module_type: 'bar' },
      { id: 'espresso', name: 'Espresso Çekirdeği', unit: 'gram', stock: 2000, par_level: 4000, unit_cost: 0.03, module_type: 'kitchen' },
      { id: 'milk', name: 'Süt', unit: 'ml', stock: 8000, par_level: 12000, unit_cost: 0.003, module_type: 'kitchen' },
      { id: 'fish_bass', name: 'Levrek Fileto', unit: 'adet', stock: 12, par_level: 50, unit_cost: 150.0, module_type: 'kitchen' }
    ];
  } else if (isYachtProfile) {
    inventoryItems = [
      { id: 'gin_premium', name: 'Bodrum Tangerine Gin', unit: 'ml', stock: 3000, par_level: 5000, unit_cost: 0.15, module_type: 'bar' },
      { id: 'rum_aged', name: 'Aged Caribbean Rum', unit: 'ml', stock: 6000, par_level: 8000, unit_cost: 0.18, module_type: 'bar' },
      { id: 'tonic_artisan', name: 'Artisan Tonic Water', unit: 'ml', stock: 15000, par_level: 20000, unit_cost: 0.02, module_type: 'bar' },
      { id: 'lime', name: 'Misket Limonu', unit: 'adet', stock: 85, par_level: 100, unit_cost: 1.50, module_type: 'bar' },
      { id: 'mint', name: 'Taze Nane Yaprağı', unit: 'gram', stock: 2500, par_level: 3000, unit_cost: 0.05, module_type: 'bar' },
      { id: 'octopus', name: 'Taze Ege Ahtapotu', unit: 'gram', stock: 12000, par_level: 15000, unit_cost: 0.30, module_type: 'kitchen' }
    ];
  } else {
    inventoryItems = [
      { id: 'gin', name: 'Cin', unit: 'ml', stock: 2000, par_level: 5000, unit_cost: 0.05, module_type: 'bar' },
      { id: 'vodka', name: 'Viski', unit: 'ml', stock: 3000, par_level: 5000, unit_cost: 0.04, module_type: 'bar' },
      { id: 'tonic', name: 'Tonik', unit: 'ml', stock: 4000, par_level: 10000, unit_cost: 0.01, module_type: 'bar' },
      { id: 'lime', name: 'Limon/Misket', unit: 'adet', stock: 50, par_level: 100, unit_cost: 0.20, module_type: 'bar' },
      { id: 'espresso', name: 'Kahve Çekirdeği', unit: 'gram', stock: 1000, par_level: 2000, unit_cost: 0.02, module_type: 'kitchen' },
      { id: 'milk', name: 'Süt', unit: 'ml', stock: 5000, par_level: 10000, unit_cost: 0.002, module_type: 'kitchen' }
    ];
  }
  for (const item of inventoryItems) {
    await db.run(
      "INSERT OR IGNORE INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type, purchase_unit, purchase_unit_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [item.id, item.name, item.unit, item.stock ?? 0, item.par_level, item.unit_cost ?? 0, item.module_type, item.purchase_unit || '', item.purchase_unit_amount || 0]
    );
  }

  // Insert catalog items
  let catalogItems = [];
  if (isDefaultProfile || isBaseTenant) {
    catalogItems = [
      // A La Carte - Ana Yemekler (Deniz Ürünleri)
      { id: 'c_cipura',    name: 'Izgara Deniz \u00c7ipuras\u0131',      price: 420,  category: 'food',    module_type: 'dining' },
      { id: 'c_levrek',    name: 'Izgara Levrek',                price: 390,  category: 'food',    module_type: 'dining' },
      { id: 'c_ahtapot_iz',name: 'Izgara Ahtapot',              price: 460,  category: 'food',    module_type: 'dining' },
      { id: 'c_karides',   name: 'Karides G\u00fcvec\u00e7',             price: 480,  category: 'food',    module_type: 'dining' },
      { id: 'c_kalamar',   name: 'K\u0131zartma Kalamar',            price: 280,  category: 'food',    module_type: 'dining' },
      // Mezeler
      { id: 'c_meze_karm', name: 'Kar\u0131\u015f\u0131k Meze Tabag\u0131',      price: 230,  category: 'food',    module_type: 'dining' },
      { id: 'c_ahtapot_sl',name: 'Ahtapot Salatas\u0131',           price: 360,  category: 'food',    module_type: 'dining' },
      { id: 'c_humus',     name: 'Humus',                        price: 130,  category: 'food',    module_type: 'dining' },
      { id: 'c_ezme',      name: 'Ate\u015fli Ezme',                 price: 110,  category: 'food',    module_type: 'dining' },
      { id: 'c_cacik',     name: 'Cac\u0131k',                      price: 100,  category: 'food',    module_type: 'dining' },
      // AEON Spesiyalleri
      { id: 'c_bal_kaymak',name: 'AEON Bal\u0131 & Kaymak',     price: 150,  category: 'food',    module_type: 'dining' },
      { id: 'c_gozleme',   name: 'Taze Gozleme (Peynirli)',      price: 120,  category: 'food',    module_type: 'dining' },
      // \u0130cecekler - Alkoller
      { id: 'c_raki_tek',  name: 'Rak\u0131 Tek',                   price: 160,  category: 'drink',   module_type: 'dining' },
      { id: 'c_raki_dbl',  name: 'Rak\u0131 Duble',                 price: 280,  category: 'drink',   module_type: 'dining' },
      { id: 'c_gin_tonik', name: 'Cin Tonik',                    price: 260,  category: 'drink',   module_type: 'dining' },
      { id: 'c_sarap_b',   name: 'Beyaz \u015earap (Kadeh)',          price: 180,  category: 'drink',   module_type: 'dining' },
      { id: 'c_sarap_k',   name: 'K\u0131rm\u0131z\u0131 \u015earap (Kadeh)',   price: 200,  category: 'drink',   module_type: 'dining' },
      { id: 'c_bira_efes', name: 'Bira (Efes Pilsen)',           price: 130,  category: 'drink',   module_type: 'dining' },
      { id: 'c_bira_mil',  name: 'Bira (Miller)',                price: 150,  category: 'drink',   module_type: 'dining' },
      // \u0130cecekler - Alkolsuz
      { id: 'c_su',        name: 'Su (0.5L)',                    price: 25,   category: 'drink',   module_type: 'dining' },
      { id: 'c_kola',      name: 'Kola (Coca-Cola)',             price: 90,   category: 'drink',   module_type: 'dining' },
      { id: 'c_cay',       name: 'Cay',                          price: 35,   category: 'drink',   module_type: 'dining' },
      { id: 'c_kahve',     name: 'T\u00fcrk Kahvesi',               price: 75,   category: 'drink',   module_type: 'dining' },
      // Oda & Minibar
      { id: 'c_minibar_b', name: 'Minibar Bira',                 price: 130,  category: 'minibar', module_type: 'hotel' },
      { id: 'c_minibar_s', name: 'Minibar Su (0.5L)',            price: 30,   category: 'minibar', module_type: 'hotel' },
      { id: 'c_minibar_k', name: 'Minibar Kola',                 price: 90,   category: 'minibar', module_type: 'hotel' },
      // Hizmetler
      { id: 'c_oda_tmz',   name: 'Oda Temizli\u011fi',              price: 0,    category: 'service', module_type: 'hotel' },
      { id: 'c_havlu',     name: 'Ekstra Havlu',                 price: 0,    category: 'service', module_type: 'hotel' },
      { id: 'c_sabah_kah', name: 'Kahvalt\u0131 (Oda Servis)',      price: 120,  category: 'food',    module_type: 'hotel' },
    ];
  } else if (isSecondaryProfile || isYachtProfile) {
    catalogItems = [
      { id: 'c1', name: 'Signature Mojito (Beach Club)', price: 380, category: 'drink', module_type: 'dining' },
      { id: 'c2', name: 'Bodrum Tangerine Gin Tonik', price: 420, category: 'drink', module_type: 'dining' },
      { id: 'c3', name: 'Ahtapot Carpaccio', price: 450, category: 'food', module_type: 'dining' },
      { id: 'c4', name: 'Izgara Kaya Levreği', price: 580, category: 'food', module_type: 'dining' },
      { id: 'c5', name: 'Minibar Premium Paket', price: 300, category: 'minibar', module_type: 'hotel' },
      { id: 'c6', name: 'Oda Servisi Gourmet Burger', price: 390, category: 'food', module_type: 'dining' },
      { id: 'c7', name: 'Ekstra Plaj Havlusu', price: 0, category: 'service', module_type: 'hotel' }
    ];
  } else if (isMarinaProfile) {
    catalogItems = [
      { id: 'c1', name: 'Grand Gin Tonik', price: 350, category: 'drink', module_type: 'dining' },
      { id: 'c2', name: 'Espresso Martini', price: 320, category: 'drink', module_type: 'dining' },
      { id: 'c3', name: 'Tava Levrek', price: 480, category: 'food', module_type: 'dining' },
      { id: 'c4', name: 'Oda Servisi Kahvaltı', price: 290, category: 'food', module_type: 'dining' },
      { id: 'c5', name: 'Minibar Bira', price: 150, category: 'minibar', module_type: 'hotel' }
    ];
  } else {
    catalogItems = [
      { id: 'c1', name: 'Cin Tonik', price: 250, category: 'drink', module_type: 'dining' },
      { id: 'c2', name: 'Viski Soda', price: 280, category: 'drink', module_type: 'dining' },
      { id: 'c3', name: 'Cappuccino', price: 95, category: 'food', module_type: 'dining' },
      { id: 'c4', name: 'Oda Temizliği', price: 0, category: 'service', module_type: 'hotel' },
      { id: 'c5', name: 'Minibar Bira', price: 120, category: 'minibar', module_type: 'hotel' }
    ];
  }
  for (const item of catalogItems) {
    await db.run(
      "INSERT OR IGNORE INTO catalog_items (id, name, price, category, module_type) VALUES (?, ?, ?, ?, ?)",
      [item.id, item.name, item.price, item.category, item.module_type]
    );
  }

  // Insert recipes
  let recipes = [];
  if (isDefaultProfile || isBaseTenant) {
    recipes = AEON_RECIPE_SEED.map((r, i) => ({
      id: `rc_${r.catalog_item_id}_${r.inventory_id}_${i}`,
      ...r
    }));
  } else if (isSecondaryProfile || isYachtProfile) {
    recipes = [
      { id: 'r_mojito_rum', catalog_item_id: 'c1', inventory_id: 'rum_aged', amount_needed: 50 },
      { id: 'r_mojito_tonic', catalog_item_id: 'c1', inventory_id: 'tonic_artisan', amount_needed: 120 },
      { id: 'r_mojito_lime', catalog_item_id: 'c1', inventory_id: 'lime', amount_needed: 1 },
      { id: 'r_mojito_mint', catalog_item_id: 'c1', inventory_id: 'mint', amount_needed: 15 },
      { id: 'r_gin_t_gin', catalog_item_id: 'c2', inventory_id: 'gin_premium', amount_needed: 50 },
      { id: 'r_gin_t_tonic', catalog_item_id: 'c2', inventory_id: 'tonic_artisan', amount_needed: 150 },
      { id: 'r_gin_t_lime', catalog_item_id: 'c2', inventory_id: 'lime', amount_needed: 1 },
      { id: 'r_ahtapot_c', catalog_item_id: 'c3', inventory_id: 'octopus', amount_needed: 150 },
      { id: 'r_levrek_g', catalog_item_id: 'c4', inventory_id: 'fish_seabass', amount_needed: 1 }
    ];
  } else if (isMarinaProfile) {
    recipes = [
      { id: 'r_gm_gin', catalog_item_id: 'c1', inventory_id: 'gin', amount_needed: 50 },
      { id: 'r_gm_tonic', catalog_item_id: 'c1', inventory_id: 'tonic', amount_needed: 150 },
      { id: 'r_gm_lime', catalog_item_id: 'c1', inventory_id: 'lime', amount_needed: 1 },
      { id: 'r_gm_espresso', catalog_item_id: 'c2', inventory_id: 'espresso', amount_needed: 15 },
      { id: 'r_gm_fish', catalog_item_id: 'c3', inventory_id: 'fish_bass', amount_needed: 1 }
    ];
  } else {
    recipes = [
      { id: 'r_ct_gin', catalog_item_id: 'c1', inventory_id: 'gin', amount_needed: 50 },
      { id: 'r_ct_tonic', catalog_item_id: 'c1', inventory_id: 'tonic', amount_needed: 150 },
      { id: 'r_ct_lime', catalog_item_id: 'c1', inventory_id: 'lime', amount_needed: 1 },
      { id: 'r_vs_whisky', catalog_item_id: 'c2', inventory_id: 'vodka', amount_needed: 60 },
      { id: 'r_cap_beans', catalog_item_id: 'c3', inventory_id: 'espresso', amount_needed: 15 },
      { id: 'r_cap_milk', catalog_item_id: 'c3', inventory_id: 'milk', amount_needed: 150 }
    ];
  }
  for (const rec of recipes) {
    await db.run(
      "INSERT OR IGNORE INTO recipes (id, catalog_item_id, inventory_id, amount_needed) VALUES (?, ?, ?, ?)",
      [rec.id, rec.catalog_item_id, rec.inventory_id, rec.amount_needed]
    );
  }

  // Insert default requests & Yacht APA ledger records
  if (isDefaultProfile) {
    // Aktif sipari\u015f - \u0130skele 2
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d1', 'order', 'Table-\u0130skele 2', 'preparing',
        JSON.stringify([{ itemId: 'c_raki_dbl', name: 'Rak\u0131 Duble', quantity: 2, price: 280 }, { itemId: 'c_meze_karm', name: 'Kar\u0131\u015f\u0131k Meze', quantity: 1, price: 230 }, { itemId: 'c_ahtapot_sl', name: 'Ahtapot Salatas\u0131', quantity: 1, price: 360 }]),
        1150, null]
    );
    // Hesap isteg\u0131 - \u0130skele 3
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d2', 'order', 'Table-\u0130skele 3', 'delivered',
        JSON.stringify([{ itemId: 'c_cipura', name: 'Izgara \u00c7ipura', quantity: 2, price: 420 }, { itemId: 'c_sarap_b', name: 'Beyaz \u015earap', quantity: 2, price: 180 }]),
        1200, null]
    );
    // Oda servisi - 301 Kral Dairesi
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d3', 'order', 'Room-301 - Kral Dairesi', 'pending',
        JSON.stringify([{ itemId: 'c_sarap_b', name: 'Beyaz \u015earap (Kadeh)', quantity: 2, price: 180 }, { itemId: 'c_meze_karm', name: 'Kar\u0131\u015f\u0131k Meze', quantity: 1, price: 230 }]),
        590, null]
    );
    // Su talebi - Oda 207
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d4', 'water_request', 'Room-207 - Aile Odas\u0131', 'pending', '\u00c7ocuklar i\u00e7in ek yatak ve \u00e7ar\u015faf talebi', 0, null]
    );
    // Temizlik talebi - Oda 104
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d5', 'hk_request', 'Room-104 - Panoramik', 'pending', 'Oda temizli\u011fi ve havlu de\u011fi\u015fikli\u011fi', 0, null]
    );
    // Tamamlanm\u0131\u015f restoran sipari\u015fi (Restoran Cirosu i\u00e7in)
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d6', 'order', 'Table-\u0130skele 1', 'completed', JSON.stringify([{ itemId: 'c_ahtapot_sl', name: 'Ahtapot Salatas\u0131', quantity: 1, price: 360 }]), 360, 'credit_card']
    );
    // Oda hesab\u0131na aktar\u0131lan sipari\u015f (Konaklama Cirosu i\u00e7in)
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['req_d7', 'room_service_charge', 'Room-102 - Bah\u00e7e Manzaral\u0131', 'completed', JSON.stringify([{ itemId: 'c_bira_efes', name: 'Bira (Efes Pilsen)', quantity: 3, price: 130 }]), 390, 'room_charge']
    );
    // Barmen k\u00f6r say\u0131m raporu (bar_blind_audits)
    await db.run(
      "INSERT OR IGNORE INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['audit_1', 'staff_1', 'raki_efe', 12.5, 12.0, -0.5, new Date().toISOString()]
    );
    await db.run(
      "INSERT OR IGNORE INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['audit_2', 'staff_1', 'gin', 8.0, 8.0, 0, new Date().toISOString()]
    );
  } else if (isSecondaryProfile) {
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'req_m1', 
        'order', 
        'Table-Sunset Masa 1', 
        'preparing', 
        JSON.stringify([{ itemId: 'c2', name: 'Bodrum Tangerine Gin Tonik', quantity: 2, price: 420 }, { itemId: 'c3', name: 'Ahtapot Carpaccio', quantity: 1, price: 450 }]), 
        1290, 
        null
      ]
    );
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'req_m2', 
        'water_request', 
        'Room-Villa Marina 101', 
        'pending', 
        'Odaya çocuk yatağı ve ekstra su talebi', 
        0, 
        null
      ]
    );
    // Seed Yacht APA
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_m1', 3500, 'EUR', 1.0, 'fuel', 'S/Y Windrunner - 28m Oyster yakıt alımı', '/uploads/receipts/fuel_windrunner.jpg']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_m2', 850, 'EUR', 1.0, 'marina_fees', 'M/Y Blue Horizon - Gecelik iskele bağlama ücreti', '']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_m3', 1200, 'EUR', 1.0, 'provisions_guest', 'M/Y Blue Horizon - Gurme kumanya ve taze balık tedariği', '']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_m4', 450, 'EUR', 1.0, 'alcohol', 'Pier VIP Lounge 5 - Akşam yemeği APA transferi', '']
    );
  } else if (isMarinaProfile) {
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'req_gm1', 
        'order', 
        'Table-Deck Table 1', 
        'preparing', 
        JSON.stringify([{ itemId: 'c1', name: 'Grand Gin Tonik', quantity: 2, price: 350 }]), 
        700, 
        null
      ]
    );
    // Seed Yacht APA
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_gm1', 5400, 'EUR', 1.0, 'fuel', 'M/Y Ocean Pearl - 45m Benetti yakıt ikmali', '/uploads/receipts/fuel_ocean_pearl.jpg']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_gm2', 1500, 'EUR', 1.0, 'marina_fees', 'M/Y Ocean Pearl - 2 günlük rıhtım bağlama ücreti', '']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_gm3', 980, 'EUR', 1.0, 'provisions_guest', 'M/Y Ocean Pearl - Organik sebze, meyve ve premium et tedariği', '']
    );
  } else if (isYachtProfile) {
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'req_vy1', 
        'order', 
        'Table-Yacht Lounge 1', 
        'preparing', 
        JSON.stringify([{ itemId: 'c1', name: 'Signature Mojito (Beach Club)', quantity: 4, price: 380 }]), 
        1520, 
        null
      ]
    );
    // Seed Yacht APA
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_vy1', 6800, 'EUR', 1.0, 'fuel', 'S/Y Black Pearl - 38m Perini Navi yakıt dolumu', '']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_vy2', 450, 'EUR', 1.0, 'clearance', 'Port agent customs entry fees - Giriş acente ücretleri', '']
    );
    await db.run(
      "INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['apa_vy3', 2500, 'EUR', 1.0, 'alcohol', 'Kav dolabı için şampanya ve konyak teslimatı', '']
    );
  } else {
    await db.run(
      "INSERT OR IGNORE INTO requests (id, type, target_identifier, status, details, total_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'req1', 
        'order', 
        'Table-Masa 1', 
        'preparing', 
        JSON.stringify([{ itemId: 'c1', name: 'Cin Tonik', quantity: 2, price: 250 }]), 
        500, 
        null
      ]
    );
  }
}
