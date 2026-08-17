import { notifyNewOrder } from './order-alert.js';

let data = { inventory: [], catalog: [], management_catalog: [], recipes: [], orders: [], tables: [], rooms: [], audits: [], stock_activity: [], setup: {}, can_manage: false };
let cart = [];
let category = 'Tümü';
let orderScreen = 'tables';
let showingOrderHistory = false;
const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const tenantQuery = () => `?tenant_id=${encodeURIComponent(window.tenantId || 'restaurant_kitchen')}`;
const api = path => `${path}${tenantQuery()}`;
const istanbulDay = value => {
  const raw = value instanceof Date ? value : String(value || '');
  const normalized = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = raw instanceof Date ? raw : new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const postJson = async (path, body, method = 'POST') => {
  const response = await fetch(api(path), { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
  return result;
};

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user) return;
  document.getElementById('btn-staff-logout').addEventListener('click', window.aeonLogout);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-bar-order-view]').forEach(button => button.addEventListener('click', () => setOrderScreen(button.dataset.barOrderView)));
  document.getElementById('bar-submit').addEventListener('click', submitOrder);
  document.getElementById('bar-audit-form').addEventListener('submit', submitAudit);
  document.getElementById('bar-target').addEventListener('change', syncPaymentTarget);
  document.getElementById('bar-change-target').addEventListener('click', () => setOrderScreen('tables'));
  document.getElementById('bar-product-search').addEventListener('input', renderProducts);
  document.getElementById('bar-show-active-orders').addEventListener('click', () => { showingOrderHistory = false; renderOrders(); });
  document.getElementById('bar-show-order-history').addEventListener('click', () => { showingOrderHistory = true; renderOrders(); });
  document.getElementById('bar-new-product').addEventListener('click', () => openProductEditor());
  document.getElementById('bar-new-inventory').addEventListener('click', () => openInventoryEditor());
  document.getElementById('bar-add-stock').addEventListener('click', () => openInventoryEditor());
  document.getElementById('bar-receive-stock').addEventListener('click', () => openStockReceipt());
  document.getElementById('bar-modal-close').addEventListener('click', closeModal);
  document.getElementById('bar-modal').addEventListener('click', event => { if (event.target.id === 'bar-modal') closeModal(); });
  setInterval(() => document.getElementById('bar-clock').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), 1000);
  await loadData();
  connectEvents();
  // Fallback poll in case an SSE push is missed (e.g. a proxy silently drops the stream without
  // firing onerror). Matches the 15s cadence every other staff screen uses — a busy bar can get
  // a new ticket every few seconds, so this was left too slow (30s) to be a meaningful safety net.
  setInterval(loadData, 15000);
});

function setView(view) {
  if (view === 'manage' && !data.can_manage) return;
  document.querySelectorAll('.bar-view').forEach(element => element.classList.toggle('active', element.id === `bar-view-${view}`));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
}

function setOrderScreen(screen) {
  if (screen === 'order' && !document.getElementById('bar-target').value) {
    toast('Önce masa veya konaklayan oda hesabını seçin.', true);
    screen = 'tables';
  }
  orderScreen = screen;
  document.querySelectorAll('.bar-order-screen').forEach(element => element.classList.toggle('active', element.id === `bar-order-${screen}`));
  document.querySelectorAll('[data-bar-order-view]').forEach(button => button.classList.toggle('active', button.dataset.barOrderView === screen));
}

async function loadData() {
  try {
    const response = await fetch(api('/api/bar/dashboard'));
    if (!response.ok) throw new Error();
    data = await response.json();
    render();
  } catch (error) {
    toast('Bar verileri yüklenemedi.', true);
  }
}

function render() {
  document.getElementById('bar-manage-nav').hidden = !data.can_manage;
  document.getElementById('bar-mobile-manage').hidden = !data.can_manage;
  renderKpis();
  renderSetup();
  renderProducts();
  renderTargets();
  renderCart();
  renderStock();
  renderAudits();
  renderStockActivity();
  renderOrders();
  renderManagement();
}

function renderSetup() {
  const setup = data.setup || {};
  const inventoryCount = Number(setup.inventory_count || 0);
  const productCount = Number(setup.product_count || 0);
  const recipeReadyCount = Number(setup.recipe_ready_count || 0);
  const activeProductCount = Number(setup.active_product_count || 0);
  const steps = [
    ['Gerçek stok tanımı', inventoryCount, 'Yalnız fiziksel sayımla doğrulanan stokları ekleyin'],
    ['Ortak içecek kataloğu', productCount, 'Restoran ve bar aynı içecek ürünlerini kullanır'],
    ['Stok takibi bağlı', recipeReadyCount, 'Reçeteli ürünlerde gerçek stok otomatik düşer'],
    ['Satışa açık içecek', activeProductCount, 'Pasif ürünler ortak menüde gösterilmez']
  ];
  const ready = productCount > 0 && activeProductCount > 0;
  const managerAction = data.can_manage ? '<button id="bar-open-manage" class="bar-secondary" type="button">Bar Ayarlarını Aç</button>' : '<span class="bar-setup-note">Bar şefi katalog ve gerçek stok bağlantılarını bu ekrandan yönetir.</span>';
  document.getElementById('bar-setup').innerHTML = `<div class="bar-setup-head"><div><h2>${ready ? 'Ortak içecek kataloğu bağlı' : 'Bar kurulum kontrolü'}</h2><p>Reçetesiz içecek satılabilir ancak stok düşmez. Otomatik stok takibi yalnız gerçek sayım ve reçete tanımı olan ürünlerde çalışır.</p></div>${managerAction}</div><div class="bar-setup-grid">${steps.map(([label, value, note]) => `<div class="bar-setup-item ${Number(value) ? 'ready' : ''}"><i class="fa-solid ${Number(value) ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><strong>${label}</strong><b>${value}</b><small>${note}</small></div>`).join('')}<div class="bar-setup-item link"><i class="fa-solid fa-chair"></i><strong>Masa bağlantısı</strong><b>${Number(setup.table_count || 0)}</b><small>Servis ve masa adisyonu</small></div><div class="bar-setup-item link"><i class="fa-solid fa-bed"></i><strong>Oda hesabı</strong><b>${Number(setup.occupied_room_count || 0)}</b><small>Konaklayan misafir folyoları</small></div></div>`;
  document.getElementById('bar-open-manage')?.addEventListener('click', () => setView('manage'));
}

