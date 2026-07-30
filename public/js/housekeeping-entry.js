import { state } from './state.js';
import { notifyNewOrder } from './order-alert.js';

const data = { rooms: [], tasks: [], public_areas: [], laundry: [], lost_found: [], linen: [] };
let minibarCatalog = [];
const $ = id => document.getElementById(id);
const tenant = () => `?tenant_id=${encodeURIComponent(state.currentTenant)}`;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
let filter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || !['housekeeping', 'kat hizmetleri'].includes(String(user.role || '').toLocaleLowerCase('tr-TR'))) return;
  bind(); await load(); subscribe();
});

function bind() {
  $('logout').addEventListener('click', () => window.aeonLogout?.());
  document.querySelectorAll('.hk-nav button').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button)); renderRooms(); }));
  $('new-task').addEventListener('click', openTask); $('new-task-top').addEventListener('click', openTask);
  $('new-laundry').addEventListener('click', openLaundry); $('new-laundry-top').addEventListener('click', openLaundry);
  $('new-lost').addEventListener('click', () => { $('lost-form').reset(); $('lost-dialog').showModal(); });
  $('new-stock-item').addEventListener('click', () => { $('stock-item-form').reset(); $('stock-item-dialog').showModal(); });
  $('new-area').addEventListener('click', () => { $('area-form').reset(); $('area-dialog').showModal(); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('task-form').addEventListener('submit', createTask); $('inspect-form').addEventListener('submit', inspectRoom); $('laundry-form').addEventListener('submit', createLaundry); $('count-form').addEventListener('submit', createCount); $('lost-form').addEventListener('submit', createLost);
  $('stock-item-form').addEventListener('submit', createStockItem);
  $('stock-movement-form').addEventListener('submit', createStockMovement);
  $('area-form').addEventListener('submit', createArea);
  $('minibar-form').addEventListener('submit', submitMinibar);
}

function subscribe() {
  const source = new EventSource(`/api/events${tenant()}`);
  ['room_updated', 'area_updated', 'request_created'].forEach(type => source.addEventListener(type, load));
  source.addEventListener('request_created', event => {
    let departments = [];
    try { departments = JSON.parse(event.data || '{}').departments || []; } catch (error) { departments = []; }
    if (departments.some(department => String(department).toLocaleLowerCase('tr-TR') === 'housekeeping')) notifyNewOrder(event);
  });
  source.addEventListener('hk_task_updated', event => {
    load();
    try {
      const payload = JSON.parse(event.data || '{}');
      if (payload.status === 'open' && payload.target_identifier) toast(`Yeni misafir talebi: ${payload.target_identifier} · ${payload.details || 'Kat hizmetleri görevi'}`);
    } catch {
      toast('Yeni housekeeping görevi oluşturuldu.');
    }
  });
  source.onerror = () => { source.close(); setTimeout(subscribe, 4000); };
}

async function load() {
  try { const response = await fetch(`/api/hk/dashboard${tenant()}`); if (!response.ok) throw new Error(); Object.assign(data, await response.json()); render(); } catch { toast('Canlı housekeeping verileri alınamadı.'); }
  try { const response = await fetch(`/api/catalog${tenant()}`); if (response.ok) minibarCatalog = (await response.json()).filter(item => item.category === 'minibar'); } catch { /* minibar menu stays as last known state */ }
}

function view(name) { document.querySelectorAll('.hk-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === name)); document.querySelectorAll('.hk-view').forEach(section => section.classList.toggle('active', section.id === `view-${name}`)); }

function render() {
  $('metric-dirty').textContent = data.rooms.filter(room => room.status === 'dirty_vacant' || room.status === 'assigned').length;
  $('metric-cleaning').textContent = data.rooms.filter(room => room.status === 'cleaning').length;
  $('metric-tasks').textContent = data.tasks.filter(task => task.status !== 'completed').length;
  $('metric-dnd').textContent = data.rooms.filter(room => Number(room.dnd_active) === 1).length;
  renderRooms(); renderTasks(); renderAreas(); renderLinen(); renderLost();
}

function renderRooms() {
  let rooms = data.rooms;
  if (filter === 'dirty') rooms = rooms.filter(room => room.status === 'dirty_vacant' || room.status === 'assigned');
  if (filter === 'cleaning') rooms = rooms.filter(room => room.status === 'cleaning');
  if (filter === 'dnd') rooms = rooms.filter(room => Number(room.dnd_active) === 1);
  $('room-grid').innerHTML = rooms.length ? rooms.map(room => {
    const mode = room.status === 'dirty_vacant' || room.status === 'assigned' ? 'dirty' : room.status === 'cleaning' ? 'cleaning' : ['maintenance', 'out_of_order', 'blocked'].includes(room.status) ? 'maintenance' : '';
    const stateLabel = ({ clean_vacant: 'Temiz boş', dirty_vacant: 'Kirli boş', assigned: 'Atandı', cleaning: 'Temizlikte', occupied: 'Dolu', maintenance: 'Teknik bakım', out_of_order: 'Kullanıma kapalı', blocked: 'Bloke' })[room.status] || room.status;
    const action = room.status === 'cleaning' ? `<button class="card-action" data-inspect="${esc(room.id)}">Kalite onayı</button>` : ['dirty_vacant', 'assigned', 'out_of_order', 'blocked'].includes(room.status) ? `<button class="card-action" data-start="${esc(room.id)}">Temizliği başlat</button>` : `<button class="card-action" data-task-room="${esc(room.id)}">Görev oluştur</button>`;
    return `<article class="room-card ${mode}"><h3>Oda ${esc(room.room_number)}</h3><p>${esc(stateLabel)}${Number(room.dnd_active) ? ' · DND' : ''}</p><p>${esc(room.maintenance_notes || room.eta || 'Açık housekeeping notu yok')}</p><div class="task-actions">${action}<button class="small-button" data-minibar="${esc(room.id)}">Minibar</button></div></article>`;
  }).join('') : '<p>Gösterilecek oda yok.</p>';
  document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => startRoom(button.dataset.start)));
  document.querySelectorAll('[data-inspect]').forEach(button => button.addEventListener('click', () => openInspect(button.dataset.inspect)));
  document.querySelectorAll('[data-task-room]').forEach(button => button.addEventListener('click', () => openTask(button.dataset.taskRoom)));
  document.querySelectorAll('[data-minibar]').forEach(button => button.addEventListener('click', () => openMinibar(button.dataset.minibar)));
}

function renderTasks() {
  $('task-list').innerHTML = data.tasks.length ? data.tasks.map(task => `<article class="task-card"><div><strong>${esc(task.room_number ? `Oda ${task.room_number}` : 'Genel görev')} · ${esc(typeLabel(task.task_type))}</strong><p>${esc(task.details)}</p><p>${esc(priorityLabel(task.priority))}${task.due_at ? ` · Hedef: ${esc(new Date(task.due_at).toLocaleString('tr-TR'))}` : ''}</p></div><div class="task-actions">${task.status === 'open' ? `<button class="small-button" data-task-progress="${esc(task.id)}">Başlat</button>` : ''}${task.status !== 'completed' ? `<button class="small-button" data-task-complete="${esc(task.id)}">Tamamla</button>` : '<span class="badge">Tamamlandı</span>'}</div></article>`).join('') : '<article class="task-card"><p>Açık housekeeping görevi yok.</p></article>';
  document.querySelectorAll('[data-task-progress]').forEach(button => button.addEventListener('click', () => updateTask(button.dataset.taskProgress, 'in_progress')));
  document.querySelectorAll('[data-task-complete]').forEach(button => button.addEventListener('click', () => updateTask(button.dataset.taskComplete, 'completed')));
}

function renderAreas() {
  $('area-grid').innerHTML = data.public_areas.length ? data.public_areas.map(area => `<article class="area-card"><span class="status ${esc(area.status)}">${area.status === 'clean' ? 'Temiz' : 'Temizlik gerekli'}</span><h3>${esc(area.name)}</h3><p>${area.last_cleaned_at ? `Son temizlik: ${esc(new Date(area.last_cleaned_at).toLocaleString('tr-TR'))}` : 'Henüz temizlik kaydı yok'}</p><p>${esc(area.last_cleaned_by || 'Atanmamış')}</p><div class="task-actions"><button class="card-action" data-area="${esc(area.id)}">Temizlendi olarak kaydet</button><button class="small-button" data-area-delete="${esc(area.id)}">Sil</button></div></article>`).join('') : '<p>Tanımlı ortak alan yok.</p>';
  document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => cleanArea(button.dataset.area)));
  document.querySelectorAll('[data-area-delete]').forEach(button => button.addEventListener('click', () => deleteArea(button.dataset.areaDelete)));
}

