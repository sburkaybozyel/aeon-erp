import { state } from './state.js';
import { notifyNewOrder } from './order-alert.js';

let restTables = [];
let restRequests = [];
let restCatalog = [];
let restCatalogManagement = [];
let restRooms = [];
let restKitchenTickets = [];
let restCart = [];
let activeCategory = 'all';
let activeTable = null;
let activeTableOrders = [];
let activeUser = null;
let selectedOrderTarget = '';

const inactiveStatuses = new Set(['completed', 'paid', 'delivered', 'cancelled', 'rejected']);
const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));
const tenantQuery = () => `?tenant_id=${encodeURIComponent(state.currentTenant || 'aeon')}`;
const requestKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

document.addEventListener('DOMContentLoaded', async () => {
  activeUser = await window.aeonBoot();
  if (!activeUser || !['restaurant', 'waiter', 'admin', 'manager', 'yönetici'].includes(String(activeUser.role || '').toLocaleLowerCase('tr-TR'))) return;
  setupTabs();
  setupCategoryFilters();
  setupModals();
  setupActions();
  setupMenuManagement();
  if (new URLSearchParams(window.location.search).get('inbox') === 'orders') setRestaurantSubview('service');
  await loadRestaurantData();
  initRestaurantSSE();
  // SSE runs over a single serverless function instance; on Vercel a push can miss a
  // screen connected to a different instance, so poll as a safety net independent of SSE.
  setInterval(loadRestaurantData, 8000);
});

function initRestaurantSSE() {
  const stream = new EventSource(`/api/events${tenantQuery()}`);
  ['table_updated', 'request_updated', 'request_created', 'request_deleted', 'bar_order_created', 'bar_order_updated'].forEach(event => stream.addEventListener(event, loadRestaurantData));
  stream.addEventListener('request_created', event => {
    let departments = [];
    try { departments = JSON.parse(event.data || '{}').departments || []; } catch (error) { departments = []; }
    if (departments.some(department => String(department).toLocaleLowerCase('tr-TR') === 'restaurant')) notifyNewOrder(event);
  });
  stream.addEventListener('bar_order_created', notifyNewOrder);
  stream.onerror = () => {
    stream.close();
    setTimeout(initRestaurantSSE, 3000);
  };
}

async function loadRestaurantData() {
  try {
    const [tablesResponse, requestsResponse, catalogResponse, roomsResponse, kitchenTicketsResponse, menuManagementResponse] = await Promise.all([
      fetch(`/api/tables${tenantQuery()}`),
      fetch(`/api/requests${tenantQuery()}`),
      fetch(`/api/catalog${tenantQuery()}`),
      fetch(`/api/rooms${tenantQuery()}`),
      fetch(`/api/kitchen/tickets${tenantQuery()}`),
      fetch(`/api/catalog/availability${tenantQuery()}`)
    ]);
    if (tablesResponse.ok) restTables = await tablesResponse.json();
    if (requestsResponse.ok) restRequests = await requestsResponse.json();
    if (catalogResponse.ok) restCatalog = await catalogResponse.json();
    if (roomsResponse.ok) restRooms = await roomsResponse.json();
    if (kitchenTicketsResponse.ok) restKitchenTickets = await kitchenTicketsResponse.json();
    if (menuManagementResponse.ok) restCatalogManagement = await menuManagementResponse.json();
    const labels = { 'Masalar': tablesResponse, 'Siparişler': requestsResponse, 'Katalog': catalogResponse, 'Odalar': roomsResponse };
    const failed = Object.entries(labels).filter(([, response]) => !response.ok).map(([label]) => label);
    if (failed.length) showToast(`Bazı veriler güncellenemedi (${failed.join(', ')}); ekranda eski veri gösteriliyor olabilir.`, 'error');
    renderAll();
  } catch (error) {
    showToast('Restoran verileri şu anda yüklenemedi.', 'error');
  }
}

function renderAll() {
  renderKpis();
  renderTables();
  renderOrdersQueue();
  renderMenuItems();
  renderCart();
  renderMenuManagement();
}

function activeOrdersFor(target) {
  return restRequests.filter(order => order.target_identifier === target && !inactiveStatuses.has(String(order.status || '').toLowerCase()));
}

