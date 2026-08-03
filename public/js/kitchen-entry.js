import { state } from './state.js';
import { notifyNewOrder } from './order-alert.js';

let kitchenRequests = [];
let kitchenInventory = [];
let kitchenCatalog = [];
let kitchenTables = [];
let kitchenRecipes = [];
let kitchenTasks = [];
let kitchenPurchases = [];
let kitchenTickets = [];
let kitchenTemperatures = [];
let kitchenMenuControl = [];
let activeUser = null;

const terminal = new Set(['completed', 'delivered', 'cancelled', 'rejected']);
const tenantQuery = () => `?tenant_id=${encodeURIComponent(state.currentTenant || 'aeon')}`;
const requestKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));

document.addEventListener('DOMContentLoaded', async () => {
  activeUser = await window.aeonBoot();
  if (!activeUser || !['kitchen', 'chef', 'mutfak'].includes(String(activeUser.role || '').toLocaleLowerCase('tr-TR'))) return;
  setupTabs();
  setupActions();
  updateClock();
  setInterval(updateClock, 1000);
  await loadKitchenData();
  initKitchenSSE();
  // SSE runs over a single serverless function instance; on Vercel a push can miss a KDS
  // screen connected to a different instance, so poll as a safety net independent of SSE.
  setInterval(loadKitchenData, 8000);
});

function initKitchenSSE() {
  const stream = new EventSource(`/api/events${tenantQuery()}`);
  ['request_created', 'request_updated', 'table_updated', 'bar_order_created', 'bar_order_updated'].forEach(event => stream.addEventListener(event, loadKitchenData));
  const notifyIfKitchen = event => {
    let departments = [];
    try { departments = JSON.parse(event.data || '{}').departments || []; } catch (error) { departments = []; }
    if (departments.some(department => String(department).toLocaleLowerCase('tr-TR') === 'kitchen')) notifyNewOrder(event);
  };
  stream.addEventListener('request_created', notifyIfKitchen);
  stream.addEventListener('bar_order_created', notifyIfKitchen);
  stream.onerror = () => { stream.close(); setTimeout(initKitchenSSE, 3000); };
}

async function loadKitchenData() {
  try {
    const responses = await Promise.all([
      fetch(`/api/requests${tenantQuery()}`), fetch(`/api/inventory${tenantQuery()}`), fetch(`/api/catalog${tenantQuery()}`), fetch(`/api/tables${tenantQuery()}`), fetch(`/api/recipes${tenantQuery()}`), fetch(`/api/kitchen/tasks${tenantQuery()}`), fetch(`/api/purchase_requests${tenantQuery()}`), fetch(`/api/kitchen/tickets${tenantQuery()}`), fetch(`/api/kitchen/temperatures${tenantQuery()}`), fetch(`/api/kitchen/menu-control${tenantQuery()}`)
    ]);
    const labels = ['Siparişler', 'Stok', 'Katalog', 'Masalar', 'Reçeteler', 'Görevler', 'Satın alma', 'KDS biletleri', 'Sıcaklık kayıtları', 'Menü kontrolü'];
    const [requests, inventory, catalog, tables, recipes, tasks, purchases, tickets, temperatures, menuControl] = responses;
    if (requests.ok) kitchenRequests = await requests.json();
    if (inventory.ok) kitchenInventory = await inventory.json();
    if (catalog.ok) kitchenCatalog = await catalog.json();
    if (tables.ok) kitchenTables = await tables.json();
    if (recipes.ok) kitchenRecipes = await recipes.json();
    if (tasks.ok) kitchenTasks = await tasks.json();
    if (purchases.ok) kitchenPurchases = await purchases.json();
    if (tickets.ok) kitchenTickets = await tickets.json();
    if (temperatures.ok) kitchenTemperatures = await temperatures.json();
    if (menuControl.ok) kitchenMenuControl = await menuControl.json();
    const failed = responses.map((response, index) => response.ok ? null : labels[index]).filter(Boolean);
    if (failed.length) showToast(`Bazı veriler güncellenemedi (${failed.join(', ')}); ekranda eski veri gösteriliyor olabilir.`, 'error');
    renderAll();
  } catch (error) { showToast('Mutfak verileri yüklenemedi.', 'error'); }
}