function renderLinen() {
  $('linen-list').innerHTML = data.linen.length ? data.linen.map(item => `<article class="stack-item"><div><strong>${esc(item.name)}</strong><p>Par seviyesi: ${esc(item.par_level)} ${esc(item.unit)}</p></div><div><span class="badge">${esc(item.stock)} ${esc(item.unit)}</span><button class="small-button" data-count="${esc(item.id)}" data-count-name="${esc(item.name)}">Sayım</button><button class="small-button" data-movement="${esc(item.id)}" data-movement-name="${esc(item.name)}">Hareket</button><button class="small-button" data-stock-delete="${esc(item.id)}">Sil</button></div></article>`).join('') : '<article class="stack-item"><p>Kat hizmetleri çarşaf / oda ikramı envanteri tanımlı değil.</p></article>';
  $('laundry-list').innerHTML = data.laundry.length ? data.laundry.map(item => `<article class="stack-item"><div><strong>${esc(item.guest_name || 'Oda çamaşırı')}</strong><p>${esc(item.items)}</p></div><div><span class="badge">${esc(item.status)}</span>${item.status !== 'delivered' ? `<button class="small-button" data-laundry="${esc(item.id)}">Teslim edildi</button>` : ''}</div></article>`).join('') : '<article class="stack-item"><p>Açık çamaşır işlemi yok.</p></article>';
  document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => openCount(button.dataset.count, button.dataset.countName)));
  document.querySelectorAll('[data-movement]').forEach(button => button.addEventListener('click', () => openStockMovement(button.dataset.movement, button.dataset.movementName)));
  document.querySelectorAll('[data-stock-delete]').forEach(button => button.addEventListener('click', () => deleteStockItem(button.dataset.stockDelete)));
  document.querySelectorAll('[data-laundry]').forEach(button => button.addEventListener('click', () => updateLaundry(button.dataset.laundry)));
}