function renderKpis() {
  const occupied = restTables.filter(table => activeOrdersFor(`Table-${table.table_number}`).length > 0 || table.status === 'occupied').length;
  const ready = restRequests.filter(request => request.type === 'order' && String(request.status || '').toLowerCase() === 'ready').length;
  const activeOrders = restRequests.filter(request => request.type === 'order' && !inactiveStatuses.has(String(request.status || '').toLowerCase()));
  const sales = activeOrders.reduce((sum, request) => sum + orderAmount(request), 0);
  const items = [
    ['fa-table-cells-large', 'Açık Masa', occupied, `${restTables.length} masadan`],
    ['fa-bell-concierge', 'Servis Bekleyen', ready, ready ? 'Teslim bekliyor' : 'Hazır ürün yok'],
    ['fa-receipt', 'Açık Adisyon', activeOrders.length, 'Aktif sipariş'],
    ['fa-turkish-lira-sign', 'Açık Tutar', money(sales), 'Tahsil edilmemiş']
  ];
  document.getElementById('restaurant-kpis').innerHTML = items.map(([icon, label, value, note]) => `<article class="restaurant-kpi"><div class="restaurant-kpi-top"><span>${label}</span><i class="fa-solid ${icon}"></i></div><strong>${value}</strong><small>${note}</small></article>`).join('');
}

function tableState(table, orders) {
  if (orders.some(order => order.type === 'bill_call')) return ['bill', 'Hesap istendi'];
  if (orders.some(order => order.status === 'ready')) return ['service', 'Servise hazır'];
  if (orders.length || table.status === 'occupied') return ['occupied', 'Açık adisyon'];
  return ['empty', 'Müsait'];
}

function renderTables() {
  const grid = document.getElementById('staff-restaurant-tables-grid');
  const summary = document.getElementById('restaurant-table-summary');
  if (!restTables.length) {
    summary.textContent = 'Masa planı bulunamadı';
    grid.innerHTML = emptyState('fa-table-cells-large', 'Masa planı henüz yok', 'Restoran masaları tanımlandığında burada bölümlere ayrılmış şekilde görünür.');
    return;
  }
  const sections = new Map();
  restTables.forEach(table => {
    const section = table.section || 'Restoran';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(table);
  });
  const occupied = restTables.filter(table => activeOrdersFor(`Table-${table.table_number}`).length || table.status === 'occupied').length;
  summary.textContent = `${occupied} açık · ${restTables.length - occupied} müsait`;
  grid.innerHTML = Array.from(sections.entries()).map(([section, tables]) => `<section class="restaurant-zone"><div class="restaurant-zone-title"><strong>${escapeHtml(section)}</strong><span>${tables.length} masa</span></div><div class="restaurant-table-grid">${tables.map(table => tableCard(table)).join('')}</div></section>`).join('');
  grid.querySelectorAll('[data-table-id]').forEach(button => button.addEventListener('click', () => {
    const table = restTables.find(item => item.id === button.dataset.tableId);
    if (!table) return;
    const orders = activeOrdersFor(`Table-${table.table_number}`);
    if (orders.length) {
      openTableDetail(table, orders);
      return;
    }
    openOrderForTarget(`Table-${table.table_number}`);
  }));
}

