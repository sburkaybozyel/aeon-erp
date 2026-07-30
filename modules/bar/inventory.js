import { barGuard, managementGuard, makeId, saveAudit } from './helpers.js';

export function registerInventoryRoutes({ app, broadcastSSE }) {
  app.post('/api/bar/audits', async (req, res) => {
    if (!barGuard(req, res)) return;
    const inventoryId = String(req.body?.inventory_id || '');
    const physicalAmount = Number(req.body?.physical_amount);
    if (!inventoryId || !Number.isFinite(physicalAmount) || physicalAmount < 0) return res.status(400).json({ error: 'Bar kalemi ve fiziksel sayım zorunludur.' });
    try {
      const item = await req.db.get("SELECT * FROM inventory WHERE id = ? AND module_type = 'bar'", [inventoryId]);
      if (!item) return res.status(404).json({ error: 'Bar stok kalemi bulunamadı.' });
      const id = makeId('bar_audit');
      const variance = physicalAmount - Number(item.stock);
      await req.db.run('INSERT INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance) VALUES (?, ?, ?, ?, ?, ?)', [id, req.actor?.id || 'bar_staff', inventoryId, item.stock, physicalAmount, variance]);
      await req.db.run('UPDATE inventory SET stock = ? WHERE id = ?', [physicalAmount, inventoryId]);
      await saveAudit(req.db, req.actor, 'Bar Kör Sayım', `${item.name}: fark ${variance} ${item.unit}`);
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId, stock: physicalAmount, variance });
      res.status(201).json({ success: true, variance, stock: physicalAmount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bar/inventory/receipts', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const inventoryId = String(req.body?.inventory_id || '');
    const quantity = Number(req.body?.quantity);
    const unitPrice = Number(req.body?.unit_price);
    const vendor = String(req.body?.vendor || '').trim();
    const receiptNumber = String(req.body?.receipt_number || '').trim();
    if (!inventoryId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'Stok kalemi, giriş miktarı ve birim maliyet geçerli olmalıdır.' });
    try {
      const item = await req.db.get("SELECT * FROM inventory WHERE id = ? AND module_type = 'bar'", [inventoryId]);
      if (!item) return res.status(404).json({ error: 'Bar stok kalemi bulunamadı.' });
      const previousStock = Number(item.stock || 0);
      const nextStock = previousStock + quantity;
      const nextCost = nextStock ? ((previousStock * Number(item.unit_cost || 0)) + (quantity * unitPrice)) / nextStock : unitPrice;
      const receiptId = makeId('bar_receipt');
      const total = quantity * unitPrice;
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO inventory_receipts (id, receipt_number, vendor, total_amount, created_by) VALUES (?, ?, ?, ?, ?)', [receiptId, receiptNumber || receiptId, vendor || 'Belirtilmedi', total, req.actor?.name || 'Bar'], {
          undoSql: 'DELETE FROM inventory_receipts WHERE id = ?', undoParams: [receiptId]
        });
        await tx.run('INSERT INTO inventory_receipt_items (id, receipt_id, inventory_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)', [makeId('bar_receipt_item'), receiptId, inventoryId, quantity, unitPrice, total]);
        await tx.run('UPDATE inventory SET stock = ?, unit_cost = ? WHERE id = ?', [nextStock, nextCost, inventoryId], {
          undoSql: 'UPDATE inventory SET stock = ?, unit_cost = ? WHERE id = ?', undoParams: [previousStock, item.unit_cost, inventoryId]
        });
        await saveAudit(tx, req.actor, 'Bar Stok Girişi', `${item.name}: +${quantity} ${item.unit}${vendor ? ` · ${vendor}` : ''}${receiptNumber ? ` · ${receiptNumber}` : ''}`);
      });
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId, stock: nextStock, quantity, unit_cost: nextCost });
      res.status(201).json({ success: true, stock: nextStock, unit_cost: nextCost, receipt_id: receiptId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bar/inventory/:id/waste', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const quantity = Number(req.body?.quantity);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isFinite(quantity) || quantity <= 0 || !reason) return res.status(400).json({ error: 'Zayiat miktarı ve nedeni zorunludur.' });
    try {
      const item = await req.db.get("SELECT * FROM inventory WHERE id = ? AND module_type = 'bar'", [req.params.id]);
      if (!item) return res.status(404).json({ error: 'Bar stok kalemi bulunamadı.' });
      if (quantity > Number(item.stock || 0)) return res.status(409).json({ error: 'Zayiat mevcut stoktan fazla olamaz.' });
      const stock = Number(item.stock) - quantity;
      await req.db.run('UPDATE inventory SET stock = ? WHERE id = ?', [stock, item.id]);
      await saveAudit(req.db, req.actor, 'Bar Stok Zayiatı', `${item.name}: -${quantity} ${item.unit} · ${reason}`);
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId: item.id, stock, quantity: -quantity });
      res.json({ success: true, stock });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bar/inventory', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const name = String(req.body?.name || '').trim();
    const unit = String(req.body?.unit || '').trim();
    const stock = Number(req.body?.stock);
    const parLevel = Number(req.body?.par_level);
    const unitCost = Number(req.body?.unit_cost || 0);
    if (!name || !unit || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(parLevel) || parLevel < 0 || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: 'Stok adı, birim, miktar, kritik seviye ve maliyet geçerli olmalıdır.' });
    try {
      const id = makeId('bar_stock');
      await req.db.run("INSERT INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type) VALUES (?, ?, ?, ?, ?, ?, 'bar')", [id, name, unit, stock, parLevel, unitCost]);
      await saveAudit(req.db, req.actor, 'Bar Stok Tanımı', name);
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId: id, stock });
      res.status(201).json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/bar/inventory/:id', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const name = String(req.body?.name || '').trim();
    const unit = String(req.body?.unit || '').trim();
    const stock = Number(req.body?.stock);
    const parLevel = Number(req.body?.par_level);
    const unitCost = Number(req.body?.unit_cost || 0);
    if (!name || !unit || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(parLevel) || parLevel < 0 || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: 'Stok bilgileri geçersiz.' });
    try {
      const result = await req.db.run("UPDATE inventory SET name = ?, unit = ?, stock = ?, par_level = ?, unit_cost = ? WHERE id = ? AND module_type = 'bar'", [name, unit, stock, parLevel, unitCost, req.params.id]);
      if (!result.changes) return res.status(404).json({ error: 'Bar stok kalemi bulunamadı.' });
      await saveAudit(req.db, req.actor, 'Bar Stok Güncelleme', name);
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId: req.params.id, stock });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/bar/inventory/:id', async (req, res) => {
    if (!managementGuard(req, res)) return;
    try {
      const linked = await req.db.get('SELECT COUNT(*) AS cnt FROM recipes WHERE inventory_id = ?', [req.params.id]);
      if (Number(linked?.cnt || 0) > 0) return res.status(409).json({ error: 'Bu stok kalemi reçetelerde kullanılıyor. Önce reçete bağlantılarını kaldırın.' });
      const result = await req.db.run("DELETE FROM inventory WHERE id = ? AND module_type = 'bar'", [req.params.id]);
      if (!result.changes) return res.status(404).json({ error: 'Bar stok kalemi bulunamadı.' });
      await saveAudit(req.db, req.actor, 'Bar Stok Silme', req.params.id);
      broadcastSSE(req.tenantId, 'bar_inventory_updated', { inventoryId: req.params.id, deleted: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
