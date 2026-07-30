import { managementGuard, makeId, saveAudit, validImageUrl } from './helpers.js';

export function registerMenuRoutes({ app, broadcastSSE }) {
  app.post('/api/bar/menu', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const name = String(req.body?.name || '').trim();
    const price = Number(req.body?.price);
    const barCategory = String(req.body?.bar_category || 'Genel').trim() || 'Genel';
    const description = String(req.body?.description || '').trim();
    const imageUrl = String(req.body?.image_url || '').trim();
    const active = req.body?.in_stock === true || req.body?.in_stock === 1 || req.body?.in_stock === 'true';
    if (!name || !Number.isFinite(price) || price < 0 || !validImageUrl(imageUrl)) return res.status(400).json({ error: 'Ürün adı, fiyat ve fotoğraf bağlantısı geçerli olmalıdır.' });
    try {
      const id = makeId('bar_menu');
      await req.db.run("INSERT INTO catalog_items (id, name, price, category, module_type, in_stock, image_url, bar_category, description) VALUES (?, ?, ?, 'drink', 'dining', ?, ?, ?, ?)", [id, name, price, active ? 1 : 0, imageUrl, barCategory, description]);
      await saveAudit(req.db, req.actor, 'Bar Menü Tanımı', name);
      broadcastSSE(req.tenantId, 'bar_menu_updated', { id });
      res.status(201).json({ success: true, id, message: active ? 'Ürün ortak içecek menüsünde satışa açıldı.' : 'Ürün ortak içecek menüsüne pasif olarak kaydedildi.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/bar/menu/:id', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const name = String(req.body?.name || '').trim();
    const price = Number(req.body?.price);
    const barCategory = String(req.body?.bar_category || 'Genel').trim() || 'Genel';
    const description = String(req.body?.description || '').trim();
    const imageUrl = String(req.body?.image_url || '').trim();
    const active = req.body?.in_stock === true || req.body?.in_stock === 1 || req.body?.in_stock === 'true';
    if (!name || !Number.isFinite(price) || price < 0 || !validImageUrl(imageUrl)) return res.status(400).json({ error: 'Ürün bilgileri geçersiz.' });
    try {
      const product = await req.db.get("SELECT id FROM catalog_items WHERE id = ? AND category = 'drink'", [req.params.id]);
      if (!product) return res.status(404).json({ error: 'Bar ürünü bulunamadı.' });
      await req.db.run('UPDATE catalog_items SET name = ?, price = ?, image_url = ?, bar_category = ?, description = ?, in_stock = ? WHERE id = ?', [name, price, imageUrl, barCategory, description, active ? 1 : 0, product.id]);
      await saveAudit(req.db, req.actor, 'Bar Menü Güncelleme', name);
      broadcastSSE(req.tenantId, 'bar_menu_updated', { id: product.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/bar/menu/:id', async (req, res) => {
    if (!managementGuard(req, res)) return;
    try {
      const result = await req.db.run("UPDATE catalog_items SET in_stock = 0 WHERE id = ? AND category = 'drink'", [req.params.id]);
      if (!result.changes) return res.status(404).json({ error: 'Bar ürünü bulunamadı.' });
      await saveAudit(req.db, req.actor, 'Bar Menüden Kaldırma', req.params.id);
      broadcastSSE(req.tenantId, 'bar_menu_updated', { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/bar/menu/:id/recipes', async (req, res) => {
    if (!managementGuard(req, res)) return;
    const ingredients = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
    if (ingredients.length > 20) return res.status(400).json({ error: 'Reçete en fazla yirmi stok kalemi içermelidir.' });
    try {
      const product = await req.db.get("SELECT id, name FROM catalog_items WHERE id = ? AND category = 'drink'", [req.params.id]);
      if (!product) return res.status(404).json({ error: 'Bar ürünü bulunamadı.' });
      const normalized = [];
      for (const ingredient of ingredients) {
        const inventoryId = String(ingredient?.inventory_id || '');
        const amount = Number(ingredient?.amount_needed);
        const stock = await req.db.get("SELECT id FROM inventory WHERE id = ? AND module_type = 'bar'", [inventoryId]);
        if (!stock || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Reçete stok kalemi ve miktarı geçersiz.' });
        if (!normalized.some(row => row.inventoryId === inventoryId)) normalized.push({ inventoryId, amount });
      }
      await req.db.run("DELETE FROM recipes WHERE catalog_item_id = ? AND inventory_id IN (SELECT id FROM inventory WHERE module_type = 'bar')", [product.id]);
      for (const ingredient of normalized) await req.db.run('INSERT INTO recipes (id, catalog_item_id, inventory_id, amount_needed) VALUES (?, ?, ?, ?)', [makeId('bar_recipe'), product.id, ingredient.inventoryId, ingredient.amount]);
      await saveAudit(req.db, req.actor, 'Bar Reçete Güncelleme', product.name);
      broadcastSSE(req.tenantId, 'bar_menu_updated', { id: product.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
