import crypto from 'crypto';

// Technical work orders, assets, maintenance plans, purchase requests, and the legacy
// `/api/maintenance` ticket routes.
export function registerMaintenanceRoutes({ app, broadcastSSE, notify }) {
  app.get('/api/maintenance/work-orders', async (req, res) => {
    try {
      const rows = await req.db.all(`SELECT w.*, r.room_number, a.name AS asset_name, a.location AS asset_location
        FROM technical_work_orders w
        LEFT JOIN rooms r ON r.id = w.room_id
        LEFT JOIN technical_assets a ON a.id = w.asset_id
        ORDER BY CASE w.status WHEN 'reported' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'waiting_part' THEN 2 ELSE 3 END, w.created_at ASC`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/maintenance/work-orders', async (req, res) => {
    const { roomId, assetId, category, priority, summary, dueAt, markRoomOutOfOrder } = req.body;
    const text = String(summary || '').trim();
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Arıza açıklaması zorunludur.' });
    if (!['hvac', 'electrical', 'plumbing', 'room_equipment', 'safety', 'pool_public', 'general'].includes(category)) return res.status(400).json({ error: 'Geçersiz arıza kategorisi.' });
    if (!['critical', 'high', 'normal'].includes(priority)) return res.status(400).json({ error: 'Geçersiz öncelik.' });
    try {
      const room = roomId ? await req.db.get('SELECT * FROM rooms WHERE id = ?', [roomId]) : null;
      const asset = assetId ? await req.db.get('SELECT * FROM technical_assets WHERE id = ?', [assetId]) : null;
      if (roomId && !room) return res.status(404).json({ error: 'Oda bulunamadı.' });
      if (assetId && !asset) return res.status(404).json({ error: 'Varlık bulunamadı.' });
      if (!room && !asset) return res.status(400).json({ error: 'Oda veya teknik varlık seçilmelidir.' });
      if (room && markRoomOutOfOrder && room.status === 'occupied') {
        return res.status(409).json({ error: 'Misafir odada kalırken oda bakıma alınamaz. Önce check-out veya oda değişimi yapılmalıdır.' });
      }
      const actor = req.actor?.name || 'Teknik Servis';
      const requestId = `mnt_${crypto.randomUUID()}`;
      const workOrderId = `wo_${crypto.randomUUID()}`;
      const target = room ? `Room-${room.room_number}` : `${asset.name} · ${asset.location}`;
      const details = JSON.stringify({ category, priority, summary: text, due_at: dueAt || null, asset_id: assetId || null });
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO requests (id, type, department, target_identifier, status, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [requestId, 'maintenance_request', 'Maintenance', target, 'reported', details, actor], {
          undoSql: 'DELETE FROM requests WHERE id = ?', undoParams: [requestId]
        });
        await tx.run('INSERT INTO technical_work_orders (id, request_id, room_id, asset_id, category, priority, status, summary, due_at, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [workOrderId, requestId, roomId || null, assetId || null, category, priority, 'reported', text, dueAt || null, actor], {
          undoSql: 'DELETE FROM technical_work_orders WHERE id = ?', undoParams: [workOrderId]
        });
        if (room && markRoomOutOfOrder) {
          await tx.run("UPDATE rooms SET status = 'maintenance', maintenance_notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [text, actor, room.id], {
            undoSql: 'UPDATE rooms SET status = ?, maintenance_notes = ? WHERE id = ?', undoParams: [room.status, room.maintenance_notes, room.id]
          });
        }
        await tx.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Teknik iş emri açıldı', `${target} · ${priority} · ${text}`]);
      });
      broadcastSSE && broadcastSSE(req.tenantId, 'maintenance_updated', { id: workOrderId, status: 'reported' });
      await notify(req.tenantId, { title: 'Yeni Teknik İş Emri', body: `${target} · ${priority} · ${text}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}`, tag: workOrderId, type: 'maintenance_created', requestId, target_identifier: target }, ['Maintenance']);
      if (room && markRoomOutOfOrder) broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId: room.id, status: 'maintenance' });
      res.status(201).json({ success: true, id: workOrderId, request_id: requestId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/maintenance/work-orders/:id', async (req, res) => {
    const { status, resolution, laborMinutes, parts = [], releaseRoom } = req.body;
    if (!['reported', 'in_progress', 'waiting_part', 'resolved'].includes(status)) return res.status(400).json({ error: 'Geçersiz iş emri durumu.' });
    try {
      const order = await req.db.get('SELECT * FROM technical_work_orders WHERE id = ?', [req.params.id]);
      if (!order) return res.status(404).json({ error: 'İş emri bulunamadı.' });
      const actor = req.actor?.name || 'Teknik Servis';
      const minutes = laborMinutes === '' || laborMinutes === undefined ? null : Number(laborMinutes);
      if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)) return res.status(400).json({ error: 'İşçilik süresi geçersiz.' });
      if (!Array.isArray(parts)) return res.status(400).json({ error: 'Malzeme listesi geçersiz.' });
      for (const part of parts) {
        const qty = Number(part.quantity);
        if (!part.inventoryId || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Malzeme kullanımı geçersiz.' });
        const inventory = await req.db.get('SELECT * FROM inventory WHERE id = ?', [part.inventoryId]);
        if (!inventory || Number(inventory.stock) < qty) return res.status(409).json({ error: 'Yeterli teknik malzeme stoku yok.' });
      }
      const completed = status === 'resolved';
      const roomBefore = completed && releaseRoom && order.room_id ? await req.db.get('SELECT status FROM rooms WHERE id = ?', [order.room_id]) : null;
      const requestBefore = await req.db.get('SELECT completed_at FROM requests WHERE id = ?', [order.request_id]);
      // Computed in JS rather than a SQL `CASE WHEN ... ELSE <same column>` — alasql's query
      // compiler throws "Identifier 'r' has already been declared" on that self-referencing
      // pattern (reproduced against alasql 4.17.3), which made every PATCH here 500 unconditionally.
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const startedAt = status === 'in_progress' && !order.started_at ? now : order.started_at;
      const orderCompletedAt = completed ? now : order.completed_at;
      const requestCompletedAt = completed ? now : requestBefore?.completed_at;
      await req.db.transaction(async tx => {
        for (const part of parts) {
          const qty = Number(part.quantity);
          // Sufficiency check baked into the WHERE clause — same atomic-decrement pattern used
          // for restaurant/bar stock — so two technicians resolving work orders against the same
          // scarce part at once can't both succeed past a stale snapshot.
          await tx.run('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?', [qty, part.inventoryId, qty], {
            requireChange: true,
            failureMessage: 'Yeterli teknik malzeme stoku yok (eşzamanlı kullanım nedeniyle stok tükendi).',
            undoSql: 'UPDATE inventory SET stock = stock + ? WHERE id = ?', undoParams: [qty, part.inventoryId]
          });
          const partId = `wop_${crypto.randomUUID()}`;
          await tx.run('INSERT INTO technical_work_order_parts (id, work_order_id, inventory_id, quantity, used_by) VALUES (?, ?, ?, ?, ?)', [partId, order.id, part.inventoryId, qty, actor], {
            undoSql: 'DELETE FROM technical_work_order_parts WHERE id = ?', undoParams: [partId]
          });
        }
        await tx.run('UPDATE technical_work_orders SET status = ?, resolution = ?, labor_minutes = ?, started_at = ?, completed_at = ? WHERE id = ?', [status, String(resolution || '').trim(), minutes, startedAt, orderCompletedAt, order.id], {
          undoSql: 'UPDATE technical_work_orders SET status = ?, resolution = ?, labor_minutes = ?, started_at = ?, completed_at = ? WHERE id = ?', undoParams: [order.status, order.resolution, order.labor_minutes, order.started_at, order.completed_at, order.id]
        });
        await tx.run('UPDATE requests SET status = ?, details = ?, completed_by = ?, completed_at = ? WHERE id = ?', [status, JSON.stringify({ category: order.category, priority: order.priority, summary: order.summary, resolution: String(resolution || '').trim(), labor_minutes: minutes }), actor, requestCompletedAt, order.request_id], {
          undoSql: 'UPDATE requests SET status = ?, completed_at = ? WHERE id = ?', undoParams: [order.status, requestBefore?.completed_at, order.request_id]
        });
        if (completed && releaseRoom && order.room_id) {
          await tx.run("UPDATE rooms SET status = 'dirty_vacant', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'maintenance'", [actor, order.room_id], {
            undoSql: 'UPDATE rooms SET status = ? WHERE id = ?', undoParams: [roomBefore?.status || 'maintenance', order.room_id]
          });
        }
        await tx.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, actor, 'Teknik iş emri güncellendi', `${order.id} · ${status} · ${String(resolution || '').trim() || 'not yok'}`]);
      });
      broadcastSSE && broadcastSSE(req.tenantId, 'maintenance_updated', { id: order.id, status });
      await notify(req.tenantId, { title: 'Teknik İş Emri Güncellendi', body: `${order.summary} · ${status}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}`, tag: `${order.id}-${status}`, type: 'maintenance_updated', requestId: order.request_id }, ['Maintenance', 'Reception']);
      if (completed && releaseRoom && order.room_id) broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId: order.room_id, status: 'dirty_vacant' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/maintenance/assets', async (req, res) => {
    try {
      res.json(await req.db.all('SELECT * FROM technical_assets ORDER BY name ASC'));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/maintenance/assets', async (req, res) => {
    const { name, category, location, assetTag, criticality, notes } = req.body;
    if (!String(name || '').trim() || !String(category || '').trim() || !String(location || '').trim()) return res.status(400).json({ error: 'Varlık adı, kategorisi ve konumu zorunludur.' });
    try {
      const id = `asset_${crypto.randomUUID()}`;
      await req.db.run('INSERT INTO technical_assets (id, name, category, location, asset_tag, criticality, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, String(name).trim(), String(category).trim(), String(location).trim(), String(assetTag || '').trim(), ['critical', 'high', 'normal'].includes(criticality) ? criticality : 'normal', String(notes || '').trim()]);
      res.status(201).json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/maintenance/plans', async (req, res) => {
    try {
      res.json(await req.db.all('SELECT p.*, a.name AS asset_name, a.location AS asset_location FROM technical_maintenance_plans p JOIN technical_assets a ON a.id = p.asset_id WHERE p.active = 1 ORDER BY p.next_due_at ASC'));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/maintenance/plans', async (req, res) => {
    const { assetId, title, frequencyDays, nextDueAt } = req.body;
    const days = Number(frequencyDays);
    if (!assetId || !String(title || '').trim() || !Number.isInteger(days) || days < 1 || !nextDueAt) return res.status(400).json({ error: 'Bakım planı alanları geçersiz.' });
    try {
      const asset = await req.db.get('SELECT id FROM technical_assets WHERE id = ?', [assetId]);
      if (!asset) return res.status(404).json({ error: 'Teknik varlık bulunamadı.' });
      const id = `plan_${crypto.randomUUID()}`;
      await req.db.run('INSERT INTO technical_maintenance_plans (id, asset_id, title, frequency_days, next_due_at, created_by) VALUES (?, ?, ?, ?, ?, ?)', [id, assetId, String(title).trim(), days, nextDueAt, req.actor?.name || 'Teknik Servis']);
      res.status(201).json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/maintenance/purchase-requests', async (req, res) => {
    try { res.json(await req.db.all("SELECT * FROM purchase_requests WHERE department = 'Technical' ORDER BY created_at DESC")); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/maintenance/purchase-requests', async (req, res) => {
    const { itemName, quantity, priority, notes } = req.body;
    const qty = Number(quantity);
    if (!String(itemName || '').trim() || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Malzeme adı ve miktarı zorunludur.' });
    try {
      const id = `pr_${crypto.randomUUID()}`;
      await req.db.run('INSERT INTO purchase_requests (id, item_name, quantity, status, requested_by, department, priority, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, String(itemName).trim(), qty, 'requested', req.actor?.name || 'Teknik Servis', 'Technical', ['critical', 'high', 'normal'].includes(priority) ? priority : 'normal', String(notes || '').trim()]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, req.actor?.name || 'Teknik Servis', 'Teknik satın alma talebi', `${itemName} · ${qty}`]);
      res.status(201).json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Previously there was no way for anyone to ever mark a Technical purchase request
  // fulfilled/cancelled — it sat in 'requested' forever once created.
  app.patch('/api/maintenance/purchase-requests/:id', async (req, res) => {
    const { status } = req.body;
    if (!['requested', 'ordered', 'fulfilled', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Geçersiz satın alma durumu.' });
    try {
      const pr = await req.db.get("SELECT * FROM purchase_requests WHERE id = ? AND department = 'Technical'", [req.params.id]);
      if (!pr) return res.status(404).json({ error: 'Satın alma talebi bulunamadı.' });
      await req.db.run('UPDATE purchase_requests SET status = ? WHERE id = ?', [status, pr.id]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [`log_${crypto.randomUUID()}`, req.actor?.name || 'Teknik Servis', 'Teknik satın alma durumu güncellendi', `${pr.item_name} · ${pr.status} -> ${status}`]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/maintenance', async (req, res) => {
    try {
      const items = await req.db.all("SELECT * FROM requests WHERE type = 'maintenance_request' ORDER BY created_at DESC");
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/maintenance', async (req, res) => {
    const { roomId, priority, details, estimated_completion } = req.body;
    try {
      const room = await req.db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      if (room.status === 'occupied') return res.status(409).json({ error: 'Dolu oda bakım için resepsiyon onayı olmadan kapatılamaz.' });
      const id = `mnt_${crypto.randomUUID()}`;
      const actor = req.actor?.name || 'Teknik Servis';
      const payload = JSON.stringify({ priority: priority || 'normal', estimated_completion: estimated_completion || null, notes: details || '' });
      await req.db.run(
        "INSERT INTO requests (id, type, department, target_identifier, status, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, 'maintenance_request', 'Maintenance', `Room-${room.room_number}`, 'reported', payload, actor]
      );
      await req.db.run("UPDATE rooms SET status = 'maintenance', maintenance_notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [details || '', actor, roomId]);
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [
        `log_${crypto.randomUUID()}`, actor, 'Teknik Arıza Açıldı', `Oda: ${room.room_number}, Öncelik: ${priority || 'normal'}, Tahmini bitiş: ${estimated_completion || 'belirtilmedi'}`
      ]);
      broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { roomId, status: 'maintenance' });
      res.status(201).json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/maintenance/:id', async (req, res) => {
    const { status, resolution, used_parts, actual_minutes } = req.body;
    const allowedStatuses = ['assigned', 'in_progress', 'resolved', 'blocked'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Geçersiz teknik durum.' });
    try {
      const ticket = await req.db.get("SELECT * FROM requests WHERE id = ? AND type = 'maintenance_request'", [req.params.id]);
      if (!ticket) return res.status(404).json({ error: 'Maintenance ticket not found' });
      const actor = req.actor?.name || 'Teknik Servis';
      const details = JSON.stringify({ ...(JSON.parse(ticket.details || '{}')), resolution: resolution || '', used_parts: used_parts || [], actual_minutes: actual_minutes || null });
      if (status === 'resolved') {
        await req.db.run("UPDATE requests SET status = ?, details = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?", [status, details, actor, ticket.id]);
      } else {
        await req.db.run("UPDATE requests SET status = ?, details = ?, completed_by = ? WHERE id = ?", [status, details, actor, ticket.id]);
      }
      if (status === 'resolved') {
        const roomNumber = ticket.target_identifier.replace('Room-', '');
        await req.db.run("UPDATE rooms SET status = 'dirty_vacant', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE room_number = ?", [actor, roomNumber]);
      }
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [
        `log_${crypto.randomUUID()}`, actor, 'Teknik Arıza Güncellendi', `Arıza: ${ticket.id}, Durum: ${status}, Çözüm: ${resolution || 'yok'}`
      ]);
      broadcastSSE && broadcastSSE(req.tenantId, 'maintenance_updated', { id: ticket.id, status });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
