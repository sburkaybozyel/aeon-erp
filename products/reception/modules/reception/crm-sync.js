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

async function pushEvent(eventType, data) {
  const eventKey = data.event_id || `${eventType}:${data.reservation?.id || data.stay?.id || data.folio_id || data.request_id || data.invoice_id || data.reservationId || 'general'}:${data.status || data.event?.status || ''}`;
  const response = await eventRequest('/api/module/reception-events', { event_id: eventKey, event_type: eventType, source: 'reception', ...data });
  if (response && response.status >= 400) throw new Error(`CRM senkronizasyonu HTTP ${response.status}`);
}

async function reservationSnapshot(getDb, data) {
  const db = await getDb(data.tenantId);
  const reservationId = data.reservationId || data.reservation_id;
  let resolvedReservationId = reservationId;
  if (!resolvedReservationId && data.stayId) {
    const stay = await db.get('SELECT reservation_id FROM stays WHERE id = ?', [data.stayId]);
    resolvedReservationId = stay?.reservation_id;
  }
  if (!resolvedReservationId) return { reservation: {}, guest: data.guest || {}, event: data };
  const reservation = await db.get(`
    SELECT r.*, rm.room_number, s.id AS stay_id, s.status AS stay_status
    FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id LEFT JOIN stays s ON s.reservation_id = r.id
    WHERE r.id = ? LIMIT 1
  `, [resolvedReservationId]);
  if (!reservation) return { reservation: { id: resolvedReservationId }, guest: data.guest || {}, event: data };
  const guest = reservation.main_guest_id ? await db.get('SELECT first_name, last_name, phone, email, nationality, identity_number, passport_number, address, vehicle_plate, date_of_birth FROM guest_profiles WHERE id = ?', [reservation.main_guest_id]) : null;
  return { reservation: { id: reservation.id, reservation_number: reservation.reservation_number, status: reservation.status, arrival_date: reservation.arrival_date, departure_date: reservation.departure_date, room_type: reservation.room_type, room_number: reservation.room_number, total_amount: reservation.total_amount, currency: reservation.currency, stay_id: reservation.stay_id, source_id: reservation.source_id }, guest: guest || data.guest || {}, stay: reservation.stay_id ? { id: reservation.stay_id, status: reservation.stay_status } : null, event: data };
}

async function requestSnapshot(getDb, data) {
  const db = await getDb(data.tenantId);
  const target = String(data.target_identifier || data.targetIdentifier || '');
  const roomNumber = target.startsWith('Room-') ? target.slice(5).trim() : null;
  const stay = roomNumber ? await db.get("SELECT s.id AS stay_id, s.reservation_id FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.room_number = ? AND s.status = 'checked_in' ORDER BY s.checkin_at DESC LIMIT 1", [roomNumber]) : null;
  const snapshot = await reservationSnapshot(getDb, { ...data, reservationId: data.reservationId || stay?.reservation_id, stayId: data.stayId || stay?.stay_id });
  return { ...snapshot, request_id: data.requestId || data.request_id || null, event: data };
}

export function registerCrmSync({ eventBus, getDb }) {
  if (!eventBus || !getDb) return;
  for (const eventType of ['reservation_created', 'reservation_updated', 'checkin_completed', 'checkout_completed', 'stay_moved']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(eventType, await reservationSnapshot(getDb, data)); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
  eventBus.on('precheckin_submitted', async data => {
    try {
      let guest = data.guest || {};
      if (!Object.keys(guest).length && data.reservationId) guest = (await reservationSnapshot(getDb, data)).guest;
      await pushEvent('precheckin_submitted', { reservation: data.reservationId ? { id: data.reservationId, reservation_number: data.reservationNumber } : {}, guest, event: data });
    } catch (error) { console.error('[reception→crm] precheckin_submitted:', error.message); }
  });
  for (const eventType of ['request_created', 'request_updated', 'order_delivered_to_room']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(eventType, await requestSnapshot(getDb, data)); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
  for (const eventType of ['folio_transaction_created', 'payment_recorded', 'folio_transaction_reversed', 'invoice_issued', 'invoice_cancelled']) {
    eventBus.on(eventType, async data => {
      try { await pushEvent(eventType, { ...(await reservationSnapshot(getDb, data)), ...data, event: data }); }
      catch (error) { console.error(`[reception→crm] ${eventType}:`, error.message); }
    });
  }
}
