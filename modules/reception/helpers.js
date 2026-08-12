import crypto from 'crypto';

// Shared helpers for the reception module split. `id`, `actor`, `audit`, `folioBalance`
// and friends are used across the guest/stay CRUD, folio/billing, and cash-shift/reporting
// route groups, so they live here once and get imported wherever needed.

export const id = prefix => `${prefix}_${crypto.randomUUID()}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const actor = req => ({ id: req.actor?.id || 'system', name: req.actor?.name || 'Sistem' });
export const parse = value => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
export const json = value => JSON.stringify(value ?? null);
export const allowed = req => ['yönetici', 'manager', 'admin', 'reception', 'resepsiyon'].includes(normalize(req.actor?.role)) || ['reception', 'resepsiyon', 'management'].includes(normalize(req.actor?.department));
export const normalize = value => String(value || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
export const mask = value => { const text = String(value || ''); return text.length < 5 ? '••••' : `${text.slice(0, 2)}••••${text.slice(-2)}`; };
export const paymentLabels = { cash: 'Nakit', credit_card: 'Kredi Kartı', bank_transfer: 'Banka Havalesi', online_link: 'Ödeme Linki', agency: 'Acenta', company_receivable: 'Şirket Cari Hesabı' };

export function requireReception(req, res, next) {
  if (allowed(req)) return next();
  return res.status(req.actor ? 403 : 401).json({ error: req.actor ? 'Bu işlem ön büro yetkisi gerektirir.' : 'Oturum gerekli veya oturum süresi dolmuş.' });
}

// `db` is either `req.db` (outside a transaction) or a `tx` handle from `req.db.transaction(...)`
// so the audit row is undone along with everything else if a later step in the same transaction
// fails.
export async function audit(db, req, entityType, entityId, action, beforeData, afterData, reason = null) {
  const user = actor(req);
  await db.run('INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, reason, actor_id, actor_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id('audit'), entityType, entityId, action, json(beforeData), json(afterData), reason, user.id, user.name]);
}

export async function roomAvailable(db, roomId, arrivalDate, departureDate, excludeReservationId = null) {
  const room = await db.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (!room || ['maintenance', 'out_of_order', 'blocked'].includes(room.status)) return false;
  const assignments = await db.all("SELECT * FROM room_assignments WHERE status IN ('active','reserved','checked_in') AND room_id = ?", [roomId]);
  const blocks = await db.all("SELECT * FROM room_blocks WHERE status = 'active' AND room_id = ?", [roomId]);
  const overlaps = row => String(row.start_date) < departureDate && String(row.end_date) > arrivalDate;
  if (assignments.some(item => item.reservation_id !== excludeReservationId && overlaps(item))) return false;
  return !blocks.some(overlaps);
}

export async function folioBalance(db, folioId) {
  const row = await db.get('SELECT SUM(debit) AS debit, SUM(credit) AS credit FROM folio_transactions WHERE folio_id = ?', [folioId]);
  return Number(row?.debit || 0) - Number(row?.credit || 0);
}

export async function checkoutReceipt(db, stayId) {
  const stay = await db.get(`SELECT s.*, r.reservation_number, r.arrival_date, r.departure_date, r.currency AS reservation_currency, rm.room_number, g.first_name, g.last_name
    FROM stays s
    JOIN reservations r ON r.id = s.reservation_id
    JOIN rooms rm ON rm.id = s.room_id
    LEFT JOIN guest_profiles g ON g.id = r.main_guest_id
    WHERE s.id = ?`, [stayId]);
  if (!stay) return null;
  const transactions = await db.all('SELECT * FROM folio_transactions WHERE folio_id = ? ORDER BY occurred_at ASC, id ASC', [stay.folio_id]);
  const reversed = new Set(transactions.filter(item => item.transaction_type === 'reversal' && String(item.related_reference || '').startsWith('reversal:')).map(item => String(item.related_reference).slice('reversal:'.length)));
  const charges = transactions.filter(item => Number(item.debit || 0) > 0 && item.transaction_type !== 'reversal' && !reversed.has(item.id));
  const payments = transactions.filter(item => Number(item.credit || 0) > 0 && item.transaction_type !== 'reversal' && !reversed.has(item.id));
  const totalCharges = charges.reduce((sum, item) => sum + Number(item.debit || 0), 0);
  const totalPayments = payments.reduce((sum, item) => sum + Number(item.credit || 0), 0);
  return { stay, charges, payments, total_charges: totalCharges, total_payments: totalPayments, balance: totalCharges - totalPayments, currency: stay.currency || stay.reservation_currency || 'TRY' };
}

export async function profileFor(db, data, req) {
  const identity = normalize(data.identity_number);
  const passport = normalize(data.passport_number);
  const phone = normalize(data.phone);
  const email = normalize(data.email);
  const candidates = await db.all('SELECT * FROM guest_profiles');
  const found = candidates.find(item => (identity && normalize(item.identity_number) === identity) || (passport && normalize(item.passport_number) === passport) || (phone && normalize(item.phone) === phone) || (email && normalize(item.email) === email));
  const user = actor(req);
  if (found) {
    const before = { ...found };
    // Precheckin/reservation submissions carry identity_number/passport_number/document_type
    // (and sometimes date_of_birth/address/vehicle_plate) precisely for guests matched to an
    // *existing* profile (e.g. an imported reservation missing ID data) — these used to be
    // silently dropped here, so a guest submitting their own ID online never actually unblocked
    // check-in even though the approval flow reported success.
    const updates = { ...found, first_name: data.first_name || found.first_name, last_name: data.last_name || found.last_name, phone: data.phone || found.phone, email: data.email || found.email, nationality: data.nationality || found.nationality, language: data.language || found.language, identity_number: data.identity_number || found.identity_number, passport_number: data.passport_number || found.passport_number, document_type: data.document_type || found.document_type, date_of_birth: data.date_of_birth || found.date_of_birth, address: data.address || found.address, vehicle_plate: data.vehicle_plate || found.vehicle_plate, updated_by: user.name, updated_at: new Date().toISOString(), version: Number(found.version || 1) + 1 };
    await db.run('UPDATE guest_profiles SET first_name = ?, last_name = ?, phone = ?, email = ?, nationality = ?, language = ?, identity_number = ?, passport_number = ?, document_type = ?, date_of_birth = ?, address = ?, vehicle_plate = ?, updated_by = ?, updated_at = ?, version = ? WHERE id = ?', [updates.first_name, updates.last_name, updates.phone, updates.email, updates.nationality, updates.language, updates.identity_number, updates.passport_number, updates.document_type, updates.date_of_birth, updates.address, updates.vehicle_plate, updates.updated_by, updates.updated_at, updates.version, found.id]);
    await audit(db, req, 'guest_profile', found.id, 'profile_reused', before, updates);
    return found.id;
  }
  if (!data.first_name || !data.last_name) throw new Error('Misafir adı ve soyadı zorunludur.');
  const guestId = id('guest');
  await db.run('INSERT INTO guest_profiles (id, first_name, last_name, identity_number, passport_number, document_type, nationality, date_of_birth, gender, phone, email, address, vehicle_plate, language, preferences, allergies, vip, restricted, restriction_reason, kvkk_notice_at, marketing_consent, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [guestId, data.first_name, data.last_name, data.identity_number || null, data.passport_number || null, data.document_type || null, data.nationality || 'TR', data.date_of_birth || null, data.gender || null, data.phone || null, data.email || null, data.address || null, data.vehicle_plate || null, data.language || 'tr', data.preferences || null, data.allergies || null, data.vip ? 1 : 0, data.restricted ? 1 : 0, data.restriction_reason || null, data.kvkk_notice_at || null, data.marketing_consent ? 1 : 0, user.name, user.name]);
  await audit(db, req, 'guest_profile', guestId, 'created', null, { first_name: data.first_name, last_name: data.last_name });
  return guestId;
}

export function validateDates(arrivalDate, departureDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate || '') || arrivalDate >= departureDate) throw new Error('Geçerli varış ve ayrılış tarihleri zorunludur.');
}

export function validateReservationPartySize(data) {
  const adults = Number(data.adults ?? 1);
  const children = Number(data.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
    throw new Error('Yetişkin sayısı en az 1, çocuk sayısı 0 veya üzeri tam sayı olmalıdır.');
  }
  return { adults, children };
}

export function validateReservationMoney(data) {
  const deposit = data.deposit_amount === undefined ? 0 : Number(data.deposit_amount);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error('Kapora tutarı negatif olamaz.');
  const rate = data.nightly_rate === undefined ? 0 : Number(data.nightly_rate);
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Gecelik fiyat negatif olamaz.');
  return { deposit, rate };
}

export function validateContactInfo(data) {
  const email = String(data.contact_email || data.main_guest?.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçersiz e-posta adresi.');
  const phone = String(data.contact_phone || data.main_guest?.phone || '').trim();
  if (phone && !/^[0-9+()\s-]{7,20}$/.test(phone)) throw new Error('Geçersiz telefon numarası.');
}

export async function validateRoomCapacity(db, roomId, adults, children) {
  if (!roomId) return;
  const room = await db.get('SELECT capacity FROM rooms WHERE id = ?', [roomId]);
  if (room?.capacity && (adults + children) > Number(room.capacity)) {
    throw new Error(`Seçilen oda en fazla ${room.capacity} kişi kapasitelidir.`);
  }
}

export function validateIdentity(guest) {
  if (String(guest.nationality || 'TR').toUpperCase() === 'TR') return /^\d{11}$/.test(String(guest.identity_number || ''));
  return String(guest.passport_number || '').trim().length >= 4;
}
