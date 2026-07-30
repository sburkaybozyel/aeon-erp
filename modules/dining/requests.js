import { syncMenuAvailability } from './menu.js';
import { refreshTableStatus } from './tables.js';
import { restoreRequestInventory, validateTerminalProduction, syncProductionTickets, getProductionTickets } from './production.js';
import { initRequestCreate } from './requests-create.js';

const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';
const requestDepartmentsReady = new WeakSet();

  async function ensureRequestDepartments(db) {
    if (requestDepartmentsReady.has(db)) return;
    try { await db.run('ALTER TABLE requests ADD COLUMN departments TEXT'); } catch (error) {}
    requestDepartmentsReady.add(db);
  }

  function getRequestDepartments(request) {
    if (request.departments) {
      try {
        const parsed = typeof request.departments === 'string' ? JSON.parse(request.departments) : request.departments;
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (error) {}
    }
    const departments = new Set([request.department || 'Reception']);
    if (request.type === 'order') {
      if (request.target_identifier?.startsWith('Room-')) {
        departments.add(request.department === 'Bar' ? 'Bar' : 'Kitchen');
        departments.add('Restaurant');
      } else {
        departments.add('Restaurant');
      }
    }
    if (request.type === 'waiter_call' || request.type === 'bill_call') departments.add('Restaurant');
    return Array.from(departments);
  }

  async function normalizeTargetIdentifier(db, targetIdentifier) {
    if (typeof targetIdentifier !== 'string') return targetIdentifier;
    const raw = targetIdentifier.trim();
    if (raw.startsWith('Room-')) {
      const requested = raw.slice('Room-'.length).trim();
      const exact = await db.get('SELECT room_number FROM rooms WHERE room_number = ?', [requested]);
      if (exact) return `Room-${exact.room_number}`;
      const number = requested.match(/^\d+/)?.[0];
      if (number) {
        const room = await db.get('SELECT room_number FROM rooms WHERE room_number LIKE ?', [`${number} %`]);
        if (room) return `Room-${room.room_number}`;
      }
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
    return raw;
  }

export function initRequests({ app, eventBus, broadcastSSE }) {
  app.get('/api/guest/requests', async (req, res) => {
    try {
      const target = await normalizeTargetIdentifier(req.db, String(req.query.target || ''));
      if (!target || (!target.startsWith('Room-') && !target.startsWith('Table-'))) return res.status(400).json({ error: 'Geçerli QR hedefi zorunludur.' });
      const requests = await req.db.all("SELECT id, type, status, details, total_amount, created_at FROM requests WHERE target_identifier = ? AND created_by = 'Misafir QR' AND type = 'order' ORDER BY created_at DESC LIMIT 12", [target]);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/requests', async (req, res) => {
    try {
      const requests = await req.db.all("SELECT * FROM requests ORDER BY created_at DESC");
      const scope = String(req.query.scope || 'all').toLocaleLowerCase('tr-TR');
      const terminalStatuses = new Set(['completed', 'paid', 'delivered', 'cancelled', 'rejected']);
      const actorRole = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
      const actorDepartment = String(req.actor?.department || '').toLocaleLowerCase('tr-TR');
      const canSeeAll = ['admin', 'manager', 'yönetici'].includes(actorRole) || ['reception', 'resepsiyon'].includes(actorDepartment);
      const visible = canSeeAll ? requests : requests.filter(request => {
        const departments = getRequestDepartments(request).map(value => String(value).toLocaleLowerCase('tr-TR'));
        return departments.includes(actorDepartment) || departments.includes(actorRole);
      });
      const scoped = scope === 'active'
        ? visible.filter(request => !terminalStatuses.has(String(request.status || '').toLocaleLowerCase('tr-TR')))
        : scope === 'history'
          ? visible.filter(request => terminalStatuses.has(String(request.status || '').toLocaleLowerCase('tr-TR')))
          : visible;
      res.json(scoped.map(request => ({ ...request, departments: getRequestDepartments(request) })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  initRequestCreate({ app, eventBus, broadcastSSE, normalizeTargetIdentifier, ensureRequestDepartments });

  app.post('/api/requests/status', async (req, res) => {
    const { requestId, status, completed_by, reason, payment_method } = req.body;
    try {
      const actorName = req.actor?.name || completed_by || 'Operasyon';
      const request = await req.db.get("SELECT * FROM requests WHERE id = ?", [requestId]);
      if (!request) return res.status(404).json({ error: 'Talep bulunamadı.' });
      const requestedStatus = String(status || '');
      const roomDelivery = request.type === 'order' && request.target_identifier.startsWith('Room-') && requestedStatus === 'served';
      const effectiveStatus = roomDelivery ? 'completed' : requestedStatus;
      if (request.status === effectiveStatus) return res.json({ success: true, status: effectiveStatus });
      const orderTransitions = {
        pending: ['accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'rejected'],
        accepted: ['preparing', 'cancelled', 'rejected'],
        preparing: ['ready', 'cancelled', 'rejected'],
        ready: ['served', 'completed', 'cancelled', 'rejected'],
        served: ['paid', 'completed'],
        delivered: ['paid', 'completed'],
        completed: [],
        paid: [],
        cancelled: [],
        rejected: []
      };
      const taskTransitions = {
        pending: ['accepted', 'in_progress', 'completed', 'cancelled', 'rejected'],
        accepted: ['in_progress', 'completed', 'cancelled', 'rejected'],
        in_progress: ['completed', 'blocked', 'cancelled'],
        blocked: ['in_progress', 'completed', 'cancelled'],
        completed: [],
        cancelled: [],
        rejected: []
      };
      const transitions = request.type === 'order' ? orderTransitions : taskTransitions;
      if (request.status !== requestedStatus && request.status !== effectiveStatus && !transitions[request.status]?.includes(requestedStatus)) {
        return res.status(409).json({ error: `Geçersiz istek durumu geçişi: ${request.status} -> ${requestedStatus}` });
      }
      let effectivePaymentMethod = payment_method || request.payment_method || null;
      if (['completed', 'paid'].includes(effectiveStatus) && request.type === 'order' && request.target_identifier.startsWith('Table-')) {
        return res.status(409).json({ error: 'Masa siparişini tamamlamak için /api/tables/settle ödeme akışını kullanın.' });
      }

      if (request.type === 'order') {
        if (['served', 'completed', 'paid'].includes(effectiveStatus)) {
          const production = await validateTerminalProduction(req.db, request);
          if (!production.valid) {
            return res.status(409).json({ error: 'Teslim veya ödeme için tüm yemek ve içecek miktarlarının üretim biletleri eksiksiz ve hazır olmalıdır.' });
          }
          await syncProductionTickets(req.db, requestId, effectiveStatus, actorName);
        } else if (['cancelled', 'rejected'].includes(effectiveStatus)) {
          const tickets = await getProductionTickets(req.db, requestId);
          if (tickets.some(ticket => ['served', 'completed'].includes(ticket.status))) {
            return res.status(409).json({ error: 'Teslim edilmiş üretim kalemleri iptal edilemez.' });
          }
          await syncProductionTickets(req.db, requestId, effectiveStatus, actorName);
        } else if (['accepted', 'preparing', 'ready'].includes(effectiveStatus)) {
          // The restaurant screen's own progress buttons post here directly (not through
          // /api/kitchen/tickets or /api/bar/orders), so without this branch the request row
          // advanced while kitchen_ticket_lines/bar_ticket_lines stayed pending — the KDS board
          // never moved, and delivery later 409'd on validateTerminalProduction with no visible
          // explanation of why. syncProductionTickets already supports these statuses (used by
          // the kitchen/bar endpoints); it just wasn't being called from this route for them.
          await syncProductionTickets(req.db, requestId, effectiveStatus, actorName);
        }
      }

      let updatedDetails = request.details;
      if (['cancelled', 'rejected'].includes(effectiveStatus) && reason) {
        try {
          const items = JSON.parse(request.details);
          if (Array.isArray(items)) {
            items.push({ name: `[İPTAL SEBEBİ: ${reason}]`, quantity: '-' });
            updatedDetails = JSON.stringify(items);
          } else {
            updatedDetails += `\n[İPTAL SEBEBİ: ${reason}]`;
          }
        } catch(e) {
          updatedDetails += `\n[İPTAL SEBEBİ: ${reason}]`;
        }
      }

      if (['completed', 'paid', 'cancelled', 'rejected'].includes(effectiveStatus)) {
        await req.db.run("UPDATE requests SET status = ?, details = ?, completed_at = CURRENT_TIMESTAMP, completed_by = ?, payment_method = COALESCE(?, payment_method) WHERE id = ?", [effectiveStatus, updatedDetails, actorName, effectivePaymentMethod, requestId]);
      } else {
        await req.db.run("UPDATE requests SET status = ?, details = ?, completed_by = ? WHERE id = ?", [effectiveStatus, updatedDetails, actorName, requestId]);
      }

      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      const staffName = actorName;
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staffName, 'İstek Durumu Güncellendi', `İstek ID: #${requestId}, Tip: ${request.type}, Yeni Durum: ${effectiveStatus}, Hedef: ${request.target_identifier}`]
      );

      await eventBus.emit('staff_push', {
        tenantId: req.tenantId,
        targetRoles: [],
        targetDepartments: getRequestDepartments(request),
        payload: {
          title: 'Sipariş Durumu Güncellendi',
          body: `${request.target_identifier} - ${effectiveStatus}`,
          url: `/login.html?tenant_id=${req.tenantId}&inbox=orders`,
          tag: `${requestId}-${effectiveStatus}`,
          requestId,
          type: request.type,
          status: effectiveStatus
        }
      });

      const tableUpdate = await refreshTableStatus(req.db, request.target_identifier);
      if (tableUpdate) broadcastSSE && broadcastSSE(req.tenantId, 'table_updated', tableUpdate);
      broadcastSSE && broadcastSSE(req.tenantId, 'request_updated', { requestId, status: effectiveStatus });
      if (['cancelled', 'rejected'].includes(effectiveStatus) && request.type === 'order') {
        await restoreRequestInventory(req.db, request, actorName);
      }
      if (['cancelled', 'rejected'].includes(effectiveStatus) && request.type === 'order' && request.target_identifier.startsWith('Room-') && request.payment_method === 'room_charge') {
        await eventBus.emit('room_charge_reversal_request', {
          tenantId: req.tenantId,
          requestId,
          createdBy: actorName,
          reason: reason || effectiveStatus
        });
      }
      if (['completed', 'paid'].includes(effectiveStatus) && request.type === 'order' && request.target_identifier.startsWith('Room-')) {
        await eventBus.emit('order_delivered_to_room', {
          tenantId: req.tenantId,
          targetIdentifier: request.target_identifier,
          requestId
        });
        broadcastSSE && broadcastSSE(req.tenantId, 'room_updated', { target: request.target_identifier });
      }

      res.json({ success: true, status: effectiveStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/requests/:id', async (req, res) => {
    const requestId = req.params.id;
    const note = String(req.body?.note || '').trim();
    if (note.length > 500) return res.status(400).json({ error: 'Sipariş notu en fazla 500 karakter olabilir.' });
    try {
      const request = await req.db.get('SELECT * FROM requests WHERE id = ?', [requestId]);
      if (!request) return res.status(404).json({ error: 'Sipariş/İstek bulunamadı.' });
      if (!['pending', 'accepted'].includes(request.status)) return res.status(409).json({ error: 'Yalnız henüz hazırlanmamış kayıtlar düzenlenebilir.' });
      let details = note;
      if (request.type === 'order') {
        let items = [];
        try { items = JSON.parse(request.details || '[]'); } catch (error) {}
        if (!Array.isArray(items)) return res.status(409).json({ error: 'Sipariş kalemleri düzenlenebilir biçimde değil.' });
        details = JSON.stringify(items.map((item, index) => index === 0 ? { ...item, service_note: note } : item));
      }
      await req.db.run('UPDATE requests SET details = ?, completed_by = ? WHERE id = ?', [details, req.actor?.name || 'Operasyon', requestId]);
      await req.db.run('INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)', ['log_' + Math.random().toString(36).slice(2, 11), req.actor?.name || 'Operasyon', 'Sipariş/İstek Düzenlendi', `İstek #${requestId} notu güncellendi.`]);
      broadcastSSE && broadcastSSE(req.tenantId, 'request_updated', { requestId, status: request.status });
      res.json({ success: true, requestId, note });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/requests/:id', async (req, res) => {
    const requestId = req.params.id;
    const staffName = req.actor?.name || req.body?.staff_name || req.query?.staff_name || req.body?.completed_by || 'Operasyon';
    try {
      const request = await req.db.get("SELECT * FROM requests WHERE id = ?", [requestId]);
      if (!request) return res.status(404).json({ error: 'Sipariş/İstek bulunamadı.' });

      if (request.type === 'order' && ENABLE_STOCK_ALGORITHM) {
        try {
          await restoreRequestInventory(req.db, request, staffName);
        } catch (e) {
          console.error('[StockRestoreError]', e);
        }
      }

      // Deleting a room-charge order must reverse the folio debit the same way cancelling one
      // does (see /api/requests/status above) — otherwise the guest stays charged for an order
      // that no longer exists anywhere, with nothing left to explain the amount.
      if (request.type === 'order' && request.target_identifier.startsWith('Room-') && request.payment_method === 'room_charge') {
        await eventBus.emit('room_charge_reversal_request', {
          tenantId: req.tenantId,
          requestId,
          createdBy: staffName,
          reason: 'deleted'
        });
      }

      await req.db.run("DELETE FROM kitchen_ticket_lines WHERE request_id = ?", [requestId]);
      await req.db.run("DELETE FROM bar_ticket_lines WHERE request_id = ?", [requestId]);
      await req.db.run("DELETE FROM requests WHERE id = ?", [requestId]);

      const logId = 'log_' + Math.random().toString(36).substring(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staffName, 'Sipariş/İstek Silindi', `İstek #${requestId} (${request.target_identifier}, ${request.type}) ${staffName} tarafından silindi.`]
      );

      await syncMenuAvailability(req.db);
      const tableUpdate = await refreshTableStatus(req.db, request.target_identifier);
      if (tableUpdate) broadcastSSE && broadcastSSE(req.tenantId, 'table_updated', tableUpdate);
      broadcastSSE && broadcastSSE(req.tenantId, 'request_deleted', { requestId, deleted_by: staffName });

      res.json({ success: true, message: 'Sipariş/İstek silindi.', deleted_by: staffName });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
}
