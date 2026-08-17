import path from 'path';
import fs from 'fs';
import os from 'os';
import { hasD1Persistence } from '../db.js';
import { isManagementRole, hasDurablePersistence } from '../server-middleware.js';
import { __dirname, PORT, isCloudflareWorker } from '../server-config.js';

// Tenant config/branding/system-info routes, extracted verbatim from server.js — no behavior change.

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export function registerTenantRoutes(app) {
  app.get('/api/tenant/branding', (req, res) => {
    let tenantId = req.tenantId || req.query.tenant_id || 'restaurant_kitchen';
    if (Array.isArray(tenantId)) {
      tenantId = tenantId[0];
    }
    if (tenantId === 'default') tenantId = 'aeon';

    if (tenantId === (process.env.MODULE_DEFAULT_TENANT || 'restaurant_kitchen')) {
      return res.json({
        tenant_id: tenantId,
        name: process.env.MODULE_NAME || 'AEON Restaurant & Kitchen',
        logo: '/brands/aeon/logo.svg',
        primary_color: '#0891b2',
        accent_color: '#d4af37'
      });
    }

    // 1. Validate tenant ID to prevent path traversal
    if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
      return res.status(400).json({ error: 'Geçersiz tenant kimliği.' });
    }

    // 2. Resolve only under public/brands/
    const brandingFile = path.join(__dirname, 'public', 'brands', tenantId, 'branding.json');
    if (fs.existsSync(brandingFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
        return res.json({
          tenant_id: tenantId,
          name: data.name || 'Aeon ERP',
          logo: data.logo || `/brands/${tenantId}/logo.svg`,
          primary_color: data.primary_color || '#0891b2',
          accent_color: data.accent_color || '#d4af37'
        });
      } catch (e) {
        console.error('Error reading branding file:', e);
      }
    }

    // 3. Reject unknown tenants with 404 tenant_not_found (no default fallback)
    res.status(404).json({ error: 'tenant_not_found' });
  });



  app.get('/api/tenant/config', async (req, res) => {
    try {
      const configRows = await req.db.all("SELECT * FROM config");
      const config = {};
      configRows.forEach(row => {
        config[row.key] = row.value;
      });
      try {
        config.hotel_profile = config.HOTEL_PROFILE ? JSON.parse(config.HOTEL_PROFILE) : {};
      } catch {
        config.hotel_profile = {};
      }
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reception/hotel-profile', async (req, res) => {
    try {
      const row = await req.db.get("SELECT value FROM config WHERE key = 'HOTEL_PROFILE'");
      let hotel_profile = {};
      try {
        hotel_profile = row?.value ? JSON.parse(row.value) : {};
      } catch {
        hotel_profile = {};
      }
      res.json({ hotel_profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/persistence', (req, res) => {
    res.json({
      customer: req.tenantId,
      mode: hasD1Persistence() ? 'cloudflare-d1' : (isCloudflareWorker ? 'filesystem-ephemeral' : 'local-file'),
      durable: hasDurablePersistence() || !isCloudflareWorker,
      warning: hasDurablePersistence() || !isCloudflareWorker
        ? null
        : 'Cloudflare Workers üzerinde kalıcı veri deposu yapılandırılmadı.'
    });
  });

  app.get('/api/system/build', (req, res) => {
    res.json({
      build: process.env.AEON_BUILD_ID || 'local',
      deployed_at: null,
      environment: isCloudflareWorker ? 'cloudflare-workers' : 'local'
    });
  });

  app.get('/api/system/health', async (req, res) => {
    try {
      const [roomCount, tableCount, catalogCount] = await Promise.all([
        req.db.get('SELECT COUNT(*) AS cnt FROM rooms'),
        req.db.get('SELECT COUNT(*) AS cnt FROM tables'),
        req.db.get('SELECT COUNT(*) AS cnt FROM catalog_items')
      ]);
      res.json({
        ok: true,
        runtime: isCloudflareWorker ? 'cloudflare-workers' : 'local',
        tenant: req.tenantId,
        module: process.env.MODULE_ID || 'independent-module',
        databases: {
          primary: {
            durable: hasD1Persistence() || hasDurablePersistence(),
            rooms: Number(roomCount?.cnt || 0),
            tables: Number(tableCount?.cnt || 0),
            catalog_items: Number(catalogCount?.cnt || 0)
          }
        },
        bridges: {
          printing: { configured: Boolean(process.env.AEON_PRINT_BRIDGE_KEY) }
        },
        build: process.env.MODULE_BUILD_ID || 'local'
      });
    } catch (error) {
      res.status(503).json({ error: error.message, ok: false });
    }
  });

  app.post('/api/tenant/config', async (req, res) => {
    if (!isManagementRole(req.actor)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
    const { MODULE_DINING, MODULE_STAY, MODULE_CRUISE, MODULE_PRINTER, hotel_profile } = req.body;
    try {
      const staff_name = req.actor?.name || 'Sistem / Yönetici';
      const changed = [];
      if (MODULE_DINING !== undefined) {
        await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_DINING'", [String(MODULE_DINING)]);
        changed.push('Restoran modülü');
      }
      if (MODULE_STAY !== undefined) {
        await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_STAY'", [String(MODULE_STAY)]);
        changed.push('Konaklama modülü');
      }
      if (MODULE_CRUISE !== undefined) {
        await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_CRUISE'", [String(MODULE_CRUISE)]);
        changed.push('Tur modülü');
      }
      if (MODULE_PRINTER !== undefined) {
        await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_PRINTER'", [String(MODULE_PRINTER)]);
        changed.push('Yazıcı ayarı');
      }
      if (hotel_profile !== undefined) {
        const limits = {
          hotel_name: 120,
          legal_name: 180,
          tax_number: 20,
          tax_office: 120,
          mersis_number: 32,
          address: 600,
          phone: 40,
          email: 160,
          invoice_prefix: 20,
          kbs_property_code: 80
        };
        const profile = {};
        Object.entries(limits).forEach(([key, limit]) => {
          profile[key] = String(hotel_profile?.[key] || '').trim().slice(0, limit);
        });
        await req.db.run("DELETE FROM config WHERE key = 'HOTEL_PROFILE'");
        await req.db.run("INSERT INTO config (key, value) VALUES ('HOTEL_PROFILE', ?)", [JSON.stringify(profile)]);
        changed.push('Otel profili');
      }
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name, 'Yönetici Ayarları Güncellendi', changed.join(', ') || 'Ayar kaydedildi']
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/info', (req, res) => {
    const ip = getLocalIpAddress();
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || '';
    res.json({
      ip,
      port: PORT,
      url: host ? `${protocol}://${host}` : `http://${ip}:${PORT}`
    });
  });
}
