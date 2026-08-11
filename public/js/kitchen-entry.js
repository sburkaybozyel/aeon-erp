import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

let kitchenRequests = [];
let kitchenInventory = [];
let kitchenCatalog = [];
let marketReceiptItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || !['kitchen', 'chef'].includes(user.role.toLowerCase())) return;

  setupTabs();
  setupKdsQueueTabs();
  setupModals();
  setupActions();

  await loadKitchenData();

  initKitchenSSE();
  setInterval(loadKitchenData, 15000);

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
    const [reqsRes, invRes, catRes] = await Promise.all([
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`)
    ]);

    if (reqsRes.ok) kitchenRequests = await reqsRes.json();
    if (invRes.ok) kitchenInventory = await invRes.json();
    if (catRes.ok) kitchenCatalog = await catRes.json();

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

function renderKdsQueues() {
  const tablesList = document.getElementById('kds-tables-orders-list');
  const roomsList = document.getElementById('kds-rooms-orders-list');

  if (tablesList) {
    tablesList.innerHTML = '';
    const tableOrders = kitchenRequests.filter(r => r.type === 'order' && r.target_identifier.startsWith('Table-') && r.status !== 'completed' && r.status !== 'delivered');
    if (tableOrders.length === 0) {
      tablesList.innerHTML = '<div class="text-muted text-center small">Masa siparişi bulunmuyor.</div>';
    } else {
      tableOrders.forEach(o => renderOrderCard(o, tablesList));
    }
  }

  if (roomsList) {
    roomsList.innerHTML = '';
    const roomOrders = kitchenRequests.filter(r => r.type === 'order' && r.target_identifier.startsWith('Room-') && r.status !== 'completed' && r.status !== 'delivered');
    if (roomOrders.length === 0) {
      roomsList.innerHTML = '<div class="text-muted text-center small">Oda servisi siparişi bulunmuyor.</div>';
    } else {
      roomOrders.forEach(o => renderOrderCard(o, roomsList));
    }
  }
}

function renderOrderCard(order, container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '14px';
  card.style.borderLeft = `4px solid ${order.status === 'preparing' ? 'var(--color-primary)' : 'var(--color-warning)'}`;

  let detailsHtml = '';
  try {
    if (typeof order.details === 'string') {
      const arr = JSON.parse(order.details);
      if (Array.isArray(arr)) {
        detailsHtml = arr.map(item => `<div><strong>${item.quantity}x</strong> ${item.name}</div>`).join('');
      }
    }
  } catch (e) {
    detailsHtml = `<div>${order.details}</div>`;
  }

  const isPreparing = order.status === 'preparing';

  card.innerHTML = `
    <div class="d-flex justify-content-between align-items-center" style="border-bottom: 1px solid var(--border-glass); padding-bottom:6px; margin-bottom:8px;">
      <strong>${order.target_identifier}</strong>
      <span class="badge ${isPreparing ? 'badge-primary' : 'badge-warning'}">${order.status === 'preparing' ? 'Hazırlanıyor' : 'Sırada'}</span>
    </div>
    <div class="small" style="margin-bottom:12px;">${detailsHtml}</div>
    <div class="d-flex gap-2">
      ${!isPreparing ? `<button class="btn btn-primary btn-xs flex-1" onclick="updateOrderStatus('${order.id}', 'preparing')">Başla</button>` : ''}
      <button class="btn btn-success btn-xs flex-1" onclick="updateOrderStatus('${order.id}', 'ready')">Hazır</button>
    </div>
  `;
  container.appendChild(card);
}

window.updateOrderStatus = async function(id, status) {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, updated_by: 'Mutfak KDS' })
    });
    if (res.ok) {
      loadKitchenData();
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

  // File upload change listener
  document.getElementById('ai-receipt-upload').addEventListener('change', handleReceiptImageUpload);

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

  const prs = kitchenRequests.filter(r => r.type === 'purchase_request' || r.type === 'material_request');
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
        <strong>${pr.target_identifier || 'Mutfak'}</strong>
        <span class="badge badge-secondary">${pr.status}</span>
      </div>
      <div class="small" style="margin-top: 4px;">${pr.details}</div>
    `;
    list.appendChild(div);
  });
}

async function submitPurchaseRequest(e) {
  e.preventDefault();
  const item = document.getElementById('staff-pr-item').value;
  const qty = document.getElementById('staff-pr-qty').value;

  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'purchase_request',
        target_identifier: 'Mutfak Depo',
        details: `Malzeme talebi: ${item} (${qty})`,
        department: 'Kitchen',
        created_by: 'Mutfak Şefi'
      })
    });
    if (res.ok) {
      loadPastPurchaseRequests();
      loadKitchenData();
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

  if (!inventoryId || isNaN(qty)) return;

  try {
    const res = await fetch(`/api/inventory/transaction?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_id: inventoryId,
        quantity: -qty, // Negative for reduction
        type: 'wastage',
        notes: 'Zayiat / Mutfak Fire Kaydı',
        created_by: 'Mutfak Şefi'
      })
    });
    if (res.ok) {
      alert("Zayiat kaydı başarıyla stoğa işlendi.");
      document.getElementById('staff-wastage-modal').style.display = 'none';
      loadKitchenData();
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

async function handleReceiptImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const overlay = document.getElementById('receipt-loading-overlay');
  if (overlay) overlay.style.display = 'flex';

  try {
    const base64String = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/inventory/receipt/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64String })
    });

    if (res.ok) {
      const parsedData = await res.json();
      if (parsedData.vendor) document.getElementById('mr-vendor').value = parsedData.vendor;
      if (parsedData.total_amount) document.getElementById('mr-total').value = parsedData.total_amount;
      
      if (parsedData.items && parsedData.items.length > 0) {
        parsedData.items.forEach(pItem => {
          const invItem = kitchenInventory.find(i => 
            i.name.toLowerCase().includes(pItem.name.toLowerCase()) || 
            pItem.name.toLowerCase().includes(i.name.toLowerCase())
          );
          
          if (invItem) {
            marketReceiptItems.push({
              inventory_id: invItem.id,
              name: invItem.name,
              quantity: pItem.quantity || 1,
              unit_price: pItem.unit_price || 0,
              total_price: (pItem.quantity || 1) * (pItem.unit_price || 0)
            });
          }
        });
        renderMarketReceiptItems();
      }
    } else {
      alert("AI okuma hatası oluştu.");
    }
  } catch (err) {
    console.error(err);
    alert("Fotoğraf yüklenirken bir sorun oluştu.");
  } finally {
    if (overlay) overlay.style.display = 'none';
    event.target.value = '';
  }
}

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
