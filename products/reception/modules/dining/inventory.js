import { syncMenuAvailability } from './menu.js';

const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';

export function initInventory({ app }) {
  app.get('/api/inventory', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled for this deployment.' });
    try {
      const inventory = await req.db.all("SELECT * FROM inventory");
      res.json(inventory);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/audit', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory audits are disabled for this deployment.' });
    const { staffId, inventoryId, physicalAmount, staff_name } = req.body;
    const staffName = req.actor?.name || staff_name || staffId || 'Barmen / Sayım Sorumlusu';
    try {
      const inv = await req.db.get("SELECT * FROM inventory WHERE id = ?", [inventoryId]);
      if (!inv) return res.status(404).json({ error: 'Inventory item not found' });

      const expectedAmount = inv.stock;
      const variance = physicalAmount - expectedAmount;
      const auditId = 'aud_' + Math.random().toString(36).substr(2, 9);

      await req.db.run(
        "INSERT INTO bar_blind_audits (id, staff_id, inventory_id, expected_amount, physical_amount, variance) VALUES (?, ?, ?, ?, ?, ?)",
        [auditId, staffId || 'staff_system', inventoryId, expectedAmount, physicalAmount, variance]
      );

      await req.db.run("UPDATE inventory SET stock = ? WHERE id = ?", [physicalAmount, inventoryId]);

      // Log action
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staffName, 'Kör Sayım / Envanter Ayarı', `Malzeme: ${inv.name}, Fiziksel: ${physicalAmount}, Beklenen: ${expectedAmount}, Fark: ${variance}`]
      );

      res.json({ success: true, variance, expectedAmount, physicalAmount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory/audits', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory audits are disabled for this deployment.' });
    try {
      const audits = await req.db.all(`
        SELECT a.*, i.name as inventory_name, i.unit 
        FROM bar_blind_audits a
        JOIN inventory i ON a.inventory_id = i.id
        ORDER BY a.created_at DESC
      `);
      res.json(audits);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/movement', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory movements are disabled for this deployment.' });
    const { inventoryId, type, quantity, reason, staff_name } = req.body;
    const staff = req.actor?.name || staff_name || 'Depo Sorumlusu';
    try {
      const inv = await req.db.get("SELECT * FROM inventory WHERE id = ?", [inventoryId]);
      if (!inv) return res.status(404).json({ error: 'Inventory item not found' });

      const currentStock = inv.stock;
      const change = parseFloat(quantity);
      
      // Both out and waste subtract from stock
      const newStock = type === 'in' ? currentStock + change : currentStock - change;

      if (newStock < 0) {
        return res.status(400).json({ error: 'Depoda yeterli stok yok!' });
      }

      await req.db.run("UPDATE inventory SET stock = ? WHERE id = ?", [newStock, inventoryId]);

      // Log action
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      const actionText = type === 'in' ? 'Stok Girişi (+)' : (type === 'waste' ? 'Zayiat / Kayıp Stoğu (-)' : 'Stok Çıkışı (-)');
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff, actionText, `Malzeme: ${inv.name}, Miktar: ${change} ${inv.unit}, Eski: ${currentStock}, Yeni: ${newStock}${reason ? `, Neden: ${reason}` : ''}`]
      );

      await syncMenuAvailability(req.db);
      res.json({ success: true, newStock });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled for this deployment.' });
    const { name, unit, stock, par_level, unit_cost, module_type, purchase_unit, purchase_unit_amount } = req.body;
    try {
      const id = 'inv_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type, purchase_unit, purchase_unit_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, unit, parseFloat(stock) || 0, parseFloat(par_level) || 0, parseFloat(unit_cost) || 0, module_type || 'bar', purchase_unit || '', parseFloat(purchase_unit_amount) || 0]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled for this deployment.' });
    const invId = req.params.id;
    try {
      await req.db.run("DELETE FROM inventory WHERE id = ?", [invId]);
      await req.db.run("DELETE FROM recipes WHERE inventory_id = ?", [invId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add stock using purchase units (e.g., 3 packets = 3 * 500g = 1500g)
  app.post('/api/inventory/add-stock', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled.' });
    const { inventory_id, purchase_quantity, staff_name } = req.body;
    const staff = req.actor?.name || staff_name || 'Mutfak Personeli';
    try {
      const inv = await req.db.get('SELECT * FROM inventory WHERE id = ?', [inventory_id]);
      if (!inv) return res.status(404).json({ error: 'Envanter kalemi bulunamadı.' });

      const purchaseUnitAmount = Number(inv.purchase_unit_amount) || 1;
      const addAmount = Number(purchase_quantity) * purchaseUnitAmount;

      if (!Number.isFinite(addAmount) || addAmount <= 0) {
        return res.status(400).json({ error: 'Geçerli miktar girin.' });
      }

      const oldStock = Number(inv.stock || 0);
      const newStock = oldStock + addAmount;
      await req.db.run('UPDATE inventory SET stock = ? WHERE id = ?', [newStock, inventory_id]);

      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      const purchaseLabel = inv.purchase_unit || inv.unit;
      await req.db.run(
        'INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)',
        [logId, staff, 'Stok Girişi (Ambalaj)', `${inv.name}: +${purchase_quantity} ${purchaseLabel} (${addAmount} ${inv.unit}), Eski: ${oldStock}, Yeni: ${newStock}`]
      );

      await syncMenuAvailability(req.db);
      res.json({ success: true, newStock, addedBaseUnits: addAmount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/fill-stock', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled.' });
    const role = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
    if (!['kitchen', 'chef', 'mutfak', 'admin', 'manager', 'yönetici'].includes(role)) return res.status(403).json({ error: 'Bu işlem için mutfak veya yönetici yetkisi gerekir.' });
    const targetStock = Number(req.body?.target_stock);
    if (!Number.isFinite(targetStock) || targetStock <= 0 || targetStock > 1000000) return res.status(400).json({ error: 'Geçerli hedef stok girin.' });
    try {
      const items = await req.db.all('SELECT id, name, stock, unit FROM inventory WHERE stock < ?', [targetStock]);
      await req.db.transaction(async tx => {
        for (const item of items) await tx.run('UPDATE inventory SET stock = ? WHERE id = ?', [targetStock, item.id], { undoSql: 'UPDATE inventory SET stock = ? WHERE id = ?', undoParams: [item.stock, item.id] });
        const logId = 'log_' + Math.random().toString(36).substr(2, 9);
        await tx.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', [logId, req.actor?.name || 'Mutfak', 'Toplu Stok Tamamlama', `${items.length} kalem en az ${targetStock} birime tamamlandı.`], { undoSql: 'DELETE FROM audit_logs WHERE id = ?', undoParams: [logId] });
      });
      await syncMenuAvailability(req.db);
      res.json({ success: true, updatedCount: items.length, targetStock });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update inventory item details (name, par_level, purchase_unit, etc.)
  app.put('/api/inventory/:id', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Inventory management is disabled.' });
    const invId = req.params.id;
    const { name, stock, par_level, unit_cost, purchase_unit, purchase_unit_amount } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(String(name)); }
    if (stock !== undefined) { fields.push('stock = ?'); values.push(Number(stock) || 0); }
    if (par_level !== undefined) { fields.push('par_level = ?'); values.push(Number(par_level) || 0); }
    if (unit_cost !== undefined) { fields.push('unit_cost = ?'); values.push(Number(unit_cost) || 0); }
    if (purchase_unit !== undefined) { fields.push('purchase_unit = ?'); values.push(String(purchase_unit)); }
    if (purchase_unit_amount !== undefined) { fields.push('purchase_unit_amount = ?'); values.push(Number(purchase_unit_amount) || 0); }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    try {
      values.push(invId);
      await req.db.run(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`, values);
      const item = await req.db.get('SELECT * FROM inventory WHERE id = ?', [invId]);
      if (!item) return res.status(404).json({ error: 'Envanter kalemi bulunamadı.' });
      await syncMenuAvailability(req.db);
      res.json({ success: true, item });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/purchase_requests', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Purchase tracking is disabled for this deployment.' });
    try {
      // Excludes Technical's requests (modules/stay/maintenance.js tags those 'Technical') —
      // this endpoint is used by the kitchen screen for its own purchasing list, which
      // previously showed every department's requests mixed together with no way to tell
      // them apart.
      const prs = await req.db.all("SELECT * FROM purchase_requests WHERE department <> 'Technical' ORDER BY created_at DESC");
      res.json(prs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/purchase_requests', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Purchase tracking is disabled for this deployment.' });
    const { item_name, quantity, requested_by } = req.body;
    try {
      const id = 'pr_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO purchase_requests (id, item_name, quantity, status, requested_by, department) VALUES (?, ?, ?, 'Pending', ?, 'Kitchen')",
        [id, item_name, parseFloat(quantity) || 0, requested_by || 'Unknown']
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/purchase_requests/status', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Purchase tracking is disabled for this deployment.' });
    const { id, status } = req.body;
    try {
      await req.db.run("UPDATE purchase_requests SET status = ? WHERE id = ?", [status, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
