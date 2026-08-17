const state = {
  currentTenant: window.tenantId || new URLSearchParams(window.location.search).get('tenant_id') || 'reception'
};

let restTables = [];
let restRequests = [];
let restCatalog = [];
let restCart = [];
let activeCategory = 'all';

async function initRestaurantPortal() {
  setupTabs();
  setupCategoryFilters();
  setupModals();
  setupActions();

  await loadRestaurantData();

  initRestaurantSSE();
  setInterval(loadRestaurantData, 15000);

  const user = await window.aeonBoot();
  if (!user || !['restaurant', 'waiter', 'restoran müdürü'].includes(user.role.toLowerCase())) return;

  try {
    const [{ setupStaffPushNotifications }, { startRequestNotifications }] = await Promise.all([
      import('./push-notifications.js'),
      import('./request-notifications.js')
    ]);
    setupStaffPushNotifications(user);
    startRequestNotifications({ surface: 'restaurant' });
  } catch (err) {
    console.error(err);
  }
}

initRestaurantPortal();

function initRestaurantSSE() {
  const url = `/api/events?tenant_id=${state.currentTenant}`;
  const es = new EventSource(url);
  es.addEventListener('table_updated', loadRestaurantData);
  es.addEventListener('request_updated', loadRestaurantData);
  es.addEventListener('request_created', loadRestaurantData);
  es.onerror = () => {
    es.close();
    setTimeout(initRestaurantSSE, 3000);
  };
}

async function loadRestaurantData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [tablesRes, reqsRes, catRes] = await Promise.all([
      fetch(`/api/tables${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`)
    ]);

    if (tablesRes.ok) restTables = await tablesRes.json();
    if (reqsRes.ok) restRequests = await reqsRes.json();
    if (catRes.ok) restCatalog = await catRes.json();

    renderTables();
    renderReadyService();
    renderMenuItems();
    populateOrderTargetDropdown();
  } catch (err) {
    console.error(err);
  }
}

function setupTabs() {
  const tabs = ['tables', 'service', 'order'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`nav-restaurant-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => {
          document.getElementById(`nav-restaurant-tab-${t}`).classList.remove('active');
          document.getElementById(`restaurant-subview-${t}`).classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(`restaurant-subview-${tab}`).classList.add('active');
      });
    }
  });
}

function renderTables() {
  const grid = document.getElementById('staff-restaurant-tables-grid');
  if (!grid) return;
  grid.innerHTML = '';

  restTables.forEach(table => {
    const card = document.createElement('div');
    card.className = `room-card room-status-${table.status === 'occupied' ? 'occupied' : 'clean'}`;
    
    // Check if table has active requests/orders
    const orders = restRequests.filter(r => r.target_identifier === `Table-${table.table_number}` && r.status !== 'completed' && r.status !== 'delivered');
    const hasUnpaid = orders.length > 0;

    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-number">${table.table_number}</span>
        <span class="badge ${hasUnpaid ? 'badge-primary' : 'badge-success'}">${hasUnpaid ? 'Dolu' : 'Boş'}</span>
      </div>
      <div class="room-guest">${table.section || 'Restoran'}</div>
      <div class="room-details">${hasUnpaid ? `${orders.length} Aktif Sipariş` : 'Masa Müsait'}</div>
    `;

    card.addEventListener('click', () => openTableDetail(table, orders));
    grid.appendChild(card);
  });
}

let activeTable = null;
let activeTableOrders = [];

function openTableDetail(table, orders) {
  activeTable = table;
  activeTableOrders = orders;

  document.getElementById('table-detail-title').textContent = `${table.table_number} Detayı`;
  const list = document.getElementById('table-detail-orders');
  list.innerHTML = '';

  let total = 0;

  if (orders.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Aktif sipariş bulunmuyor.</div>';
  } else {
    orders.forEach(order => {
      let orderTotal = 0;
      let detailsHtml = '';
      try {
        if (typeof order.details === 'string') {
          const arr = JSON.parse(order.details);
          if (Array.isArray(arr)) {
            detailsHtml = arr.map(item => {
              const catalogItem = restCatalog.find(c => c.id === item.itemId) || { name: item.itemId, price: 0 };
              const price = catalogItem.price * item.quantity;
              orderTotal += price;
              return `<div class="d-flex justify-content-between"><span>${item.quantity}x ${catalogItem.name}</span><span>${price} TL</span></div>`;
            }).join('');
          }
        }
      } catch (e) {
        detailsHtml = `<div>${order.details}</div>`;
      }
      total += orderTotal;

      const orderBox = document.createElement('div');
      orderBox.style.padding = '8px';
      orderBox.style.borderBottom = '1px solid var(--border-glass)';
      orderBox.innerHTML = `
        <div class="d-flex justify-content-between small" style="font-weight:bold; color:var(--color-primary); margin-bottom:4px;">
          <span>Sipariş No: ${order.id.slice(0, 8)}</span>
          <span>Durum: ${order.status}</span>
        </div>
        <div>${detailsHtml}</div>
      `;
      list.appendChild(orderBox);
    });
  }

  document.getElementById('table-detail-total').textContent = `${total.toFixed(2)} TL`;
  document.getElementById('table-detail-modal').style.display = 'flex';
}