function renderKpis() {
  const low = data.inventory.filter(item => Number(item.stock) <= Number(item.par_level)).length;
  const active = data.orders.filter(order => !['served', 'completed', 'paid', 'delivered', 'cancelled', 'rejected'].includes(String(order.status).toLowerCase()));
  const total = active.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const today = istanbulDay(new Date());
  const todayOrders = data.orders.filter(order => istanbulDay(order.created_at) === today).length;
  const cards = [['fa-receipt', 'Açık bar adisyonu', active.length, 'Hazırlık veya servis bekliyor'], ['fa-turkish-lira-sign', 'Açık tutar', money(total), 'Aktif bar siparişleri'], ['fa-wine-bottle', 'Kritik stok', low, low ? 'Par seviyesinin altında' : 'Stok seviyesi dengeli'], ['fa-martini-glass-citrus', 'Bugün sipariş', todayOrders, 'Bar içecek akışı']];
  document.getElementById('bar-kpis').innerHTML = cards.map(([icon, label, value, note]) => `<article class="bar-kpi"><div><span>${label}</span><i class="fa-solid ${icon}"></i></div><strong>${value}</strong><small>${note}</small></article>`).join('');
}

function renderProducts() {
  const root = document.getElementById('bar-products');
  const query = String(document.getElementById('bar-product-search')?.value || '').toLocaleLowerCase('tr-TR');
  const categories = ['Tümü', ...new Set(data.catalog.map(item => item.bar_category || 'Genel'))];
  if (!categories.includes(category)) category = 'Tümü';
  document.getElementById('bar-category-filters').innerHTML = categories.map(name => `<button class="${name === category ? 'active' : ''}" data-category="${escapeHtml(name)}" type="button">${escapeHtml(name)}</button>`).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; renderProducts(); }));
  const items = data.catalog.filter(item => (category === 'Tümü' || (item.bar_category || 'Genel') === category) && `${item.name} ${item.bar_category || ''}`.toLocaleLowerCase('tr-TR').includes(query));
  document.getElementById('bar-menu-count').textContent = `${items.length} içecek`;
  root.innerHTML = items.map(item => `<button class="bar-product" type="button" data-item="${escapeHtml(item.id)}" title="${stockTrackingTitle(item)}">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}">` : '<i class="fa-solid fa-martini-glass-citrus"></i>'}<span>${escapeHtml(item.bar_category || 'Genel')}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || stockTrackingLabel(item))}</small><small>${money(item.price)} · ${stockTrackingLabel(item)}</small></button>`).join('') || '<div class="bar-cart-empty">Bu seçimde aktif içecek ürünü yok.</div>';
  root.querySelectorAll('[data-item]').forEach(button => button.addEventListener('click', () => addCart(button.dataset.item)));
}

function activeOrdersFor(target) {
  const terminal = new Set(['served', 'completed', 'paid', 'delivered', 'cancelled', 'rejected']);
  return data.orders.filter(order => order.target_identifier === target && !terminal.has(String(order.status || '').toLowerCase()));
}

function renderTargets() {
  const select = document.getElementById('bar-target');
  const current = select.value;
  const tableOptions = data.tables.map(table => `<option value="Table-${escapeHtml(table.table_number)}">${escapeHtml(table.section)} · Masa ${escapeHtml(table.table_number)}</option>`).join('');
  const roomOptions = data.rooms.map(room => `<option value="Room-${escapeHtml(room.room_number)}">Oda ${escapeHtml(room.room_number)}${room.guest_name ? ` · ${escapeHtml(room.guest_name)}` : ''}</option>`).join('');
  select.innerHTML = `<option value="">Masa veya konaklayan oda seçin</option><optgroup label="Masalar">${tableOptions}</optgroup><optgroup label="Konaklayan oda hesapları">${roomOptions}</optgroup>`;
  if (current) select.value = current;
  syncPaymentTarget();
  renderTablePlan();
  renderRoomPlan();
}

function renderTablePlan() {
  const tableGroups = data.tables.reduce((groups, table) => {
    const section = table.section || 'Genel';
    groups[section] ||= [];
    groups[section].push(table);
    return groups;
  }, {});
  const root = document.getElementById('bar-table-plan');
  root.innerHTML = Object.entries(tableGroups).map(([section, tables]) => `<section class="bar-zone"><header><h3>${escapeHtml(section)}</h3><span>${tables.length} masa</span></header><div class="bar-table-grid">${tables.map(table => { const target = `Table-${table.table_number}`; const orders = activeOrdersFor(target); const ready = orders.some(order => String(order.status || '').toLowerCase() === 'ready'); const amount = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0); const state = ready ? 'ready' : orders.length ? 'open' : 'empty'; const label = ready ? 'Servise hazır' : orders.length ? 'Açık adisyon' : 'Müsait'; return `<button class="bar-table-card ${state}" type="button" data-table-target="${escapeHtml(target)}"><div><small>${escapeHtml(section)}</small><strong>Masa ${escapeHtml(table.table_number)}</strong></div><span>${label}</span><em>${orders.length ? `${orders.length} sipariş · ${money(amount)}` : 'Yeni sipariş için seçin'}</em></button>`; }).join('')}</div></section>`).join('') || '<div class="bar-cart-empty">Tanımlı masa yok.</div>';
  document.getElementById('bar-table-summary').textContent = `${data.tables.length} masa`;
  root.querySelectorAll('[data-table-target]').forEach(button => button.addEventListener('click', () => openTarget(button.dataset.tableTarget)));
}

function renderRoomPlan() {
  const root = document.getElementById('bar-room-plan');
  root.innerHTML = data.rooms.map(room => { const target = `Room-${room.room_number}`; const orders = activeOrdersFor(target); const amount = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0); return `<button class="bar-room-card ${orders.length ? 'open' : ''}" type="button" data-room-target="${escapeHtml(target)}"><small>Oda ${escapeHtml(room.room_number)}</small><strong>${escapeHtml(room.guest_name || 'Konaklayan misafir')}</strong><span>${orders.length ? `${orders.length} açık içecek siparişi · ${money(amount)}` : 'Oda hesabına yeni sipariş'}</span></button>`; }).join('') || '<div class="bar-cart-empty">Konaklayan oda bulunmuyor.</div>';
  document.getElementById('bar-room-summary').textContent = `${data.rooms.length} konaklayan oda`;
  root.querySelectorAll('[data-room-target]').forEach(button => button.addEventListener('click', () => openTarget(button.dataset.roomTarget)));
}

function openTarget(target) {
  const orders = activeOrdersFor(target);
  if (!orders.length) return selectTarget(target);
  openModal(`<h2>${escapeHtml(targetLabel(target))}</h2><p class="bar-modal-note">Bu hesapta açık içecek siparişleri bulunuyor.</p><div class="bar-order-list">${orders.map(order => `<div class="bar-order-row"><div><strong>${escapeHtml(statusName(order.status))}</strong><small>${escapeHtml(summary(order))}</small></div><b>${money(order.total_amount)}</b></div>`).join('')}</div><div class="bar-modal-actions"><button id="bar-add-round" class="bar-primary" type="button">Yeni Tur Ekle</button></div>`);
  document.getElementById('bar-add-round').addEventListener('click', () => { closeModal(); selectTarget(target); });
}

function selectTarget(target) {
  document.getElementById('bar-target').value = target;
  syncPaymentTarget();
  setOrderScreen('order');
}

function syncPaymentTarget() {
  const target = document.getElementById('bar-target').value;
  const payment = document.getElementById('bar-payment');
  const cash = payment.querySelector('option[value="cash"]');
  const card = payment.querySelector('option[value="credit_card"]');
  const roomCharge = payment.querySelector('option[value="room_charge"]');
  const isRoom = target.startsWith('Room-');
  const isTable = target.startsWith('Table-');
  [cash, card].forEach(option => {
    option.hidden = isRoom;
    option.disabled = isRoom;
  });
  roomCharge.hidden = isTable;
  roomCharge.disabled = isTable;
  payment.disabled = isRoom;
  if (isRoom) {
    payment.value = 'room_charge';
    payment.title = 'Oda hedefinde ödeme zorunlu olarak oda hesabına yazılır.';
  } else {
    payment.title = '';
  }
  if (isTable && payment.value === 'room_charge') payment.value = 'cash';
  if (!target && payment.value === 'room_charge') payment.value = 'cash';
  document.getElementById('bar-cart-target').textContent = target ? targetLabel(target) : 'Hesap seçilmedi';
  document.getElementById('bar-selected-target').textContent = target ? targetLabel(target) : 'Hesap seçilmedi';
}

function targetLabel(target) {
  if (target.startsWith('Table-')) {
    const table = data.tables.find(item => `Table-${item.table_number}` === target);
    return table ? `${table.section} · Masa ${table.table_number}` : target;
  }
  const room = data.rooms.find(item => `Room-${item.room_number}` === target);
  return room ? `Oda ${room.room_number} · ${room.guest_name || 'Konaklayan misafir'}` : target;
}

function addCart(id) {
  const item = data.catalog.find(row => row.id === id);
  if (!item) return;
  const line = cart.find(row => row.id === id);
  if (line) line.quantity += 1;
  else cart.push({ ...item, quantity: 1 });
  renderCart();
}

function renderCart() {
  const root = document.getElementById('bar-cart-list');
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  document.getElementById('bar-cart-count').textContent = `${count} ürün`;
  document.getElementById('bar-total').textContent = money(total);
  document.getElementById('bar-submit').disabled = !cart.length;
  root.innerHTML = cart.length ? cart.map(item => `<div class="bar-cart-item"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} · ${item.quantity} adet · ${stockTrackingLabel(item)}</small></div><div class="bar-qty"><button type="button" data-action="minus" data-id="${escapeHtml(item.id)}">−</button><span>${item.quantity}</span><button type="button" data-action="plus" data-id="${escapeHtml(item.id)}">+</button></div></div>`).join('') : '<div class="bar-cart-empty">Menüden içecek seçerek yeni adisyon oluşturun.</div>';
  root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => changeCart(button.dataset.id, button.dataset.action)));
}

function changeCart(id, action) {
  const line = cart.find(item => item.id === id);
  if (!line) return;
  line.quantity += action === 'plus' ? 1 : -1;
  cart = cart.filter(item => item.quantity > 0);
  renderCart();
}

function renderStock() {
  const root = document.getElementById('bar-stock-list');
  root.innerHTML = data.inventory.map(item => { const low = Number(item.stock) <= Number(item.par_level); return `<div class="bar-stock-row ${low ? 'low' : ''}"><div><strong>${escapeHtml(item.name)}</strong><small>Kritik: ${item.par_level} ${escapeHtml(item.unit)} · Birim maliyet: ${money(item.unit_cost)}</small></div><div class="bar-stock-row-end"><b class="bar-stock-value">${item.stock} ${escapeHtml(item.unit)}</b><span><button class="bar-mini" data-stock-receipt="${escapeHtml(item.id)}">Giriş</button><button class="bar-danger-mini" data-stock-waste="${escapeHtml(item.id)}">Zayiat</button><button class="bar-secondary" data-stock-edit="${escapeHtml(item.id)}">Düzenle</button></span></div></div>`; }).join('') || '<div class="bar-cart-empty">Henüz bar stok kalemi yok. Gerçek fiziksel stokla ilk kalemi tanımlayın.</div>';
  const hasInventory = data.inventory.length > 0;
  const auditItem = document.getElementById('bar-audit-item');
  const auditAmount = document.getElementById('bar-audit-amount');
  const auditSubmit = document.querySelector('#bar-audit-form button[type="submit"]');
  auditItem.innerHTML = data.inventory.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · sistem: ${item.stock} ${escapeHtml(item.unit)}</option>`).join('');
  [auditItem, auditAmount, auditSubmit].forEach(element => { element.disabled = !hasInventory; });
  document.getElementById('bar-receive-stock').disabled = !hasInventory;
  document.getElementById('bar-stock-guidance').innerHTML = hasInventory ? '' : '<p class="bar-stock-guidance">İlk kez stok tanımlayın; sonrasında teslim alma, zayiat ve kör sayım bu ekrandan yürür.</p>';
  root.querySelectorAll('[data-stock-receipt]').forEach(button => button.addEventListener('click', () => openStockReceipt(data.inventory.find(item => item.id === button.dataset.stockReceipt))));
  root.querySelectorAll('[data-stock-waste]').forEach(button => button.addEventListener('click', () => openWasteEditor(data.inventory.find(item => item.id === button.dataset.stockWaste))));
  root.querySelectorAll('[data-stock-edit]').forEach(button => button.addEventListener('click', () => openInventoryEditor(data.inventory.find(item => item.id === button.dataset.stockEdit))));
}

