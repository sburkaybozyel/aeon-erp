import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';

process.env.CLOUDFLARE_WORKER = '1';
for (const [key, value] of Object.entries(env)) {
  if (typeof value === 'string') process.env[key] = value;
}
globalThis.__MODULE_D1 = env.DB;
globalThis.__CRM_SERVICE = env.CRM_SERVICE;

const nodeVersion = process.versions?.node;
if (process.versions) delete process.versions.node;
const { default: app } = await import('./server.js');
if (nodeVersion && process.versions) process.versions.node = nodeVersion;
app.listen(3000);

const appHandler = httpServerHandler({ port: 3000 });
const pageAliases = new Map([
  ['/', '/login.html'],
  ['/reception', '/staff-reception.html'],
  ['/reception/', '/staff-reception.html'],
  ['/precheckin', '/precheckin.html'],
  ['/precheckin/', '/precheckin.html']
]);

const bridgeRequestTypes = new Set([
  'waiter_call',
  'bill_call',
  'room_service_call',
  'towel_request',
  'cleaning_request',
  'linen_request',
  'amenity_request',
  'maintenance_request',
  'water_request',
  'transport_request',
  'room_dnd_change'
]);

function bridgeJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function handleModuleGuestRequest(request, runtimeEnv) {
  const expected = String(runtimeEnv.RECEPTION_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-module-token') || '').trim();
  if (!expected || !received || expected !== received) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400);
  }

  const type = String(body?.type || '').trim();
  if (!bridgeRequestTypes.has(type)) return bridgeJson({ error: 'Bu istek resepsiyon modülünde desteklenmiyor.' }, 400);

  const rawTarget = String(body?.target_identifier || '').trim();
  let target = null;
  if (rawTarget.startsWith('Room-')) {
    const requested = rawTarget.slice('Room-'.length).trim();
    const exact = await runtimeEnv.DB.prepare('SELECT room_number FROM rooms WHERE room_number = ?').bind(requested).first();
    if (exact) target = `Room-${exact.room_number}`;
    if (!target) {
      const number = requested.match(/^\d+/)?.[0];
      if (number) {
        const room = await runtimeEnv.DB.prepare('SELECT room_number FROM rooms WHERE room_number LIKE ?').bind(`${number} %`).first();
        if (room) target = `Room-${room.room_number}`;
      }
    }
  } else if (rawTarget.startsWith('Table-')) {
    const requested = rawTarget.slice('Table-'.length).trim();
    const exact = await runtimeEnv.DB.prepare('SELECT table_number FROM tables WHERE table_number = ?').bind(requested).first();
    if (exact) target = `Table-${exact.table_number}`;
    if (!target) {
      const number = requested.match(/\d+/)?.[0];
      if (number) {
        const table = await runtimeEnv.DB.prepare('SELECT table_number FROM tables WHERE table_number LIKE ?').bind(`%${number}`).first();
        if (table) target = `Table-${table.table_number}`;
      }
    }
  }
  if (!target) return bridgeJson({ error: 'Geçerli oda veya masa hedefi bulunamadı.' }, 404);

  const requestId = String(body?.request_id || body?.requestId || '').trim() || `req_${crypto.randomUUID()}`;
  if (requestId.length > 120) return bridgeJson({ error: 'İstek kimliği çok uzun.' }, 400);
  const existing = await runtimeEnv.DB.prepare('SELECT id, total_amount, payment_method FROM requests WHERE id = ?').bind(requestId).first();
  if (existing) return bridgeJson({ success: true, requestId: existing.id, totalAmount: Number(existing.total_amount || 0), payment_method: existing.payment_method || null, idempotent: true });

  const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 2000) : JSON.stringify(body?.details ?? 'Misafir talebi').slice(0, 2000);
  await runtimeEnv.DB.prepare(
    "INSERT INTO requests (id, type, department, target_identifier, status, details, total_amount, payment_method, created_by) VALUES (?, ?, 'Reception', ?, 'pending', ?, 0, NULL, ?)"
  ).bind(requestId, type, target, details || 'Misafir talebi', 'Misafir QR · AEON Restaurant & Kitchen').run();

  return bridgeJson({ success: true, requestId, totalAmount: 0, payment_method: null, forwardedTo: 'reception' }, 201);
}

function crmAuthorized(request, runtimeEnv) {
  const expected = String(runtimeEnv.CRM_MODULE_TOKEN || '').trim();
  const received = String(request.headers.get('x-aeon-crm-token') || '').trim();
  return Boolean(expected && received && expected === received);
}

