import webpush from 'web-push';
import { getDb } from '../db.js';
import { eventBus, hookRegistry } from '../lib/event-bus.js';
import { sseClients, broadcastSSE } from '../server-middleware.js';
import { VAPID_PUBLIC_KEY } from '../server-config.js';

// Operations context, SSE, push notifications, payment methods and the admin
// dashboard, extracted verbatim from server.js — no behavior change.

function getWorkflowDepartments(request) {
  if (request.departments) {
    try {
      const parsed = JSON.parse(request.departments);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {}
  }
  const departments = new Set([request.department || 'Reception']);
  if (request.type === 'order') {
    departments.add('Kitchen');
    departments.add('Restaurant');
  }
  if (request.type === 'waiter_call' || request.type === 'bill_call') departments.add('Restaurant');
  return Array.from(departments);
}

async function sendStaffPush(tenantId, payload, targetRoles = [], targetDepartments = [], targetStaffIds = []) {
  const result = { attempted: 0, sent: 0, failed: 0, removed: 0, error: null, statusCode: null };
  try {
    const db = await getDb(tenantId || 'reception');
    const rows = await db.all("SELECT * FROM push_subscriptions");
    await Promise.all(rows.map(async row => {
      const normalize = value => String(value || '').trim().toLocaleLowerCase('tr-TR');
      const matchesRole = targetRoles.some(role => normalize(role) === normalize(row.role));
      const matchesDepartment = targetDepartments.some(department => normalize(department) === normalize(row.department));
      const matchesAudience = targetRoles.length === 0 && targetDepartments.length === 0 || matchesRole || matchesDepartment;
      const matchesStaff = targetStaffIds.length === 0 || targetStaffIds.includes(row.staff_id);
      if (matchesAudience && matchesStaff) {
        result.attempted += 1;
        try {
          await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
          result.sent += 1;
        } catch (err) {
          result.failed += 1;
          result.error = String(err?.message || err || 'unknown_push_error');
          result.statusCode = Number(err?.statusCode || err?.status || 0) || null;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [row.endpoint]);
            result.removed += 1;
          } else {
            console.error('Push notification failed:', err.message);
          }
        }
      }
    }));
  } catch (err) {
    console.error('Push dispatch failed:', err);
    result.failed += 1;
    result.error = String(err?.message || err || 'unknown_push_error');
  }
  return result;
}

eventBus.on('staff_push', data => {
  const { tenantId, payload, targetRoles, targetDepartments } = data;
  // Must return this promise (not fire-and-forget) — EventBus.emit awaits every listener via
  // Promise.all, and callers await emit('staff_push', ...) before sending their HTTP response.
  // On Cloudflare Workers, an un-returned/un-awaited async call left running after the response
  // is sent can simply be killed mid-flight (no persistent Node process keeping it alive), which
  // is why real push deliveries were silently dropped even though sendStaffPush() itself was
  // correct — the network calls to the push service never got the chance to finish.
  return sendStaffPush(tenantId, payload, targetRoles, targetDepartments).catch(console.error);
});

eventBus.on('precheckin_submitted', data => {
  const tenantId = data.tenantId || 'reception';
  broadcastSSE(tenantId, 'precheckin_submitted', data);
  // Returned (not fire-and-forget) — see the comment on the 'staff_push' listener above for why:
  // an un-returned async push send can be killed mid-flight once the Worker's response is sent.
  return sendStaffPush(tenantId, {
    title: 'Yeni QR ön giriş formu',
    body: `${data.guestName || 'Misafir'} bilgilerini resepsiyona gönderdi.`,
    url: `/staff-reception.html?tenant_id=${encodeURIComponent(tenantId)}`,
    tag: `precheckin-${data.id || Date.now()}`,
    type: 'precheckin_submitted',
    source: data.source || 'qr'
  }, [], ['Reception']).catch(console.error);
});