function renderAudits() {
  document.getElementById('bar-audit-list').innerHTML = data.audits.map(audit => `<div class="bar-audit-row"><div><strong>${escapeHtml(audit.inventory_name)}</strong><small>${escapeHtml(audit.created_at || '')}</small></div><b>${Number(audit.variance) > 0 ? '+' : ''}${audit.variance} ${escapeHtml(audit.unit)}</b></div>`).join('') || '<div class="bar-cart-empty">Bu vardiyada henüz kör sayım yok.</div>';
}

function renderStockActivity() {
  document.getElementById('bar-stock-activity').innerHTML = (data.stock_activity || []).map(activity => `<div class="bar-audit-row"><div><strong>${escapeHtml(activity.action)}</strong><small>${escapeHtml(activity.details || '')}</small></div><b>${escapeHtml(activity.created_at || '')}</b></div>`).join('') || '<div class="bar-cart-empty">Henüz stok hareketi yok.</div>';
}

function renderOrders() {
  const root = document.getElementById('bar-order-list');
  const terminal = new Set(['served', 'completed', 'paid', 'delivered', 'cancelled', 'rejected']);
  const orders = data.orders.filter(order => terminal.has(String(order.status || '').toLowerCase()) === showingOrderHistory).slice(0, 80);
  document.getElementById('bar-show-active-orders').classList.toggle('active', !showingOrderHistory);
  document.getElementById('bar-show-order-history').classList.toggle('active', showingOrderHistory);
  document.getElementById('bar-order-summary').textContent = showingOrderHistory ? `${orders.length} kapatılmış veya iptal edilmiş sipariş` : `${orders.length} açık sipariş`;
  root.innerHTML = orders.map(order => {
    const source = isBarOwned(order) ? 'Bar POS' : 'Restoran karma adisyonu · bar fişi';
    return `<div class="bar-order-row"><div><strong>${escapeHtml(order.target_identifier)}</strong><small>${source} · ${escapeHtml(order.created_by || 'Operasyon')} · ${escapeHtml(statusName(order.status))}</small><small>${escapeHtml(summary(order))}</small></div><div class="bar-order-actions"><b title="Yalnız içecek kalemleri toplamı">İçecek ${money(order.total_amount)}</b>${orderAction(order)}</div></div>`;
  }).join('') || `<div class="bar-cart-empty">${showingOrderHistory ? 'Geçmiş sipariş kaydı yok.' : 'Açık bar içecek fişi yok.'}</div>`;
  root.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => updateOrder(button.dataset.status, button.dataset.id)));
  root.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => cancelOrder(button.dataset.cancel)));
  root.querySelectorAll('[data-order-edit]').forEach(button => button.addEventListener('click', () => openOrderEditor(data.orders.find(order => order.id === button.dataset.orderEdit))));
}

