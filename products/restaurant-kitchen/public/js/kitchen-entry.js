import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

let kitchenRequests = [];
let kitchenInventory = [];
let kitchenCatalog = [];
let kitchenTickets = [];
let marketReceiptItems = [];

// Guest-supplied free text (order modifiers, allergen notes) is stored and served back
// verbatim by the API — treat it as hostile and never interpolate it into innerHTML unescaped.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  const role = String(user?.role || '').toLocaleLowerCase('tr-TR');
  if (!user || !['kitchen', 'chef', 'admin', 'manager', 'yönetici', 'restoran müdürü'].includes(role)) return;

  setupTabs();
  setupKdsQueueTabs();
  setupModals();
  setupActions();

  await loadKitchenData();

  initKitchenSSE();
  // Tighter poll than the generic 15s screens — the KDS is watched continuously during a live
  // service, so a missed SSE push (reconnect gap, tab backgrounded) should self-heal quickly.
  setInterval(loadKitchenData, 8000);

  setupStaffPushNotifications(user);
  startRequestNotifications({ surface: 'kitchen' });
});

function initKitchenSSE() {
  const url = `/api/events?tenant_id=${state.currentTenant}`;
  const es = new EventSource(url);
  es.addEventListener('request_created', loadKitchenData);
  es.addEventListener('request_updated', loadKitchenData);
  es.onerror = () => {
    es.close();
    setTimeout(initKitchenSSE, 3000);
  };
}

async function loadKitchenData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [reqsRes, invRes, catRes, ticketsRes] = await Promise.all([
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`),
      fetch(`/api/kitchen/tickets${tenantParam}`)
    ]);

    if (reqsRes.ok) kitchenRequests = await reqsRes.json();
    if (invRes.ok) kitchenInventory = await invRes.json();
    if (catRes.ok) kitchenCatalog = await catRes.json();
    if (ticketsRes.ok) kitchenTickets = await ticketsRes.json();

    renderKdsQueues();
    renderTablesGrid();
    populateWastageItemDropdown();
    populateMrItemDropdown();
  } catch (err) {
    console.error(err);
  }
}

function setupTabs() {
  const tabs = ['kds', 'tables', 'actions'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`nav-kitchen-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => {
          document.getElementById(`nav-kitchen-tab-${t}`).classList.remove('active');
          document.getElementById(`kitchen-subview-${t}`).classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(`kitchen-subview-${tab}`).classList.add('active');
      });
    }
  });
}

function setupKdsQueueTabs() {
  const btnTables = document.getElementById('btn-tab-order-tables');
  const btnRooms = document.getElementById('btn-tab-order-rooms');
  const sectTables = document.getElementById('section-order-tables');
  const sectRooms = document.getElementById('section-order-rooms');

  if (btnTables && btnRooms && sectTables && sectRooms) {
    btnTables.addEventListener('click', () => {
      btnTables.classList.add('active');
      btnRooms.classList.remove('active');
      sectTables.style.display = 'block';
      sectRooms.style.display = 'none';
    });

    btnRooms.addEventListener('click', () => {
      btnRooms.classList.add('active');
      btnTables.classList.remove('active');
      sectTables.style.display = 'none';
      sectRooms.style.display = 'block';
    });
  }
}

const KDS_ACTIVE_STATUSES = new Set(['pending', 'accepted', 'preparing', 'ready']);

function renderKdsQueues() {
  const tablesList = document.getElementById('kds-tables-orders-list');
  const roomsList = document.getElementById('kds-rooms-orders-list');

  if (tablesList) {
    tablesList.innerHTML = '';
    const tableOrders = kitchenRequests.filter(r => r.type === 'order' && r.target_identifier.startsWith('Table-') && KDS_ACTIVE_STATUSES.has(r.status));
    if (tableOrders.length === 0) {
      tablesList.innerHTML = '<div class="text-muted text-center small">Masa siparişi bulunmuyor.</div>';
    } else {
      tableOrders.forEach(o => renderOrderCard(o, tablesList));
    }
  }

  if (roomsList) {
    roomsList.innerHTML = '';
    const roomOrders = kitchenRequests.filter(r => r.type === 'order' && r.target_identifier.startsWith('Room-') && KDS_ACTIVE_STATUSES.has(r.status));
    if (roomOrders.length === 0) {
      roomsList.innerHTML = '<div class="text-muted text-center small">Oda servisi siparişi bulunmuyor.</div>';
    } else {
      roomOrders.forEach(o => renderOrderCard(o, roomsList));
    }
  }
}

// Order-level status -> the shared .kds-card status vocabulary (aeon-components.css).
const KDS_STATUS_CLASS = {
  pending: 'status-pending',
  accepted: 'status-pending',
  preparing: 'status-preparing',
  ready: 'status-ready',
  served: 'status-completed',
  completed: 'status-completed'
};
const KDS_STATUS_LABEL = {
  pending: 'Sırada',
  accepted: 'Kabul Edildi',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır — Servis Bekliyor',
  served: 'Servis Edildi',
  completed: 'Tamamlandı'
};

