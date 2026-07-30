// Core AlaSQL schema DDL used by initSchema(). Kept as its own module purely so no single
// file in the codebase exceeds ~600 lines — this is a plain data export, not logic.
export const CORE_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_number TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'clean_vacant',
      eta TEXT,
      guest_name TEXT,
      dnd_active INTEGER DEFAULT 0,
      ac_status TEXT DEFAULT 'working',
      maintenance_notes TEXT DEFAULT '',
      updated_by TEXT,
      updated_at TIMESTAMP,
      vip INTEGER DEFAULT 0,
      late_checkout INTEGER DEFAULT 0,
      room_type TEXT DEFAULT 'standard',
      floor INTEGER DEFAULT 1,
      bed_type TEXT DEFAULT 'double',
      capacity INTEGER DEFAULT 2,
      base_rate REAL DEFAULT 0,
      view_type TEXT DEFAULT '',
      arrival_date TEXT,
      departure_date TEXT
    );

    CREATE TABLE IF NOT EXISTS public_areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'clean',
      last_cleaned_at TIMESTAMP,
      last_cleaned_by TEXT
    );

    CREATE TABLE IF NOT EXISTS guest_registry (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      car_plate TEXT,
      checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checked_out_at TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      table_number TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'empty',
      section TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock REAL NOT NULL DEFAULT 0.0,
      par_level REAL NOT NULL DEFAULT 0.0,
      unit_cost REAL DEFAULT 0.0,
      module_type TEXT NOT NULL,
      purchase_unit TEXT DEFAULT '',
      purchase_unit_amount REAL DEFAULT 0,
      sub_category TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      module_type TEXT NOT NULL,
      in_stock BOOLEAN DEFAULT 1,
      image_url TEXT DEFAULT '',
      bar_category TEXT DEFAULT 'Genel',
      description TEXT DEFAULT '',
      ingredients TEXT DEFAULT '',
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_receipts (
      id TEXT PRIMARY KEY,
      receipt_number TEXT NOT NULL,
      vendor TEXT,
      total_amount REAL NOT NULL DEFAULT 0.0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_receipt_items (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id),
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      catalog_item_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      amount_needed REAL NOT NULL,
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id),
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS kitchen_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS menu_kitchen_profiles (
      catalog_item_id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      course TEXT DEFAULT 'main',
      allergens TEXT DEFAULT '',
      prep_minutes INTEGER DEFAULT 15,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id),
      FOREIGN KEY (station_id) REFERENCES kitchen_stations(id)
    );

    CREATE TABLE IF NOT EXISTS kitchen_ticket_lines (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      catalog_item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      station_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      course TEXT DEFAULT 'main',
      modifiers TEXT DEFAULT '',
      allergen_notes TEXT DEFAULT '',
      priority TEXT DEFAULT 'normal',
      fire_count INTEGER DEFAULT 0,
      started_at TIMESTAMP,
      ready_at TIMESTAMP,
      completed_by TEXT,
      line_ref TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id),
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id),
      FOREIGN KEY (station_id) REFERENCES kitchen_stations(id)
    );

    CREATE TABLE IF NOT EXISTS bar_ticket_lines (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      catalog_item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TIMESTAMP,
      ready_at TIMESTAMP,
      completed_by TEXT,
      line_ref TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id),
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id)
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      station TEXT NOT NULL,
      request_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      payload TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      printed_at TIMESTAMP,
      printed_by TEXT,
      error_message TEXT,
      FOREIGN KEY (request_id) REFERENCES requests(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_lots (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL,
      supplier TEXT,
      lot_code TEXT,
      expires_on TEXT,
      received_quantity REAL NOT NULL,
      remaining_quantity REAL NOT NULL,
      received_temperature REAL,
      received_by TEXT NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS kitchen_waste_logs (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS kitchen_temperature_logs (
      id TEXT PRIMARY KEY,
      area TEXT NOT NULL,
      temperature REAL NOT NULL,
      corrective_action TEXT,
      recorded_by TEXT NOT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kitchen_stock_counts (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'open',
      opened_by TEXT NOT NULL,
      approved_by TEXT,
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kitchen_stock_count_lines (
      id TEXT PRIMARY KEY,
      count_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      expected_quantity REAL NOT NULL,
      counted_quantity REAL NOT NULL,
      variance REAL NOT NULL,
      FOREIGN KEY (count_id) REFERENCES kitchen_stock_counts(id),
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      department TEXT DEFAULT 'General',
      priority TEXT DEFAULT 'normal',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technical_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      asset_tag TEXT,
      status TEXT DEFAULT 'active',
      criticality TEXT DEFAULT 'normal',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technical_work_orders (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      room_id TEXT,
      asset_id TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'reported',
      summary TEXT NOT NULL,
      due_at TEXT,
      assigned_to TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      resolution TEXT,
      labor_minutes INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (asset_id) REFERENCES technical_assets(id)
    );

    CREATE TABLE IF NOT EXISTS technical_work_order_parts (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      used_by TEXT NOT NULL,
      used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_order_id) REFERENCES technical_work_orders(id),
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS technical_maintenance_plans (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      title TEXT NOT NULL,
      frequency_days INTEGER NOT NULL,
      next_due_at TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES technical_assets(id)
    );

    CREATE TABLE IF NOT EXISTS technical_meter_readings (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      recorded_by TEXT NOT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES technical_assets(id)
    );

    CREATE TABLE IF NOT EXISTS housekeeping_inspections (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      checklist TEXT NOT NULL,
      notes TEXT,
      inspected_by TEXT NOT NULL,
      inspected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS housekeeping_linen_counts (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL,
      counted_quantity REAL NOT NULL,
      notes TEXT,
      counted_by TEXT NOT NULL,
      counted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      department TEXT DEFAULT 'Reception',
      target_identifier TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      total_amount REAL DEFAULT 0.0,
      payment_method TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      created_by TEXT,
      completed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT DEFAULT 'Reception',
      pin TEXT NOT NULL UNIQUE,
      pin_encrypted TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT,
      tenant TEXT,
      http_method TEXT,
      normalized_path TEXT,
      request_body_hash TEXT,
      response_status INTEGER,
      response_body TEXT,
      expires_at BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      -- Backwards compatibility columns for modules/dining.js
      operation TEXT,
      request_hash TEXT,
      response_json TEXT
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      subscription TEXT NOT NULL,
      staff_id TEXT,
      staff_name TEXT,
      role TEXT,
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      staff_name TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bar_blind_audits (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      physical_amount REAL NOT NULL,
      variance REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS apa_ledger (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      exchange_rate_to_eur REAL DEFAULT 1.0,
      category TEXT NOT NULL,
      description TEXT,
      receipt_image_path TEXT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      discount_rate REAL NOT NULL,
      catalog_item_id TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id)
    );

    CREATE TABLE IF NOT EXISTS folios (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      type TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      id_number TEXT,
      nationality TEXT DEFAULT 'TR',
      arrival_date TEXT,
      departure_date TEXT,
      adult_count INTEGER DEFAULT 1,
      child_count INTEGER DEFAULT 0,
      car_plate TEXT,
      daily_rate REAL DEFAULT 0,
      booking_source TEXT,
      special_notes TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  `;
