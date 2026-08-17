const BRIDGE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS module_bridge_events (
    event_id TEXT PRIMARY KEY,
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_module_bridge_events_source ON module_bridge_events (source_system, source_id, event_type, event_id);
  CREATE TABLE IF NOT EXISTS dining_order_mirrors (
    source_id TEXT PRIMARY KEY,
    source_system TEXT NOT NULL,
    target_identifier TEXT NOT NULL,
    status TEXT NOT NULL,
    total_amount REAL DEFAULT 0,
    payment_method TEXT,
    details TEXT,
    departments TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const EVENT_TYPES = new Set(['order_created', 'order_updated', 'request_created', 'request_updated', 'order_delivered', 'charge', 'reversal', 'adjustment']);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export function moduleTokenAuthorized(request, runtimeEnv) {
  const expected = String(runtimeEnv.RECEPTION_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-module-token') || '').trim();
  return Boolean(expected && received && expected === received);
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Geçerli bir JSON gövdesi zorunludur.');
  }
}

async function ensureBridgeSchema(db) {
  for (const statement of BRIDGE_SCHEMA.split(';').map(value => value.trim()).filter(Boolean)) {
    await db.run(statement);
  }
}

function roomNumberFromTarget(target) {
  const value = String(target || '').trim();
  if (!value.startsWith('Room-')) return '';
  return value.slice(5).trim();
}

async function resolveRoom(db, target) {
  const requested = roomNumberFromTarget(target);
  if (!requested) return null;
  const exact = await db.get('SELECT * FROM rooms WHERE room_number = ?', [requested]);
  if (exact) return exact;
  const numeric = requested.match(/^\d+/)?.[0];
  return numeric ? db.get('SELECT * FROM rooms WHERE room_number LIKE ? ORDER BY room_number LIMIT 1', [`${numeric} %`]) : null;
}

async function postRoomCharge(db, body) {
  const target = String(body.target_identifier || body.targetIdentifier || '').trim();
  const room = await resolveRoom(db, target);
  if (!room) throw new Error('Oda hesabı için geçerli oda bulunamadı.');
  if (String(room.status) !== 'occupied') throw new Error(`Oda ${room.room_number} için aktif konaklama bulunamadı.`);
  const stay = await db.get("SELECT id, reservation_id, folio_id FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
  if (!stay?.folio_id) throw new Error(`Oda ${room.room_number} için açık folyo bulunamadı.`);
  const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
  if (!sourceId) throw new Error('Restaurant sipariş kimliği zorunludur.');
  const marker = `restaurant-order:${sourceId}`;
  const existing = await db.get('SELECT id, folio_id, debit FROM folio_transactions WHERE related_reference = ?', [marker]);
  if (existing) return { ...existing, inserted: false, stayId: stay.id, reservationId: stay.reservation_id, roomNumber: room.room_number };
  const amount = Number(body.amount ?? body.total_amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Geçersiz oda hesabı tutarı.');
  const department = ['Bar', 'Restaurant', 'Kitchen'].includes(String(body.department || '')) ? String(body.department) : 'Restaurant';
  const description = String(body.description || (department === 'Bar' ? 'Bar siparişi' : 'Restoran siparişi')).trim().slice(0, 240);
  const transactionId = `ftx_${crypto.randomUUID()}`;
  await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, debit, currency, related_reference, department, created_by) VALUES (?, ?, 'restaurant', ?, 1, ?, ?, 'TRY', ?, ?, ?)", [transactionId, stay.folio_id, `${description}: #${sourceId}`, amount, amount, marker, department, body.created_by || department]);
  await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, body.created_by || department, `${department} Folyo Masrafı`, `Oda: ${room.room_number}, Sipariş: #${sourceId}, Tutar: ${amount} TL`]);
  return { id: transactionId, folio_id: stay.folio_id, debit: amount, inserted: true, stayId: stay.id, reservationId: stay.reservation_id, roomNumber: room.room_number };
}

async function reverseRoomCharge(db, body) {
  const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
  const original = await db.get('SELECT * FROM folio_transactions WHERE related_reference = ?', [`restaurant-order:${sourceId}`]);
  if (!original) return { inserted: false, missing: true };
  const marker = `reversal:${original.id}`;
  const existing = await db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]);
  if (existing) return { inserted: false, id: existing.id };
  const adjustments = await db.get("SELECT COALESCE(SUM(credit), 0) AS credited_total FROM folio_transactions WHERE related_reference LIKE ?", [`adjustment:${original.id}:%`]);
  const remaining = Math.max(0, Number(original.debit || 0) - Number(adjustments?.credited_total || 0));
  const transactionId = `ftx_${crypto.randomUUID()}`;
  await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, currency, debit, credit, related_reference, department, created_by) VALUES (?, ?, 'reversal', ?, ?, 0, ?, ?, ?, ?)", [transactionId, original.folio_id, `İptal: ${original.description}`, original.currency || 'TRY', remaining, marker, original.department || 'Restaurant', body.created_by || original.department || 'Restaurant']);
  await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, body.created_by || original.department || 'Restaurant', 'Restoran Folyo İptali', `Sipariş: #${sourceId}, Sebep: ${body.reason || 'iptal'}`]);
  return { inserted: true, id: transactionId, folio_id: original.folio_id, amount: remaining };
}

