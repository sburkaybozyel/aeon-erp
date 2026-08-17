
// ==========================================
// UNIFIED GUEST PORTAL & SIMULATOR ENGINE
// ==========================================

import { state, logEvent, registerLoader } from './state.js';

let activeTarget = ''; // e.g. 'Room-101' or 'Table-Masa 1'
let cart = []; // array of { itemId, quantity, name, price }
let portalMode = '';
let currentMenuItems = [];
let trackedOrderIds = [];
let orderStatusCache = {};
let guestOrderPollTimer = null;

export async function setupGuestPortal(target, mode = '') {
  portalMode = mode === 'restaurant' ? 'restaurant' : 'room';
  const resolvedTarget = await setupTargetSelector(target, portalMode);
  target = resolvedTarget;
  activeTarget = target;
  trackedOrderIds = loadTrackedGuestOrders();
  
  const badge = document.getElementById('guest-location-badge');
  if (badge) {
    badge.textContent = target;
    if (target.startsWith('Room-')) {
      badge.className = 'room-badge occupied';
    } else {
      badge.className = 'room-badge clean';
    }
  }

  const welcomeTitle = document.getElementById('welcome-title');
  if (welcomeTitle) {
    welcomeTitle.textContent = target.startsWith('Room-') ? `Oda ${target.replace('Room-', '')}` : `${target.replace('Table-', '')} Restoran Menüsü`;
  }
  document.title = target.startsWith('Room-') ? `Oda ${target.replace('Room-', '')} | Misafir Menüsü` : `${target.replace('Table-', '')} | Restoran Menüsü`;

  // Hide/Show sections based on Room vs Table
  const folioSec = document.getElementById('guest-folio-section');
  const roomServicesSec = document.getElementById('guest-room-services-section');
  const btnClean = document.getElementById('btn-guest-request-clean');
  const btnBill = document.getElementById('btn-guest-call-bill');
  const btnWaiter = document.getElementById('btn-guest-call-service');

  if (target.startsWith('Room-')) {
    if (folioSec) folioSec.style.display = 'block';
    if (roomServicesSec) roomServicesSec.style.display = 'block';
    if (btnClean) btnClean.style.display = 'block';
    if (btnBill) {
      btnBill.querySelector('span').textContent = 'Folyomu Gör';
      btnBill.onclick = () => {
        const el = document.getElementById('guest-folio-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      };
    }
    if (btnWaiter) {
      btnWaiter.querySelector('span').textContent = 'Oda Servisi İste';
      btnWaiter.onclick = () => sendQuickRequest('room_service_call', 'Oda Servisi Görevlisi Çağrısı');
    }
  } else {
    if (folioSec) folioSec.style.display = 'none';
    if (roomServicesSec) roomServicesSec.style.display = 'none';
    if (btnClean) btnClean.style.display = 'none';
    if (btnWaiter) {
      btnWaiter.querySelector('span').textContent = 'Garson Çağır';
      btnWaiter.onclick = () => sendQuickRequest('waiter_call', 'Garson Çağrısı');
    }
    if (btnBill) {
      btnBill.querySelector('span').textContent = 'Hesap İste';
      btnBill.onclick = () => sendQuickRequest('bill_call', 'Hesap Talebi');
    }
  }

  if (btnClean && target.startsWith('Room-')) {
    btnClean.onclick = () => {
      sendQuickRequest('cleaning_request', 'Oda Temizliği Talebi');
    };
  }

  const btnSubmit = document.getElementById('btn-guest-submit-order');
  if (btnSubmit) {
    btnSubmit.onclick = submitOrder;
  }
  const btnClearCart = document.getElementById('btn-guest-clear-cart');
  if (btnClearCart) {
    btnClearCart.onclick = clearCart;
  }

  renderRoomServiceCatalog();
  loadMenuData();
  loadGuestOrderTracker();
  startGuestOrderPolling();
  if (target.startsWith('Room-')) {
    loadFolioData();
  }
}

async function setupTargetSelector(initialTarget, mode = '') {
  const select = document.getElementById('guest-target-select');
  const lockedMode = mode === 'restaurant' ? 'restaurant' : 'room';
  let rooms = [];
  let tables = [];
  try {
    const targetsRes = await fetch('/api/guest/targets');
    const targets = targetsRes.ok ? await targetsRes.json() : { rooms: [], tables: [] };
    rooms = Array.isArray(targets.rooms) ? targets.rooms.map(value => String(value)) : [];
    tables = Array.isArray(targets.tables) ? targets.tables : [];
  } catch (err) {
    rooms = [];
    tables = [];
  }
  const roomTargets = rooms.map(roomNumber => `Room-${roomNumber}`);
  const tableTargets = tables.map(table => `Table-${table.table_number}`);
  const requestedTarget = String(initialTarget || '').trim();
  const prefixValid = lockedMode === 'room' ? requestedTarget.startsWith('Room-') : requestedTarget.startsWith('Table-');
  const knownTargets = lockedMode === 'room' ? roomTargets : tableTargets;
  const defaultTarget = knownTargets[0] || (lockedMode === 'room' ? 'Room-1' : 'Table-Garden 1');
  const lockedTarget = prefixValid && (knownTargets.length === 0 || knownTargets.includes(requestedTarget)) ? requestedTarget : defaultTarget;
  if (!select) {
    return lockedTarget;
  }

  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = lockedTarget;
  option.textContent = lockedTarget.replace('Room-', 'Oda ').replace('Table-', '');
  select.appendChild(option);
  select.value = lockedTarget;
  select.hidden = true;
  select.setAttribute('aria-hidden', 'true');
  return lockedTarget;
}

async function sendQuickRequest(type, details) {
  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        target_identifier: activeTarget,
        details
      })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      showGuestNotice({
        title: 'Talebiniz Alındı',
        message: result.forwardedTo === 'reception' ? 'İsteğiniz doğrudan resepsiyona iletildi.' : 'İsteğiniz ilgili ekibe iletildi.',
        tone: 'success'
      });
    } else {
      showGuestNotice({
        title: 'İşlem Tamamlanamadı',
        message: result.error || 'Bir hata oluştu, lütfen tekrar deneyin.',
        tone: 'error'
      });
    }
  } catch (err) {
    console.error(err);
    showGuestNotice({
      title: 'Bağlantı Hatası',
      message: 'Talebiniz şu anda gönderilemedi, lütfen tekrar deneyin.',
      tone: 'error'
    });
  }
}

