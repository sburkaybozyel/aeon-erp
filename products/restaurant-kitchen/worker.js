const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

const makeId = prefix => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

async function api(request, env, url) {
  const db = env.DB;
  if (url.pathname === '/api/health') {
    const result = await db.prepare('SELECT COUNT(*) AS count FROM menu_items').first();
    return json({ ok: true, product: env.PRODUCT_ID, database: env.PRODUCT_DB, menu_items: Number(result?.count || 0) });
  }
  if (url.pathname === '/api/menu' && request.method === 'GET') {
    const result = await db.prepare('SELECT id, name, description, category, price FROM menu_items WHERE active = 1 ORDER BY category, name').all();
    return json({ items: result.results || [] });
  }
  if (url.pathname === '/api/tables' && request.method === 'GET') {
    const result = await db.prepare('SELECT id, label, target_type FROM tables WHERE active = 1 ORDER BY label').all();
    return json({ tables: result.results || [] });
  }
  if (url.pathname === '/api/orders' && request.method === 'GET') {
    const status = url.searchParams.get('status');
    const query = status ? 'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 100' : 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100';
    const result = status ? await db.prepare(query).bind(status).all() : await db.prepare(query).all();
    const orders = result.results || [];
    const items = orders.length ? (await db.prepare(`SELECT * FROM order_items WHERE order_id IN (${orders.map(() => '?').join(',')}) ORDER BY id`).bind(...orders.map(order => order.id)).all()).results || [] : [];
    return json({ orders: orders.map(order => ({ ...order, items: items.filter(item => item.order_id === order.id) })) });
  }
  if (url.pathname === '/api/orders' && request.method === 'POST') {
    const data = await readBody(request);
    const targetLabel = String(data.target_label || '').trim();
    const targetType = data.target_type === 'room' ? 'room' : 'table';
    const selected = Array.isArray(data.items) ? data.items : [];
    if (!targetLabel || !selected.length) return json({ error: 'Hedef ve en az bir ürün zorunludur.' }, 400);
    const menuIds = selected.map(item => String(item.id || ''));
    const menu = (await db.prepare(`SELECT id, name, price FROM menu_items WHERE active = 1 AND id IN (${menuIds.map(() => '?').join(',')})`).bind(...menuIds).all()).results || [];
    const lines = selected.map(item => {
      const found = menu.find(menuItem => menuItem.id === String(item.id));
      const quantity = Math.max(1, Math.min(20, Number.parseInt(item.quantity, 10) || 1));
      return found ? { ...found, quantity, note: String(item.note || '').slice(0, 200) } : null;
    }).filter(Boolean);
    if (!lines.length) return json({ error: 'Geçerli ürün bulunamadı.' }, 400);
    const orderId = makeId('order');
    const timestamp = now();
    const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
    const statements = [db.prepare('INSERT INTO orders (id, target_type, target_label, status, note, total_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(orderId, targetType, targetLabel, 'pending', String(data.note || '').slice(0, 300), total, timestamp, timestamp)];
    for (const line of lines) statements.push(db.prepare('INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, note) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(makeId('line'), orderId, line.id, line.name, line.quantity, line.price, line.note));
    await db.batch(statements);
    return json({ ok: true, order_id: orderId, total_amount: total, status: 'pending' }, 201);
  }
  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && request.method === 'PATCH') {
    const data = await readBody(request);
    const allowed = new Set(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']);
    if (!allowed.has(data.status)) return json({ error: 'Geçersiz sipariş durumu.' }, 400);
    const result = await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(data.status, now(), orderMatch[1]).run();
    if (!result.meta?.changes) return json({ error: 'Sipariş bulunamadı.' }, 404);
    return json({ ok: true, id: orderMatch[1], status: data.status });
  }
  return json({ error: 'Ürün API yolu bulunamadı.' }, 404);
}

const pages = new Map([
  ['/guest', '/guest.html'],
  ['/restaurant', '/restaurant.html'],
  ['/kitchen', '/kitchen.html']
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    if (pages.has(url.pathname)) {
      const asset = new URL(request.url);
      asset.pathname = pages.get(url.pathname);
      return env.ASSETS.fetch(new Request(asset, request));
    }
    return env.ASSETS.fetch(request);
  }
};