function renderLost() {
  $('lost-list').innerHTML = data.lost_found.length ? data.lost_found.map(item => `<article class="stack-item"><div><strong>${esc(item.item_name)}</strong><p>${esc(item.found_location)} · ${esc(item.description || 'Açıklama yok')}</p><p>Kaydeden: ${esc(item.reported_by || 'Kat Hizmetleri')}</p></div><div><span class="badge">${esc(item.status)}</span>${item.status !== 'claimed' ? `<button class="small-button" data-claim="${esc(item.id)}">Teslim edildi</button>` : ''}</div></article>`).join('') : '<article class="stack-item"><p>Açık kayıp eşya kaydı yok.</p></article>';
  document.querySelectorAll('[data-claim]').forEach(button => button.addEventListener('click', () => claimLost(button.dataset.claim)));
}

function openTask(roomId = '') { $('task-form').reset(); $('task-room').innerHTML = '<option value="">Oda bağlı değil</option>' + data.rooms.map(room => `<option value="${esc(room.id)}">Oda ${esc(room.room_number)}</option>`).join(''); $('task-room').value = roomId; $('task-dialog').showModal(); }
function openInspect(roomId) { const room = data.rooms.find(item => item.id === roomId); $('inspect-form').reset(); $('inspect-room').value = roomId; $('inspect-title').textContent = `Oda ${room?.room_number || ''} kalite onayı`; $('inspect-dialog').showModal(); }
function openLaundry() { $('laundry-form').reset(); $('laundry-room').innerHTML = data.rooms.map(room => `<option value="${esc(room.id)}">Oda ${esc(room.room_number)}</option>`).join(''); $('laundry-dialog').showModal(); }
function openCount(inventoryId, name) { $('count-form').reset(); $('count-inventory').value = inventoryId; $('count-label').textContent = `${name} fiziki sayımı`; $('count-dialog').showModal(); }
function openStockMovement(inventoryId, name) { $('stock-movement-form').reset(); $('stock-movement-inventory').value = inventoryId; $('stock-movement-title').textContent = `${name} · stok hareketi`; $('stock-movement-dialog').showModal(); }
function openMinibar(roomId) {
  const room = data.rooms.find(item => item.id === roomId);
  $('minibar-form').reset();
  $('minibar-room').value = roomId;
  $('minibar-title').textContent = `Oda ${room?.room_number || ''} minibar tüketimi`;
  $('minibar-items').innerHTML = minibarCatalog.length
    ? minibarCatalog.map(item => `<label class="minibar-item"><span>${esc(item.name)} (${Number(item.price).toFixed(2)} TL)</span><input type="number" min="0" step="1" value="0" data-minibar-catalog="${esc(item.id)}"></label>`).join('')
    : '<p>Tanımlı minibar ürünü yok. Yönetici panelinden minibar ürünü tanımlanmalı.</p>';
  $('minibar-dialog').showModal();
}

