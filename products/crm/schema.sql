CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'satis',
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS firms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'direkt',
    tax_number TEXT,
    phone TEXT,
    email TEXT,
    country TEXT,
    city TEXT,
    website TEXT,
    commission_rate REAL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    firm_id TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    title TEXT,
    phone TEXT,
    email TEXT,
    is_primary INTEGER DEFAULT 0,
    kvkk_consent INTEGER DEFAULT 0,
    marketing_consent INTEGER DEFAULT 0,
    vip INTEGER DEFAULT 0,
    segment TEXT DEFAULT 'direkt',
    preferences TEXT,
    allergies TEXT,
    birthday TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    firm_id TEXT,
    contact_id TEXT,
    source TEXT NOT NULL DEFAULT 'web',
    owner_id TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    lead_id TEXT,
    firm_id TEXT,
    contact_id TEXT,
    title TEXT NOT NULL,
    pipeline_stage TEXT NOT NULL DEFAULT 'inquiry',
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    owner_id TEXT,
    source TEXT,
    close_date TEXT,
    lost_reason TEXT,
    notes TEXT,
    erp_reservation_id TEXT,
    erp_reservation_no TEXT,
    erp_status TEXT,
    integration_status TEXT,
    erp_check_in TEXT,
    erp_check_out TEXT,
    erp_total_amount REAL,
    erp_currency TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    currency TEXT DEFAULT 'EUR',
    discount_rate REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    valid_until TEXT,
    check_in TEXT,
    check_out TEXT,
    nights INTEGER,
    guests INTEGER,
    room_type TEXT,
    board_type TEXT,
    commission_rate REAL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS offer_items (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'konaklama',
    description TEXT NOT NULL,
    qty REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT,
    contact_id TEXT,
    type TEXT NOT NULL DEFAULT 'note',
    subject TEXT NOT NULL,
    notes TEXT,
    owner_id TEXT,
    activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    due_date TEXT,
    owner_id TEXT,
    related_type TEXT,
    related_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS integration_logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    response TEXT,
    retry_count INTEGER DEFAULT 0,
    opportunity_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT 'direkt',
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at TEXT,
    sent_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaign_contacts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT,
    contact_id TEXT,
    firm_id TEXT,
    type TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'pending',
    erp_reservation_no TEXT,
    due_date TEXT,
    notes TEXT,
    owner_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
  );