eventBus.on('room_updated', data => {
  const tenantId = data.tenantId || 'reception';
  broadcastSSE(tenantId, 'room_updated', data);
  return sendStaffPush(tenantId, {
    title: 'Oda Durumu Güncellendi',
    body: `${data.roomId || data.target || 'Oda'}${data.status ? ` · ${data.status}` : ''}`,
    url: `/login.html?tenant_id=${encodeURIComponent(tenantId)}`,
    tag: `room-${data.roomId || data.target || Date.now()}-${data.status || 'updated'}`,
    type: 'room_updated'
  }, [], ['Reception', 'Housekeeping', 'Maintenance']).catch(console.error);
});
eventBus.on('request_created', data => {
  broadcastSSE(data.tenantId || 'reception', 'request_created', data);
});
eventBus.on('request_updated', data => {
  broadcastSSE(data.tenantId || 'reception', 'request_updated', data);
});
eventBus.on('hotelrunner_sync', data => {
  const tenantId = data.tenantId || 'reception';
  const result = data.result || {};
  const count = Number(result.processed || result.imported || result.updated || result.queued || 0);
  return sendStaffPush(tenantId, {
    title: 'Kanal Yöneticisi Güncellemesi',
    body: count ? `${count} kayıt işlendi.` : 'HotelRunner senkronizasyonu tamamlandı.',
    url: `/login.html?tenant_id=${encodeURIComponent(tenantId)}`,
    tag: `hotelrunner-${result.operationId || Date.now()}`,
    type: 'hotelrunner_sync'
  }, [], ['Reception', 'Management']).catch(console.error);
});

