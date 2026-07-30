import crypto from 'crypto';

export const barRoles = new Set(['bar', 'barmen', 'bartender']);
export const managementRoles = new Set(['admin', 'manager', 'yönetici']);

export const actorRole = actor => String(actor?.role || '').toLocaleLowerCase('tr-TR');
export const actorDepartment = actor => String(actor?.department || '').toLocaleLowerCase('tr-TR');
// These were unconditional `=> true` stubs — barGuard/managementGuard never actually
// restricted anything, so any authenticated staff member (housekeeping, maintenance, etc.)
// could hit bar write endpoints regardless of role or department.
export const canManage = actor => managementRoles.has(actorRole(actor));
export const canAccess = actor => canManage(actor) || barRoles.has(actorRole(actor)) || actorDepartment(actor) === 'bar';
export const makeId = prefix => `${prefix}_${crypto.randomUUID()}`;
export const validImageUrl = value => !value || /^https?:\/\//i.test(value) || value.startsWith('/images/');

export function barGuard(req, res) {
  if (canAccess(req.actor)) return true;
  res.status(403).json({ error: 'Bu işlem bar yetkisi gerektirir.' });
  return false;
}

export function managementGuard(req, res) {
  if (canManage(req.actor)) return true;
  res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
  return false;
}

export async function resolveTarget(db, value, paymentMethod) {
  const target = String(value || '').trim();
  if (!/^(Table|Room)-.+$/.test(target)) return null;
  if (target.startsWith('Table-')) {
    if (paymentMethod === 'room_charge') return null;
    const table = await db.get('SELECT table_number FROM tables WHERE table_number = ?', [target.slice(6)]);
    return table ? `Table-${table.table_number}` : null;
  }
  if (paymentMethod !== 'room_charge') return null;
  const room = await db.get("SELECT r.room_number FROM rooms r JOIN stays s ON s.room_id = r.id AND s.status = 'checked_in' JOIN folios f ON f.id = s.folio_id AND f.status = 'open' WHERE r.room_number = ? AND r.status = 'occupied'", [target.slice(5)]);
  return room ? `Room-${room.room_number}` : null;
}

export async function saveAudit(db, actor, action, details) {
  await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [makeId('log'), actor?.name || 'Bar', action, details]);
}

export function ticketStatus(value) {
  return ['pending', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'rejected'].includes(value) ? value : 'pending';
}

export async function backfillBarTickets(db) {
  const migration = await db.get("SELECT value FROM config WHERE key = 'BAR_TICKET_BACKFILL_V1'");
  if (migration?.value === 'completed') return;
  const catalog = await db.all("SELECT * FROM catalog_items WHERE category = 'drink'");
  const catalogMap = Object.fromEntries(catalog.map(item => [item.id, item]));
  const requests = await db.all("SELECT * FROM requests WHERE type = 'order' AND status NOT IN ('completed', 'paid', 'cancelled', 'rejected')");
  for (const request of requests) {
    const existingRows = await db.all('SELECT catalog_item_id, quantity FROM bar_ticket_lines WHERE request_id = ?', [request.id]);
    const existingQuantities = {};
    for (const row of existingRows) existingQuantities[row.catalog_item_id] = (existingQuantities[row.catalog_item_id] || 0) + Number(row.quantity || 0);
    let details = [];
    try { details = JSON.parse(request.details || '[]'); } catch (error) {}
    let inserted = false;
    const requiredQuantities = {};
    for (const line of details) {
      const product = catalogMap[line.itemId];
      if (!product) continue;
      requiredQuantities[product.id] = (requiredQuantities[product.id] || 0) + Number(line.quantity || 1);
      const missing = requiredQuantities[product.id] - Number(existingQuantities[product.id] || 0);
      if (missing <= 0) continue;
      await db.run("INSERT INTO bar_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, unit_price, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", [makeId('btl'), request.id, product.id, product.name, missing, Number(line.price ?? product.price)]);
      existingQuantities[product.id] = Number(existingQuantities[product.id] || 0) + missing;
      inserted = true;
    }
    if (inserted && ['accepted', 'preparing', 'ready', 'served'].includes(request.status)) await db.run("UPDATE requests SET status = 'pending', completed_at = NULL WHERE id = ?", [request.id]);
  }
  const markerUpdate = await db.run("UPDATE config SET value = 'completed' WHERE key = 'BAR_TICKET_BACKFILL_V1'");
  if (!markerUpdate.changes) await db.run("INSERT INTO config (key, value) VALUES ('BAR_TICKET_BACKFILL_V1', 'completed')");
}

