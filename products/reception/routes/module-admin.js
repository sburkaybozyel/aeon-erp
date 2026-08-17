async function ensureBridgeTables(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS module_bridge_events (event_id TEXT PRIMARY KEY, source_system TEXT NOT NULL, source_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.run(`CREATE TABLE IF NOT EXISTS dining_order_mirrors (source_id TEXT PRIMARY KEY, source_system TEXT NOT NULL, target_identifier TEXT NOT NULL, status TEXT NOT NULL, total_amount REAL DEFAULT 0, payment_method TEXT, details TEXT, departments TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
}

async function fetchModule(service, url, headers) {
  if (!service && !url) return { available: false, error: 'Servis bağlantısı yapılandırılmamış.' };
  try {
    const response = service ? await service.fetch(new Request(url, { headers })) : await fetch(url, { headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { available: false, error: body.error || `Servis HTTP ${response.status}` };
    return { available: true, ...body };
  } catch (error) {
    return { available: false, error: error.message || 'Servis yanıt vermedi.' };
  }
}

export function registerModuleAdminRoutes(app) {
  app.get('/api/admin/hub/overview', async (req, res) => {
    try {
      await ensureBridgeTables(req.db);
      const [rooms, reservations, stays, precheckins, requests, folios, mirrors, bridgeEvents, recentRequests, restaurant, crm] = await Promise.all([
        req.db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied, SUM(CASE WHEN status = 'clean_vacant' THEN 1 ELSE 0 END) AS clean_vacant, SUM(CASE WHEN status IN ('dirty_vacant', 'cleaning') THEN 1 ELSE 0 END) AS turnover FROM rooms"),
        req.db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('confirmed', 'guaranteed', 'option') THEN 1 ELSE 0 END) AS active FROM reservations"),
        req.db.get("SELECT COUNT(*) AS active FROM stays WHERE status = 'checked_in'"),
        req.db.get("SELECT (SELECT COUNT(*) FROM guest_precheckin_submissions WHERE status IN ('submitted', 'reviewed')) + (SELECT COUNT(*) FROM guest_precheckins WHERE status IN ('submitted', 'reviewed')) AS pending"),
        req.db.get("SELECT SUM(CASE WHEN status NOT IN ('completed', 'paid', 'cancelled', 'rejected', 'resolved') THEN 1 ELSE 0 END) AS open FROM requests"),
        req.db.get("SELECT SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open FROM folios"),
        req.db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status NOT IN ('completed', 'paid', 'cancelled', 'rejected') THEN 1 ELSE 0 END) AS open FROM dining_order_mirrors"),
        req.db.get("SELECT COUNT(*) AS total FROM module_bridge_events"),
        req.db.all("SELECT id, type, status, target_identifier, total_amount, payment_method, created_at FROM requests ORDER BY created_at DESC LIMIT 12"),
        fetchModule(globalThis.__RESTAURANT_SERVICE, `${String(process.env.RESTAURANT_MODULE_URL || '').replace(/\/$/, '')}/api/module/admin/overview`, { 'x-aeon-module-token': String(process.env.RECEPTION_MODULE_TOKEN || '') }),
        fetchModule(globalThis.__CRM_SERVICE, 'https://aeon-crm.internal/api/module/admin/overview', { 'x-aeon-crm-admin-token': String(process.env.CRM_ADMIN_TOKEN || '') })
      ]);
      res.json({
        success: true,
        generated_at: new Date().toISOString(),
        actor: { name: req.actor?.name, role: req.actor?.role, department: req.actor?.department },
        reception: { rooms, reservations, stays, precheckins, requests, folios, dining_mirror: mirrors, bridge_events: bridgeEvents },
        recent_requests: recentRequests,
        restaurant,
        crm,
        links: { reception: '/reception', precheckin: '/precheckin', restaurant: 'https://aeon-restaurant-kitchen.aeon-global.workers.dev/restaurant-staff', kitchen: 'https://aeon-restaurant-kitchen.aeon-global.workers.dev/kitchen', crm: 'https://aeon-crm.aeon-global.workers.dev/' }
      });
    } catch (error) {
      console.error('[module admin hub]', error);
      res.status(500).json({ error: 'Modül yönetici özeti oluşturulamadı.' });
    }
  });
}