async function createTask(event) { event.preventDefault(); const result = await send('/api/hk/tasks', { taskType: $('task-type').value, roomId: $('task-room').value || null, priority: $('task-priority').value, dueAt: $('task-due').value || null, details: $('task-details').value }); if (result) { $('task-dialog').close(); toast('Kat hizmetleri görevi kaydedildi.'); load(); } }
async function startRoom(id, overrideDnd = false) {
  // The server 409s with dnd_active:true when the room has DND on and override_dnd wasn't
  // sent — this button never sent it and had no way to, so a DND room could never be started
  // from Housekeeping at all; only Reception's separate room-operations modal could clear DND.
  try {
    const response = await fetch(`/api/hk/rooms/${encodeURIComponent(id)}/start${tenant()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ override_dnd: overrideDnd }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result.dnd_active && !overrideDnd && confirm('Bu oda DND (Rahatsız Etmeyin) modunda. Yine de temizliğe başlamak istiyor musunuz?')) {
        return startRoom(id, true);
      }
      toast(result.error || 'İşlem tamamlanamadı.');
      return;
    }
    toast('Temizlik başlatıldı.');
    load();
  } catch { toast('Bağlantı hatası oluştu.'); }
}
async function inspectRoom(event) { event.preventDefault(); const checklist = [...document.querySelectorAll('#inspect-form .check input:checked')].map(item => item.value); const result = await send(`/api/hk/rooms/${encodeURIComponent($('inspect-room').value)}/inspect`, { checklist, notes: $('inspect-notes').value }); if (result) { $('inspect-dialog').close(); toast('Oda kalite onayı tamamlandı.'); load(); } }
async function updateTask(id, status) { const result = await send(`/api/hk/tasks/${encodeURIComponent(id)}`, { status }, 'PATCH'); if (result) { toast('Görev güncellendi.'); load(); } }
async function cleanArea(id) { const result = await send('/api/public_areas/clean', { id }); if (result) { toast('Ortak alan temizlik kaydı işlendi.'); load(); } }
async function createLaundry(event) { event.preventDefault(); const result = await send('/api/hk/laundry', { room_id: $('laundry-room').value, items_description: $('laundry-items').value }); if (result) { $('laundry-dialog').close(); toast('Çamaşır kaydı oluşturuldu.'); load(); } }
async function updateLaundry(id) { const result = await send(`/api/hk/laundry/${encodeURIComponent(id)}/status`, { status: 'delivered' }); if (result) { toast('Çamaşır teslim edildi olarak kaydedildi.'); load(); } }
async function createCount(event) { event.preventDefault(); const result = await send('/api/hk/linen-counts', { inventoryId: $('count-inventory').value, countedQuantity: Number($('count-quantity').value), notes: $('count-notes').value }); if (result) { $('count-dialog').close(); toast('Linen sayımı kaydedildi.'); load(); } }
async function createStockItem(event) { event.preventDefault(); const result = await send('/api/inventory', { name: $('stock-item-name').value, unit: $('stock-item-unit').value, stock: Number($('stock-item-stock').value), par_level: Number($('stock-item-par').value), module_type: 'housekeeping' }); if (result) { $('stock-item-dialog').close(); toast('Malzeme eklendi.'); load(); } }
async function deleteStockItem(id) { if (!confirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return; const result = await send(`/api/inventory/${encodeURIComponent(id)}`, {}, 'DELETE'); if (result) { toast('Malzeme silindi.'); load(); } }
async function createStockMovement(event) { event.preventDefault(); const result = await send('/api/inventory/movement', { inventoryId: $('stock-movement-inventory').value, type: $('stock-movement-type').value, quantity: Number($('stock-movement-quantity').value), reason: $('stock-movement-reason').value }); if (result) { $('stock-movement-dialog').close(); toast('Stok hareketi kaydedildi.'); load(); } }
async function createArea(event) { event.preventDefault(); const result = await send('/api/public_areas', { name: $('area-name').value }); if (result) { $('area-dialog').close(); toast('Ortak alan tanımlandı.'); load(); } }
async function deleteArea(id) { if (!confirm('Bu ortak alanı silmek istediğinize emin misiniz?')) return; const result = await send(`/api/public_areas/${encodeURIComponent(id)}`, {}, 'DELETE'); if (result) { toast('Ortak alan silindi.'); load(); } }
async function submitMinibar(event) {
  event.preventDefault();
  const items = [...document.querySelectorAll('[data-minibar-catalog]')]
    .map(input => ({ catalogItemId: input.dataset.minibarCatalog, quantity: Number(input.value) }))
    .filter(item => item.quantity > 0);
  if (!items.length) { toast('En az bir üründen 1 veya daha fazla adet girin.'); return; }
  const result = await send(`/api/hk/rooms/${encodeURIComponent($('minibar-room').value)}/minibar`, { items });
  if (result) { $('minibar-dialog').close(); toast(result.charged ? 'Minibar tüketimi oda hesabına yazıldı.' : 'Minibar tüketimi stoktan düşüldü.'); load(); }
}
async function createLost(event) { event.preventDefault(); const result = await send('/api/hk/lost-found', { item_name: $('lost-name').value, found_location: $('lost-location').value, description: $('lost-description').value }); if (result) { $('lost-dialog').close(); toast('Buluntu eşya kaydedildi.'); load(); } }
async function claimLost(id) { const result = await send(`/api/hk/lost-found/${encodeURIComponent(id)}/claim`, {} ,'PATCH'); if (result) { toast('Teslim işlemi kaydedildi.'); load(); } }
async function send(path, body, method = 'POST') { try { const response = await fetch(`${path}${tenant()}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok) { toast(result.error || 'İşlem tamamlanamadı.'); return null; } return result; } catch { toast('Bağlantı hatası oluştu.'); return null; } }
function typeLabel(value) { return ({ room_turn: 'Oda dönüşü', cleaning_request: 'Temizlik', linen: 'Çarşaf / havlu', amenity: 'Oda ikramı', water: 'Su talebi', minibar: 'Minibar', public_area: 'Ortak alan', checkout_cleaning: 'Çıkış sonrası temizlik', room_move_cleaning: 'Oda değişimi temizliği' })[value] || value; }
function priorityLabel(value) { return ({ urgent: 'Acil', high: 'Yüksek', normal: 'Normal', low: 'Düşük' })[value] || value; }
function toast(message) { const node = $('toast'); node.textContent = message; node.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.style.display = 'none'; }, 3500); }