function elapsedMinutes(isoTime) {
  const created = new Date(isoTime).getTime();
  if (!Number.isFinite(created)) return null;
  return Math.max(0, Math.round((Date.now() - created) / 60000));
}

function renderOrderCard(order, container) {
  const card = document.createElement('div');
  const statusClass = KDS_STATUS_CLASS[order.status] || 'status-pending';
  card.className = `kds-card ${statusClass}`;

  // Only the food lines that actually belong to the kitchen (not drinks — those are on the bar's
  // own board) come from the real per-dish ticket data, so allergens/modifiers/station routing
  // are visible instead of a bare "2x Köfte" line parsed out of the raw order JSON.
  const lines = kitchenTickets.filter(t => t.request_id === order.id && t.production_area === 'Kitchen');
  const minutes = elapsedMinutes(order.order_created_at || order.created_at);
  const isUrgent = lines.some(l => l.priority === 'urgent');

  const linesHtml = lines.length
    ? lines.map(line => `
        <div class="kds-line">
          <div class="kds-line-main">
            <span class="kds-line-qty">${escapeHtml(line.quantity)}×</span>
            <span class="kds-line-name">${escapeHtml(line.item_name)}</span>
            ${line.station_name ? `<span class="kds-station-tag">${escapeHtml(line.station_name)}</span>` : ''}
          </div>
          ${line.modifiers ? `<div class="kds-line-note">${escapeHtml(line.modifiers)}</div>` : ''}
          ${line.allergen_notes ? `<div class="kds-line-allergen"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(line.allergen_notes)}</div>` : ''}
        </div>`).join('')
    : `<div class="kds-line-note">Bu sipariş için mutfak kalemi bulunmuyor.</div>`;

  const nextAction = order.status === 'preparing'
    ? { label: 'Hazır', status: 'ready', cls: 'btn-success' }
    : { label: 'Hazırlamaya Başla', status: 'preparing', cls: 'btn-primary' };

  card.innerHTML = `
    <div class="kds-card-head">
      <div>
        <strong class="kds-target">${escapeHtml(order.target_identifier)}</strong>
        ${isUrgent ? '<span class="kds-urgent-tag"><i class="fa-solid fa-fire"></i> ACİL</span>' : ''}
      </div>
      <span class="badge ${statusClass === 'status-preparing' ? 'badge-primary' : statusClass === 'status-ready' ? 'badge-success' : 'badge-warning'}">${KDS_STATUS_LABEL[order.status] || order.status}</span>
    </div>
    <div class="kds-card-meta">${minutes === null ? '' : `<i class="fa-regular fa-clock"></i> ${minutes} dk önce`}</div>
    <div class="kds-lines">${linesHtml}</div>
    <div class="kds-card-actions">
      ${order.status !== 'ready' ? `<button class="btn ${nextAction.cls} tap-target-lg flex-1" onclick="updateOrderStatus('${order.id}', '${nextAction.status}')">${nextAction.label}</button>` : `<span class="kds-ready-note"><i class="fa-solid fa-bell-concierge"></i> Servis ekibi bekleniyor</span>`}
    </div>
  `;
  container.appendChild(card);
}

window.updateOrderStatus = async function(id, status) {
  try {
    // The backend reads `requestId`, not `id` — sending `id` used to silently 404 and leave
    // every "Başla"/"Hazır" tap doing nothing with no error shown to the cook.
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, status, completed_by: 'Mutfak KDS' })
    });
    if (res.ok) {
      loadKitchenData();
    } else {
      const body = await res.json().catch(() => ({}));
      console.error('[updateOrderStatus]', res.status, body.error);
      alert(body.error || 'Sipariş durumu güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
  }
};