function receptionRoomType(value) {
  const key = String(value || '').toLowerCase();
  if (key.includes('dlx') || key.includes('deluxe')) return 'Deluxe Room';
  if (key.includes('suit')) return 'suite';
  if (key.includes('standard')) return 'Standard Room';
  return 'Standard Room';
}

function crmNames(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts.shift() || 'CRM', last: parts.join(' ') || 'Misafiri' };
}

async function findCrmRoom(runtimeEnv, roomType, arrival, departure, excludeReservationId = null) {
  const type = receptionRoomType(roomType);
  return runtimeEnv.DB.prepare(`
    SELECT rm.* FROM rooms rm
    WHERE rm.status = 'clean_vacant' AND lower(rm.room_type) = lower(?)
      AND NOT EXISTS (
        SELECT 1 FROM room_assignments ra
        WHERE ra.room_id = rm.id AND ra.status IN ('active', 'reserved', 'checked_in')
          AND ra.start_date < ? AND ra.end_date > ?
          AND (? IS NULL OR ra.reservation_id <> ?)
      )
    ORDER BY rm.room_number LIMIT 1
  `).bind(type, departure, arrival, excludeReservationId, excludeReservationId).first();
}

async function handleCrmAvailability(request, runtimeEnv) {
  if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try { body = await request.json(); } catch { return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400); }
  const arrival = String(body?.check_in || '').trim();
  const departure = String(body?.check_out || '').trim();
  const nights = Math.round((new Date(`${departure}T00:00:00Z`) - new Date(`${arrival}T00:00:00Z`)) / 86400000);
  if (!arrival || !departure || !Number.isFinite(nights) || nights <= 0) return bridgeJson({ error: 'Geçerli giriş ve çıkış tarihleri zorunludur.' }, 400);
  const room = await findCrmRoom(runtimeEnv, body.room_type, arrival, departure);
  const nightly = Number(body.nightly_rate || room?.base_rate || 100);
  const currency = String(body.currency || 'TRY').toUpperCase();
  return bridgeJson({
    available: Boolean(room), message: room ? 'Oda müsait.' : 'Bu tarih aralığında uygun oda yok.',
    room_id: room?.id || null, room_name: room ? `${room.room_number} · ${room.room_type}` : null,
    room_number: room?.room_number || null, nights, nightly, total: nightly * nights, currency
  });
}

