import crypto from 'crypto';
import express from 'express';
import { id, actor, audit, roomAvailable, profileFor, validateDates } from './reception/helpers.js';

// Bridge that lets the standalone Turizm CRM (crm/) talk to the real AEON ERP over HTTP,
// using the same /api/erp/* contract the CRM's sandbox (crm/erp_server.js) already
// implements — see crm/docs/DATA_CONTRACT.md §3.1. The CRM never touches AEON's own
// reservation tables directly; every write goes through the normal reservation-creation
// path (profileFor, room_assignments, audit) so a CRM-originated booking looks and behaves
// exactly like one entered at reception.
//
// Auth model: this is server-to-server, not a staff session, so it can't go through the
// PIN/session flow. A shared secret (CRM_BRIDGE_KEY) gates every route below instead —
// requests without a matching `x-erp-api-key` header are rejected. The env var must be set
// (and match ERP_API_KEY on the CRM side) or the bridge refuses to run at all, so it never
// ships silently open.

const ROOM_TYPE_MAP = { rt_std: 'Standard Room', rt_dlx: 'Deluxe Room', rt_suit: 'Suite' };
const BOARD_MULTIPLIER = { BB: 1, HB: 1.2, FB: 1.4, AI: 1.7, UAI: 1.9 };
const FX = { EUR: 1, USD: 1.08, TRY: 40 };
const DEFAULT_BASE_RATE = { 'Standard Room': 90, 'Deluxe Room': 150, 'Suite': 240 };