async function adjustRoomCharge(db, body) {
  const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
  const ticketId = String(body.ticket_id || body.ticketId || 'ticket').trim();
  const amount = Math.abs(Number(body.amount ?? body.adjustmentAmount ?? 0));
  if (!(amount > 0)) return { inserted: false, skipped: true };
  const original = await db.get('SELECT * FROM folio_transactions WHERE related_reference = ?', [`restaurant-order:${sourceId}`]);
  if (!original) return { inserted: false, missing: true };
  const marker = `adjustment:${original.id}:${ticketId}`;
  const existing = await db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]);
  if (existing) return { inserted: false, id: existing.id };
  const transactionId = `ftx_${crypto.randomUUID()}`;
  await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, currency, debit, credit, related_reference, department, created_by) VALUES (?, ?, 'adjustment', ?, 1, ?, ?, 0, ?, ?, ?, ?)", [transactionId, original.folio_id, `İptal düzeltmesi: ${original.description}`, amount, original.currency || 'TRY', amount, marker, original.department || 'Restaurant', body.created_by || original.department || 'Restaurant']);
  await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, body.created_by || original.department || 'Restaurant', 'Restoran Folyo Düzeltmesi', `Sipariş: #${sourceId}, Tutar: ${amount} TL, Sebep: ${body.reason || 'iptal'}`]);
  return { inserted: true, id: transactionId, folio_id: original.folio_id, amount };
}

async function upsertMirror(db, body, eventType) {
  const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
  if (!sourceId) throw new Error('Restaurant sipariş kimliği zorunludur.');
  const target = String(body.target_identifier || body.targetIdentifier || '').trim() || 'Restaurant';
  const status = String(body.status || (eventType === 'order_delivered' ? 'completed' : 'pending')).trim();
  const details = typeof body.details === 'string' ? body.details.slice(0, 8000) : JSON.stringify(body.details || '');
  const departments = Array.isArray(body.departments) ? JSON.stringify(body.departments) : String(body.departments || '');
  await db.run(`INSERT INTO dining_order_mirrors (source_id, source_system, target_identifier, status, total_amount, payment_method, details, departments, created_by)
    VALUES (?, 'restaurant-kitchen', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET target_identifier = excluded.target_identifier, status = excluded.status, total_amount = excluded.total_amount, payment_method = excluded.payment_method, details = excluded.details, departments = excluded.departments, updated_at = CURRENT_TIMESTAMP`, [sourceId, target, status, Number(body.total_amount ?? body.amount ?? 0), body.payment_method || null, details, departments, body.created_by || 'Restaurant / Kitchen']);
  return sourceId;
}

async function emitReceptionEvent(eventBus, eventType, body, charge = null) {
  const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
  const data = {
    tenantId: process.env.MODULE_DEFAULT_TENANT || 'reception',
    requestId: sourceId,
    request_id: sourceId,
    type: body.type || 'order',
    target_identifier: body.target_identifier || body.targetIdentifier || null,
    status: body.status || null,
    total_amount: Number(body.total_amount ?? body.amount ?? 0),
    payment_method: body.payment_method || null,
    details: body.details || null,
    source: 'restaurant-kitchen',
    source_system: 'restaurant-kitchen',
    ...(charge?.folio_id ? { transaction_id: charge.id || null, folio_id: charge.folio_id, stayId: charge.stayId, reservationId: charge.reservationId, amount: charge.debit || charge.amount || 0 } : {})
  };
  if (eventType === 'order_created' || eventType === 'request_created' || eventType === 'charge') await eventBus.emit(eventType === 'charge' ? 'folio_transaction_created' : 'request_created', data);
  if (eventType === 'order_updated' || eventType === 'request_updated') await eventBus.emit('request_updated', data);
  if (eventType === 'order_delivered') await eventBus.emit('order_delivered_to_room', data);
}

