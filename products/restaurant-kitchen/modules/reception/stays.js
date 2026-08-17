import { id, actor, audit, today, json, mask, folioBalance, roomAvailable, checkoutReceipt, validateIdentity } from './helpers.js';

// Active-stay lifecycle: listing in-house stays, room operational status, check-in,
// room moves, and check-out (including the checkout receipt).
export function registerStayRoutes({ app, eventBus }) {
  app.get('/api/reception/stays', async (req, res) => {
    const rows = await req.db.all("SELECT s.*, r.reservation_number, r.arrival_date, r.departure_date, rm.room_number, g.first_name, g.last_name, g.phone, f.total_amount FROM stays s JOIN reservations r ON r.id = s.reservation_id JOIN rooms rm ON rm.id = s.room_id LEFT JOIN guest_profiles g ON g.id = r.main_guest_id LEFT JOIN folios f ON f.id = s.folio_id WHERE s.status = 'checked_in' ORDER BY s.checkin_at DESC");
    const results = await Promise.all(rows.map(async item => ({ ...item, balance: await folioBalance(req.db, item.folio_id) })));
    res.json(results);
  });

  app.patch('/api/reception/rooms/:id/operations', async (req, res) => {
    const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı.' });
    const data = req.body || {};
    const activeStay = await req.db.get("SELECT id FROM stays WHERE room_id = ? AND status = 'checked_in'", [room.id]);
    const allowedStatuses = ['clean_vacant', 'dirty_vacant', 'maintenance', 'out_of_order', 'blocked'];
    if (data.status && !allowedStatuses.includes(data.status)) return res.status(400).json({ error: 'Geçersiz oda durumu.' });
    if (data.status && activeStay) return res.status(409).json({ error: 'Konaklayan bulunan odanın durumu giriş/çıkış işlemiyle değişir.' });
    const user = actor(req);
    await req.db.run('UPDATE rooms SET status = ?, ac_status = ?, dnd_active = ?, maintenance_notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [data.status || room.status, data.ac_status || room.ac_status || 'working', data.dnd_active ? 1 : 0, String(data.maintenance_notes || '').trim(), user.name, room.id]);
    await audit(req.db, req, 'room', room.id, 'operations_updated', room, data);
    res.json({ success: true });
  });

  app.post('/api/reception/checkin', async (req, res) => {
    try {
      const reservation = await req.db.get('SELECT * FROM reservations WHERE id = ?', [req.body.reservation_id]);
      if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
      if (!['confirmed', 'guaranteed', 'option', 'inquiry'].includes(reservation.status)) return res.status(409).json({ error: 'Bu rezervasyon check-in durumuna uygun değil.' });
      if (!reservation.room_id) return res.status(400).json({ error: 'Check-in için oda ataması zorunludur.' });
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [reservation.room_id]);
      if (!room || room.status !== 'clean_vacant') return res.status(409).json({ error: 'Oda temiz ve hazır olmadan check-in yapılamaz.' });
      const guests = await req.db.all('SELECT g.* FROM reservation_guests rg JOIN guest_profiles g ON g.id = rg.guest_id WHERE rg.reservation_id = ?', [reservation.id]);
      const invalidGuests = guests.filter(item => !validateIdentity(item));
      if (!guests.length || invalidGuests.length) return res.status(400).json({ error: `Kimlik bilgisi eksik veya geçersiz: ${(invalidGuests.length ? invalidGuests : guests).map(item => `${item.first_name} ${item.last_name}`).join(', ')}. Giriş ekranından kimlik veya pasaport bilgisini tamamlayın.` });
      const already = await req.db.get("SELECT id FROM stays WHERE reservation_id = ? AND status = 'checked_in'", [reservation.id]);
      if (already) return res.status(409).json({ error: 'Bu rezervasyon zaten check-in yapılmış.' });
      const user = actor(req); const stayId = id('stay'); const folioId = id('folio');
      await req.db.transaction(async tx => {
        await tx.run("INSERT INTO folios (id, tenant_id, room_id, total_amount, type, details, created_by, status) VALUES (?, ?, ?, 0, 'stay', ?, ?, 'open')", [folioId, req.tenantId, room.id, reservation.reservation_number, user.name], {
          undoSql: 'DELETE FROM folios WHERE id = ?', undoParams: [folioId]
        });
        await tx.run("INSERT INTO stays (id, reservation_id, room_id, folio_id, status, checkin_at, business_date, board_type, nightly_rate, currency, adults, children, created_by, updated_by) VALUES (?, ?, ?, ?, 'checked_in', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)", [stayId, reservation.id, room.id, folioId, reservation.departure_date, reservation.board_type, reservation.nightly_rate, reservation.currency, reservation.adults, reservation.children, user.name, user.name], {
          undoSql: 'DELETE FROM stays WHERE id = ?', undoParams: [stayId]
        });
        for (const guest of guests) {
          await tx.run('INSERT INTO stay_guests (id, stay_id, guest_id, is_main) VALUES (?, ?, ?, ?)', [id('stayguest'), stayId, guest.id, guest.id === reservation.main_guest_id ? 1 : 0], {
            undoSql: 'DELETE FROM stay_guests WHERE stay_id = ? AND guest_id = ?', undoParams: [stayId, guest.id]
          });
        }
        await tx.run("UPDATE reservations SET status = 'checked_in', updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?", [user.name, reservation.id], {
          undoSql: 'UPDATE reservations SET status = ? WHERE id = ?', undoParams: [reservation.status, reservation.id]
        });
        // Guard the room-status flip itself (not just the earlier, unlocked `room.status`
        // read above) so two check-in requests racing for the same clean_vacant room can't
        // both succeed: only the first UPDATE actually matches status='clean_vacant' and
        // flips it; the second throws (via requireChange) and its whole transaction — stay,
        // folio, KBS rows — is rolled back instead of silently double-occupying the room.
        await tx.run("UPDATE rooms SET status = 'occupied', guest_name = ?, arrival_date = ?, departure_date = ?, board_type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'clean_vacant'", [`${guests[0].first_name} ${guests[0].last_name}`, reservation.arrival_date, reservation.departure_date, reservation.board_type, user.name, room.id], {
          undoSql: 'UPDATE rooms SET status = ?, guest_name = ?, arrival_date = ?, departure_date = ?, board_type = ? WHERE id = ?',
          undoParams: [room.status, room.guest_name, room.arrival_date, room.departure_date, room.board_type, room.id],
          requireChange: true, failureMessage: 'Oda bu sırada başka bir işlemle dolduruldu; lütfen tekrar deneyin.'
        });
        await tx.run("UPDATE room_assignments SET stay_id = ?, status = 'checked_in' WHERE reservation_id = ? AND room_id = ? AND status = 'reserved'", [stayId, reservation.id, room.id], {
          undoSql: "UPDATE room_assignments SET stay_id = NULL, status = 'reserved' WHERE reservation_id = ? AND room_id = ? AND status = 'checked_in'", undoParams: [reservation.id, room.id]
        });
        for (const guest of guests) {
          await tx.run("INSERT INTO identity_notifications (id, stay_id, guest_id, notification_type, payload_snapshot, validation_status, status) VALUES (?, ?, ?, 'arrival', ?, 'valid', 'pending')", [id('kbs'), stayId, guest.id, json({ guest_id: guest.id, nationality: guest.nationality, identity_or_passport: guest.nationality === 'TR' ? mask(guest.identity_number) : mask(guest.passport_number), arrival_date: reservation.arrival_date })], {
            undoSql: 'DELETE FROM identity_notifications WHERE stay_id = ? AND guest_id = ? AND notification_type = ?', undoParams: [stayId, guest.id, 'arrival']
          });
        }
        await audit(tx, req, 'stay', stayId, 'checked_in', null, { reservation_id: reservation.id, room_id: room.id });
      });
      eventBus.emit('room_updated', { tenantId: req.tenantId, roomId: room.id });
      res.status(201).json({ stay_id: stayId, folio_id: folioId });
    } catch (error) { res.status(error.message?.includes('başka bir işlemle') ? 409 : 500).json({ error: error.message || 'Check-in tamamlanamadı.' }); }
  });

  // One-time cutover tool: reservations imported from the pre-ERP system for guests who are
  // already physically in-house (arrival in the past, departure in the future) were never run
  // through the normal check-in flow, so they sit at 'confirmed' and the room never flips to
  // 'occupied' — the dashboard shows them as empty even though the hotel is actually full. The
  // normal /api/reception/checkin route correctly requires KBS identity for NEW check-ins, but
  // that data was never captured for this migrated batch, so this route checks them in without
  // it and flags each one in the KBS queue as needing manual review instead of blocking the
  // whole occupancy picture on a data-entry backlog.
  app.post('/api/reception/reservations/bulk-migrate-checkin', async (req, res) => {
    const role = String(req.actor?.role || '').toLowerCase();
    if (!['admin', 'manager', 'yönetici'].includes(role)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const user = actor(req);
    const businessDate = today();
    const candidates = await req.db.all("SELECT * FROM reservations WHERE status IN ('confirmed', 'guaranteed') AND arrival_date <= ? AND departure_date >= ? AND room_id IS NOT NULL ORDER BY arrival_date ASC", [businessDate, businessDate]);
    const migrated = [];
    const skipped = [];
    for (const reservation of candidates) {
      const already = await req.db.get("SELECT id FROM stays WHERE reservation_id = ? AND status = 'checked_in'", [reservation.id]);
      if (already) { skipped.push({ reservation_number: reservation.reservation_number, reason: 'already_checked_in' }); continue; }
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [reservation.room_id]);
      if (!room) { skipped.push({ reservation_number: reservation.reservation_number, reason: 'room_not_found' }); continue; }
      if (room.status === 'occupied') { skipped.push({ reservation_number: reservation.reservation_number, reason: 'room_conflict', room_number: room.room_number }); continue; }
      let guests = await req.db.all('SELECT g.* FROM reservation_guests rg JOIN guest_profiles g ON g.id = rg.guest_id WHERE rg.reservation_id = ?', [reservation.id]);
      if (!guests.length && reservation.main_guest_id) {
        const mainGuest = await req.db.get('SELECT * FROM guest_profiles WHERE id = ?', [reservation.main_guest_id]);
        if (mainGuest) guests = [mainGuest];
      }
      if (!guests.length) { skipped.push({ reservation_number: reservation.reservation_number, reason: 'no_guest' }); continue; }
      const stayId = id('stay'); const folioId = id('folio');
      const identityMissing = guests.some(guest => !validateIdentity(guest));
      try {
        await req.db.transaction(async tx => {
          await tx.run("INSERT INTO folios (id, tenant_id, room_id, total_amount, type, details, created_by, status) VALUES (?, ?, ?, 0, 'stay', ?, ?, 'open')", [folioId, req.tenantId, room.id, reservation.reservation_number, user.name], {
            undoSql: 'DELETE FROM folios WHERE id = ?', undoParams: [folioId]
          });
          await tx.run("INSERT INTO stays (id, reservation_id, room_id, folio_id, status, checkin_at, business_date, board_type, nightly_rate, currency, adults, children, created_by, updated_by) VALUES (?, ?, ?, ?, 'checked_in', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)", [stayId, reservation.id, room.id, folioId, reservation.departure_date, reservation.board_type, reservation.nightly_rate, reservation.currency, reservation.adults, reservation.children, user.name, user.name], {
            undoSql: 'DELETE FROM stays WHERE id = ?', undoParams: [stayId]
          });
          for (const guest of guests) {
            await tx.run('INSERT INTO stay_guests (id, stay_id, guest_id, is_main) VALUES (?, ?, ?, ?)', [id('stayguest'), stayId, guest.id, guest.id === reservation.main_guest_id ? 1 : 0], {
              undoSql: 'DELETE FROM stay_guests WHERE stay_id = ? AND guest_id = ?', undoParams: [stayId, guest.id]
            });
          }
          await tx.run("UPDATE reservations SET status = 'checked_in', updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?", [user.name, reservation.id], {
            undoSql: 'UPDATE reservations SET status = ? WHERE id = ?', undoParams: [reservation.status, reservation.id]
          });
          // Same room-status race guard as the interactive check-in route above — a concurrent
          // live check-in for this room mid-migration should abort this candidate, not stack a
          // second stay on top of the room.
          await tx.run("UPDATE rooms SET status = 'occupied', guest_name = ?, arrival_date = ?, departure_date = ?, board_type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'occupied'", [`${guests[0].first_name} ${guests[0].last_name}`, reservation.arrival_date, reservation.departure_date, reservation.board_type, user.name, room.id], {
            undoSql: 'UPDATE rooms SET status = ?, guest_name = ?, arrival_date = ?, departure_date = ?, board_type = ? WHERE id = ?',
            undoParams: [room.status, room.guest_name, room.arrival_date, room.departure_date, room.board_type, room.id],
            requireChange: true, failureMessage: 'room_conflict'
          });
          await tx.run("UPDATE room_assignments SET stay_id = ?, status = 'checked_in' WHERE reservation_id = ? AND room_id = ? AND status = 'reserved'", [stayId, reservation.id, room.id], {
            undoSql: "UPDATE room_assignments SET stay_id = NULL, status = 'reserved' WHERE reservation_id = ? AND room_id = ? AND status = 'checked_in'", undoParams: [reservation.id, room.id]
          });
          for (const guest of guests) {
            const kbsId = id('kbs');
            await tx.run("INSERT INTO identity_notifications (id, stay_id, guest_id, notification_type, payload_snapshot, validation_status, status) VALUES (?, ?, ?, 'arrival', ?, ?, ?)", [kbsId, stayId, guest.id, json({ guest_id: guest.id, nationality: guest.nationality, migrated: true, arrival_date: reservation.arrival_date }), identityMissing ? 'missing' : 'valid', identityMissing ? 'manual_review' : 'pending'], {
              undoSql: 'DELETE FROM identity_notifications WHERE id = ?', undoParams: [kbsId]
            });
          }
          await audit(tx, req, 'stay', stayId, 'migrated_checked_in', null, { reservation_id: reservation.id, room_id: room.id, identity_missing: identityMissing });
        });
        eventBus.emit('room_updated', { tenantId: req.tenantId, roomId: room.id });
        migrated.push({ reservation_number: reservation.reservation_number, room_number: room.room_number, identity_missing: identityMissing });
      } catch (error) {
        skipped.push({ reservation_number: reservation.reservation_number, reason: error.message });
      }
    }
    res.json({ success: true, migrated_count: migrated.length, skipped_count: skipped.length, migrated, skipped });
  });

  // Placeholder marker so a null identity_number doesn't read as "never collected" — flags
  // the migrated-from-XLSX guests for a real KBS-compliant identity entry later, without
  // blocking today's occupancy picture on it.
  app.post('/api/reception/reservations/mark-migrated-identity-placeholder', async (req, res) => {
    const role = String(req.actor?.role || '').toLowerCase();
    if (!['admin', 'manager', 'yönetici'].includes(role)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const guests = await req.db.all("SELECT DISTINCT guest_id FROM identity_notifications WHERE validation_status = 'missing' AND payload_snapshot LIKE '%migrated%'");
    let updated = 0;
    for (const row of guests) {
      const result = await req.db.run("UPDATE guest_profiles SET identity_number = 'XLSX', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND identity_number IS NULL AND passport_number IS NULL", [row.guest_id]);
      updated += result.changes || 0;
    }
    res.json({ success: true, updated });
  });

  app.post('/api/reception/stays/:id/move', async (req, res) => {
    try {
      const reason = String(req.body.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'Oda değişimi için gerekçe zorunludur.' });
      const stay = await req.db.get("SELECT * FROM stays WHERE id = ? AND status = 'checked_in'", [req.params.id]);
      if (!stay) return res.status(404).json({ error: 'Aktif konaklama bulunamadı.' });
      const newRoomId = req.body.room_id;
      const target = await req.db.get('SELECT * FROM rooms WHERE id = ?', [newRoomId]);
      if (!target || target.status !== 'clean_vacant') return res.status(409).json({ error: 'Hedef oda temiz ve boş olmalıdır.' });
      const reservation = await req.db.get('SELECT * FROM reservations WHERE id = ?', [stay.reservation_id]);
      if (!await roomAvailable(req.db, newRoomId, today(), reservation.departure_date, reservation.id)) return res.status(409).json({ error: 'Hedef oda tarihlerde uygun değil.' });
      const oldRoom = await req.db.get('SELECT * FROM rooms WHERE id = ?', [stay.room_id]); const user = actor(req);
      await req.db.transaction(async tx => {
        await tx.run("UPDATE rooms SET status = 'dirty_vacant', guest_name = '', dnd_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.name, oldRoom.id], {
          undoSql: 'UPDATE rooms SET status = ?, guest_name = ?, dnd_active = ? WHERE id = ?', undoParams: [oldRoom.status, oldRoom.guest_name, oldRoom.dnd_active, oldRoom.id]
        });
        // Re-validate the target room's status inside the transaction, not just via the
        // unlocked read above — otherwise two concurrent moves (or a move racing a fresh
        // check-in) into the same target room could both pass the earlier check and one
        // guest's move would silently overwrite the room state the other just set.
        await tx.run("UPDATE rooms SET status = 'occupied', guest_name = ?, arrival_date = ?, departure_date = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'clean_vacant'", [oldRoom.guest_name, reservation.arrival_date, reservation.departure_date, user.name, target.id], {
          undoSql: 'UPDATE rooms SET status = ?, guest_name = ?, arrival_date = ?, departure_date = ? WHERE id = ?',
          undoParams: [target.status, target.guest_name, target.arrival_date, target.departure_date, target.id],
          requireChange: true, failureMessage: 'Hedef oda bu sırada başka bir işlemle dolduruldu; lütfen tekrar deneyin.'
        });
        await tx.run("UPDATE stays SET room_id = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?, version = version + 1 WHERE id = ? AND status = 'checked_in'", [target.id, user.name, stay.id], {
          undoSql: 'UPDATE stays SET room_id = ?, version = ? WHERE id = ?', undoParams: [stay.room_id, stay.version, stay.id],
          requireChange: true, failureMessage: 'Konaklama artık aktif değil.'
        });
        await tx.run('UPDATE reservations SET room_id = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [target.id, user.name, reservation.id], {
          undoSql: 'UPDATE reservations SET room_id = ? WHERE id = ?', undoParams: [reservation.room_id, reservation.id]
        });
        await tx.run("UPDATE room_assignments SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE stay_id = ? AND status = 'checked_in'", [stay.id], {
          undoSql: "UPDATE room_assignments SET status = 'checked_in', ended_at = NULL WHERE stay_id = ? AND status = 'ended'", undoParams: [stay.id]
        });
        const assignmentId = id('assignment');
        await tx.run("INSERT INTO room_assignments (id, reservation_id, stay_id, room_id, start_date, end_date, status, override_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, 'checked_in', ?, ?)", [assignmentId, reservation.id, stay.id, target.id, today(), reservation.departure_date, reason, user.name], {
          undoSql: 'DELETE FROM room_assignments WHERE id = ?', undoParams: [assignmentId]
        });
        const taskId = id('task');
        await tx.run("INSERT INTO reception_tasks (id, task_type, department, room_id, stay_id, details, created_by) VALUES (?, 'room_move_cleaning', 'Housekeeping', ?, ?, ?, ?)", [taskId, oldRoom.id, stay.id, `Oda değişimi sonrası ${oldRoom.room_number} temizliği`, user.name], {
          undoSql: 'DELETE FROM reception_tasks WHERE id = ?', undoParams: [taskId]
        });
        await audit(tx, req, 'stay', stay.id, 'room_moved', { room_id: oldRoom.id }, { room_id: target.id }, req.body.reason || null);
      });
      eventBus.emit('room_updated', { tenantId: req.tenantId, roomId: oldRoom.id }); eventBus.emit('room_updated', { tenantId: req.tenantId, roomId: target.id });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message || 'Oda değişimi tamamlanamadı.' }); }
  });

  app.get('/api/reception/stays/:id/checkout-receipt', async (req, res) => {
    try {
      const receipt = await checkoutReceipt(req.db, req.params.id);
      if (!receipt) return res.status(404).json({ error: 'Konaklama bulunamadı.' });
      res.json(receipt);
    } catch (error) { res.status(500).json({ error: error.message || 'Hesap fişi alınamadı.' }); }
  });

  app.post('/api/reception/stays/:id/checkout', async (req, res) => {
    try {
      const stay = await req.db.get("SELECT * FROM stays WHERE id = ? AND status = 'checked_in'", [req.params.id]); if (!stay) return res.status(404).json({ error: 'Aktif konaklama bulunamadı.' });
      const balance = await folioBalance(req.db, stay.folio_id); if (balance > 0.009 && !req.body.receivable_reason) return res.status(409).json({ error: 'Ödenmemiş bakiye için tahsilat veya alacak gerekçesi zorunludur.', balance });
      const reservation = await req.db.get('SELECT * FROM reservations WHERE id = ?', [stay.reservation_id]);
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [stay.room_id]);
      const folio = await req.db.get('SELECT status FROM folios WHERE id = ?', [stay.folio_id]);
      const user = actor(req);
      await req.db.transaction(async tx => {
        // Guarded on status='checked_in' so two concurrent checkout clicks on the same stay
        // (e.g. a double-tap on a slow connection) can't both run the full side-effect chain
        // below — the second one aborts instead of posting a duplicate cleaning task and a
        // duplicate departure KBS notification for the same guest.
        await tx.run("UPDATE stays SET status = 'checked_out', checkout_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ? AND status = 'checked_in'", [user.name, stay.id], {
          undoSql: 'UPDATE stays SET status = ?, checkout_at = NULL WHERE id = ?', undoParams: [stay.status, stay.id],
          requireChange: true, failureMessage: 'Bu konaklama için çıkış işlemi zaten yapılmış.'
        });
        await tx.run("UPDATE reservations SET status = 'checked_out', updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?", [user.name, reservation.id], {
          undoSql: 'UPDATE reservations SET status = ? WHERE id = ?', undoParams: [reservation.status, reservation.id]
        });
        await tx.run("UPDATE folios SET status = ? WHERE id = ?", [balance > 0.009 ? 'transferred_receivable' : 'closed', stay.folio_id], {
          undoSql: 'UPDATE folios SET status = ? WHERE id = ?', undoParams: [folio.status, stay.folio_id]
        });
        await tx.run("UPDATE rooms SET status = 'dirty_vacant', guest_name = '', dnd_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.name, stay.room_id], {
          undoSql: 'UPDATE rooms SET status = ?, guest_name = ?, dnd_active = ? WHERE id = ?', undoParams: [room.status, room.guest_name, room.dnd_active, room.id]
        });
        await tx.run("UPDATE stay_guests SET checked_out_at = CURRENT_TIMESTAMP WHERE stay_id = ?", [stay.id], {
          undoSql: 'UPDATE stay_guests SET checked_out_at = NULL WHERE stay_id = ?', undoParams: [stay.id]
        });
        const guests = await tx.all('SELECT guest_id FROM stay_guests WHERE stay_id = ?', [stay.id]);
        for (const guest of guests) {
          const kbsId = id('kbs');
          await tx.run("INSERT INTO identity_notifications (id, stay_id, guest_id, notification_type, payload_snapshot, validation_status, status) VALUES (?, ?, ?, 'departure', ?, 'valid', 'pending')", [kbsId, stay.id, guest.guest_id, json({ stay_id: stay.id, departure_date: today() })], {
            undoSql: 'DELETE FROM identity_notifications WHERE id = ?', undoParams: [kbsId]
          });
        }
        const taskId = id('task');
        await tx.run("INSERT INTO reception_tasks (id, task_type, department, room_id, stay_id, details, created_by) VALUES (?, 'checkout_cleaning', 'Housekeeping', ?, ?, ?, ?)", [taskId, stay.room_id, stay.id, 'Check-out sonrası oda temizliği', user.name], {
          undoSql: 'DELETE FROM reception_tasks WHERE id = ?', undoParams: [taskId]
        });
        await audit(tx, req, 'stay', stay.id, 'checked_out', { balance }, { room_id: stay.room_id }, req.body.receivable_reason || null);
      });
      eventBus.emit('room_updated', { tenantId: req.tenantId, roomId: stay.room_id });
      res.json({ success: true, balance, receipt: await checkoutReceipt(req.db, stay.id) });
    } catch (error) { res.status(500).json({ error: error.message || 'Check-out tamamlanamadı.' }); }
  });
}
