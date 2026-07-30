import crypto from 'crypto';

// Marina / yacht club module: manages berths and visiting-vessel check-ins (not an
// owned fleet). Each visiting boat gets a running account (fuel, mooring, water,
// electricity, provisioning) that can be settled like a hotel folio.

const VESSEL_ACCOUNT_CURRENCIES = ['EUR', 'USD', 'TRY'];

export function initMarina({ app, eventBus, hookRegistry, getDb }) {
  hookRegistry.register('payment_methods', async (context) => {
    const { db } = context;
    const marinaActive = await db.get("SELECT value FROM config WHERE key = 'MODULE_CRUISE'");
    if (marinaActive && marinaActive.value === 'true') {
      return [{ id: 'vessel_account', name: 'Tekne Hesabına Yaz' }];
    }
    return [];
  });

  eventBus.on('vessel_account_charge', async (data) => {
    const { tenantId, amount, description, vesselVisitId } = data;
    const db = await getDb(tenantId);
    const ledgerId = 'va_' + crypto.randomUUID();
    await db.run(
      "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path, vessel_visit_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [ledgerId, amount, 'EUR', 1.0, 'vessel_account', description, '', vesselVisitId || null]
    );
  });

  // --- Berths ---

  app.get('/api/marina/berths', async (req, res) => {
    try {
      const berths = await req.db.all("SELECT * FROM berths ORDER BY berth_number");
      res.json(berths);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marina/berths', async (req, res) => {
    const { berthNumber, maxLoaM, maxDraftM, powerAmps, water, notes } = req.body;
    const number = String(berthNumber || '').trim();
    if (!number) return res.status(400).json({ error: 'Yanaşma yeri numarası gerekli.' });
    try {
      const id = 'berth_' + crypto.randomUUID();
      await req.db.run(
        "INSERT INTO berths (id, berth_number, max_loa_m, max_draft_m, power_amps, water, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, number, Number(maxLoaM) || 15, Number(maxDraftM) || 3, Number(powerAmps) || 32, water === false ? 0 : 1, String(notes || '')]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vessel visits (check-in / check-out) ---

  app.get('/api/marina/visits', async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const visits = status
        ? await req.db.all("SELECT * FROM vessel_visits WHERE status = ? ORDER BY arrival_date DESC", [status])
        : await req.db.all("SELECT * FROM vessel_visits ORDER BY arrival_date DESC");
      res.json(visits);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marina/visits', async (req, res) => {
    const {
      berthId, vesselName, vesselType, loaM, flag,
      captainName, contactPhone, guestCount, arrivalDate, departureDate, dailyRate, notes
    } = req.body;
    const name = String(vesselName || '').trim();
    if (!name) return res.status(400).json({ error: 'Tekne adı gerekli.' });
    try {
      const id = 'visit_' + crypto.randomUUID();
      await req.db.run(
        `INSERT INTO vessel_visits
          (id, berth_id, vessel_name, vessel_type, loa_m, flag, captain_name, contact_phone,
           guest_count, arrival_date, departure_date, status, daily_rate, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked_in', ?, ?, CURRENT_TIMESTAMP)`,
        [id, berthId || null, name, vesselType || 'sailing', Number(loaM) || null, String(flag || ''),
         String(captainName || ''), String(contactPhone || ''), Number(guestCount) || 0,
         arrivalDate || null, departureDate || null, Number(dailyRate) || 0, String(notes || '')]
      );
      if (berthId) {
        await req.db.run("UPDATE berths SET status = 'occupied' WHERE id = ?", [berthId]);
      }
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marina/visits/:id/checkout', async (req, res) => {
    try {
      const visit = await req.db.get("SELECT * FROM vessel_visits WHERE id = ?", [req.params.id]);
      if (!visit) return res.status(404).json({ error: 'Ziyaret bulunamadı.' });
      await req.db.run(
        "UPDATE vessel_visits SET status = 'checked_out', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [req.params.id]
      );
      if (visit.berth_id) {
        await req.db.run("UPDATE berths SET status = 'vacant' WHERE id = ?", [visit.berth_id]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vessel account ledger (fuel, mooring, water, electricity, provisioning) ---

  app.get('/api/marina/vessel-account', async (req, res) => {
    try {
      const visitId = req.query.vessel_visit_id ? String(req.query.vessel_visit_id) : null;
      const ledger = visitId
        ? await req.db.all("SELECT * FROM apa_ledger WHERE vessel_visit_id = ? ORDER BY recorded_at DESC", [visitId])
        : await req.db.all("SELECT * FROM apa_ledger ORDER BY recorded_at DESC");
      res.json(ledger);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marina/vessel-account', async (req, res) => {
    const { vesselVisitId, amount, currency, exchangeRateToEur, category, description, receiptImagePath } = req.body;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Geçerli bir tutar giriniz (0\'dan büyük olmalı).' });
    }
    const normalizedCurrency = String(currency || 'EUR').toUpperCase();
    if (!VESSEL_ACCOUNT_CURRENCIES.includes(normalizedCurrency)) {
      return res.status(400).json({ error: `Para birimi şunlardan biri olmalı: ${VESSEL_ACCOUNT_CURRENCIES.join(', ')}.` });
    }
    const parsedRate = exchangeRateToEur === undefined ? 1.0 : Number(exchangeRateToEur);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return res.status(400).json({ error: 'Geçerli bir döviz kuru giriniz (0\'dan büyük olmalı).' });
    }
    const normalizedCategory = String(category || 'diğer').trim().slice(0, 60) || 'diğer';
    const normalizedDescription = String(description || '').trim().slice(0, 500);

    try {
      const id = 'va_' + crypto.randomUUID();
      await req.db.run(
        "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path, vessel_visit_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, parsedAmount, normalizedCurrency, parsedRate, normalizedCategory, normalizedDescription, receiptImagePath || '', vesselVisitId || null]
      );
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        ['log_' + crypto.randomUUID(), req.actor?.name || 'Sistem', 'Tekne Hesabı Kaydı', `${normalizedCategory}: ${parsedAmount} ${normalizedCurrency} (${normalizedDescription || 'açıklama yok'})`]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