export async function handleDiningModuleEvent(request, runtimeEnv, { getDb, eventBus }) {
  if (!moduleTokenAuthorized(request, runtimeEnv)) return jsonResponse({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
  const eventType = String(body.event_type || '').trim();
  if (!EVENT_TYPES.has(eventType)) return jsonResponse({ error: 'Desteklenmeyen restoran olayı.' }, 400);
  try {
    const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'reception');
    await ensureBridgeSchema(db);
    const sourceId = String(body.source_id || body.requestId || body.request_id || '').trim();
    const eventId = String(body.event_id || `${eventType}:${sourceId}:${body.status || ''}`).trim();
    if (!sourceId || !eventId) return jsonResponse({ error: 'event_id ve source_id zorunludur.' }, 400);
    const prior = await db.get('SELECT event_id FROM module_bridge_events WHERE event_id = ?', [eventId]);
    if (prior) return jsonResponse({ success: true, idempotent: true, event_id: eventId });
    let result = null;
    if (['order_created', 'order_updated', 'order_delivered'].includes(eventType)) await upsertMirror(db, body, eventType);
    if (eventType === 'order_created' && String(body.payment_method || '') === 'room_charge') result = await postRoomCharge(db, body);
    if (eventType === 'charge') result = await postRoomCharge(db, body);
    if (eventType === 'reversal') result = await reverseRoomCharge(db, body);
    if (eventType === 'adjustment') result = await adjustRoomCharge(db, body);
    if (eventType === 'order_delivered' && roomNumberFromTarget(body.target_identifier || body.targetIdentifier)) {
      const room = await resolveRoom(db, body.target_identifier || body.targetIdentifier);
      if (room) await db.run("UPDATE rooms SET eta = 'Servis Teslim Edildi ✓', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [room.id]);
    }
    await db.run('INSERT INTO module_bridge_events (event_id, source_system, source_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?)', [eventId, 'restaurant-kitchen', sourceId, eventType, JSON.stringify(body)]);
    await emitReceptionEvent(eventBus, eventType, body, result);
    return jsonResponse({ success: true, event_id: eventId, event_type: eventType, source_id: sourceId, result }, 201);
  } catch (error) {
    console.error('[reception dining bridge]', error);
    return jsonResponse({ error: error.message || 'Restoran olayı işlenemedi.' }, 409);
  }
}

export async function handleDiningModulePreflight(request, runtimeEnv, { getDb }) {
  if (!moduleTokenAuthorized(request, runtimeEnv)) return jsonResponse({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  try {
    const body = await parseBody(request);
    const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'reception');
    const room = await resolveRoom(db, body.target_identifier || body.targetIdentifier);
    if (!room || room.status !== 'occupied') return jsonResponse({ valid: false, error: 'Oda için aktif konaklama bulunamadı.' }, 409);
    const stay = await db.get("SELECT id, reservation_id, folio_id FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
    if (!stay?.folio_id) return jsonResponse({ valid: false, error: 'Oda için açık folyo bulunamadı.' }, 409);
    return jsonResponse({ valid: true, room_number: room.room_number, stay_id: stay.id, reservation_id: stay.reservation_id, folio_id: stay.folio_id });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
}

export async function handleDiningModuleRoomContext(request, runtimeEnv, { getDb }) {
  if (!moduleTokenAuthorized(request, runtimeEnv)) return jsonResponse({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  const url = new URL(request.url);
  const target = url.searchParams.get('target') || '';
  try {
    const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'reception');
    const room = await resolveRoom(db, target.startsWith('Room-') ? target : `Room-${target}`);
    if (!room) return jsonResponse({ error: 'Oda QR hedefi bulunamadı.' }, 404);
    return jsonResponse({ target_identifier: `Room-${room.room_number}`, room: { id: room.id, room_number: room.room_number, room_type: room.room_type, floor: room.floor, bed_type: room.bed_type, capacity: room.capacity, view_type: room.view_type, status: room.status } });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleDiningModuleFolio(request, runtimeEnv, { getDb }) {
  if (!moduleTokenAuthorized(request, runtimeEnv)) return jsonResponse({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  const url = new URL(request.url);
  const target = url.searchParams.get('target') || '';
  try {
    const db = await getDb(process.env.MODULE_DEFAULT_TENANT || 'reception');
    const room = await resolveRoom(db, target.startsWith('Room-') ? target : `Room-${target}`);
    if (!room) return jsonResponse({ error: 'Oda QR hedefi bulunamadı.' }, 404);
    const activeStay = await db.get("SELECT id, folio_id, checkin_at FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
    if (!activeStay?.folio_id) return jsonResponse({ room, charges: [], stay_folio: null });
    const transactions = await db.all("SELECT id, transaction_type AS type, description AS details, debit AS total_amount, occurred_at AS created_at, related_reference FROM folio_transactions WHERE folio_id = ? AND debit > 0 ORDER BY occurred_at DESC", [activeStay.folio_id]);
    const totals = await db.get('SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit FROM folio_transactions WHERE folio_id = ?', [activeStay.folio_id]);
    return jsonResponse({ room, charges: transactions, stay_folio: { balance: Number(totals?.debit || 0) - Number(totals?.credit || 0) } });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
