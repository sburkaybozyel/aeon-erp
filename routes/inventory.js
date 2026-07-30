import { tenantDbResolver } from '../server-middleware.js';

// Inventory & menu management endpoints, extracted verbatim from server.js — no behavior change.
export function registerInventoryRoutes(app) {
  app.post('/api/inventory/receipt', async (req, res) => {
    const { receipt_number, vendor, total_amount, items, created_by } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'En az bir kalem gereklidir.' });
    for (const item of items) {
      const quantity = Number(item?.quantity);
      const unitPrice = Number(item?.unit_price);
      if (!item?.inventory_id || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Her kalem geçerli bir stok kimliği ve pozitif miktar içermelidir.' });
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ error: 'Birim fiyat negatif olamaz.' });
      }
    }
    const receipt_id = 'rec_' + Date.now() + Math.random().toString(36).substring(7);
    const actorName = req.actor?.name || created_by || 'Unknown';
    try {
      await req.db.transaction(async tx => {
        await tx.run(`INSERT INTO inventory_receipts (id, receipt_number, vendor, total_amount, created_by) VALUES (?, ?, ?, ?, ?)`,
          [receipt_id, receipt_number, vendor, total_amount, actorName], { undoSql: 'DELETE FROM inventory_receipts WHERE id = ?', undoParams: [receipt_id] });

        for (const item of items) {
          const item_id = 'reci_' + Date.now() + Math.random().toString(36).substring(7);
          await tx.run(`INSERT INTO inventory_receipt_items (id, receipt_id, inventory_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
            [item_id, receipt_id, item.inventory_id, item.quantity, item.unit_price, item.total_price], { undoSql: 'DELETE FROM inventory_receipt_items WHERE id = ?', undoParams: [item_id] });
          // Update inventory stock
          await tx.run(`UPDATE inventory SET stock = stock + ? WHERE id = ?`, [item.quantity, item.inventory_id], { undoSql: 'UPDATE inventory SET stock = stock - ? WHERE id = ?', undoParams: [item.quantity, item.inventory_id] });
        }
        await tx.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Mal Kabul', ?)",
          [`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, actorName, `Fiş: ${receipt_number || receipt_id}, Tedarikçi: ${vendor || '-'}, Kalem: ${items.length}, Tutar: ${total_amount || 0} TL`]);
      });
      res.json({ success: true, receipt_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory/receipts', tenantDbResolver, async (req, res) => {
    try {
      const receipts = await req.db.all(`
        SELECT r.*, GROUP_CONCAT(ri.inventory_id || ':' || ri.quantity || ':' || ri.unit_price) as items_summary
        FROM inventory_receipts r
        LEFT JOIN inventory_receipt_items ri ON r.id = ri.receipt_id
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT 100
      `);
      res.json(receipts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/update', async (req, res) => {
    const { inventory_id, quantity_change } = req.body;
    const delta = Number(quantity_change);
    if (!inventory_id || !Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: 'Geçerli stok kimliği ve sıfırdan farklı miktar zorunludur.' });
    }
    try {
      const before = await req.db.get('SELECT name, stock FROM inventory WHERE id = ?', [inventory_id]);
      if (!before) return res.status(404).json({ error: 'Stok kalemi bulunamadı.' });
      await req.db.transaction(async tx => {
        await tx.run(`UPDATE inventory SET stock = stock + ? WHERE id = ?`, [delta, inventory_id], {
          undoSql: 'UPDATE inventory SET stock = stock - ? WHERE id = ?', undoParams: [delta, inventory_id]
        });
        await tx.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Stok Manuel Düzeltme', ?)",
          [`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, req.actor?.name || 'Yönetici', `${before.name}: ${before.stock} -> ${Number(before.stock) + delta} (${delta > 0 ? '+' : ''}${delta})`]);
        // Auto-sync menu availability after stock change
        const recipes = await tx.all('SELECT catalog_item_id, inventory_id, amount_needed FROM recipes');
        const inventory = await tx.all('SELECT id, stock FROM inventory');
        const invMap = Object.fromEntries(inventory.map(i => [i.id, i]));
        const recipeMap = {};
        for (const r of recipes) {
          if (!recipeMap[r.catalog_item_id]) recipeMap[r.catalog_item_id] = [];
          recipeMap[r.catalog_item_id].push(r);
        }
        for (const [catId, recs] of Object.entries(recipeMap)) {
          const canProduce = recs.every(r => { const inv = invMap[r.inventory_id]; return inv && Number(inv.stock || 0) >= r.amount_needed; });
          await tx.run('UPDATE catalog_items SET in_stock = ? WHERE id = ?', [canProduce ? 1 : 0, catId]);
        }
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/catalog/toggle', async (req, res) => {
    const { catalog_id, in_stock } = req.body;
    try {
      const item = await req.db.get('SELECT name, in_stock FROM catalog_items WHERE id = ?', [catalog_id]);
      if (!item) return res.status(404).json({ error: 'Ürün bulunamadı.' });
      await req.db.transaction(async tx => {
        await tx.run(`UPDATE catalog_items SET in_stock = ? WHERE id = ?`, [in_stock ? 1 : 0, catalog_id], {
          undoSql: 'UPDATE catalog_items SET in_stock = ? WHERE id = ?', undoParams: [item.in_stock, catalog_id]
        });
        await tx.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, 'Katalog Durum Değişikliği', ?)",
          [`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, req.actor?.name || 'Yönetici', `${item.name}: ${in_stock ? 'satışa açıldı' : 'satıştan kaldırıldı (86)'}`]);
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
