import { state } from './state.js';
import { notifyNewOrder } from './order-alert.js';

const data = { rooms: [], orders: [], assets: [], plans: [], inventory: [], purchases: [] };
const $ = id => document.getElementById(id);
const tenant = () => `?tenant_id=${encodeURIComponent(state.currentTenant)}`;
const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || !['maintenance', 'technical'].includes(String(user.role || '').toLowerCase())) return;
  bind();
  await load();
  subscribe();
  setInterval(load, 8000);
});

function bind() {
  document.querySelectorAll('.maintenance-nav button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('btn-staff-logout').addEventListener('click', () => window.aeonLogout?.());
  $('btn-new-work-order').addEventListener('click', openWorkOrder);
  $('btn-room-work-order').addEventListener('click', openWorkOrder);
  $('btn-new-asset').addEventListener('click', () => $('asset-dialog').showModal());
  $('btn-new-plan').addEventListener('click', openPlan);
  $('btn-new-purchase').addEventListener('click', () => $('purchase-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('work-order-form').addEventListener('submit', createWorkOrder);
  $('asset-form').addEventListener('submit', createAsset);
  $('plan-form').addEventListener('submit', createPlan);
  $('purchase-form').addEventListener('submit', createPurchase);
  $('update-form').addEventListener('submit', updateWorkOrder);
}

function subscribe() {
  const source = new EventSource(`/api/events${tenant()}`);
  ['room_updated', 'maintenance_updated', 'request_created', 'request_updated', 'inventory_updated'].forEach(type => source.addEventListener(type, load));
  source.addEventListener('request_created', event => {
    let departments = [];
    try { departments = JSON.parse(event.data || '{}').departments || []; } catch (error) { departments = []; }
    if (departments.some(department => String(department).toLocaleLowerCase('tr-TR') === 'maintenance')) notifyNewOrder(event);
  });
  source.onerror = () => { source.close(); setTimeout(subscribe, 4000); };
}

async function load() {
  try {
    const [rooms, orders, assets, plans, inventory, purchases] = await Promise.all([
      fetch(`/api/rooms${tenant()}`), fetch(`/api/maintenance/work-orders${tenant()}`), fetch(`/api/maintenance/assets${tenant()}`), fetch(`/api/maintenance/plans${tenant()}`), fetch(`/api/inventory${tenant()}`), fetch(`/api/maintenance/purchase-requests${tenant()}`)
    ]);
    if (rooms.ok) data.rooms = await rooms.json();
    if (orders.ok) data.orders = await orders.json();
    if (assets.ok) data.assets = await assets.json();
    if (plans.ok) data.plans = await plans.json();
    if (inventory.ok) data.inventory = await inventory.json();
    if (purchases.ok) data.purchases = await purchases.json();
    const labels = { 'Odalar': rooms, 'İş emirleri': orders, 'Varlıklar': assets, 'Bakım planları': plans, 'Depo': inventory, 'Satın alma': purchases };
    const failed = Object.entries(labels).filter(([, response]) => !response.ok).map(([label]) => label);
    if (failed.length) toast(`Bazı veriler güncellenemedi (${failed.join(', ')}); ekranda eski veri gösteriliyor olabilir.`);
    render();
  } catch { toast('Canlı veriler alınamadı. Bağlantıyı kontrol edin.'); }
}

function showView(view) {
  document.querySelectorAll('.maintenance-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.maintenance-view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
}

function render() {
  const open = data.orders.filter(order => order.status !== 'resolved');
  $('kpi-open').textContent = open.length;
  $('kpi-critical').textContent = open.filter(order => order.priority === 'critical').length;
  $('kpi-waiting').textContent = open.filter(order => order.status === 'waiting_part').length;
  $('kpi-rooms').textContent = data.rooms.filter(room => room.status === 'maintenance').length;
  renderOrders(); renderRooms(); renderPlans(); renderInventory();
}

function renderOrders() {
  const maps = { reported: 'orders-reported', in_progress: 'orders-progress', waiting_part: 'orders-waiting', resolved: 'orders-resolved' };
  Object.entries(maps).forEach(([status, id]) => {
    const list = data.orders.filter(order => order.status === status);
    $(id).innerHTML = list.length ? list.map(orderCard).join('') : '<div class="stack-item"><p>Bu aşamada iş emri yok.</p></div>';
    $(`count-${status === 'in_progress' ? 'progress' : status === 'waiting_part' ? 'waiting' : status}`).textContent = list.length;
  });
  document.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', () => openUpdate(button.dataset.order)));
}

function orderCard(order) {
  const target = order.room_number ? `Oda ${order.room_number}` : `${order.asset_name || 'Varlık'} · ${order.asset_location || ''}`;
  const due = order.due_at ? `Plan: ${new Date(order.due_at).toLocaleString('tr-TR')}` : 'Planlanan bitiş yok';
  return `<article class="order-card ${escape(order.priority)}"><div class="card-top"><strong>${escape(target)}</strong><span class="badge">${escape(labelPriority(order.priority))}</span></div><p>${escape(order.summary)}</p><div class="meta">${escape(labelCategory(order.category))} · ${escape(due)}</div><button class="card-action" data-order="${escape(order.id)}">İş emrini güncelle</button></article>`;
}

function renderRooms() {
  const statusLabel = room => room.status === 'maintenance' ? 'Bakımda' : room.status === 'out_of_order' ? 'Kullanıma kapalı (Ön Büro)' : room.status === 'blocked' ? 'Bloke (Ön Büro)' : room.ac_status === 'broken' ? 'Klima arızası bildirildi' : 'Operasyonel';
  $('room-grid').innerHTML = data.rooms.length ? data.rooms.map(room => `<article class="room-card ${['maintenance', 'out_of_order', 'blocked'].includes(room.status) ? 'maintenance' : ''}"><h3>Oda ${escape(room.room_number)}</h3><p>${statusLabel(room)}</p><p>${escape(room.maintenance_notes || 'Açık teknik not yok')}</p><button class="card-action" data-room="${escape(room.id)}">İş emri aç</button></article>`).join('') : '<p>Oda kaydı yok.</p>';
  document.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', () => openWorkOrder(button.dataset.room)));
}

function renderPlans() {
  $('plans-list').innerHTML = data.plans.length ? data.plans.map(plan => `<article class="stack-item"><div><strong>${escape(plan.title)}</strong><p>${escape(plan.asset_name)} · ${escape(plan.asset_location)}</p><p>Son tarih: ${escape(plan.next_due_at)} · ${escape(plan.frequency_days)} günde bir</p></div><span class="badge">Aktif</span></article>`).join('') : '<div class="stack-item"><p>Planlı bakım kaydı yok. Önce teknik varlık, sonra plan oluşturun.</p></div>';
  $('assets-list').innerHTML = data.assets.length ? data.assets.map(asset => `<article class="stack-item"><div><strong>${escape(asset.name)}</strong><p>${escape(asset.category)} · ${escape(asset.location)}</p><p>${escape(asset.asset_tag || 'Etiket yok')}</p></div><span class="badge">${escape(labelPriority(asset.criticality))}</span></article>`).join('') : '<div class="stack-item"><p>Teknik varlık henüz tanımlanmadı.</p></div>';
}

function renderInventory() {
  const items = data.inventory.filter(item => ['technical', 'maintenance', 'general'].includes(String(item.module_type || '').toLowerCase()));
  $('inventory-list').innerHTML = items.length ? items.map(item => `<article class="stack-item"><div><strong>${escape(item.name)}</strong><p>Par seviyesi: ${escape(item.par_level)} ${escape(item.unit)}</p></div><span class="badge">${escape(item.stock)} ${escape(item.unit)}</span></article>`).join('') : '<div class="stack-item"><p>Teknik malzeme yok. Envantere teknik modül tipiyle kayıt ekleyin.</p></div>';
  const purchaseActions = request => ['fulfilled', 'cancelled'].includes(request.status) ? '' : `<div class="row-actions"><button class="card-action" data-purchase-status="${escape(request.id)}" data-status="fulfilled">Teslim Alındı</button><button class="card-action" data-purchase-status="${escape(request.id)}" data-status="cancelled">İptal Et</button></div>`;
  $('purchases-list').innerHTML = data.purchases.length ? data.purchases.map(request => `<article class="stack-item"><div><strong>${escape(request.item_name)} · ${escape(request.quantity)}</strong><p>${escape(request.notes || 'Not yok')}</p>${purchaseActions(request)}</div><span class="badge">${escape(request.status)}</span></article>`).join('') : '<div class="stack-item"><p>Açık teknik satın alma talebi yok.</p></div>';
  document.querySelectorAll('[data-purchase-status]').forEach(button => button.addEventListener('click', () => updatePurchaseStatus(button.dataset.purchaseStatus, button.dataset.status)));
  $('update-part').innerHTML = '<option value="">Malzeme kullanılmadı</option>' + items.map(item => `<option value="${escape(item.id)}">${escape(item.name)} · ${escape(item.stock)} ${escape(item.unit)}</option>`).join('');
}

function openWorkOrder(roomId = '') {
  const options = ['<option value="">Hedef seçin</option>', ...data.rooms.map(room => `<option value="room:${escape(room.id)}">Oda ${escape(room.room_number)}</option>`), ...data.assets.map(asset => `<option value="asset:${escape(asset.id)}">${escape(asset.name)} · ${escape(asset.location)}</option>`)] .join('');
  $('work-order-target').innerHTML = options;
  $('work-order-target').value = roomId ? `room:${roomId}` : '';
  $('work-order-form').reset();
  if (roomId) $('work-order-target').value = `room:${roomId}`;
  $('work-order-dialog').showModal();
}

function openPlan() {
  if (!data.assets.length) return toast('Plan oluşturmak için önce teknik varlık tanımlayın.');
  $('plan-asset').innerHTML = data.assets.map(asset => `<option value="${escape(asset.id)}">${escape(asset.name)} · ${escape(asset.location)}</option>`).join('');
  $('plan-form').reset(); $('plan-due').value = new Date().toISOString().slice(0, 10); $('plan-dialog').showModal();
}

function openUpdate(id) {
  $('update-form').reset(); $('update-id').value = id; $('update-dialog').showModal();
}

async function createWorkOrder(event) {
  event.preventDefault();
  const [kind, id] = $('work-order-target').value.split(':');
  const result = await request('/api/maintenance/work-orders', { roomId: kind === 'room' ? id : null, assetId: kind === 'asset' ? id : null, category: $('work-order-category').value, priority: $('work-order-priority').value, summary: $('work-order-summary').value, dueAt: $('work-order-due').value || null, markRoomOutOfOrder: $('work-order-room-out').checked });
  if (result) { $('work-order-dialog').close(); toast('İş emri açıldı.'); await load(); }
}

async function createAsset(event) {
  event.preventDefault();
  const result = await request('/api/maintenance/assets', { name: $('asset-name').value, category: $('asset-category').value, location: $('asset-location').value, assetTag: $('asset-tag').value, criticality: $('asset-criticality').value, notes: $('asset-notes').value });
  if (result) { $('asset-dialog').close(); toast('Teknik varlık kaydedildi.'); await load(); }
}

async function createPlan(event) {
  event.preventDefault();
  const result = await request('/api/maintenance/plans', { assetId: $('plan-asset').value, title: $('plan-title').value, frequencyDays: Number($('plan-frequency').value), nextDueAt: $('plan-due').value });
  if (result) { $('plan-dialog').close(); toast('Bakım planı kaydedildi.'); await load(); }
}

async function createPurchase(event) {
  event.preventDefault();
  const result = await request('/api/maintenance/purchase-requests', { itemName: $('purchase-name').value, quantity: Number($('purchase-quantity').value), priority: $('purchase-priority').value, notes: $('purchase-notes').value });
  if (result) { $('purchase-dialog').close(); toast('Satın alma talebi gönderildi.'); await load(); }
}

async function updatePurchaseStatus(id, status) {
  const result = await request(`/api/maintenance/purchase-requests/${encodeURIComponent(id)}`, { status }, 'PATCH');
  if (result) { toast(status === 'fulfilled' ? 'Satın alma teslim alındı olarak işaretlendi.' : 'Satın alma talebi iptal edildi.'); await load(); }
}

async function updateWorkOrder(event) {
  event.preventDefault();
  const inventoryId = $('update-part').value;
  const quantity = Number($('update-part-quantity').value);
  const parts = inventoryId && Number.isFinite(quantity) && quantity > 0 ? [{ inventoryId, quantity }] : [];
  const result = await request(`/api/maintenance/work-orders/${encodeURIComponent($('update-id').value)}`, { status: $('update-status').value, resolution: $('update-resolution').value, laborMinutes: $('update-minutes').value, parts, releaseRoom: $('update-release-room').checked }, 'PATCH');
  if (result) { $('update-dialog').close(); toast('İş emri güncellendi.'); await load(); }
}

async function request(path, body, method = 'POST') {
  try {
    const response = await fetch(`${path}${tenant()}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast(result.error || 'İşlem tamamlanamadı.'); return null; }
    return result;
  } catch { toast('Bağlantı hatası oluştu.'); return null; }
}

function labelPriority(value) { return ({ critical: 'Kritik', high: 'Yüksek', normal: 'Normal' })[value] || value; }
function labelCategory(value) { return ({ hvac: 'HVAC', electrical: 'Elektrik', plumbing: 'Tesisat', room_equipment: 'Oda ekipmanı', safety: 'Güvenlik', pool_public: 'Havuz / genel alan', general: 'Genel teknik' })[value] || value; }
function toast(message) { const node = $('toast'); node.textContent = message; node.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.style.display = 'none'; }, 3500); }
