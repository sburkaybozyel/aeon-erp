import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';

process.env.CLOUDFLARE_WORKER = '1';
process.env.CRM_DISABLE_LISTEN = 'true';
process.env.CRM_ERP_DISABLE = 'true';
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
globalThis.__AEON_CRM_D1 = env.DB;
globalThis.__RECEPTION_SERVICE = env.RECEPTION_SERVICE;
const { getCrmDbForRequest } = await import('./runtime-db.js');

const nodeVersion = process.versions?.node;
if (process.versions) delete process.versions.node;
const { default: app } = await import('./server.js');
if (nodeVersion && process.versions) process.versions.node = nodeVersion;
app.listen(3000);

const appHandler = httpServerHandler({ port: 3000 });

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function authorized(request, runtimeEnv) {
  const expected = String(runtimeEnv.CRM_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-crm-token') || '').trim();
  return Boolean(expected && received && expected === received);
}

function splitName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || 'Misafir', lastName: parts.join(' ') || '-' };
}

function receptionStatus(eventType, reservation = {}, event = {}) {
  if (eventType === 'checkin_completed') return 'checked_in';
  if (eventType === 'checkout_completed') return 'checked_out';
  if (eventType === 'stay_moved') return 'in_house';
  return reservation.status || event.status || eventType;
}

async function syncLinkedOpportunity(db, { eventType, reservation, contactId, body }) {
  const sourceId = String(reservation.source_id || body.source_id || body.event?.source_id || '').trim();
  const receptionReservationId = String(reservation.id || body.reservation_id || '').trim();
  let opportunity = sourceId ? await db.get('SELECT * FROM opportunities WHERE id = ?', [sourceId]) : null;
  if (!opportunity && receptionReservationId) {
    opportunity = await db.get('SELECT * FROM opportunities WHERE erp_reservation_id = ?', [receptionReservationId]);
  }
  if (!opportunity) return null;

  const status = receptionStatus(eventType, reservation, body.event || {});
  await db.run(`UPDATE opportunities SET
      contact_id = COALESCE(?, contact_id),
      erp_reservation_id = COALESCE(?, erp_reservation_id),
      erp_reservation_no = COALESCE(?, erp_reservation_no),
      erp_status = ?,
      integration_status = 'synced',
      erp_check_in = COALESCE(?, erp_check_in),
      erp_check_out = COALESCE(?, erp_check_out),
      erp_total_amount = COALESCE(?, erp_total_amount),
      erp_currency = COALESCE(?, erp_currency),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`, [
    contactId || null,
    receptionReservationId || null,
    reservation.reservation_number || null,
    status,
    reservation.arrival_date || null,
    reservation.departure_date || null,
    reservation.total_amount === undefined ? null : Number(reservation.total_amount || 0),
    reservation.currency || null,
    opportunity.id
  ]);
  return opportunity.id;
}

async function upsertContact(db, guest = {}) {
  const email = String(guest.email || '').trim().toLowerCase() || null;
  const phone = String(guest.phone || '').trim() || null;
  let contact = null;
  if (email || phone) {
    contact = await db.get(
      'SELECT * FROM contacts WHERE (? IS NOT NULL AND lower(email) = lower(?)) OR (? IS NOT NULL AND phone = ?) LIMIT 1',
      [email, email, phone, phone]
    );
  }
  const names = splitName(guest.name || `${guest.first_name || ''} ${guest.last_name || ''}`);
  if (contact) {
    await db.run(
      'UPDATE contacts SET first_name = ?, last_name = ?, phone = COALESCE(?, phone), email = COALESCE(?, email), nationality = COALESCE(?, nationality), identity_number = COALESCE(?, identity_number), passport_number = COALESCE(?, passport_number), address = COALESCE(?, address), vehicle_plate = COALESCE(?, vehicle_plate), date_of_birth = COALESCE(?, date_of_birth), notes = COALESCE(?, notes), segment = ?, last_reception_sync_at = CURRENT_TIMESTAMP WHERE id = ?',
      [guest.first_name || names.firstName, guest.last_name || names.lastName, phone, email, guest.nationality || null, guest.identity_number || null, guest.passport_number || null, guest.address || null, guest.vehicle_plate || null, guest.date_of_birth || null, guest.notes || null, 'reception', contact.id]
    );
    return contact.id;
  }
  const id = `contact_reception_${crypto.randomUUID()}`;
  await db.run(
    'INSERT INTO contacts (id, first_name, last_name, phone, email, nationality, identity_number, passport_number, address, vehicle_plate, date_of_birth, segment, notes, last_reception_sync_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [id, guest.first_name || names.firstName, guest.last_name || names.lastName, phone, email, guest.nationality || null, guest.identity_number || null, guest.passport_number || null, guest.address || null, guest.vehicle_plate || null, guest.date_of_birth || null, 'reception', guest.notes || null]
  );
  return id;
}

