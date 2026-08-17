import { hashPin } from '../db.js';
import { isManagementRole, encryptStaffPin, decryptStaffPin, knownStaffPin } from '../server-middleware.js';
import { seedDemoData } from '../db/demo-data.js';

// Staff CRUD, PIN management, and admin operational resets, extracted verbatim
// from server.js — no behavior change.
export function registerStaffRoutes(app) {
  app.post('/api/admin/demo-seed', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    try {
      const summary = await seedDemoData(req.db, req.tenantId, req.actor?.name || 'Yönetici');
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/staff', async (req, res) => {
    try {
      const staff = await req.db.all("SELECT id, name, role, department, pin, pin_encrypted FROM staff ORDER BY name");
      // NFR-09: PIN values must never appear in any list/report/console output, including a
      // manager's own staff table — only whether a PIN has been set.
      res.json(staff.map(person => ({
        id: person.id,
        name: person.name,
        role: person.role,
        department: person.department,
        has_pin: Boolean(decryptStaffPin(person.pin_encrypted) || knownStaffPin(person))
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/staff', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const name = String(req.body?.name || '').trim();
    const assignment = String(req.body?.role || '').trim().toLowerCase();
    const pin = String(req.body?.pin || '').trim();
    const staff_name = req.actor?.name || 'Yönetici';
    const assignments = {
      reception: { role: 'reception', department: 'Reception' },
      housekeeping: { role: 'housekeeping', department: 'Housekeeping' },
      restaurant: { role: 'restaurant', department: 'Restaurant' },
      kitchen: { role: 'kitchen', department: 'Kitchen' },
      bar: { role: 'bar', department: 'Bar' },
      maintenance: { role: 'maintenance', department: 'Maintenance' },
      manager: { role: 'manager', department: 'Management' }
    };
    const selectedAssignment = assignments[assignment];
    if (!name || !selectedAssignment || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'Ad soyad, departman seçimi ve 4-8 rakamlı PIN zorunludur.' });
    }

    try {
      const existing = await req.db.get("SELECT id FROM staff WHERE pin = ?", [hashPin(pin)]);
      if (existing) return res.status(409).json({ error: 'PIN already exists' });

      const id = 'staff_' + Math.random().toString(36).substr(2, 9);
      await req.db.transaction(async tx => {
        await tx.run(
          "INSERT INTO staff (id, name, role, department, pin, pin_encrypted) VALUES (?, ?, ?, ?, ?, ?)",
          [id, name, selectedAssignment.role, selectedAssignment.department, hashPin(pin), encryptStaffPin(pin)],
          { undoSql: 'DELETE FROM staff WHERE id = ?', undoParams: [id] }
        );

        // Log action
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Personel Eklendi', `İsim: ${name}, Departman: ${selectedAssignment.department}`]
        );
      });

      res.json({ success: true, staff: { id, name, role: selectedAssignment.role, department: selectedAssignment.department } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/operational-reset', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const confirmation = String(req.body?.confirmation || '').trim();
    if (confirmation !== 'MÜŞTERİ VE İŞLEM VERİLERİNİ SİL') {
      return res.status(400).json({ error: 'Onay metni doğrulanamadı.' });
    }

    const count = async table => Number((await req.db.get(`SELECT COUNT(*) AS cnt FROM ${table}`))?.cnt || 0);
    const counts = {
      reservations: await count('reservations'),
      guests: await count('guest_profiles'),
      stays: await count('stays'),
      folios: await count('folios'),
      folio_transactions: await count('folio_transactions'),
      payments: await count('payments'),
      invoices: await count('invoices')
    };

    await req.db.exec(`
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM payments;
      DELETE FROM folio_transactions;
      DELETE FROM folios;
      DELETE FROM stay_guests;
      DELETE FROM room_assignments;
      DELETE FROM stays;
      DELETE FROM reservation_guests;
      DELETE FROM guest_precheckins;
      DELETE FROM guest_precheckin_submissions;
      DELETE FROM registrations;
      DELETE FROM guest_registry;
      DELETE FROM identity_notifications;
      DELETE FROM documents_metadata;
      DELETE FROM reception_tasks WHERE stay_id IS NOT NULL;
      DELETE FROM audit_events WHERE entity_type IN ('guest', 'reservation', 'stay', 'folio', 'payment', 'invoice', 'precheckin');
      DELETE FROM guest_profiles;
      DELETE FROM reservations;
      UPDATE rooms SET status = 'clean_vacant', eta = NULL, guest_name = NULL, dnd_active = 0, arrival_date = NULL, departure_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE guest_name IS NOT NULL OR status IN ('occupied', 'dirty_occupied');
    `);

    // Recorded after the wipe (and under an action name that doesn't match any of the LIKE
    // patterns this or the restaurant reset delete) so the reset itself always leaves a forensic
    // trace of who ran it and what was cleared, even though it removes the records it acted on.
    await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Sistem Operasyonel Sıfırlama', ?)",
      [`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, req.actor?.name || 'Yönetici', JSON.stringify(counts)]);

    res.json({ success: true, cleared: counts });
  });

  app.post('/api/admin/restaurant-operational-reset', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const confirmation = String(req.body?.confirmation || '').trim();
    if (confirmation !== 'RESTORAN GEÇMİŞİNİ SİL') {
      return res.status(400).json({ error: 'Onay metni doğrulanamadı.' });
    }

    const orderIds = (await req.db.all("SELECT id FROM requests WHERE type = 'order'")).map(order => order.id);
    const kitchenTickets = Number((await req.db.get("SELECT COUNT(*) AS cnt FROM kitchen_ticket_lines"))?.cnt || 0);
    const barTickets = Number((await req.db.get("SELECT COUNT(*) AS cnt FROM bar_ticket_lines"))?.cnt || 0);

    if (orderIds.length) {
      const orderPlaceholders = orderIds.map(() => '?').join(', ');
      await req.db.run(`DELETE FROM kitchen_ticket_lines WHERE request_id IN (${orderPlaceholders})`, orderIds);
      await req.db.run(`DELETE FROM bar_ticket_lines WHERE request_id IN (${orderPlaceholders})`, orderIds);
      await req.db.run(`DELETE FROM requests WHERE id IN (${orderPlaceholders})`, orderIds);
    }

    await req.db.exec("DELETE FROM kitchen_ticket_lines; DELETE FROM bar_ticket_lines; DELETE FROM config WHERE key = 'BAR_TICKET_BACKFILL_V1'; UPDATE tables SET status = 'empty'; DELETE FROM audit_logs WHERE action LIKE 'Sipariş%' OR action LIKE 'Adisyon%' OR action LIKE 'Restoran%' OR action LIKE 'Bar%'; DELETE FROM audit_events WHERE entity_type IN ('restaurant_order', 'kitchen_ticket', 'bar_ticket');");

    const clearedSummary = { restaurant_orders: orderIds.length, kitchen_tickets: kitchenTickets, bar_tickets: barTickets };
    // Inserted after the wipe under an action name that doesn't match the LIKE patterns just used
    // to delete prior restaurant/bar audit history, so the reset action itself always survives.
    await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Sistem: Yeme-İçme Geçmişi Sıfırlandı', ?)",
      [`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, req.actor?.name || 'Yönetici', JSON.stringify(clearedSummary)]);

    res.json({ success: true, cleared: clearedSummary });
  });

  app.patch('/api/staff/:id/pin', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const pin = String(req.body?.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN 4 ile 8 rakam arasında olmalıdır.' });
    try {
      const staff = await req.db.get("SELECT id, name FROM staff WHERE id = ?", [req.params.id]);
      if (!staff) return res.status(404).json({ error: 'Personel bulunamadı.' });
      const existing = await req.db.get("SELECT id FROM staff WHERE pin = ? AND id <> ?", [hashPin(pin), staff.id]);
      if (existing) return res.status(409).json({ error: 'Bu PIN başka bir personel tarafından kullanılıyor.' });
      const previousPin = await req.db.get("SELECT pin, pin_encrypted FROM staff WHERE id = ?", [staff.id]);
      await req.db.transaction(async tx => {
        await tx.run("UPDATE staff SET pin = ?, pin_encrypted = ? WHERE id = ?", [hashPin(pin), encryptStaffPin(pin), staff.id], {
          undoSql: 'UPDATE staff SET pin = ?, pin_encrypted = ? WHERE id = ?', undoParams: [previousPin.pin, previousPin.pin_encrypted, staff.id]
        });
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          ['log_' + Math.random().toString(36).substr(2, 9), req.actor?.name || 'Yönetici', 'Personel PIN Güncellendi', `İsim: ${staff.name}`]
        );
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/staff/:id', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const staff_name = req.actor?.name || 'Yönetici';
    try {
      const staff = await req.db.get("SELECT * FROM staff WHERE id = ?", [req.params.id]);
      if (!staff) return res.json({ success: true });
      await req.db.transaction(async tx => {
        await tx.run("DELETE FROM staff WHERE id = ?", [req.params.id]);
        tx.onFailure(async () => {
          await req.db.run("INSERT INTO staff (id, name, role, department, pin, pin_encrypted) VALUES (?, ?, ?, ?, ?, ?)", [staff.id, staff.name, staff.role, staff.department, staff.pin, staff.pin_encrypted]);
        });
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Personel Silindi', `İsim: ${staff.name}, Rol: ${staff.role}`]
        );
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
