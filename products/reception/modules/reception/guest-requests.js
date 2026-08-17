import { id, json } from './helpers.js';

const RECEPTION_REQUEST_TYPES = new Set([
  'waiter_call',
  'bill_call',
  'room_service_call',
  'towel_request',
  'cleaning_request',
  'linen_request',
  'amenity_request',
  'maintenance_request',
  'water_request',
  'transport_request',
  'room_dnd_change'
]);

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'rejected']);
const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);

async function normalizeTargetIdentifier(db, value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('Room-')) {
    const requested = raw.slice('Room-'.length).trim();
    const exact = await db.get('SELECT room_number FROM rooms WHERE room_number = ?', [requested]);
    if (exact) return `Room-${exact.room_number}`;
    const number = requested.match(/^\d+/)?.[0];
    if (number) {
      const room = await db.get('SELECT room_number FROM rooms WHERE room_number LIKE ?', [`${number} %`]);
      if (room) return `Room-${room.room_number}`;
    }
    return null;
  }

  if (raw.startsWith('Table-')) {
    const requested = raw.slice('Table-'.length).trim();
    const exact = await db.get('SELECT table_number FROM tables WHERE table_number = ?', [requested]);
    if (exact) return `Table-${exact.table_number}`;
    const number = requested.match(/\d+/)?.[0];
    if (number) {
      const table = await db.get('SELECT table_number FROM tables WHERE table_number LIKE ?', [`%${number}`]);
      if (table) return `Table-${table.table_number}`;
    }
  }

  return null;
}

function bridgeAuthorized(req) {
  const expected = String(process.env.RECEPTION_MODULE_TOKEN || '').trim();
  const received = String(req.get('x-aeon-module-token') || '').trim();
  return Boolean(expected && received && expected === received);
}

function requestDetails(value) {
  if (typeof value === 'string') return value.trim().slice(0, 2000);
  return json(value).slice(0, 2000);
}

async function createReceptionRequest(req, eventBus, { bridged = false } = {}) {
  const { type } = req.body || {};
  if (!RECEPTION_REQUEST_TYPES.has(type)) {
    const error = new Error('Bu istek resepsiyon modülünde desteklenmiyor.');
    error.statusCode = 400;
    throw error;
  }

  const target = await normalizeTargetIdentifier(req.db, req.body?.target_identifier);
  if (!target) {
    const error = new Error('Geçerli oda veya masa hedefi bulunamadı.');
    error.statusCode = 404;
    throw error;
  }

  const requestId = String(req.body?.request_id || req.body?.requestId || '').trim() || id('req');
  if (requestId.length > 120) {
    const error = new Error('İstek kimliği çok uzun.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await req.db.get('SELECT id, status, total_amount, payment_method FROM requests WHERE id = ?', [requestId]);
  if (existing) {
    return { success: true, requestId: existing.id, totalAmount: Number(existing.total_amount || 0), payment_method: existing.payment_method || null, idempotent: true };
  }

  const createdBy = bridged ? 'Misafir QR · AEON Restaurant & Kitchen' : (req.actor?.name || 'Misafir QR');
  const details = requestDetails(req.body?.details) || 'Misafir talebi';

  await req.db.run(
    'INSERT INTO requests (id, type, department, target_identifier, status, details, total_amount, payment_method, created_by) VALUES (?, ?, \'Reception\', ?, \'pending\', ?, 0, NULL, ?)',
    [requestId, type, target, details, createdBy]
  );

  await eventBus.emit('request_created', {
    tenantId: req.tenantId,
    requestId,
    type,
    target_identifier: target,
    status: 'pending',
    details,
    departments: ['Reception'],
    source: bridged ? 'restaurant-kitchen-module' : 'reception-module'
  });

  await eventBus.emit('staff_push', {
    tenantId: req.tenantId,
    payload: {
      title: 'Yeni Misafir Talebi',
      body: `${target} · ${details}`,
      url: `/reception?tenant_id=${encodeURIComponent(req.tenantId)}`,
      tag: requestId,
      requestId,
      type,
      target_identifier: target
    },
    targetRoles: [],
    targetDepartments: ['Reception']
  });

  return { success: true, requestId, totalAmount: 0, payment_method: null, forwardedTo: 'reception' };
}

export function registerGuestRequestRoutes({ app, eventBus }) {
  app.post('/api/module/guest-requests', async (req, res) => {
    if (!bridgeAuthorized(req)) return res.status(401).json({ error: 'Modül bağlantı yetkisi geçersiz.' });
    try {
      const result = await createReceptionRequest(req, eventBus, { bridged: true });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post('/api/requests', async (req, res) => {
    try {
      const result = await createReceptionRequest(req, eventBus);
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get('/api/requests', async (req, res) => {
    try {
      const rows = await req.db.all('SELECT * FROM requests ORDER BY created_at DESC LIMIT 200');
      const scope = String(req.query.scope || 'all').toLocaleLowerCase('tr-TR');
      const filtered = scope === 'active'
        ? rows.filter(row => ACTIVE_STATUSES.has(String(row.status || '').toLocaleLowerCase('tr-TR')))
        : scope === 'history'
          ? rows.filter(row => TERMINAL_STATUSES.has(String(row.status || '').toLocaleLowerCase('tr-TR')))
          : rows;
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/requests/status', async (req, res) => {
    const requestId = String(req.body?.requestId || req.body?.id || '').trim();
    const status = String(req.body?.status || '').trim().toLocaleLowerCase('tr-TR');
    if (!requestId || !['pending', 'in_progress', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Geçerli istek kimliği ve durum zorunludur.' });
    }

    try {
      const request = await req.db.get('SELECT * FROM requests WHERE id = ?', [requestId]);
      if (!request) return res.status(404).json({ error: 'Talep bulunamadı.' });
      if (request.status === status) return res.json({ success: true, status, idempotent: true });

      const completedAt = TERMINAL_STATUSES.has(status) ? new Date().toISOString() : null;
      const completedBy = TERMINAL_STATUSES.has(status) ? (req.actor?.name || 'Resepsiyon') : null;
      await req.db.run('UPDATE requests SET status = ?, completed_at = ?, completed_by = ? WHERE id = ?', [status, completedAt, completedBy, requestId]);
      await eventBus.emit('request_updated', { tenantId: req.tenantId, requestId, type: request.type, target_identifier: request.target_identifier, status });
      res.json({ success: true, status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/requests/:id', async (req, res) => {
    const note = String(req.body?.note || '').trim();
    if (!note || note.length > 2000) return res.status(400).json({ error: 'Geçerli bir talep notu girin.' });
    try {
      const request = await req.db.get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
      if (!request) return res.status(404).json({ error: 'Talep bulunamadı.' });
      const details = requestDetails(request.details);
      const nextDetails = `${details}\n${note}`.slice(0, 2000);
      await req.db.run('UPDATE requests SET details = ? WHERE id = ?', [nextDetails, request.id]);
      await eventBus.emit('request_updated', { tenantId: req.tenantId, requestId: request.id, type: request.type, target_identifier: request.target_identifier, status: request.status });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