function renderRoomServiceCatalog() {
  const section = document.getElementById('guest-room-services-section');
  const grid = document.getElementById('guest-room-services-grid');
  if (!section || !grid) return;

  if (!targetIsRoom()) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  const services = [
    { icon: 'fa-broom', title: 'Oda Temizliği', type: 'cleaning_request', details: 'Oda Temizliği Talebi' },
    { icon: 'fa-bath', title: 'Temiz Havlu', type: 'towel_request', details: 'Ekstra Temiz Havlu Talebi' },
    { icon: 'fa-bed', title: 'Çarşaf / Yastık', type: 'linen_request', details: 'Ekstra Çarşaf veya Yastık Talebi' },
    { icon: 'fa-droplet', title: 'Su', type: 'water_request', details: 'Odaya Su Talebi' },
    { icon: 'fa-pump-soap', title: 'Banyo Seti', type: 'amenity_request', details: 'Şampuan, sabun veya banyo seti talebi' },
    { icon: 'fa-screwdriver-wrench', title: 'Teknik Servis', type: 'maintenance_request', details: 'Oda Teknik Servis Talebi' },
    { icon: 'fa-utensils', title: 'Oda Servisi', type: 'room_service_call', details: 'Oda Servisi Görevlisi Çağrısı' },
    { icon: 'fa-car', title: 'Transfer / Taksi', type: 'transport_request', details: 'Transfer veya taksi talebi' }
  ];

  grid.innerHTML = '';
  services.forEach(service => {
    const card = document.createElement('button');
    card.className = 'aeon-card';
    card.style.minHeight = '95px';
    card.style.padding = '10px';
    card.innerHTML = `
      <i class="fa-solid ${service.icon}" style="font-size: 20px; margin-bottom: 6px;"></i>
      <span style="font-size: 12px; font-weight: 700;">${service.title}</span>
    `;
    card.onclick = () => sendQuickRequest(service.type, service.details);
    grid.appendChild(card);
  });
}

async function loadMenuData() {
  try {
    const res = await fetch('/api/catalog/availability');
    if (res.ok) {
      const menuItems = await res.json();
      state.availableCatalog = menuItems;
      const diningMenu = menuItems.filter(item => item.module_type === 'dining' || (targetIsRoom() && item.module_type === 'hotel' && item.price > 0));
      renderMenu(diningMenu);
      renderPaymentMethods(targetIsRoom());
    }
  } catch (err) {
    console.error(err);
  }
}

function targetIsRoom() {
  return activeTarget.startsWith('Room-');
}

function renderPaymentMethods(isRoom) {
  const select = document.getElementById('guest-payment-method');
  if (!select) return;
  select.innerHTML = '';
  
  const options = [
    { id: 'cash', name: 'Nakit' },
    { id: 'card', name: 'Kredi Kartı' }
  ];
  if (isRoom) {
    options.push({ id: 'room_charge', name: 'Oda Hesabına Yaz' });
  }

  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.id;
    el.textContent = opt.name;
    select.appendChild(el);
  });
}

function renderMenu(items) {
  const container = document.getElementById('guest-menu-grid');
  if (!container) return;
  container.innerHTML = '';
  currentMenuItems = items;

  if (items.length === 0) {
    container.innerHTML = `<div class="aeon-card" style="min-height:100px;"><span class="card-title">Menü yüklenemedi.</span></div>`;
    return;
  }

  const categories = getMenuCategories(items);
  categories.forEach(category => {
    const section = document.createElement('section');
    section.className = 'guest-menu-section';
    section.innerHTML = `
      <div class="guest-menu-section-head">
        <div>
          <span>${category.eyebrow}</span>
          <h5>${category.title}</h5>
        </div>
        <strong>${category.items.length}</strong>
      </div>
      <div class="guest-menu-section-grid"></div>
    `;
    const grid = section.querySelector('.guest-menu-section-grid');
    category.items.forEach(item => grid.appendChild(renderMenuItemCard(item)));
    container.appendChild(section);
  });
}