async function handleCrmReservation(request, runtimeEnv) {
  if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try { body = await request.json(); } catch { return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400); }
  const sourceId = String(body?.source_id || '').trim();
  const arrival = String(body?.check_in || '').trim();
  const departure = String(body?.check_out || '').trim();
  const nights = Math.round((new Date(`${departure}T00:00:00Z`) - new Date(`${arrival}T00:00:00Z`)) / 86400000);
  if (!sourceId || !arrival || !departure || !Number.isFinite(nights) || nights <= 0) return bridgeJson({ error: 'source_id, check_in ve check_out zorunludur.' }, 400);
  const duplicate = await runtimeEnv.DB.prepare(`
    SELECT r.id AS erp_reservation_id, r.reservation_number AS reservation_no, r.status, r.arrival_date AS check_in,
           r.departure_date AS check_out, r.total_amount, r.currency, rm.room_number
    FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id
    WHERE r.source_system = 'crm' AND r.source_id = ? LIMIT 1
  `).bind(sourceId).first();
  if (duplicate) return bridgeJson({ duplicate: true, ...duplicate, room_name: duplicate.room_number || null });

  const guest = body.guest_name ? crmNames(body.guest_name) : { first: 'CRM', last: 'Misafiri' };
  const email = String(body.guest_email || '').trim().toLowerCase() || null;
  const phone = String(body.guest_phone || '').trim() || null;
  let profile = null;
  if (email || phone) {
    profile = await runtimeEnv.DB.prepare(
      'SELECT * FROM guest_profiles WHERE (? IS NOT NULL AND lower(email) = lower(?)) OR (? IS NOT NULL AND phone = ?) LIMIT 1'
    ).bind(email, email, phone, phone).first();
  }
  const guestId = profile?.id || `guest_crm_${crypto.randomUUID()}`;
  const room = await findCrmRoom(runtimeEnv, body.room_type, arrival, departure);
  const reservationId = `res_crm_${crypto.randomUUID()}`;
  const reservationNumber = `CRM-${arrival.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const currency = String(body.currency || 'TRY').toUpperCase();
  const total = Number(body.total_amount || 0);
  const nightly = nights > 0 ? total / nights : 0;
  const guestInsert = profile
    ? runtimeEnv.DB.prepare('UPDATE guest_profiles SET first_name = ?, last_name = ?, phone = COALESCE(?, phone), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(guest.first, guest.last, phone, email, guestId)
    : runtimeEnv.DB.prepare('INSERT INTO guest_profiles (id, first_name, last_name, nationality, phone, email, language, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(guestId, guest.first, guest.last, 'TR', phone, email, 'tr', 'CRM', 'CRM');
  const statements = [
    guestInsert,
    runtimeEnv.DB.prepare(`INSERT INTO reservations
      (id, reservation_number, status, arrival_date, departure_date, nights, adults, children, child_ages, room_type, room_id,
       board_type, nightly_rate, currency, total_amount, booking_source, agency, main_guest_id, contact_phone, contact_email,
       internal_notes, created_by, updated_by, source_system, source_id, crm_idempotency_key)
      VALUES (?, ?, 'confirmed', ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, 'crm', ?, ?, ?, ?, ?, 'CRM', 'CRM', 'crm', ?, ?)`)
      .bind(reservationId, reservationNumber, arrival, departure, nights, Number(body.guests || 1), 0,
        body.room_type || 'rt_std', room?.id || null, body.board_type || 'BB', nightly, currency, total,
        body.firm_name || null, guestId, phone, email, body.notes || null, sourceId, body.idempotency_key || `crm-${sourceId}`),
    runtimeEnv.DB.prepare('INSERT INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 1)').bind(`resguest_crm_${crypto.randomUUID()}`, reservationId, guestId)
  ];
  if (room) {
    statements.push(runtimeEnv.DB.prepare("INSERT INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, 'reserved', 'CRM')").bind(`assignment_crm_${crypto.randomUUID()}`, reservationId, room.id, arrival, departure));
  }
  await runtimeEnv.DB.batch(statements);
  return bridgeJson({
    duplicate: false, erp_reservation_id: reservationId, reservation_no: reservationNumber, status: 'confirmed',
    check_in: arrival, check_out: departure, nights, room_id: room?.id || null, room_number: room?.room_number || null,
    room_name: room ? `${room.room_number} · ${room.room_type}` : null, currency, total_amount: total
  }, 201);
}

async function handleCrmReservationStatus(request, runtimeEnv, reservationId) {
  if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  const row = await runtimeEnv.DB.prepare(`
    SELECT r.*, rm.room_number, s.id AS stay_id, s.status AS stay_status
    FROM reservations r LEFT JOIN rooms rm ON rm.id = r.room_id LEFT JOIN stays s ON s.reservation_id = r.id
    WHERE r.id = ? LIMIT 1
  `).bind(reservationId).first();
  if (!row) return bridgeJson({ error: 'Rezervasyon bulunamadı.' }, 404);
  return bridgeJson({ ...row, erp_reservation_id: row.id, reservation_no: row.reservation_number, stay: row.stay_id ? { id: row.stay_id, status: row.stay_status } : null });
}

async function upsertCrmGuest(runtimeEnv, input = {}) {
  const guest = input.guest || input;
  const first = String(guest.first_name || 'Misafir').trim();
  const last = String(guest.last_name || 'CRM').trim();
  const email = String(guest.email || '').trim().toLowerCase() || null;
  const phone = String(guest.phone || '').trim() || null;
  const found = email || phone ? await runtimeEnv.DB.prepare('SELECT id FROM guest_profiles WHERE (? IS NOT NULL AND lower(email) = lower(?)) OR (? IS NOT NULL AND phone = ?) LIMIT 1').bind(email, email, phone, phone).first() : null;
  const guestId = found?.id || `guest_crm_${crypto.randomUUID()}`;
  const statement = found
    ? runtimeEnv.DB.prepare('UPDATE guest_profiles SET first_name = ?, last_name = ?, phone = COALESCE(?, phone), email = COALESCE(?, email), nationality = COALESCE(?, nationality), identity_number = COALESCE(?, identity_number), passport_number = COALESCE(?, passport_number), address = COALESCE(?, address), updated_by = \'CRM\', updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(first, last, phone, email, guest.nationality || null, guest.identity_number || null, guest.passport_number || null, guest.address || null, guestId)
    : runtimeEnv.DB.prepare('INSERT INTO guest_profiles (id, first_name, last_name, nationality, identity_number, passport_number, phone, email, address, language, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'CRM\', \'CRM\')').bind(guestId, first, last, guest.nationality || 'TR', guest.identity_number || null, guest.passport_number || null, phone, email, guest.address || null, guest.language || 'tr');
  await statement.run();
  return guestId;
}

async function handleCrmReservationUpdate(request, runtimeEnv, reservationId) {
  if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try { body = await request.json(); } catch { return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400); }
  const existing = await runtimeEnv.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(reservationId).first();
  if (!existing) return bridgeJson({ error: 'Rezervasyon bulunamadı.' }, 404);
  const arrival = String(body.check_in || existing.arrival_date);
  const departure = String(body.check_out || existing.departure_date);
  const nights = Math.round((new Date(`${departure}T00:00:00Z`) - new Date(`${arrival}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(nights) || nights <= 0) return bridgeJson({ error: 'Geçerli tarih aralığı zorunludur.' }, 400);
  const status = String(body.status || existing.status);
  const room = body.room_type ? await findCrmRoom(runtimeEnv, body.room_type, arrival, departure, reservationId) : null;
  if (body.room_type && !room) return bridgeJson({ error: 'Güncelleme için seçilen oda tipi bu tarih aralığında müsait değil.' }, 409);
  const roomId = body.room_type ? (room?.id || null) : existing.room_id;
  const guestId = body.guest ? await upsertCrmGuest(runtimeEnv, body.guest) : existing.main_guest_id;
  const total = body.total_amount === undefined ? Number(existing.total_amount || 0) : Number(body.total_amount || 0);
  const nightly = body.nightly_rate === undefined ? (nights ? Number(total) / nights : 0) : Number(body.nightly_rate || 0);
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(`UPDATE reservations SET status = ?, arrival_date = ?, departure_date = ?, nights = ?, room_type = ?, room_id = ?, board_type = ?, nightly_rate = ?, currency = ?, total_amount = ?, main_guest_id = ?, contact_phone = ?, contact_email = ?, internal_notes = COALESCE(?, internal_notes), updated_by = 'CRM', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(status, arrival, departure, nights, body.room_type || existing.room_type, roomId, body.board_type || existing.board_type, nightly, body.currency || existing.currency, total, guestId, body.guest?.phone || existing.contact_phone, body.guest?.email || existing.contact_email, body.notes || null, reservationId),
    runtimeEnv.DB.prepare("UPDATE room_assignments SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE reservation_id = ? AND status IN ('reserved', 'active')").bind(reservationId),
    runtimeEnv.DB.prepare("INSERT INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) SELECT ?, ?, ?, ?, ?, 'reserved', 'CRM' WHERE ? NOT IN ('cancelled', 'no_show', 'checked_out') AND ? IS NOT NULL").bind(`assignment_crm_${crypto.randomUUID()}`, reservationId, roomId, arrival, departure, status, roomId)
  ]);
  return handleCrmReservationStatus(new Request(`https://aeon-reception.internal/api/module/crm/reservations/${reservationId}`, { headers: { 'x-aeon-crm-token': request.headers.get('x-aeon-crm-token') || '' } }), runtimeEnv, reservationId);
}