function statusName(status) {
  const value = String(status || '').toLowerCase();
  return ({ pending: 'Sırada', accepted: 'Kabul edildi', preparing: 'Hazırlanıyor', ready: 'Servise hazır', served: 'Teslim edildi', completed: 'Tamamlandı', paid: 'Ödendi', delivered: 'Teslim edildi', cancelled: 'İptal', rejected: 'Reddedildi' })[value] || String(status || 'Bilinmiyor');
}

function orderAction(order) {
  const status = String(order.status || '').toLowerCase();
  const canManageFromBar = order.bar_editable !== false;
  const cancel = canManageFromBar ? `<button class="bar-danger-mini" data-cancel="${escapeHtml(order.id)}">İptal</button>` : '';
  const edit = canManageFromBar && status === 'pending' && order.payment_method !== 'room_charge' ? `<button class="bar-secondary" data-order-edit="${escapeHtml(order.id)}">Düzenle</button>` : '';
  if (status === 'pending') return `${edit}<button class="bar-mini" data-status="accepted" data-id="${escapeHtml(order.id)}">Hazırlamaya Al</button>${cancel}`;
  if (['accepted', 'preparing'].includes(status)) return `<button class="bar-mini" data-status="ready" data-id="${escapeHtml(order.id)}">Servise Hazır</button>${cancel}`;
  if (status === 'ready') return `<span class="bar-terminal-status">Servis ekibi teslim alacak</span>${cancel}`;
  if (['served', 'completed', 'paid', 'delivered'].includes(status)) return '<span class="bar-terminal-status">Teslim edildi</span>';
  return '';
}

