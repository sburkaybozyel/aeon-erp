import { barGuard, makeId, saveAudit, resolveTarget, reconcileRequestStatus, getDashboard } from './helpers.js';

export function registerOrderRoutes({ app, eventBus, broadcastSSE }) {
  app.get('/api/bar/dashboard', async (req, res) => {
    if (!barGuard(req, res)) return;
    try {
      res.json(await getDashboard(req.db, req.tenantId, req.actor));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bar/orders', async (req, res) => {
    if (!barGuard(req, res)) return;
    const lines = Array.isArray(req.body?.details) ? req.body.details : [];
    const paymentMethod = String(req.body?.payment_method || 'cash');
    if (!lines.length || lines.length > 50) return res.status(400).json({ error: 'Sipariş 1 ile 50 kalem arasında olmalıdır.' });
    if (!['cash', 'credit_card', 'room_charge'].includes(paymentMethod)) return res.status(400).json({ error: 'Geçerli ödeme yöntemi seçin.' });
    let idempotencyId = '';
    try {
      const idempotencyKey = String(req.get('idempotency-key') || '').trim();
      idempotencyId = idempotencyKey ? `bar_order:${idempotencyKey}` : '';
      const requestFingerprint = JSON.stringify(req.body || {});
      if (idempotencyId) {
        const prior = await req.db.get("SELECT request_hash, response_json FROM idempotency_records WHERE id = ?", [idempotencyId]);
        if (prior && prior.request_hash !== requestFingerprint) return res.status(409).json({ error: 'Aynı idempotency anahtarı farklı bir taleple kullanılmış.' });
        if (prior && prior.response_json) return res.status(200).json(JSON.parse(prior.response_json));
        if (prior && !prior.response_json) return res.status(409).json({ error: 'Bu talep hâlâ işleniyor, lütfen kısa süre sonra tekrar deneyin.' });
      }
      const target = await resolveTarget(req.db, req.body?.target_identifier, paymentMethod);
      if (!target) return res.status(400).json({ error: 'Masa için nakit veya kart seçin; oda hesabı için yalnızca konaklayan misafir odası seçin.' });
      const [catalog, recipes, inventory] = await Promise.all([
        req.db.all("SELECT * FROM catalog_items WHERE category = 'drink' AND in_stock <> 0"),
        req.db.all("SELECT r.* FROM recipes r JOIN inventory i ON i.id = r.inventory_id WHERE i.module_type = 'bar'"),
        req.db.all("SELECT * FROM inventory WHERE module_type = 'bar'")
      ]);
      const catalogById = Object.fromEntries(catalog.map(item => [item.id, item]));
      const inventoryById = Object.fromEntries(inventory.map(item => [item.id, item]));
      const deductions = {};
      const details = [];
      let totalAmount = 0;
      for (const rawLine of lines) {
        const item = catalogById[String(rawLine?.itemId || '')];
        const quantity = Number(rawLine?.quantity);
        if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return res.status(400).json({ error: 'Bar menüsünden geçerli ürün ve adet seçin.' });
        const itemRecipe = recipes.filter(recipe => recipe.catalog_item_id === item.id);
        details.push({ itemId: item.id, name: item.name, price: Number(item.price), quantity, stockTracked: itemRecipe.length > 0 });
        totalAmount += Number(item.price) * quantity;
        for (const recipe of itemRecipe) deductions[recipe.inventory_id] = (deductions[recipe.inventory_id] || 0) + Number(recipe.amount_needed) * quantity * 1.06;
      }
      for (const [inventoryId, amount] of Object.entries(deductions)) {
        const item = inventoryById[inventoryId];
        if (!item || Number(item.stock) < amount) return res.status(409).json({ error: `${item?.name || 'Stok kalemi'} için yeterli stok yok.` });
      }
      const id = makeId('bar');
      try {
        await req.db.transaction(async tx => {
          if (idempotencyId) {
            // Reserve only now that every validation check has passed, so a legitimate 400/409
            // above never leaves a stuck 'processing' record blocking future retries with this key.
            await tx.run("INSERT INTO idempotency_records (id, operation, request_hash, response_json) VALUES (?, ?, ?, NULL)", [idempotencyId, 'bar_order.create', requestFingerprint], {
              undoSql: "DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", undoParams: [idempotencyId]
            });
          }
          // Sufficiency check baked into the WHERE clause so it and the write are one atomic
          // statement — closing the read-check-write race where two concurrent orders both pass
          // the JS snapshot check above and both deduct. A short item throws and everything
          // already deducted in this loop (and the reservation above) is automatically restored.
          for (const [inventoryId, amount] of Object.entries(deductions)) {
            await tx.run('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?', [amount, inventoryId, amount], {
              requireChange: true,
              failureMessage: `${inventoryById[inventoryId]?.name || 'Stok kalemi'} için yeterli stok yok (eşzamanlı sipariş nedeniyle stok tükendi).`,
              undoSql: 'UPDATE inventory SET stock = stock + ? WHERE id = ?', undoParams: [amount, inventoryId]
            });
          }
          // The order/ticket rows are created inside the same transaction as the stock
          // deduction so a failure here (e.g. a transient DB error) rolls the stock back too,
          // instead of leaving inventory permanently short with no order to explain it.
          await tx.run("INSERT INTO requests (id, type, target_identifier, status, details, total_amount, payment_method, created_by, department, departments) VALUES (?, 'order', ?, 'pending', ?, ?, ?, ?, 'Bar', ?)", [id, target, JSON.stringify(details), totalAmount, paymentMethod, req.actor?.name || 'Bar', JSON.stringify(['Bar', 'Restaurant'])], {
            undoSql: 'DELETE FROM requests WHERE id = ?', undoParams: [id]
          });
          for (const line of details) {
            const ticketId = makeId('btl');
            await tx.run("INSERT INTO bar_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, unit_price, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", [ticketId, id, line.itemId, line.name, line.quantity, line.price], {
              undoSql: 'DELETE FROM bar_ticket_lines WHERE id = ?', undoParams: [ticketId]
            });
          }
          if (target.startsWith('Table-')) {
            await tx.run("UPDATE tables SET status = 'occupied' WHERE table_number = ?", [target.slice(6)], {
              undoSql: "UPDATE tables SET status = 'available' WHERE table_number = ?", undoParams: [target.slice(6)]
            });
          }
        });
      } catch (stockError) {
        return res.status(409).json({ error: stockError.message });
      }
      if (paymentMethod === 'room_charge') await eventBus.emit('room_charge_request', { tenantId: req.tenantId, targetIdentifier: target, amount: totalAmount, requestId: id, createdBy: req.actor?.name || 'Bar', department: 'Bar', description: 'Bar siparişi' });
      const printPayload = { target, created_by: req.actor?.name || 'Bar', lines: details.map(line => ({ name: line.name, quantity: line.quantity, modifiers: '', allergen_notes: '' })) };
      await Promise.all([
        eventBus.emit('print_job_enqueue', { tenantId: req.tenantId, station: 'kitchen', requestId: id, payload: { ...printPayload, title: 'SİPARİŞ FİŞİ' } }),
        eventBus.emit('print_job_enqueue', { tenantId: req.tenantId, station: 'reception', requestId: id, payload: { ...printPayload, title: 'SİPARİŞ FİŞİ' } })
      ]);
      await saveAudit(req.db, req.actor, 'Bar Siparişi', `${target}: ${totalAmount.toFixed(2)} TL`);
      const payload = { id, type: 'order', target_identifier: target, status: 'pending', details, total_amount: totalAmount, payment_method: paymentMethod, department: 'Bar', departments: ['Bar', 'Restaurant'] };
      broadcastSSE(req.tenantId, 'bar_order_created', payload);
      broadcastSSE(req.tenantId, 'request_created', payload);
      await eventBus.emit('staff_push', { tenantId: req.tenantId, targetRoles: [], targetDepartments: ['Bar'], payload: { title: 'Yeni Bar Siparişi', body: `${target} - ${details.map(line => `${line.quantity}x ${line.name}`).join(', ')}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}&inbox=orders`, tag: id, requestId: id, type: 'bar_order', target_identifier: target } });
      if (target.startsWith('Table-')) broadcastSSE(req.tenantId, 'table_updated', { tableNumber: target.slice(6), status: 'occupied' });
      const responseBody = { success: true, order: payload, room_charge_posted: paymentMethod === 'room_charge' };
      if (idempotencyId) {
        await req.db.run("UPDATE idempotency_records SET response_json = ? WHERE id = ?", [JSON.stringify(responseBody), idempotencyId]);
      }
      res.status(201).json(responseBody);
    } catch (error) {
      if (idempotencyId) {
        await req.db.run("DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", [idempotencyId]).catch(() => {});
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bar/orders/:id/status', async (req, res) => {
    if (!barGuard(req, res)) return;
    const requestedStatus = String(req.body?.status || '');
    const nextStatus = requestedStatus === 'completed' ? 'served' : requestedStatus;
    const transitions = { pending: ['accepted', 'preparing', 'ready'], accepted: ['preparing', 'ready'], preparing: ['ready'], ready: ['served'], served: [] };
    try {
      const order = await req.db.get("SELECT * FROM requests WHERE id = ? AND type = 'order' AND (department = 'Bar' OR departments LIKE '%Bar%')", [req.params.id]);
      if (!order) return res.status(404).json({ error: 'Bar siparişi bulunamadı.' });
      const tickets = await req.db.all('SELECT * FROM bar_ticket_lines WHERE request_id = ?', [order.id]);
      if (!tickets.length) return res.status(409).json({ error: 'Siparişin bar üretim kalemi bulunamadı.' });
      const current = tickets.some(line => line.status === 'pending') ? 'pending' : tickets.some(line => line.status === 'accepted') ? 'accepted' : tickets.some(line => line.status === 'preparing') ? 'preparing' : tickets.some(line => line.status === 'ready') ? 'ready' : 'served';
      if (current !== nextStatus && !(transitions[current] || []).includes(nextStatus)) return res.status(409).json({ error: 'Sipariş bu aşamadan istenen duruma geçirilemez.' });
      const actorName = req.actor?.name || 'Bar';
      const now = new Date().toISOString();
      let finalStatus;
      await req.db.transaction(async tx => {
        if (nextStatus === 'accepted') await tx.run("UPDATE bar_ticket_lines SET status = 'accepted', completed_by = ? WHERE request_id = ? AND status = 'pending'", [actorName, order.id]);
        if (nextStatus === 'preparing') await tx.run("UPDATE bar_ticket_lines SET status = 'preparing', started_at = COALESCE(started_at, ?), completed_by = ? WHERE request_id = ? AND status IN ('pending', 'accepted')", [now, actorName, order.id]);
        if (nextStatus === 'ready') await tx.run("UPDATE bar_ticket_lines SET status = 'ready', started_at = COALESCE(started_at, ?), ready_at = ?, completed_by = ? WHERE request_id = ? AND status IN ('pending', 'accepted', 'preparing')", [now, now, actorName, order.id]);
        if (nextStatus === 'served') await tx.run("UPDATE bar_ticket_lines SET status = 'served', completed_by = ? WHERE request_id = ? AND status = 'ready'", [actorName, order.id]);
        const requestStatus = await reconcileRequestStatus(tx, order.id, actorName);
        finalStatus = requestStatus;
        if (nextStatus === 'served' && order.target_identifier.startsWith('Room-')) {
          await tx.run("UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ?", [actorName, order.id], {
            undoSql: 'UPDATE requests SET status = ? WHERE id = ?', undoParams: [order.status, order.id]
          });
          finalStatus = 'completed';
        }
        await saveAudit(tx, req.actor, 'Bar Sipariş Durumu', `${order.target_identifier}: ${nextStatus}`);
      });
      if (nextStatus === 'served' && order.target_identifier.startsWith('Room-')) {
        await eventBus.emit('order_delivered_to_room', { tenantId: req.tenantId, targetIdentifier: order.target_identifier, requestId: order.id });
      }
      const payload = { id: order.id, status: finalStatus, bar_status: nextStatus, target_identifier: order.target_identifier };
      broadcastSSE(req.tenantId, 'bar_order_updated', payload);
      broadcastSSE(req.tenantId, 'request_updated', payload);
      await eventBus.emit('staff_push', { tenantId: req.tenantId, targetRoles: [], targetDepartments: nextStatus === 'ready' ? ['Bar', 'Restaurant'] : ['Bar'], payload: { title: 'Bar Sipariş Durumu', body: `${order.target_identifier} - ${nextStatus}`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}&inbox=orders`, tag: `${order.id}-${nextStatus}`, requestId: order.id, type: 'bar_order_status', target_identifier: order.target_identifier } });
      res.json({ success: true, order: payload });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/bar/orders/:id', async (req, res) => {
    if (!barGuard(req, res)) return;
    const lines = Array.isArray(req.body?.details) ? req.body.details : [];
    if (!lines.length || lines.length > 50) return res.status(400).json({ error: 'Sipariş 1 ile 50 kalem arasında olmalıdır.' });
    try {
      const order = await req.db.get("SELECT * FROM requests WHERE id = ? AND type = 'order' AND (department = 'Bar' OR departments LIKE '%Bar%')", [req.params.id]);
      if (!order) return res.status(404).json({ error: 'Bar siparişi bulunamadı.' });
      const kitchenLines = await req.db.get('SELECT COUNT(*) AS count FROM kitchen_ticket_lines WHERE request_id = ?', [order.id]);
      if (Number(kitchenLines?.count || 0)) return res.status(409).json({ error: 'Mutfak kalemi içeren karma sipariş restoran ekranından düzenlenmelidir.' });
      if (order.status !== 'pending') return res.status(409).json({ error: 'Yalnız hazırlanma aşamasına geçmemiş siparişler düzenlenebilir.' });
      if (order.payment_method === 'room_charge') return res.status(409).json({ error: 'Oda hesabına işlenen sipariş düzenlenemez; iptal edip yeniden oluşturun.' });
      const [catalog, recipes, inventory] = await Promise.all([
        req.db.all("SELECT * FROM catalog_items WHERE category = 'drink' AND in_stock <> 0"),
        req.db.all("SELECT r.* FROM recipes r JOIN inventory i ON i.id = r.inventory_id WHERE i.module_type = 'bar'"),
        req.db.all("SELECT * FROM inventory WHERE module_type = 'bar'")
      ]);
      const catalogById = Object.fromEntries(catalog.map(item => [item.id, item]));
      const inventoryById = Object.fromEntries(inventory.map(item => [item.id, item]));
      const makeDeductions = details => {
        const deductions = {};
        for (const line of details) for (const recipe of recipes.filter(row => row.catalog_item_id === line.itemId)) deductions[recipe.inventory_id] = (deductions[recipe.inventory_id] || 0) + Number(recipe.amount_needed) * Number(line.quantity) * 1.06;
        return deductions;
      };
      const details = [];
      let totalAmount = 0;
      for (const rawLine of lines) {
        const item = catalogById[String(rawLine?.itemId || '')];
        const quantity = Number(rawLine?.quantity);
        if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return res.status(400).json({ error: 'Bar menüsünden geçerli ürün ve adet seçin.' });
        details.push({ itemId: item.id, name: item.name, price: Number(item.price), quantity });
        totalAmount += Number(item.price) * quantity;
      }
      let previousDetails = [];
      try { previousDetails = JSON.parse(order.details || '[]'); } catch (error) {}
      const previousDeductions = makeDeductions(previousDetails);
      const nextDeductions = makeDeductions(details);
      const deltas = {};
      for (const inventoryId of new Set([...Object.keys(previousDeductions), ...Object.keys(nextDeductions)])) deltas[inventoryId] = Number(nextDeductions[inventoryId] || 0) - Number(previousDeductions[inventoryId] || 0);
      await req.db.transaction(async tx => {
        for (const [inventoryId, amount] of Object.entries(deltas)) {
          if (amount <= 0) continue;
          const item = inventoryById[inventoryId];
          if (!item || Number(item.stock) < amount) throw new Error(`${item?.name || 'Stok kalemi'} için yeterli stok yok.`);
          await tx.run('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?', [amount, inventoryId, amount], {
            requireChange: true,
            failureMessage: `${item.name} için yeterli stok yok.`,
            undoSql: 'UPDATE inventory SET stock = stock + ? WHERE id = ?', undoParams: [amount, inventoryId]
          });
        }
        for (const [inventoryId, amount] of Object.entries(deltas)) if (amount < 0) await tx.run('UPDATE inventory SET stock = stock + ? WHERE id = ?', [Math.abs(amount), inventoryId]);
        await tx.run('UPDATE requests SET details = ?, total_amount = ? WHERE id = ?', [JSON.stringify(details), totalAmount, order.id]);
        await tx.run('DELETE FROM bar_ticket_lines WHERE request_id = ?', [order.id]);
        for (const line of details) await tx.run("INSERT INTO bar_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, unit_price, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", [makeId('btl'), order.id, line.itemId, line.name, line.quantity, line.price]);
        await saveAudit(tx, req.actor, 'Bar Siparişi Düzenlendi', `${order.target_identifier}: ${totalAmount.toFixed(2)} TL`);
      });
      const payload = { id: order.id, target_identifier: order.target_identifier, status: 'pending', details, total_amount: totalAmount };
      broadcastSSE(req.tenantId, 'bar_order_updated', payload);
      broadcastSSE(req.tenantId, 'request_updated', payload);
      res.json({ success: true, order: payload });
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });

  app.post('/api/bar/orders/:id/cancel', async (req, res) => {
    if (!barGuard(req, res)) return;
    try {
      const order = await req.db.get("SELECT * FROM requests WHERE id = ? AND type = 'order' AND (department = 'Bar' OR departments LIKE '%Bar%')", [req.params.id]);
      if (!order) return res.status(404).json({ error: 'Bar siparişi bulunamadı.' });
      const kitchenLines = await req.db.get('SELECT COUNT(*) AS count FROM kitchen_ticket_lines WHERE request_id = ?', [order.id]);
      if (Number(kitchenLines?.count || 0)) return res.status(409).json({ error: 'Mutfak kalemi içeren karma sipariş restoran ekranından iptal edilmelidir.' });
      if (!['pending', 'accepted', 'preparing', 'ready'].includes(order.status)) return res.status(409).json({ error: 'Teslim edilmiş veya tamamlanmış sipariş iptal edilemez.' });
      const details = JSON.parse(order.details || '[]');
      const recipes = await req.db.all("SELECT r.* FROM recipes r JOIN inventory i ON i.id = r.inventory_id WHERE i.module_type = 'bar'");
      const returns = {};
      const restoreMarker = `log_stock_restore_request_${order.id}`;
      const alreadyRestored = await req.db.get('SELECT id FROM audit_logs WHERE id = ?', [restoreMarker]);
      let tableNumber = null, tableStatus = null;
      await req.db.transaction(async tx => {
        if (!alreadyRestored) {
          for (const line of details) for (const recipe of recipes.filter(row => row.catalog_item_id === line.itemId)) returns[recipe.inventory_id] = (returns[recipe.inventory_id] || 0) + Number(recipe.amount_needed) * Number(line.quantity) * 1.06;
          for (const [inventoryId, amount] of Object.entries(returns)) {
            await tx.run('UPDATE inventory SET stock = stock + ? WHERE id = ?', [amount, inventoryId], {
              undoSql: 'UPDATE inventory SET stock = stock - ? WHERE id = ?', undoParams: [amount, inventoryId]
            });
          }
          await tx.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Stok İade', ?)", [restoreMarker, req.actor?.name || 'Bar', `Sipariş iptali: ${order.id}`], {
            undoSql: 'DELETE FROM audit_logs WHERE id = ?', undoParams: [restoreMarker]
          });
        }
        await tx.run("UPDATE requests SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ?", [req.actor?.name || 'Bar', order.id], {
          undoSql: 'UPDATE requests SET status = ? WHERE id = ?', undoParams: [order.status, order.id]
        });
        await tx.run("UPDATE bar_ticket_lines SET status = 'cancelled', completed_by = ? WHERE request_id = ? AND status NOT IN ('served', 'completed', 'cancelled', 'rejected')", [req.actor?.name || 'Bar', order.id]);
        if (order.target_identifier.startsWith('Table-')) {
          tableNumber = order.target_identifier.slice(6);
          const active = await tx.get("SELECT COUNT(*) AS count FROM requests WHERE target_identifier = ? AND type = 'order' AND id <> ? AND status NOT IN ('completed', 'served', 'cancelled', 'rejected', 'paid')", [order.target_identifier, order.id]);
          tableStatus = Number(active?.count || 0) ? 'occupied' : 'empty';
          await tx.run('UPDATE tables SET status = ? WHERE table_number = ?', [tableStatus, tableNumber]);
        }
        await saveAudit(tx, req.actor, 'Bar Sipariş İptali', `${order.target_identifier}: ${Number(order.total_amount).toFixed(2)} TL`);
      });
      if (order.payment_method === 'room_charge') await eventBus.emit('room_charge_reversal_request', { tenantId: req.tenantId, targetIdentifier: order.target_identifier, amount: Number(order.total_amount), requestId: order.id, createdBy: req.actor?.name || 'Bar', department: 'Bar' });
      if (tableNumber) broadcastSSE(req.tenantId, 'table_updated', { tableNumber, status: tableStatus });
      const payload = { id: order.id, status: 'cancelled', target_identifier: order.target_identifier };
      broadcastSSE(req.tenantId, 'bar_order_updated', payload);
      broadcastSSE(req.tenantId, 'request_updated', payload);
      await eventBus.emit('staff_push', { tenantId: req.tenantId, targetRoles: [], targetDepartments: ['Bar', 'Restaurant'], payload: { title: 'Bar Siparişi İptal Edildi', body: `${order.target_identifier} siparişi iptal edildi.`, url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}&inbox=orders`, tag: `${order.id}-cancelled`, requestId: order.id, type: 'bar_order_cancelled', target_identifier: order.target_identifier } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
