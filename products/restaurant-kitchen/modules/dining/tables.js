import { validateTerminalProduction, syncProductionTickets } from './production.js';

export async function refreshTableStatus(db, targetIdentifier) {
    if (!String(targetIdentifier || '').startsWith('Table-')) return null;
    const tableNumber = targetIdentifier.slice(6).trim();
    const [orders, billCalls, waiterCalls] = await Promise.all([
      db.get("SELECT COUNT(*) AS cnt FROM requests WHERE target_identifier = ? AND type = 'order' AND status NOT IN ('completed', 'paid', 'cancelled', 'rejected')", [targetIdentifier]),
      db.get("SELECT COUNT(*) AS cnt FROM requests WHERE target_identifier = ? AND type = 'bill_call' AND status NOT IN ('completed', 'cancelled', 'rejected')", [targetIdentifier]),
      db.get("SELECT COUNT(*) AS cnt FROM requests WHERE target_identifier = ? AND type = 'waiter_call' AND status NOT IN ('completed', 'cancelled', 'rejected')", [targetIdentifier])
    ]);
    const status = Number(billCalls?.cnt || 0) > 0 ? 'requested_bill' : Number(waiterCalls?.cnt || 0) > 0 ? 'requested_service' : Number(orders?.cnt || 0) > 0 ? 'occupied' : 'empty';
    await db.run('UPDATE tables SET status = ? WHERE table_number = ?', [status, tableNumber]);
    return { tableNumber, status };
}

