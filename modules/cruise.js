import crypto from 'crypto';

const APA_CURRENCIES = ['EUR', 'USD', 'TRY'];

export function initCruise({ app, eventBus, hookRegistry, getDb }) {
  hookRegistry.register('payment_methods', async (context) => {
    const { db } = context;
    const cruiseActive = await db.get("SELECT value FROM config WHERE key = 'MODULE_CRUISE'");
    if (cruiseActive && cruiseActive.value === 'true') {
      return [{ id: 'apa_charge', name: 'APA Bütçesinden Tahsil Et' }];
    }
    return [];
  });

  eventBus.on('apa_charge_request', async (data) => {
    const { tenantId, amount, description } = data;
    try {
      const db = await getDb(tenantId);
      const ledgerId = 'apa_l_' + crypto.randomUUID();
      await db.run(
        "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [ledgerId, amount, 'EUR', 1.0, 'alcohol', description, '']
      );
    } catch (err) {
      throw err;
    }
  });

  app.get('/api/apa/ledger', async (req, res) => {
    try {
      const ledger = await req.db.all("SELECT * FROM apa_ledger ORDER BY recorded_at DESC");
      res.json(ledger);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/apa/ledger', async (req, res) => {
    const { amount, currency, exchangeRateToEur, category, description, receiptImagePath } = req.body;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Geçerli bir tutar giriniz (0\'dan büyük olmalı).' });
    }
    const normalizedCurrency = String(currency || '').toUpperCase();
    if (!APA_CURRENCIES.includes(normalizedCurrency)) {
      return res.status(400).json({ error: `Para birimi şunlardan biri olmalı: ${APA_CURRENCIES.join(', ')}.` });
    }
    const parsedRate = exchangeRateToEur === undefined ? 1.0 : Number(exchangeRateToEur);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return res.status(400).json({ error: 'Geçerli bir döviz kuru giriniz (0\'dan büyük olmalı).' });
    }
    const normalizedCategory = String(category || '').trim().slice(0, 60) || 'diğer';
    const normalizedDescription = String(description || '').trim().slice(0, 500);

    try {
      const id = 'apa_' + crypto.randomUUID();
      await req.db.run(
        "INSERT INTO apa_ledger (id, amount, currency, exchange_rate_to_eur, category, description, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, parsedAmount, normalizedCurrency, parsedRate, normalizedCategory, normalizedDescription, receiptImagePath || '']
      );
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        ['log_' + crypto.randomUUID(), req.actor?.name || 'Sistem', 'APA Bütçe Kaydı', `${normalizedCategory}: ${parsedAmount} ${normalizedCurrency} (${normalizedDescription || 'açıklama yok'})`]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/apa/summary', async (req, res) => {
    try {
      const ledger = await req.db.all("SELECT * FROM apa_ledger");
      const budget = 10000.00;
      let totalSpentEur = 0;
      ledger.forEach(entry => {
        totalSpentEur += entry.amount * entry.exchange_rate_to_eur;
      });
      res.json({
        budget,
        totalSpentEur,
        remainingBudget: budget - totalSpentEur,
        currencyList: ['EUR', 'USD', 'TRY']
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
