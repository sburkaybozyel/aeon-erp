const byId = id => document.getElementById(id);
const value = (object, path, fallback = 0) => path.split('.').reduce((current, key) => current && current[key] !== undefined ? current[key] : undefined, object) ?? fallback;
const number = input => Number(input || 0).toLocaleString('tr-TR');
const date = input => input ? new Date(input).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const esc = input => String(input ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function setText(id, text) {
  const node = byId(id);
  if (node) node.textContent = text;
}

function setStatus(id, available, error = '') {
  const node = byId(id);
  if (!node) return;
  node.classList.toggle('offline', !available);
  node.innerHTML = `<i class="fa-solid fa-circle"></i> ${available ? 'Bağlı' : esc(error || 'Bağlantı yok')}`;
}

function render(data) {
  const reception = data.reception || {};
  const rooms = reception.rooms || {};
  setText('hub-actor', `${data.actor?.name || 'Yönetici'} · ${data.actor?.role || 'manager'}`);
  setText('kpi-occupied', number(rooms.occupied));
  setText('kpi-rooms-note', `${number(rooms.total)} oda · ${number(rooms.clean_vacant)} temiz/hazır`);
  setText('kpi-stays', number(reception.stays?.active));
  setText('kpi-precheckins', `Ön giriş: ${number(reception.precheckins?.pending)}`);
  setText('kpi-open', number(reception.requests?.open));
  setText('kpi-folios', `Açık folyo: ${number(reception.folios?.open)}`);
  setText('kpi-events', number(reception.bridge_events?.total));
  setText('kpi-mirrors', `Restoran aynası: ${number(reception.dining_mirror?.total)}`);
  setText('reception-rooms', `${number(rooms.occupied)} / ${number(rooms.total)}`);
  setText('reception-reservations', `${number(reception.reservations?.active)} aktif`);
  setText('reception-precheckins', number(reception.precheckins?.pending));
  setText('reception-folios', number(reception.folios?.open));

  const restaurant = data.restaurant || {};
  setStatus('restaurant-status', restaurant.available, restaurant.error);
  setText('restaurant-orders', number(restaurant.orders?.open));
  setText('restaurant-tables', `${number(restaurant.tables?.open)} / ${number(restaurant.tables?.total)}`);
  setText('restaurant-ready', number((restaurant.orders?.ready || 0) + (restaurant.kitchen?.ready || 0)));
  setText('restaurant-outbox', number(restaurant.outbox?.pending));

  setStatus('kitchen-status', restaurant.available, restaurant.error);
  setText('kitchen-active', number(restaurant.kitchen?.active));
  setText('kitchen-ready', number(restaurant.kitchen?.ready));
  setText('kitchen-unavailable', number(restaurant.menu?.unavailable));
  setText('kitchen-sent', number(restaurant.outbox?.sent));

  const crm = data.crm || {};
  setStatus('crm-status', crm.available, crm.error);
  setText('crm-contacts', number(crm.contacts));
  setText('crm-opportunities', number(crm.open_opportunities));
  setText('crm-reservations', number(crm.reception_reservations));
  setText('crm-events', number(crm.reception_events));

  const rows = Array.isArray(data.recent_requests) ? data.recent_requests : [];
  const target = byId('recent-requests');
  if (target) target.innerHTML = rows.length ? rows.map(row => `<tr><td>${esc(row.type || '—')}</td><td>${esc(row.target_identifier || '—')}</td><td>${esc(row.status || '—')}</td><td>${Number(row.total_amount || 0).toLocaleString('tr-TR')} TL</td><td>${esc(date(row.created_at))}</td></tr>`).join('') : '<tr><td colspan="5" class="hub-note">Henüz operasyon kaydı yok.</td></tr>';
  setText('hub-updated', `Son güncelleme: ${new Date(data.generated_at || Date.now()).toLocaleTimeString('tr-TR')}`);
}

async function load() {
  const error = byId('hub-error');
  if (error) error.textContent = '';
  try {
    const response = await fetch('/api/admin/hub/overview?tenant_id=reception', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Yönetici özeti alınamadı.');
    render(data);
  } catch (reason) {
    if (error) error.textContent = reason.message || 'Yönetici özeti alınamadı.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  byId('hub-refresh')?.addEventListener('click', load);
  load();
  window.setInterval(load, 30000);
});