function setupModals() {
  document.getElementById('btn-close-table-modal').addEventListener('click', () => {
    document.getElementById('table-detail-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-table-modal').addEventListener('click', () => {
    document.getElementById('table-detail-modal').style.display = 'none';
  });

  document.getElementById('btn-collect-table-payment').addEventListener('click', collectPayment);
}

async function collectPayment() {
  if (!activeTable || activeTableOrders.length === 0) return;
  const pm = document.getElementById('table-payment-method').value;

  if (!confirm(`${activeTable.table_number} ödemesini tahsil etmek istiyor musunuz?`)) return;

  try {
    // Process all orders as completed/paid
    for (const order of activeTableOrders) {
      await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'completed',
          payment_method: pm,
          updated_by: 'Garson POS'
        })
      });
    }

    alert("Masa hesabı başarıyla kapatıldı.");
    document.getElementById('table-detail-modal').style.display = 'none';
    loadRestaurantData();
  } catch (err) {
    console.error(err);
  }
}

function renderReadyService() {
  const grid = document.getElementById('staff-restaurant-ready-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Get orders that are marked 'ready' (prepared by kitchen)
  const readyOrders = restRequests.filter(r => r.status === 'ready');
  if (readyOrders.length === 0) {
    grid.innerHTML = '<div class="text-muted text-center small">Servis edilmeyi bekleyen ürün bulunmuyor.</div>';
    return;
  }

  readyOrders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '12px';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${order.target_identifier}</strong>
        <span class="badge badge-warning">Mutfakta Hazır</span>
      </div>
      <div class="small" style="margin-top: 6px; margin-bottom: 8px;">${order.details}</div>
      <button class="btn btn-success btn-xs btn-block" onclick="completeDelivery('${order.id}')">Servis Edildi (Masaya Teslim)</button>
    `;
    grid.appendChild(card);
  });
}

window.completeDelivery = async function(id) {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'delivered', updated_by: 'Garson POS' })
    });
    if (res.ok) {
      loadRestaurantData();
    }
  } catch (err) {
    console.error(err);
  }
};

function setupCategoryFilters() {
  const cats = ['all', 'food', 'drink', 'minibar'];
  cats.forEach(cat => {
    const btn = document.getElementById(`btn-cat-${cat}`);
    if (btn) {
      btn.addEventListener('click', () => {
        cats.forEach(c => document.getElementById(`btn-cat-${c}`).classList.remove('active-cat-btn'));
        btn.classList.add('active-cat-btn');
        activeCategory = cat;
        renderMenuItems();
      });
    }
  });
}

function renderMenuItems() {
  const grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = restCatalog;
  if (activeCategory !== 'all') {
    filtered = restCatalog.filter(item => item.category === activeCategory);
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pos-product-tile';
    card.innerHTML = `
      <div class="pos-product-name">${item.name}</div>
      <div class="pos-product-price">${item.price} TL</div>
    `;
    card.addEventListener('click', () => addToCart(item));
    grid.appendChild(card);
  });
}

function addToCart(item) {
  const existing = restCart.find(c => c.id === item.id);
  if (existing) {
    existing.quantity++;
  } else {
    restCart.push({ ...item, quantity: 1 });
  }
  renderCart();
}

function renderCart() {
  const card = document.getElementById('staff-restaurant-cart-card');
  const list = document.getElementById('staff-restaurant-cart-items-list');
  if (!card || !list) return;

  if (restCart.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  list.innerHTML = '';

  let total = 0;

  restCart.forEach(item => {
    const price = item.price * item.quantity;
    total += price;
    const row = document.createElement('div');
    row.className = 'd-flex justify-content-between align-items-center';
    row.innerHTML = `
      <span>${item.name} (x${item.quantity})</span>
      <div class="d-flex align-items-center" style="gap: 8px;">
        <span>${price} TL</span>
        <button class="btn btn-danger btn-xs" style="padding: 2px 6px;" onclick="removeFromCart('${item.id}')">&times;</button>
      </div>
    `;
    list.appendChild(row);
  });

  const submitBtn = document.getElementById('btn-submit-cart');
  if (submitBtn) {
    submitBtn.textContent = `Siparişi Gönder - ${total.toFixed(2)} TL`;
  }
}

window.removeFromCart = function(id) {
  restCart = restCart.filter(item => item.id !== id);
  renderCart();
};

function populateOrderTargetDropdown() {
  const select = document.getElementById('staff-restaurant-order-target');
  if (!select) return;
  select.innerHTML = '';

  // Options: Masalar
  const tablesGroup = document.createElement('optgroup');
  tablesGroup.label = 'Restoran Masaları';
  restTables.forEach(t => {
    const opt = document.createElement('option');
    opt.value = `Table-${t.table_number}`;
    opt.textContent = `${t.table_number} (${t.section || 'Salon'})`;
    tablesGroup.appendChild(opt);
  });
  select.appendChild(tablesGroup);
}

function setupActions() {
  const btnLogout = document.getElementById('btn-staff-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (window.aeonLogout) window.aeonLogout();
    });
  }

  const btnSubmitCart = document.getElementById('btn-submit-cart');
  if (btnSubmitCart) {
    btnSubmitCart.addEventListener('click', submitCartOrder);
  }
}

async function submitCartOrder() {
  const target = document.getElementById('staff-restaurant-order-target').value;
  if (!target || restCart.length === 0) return;

  const details = restCart.map(item => ({
    itemId: item.id,
    quantity: item.quantity,
    name: item.name
  }));

  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: target,
        details: details,
        department: 'Kitchen',
        created_by: 'Garson POS'
      })
    });

    if (res.ok) {
      alert("Sipariş mutfağa gönderildi.");
      restCart = [];
      renderCart();
      loadRestaurantData();
      
      // Go back to Tables tab
      document.getElementById('nav-restaurant-tab-tables').click();
    }
  } catch (err) {
    console.error(err);
  }
}