function renderTablesGrid() {
  const grid = document.getElementById('kds-tables-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Get unique tables from current catalog tables or requests
  const activeTables = new Set(kitchenRequests.filter(r => r.target_identifier.startsWith('Table-')).map(r => r.target_identifier.replace('Table-', '')));
  
  if (activeTables.size === 0) {
    grid.innerHTML = '<div class="text-muted text-center small">Aktif masa bulunmuyor.</div>';
    return;
  }

  activeTables.forEach(tableNum => {
    const card = document.createElement('div');
    card.className = 'room-card room-status-occupied';
    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-number">${tableNum}</span>
        <span class="badge badge-primary">Aktif</span>
      </div>
      <div class="room-details">Masa Siparişleri var</div>
    `;
    grid.appendChild(card);
  });
}

function setupModals() {
  document.getElementById('btn-market-receipt-trigger').addEventListener('click', () => {
    marketReceiptItems = [];
    document.getElementById('mr-number').value = '';
    document.getElementById('mr-vendor').value = '';
    document.getElementById('mr-total').value = '';
    renderMarketReceiptItems();
    document.getElementById('market-receipt-modal').style.display = 'flex';
  });

  document.getElementById('btn-close-mr-modal').addEventListener('click', () => {
    document.getElementById('market-receipt-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-mr-modal').addEventListener('click', () => {
    document.getElementById('market-receipt-modal').style.display = 'none';
  });
  document.getElementById('btn-save-mr-modal').addEventListener('click', submitMarketReceipt);

  document.getElementById('btn-add-mr-item').addEventListener('click', addMarketReceiptItem);

  // Other modals close buttons
  const closeButtons = [
    { btn: 'btn-close-prep-modal', modal: 'staff-prep-tasks-modal' },
    { btn: 'btn-close-pr-modal', modal: 'staff-purchase-requests-modal' },
    { btn: 'btn-close-wastage-modal', modal: 'staff-wastage-modal' },
    { btn: 'btn-close-recipe-modal', modal: 'staff-recipe-manager-modal' }
  ];

  closeButtons.forEach(cb => {
    const btn = document.getElementById(cb.btn);
    if (btn) {
      btn.addEventListener('click', () => {
        document.getElementById(cb.modal).style.display = 'none';
      });
    }
  });
}

function setupActions() {
  document.getElementById('btn-staff-logout').addEventListener('click', () => {
    if (window.aeonLogout) window.aeonLogout();
  });

  // Action buttons
  document.getElementById('btn-kit-prep').addEventListener('click', openPrepTasks);
  document.getElementById('btn-kit-pr').addEventListener('click', openPurchaseRequests);
  document.getElementById('btn-kit-wastage').addEventListener('click', openWastage);
  document.getElementById('btn-kit-recipes').addEventListener('click', openRecipes);

  // Purchase Request form submit
  document.getElementById('staff-form-purchase-request').addEventListener('submit', submitPurchaseRequest);
  
  // Wastage form submit
  document.getElementById('staff-form-wastage').addEventListener('submit', submitWastage);
}

function openPrepTasks() {
  const list = document.getElementById('staff-prep-tasks-list');
  list.innerHTML = '';
  
  const tasks = [
    'Domates sosu hazırlığı (5 lt)',
    'Köfte porsiyonlama (50 adet)',
    'Ekmek pişirme (30 adet)',
    'Meze tepsileri tazeleme'
  ];

  tasks.forEach(t => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.padding = '10px';
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span>${t}</span>
        <button class="btn btn-success btn-xs" onclick="this.disabled=true; this.textContent='Yapıldı'">Tamamla</button>
      </div>
    `;
    list.appendChild(div);
  });

  document.getElementById('staff-prep-tasks-modal').style.display = 'flex';
}

async function openPurchaseRequests() {
  document.getElementById('staff-pr-item').value = '';
  document.getElementById('staff-pr-qty').value = '';
  await loadPastPurchaseRequests();
  document.getElementById('staff-purchase-requests-modal').style.display = 'flex';
}

async function loadPastPurchaseRequests() {
  const list = document.getElementById('staff-purchase-requests-list');
  list.innerHTML = '';

  // Purchase requests live in their own table (dining/inventory.js), not in `requests` — posting
  // to /api/requests with type 'purchase_request' was always rejected (not an allowed request
  // type) and this list was reading from the wrong collection, so it was permanently empty.
  let prs = [];
  try {
    const res = await fetch(`/api/purchase_requests?tenant_id=${state.currentTenant}`);
    if (res.ok) prs = await res.json();
  } catch (err) {
    console.error(err);
  }

  if (prs.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Kayıtlı satın alma talebi bulunmuyor.</div>';
    return;
  }

  prs.forEach(pr => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.padding = '10px';
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${escapeHtml(pr.item_name || 'Malzeme')}</strong>
        <span class="badge badge-secondary">${escapeHtml(pr.status)}</span>
      </div>
      <div class="small" style="margin-top: 4px;">${escapeHtml(String(pr.quantity ?? ''))} adet — ${escapeHtml(pr.requested_by || '')}</div>
    `;
    list.appendChild(div);
  });
}

async function submitPurchaseRequest(e) {
  e.preventDefault();
  const item = document.getElementById('staff-pr-item').value;
  const qty = document.getElementById('staff-pr-qty').value;
  if (!item.trim() || !qty) return;

  try {
    const res = await fetch(`/api/purchase_requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: item,
        quantity: qty,
        requested_by: 'Mutfak Şefi'
      })
    });
    if (res.ok) {
      loadPastPurchaseRequests();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Satın alma talebi oluşturulamadı.');
    }
  } catch (err) {
    console.error(err);
  }
}

