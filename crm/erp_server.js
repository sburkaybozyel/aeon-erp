// AEON ERP Sandbox — CRM entegrasyon testleri için gerçek AEON ERP API'sini simüle eder.
// Gerçek AEON'a geçişte CRM istemcisinin ERP_API_URL değeri değiştirilir; istemci değişmez.
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import alasql from 'alasql';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.ERP_DATA_PATH || join(__dirname, 'erp_data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const savePath = join(dataDir, 'erp_alasql.json');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS room_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_rate REAL NOT NULL,
    capacity INTEGER DEFAULT 2,
    board_options TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    reservation_no TEXT NOT NULL,
    source_system TEXT,
    source_id TEXT,
    idempotency_key TEXT UNIQUE,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    firm_name TEXT,
    check_in TEXT,
    check_out TEXT,
    nights INTEGER,
    room_type TEXT,
    board_type TEXT,
    guests INTEGER,
    currency TEXT DEFAULT 'EUR',
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'inquiry',
    guarantee_deadline TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stays (
    id TEXT PRIMARY KEY,
    reservation_id TEXT,
    checked_in_at TIMESTAMP,
    checked_out_at TIMESTAMP,
    status TEXT DEFAULT 'expected'
  );
`;

class ErpDb {
  constructor(db) { this.db = db; }

  normalizeSql(sql) {
    let s = String(sql || '')
      .replace(/,?\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*[a-zA-Z0-9_]*\([^)]*\)/gi, '')
      .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/\b(?<!PRIMARY\s+|FOREIGN\s+)(key|value)\b/gi, '[$1]');
    return s;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec(this.normalizeSql(sql), params);
        if (/insert|update|delete|replace|create|drop|alter/i.test(sql)) this.persist();
        resolve({ changes: 1 });
      } catch (err) { reject(err); }
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const res = this.db.exec(this.normalizeSql(sql), params);
        resolve(res && res.length ? res[0] : null);
      } catch (err) { reject(err); }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.db.exec(this.normalizeSql(sql), params) || []);
      } catch (err) { reject(err); }
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      try {
        const queries = String(sql).split(';').map(q => q.trim()).filter(Boolean);
        for (const q of queries) this.db.exec(this.normalizeSql(q));
        if (/insert|update|delete|replace|create|drop|alter/i.test(sql)) this.persist();
        resolve();
      } catch (err) { reject(err); }
    });
  }

  persist() {
    const dump = {};
    for (const table of ['room_types', 'reservations', 'stays']) {
      try { dump[table] = this.db.exec(`SELECT * FROM [${table}]`); } catch (e) {}
    }
    fs.writeFileSync(savePath, JSON.stringify(dump, null, 2), 'utf8');
  }

  load() {
    if (!fs.existsSync(savePath)) return;
    try {
      const dump = JSON.parse(fs.readFileSync(savePath, 'utf8'));
      for (const [table, rows] of Object.entries(dump)) {
        try { this.db.exec(`DELETE FROM [${table}]`); } catch (e) { continue; }
        for (const row of rows) {
          const keys = Object.keys(row);
          const sql = `INSERT INTO [${table}] (${keys.map(k => `[${k}]`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
          try { this.db.exec(sql, Object.values(row)); } catch (e) {}
        }
      }
    } catch (e) { console.error('ERP sandbox veri yükleme hatası:', e.message); }
  }
}