function getMenuCategories(items) {
  const definitions = [
    { id: 'meze', eyebrow: 'Başlangıç', title: 'Mezeler & Salatalar' },
    { id: 'hot', eyebrow: 'Sıcak', title: 'Ara Sıcaklar' },
    { id: 'main', eyebrow: 'Ana Yemek', title: 'Deniz Ürünleri' },
    { id: 'breakfast', eyebrow: 'Gün Boyu', title: 'Kahvaltı & Tatlı' },
    { id: 'cocktail', eyebrow: 'Bar', title: 'İçkiler' },
    { id: 'soft', eyebrow: 'İçecek', title: 'Soğuk & Sıcak İçecekler' },
    { id: 'minibar', eyebrow: 'Oda', title: 'Minibar' },
    { id: 'other', eyebrow: 'Seçki', title: 'Diğer Lezzetler' }
  ];
  const grouped = definitions.map(def => ({ ...def, items: [] }));
  items.forEach(item => {
    const groupId = resolveMenuCategoryId(item);
    const group = grouped.find(def => def.id === groupId) || grouped[grouped.length - 1];
    group.items.push(item);
  });
  return grouped.filter(group => group.items.length > 0);
}

function resolveMenuCategoryId(item) {
  const text = `${item.id || ''} ${item.name || ''}`.toLocaleLowerCase('tr-TR');
  if (item.category === 'minibar') return 'minibar';
  if (item.category === 'drink') {
    if (/(rakı|raki|gin|cin|tonik|şarap|sarap|bira|miller|efes)/.test(text)) return 'cocktail';
    return 'soft';
  }
  if (/(meze|salata|humus|ezme|cacık|cacik)/.test(text)) return 'meze';
  if (/(kalamar|karides|güveç|guvec|ahtapot)/.test(text)) return 'hot';
  if (/(bal|kaymak|gözleme|gozleme|kahvaltı|kahvalti|tatlı|tatli)/.test(text)) return 'breakfast';
  if (/(levrek|çipura|cipura|balık|balik|deniz)/.test(text)) return 'main';
  return item.category === 'food' ? 'main' : 'other';
}

function renderMenuItemCard(item) {
  const cartItem = cart.find(c => c.itemId === item.id);
  const cartQty = cartItem ? cartItem.quantity : 0;
  const itemCard = document.createElement('div');
  itemCard.className = 'aeon-card guest-menu-card';
  itemCard.style.padding = '12px';
  itemCard.style.minHeight = '140px';
  itemCard.style.cursor = 'pointer';

  const isOutOfStock = item.maxServings === 0;

  let stockBadgeHtml = '';
  if (isOutOfStock) {
    stockBadgeHtml = `<span class="room-badge maintenance" style="font-size:9px; padding:2px 6px;">TÜKENDİ</span>`;
  } else if (Number.isFinite(item.maxServings) && item.maxServings <= 5) {
    stockBadgeHtml = `<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">SON ${item.maxServings}</span>`;
  } else {
    stockBadgeHtml = `<span class="room-badge clean" style="font-size:9px; padding:2px 6px;">Mevcut</span>`;
  }

  const iconClass = item.category === 'drink' ? 'fa-glass-water' : item.category === 'minibar' ? 'fa-door-closed' : 'fa-utensils';
  const imageUrl = typeof item.image_url === 'string' ? item.image_url.trim() : '';
  const mediaHtml = imageUrl
    ? `<div class="guest-menu-photo" style="background-image:url('${imageUrl.replace(/'/g, '%27')}')" role="img" aria-label="${String(item.name || 'Menü ürünü').replace(/"/g, '&quot;')}"></div>`
    : `<div class="guest-menu-icon"><i class="fa-solid ${iconClass}"></i></div>`;

  itemCard.innerHTML = `
    <div class="guest-menu-badge">
      ${stockBadgeHtml}
    </div>
    ${mediaHtml}
    <div class="card-title guest-menu-name">${item.name}</div>
    <div class="guest-menu-price">
      ${item.discountRate > 0 ? `
        <span style="color: var(--color-danger); text-decoration: line-through; margin-right: 4px;">${item.originalPrice} TL</span>
        <span style="color: var(--color-success);">${item.price} TL</span>
      ` : `
        <span style="color: var(--color-success);">${item.price} TL</span>
      `}
    </div>
    ${item.discountRate > 0 ? `
      <div class="guest-menu-campaign">
        <i class="fa-solid fa-bolt"></i> ${item.campaignTitle || 'İndirim Fırsatı'}
      </div>
    ` : ''}

    <div class="margin-top-sm guest-menu-cta">
      ${isOutOfStock ? '' : `
        <div class="btn btn-glass btn-xs guest-add-pill">
          <span class="guest-cart-count" data-item-id="${item.id}">${cartQty > 0 ? `Sepette ${cartQty}` : 'Sepete Ekle'}</span>
        </div>
      `}
    </div>
  `;
  if (!isOutOfStock) {
    itemCard.onclick = () => addMenuItemToCart(item.id);
  }
  return itemCard;
}

function addMenuItemToCart(itemId) {
  const catalogItem = state.availableCatalog?.find(i => i.id === itemId);
  if (!catalogItem) return;

  const cartItem = cart.find(c => c.itemId === itemId);
  const currentQty = cartItem ? cartItem.quantity : 0;
  const newQty = currentQty + 1;
  if (Number.isFinite(catalogItem.maxServings) && newQty > catalogItem.maxServings) {
    showGuestNotice({
      title: 'Stok Sınırı',
      message: 'Bu üründen şu anda daha fazla sipariş alınamıyor.',
      tone: 'warning'
    });
    return;
  }

  if (cartItem) {
    cartItem.quantity = newQty;
  } else {
    cart.push({
      itemId,
      quantity: 1,
      name: catalogItem.name,
      price: Number(catalogItem.price) || 0
    });
  }

  updateMenuItemCartState(itemId);
  updateCartFooter();
}