function renderAll() { renderKpis(); renderBoard(); renderTargets(); renderTasks(); renderStock(); renderPurchases(); renderWasteOptions(); renderRecipes(); renderTemperatures(); renderMenuControl(); renderInventory(); }

function orders() { return kitchenRequests.filter(request => request.type === 'order' && !terminal.has(String(request.status || '').toLowerCase())); }
function lines(order) { try { return Array.isArray(order.details) ? order.details : JSON.parse(order.details || '[]'); } catch { return []; } }
function orderFoodLines(order) { return lines(order).filter(line => kitchenCatalog.find(item => item.id === line.itemId)?.category === 'food'); }
function kitchenOrders() { return orders().filter(order => orderFoodLines(order).length > 0 || String(order.departments || '').includes('Kitchen') || order.target_identifier?.startsWith('Room-')); }
function age(order) { const start = new Date(order.created_at || Date.now()).getTime(); const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

function renderKpis() {
  const active = kitchenTickets;
  const preparing = active.filter(order => order.status === 'preparing').length;
  const ready = active.filter(order => order.status === 'ready').length;
  const critical = kitchenInventory.filter(item => Number(item.stock || 0) <= Number(item.par_level || 0)).length;
  const data = [['fa-list-check', 'Yeni Sipariş', active.filter(order => ['pending', 'accepted'].includes(order.status)).length, 'Sıraya alınacak'], ['fa-fire-burner', 'Hazırlanıyor', preparing, 'Aktif üretim'], ['fa-bell-concierge', 'Hazır', ready, 'Servis bekliyor'], ['fa-boxes-stacked', 'Kritik Stok', critical, critical ? 'Takip gerekli' : 'Kritik kalem yok']];
  document.getElementById('kitchen-kpis').innerHTML = data.map(([icon, label, value, note]) => `<article class="kitchen-kpi"><div><span>${label}</span><i class="fa-solid ${icon}"></i></div><strong>${value}</strong><small>${note}</small></article>`).join('');
}

function renderBoard() {
  const columns = [['queue', 'Sırada', ['pending', 'accepted']], ['preparing', 'Hazırlanıyor', ['preparing']], ['ready', 'Servise Hazır', ['ready']]];
  document.getElementById('kitchen-order-summary').textContent = `${kitchenTickets.length} aktif üretim bileti`;
  document.getElementById('kds-board').innerHTML = columns.map(([key, title, statuses]) => { const list = kitchenTickets.filter(ticket => statuses.includes(ticket.status)); return `<section class="kds-column ${key}"><header><strong>${title}</strong><span>${list.length}</span></header><div class="kds-list">${list.length ? list.map(ticketCard).join('') : emptyState('fa-check', 'Bu kuyruk boş', 'Yeni sipariş geldiğinde burada görünür.')}</div></section>`; }).join('');
  document.querySelectorAll('[data-ticket-action]').forEach(button => button.addEventListener('click', () => updateTicket(button.dataset.ticketId, button.dataset.ticketAction)));
  document.querySelectorAll('.ticket-cancel-btn').forEach(button => button.addEventListener('click', () => cancelTicketRequest(button.dataset.cancelRequestId)));
}

function ticketCard(ticket) {
  const actions = ticket.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-ticket-action="accepted" data-ticket-id="${esc(ticket.id)}">Siparişi Al</button>` : ticket.status === 'accepted' ? `<button class="btn btn-primary btn-sm" data-ticket-action="preparing" data-ticket-id="${esc(ticket.id)}">Hazırlığa Başla</button>` : ticket.status === 'preparing' ? `<button class="btn btn-success btn-sm" data-ticket-action="ready" data-ticket-id="${esc(ticket.id)}">Hazır Bildir</button>` : `<span>Servis ekibi teslim alacak</span>`;
  const cancelBtn = `<button class="btn btn-danger btn-xs ticket-cancel-btn" data-cancel-request-id="${esc(ticket.request_id || ticket.id)}" title="Siparişi geçmişe aktararak iptal et" style="margin-left:auto;padding:3px 8px;font-size:11px"><i class="fa-solid fa-ban"></i> İptal</button>`;
  return `<article class="kds-ticket ${ticket.target_identifier?.startsWith('Room-') ? 'room' : 'table'}"><div class="kds-ticket-head"><div><strong>${esc(ticket.target_identifier || 'Hedef yok')}</strong><small>${esc(ticket.station_name || 'İstasyon')} · ${esc(ticket.course || 'main')}</small></div><time>${age({ created_at: ticket.order_created_at })}</time></div><div class="kds-lines"><div><b>${Number(ticket.quantity || 1)}×</b> ${esc(ticket.item_name)}</div>${ticket.modifiers ? `<div class="kds-note">${esc(ticket.modifiers)}</div>` : ''}${ticket.allergen_notes ? `<div class="kds-allergen"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(ticket.allergen_notes)}</div>` : ''}</div><div class="kds-ticket-foot"><span>${ticket.fire_count ? `${ticket.fire_count} re-fire` : 'İlk üretim'}</span>${actions}${cancelBtn}</div></article>`;
}

async function updateTicket(id, status) { try { await patch(`/api/kitchen/tickets/${encodeURIComponent(id)}${tenantQuery()}`, { status }); showToast(status === 'ready' ? 'Ürün servis için hazırlandı.' : 'Üretim bileti güncellendi.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }

async function cancelTicketRequest(requestId) {
  if (!confirm('Bu sipariş iptal edilip geçmişe aktarılsın mı?')) return;
  try {
    const res = await fetch(`/api/requests/status${tenantQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status: 'cancelled', completed_by: activeUser?.name || 'Mutfak', reason: 'Mutfak ekranından iptal edildi' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Sipariş iptal edilerek geçmişe aktarıldı.', 'success');
    await loadKitchenData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderTargets() {
  const tableCards = kitchenTables.map(table => { const tableOrders = kitchenTickets.filter(order => order.target_identifier === `Table-${table.table_number}`); return targetCard(table.table_number, table.section || 'Restoran', tableOrders, 'Masa'); });
  const roomKeys = [...new Set(kitchenTickets.filter(order => order.target_identifier?.startsWith('Room-')).map(order => order.target_identifier.slice(5)))];
  const roomCards = roomKeys.map(room => targetCard(room, 'Oda servisi', kitchenTickets.filter(order => order.target_identifier === `Room-${room}`), 'Oda'));
  document.getElementById('kitchen-target-grid').innerHTML = `<section class="kitchen-target-section"><h3>Restoran Masaları</h3><div class="kitchen-target-cards">${tableCards.join('') || emptyState('fa-table-cells', 'Masa bulunamadı', 'Merkezi masa planı boş.')}</div></section><section class="kitchen-target-section"><h3>Oda Servisi</h3><div class="kitchen-target-cards">${roomCards.join('') || emptyState('fa-bed', 'Açık oda servisi yok', 'Oda siparişleri geldiğinde burada görünür.')}</div></section>`;
}

function targetCard(name, section, list, type) { const status = list.some(order => order.status === 'ready') ? 'ready' : list.some(order => order.status === 'preparing') ? 'preparing' : list.length ? 'queue' : 'empty'; return `<article class="kitchen-target-card ${status}"><div><span>${type}</span><strong>${esc(name)}</strong><small>${esc(section)}</small></div><b>${list.length ? `${list.length} açık iş` : 'Müsait'}</b></article>`; }

function renderTasks() { const list = document.getElementById('kitchen-task-list'); if (!kitchenTasks.length) { list.innerHTML = emptyState('fa-clipboard-check', 'Açık hazırlık görevi yok', 'Yeni görevleri buradan gerçek operasyon kaydı olarak oluşturabilirsiniz.'); return; } list.innerHTML = kitchenTasks.map(task => `<div class="kitchen-list-row"><div><strong>${esc(task.details || task.task_type)}</strong><small>${esc(task.priority || 'normal')} öncelik · ${esc(task.created_by || '')}</small></div><button class="btn btn-success btn-sm" type="button" data-task-id="${esc(task.id)}">Tamamla</button></div>`).join(''); list.querySelectorAll('[data-task-id]').forEach(button => button.addEventListener('click', () => completeTask(button.dataset.taskId))); }
function renderStock() { const list = document.getElementById('kitchen-stock-list'); const stock = kitchenInventory.filter(item => Number(item.stock || 0) <= Number(item.par_level || 0)).sort((a,b) => Number(a.stock || 0) - Number(b.stock || 0)); document.getElementById('kitchen-stock-summary').textContent = `${stock.length} kritik`; list.innerHTML = stock.length ? stock.map(item => `<div class="kitchen-list-row"><div><strong>${esc(item.name)}</strong><small>Mevcut ${Number(item.stock || 0)} ${esc(item.unit || '')} · hedef ${Number(item.par_level || 0)}</small></div><b class="stock-danger">Kritik</b></div>`).join('') : emptyState('fa-boxes-stacked', 'Kritik stok yok', 'Stok seviyesi tanımlı eşiklerin üzerinde.'); }
function renderPurchases() { const list = document.getElementById('kitchen-purchase-list'); list.innerHTML = kitchenPurchases.length ? kitchenPurchases.slice(0, 8).map(request => `<div class="kitchen-list-row"><div><strong>${esc(request.item_name)}</strong><small>${Number(request.quantity)} · ${esc(request.requested_by || '')}</small></div><b>${esc(request.status)}</b></div>`).join('') : emptyState('fa-truck-ramp-box', 'Açık satın alma talebi yok', 'Kritik malzemeler için talep açabilirsiniz.'); }
function renderWasteOptions() { const select = document.getElementById('kitchen-waste-item'); select.innerHTML = kitchenInventory.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${Number(item.stock || 0)} ${esc(item.unit || '')}</option>`).join(''); }
function renderTemperatures() { const list = document.getElementById('kitchen-temperature-list'); if (!list) return; list.innerHTML = kitchenTemperatures.length ? kitchenTemperatures.slice(0, 5).map(log => `<div class="kitchen-list-row"><div><strong>${esc(log.area)}</strong><small>${new Date(log.recorded_at).toLocaleString('tr-TR')} · ${esc(log.recorded_by)}</small></div><b>${Number(log.temperature).toFixed(1)}°C</b></div>`).join('') : emptyState('fa-temperature-half', 'Bugün sıcaklık kaydı yok', 'Soğuk depo, sıcak bekletme ve teslim alma sıcaklıklarını kayıt altına alın.'); }
function renderMenuControl() { const list = document.getElementById('kitchen-menu-control-list'); if (!list) return; list.innerHTML = kitchenMenuControl.length ? kitchenMenuControl.map(item => `<div class="kitchen-list-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.station_name)} · ${item.active ? 'Satışa açık' : '86 / satış kapalı'}</small></div><button class="btn ${item.active ? 'btn-danger' : 'btn-success'} btn-sm" type="button" data-menu-toggle-id="${esc(item.id)}" data-menu-toggle-active="${item.active ? '0' : '1'}">${item.active ? '86 Yap' : 'Satışa Aç'}</button></div>`).join('') : emptyState('fa-ban', 'Yemek ürünü yok', 'Menü ürünleri burada yönetilir.'); list.querySelectorAll('[data-menu-toggle-id]').forEach(button => button.addEventListener('click', () => toggleMenuItem(button.dataset.menuToggleId, button.dataset.menuToggleActive === '1'))); }
function renderRecipes() { const list = document.getElementById('kitchen-recipe-list'); const food = kitchenCatalog.filter(item => item.category === 'food'); if (!food.length) { list.innerHTML = emptyState('fa-book-open', 'Ürün kartı yok', 'Merkezi menü tanımlandığında reçeteler burada görünür.'); return; } list.innerHTML = food.map(item => { const recipe = kitchenRecipes.filter(line => line.catalog_item_id === item.id); return `<div class="kitchen-list-row"><div><strong>${esc(item.name)}</strong><small>${recipe.length ? recipe.map(line => `${esc(line.inventory_name || line.inventory_id)} ${line.amount_needed}`).join(' · ') : 'Reçete kalemi tanımlanmamış'}</small></div><b>${money(item.price)}</b></div>`; }).join(''); }

function setupTabs() { const tabs = ['kds', 'tables', 'actions', 'inventory']; const select = tab => { tabs.forEach(name => { const mobileTab = document.getElementById(`nav-kitchen-tab-${name}`); if (mobileTab) mobileTab.classList.toggle('active', name === tab); const subview = document.getElementById(`kitchen-subview-${name}`); if (subview) subview.classList.toggle('active', name === tab); document.querySelectorAll(`[data-kitchen-view="${name}"]`).forEach(button => button.classList.toggle('active', name === tab)); }); window.scrollTo({ top: 0, behavior: 'smooth' }); }; tabs.forEach(tab => { const el = document.getElementById(`nav-kitchen-tab-${tab}`); if (el) el.addEventListener('click', event => { event.preventDefault(); select(tab); }); }); document.querySelectorAll('[data-kitchen-view]').forEach(button => button.addEventListener('click', () => select(button.dataset.kitchenView))); }
function setupActions() { document.getElementById('btn-staff-logout').addEventListener('click', () => window.aeonLogout?.()); document.getElementById('kitchen-task-form').addEventListener('submit', createTask); document.getElementById('kitchen-purchase-form').addEventListener('submit', createPurchase); document.getElementById('kitchen-waste-form').addEventListener('submit', createWaste); document.getElementById('kitchen-temperature-form').addEventListener('submit', createTemperature); setupInventoryActions(); }
async function createTask(event) { event.preventDefault(); try { await post(`/api/kitchen/tasks${tenantQuery()}`, { details: document.getElementById('kitchen-task-detail').value, priority: document.getElementById('kitchen-task-priority').value }); event.target.reset(); showToast('Hazırlık görevi kaydedildi.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function completeTask(id) { try { await patch(`/api/kitchen/tasks/${encodeURIComponent(id)}${tenantQuery()}`, { status: 'completed' }); showToast('Görev tamamlandı.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function createPurchase(event) { event.preventDefault(); try { await post(`/api/purchase_requests${tenantQuery()}`, { item_name: document.getElementById('kitchen-purchase-item').value, quantity: Number(document.getElementById('kitchen-purchase-quantity').value), requested_by: activeUser?.name || 'Mutfak' }); event.target.reset(); showToast('Satın alma talebi açıldı.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function createWaste(event) { event.preventDefault(); try { await post(`/api/kitchen/waste${tenantQuery()}`, { inventory_id: document.getElementById('kitchen-waste-item').value, quantity: Number(document.getElementById('kitchen-waste-quantity').value), reason: document.getElementById('kitchen-waste-reason').value, notes: document.getElementById('kitchen-waste-notes').value }); event.target.reset(); showToast('Zayiat merkezi stoğa işlendi.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function createTemperature(event) { event.preventDefault(); try { await post(`/api/kitchen/temperatures${tenantQuery()}`, { area: document.getElementById('kitchen-temperature-area').value, temperature: Number(document.getElementById('kitchen-temperature-value').value), corrective_action: document.getElementById('kitchen-temperature-action').value }); event.target.reset(); showToast('Sıcaklık kaydı kaydedildi.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function toggleMenuItem(id, active) { try { await patch(`/api/kitchen/menu-control/${encodeURIComponent(id)}${tenantQuery()}`, { active }); showToast(active ? 'Ürün tekrar satışa açıldı.' : 'Ürün 86 yapıldı; restoran menüsünden kalktı.', 'success'); await loadKitchenData(); } catch (error) { showToast(error.message, 'error'); } }
async function post(url, body) { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey() }, body: JSON.stringify(body) }); return parseResponse(response); }
async function patch(url, body) { const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey() }, body: JSON.stringify(body) }); return parseResponse(response); }
async function parseResponse(response) { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'İşlem tamamlanamadı.'); return body; }
function updateClock() { document.getElementById('kitchen-clock').textContent = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()); }
function emptyState(icon, title, text) { return `<div class="kitchen-empty"><i class="fa-solid ${icon}"></i><strong>${title}</strong><span>${text}</span></div>`; }
function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function showToast(message, type) { const toast = document.getElementById('kitchen-toast'); toast.textContent = message; toast.className = `show ${type}`; setTimeout(() => { toast.className = ''; }, 3500); }

// ─── Inventory Management ───────────────────────────────────────────────
function renderInventory() {
  const tbody = document.getElementById('kitchen-inv-tbody');
  const summary = document.getElementById('kitchen-inv-summary');
  const affected = document.getElementById('kitchen-inv-affected');
  if (!tbody) return;

  const searchTerm = (document.getElementById('kitchen-inv-search')?.value || '').toLocaleLowerCase('tr-TR');
  const filterVal = document.getElementById('kitchen-inv-filter')?.value || 'all';

  let items = [...kitchenInventory];

  // Apply filter
  if (filterVal === 'critical') items = items.filter(i => Number(i.stock || 0) <= Number(i.par_level || 0) && Number(i.stock || 0) > 0);
  else if (filterVal === 'zero') items = items.filter(i => Number(i.stock || 0) <= 0);
  else if (filterVal === 'dining') items = items.filter(i => i.module_type === 'dining');
  else if (filterVal === 'bar') items = items.filter(i => i.module_type === 'bar');

  // Apply search
  if (searchTerm) items = items.filter(i => (i.name || '').toLocaleLowerCase('tr-TR').includes(searchTerm));

  // Sort within groups: zero first, then critical, then alphabetical
  const sortItems = (arr) => arr.sort((a, b) => {
    const aStock = Number(a.stock || 0), bStock = Number(b.stock || 0);
    const aPar = Number(a.par_level || 0), bPar = Number(b.par_level || 0);
    if (aStock <= 0 && bStock > 0) return -1;
    if (bStock <= 0 && aStock > 0) return 1;
    if (aStock <= aPar && bStock > bPar) return -1;
    if (bStock <= bPar && aStock > aPar) return 1;
    return (a.name || '').localeCompare(b.name || '', 'tr');
  });

  const criticalCount = kitchenInventory.filter(i => Number(i.stock || 0) <= Number(i.par_level || 0)).length;
  const zeroCount = kitchenInventory.filter(i => Number(i.stock || 0) <= 0).length;
  summary.textContent = `${kitchenInventory.length} malzeme · ${criticalCount} kritik · ${zeroCount} sıfır`;

  const renderRow = (item) => {
    const stock = Number(item.stock || 0);
    const par = Number(item.par_level || 0);
    const isZero = stock <= 0;
    const isCritical = stock <= par && stock > 0;
    const rowClass = isZero ? 'inv-row-zero' : isCritical ? 'inv-row-critical' : '';
    const purchaseUnit = item.purchase_unit || item.unit;
    const purchaseAmt = Number(item.purchase_unit_amount) || 1;
    const stockInPurchase = purchaseAmt > 0 ? (stock / purchaseAmt).toFixed(1) : stock;
    return `<tr class="${rowClass}">
      <td><strong>${esc(item.name)}</strong></td>
      <td><span class="inv-stock-val">${stock.toFixed(1)}</span> <small>${esc(item.unit)}</small>${purchaseAmt > 1 ? `<br><small class="inv-purchase-equiv">(≈ ${stockInPurchase} ${esc(purchaseUnit)})</small>` : ''}</td>
      <td>${esc(item.unit)}</td>
      <td>${par}</td>
      <td>${purchaseAmt > 1 ? `1 ${esc(purchaseUnit)} = ${purchaseAmt} ${esc(item.unit)}` : esc(purchaseUnit)}</td>
      <td>
        <form class="inv-add-form" data-inv-id="${esc(item.id)}">
          <input type="number" min="0.1" step="0.1" value="1" class="inv-add-qty" required>
          <span class="inv-add-unit">${esc(purchaseUnit)}</span>
          <button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i></button>
        </form>
      </td>
      <td>
        <button class="btn btn-sm inv-edit-btn" data-inv-edit="${esc(item.id)}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
      </td>
    </tr>`;
  };

  // Group by module_type, then by sub_category
  const subCatIcons = { 'kırmızı et': '🥩', 'beyaz et': '🍗', 'deniz ürünleri': '🐟', 'şarküteri': '🥓', 'süt ürünleri': '🧀', 'tahıl & hamur': '🌾', 'sebze': '🥬', 'yeşillik': '🌿', 'meyve': '🍎', 'kuruyemiş & kuru': '🥜', 'yağ & sos': '🫒', 'baharat': '🧂', 'içecek': '☕', 'diğer': '📦', 'rakı': '🍶', 'şarap': '🍷', 'şampanya': '🥂', 'viski': '🥃', 'votka': '🍸', 'rom': '🏴‍☠️', 'cin': '🫐', 'likör': '🍹', 'bira': '🍺', 'alkolsüz': '🥤', 'garnitür': '🧊', 'kuruyemiş': '🥜' };

  const moduleGroups = [
    { key: 'dining', label: '🍳 MUTFAK', icon: 'fa-utensils' },
    { key: 'bar', label: '🍸 BAR', icon: 'fa-martini-glass-citrus' }
  ];

  if (items.length) {
    let html = '';
    for (const mg of moduleGroups) {
      const moduleItems = items.filter(i => i.module_type === mg.key);
      if (!moduleItems.length) continue;
      // Module header
      html += `<tr class="inv-module-header"><td colspan="7"><i class="fa-solid ${mg.icon}"></i> ${mg.label} <span class="inv-module-count">(${moduleItems.length})</span></td></tr>`;
      // Group by sub_category
      const cats = {};
      moduleItems.forEach(i => { const c = i.sub_category || 'diğer'; if (!cats[c]) cats[c] = []; cats[c].push(i); });
      for (const [cat, catItems] of Object.entries(cats)) {
        sortItems(catItems);
        const catIcon = subCatIcons[cat] || '📋';
        const catCritical = catItems.filter(i => Number(i.stock || 0) <= Number(i.par_level || 0)).length;
        html += `<tr class="inv-subcat-header"><td colspan="7">${catIcon} ${cat.charAt(0).toUpperCase() + cat.slice(1)} <span class="inv-subcat-count">(${catItems.length}${catCritical ? ` · <span class="inv-subcat-warn">${catCritical} kritik</span>` : ''})</span></td></tr>`;
        html += catItems.map(renderRow).join('');
      }
    }
    tbody.innerHTML = html;
  } else {
    tbody.innerHTML = `<tr><td colspan="7">${emptyState('fa-warehouse', 'Envanter kalemi yok', 'Henüz hammadde tanımlanmamış.')}</td></tr>`;
  }

  // Show affected menu items for zero-stock ingredients
  if (affected) {
    const zeroInvIds = new Set(kitchenInventory.filter(i => Number(i.stock || 0) <= 0).map(i => i.id));
    const affectedItems = kitchenCatalog.filter(item => {
      const itemRecipes = kitchenRecipes.filter(r => r.catalog_item_id === item.id);
      return itemRecipes.some(r => zeroInvIds.has(r.inventory_id));
    });
    affected.innerHTML = affectedItems.length ? `<div class="kitchen-panel inv-affected-panel"><div class="kitchen-section-head"><h3><i class="fa-solid fa-triangle-exclamation"></i> Stok Yetersizliğinden Etkilenen Menü Ürünleri (${affectedItems.length})</h3></div><div class="inv-affected-list">${affectedItems.map(item => {
      const missing = kitchenRecipes.filter(r => r.catalog_item_id === item.id && zeroInvIds.has(r.inventory_id));
      const missingNames = missing.map(r => {
        const inv = kitchenInventory.find(i => i.id === r.inventory_id);
        return inv ? inv.name : r.inventory_id;
      });
      return `<div class="kitchen-list-row"><div><strong>${esc(item.name)}</strong><small>Eksik: ${missingNames.map(n => esc(n)).join(', ')}</small></div><b class="stock-danger">${Number(item.in_stock) ? 'Menüde' : 'Menüden Kalktı'}</b></div>`;
    }).join('')}</div></div>` : '';
  }

  // Wire up add-stock forms
  tbody.querySelectorAll('.inv-add-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const invId = form.dataset.invId;
      const qty = Number(form.querySelector('.inv-add-qty').value);
      if (!qty || qty <= 0) return;
      try {
        await post(`/api/inventory/add-stock${tenantQuery()}`, { inventory_id: invId, purchase_quantity: qty, staff_name: activeUser?.name || 'Mutfak' });
        showToast('Stok eklendi.', 'success');
        await loadKitchenData();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  // Wire up edit buttons
  tbody.querySelectorAll('.inv-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openInvEditModal(btn.dataset.invEdit));
  });
}

function openInvEditModal(invId) {
  const item = kitchenInventory.find(i => i.id === invId);
  if (!item) return;

  const existing = document.getElementById('inv-edit-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'inv-edit-overlay';
  overlay.className = 'inv-edit-overlay';
  overlay.innerHTML = `
    <div class="inv-edit-modal">
      <h3><i class="fa-solid fa-pen"></i> ${esc(item.name)} Düzenle</h3>
      <form id="inv-edit-form">
        <label>Mevcut Stok (${esc(item.unit)})<input type="number" step="0.1" value="${Number(item.stock || 0)}" name="stock"></label>
        <label>Min. Stok<input type="number" step="0.1" value="${Number(item.par_level || 0)}" name="par_level"></label>
        <label>Birim Maliyet (₺)<input type="number" step="0.01" value="${Number(item.unit_cost || 0)}" name="unit_cost"></label>
        <label>Ambalaj Birimi<input type="text" value="${esc(item.purchase_unit || '')}" name="purchase_unit" placeholder="paket, şişe, kutu..."></label>
        <label>1 Ambalaj = kaç ${esc(item.unit)}?<input type="number" step="0.1" value="${Number(item.purchase_unit_amount || 0)}" name="purchase_unit_amount"></label>
        <div class="inv-edit-actions">
          <button type="button" class="btn" id="inv-edit-cancel">İptal</button>
          <button type="submit" class="btn btn-primary">Kaydet</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#inv-edit-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#inv-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    for (const [k, v] of fd.entries()) body[k] = k === 'purchase_unit' ? v : Number(v);
    try {
      const resp = await fetch(`/api/inventory/${encodeURIComponent(invId)}${tenantQuery()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Güncelleme başarısız.');
      overlay.remove();
      showToast('Envanter güncellendi.', 'success');
      await loadKitchenData();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function setupInventoryActions() {
  const search = document.getElementById('kitchen-inv-search');
  const filter = document.getElementById('kitchen-inv-filter');
  const fill = document.getElementById('btn-kitchen-stock-fill');
  if (search) search.addEventListener('input', renderInventory);
  if (filter) filter.addEventListener('change', renderInventory);
  if (fill) fill.addEventListener('click', async () => {
    if (!confirm("Tüm envanter kalemleri en az 1000 birime tamamlanacak. Devam edilsin mi?")) return;
    fill.disabled = true;
    try {
      const result = await post(`/api/inventory/fill-stock${tenantQuery()}`, { target_stock: 1000 });
      showToast(`${result.updatedCount} stok kalemi 1000 birime tamamlandı.`, 'success');
      await loadKitchenData();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      fill.disabled = false;
    }
  });
}
