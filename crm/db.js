import alasql from 'alasql';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.CRM_DATA_PATH || join(__dirname, 'crm_data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getSavePath() {
  return join(dataDir, 'crm_alasql.json');
}

export function hashPassword(password) {
  return `sha256:${crypto.createHash('sha256').update(String(password)).digest('hex')}`;
}

const SCHEMA = `
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
`;

class CrmDb {
  constructor(db) {
    this.db = db;
  }

  normalizeSql(sql) {
    if (!sql) return '';
    let normalized = sql
      .replace(/,\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*[a-zA-Z0-9_]*\([^)]*\)/gi, '')
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/AUTOINCREMENT/gi, '');
    normalized = normalized.replace(/\b(?<!PRIMARY\s+|FOREIGN\s+)(key|value)\b/gi, '[$1]');
    return normalized;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec(this.normalizeSql(sql), params);
        if (/insert|update|delete|replace|create|drop|alter/i.test(sql)) {
          this.persist();
        }
        resolve({ changes: 1 });
      } catch (err) {
        reject(err);
      }
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const res = this.db.exec(this.normalizeSql(sql), params);
        resolve(res && res.length > 0 ? res[0] : null);
      } catch (err) {
        reject(err);
      }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const res = this.db.exec(this.normalizeSql(sql), params);
        resolve(res || []);
      } catch (err) {
        reject(err);
      }
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      try {
        const queries = sql.split(';').map(q => q.trim()).filter(Boolean);
        for (const query of queries) {
          this.db.exec(this.normalizeSql(query));
        }
        if (!this.persistSuppressed && /insert|update|delete|replace|create|drop|alter/i.test(sql)) {
          this.persist();
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  persist() {
    const tables = ['config', 'users', 'firms', 'contacts', 'leads', 'opportunities', 'offers', 'offer_items', 'activities', 'tasks', 'sessions', 'integration_logs', 'campaigns', 'campaign_contacts', 'followups'];
    const dump = {};
    for (const table of tables) {
      try {
        dump[table] = this.db.exec(`SELECT * FROM [${table}]`);
      } catch (e) {
        // table might not exist yet
      }
    }
    fs.writeFileSync(getSavePath(), JSON.stringify(dump, null, 2), 'utf8');
  }

  load() {
    const savePath = getSavePath();
    if (!fs.existsSync(savePath)) return;
    try {
      const dump = JSON.parse(fs.readFileSync(savePath, 'utf8'));
      const wasSuppressed = this.persistSuppressed;
      this.persistSuppressed = true;
      for (const [table, rows] of Object.entries(dump)) {
        try {
          this.db.exec(`DELETE FROM [${table}]`);
        } catch (e) {
          continue;
        }
        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const sql = `INSERT INTO [${table}] (${keys.map(k => `[${k}]`).join(', ')}) VALUES (${placeholders})`;
          try {
            this.db.exec(sql, Object.values(row));
          } catch (e) {
            // ignore row-level conflicts
          }
        }
      }
      this.persistSuppressed = wasSuppressed;
    } catch (e) {
      console.error('CRM veri yükleme hatası:', e.message);
    }
  }
}

async function seedDefaults(db) {
  const cfg = await db.get("SELECT COUNT(*) AS cnt FROM config");
  if (Number(cfg?.cnt || 0) === 0) {
    const stages = ['inquiry', 'option', 'offer', 'negotiation', 'won', 'lost'];
    await db.run("INSERT INTO config (key, value) VALUES ('pipeline_stages', ?)", [JSON.stringify(stages)]);
    await db.run("INSERT INTO config (key, value) VALUES ('currencies', ?)", [JSON.stringify(['EUR', 'USD', 'TRY'])]);
    await db.run("INSERT INTO config (key, value) VALUES ('firm_types', ?)", [JSON.stringify(['direkt', 'acente', 'kurumsal'])]);
    await db.run("INSERT INTO config (key, value) VALUES ('lead_sources', ?)", [JSON.stringify(['web', 'telefon', 'email', 'acente', 'walk_in', 'otel', 'referans', 'sosyal_medya'])]);
    await db.run("INSERT INTO config (key, value) VALUES ('activity_types', ?)", [JSON.stringify(['call', 'email', 'meeting', 'note', 'whatsapp'])]);
    await db.run("INSERT INTO config (key, value) VALUES ('lost_reasons', ?)", [JSON.stringify(['fiyat', 'tarih', 'musaitlik', 'rakip', 'cevap_yok', 'diget'])]);
  }

  const admin = await db.get("SELECT COUNT(*) AS cnt FROM users");
  if (Number(admin?.cnt || 0) === 0) {
    const email = process.env.CRM_ADMIN_EMAIL || 'admin@aeon.local';
    const password = process.env.CRM_ADMIN_PASSWORD || 'admin123';
    await db.run(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      ['usr_admin', 'Sistem Yöneticisi', email, hashPassword(password), 'yönetici']
    );
    console.log(`CRM varsayılan yönetici: ${email} / ${password}`);
  }
}

async function runMigrations(db) {
  const newOfferColumns = ['check_in TEXT', 'check_out TEXT', 'nights INTEGER', 'guests INTEGER', 'room_type TEXT', 'board_type TEXT', 'commission_rate REAL DEFAULT 0'];
  for (const col of newOfferColumns) {
    try {
      await db.run(`ALTER TABLE offers ADD COLUMN ${col}`);
    } catch (e) { /* zaten var */ }
  }
  const newOppColumns = ['erp_reservation_id TEXT', 'erp_reservation_no TEXT', 'erp_status TEXT', 'integration_status TEXT', 'erp_check_in TEXT', 'erp_check_out TEXT', 'erp_total_amount REAL', 'erp_currency TEXT'];
  for (const col of newOppColumns) {
    try {
      await db.run(`ALTER TABLE opportunities ADD COLUMN ${col}`);
    } catch (e) { /* zaten var */ }
  }
  const newLogColumns = ['response TEXT', 'opportunity_id TEXT'];
  for (const col of newLogColumns) {
    try {
      await db.run(`ALTER TABLE integration_logs ADD COLUMN ${col}`);
    } catch (e) { /* zaten var */ }
  }
  const newContactColumns = ['vip INTEGER DEFAULT 0', 'segment TEXT DEFAULT \'direkt\'', 'preferences TEXT', 'allergies TEXT', 'birthday TEXT'];
  for (const col of newContactColumns) {
    try {
      await db.run(`ALTER TABLE contacts ADD COLUMN ${col}`);
    } catch (e) { /* zaten var */ }
  }
}

let connectionPromise = null;

export async function getCrmDb() {
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    const raw = new alasql.Database();
    const db = new CrmDb(raw);
    db.persistSuppressed = true;
    db.exec(SCHEMA);
    await runMigrations(db);
    db.load();
    db.persistSuppressed = false;
    await seedDefaults(db);
    return db;
  })();
  return connectionPromise;
}