function updateMenuItemCartState(itemId) {
  const cartItem = cart.find(c => c.itemId === itemId);
  const countEl = Array.from(document.querySelectorAll('.guest-cart-count')).find(el => el.dataset.itemId === itemId);
  if (countEl) {
    countEl.textContent = cartItem ? `Sepette ${cartItem.quantity}` : 'Sepete Ekle';
  }
}

function clearCart() {
  cart = [];
  currentMenuItems.forEach(item => updateMenuItemCartState(item.id));
  updateCartFooter();
}

function updateCartFooter() {
  const footer = document.getElementById('guest-cart-footer');
  if (!footer) return;

  if (cart.length === 0) {
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  
  let total = 0;
  let count = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
    count += item.quantity;
  });

  document.getElementById('guest-cart-total').textContent = `${total.toFixed(2)} TL`;
  const summary = document.getElementById('guest-cart-summary');
  if (summary) {
    summary.textContent = `${count} ürün sepette`;
  }
}

async function submitOrder() {
  if (cart.length === 0) return;
  
  const paymentMethod = document.getElementById('guest-payment-method').value;

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: activeTarget,
        details: cart,
        payment_method: paymentMethod
      })
    });
    if (res.ok) {
      const result = await res.json();
      trackedOrderIds = Array.from(new Set([result.requestId, ...trackedOrderIds])).slice(0, 8);
      saveTrackedGuestOrders();
      orderStatusCache[result.requestId] = 'pending';
      showGuestNotice({
        title: 'Siparişiniz Alındı',
        message: `Mutfak & Bar ekibine iletildi. Tutar: ${result.totalAmount} TL`,
        tone: 'success'
      });

      clearCart();
      loadGuestOrderTracker();

      if (targetIsRoom()) {
        loadFolioData();
      }
      loadMenuData();
    } else {
      const err = await res.json();
      showGuestNotice({
        title: 'Sipariş Gönderilemedi',
        message: err.error || 'Lütfen tekrar deneyin.',
        tone: 'error'
      });
    }
  } catch (err) {
    console.error(err);
    showGuestNotice({
      title: 'Bağlantı Hatası',
      message: 'Siparişiniz şu anda gönderilemedi, lütfen tekrar deneyin.',
      tone: 'error'
    });
  }
}