async function handleCrmGuestUpsert(request, runtimeEnv) {
  if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
  let body;
  try { body = await request.json(); } catch { return bridgeJson({ error: 'Geçerli bir JSON gövdesi zorunludur.' }, 400); }
  const guestId = await upsertCrmGuest(runtimeEnv, body.guest || body);
  return bridgeJson({ success: true, guest_id: guestId });
}

function assetRequest(request, runtimeEnv, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return runtimeEnv.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, runtimeEnv, context) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/module/guest-requests') {
      return handleModuleGuestRequest(request, runtimeEnv);
    }
    if (url.pathname === '/api/module/crm/health' && request.method === 'GET') {
      if (!crmAuthorized(request, runtimeEnv)) return bridgeJson({ error: 'Modül bağlantı yetkisi geçersiz.' }, 401);
      return bridgeJson({ ok: true, system: 'AEON Reception Module', module: 'reception', time: new Date().toISOString() });
    }
    if (url.pathname === '/api/module/crm/availability' && request.method === 'POST') return handleCrmAvailability(request, runtimeEnv);
    if (url.pathname === '/api/module/crm/reservations' && request.method === 'POST') return handleCrmReservation(request, runtimeEnv);
    if (url.pathname === '/api/module/crm/guests/upsert' && request.method === 'POST') return handleCrmGuestUpsert(request, runtimeEnv);
    if (request.method === 'PATCH' && url.pathname.startsWith('/api/module/crm/reservations/')) return handleCrmReservationUpdate(request, runtimeEnv, url.pathname.split('/').pop());
    if (request.method === 'GET' && url.pathname.startsWith('/api/module/crm/reservations/')) return handleCrmReservationStatus(request, runtimeEnv, url.pathname.split('/').pop());
    if (request.method === 'GET' || request.method === 'HEAD') {
      const page = pageAliases.get(url.pathname);
      if (page) return assetRequest(request, runtimeEnv, page);
      if (!url.pathname.startsWith('/api/')) {
        const asset = await runtimeEnv.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }
    }
    return appHandler.fetch(request, runtimeEnv, context);
  }
};
