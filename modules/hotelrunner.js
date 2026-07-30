import crypto from 'crypto';
import express from 'express';
import { createHotelRunnerClient, getHotelRunnerConfigurationStatus } from '../integrations/hotelrunner.js';

const provider = 'hotelrunner';
const id = prefix => `${prefix}_${crypto.randomUUID()}`;
const clean = value => String(value ?? '').trim();
const json = value => JSON.stringify(value ?? null);
const parse = value => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
const nights = (from, to) => Math.max(1, Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000));
const statusFor = state => String(state || '').toLowerCase() === 'canceled' ? 'cancelled' : 'confirmed';
const enabled = configured => process.env.HOTELRUNNER_ENABLED === undefined ? configured : process.env.HOTELRUNNER_ENABLED === 'true' && configured;

function safeEqual(left, right) {
  const a = Buffer.from(clean(left));
  const b = Buffer.from(clean(right));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function sourceGuest(reservation) {
  const person = reservation.guest && typeof reservation.guest === 'object' ? reservation.guest : {};
  const fullName = clean(typeof reservation.guest === 'string' ? reservation.guest : '');
  const [firstFromFull = 'Misafir', ...rest] = fullName.split(/\s+/);
  return {
    firstName: clean(person.first_name || person.firstname || reservation.firstname || firstFromFull) || 'Misafir',
    lastName: clean(person.last_name || person.lastname || reservation.lastname || rest.join(' ')) || 'HotelRunner',
    phone: clean(person.phone || reservation.address?.phone),
    email: clean(person.email || reservation.address?.email),
    nationality: clean(person.nationality || reservation.country || reservation.address?.country_code).toUpperCase() || 'TR'
  };
}

function safeSnapshot(reservation) {
  const guest = sourceGuest(reservation);
  return {
    reservation_id: reservation.reservation_id ?? reservation.hr_number ?? reservation.reservation_number,
    hr_number: reservation.hr_number ?? null,
    provider_number: reservation.provider_number ?? null,
    message_uid: reservation.message_uid ?? null,
    state: reservation.state ?? null,
    modified: Boolean(reservation.modified),
    channel: reservation.channel ?? null,
    channel_display: reservation.channel_display ?? reservation.source_display ?? null,
    checkin_date: reservation.checkin_date ?? null,
    checkout_date: reservation.checkout_date ?? null,
    currency: reservation.currency ?? 'TRY',
    total: Number(reservation.total || 0),
    paid_amount: Number(reservation.paid_amount || 0),
    note: clean(reservation.note).slice(0, 1000),
    guest,
    rooms: (Array.isArray(reservation.rooms) ? reservation.rooms : []).map((room, index) => ({
      id: room.id ?? room.hr_id ?? room.code ?? index,
      inv_code: room.inv_code ?? room.availability_group ?? room.code ?? null,
      rate_code: room.rate_code ?? room.rate_plan_code ?? null,
      name: room.name_presentation ?? room.name ?? null,
      voucher_number: room.voucher_number ?? null,
      state: room.state ?? reservation.state ?? null,
      checkin_date: room.checkin_date ?? reservation.checkin_date ?? null,
      checkout_date: room.checkout_date ?? reservation.checkout_date ?? null,
      adults: Number(room.total_adult ?? room.adults ?? 1),
      children: Array.isArray(room.child_ages) ? room.child_ages.length : Number(room.children || 0),
      child_ages: Array.isArray(room.child_ages) ? room.child_ages : [],
      meal_plan: room.meal_plan ?? room.meal_plan_presentation ?? null,
      total: Number(room.total ?? room.price ?? 0),
      price: Number(room.price ?? 0),
      updated_at: room.updated_at ?? reservation.updated_at ?? null
    }))
  };
}

async function connection(db, patch = {}) {
  const current = await db.get('SELECT * FROM channel_connections WHERE provider = ?', [provider]);
  const row = { enabled: 0, connection_status: 'not_configured', sync_mode: 'push_pull', metadata: '{}', ...current, ...patch };
  if (current) await db.run('UPDATE channel_connections SET enabled = ?, connection_status = ?, last_sync_at = ?, last_success_at = ?, last_error = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ?', [row.enabled, row.connection_status, row.last_sync_at || null, row.last_success_at || null, row.last_error || null, row.metadata || '{}', provider]);
  else await db.run('INSERT INTO channel_connections (id, provider, property_id, enabled, connection_status, sync_mode, last_sync_at, last_success_at, last_error, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id('channel'), provider, null, row.enabled, row.connection_status, row.sync_mode, row.last_sync_at || null, row.last_success_at || null, row.last_error || null, row.metadata || '{}']);
  return await db.get('SELECT * FROM channel_connections WHERE provider = ?', [provider]);
}

async function cache(db, key, payload) {
  await db.run('DELETE FROM channel_cache WHERE provider = ? AND cache_key = ?', [provider, key]);
  await db.run('INSERT INTO channel_cache (id, provider, cache_key, payload, expires_at) VALUES (?, ?, ?, ?, ?)', [id('cache'), provider, key, json(payload), new Date(Date.now() + 3600000).toISOString()]);
}

async function cached(db, key) {
  const item = await db.get('SELECT * FROM channel_cache WHERE provider = ? AND cache_key = ?', [provider, key]);
  return parse(item?.payload) || null;
}

async function operation(db, direction, operationType, entityReference, payload) {
  const operationId = id('sync');
  await db.run('INSERT INTO channel_sync_operations (id, provider, direction, operation_type, entity_reference, status, request_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)', [operationId, provider, direction, operationType, entityReference || null, 'processing', json(payload)]);
  return operationId;
}

async function operationDone(db, operationId, response) {
  await db.run("UPDATE channel_sync_operations SET status = 'completed', response_snapshot = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [json(response), operationId]);
}

async function operationFailed(db, operationId, error) {
  await db.run("UPDATE channel_sync_operations SET status = 'failed', attempts = attempts + 1, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [clean(error?.message || error).slice(0, 1000), operationId]);
}

async function notify(db, severity, title, message, entityType, entityId) {
  await db.run('INSERT INTO channel_notifications (id, provider, severity, title, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('channel_note'), provider, severity, title, message, entityType || null, entityId || null]);
}

async function profile(db, guest) {
  const candidates = await db.all('SELECT * FROM guest_profiles');
  const found = candidates.find(item => (guest.email && clean(item.email).toLowerCase() === guest.email.toLowerCase()) || (guest.phone && clean(item.phone) === guest.phone));
  if (found) {
    await db.run('UPDATE guest_profiles SET first_name = ?, last_name = ?, phone = ?, email = ?, nationality = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [guest.firstName, guest.lastName, guest.phone || found.phone, guest.email || found.email, guest.nationality || found.nationality, 'HotelRunner', found.id]);
    return found.id;
  }
  const guestId = id('guest');
  await db.run('INSERT INTO guest_profiles (id, first_name, last_name, nationality, phone, email, language, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [guestId, guest.firstName, guest.lastName, guest.nationality || 'TR', guest.phone || null, guest.email || null, 'tr', 'HotelRunner', 'HotelRunner']);
  return guestId;
}

async function mappingFor(db, room) {
  const invCode = clean(room.inv_code);
  if (!invCode) return null;
  return await db.get("SELECT * FROM channel_room_mappings WHERE provider = ? AND active = 1 AND external_inv_code = ? ORDER BY updated_at DESC", [provider, invCode]);
}

async function rateMappingFor(db, room) {
  const rateCode = clean(room.rate_code);
  if (!rateCode) return { required: false, mapping: null };
  const mapping = await db.get("SELECT * FROM channel_room_mappings WHERE provider = ? AND active = 1 AND external_rate_code = ? ORDER BY updated_at DESC", [provider, rateCode]);
  return { required: true, mapping };
}

async function createReservation(db, externalId, room, mapping, snapshot, guestId, index) {
  const arrival = date(room.checkin_date) || date(snapshot.checkin_date);
  const departure = date(room.checkout_date) || date(snapshot.checkout_date);
  if (!arrival || !departure || arrival >= departure) throw new Error('HotelRunner rezervasyon tarihleri geçersiz.');
  const localId = id('res');
  const ref = crypto.createHash('sha256').update(`${externalId}:${room.id}`).digest('hex').slice(0, 12).toUpperCase();
  const reservationNumber = `DHR-${ref}`;
  const total = Number(room.total || 0) || Number(snapshot.total || 0) / Math.max(1, snapshot.rooms.length);
  const rate = Number(room.price || 0) || total / nights(arrival, departure);
  // All four rows below describe the same imported room-reservation; if a later insert throws
  // (e.g. the link or audit row), the reservation/guest rows already written must not survive as
  // an orphan with no channel link — that orphan would then be invisible to future
  // create-or-update lookups (which key off channel_reservation_links) and could be recreated as
  // a duplicate on the next sync.
  await db.transaction(async tx => {
    await tx.run('INSERT INTO reservations (id, reservation_number, status, arrival_date, departure_date, nights, adults, children, child_ages, room_type, room_id, board_type, nightly_rate, currency, total_amount, deposit_amount, booking_source, agency, voucher_number, payment_method, payment_status, main_guest_id, contact_phone, contact_email, special_requests, external_provider, external_reservation_id, external_room_id, channel_sync_status, channel_last_update, precheckin_token, precheckin_expires_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [localId, reservationNumber, statusFor(room.state || snapshot.state), arrival, departure, nights(arrival, departure), Number(room.adults || 1), Number(room.children || 0), json(room.child_ages || []), mapping.local_room_type || null, null, clean(room.meal_plan) || 'BB', rate, snapshot.currency || 'TRY', total, Number(snapshot.paid_amount || 0), 'HotelRunner', snapshot.channel_display || snapshot.channel || 'HotelRunner', room.voucher_number || snapshot.provider_number || externalId, snapshot.payment || 'agency', Number(snapshot.paid_amount || 0) > 0 ? 'partial' : 'pending', guestId, snapshot.guest.phone || null, snapshot.guest.email || null, clean(snapshot.note) || null, provider, externalId, String(room.id), 'synced', room.updated_at || new Date().toISOString(), crypto.randomBytes(24).toString('base64url'), `${departure}T23:59:59.000Z`, 'HotelRunner', 'HotelRunner'], {
      undoSql: 'DELETE FROM reservations WHERE id = ?', undoParams: [localId]
    });
    await tx.run('INSERT INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 1)', [id('resguest'), localId, guestId], {
      undoSql: 'DELETE FROM reservation_guests WHERE reservation_id = ? AND guest_id = ?', undoParams: [localId, guestId]
    });
    await tx.run('INSERT INTO channel_reservation_links (id, provider, external_reservation_id, external_room_id, reservation_id, last_external_update) VALUES (?, ?, ?, ?, ?, ?)', [id('link'), provider, externalId, String(room.id), localId, room.updated_at || snapshot.updated_at || new Date().toISOString()], {
      undoSql: 'DELETE FROM channel_reservation_links WHERE reservation_id = ?', undoParams: [localId]
    });
    await tx.run('INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, actor_id, actor_name) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('audit'), 'reservation', localId, 'hotelrunner_imported', json({ external_id: externalId, room_id: room.id, index }), 'hotelrunner', 'HotelRunner']);
  });
  return localId;
}

async function cancelReservation(db, externalId, eventId, snapshot) {
  const links = await db.all('SELECT * FROM channel_reservation_links WHERE provider = ? AND external_reservation_id = ?', [provider, externalId]);
  if (!links.length) return { processed: false, manual: true, reason: 'Eşleşen Aeon rezervasyonu bulunamadı.' };
  for (const link of links) {
    const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', [link.reservation_id]);
    if (!reservation || ['checked_in', 'checked_out'].includes(reservation.status)) {
      await notify(db, 'warning', 'HotelRunner iptal incelemesi', `${externalId} numaralı iptal aktif konaklama ile çakışıyor.`, 'reservation', link.reservation_id);
      return { processed: false, manual: true, reason: 'Aktif konaklama iptal edilemez.' };
    }
    await db.transaction(async tx => {
      await tx.run("UPDATE reservations SET status = 'cancelled', cancellation_reason = ?, channel_sync_status = 'synced', channel_last_update = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'HotelRunner' WHERE id = ?", [clean(snapshot.cancel_reason) || 'HotelRunner cancellation', snapshot.updated_at || new Date().toISOString(), link.reservation_id], {
        undoSql: 'UPDATE reservations SET status = ? WHERE id = ?', undoParams: [reservation.status, link.reservation_id]
      });
      await tx.run("UPDATE room_assignments SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE reservation_id = ? AND status IN ('reserved','active')", [link.reservation_id]);
    });
  }
  await db.run("UPDATE channel_reservation_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = ?", [eventId]);
  return { processed: true, reservations: links.map(item => item.reservation_id) };
}

async function ingest(db, remote) {
  const snapshot = safeSnapshot(remote);
  const externalId = clean(snapshot.hr_number || snapshot.reservation_id || remote.reservation_number);
  if (!externalId) throw new Error('HotelRunner rezervasyon kimliği eksik.');
  const messageUid = clean(snapshot.message_uid) || `derived:${hash(snapshot)}`;
  const payloadHash = hash(snapshot);
  const previous = await db.get('SELECT * FROM channel_reservation_events WHERE provider = ? AND message_uid = ?', [provider, messageUid]);
  if (previous && previous.payload_hash === payloadHash && previous.processing_status === 'processed') return { duplicate: true, eventId: previous.id, reservationId: previous.reservation_id };
  if (previous && previous.payload_hash === payloadHash) {
    // Same payload as a prior attempt that never reached 'processed' (crashed mid-loop, stuck in
    // 'processing', or flagged for manual_review) — this is a legitimate retry, not a duplicate.
    await db.run('DELETE FROM channel_reservation_events WHERE id = ?', [previous.id]);
  } else if (previous) {
    await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', error_message = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?", ['Aynı message_uid farklı içerikle tekrar alındı.', previous.id]);
    await notify(db, 'danger', 'HotelRunner mesaj çakışması', `${externalId} mesajı farklı içerikle tekrar geldi.`, 'reservation', previous.reservation_id);
    return { manual: true, eventId: previous.id };
  }
  const eventId = id('event');
  await db.run('INSERT INTO channel_reservation_events (id, provider, external_reservation_id, message_uid, event_type, external_state, payload_hash, payload_snapshot, processing_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [eventId, provider, externalId, messageUid, snapshot.state === 'canceled' ? 'cancelled' : snapshot.modified ? 'modified' : 'created', snapshot.state || null, payloadHash, json(snapshot), 'processing']);
  if (String(snapshot.state).toLowerCase() === 'canceled') return { ...(await cancelReservation(db, externalId, eventId, snapshot)), eventId, messageUid };
  if (!snapshot.rooms.length) {
    await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', error_message = ? WHERE id = ?", ['HotelRunner oda satırı bulunamadı.', eventId]);
    await notify(db, 'warning', 'HotelRunner rezervasyon incelemesi', `${externalId} için oda satırı bulunamadı.`, 'reservation', null);
    return { manual: true, eventId, messageUid };
  }
  const mappings = await Promise.all(snapshot.rooms.map(room => mappingFor(db, room)));
  if (mappings.some(item => !item)) {
    const unknown = snapshot.rooms[mappings.findIndex(item => !item)];
    await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', error_message = ? WHERE id = ?", [`Oda envanter eşlemesi bulunamadı: ${clean(unknown.inv_code) || '-'}`, eventId]);
    await notify(db, 'warning', 'HotelRunner eşleme gerekli', `${externalId} için ${clean(unknown.name) || clean(unknown.inv_code) || 'oda'} eşlemesi yapılmalı.`, 'reservation', null);
    return { manual: true, eventId, messageUid };
  }
  const rateMappings = await Promise.all(snapshot.rooms.map(room => rateMappingFor(db, room)));
  if (rateMappings.some(item => item.required && !item.mapping)) {
    const unknown = snapshot.rooms[rateMappings.findIndex(item => item.required && !item.mapping)];
    await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', error_message = ? WHERE id = ?", [`Fiyat planı eşlemesi bulunamadı: ${clean(unknown.rate_code) || '-'}`, eventId]);
    await notify(db, 'warning', 'HotelRunner fiyat planı eşlemesi gerekli', `${externalId} için ${clean(unknown.rate_code) || 'fiyat planı'} eşlemesi yapılmalı.`, 'reservation', null);
    return { manual: true, eventId, messageUid };
  }
  const guestId = await profile(db, snapshot.guest);
  const reservationIds = [];
  try {
  for (let index = 0; index < snapshot.rooms.length; index += 1) {
    const room = snapshot.rooms[index];
    const link = await db.get('SELECT * FROM channel_reservation_links WHERE provider = ? AND external_reservation_id = ? AND external_room_id = ?', [provider, externalId, String(room.id)]);
    if (link) {
      const local = await db.get('SELECT * FROM reservations WHERE id = ?', [link.reservation_id]);
      const arrival = date(room.checkin_date) || date(snapshot.checkin_date);
      const departure = date(room.checkout_date) || date(snapshot.checkout_date);
      if (!local || ['checked_in', 'checked_out'].includes(local.status) || !arrival || !departure || arrival >= departure) {
        await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', error_message = ? WHERE id = ?", ['Mevcut konaklama güvenli olarak güncellenemedi.', eventId]);
        await notify(db, 'warning', 'HotelRunner değişiklik incelemesi', `${externalId} için manuel resepsiyon incelemesi gerekli.`, 'reservation', link?.reservation_id || null);
        return { manual: true, eventId, messageUid };
      }
      const total = Number(room.total || 0) || Number(snapshot.total || 0) / snapshot.rooms.length;
      const roomState = String(room.state || snapshot.state || '').toLowerCase();
      if (roomState === 'canceled' && String(snapshot.state).toLowerCase() !== 'canceled') {
        await db.run("UPDATE reservations SET status = 'cancelled', cancellation_reason = ?, channel_sync_status = 'synced', channel_last_update = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'HotelRunner' WHERE id = ?", [clean(snapshot.cancel_reason) || 'HotelRunner room cancellation', snapshot.updated_at || new Date().toISOString(), link.reservation_id]);
        await db.run("UPDATE room_assignments SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE reservation_id = ? AND status IN ('reserved','active')", [link.reservation_id]);
        reservationIds.push(link.reservation_id);
        continue;
      }
      await db.run("UPDATE reservations SET status = ?, arrival_date = ?, departure_date = ?, nights = ?, adults = ?, children = ?, child_ages = ?, room_type = ?, board_type = ?, nightly_rate = ?, currency = ?, total_amount = ?, deposit_amount = ?, agency = ?, voucher_number = ?, main_guest_id = ?, contact_phone = ?, contact_email = ?, special_requests = ?, channel_sync_status = 'synced', channel_last_update = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'HotelRunner', version = version + 1 WHERE id = ?", [statusFor(room.state || snapshot.state), arrival, departure, nights(arrival, departure), Number(room.adults || 1), Number(room.children || 0), json(room.child_ages || []), mappings[index].local_room_type || local.room_type, clean(room.meal_plan) || local.board_type, Number(room.price || 0) || total / nights(arrival, departure), snapshot.currency || local.currency, total, Number(snapshot.paid_amount || 0), snapshot.channel_display || snapshot.channel || local.agency, room.voucher_number || snapshot.provider_number || local.voucher_number, guestId, snapshot.guest.phone || local.contact_phone, snapshot.guest.email || local.contact_email, clean(snapshot.note) || local.special_requests, room.updated_at || snapshot.updated_at || new Date().toISOString(), link.reservation_id]);
      await db.run('UPDATE channel_reservation_links SET last_external_update = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [room.updated_at || snapshot.updated_at || new Date().toISOString(), link.id]);
      reservationIds.push(link.reservation_id);
    } else reservationIds.push(await createReservation(db, externalId, room, mappings[index], snapshot, guestId, index));
  }
  } catch (error) {
    await db.run("UPDATE channel_reservation_events SET processing_status = 'manual_review', reservation_id = ?, error_message = ? WHERE id = ?", [reservationIds[0] || null, `Çok odalı işleme kısmi hata: ${clean(error?.message || error).slice(0, 500)}`, eventId]);
    await notify(db, 'danger', 'HotelRunner kısmi işleme hatası', `${externalId} bazı oda satırları işlenemedi, manuel inceleme gerekli.`, 'reservation', reservationIds[0] || null);
    return { manual: true, eventId, messageUid, reservationIds, partial: true };
  }
  await db.run("UPDATE channel_reservation_events SET processing_status = 'processed', reservation_id = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?", [reservationIds[0] || null, eventId]);
  return { processed: true, eventId, messageUid, reservationIds, pmsNumber: reservationIds.length === 1 ? (await db.get('SELECT reservation_number FROM reservations WHERE id = ?', [reservationIds[0]]))?.reservation_number : externalId };
}

async function ingestSafely(db, remote) {
  const messageUidGuess = clean(remote?.message_uid) || null;
  try {
    return await ingest(db, remote);
  } catch (error) {
    try {
      const externalId = clean(remote?.hr_number || remote?.reservation_id || remote?.reservation_number) || 'unknown';
      const eventId = id('event');
      await db.run('INSERT INTO channel_reservation_events (id, provider, external_reservation_id, message_uid, event_type, external_state, payload_hash, payload_snapshot, processing_status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [eventId, provider, externalId, messageUidGuess || `error:${crypto.randomUUID()}`, 'error', remote?.state || null, hash(remote || {}), json(remote || null), 'manual_review', clean(error?.message || error).slice(0, 1000)]);
      await notify(db, 'danger', 'HotelRunner işleme hatası', `${externalId} işlenirken hata oluştu: ${clean(error?.message || error).slice(0, 300)}`, 'reservation', null);
    } catch { /* best-effort failure logging; never let logging itself crash the process */ }
    return { manual: true, error: true, message: clean(error?.message || error) };
  }
}

async function roomMappings(db) {
  const localRooms = await db.all('SELECT * FROM rooms ORDER BY room_number');
  const types = [...new Map(localRooms.filter(room => clean(room.room_type)).map(room => [room.room_type, room])).values()];
  const mappings = await db.all('SELECT * FROM channel_room_mappings WHERE provider = ? ORDER BY updated_at DESC', [provider]);
  const remote = (await cached(db, 'rooms'))?.rooms || (await cached(db, 'rooms')) || [];
  return { rooms: types.map(room => {
    const mapping = mappings.find(item => item.local_room_id === room.id || item.local_room_type === room.room_type && !item.external_rate_code);
    return { id: mapping?.id || `local:${room.room_type}`, mapping_id: mapping?.id || null, local_id: room.id, local_room_id: room.id, local_room_type: room.room_type, local_name: room.room_type, local_code: room.room_type, external_code: mapping?.external_inv_code || '', external_inv_code: mapping?.external_inv_code || '', external_name: mapping?.external_name || '', active: mapping?.active ?? 1, remote_candidates: remote.filter(item => clean(item.inv_code) === clean(mapping?.external_inv_code)) };
  }), rates: mappings.filter(item => clean(item.external_rate_code)).map(item => ({ id: item.id, local_id: item.local_room_id || item.local_room_type, local_name: item.local_room_type || item.local_room_id || 'Fiyat planı', local_code: item.local_room_type || '-', external_code: item.external_rate_code, external_rate_code: item.external_rate_code, external_name: item.external_name || '', active: item.active })) };
}

async function pushDaily(db, client, kind) {
  const mappings = await db.all('SELECT * FROM channel_room_mappings WHERE provider = ? AND active = 1 AND external_inv_code IS NOT NULL', [provider]);
  const days = Array.from({ length: 30 }, (_, index) => { const value = new Date(); value.setUTCDate(value.getUTCDate() + index); return value.toISOString().slice(0, 10); });
  const rooms = await db.all('SELECT * FROM rooms');
  const assignments = await db.all("SELECT * FROM room_assignments WHERE status IN ('active','reserved','checked_in')");
  const blocks = await db.all("SELECT * FROM room_blocks WHERE status = 'active'");
  const payload = [];
  for (const mapping of mappings) {
    const sameType = rooms.filter(room => room.room_type === mapping.local_room_type);
    if (!sameType.length) continue;
    const dates = days.map(day => {
      const available = sameType.filter(room => !assignments.some(item => item.room_id === room.id && item.start_date <= day && item.end_date > day) && !blocks.some(item => item.room_id === room.id && item.start_date <= day && item.end_date > day)).length;
      const price = Number(sameType[0].base_rate || 0);
      return kind === 'availability' ? { date: day, availability: available } : { date: day, price };
    });
    payload.push({ invCode: kind === 'rates' && mapping.external_rate_code ? undefined : mapping.external_inv_code, rateCode: kind === 'rates' ? mapping.external_rate_code || mapping.external_inv_code : undefined, dates });
  }
  if (!payload.length) return { updated: 0, skipped: true };
  const operationId = await operation(db, 'outbound', kind, null, { mappings: payload.length, days: days.length });
  try {
    const response = await client.updateRoomsDaily({ rooms: payload });
    await operationDone(db, operationId, response);
    return { updated: payload.length, transaction_id: response?.transaction_id || null };
  } catch (error) {
    await operationFailed(db, operationId, error);
    throw error;
  }
}

export function initHotelRunner({ app, eventBus, createClient = createHotelRunnerClient, configurationStatus = getHotelRunnerConfigurationStatus, commitDb } = {}) {
  if (!app) throw new Error('Express app gerekli.');
  const configuration = () => configurationStatus(process.env);
  const active = () => enabled(configuration().configured);
  const client = () => {
    if (!active()) { const error = new Error('HotelRunner üretim bağlantısı yapılandırılmadı.'); error.code = 'HOTELRUNNER_NOT_CONFIGURED'; throw error; }
    return createClient();
  };
  const emit = payload => eventBus?.emit?.('hotelrunner_sync', payload);
  const base = '/api/integrations/hotelrunner';

  app.get(`${base}/status`, async (req, res) => {
    const config = configuration();
    const current = await req.db.get('SELECT * FROM channel_connections WHERE provider = ?', [provider]);
    const pending = await req.db.get("SELECT COUNT(*) AS cnt FROM channel_sync_operations WHERE provider = ? AND status IN ('queued','processing','failed')", [provider]);
    const manual = await req.db.get("SELECT COUNT(*) AS cnt FROM channel_reservation_events WHERE provider = ? AND processing_status = 'manual_review'", [provider]);
    const configured = Boolean(config.configured); const isActive = active();
    res.json({ provider, configured, enabled: isActive, missing: config.missing || [], connected: current?.connection_status === 'connected', status: current?.connection_status || (configured ? (isActive ? 'pending_test' : 'disabled') : 'not_configured'), connection_status: current?.connection_status || (configured ? (isActive ? 'pending_test' : 'disabled') : 'not_configured'), last_sync_at: current?.last_sync_at || null, last_success_at: current?.last_success_at || null, last_error: current?.last_error || null, counts: { outbox_pending: Number(pending?.cnt || 0), manual_review: Number(manual?.cnt || 0) } });
  });

  app.get(`${base}/reservations`, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 250);
    const rows = await req.db.all("SELECT r.*, g.first_name, g.last_name FROM reservations r LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE r.external_provider = ? ORDER BY r.channel_last_update DESC, r.created_at DESC", [provider]);
    res.json(rows.slice(0, limit).map(row => ({ ...row, external_id: row.external_reservation_id, hotelrunner_reservation_id: row.external_reservation_id, source_channel: row.agency || row.booking_source, guest_name: `${row.first_name || ''} ${row.last_name || ''}`.trim() })));
  });

  app.get(`${base}/mappings`, async (req, res) => res.json(await roomMappings(req.db)));

  app.post(`${base}/mappings`, async (req, res) => {
    const body = req.body || {}; const code = clean(body.external_code || body.external_inv_code);
    if (!code) return res.status(400).json({ error: 'HotelRunner envanter veya fiyat kodu zorunludur.' });
    let room = body.local_room_id ? await req.db.get('SELECT * FROM rooms WHERE id = ?', [body.local_room_id]) : null;
    const localType = clean(body.local_room_type || room?.room_type || body.local_id);
    if (!localType) return res.status(400).json({ error: 'Aeon oda tipi zorunludur.' });
    const type = clean(body.mapping_type) === 'rate' ? 'rate' : 'room';
    const existing = await req.db.get(type === 'rate' ? 'SELECT id FROM channel_room_mappings WHERE provider = ? AND external_rate_code = ? AND active = 1' : 'SELECT id FROM channel_room_mappings WHERE provider = ? AND external_inv_code = ? AND active = 1', [provider, code]);
    if (existing) return res.status(409).json({ error: 'Bu HotelRunner kodu zaten aktif olarak eşlenmiş.' });
    const mappingId = id('mapping');
    await req.db.run('INSERT INTO channel_room_mappings (id, provider, external_inv_code, external_rate_code, external_name, local_room_type, local_room_id, active, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [mappingId, provider, type === 'room' ? code : clean(body.external_inv_code) || localType, type === 'rate' ? code : null, clean(body.external_name) || null, localType, room?.id || body.local_room_id || null, 1, req.actor?.name || 'Sistem']);
    res.status(201).json({ id: mappingId, external_code: code });
  });

  app.put(`${base}/mappings/:id`, async (req, res) => {
    const current = await req.db.get('SELECT * FROM channel_room_mappings WHERE id = ?', [req.params.id]);
    if (!current && !String(req.params.id).startsWith('local:')) return res.status(404).json({ error: 'Eşleme kaydı bulunamadı.' });
    if (!current) {
      const code = clean(req.body?.external_code || req.body?.external_inv_code);
      const localType = clean(req.body?.local_room_type || req.body?.local_id || req.params.id.slice(6));
      if (!code || !localType) return res.status(400).json({ error: 'Aeon kaydı ve HotelRunner kodu zorunludur.' });
      const mappingId = id('mapping');
      await req.db.run('INSERT INTO channel_room_mappings (id, provider, external_inv_code, external_rate_code, external_name, local_room_type, local_room_id, active, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [mappingId, provider, clean(req.body?.mapping_type) === 'rate' ? localType : code, clean(req.body?.mapping_type) === 'rate' ? code : null, clean(req.body?.external_name) || null, localType, null, 1, req.actor?.name || 'Sistem']);
      return res.status(201).json({ success: true, id: mappingId });
    }
    const code = clean(req.body?.external_code || req.body?.external_inv_code);
    if (!code) return res.status(400).json({ error: 'HotelRunner kodu zorunludur.' });
    const isRate = clean(req.body?.mapping_type) === 'rate';
    await req.db.run('UPDATE channel_room_mappings SET external_inv_code = ?, external_rate_code = ?, external_name = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [isRate ? current.external_inv_code : code, isRate ? code : current.external_rate_code, clean(req.body?.external_name) || null, req.actor?.name || 'Sistem', current.id]);
    res.json({ success: true, id: current.id });
  });

  app.get(`${base}/failures`, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 250);
    const operations = await req.db.all("SELECT * FROM channel_sync_operations WHERE provider = ? AND status IN ('failed','queued') ORDER BY updated_at DESC", [provider]);
    const events = await req.db.all("SELECT * FROM channel_reservation_events WHERE provider = ? AND processing_status = 'manual_review' ORDER BY received_at DESC", [provider]);
    const rows = [...operations.map(item => ({ ...item, operation: item.operation_type, resource_id: item.entity_reference, error_code: 'SYNC_ERROR', retry_count: item.attempts })), ...events.map(item => ({ ...item, operation: item.event_type, resource_id: item.external_reservation_id, error_code: 'MAPPING_REVIEW', status: 'open', retry_count: 0, created_at: item.received_at, message: item.error_message }))];
    res.json({ failures: rows.slice(0, limit) });
  });

  app.post(`${base}/failures/:id/retry`, async (req, res) => {
    const operationRow = await req.db.get('SELECT * FROM channel_sync_operations WHERE id = ? AND provider = ?', [req.params.id, provider]);
    if (operationRow) { await req.db.run("UPDATE channel_sync_operations SET status = 'queued', next_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [operationRow.id]); return res.json({ queued: 1 }); }
    const event = await req.db.get('SELECT * FROM channel_reservation_events WHERE id = ? AND provider = ?', [req.params.id, provider]);
    if (!event) return res.status(404).json({ error: 'Hata kaydı bulunamadı.' });
    await req.db.run("UPDATE channel_reservation_events SET processing_status = 'pending', error_message = NULL WHERE id = ?", [event.id]);
    res.json({ queued: 1 });
  });

  app.post(`${base}/failures/retry`, async (req, res) => {
    const rows = await req.db.all("SELECT id FROM channel_sync_operations WHERE provider = ? AND status = 'failed'", [provider]);
    for (const row of rows) await req.db.run("UPDATE channel_sync_operations SET status = 'queued', next_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
    res.json({ queued: rows.length });
  });

  app.get(`${base}/channels`, async (req, res) => {
    const data = await cached(req.db, 'channels');
    res.json({ channels: data?.channels || data || [] });
  });

  app.post(`${base}/connection/test`, async (req, res) => {
    try {
      const instance = client(); const [rooms, channels] = await Promise.all([instance.getRooms(), instance.getConnectedChannels?.() || instance.getChannels()]);
      await cache(req.db, 'rooms', rooms); await cache(req.db, 'channels', channels); await connection(req.db, { enabled: 1, connection_status: 'connected', last_success_at: new Date().toISOString(), last_error: null });
      res.json({ success: true, message: 'HotelRunner bağlantısı doğrulandı.', rooms: (rooms?.rooms || []).length, channels: (channels?.channels || []).length });
    } catch (error) {
      await connection(req.db, { enabled: 0, connection_status: active() ? 'error' : 'not_configured', last_error: clean(error.message).slice(0, 500) });
      res.status(502).json({ error: 'HotelRunner bağlantısı doğrulanamadı.' });
    }
  });

  const syncReservations = async (req, res) => {
    let operationId;
    try {
      const instance = client(); operationId = await operation(req.db, 'inbound', 'reservations', null, { requested_at: new Date().toISOString() });
      const response = await instance.retrieveReservations({ undelivered: true, perPage: 50 }); const records = Array.isArray(response?.reservations) ? response.reservations : [];
      const result = { processed: 0, duplicates: 0, manual_review: 0, acknowledgements_failed: 0, errors: 0 };
      for (const remote of records) {
        const imported = await ingestSafely(req.db, remote);
        if (imported.error) result.errors += 1; else if (imported.duplicate) result.duplicates += 1; else if (imported.manual) result.manual_review += 1; else if (imported.processed) result.processed += 1;
        if (imported.processed && imported.messageUid && instance.confirmReservationDelivery) {
          try { if (commitDb) await commitDb(req.tenantId); await instance.confirmReservationDelivery({ messageUid: imported.messageUid, pmsNumber: imported.pmsNumber }); await req.db.run('UPDATE channel_reservation_events SET acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?', [imported.eventId]); } catch (error) { result.acknowledgements_failed += 1; await notify(req.db, 'warning', 'HotelRunner teslim onayı bekliyor', 'Rezervasyon Aeon tarafında kaydedildi, teslim onayı yeniden denenecek.', 'channel_event', imported.eventId); }
        }
      }
      await operationDone(req.db, operationId, result); await connection(req.db, { enabled: 1, connection_status: 'connected', last_sync_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null }); emit({ tenantId: req.tenantId, result }); res.json(result);
    } catch (error) {
      if (operationId) await operationFailed(req.db, operationId, error);
      await connection(req.db, { connection_status: active() ? 'error' : 'not_configured', last_error: clean(error?.message || error).slice(0, 500) });
      res.status(502).json({ error: 'HotelRunner rezervasyonları alınamadı.' });
    }
  };
  app.post(`${base}/sync/reservations`, syncReservations);

  app.post(`${base}/sync/availability`, async (req, res) => { try { const result = await pushDaily(req.db, client(), 'availability'); await connection(req.db, { enabled: 1, connection_status: 'connected', last_sync_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null }); res.json(result); } catch (error) { res.status(502).json({ error: 'Müsaitlik HotelRunner’a gönderilemedi.' }); } });
  app.post(`${base}/sync/rates`, async (req, res) => { try { const result = await pushDaily(req.db, client(), 'rates'); await connection(req.db, { enabled: 1, connection_status: 'connected', last_sync_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null }); res.json(result); } catch (error) { res.status(502).json({ error: 'Fiyatlar HotelRunner’a gönderilemedi.' }); } });
  app.post(`${base}/sync/reconcile`, async (req, res) => { req.url = `${base}/sync/reservations`; return syncReservations(req, res); });

  app.post(`${base}/push`, express.urlencoded({ extended: false, limit: '1mb' }), async (req, res) => {
    const config = configuration();
    if (!config.configured || !safeEqual(req.query.token, process.env.HOTELRUNNER_TOKEN) || !safeEqual(req.query.hr_id, process.env.HOTELRUNNER_HR_ID)) return res.status(401).json({ error: 'Yetkisiz HotelRunner bildirimi.' });
    if (process.env.HOTELRUNNER_WEBHOOK_SECRET && !safeEqual(req.query.secret, process.env.HOTELRUNNER_WEBHOOK_SECRET)) return res.status(401).json({ error: 'Yetkisiz HotelRunner bildirimi.' });
    let payload; try { payload = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body?.data; } catch { return res.status(400).json({ error: 'HotelRunner bildirim verisi geçersiz.' }); }
    if (!payload || !Array.isArray(payload.reservations)) return res.status(400).json({ error: 'HotelRunner bildirim yapısı geçersiz.' });
    const outcome = { processed: 0, manual_review: 0, duplicates: 0, errors: 0 };
    try {
      for (const remote of payload.reservations) {
        const imported = await ingestSafely(req.db, remote);
        if (imported.error) outcome.errors += 1; else if (imported.duplicate) outcome.duplicates += 1; else if (imported.manual) outcome.manual_review += 1; else if (imported.processed) outcome.processed += 1;
      }
      await connection(req.db, { enabled: 1, connection_status: 'connected', last_sync_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null });
    } catch (error) {
      // ingestSafely already contains all per-record failures; this only guards against an
      // unexpected error outside that boundary (e.g. connection() write failing) so the webhook
      // endpoint can never crash the process or hang the caller without a response.
      await notify(req.db, 'danger', 'HotelRunner webhook hatası', clean(error?.message || error).slice(0, 500), 'reservation', null).catch(() => {});
      return res.status(200).json({ status: 'partial', ...outcome, error: 'internal_error_logged' });
    }
    emit({ tenantId: req.tenantId, result: outcome }); res.json({ status: 'ok', ...outcome });
  });
}