function showGuestNotice({ title, message, tone = 'success' }) {
  let overlay = document.getElementById('guest-notice-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guest-notice-overlay';
    overlay.className = 'guest-notice-overlay';
    overlay.innerHTML = `
      <div class="guest-notice-modal" role="dialog" aria-modal="true" aria-labelledby="guest-notice-title">
        <div class="guest-notice-icon"><i class="fa-solid fa-check"></i></div>
        <h3 id="guest-notice-title"></h3>
        <p id="guest-notice-message"></p>
        <button class="btn btn-primary" id="guest-notice-close">Tamam</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) hideGuestNotice();
    });
    overlay.querySelector('#guest-notice-close').onclick = hideGuestNotice;
  }

  const icon = overlay.querySelector('.guest-notice-icon i');
  const modal = overlay.querySelector('.guest-notice-modal');
  modal.dataset.tone = tone;
  icon.className = tone === 'error' ? 'fa-solid fa-triangle-exclamation' : tone === 'warning' ? 'fa-solid fa-circle-info' : 'fa-solid fa-check';
  overlay.querySelector('#guest-notice-title').textContent = title;
  overlay.querySelector('#guest-notice-message').textContent = message;
  overlay.classList.add('active');
}

function hideGuestNotice() {
  const overlay = document.getElementById('guest-notice-overlay');
  if (overlay) overlay.classList.remove('active');
}

function getTrackedOrdersKey() {
  const safeTarget = activeTarget.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `guestTrackedOrders:${safeTarget}`;
}

function loadTrackedGuestOrders() {
  try {
    return JSON.parse(localStorage.getItem(getTrackedOrdersKey()) || '[]');
  } catch (err) {
    return [];
  }
}

function saveTrackedGuestOrders() {
  localStorage.setItem(getTrackedOrdersKey(), JSON.stringify(trackedOrderIds));
}

function startGuestOrderPolling() {
  if (guestOrderPollTimer) return;
  guestOrderPollTimer = setInterval(loadGuestOrderTracker, 3500);
}

async function loadGuestOrderTracker() {
  if (!activeTarget) return;
  const section = document.getElementById('guest-order-tracker-section');
  const list = document.getElementById('guest-order-tracker-list');
  if (!section || !list) return;

  try {
    const res = await fetch('/api/requests');
    if (!res.ok) return;
    const requests = await res.json();
    const visibleOrders = requests
      .filter(req => req.type === 'order' && req.target_identifier === activeTarget)
      .filter(req => trackedOrderIds.includes(req.id) || req.status !== 'completed')
      .slice(0, 6);

    if (visibleOrders.length === 0) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';
    visibleOrders.forEach(order => {
      if (orderStatusCache[order.id] && orderStatusCache[order.id] !== order.status) {
        showGuestNotice({
          title: 'Sipariş Durumu Güncellendi',
          message: `${formatOrderStatus(order.status)}: ${formatOrderItems(order.details)}`,
          tone: order.status === 'completed' ? 'success' : 'warning'
        });
      }
      orderStatusCache[order.id] = order.status;
      list.appendChild(renderGuestOrderStatusCard(order));
    });
  } catch (err) {
    console.error(err);
  }
}

function renderGuestOrderStatusCard(order) {
  const card = document.createElement('div');
  card.className = `guest-order-status-card status-${order.status}`;
  card.innerHTML = `
    <div class="guest-order-status-top">
      <div>
        <span>${new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <strong>${formatOrderStatus(order.status)}</strong>
      </div>
      <em>${Number(order.total_amount || 0).toFixed(2)} TL</em>
    </div>
    <div class="guest-order-items">${formatOrderItems(order.details)}</div>
    <div class="guest-order-progress">
      ${['pending', 'preparing', 'ready', 'completed'].map(status => `<i class="${isOrderStepActive(order.status, status) ? 'active' : ''}"></i>`).join('')}
    </div>
  `;
  return card;
}

function formatOrderStatus(status) {
  const labels = {
    pending: 'Mutfağa Düştü',
    preparing: 'Hazırlanıyor',
    ready: 'Servise Hazır',
    completed: 'Teslim Edildi'
  };
  return labels[status] || status;
}

function isOrderStepActive(current, step) {
  const order = ['pending', 'preparing', 'ready', 'completed'];
  return order.indexOf(step) <= order.indexOf(current);
}

function formatOrderItems(details) {
  try {
    const items = JSON.parse(details || '[]');
    if (Array.isArray(items)) {
      return items.map(item => `${item.quantity}x ${item.name || item.itemId}`).join(', ');
    }
  } catch (err) {}
  return details || 'Sipariş';
}

async function loadFolioData() {
  if (!targetIsRoom()) return;
  const roomNumber = activeTarget.replace('Room-', '').trim();
  
  try {
    const folioRes = await fetch(`/api/guest/folio?target=${encodeURIComponent(roomNumber)}`);
    if (folioRes.ok) {
      const data = await folioRes.json();
      renderFolio(data);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderFolio(data) {
  const container = document.getElementById('guest-folio-charges-list');
  const totalEl = document.getElementById('guest-folio-total');
  if (!container || !totalEl) return;

  container.innerHTML = '';
  
  let total = 0;
  const charges = data.charges || [];
  
  if (charges.length === 0) {
    container.innerHTML = `<div class="text-muted text-xs padding-sm">Şu ana kadar yansıtılmış harcama bulunmuyor.</div>`;
    totalEl.textContent = '0.00 TL';
    return;
  }

  charges.forEach(charge => {
    let detailsLabel = charge.details;
    if (charge.type === 'order') {
      try {
        const items = JSON.parse(charge.details);
        if (Array.isArray(items)) {
          detailsLabel = items.map(i => `${i.name} x ${i.quantity}`).join(', ');
        }
      } catch(e) {}
    }

    const row = document.createElement('div');
    row.className = 'flex-between text-xs';
    row.style.borderBottom = '1px solid var(--border-glass)';
    row.style.padding = '8px 0';
    row.innerHTML = `
      <div style="max-width: 70%;">
        <div style="font-weight:700;">${charge.type === 'room_service_charge' ? 'Oda Servisi' : 'Sipariş'}</div>
        <div class="text-muted" style="font-size:9px;">${detailsLabel}</div>
      </div>
      <div class="bold text-success">${charge.total_amount} TL</div>
    `;
    container.appendChild(row);
    total += charge.total_amount;
  });

  totalEl.textContent = `${total.toFixed(2)} TL`;
}


// ==========================================
// DESKTOP GUEST SIMULATOR SPECIFIC CODE
// ==========================================



export function setupDesktopGuestSimulator() {
  const btnEnterGuestPortal = document.getElementById('btn-enter-guest-portal');
  const targetSelector = document.getElementById('qr-target-select');
  const btnSimulateQr = document.getElementById('btn-simulate-qr');
  
  if (btnSimulateQr) {
    btnSimulateQr.addEventListener('click', () => {
      if (targetSelector) {
        state.simulatedTarget = targetSelector.value;
        const badge = document.getElementById('simulated-target-badge');
        if (badge) badge.textContent = state.simulatedTarget;
      }
      const guestNavItem = document.querySelector('.nav-item.guest-nav');
      if (guestNavItem) {
        guestNavItem.click();
      }
      if (btnEnterGuestPortal) {
        btnEnterGuestPortal.click();
      }
    });
  }
  
  if (btnEnterGuestPortal && targetSelector) {
    document.getElementById('simulated-target-badge').textContent = targetSelector.value;
    
    targetSelector.addEventListener('change', () => {
      state.simulatedTarget = targetSelector.value;
      document.getElementById('simulated-target-badge').textContent = state.simulatedTarget;
    });
    
    btnEnterGuestPortal.addEventListener('click', () => {
      document.querySelectorAll('.guest-subview').forEach(v => v.classList.remove('active'));
      
      if (state.simulatedTarget.startsWith('Table-')) {
        document.getElementById('guest-view-dining').classList.add('active');
        const tableName = state.simulatedTarget.replace('Table-', '').trim();
        document.querySelector('.guest-loc-name').textContent = tableName;
      } else if (state.simulatedTarget.startsWith('Room-')) {
        document.getElementById('guest-view-room').classList.add('active');
        const roomNum = state.simulatedTarget.replace('Room-', '').trim();
        document.querySelector('.guest-room-num').textContent = roomNum;
      } else {
        document.getElementById('guest-view-yacht').classList.add('active');
      }
      
      logEvent('system', `Misafir Portalı açıldı: <strong>${state.simulatedTarget}</strong>`);
      loadGuestSimulatorData();
    });
  }
  
  // Call Waiter
  const btnCallWaiter = document.getElementById('btn-guest-call-waiter');
  if (btnCallWaiter) {
    btnCallWaiter.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'waiter_call',
            target_identifier: state.simulatedTarget,
            details: 'Garson Çağrısı'
          })
        });
        if (res.ok) {
          logEvent('event', `Misafir Garson Çağırdı: <strong>${state.simulatedTarget}</strong>`);
          alert("Garson çağrısı iletildi.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Guest requests (water & towels)
  const actionTiles = document.querySelectorAll('.action-tile[data-request]');
  actionTiles.forEach(tile => {
    tile.addEventListener('click', async () => {
      const reqType = tile.getAttribute('data-request');
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: reqType,
            target_identifier: state.simulatedTarget,
            details: reqType === 'water_request' ? 'Odaya Su Talebi' : (reqType === 'maintenance_request' ? 'Teknik Servis Talebi' : 'Odaya Temiz Havlu Talebi')
          })
        });
        if (res.ok) {
          logEvent('event', `Misafir Oda İsteği Gönderdi: <strong>${state.simulatedTarget} - ${reqType}</strong>`);
          alert("Talebiniz resepsiyona iletildi.");
          loadGuestSimulatorData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  });

  // Guest DND Toggle
  const dndToggle = document.getElementById('btn-guest-toggle-dnd');
  if (dndToggle) {
    dndToggle.addEventListener('click', async () => {
      const isActiveNow = !dndToggle.classList.contains('active');
      const roomNum = state.simulatedTarget.replace('Room-', '').trim();
      
      try {
        const roomsRes = await fetch(`/api/rooms?tenant_id=${state.currentTenant}`);
        if (roomsRes.ok) {
          const rooms = await roomsRes.json();
          const roomObj = rooms.find(r => r.room_number === roomNum);
          if (roomObj) {
            const updateRes = await fetch(`/api/rooms/dnd?tenant_id=${state.currentTenant}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: roomObj.id, dnd_active: isActiveNow })
            });
            
            if (updateRes.ok) {
              await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'room_dnd_change',
                  target_identifier: state.simulatedTarget,
                  details: isActiveNow ? 'DND Aktifleştirildi' : 'DND Devre Dışı Bırakıldı'
                })
              });

              logEvent('event', `Misafir DND Durumu Değişti: ${state.simulatedTarget} -> ${isActiveNow ? 'Aktif' : 'Pasif'}`);
              loadGuestSimulatorData();
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Room Service Menu toggle inside Guest Room Portal
  const roomMenuToggle = document.getElementById('btn-guest-room-menu-toggle');
  if (roomMenuToggle) {
    roomMenuToggle.addEventListener('click', () => {
      const box = document.getElementById('guest-room-service-menu-box');
      if (box) {
        const isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        roomMenuToggle.classList.toggle('active', isHidden);
      }
    });
  }

  // Valet request trigger
  const valetBtn = document.getElementById('btn-guest-concierge-valet');
  if (valetBtn) {
    valetBtn.addEventListener('click', async () => {
      const roomNum = state.simulatedTarget.replace('Room-', '').trim();
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'towel_request', // Keep request type compatible or use custom type
            target_identifier: state.simulatedTarget,
            details: `Vale Çağrısı: Araç kapıya yönlendirilsin.`
          })
        });
        if (res.ok) {
          logEvent('event', `Misafir Vale Çağırdı: <strong>${state.simulatedTarget}</strong>`);
          alert(`Vale talebi iletildi! Aracınız kapıya yönlendiriliyor.`);
          loadGuestSimulatorData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Taxi request trigger
  const taxiBtn = document.getElementById('btn-guest-concierge-taxi');
  if (taxiBtn) {
    taxiBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'water_request',
            target_identifier: state.simulatedTarget,
            details: `Taksi Talebi: ${state.simulatedTarget} için taksi çağrılması talep edildi.`
          })
        });
        if (res.ok) {
          logEvent('event', `Misafir Taksi İstedi: <strong>${state.simulatedTarget}</strong>`);
          alert("Taksi çağrı talebiniz resepsiyona iletildi.");
          loadGuestSimulatorData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Boat transfer request trigger
  const boatBtn = document.getElementById('btn-guest-concierge-boat');
  if (boatBtn) {
    boatBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'towel_request',
            target_identifier: state.simulatedTarget,
            details: `Transfer Talebi: ${state.simulatedTarget} için transfer talebi oluşturuldu.`
          })
        });
        if (res.ok) {
          logEvent('event', `Misafir Bot Transferi İstedi: <strong>${state.simulatedTarget}</strong>`);
          alert("Koy içi bot transfer talebiniz kaptana iletildi.");
          loadGuestSimulatorData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Guest Checkout Cart
  const btnGuestCheckout = document.getElementById('btn-guest-checkout');
  if (btnGuestCheckout) {
    btnGuestCheckout.addEventListener('click', async () => {
      if (state.guestCart.length === 0) return;
      const paymentMethod = document.getElementById('guest-payment-method').value;
      
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order',
            target_identifier: state.simulatedTarget,
            details: state.guestCart,
            payment_method: paymentMethod
          })
        });
        
        if (res.ok) {
          logEvent('event', `Müşteri Siparişi Verildi: <strong>${state.simulatedTarget}</strong> - Ödeme Yöntemi: ${paymentMethod}`);
          state.guestCart = [];
          updateGuestCartDrawer();
          loadGuestSimulatorData();
          alert("Siparişiniz başarıyla alındı.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global addGuestCart helper
  window.addGuestCart = (itemId, name, price) => {
    const existing = state.guestCart.find(i => i.itemId === itemId);
    if (existing) {
      existing.quantity++;
    } else {
      state.guestCart.push({ itemId, name, price, quantity: 1 });
    }
    updateGuestCartDrawer();
  };

  registerLoader('loadGuestSimulatorData', loadGuestSimulatorData);
}

export async function loadDesktopGuestSimulatorData() {
  if (state.simulatedTarget.startsWith('Table-')) {
    renderGuestDiningMenu();
    updateGuestCartDrawer();
    loadGuestActiveOrders();
  } else if (state.simulatedTarget.startsWith('Room-')) {
    loadGuestRoomStatusAndFolio();
  } else {
    loadGuestYachtApa();
  }
}

function renderGuestDiningMenu() {
  const container = document.getElementById('guest-menu-container');
  if (!container) return;
  container.innerHTML = '';
  
  const diningItems = state.availableCatalog.filter(item => item.module_type === 'dining');
  diningItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'guest-menu-item';
    
    const limitText = item.maxServings === Infinity ? 'Sınırsız' : `${item.maxServings} Servis Kalan`;
    const isDisabled = item.maxServings <= 0;
    
    card.innerHTML = `
      <div class="menu-item-info">
        <h5>${item.name}</h5>
        <span>${item.price} TL</span>
        <span class="serving-limit text-muted">${limitText}</span>
      </div>
      <button class="btn btn-primary btn-xs" ${isDisabled ? 'disabled' : ''} onclick="addGuestCart('${item.id}', '${item.name}', ${item.price})">
        <i class="fa-solid fa-plus"></i> Ekle
      </button>
    `;
    container.appendChild(card);
  });
}