export async function getBarOrders(db) {
  await backfillBarTickets(db);
  const rows = await db.all("SELECT b.*, r.target_identifier, r.created_by, r.department, r.departments, r.payment_method, r.status AS request_status, r.created_at AS request_created_at, (SELECT COUNT(*) FROM kitchen_ticket_lines k WHERE k.request_id = r.id) AS kitchen_line_count FROM bar_ticket_lines b JOIN requests r ON r.id = b.request_id ORDER BY r.created_at DESC, b.created_at ASC LIMIT 600");
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.request_id)) grouped.set(row.request_id, { id: row.request_id, target_identifier: row.target_identifier, created_by: row.created_by, department: row.department, departments: row.departments, payment_method: row.payment_method, request_status: row.request_status, created_at: row.request_created_at, kitchen_line_count: Number(row.kitchen_line_count || 0), lines: [] });
    grouped.get(row.request_id).lines.push(row);
  }
  return Array.from(grouped.values()).slice(0, 120).map(order => {
    const active = order.lines.filter(line => !['served', 'completed', 'cancelled', 'rejected'].includes(line.status));
    const statuses = active.map(line => line.status);
    const status = statuses.includes('pending') ? 'pending' : statuses.includes('accepted') ? 'accepted' : statuses.includes('preparing') ? 'preparing' : statuses.includes('ready') ? 'ready' : order.lines.every(line => line.status === 'cancelled' || line.status === 'rejected') ? 'cancelled' : order.lines.every(line => ['served', 'completed'].includes(line.status)) ? 'served' : ticketStatus(order.request_status);
    const details = order.lines.map(line => ({ itemId: line.catalog_item_id, name: line.item_name, quantity: Number(line.quantity), price: Number(line.unit_price), ticketId: line.id }));
    return { ...order, status, details: JSON.stringify(details), total_amount: details.reduce((sum, line) => sum + line.price * line.quantity, 0), bar_owned: String(order.department || '').toLocaleLowerCase('tr-TR') === 'bar', bar_editable: Number(order.kitchen_line_count || 0) === 0 };
  });
}

export async function reconcileRequestStatus(db, requestId, actorName) {
  const request = await db.get('SELECT * FROM requests WHERE id = ?', [requestId]);
  if (!request || ['completed', 'paid', 'cancelled', 'rejected'].includes(request.status)) return request?.status;
  const kitchen = await db.all('SELECT status FROM kitchen_ticket_lines WHERE request_id = ?', [requestId]);
  const bar = await db.all('SELECT status FROM bar_ticket_lines WHERE request_id = ?', [requestId]);
  const tickets = [...kitchen, ...bar];
  if (!tickets.length) return request.status;
  const active = tickets.filter(line => !['cancelled', 'rejected'].includes(line.status));
  let status = request.status;
  if (!active.length) status = 'cancelled';
  else if (active.every(line => ['served', 'completed'].includes(line.status))) status = 'served';
  else if (active.every(line => ['ready', 'served', 'completed'].includes(line.status))) status = 'ready';
  else if (active.some(line => ['preparing', 'ready'].includes(line.status))) status = 'preparing';
  else if (active.some(line => line.status === 'accepted')) status = 'accepted';
  else status = 'pending';
  const ranks = { pending: 0, accepted: 1, preparing: 2, ready: 3, served: 4 };
  if (ranks[status] < ranks[request.status]) status = request.status;
  await db.run('UPDATE requests SET status = ?, completed_by = ? WHERE id = ?', [status, actorName, requestId]);
  return status;
}

export async function getDashboard(db, tenantId, actor) {
  const [inventory, activeCatalog, catalog, recipes, requests, tables, rooms, audits, stockActivity] = await Promise.all([
    db.all("SELECT * FROM inventory WHERE module_type = 'bar' ORDER BY name"),
    db.all("SELECT * FROM catalog_items WHERE category = 'drink' AND in_stock <> 0 ORDER BY bar_category, name"),
    db.all("SELECT * FROM catalog_items WHERE category = 'drink' ORDER BY bar_category, name"),
    db.all("SELECT r.*, i.name AS inventory_name, i.unit FROM recipes r JOIN inventory i ON i.id = r.inventory_id WHERE i.module_type = 'bar' ORDER BY r.catalog_item_id, i.name"),
    getBarOrders(db),
    db.all('SELECT * FROM tables ORDER BY section, table_number'),
    db.all("SELECT r.room_number, TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) AS guest_name FROM rooms r JOIN stays s ON s.room_id = r.id AND s.status = 'checked_in' LEFT JOIN reservations rv ON rv.id = s.reservation_id LEFT JOIN guest_profiles g ON g.id = rv.main_guest_id WHERE r.status = 'occupied' ORDER BY CAST(r.room_number AS INTEGER), r.room_number"),
    db.all("SELECT a.*, i.name AS inventory_name, i.unit FROM bar_blind_audits a JOIN inventory i ON i.id = a.inventory_id ORDER BY a.created_at DESC LIMIT 12"),
    db.all("SELECT staff_name, action, details, created_at FROM audit_logs WHERE action LIKE 'Bar Stok%' OR action IN ('Stok İade') ORDER BY created_at DESC LIMIT 20")
  ]);
  const recipeProductIds = new Set(recipes.map(recipe => recipe.catalog_item_id));
  const withTracking = list => list.map(product => ({ ...product, stock_tracking_status: recipeProductIds.has(product.id) ? 'configured' : 'unconfigured' }));
  return { tenant_id: tenantId, inventory, catalog: withTracking(activeCatalog), management_catalog: withTracking(catalog), recipes, orders: requests, tables, rooms, audits, stock_activity: stockActivity, can_manage: canManage(actor), setup: { inventory_count: inventory.length, product_count: catalog.length, recipe_ready_count: catalog.filter(product => recipeProductIds.has(product.id)).length, active_product_count: activeCatalog.length, table_count: tables.length, occupied_room_count: rooms.length } };
}