function openOrderForTarget(target) {
  document.getElementById('table-detail-modal').style.display = 'none';
  setRestaurantSubview('order');
  selectedOrderTarget = target;
  renderCart();
  document.getElementById('menu-items-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tableCard(table) {
  const orders = activeOrdersFor(`Table-${table.table_number}`);
  const [stateName, label] = tableState(table, orders);
  return `<button class="restaurant-table-card ${stateName}" type="button" data-table-id="${escapeHtml(table.id)}"><div class="restaurant-table-card-top"><strong>${escapeHtml(table.table_number)}</strong><span class="restaurant-status ${stateName}">${label}</span></div><small>${orders.length ? `${orders.length} aktif sipariş · ${money(orders.reduce((sum, order) => sum + orderAmount(order), 0))}` : 'Yeni sipariş için seçin'}</small></button>`;
}

function orderStatusMeta(status) {
  const key = String(status || '').toLowerCase();
  return {
    pending: ['pending', 'Beklemede'],
    accepted: ['pending', 'Kabul Edildi'],
    preparing: ['pending', 'Hazırlanıyor'],
    ready: ['service', 'Teslime Hazır'],
    served: ['empty', 'Teslim Edildi']
  }[key] || ['pending', status || 'Beklemede'];
}

function kitchenLinesForOrder(orderId) {
  return restKitchenTickets.filter(ticket => ticket.request_id === orderId && !['served', 'completed', 'cancelled', 'rejected'].includes(String(ticket.status || '').toLowerCase()));
}

function renderOrdersQueue() {
  const grid = document.getElementById('staff-restaurant-ready-grid');
  const activeOrders = restRequests
    .filter(request => request.type === 'order' && !inactiveStatuses.has(String(request.status || '').toLowerCase()))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const readyCount = activeOrders.filter(order => String(order.status || '').toLowerCase() === 'ready').length;
  document.getElementById('restaurant-service-summary').textContent = activeOrders.length ? `${activeOrders.length} aktif sipariş · ${readyCount} teslime hazır` : 'Aktif sipariş yok';
  if (!activeOrders.length) {
    grid.innerHTML = emptyState('fa-bell-concierge', 'Bekleyen sipariş yok', 'Masa veya oda için gönderilen yeni siparişler burada anında görünür.');
    return;
  }
  const lanes = [
    { title: 'Yeni', statuses: ['pending', 'accepted'], empty: 'Yeni sipariş yok' },
    { title: 'Hazırlanıyor', statuses: ['preparing'], empty: 'Hazırlanan sipariş yok' },
    { title: 'Servis Bekliyor', statuses: ['ready'], empty: 'Teslime hazır sipariş yok' }
  ];
  const orderCard = order => {
    const [statusClass, statusLabel] = orderStatusMeta(order.status);
    const lines = kitchenLinesForOrder(order.id);
    const status = String(order.status || '').toLowerCase();
    const progress = status === 'pending' ? { label: 'Siparişi Al', status: 'accepted' } : status === 'accepted' ? { label: 'Hazırla', status: 'preparing' } : status === 'preparing' ? { label: 'Hazır Bildir', status: 'ready' } : null;
    const lineRows = lines.map(line => `<div class="restaurant-order-line"><span>${line.quantity} × ${escapeHtml(line.item_name)} <em>(${escapeHtml(line.station_name || 'Mutfak')} · ${escapeHtml(orderStatusMeta(line.status)[1])})</em></span><button type="button" class="btn btn-danger btn-xs" data-void-line="${escapeHtml(line.id)}" title="Bu kalemi siparişten kaldır"><i class="fa-solid fa-xmark"></i> Kaldır</button></div>`).join('');
    return `<article class="restaurant-service-card">
      <header><strong>${escapeHtml(order.target_identifier || 'Hedef belirtilmedi')}</strong><span class="restaurant-status ${statusClass}">${escapeHtml(statusLabel)}</span></header>
      <p>${productionBreakdown(order)}</p>
      ${lineRows ? `<div class="restaurant-order-lines">${lineRows}</div>` : ''}
      <div class="restaurant-order-card-actions">
        ${progress ? `<button class="btn btn-primary btn-sm" type="button" data-progress-order="${escapeHtml(order.id)}" data-progress-status="${escapeHtml(progress.status)}">${progress.label}</button>` : ''}
        ${String(order.status || '').toLowerCase() === 'ready' ? `<button class="btn btn-success btn-sm restaurant-submit" type="button" data-deliver-id="${escapeHtml(order.id)}">${deliveryActionLabel(order)}</button>` : ''}
        <button class="btn btn-danger btn-sm" type="button" data-cancel-order="${escapeHtml(order.id)}"><i class="fa-solid fa-ban"></i> Siparişi İptal Et</button>
      </div>
    </article>`;
  };
  grid.innerHTML = lanes.map(lane => {
    const orders = activeOrders.filter(order => lane.statuses.includes(String(order.status || '').toLowerCase()));
    return `<section class="restaurant-flow-lane"><header><strong>${lane.title}</strong><span>${orders.length}</span></header><div class="restaurant-flow-lane-list">${orders.length ? orders.map(orderCard).join('') : `<div class="restaurant-flow-empty">${lane.empty}</div>`}</div></section>`;
  }).join('');
  grid.querySelectorAll('[data-deliver-id]').forEach(button => button.addEventListener('click', () => completeDelivery(button.dataset.deliverId, button)));
  grid.querySelectorAll('[data-progress-order]').forEach(button => button.addEventListener('click', () => progressRestaurantOrder(button.dataset.progressOrder, button.dataset.progressStatus, button)));
  grid.querySelectorAll('[data-cancel-order]').forEach(button => button.addEventListener('click', () => cancelRestaurantOrder(button.dataset.cancelOrder)));
  grid.querySelectorAll('[data-void-line]').forEach(button => button.addEventListener('click', () => voidKitchenLine(button.dataset.voidLine, button)));
}

async function progressRestaurantOrder(orderId, status, button) {
  if (button) button.disabled = true;
  try {
    await post(`/api/requests/status${tenantQuery()}`, { requestId: orderId, status, completed_by: activeUser?.name || 'Restoran POS' });
    showToast(status === 'accepted' ? 'Sipariş akışa alındı.' : status === 'preparing' ? 'Sipariş hazırlığa alındı.' : 'Sipariş hazır olarak işaretlendi.', 'success');
    await loadRestaurantData();
  } catch (error) {
    showToast(error.message || 'Sipariş durumu güncellenemedi.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function renderMenuManagement() {
  const list = document.getElementById('restaurant-menu-admin-list');
  if (!list) return;
  if (!restCatalogManagement.length) {
    list.innerHTML = emptyState('fa-utensils', 'Menü ürünü yok', 'Soldaki formdan ilk ürünü ekleyin.');
    return;
  }
  list.innerHTML = restCatalogManagement.map(item => `<article class="restaurant-menu-admin-card" data-menu-id="${escapeHtml(item.id)}"><div class="restaurant-menu-admin-fields"><label>Ürün<input data-menu-field="name" value="${escapeHtml(item.name)}" maxlength="120"></label><label>Fiyat<input data-menu-field="price" type="number" min="0" step="0.01" value="${escapeHtml(item.price)}"></label><label>Açıklama<input data-menu-field="ingredients" value="${escapeHtml(item.ingredients || '')}" maxlength="500"></label></div><div class="restaurant-menu-admin-actions"><span class="restaurant-menu-category">${escapeHtml(categoryLabel(item.category))}</span><button type="button" class="btn btn-secondary btn-sm" data-menu-save="${escapeHtml(item.id)}">Kaydet</button><button type="button" class="btn btn-sm ${Number(item.in_stock) ? 'btn-success' : 'btn-danger'}" data-menu-toggle="${escapeHtml(item.id)}">${Number(item.in_stock) ? 'Satışta' : 'Pasif'}</button></div></article>`).join('');
}

function categoryLabel(category) {
  return { food: 'Yemek', drink: 'İçecek', minibar: 'Minibar', service: 'Servis' }[String(category || '').toLowerCase()] || String(category || 'Diğer');
}

function setupMenuManagement() {
  const form = document.getElementById('restaurant-menu-form');
  const list = document.getElementById('restaurant-menu-admin-list');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = {
      name: document.getElementById('restaurant-menu-name').value.trim(),
      price: Number(document.getElementById('restaurant-menu-price').value),
      category: document.getElementById('restaurant-menu-category').value,
      ingredients: document.getElementById('restaurant-menu-ingredients').value.trim(),
      module_type: 'dining'
    };
    if (!body.name || !Number.isFinite(body.price) || body.price < 0) return showToast('Ürün adı ve geçerli fiyat zorunludur.', 'error');
    try {
      const response = await fetch(`/api/catalog${tenantQuery()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Ürün eklenemedi.');
      form.reset();
      showToast('Yeni ürün menüye eklendi.', 'success');
      await loadRestaurantData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  list.addEventListener('click', async event => {
    const save = event.target.closest('[data-menu-save]');
    const toggle = event.target.closest('[data-menu-toggle]');
    try {
      if (save) {
        const card = save.closest('[data-menu-id]');
        const fields = Object.fromEntries(Array.from(card.querySelectorAll('[data-menu-field]')).map(input => [input.dataset.menuField, input.value.trim()]));
        const response = await fetch(`/api/catalog/${encodeURIComponent(save.dataset.menuSave)}${tenantQuery()}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fields.name, price: Number(fields.price), ingredients: fields.ingredients }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Menü ürünü güncellenemedi.');
        showToast('Menü ürünü güncellendi.', 'success');
      }
      if (toggle) {
        const item = restCatalogManagement.find(entry => entry.id === toggle.dataset.menuToggle);
        const response = await fetch(`/api/catalog/toggle${tenantQuery()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog_id: item.id, in_stock: !Number(item.in_stock) }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Satış durumu güncellenemedi.');
        showToast(Number(item.in_stock) ? 'Ürün satıştan kaldırıldı.' : 'Ürün satışa açıldı.', 'success');
      }
      if (save || toggle) await loadRestaurantData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

async function voidKitchenLine(ticketId, button) {
  if (!confirm('Bu kalemi siparişten kaldırmak istediğinize emin misiniz? (Stok iade edilir, oda hesabı varsa düzeltilir)')) return;
  if (button) button.disabled = true;
  try {
    await fetch(`/api/kitchen/tickets/${encodeURIComponent(ticketId)}${tenantQuery()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', reason: 'Restoran ekranından kaldırıldı' })
    }).then(async response => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Kalem kaldırılamadı.');
      }
    });
    showToast('Sipariş kalemi kaldırıldı.', 'success');
    await loadRestaurantData();
  } catch (error) {
    showToast(error.message || 'Kalem kaldırılamadı.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function renderMenuItems() {
  const grid = document.getElementById('menu-items-grid');
  const menu = restCatalog.filter(item => activeCategory === 'all' || item.category === activeCategory);
  if (!menu.length) {
    grid.innerHTML = emptyState('fa-utensils', 'Bu kategoride ürün yok', 'Menü ürünleri tanımlandığında siparişe eklemek için burada görünür.');
    return;
  }
  grid.innerHTML = menu.map(item => {
    const subtitle = item.ingredients ? escapeHtml(item.ingredients) : productFlowLabel(item);
    const calLabel = item.calories ? ` · ${item.calories} kcal` : '';
    const tooltip = item.ingredients ? `İçindekiler: ${item.ingredients}${item.calories ? ` | Kalori: ${item.calories} kcal` : ''}` : item.name;
    return `<button class="restaurant-product" type="button" data-product-id="${escapeHtml(item.id)}" title="${escapeHtml(tooltip)}">
      ${item.image_url ? `<img class="restaurant-product-photo" src="${escapeHtml(item.image_url)}" alt="" loading="lazy">` : `<i class="fa-solid ${item.category === 'drink' ? 'fa-wine-glass' : ['minibar', 'service'].includes(item.category) ? 'fa-bell-concierge' : 'fa-utensils'}"></i>`}
      <strong>${escapeHtml(item.name)}</strong>
      <small style="font-size: 10px; color: #94a3b8; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 100%; display: block;">${subtitle}${calLabel}</small>
      <span>${money(item.price)}</span>
    </button>`;
  }).join('');
  grid.querySelectorAll('[data-product-id]').forEach(button => button.addEventListener('click', () => {
    const item = restCatalog.find(product => product.id === button.dataset.productId);
    if (item) addToCart(item);
  }));
}

function addToCart(item) {
  const existing = restCart.find(cartItem => cartItem.id === item.id);
  if (existing) existing.quantity += 1;
  else restCart.push({ ...item, quantity: 1 });
  renderCart();
}

function renderCart() {
  const list = document.getElementById('staff-restaurant-cart-items-list');
  const itemCount = restCart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('restaurant-cart-count').textContent = `${itemCount} ürün`;
  const total = restCart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  document.getElementById('restaurant-cart-total').textContent = money(total);
  const targetSummary = document.getElementById('restaurant-selected-target');
  const tableButton = document.getElementById('btn-send-table');
  const roomButton = document.getElementById('btn-add-room-charge');
  tableButton.disabled = restCart.length === 0;
  roomButton.disabled = restCart.length === 0;
  if (selectedOrderTarget.startsWith('Table-')) {
    const tableName = selectedOrderTarget.slice(6);
    targetSummary.textContent = `${tableName} seçildi. Siparişi masaya gönderebilirsiniz.`;
    tableButton.textContent = `${tableName} İçin Siparişi Gönder`;
    roomButton.textContent = 'Oda Hesabına Ekle';
  } else if (selectedOrderTarget.startsWith('Room-')) {
    const roomName = selectedOrderTarget.slice(5);
    targetSummary.textContent = `Oda ${roomName} seçildi. Sipariş doğrudan oda hesabına yazılır.`;
    tableButton.textContent = 'Masaya Gönder';
    roomButton.textContent = `Oda ${roomName} Hesabına Ekle`;
  } else {
    targetSummary.textContent = 'Ürünleri seçin; ardından masayı veya oda hesabını kutucuklardan seçin.';
    tableButton.textContent = 'Masaya Gönder';
    roomButton.textContent = 'Oda Hesabına Ekle';
  }
  if (!restCart.length) {
    list.innerHTML = '<div class="restaurant-empty"><i class="fa-solid fa-cart-shopping"></i><strong>Adisyon boş</strong><span>Soldaki menüden ürün seçerek sipariş oluşturun.</span></div>';
    return;
  }
  list.innerHTML = restCart.map(item => `<div class="restaurant-cart-item"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} · ${item.quantity} adet</small></div><div class="restaurant-qty"><button type="button" data-cart-action="minus" data-cart-id="${escapeHtml(item.id)}">−</button><span>${item.quantity}</span><button type="button" data-cart-action="plus" data-cart-id="${escapeHtml(item.id)}">+</button></div><strong>${money(Number(item.price || 0) * item.quantity)}</strong></div>`).join('');
  list.querySelectorAll('[data-cart-action]').forEach(button => button.addEventListener('click', () => updateCart(button.dataset.cartId, button.dataset.cartAction)));
}

function updateCart(id, action) {
  const item = restCart.find(cartItem => cartItem.id === id);
  if (!item) return;
  item.quantity += action === 'plus' ? 1 : -1;
  restCart = restCart.filter(cartItem => cartItem.quantity > 0);
  renderCart();
}

function openTableDetail(table, orders) {
  activeTable = table;
  activeTableOrders = orders;
  document.getElementById('table-detail-title').textContent = `${table.table_number} Adisyonu`;
  const list = document.getElementById('table-detail-orders');
  if (!orders.length) list.innerHTML = '<div class="restaurant-empty"><i class="fa-solid fa-receipt"></i><strong>Açık adisyon yok</strong><span>Bu masa yeni sipariş için müsait.</span></div>';
  else list.innerHTML = orders.map(order => `<article class="card" style="padding:10px"><div class="d-flex justify-content-between"><strong>${escapeHtml(order.target_identifier || '')}</strong><div style="display:flex;gap:6px;align-items:center;"><span class="badge badge-primary">${escapeHtml(order.status || 'pending')}</span><button type="button" class="btn btn-danger btn-xs rest-cancel-order-btn" data-order-id="${escapeHtml(order.id)}" title="Siparişi Sil / İptal Et" style="padding:2px 6px;font-size:11px"><i class="fa-solid fa-trash-can"></i> İptal</button></div></div><div class="small" style="margin-top:6px">${escapeHtml(orderSummary(order))}</div><strong style="display:block;margin-top:8px">${money(orderAmount(order))}</strong></article>`).join('');
  list.querySelectorAll('.rest-cancel-order-btn').forEach(btn => btn.addEventListener('click', () => cancelRestaurantOrder(btn.dataset.orderId)));
  document.getElementById('table-detail-total').textContent = money(orders.reduce((sum, order) => sum + orderAmount(order), 0));
  document.getElementById('btn-collect-table-payment').disabled = orders.length === 0;
  document.getElementById('table-detail-modal').style.display = 'flex';
}

async function cancelRestaurantOrder(orderId) {
  if (!confirm('Bu sipariş iptal edilip geçmişe aktarılsın mı?')) return;
  try {
    const res = await fetch(`/api/requests/status${tenantQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: orderId, status: 'cancelled', completed_by: activeUser?.name || 'Restoran', reason: 'Restoran ekranından iptal edildi' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Sipariş iptal edilerek geçmişe aktarıldı.', 'success');
    document.getElementById('table-detail-modal').style.display = 'none';
    await loadRestaurantData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function completeDelivery(id, button) {
  const order = restRequests.find(request => request.id === id);
  if (!order) return showToast('Teslim edilecek sipariş bulunamadı.', 'error');
  if (button) button.disabled = true;
  try {
    await post(`/api/requests/status${tenantQuery()}`, { requestId: id, status: 'served', completed_by: activeUser?.name || 'Restoran POS' });
    showToast(order.target_identifier?.startsWith('Room-') ? 'Oda teslimi tamamlandı; sipariş kapatıldı.' : 'Masa servisi tamamlandı; adisyon ödeme için açık.', 'success');
    await loadRestaurantData();
  } catch (error) {
    showToast(error.message || 'Teslim işlemi tamamlanamadı.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function collectPayment() {
  if (!activeTable || !activeTableOrders.length) return;
  const button = document.getElementById('btn-collect-table-payment');
  const paymentMethod = document.getElementById('table-payment-method').value;
  if (paymentMethod === 'room_charge') return showToast('Masa adisyonu oda hesabına yazılamaz.', 'error');
  button.disabled = true;
  try {
    await post(`/api/tables/settle${tenantQuery()}`, { table_number: activeTable.table_number, payment_method: paymentMethod, completed_by: activeUser?.name || 'Restoran POS' });
    document.getElementById('table-detail-modal').style.display = 'none';
    showToast('Adisyon kapatıldı ve ödeme işlendi.', 'success');
    await loadRestaurantData();
  } catch (error) {
    showToast(error.message || 'Ödeme işlemi tamamlanamadı.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function submitCartOrder(target = selectedOrderTarget) {
  if (!target) return showToast('Sipariş için masa veya oda seçin.', 'error');
  if (!restCart.length) return;
  const isRoomCharge = target.startsWith('Room-');
  const routeResult = orderRouteResult(restCart);
  const buttons = [document.getElementById('btn-send-table'), document.getElementById('btn-add-room-charge')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    await post(`/api/requests${tenantQuery()}`, { type: 'order', target_identifier: target, details: restCart.map(item => ({ itemId: item.id, quantity: item.quantity })), payment_method: isRoomCharge ? 'room_charge' : undefined, department: 'Restaurant', created_by: activeUser?.name || 'Restoran POS' });
    restCart = [];
    selectedOrderTarget = '';
    renderCart();
    showToast(isRoomCharge ? `Oda ${target.slice(5)} hesabına yazıldı; sipariş ${routeResult}.` : `${target.replace('-', ' ')} için sipariş ${routeResult}.`, 'success');
    await loadRestaurantData();
    setRestaurantSubview('tables');
  } catch (error) {
    showToast(error.message || 'Sipariş gönderilemedi.', 'error');
  } finally {
    buttons.forEach(button => { button.disabled = !restCart.length; });
  }
}

function openOrderTargetPicker(mode) {
  if (!restCart.length) return showToast('Önce en az bir ürün seçin.', 'error');
  const isRoomCharge = mode === 'room';
  const targets = isRoomCharge
    ? restRooms.filter(room => room.status === 'occupied' || room.guest_name).map(room => ({ id: `Room-${room.room_number}`, title: `Oda ${room.room_number}`, subtitle: room.guest_name || 'Konaklayan misafir' }))
    : restTables.map(table => ({ id: `Table-${table.table_number}`, title: table.table_number, subtitle: table.section || 'Restoran' }));
  document.getElementById('order-target-title').textContent = isRoomCharge ? 'Oda Hesabı Seçin' : 'Masa Seçin';
  document.getElementById('order-target-note').textContent = isRoomCharge ? 'Odaya basınca sipariş doğrudan oda hesabına yazılır; ürün türüne göre mutfak, bar veya doğrudan servise iletilir. İptalde folyo satırı ters kayıtla kapatılır.' : 'Masaya basınca sipariş ürün türüne göre mutfak, bar veya doğrudan servise iletilir; oda hesabı kullanılamaz.';
  const grid = document.getElementById('restaurant-order-target-grid');
  grid.innerHTML = targets.length
    ? targets.map(target => `<button class="restaurant-target-card" type="button" data-target-id="${escapeHtml(target.id)}"><strong>${escapeHtml(target.title)}</strong><span>${escapeHtml(target.subtitle)} · Siparişi kaydet</span></button>`).join('')
    : emptyState('fa-bed', 'Uygun oda bulunamadı', 'Oda hesabı için önce misafirin giriş işlemi tamamlanmalıdır.');
  grid.onclick = async event => {
    const button = event.target.closest('[data-target-id]');
    if (!button || !grid.contains(button)) return;
    button.disabled = true;
    document.getElementById('order-target-modal').style.display = 'none';
    await submitCartOrder(button.dataset.targetId);
  };
  document.getElementById('order-target-modal').style.display = 'flex';
}

async function post(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey() }, body: JSON.stringify(body) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'İşlem tamamlanamadı.');
  }
  return response.json().catch(() => ({}));
}

function setupTabs() {
  document.querySelectorAll('[data-restaurant-tab]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    setRestaurantSubview(button.dataset.restaurantTab);
  }));
}

function setRestaurantSubview(tab) {
  ['tables', 'service', 'order', 'menu'].forEach(name => {
    document.getElementById(`restaurant-subview-${name}`).classList.toggle('active', name === tab);
    document.querySelectorAll(`[data-restaurant-tab="${name}"]`).forEach(button => button.classList.toggle('active', name === tab));
  });
}

function setupCategoryFilters() {
  ['all', 'food', 'drink', 'minibar', 'service'].forEach(category => document.getElementById(`btn-cat-${category}`).addEventListener('click', () => {
    activeCategory = category;
    ['all', 'food', 'drink', 'minibar', 'service'].forEach(name => document.getElementById(`btn-cat-${name}`).classList.toggle('active', name === category));
    renderMenuItems();
  }));
}

function setupModals() {
  ['btn-close-table-modal', 'btn-cancel-table-modal'].forEach(id => document.getElementById(id).addEventListener('click', () => { document.getElementById('table-detail-modal').style.display = 'none'; }));
  document.getElementById('btn-close-order-target-modal').addEventListener('click', () => { document.getElementById('order-target-modal').style.display = 'none'; });
  document.getElementById('btn-collect-table-payment').addEventListener('click', collectPayment);
  document.getElementById('btn-add-table-order').addEventListener('click', () => {
    if (activeTable) openOrderForTarget(`Table-${activeTable.table_number}`);
  });
}

function setupActions() {
  document.getElementById('btn-staff-logout').addEventListener('click', () => window.aeonLogout?.());
  document.getElementById('btn-send-table').addEventListener('click', () => selectedOrderTarget.startsWith('Table-') ? submitCartOrder() : openOrderTargetPicker('table'));
  document.getElementById('btn-add-room-charge').addEventListener('click', () => selectedOrderTarget.startsWith('Room-') ? submitCartOrder() : openOrderTargetPicker('room'));
}

function parsedDepartments(order) {
  try {
    const values = Array.isArray(order.departments) ? order.departments : JSON.parse(order.departments || '[]');
    return [...values, order.department].filter(Boolean).map(value => String(value).toLocaleLowerCase('tr-TR'));
  } catch {
    return [String(order.department || '').toLocaleLowerCase('tr-TR')];
  }
}

function orderDetails(order) {
  try { return Array.isArray(order.details) ? order.details : JSON.parse(order.details || '[]'); } catch { return []; }
}

function catalogItemForLine(line) {
  return restCatalog.find(item => item.id === (line.itemId || line.id));
}

function lineSummary(line) {
  const item = catalogItemForLine(line);
  return `${line.quantity || line.qty || 1} × ${item?.name || line.name || line.itemId || 'Ürün'}`;
}

function orderProductionGroups(order) {
  const groups = { kitchen: [], bar: [], other: [] };
  orderDetails(order).forEach(line => {
    const category = String(catalogItemForLine(line)?.category || line.category || '').toLocaleLowerCase('tr-TR');
    if (category === 'drink' || category === 'içecek') groups.bar.push(line);
    else if (category === 'food' || category === 'yemek') groups.kitchen.push(line);
    else groups.other.push(line);
  });
  return groups;
}

function productionBreakdown(order) {
  const groups = orderProductionGroups(order);
  const departments = parsedDepartments(order);
  const station = departments.includes('bar') && departments.includes('kitchen') ? 'Mutfak ve Bar' : departments.includes('bar') ? 'Bar' : departments.includes('kitchen') ? 'Mutfak' : 'Sipariş';
  if (!groups.kitchen.length && !groups.bar.length && groups.other.length) return `<strong>Doğrudan Servis:</strong> ${escapeHtml(groups.other.map(lineSummary).join(' · '))}`;
  const rows = [];
  if (groups.kitchen.length) rows.push(`<strong>Mutfak:</strong> ${escapeHtml(groups.kitchen.map(lineSummary).join(' · '))}`);
  if (groups.bar.length) rows.push(`<strong>Bar:</strong> ${escapeHtml(groups.bar.map(lineSummary).join(' · '))}`);
  if (groups.other.length) rows.push(`<strong>Servis:</strong> ${escapeHtml(groups.other.map(lineSummary).join(' · '))}`);
  if (rows.length) return rows.join('<br>');
  return `<strong>${station}:</strong> ${escapeHtml(orderSummary(order))}`;
}

function deliveryActionLabel(order) {
  return String(order.target_identifier || '').startsWith('Room-') ? 'Odaya Teslim Edildi' : 'Masaya Servis Edildi';
}

function productFlowLabel(item) {
  const category = String(item.category || '').toLocaleLowerCase('tr-TR');
  if (category === 'food' || category === 'yemek') return 'Mutfak üretimi';
  if (category === 'drink' || category === 'içecek') return 'Bar üretimi';
  return 'Doğrudan servis';
}

function orderRouteResult(items) {
  const categories = items.map(item => String(item.category || '').toLocaleLowerCase('tr-TR'));
  const hasKitchen = categories.some(value => value === 'food' || value === 'yemek');
  const hasBar = categories.some(value => value === 'drink' || value === 'içecek');
  const hasDirectService = categories.some(value => !['food', 'yemek', 'drink', 'içecek'].includes(value));
  if (!hasKitchen && !hasBar) return 'üretim beklemeden servis kuyruğuna alındı';
  const production = hasKitchen && hasBar ? 'mutfak ve bara' : hasBar ? 'bara' : 'mutfağa';
  return hasDirectService ? `${production} iletildi; doğrudan servis kalemleri aynı adisyona eklendi` : `${production} iletildi`;
}

function orderAmount(order) {
  if (Number.isFinite(Number(order.total_amount))) return Number(order.total_amount);
  return orderDetails(order).reduce((sum, line) => {
    const item = catalogItemForLine(line);
    return sum + Number(item?.price || line.price || 0) * Number(line.quantity || line.qty || 1);
  }, 0);
}

function orderSummary(order) {
  const lines = orderDetails(order);
  if (!lines.length) return typeof order.details === 'string' ? order.details : 'Sipariş detayları yok';
  return lines.map(lineSummary).join(' · ');
}

function emptyState(icon, title, text) {
  return `<div class="restaurant-empty"><i class="fa-solid ${icon}"></i><strong>${title}</strong><span>${text}</span></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function showToast(message, type) {
  const toast = document.getElementById('restaurant-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `show ${type}`;
  setTimeout(() => { toast.className = ''; }, 3600);
}
