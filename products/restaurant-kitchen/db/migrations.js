import { seedDefaultStaff, hashUnhashedPins } from './master-data.js';

export async function runMigrations(db, tenantId) {
  // Safe migrations, AlaSQL handles try/catch
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS public_areas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'clean',
        last_cleaned_at TIMESTAMP,
        last_cleaned_by TEXT
      )
    `);
  } catch (e) {
    console.error("Migration error creating public_areas table:", e);
  }

  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN image_url TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN bar_category TEXT DEFAULT 'Genel'");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN description TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN ingredients TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN calories REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN protein REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN carbs REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE catalog_items ADD COLUMN fat REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE inventory ADD COLUMN purchase_unit TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE inventory ADD COLUMN purchase_unit_amount REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE inventory ADD COLUMN sub_category TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE requests ADD COLUMN completed_at TIMESTAMP");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE requests ADD COLUMN created_by TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE requests ADD COLUMN completed_by TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE requests ADD COLUMN departments TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE kitchen_ticket_lines ADD COLUMN fire_count INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE kitchen_ticket_lines ADD COLUMN started_at TIMESTAMP");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE kitchen_ticket_lines ADD COLUMN ready_at TIMESTAMP");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE kitchen_ticket_lines ADD COLUMN completed_by TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE kitchen_ticket_lines ADD COLUMN line_ref TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE bar_ticket_lines ADD COLUMN line_ref TEXT");
  } catch (e) {}
  try {
    await db.exec(`
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
      )
    `);
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN ac_status TEXT DEFAULT 'working'");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN maintenance_notes TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN updated_by TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE guest_registry ADD COLUMN board_type TEXT DEFAULT 'BB'");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE guest_registry ADD COLUMN special_occasion TEXT DEFAULT ''");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN board_type TEXT DEFAULT 'BB'");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN special_occasion TEXT DEFAULT ''");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN updated_at TIMESTAMP");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN vip INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN late_checkout INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN room_type TEXT DEFAULT 'standard'");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN floor INTEGER DEFAULT 1");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN bed_type TEXT DEFAULT 'double'");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN capacity INTEGER DEFAULT 2");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN base_rate REAL DEFAULT 0");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN view_type TEXT DEFAULT ''");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN arrival_date TEXT");
  } catch(e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN departure_date TEXT");
  } catch(e) {}

  try {
    await db.run(`
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
      )
    `);
  } catch (e) {}

  try {
    await db.run(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {}
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        subscription TEXT NOT NULL,
        staff_id TEXT,
        staff_name TEXT,
        role TEXT,
        department TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {}

  try {
    await db.run("ALTER TABLE push_subscriptions ADD COLUMN department TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN expected_checkout TIMESTAMP");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE rooms ADD COLUMN pax INTEGER DEFAULT 1");
  } catch (e) {}

  await ensureReceptionSchema(db);

  await seedDefaultStaff(db);
  await hashUnhashedPins(db);
}

export async function ensureReceptionSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pms_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS guest_profiles (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, identity_number TEXT, passport_number TEXT, document_type TEXT, nationality TEXT DEFAULT 'TR', date_of_birth TEXT, gender TEXT, phone TEXT, email TEXT, address TEXT, vehicle_plate TEXT, language TEXT, preferences TEXT, allergies TEXT, vip INTEGER DEFAULT 0, restricted INTEGER DEFAULT 0, restriction_reason TEXT, kvkk_notice_at TEXT, marketing_consent INTEGER DEFAULT 0, version INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, reservation_number TEXT NOT NULL UNIQUE, status TEXT NOT NULL, arrival_date TEXT NOT NULL, departure_date TEXT NOT NULL, nights INTEGER NOT NULL, adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0, child_ages TEXT, room_type TEXT, room_id TEXT, board_type TEXT DEFAULT 'BB', nightly_rate REAL DEFAULT 0, currency TEXT DEFAULT 'TRY', tax_amount REAL DEFAULT 0, discount_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0, deposit_amount REAL DEFAULT 0, booking_source TEXT, agency TEXT, voucher_number TEXT, guarantee_type TEXT, payment_method TEXT, main_guest_id TEXT, contact_phone TEXT, contact_email TEXT, arrival_info TEXT, special_requests TEXT, internal_notes TEXT, guest_notes TEXT, cancellation_reason TEXT, version INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS guest_precheckins (id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL, payload TEXT NOT NULL, submitted_at TIMESTAMP, reviewed_at TIMESTAMP, reviewed_by TEXT, expires_at TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS guest_precheckin_submissions (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'submitted', payload TEXT NOT NULL, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP, reviewed_by TEXT, created_guest_id TEXT, reservation_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reservation_guests (id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL, guest_id TEXT NOT NULL, is_main INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS room_assignments (id TEXT PRIMARY KEY, reservation_id TEXT, stay_id TEXT, room_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL, override_reason TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT, ended_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS stays (id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL, room_id TEXT NOT NULL, folio_id TEXT, status TEXT NOT NULL, checkin_at TIMESTAMP, checkout_at TIMESTAMP, business_date TEXT, board_type TEXT, nightly_rate REAL DEFAULT 0, currency TEXT DEFAULT 'TRY', adults INTEGER DEFAULT 1, children INTEGER DEFAULT 0, version INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS stay_guests (id TEXT PRIMARY KEY, stay_id TEXT NOT NULL, guest_id TEXT NOT NULL, is_main INTEGER DEFAULT 0, checked_out_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS folio_transactions (id TEXT PRIMARY KEY, folio_id TEXT NOT NULL, occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, transaction_type TEXT NOT NULL, description TEXT NOT NULL, quantity REAL DEFAULT 1, unit_amount REAL DEFAULT 0, tax_amount REAL DEFAULT 0, currency TEXT DEFAULT 'TRY', exchange_rate REAL DEFAULT 1, debit REAL DEFAULT 0, credit REAL DEFAULT 0, payment_method TEXT, department TEXT, related_reference TEXT, reversal_of TEXT, reason TEXT, created_by TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, folio_id TEXT NOT NULL, amount REAL NOT NULL, currency TEXT DEFAULT 'TRY', payment_method TEXT NOT NULL, exchange_rate REAL DEFAULT 1, received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, reference TEXT, split_group TEXT, created_by TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, folio_id TEXT NOT NULL, reservation_id TEXT, guest_id TEXT, status TEXT NOT NULL, issue_date TEXT NOT NULL, customer_name TEXT NOT NULL, customer_tax_number TEXT, customer_tax_office TEXT, customer_address TEXT, customer_email TEXT, currency TEXT DEFAULT 'TRY', subtotal REAL DEFAULT 0, tax_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0, notes TEXT, snapshot TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, cancelled_at TIMESTAMP, cancelled_by TEXT, cancellation_reason TEXT);
    CREATE TABLE IF NOT EXISTS invoice_items (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, description TEXT NOT NULL, quantity REAL DEFAULT 1, unit_amount REAL DEFAULT 0, tax_rate REAL DEFAULT 0, tax_amount REAL DEFAULT 0, total_amount REAL DEFAULT 0, source_transaction_id TEXT);
    CREATE TABLE IF NOT EXISTS cash_shifts (id TEXT PRIMARY KEY, status TEXT NOT NULL, business_date TEXT NOT NULL, opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP, opening_cash REAL DEFAULT 0, closing_cash REAL, expected_cash REAL, difference_amount REAL, difference_reason TEXT, handover_notes TEXT, opened_by TEXT NOT NULL, closed_by TEXT, approved_by TEXT);
    CREATE TABLE IF NOT EXISTS reception_tasks (id TEXT PRIMARY KEY, task_type TEXT NOT NULL, department TEXT NOT NULL, room_id TEXT, stay_id TEXT, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', due_at TIMESTAMP, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP, created_by TEXT NOT NULL, completed_by TEXT);
    CREATE TABLE IF NOT EXISTS identity_notifications (id TEXT PRIMARY KEY, stay_id TEXT NOT NULL, guest_id TEXT NOT NULL, notification_type TEXT NOT NULL, payload_snapshot TEXT NOT NULL, validation_status TEXT NOT NULL, status TEXT NOT NULL, submitted_at TIMESTAMP, response_reference TEXT, error_code TEXT, error_message TEXT, retry_count INTEGER DEFAULT 0, submitted_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS documents_metadata (id TEXT PRIMARY KEY, reservation_id TEXT, guest_id TEXT, document_type TEXT NOT NULL, filename TEXT NOT NULL, storage_reference TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, before_data TEXT, after_data TEXT, reason TEXT, actor_id TEXT, actor_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS room_status_history (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, previous_status TEXT, next_status TEXT NOT NULL, reason TEXT, actor_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS room_blocks (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, block_type TEXT NOT NULL, reason TEXT, status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT);
    CREATE TABLE IF NOT EXISTS night_audits (id TEXT PRIMARY KEY, business_date TEXT NOT NULL UNIQUE, status TEXT NOT NULL, posted_at TIMESTAMP, posted_by TEXT, summary TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS channel_connections (id TEXT PRIMARY KEY, provider TEXT NOT NULL UNIQUE, property_id TEXT, enabled INTEGER DEFAULT 0, connection_status TEXT DEFAULT 'not_configured', sync_mode TEXT DEFAULT 'push_pull', last_sync_at TIMESTAMP, last_success_at TIMESTAMP, last_error TEXT, metadata TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS channel_room_mappings (id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_inv_code TEXT NOT NULL, external_rate_code TEXT, external_name TEXT, local_room_type TEXT, local_room_id TEXT, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS channel_reservation_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_reservation_id TEXT NOT NULL, external_room_id TEXT, message_uid TEXT, event_type TEXT NOT NULL, external_state TEXT, payload_hash TEXT NOT NULL, payload_snapshot TEXT NOT NULL, processing_status TEXT NOT NULL, reservation_id TEXT, error_message TEXT, received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMP, acknowledged_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS channel_reservation_links (id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_reservation_id TEXT NOT NULL, external_room_id TEXT NOT NULL, reservation_id TEXT NOT NULL, last_external_update TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS channel_sync_operations (id TEXT PRIMARY KEY, provider TEXT NOT NULL, direction TEXT NOT NULL, operation_type TEXT NOT NULL, entity_reference TEXT, transaction_id TEXT, status TEXT NOT NULL, attempts INTEGER DEFAULT 0, request_snapshot TEXT, response_snapshot TEXT, error_message TEXT, next_retry_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS channel_notifications (id TEXT PRIMARY KEY, provider TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, entity_type TEXT, entity_id TEXT, status TEXT DEFAULT 'unread', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, read_at TIMESTAMP, read_by TEXT);
    CREATE TABLE IF NOT EXISTS channel_cache (id TEXT PRIMARY KEY, provider TEXT NOT NULL, cache_key TEXT NOT NULL, payload TEXT NOT NULL, expires_at TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  try { await db.run('ALTER TABLE reservations ADD COLUMN precheckin_token TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN precheckin_expires_at TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN payment_due_date TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN payment_reminder TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT \'pending\''); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN external_provider TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN external_reservation_id TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN external_room_id TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN channel_sync_status TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN channel_last_update TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE guest_precheckin_submissions ADD COLUMN reservation_id TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN source_system TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN source_id TEXT'); } catch (error) {}
  try { await db.run('ALTER TABLE reservations ADD COLUMN crm_idempotency_key TEXT'); } catch (error) {}
}