function updateGuestCartDrawer() {
  const drawer = document.getElementById('guest-cart');
  const itemsContainer = document.getElementById('guest-cart-items');
  const totalSpan = document.getElementById('guest-cart-total');
  
  if (!drawer) return;
  
  if (state.guestCart.length === 0) {
    drawer.classList.remove('active');
    return;
  }
  
  drawer.classList.add('active');
  itemsContainer.innerHTML = '';
  let total = 0;
  
  state.guestCart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <span>${item.name} x ${item.quantity}</span>
      <span>${(item.price * item.quantity).toFixed(2)} TL</span>
    `;
    itemsContainer.appendChild(row);
    total += item.price * item.quantity;
  });
  
  totalSpan.textContent = `${total.toFixed(2)} TL`;
}

async function loadGuestActiveOrders() {
  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const requests = await res.json();
      const active = requests.filter(r => r.target_identifier === state.simulatedTarget && r.status !== 'completed');
      
      const container = document.getElementById('guest-active-orders');
      if (!container) return;
      container.innerHTML = '';
      
      if (active.length === 0) {
        container.innerHTML = `<div class="text-muted text-xs">Aktif siparişiniz yok.</div>`;
        return;
      }
      
      active.forEach(a => {
        let text = 'İstek';
        if (a.type === 'order') {
          const items = JSON.parse(a.details);
          text = items.map(i => `${i.name} (${i.quantity})`).join(', ');
        }
        
        container.innerHTML += `
          <div class="flex-between margin-top-xs" style="background:rgba(228, 211, 167,0.02); padding: 6px; border-radius:4px;">
            <span class="text-xs" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:180px;">${text}</span>
            <span class="room-badge occupied text-xs" style="padding: 2px 6px;">${a.status}</span>
          </div>
        `;
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadGuestRoomStatusAndFolio() {
  const roomNum = state.simulatedTarget.replace('Room-', '').trim();
  try {
    const roomsRes = await fetch(`/api/rooms?tenant_id=${state.currentTenant}`);
    if (roomsRes.ok) {
      const rooms = await roomsRes.json();
      state.roomsList = rooms;
      const room = rooms.find(r => r.room_number === roomNum);
      
      if (room) {
        document.getElementById('guest-fullname-welcome').textContent = `Durum: Dolu`;
        
        const dndBadge = document.getElementById('guest-dnd-status');
        const dndTile = document.getElementById('btn-guest-toggle-dnd');
        
        if (room.dnd_active) {
          if (dndBadge) {
            dndBadge.textContent = 'DND Aktif';
            dndBadge.className = 'dnd-badge active';
          }
          if (dndTile) dndTile.classList.add('active');
        } else {
          if (dndBadge) {
            dndBadge.textContent = 'DND Kapalı';
            dndBadge.className = 'dnd-badge';
          }
          if (dndTile) dndTile.classList.remove('active');
        }
        
        // Render room service menu and cart configurations
        renderGuestRoomMenu();
        
        const pmSelect = document.getElementById('guest-payment-method');
        if (pmSelect) {
          pmSelect.value = 'room_charge';
        }

        // Load Folio
        const folioRes = await fetch(`/api/rooms/${room.id}/folio?tenant_id=${state.currentTenant}`);
        if (folioRes.ok) {
          const folioData = await folioRes.json();
          renderGuestFolio(folioData.charges);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderGuestFolio(charges) {
  const container = document.getElementById('guest-folio-items-list');
  const totalSpan = document.getElementById('guest-folio-total');
  
  if (!container) return;
  container.innerHTML = '';
  let total = 0;
  
  const validCharges = charges.filter(c => c.status !== 'cancelled');
  
  if (validCharges.length === 0) {
    container.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Henüz ek bir harcama bulunmamaktadır.</div>`;
    if (totalSpan) totalSpan.textContent = '0.00 TL';
    return;
  }
  
  validCharges.forEach(charge => {
    const row = document.createElement('div');
    row.className = 'folio-item-row';
    
    let text = 'Oda Servisi';
    if (charge.type === 'order') {
      const items = JSON.parse(charge.details);
      text = items.map(i => `${i.name} (${i.quantity})`).join(', ');
    } else if (charge.type === 'room_service_charge') {
      text = charge.details;
    }
    
    row.innerHTML = `
      <span>${text}</span>
      <span>${charge.total_amount.toFixed(2)} TL</span>
    `;
    container.appendChild(row);
    total += charge.total_amount;
  });
  
  if (totalSpan) totalSpan.textContent = `${total.toFixed(2)} TL`;
}

