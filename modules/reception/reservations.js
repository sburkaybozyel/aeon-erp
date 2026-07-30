import crypto from 'crypto';
import { id, actor, audit, normalize, mask, allowed, json, roomAvailable, validateDates, validateReservationPartySize, validateReservationMoney, validateContactInfo, validateRoomCapacity, profileFor } from './helpers.js';

// Physical room definitions, reservation CRUD, and guest-profile search.
export function registerReservationRoutes({ app }) {
  app.post('/api/reception/rooms', async (req, res) => {
    if (!['admin', 'manager', 'yönetici'].includes(String(req.actor?.role || '').toLowerCase())) return res.status(403).json({ error: 'Fiziksel oda tanımı yönetici yetkisi gerektirir.' });
    const data = req.body || {};
    if (!String(data.room_number || '').trim()) return res.status(400).json({ error: 'Oda numarası zorunludur.' });
    const duplicate = await req.db.get('SELECT id FROM rooms WHERE room_number = ?', [data.room_number.trim()]);
    if (duplicate) return res.status(409).json({ error: 'Bu oda numarası zaten tanımlı.' });
    const roomId = id('room'); const user = actor(req);
    await req.db.run("INSERT INTO rooms (id, room_number, status, eta, guest_name, room_type, floor, bed_type, capacity, base_rate, updated_by, updated_at) VALUES (?, ?, 'clean_vacant', 'Hazır', '', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)", [roomId, data.room_number.trim(), data.room_type || 'standard', Number(data.floor || 1), data.bed_type || 'double', Number(data.capacity || 2), Number(data.base_rate || 0), user.name]);
    await audit(req.db, req, 'room', roomId, 'created', null, { room_number: data.room_number, room_type: data.room_type });
    res.status(201).json({ id: roomId });
  });

  app.get('/api/reception/reservations', async (req, res) => {
    const search = normalize(req.query.search);
    const status = req.query.status;
    const records = await req.db.all('SELECT r.*, g.first_name, g.last_name, g.phone, g.email, g.nationality, g.identity_number, g.passport_number, rm.room_number FROM reservations r LEFT JOIN guest_profiles g ON g.id = r.main_guest_id LEFT JOIN rooms rm ON rm.id = r.room_id ORDER BY r.arrival_date DESC, r.created_at DESC');
    const filtered = records.filter(item => (!status || item.status === status) && (!search || [item.reservation_number, item.first_name, item.last_name, item.phone, item.identity_number, item.passport_number, item.room_number, item.booking_source, item.agency, item.voucher_number, item.external_reservation_id].some(value => normalize(value).includes(search))));
    res.json(filtered.map(item => ({ ...item, identity_number: allowed(req) ? item.identity_number : mask(item.identity_number), passport_number: allowed(req) ? item.passport_number : mask(item.passport_number) })));
  });

  app.post('/api/reception/reservations', async (req, res) => {
    try {
      const data = req.body || {};
      validateDates(data.arrival_date, data.departure_date);
      const { adults, children } = validateReservationPartySize(data);
      validateReservationMoney(data);
      validateContactInfo(data);
      if (!String(data.main_guest?.first_name || data.first_name || '').trim()) return res.status(400).json({ error: 'Ana misafir adı zorunludur.' });
      if (data.room_id && !await roomAvailable(req.db, data.room_id, data.arrival_date, data.departure_date)) return res.status(409).json({ error: 'Seçilen oda bu tarih aralığında uygun değil.' });
      if (data.room_id) await validateRoomCapacity(req.db, data.room_id, adults, children);
      const reservationId = id('res');
      const reservationNumber = `DL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const nights = Math.round((new Date(`${data.departure_date}T00:00:00Z`) - new Date(`${data.arrival_date}T00:00:00Z`)) / 86400000);
      const rate = Number(data.nightly_rate || 0);
      const tax = Number(data.tax_amount || 0);
      const discount = Number(data.discount_amount || 0);
      const total = Number(data.total_amount ?? Math.max(0, nights * rate + tax - discount));
      const user = actor(req);
      await req.db.transaction(async tx => {
        const guestId = await profileFor(tx, data.main_guest || data, req);
        await tx.run('INSERT INTO reservations (id, reservation_number, status, arrival_date, departure_date, nights, adults, children, child_ages, room_type, room_id, board_type, nightly_rate, currency, tax_amount, discount_amount, total_amount, deposit_amount, booking_source, agency, voucher_number, guarantee_type, payment_method, payment_due_date, payment_reminder, payment_status, main_guest_id, contact_phone, contact_email, arrival_info, special_requests, internal_notes, guest_notes, precheckin_token, precheckin_expires_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [reservationId, reservationNumber, data.status || 'inquiry', data.arrival_date, data.departure_date, nights, Number(data.adults || 1), Number(data.children || 0), json(data.child_ages || []), data.room_type || null, data.room_id || null, data.board_type || 'BB', rate, data.currency || 'TRY', tax, discount, total, Number(data.deposit_amount || 0), data.booking_source || null, data.agency || null, data.voucher_number || null, data.guarantee_type || null, data.payment_method || 'credit_card', data.payment_due_date || data.arrival_date, data.payment_reminder || null, data.payment_status || 'pending', guestId, data.contact_phone || data.main_guest?.phone || null, data.contact_email || data.main_guest?.email || null, data.arrival_info || null, data.special_requests || null, data.internal_notes || null, data.guest_notes || null, null, null, user.name, user.name], {
          undoSql: 'DELETE FROM reservations WHERE id = ?', undoParams: [reservationId]
        });
        await tx.run('INSERT INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 1)', [id('resguest'), reservationId, guestId], {
          undoSql: 'DELETE FROM reservation_guests WHERE reservation_id = ? AND guest_id = ?', undoParams: [reservationId, guestId]
        });
        for (const guest of data.accompanying_guests || []) {
          const profileId = await profileFor(tx, guest, req);
          await tx.run('INSERT INTO reservation_guests (id, reservation_id, guest_id, is_main) VALUES (?, ?, ?, 0)', [id('resguest'), reservationId, profileId], {
            undoSql: 'DELETE FROM reservation_guests WHERE reservation_id = ? AND guest_id = ?', undoParams: [reservationId, profileId]
          });
        }
        if (data.room_id) {
          const assignmentId = id('assignment');
          await tx.run("INSERT INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, 'reserved', ?)", [assignmentId, reservationId, data.room_id, data.arrival_date, data.departure_date, user.name], {
            undoSql: 'DELETE FROM room_assignments WHERE id = ?', undoParams: [assignmentId]
          });
        }
        if (data.precheckin_submission_id) {
          await tx.run("UPDATE guest_precheckin_submissions SET status = 'converted', reservation_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'reviewed'", [reservationId, data.precheckin_submission_id], {
            undoSql: "UPDATE guest_precheckin_submissions SET status = 'reviewed', reservation_id = NULL WHERE id = ?", undoParams: [data.precheckin_submission_id]
          });
        }
        await audit(tx, req, 'reservation', reservationId, 'created', null, { reservation_number: reservationNumber, status: data.status || 'inquiry' });
      });
      res.status(201).json({ id: reservationId, reservation_number: reservationNumber, precheckin_url: '/precheckin.html' });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.patch('/api/reception/reservations/:id', async (req, res) => {
    try {
      const existing = await req.db.get('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
      const data = req.body || {};
      const arrival = data.arrival_date || existing.arrival_date;
      const departure = data.departure_date || existing.departure_date;
      validateDates(arrival, departure);
      const roomId = data.room_id === undefined ? existing.room_id : data.room_id;
      if (roomId && !await roomAvailable(req.db, roomId, arrival, departure, existing.id)) return res.status(409).json({ error: 'Yeni oda veya tarihler çakışıyor.' });
      const user = actor(req);
      const depositAmount = Number(data.deposit_amount ?? existing.deposit_amount ?? 0);
      if (!Number.isFinite(depositAmount) || depositAmount < 0) return res.status(400).json({ error: 'Kapora tutarı geçerli olmalıdır.' });
      const status = data.status || existing.status;
      // Setting status to a terminal state here only ends the room_assignments row — it never
      // touches stays/rooms/folios. If the guest is actually still checked in, that would free
      // the room for a new booking on the same dates while the real stay (and its open folio)
      // silently stays active, letting two guests get assigned the same physical room. Force
      // the real checkout workflow (/api/reception/stays/:id/checkout) for that case instead.
      if (status !== existing.status && ['cancelled', 'no_show', 'checked_out'].includes(status)) {
        const activeStay = await req.db.get("SELECT id FROM stays WHERE reservation_id = ? AND status = 'checked_in'", [existing.id]);
        if (activeStay) return res.status(409).json({ error: 'Misafir hâlâ giriş yapmış durumda; önce Konaklayanlar ekranından check-out yapın.' });
      }
      const nights = Math.round((new Date(`${departure}T00:00:00Z`) - new Date(`${arrival}T00:00:00Z`)) / 86400000);
      const nightlyRate = Number(data.nightly_rate ?? existing.nightly_rate);
      const taxAmount = Number(data.tax_amount ?? existing.tax_amount ?? 0);
      const discountAmount = Number(data.discount_amount ?? existing.discount_amount ?? 0);
      const totalAmount = Math.max(0, nights * nightlyRate + taxAmount - discountAmount);
      const assignmentChanged = roomId !== existing.room_id || arrival !== existing.arrival_date || departure !== existing.departure_date || ['cancelled', 'no_show', 'checked_out'].includes(status);

      await req.db.transaction(async tx => {
        if (data.main_guest && existing.main_guest_id) {
          const guest = await tx.get('SELECT * FROM guest_profiles WHERE id = ?', [existing.main_guest_id]);
          if (guest) {
            const nationality = String(data.main_guest.nationality || guest.nationality || 'TR').toUpperCase();
            const identityNumber = data.main_guest.identity_number === undefined ? guest.identity_number : String(data.main_guest.identity_number || '').trim();
            const passportNumber = data.main_guest.passport_number === undefined ? guest.passport_number : String(data.main_guest.passport_number || '').trim();
            const phone = data.main_guest.phone === undefined ? guest.phone : String(data.main_guest.phone || '').trim();
            const email = data.main_guest.email === undefined ? guest.email : String(data.main_guest.email || '').trim();
            await tx.run('UPDATE guest_profiles SET first_name = ?, last_name = ?, identity_number = ?, passport_number = ?, document_type = ?, nationality = ?, phone = ?, email = ?, updated_by = ?, updated_at = ?, version = ? WHERE id = ?', [data.main_guest.first_name || guest.first_name, data.main_guest.last_name || guest.last_name, identityNumber || null, passportNumber || null, nationality === 'TR' ? 'national_id' : 'passport', nationality, phone || null, email || null, user.name, new Date().toISOString(), Number(guest.version || 1) + 1, guest.id], {
              undoSql: 'UPDATE guest_profiles SET first_name = ?, last_name = ?, identity_number = ?, passport_number = ?, document_type = ?, nationality = ?, phone = ?, email = ?, version = ? WHERE id = ?',
              undoParams: [guest.first_name, guest.last_name, guest.identity_number, guest.passport_number, guest.document_type, guest.nationality, guest.phone, guest.email, guest.version, guest.id]
            });
            await audit(tx, req, 'guest_profile', guest.id, 'identity_updated', guest, { nationality, identity_number: identityNumber ? 'updated' : null, passport_number: passportNumber ? 'updated' : null });
          }
        }
        await tx.run('UPDATE reservations SET status = ?, arrival_date = ?, departure_date = ?, nights = ?, room_id = ?, board_type = ?, nightly_rate = ?, currency = ?, tax_amount = ?, discount_amount = ?, total_amount = ?, payment_method = ?, deposit_amount = ?, payment_due_date = ?, payment_reminder = ?, payment_status = ?, internal_notes = ?, special_requests = ?, cancellation_reason = ?, updated_at = ?, updated_by = ?, version = ? WHERE id = ?', [status, arrival, departure, nights, roomId, data.board_type || existing.board_type, nightlyRate, data.currency || existing.currency, taxAmount, discountAmount, totalAmount, data.payment_method || existing.payment_method, depositAmount, data.payment_due_date || existing.payment_due_date, data.payment_reminder ?? existing.payment_reminder, data.payment_status || existing.payment_status, data.internal_notes ?? existing.internal_notes, data.special_requests ?? existing.special_requests, data.cancellation_reason ?? existing.cancellation_reason, new Date().toISOString(), user.name, Number(existing.version || 1) + 1, existing.id], {
          undoSql: 'UPDATE reservations SET status = ?, arrival_date = ?, departure_date = ?, nights = ?, room_id = ?, board_type = ?, nightly_rate = ?, currency = ?, tax_amount = ?, discount_amount = ?, total_amount = ?, payment_method = ?, deposit_amount = ?, payment_due_date = ?, payment_reminder = ?, payment_status = ?, internal_notes = ?, special_requests = ?, cancellation_reason = ?, version = ? WHERE id = ?',
          undoParams: [existing.status, existing.arrival_date, existing.departure_date, existing.nights, existing.room_id, existing.board_type, existing.nightly_rate, existing.currency, existing.tax_amount, existing.discount_amount, existing.total_amount, existing.payment_method, existing.deposit_amount, existing.payment_due_date, existing.payment_reminder, existing.payment_status, existing.internal_notes, existing.special_requests, existing.cancellation_reason, existing.version, existing.id]
        });
        if (assignmentChanged) {
          await tx.run("UPDATE room_assignments SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE reservation_id = ? AND status IN ('reserved','active')", [existing.id], {
            undoSql: "UPDATE room_assignments SET status = 'reserved', ended_at = NULL WHERE reservation_id = ? AND status = 'ended'", undoParams: [existing.id]
          });
          if (roomId && !['cancelled', 'no_show', 'checked_out'].includes(status)) {
            const assignmentId = id('assignment');
            await tx.run("INSERT INTO room_assignments (id, reservation_id, room_id, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, 'reserved', ?)", [assignmentId, existing.id, roomId, arrival, departure, user.name], {
              undoSql: 'DELETE FROM room_assignments WHERE id = ?', undoParams: [assignmentId]
            });
          }
        }
        await audit(tx, req, 'reservation', existing.id, 'updated', existing, { ...data, arrival_date: arrival, departure_date: departure });
      });
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.get('/api/reception/guests', async (req, res) => {
    const query = normalize(req.query.search);
    const guests = await req.db.all('SELECT * FROM guest_profiles ORDER BY updated_at DESC');
    res.json(guests.filter(item => !query || [item.first_name, item.last_name, item.phone, item.email, item.identity_number, item.passport_number].some(value => normalize(value).includes(query))).map(item => ({ ...item, identity_number: mask(item.identity_number), passport_number: mask(item.passport_number) })));
  });
}