function openWastage() {
  document.getElementById('staff-wastage-qty').value = '';
  document.getElementById('staff-wastage-modal').style.display = 'flex';
}

function populateWastageItemDropdown() {
  const select = document.getElementById('staff-wastage-item');
  if (!select) return;
  select.innerHTML = '';
  kitchenInventory.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.unit})`;
    select.appendChild(opt);
  });
}

async function submitWastage(e) {
  e.preventDefault();
  const inventoryId = document.getElementById('staff-wastage-item').value;
  const qty = parseFloat(document.getElementById('staff-wastage-qty').value);

  if (!inventoryId || isNaN(qty) || qty <= 0) return;

  try {
    // /api/inventory/transaction does not exist; the kitchen-scoped, transaction-safe waste
    // endpoint is /api/kitchen/waste (modules/dining/production.js), which also requires a
    // non-empty `reason` and takes a positive quantity to subtract (it does stock - amount
    // itself — sending a negative quantity here as the old code did would have added stock
    // back instead of removing it, on top of hitting a route that doesn't exist).
    const res = await fetch(`/api/kitchen/waste?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_id: inventoryId,
        quantity: qty,
        reason: 'Mutfak Fire Kaydı',
        notes: ''
      })
    });
    if (res.ok) {
      alert("Zayiat kaydı başarıyla stoğa işlendi.");
      document.getElementById('staff-wastage-modal').style.display = 'none';
      loadKitchenData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Zayiat kaydedilemedi.');
    }
  } catch (err) {
    console.error(err);
  }
}

function openRecipes() {
  const list = document.getElementById('staff-recipes-list');
  list.innerHTML = '';

  // Get food/drink catalog
  const foods = kitchenCatalog.filter(c => c.category === 'food' || c.category === 'drink');
  if (foods.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Kayıtlı reçete bulunmuyor.</div>';
  } else {
    foods.forEach(f => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.padding = '12px';
      div.innerHTML = `
        <strong style="color:var(--color-primary);">${f.name}</strong>
        <div class="small text-muted" style="margin-top: 4px;">Fiyat: ${f.price} TL</div>
      `;
      list.appendChild(div);
    });
  }

  document.getElementById('staff-recipe-manager-modal').style.display = 'flex';
}

function populateMrItemDropdown() {
  const select = document.getElementById('mr-item-select');
  if (!select) return;
  select.innerHTML = '';
  kitchenInventory.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.unit})`;
    select.appendChild(opt);
  });
}

function addMarketReceiptItem() {
  const select = document.getElementById('mr-item-select');
  const qty = parseFloat(document.getElementById('mr-item-qty').value);
  const price = parseFloat(document.getElementById('mr-item-price').value);

  if (!qty || !price) {
    alert("Miktar ve birim fiyat girin!");
    return;
  }

  const itemId = select.value;
  const name = select.options[select.selectedIndex].text;

  marketReceiptItems.push({
    inventory_id: itemId,
    name: name,
    quantity: qty,
    unit_price: price,
    total_price: qty * price
  });

  renderMarketReceiptItems();
  document.getElementById('mr-item-qty').value = '';
  document.getElementById('mr-item-price').value = '';
}

function renderMarketReceiptItems() {
  const list = document.getElementById('mr-items-list');
  list.innerHTML = '';

  if (marketReceiptItems.length === 0) {
    list.innerHTML = '<div class="text-muted text-xs italic">Henüz kalem eklenmedi.</div>';
    return;
  }

  marketReceiptItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'd-flex justify-content-between align-items-center small';
    row.style.padding = '4px 0';
    row.innerHTML = `
      <span>${item.name} (x${item.quantity})</span>
      <div>
        <span style="font-weight:bold; margin-right:8px;">${item.total_price.toFixed(2)} TL</span>
        <button class="btn btn-danger btn-xs" style="padding:2px 6px;" type="button" onclick="removeMrItem(${index})">&times;</button>
      </div>
    `;
    list.appendChild(row);
  });
}

window.removeMrItem = function(index) {
  marketReceiptItems.splice(index, 1);
  renderMarketReceiptItems();
};

async function submitMarketReceipt() {
  const vendor = document.getElementById('mr-vendor').value;
  const total = parseFloat(document.getElementById('mr-total').value);

  if (!vendor || marketReceiptItems.length === 0) {
    alert("Lütfen satıcı ve en az bir kalem ekleyin!");
    return;
  }

  try {
    const res = await fetch(`/api/inventory/receipt?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor,
        total_amount: total || 0,
        items: marketReceiptItems,
        created_by: 'Mutfak KDS'
      })
    });
    if (res.ok) {
      alert("Fatura başarıyla kaydedildi ve stoklar güncellendi.");
      document.getElementById('market-receipt-modal').style.display = 'none';
      loadKitchenData();
    }
  } catch (err) {
    console.error(err);
  }
}