function renderManagement() {
  if (!data.can_manage) return;
  document.getElementById('bar-menu-management').innerHTML = data.management_catalog.map(product => { const recipeCount = data.recipes.filter(recipe => recipe.catalog_item_id === product.id).length; return `<div class="bar-management-row"><div>${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : '<i class="fa-solid fa-martini-glass-citrus"></i>'}<span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.bar_category || 'Genel')} · ${money(product.price)} · ${recipeCount ? `${recipeCount} reçete kalemi` : 'Stok takibi yok'} · ${Number(product.in_stock) ? 'Ortak menüde aktif' : 'Pasif'}</small></span></div><button class="bar-secondary" data-product-edit="${escapeHtml(product.id)}">Düzenle</button></div>`; }).join('') || '<div class="bar-cart-empty">Henüz ortak içecek ürünü yok.</div>';
  document.getElementById('bar-inventory-management').innerHTML = data.inventory.map(item => `<div class="bar-management-row"><div><i class="fa-solid fa-box"></i><span><strong>${escapeHtml(item.name)}</strong><small>${item.stock} ${escapeHtml(item.unit)} · Kritik ${item.par_level} · ${money(item.unit_cost)}</small></span></div><button class="bar-secondary" data-inventory-edit="${escapeHtml(item.id)}">Düzenle</button></div>`).join('') || '<div class="bar-cart-empty">Henüz bar stoku tanımlı değil.</div>';
  document.querySelectorAll('[data-product-edit]').forEach(button => button.addEventListener('click', () => openProductEditor(data.management_catalog.find(item => item.id === button.dataset.productEdit))));
  document.querySelectorAll('[data-inventory-edit]').forEach(button => button.addEventListener('click', () => openInventoryEditor(data.inventory.find(item => item.id === button.dataset.inventoryEdit))));
}

function summary(order) {
  try {
    const lines = Array.isArray(order.details) ? order.details : JSON.parse(order.details || '[]');
    return lines.map(line => `${line.quantity || line.qty || 1}× ${line.name || line.itemId || line.id || 'İçecek'}`).join(', ');
  } catch {
    return typeof order.details === 'string' ? order.details : '';
  }
}

function isBarOwned(order) {
  return order.bar_owned === true || Number(order.bar_owned) === 1 || String(order.department || '').toLocaleLowerCase('tr-TR') === 'bar';
}

function hasStockTracking(item) {
  return item.stock_tracking_status === 'configured' || data.recipes.some(recipe => recipe.catalog_item_id === item.id);
}

function stockTrackingLabel(item) {
  return hasStockTracking(item) ? 'Stok reçeteli' : 'Stok takibi yok';
}

function stockTrackingTitle(item) {
  return escapeHtml(hasStockTracking(item) ? 'Gerçek stok reçetesi bağlı; satışta stok otomatik düşer.' : 'Satış kaydedilir; gerçek stok reçetesi olmadığı için fiziksel stok otomatik düşmez.');
}

async function submitOrder() {
  const target = document.getElementById('bar-target').value;
  const payment = document.getElementById('bar-payment').value;
  const submitButton = document.getElementById('bar-submit');
  if (!target) return toast('Önce masa veya konaklayan oda hedefi seçin.', true);
  if (payment === 'room_charge' && !target.startsWith('Room-')) return toast('Oda hesabına yalnızca konaklayan oda için yazılabilir.', true);
  if (target.startsWith('Room-') && payment !== 'room_charge') return toast('Oda siparişi zorunlu olarak oda hesabına yazılmalıdır.', true);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const untracked = cart.filter(item => !hasStockTracking(item)).reduce((sum, item) => sum + item.quantity, 0);
  const targetNote = target.startsWith('Room-') ? 'Tutar oda hesabına yazılacak; teslimi servis ekibi onaylayacak.' : 'Sipariş masa adisyonuna açılacak; teslimi servis ekibi onaylayacak.';
  const stockNote = untracked ? ` ${untracked} ürün için stok takibi yok; satış kaydedilir fakat fiziksel stok düşmez.` : ' Tüm ürünlerde gerçek stok reçetesi bağlı.';
  if (!window.confirm(`${target} için ${money(total)} tutarlı sipariş kaydedilsin mi?\n\n${targetNote}${stockNote}`)) return;
  const idleText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Sipariş Kaydediliyor...';
  try {
    const result = await postJson('/api/bar/orders', { target_identifier: target, payment_method: payment, details: cart.map(item => ({ itemId: item.id, quantity: item.quantity })) });
    cart = [];
    renderCart();
    setOrderScreen('tables');
    toast(result.room_charge_posted ? 'Sipariş kaydedildi ve oda hesabına işlendi.' : 'Bar siparişi kaydedildi.');
    await loadData();
  } catch (error) {
    toast(error.message, true);
  } finally {
    submitButton.textContent = idleText;
    submitButton.disabled = !cart.length;
  }
}

