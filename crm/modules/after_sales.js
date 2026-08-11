// Faz 4 — Satış sonrası takip, tekrar satış ve kampanyalar (izin kontrollü)
// Kabul kanıtı: çıkış yapan misafir uygun izinlere göre takip kuyruğuna düşer;
// iletişim tercihi (marketing_consent) olmayan kişiye kampanya gönderilmez.
import crypto from 'crypto';

const ERP_API_URL = (process.env.ERP_API_URL || 'http://localhost:3200/api/erp').replace(/\/$/, '');

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function erpGet(db, path) {
  const res = await fetch(`${ERP_API_URL}${path}`, { headers: { 'Content-Type': 'application/json' } });
  if (res.status >= 400) throw new Error(`ERP hatası (${res.status})`);
  return res.json();
}

function iso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

export function initAfterSales({ app, getCrmDb, broadcastSSE, isManagement, requireManagement }) {
  const ok = (res, data) => res.json(data);
  const badRequest = (res, msg) => res.status(400).json({ error: msg });
  const notFound = (res, msg) => res.status(404).json({ error: msg });

  // ── TAKİP KUYRUĞU ────────────────────────────────────────────────────
  // ERP'de çıkış yapmış (checked_out) rezervasyonları çekip, izinli kontaklar için
  // satış sonrası memnuniyet takibi oluşturur. Ayrıca yaklaşan check-in için ön takip.
  app.post('/api/crm/followups/generate', async (req, res) => {
    try {
      const db = await getCrmDb();
      let erpReservations = [];
      try {
        erpReservations = await erpGet(db, '/reservations');
      } catch (e) {
        return res.status(502).json({ error: `ERP'ye ulaşılamadı: ${e.message}` });
      }
      let created = 0, skipped = 0;
      for (const erp of erpReservations) {
        if (!erp.source_id) continue;
        const opp = await db.get("SELECT * FROM opportunities WHERE id = ?", [erp.source_id]);
        if (!opp) continue;

        // Satış sonrası: ERP'de çıkış yapmış rezervasyonlar
        if (erp.status === 'checked_out' || erp.status === 'in_house') {
          const contact = opp.contact_id ? await db.get("SELECT * FROM contacts WHERE id = ?", [opp.contact_id]) : null;
          if (!contact || Number(contact.marketing_consent) !== 1) {
            skipped++; // iletişim izni olmayan kişi takibe düşürülmez
            continue;
          }
          const existing = await db.get("SELECT id FROM followups WHERE opportunity_id = ? AND type = ? AND stage != 'done'", [opp.id, 'post_stay']);
          if (existing) continue;
          await db.run(
            "INSERT INTO followups (id, opportunity_id, contact_id, firm_id, type, stage, erp_reservation_no, due_date, notes, owner_id) VALUES (?, ?, ?, ?, 'post_stay', 'pending', ?, ?, ?, ?)",
            [uid('fup'), opp.id, contact.id, opp.firm_id || null, erp.reservation_no, iso(1), `Satış sonrası memnuniyet araması — ${contact.first_name} ${contact.last_name}`, opp.owner_id || null]);
          created++;
        }

        // Konaklama öncesi: check-in'e 3 gün kalan rezervasyonlar
        if (erp.status === 'inquiry' || erp.status === 'option' || erp.status === 'confirmed') {
          if (!erp.check_in) continue;
          const daysLeft = Math.round((new Date(erp.check_in) - Date.now()) / 86400000);
          if (daysLeft >= 0 && daysLeft <= 3) {
            const existing = await db.get("SELECT id FROM followups WHERE opportunity_id = ? AND type = ? AND stage != 'done'", [opp.id, 'pre_stay']);
            if (existing) continue;
            await db.run(
              "INSERT INTO followups (id, opportunity_id, contact_id, firm_id, type, stage, erp_reservation_no, due_date, notes, owner_id) VALUES (?, ?, ?, ?, 'pre_stay', 'pending', ?, ?, ?, ?)",
              [uid('fup'), opp.id, opp.contact_id || null, opp.firm_id || null, erp.reservation_no, erp.check_in, `Check-in öncesi takip — ${erp.reservation_no}`, opp.owner_id || null]);
            created++;
          }
        }
      }
      broadcastSSE('crm_data_changed', { type: 'followup' });
      ok(res, { success: true, created, skipped });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/crm/followups', async (req, res) => {
    try {
      const db = await getCrmDb();
      const stage = req.query.stage;
      let sql = "SELECT f.*, o.title AS opportunity_title, c.first_name || ' ' || c.last_name AS contact_name, c.marketing_consent, u.name AS owner_name FROM followups f LEFT JOIN opportunities o ON o.id = f.opportunity_id LEFT JOIN contacts c ON c.id = f.contact_id LEFT JOIN users u ON u.id = f.owner_id";
      const params = [];
      if (stage) { sql += " WHERE f.stage = ?"; params.push(stage); }
      sql += " ORDER BY f.due_date ASC, f.created_at DESC LIMIT 200";
      ok(res, await db.all(sql, params));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Takipleri tamamla / ertele
  app.post('/api/crm/followups/:id/action', async (req, res) => {
    const { action } = req.body;
    if (!['done', 'skip', 'snooze'].includes(action)) return badRequest(res, 'Geçersiz işlem (done, skip, snooze).');
    try {
      const db = await getCrmDb();
      const fup = await db.get("SELECT * FROM followups WHERE id = ?", [req.params.id]);
      if (!fup) return notFound(res, 'Takip bulunamadı.');
      if (action === 'done') {
        await db.run("UPDATE followups SET stage = 'done', completed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes) WHERE id = ?", [req.body.notes || null, fup.id]);
      } else if (action === 'skip') {
        await db.run("UPDATE followups SET stage = 'skipped', completed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes) WHERE id = ?", [req.body.notes || null, fup.id]);
      } else {
        await db.run("UPDATE followups SET due_date = ? WHERE id = ?", [iso(3), fup.id]);
      }
      broadcastSSE('crm_data_changed', { type: 'followup' });
      ok(res, { success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Satış sonrası takipten tekrar konaklama fırsatı oluştur
  app.post('/api/crm/followups/:id/create-opportunity', async (req, res) => {
    try {
      const db = await getCrmDb();
      const fup = await db.get("SELECT * FROM followups WHERE id = ?", [req.params.id]);
      if (!fup) return notFound(res, 'Takip bulunamadı.');
      if (fup.stage !== 'pending') return badRequest(res, 'Yalnızca bekleyen takiplerden tekrar fırsat oluşturulabilir.');
      const opp = fup.opportunity_id ? await db.get("SELECT * FROM opportunities WHERE id = ?", [fup.opportunity_id]) : null;
      const id = uid('opp');
      await db.run(
        "INSERT INTO opportunities (id, lead_id, firm_id, contact_id, title, pipeline_stage, amount, currency, owner_id, source, notes, close_date) VALUES (?, NULL, ?, ?, ?, 'inquiry', 0, ?, ?, 'tekrar_konaklama', ?, NULL)",
        [id, fup.firm_id || null, fup.contact_id || null, `Tekrar Konaklama — ${fup.contact_id ? 'Misafir' : 'Fırsat'}`, (opp?.currency || 'EUR'), req.crmUser?.id || fup.owner_id || null, fup.notes || null]);
      await db.run("UPDATE followups SET stage = 'done', completed_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes) WHERE id = ?", [`Tekrar konaklama fırsatı oluşturuldu: ${id}`, fup.id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity' });
      ok(res, { success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── KAMPANYALAR (izin kontrollü) ─────────────────────────────────────
  app.get('/api/crm/campaigns', async (req, res) => {
    try {
      const db = await getCrmDb();
      const rows = await db.all("SELECT c.*, (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.status = 'sent') AS sent_count, (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.status = 'skipped') AS skipped_count FROM campaigns c ORDER BY c.created_at DESC LIMIT 100");
      ok(res, rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/crm/campaigns', async (req, res) => {
    const { name, segment, scheduled_at } = req.body;
    if (!name || !segment) return badRequest(res, 'Kampanya adı ve segment zorunludur.');
    try {
      const db = await getCrmDb();
      const id = uid('cmp');
      await db.run("INSERT INTO campaigns (id, name, segment, status, scheduled_at) VALUES (?, ?, ?, 'draft', ?)",
        [id, name.trim(), segment, scheduled_at || null]);
      broadcastSSE('crm_data_changed', { type: 'campaign' });
      ok(res, { success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/crm/campaigns/:id', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb();
      await db.run("DELETE FROM campaign_contacts WHERE campaign_id = ?", [req.params.id]);
      await db.run("DELETE FROM campaigns WHERE id = ?", [req.params.id]);
      ok(res, { success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Kampanyayı hedef segmentteki izinli kontaklara "gönderir".
  // marketing_consent=0 olanlar asla gönderilmez; kampanya_contacts'a skipped+neden yazılır.
  app.post('/api/crm/campaigns/:id/run', async (req, res) => {
    try {
      const db = await getCrmDb();
      const camp = await db.get("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
      if (!camp) return notFound(res, 'Kampanya bulunamadı.');

      let targetContacts;
      if (camp.segment === 'acente') {
        targetContacts = await db.all("SELECT c.* FROM contacts c JOIN firms f ON f.id = c.firm_id WHERE f.type = 'acente'");
      } else if (camp.segment === 'kurumsal') {
        targetContacts = await db.all("SELECT c.* FROM contacts c JOIN firms f ON f.id = c.firm_id WHERE f.type = 'kurumsal'");
      } else if (camp.segment === 'vip') {
        targetContacts = await db.all("SELECT * FROM contacts WHERE vip = 1");
      } else if (camp.segment === 'tekrar_gelen') {
        targetContacts = await db.all("SELECT c.* FROM contacts c JOIN followups f ON f.contact_id = c.id WHERE f.type = 'post_stay' GROUP BY c.id HAVING COUNT(*) >= 2");
      } else if (camp.segment === 'kaybedilen') {
        targetContacts = await db.all("SELECT DISTINCT c.* FROM contacts c JOIN opportunities o ON o.contact_id = c.id WHERE o.pipeline_stage = 'lost'");
      } else {
        targetContacts = await db.all("SELECT * FROM contacts");
      }

      await db.run("DELETE FROM campaign_contacts WHERE campaign_id = ?", [camp.id]);
      let sent = 0, skipped = 0;
      for (const contact of targetContacts || []) {
        if (Number(contact.marketing_consent) !== 1) {
          await db.run("INSERT INTO campaign_contacts (id, campaign_id, contact_id, status, reason) VALUES (?, ?, ?, 'skipped', 'marketing_consent')", [uid('cc'), camp.id, contact.id]);
          skipped++;
          continue;
        }
        if (!contact.email) {
          await db.run("INSERT INTO campaign_contacts (id, campaign_id, contact_id, status, reason) VALUES (?, ?, ?, 'skipped', 'email_yok')", [uid('cc'), camp.id, contact.id]);
          skipped++;
          continue;
        }
        await db.run("INSERT INTO campaign_contacts (id, campaign_id, contact_id, status, reason) VALUES (?, ?, ?, 'sent', ?)", [uid('cc'), camp.id, contact.id, `simule:${camp.name}`]);
        sent++;
      }
      await db.run("UPDATE campaigns SET status = 'sent', sent_count = ?, skipped_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [sent, skipped, camp.id]);
      broadcastSSE('crm_data_changed', { type: 'campaign' });
      ok(res, { success: true, sent, skipped, total: (targetContacts || []).length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/crm/campaigns/:id/contacts', async (req, res) => {
    try {
      const db = await getCrmDb();
      const rows = await db.all("SELECT cc.contact_id, cc.status, cc.reason, c.first_name || ' ' || c.last_name AS contact_name, c.email, c.marketing_consent FROM campaign_contacts cc LEFT JOIN contacts c ON c.id = cc.contact_id WHERE cc.campaign_id = ? ORDER BY cc.created_at DESC", [req.params.id]);
      ok(res, rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Dashboard için takip özeti
  app.get('/api/crm/followups/summary', async (req, res) => {
    try {
      const db = await getCrmDb();
      const pending = await db.get("SELECT COUNT(*) AS cnt FROM followups WHERE stage = 'pending'");
      const dueSoon = await db.get("SELECT COUNT(*) AS cnt FROM followups WHERE stage = 'pending' AND due_date IS NOT NULL AND date(due_date) <= date('now', '+3 day')");
      ok(res, { pending: Number(pending?.cnt || 0), due_soon: Number(dueSoon?.cnt || 0) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}
