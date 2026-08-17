function eventRequest(path, body) {
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-aeon-crm-token': process.env.CRM_MODULE_TOKEN || '' },
    body: JSON.stringify(body)
  };
  if (globalThis.__CRM_SERVICE) return globalThis.__CRM_SERVICE.fetch(new Request(`https://aeon-crm.internal${path}`, init));
  const url = String(process.env.CRM_MODULE_URL || '').replace(/\/$/, '');
  if (!url) return null;
  return fetch(`${url}${path}`, init);
}

async function ensureOutbox(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS crm_outbox (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMP)`);
}

function eventIdentity(eventType, data) {
  return String(data.event_id || data.eventId || data.id || data.transaction_id || data.transactionId || data.payment_id || data.paymentId || data.invoice_id || data.invoiceId || data.request_id || data.requestId || data.stay_id || data.stayId || data.folio_id || data.folioId || data.reservation?.id || data.reservationId || data.event?.id || 'general');
}

function eventPayload(eventType, data) {
  const eventId = `${eventType}:${eventIdentity(eventType, data)}:${data.status || data.event?.status || data.event?.reviewed_at || ''}`;
  return { event_id: data.event_id || eventId, event_type: eventType, source: 'reception', ...data };
}

async function flushCrmOutbox(db) {
  await ensureOutbox(db);
  const rows = await db.all("SELECT * FROM crm_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20");
  let sent = 0;
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload_json);
      const response = await eventRequest('/api/module/reception-events', payload);
      if (!response) throw new Error('CRM bağlantısı yapılandırılmamış.');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `CRM senkronizasyonu HTTP ${response.status}`);
      await db.run("UPDATE crm_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL WHERE event_id = ?", [row.event_id]);
      sent += 1;
    } catch (error) {
      await db.run('UPDATE crm_outbox SET attempts = attempts + 1, last_error = ? WHERE event_id = ?', [String(error.message || error).slice(0, 500), row.event_id]);
    }
  }
  return { sent, pending: rows.length - sent };
}

async function pushEvent(getDb, eventType, data) {
  const db = await getDb(data.tenantId || process.env.MODULE_DEFAULT_TENANT || 'reception');
  await ensureOutbox(db);
  const payload = eventPayload(eventType, data);
  await db.run('INSERT OR IGNORE INTO crm_outbox (event_id, event_type, payload_json) VALUES (?, ?, ?)', [payload.event_id, eventType, JSON.stringify(payload)]);
  return flushCrmOutbox(db);
}

async function reservationSnapshot(getDb, data) {
  const db = await getDb(data.tenantId || process.env.MODULE_DEFAULT_TENANT || 'reception');
  const reservationId = data.reservationId || data.reservation_id;
  let resolvedReservationId = reservationId;
  if (!resolvedReservationId && data.stayId) {
    const stay = await db.get('SELECT reservation_id FROM stays WHERE id = ?', [data.stayId]);
    resolvedReservationId = stay?.reservation_id;
  }
  if (!resolvedReservationId) return { reservation: {}, guest: data.guest || {}, event: data };
  const reservation = await db.get(`SELECT r.*, rm.room_number, s.id AS stay_id, s.status AS stay_status FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id LEFT JOIN stays s ON s.reservation_id = r.id WHERE r.id = ? LIMIT 1`, [resolvedReservationId]);
  if (!reservation) return { reservation: { id: resolvedReservationId }, guest: data.guest || {}, event: data };
  const guest = reservation.main_guest_id ? await db.get('SELECT first_name, last_name, phone, email, nationality, identity_number, passport_number, address, vehicle_plate, date_of_birth FROM guest_profiles WHERE id = ?', [reservation.main_guest_id]) : null;
  return { reservation: { id: reservation.id, reservation_number: reservation.reservation_number, status: reservation.status, arrival_date: reservation.arrival_date, departure_date: reservation.departure_date, room_type: reservation.room_type, room_number: reservation.room_number, total_amount: reservation.total_amount, currency: reservation.currency, stay_id: reservation.stay_id, source_id: reservation.source_id }, guest: guest || data.guest || {}, stay: reservation.stay_id ? { id: reservation.stay_id, status: reservation.stay_status } : null, event: data };
}

async function requestSnapshot(getDb, data) {
  const db = await getDb(data.tenantId || process.env.MODULE_DEFAULT_TENANT || 'reception');
  const target = String(data.target_identifier || data.targetIdentifier || '');
  const roomNumber = target.startsWith('Room-') ? target.slice(5).trim() : null;
  const stay = roomNumber ? await db.get("SELECT s.id AS stay_id, s.reservation_id FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.room_number = ? AND s.status = 'checked_in' ORDER BY s.checkin_at DESC LIMIT 1", [roomNumber]) : null;
  const snapshot = await reservationSnapshot(getDb, { ...data, reservationId: data.reservationId || stay?.reservation_id, stayId: data.stayId || stay?.stay_id });
  return { ...snapshot, request_id: data.requestId || data.request_id || null, event: data };
}

export async function flushCrmOutboxForTenant(getDb, tenantId = 'reception') {
  const db = await getDb(tenantId);
  return flushCrmOutbox(db);
}

export function registerCrmSync({ eventBus, getDb }) {
  if (!eventBus || !getDb) return;
  for (const eventType of ['reservation_created', 'reservation_updated', 'checkin_completed', 'checkout_completed', 'stay_moved']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(getDb, eventType, await reservationSnapshot(getDb, data)); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
  eventBus.on('precheckin_submitted', async data => {
    try {
      let guest = data.guest || {};
      if (!Object.keys(guest).length && data.reservationId) guest = (await reservationSnapshot(getDb, data)).guest;
      await pushEvent(getDb, 'precheckin_submitted', { reservation: data.reservationId ? { id: data.reservationId, reservation_number: data.reservationNumber } : {}, guest, event: data, id: data.id });
    } catch (error) { console.error('[reception→crm] precheckin_submitted:', error.message); }
  });
  for (const eventType of ['precheckin_reviewed', 'guest_profile_updated']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(getDb, eventType, { reservation: data.reservationId ? { id: data.reservationId } : {}, guest: data.guest || {}, event: data, id: data.id }); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
  for (const eventType of ['request_created', 'request_updated', 'order_delivered_to_room']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(getDb, eventType, await requestSnapshot(getDb, data)); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
  for (const eventType of ['folio_transaction_created', 'payment_recorded', 'folio_transaction_reversed', 'invoice_issued', 'invoice_cancelled']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(getDb, eventType, { ...(await reservationSnapshot(getDb, data)), ...data, event: data }); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
}
