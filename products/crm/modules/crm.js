import crypto from 'crypto';
import { hashPassword as hashPass } from '../db.js';

const uid = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}${Date.now().toString(36)}`;

export function initCrm({ app, getCrmDb, broadcastSSE, isManagement, requireManagement }) {

  const json = (res, status, body) => res.status(status).json(body);
  const badRequest = (res, message) => json(res, 400, { error: message });

  // ─── CONFIG / METADATA ────────────────────────────────────────────────
  app.get('/api/crm/config', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT * FROM config");
      const config = {};
      rows.forEach(r => {
        try { config[r.key] = JSON.parse(r.value); } catch { config[r.key] = r.value; }
      });
      const users = await db.all("SELECT id, name, role FROM users ORDER BY name");
      res.json({ config, users });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── DASHBOARD ────────────────────────────────────────────────────────
  app.get('/api/crm/dashboard', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const [openOpps, totalOpps, wonOpps, overdueTasks, openTasks, recentLeads, recentActivities, stageCounts] = await Promise.all([
        db.get("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_pipeline FROM opportunities WHERE pipeline_stage NOT IN ('won','lost')"),
        db.get("SELECT COUNT(*) AS cnt FROM opportunities"),
        db.get("SELECT COUNT(*) AS cnt FROM opportunities WHERE pipeline_stage = 'won'"),
        db.get("SELECT COUNT(*) AS cnt FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date < ?", [new Date().toISOString().slice(0, 10)]),
        db.get("SELECT COUNT(*) AS cnt FROM tasks WHERE status != 'done'"),
        db.all("SELECT l.*, u.name AS owner_name, f.name AS firm_name FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN firms f ON f.id = l.firm_id ORDER BY l.created_at DESC LIMIT 8"),
        db.all("SELECT a.*, u.name AS owner_name FROM activities a LEFT JOIN users u ON u.id = a.owner_id ORDER BY a.activity_at DESC LIMIT 10"),
        db.all("SELECT pipeline_stage, COUNT(*) AS cnt FROM opportunities GROUP BY pipeline_stage")
      ]);
      res.json({
        open_opportunities: Number(openOpps.cnt),
        open_pipeline_total: Number(openOpps.total_pipeline || 0),
        total_opportunities: Number(totalOpps.cnt),
        won_opportunities: Number(wonOpps.cnt),
        overdue_tasks: Number(overdueTasks.cnt),
        open_tasks: Number(openTasks.cnt),
        stage_counts: stageCounts,
        recent_leads: recentLeads,
        recent_activities: recentActivities,
        current_user: req.crmUser
      });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── USERS (yönetici) ─────────────────────────────────────────────────
  app.get('/api/crm/users', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const users = await db.all("SELECT id, name, email, role, active, created_at FROM users ORDER BY name");
      res.json(users);
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/users', requireManagement, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return badRequest(res, 'name, email ve password zorunludur.');
    try {
      const db = await getCrmDb(req);
      const existing = await db.get("SELECT id FROM users WHERE email = ?", [String(email).toLowerCase().trim()]);
      if (existing) return json(res, 409, { error: 'Bu e-posta zaten kayıtlı.' });
      const id = uid('usr');
      await db.run("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
        [id, name, String(email).toLowerCase().trim(), hashPass(password), role || 'satis']);
      broadcastSSE('crm_data_changed', { type: 'user' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/users/:id', requireManagement, async (req, res) => {
    const { name, role, active, password } = req.body;
    try {
      const db = await getCrmDb(req);
      const fields = []; const values = [];
      if (typeof name === 'string' && name.trim()) { fields.push('name = ?'); values.push(name.trim()); }
      if (role) { fields.push('role = ?'); values.push(role); }
      if (active !== undefined) { fields.push('active = ?'); values.push(active ? 1 : 0); }
      if (password) { fields.push('password_hash = ?'); values.push(hashPass(password)); }
      if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
      values.push(req.params.id);
      await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── FIRMS ────────────────────────────────────────────────────────────
  app.get('/api/crm/firms', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const q = (req.query.q || '').trim();
      let rows;
      if (q) {
        rows = await db.all("SELECT * FROM firms WHERE name LIKE ? OR city LIKE ? OR email LIKE ? ORDER BY name", [`%${q}%`, `%${q}%`, `%${q}%`]);
      } else {
        rows = await db.all("SELECT * FROM firms ORDER BY name");
      }
      const withCounts = await Promise.all(rows.map(async f => {
        const cnt = await db.get("SELECT COUNT(*) AS c FROM contacts WHERE firm_id = ?", [f.id]);
        return { ...f, contact_count: Number(cnt.c) };
      }));
      res.json(withCounts);
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/firms', async (req, res) => {
    const { name, type, tax_number, phone, email, country, city, website, commission_rate, notes } = req.body;
    if (!name || !String(name).trim()) return badRequest(res, 'Firma adı zorunludur.');
    try {
      const db = await getCrmDb(req);
      const id = uid('frm');
      await db.run(
        "INSERT INTO firms (id, name, type, tax_number, phone, email, country, city, website, commission_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name.trim(), type || 'direkt', tax_number || null, phone || null, email || null, country || null, city || null, website || null, Number(commission_rate) || 0, notes || null]);
      broadcastSSE('crm_data_changed', { type: 'firm' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.get('/api/crm/firms/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const firm = await db.get("SELECT * FROM firms WHERE id = ?", [req.params.id]);
      if (!firm) return json(res, 404, { error: 'Firma bulunamadı.' });
      const contacts = await db.all("SELECT * FROM contacts WHERE firm_id = ? ORDER BY is_primary DESC, last_name", [firm.id]);
      const opps = await db.all("SELECT * FROM opportunities WHERE firm_id = ? ORDER BY created_at DESC", [firm.id]);
      const leads = await db.all("SELECT * FROM leads WHERE firm_id = ? ORDER BY created_at DESC", [firm.id]);
      res.json({ ...firm, contacts, opportunities: opps, leads });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/firms/:id', async (req, res) => {
    const allowed = ['name', 'type', 'tax_number', 'phone', 'email', 'country', 'city', 'website', 'commission_rate', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      values.push(req.params.id);
      await db.run(`UPDATE firms SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/firms/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM contacts WHERE firm_id = ?", [req.params.id]);
      await db.run("DELETE FROM firms WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── CONTACTS ─────────────────────────────────────────────────────────
  app.get('/api/crm/contacts', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const q = (req.query.q || '').trim();
      const firmId = req.query.firm_id;
      let sql = "SELECT c.*, f.name AS firm_name FROM contacts c LEFT JOIN firms f ON f.id = c.firm_id";
      const cond = []; const params = [];
      if (q) { cond.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      if (firmId) { cond.push("c.firm_id = ?"); params.push(firmId); }
      if (cond.length) sql += " WHERE " + cond.join(' AND ');
      sql += " ORDER BY c.last_name, c.first_name";
      res.json(await db.all(sql, params));
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/contacts', async (req, res) => {
    const { firm_id, first_name, last_name, title, phone, email, is_primary, kvkk_consent, marketing_consent, vip, segment, preferences, allergies, birthday, notes } = req.body;
    if (!first_name || !last_name) return badRequest(res, 'Ad ve soyad zorunludur.');
    try {
      const db = await getCrmDb(req);
      if (is_primary) await db.run("UPDATE contacts SET is_primary = 0 WHERE firm_id = ?", [firm_id || null]);
      const id = uid('cnt');
      await db.run(
        "INSERT INTO contacts (id, firm_id, first_name, last_name, title, phone, email, is_primary, kvkk_consent, marketing_consent, vip, segment, preferences, allergies, birthday, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, firm_id || null, first_name.trim(), last_name.trim(), title || null, phone || null, email || null, is_primary ? 1 : 0, kvkk_consent ? 1 : 0, marketing_consent ? 1 : 0, vip ? 1 : 0, segment || 'direkt', preferences || null, allergies || null, birthday || null, notes || null]);
      broadcastSSE('crm_data_changed', { type: 'contact' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/contacts/:id', async (req, res) => {
    const allowed = ['firm_id', 'first_name', 'last_name', 'title', 'phone', 'email', 'is_primary', 'kvkk_consent', 'marketing_consent', 'vip', 'segment', 'preferences', 'allergies', 'birthday', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      if (req.body.is_primary) await db.run("UPDATE contacts SET is_primary = 0 WHERE firm_id = ? AND id != ?", [req.body.firm_id || null, req.params.id]);
      values.push(req.params.id);
      await db.run(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/contacts/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM contacts WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── LEADS ────────────────────────────────────────────────────────────
  app.get('/api/crm/leads', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const status = req.query.status;
      const q = (req.query.q || '').trim();
      let sql = "SELECT l.*, u.name AS owner_name, f.name AS firm_name FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN firms f ON f.id = l.firm_id";
      const cond = []; const params = [];
      if (status && status !== 'all') { cond.push("l.status = ?"); params.push(status); }
      if (q) { cond.push("(f.name LIKE ? OR l.notes LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
      if (cond.length) sql += " WHERE " + cond.join(' AND ');
      sql += " ORDER BY l.created_at DESC";
      res.json(await db.all(sql, params));
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/leads', async (req, res) => {
    const { firm_id, contact_id, source, owner_id, notes } = req.body;
    if (!source) return badRequest(res, 'Lead kaynağı zorunludur.');
    try {
      const db = await getCrmDb(req);
      const id = uid('lead');
      await db.run("INSERT INTO leads (id, firm_id, contact_id, source, owner_id, status, notes) VALUES (?, ?, ?, ?, ?, 'new', ?)",
        [id, firm_id || null, contact_id || null, source, owner_id || req.crmUser.id, notes || null]);
      broadcastSSE('crm_data_changed', { type: 'lead' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/leads/:id', async (req, res) => {
    const allowed = ['firm_id', 'contact_id', 'source', 'owner_id', 'status', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id);
      await db.run(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/leads/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM leads WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── OPPORTUNITIES (pipeline) ─────────────────────────────────────────
  app.get('/api/crm/opportunities', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const stage = req.query.stage;
      const ownerId = req.query.owner_id;
      let sql = "SELECT o.*, u.name AS owner_name, f.name AS firm_name, c.first_name || ' ' || c.last_name AS contact_name FROM opportunities o LEFT JOIN users u ON u.id = o.owner_id LEFT JOIN firms f ON f.id = o.firm_id LEFT JOIN contacts c ON c.id = o.contact_id";
      const cond = []; const params = [];
      if (stage && stage !== 'all') { cond.push("o.pipeline_stage = ?"); params.push(stage); }
      if (ownerId && ownerId !== 'all') { cond.push("o.owner_id = ?"); params.push(ownerId); }
      if (cond.length) sql += " WHERE " + cond.join(' AND ');
      sql += " ORDER BY o.updated_at DESC";
      res.json(await db.all(sql, params));
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/opportunities', async (req, res) => {
    const { lead_id, firm_id, contact_id, title, pipeline_stage, amount, currency, owner_id, source, close_date, notes } = req.body;
    if (!title || !String(title).trim()) return badRequest(res, 'Fırsat başlığı zorunludur.');
    try {
      const db = await getCrmDb(req);
      const id = uid('opp');
      await db.run(
        "INSERT INTO opportunities (id, lead_id, firm_id, contact_id, title, pipeline_stage, amount, currency, owner_id, source, close_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, lead_id || null, firm_id || null, contact_id || null, title.trim(), pipeline_stage || 'inquiry', Number(amount) || 0, currency || 'EUR', owner_id || req.crmUser.id, source || null, close_date || null, notes || null]);
      if (lead_id) await db.run("UPDATE leads SET status = 'qualified' WHERE id = ? AND status = 'new'", [lead_id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.get('/api/crm/opportunities/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const opp = await db.get("SELECT o.*, u.name AS owner_name, f.name AS firm_name, c.first_name || ' ' || c.last_name AS contact_name FROM opportunities o LEFT JOIN users u ON u.id = o.owner_id LEFT JOIN firms f ON f.id = o.firm_id LEFT JOIN contacts c ON c.id = o.contact_id WHERE o.id = ?", [req.params.id]);
      if (!opp) return json(res, 404, { error: 'Fırsat bulunamadı.' });
      const activities = await db.all("SELECT a.*, u.name AS owner_name FROM activities a LEFT JOIN users u ON u.id = a.owner_id WHERE a.opportunity_id = ? ORDER BY a.activity_at DESC", [opp.id]);
      const offers = await db.all("SELECT * FROM offers WHERE opportunity_id = ? ORDER BY version DESC", [opp.id]);
      const tasks = await db.all("SELECT * FROM tasks WHERE related_type = 'opportunity' AND related_id = ? ORDER BY due_date IS NULL, due_date ASC", [opp.id]);
      res.json({ ...opp, activities, offers, tasks });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/opportunities/:id', async (req, res) => {
    const allowed = ['title', 'pipeline_stage', 'amount', 'currency', 'owner_id', 'source', 'close_date', 'lost_reason', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      if (req.body.pipeline_stage === 'lost' && !req.body.lost_reason) return badRequest(res, 'Kaybedilen fırsat için kayıp nedeni gereklidir.');
      // Moving out of 'lost' without an explicit new lost_reason should clear the old one —
      // otherwise a reopened opportunity keeps displaying a stale "kayıp nedeni" from the
      // previous loss (the POST /:id/stage endpoint already gets this right; this PATCH path
      // didn't, since lost_reason is only in `fields` when the caller passes it explicitly).
      if (req.body.pipeline_stage && req.body.pipeline_stage !== 'lost' && req.body.lost_reason === undefined) {
        fields.push('lost_reason = NULL');
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id);
      await db.run(`UPDATE opportunities SET ${fields.join(', ')} WHERE id = ?`, values);
      const opp = await db.get("SELECT * FROM opportunities WHERE id = ?", [req.params.id]);
      if (opp?.lead_id && opp.pipeline_stage === 'won') await db.run("UPDATE leads SET status = 'converted' WHERE id = ?", [opp.lead_id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity' });
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/opportunities/:id/stage', async (req, res) => {
    const { pipeline_stage, lost_reason } = req.body;
    if (!pipeline_stage) return badRequest(res, 'pipeline_stage gereklidir.');
    try {
      const db = await getCrmDb(req);
      if (pipeline_stage === 'lost' && !lost_reason) return badRequest(res, 'Kaybedilen fırsat için kayıp nedeni gereklidir.');
      await db.run("UPDATE opportunities SET pipeline_stage = ?, lost_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [pipeline_stage, lost_reason || null, req.params.id]);
      const opp = await db.get("SELECT lead_id FROM opportunities WHERE id = ?", [req.params.id]);
      if (opp?.lead_id && pipeline_stage === 'won') await db.run("UPDATE leads SET status = 'converted' WHERE id = ?", [opp.lead_id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity' });
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/opportunities/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM activities WHERE opportunity_id = ?", [req.params.id]);
      await db.run("DELETE FROM offers WHERE opportunity_id = ?", [req.params.id]);
      await db.run("DELETE FROM tasks WHERE related_type = 'opportunity' AND related_id = ?", [req.params.id]);
      await db.run("DELETE FROM opportunities WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── ACTIVITIES ───────────────────────────────────────────────────────
  app.get('/api/crm/activities', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT a.*, u.name AS owner_name, o.title AS opportunity_title FROM activities a LEFT JOIN users u ON u.id = a.owner_id LEFT JOIN opportunities o ON o.id = a.opportunity_id ORDER BY a.activity_at DESC LIMIT 200");
      res.json(rows);
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/activities', async (req, res) => {
    const { opportunity_id, contact_id, type, subject, notes, activity_at } = req.body;
    if (!subject || !String(subject).trim()) return badRequest(res, 'Aktivite konusu zorunludur.');
    try {
      const db = await getCrmDb(req);
      const id = uid('act');
      await db.run("INSERT INTO activities (id, opportunity_id, contact_id, type, subject, notes, owner_id, activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, opportunity_id || null, contact_id || null, type || 'note', subject.trim(), notes || null, req.crmUser.id, activity_at || new Date().toISOString()]);
      broadcastSSE('crm_data_changed', { type: 'activity' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/activities/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM activities WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── TASKS ────────────────────────────────────────────────────────────
  app.get('/api/crm/tasks', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const status = req.query.status;
      const ownerId = req.query.owner_id;
      let sql = "SELECT t.*, u.name AS owner_name, o.title AS opportunity_title FROM tasks t LEFT JOIN users u ON u.id = t.owner_id LEFT JOIN opportunities o ON o.id = t.related_id AND t.related_type = 'opportunity'";
      const cond = []; const params = [];
      if (status && status !== 'all') { cond.push("t.status = ?"); params.push(status); }
      if (ownerId && ownerId !== 'all') { cond.push("t.owner_id = ?"); params.push(ownerId); }
      if (cond.length) sql += " WHERE " + cond.join(' AND ');
      sql += " ORDER BY t.due_date IS NULL, t.due_date ASC, t.created_at DESC";
      res.json(await db.all(sql, params));
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/tasks', async (req, res) => {
    const { title, priority, due_date, owner_id, related_type, related_id, notes } = req.body;
    if (!title || !String(title).trim()) return badRequest(res, 'Görev başlığı zorunludur.');
    try {
      const db = await getCrmDb(req);
      const id = uid('tsk');
      await db.run("INSERT INTO tasks (id, title, priority, due_date, owner_id, related_type, related_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, title.trim(), priority || 'normal', due_date || null, owner_id || req.crmUser.id, related_type || null, related_id || null, notes || null]);
      broadcastSSE('crm_data_changed', { type: 'task' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/tasks/:id', async (req, res) => {
    const allowed = ['title', 'status', 'priority', 'due_date', 'owner_id', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      if (req.body.status === 'done') fields.push('completed_at = CURRENT_TIMESTAMP');
      if (req.body.status === 'pending') fields.push('completed_at = NULL');
      values.push(req.params.id);
      await db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/tasks/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM tasks WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── OFFERS (Faz 2) ──────────────────────────────────────────────────
  const OFFER_STATUSES = ['draft', 'sent', 'waiting', 'revised', 'approved', 'lost'];
  const OFFER_TRANSITIONS = {
    draft: ['sent', 'approved', 'lost', 'revised'],
    sent: ['waiting', 'approved', 'lost', 'revised'],
    waiting: ['sent', 'approved', 'lost', 'revised'],
    revised: ['sent', 'approved', 'lost', 'waiting'],
    approved: [],
    lost: []
  };
  const OFFER_CATEGORIES = ['konaklama', 'transfer', 'tekne_yat', 'restoran', 'etkinlik', 'ozel_istek'];

  async function getOfferDetail(db, id) {
    const offer = await db.get("SELECT * FROM offers WHERE id = ?", [id]);
    if (!offer) return null;
    const items = await db.all("SELECT * FROM offer_items WHERE offer_id = ? ORDER BY created_at", [id]);
    const opp = await db.get("SELECT title, pipeline_stage FROM opportunities WHERE id = ?", [offer.opportunity_id]);
    const discount = Number(offer.discount_rate) || 0;
    const tax = Number(offer.tax_rate) || 0;
    const subtotal = items.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
    const afterDiscount = subtotal * (1 - discount / 100);
    const taxAmount = afterDiscount * (tax / 100);
    const total = afterDiscount + taxAmount;
    return {
      ...offer,
      opportunity_title: opp?.title || '—',
      opportunity_stage: opp?.pipeline_stage || null,
      items,
      totals: {
        subtotal,
        discount_amount: subtotal - afterDiscount,
        tax_amount: taxAmount,
        total
      },
      nights: offer.nights ?? computeNights(offer.check_in, offer.check_out)
    };
  }

  function computeNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return null;
    const a = new Date(checkIn), b = new Date(checkOut);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  app.get('/api/crm/offers', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT o.*, op.title AS opportunity_title, (SELECT COUNT(*) FROM offer_items i WHERE i.offer_id = o.id) AS item_count FROM offers o LEFT JOIN opportunities op ON op.id = o.opportunity_id ORDER BY o.created_at DESC LIMIT 200");
      const withTotals = await Promise.all(rows.map(async o => {
        const detail = await getOfferDetail(db, o.id);
        return { ...o, totals: detail?.totals || null };
      }));
      res.json(withTotals);
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/offers', async (req, res) => {
    const { opportunity_id, title, currency, discount_rate, tax_rate, valid_until, check_in, check_out, guests, room_type, board_type, commission_rate, notes } = req.body;
    if (!opportunity_id || !title) return badRequest(res, 'Fırsat ve teklif başlığı zorunludur.');
    try {
      const db = await getCrmDb(req);
      const opp = await db.get("SELECT id FROM opportunities WHERE id = ?", [opportunity_id]);
      if (!opp) return json(res, 404, { error: 'Fırsat bulunamadı.' });
      const existing = await db.get("SELECT COUNT(*) AS cnt FROM offers WHERE opportunity_id = ?", [opportunity_id]);
      const version = Number(existing.cnt) + 1;
      const id = uid('ofr');
      const nights = req.body.nights ?? computeNights(check_in, check_out);
      await db.run(
        "INSERT INTO offers (id, opportunity_id, version, title, status, currency, discount_rate, tax_rate, valid_until, check_in, check_out, nights, guests, room_type, board_type, commission_rate, notes) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, opportunity_id, version, title.trim(), currency || 'EUR', Number(discount_rate) || 0, Number(tax_rate) || 0, valid_until || null, check_in || null, check_out || null, nights || null, Number(guests) || null, room_type || null, board_type || null, Number(commission_rate) || 0, notes || null]);
      await db.run("UPDATE opportunities SET pipeline_stage = 'offer', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND pipeline_stage NOT IN ('won','lost')", [opportunity_id]);
      broadcastSSE('crm_data_changed', { type: 'offer' });
      res.json({ success: true, id, version });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.get('/api/crm/offers/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const offer = await getOfferDetail(db, req.params.id);
      if (!offer) return json(res, 404, { error: 'Teklif bulunamadı.' });
      const versions = await db.all("SELECT id, version, title, status, created_at FROM offers WHERE opportunity_id = ? ORDER BY version DESC", [offer.opportunity_id]);
      res.json({ ...offer, versions });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/offers/:id', async (req, res) => {
    const allowed = ['title', 'currency', 'discount_rate', 'tax_rate', 'valid_until', 'check_in', 'check_out', 'nights', 'guests', 'room_type', 'board_type', 'commission_rate', 'notes'];
    const fields = []; const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (req.body.check_in !== undefined || req.body.check_out !== undefined) {
      const current = await (await getCrmDb(req)).get("SELECT check_in, check_out FROM offers WHERE id = ?", [req.params.id]);
      const checkIn = req.body.check_in ?? current.check_in;
      const checkOut = req.body.check_out ?? current.check_out;
      const nights = req.body.nights ?? computeNights(checkIn, checkOut);
      if (!req.body.nights) { fields.push('nights = ?'); values.push(nights); }
    }
    if (!fields.length) return badRequest(res, 'Güncellenecek alan yok.');
    try {
      const db = await getCrmDb(req);
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id);
      await db.run(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/offers/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!OFFER_STATUSES.includes(status)) return badRequest(res, 'Geçersiz teklif durumu.');
    if (status === 'lost' && !req.body.lost_reason) return badRequest(res, 'Kaybedilen teklif için kayıp nedeni zorunludur (fiyat, tarih, müsaitlik, rakip, cevap_yok).');
    try {
      const db = await getCrmDb(req);
      const offer = await db.get("SELECT * FROM offers WHERE id = ?", [req.params.id]);
      if (!offer) return json(res, 404, { error: 'Teklif bulunamadı.' });
      if (offer.status !== status && !OFFER_TRANSITIONS[offer.status]?.includes(status)) {
        return json(res, 409, { error: `Geçersiz teklif durumu geçişi: ${offer.status} -> ${status}` });
      }
      await db.run("UPDATE offers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, offer.id]);
      if (status === 'approved') {
        await db.run("UPDATE opportunities SET pipeline_stage = 'won', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [offer.opportunity_id]);
        const opp = await db.get("SELECT lead_id FROM opportunities WHERE id = ?", [offer.opportunity_id]);
        if (opp?.lead_id) await db.run("UPDATE leads SET status = 'converted' WHERE id = ?", [opp.lead_id]);
      }
      if (status === 'lost') {
        await db.run("UPDATE opportunities SET pipeline_stage = 'lost', lost_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.body.lost_reason || 'cevap_yok', offer.opportunity_id]);
      }
      broadcastSSE('crm_data_changed', { type: 'offer' });
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.post('/api/crm/offers/:id/revision', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const source = await db.get("SELECT * FROM offers WHERE id = ?", [req.params.id]);
      if (!source) return json(res, 404, { error: 'Teklif bulunamadı.' });
      const maxVer = await db.get("SELECT MAX(version) AS m FROM offers WHERE opportunity_id = ?", [source.opportunity_id]);
      const newVersion = Number(maxVer.m || source.version) + 1;
      const id = uid('ofr');
      await db.run(
        "INSERT INTO offers (id, opportunity_id, version, title, status, currency, discount_rate, tax_rate, valid_until, check_in, check_out, nights, guests, room_type, board_type, commission_rate, notes) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, source.opportunity_id, newVersion, `${source.title} (Rev. ${newVersion})`, source.currency || 'EUR', source.discount_rate || 0, source.tax_rate || 0, source.valid_until || null, source.check_in || null, source.check_out || null, source.nights || null, source.guests || null, source.room_type || null, source.board_type || null, source.commission_rate || 0, source.notes || null]);
      const items = await db.all("SELECT * FROM offer_items WHERE offer_id = ?", [source.id]);
      for (const item of items) {
        const itemId = uid('itm');
        await db.run("INSERT INTO offer_items (id, offer_id, category, description, qty, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [itemId, id, item.category, item.description, item.qty, item.unit_price, item.total_price]);
      }
      broadcastSSE('crm_data_changed', { type: 'offer' });
      res.json({ success: true, id, version: newVersion });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/offers/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM offer_items WHERE offer_id = ?", [req.params.id]);
      await db.run("DELETE FROM offers WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── OFFER ITEMS ─────────────────────────────────────────────────────
  app.post('/api/crm/offers/:id/items', async (req, res) => {
    const { category, description, qty, unit_price } = req.body;
    if (!description || !String(description).trim()) return badRequest(res, 'Kalem açıklaması zorunludur.');
    try {
      const db = await getCrmDb(req);
      const offer = await db.get("SELECT id FROM offers WHERE id = ?", [req.params.id]);
      if (!offer) return json(res, 404, { error: 'Teklif bulunamadı.' });
      const quantity = Number(qty) || 1;
      const price = Number(unit_price) || 0;
      const id = uid('itm');
      await db.run("INSERT INTO offer_items (id, offer_id, category, description, qty, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, req.params.id, category || 'konaklama', description.trim(), quantity, price, quantity * price]);
      await db.run("UPDATE offers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
      broadcastSSE('crm_data_changed', { type: 'offer' });
      res.json({ success: true, id });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.patch('/api/crm/offer-items/:id', async (req, res) => {
    const { category, description, qty, unit_price } = req.body;
    try {
      const db = await getCrmDb(req);
      const item = await db.get("SELECT * FROM offer_items WHERE id = ?", [req.params.id]);
      if (!item) return json(res, 404, { error: 'Kalem bulunamadı.' });
      const quantity = req.body.qty !== undefined ? Number(req.body.qty) : Number(item.qty);
      const price = req.body.unit_price !== undefined ? Number(req.body.unit_price) : Number(item.unit_price);
      await db.run(
        "UPDATE offer_items SET category = ?, description = ?, qty = ?, unit_price = ?, total_price = ? WHERE id = ?",
        [req.body.category ?? item.category, req.body.description ?? item.description, quantity, price, quantity * price, req.params.id]);
      await db.run("UPDATE offers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [item.offer_id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  app.delete('/api/crm/offer-items/:id', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      await db.run("DELETE FROM offer_items WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── INTEGRATION LOGS (Faz 3 hazırlık) ────────────────────────────────
  app.get('/api/crm/integration-logs', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT * FROM integration_logs ORDER BY created_at DESC LIMIT 100");
      res.json(rows);
    } catch (err) { json(res, 500, { error: err.message }); }
  });

  // ─── SEARCH (global) ──────────────────────────────────────────────────
  app.get('/api/crm/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ firms: [], contacts: [], leads: [], opportunities: [] });
    try {
      const db = await getCrmDb(req);
      const like = `%${q}%`;
      const [firms, contacts, leads, opportunities] = await Promise.all([
        db.all("SELECT id, name, city, type FROM firms WHERE name LIKE ? OR city LIKE ? LIMIT 10", [like, like]),
        db.all("SELECT id, first_name || ' ' || last_name AS name, email, phone FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? LIMIT 10", [like, like, like]),
        db.all("SELECT id, source, status, notes FROM leads WHERE notes LIKE ? LIMIT 10", [like]),
        db.all("SELECT id, title, pipeline_stage, amount FROM opportunities WHERE title LIKE ? LIMIT 10", [like])
      ]);
      res.json({ firms, contacts, leads, opportunities });
    } catch (err) { json(res, 500, { error: err.message }); }
  });
}
