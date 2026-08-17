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
    const result = await db.prepare('SELECT COUNT(*) AS count FROM rooms').first();
    return json({ ok: true, product: env.PRODUCT_ID, database: env.PRODUCT_DB, rooms: Number(result?.count || 0) });
  }
  if (url.pathname === '/api/rooms' && request.method === 'GET') {
    const result = await db.prepare('SELECT * FROM rooms ORDER BY CAST(room_number AS INTEGER), room_number').all();
    return json({ rooms: result.results || [] });
  }
  if (url.pathname === '/api/reservations' && request.method === 'GET') {
    const result = await db.prepare('SELECT reservations.*, rooms.room_number FROM reservations LEFT JOIN rooms ON rooms.id = reservations.room_id ORDER BY arrival_date, created_at DESC LIMIT 100').all();
    return json({ reservations: result.results || [] });
  }
  if (url.pathname === '/api/reservations' && request.method === 'POST') {
    const data = await readBody(request);
    const guestName = String(data.guest_name || '').trim();
    const arrival = String(data.arrival_date || '').trim();
    const departure = String(data.departure_date || '').trim();
    if (!guestName || !arrival || !departure) return json({ error: 'Misafir, giriş ve çıkış tarihi zorunludur.' }, 400);
    const reservationId = makeId('reservation');
    await db.prepare('INSERT INTO reservations (id, guest_name, room_id, arrival_date, departure_date, status, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(reservationId, guestName, data.room_id || null, arrival, departure, 'confirmed', Number(data.total_amount || 0), now()).run();
    return json({ ok: true, id: reservationId }, 201);
  }
  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/status$/);
  if (roomMatch && request.method === 'PATCH') {
    const data = await readBody(request);
    const allowed = new Set(['clean_vacant', 'dirty_vacant', 'occupied', 'maintenance']);
    if (!allowed.has(data.status)) return json({ error: 'Geçersiz oda durumu.' }, 400);
    const guestName = data.status === 'occupied' ? String(data.guest_name || '').trim() || null : null;
    const result = await db.prepare('UPDATE rooms SET status = ?, guest_name = ?, updated_at = ? WHERE id = ?').bind(data.status, guestName, now(), roomMatch[1]).run();
    if (!result.meta?.changes) return json({ error: 'Oda bulunamadı.' }, 404);
    return json({ ok: true, id: roomMatch[1], status: data.status });
  }
  if (url.pathname === '/api/precheckins' && request.method === 'GET') {
    const result = await db.prepare('SELECT * FROM precheckins ORDER BY created_at DESC LIMIT 100').all();
    return json({ precheckins: result.results || [] });
  }
  if (url.pathname === '/api/precheckins' && request.method === 'POST') {
    const data = await readBody(request);
    const guestName = String(data.guest_name || '').trim();
    if (!guestName) return json({ error: 'Misafir adı zorunludur.' }, 400);
    const precheckinId = makeId('precheckin');
    await db.prepare('INSERT INTO precheckins (id, reservation_id, guest_name, email, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(precheckinId, data.reservation_id || null, guestName, String(data.email || '').trim() || null, String(data.phone || '').trim() || null, 'pending', now()).run();
    return json({ ok: true, id: precheckinId, status: 'pending' }, 201);
  }
  return json({ error: 'Resepsiyon API yolu bulunamadı.' }, 404);
}

const pages = new Map([
  ['/reception', '/reception.html'],
  ['/precheckin', '/precheckin.html']
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
