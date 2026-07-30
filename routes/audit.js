// Audit Logs Endpoints, extracted verbatim from server.js — no behavior change.
export function registerAuditRoutes(app) {
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const logs = await req.db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    const { action, details } = req.body;
    const staff_name = req.actor?.name;
    if (!staff_name || !action) {
      return res.status(400).json({ error: 'action is required' });
    }
    try {
      const id = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [id, staff_name, action, details || '']
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