async function submitAudit(event) {
  event.preventDefault();
  try {
    const result = await postJson('/api/bar/audits', { inventory_id: document.getElementById('bar-audit-item').value, physical_amount: Number(document.getElementById('bar-audit-amount').value) });
    event.target.reset();
    toast(`Sayım kaydedildi. Fark: ${result.variance}`);
    await loadData();
  } catch (error) { toast(error.message, true); }
}

async function updateOrder(status, id) {
  try { await postJson(`/api/bar/orders/${encodeURIComponent(id)}/status`, { status }); toast('Sipariş durumu güncellendi.'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function cancelOrder(id) {
  if (!window.confirm('Sipariş iptal edilsin mi? Stok ve varsa oda hesabı geri alınır.')) return;
  try { await postJson(`/api/bar/orders/${encodeURIComponent(id)}/cancel`, {}); toast('Sipariş iptal edildi; stok ve hesap geri alındı.'); await loadData(); } catch (error) { toast(error.message, true); }
}

function openOrderEditor(order) {
  if (!order) return;
  let lines = (Array.isArray(order.details) ? order.details : JSON.parse(order.details || '[]')).map(line => ({ itemId: String(line.itemId), quantity: Number(line.quantity) || 1 }));
  const products = data.catalog || [];
  const render = () => {
    const total = lines.reduce((sum, line) => {
      const product = products.find(item => item.id === line.itemId);
      return sum + Number(product?.price || 0) * line.quantity;
    }, 0);
    document.getElementById('bar-order-edit-lines').innerHTML = lines.map((line, index) => {
      const product = products.find(item => item.id === line.itemId);
      return `<div class="bar-cart-item"><div><strong>${escapeHtml(product?.name || 'Ürün')}</strong><small>${money(product?.price || 0)}</small></div><div class="bar-qty"><button type="button" data-order-line-minus="${index}">−</button><b>${line.quantity}</b><button type="button" data-order-line-plus="${index}">+</button><button type="button" class="bar-danger-mini" data-order-line-remove="${index}">Sil</button></div></div>`;
    }).join('') || '<div class="bar-cart-empty">Sipariş kalemi kalmadı.</div>';
    document.getElementById('bar-order-edit-total').textContent = money(total);
    document.querySelectorAll('[data-order-line-minus]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.orderLineMinus); lines[index].quantity -= 1; if (lines[index].quantity < 1) lines.splice(index, 1); render(); }));
    document.querySelectorAll('[data-order-line-plus]').forEach(button => button.addEventListener('click', () => { lines[Number(button.dataset.orderLinePlus)].quantity += 1; render(); }));
    document.querySelectorAll('[data-order-line-remove]').forEach(button => button.addEventListener('click', () => { lines.splice(Number(button.dataset.orderLineRemove), 1); render(); }));
  };
  openModal(`<h2>Bar Siparişini Düzenle</h2><p class="bar-modal-note">Yalnız hazırlanmamış masa siparişleri düzenlenir.</p><select id="bar-order-edit-product"><option value="">İçecek ekle</option>${products.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${money(item.price)}</option>`).join('')}</select><div id="bar-order-edit-lines" class="bar-cart-list"></div><div class="bar-total"><span>Yeni toplam</span><strong id="bar-order-edit-total"></strong></div><button id="bar-order-edit-save" class="bar-primary" type="button">Değişiklikleri Kaydet</button>`);
  document.getElementById('bar-order-edit-product').addEventListener('change', event => { const itemId = event.target.value; if (!itemId) return; const line = lines.find(item => item.itemId === itemId); if (line) line.quantity += 1; else lines.push({ itemId, quantity: 1 }); event.target.value = ''; render(); });
  document.getElementById('bar-order-edit-save').addEventListener('click', async () => { if (!lines.length) return toast('Siparişte en az bir ürün olmalıdır.', true); try { await postJson(`/api/bar/orders/${encodeURIComponent(order.id)}`, { details: lines }, 'PUT'); closeModal(); toast('Bar siparişi güncellendi.'); await loadData(); } catch (error) { toast(error.message, true); } });
  render();
}

function openProductEditor(product = null) {
  const editing = Boolean(product);
  let persistedId = product?.id || '';
  const recipe = editing ? data.recipes.filter(item => item.catalog_item_id === product.id).map(item => ({ inventory_id: item.inventory_id, amount_needed: item.amount_needed })) : [];
  let recipeDirty = false;
  openModal(`<h2>${editing ? 'Ortak İçecek Ürününü Düzenle' : 'Yeni Ortak İçecek Ürünü'}</h2><form id="bar-product-form" class="bar-form"><label>Ürün adı<input name="name" required value="${escapeHtml(product?.name || '')}"></label><label>Kategori<input name="bar_category" required value="${escapeHtml(product?.bar_category || 'Genel')}"></label><label>İçerik açıklaması<textarea name="description" maxlength="500" placeholder="İçindekiler, servis notu veya alerjen bilgisi">${escapeHtml(product?.description || '')}</textarea></label><label>Satış fiyatı<input name="price" type="number" min="0" step="0.01" required value="${product?.price ?? ''}"></label><label>Fotoğraf bağlantısı<input name="image_url" type="url" placeholder="https://... veya /images/..." value="${escapeHtml(product?.image_url || '')}"></label><label class="bar-check"><input name="in_stock" type="checkbox" ${Number(product?.in_stock) ? 'checked' : ''}> Restoran ve bar ortak menüsünde satışa açık</label><div class="bar-recipe-editor"><h3>Gerçek stok reçetesi</h3><p>Reçete tanımlıysa satışta miktarlar yüzde 6 fire payıyla düşer. Reçetesiz ürün satılır, fiziksel stok otomatik düşmez.</p><div id="bar-recipe-lines"></div><button id="bar-add-recipe-line" class="bar-secondary" type="button">Stok Kalemi Ekle</button></div><button class="bar-primary" type="submit">${editing ? 'Değişiklikleri Kaydet' : 'Ürünü Kaydet'}</button>${editing ? '<button id="bar-disable-product" class="bar-danger" type="button">Ortak Menüden Kaldır</button>' : ''}</form>`);
  const root = document.getElementById('bar-recipe-lines');
  const renderRecipeLines = () => { root.innerHTML = recipe.map((line, index) => `<div class="bar-recipe-line"><select data-recipe-stock="${index}">${data.inventory.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === line.inventory_id ? 'selected' : ''}>${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`).join('')}</select><input data-recipe-amount="${index}" type="number" min="0.01" step="0.01" value="${line.amount_needed}"><button type="button" data-recipe-remove="${index}">×</button></div>`).join(''); root.querySelectorAll('[data-recipe-stock]').forEach(input => input.addEventListener('change', () => { recipe[Number(input.dataset.recipeStock)].inventory_id = input.value; recipeDirty = true; })); root.querySelectorAll('[data-recipe-amount]').forEach(input => input.addEventListener('input', () => { recipe[Number(input.dataset.recipeAmount)].amount_needed = Number(input.value); recipeDirty = true; })); root.querySelectorAll('[data-recipe-remove]').forEach(button => button.addEventListener('click', () => { recipe.splice(Number(button.dataset.recipeRemove), 1); recipeDirty = true; renderRecipeLines(); })); };
  document.getElementById('bar-add-recipe-line').addEventListener('click', () => { if (!data.inventory.length) return toast('Önce gerçek stok kalemi tanımlayın.', true); recipe.push({ inventory_id: data.inventory[0].id, amount_needed: 1 }); recipeDirty = true; renderRecipeLines(); });
  document.getElementById('bar-product-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const form = new FormData(event.target);
    const payload = { name: form.get('name'), bar_category: form.get('bar_category'), description: form.get('description'), price: Number(form.get('price')), image_url: form.get('image_url'), in_stock: form.get('in_stock') === 'on' };
    submitButton.disabled = true;
    try {
      if (persistedId) {
        if (recipeDirty) await postJson(`/api/bar/menu/${encodeURIComponent(persistedId)}/recipes`, { ingredients: recipe }, 'PUT');
        await postJson(`/api/bar/menu/${encodeURIComponent(persistedId)}`, payload, 'PUT');
      } else {
        const result = await postJson('/api/bar/menu', payload);
        persistedId = result.id;
        if (recipe.length) await postJson(`/api/bar/menu/${encodeURIComponent(persistedId)}/recipes`, { ingredients: recipe }, 'PUT');
      }
      closeModal();
      toast(recipe.length ? 'Ortak içecek ve gerçek stok reçetesi kaydedildi.' : 'Ortak içecek stok takibi olmadan kaydedildi.');
      await loadData();
    } catch (error) {
      toast(error.message, true);
    } finally {
      if (submitButton.isConnected) submitButton.disabled = false;
    }
  });
  if (editing) document.getElementById('bar-disable-product').addEventListener('click', async () => { if (!window.confirm('Ürün satıştan kaldırılacak. Devam edilsin mi?')) return; try { const response = await fetch(api(`/api/bar/menu/${encodeURIComponent(product.id)}`), { method: 'DELETE' }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Ürün satıştan kaldırılamadı.'); closeModal(); toast('Ürün satıştan kaldırıldı.'); await loadData(); } catch (error) { toast(error.message || 'Ürün kaldırılamadı.', true); } });
  renderRecipeLines();
}

function openInventoryEditor(item = null) {
  const editing = Boolean(item);
  openModal(`<h2>${editing ? 'Bar Stok Kalemini Düzenle' : 'Yeni Bar Stok Kalemi'}</h2><form id="bar-inventory-form" class="bar-form"><label>Stok adı<input name="name" required value="${escapeHtml(item?.name || '')}"></label><label>Birim<select name="unit"><option ${item?.unit === 'adet' ? 'selected' : ''}>adet</option><option ${item?.unit === 'ml' ? 'selected' : ''}>ml</option><option ${item?.unit === 'cl' ? 'selected' : ''}>cl</option><option ${item?.unit === 'gram' ? 'selected' : ''}>gram</option><option ${item?.unit === 'kg' ? 'selected' : ''}>kg</option></select></label><label>Mevcut miktar<input name="stock" type="number" min="0" step="0.01" required value="${item?.stock ?? ''}"></label><label>Kritik seviye<input name="par_level" type="number" min="0" step="0.01" required value="${item?.par_level ?? ''}"></label><label>Birim maliyet<input name="unit_cost" type="number" min="0" step="0.01" required value="${item?.unit_cost ?? 0}"></label><button class="bar-primary" type="submit">${editing ? 'Stoku Güncelle' : 'Stoku Kaydet'}</button>${editing ? '<button id="bar-delete-inventory" class="bar-danger" type="button">Stok Kalemini Sil</button>' : ''}</form>`);
  document.getElementById('bar-inventory-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); const payload = Object.fromEntries(form.entries()); ['stock', 'par_level', 'unit_cost'].forEach(key => { payload[key] = Number(payload[key]); }); try { await postJson(editing ? `/api/bar/inventory/${encodeURIComponent(item.id)}` : '/api/bar/inventory', payload, editing ? 'PUT' : 'POST'); closeModal(); toast('Bar stok bilgisi kaydedildi.'); await loadData(); } catch (error) { toast(error.message, true); } });
  if (editing) document.getElementById('bar-delete-inventory').addEventListener('click', async () => { if (!window.confirm('Reçetelerde kullanılmıyorsa stok kalemi silinecek. Devam edilsin mi?')) return; try { const response = await fetch(api(`/api/bar/inventory/${encodeURIComponent(item.id)}`), { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); closeModal(); toast('Stok kalemi silindi.'); await loadData(); } catch (error) { toast(error.message || 'Stok kalemi silinemedi.', true); } });
}

function openStockReceipt(item = null) {
  if (!data.inventory.length) return toast('Önce bar stok kalemi tanımlayın.', true);
  openModal(`<h2>Bar Stok Girişi</h2><p class="bar-modal-note">Teslim alınan gerçek miktarı girin. Sistem stok miktarını ve ağırlıklı birim maliyetini günceller.</p><form id="bar-stock-receipt-form" class="bar-form"><label>Stok kalemi<select name="inventory_id" required>${data.inventory.map(stock => `<option value="${escapeHtml(stock.id)}" ${stock.id === item?.id ? 'selected' : ''}>${escapeHtml(stock.name)} · mevcut ${stock.stock} ${escapeHtml(stock.unit)}</option>`).join('')}</select></label><label>Giriş miktarı<input name="quantity" type="number" min="0.01" step="0.01" required></label><label>Birim maliyet<input name="unit_price" type="number" min="0" step="0.01" required></label><label>Tedarikçi<input name="vendor" autocomplete="organization"></label><label>İrsaliye / fatura no<input name="receipt_number"></label><button class="bar-primary" type="submit">Stok Girişini Kaydet</button></form>`);
  document.getElementById('bar-stock-receipt-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); const payload = Object.fromEntries(form.entries()); payload.quantity = Number(payload.quantity); payload.unit_price = Number(payload.unit_price); try { await postJson('/api/bar/inventory/receipts', payload); closeModal(); toast('Stok girişi kaydedildi.'); await loadData(); } catch (error) { toast(error.message, true); } });
}

function openWasteEditor(item) {
  if (!item) return;
  openModal(`<h2>Bar Stok Zayiatı</h2><p class="bar-modal-note">${escapeHtml(item.name)} için kullanılmayacak, kırılan veya bozulmuş miktarı kaydedin. Bu işlem stoktan düşer.</p><form id="bar-stock-waste-form" class="bar-form"><label>Zayiat miktarı<input name="quantity" type="number" min="0.01" max="${Number(item.stock)}" step="0.01" required></label><label>Zayiat nedeni<input name="reason" required placeholder="Kırılma, bozulma, ikram veya sayım farkı"></label><button class="bar-danger" type="submit">Zayiatı Kaydet</button></form>`);
  document.getElementById('bar-stock-waste-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); try { await postJson(`/api/bar/inventory/${encodeURIComponent(item.id)}/waste`, { quantity: Number(form.get('quantity')), reason: form.get('reason') }); closeModal(); toast('Zayiat stoktan düşüldü.'); await loadData(); } catch (error) { toast(error.message, true); } });
}

function openModal(html) { document.getElementById('bar-modal-content').innerHTML = html; document.getElementById('bar-modal').hidden = false; }
function closeModal() { document.getElementById('bar-modal').hidden = true; document.getElementById('bar-modal-content').innerHTML = ''; }

// A new bar-created order fires BOTH 'bar_order_created' and 'request_created' from the backend
// (see registerOrderRoutes) — 'request_created' also has to cover bar tickets that originate from
// a mixed restaurant/kitchen order (those never fire 'bar_order_created'). Without de-duping, a
// bar-originated order matched both listeners and produced two toasts, two sounds and two browser
// notifications for the same single ticket. Track recently-notified order ids for a few seconds
// so the second event for the same order is a no-op.
const recentlyNotifiedOrderIds = new Set();
function notifyOnce(event) {
  let data = {};
  try { data = JSON.parse(event.data || '{}'); } catch (error) { data = {}; }
  const id = data.id;
  if (id) {
    if (recentlyNotifiedOrderIds.has(id)) return;
    recentlyNotifiedOrderIds.add(id);
    setTimeout(() => recentlyNotifiedOrderIds.delete(id), 8000);
  }
  notifyNewOrder(event);
}

function connectEvents() {
  const stream = new EventSource(`/api/events${tenantQuery()}`);
  ['bar_order_created', 'bar_order_updated', 'bar_inventory_updated', 'bar_menu_updated', 'request_created', 'request_updated', 'table_updated', 'room_updated'].forEach(name => stream.addEventListener(name, loadData));
  stream.addEventListener('bar_order_created', notifyOnce);
  stream.addEventListener('request_created', event => {
    let departments = [];
    try { departments = JSON.parse(event.data || '{}').departments || []; } catch (error) { departments = []; }
    if (departments.some(department => String(department).toLocaleLowerCase('tr-TR') === 'bar')) notifyOnce(event);
  });
  stream.onerror = () => { stream.close(); setTimeout(connectEvents, 4000); };
}

function toast(message, error = false) {
  const root = document.getElementById('bar-toast');
  root.textContent = message;
  root.className = `show${error ? ' error' : ''}`;
  setTimeout(() => { root.className = ''; }, 3200);
}