function computeNights(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

async function resolveRoomType(db, requested) {
  const mapped = ROOM_TYPE_MAP[requested] || null;
  if (mapped) return mapped;
  if (requested) {
    const match = await db.get('SELECT DISTINCT room_type FROM rooms WHERE LOWER(room_type) = LOWER(?)', [requested]);
    if (match) return match.room_type;
  }
  return 'Standard Room';
}

async function ensureBaseRates(db) {
  for (const [roomType, rate] of Object.entries(DEFAULT_BASE_RATE)) {
    await db.run('UPDATE rooms SET base_rate = ? WHERE room_type = ? AND (base_rate IS NULL OR base_rate = 0)', [rate, roomType]);
  }
}

async function findAvailableRoom(db, roomType, checkIn, checkOut) {
  const rooms = await db.all("SELECT * FROM rooms WHERE room_type = ? AND status NOT IN ('maintenance', 'out_of_order', 'blocked') ORDER BY CAST(room_number AS INT), room_number", [roomType]);
  for (const room of rooms) {
    if (await roomAvailable(db, room.id, checkIn, checkOut)) return room;
  }
  return null;
}

function priceFor(room, board, nights, currency) {
  const baseRate = Number(room.base_rate) || DEFAULT_BASE_RATE[room.room_type] || 90;
  const nightly = Number((baseRate * (BOARD_MULTIPLIER[board] || 1)).toFixed(2));
  const fx = FX[currency] || 1;
  return { base_rate: baseRate, nightly, total: Number((nightly * (nights || 1) * fx).toFixed(2)), currency };
}

function present(row) {
  return {
    erp_reservation_id: row.id,
    reservation_no: row.reservation_number,
    source_system: row.source_system,
    source_id: row.source_id,
    guest_name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || null,
    guest_email: row.contact_email,
    guest_phone: row.contact_phone,
    firm_name: row.agency || null,
    check_in: row.arrival_date,
    check_out: row.departure_date,
    nights: row.nights,
    room_type: row.room_type,
    board_type: row.board_type,
    guests: Number(row.adults || 0) + Number(row.children || 0),
    currency: row.currency,
    total_amount: row.total_amount,
    status: row.status,
    guarantee_deadline: row.payment_due_date || null,
    notes: row.internal_notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function splitGuestName(guestName) {
  const parts = String(guestName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: 'CRM', last_name: 'Misafiri' };
  if (parts.length === 1) return { first_name: parts[0], last_name: 'Misafiri' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
}

function requireBridgeKey(req, res, next) {
  const expected = process.env.CRM_BRIDGE_KEY;
  if (!expected) return res.status(503).json({ error: 'CRM köprüsü yapılandırılmadı (CRM_BRIDGE_KEY eksik).' });
  if (req.get('x-erp-api-key') !== expected) return res.status(401).json({ error: 'Geçersiz veya eksik köprü anahtarı.' });
  next();
}

export function initCrmBridge({ app }) {
  const router = express.Router();
  app.use('/api/erp', requireBridgeKey, router);

  router.get('/health', async (req, res) => {
    res.json({ ok: true, system: 'aeon-erp', time: new Date().toISOString() });
  });

  router.post('/availability', async (req, res) => {
    try {
      const { check_in, check_out, room_type, board, guests, currency } = req.body || {};
      validateDates(check_in, check_out);
      const nights = computeNights(check_in, check_out);
      await ensureBaseRates(req.db);
      const resolvedType = await resolveRoomType(req.db, room_type);
      const room = await findAvailableRoom(req.db, resolvedType, check_in, check_out);
      const priceRoom = room || (await req.db.get('SELECT * FROM rooms WHERE room_type = ? LIMIT 1', [resolvedType]));
      const price = priceFor(priceRoom || {}, board || 'BB', nights, currency || 'EUR');
      res.json({
        available: Boolean(room),
        room_type: room_type || null,
        room_name: resolvedType,
        nights,
        board: board || 'BB',
        guests: guests || 2,
        currency: price.currency,
        nightly: price.nightly,
        total: price.total,
        base_rate: price.base_rate,
        message: room ? 'Müsait' : `Bu tarih aralığında ${resolvedType} dolu.`
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/reservations', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.source_system || !body.source_id) return res.status(400).json({ error: 'source_system ve source_id zorunludur.' });

      const existing = await req.db.get(
        "SELECT r.*, g.first_name, g.last_name FROM reservations r LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE r.source_system = ? AND r.source_id = ?",
        [body.source_system, body.source_id]
      );
      if (existing) return res.json({ duplicate: true, ...present(existing) });

      validateDates(body.check_in, body.check_out);
      const nights = computeNights(body.check_in, body.check_out);
      await ensureBaseRates(req.db);
      const resolvedType = await resolveRoomType(req.db, body.room_type);
      const room = await findAvailableRoom(req.db, resolvedType, body.check_in, body.check_out);
      if (!room) return res.status(409).json({ error: `${resolvedType} bu tarih aralığında müsait değil.` });

      const price = priceFor(room, body.board_type || 'BB', nights, body.currency || 'EUR');
      const totalAmount = Number(body.total_amount) || price.total;
      const guestName = splitGuestName(body.guest_name);
      const reservationId = id('res');
      const reservationNumber = `AE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const status = 'inquiry';
      const user = actor(req);

      await req.db.transaction(async tx => {
        const guestId = await profileFor(tx, { ...guestName, phone: body.guest_phone, email: body.guest_email }, req);
        await tx.run(
          `INSERT INTO reservations (id, reservation_number, status, arrival_date, departure_date, nights, adults, children,
            room_type, board_type, nightly_rate, currency, total_amount, agency, main_guest_id, contact_phone, contact_email,
            internal_notes, payment_status, source_system, source_id, crm_idempotency_key, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [reservationId, reservationNumber, status, body.check_in, body.check_out, nights, Number(body.guests) || 2, 0,
            resolvedType, body.board_type || 'BB', price.nightly, body.currency || 'EUR', totalAmount, body.firm_name || null,
            guestId, body.guest_phone || null, body.guest_email || null, body.notes || null, 'pending',
            body.source_system, body.source_id, body.idempotency_key || null, user.name, user.name],
          { undoSql: 'DELETE FROM reservations WHERE id = ?', undoParams: [reservationId] }
        );
        await tx.run('INSERT INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 1)', [id('resguest'), reservationId, guestId], {
          undoSql: 'DELETE FROM reservation_guests WHERE reservation_id = ? AND guest_id = ?', undoParams: [reservationId, guestId]
        });
        const assignmentId = id('assignment');
        await tx.run("INSERT INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, 'reserved', ?)",
          [assignmentId, reservationId, room.id, body.check_in, body.check_out, user.name], {
            undoSql: 'DELETE FROM room_assignments WHERE id = ?', undoParams: [assignmentId]
          });
        await audit(tx, req, 'reservation', reservationId, 'created_from_crm', null, { reservation_number: reservationNumber, source_id: body.source_id });
      });

      const row = await req.db.get(
        "SELECT r.*, g.first_name, g.last_name FROM reservations r LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE r.id = ?",
        [reservationId]
      );
      res.status(201).json({ duplicate: false, ...present(row) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/reservations/:idOrNumber', async (req, res) => {
    const row = await req.db.get(
      "SELECT r.*, g.first_name, g.last_name FROM reservations r LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE r.id = ? OR r.reservation_number = ?",
      [req.params.idOrNumber, req.params.idOrNumber]
    );
    if (!row) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    const stay = await req.db.get('SELECT status, checkin_at, checkout_at FROM stays WHERE reservation_id = ?', [row.id]);
    res.json({ ...present(row), stay: stay || null });
  });
}