export function initTables({ app, broadcastSSE }) {
  app.get('/api/tables', async (req, res) => {
    try {
      const tables = await req.db.all("SELECT * FROM tables ORDER BY table_number");
      res.json(tables);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tables/status', async (req, res) => {
    const { tableId, status } = req.body;
    try {
      await req.db.run("UPDATE tables SET status = ? WHERE id = ?", [status, tableId]);
      broadcastSSE && broadcastSSE(req.tenantId, 'table_updated', { tableId, status });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tables/settle', async (req, res) => {
    const { table_number, payment_method, completed_by } = req.body;
    const tableNumber = String(table_number || '').trim();
    if (!tableNumber) return res.status(400).json({ error: 'Masa numarası zorunludur.' });
    const requestedMethod = String(payment_method || 'cash');
    const method = requestedMethod === 'card' ? 'credit_card' : requestedMethod;
    if (!['cash', 'credit_card'].includes(method)) return res.status(400).json({ error: 'Masa ödemesinde nakit veya kredi kartı kullanılmalıdır; oda hesabına yazma kullanılamaz.' });
    let idempotencyId = '';
    try {
      const idempotencyKey = String(req.get('idempotency-key') || '').trim();
      idempotencyId = idempotencyKey ? `settle:${idempotencyKey}` : '';
      const requestFingerprint = JSON.stringify({ table_number: tableNumber, payment_method: method });
      if (idempotencyId) {
        const prior = await req.db.get("SELECT request_hash, response_json FROM idempotency_records WHERE id = ?", [idempotencyId]);
        if (prior?.request_hash && prior.request_hash !== requestFingerprint) return res.status(409).json({ error: 'Aynı idempotency anahtarı farklı bir ödeme talebiyle kullanılmış.' });
        if (prior && prior.response_json) return res.status(200).json(JSON.parse(prior.response_json));
        if (prior && !prior.response_json) return res.status(409).json({ error: 'Bu ödeme hâlâ işleniyor, lütfen kısa süre sonra tekrar deneyin.' });
        // Reserve the key immediately, before any of the read-then-act settlement logic below, so
        // two concurrent settle calls with the same key can't both pass the check above and both
        // proceed to settle the same table.
        await req.db.run("INSERT INTO idempotency_records (id, operation, request_hash, response_json) VALUES (?, ?, ?, NULL)", [idempotencyId, 'table.settle', requestFingerprint]);
      }
      const releaseReservation = () => idempotencyId
        ? req.db.run("DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", [idempotencyId]).catch(() => {})
        : Promise.resolve();

      const activeOrders = await req.db.all(
        "SELECT * FROM requests WHERE target_identifier = ? AND type = 'order' AND status NOT IN ('completed', 'paid', 'rejected', 'cancelled') ORDER BY created_at ASC",
        [`Table-${tableNumber}`]
      );
      if (!activeOrders.length) {
        await releaseReservation();
        return res.status(400).json({ error: 'Bu masa için aktif sipariş bulunamadı.' });
      }

      const staffName = req.actor?.name || completed_by || 'Restaurant';
      for (const order of activeOrders) {
        const production = await validateTerminalProduction(req.db, order);
        if (!production.valid) {
          await releaseReservation();
          return res.status(409).json({ error: `Sipariş ${order.id} için yemek ve içecek üretim biletleri eksik veya henüz hazır değil.` });
        }
      }
      const relatedCalls = await req.db.all(
        "SELECT id FROM requests WHERE target_identifier = ? AND type IN ('waiter_call', 'bill_call') AND status NOT IN ('completed', 'cancelled', 'rejected')",
        [`Table-${tableNumber}`]
      );
      const totalAmount = activeOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const response = { success: true, table_number: tableNumber, totalAmount, payment_method: method, requestIds: activeOrders.map(order => order.id), resolvedCallIds: relatedCalls.map(call => call.id) };
      await req.db.transaction(async tx => {
        for (const order of activeOrders) {
          await syncProductionTickets(tx, order.id, 'completed', staffName);
          await tx.run(
            "UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ?, payment_method = ? WHERE id = ?",
            [staffName, method, order.id],
            { undoSql: "UPDATE requests SET status = ? WHERE id = ?", undoParams: [order.status, order.id] }
          );
        }
        await tx.run(
          "UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE target_identifier = ? AND type IN ('waiter_call', 'bill_call') AND status NOT IN ('completed', 'cancelled', 'rejected')",
          [staffName, `Table-${tableNumber}`]
        );
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staffName, 'Table Payment Collected', `Table-${tableNumber}: ${totalAmount}, Payment: ${method}`]
        );
        if (idempotencyId) {
          await tx.run("UPDATE idempotency_records SET response_json = ? WHERE id = ?", [JSON.stringify(response), idempotencyId]);
        }
      });
      for (const order of activeOrders) broadcastSSE && broadcastSSE(req.tenantId, 'request_updated', { requestId: order.id, status: 'completed' });
      for (const call of relatedCalls) broadcastSSE && broadcastSSE(req.tenantId, 'request_updated', { requestId: call.id, status: 'completed' });
      const tableUpdate = await refreshTableStatus(req.db, `Table-${tableNumber}`);
      if (tableUpdate) broadcastSSE && broadcastSSE(req.tenantId, 'table_updated', tableUpdate);
      res.json(response);
    } catch (err) {
      if (idempotencyId) {
        await req.db.run("DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", [idempotencyId]).catch(() => {});
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tables', async (req, res) => {
    const { tableNumber, section, status } = req.body;
    const staff_name = req.actor?.name || 'Yönetici';
    try {
      const id = 't_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO tables (id, table_number, status, section) VALUES (?, ?, ?, ?)",
        [id, tableNumber, status || 'empty', section || 'Main']
      );

      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name, 'Masa Eklendi', `Masa No: ${tableNumber}, Bölüm: ${section || 'Main'}`]
      );

      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/tables/:id', async (req, res) => {
    const tableId = req.params.id;
    const staff_name = req.actor?.name || 'Yönetici';
    try {
      const table = await req.db.get("SELECT table_number, section FROM tables WHERE id = ?", [tableId]);
      await req.db.run("DELETE FROM tables WHERE id = ?", [tableId]);
      
      if (table) {
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await req.db.run(
          "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
          [logId, staff_name, 'Masa Silindi', `Masa No: ${table.table_number}, Bölüm: ${table.section}`]
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
