import crypto from 'crypto';

// Housekeeping dashboard/tasks, minibar posting, lost & found, laundry, room
// inspection, and public-area cleanliness tracking.
export function registerHousekeepingRoutes({ app, broadcastSSE, notify }) {
  app.get('/api/hk/dashboard', async (req, res) => {
    try {
      const [rooms, tasks, publicAreas, laundry, lostFound, linen] = await Promise.all([
        req.db.all('SELECT * FROM rooms ORDER BY CAST(room_number AS INT), room_number'),
        req.db.all("SELECT t.*, r.room_number FROM reception_tasks t LEFT JOIN rooms r ON r.id = t.room_id WHERE lower(t.department) = 'housekeeping' AND t.status <> 'completed' ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, t.created_at ASC"),
        req.db.all('SELECT * FROM public_areas ORDER BY name'),
        req.db.all("SELECT * FROM laundry_orders WHERE status <> 'delivered' ORDER BY created_at ASC"),
        req.db.all("SELECT * FROM lost_and_found WHERE status <> 'claimed' ORDER BY found_at DESC"),
        req.db.all("SELECT * FROM inventory WHERE lower(module_type) IN ('housekeeping','linen') ORDER BY name")
      ]);
      res.json({ rooms, tasks, public_areas: publicAreas, laundry, lost_found: lostFound, linen });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/hk/tasks', async (req, res) => {
    try { res.json(await req.db.all("SELECT t.*, r.room_number FROM reception_tasks t LEFT JOIN rooms r ON r.id = t.room_id WHERE lower(t.department) = 'housekeeping' ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at ASC")); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/hk/tasks', async (req, res) => {
    const { taskType, roomId, priority, dueAt, details } = req.body;
    if (!['room_turn', 'cleaning_request', 'linen', 'amenity', 'water', 'minibar', 'public_area'].includes(taskType)) return res.status(400).json({ error: 'Geçersiz housekeeping görev türü.' });
    if (!String(details || '').trim()) return res.status(400).json({ error: 'Görev açıklaması zorunludur.' });
    if (roomId && !(await req.db.get('SELECT id FROM rooms WHERE id = ?', [roomId]))) return res.status(404).json({ error: 'Oda bulunamadı.' });
    try {
      const id = `hkt_${crypto.randomUUID()}`;
      const actor = req.actor?.name || 'Kat Hizmetleri';
      await req.db.run("INSERT INTO reception_tasks (id, task_type, department, room_id, priority, due_at, details, created_by) VALUES (?, ?, 'Housekeeping', ?, ?, ?, ?, ?)", [id, taskType, roomId || null, ['urgent', 'high', 'normal', 'low'].includes(priority) ? priority : 'normal', dueAt || null, String(details).trim(), actor]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Housekeeping görevi açıldı', `${taskType} · ${details}`]);
      broadcastSSE && broadcastSSE(req.tenantId, 'hk_task_updated', { id, status: 'open' });
      await notify(req.tenantId, { title: 'Yeni Kat Hizmetleri Görevi', body: `${taskType} · ${String(details).trim()}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}`, tag: id, type: 'housekeeping_created' }, ['Housekeeping']);
      res.status(201).json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch('/api/hk/tasks/:id', async (req, res) => {
    const { status } = req.body;
    if (!['open', 'in_progress', 'completed'].includes(status)) return res.status(400).json({ error: 'Geçersiz görev durumu.' });
    try {
      const task = await req.db.get("SELECT * FROM reception_tasks WHERE id = ? AND lower(department) = 'housekeeping'", [req.params.id]);
      if (!task) return res.status(404).json({ error: 'Housekeeping görevi bulunamadı.' });
      const actor = req.actor?.name || 'Kat Hizmetleri';
      await req.db.run('UPDATE reception_tasks SET status = ?, completed_at = ?, completed_by = ? WHERE id = ?', [status, status === 'completed' ? new Date().toISOString() : null, status === 'completed' ? actor : null, task.id]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Housekeeping görevi güncellendi', `${task.id} · ${status}`]);
      broadcastSSE && broadcastSSE(req.tenantId, 'hk_task_updated', { id: task.id, status });
      await notify(req.tenantId, { title: 'Kat Hizmetleri Görevi Güncellendi', body: `${task.details} · ${status}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}`, tag: `${task.id}-${status}`, type: 'housekeeping_updated' }, ['Housekeeping', 'Reception']);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/hk/rooms/:id/start', async (req, res) => {
    try {
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
      if (!room) return res.status(404).json({ error: 'Oda bulunamadı.' });
      // Reception can set a room to 'out_of_order'/'blocked' via /api/reception/rooms/:id/operations,
      // but until now Housekeeping had no way to bring it back into the cleaning workflow at all —
      // it fell through every HK filter uncategorized with no actionable button.
      if (!['dirty_vacant', 'assigned', 'out_of_order', 'blocked'].includes(room.status)) return res.status(409).json({ error: 'Bu oda temizlik başlangıcı için uygun durumda değil.' });
      if (Number(room.dnd_active) === 1 && !req.body.override_dnd) {
        return res.status(409).json({ error: 'Oda DND (Rahatsız Etmeyin) modunda. Temizliğe başlamak için yetkili onayı (override) gereklidir.', dnd_active: true });
      }
      const actor = req.actor?.name || 'Kat Hizmetleri';
      await req.db.run("UPDATE rooms SET status = 'cleaning', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [actor, room.id]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Oda temizliği başlatıldı', room.room_number]);
      broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId: room.id, status: 'cleaning' });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/hk/rooms/:id/inspect', async (req, res) => {
    const { checklist, notes } = req.body;
    if (!Array.isArray(checklist) || checklist.length === 0) return res.status(400).json({ error: 'Oda onayı için kontrol listesi zorunludur.' });
    try {
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
      if (!room) return res.status(404).json({ error: 'Oda bulunamadı.' });
      if (room.status !== 'cleaning') return res.status(409).json({ error: 'Oda incelemesi yalnız temizlikteki oda için yapılabilir.' });
      const actor = req.actor?.name || 'Kat Hizmetleri';
      const inspectionId = `hki_${crypto.randomUUID()}`;
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO housekeeping_inspections (id, room_id, checklist, notes, inspected_by) VALUES (?, ?, ?, ?, ?)', [inspectionId, room.id, JSON.stringify(checklist), String(notes || '').trim(), actor], {
          undoSql: 'DELETE FROM housekeeping_inspections WHERE id = ?', undoParams: [inspectionId]
        });
        await tx.run("UPDATE rooms SET status = 'clean_vacant', eta = 'HK onaylandı', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [actor, room.id], {
          undoSql: 'UPDATE rooms SET status = ?, eta = ? WHERE id = ?', undoParams: [room.status, room.eta, room.id]
        });
        await tx.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Oda HK onayı tamamlandı', `${room.room_number} · ${String(notes || '').trim() || 'not yok'}`]);
      });
      broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId: room.id, status: 'clean_vacant' });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/hk/linen-counts', async (req, res) => {
    const { inventoryId, countedQuantity, notes } = req.body;
    const amount = Number(countedQuantity);
    if (!inventoryId || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Sayım verisi geçersiz.' });
    try {
      const item = await req.db.get("SELECT * FROM inventory WHERE id = ? AND lower(module_type) IN ('housekeeping','linen','minibar')", [inventoryId]);
      if (!item) return res.status(404).json({ error: 'Housekeeping envanter kalemi bulunamadı.' });
      const actor = req.actor?.name || 'Kat Hizmetleri';
      const previousStock = Number(item.stock || 0);
      await req.db.run('INSERT INTO housekeeping_linen_counts (id, inventory_id, counted_quantity, notes, counted_by) VALUES (?, ?, ?, ?, ?)', [`hkl_${crypto.randomUUID()}`, item.id, amount, String(notes || '').trim(), actor]);
      await req.db.run('UPDATE inventory SET stock = ? WHERE id = ?', [amount, item.id]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Housekeeping fiziki sayım', `${item.name}: kayıtlı ${previousStock} ${item.unit} → sayılan ${amount} ${item.unit}${notes ? `, Not: ${notes}` : ''}`]);
      res.status(201).json({ success: true, newStock: amount });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── MINIBAR (Housekeeping) ───────────────────────────────────────────────────
  // Lets housekeeping record minibar consumption straight from a room. If the room
  // has an in-house guest, the consumed items are posted to their folio exactly like
  // the reception minibar flow; regardless of occupancy the linked stock is deducted
  // via the recipes table so minibar sales stay in sync with physical inventory.
  app.post('/api/hk/rooms/:id/minibar', async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'En az bir minibar ürünü seçin.' });
    try {
      const room = await req.db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
      if (!room) return res.status(404).json({ error: 'Oda bulunamadı.' });
      const actor = req.actor?.name || 'Kat Hizmetleri';

      const normalizedItems = [];
      for (const raw of items) {
        const quantity = Number(raw?.quantity);
        if (typeof raw?.catalogItemId !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          return res.status(400).json({ error: 'Her minibar satırı geçerli bir ürün ve 1-99 arası adet içermelidir.' });
        }
        const catalogItem = await req.db.get("SELECT * FROM catalog_items WHERE id = ? AND category = 'minibar'", [raw.catalogItemId]);
        if (!catalogItem) return res.status(400).json({ error: `Minibar ürünü bulunamadı: ${raw.catalogItemId}` });
        normalizedItems.push({ catalogItem, quantity });
      }

      const stockUpdates = {};
      for (const { catalogItem, quantity } of normalizedItems) {
        const recipeLines = await req.db.all('SELECT * FROM recipes WHERE catalog_item_id = ?', [catalogItem.id]);
        for (const line of recipeLines) {
          stockUpdates[line.inventory_id] = (stockUpdates[line.inventory_id] || 0) + Number(line.amount_needed) * quantity;
        }
      }
      for (const [inventoryId, deduction] of Object.entries(stockUpdates)) {
        const inv = await req.db.get('SELECT * FROM inventory WHERE id = ?', [inventoryId]);
        if (!inv) continue;
        await req.db.run('UPDATE inventory SET stock = MAX(0, stock - ?) WHERE id = ?', [deduction, inventoryId]);
      }

      let folioId = null;
      if (room.status === 'occupied') {
        const stay = await req.db.get("SELECT folio_id FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
        folioId = stay?.folio_id || null;
      }

      let totalCharged = 0;
      if (folioId) {
        for (const { catalogItem, quantity } of normalizedItems) {
          const amount = Number(catalogItem.price) * quantity;
          totalCharged += amount;
          const transactionId = `ftx_${crypto.randomUUID()}`;
          await req.db.run(
            "INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, currency, debit, related_reference, department, created_by) VALUES (?, ?, 'minibar', ?, ?, ?, 'TRY', ?, ?, ?, ?)",
            [transactionId, folioId, catalogItem.name, quantity, catalogItem.price, amount, `minibar:${catalogItem.id}`, 'Housekeeping', actor]
          );
        }
      }

      const summary = normalizedItems.map(({ catalogItem, quantity }) => `${catalogItem.name} x${quantity}`).join(', ');
      await req.db.run(
        'INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)',
        [`log_${crypto.randomUUID()}`, actor, folioId ? 'Minibar Tüketimi (Oda Hesabı)' : 'Minibar Tüketimi (Stok Düşümü)', `Oda ${room.room_number}: ${summary}${folioId ? `, Tutar: ${totalCharged} TL` : ' (misafir yok, stok düşüldü)'}`]
      );
      broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId: room.id });
      res.status(201).json({ success: true, charged: Boolean(folioId), totalCharged });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── LOST & FOUND ───────────────────────────────────────────────────────────
  app.get('/api/hk/lost-found', async (req, res) => {
    try {
      const items = await req.db.all("SELECT * FROM lost_and_found ORDER BY found_at DESC LIMIT 100");
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/hk/lost-found', async (req, res) => {
    const { item_name, description, found_location, found_by } = req.body;
    try {
      const id = 'laf_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO lost_and_found (id, item_name, description, found_location, reported_by) VALUES (?, ?, ?, ?, ?)",
        [id, item_name || 'Bilinmeyen Eşya', description, found_location || 'Genel', found_by || 'HK']
      );
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, found_by || 'HK', 'Kayıp Eşya Kaydedildi', `${found_location}: ${description}`]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── LAUNDRY ─────────────────────────────────────────────────────────────────
  app.get('/api/hk/laundry', async (req, res) => {
    try {
      const items = await req.db.all("SELECT * FROM laundry_orders ORDER BY created_at DESC LIMIT 100");
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/hk/laundry', async (req, res) => {
    const { room_id, items_description, created_by } = req.body;
    try {
      const room = await req.db.get("SELECT room_number, guest_name FROM rooms WHERE id = ?", [room_id]);
      const id = 'lau_' + Math.random().toString(36).substr(2, 9);

      await req.db.run(
        "INSERT INTO laundry_orders (id, room_id, guest_name, items) VALUES (?, ?, ?, ?)",
        [id, room_id, room ? room.guest_name : '', items_description]
      );
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, created_by || 'HK', 'Çamaşır Talebi Oluşturuldu', `Oda ${room?.room_number || room_id}: ${items_description}`]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ROOM INSPECTION ─────────────────────────────────────────────────────────
  app.post('/api/rooms/inspect', async (req, res) => {
    const { roomId, inspected_by, checklist } = req.body;
    try {
      const room = await req.db.get("SELECT room_number, status FROM rooms WHERE id = ?", [roomId]);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      if (room.status !== 'cleaning') return res.status(409).json({ error: 'İnceleme yalnız temizlik tamamlandıktan sonra yapılabilir.' });
      await req.db.run("UPDATE rooms SET status = 'clean_vacant', eta = 'İncelendi ✓', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [inspected_by || 'HK Süpervizör', roomId]);
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, inspected_by || 'HK Süpervizör', 'Oda İncelendi', `Oda: ${room.room_number}, geçiş: cleaning -> inspected -> clean_vacant. Kontrol listesi: ${checklist || 'Tamam'}`]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  // ─── PUBLIC AREAS ─────────────────────────────────────────────────────────────
  app.get('/api/public_areas', async (req, res) => {
    try {
      const areas = await req.db.all("SELECT * FROM public_areas ORDER BY name");
      res.json(areas);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/public_areas', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Ortak alan adı zorunludur.' });
    try {
      const existing = await req.db.get("SELECT id FROM public_areas WHERE lower(name) = lower(?)", [name]);
      if (existing) return res.status(409).json({ error: 'Bu isimde bir ortak alan zaten tanımlı.' });
      const id = `pa_${crypto.randomUUID()}`;
      const actor = req.actor?.name || 'Kat Hizmetleri';
      await req.db.run("INSERT INTO public_areas (id, name, status) VALUES (?, ?, 'dirty')", [id, name]);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [`log_${crypto.randomUUID()}`, actor, 'Ortak Alan Tanımlandı', name]
      );
      broadcastSSE && broadcastSSE(req.tenantId, 'area_updated', { id, status: 'dirty' });
      res.status(201).json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/public_areas/:id', async (req, res) => {
    try {
      const area = await req.db.get("SELECT name FROM public_areas WHERE id = ?", [req.params.id]);
      if (!area) return res.status(404).json({ error: 'Ortak alan bulunamadı.' });
      await req.db.run("DELETE FROM public_areas WHERE id = ?", [req.params.id]);
      const actor = req.actor?.name || 'Kat Hizmetleri';
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [`log_${crypto.randomUUID()}`, actor, 'Ortak Alan Silindi', area.name]
      );
      broadcastSSE && broadcastSSE(req.tenantId, 'area_updated', { id: req.params.id, status: 'deleted' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/public_areas/clean', async (req, res) => {
    const { id, staff_name } = req.body;
    try {
      await req.db.run(
        "UPDATE public_areas SET status = 'clean', last_cleaned_at = CURRENT_TIMESTAMP, last_cleaned_by = ? WHERE id = ?",
        [staff_name || 'HK', id]
      );
      const area = await req.db.get("SELECT name FROM public_areas WHERE id = ?", [id]);
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name || 'HK', 'Genel Alan Temizlendi', `${area?.name} temizlendi`]
      );
      broadcastSSE && broadcastSSE(req.tenantId, 'area_updated', { id, status: 'clean' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/public_areas/dirty', async (req, res) => {
    const { id, staff_name } = req.body;
    try {
      await req.db.run("UPDATE public_areas SET status = 'dirty' WHERE id = ?", [id]);
      const area = await req.db.get("SELECT name FROM public_areas WHERE id = ?", [id]);
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name || 'HK', 'Genel Alan Kirli İşaretlendi', `${area?.name} kirlendi`]
      );
      broadcastSSE && broadcastSSE(req.tenantId, 'area_updated', { id, status: 'dirty' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  // ─── LAUNDRY STATUS UPDATE ────────────────────────────────────────────────────
  app.post('/api/hk/laundry/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, updated_by } = req.body;
    const allowedLaundryStatuses = ['open', 'in_progress', 'delivered', 'cancelled'];
    if (!allowedLaundryStatuses.includes(status)) return res.status(400).json({ error: 'Geçersiz çamaşır durumu.' });
    try {
      await req.db.run(
        "UPDATE laundry_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, id]
      );
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, updated_by || 'HK', 'Çamaşır Durumu Güncellendi', `ID: ${id}, Durum: ${status}`]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── LOST & FOUND CLAIM ───────────────────────────────────────────────────────
  app.patch('/api/hk/lost-found/:id/claim', async (req, res) => {
    const { id } = req.params;
    const { claimed_by } = req.body;
    try {
      await req.db.run(
        "UPDATE lost_and_found SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, claimed_by || 'HK', 'Kayıp Eşya Teslim Edildi', `Eşya ID: ${id} teslim alındı`]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
