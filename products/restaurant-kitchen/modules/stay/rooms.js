import crypto from 'crypto';

async function receptionJson(path) {
  const token = String(process.env.RECEPTION_MODULE_TOKEN || '').trim();
  const base = String(process.env.RECEPTION_MODULE_URL || '').replace(/\/$/, '');
  if (!token || (!base && !globalThis.__RECEPTION_SERVICE)) return null;
  const init = { headers: { 'x-aeon-module-token': token } };
  try {
    const response = globalThis.__RECEPTION_SERVICE
      ? await globalThis.__RECEPTION_SERVICE.fetch(new Request(`https://aeon-reception.internal${path}`, init))
      : await fetch(`${base}${path}`, init);
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  } catch {
    return null;
  }
}

// Room CRUD, status/DND transitions, the guest-facing room-context/targets/folio endpoints,
// and guest search — the core "rooms" surface of the Stay module.
export function registerRoomRoutes({ app, broadcastSSE }) {
  app.get('/api/guest/room-context', async (req, res) => {
    const target = String(req.query.target || '').replace(/^Room-/, '').trim();
    if (!target) return res.status(400).json({ error: 'Oda hedefi zorunludur.' });
    try {
      const remote = await receptionJson(`/api/module/dining/room-context?target=${encodeURIComponent(target)}`);
      if (remote?.ok) return res.json(remote.payload);
      if (remote && remote.status === 404) return res.status(404).json(remote.payload);
      const room = await req.db.get('SELECT id, room_number, room_type, floor, bed_type, capacity, view_type FROM rooms WHERE room_number = ?', [target]);
      if (!room) return res.status(404).json({ error: 'Oda QR hedefi bulunamadı.' });
      res.json({ target_identifier: `Room-${room.room_number}`, room });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public, PII-free target list for the guest portal's room/table picker. `/api/rooms` and
  // `/api/tables` require a staff session, so an anonymous guest hitting the un-locked picker
  // (guest.js setupTargetSelector) previously got a silent 401 and an empty dropdown.
  app.get('/api/guest/targets', async (req, res) => {
    try {
      const [rooms, tables] = await Promise.all([
        req.db.all("SELECT room_number FROM rooms ORDER BY CAST(room_number AS INT), room_number"),
        req.db.all("SELECT table_number, section FROM tables ORDER BY CAST(table_number AS INT), table_number")
      ]);
      res.json({ rooms: rooms.map(r => r.room_number), tables: tables.map(t => ({ table_number: t.table_number, section: t.section })) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/guest/folio', async (req, res) => {
    const roomNumber = String(req.query.target || '').replace(/^Room-/, '').trim();
    if (!roomNumber) return res.status(400).json({ error: 'Oda hedefi zorunludur.' });
    try {
      const remote = await receptionJson(`/api/module/dining/folio?target=${encodeURIComponent(roomNumber)}`);
      if (remote?.ok) return res.json(remote.payload);
      if (remote && remote.status === 404) return res.status(404).json(remote.payload);
      const room = await req.db.get('SELECT id, room_number, status FROM rooms WHERE room_number = ?', [roomNumber]);
      if (!room) return res.status(404).json({ error: 'Oda QR hedefi bulunamadı.' });
      const activeStay = await req.db.get("SELECT folio_id, checkin_at FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
      const charges = activeStay
        ? await req.db.all('SELECT id, type, details, total_amount, status, created_at FROM requests WHERE target_identifier = ? AND created_at >= ? ORDER BY created_at DESC', [`Room-${room.room_number}`, activeStay.checkin_at])
        : [];
      let stayFolio = null;
      if (activeStay?.folio_id) {
        const totals = await req.db.get('SELECT SUM(debit) AS debit, SUM(credit) AS credit FROM folio_transactions WHERE folio_id = ?', [activeStay.folio_id]);
        stayFolio = { balance: Number(totals?.debit || 0) - Number(totals?.credit || 0) };
      }
      res.json({ room, charges, stay_folio: stayFolio });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/rooms', async (req, res) => {
    try {
      const rooms = await req.db.all(`
        SELECT r.*, g.first_name AS guest_first_name, g.last_name AS guest_last_name,
          g.car_plate, g.phone, g.board_type AS guest_board_type, g.special_occasion AS guest_special_occasion,
          CASE WHEN g.id IS NOT NULL THEN trim(g.first_name || ' ' || g.last_name) ELSE r.guest_name END AS canonical_guest_name
        FROM rooms r
        LEFT JOIN guest_registry g ON r.id = g.room_id AND g.checked_out_at IS NULL
        ORDER BY CAST(r.room_number AS INT), r.room_number
      `);
      const actorRole = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
      const actorDepartment = String(req.actor?.department || '').toLocaleLowerCase('tr-TR');
      const canSeeGuestData = ['admin', 'manager', 'yönetici'].includes(actorRole) || ['reception', 'resepsiyon'].includes(actorDepartment);
      res.json(rooms.map(room => {
        const normalized = {
          ...room,
          guest_name: room.canonical_guest_name || room.guest_name || '',
          board_type: room.guest_board_type || room.board_type || 'BB',
          special_occasion: room.guest_special_occasion || room.special_occasion || ''
        };
        if (canSeeGuestData) return normalized;
        const { phone, car_plate, guest_first_name, guest_last_name, canonical_guest_name, guest_name, guest_special_occasion, special_occasion, ...operationalRoom } = normalized;
        return operationalRoom;
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  app.post('/api/rooms/checkin', async (req, res) => {
    // Retired: this legacy path never creates a stays/folio record, so guests checked in
    // here are silently unbillable and (per the folios-by-room_id guard in /checkout below)
    // can permanently block that room's checkout once any reception-module stay has ever
    // touched it. Real check-in is /api/reception/checkin (modules/reception.js), which
    // creates the stays+folio rows the rest of the app depends on. No frontend calls this.
    return res.status(410).json({ error: 'Bu uç nokta kaldırıldı. Check-in için Resepsiyon > Girişler ekranını kullanın.' });
  });

  app.post('/api/rooms/checkout', async (req, res) => {
    // Retired alongside /api/rooms/checkin above — real checkout is
    // /api/reception/stays/:id/checkout (modules/reception.js).
    return res.status(410).json({ error: 'Bu uç nokta kaldırıldı. Check-out için Resepsiyon > Konaklayanlar ekranını kullanın.' });
  });

  app.post('/api/rooms/status', async (req, res) => {
    const { roomId, status, updated_by } = req.body;
    const staff_name = req.actor?.name || 'Kat Hizmetleri / Ön Büro';
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      const transitions = {
        clean_vacant: ['maintenance'],
        // Occupied rooms must never be flipped to 'maintenance' through this generic
        // status endpoint: doing so silently orphans the guest's active stay (the room
        // shows out-of-service while the guest is still checked in, with no work order,
        // no reception notice, and none of the guards enforced by the dedicated
        // maintenance-ticket routes in modules/stay/maintenance.js, which correctly
        // reject `markRoomOutOfOrder`/legacy ticket creation against an occupied room).
        // A room that genuinely needs maintenance while occupied must go through a
        // maintenance ticket (and, from there, a room change/relocation), not a bare
        // status flip.
        occupied: [],
        dirty_vacant: ['assigned', 'cleaning', 'maintenance'],
        assigned: ['cleaning', 'maintenance'],
        cleaning: ['inspected', 'dirty_vacant', 'maintenance'],
        inspected: ['clean_vacant', 'dirty_vacant', 'maintenance'],
        maintenance: ['dirty_vacant', 'clean_vacant']
      };
      if (!transitions[room.status]?.includes(status) && room.status !== status) {
        return res.status(409).json({ error: `Geçersiz oda durumu geçişi: ${room.status} -> ${status}` });
      }
      await req.db.run("UPDATE rooms SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, staff_name, roomId]);

      if (room) {
        // Log action
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await req.db.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Oda Durumu Değiştirildi', `Oda: ${room.room_number}, Durum: ${room.status} -> ${status}`]
        );
      }

      broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId, status });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/rooms/update-details', async (req, res) => {
    const { roomId, status, acStatus, maintenanceNotes, eta, vip, lateCheckout } = req.body;
    const staff_name = req.actor?.name || 'Kat Hizmetleri / Ön Büro';
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (status && status !== room.status) {
        return res.status(409).json({ error: 'Room status must be changed through the controlled status workflow' });
      }

      await req.db.run(
        "UPDATE rooms SET ac_status = ?, maintenance_notes = ?, eta = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP, vip = ?, late_checkout = ? WHERE id = ?",
        [acStatus, maintenanceNotes, eta || '', staff_name, vip ? 1 : 0, lateCheckout ? 1 : 0, roomId]
      );

      // Log action
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name, 'Oda Bilgileri Güncellendi', `Oda: ${room.room_number}, Klima: ${room.ac_status} -> ${acStatus}, Notlar: ${maintenanceNotes}`]
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/rooms/dnd', async (req, res) => {
    const { roomId, dnd_active } = req.body;
    const staff_name = req.actor?.name || 'Misafir QR';
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      await req.db.run("UPDATE rooms SET dnd_active = ? WHERE id = ?", [dnd_active ? 1 : 0, roomId]);

      if (room) {
        // Log action
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await req.db.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'DND Durumu Değiştirildi', `Oda: ${room.room_number}, DND: ${dnd_active ? 'Açık' : 'Kapalı'}`]
        );
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/rooms/:id/folio', async (req, res) => {
    const roomId = req.params.id;
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const targetIdentifier = `Room-${room.room_number}`;

      // The rows above only cover ad hoc manual charges and raw order/service requests. The
      // authoritative running balance — including reception-posted charges (minibar, transfer,
      // etc.) and any payments already collected — lives in folio_transactions against the
      // active stay's folio. Without this, a guest viewing "my bill" would see an incomplete or
      // overstated total that never reflects a payment reception already took.
      let stayFolio = null;
      const activeStay = await req.db.get("SELECT s.id, s.folio_id, s.checkin_at FROM stays s WHERE s.room_id = ? AND s.status = 'checked_in' ORDER BY s.checkin_at DESC LIMIT 1", [roomId]);

      // This endpoint is reachable anonymously from the in-room QR portal. Scope every charge
      // list to the current occupant's stay so a newly checked-in guest can never see a prior
      // occupant's order/payment history — without this filter, "requests"/"folios" rows never
      // expire and just accumulate across every guest who has ever stayed in the room.
      const charges = activeStay
        ? await req.db.all("SELECT * FROM requests WHERE target_identifier = ? AND created_at >= ? ORDER BY created_at DESC", [targetIdentifier, activeStay.checkin_at])
        : [];
      if (activeStay?.folio_id) {
        const transactions = await req.db.all("SELECT * FROM folio_transactions WHERE folio_id = ? ORDER BY created_at DESC", [activeStay.folio_id]);
        const totals = await req.db.get('SELECT SUM(debit) AS debit, SUM(credit) AS credit FROM folio_transactions WHERE folio_id = ?', [activeStay.folio_id]);
        stayFolio = {
          folio_id: activeStay.folio_id,
          transactions,
          balance: Number(totals?.debit || 0) - Number(totals?.credit || 0)
        };
      }

      // Guests reach this endpoint anonymously from the room QR portal to see their own bill.
      // Strip the fields that don't belong on a public response (other guests' names/phone,
      // internal maintenance notes) rather than the full row.
      const safeRoom = req.actor ? room : { id: room.id, room_number: room.room_number, status: room.status };
      res.json({ room: safeRoom, charges, stay_folio: stayFolio });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // NOTE: manual room charges and their settlement are handled by the authoritative folio
  // system in reception.js (`POST /folios/:id/transactions`, `POST /folios/:id/payments`),
  // which posts against `folio_transactions` — the table checkout balance, invoicing and the
  // night audit all read from. A duplicate `POST /api/rooms/:id/folio` + `POST
  // /api/folios/:id/settle` pair used to exist here, writing only to a parallel `requests`/
  // `folios` bookkeeping that `folio_transactions` never saw: any charge posted through it was
  // invisible to the guest's real bill and could never be collected. It had no frontend caller
  // (confirmed: nothing in public/js/*.js calls these routes), so it was removed rather than
  // fixed in place, to avoid keeping two competing sources of truth for the same balance.

  app.get('/api/guests/search', async (req, res) => {
    const q = req.query.q || '';
    if (q.length < 2) return res.json([]);
    try {
      const likeQ = `%${q}%`;
      const guests = await req.db.all(`
        SELECT g.*, r.room_number, r.status as room_status
        FROM guest_registry g
        LEFT JOIN rooms r ON g.room_id = r.id
        WHERE g.first_name LIKE ? OR g.last_name LIKE ? OR r.room_number LIKE ?
        ORDER BY g.checked_in_at DESC
        LIMIT 20
      `, [likeQ, likeQ, likeQ]);
      res.json(guests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    const { roomNumber, room_number, status, eta, guestName, guest_name, room_type, floor, bed_type, capacity, base_rate, view_type } = req.body;
    const resolvedRoomNumber = String(roomNumber || room_number || '').trim();
    const staff_name = req.query.staff_name || 'Ön Büro';
    if (!resolvedRoomNumber) return res.status(400).json({ error: 'Oda numarası zorunludur.' });
    try {
      const duplicate = await req.db.get('SELECT id FROM rooms WHERE room_number = ?', [resolvedRoomNumber]);
      if (duplicate) return res.status(409).json({ error: `${resolvedRoomNumber} numaralı oda zaten mevcut.` });
      const id = 'r_' + Math.random().toString(36).substr(2, 9);
      await req.db.transaction(async tx => {
        await tx.run(
          "INSERT INTO rooms (id, room_number, status, eta, guest_name, dnd_active, room_type, floor, bed_type, capacity, base_rate, view_type) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
          [id, resolvedRoomNumber, status || 'clean_vacant', eta || '', guestName || guest_name || '', room_type || 'standard', Number(floor) || 1, bed_type || 'double', Number(capacity) || 2, Number(base_rate) || 0, view_type || ''],
          { undoSql: 'DELETE FROM rooms WHERE id = ?', undoParams: [id] }
        );

        if (status === 'occupied' && guestName) {
          const guestId = 'g_' + Math.random().toString(36).substr(2, 9);
          const nameParts = guestName.split(' ');
          const firstName = nameParts[0] || 'Misafir';
          const lastName = nameParts.slice(1).join(' ') || 'Soyad';
          await tx.run(
            "INSERT INTO guest_registry (id, room_id, first_name, last_name, phone) VALUES (?, ?, ?, ?, '')",
            [guestId, id, firstName, lastName],
            { undoSql: 'DELETE FROM guest_registry WHERE id = ?', undoParams: [guestId] }
          );
        }

        // Log action
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Yeni Oda Eklendi', `Oda: ${roomNumber}, Durum: ${status || 'clean_vacant'}, Misafir: ${guestName || '-'}`]
        );
      });

      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/rooms/:id', async (req, res) => {
    const roomId = req.params.id;
    const staff_name = req.query.staff_name || 'Ön Büro';
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (!room) return res.status(404).json({ error: 'Oda bulunamadı.' });
      const [activeStay, activeAssignment, openWorkOrder, guestRows] = await Promise.all([
        req.db.get("SELECT id FROM stays WHERE room_id = ? AND status = 'checked_in'", [roomId]),
        req.db.get("SELECT id FROM room_assignments WHERE room_id = ? AND status IN ('reserved','active')", [roomId]),
        req.db.get("SELECT id FROM technical_work_orders WHERE room_id = ? AND status NOT IN ('resolved','cancelled')", [roomId]),
        req.db.all("SELECT * FROM guest_registry WHERE room_id = ?", [roomId])
      ]);
      if (activeStay || activeAssignment) {
        return res.status(409).json({ error: 'Bu odada aktif konaklama veya rezervasyon bulunduğu için silinemez.' });
      }
      if (openWorkOrder) {
        return res.status(409).json({ error: 'Bu odada açık bir teknik iş emri bulunduğu için silinemez.' });
      }
      await req.db.transaction(async tx => {
        await tx.run("DELETE FROM rooms WHERE id = ?", [roomId]);
        tx.onFailure(async () => {
          await req.db.run('INSERT INTO rooms (id, room_number, status, eta, guest_name, dnd_active, ac_status, maintenance_notes, updated_by, vip, late_checkout, room_type, floor, bed_type, capacity, base_rate, view_type, arrival_date, departure_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [room.id, room.room_number, room.status, room.eta, room.guest_name, room.dnd_active, room.ac_status, room.maintenance_notes, room.updated_by, room.vip, room.late_checkout, room.room_type, room.floor, room.bed_type, room.capacity, room.base_rate, room.view_type, room.arrival_date, room.departure_date]);
        });
        await tx.run("DELETE FROM guest_registry WHERE room_id = ?", [roomId]);
        for (const guest of guestRows) {
          tx.onFailure(async () => {
            await req.db.run('INSERT INTO guest_registry (id, room_id, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)', [guest.id, guest.room_id, guest.first_name, guest.last_name, guest.phone]);
          });
        }
        // Log action
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Oda Silindi', `Oda: ${room.room_number}`]
        );
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