async function loadGuestYachtApa() {
  try {
    const summaryRes = await fetch(`/api/apa/summary?tenant_id=${state.currentTenant}`);
    const ledgerRes = await fetch(`/api/apa/ledger?tenant_id=${state.currentTenant}`);
    
    if (summaryRes.ok && ledgerRes.ok) {
      const summary = await summaryRes.json();
      const ledger = await ledgerRes.json();
      
      const guestApaRemaining = document.getElementById('guest-apa-remaining');
      const guestApaSpent = document.getElementById('guest-apa-spent');
      const guestBar = document.getElementById('guest-apa-progress-bar');
      
      if (guestApaRemaining) guestApaRemaining.textContent = `€${summary.remainingBudget.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      if (guestApaSpent) guestApaSpent.textContent = `€${summary.totalSpentEur.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      
      const pct = (summary.totalSpentEur / summary.budget) * 100;
      if (guestBar) guestBar.style.width = `${Math.min(pct, 100)}%`;
      
      const list = document.getElementById('guest-apa-list');
      if (!list) return;
      list.innerHTML = '';
      
      if (ledger.length === 0) {
        list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Henüz harcama faturası girilmedi.</div>`;
        return;
      }
      
      ledger.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'apa-guest-item';
        const calcEur = entry.amount * entry.exchange_rate_to_eur;
        
        item.innerHTML = `
          <div class="apa-guest-item-info">
            <h5>${entry.description}</h5>
            <p>${translateCategory(entry.category)} • Fiş Görseli Mevcut</p>
          </div>
          <div class="apa-guest-item-amount">
            €${calcEur.toFixed(2)}
          </div>
        `;
        
        item.addEventListener('click', () => {
          viewReceipt(entry.receipt_image_path, entry.description, entry.amount, entry.currency);
        });
        
        list.appendChild(item);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function translateCategory(cat) {
  const map = {
    fuel: 'Yakıt (Fuel)',
    marina_fees: 'Marina Ücreti',
    provisions_guest: 'Kumanya',
    alcohol: 'Bar & Alkol',
    clearance: 'Acente & Gümrük'
  };
  return map[cat] || cat;
}

function renderGuestRoomMenu() {
  const container = document.getElementById('guest-room-menu-container');
  if (!container) return;
  container.innerHTML = '';
  
  const diningItems = state.availableCatalog.filter(item => item.module_type === 'dining');
  diningItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'guest-menu-item';
    
    const limitText = item.maxServings === Infinity ? 'Sınırsız' : `${item.maxServings} Servis Kalan`;
    const isDisabled = item.maxServings <= 0;
    
    card.innerHTML = `
      <div class="menu-item-info">
        <h5>${item.name}</h5>
        <span style="font-weight:700; color: var(--color-accent);">${item.price} TL</span>
        <span class="serving-limit text-muted" style="font-size: 10px; margin-left: 8px;">${limitText}</span>
      </div>
      <button class="btn btn-primary btn-xs" ${isDisabled ? 'disabled' : ''} onclick="addGuestCart('${item.id}', '${item.name}', ${item.price})">
        <i class="fa-solid fa-plus"></i> Ekle
      </button>
    `;
    container.appendChild(card);
  });
}


// ==========================================
// DYNAMIC DISPATCH ROUTER
// ==========================================
export function setupGuestSimulator() {
  return setupDesktopGuestSimulator();
}

export async function loadGuestSimulatorData() {
  return loadDesktopGuestSimulatorData();
}