async function handleReceptionEvent(request, runtimeEnv) {
  if (!authorized(request, runtimeEnv)) return json({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400); }
  const eventType = String(body?.event_type || '').trim();
  if (!['reservation_created', 'reservation_updated', 'precheckin_submitted', 'checkin_completed', 'checkout_completed', 'stay_moved', 'folio_transaction_created', 'payment_recorded', 'folio_transaction_reversed', 'invoice_issued', 'invoice_cancelled', 'request_created', 'request_updated', 'order_delivered_to_room'].includes(eventType)) {
    return json({ error: 'Desteklenmeyen resepsiyon olayı.' }, 400);
  }
  try {
    const db = await getCrmDbForRequest({ tenantId: process.env.CRM_TENANT_ID || 'reception' });
    const event = body.event || {};
    const reservation = body.reservation || {};
    const eventId = String(body.event_id || `${eventType}:${reservation.id || body.reservation_id || body.stay_id || body.folio_id || body.request_id || body.invoice_id || crypto.randomUUID()}:${body.status || event.status || ''}`);
    const priorEvent = await db.get('SELECT event_id FROM reception_event_log WHERE event_id = ?', [eventId]);
    if (priorEvent) return json({ success: true, idempotent: true, event_id: eventId });
    const contactId = await upsertContact(db, body.guest || {});
    const receptionReservationId = reservation.id || body.reservation_id || null;
    if (receptionReservationId) {
      const existing = await db.get('SELECT * FROM reception_reservations WHERE reception_reservation_id = ?', [receptionReservationId]);
      const payload = JSON.stringify(body);
      const values = [
        reservation.reservation_number || existing?.reservation_number || null, contactId, reservation.status || existing?.status || eventType,
        reservation.arrival_date || existing?.check_in || null, reservation.departure_date || existing?.check_out || null, reservation.room_type || existing?.room_type || null,
        reservation.room_number || existing?.room_number || null, reservation.total_amount === undefined ? Number(existing?.total_amount || 0) : Number(reservation.total_amount || 0), reservation.currency || existing?.currency || 'TRY',
        body.stay?.id || reservation.stay_id || existing?.stay_id || null, body.source || existing?.source || 'reception', reservation.source_id || existing?.source_id || null, payload
      ];
      if (existing) {
        await db.run(
          'UPDATE reception_reservations SET reservation_number = ?, contact_id = ?, status = ?, check_in = ?, check_out = ?, room_type = ?, room_number = ?, total_amount = ?, currency = ?, stay_id = ?, source = ?, source_id = ?, payload = ?, updated_at = CURRENT_TIMESTAMP WHERE reception_reservation_id = ?',
          [...values, receptionReservationId]
        );
      } else {
        await db.run(
          'INSERT INTO reception_reservations (id, reception_reservation_id, reservation_number, contact_id, status, check_in, check_out, room_type, room_number, total_amount, currency, stay_id, source, source_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [`reception_res_${crypto.randomUUID()}`, receptionReservationId, ...values]
        );
      }
    }
    const opportunityId = await syncLinkedOpportunity(db, { eventType, reservation, contactId, body });
    await db.run(
      'INSERT INTO reception_event_log (event_id, event_type, reception_reservation_id, contact_id, stay_id, folio_id, request_id, invoice_id, amount, currency, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [eventId, eventType, receptionReservationId, contactId, body.stay?.id || body.stay_id || event.stayId || null, body.folio_id || event.folioId || null, body.request_id || event.requestId || null, body.invoice_id || event.invoiceId || null, Number(body.amount ?? event.amount ?? 0), body.currency || event.currency || null, JSON.stringify(body)]
    );
    return json({ success: true, event_id: eventId, event_type: eventType, contact_id: contactId, opportunity_id: opportunityId, reception_reservation_id: receptionReservationId });
  } catch (error) {
    console.error('[crm reception event]', error);
    return json({ error: error.message || 'CRM olayı işlenemedi.' }, 500);
  }
}

function assetRequest(request, runtimeEnv, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/module/reception-events') {
      return handleReceptionEvent(request, runtimeEnv);
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/') return assetRequest(request, runtimeEnv, '/index.html');
      if (!url.pathname.startsWith('/api/')) {
        const asset = await runtimeEnv.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }
    }
    return appHandler.fetch(request, runtimeEnv, context);
  }
};
