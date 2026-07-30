import { refreshTableStatus } from './tables.js';

const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';

  async function backfillKitchenTickets(db) {
    const stations = await db.all('SELECT * FROM kitchen_stations WHERE active = 1 ORDER BY sort_order');
    if (!stations.length) return;
    const profiles = await db.all('SELECT * FROM menu_kitchen_profiles');
    const profileMap = Object.fromEntries(profiles.map(profile => [profile.catalog_item_id, profile]));
    const catalog = await db.all('SELECT * FROM catalog_items');
    const catalogMap = Object.fromEntries(catalog.map(item => [item.id, item]));
    const defaultStation = stations.find(station => station.name === 'Sıcak')?.id || stations[0].id;
    const openOrders = await db.all("SELECT * FROM requests WHERE type = 'order' AND status IN ('pending', 'accepted', 'preparing', 'ready')");
    for (const order of openOrders) {
      const current = await db.all('SELECT catalog_item_id, quantity FROM kitchen_ticket_lines WHERE request_id = ?', [order.id]);
      const existingQuantities = {};
      for (const ticket of current) existingQuantities[ticket.catalog_item_id] = (existingQuantities[ticket.catalog_item_id] || 0) + Number(ticket.quantity || 0);
      const requiredQuantities = {};
      let details = [];
      try { details = JSON.parse(order.details || '[]'); } catch (err) {}
      for (const line of details) {
        const item = catalogMap[line.itemId];
        if (!item || item.category !== 'food') continue;
        requiredQuantities[item.id] = (requiredQuantities[item.id] || 0) + Number(line.quantity || 1);
        const missingQuantity = Math.max(0, requiredQuantities[item.id] - Number(existingQuantities[item.id] || 0));
        if (!missingQuantity) continue;
        const profile = profileMap[item.id];
        const name = String(item.name || '').toLocaleLowerCase('tr-TR');
        const stationId = profile?.station_id || (/(meze|humus|cacık|salata|soğuk)/.test(name) ? stations.find(station => station.name === 'Soğuk & Meze')?.id : /(ızgara|çipura|levrek|ahtapot)/.test(name) ? stations.find(station => station.name === 'Izgara')?.id : defaultStation);
        if (!stationId) continue;
        await db.run("INSERT INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, status, course, modifiers, allergen_notes, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['ktl_' + Math.random().toString(36).slice(2, 11), order.id, item.id, item.name, missingQuantity, stationId, order.status, profile?.course || 'main', String(line.modifiers || ''), String(line.allergen_notes || ''), line.priority === 'urgent' ? 'urgent' : 'normal']);
        existingQuantities[item.id] = Number(existingQuantities[item.id] || 0) + missingQuantity;
      }
    }
  }

  export async function getProductionTickets(db, requestId) {
    const [kitchen, bar] = await Promise.all([
      db.all('SELECT * FROM kitchen_ticket_lines WHERE request_id = ?', [requestId]),
      db.all('SELECT * FROM bar_ticket_lines WHERE request_id = ?', [requestId])
    ]);
    return [...kitchen.map(ticket => ({ ...ticket, production_area: 'Kitchen' })), ...bar.map(ticket => ({ ...ticket, production_area: 'Bar' }))];
  }

export async function validateTerminalProduction(db, request) {
    let details = [];
    try { details = JSON.parse(request.details || '[]'); } catch (error) { return { valid: false, tickets: [] }; }
    if (!Array.isArray(details)) return { valid: false, tickets: [] };
    const catalog = await db.all('SELECT id, category FROM catalog_items');
    const categoryById = Object.fromEntries(catalog.map(item => [item.id, String(item.category || '').toLocaleLowerCase('tr-TR')]));
    const expectedKitchen = {};
    const expectedBar = {};
    for (const line of details) {
      const quantity = Number(line?.quantity || 0);
      if (!line?.itemId || !(quantity > 0)) continue;
      const category = categoryById[line.itemId];
      if (category === 'food') expectedKitchen[line.itemId] = (expectedKitchen[line.itemId] || 0) + quantity;
      if (category === 'drink') expectedBar[line.itemId] = (expectedBar[line.itemId] || 0) + quantity;
    }
    const tickets = await getProductionTickets(db, request.id);
    const active = tickets.filter(ticket => !['cancelled', 'rejected'].includes(ticket.status));
    const actualKitchen = {};
    const actualBar = {};
    for (const ticket of active) {
      const target = ticket.production_area === 'Kitchen' ? actualKitchen : actualBar;
      target[ticket.catalog_item_id] = (target[ticket.catalog_item_id] || 0) + Number(ticket.quantity || 0);
    }
    const quantitiesMatch = (expected, actual) => {
      const ids = new Set([...Object.keys(expected), ...Object.keys(actual)]);
      return Array.from(ids).every(id => Number(expected[id] || 0) === Number(actual[id] || 0));
    };
    const coverageValid = quantitiesMatch(expectedKitchen, actualKitchen) && quantitiesMatch(expectedBar, actualBar);
    const readinessValid = active.every(ticket => ['ready', 'served', 'completed'].includes(ticket.status));
    return { valid: coverageValid && readinessValid, tickets, active };
  }

  function productionStatus(tickets) {
    const active = tickets.filter(ticket => !['cancelled', 'rejected'].includes(ticket.status));
    if (!active.length) return 'cancelled';
    if (active.every(ticket => ['served', 'completed'].includes(ticket.status))) return 'served';
    if (active.every(ticket => ['ready', 'served', 'completed'].includes(ticket.status))) return 'ready';
    if (active.some(ticket => ['preparing', 'ready'].includes(ticket.status))) return 'preparing';
    if (active.some(ticket => ticket.status === 'accepted')) return 'accepted';
    return 'pending';
  }

  async function reconcileProductionRequest(db, requestId, actorName, allowRegression = false) {
    const request = await db.get('SELECT * FROM requests WHERE id = ?', [requestId]);
    if (!request || ['completed', 'paid', 'cancelled', 'rejected'].includes(request.status)) return request?.status;
    const tickets = await getProductionTickets(db, requestId);
    if (!tickets.length) return request.status;
    let nextStatus = productionStatus(tickets);
    const rank = { pending: 0, accepted: 1, preparing: 2, ready: 3, served: 4 };
    if (!allowRegression && nextStatus !== 'cancelled' && (rank[nextStatus] ?? 0) < (rank[request.status] ?? 0)) nextStatus = request.status;
    if (nextStatus === 'cancelled') {
      await db.run("UPDATE requests SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ?", [actorName, requestId]);
    } else {
      await db.run('UPDATE requests SET status = ?, completed_by = ? WHERE id = ?', [nextStatus, actorName, requestId]);
    }
    return nextStatus;
  }

export async function syncProductionTickets(db, requestId, status, actorName) {
    const now = new Date().toISOString();
    const tables = ['kitchen_ticket_lines', 'bar_ticket_lines'];
    for (const table of tables) {
      if (status === 'accepted') {
        await db.run(`UPDATE ${table} SET status = 'accepted', completed_by = ? WHERE request_id = ? AND status = 'pending'`, [actorName, requestId]);
      } else if (status === 'preparing') {
        await db.run(`UPDATE ${table} SET status = 'preparing', started_at = COALESCE(started_at, ?), completed_by = ? WHERE request_id = ? AND status IN ('pending', 'accepted')`, [now, actorName, requestId]);
      } else if (status === 'ready') {
        await db.run(`UPDATE ${table} SET status = 'ready', started_at = COALESCE(started_at, ?), ready_at = COALESCE(ready_at, ?), completed_by = ? WHERE request_id = ? AND status IN ('pending', 'accepted', 'preparing')`, [now, now, actorName, requestId]);
      } else if (status === 'served') {
        await db.run(`UPDATE ${table} SET status = 'served', completed_by = ? WHERE request_id = ? AND status = 'ready'`, [actorName, requestId]);
      } else if (['completed', 'paid'].includes(status)) {
        await db.run(`UPDATE ${table} SET status = 'completed', completed_by = ? WHERE request_id = ? AND status IN ('ready', 'served')`, [actorName, requestId]);
      } else if (['cancelled', 'rejected'].includes(status)) {
        await db.run(`UPDATE ${table} SET status = ?, completed_by = ? WHERE request_id = ? AND status NOT IN ('served', 'completed', 'cancelled', 'rejected')`, [status, actorName, requestId]);
      }
    }
  }

  async function restoreInventoryLines(db, marker, lines, actorName) {
    if (!ENABLE_STOCK_ALGORITHM || !lines.length) return false;
    const markerId = `log_stock_restore_${String(marker).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const existing = await db.get('SELECT id FROM audit_logs WHERE id = ?', [markerId]);
    if (existing) return false;
    const recipes = await db.all('SELECT r.*, i.module_type FROM recipes r JOIN inventory i ON i.id = r.inventory_id');
    const returns = {};
    for (const line of lines) {
      for (const recipe of recipes.filter(row => row.catalog_item_id === line.catalog_item_id)) {
        const multiplier = recipe.module_type === 'bar' ? 1.06 : 1;
        returns[recipe.inventory_id] = (returns[recipe.inventory_id] || 0) + Number(recipe.amount_needed) * Number(line.quantity || 0) * multiplier;
      }
    }
    for (const [inventoryId, amount] of Object.entries(returns)) {
      if (amount > 0) await db.run('UPDATE inventory SET stock = stock + ? WHERE id = ?', [amount, inventoryId]);
    }
    await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Sipariş Stok İadesi', ?)", [markerId, actorName, `${marker}: ${Object.entries(returns).map(([id, amount]) => `${id}=${amount}`).join(', ') || 'reçetesiz ürün'}`]);
    return true;
  }

  async function restoreTicketInventory(db, ticket, actorName) {
    return restoreInventoryLines(db, `ticket_${ticket.id}`, [{ catalog_item_id: ticket.catalog_item_id, quantity: Number(ticket.quantity || 0) }], actorName);
  }

export async function restoreRequestInventory(db, request, actorName) {
    if (!ENABLE_STOCK_ALGORITHM) return;
    const requestMarkerId = `log_stock_restore_request_${String(request.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const priorRequestRestore = await db.get('SELECT id FROM audit_logs WHERE id = ?', [requestMarkerId]);
    if (priorRequestRestore) return;
    const tickets = await getProductionTickets(db, request.id);
    const ticketTotals = {};
    for (const ticket of tickets) {
      ticketTotals[ticket.catalog_item_id] = (ticketTotals[ticket.catalog_item_id] || 0) + Number(ticket.quantity || 0);
      if (!['served', 'completed'].includes(ticket.status)) await restoreTicketInventory(db, ticket, actorName);
    }
    let details = [];
    try { details = JSON.parse(request.details || '[]'); } catch (error) {}
    const detailTotals = {};
    for (const line of Array.isArray(details) ? details : []) {
      if (!line?.itemId) continue;
      detailTotals[line.itemId] = (detailTotals[line.itemId] || 0) + Number(line.quantity || 0);
    }
    for (const [catalogItemId, quantity] of Object.entries(detailTotals)) {
      const unticketed = quantity - Number(ticketTotals[catalogItemId] || 0);
      if (unticketed > 0) await restoreInventoryLines(db, `request_${request.id}_${catalogItemId}`, [{ catalog_item_id: catalogItemId, quantity: unticketed }], actorName);
    }
    await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Sipariş Stok İadesi Tamamlandı', ?)", [requestMarkerId, actorName, request.id]);
  }

  async function adjustCancelledTicketFinancials(db, ticket, actorName, reason) {
    const markerId = `log_ticket_adjustment_${String(ticket.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const prior = await db.get('SELECT details FROM audit_logs WHERE id = ?', [markerId]);
    if (prior) {
      try { return { ...JSON.parse(prior.details || '{}'), changed: false }; } catch (error) { return { changed: false }; }
    }
    const request = await db.get("SELECT * FROM requests WHERE id = ? AND type = 'order'", [ticket.request_id]);
    if (!request) return { changed: false };
    let details = [];
    try { details = JSON.parse(request.details || '[]'); } catch (error) { return { changed: false, request }; }
    if (!Array.isArray(details)) return { changed: false, request };
    const catalogItem = await db.get('SELECT price FROM catalog_items WHERE id = ?', [ticket.catalog_item_id]);
    let remaining = Number(ticket.quantity || 0);
    let reduction = 0;
    let removedQuantity = 0;
    const updated = [];
    // Prefer matching the cancelled ticket back to the exact detail line it was generated from
    // (via line_ref). Older tickets created before line_ref existed fall back to matching purely
    // by catalog_item_id, which can misattribute the adjustment when an order has two lines for
    // the same item with different modifiers.
    const hasLineRef = Boolean(ticket.line_ref) && details.some(line => line?.lineRef === ticket.line_ref);
    for (const line of details) {
      const matches = hasLineRef ? line?.lineRef === ticket.line_ref : line?.itemId === ticket.catalog_item_id;
      if (!matches || remaining <= 0) {
        updated.push(line);
        continue;
      }
      const quantity = Number(line.quantity || 0);
      const removed = Math.min(quantity, remaining);
      const unitPrice = Number(line.price ?? catalogItem?.price ?? 0);
      reduction += removed * unitPrice;
      removedQuantity += removed;
      remaining -= removed;
      const nextQuantity = quantity - removed;
      if (nextQuantity > 0) updated.push({ ...line, quantity: nextQuantity });
    }
    const newTotalAmount = Math.max(0, Number(request.total_amount || 0) - reduction);
    const payload = {
      requestId: request.id,
      targetIdentifier: request.target_identifier,
      ticketId: ticket.id,
      catalogItemId: ticket.catalog_item_id,
      quantity: removedQuantity,
      adjustmentAmount: -reduction,
      newTotalAmount,
      reason: String(reason || 'Mutfak bileti iptali')
    };
    await db.run('UPDATE requests SET details = ?, total_amount = ? WHERE id = ?', [JSON.stringify(updated), newTotalAmount, request.id]);
    await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Sipariş Kalem İptal Düzeltmesi', ?)", [markerId, actorName, JSON.stringify(payload)]);
    return { ...payload, request: { ...request, details: JSON.stringify(updated), total_amount: newTotalAmount }, changed: removedQuantity > 0 };
  }

export function initProduction({ app, eventBus, getDb, broadcastSSE }) {
  eventBus.on('order_delivered_to_room', async data => {
    if (!data?.tenantId || !data?.requestId) return;
    const db = await getDb(data.tenantId);
    const request = await db.get("SELECT * FROM requests WHERE id = ? AND type = 'order'", [data.requestId]);
    if (!request || !request.target_identifier.startsWith('Room-') || ['completed', 'paid', 'cancelled', 'rejected'].includes(request.status)) return;
    const tickets = await getProductionTickets(db, request.id);
    const active = tickets.filter(ticket => !['cancelled', 'rejected'].includes(ticket.status));
    if (!active.length || !active.every(ticket => ['served', 'completed'].includes(ticket.status))) return;
    await syncProductionTickets(db, request.id, 'completed', request.completed_by || 'Oda Servisi');
    await db.run("UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = COALESCE(completed_by, 'Oda Servisi') WHERE id = ?", [request.id]);
    broadcastSSE && broadcastSSE(data.tenantId, 'request_updated', { requestId: request.id, status: 'completed' });
  });

  app.get('/api/kitchen/tasks', async (req, res) => {
    try {
      const tasks = await req.db.all("SELECT * FROM reception_tasks WHERE lower(department) IN ('kitchen', 'mutfak') AND status <> 'completed' ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, created_at ASC");
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/kitchen/tasks', async (req, res) => {
    const details = String(req.body?.details || '').trim();
    const priority = ['normal', 'high', 'urgent'].includes(req.body?.priority) ? req.body.priority : 'normal';
    if (!details || details.length > 240) return res.status(400).json({ error: 'Görev detayı zorunludur ve 240 karakteri geçemez.' });
    try {
      const id = 'kt_' + Math.random().toString(36).slice(2, 11);
      const staffName = req.actor?.name || 'Mutfak';
      await req.db.run("INSERT INTO reception_tasks (id, task_type, department, priority, details, created_by) VALUES (?, 'kitchen_prep', 'Kitchen', ?, ?, ?)", [id, priority, details, staffName]);
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Mutfak Hazırlık Görevi', ?)", ['log_' + Math.random().toString(36).slice(2, 11), staffName, details]);
      res.status(201).json({ id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/kitchen/tasks/:id', async (req, res) => {
    if (req.body?.status !== 'completed') return res.status(400).json({ error: 'Geçerli görev durumu completed olmalıdır.' });
    try {
      const task = await req.db.get("SELECT id FROM reception_tasks WHERE id = ? AND lower(department) IN ('kitchen', 'mutfak')", [req.params.id]);
      if (!task) return res.status(404).json({ error: 'Mutfak görevi bulunamadı.' });
      const staffName = req.actor?.name || 'Mutfak';
      await req.db.run("UPDATE reception_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ?", [staffName, task.id]);
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Mutfak Görevi Tamamlandı', ?)", ['log_' + Math.random().toString(36).slice(2, 11), staffName, task.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/kitchen/stations', async (req, res) => {
    try {
      res.json(await req.db.all('SELECT * FROM kitchen_stations WHERE active = 1 ORDER BY sort_order, name'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/kitchen/tickets', async (req, res) => {
    try {
      await backfillKitchenTickets(req.db);
      const tickets = await req.db.all("SELECT l.*, r.target_identifier, r.created_at AS order_created_at, r.total_amount, r.status AS order_status, s.name AS station_name FROM kitchen_ticket_lines l JOIN requests r ON r.id = l.request_id JOIN kitchen_stations s ON s.id = l.station_id WHERE l.status NOT IN ('served', 'completed', 'cancelled', 'rejected') AND r.status NOT IN ('completed', 'cancelled', 'rejected') ORDER BY CASE l.priority WHEN 'urgent' THEN 1 ELSE 2 END, r.created_at ASC");
      res.json(tickets);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/kitchen/tickets/:id', async (req, res) => {
    const status = String(req.body?.status || '');
    const cancellationReason = String(req.body?.reason || 'Mutfak bileti iptali');
    const allowed = { pending: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['served', 'refire'], refire: ['preparing', 'cancelled'] };
    try {
      const ticket = await req.db.get('SELECT * FROM kitchen_ticket_lines WHERE id = ?', [req.params.id]);
      if (!ticket) return res.status(404).json({ error: 'Mutfak bileti bulunamadı.' });
      const staffName = req.actor?.name || 'Mutfak';
      if (ticket.status === 'cancelled' && status === 'cancelled') {
        await restoreTicketInventory(req.db, ticket, staffName);
        const financialAdjustment = await adjustCancelledTicketFinancials(req.db, ticket, staffName, cancellationReason);
        const requestStatus = await reconcileProductionRequest(req.db, ticket.request_id, staffName);
        const request = await req.db.get('SELECT * FROM requests WHERE id = ?', [ticket.request_id]);
        if (requestStatus === 'cancelled' && request?.target_identifier?.startsWith('Room-') && request.payment_method === 'room_charge') {
          await eventBus.emit('room_charge_reversal_request', { tenantId: req.tenantId, requestId: request.id, createdBy: staffName, reason: cancellationReason });
        } else if (financialAdjustment.changed && request?.target_identifier?.startsWith('Room-') && request.payment_method === 'room_charge') {
          await eventBus.emit('room_charge_adjustment_request', {
            tenantId: req.tenantId,
            requestId: financialAdjustment.requestId,
            targetIdentifier: financialAdjustment.targetIdentifier,
            ticketId: financialAdjustment.ticketId,
            catalogItemId: financialAdjustment.catalogItemId,
            quantity: financialAdjustment.quantity,
            adjustmentAmount: financialAdjustment.adjustmentAmount,
            newTotalAmount: financialAdjustment.newTotalAmount,
            reason: financialAdjustment.reason,
            createdBy: staffName
          });
        }
        return res.json({ success: true, requestId: ticket.request_id, status: requestStatus });
      }
      if (!allowed[ticket.status]?.includes(status)) return res.status(409).json({ error: `Geçersiz bilet geçişi: ${ticket.status} -> ${status}` });
      const nextStatus = status === 'refire' ? 'preparing' : status;
      const now = new Date().toISOString();
      const fireCount = Number(ticket.fire_count || 0) + (status === 'refire' ? 1 : 0);
      const startedAt = nextStatus === 'preparing' && !ticket.started_at ? now : ticket.started_at || null;
      const readyAt = nextStatus === 'ready' ? now : ticket.ready_at || null;
      await req.db.run('UPDATE kitchen_ticket_lines SET status = ?, fire_count = ?, started_at = ?, ready_at = ?, completed_by = ? WHERE id = ?', [nextStatus, fireCount, startedAt, readyAt, staffName, ticket.id]);
      let financialAdjustment = { changed: false };
      if (nextStatus === 'cancelled') {
        await restoreTicketInventory(req.db, ticket, staffName);
        financialAdjustment = await adjustCancelledTicketFinancials(req.db, ticket, staffName, cancellationReason);
      }
      const requestStatus = await reconcileProductionRequest(req.db, ticket.request_id, staffName, status === 'refire');
      const request = await req.db.get('SELECT * FROM requests WHERE id = ?', [ticket.request_id]);
      if (requestStatus === 'cancelled' && request?.target_identifier?.startsWith('Room-') && request.payment_method === 'room_charge') {
        await eventBus.emit('room_charge_reversal_request', { tenantId: req.tenantId, requestId: request.id, createdBy: staffName, reason: cancellationReason });
      } else if (financialAdjustment.changed && request?.target_identifier?.startsWith('Room-') && request.payment_method === 'room_charge') {
        await eventBus.emit('room_charge_adjustment_request', {
          tenantId: req.tenantId,
          requestId: financialAdjustment.requestId,
          targetIdentifier: financialAdjustment.targetIdentifier,
          ticketId: financialAdjustment.ticketId,
          catalogItemId: financialAdjustment.catalogItemId,
          quantity: financialAdjustment.quantity,
          adjustmentAmount: financialAdjustment.adjustmentAmount,
          newTotalAmount: financialAdjustment.newTotalAmount,
          reason: financialAdjustment.reason,
          createdBy: staffName
        });
      }
      const tableUpdate = await refreshTableStatus(req.db, request?.target_identifier);
      if (tableUpdate) broadcastSSE && broadcastSSE(req.tenantId, 'table_updated', tableUpdate);
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Mutfak Bileti Güncellendi', ?)", ['log_' + Math.random().toString(36).slice(2, 11), staffName, `${ticket.item_name}: ${ticket.status} -> ${nextStatus}`]);
      broadcastSSE && broadcastSSE(req.tenantId, 'request_updated', { requestId: ticket.request_id, status: requestStatus });
      res.json({ success: true, requestId: ticket.request_id, status: requestStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/kitchen/menu-profiles', async (req, res) => {
    try {
      res.json(await req.db.all("SELECT p.*, c.name AS catalog_item_name, s.name AS station_name FROM menu_kitchen_profiles p JOIN catalog_items c ON c.id = p.catalog_item_id JOIN kitchen_stations s ON s.id = p.station_id ORDER BY c.name"));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/kitchen/menu-control', async (req, res) => {
    try {
      res.json(await req.db.all("SELECT c.id, c.name, c.category, c.price, COALESCE(p.active, 1) AS active, COALESCE(s.name, 'Atanmadı') AS station_name FROM catalog_items c LEFT JOIN menu_kitchen_profiles p ON p.catalog_item_id = c.id LEFT JOIN kitchen_stations s ON s.id = p.station_id WHERE c.category = 'food' ORDER BY c.name"));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/kitchen/menu-control/:catalogItemId', async (req, res) => {
    const active = req.body?.active === true || req.body?.active === 1;
    try {
      const item = await req.db.get('SELECT * FROM catalog_items WHERE id = ? AND category = ?', [req.params.catalogItemId, 'food']);
      if (!item) return res.status(404).json({ error: 'Yemek ürünü bulunamadı.' });
      const profile = await req.db.get('SELECT * FROM menu_kitchen_profiles WHERE catalog_item_id = ?', [item.id]);
      const fallback = await req.db.get('SELECT id FROM kitchen_stations WHERE active = 1 ORDER BY sort_order LIMIT 1');
      if (!profile && !fallback) return res.status(409).json({ error: 'Aktif mutfak istasyonu bulunamadı.' });
      if (profile) await req.db.run('UPDATE menu_kitchen_profiles SET active = ? WHERE catalog_item_id = ?', [active ? 1 : 0, item.id]);
      else await req.db.run("INSERT INTO menu_kitchen_profiles (catalog_item_id, station_id, course, allergens, prep_minutes, active) VALUES (?, ?, 'main', '', 15, ?)", [item.id, fallback.id, active ? 1 : 0]);
      await req.db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Menü 86 Durumu', ?)", ['log_' + Math.random().toString(36).slice(2, 11), req.actor?.name || 'Mutfak', `${item.name}: ${active ? 'aktif' : '86'}`]);
      res.json({ success: true, active });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/kitchen/menu-profiles/:catalogItemId', async (req, res) => {
    const { station_id, course, allergens, prep_minutes, active } = req.body || {};
    try {
      const item = await req.db.get('SELECT id FROM catalog_items WHERE id = ?', [req.params.catalogItemId]);
      const station = await req.db.get('SELECT id FROM kitchen_stations WHERE id = ? AND active = 1', [station_id]);
      if (!item || !station) return res.status(400).json({ error: 'Geçerli ürün ve istasyon seçilmelidir.' });
      await req.db.run('DELETE FROM menu_kitchen_profiles WHERE catalog_item_id = ?', [item.id]);
      await req.db.run("INSERT INTO menu_kitchen_profiles (catalog_item_id, station_id, course, allergens, prep_minutes, active) VALUES (?, ?, ?, ?, ?, ?)", [item.id, station.id, String(course || 'main'), String(allergens || ''), Math.max(1, Number(prep_minutes || 15)), active === false ? 0 : 1]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/kitchen/waste', async (req, res) => {
    const { inventory_id, quantity, reason, notes } = req.body || {};
    const amount = Number(quantity);
    if (!inventory_id || !Number.isFinite(amount) || amount <= 0 || !String(reason || '').trim()) return res.status(400).json({ error: 'Malzeme, miktar ve zayiat sebebi zorunludur.' });
    try {
      const inventory = await req.db.get('SELECT * FROM inventory WHERE id = ?', [inventory_id]);
      if (!inventory) return res.status(404).json({ error: 'Stok kalemi bulunamadı.' });
      const staffName = req.actor?.name || 'Mutfak';
      const id = 'waste_' + Math.random().toString(36).slice(2, 11);
      await req.db.transaction(async tx => {
        await tx.run('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?', [amount, inventory_id, amount], {
          requireChange: true,
          failureMessage: 'Zayiat için yeterli stok yok (eşzamanlı işlem nedeniyle stok tükendi).',
          undoSql: 'UPDATE inventory SET stock = stock + ? WHERE id = ?', undoParams: [amount, inventory_id]
        });
        await tx.run('INSERT INTO kitchen_waste_logs (id, inventory_id, quantity, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)', [id, inventory_id, amount, String(reason).trim(), String(notes || ''), staffName], {
          undoSql: 'DELETE FROM kitchen_waste_logs WHERE id = ?', undoParams: [id]
        });
        await tx.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Mutfak Zayiatı', ?)", ['log_' + Math.random().toString(36).slice(2, 11), staffName, `${inventory.name}: ${amount} ${inventory.unit}; ${reason}`]);
      });
      res.status(201).json({ id, stock: Number(inventory.stock) - amount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/kitchen/temperatures', async (req, res) => {
    try {
      res.json(await req.db.all('SELECT * FROM kitchen_temperature_logs ORDER BY recorded_at DESC LIMIT 100'));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/kitchen/temperatures', async (req, res) => {
    const { area, temperature, corrective_action } = req.body || {};
    const value = Number(temperature);
    if (!String(area || '').trim() || !Number.isFinite(value)) return res.status(400).json({ error: 'Alan ve sıcaklık zorunludur.' });
    try {
      const staffName = req.actor?.name || 'Mutfak';
      const id = 'temp_' + Math.random().toString(36).slice(2, 11);
      await req.db.run('INSERT INTO kitchen_temperature_logs (id, area, temperature, corrective_action, recorded_by) VALUES (?, ?, ?, ?, ?)', [id, String(area).trim(), value, String(corrective_action || ''), staffName]);
      res.status(201).json({ id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
