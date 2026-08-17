import crypto from 'crypto';

const bridgeAuthorized = req => {
  const expected = String(process.env.AEON_PRINT_BRIDGE_KEY || '');
  const supplied = String(req.get('x-aeon-print-key') || '');
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
};

const managementAllowed = actor => ['admin', 'manager', 'yönetici'].includes(String(actor?.role || '').toLocaleLowerCase('tr-TR'));

export function initPrinting({ app, eventBus, getDb, broadcastSSE }) {
  const enqueue = async ({ tenantId, station, requestId, payload }) => {
    const db = await getDb(tenantId || 'reception');
    const id = `prn_${crypto.randomUUID()}`;
    await db.run("INSERT INTO print_jobs (id, station, request_id, status, payload) VALUES (?, ?, ?, 'queued', ?)", [id, station, requestId, JSON.stringify(payload)]);
    broadcastSSE(tenantId || 'reception', 'print_job_queued', { id, station, request_id: requestId });
    return id;
  };

  eventBus.on('print_job_enqueue', async data => {
    try {
      await enqueue(data);
    } catch (error) {
      console.error('Print job enqueue failed:', error.message);
    }
  });

  app.post('/api/print-bridge/install-command', (req, res) => {
    if (!managementAllowed(req.actor)) return res.status(403).json({ error: 'Yazdırma köprüsü kurulumu yalnız yöneticiler içindir.' });
    const bridgeKey = String(process.env.AEON_PRINT_BRIDGE_KEY || '');
    if (!bridgeKey) return res.status(503).json({ error: 'Yazdırma köprüsü anahtarı yapılandırılmadı.' });
    const origin = String(req.get('origin') || `https://${req.get('host')}`).replace(/\/$/, '');
    const command = `$u='${origin}'; $k='${bridgeKey}'; $f=Join-Path $env:TEMP 'Install-AeonPrintBridge.ps1'; Invoke-WebRequest -Uri "$u/print-bridge/Install-AeonPrintBridge.ps1?v=bridge-20260727-4" -OutFile $f -UseBasicParsing; powershell.exe -NoProfile -ExecutionPolicy Bypass -File $f -AeonUrl $u -BridgeKey $k`;
    res.json({ command });
  });

  app.get('/api/print-bridge/jobs', async (req, res) => {
    const station = String(req.query.station || '').toLowerCase();
    if (!bridgeAuthorized(req)) return res.status(401).json({ error: 'Yazdırma köprüsü yetkilendirilemedi.' });
    if (!['kitchen', 'reception', 'all'].includes(station)) return res.status(400).json({ error: 'Geçerli yazdırma istasyonu zorunludur.' });
    try {
      const rows = station === 'all'
        ? await req.db.all("SELECT * FROM print_jobs WHERE station IN ('kitchen', 'reception') AND status = 'queued' ORDER BY created_at ASC LIMIT 50")
        : await req.db.all("SELECT * FROM print_jobs WHERE station = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 50", [station]);
      res.json(rows.map(row => ({ ...row, payload: JSON.parse(row.payload) })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/print-bridge/jobs/:id/complete', async (req, res) => {
    const station = String(req.body?.station || '').toLowerCase();
    if (!bridgeAuthorized(req)) return res.status(401).json({ error: 'Yazdırma köprüsü yetkilendirilemedi.' });
    if (!['kitchen', 'reception'].includes(station)) return res.status(400).json({ error: 'Geçerli yazdırma istasyonu zorunludur.' });
    try {
      const job = await req.db.get("SELECT * FROM print_jobs WHERE id = ? AND station = ? AND status = 'queued'", [req.params.id, station]);
      if (!job) return res.status(404).json({ error: 'Bekleyen yazdırma işi bulunamadı.' });
      await req.db.run("UPDATE print_jobs SET status = 'printed', printed_at = CURRENT_TIMESTAMP, printed_by = 'Aeon Print Bridge' WHERE id = ?", [job.id]);
      broadcastSSE(req.tenantId, 'print_job_completed', { id: job.id, station });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/print-bridge/jobs/:id/failed', async (req, res) => {
    const station = String(req.body?.station || '').toLowerCase();
    if (!bridgeAuthorized(req)) return res.status(401).json({ error: 'Yazdırma köprüsü yetkilendirilemedi.' });
    if (!['kitchen', 'reception'].includes(station)) return res.status(400).json({ error: 'Geçerli yazdırma istasyonu zorunludur.' });
    try {
      const errorMessage = String(req.body?.error || 'Yazdırma hatası').slice(0, 500);
      await req.db.run("UPDATE print_jobs SET error_message = ? WHERE id = ? AND station = ? AND status = 'queued'", [errorMessage, req.params.id, station]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

}