export function registerOperationsRoutes(app) {
  // Server-Sent Events endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const tenantId = req.tenantId || 'reception';
    if (!sseClients.has(tenantId)) sseClients.set(tenantId, new Set());
    sseClients.get(tenantId).add(res);

    // Send initial ping
    res.write(': ping\n\n');

    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) { clearInterval(heartbeat); }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const clients = sseClients.get(tenantId);
      if (clients) clients.delete(res);
    });
  });

  app.get('/api/operations/context', async (req, res) => {
    try {
      const [rooms, tables, requests, inventory, catalog, publicAreas] = await Promise.all([
        req.db.all(`
          SELECT r.*, g.first_name AS guest_first_name, g.last_name AS guest_last_name,
            g.car_plate, g.phone,
            CASE WHEN g.id IS NOT NULL THEN trim(g.first_name || ' ' || g.last_name) ELSE r.guest_name END AS canonical_guest_name
          FROM rooms r
          LEFT JOIN guest_registry g ON r.id = g.room_id AND g.checked_out_at IS NULL
          ORDER BY CAST(r.room_number AS INT), r.room_number
        `),
        req.db.all('SELECT * FROM tables ORDER BY table_number'),
        req.db.all('SELECT * FROM requests ORDER BY created_at DESC'),
        req.db.all('SELECT * FROM inventory ORDER BY name'),
        req.db.all('SELECT * FROM catalog_items ORDER BY category, name'),
        req.db.all('SELECT * FROM public_areas ORDER BY name')
      ]);
      const actorRole = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
      const actorDepartment = String(req.actor?.department || '').toLocaleLowerCase('tr-TR');
      const management = ['admin', 'manager', 'yönetici'].includes(actorRole);
      const reception = ['reception', 'resepsiyon'].includes(actorDepartment);
      const dining = ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak'].includes(actorDepartment) || ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak'].includes(actorRole);
      const housekeeping = ['housekeeping', 'kat hizmetleri'].includes(actorDepartment) || ['housekeeping', 'kat hizmetleri'].includes(actorRole);
      const maintenance = ['maintenance', 'teknik'].includes(actorDepartment) || ['maintenance', 'teknik'].includes(actorRole);
      const visibleRequests = management || reception ? requests : requests.filter(request => {
        const departments = getWorkflowDepartments(request).map(value => String(value).toLocaleLowerCase('tr-TR'));
        return departments.includes(actorDepartment) || departments.includes(actorRole);
      });
      const visibleRooms = rooms.map(room => {
        if (management || reception) return { ...room, guest_name: room.canonical_guest_name || room.guest_name || '' };
        const { phone, car_plate, guest_first_name, guest_last_name, canonical_guest_name, guest_name, ...operationalRoom } = room;
        return operationalRoom;
      });
      res.json({
        tenant_id: req.tenantId,
        generated_at: new Date().toISOString(),
        rooms: management || reception || housekeeping || maintenance ? visibleRooms : [],
        tables: management || reception || dining ? tables : [],
        requests: visibleRequests.map(request => ({ ...request, departments: getWorkflowDepartments(request) })),
        inventory: management || dining ? inventory : [],
        catalog: management || dining ? catalog : [],
        publicAreas: management || reception || housekeeping ? publicAreas : []
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'subscription.endpoint is required' });
    }
    if (!req.actor?.id || !req.actor?.department) {
      return res.status(401).json({ error: 'Bildirim kaydı için personel oturumu gereklidir.' });
    }

    try {
      const values = [JSON.stringify(subscription), req.actor?.id || null, req.actor?.name || null, req.actor?.role || null, req.actor?.department || null, subscription.endpoint];
      const existing = await req.db.get("SELECT endpoint FROM push_subscriptions WHERE endpoint = ?", [subscription.endpoint]);
      if (existing) await req.db.run("UPDATE push_subscriptions SET subscription = ?, staff_id = ?, staff_name = ?, role = ?, department = ? WHERE endpoint = ?", values);
      else await req.db.run("INSERT INTO push_subscriptions (subscription, staff_id, staff_name, role, department, endpoint) VALUES (?, ?, ?, ?, ?, ?)", values);
      res.json({ success: true, department: req.actor.department, staff_id: req.actor.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    try {
      await req.db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/push/test', async (req, res) => {
    const managerRoles = new Set(['admin', 'manager', 'yönetici']);
    const allRecipients = req.body?.all === true && managerRoles.has(String(req.actor?.role || '').toLocaleLowerCase('tr-TR'));
    const targetDepartment = managerRoles.has(String(req.actor?.role || '').toLocaleLowerCase('tr-TR')) ? String(req.body?.department || '').trim() : '';
    const result = await sendStaffPush(req.tenantId, {
      title: 'Aeon ERP Bildirim Testi',
      body: 'Bu cihaz gerçek zamanlı sipariş bildirimlerini alabiliyor.',
      url: `/login.html?tenant_id=${encodeURIComponent(req.tenantId)}`,
      tag: `push-test-${Date.now()}`,
      type: 'push_test'
    }, [], targetDepartment ? [targetDepartment] : [], allRecipients ? [] : targetDepartment ? [] : [req.actor.id]);
    result.target_department = targetDepartment || null;
    if (result.sent === 0) return res.status(503).json({ error: result.attempted === 0 ? 'Bu cihaz için bildirim aboneliği bulunamadı.' : 'Bildirim servisi teslimatı doğrulayamadı.', result });
    res.json({ success: true, result });
  });

  // Payment Methods Hook Endpoint
  app.get('/api/payment-methods', async (req, res) => {
    try {
      const defaultMethods = [
        { id: 'cash', name: 'Nakit' },
        { id: 'card', name: 'Kredi Kartı' }
      ];
      const methods = await hookRegistry.call('payment_methods', { db: req.db }, defaultMethods);
      res.json(methods);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/dashboard', async (req, res) => {
    try {
      const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const [rooms, pendingRequests, kitchenQueue, openTables, criticalStock, maintenance, recentAudit, hkTasks, publicAreas, laundry, lostFound, technicalOrders, maintenancePlans, technicalPurchases, kitchenTickets, readyKitchenTickets, disabledMenuItems, receptionStays, receptionTasks, identityNotifications, precheckins, restaurantOrders, folioTransactions, receptionAudit, barTickets, readyBarTickets, criticalBarStock, activeDrinks] = await Promise.all([
        req.db.all("SELECT status, COUNT(*) AS cnt FROM rooms GROUP BY status"),
        req.db.get("SELECT COUNT(*) AS cnt FROM requests WHERE type <> 'order' AND status NOT IN ('completed', 'paid', 'cancelled', 'rejected', 'resolved')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM kitchen_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE l.status IN ('pending', 'accepted', 'preparing', 'ready') AND r.status NOT IN ('completed', 'paid', 'served', 'delivered', 'cancelled', 'rejected')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM tables WHERE status != 'empty'"),
        req.db.all("SELECT id, name, stock, par_level, unit FROM inventory WHERE stock <= par_level ORDER BY stock ASC"),
        req.db.all("SELECT id, target_identifier, status, details, created_at FROM requests WHERE type = 'maintenance_request' AND status != 'resolved' ORDER BY created_at ASC"),
        req.db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50"),
        req.db.get("SELECT COUNT(*) AS cnt FROM reception_tasks WHERE lower(department) = 'housekeeping' AND status <> 'completed'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM public_areas WHERE status <> 'clean'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM laundry_orders WHERE status <> 'delivered'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM lost_and_found WHERE status <> 'claimed'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM technical_work_orders WHERE status <> 'resolved'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM technical_maintenance_plans WHERE active = 1 AND next_due_at <= ?", [new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)]),
        req.db.get("SELECT COUNT(*) AS cnt FROM purchase_requests WHERE status NOT IN ('completed', 'cancelled', 'rejected') AND department = 'Technical'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM kitchen_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE l.status IN ('pending', 'accepted', 'preparing') AND r.status NOT IN ('completed', 'paid', 'served', 'delivered', 'cancelled', 'rejected')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM kitchen_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE l.status = 'ready' AND r.status NOT IN ('completed', 'paid', 'served', 'delivered', 'cancelled', 'rejected')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM menu_kitchen_profiles WHERE active = 0"),
        req.db.get("SELECT COUNT(*) AS cnt FROM stays WHERE status = 'checked_in'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM reception_tasks WHERE status <> 'completed'"),
        req.db.get("SELECT COUNT(*) AS cnt FROM identity_notifications WHERE status IN ('pending', 'rejected', 'manual_review')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM guest_precheckin_submissions WHERE status IN ('submitted', 'reviewed')"),
        req.db.all("SELECT id, status, total_amount, payment_method, created_at, completed_at, target_identifier FROM requests WHERE type = 'order'"),
        req.db.all("SELECT id, transaction_type, related_reference, debit, credit, occurred_at FROM folio_transactions"),
        req.db.all("SELECT actor_name, action, entity_type, entity_id, created_at FROM audit_events ORDER BY created_at DESC LIMIT 50"),
        req.db.get("SELECT COUNT(*) AS cnt FROM bar_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE l.status IN ('pending', 'accepted', 'preparing') AND r.status NOT IN ('completed', 'paid', 'served', 'delivered', 'cancelled', 'rejected')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM bar_ticket_lines l JOIN requests r ON r.id = l.request_id WHERE l.status = 'ready' AND r.status NOT IN ('completed', 'paid', 'served', 'delivered', 'cancelled', 'rejected')"),
        req.db.get("SELECT COUNT(*) AS cnt FROM inventory WHERE module_type = 'bar' AND stock <= par_level"),
        req.db.get("SELECT COUNT(*) AS cnt FROM catalog_items WHERE category = 'drink' AND in_stock <> 0")
      ]);
      const roomState = Object.fromEntries(rooms.map(row => [row.status, Number(row.cnt)]));
      const reversedTransactionIds = new Set(folioTransactions.filter(item => item.transaction_type === 'reversal' && String(item.related_reference || '').startsWith('reversal:')).map(item => String(item.related_reference).slice('reversal:'.length)));
      const activeFolioTransactions = folioTransactions.filter(item => item.transaction_type !== 'reversal' && !reversedTransactionIds.has(item.id));
      const sameBusinessDate = item => String(item.occurred_at || '').slice(0, 10) === businessDate;
      const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);
      const settledRestaurantOrders = restaurantOrders.filter(item => ['completed', 'paid'].includes(String(item.status || '').toLowerCase()));
      const settledDirectRestaurantOrders = settledRestaurantOrders.filter(item => String(item.payment_method || '') !== 'room_charge');
      const activeRestaurantOrders = restaurantOrders.filter(item => !['completed', 'paid', 'cancelled', 'rejected'].includes(String(item.status || '').toLowerCase()));
      const directActiveRestaurantOrders = activeRestaurantOrders.filter(item => String(item.payment_method || '') !== 'room_charge');
      const dailyRestaurantRevenue = sum(settledDirectRestaurantOrders.filter(item => String(item.completed_at || item.created_at || '').slice(0, 10) === businessDate), 'total_amount');
      const dailyFolioAccrual = sum(activeFolioTransactions.filter(sameBusinessDate), 'debit');
      const dailyFolioCollection = sum(activeFolioTransactions.filter(sameBusinessDate), 'credit');
      const totalFolioAccrual = sum(activeFolioTransactions, 'debit');
      const totalFolioCollection = sum(activeFolioTransactions, 'credit');
      const folioReceivables = Math.max(0, totalFolioAccrual - totalFolioCollection);
      const restaurantReceivables = sum(directActiveRestaurantOrders, 'total_amount');
      const activity = [...recentAudit.map(item => ({ actor_name: item.staff_name, action: item.action, details: item.details, created_at: item.created_at })), ...receptionAudit.map(item => ({ actor_name: item.actor_name || 'Resepsiyon', action: item.action, details: `${item.entity_type || 'İşlem'} · ${item.entity_id || ''}`.trim(), created_at: item.created_at }))].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || ''))).slice(0, 50);
      res.json({
        generated_at: new Date().toISOString(),
        business_date: businessDate,
        rooms: roomState,
        open_tasks: Math.max(Number(pendingRequests.cnt || 0), Number(receptionTasks.cnt || 0)),
        kitchen_queue: Number(kitchenQueue.cnt),
        production_queue: Number(kitchenQueue.cnt) + Number(barTickets.cnt),
        open_tables: Number(openTables.cnt),
        critical_stock: criticalStock,
        maintenance,
        receivables: restaurantReceivables + folioReceivables,
        finance: {
          daily_revenue: dailyRestaurantRevenue + dailyFolioCollection,
          daily_restaurant_revenue: dailyRestaurantRevenue,
          daily_folio_accrual: dailyFolioAccrual,
          daily_folio_collection: dailyFolioCollection,
          total_folio_accrual: totalFolioAccrual,
          total_folio_collection: totalFolioCollection,
          folio_receivables: folioReceivables,
          restaurant_receivables: restaurantReceivables
        },
        audit: activity,
        activity,
        operations: {
          reception: { occupied_rooms: Number(receptionStays.cnt || roomState.occupied || 0), dirty_rooms: Number(roomState.dirty_vacant || 0), maintenance_rooms: Number(roomState.maintenance || 0), open_tasks: Number(receptionTasks.cnt || 0), identity_pending: Number(identityNotifications.cnt || 0), precheckins_pending: Number(precheckins.cnt || 0) },
          restaurant: { open_tables: Number(openTables.cnt), open_orders: activeRestaurantOrders.length, open_adisyon: restaurantReceivables, daily_revenue: dailyRestaurantRevenue },
          kitchen: { active_tickets: Number(kitchenTickets.cnt), ready_tickets: Number(readyKitchenTickets.cnt), disabled_menu_items: Number(disabledMenuItems.cnt), critical_stock: criticalStock.length },
          bar: { active_tickets: Number(barTickets.cnt), ready_tickets: Number(readyBarTickets.cnt), critical_stock: Number(criticalBarStock.cnt), active_products: Number(activeDrinks.cnt) },
          housekeeping: { open_tasks: Number(hkTasks.cnt), dirty_areas: Number(publicAreas.cnt), open_laundry: Number(laundry.cnt), lost_found: Number(lostFound.cnt), rooms_in_cleaning: Number(roomState.cleaning || 0) },
          technical: { open_work_orders: Number(technicalOrders.cnt), maintenance_rooms: Number(roomState.maintenance || 0), plans_due_7_days: Number(maintenancePlans.cnt), purchase_requests: Number(technicalPurchases.cnt || 0) }
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Yönetici özeti oluşturulamadı.' });
    }
  });
}
