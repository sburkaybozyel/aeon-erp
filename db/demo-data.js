const isoDate = (date, offset = 0) => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

export async function seedDemoData(db, tenantId = 'aeon', actorName = 'Demo Kurulum') {
  const menuImages = {
    menu_demo_tea: '/images/menu/tea.svg',
    menu_demo_filter_coffee: '/images/menu/filter-coffee.svg',
    menu_demo_cappuccino: '/images/menu/cappuccino.svg',
    menu_demo_fresh_orange_juice: '/images/menu/fresh-orange-juice.svg',
    menu_demo_soft_drink: '/images/menu/soft-drink.svg',
    menu_demo_water: '/images/menu/water-05l.svg',
    menu_demo_garden_salad: '/images/menu/garden-salad.svg',
    menu_demo_caesar_salad: '/images/menu/caesar-salad.svg',
    menu_demo_grilled_chicken: '/images/menu/grilled-chicken.svg',
    menu_demo_grilled_seabass: '/images/menu/grilled-seabass.svg',
    menu_demo_beef_burger: '/images/menu/beef-burger.svg',
    menu_demo_margherita_pizza: '/images/menu/margherita-pizza.svg',
    menu_demo_tiramisu: '/images/menu/tiramisu.svg',
    menu_demo_cheesecake: '/images/menu/cheesecake.svg',
    menu_demo_fruit_plate: '/images/menu/fruit-plate.svg'
  };
  const summary = {
    version: '2026-08-03-full-v2',
    rooms: 12,
    occupied_rooms: 4,
    reservations: 6,
    active_orders: 4,
    housekeeping_tasks: 3,
    maintenance_orders: 2,
    vessel_visits: 2
  };
  const existingVersion = await db.get("SELECT value FROM config WHERE key = 'DEMO_DATA_VERSION'");
  if (existingVersion?.value === summary.version) return { ...summary, already_seeded: true };
  if (existingVersion?.value === '2026-08-03-full-v1') {
    for (const [id, imageUrl] of Object.entries(menuImages)) await db.run("UPDATE catalog_items SET image_url = ? WHERE id = ?", [imageUrl, id]);
    await db.run("UPDATE config SET value = ? WHERE key = 'DEMO_DATA_VERSION'", [summary.version]);
    return { ...summary, upgraded: true };
  }
  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(now, -1);
  const tomorrow = isoDate(now, 1);
  const inTwoDays = isoDate(now, 2);
  const inThreeDays = isoDate(now, 3);
  const inFiveDays = isoDate(now, 5);
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
  const run = (sql, params = []) => db.run(sql, params);

  const guests = [
    ['demo_guest_1', 'Deniz', 'Yılmaz', '11111111110', null, 'national_id', 'TR', '+90 555 000 0101', 'deniz.demo@example.com', 1, 'Sessiz oda, yüksek yastık'],
    ['demo_guest_2', 'Elif', 'Kaya', '11111111128', null, 'national_id', 'TR', '+90 555 000 0102', 'elif.demo@example.com', 0, 'Glütensiz kahvaltı'],
    ['demo_guest_3', 'James', 'Walker', null, 'DEMO-P003', 'passport', 'GB', '+44 7700 900003', 'james.demo@example.com', 1, 'Airport transfer'],
    ['demo_guest_4', 'Sofia', 'Rossi', null, 'DEMO-P004', 'passport', 'IT', '+39 320 000 0004', 'sofia.demo@example.com', 0, 'Vegetarian menu'],
    ['demo_guest_5', 'Mert', 'Aydın', '11111111144', null, 'national_id', 'TR', '+90 555 000 0105', 'mert.demo@example.com', 0, 'Late arrival'],
    ['demo_guest_6', 'Anna', 'Schmidt', null, 'DEMO-P006', 'passport', 'DE', '+49 151 000 0006', 'anna.demo@example.com', 0, 'Sea view']
  ];
  const guestById = new Map(guests.map(guest => [guest[0], guest]));
  for (const guest of guests) {
    await run("INSERT OR IGNORE INTO guest_profiles (id, first_name, last_name, identity_number, passport_number, document_type, nationality, phone, email, vip, preferences, language, kvkk_notice_at, marketing_consent, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tr', ?, 1, ?, ?)", [...guest, timestamp, actorName, actorName]);
  }

  const reservations = [
    ['demo_res_1', 'DEMO-1001', 'checked_in', yesterday, inThreeDays, 4, 2, 0, 'Standard Room', 'room_01', 'BB', 4200, 16800, 5000, 'Direct', 'demo_guest_1', 'paid'],
    ['demo_res_2', 'DEMO-1002', 'checked_in', today, inTwoDays, 2, 2, 0, 'Standard Room', 'room_02', 'HB', 4900, 9800, 3000, 'Booking.com', 'demo_guest_2', 'partial'],
    ['demo_res_3', 'DEMO-1003', 'checked_in', yesterday, inFiveDays, 6, 2, 0, 'Standard Room', 'room_03', 'BB', 5600, 33600, 10000, 'HotelRunner', 'demo_guest_3', 'partial'],
    ['demo_res_4', 'DEMO-1004', 'checked_in', today, inThreeDays, 3, 1, 0, 'Standard Room', 'room_04', 'BB', 5200, 15600, 0, 'Expedia', 'demo_guest_4', 'pending'],
    ['demo_res_5', 'DEMO-1005', 'confirmed', tomorrow, inFiveDays, 4, 2, 1, 'Deluxe Room', 'room_08', 'HB', 6800, 27200, 7000, 'Direct', 'demo_guest_5', 'partial'],
    ['demo_res_6', 'DEMO-1006', 'guaranteed', inTwoDays, inFiveDays, 3, 2, 0, 'Suite', 'room_09', 'BB', 8900, 26700, 26700, 'HotelRunner', 'demo_guest_6', 'paid']
  ];
  for (const item of reservations) {
    const guest = guestById.get(item[15]);
    await run("INSERT OR IGNORE INTO reservations (id, reservation_number, status, arrival_date, departure_date, nights, adults, children, child_ages, room_type, room_id, board_type, nightly_rate, currency, total_amount, deposit_amount, booking_source, guarantee_type, payment_method, payment_due_date, payment_status, main_guest_id, contact_phone, contact_email, special_requests, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, 'TRY', ?, ?, ?, 'credit_card', 'credit_card', ?, ?, ?, ?, ?, ?, ?, ?)", [item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], item[10], item[11], item[12], item[13], item[14], item[3], item[16], item[15], guest[7], guest[8], guest[10], actorName, actorName]);
    await run("INSERT OR IGNORE INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 1)", [`demo_rg_${item[0].slice(-1)}`, item[0], item[15]]);
    await run("INSERT OR IGNORE INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)", [`demo_asg_${item[0].slice(-1)}`, item[0], item[9], item[3], item[4], item[2] === 'checked_in' ? 'checked_in' : 'reserved', actorName]);
  }

  for (let index = 1; index <= 4; index += 1) {
    const reservation = reservations[index - 1];
    const roomId = reservation[9];
    const guestId = reservation[15];
    const guest = guestById.get(guestId);
    const folioId = `demo_folio_${index}`;
    const stayId = `demo_stay_${index}`;
    await run("INSERT OR IGNORE INTO folios (id, tenant_id, room_id, total_amount, type, details, created_by, status) VALUES (?, ?, ?, 0, 'stay', ?, ?, 'open')", [folioId, tenantId, roomId, reservation[1], actorName]);
    await run("INSERT OR IGNORE INTO stays (id, reservation_id, room_id, folio_id, status, checkin_at, business_date, board_type, nightly_rate, currency, adults, children, created_by, updated_by) VALUES (?, ?, ?, ?, 'checked_in', ?, ?, ?, ?, 'TRY', ?, ?, ?, ?)", [stayId, reservation[0], roomId, folioId, timestamp, reservation[4], reservation[10], reservation[11], reservation[6], reservation[7], actorName, actorName]);
    await run("INSERT OR IGNORE INTO stay_guests (id, stay_id, guest_id, is_main) VALUES (?, ?, ?, 1)", [`demo_sg_${index}`, stayId, guestId]);
    await run("UPDATE room_assignments SET stay_id = ?, status = 'checked_in' WHERE id = ?", [stayId, `demo_asg_${index}`]);
    await run("UPDATE rooms SET status = 'occupied', guest_name = ?, arrival_date = ?, departure_date = ?, board_type = ?, vip = ?, eta = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [`${guest[1]} ${guest[2]}`, reservation[3], reservation[4], reservation[10], index === 1 || index === 3 ? 1 : 0, index === 2 ? 'Akşam yemeği 20:00' : index === 3 ? 'VIP karşılama tamamlandı' : 'Konaklama aktif', actorName, roomId]);
    await run("INSERT OR IGNORE INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, currency, debit, department, related_reference, created_by) VALUES (?, ?, 'accommodation', 'Demo geceleme', 1, ?, 'TRY', ?, 'Reception', ?, ?)", [`demo_ftx_room_${index}`, folioId, reservation[11], reservation[11], `demo-room-${index}`, actorName]);
    await run("INSERT OR IGNORE INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, currency, debit, department, related_reference, created_by) VALUES (?, ?, 'minibar', 'Minibar ve oda servisi', 1, ?, 'TRY', ?, 'Housekeeping', ?, ?)", [`demo_ftx_extra_${index}`, folioId, 350 + index * 125, 350 + index * 125, `demo-extra-${index}`, actorName]);
    if (index <= 3) {
      const payment = 1500 + index * 1000;
      await run("INSERT OR IGNORE INTO payments (id, folio_id, amount, currency, payment_method, reference, created_by) VALUES (?, ?, ?, 'TRY', ?, ?, ?)", [`demo_payment_${index}`, folioId, payment, index === 1 ? 'credit_card' : 'cash', `DEMO-POS-${index}`, actorName]);
      await run("INSERT OR IGNORE INTO folio_transactions (id, folio_id, transaction_type, description, currency, credit, payment_method, related_reference, created_by) VALUES (?, ?, 'payment', 'Demo tahsilat', 'TRY', ?, ?, ?, ?)", [`demo_ftx_payment_${index}`, folioId, payment, index === 1 ? 'credit_card' : 'cash', `demo_payment_${index}`, actorName]);
    }
    await run("INSERT OR IGNORE INTO identity_notifications (id, stay_id, guest_id, notification_type, payload_snapshot, validation_status, status) VALUES (?, ?, ?, 'arrival', ?, 'valid', ?)", [`demo_kbs_${index}`, stayId, guestId, JSON.stringify({ demo: true, guest_id: guestId, arrival_date: reservation[3] }), index <= 2 ? 'accepted' : 'pending']);
  }

  await run("UPDATE rooms SET status = 'dirty_vacant', eta = 'Öncelikli temizlik', guest_name = '', dnd_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'room_05'", [actorName]);
  await run("UPDATE rooms SET status = 'cleaning', eta = 'Temizlik devam ediyor', guest_name = '', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'room_06'", [actorName]);
  await run("UPDATE rooms SET status = 'maintenance', eta = 'Teknik servis', guest_name = '', maintenance_notes = 'Klima kontrolü', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'room_07'", [actorName]);

  const tasks = [
    ['demo_task_reception_1', 'airport_transfer', 'Reception', 'room_03', 'demo_stay_3', 'open', 'high', 'Havalimanı transferi saat 18:30 için teyit edilecek'],
    ['demo_task_reception_2', 'late_checkout', 'Reception', 'room_01', 'demo_stay_1', 'open', 'normal', 'Geç çıkış talebi için fiyat onayı alınacak'],
    ['demo_task_hk_1', 'room_turn', 'Housekeeping', 'room_05', null, 'open', 'urgent', 'Oda 5 hızlı dönüş temizliği'],
    ['demo_task_hk_2', 'amenity', 'Housekeeping', 'room_03', 'demo_stay_3', 'in_progress', 'high', 'VIP meyve tabağı ve bornoz teslimi'],
    ['demo_task_hk_3', 'public_area', 'Housekeeping', null, null, 'open', 'normal', 'Lobi ve havuz çevresi akşam kontrolü'],
    ['demo_task_maint_1', 'technical_followup', 'Maintenance', 'room_07', null, 'open', 'high', 'Klima servis kaydı takip edilecek']
  ];
  for (const task of tasks) {
    await run("INSERT OR IGNORE INTO reception_tasks (id, task_type, department, room_id, stay_id, status, priority, due_at, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [...task.slice(0, 7), `${today} 20:00:00`, task[7], actorName]);
  }

  const areas = [['demo_area_lobby', 'Lobi', 'clean'], ['demo_area_pool', 'Havuz Çevresi', 'needs_cleaning'], ['demo_area_restroom', 'Ortak WC', 'inspection_due'], ['demo_area_beach', 'Plaj Alanı', 'clean']];
  for (const area of areas) await run("INSERT OR IGNORE INTO public_areas (id, name, status, last_cleaned_at, last_cleaned_by) VALUES (?, ?, ?, ?, ?)", [...area, timestamp, 'Housekeeping Staff']);
  await run("INSERT OR IGNORE INTO laundry_orders (id, room_id, guest_name, items, status, total_price) VALUES ('demo_laundry_1', 'room_02', 'Elif Kaya', '2 gömlek, 1 elbise', 'washing', 480)");
  await run("INSERT OR IGNORE INTO laundry_orders (id, room_id, guest_name, items, status, total_price) VALUES ('demo_laundry_2', 'room_03', 'James Walker', '3 gömlek ütü', 'ready', 360)");
  await run("INSERT OR IGNORE INTO lost_and_found (id, item_name, description, found_location, status, reported_by) VALUES ('demo_lost_1', 'Güneş gözlüğü', 'Siyah çerçeveli gözlük', 'Havuz', 'found', 'Housekeeping Staff')");
  await run("INSERT OR IGNORE INTO lost_and_found (id, item_name, description, found_location, status, reported_by) VALUES ('demo_lost_2', 'Şarj adaptörü', 'Beyaz USB-C adaptör', 'Oda 6', 'stored', 'Housekeeping Staff')");

  const assets = [['demo_asset_hvac', 'Merkezi Klima', 'hvac', 'Oda Bloku', 'HVAC-001', 'critical'], ['demo_asset_pool', 'Havuz Pompası', 'pool', 'Teknik Oda', 'POOL-001', 'high'], ['demo_asset_generator', 'Jeneratör', 'electrical', 'Arka Bahçe', 'GEN-001', 'critical']];
  for (const asset of assets) await run("INSERT OR IGNORE INTO technical_assets (id, name, category, location, asset_tag, criticality, notes) VALUES (?, ?, ?, ?, ?, ?, 'Demo bakım varlığı')", asset);
  await run("INSERT OR IGNORE INTO requests (id, type, department, target_identifier, status, details, created_by, departments) VALUES ('demo_req_maintenance_1', 'maintenance_request', 'Maintenance', 'Room-7', 'in_progress', ?, ?, '[\"Maintenance\"]')", [JSON.stringify({ category: 'hvac', priority: 'high', summary: 'Klima yeterince soğutmuyor' }), actorName]);
  await run("INSERT OR IGNORE INTO technical_work_orders (id, request_id, room_id, asset_id, category, priority, status, summary, due_at, assigned_to, started_at) VALUES ('demo_wo_1', 'demo_req_maintenance_1', 'room_07', 'demo_asset_hvac', 'hvac', 'high', 'in_progress', 'Klima yeterince soğutmuyor', ?, 'Maintenance', ?)", [`${tomorrow} 12:00:00`, timestamp]);
  await run("INSERT OR IGNORE INTO requests (id, type, department, target_identifier, status, details, created_by, departments) VALUES ('demo_req_maintenance_2', 'maintenance_request', 'Maintenance', 'Havuz Pompası · Teknik Oda', 'waiting_part', ?, ?, '[\"Maintenance\"]')", [JSON.stringify({ category: 'pool_public', priority: 'normal', summary: 'Pompa filtresi değişecek' }), actorName]);
  await run("INSERT OR IGNORE INTO technical_work_orders (id, request_id, asset_id, category, priority, status, summary, due_at, assigned_to) VALUES ('demo_wo_2', 'demo_req_maintenance_2', 'demo_asset_pool', 'pool_public', 'normal', 'waiting_part', 'Pompa filtresi değişecek', ?, 'Maintenance')", [`${inTwoDays} 15:00:00`]);
  await run("INSERT OR IGNORE INTO technical_maintenance_plans (id, asset_id, title, frequency_days, next_due_at, active, created_by) VALUES ('demo_plan_1', 'demo_asset_generator', 'Aylık jeneratör testi', 30, ?, 1, ?)", [inFiveDays, actorName]);
  await run("INSERT OR IGNORE INTO purchase_requests (id, item_name, quantity, status, requested_by, department, priority, notes) VALUES ('demo_purchase_1', 'Havuz pompası filtresi', 2, 'requested', ?, 'Technical', 'high', 'Demo bakım iş emri için')", [actorName]);

  const orders = [
    ['demo_order_ready', 'Restaurant', 'Table-Garden 2', 'ready', [{ itemId: 'menu_demo_grilled_seabass', name: 'Grilled Seabass', quantity: 2, price: 1250 }], 2500, 'credit_card', ['Restaurant', 'Kitchen']],
    ['demo_order_preparing', 'Restaurant', 'Table-Terrace 1', 'preparing', [{ itemId: 'menu_demo_beef_burger', name: 'Beef Burger', quantity: 2, price: 950 }, { itemId: 'menu_demo_garden_salad', name: 'Garden Salad', quantity: 1, price: 600 }], 2500, 'cash', ['Restaurant', 'Kitchen']],
    ['demo_order_room', 'Restaurant', 'Room-2', 'accepted', [{ itemId: 'menu_demo_caesar_salad', name: 'Caesar Salad', quantity: 1, price: 700 }], 700, 'room_charge', ['Restaurant', 'Kitchen', 'Reception']],
    ['demo_order_bar', 'Bar', 'Table-Bar 1', 'pending', [{ itemId: 'menu_demo_cappuccino', name: 'Cappuccino', quantity: 2, price: 210 }], 420, 'credit_card', ['Bar', 'Restaurant']],
    ['demo_waiter_call', 'Restaurant', 'Table-Garden 3', 'pending', [], 0, null, ['Restaurant']]
  ];
  for (const order of orders) {
    await run("INSERT OR IGNORE INTO requests (id, type, department, target_identifier, status, details, total_amount, payment_method, created_by, departments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [order[0], order[0] === 'demo_waiter_call' ? 'waiter_call' : 'order', order[1], order[2], order[3], JSON.stringify(order[4]), order[5], order[6], order[0] === 'demo_waiter_call' ? 'Misafir QR' : actorName, JSON.stringify(order[7])]);
  }
  await run("INSERT OR IGNORE INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, status, priority, ready_at) VALUES ('demo_ktl_1', 'demo_order_ready', 'menu_demo_grilled_seabass', 'Grilled Seabass', 2, 'kit_grill', 'ready', 'high', ?)", [timestamp]);
  await run("INSERT OR IGNORE INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, status, priority, started_at) VALUES ('demo_ktl_2', 'demo_order_preparing', 'menu_demo_beef_burger', 'Beef Burger', 2, 'kit_hot', 'preparing', 'normal', ?)", [timestamp]);
  await run("INSERT OR IGNORE INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, status, priority) VALUES ('demo_ktl_3', 'demo_order_preparing', 'menu_demo_garden_salad', 'Garden Salad', 1, 'kit_cold', 'pending', 'normal')");
  await run("INSERT OR IGNORE INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, status, priority) VALUES ('demo_ktl_4', 'demo_order_room', 'menu_demo_caesar_salad', 'Caesar Salad', 1, 'kit_cold', 'accepted', 'high')");
  await run("INSERT OR IGNORE INTO bar_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, unit_price, status) VALUES ('demo_btl_1', 'demo_order_bar', 'menu_demo_cappuccino', 'Cappuccino', 2, 210, 'pending')");
  await run("UPDATE tables SET status = 'occupied' WHERE table_number IN ('Garden 1', 'Garden 2', 'Terrace 1', 'Bar 1')");
  await run("UPDATE tables SET status = 'requested_service' WHERE table_number = 'Garden 3'");

  await run("INSERT OR IGNORE INTO vessel_visits (id, berth_id, vessel_name, vessel_type, loa_m, flag, captain_name, contact_phone, guest_count, arrival_date, departure_date, status, daily_rate, notes, updated_at) VALUES ('demo_visit_1', 'berth_b2', 'Blue Horizon', 'motor_yacht', 18.5, 'MT', 'Captain Marco', '+356 7000 0001', 6, ?, ?, 'checked_in', 650, 'VIP provisioning', CURRENT_TIMESTAMP)", [today, inThreeDays]);
  await run("INSERT OR IGNORE INTO vessel_visits (id, berth_id, vessel_name, vessel_type, loa_m, flag, captain_name, contact_phone, guest_count, arrival_date, departure_date, status, daily_rate, notes, updated_at) VALUES ('demo_visit_2', 'berth_a3', 'Sea Breeze', 'sailing', 13.2, 'GB', 'Captain Olivia', '+44 7700 900010', 4, ?, ?, 'checked_in', 390, 'Water and shore power', CURRENT_TIMESTAMP)", [yesterday, inTwoDays]);
  await run("UPDATE berths SET status = 'occupied' WHERE id IN ('berth_b2', 'berth_a3')");
  const ledger = [['demo_va_1', 650, 'EUR', 1, 'mooring', 'Blue Horizon günlük bağlama', 'demo_visit_1'], ['demo_va_2', 420, 'EUR', 1, 'provisioning', 'VIP kumanya paketi', 'demo_visit_1'], ['demo_va_3', 180, 'EUR', 1, 'fuel', 'Tender yakıt ikmali', 'demo_visit_1'], ['demo_va_4', 390, 'EUR', 1, 'mooring', 'Sea Breeze günlük bağlama', 'demo_visit_2'], ['demo_va_5', 85, 'EUR', 1, 'utilities', 'Su ve elektrik', 'demo_visit_2']];
  for (const row of ledger) await run("INSERT OR IGNORE INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path, vessel_visit_id) VALUES (?, ?, ?, ?, ?, ?, '', ?)", row);

  const extraInventory = [
    ['demo_hk_linen', 'Nevresim Takımı', 'set', 34, 40, 450, 'housekeeping'],
    ['demo_hk_towel', 'Banyo Havlusu', 'adet', 58, 60, 180, 'linen'],
    ['demo_tech_filter', 'Klima Filtresi', 'adet', 3, 5, 750, 'technical'],
    ['demo_bar_tonic', 'Premium Tonik', 'şişe', 14, 20, 55, 'bar'],
    ['demo_bar_wine', 'Beyaz Şarap', 'şişe', 9, 12, 480, 'bar']
  ];
  for (const item of extraInventory) await run("INSERT OR IGNORE INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type) VALUES (?, ?, ?, ?, ?, ?, ?)", item);
  await run("INSERT OR IGNORE INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance) VALUES ('demo_bar_audit_1', 'staff_manager', 'demo_bar_tonic', 16, 14, -2)");

  const logs = [
    ['demo_log_1', 'Reception', 'Check-in Tamamlandı', 'Oda 1 · Deniz Yılmaz'],
    ['demo_log_2', 'Reception', 'Tahsilat Alındı', 'Demo POS tahsilatı'],
    ['demo_log_3', 'Housekeeping Staff', 'Housekeeping görevi açıldı', 'Oda 5 hızlı dönüş temizliği'],
    ['demo_log_4', 'Waiter', 'Sipariş Oluşturuldu', 'Garden 2 · Grilled Seabass x2'],
    ['demo_log_5', 'Chef', 'Mutfak Siparişi Hazır', 'Garden 2 servise hazır'],
    ['demo_log_6', 'Maintenance', 'Teknik iş emri açıldı', 'Oda 7 klima kontrolü'],
    ['demo_log_7', 'Manager', 'Tekne Hesabı Kaydı', 'Blue Horizon provisioning'],
    ['demo_log_8', 'Manager', 'Demo Veri Paketi', 'Tüm operasyon portalları demo için dolduruldu']
  ];
  for (const log of logs) await run("INSERT OR IGNORE INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", log);

  for (const [id, imageUrl] of Object.entries(menuImages)) await run("UPDATE catalog_items SET image_url = ? WHERE id = ?", [imageUrl, id]);

  await run("DELETE FROM config WHERE key = 'DEMO_DATA_VERSION'");
  await run("INSERT INTO config (key, value) VALUES ('DEMO_DATA_VERSION', '2026-08-03-full-v2')");

  return summary;
}