function uid(prefix = 'erp') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function computeNights(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function isoNow(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function genReservationNo() {
  return `AE-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
}

async function seedErp(db) {
  const cnt = await db.get("SELECT COUNT(*) AS cnt FROM room_types");
  if (Number(cnt?.cnt || 0) === 0) {
    const rooms = [
      { id: 'rt_std', name: 'Standart Oda', base_rate: 90, capacity: 2, board_options: 'BB,HB' },
      { id: 'rt_dlx', name: 'Deluxe Oda', base_rate: 150, capacity: 3, board_options: 'BB,HB,FB,AI' },
      { id: 'rt_suit', name: 'Suit', base_rate: 240, capacity: 4, board_options: 'BB,HB,FB,AI,UAI' }
    ];
    for (const r of rooms) {
      await db.run("INSERT INTO room_types (id, name, base_rate, capacity, board_options) VALUES (?, ?, ?, ?, ?)", [r.id, r.name, r.base_rate, r.capacity, r.board_options]);
    }
  }
}

function boardMultiplier(board) {
  return { BB: 1, HB: 1.2, FB: 1.4, AI: 1.7, UAI: 1.9 }[board] || 1;
}

async function priceFor(db, roomId, board, nights, currency) {
  const room = await db.get("SELECT * FROM room_types WHERE id = ?", [roomId]);
  if (!room) return null;
  const base = Number(room.base_rate) * boardMultiplier(board) * (nights || 1);
  const fx = { EUR: 1, USD: 1.08, TRY: 40 }[currency] || 1;
  return { base_rate: Number(room.base_rate), nightly: Number((Number(room.base_rate) * boardMultiplier(board)).toFixed(2)), total: Number((base * fx).toFixed(2)), currency, room_name: room.name };
}

export async function createErpApp() {
  const app = express();
  app.use(express.json());

  const raw = new alasql.Database();
  const db = new ErpDb(raw);
  await db.exec(SCHEMA);
  await seedErp(db);
  db.load();

  app.get('/api/erp/health', (req, res) => {
    res.json({ ok: true, system: 'aeon-erp-sandbox', time: new Date().toISOString() });
  });

  app.get('/api/erp/room-types', async (req, res) => {
    const rows = await db.all("SELECT id, name, base_rate, capacity, board_options FROM room_types");
    res.json(rows);
  });

  // Müsaitlik ve fiyat sorgulama (CRM Faz 3: ERP'den fiyat/müsaitlik)
  app.post('/api/erp/availability', async (req, res) => {
    const { check_in, check_out, room_type, board, guests, currency } = req.body;
    if (!check_in || !check_out) return res.status(400).json({ error: 'check_in ve check_out zorunludur.' });
    const nights = computeNights(check_in, check_out);
    if (!nights || nights < 1) return res.status(400).json({ error: 'Geçersiz tarih aralığı.' });

    const rooms = await db.all("SELECT * FROM room_types");
    // Aynı tarih aralığında çakışan rezervasyon varsa oda tipi doludur (basit simülasyon)
    const conflicting = await db.all(
      "SELECT room_type FROM reservations WHERE status IN ('option','confirmed') AND check_out > ? AND check_in < ?",
      [check_in, check_out]
    );
    const busy = new Set(conflicting.map(r => r.room_type));
    const room = rooms.find(r => r.id === room_type) || rooms[0];
    const available = !busy.has(room.id);
    const price = await priceFor(db, room.id, board, nights, currency);
    res.json({
      available,
      room_type: room.id,
      room_name: room.name,
      nights,
      board: board || 'BB',
      guests: guests || 2,
      currency: price.currency,
      nightly: price.nightly,
      total: price.total,
      base_rate: price.base_rate,
      message: available ? 'Müsait' : `Bu tarih aralığında ${room.name} dolu.`
    });
  });

  // CRM'den rezervasyon oluşturma — idempotent (source_system + source_id)
  app.post('/api/erp/reservations', async (req, res) => {
    const body = req.body || {};
    if (!body.source_system || !body.source_id) return res.status(400).json({ error: 'source_system ve source_id zorunludur.' });
    try {
      const existing = await db.get("SELECT * FROM reservations WHERE source_system = ? AND source_id = ?", [body.source_system, body.source_id]);
      if (existing) return res.json({ duplicate: true, ...present(existing) });

      const nights = computeNights(body.check_in, body.check_out);
      const price = await priceFor(db, body.room_type || 'rt_std', body.board_type || 'BB', nights || 1, body.currency || 'EUR');
      const id = uid('res');
      const no = genReservationNo();
      const status = body.status || 'inquiry'; // roadmap: varsayılan inquiry/option
      const guaranteeDeadline = body.guarantee_deadline || (status === 'option' ? isoNow(2) : null);
      await db.run(
        "INSERT INTO reservations (id, reservation_no, source_system, source_id, idempotency_key, guest_name, guest_email, guest_phone, firm_name, check_in, check_out, nights, room_type, board_type, guests, currency, total_amount, status, guarantee_deadline, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, no, body.source_system, body.source_id, body.idempotency_key || null, body.guest_name || null, body.guest_email || null, body.guest_phone || null, body.firm_name || null, body.check_in || null, body.check_out || null, nights, body.room_type || 'rt_std', body.board_type || 'BB', Number(body.guests) || 2, body.currency || 'EUR', Number(body.total_amount) || price?.total || 0, status, guaranteeDeadline, body.notes || null]);
      const row = await db.get("SELECT * FROM reservations WHERE id = ?", [id]);
      res.status(201).json(present(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/erp/reservations/:id', async (req, res) => {
    const row = await db.get("SELECT * FROM reservations WHERE id = ? OR reservation_no = ?", [req.params.id, req.params.id]);
    if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    const stay = await db.get("SELECT * FROM stays WHERE reservation_id = ?", [row.id]);
    res.json({ ...present(row), stay: stay || null });
  });

  app.patch('/api/erp/reservations/:id', async (req, res) => {
    const row = await db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    const allowed = ['status', 'total_amount', 'guarantee_deadline', 'guest_name', 'guest_email', 'guest_phone', 'firm_name', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(row.id);
    await db.run(`UPDATE reservations SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await db.get("SELECT * FROM reservations WHERE id = ?", [row.id]);
    res.json(present(updated));
  });

  app.post('/api/erp/reservations/:id/check-in', async (req, res) => {
    const row = await db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    await db.run("INSERT INTO stays (id, reservation_id, checked_in_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'in_house')", [uid('stay'), row.id]);
    await db.run("UPDATE reservations SET status = 'in_house', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
    res.json({ success: true });
  });

  app.post('/api/erp/reservations/:id/check-out', async (req, res) => {
    const row = await db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    await db.run("UPDATE stays SET checked_out_at = CURRENT_TIMESTAMP, status = 'checked_out' WHERE reservation_id = ?", [row.id]);
    await db.run("UPDATE reservations SET status = 'checked_out', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
    res.json({ success: true });
  });

  app.get('/api/erp/reservations', async (req, res) => {
    const rows = await db.all("SELECT * FROM reservations ORDER BY created_at DESC LIMIT 200");
    res.json(rows.map(present));
  });

  function present(row) {
    return {
      erp_reservation_id: row.id,
      reservation_no: row.reservation_no,
      source_system: row.source_system,
      source_id: row.source_id,
      guest_name: row.guest_name,
      guest_email: row.guest_email,
      guest_phone: row.guest_phone,
      firm_name: row.firm_name,
      check_in: row.check_in,
      check_out: row.check_out,
      nights: row.nights,
      room_type: row.room_type,
      board_type: row.board_type,
      guests: row.guests,
      currency: row.currency,
      total_amount: row.total_amount,
      status: row.status,
      guarantee_deadline: row.guarantee_deadline,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  return app;
}

export async function startErpServer(port = process.env.ERP_PORT || 3200) {
  const app = await createErpApp();
  app.listen(port, () => console.log(`AEON ERP Sandbox running on http://localhost:${port}`));
  return app;
}
