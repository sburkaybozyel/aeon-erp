// Faz 5 — Raporlama ve ürünleştirme
// Pipeline dağılımı, dönüşüm oranları, kaynak/acente/temsilci performansı,
// ortalama süreler, kayıp analizi ve CRM ↔ ERP gelir mutabakatı.
// Not: AlaSQL'de `total` ayrılmış kelime olduğu için toplam alias'ları total_amt.
export function initReports({ app, getCrmDb, broadcastSSE, isManagement, requireManagement }) {
  const ok = (res, data) => res.json(data);

  // Pipeline toplamı ve aşama bazlı dağılım
  app.get('/api/crm/reports/pipeline', async (req, res) => {
    try {
      const db = await getCrmDb();
      const rows = await db.all("SELECT pipeline_stage, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amt FROM opportunities GROUP BY pipeline_stage ORDER BY total_amt DESC");
      const grand = await db.get("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amt FROM opportunities");
      ok(res, { breakdown: rows, total_opportunities: Number(grand.cnt), total_amount: Number(grand.total_amt) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Lead → fırsat → teklif → kazanılan dönüşüm hunisi
  app.get('/api/crm/reports/conversion', async (req, res) => {
    try {
      const db = await getCrmDb();
      const leads = await db.get("SELECT COUNT(*) AS cnt FROM leads");
      const leadsToOpp = await db.get("SELECT COUNT(DISTINCT lead_id) AS cnt FROM opportunities WHERE lead_id IS NOT NULL");
      const oppsWithOffers = await db.get("SELECT COUNT(DISTINCT opportunity_id) AS cnt FROM offers");
      const totalOpps = await db.get("SELECT COUNT(*) AS cnt FROM opportunities");
      const wonOpps = await db.get("SELECT COUNT(*) AS cnt FROM opportunities WHERE pipeline_stage = 'won'");
      const lostOpps = await db.get("SELECT COUNT(*) AS cnt FROM opportunities WHERE pipeline_stage = 'lost'");
      const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
      ok(res, {
        leads: Number(leads.cnt),
        leads_converted_to_opportunity: Number(leadsToOpp.cnt),
        lead_to_opportunity_rate: pct(Number(leadsToOpp.cnt), Number(leads.cnt)),
        opportunities: Number(totalOpps.cnt),
        opportunities_with_offer: Number(oppsWithOffers.cnt),
        opportunity_to_offer_rate: pct(Number(oppsWithOffers.cnt), Number(totalOpps.cnt)),
        won: Number(wonOpps.cnt),
        win_rate: pct(Number(wonOpps.cnt), Number(totalOpps.cnt)),
        lost: Number(lostOpps.cnt),
        loss_rate: pct(Number(lostOpps.cnt), Number(totalOpps.cnt))
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Kaynak / acente / temsilci performansı
  app.get('/api/crm/reports/performance', async (req, res) => {
    try {
      const db = await getCrmDb();
      const bySource = await db.all("SELECT o.source, COUNT(*) AS cnt, COALESCE(SUM(o.amount),0) AS total_amt, SUM(CASE WHEN o.pipeline_stage = 'won' THEN 1 ELSE 0 END) AS won FROM opportunities o GROUP BY o.source ORDER BY total_amt DESC");
      const byFirm = await db.all("SELECT f.name AS firm_name, f.type AS firm_type, COUNT(o.id) AS cnt, COALESCE(SUM(o.amount),0) AS total_amt, SUM(CASE WHEN o.pipeline_stage = 'won' THEN 1 ELSE 0 END) AS won FROM opportunities o LEFT JOIN firms f ON f.id = o.firm_id GROUP BY o.firm_id ORDER BY total_amt DESC LIMIT 20");
      const byOwner = await db.all("SELECT u.name AS owner_name, COUNT(o.id) AS cnt, COALESCE(SUM(o.amount),0) AS total_amt, SUM(CASE WHEN o.pipeline_stage = 'won' THEN 1 ELSE 0 END) AS won FROM opportunities o LEFT JOIN users u ON u.id = o.owner_id GROUP BY o.owner_id ORDER BY total_amt DESC");
      ok(res, { by_source: bySource, by_firm: byFirm, by_owner: byOwner });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Ortalama yanıt / satışa dönüşme süresi (gün)
  app.get('/api/crm/reports/timing', async (req, res) => {
    try {
      const db = await getCrmDb();
      const leadToOpp = await db.all("SELECT o.created_at AS opp_created, l.created_at AS lead_created FROM opportunities o JOIN leads l ON l.id = o.lead_id WHERE l.created_at IS NOT NULL AND o.created_at IS NOT NULL");
      const wonTiming = await db.all("SELECT created_at, updated_at FROM opportunities WHERE pipeline_stage = 'won'");
      const avgDays = (rows, a, b) => {
        if (!rows.length) return null;
        const sumDays = rows.reduce((s, r) => s + Math.max(0, (new Date(r[a]) - new Date(r[b])) / 86400000), 0);
        return Math.round((sumDays / rows.length) * 10) / 10;
      };
      ok(res, {
        avg_lead_to_opportunity_days: avgDays(leadToOpp, 'opp_created', 'lead_created'),
        avg_opportunity_to_won_days: avgDays(wonTiming, 'updated_at', 'created_at'),
        sample_leads: leadToOpp.length,
        sample_won: wonTiming.length
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Kaybedilen fırsat analizi
  app.get('/api/crm/reports/lost-analysis', async (req, res) => {
    try {
      const db = await getCrmDb();
      const byReason = await db.all("SELECT COALESCE(lost_reason, 'belirsiz') AS reason, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amt FROM opportunities WHERE pipeline_stage = 'lost' GROUP BY reason ORDER BY total_amt DESC");
      const grand = await db.get("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amt FROM opportunities WHERE pipeline_stage = 'lost'");
      ok(res, { by_reason: byReason, total_lost: Number(grand.cnt), total_lost_amount: Number(grand.total_amt) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // CRM ↔ ERP gelir mutabakatı: fırsat tutarı vs ERP rezervasyon tutarı
  app.get('/api/crm/reports/reconciliation', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb();
      const rows = await db.all("SELECT id, title, amount, currency, erp_reservation_no, erp_status, erp_total_amount, erp_currency FROM opportunities WHERE erp_reservation_id IS NOT NULL ORDER BY updated_at DESC LIMIT 200");
      const rowsWithDiff = rows.map(r => {
        const crmAmount = Number(r.amount) || 0;
        const erpAmount = Number(r.erp_total_amount) || 0;
        return { ...r, difference: Math.round((crmAmount - erpAmount) * 100) / 100, reconciled: Math.abs(crmAmount - erpAmount) < 0.01 };
      });
      const summary = await db.get("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS crm_total, COALESCE(SUM(erp_total_amount),0) AS erp_total FROM opportunities WHERE erp_reservation_id IS NOT NULL");
      ok(res, {
        rows: rowsWithDiff,
        count: Number(summary.cnt),
        crm_total: Number(summary.crm_total),
        erp_total: Number(summary.erp_total),
        difference: Math.round((Number(summary.crm_total) - Number(summary.erp_total)) * 100) / 100,
        unreconciled: rowsWithDiff.filter(r => !r.reconciled).length
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}
