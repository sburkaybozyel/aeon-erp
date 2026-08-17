import { state, logEvent, registerLoader } from './state.js';

export function setupDiningModule() {
  const btnSubmitPosOrder = document.getElementById('btn-submit-pos-order');
  const formBlindAudit = document.getElementById('form-blind-audit');
  const formKitchenBlindAudit = document.getElementById('form-kitchen-blind-audit');
  
  if (btnSubmitPosOrder) {
    btnSubmitPosOrder.addEventListener('click', async () => {
      const posTarget = document.getElementById('pos-target').value;
      const paymentMethod = document.getElementById('pos-payment').value;
      
      if (!posTarget) {
        alert("Lütfen bir masa seçin.");
        return;
      }
      
      if (desktopPosCart.length === 0) {
        alert("Lütfen en az bir ürün seçin.");
        return;
      }
      
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order',
            target_identifier: posTarget,
            details: desktopPosCart,
            payment_method: paymentMethod,
            created_by: getActiveStaffLabel()
          })
        });
        if (res.ok) {
          const result = await res.json();
          logEvent('event', `POS: Sipariş girildi: <strong>${posTarget}</strong> - Tutar: ${result.totalAmount} TL - Ödeme: ${paymentMethod}`);
          if (state.featureFlags.MODULE_PRINTER) {
            alert(`[Yazıcı Çıktısı] Sipariş Fişi Gönderildi!\nHedef: ${posTarget}\nTutar: ${result.totalAmount} TL`);
          }
          
          desktopPosCart = [];
          window.renderDesktopCartPreview();
          
          document.querySelectorAll('[id^="desktop-qty-"]').forEach(span => {
            span.textContent = '0';
          });
          
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (formBlindAudit) {
    formBlindAudit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        staffId: document.getElementById('audit-staff').value,
        inventoryId: document.getElementById('audit-item').value,
        physicalAmount: parseFloat(document.getElementById('audit-amount').value)
      };

      try {
        const res = await fetch(`/api/inventory/audit?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          
          const display = document.getElementById('audit-result-display');
          if (display) {
            display.style.display = 'block';
            const varColor = result.variance === 0 ? 'text-success' : 'text-danger';
            display.innerHTML = `
              <h4>Kör Sayım Sonucu</h4>
              <p>Personel: <strong>${data.staffId}</strong></p>
              <p>Beklenen (Teorik): <strong>${result.expectedAmount}</strong></p>
              <p>Fiziksel Girilen: <strong>${result.physicalAmount}</strong></p>
              <p>Sapma Farkı: <strong class="${varColor}">${result.variance > 0 ? '+' : ''}${result.variance}</strong></p>
            `;
          }

          logEvent('event', `Kör Sayım Yapıldı: ${data.inventoryId} sapma farkı: ${result.variance}`);
          formBlindAudit.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (formKitchenBlindAudit) {
    formKitchenBlindAudit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        staffId: document.getElementById('audit-staff-kitchen').value,
        inventoryId: document.getElementById('audit-item-kitchen').value,
        physicalAmount: parseFloat(document.getElementById('audit-amount-kitchen').value)
      };

      try {
        const res = await fetch(`/api/inventory/audit?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          
          const display = document.getElementById('audit-result-display-kitchen');
          if (display) {
            display.style.display = 'block';
            const varColor = result.variance === 0 ? 'text-success' : 'text-danger';
            display.innerHTML = `
              <h4>Kör Sayım Sonucu</h4>
              <p>Personel: <strong>${data.staffId}</strong></p>
              <p>Beklenen (Teorik): <strong>${result.expectedAmount}</strong></p>
              <p>Fiziksel Girilen: <strong>${result.physicalAmount}</strong></p>
              <p>Sapma Farkı: <strong class="${varColor}">${result.variance > 0 ? '+' : ''}${result.variance}</strong></p>
            `;
          }

          logEvent('event', `Mutfak Kör Sayım Yapıldı: ${data.inventoryId} sapma farkı: ${result.variance}`);
          formKitchenBlindAudit.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global helper functions to window for KDS updates & calculations
  const formRecipeManager = document.getElementById('form-recipe-manager');
  if (formRecipeManager) {
    formRecipeManager.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        catalog_item_id: document.getElementById('recipe-catalog-item').value,
        inventory_id: document.getElementById('recipe-inventory-item').value,
        amount_needed: document.getElementById('recipe-amount').value
      };
      try {
        const res = await fetch(`/api/recipes?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          logEvent('event', 'Yeni reçete eklendi.');
          formRecipeManager.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const formPurchaseRequest = document.getElementById('form-purchase-request');
  if (formPurchaseRequest) {
    formPurchaseRequest.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        item_name: document.getElementById('pr-item-name').value,
        quantity: document.getElementById('pr-quantity').value,
        requested_by: getActiveStaffLabel()
      };
      try {
        const res = await fetch(`/api/purchase_requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          logEvent('event', 'Satın Alma Talebi oluşturuldu.');
          formPurchaseRequest.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const formWastageLog = document.getElementById('form-wastage-log');
  if (formWastageLog) {
    formWastageLog.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        inventory_id: document.getElementById('waste-inventory-item').value,
        quantity_change: -Math.abs(parseFloat(document.getElementById('waste-amount').value))
      };
      try {
        const res = await fetch(`/api/inventory/update?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          logEvent('alert', `Zayiat girildi. Stoktan düşüldü.`);
          formWastageLog.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const formPrepTask = document.getElementById('form-prep-task');
  if (formPrepTask) {
    formPrepTask.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        type: 'prep_task',
        department: 'Kitchen',
        target_identifier: 'Mutfak',
        details: document.getElementById('prep-task-desc').value,
        created_by: getActiveStaffLabel()
      };
      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          logEvent('event', `Yeni hazırlık görevi eklendi.`);
          formPrepTask.reset();
          loadDiningData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  window.updateKdsStatus = async (requestId, status) => {
    try {
      const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, completed_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `KDS: Sipariş durumu güncellendi: <strong>${status}</strong> (#${requestId})`);
        loadDiningData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.recalculatePosTotal = () => {
    let total = 0;
    const inputs = document.querySelectorAll('.pos-qty-input');
    inputs.forEach(input => {
      const price = parseFloat(input.getAttribute('data-price')) || 0;
      const qty = parseInt(input.value) || 0;
      total += price * qty;
    });
    const totalEl = document.getElementById('pos-total-amount');
    if (totalEl) {
      totalEl.textContent = `${total.toFixed(2)} TL`;
    }
  };

  registerLoader('loadDiningData', loadDiningData);
  window.__aeonLoadDiningData = loadDiningData;
}

function getActiveStaffLabel() {
  const staff = state.activeStaff;
  if (!staff) return null;
  return `${staff.name} (${staff.role})`;
}

export async function loadDiningData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    
    const [tablesRes, reqsRes, invRes, recRes, prsRes] = await Promise.all([
      fetch(`/api/tables${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/recipes${tenantParam}`),
      fetch(`/api/purchase_requests${tenantParam}`)
    ]);

    const tables = tablesRes.ok ? await tablesRes.json() : [];
    const requests = reqsRes.ok ? await reqsRes.json() : [];
    const inventory = invRes.ok ? await invRes.json() : [];
    const recipes = recRes.ok ? await recRes.json() : [];
    const prs = prsRes.ok ? await prsRes.json() : [];

    renderTablesGrid(tables);
    renderPosTargetSelect(tables);
    window.renderPosMenuGrid(state.availableCatalog || []);
    renderKdsOrders(requests);
    renderPrepTasks(requests);
    renderInventoryTable(inventory);
    renderAuditInventorySelect(inventory);
    renderRecipeManager(recipes);
    renderPurchaseRequests(prs);
    populateSelects();
  } catch (err) {
    console.error(err);
  }
}

function renderTablesGrid(tables) {
  const container = document.getElementById('table-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  tables.forEach(t => {
    const card = document.createElement('div');
    card.className = 'aeon-card';
    
    let statusText = 'Boş';
    if (t.status === 'occupied') statusText = 'Dolu / Hizmet Alıyor';
    if (t.status === 'requested_service') statusText = 'Garson İstiyor';
    if (t.status === 'requested_bill') statusText = 'Hesap İstiyor';
    
    card.innerHTML = `
      <div class="aeon-card-content" style="align-items: center; text-align: center;">
        <h4 class="aeon-card-title" style="font-size: 24px;">${t.table_number}</h4>
        <p class="aeon-card-subtitle">${t.section}</p>
        <span class="aeon-badge ${t.status}" style="margin-top: 8px;">${statusText}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderPosTargetSelect(tables) {
  const select = document.getElementById('pos-target');
  if (!select) return;
  select.innerHTML = '';
  tables.forEach(t => {
    const opt = document.createElement('option');
    opt.value = `Table-${t.table_number}`;
    opt.textContent = `${t.table_number} (${t.section})`;
    select.appendChild(opt);
  });
}

let desktopPosCart = [];
window.desktopActivePosCategory = 'all';

window.filterDesktopPosCategory = (cat) => {
  window.desktopActivePosCategory = cat;
  const categories = ['all', 'food', 'drink', 'minibar'];
  categories.forEach(c => {
    const btn = document.getElementById(`btn-desktop-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.classList.add('active-cat-btn');
      } else {
        btn.classList.remove('active-cat-btn');
      }
    }
  });
  window.renderPosMenuGrid(state.availableCatalog);
};

window.renderPosMenuGrid = (catalog) => {
  const grid = document.getElementById('desktop-pos-menu-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const activeCat = window.desktopActivePosCategory || 'all';
  const diningItems = catalog.filter(item => {
    if (item.module_type !== 'dining') return false;
    if (activeCat === 'all') return true;
    return item.category === activeCat;
  });

  diningItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pos-product-card';
    card.setAttribute('onclick', `window.increaseDesktopCartQty('${item.id}')`);
    
    card.innerHTML = `
      <div class="pos-product-name">${item.name}</div>
      <div><span class="pos-product-price">${item.price} TL</span></div>
    `;
    grid.appendChild(card);
  });
};

window.increaseDesktopCartQty = (itemId) => {
  const catalogItem = state.availableCatalog?.find(c => c.id === itemId);
  if (!catalogItem) return;

  const existing = desktopPosCart.find(c => c.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    desktopPosCart.push({
      itemId,
      name: catalogItem.name,
      quantity: 1,
      price: catalogItem.price
    });
  }

  const qtySpan = document.getElementById(`desktop-qty-${itemId}`);
  if (qtySpan) {
    qtySpan.textContent = (existing ? existing.quantity : 1).toString();
  }

  window.renderDesktopCartPreview();
};

window.decreaseDesktopCartQty = (itemId) => {
  const existing = desktopPosCart.find(c => c.itemId === itemId);
  if (!existing) return;

  existing.quantity -= 1;
  if (existing.quantity <= 0) {
    desktopPosCart = desktopPosCart.filter(c => c.itemId !== itemId);
  }

  const qtySpan = document.getElementById(`desktop-qty-${itemId}`);
  if (qtySpan) {
    qtySpan.textContent = (existing.quantity > 0 ? existing.quantity : 0).toString();
  }

  window.renderDesktopCartPreview();
};

window.renderDesktopCartPreview = () => {
  const list = document.getElementById('desktop-pos-cart-list');
  const totalSpan = document.getElementById('pos-total-amount');
  if (!list || !totalSpan) return;

  list.innerHTML = '';
  if (desktopPosCart.length === 0) {
    list.innerHTML = '<div class="text-muted small text-center" style="padding: 20px;">Adisyon boş.</div>';
    totalSpan.textContent = '0.00 TL';
    return;
  }

  let total = 0;
  desktopPosCart.forEach(item => {
    total += item.price * item.quantity;
    const row = document.createElement('div');
    row.className = 'pos-ticket-item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600; font-size:14px;">${item.name}</div>
        <div style="font-size:12px; color:var(--color-text-muted);">${item.price} TL</div>
      </div>
      <div class="pos-ticket-item-qty">
        <button onclick="window.decreaseDesktopCartQty('${item.itemId}')">-</button>
        <span style="width:24px; text-align:center; font-weight:700;">${item.quantity}</span>
        <button onclick="window.increaseDesktopCartQty('${item.itemId}')">+</button>
      </div>
    `;
    list.appendChild(row);
  });

  totalSpan.textContent = `${total.toFixed(2)} TL`;
};

window.removeDesktopCartItemDirect = (itemId) => {
  desktopPosCart = desktopPosCart.filter(c => c.itemId !== itemId);
  const qtySpan = document.getElementById(`desktop-qty-${itemId}`);
  if (qtySpan) qtySpan.textContent = '0';
  window.renderDesktopCartPreview();
};

function renderKdsOrders(requests) {
  const container = document.getElementById('kds-orders-container');
  if (!container) return;
  container.innerHTML = '';
  
  const orders = requests.filter(r => r.type === 'order' && r.status !== 'completed' && r.status !== 'delivered');
  
  if (orders.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center padding-md">Kuyrukta sipariş bulunmuyor.</div>`;
    return;
  }
  
  orders.forEach(order => {
    const card = document.createElement('div');
    card.className = `aeon-card status-${order.status}`;
    
    let itemsListHtml = '';
    const items = JSON.parse(order.details);
    if (Array.isArray(items)) {
      items.forEach(item => {
        itemsListHtml += `<p class="aeon-card-text">• ${item.name} x ${item.quantity}</p>`;
      });
    }
    
    let actionBtnHtml = '';
    if (order.status === 'pending') {
      actionBtnHtml = `<button class="btn btn-accent btn-xs" onclick="updateKdsStatus('${order.id}', 'preparing')">Hazırlanıyor</button>`;
    } else if (order.status === 'preparing') {
      actionBtnHtml = `<button class="btn btn-success btn-xs" onclick="updateKdsStatus('${order.id}', 'ready')">Hazır</button>`;
    } else if (order.status === 'ready') {
      actionBtnHtml = `<button class="btn btn-primary btn-xs" onclick="updateKdsStatus('${order.id}', 'completed')">Teslim Edildi</button>`;
    }
    
    card.innerHTML = `
      <div class="aeon-card-content">
        <div class="aeon-card-header">
          <h4 class="aeon-card-title">${order.target_identifier.startsWith('Room-') ? '🛏️ ODA SERVİSİ - ' + order.target_identifier : '🍽️ ' + order.target_identifier}</h4>
          <span class="aeon-card-subtitle">${new Date(order.created_at).toLocaleTimeString()}</span>
        </div>
        <div class="aeon-card-body" style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: var(--radius-sm);">
          ${itemsListHtml}
        </div>
        <p class="aeon-card-subtitle">Oluşturan: ${order.created_by || '-'}${order.completed_by ? ` | Tamamlayan: ${order.completed_by}` : ''}</p>
        <div class="aeon-card-footer">
          ${actionBtnHtml}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderInventoryTable(inventory) {
  const body = document.getElementById('bar-inventory-body');
  const kitchenBody = document.getElementById('kitchen-inventory-body');
  if (body) body.innerHTML = '';
  if (kitchenBody) kitchenBody.innerHTML = '';
  
  inventory.forEach(inv => {
    const el = document.createElement('div');
    el.className = 'pos-cat-card glass text-center';
    el.style.padding = '15px';
    
    // Check if below par level
    const isLowStock = inv.stock < inv.par_level;
    const stockColor = isLowStock ? 'color: var(--danger);' : 'color: var(--primary);';
    
    el.innerHTML = `
      <div class="text-md" style="font-weight: 600; margin-bottom: 5px;">${inv.name}</div>
      <div class="text-xs text-muted margin-bottom-sm"><span class="badge">${inv.module_type}</span></div>
      <div class="text-lg" style="font-weight: 700; ${stockColor}">${inv.stock.toFixed(1)} <span class="text-sm text-muted">${inv.unit}</span></div>
      <div class="text-xs text-muted margin-top-sm">Par: ${inv.par_level} ${inv.unit}</div>
    `;
    if (inv.module_type === 'kitchen' || inv.module_type === 'food') {
      if (kitchenBody) kitchenBody.appendChild(el);
    } else {
      if (body) body.appendChild(el);
    }
  });
}

function renderAuditInventorySelect(inventory) {
  const select = document.getElementById('audit-item');
  const kitchenSelect = document.getElementById('audit-item-kitchen');
  if (select) select.innerHTML = '';
  if (kitchenSelect) kitchenSelect.innerHTML = '';
  
  inventory.forEach(inv => {
    const opt = document.createElement('option');
    opt.value = inv.id;
    opt.textContent = `${inv.name} (${inv.unit})`;
    if (inv.module_type === 'kitchen' || inv.module_type === 'food') {
      if (kitchenSelect) kitchenSelect.appendChild(opt);
    } else {
      if (select) select.appendChild(opt);
    }
  });
}

window.deleteRecipe = async (catalogId, inventoryId) => {
  if (!confirm('Emin misiniz?')) return;
  try {
    const res = await fetch(`/api/recipes/${catalogId}/${inventoryId}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('event', 'Reçete silindi.');
      loadDiningData();
    }
  } catch (err) {
    console.error(err);
  }
};

window.updatePurchaseRequestStatus = async (id, status) => {
  try {
    const res = await fetch(`/api/purchase_requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    if (res.ok) {
      logEvent('event', `Satın Alma Talebi güncellendi: ${status}`);
      loadDiningData();
    }
  } catch (err) {
    console.error(err);
  }
};

window.completePrepTask = async (id) => {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, status: 'Completed', completed_by: getActiveStaffLabel() })
    });
    if (res.ok) {
      logEvent('event', `Hazırlık görevi tamamlandı.`);
      loadDiningData();
    }
  } catch (err) {
    console.error(err);
  }
};

function populateSelects() {
  const catSelect = document.getElementById('recipe-catalog-item');
  if (catSelect) {
    catSelect.innerHTML = '';
    state.availableCatalog.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  }

  const invSelect = document.getElementById('recipe-inventory-item');
  const wasteSelect = document.getElementById('waste-inventory-item');
  if (invSelect) {
    const allInv = [];
    document.querySelectorAll('#audit-item option, #audit-item-kitchen option').forEach(o => {
      allInv.push({ id: o.value, text: o.textContent });
    });
    
    // Deduplicate and populate
    const uniqueInv = [...new Map(allInv.map(item => [item.id, item])).values()];
    
    if (invSelect) {
      invSelect.innerHTML = '';
      uniqueInv.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = i.text;
        invSelect.appendChild(opt);
      });
    }
    if (wasteSelect) {
      wasteSelect.innerHTML = '';
      uniqueInv.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = i.text;
        wasteSelect.appendChild(opt);
      });
    }
  }
}

function renderRecipeManager(recipes) {
  const body = document.getElementById('recipe-list-body');
  if (!body) return;
  body.innerHTML = '';
  recipes.forEach(r => {
    // Find catalog name
    const cat = state.availableCatalog.find(c => c.id === r.catalog_item_id);
    const catName = cat ? cat.name : r.catalog_item_id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${catName}</td>
      <td>${r.inventory_name}</td>
      <td>${r.amount_needed} ${r.unit}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteRecipe('${r.catalog_item_id}', '${r.inventory_id}')">Sil</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function renderPurchaseRequests(prs) {
  const list = document.getElementById('purchase-requests-list');
  if (!list) return;
  list.innerHTML = '';
  prs.forEach(pr => {
    const li = document.createElement('li');
    li.className = 'kds-card glass';
    li.innerHTML = `
      <div class="flex-between">
        <strong>${pr.item_name}</strong>
        <span class="badge">${pr.status}</span>
      </div>
      <div class="text-xs text-muted margin-top-sm">Miktar: ${pr.quantity} | Talep: ${pr.requested_by}</div>
      <div class="kds-actions margin-top-sm">
        ${pr.status === 'Pending' ? `<button class="btn btn-sm btn-success" onclick="updatePurchaseRequestStatus('${pr.id}', 'Ordered')">Sipariş Verildi</button>` : ''}
        ${pr.status === 'Ordered' ? `<button class="btn btn-sm btn-primary" onclick="updatePurchaseRequestStatus('${pr.id}', 'Received')">Teslim Alındı</button>` : ''}
      </div>
    `;
    list.appendChild(li);
  });
}

function renderPrepTasks(requests) {
  const list = document.getElementById('prep-tasks-list');
  if (!list) return;
  list.innerHTML = '';
  
  const prepTasks = requests.filter(r => r.type === 'prep_task' && r.status !== 'Completed');
  
  prepTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'kds-card glass';
    li.innerHTML = `
      <div class="flex-between">
        <span>${task.details}</span>
        <button class="btn btn-sm btn-success" onclick="completePrepTask('${task.id}')"><i class="fa-solid fa-check"></i></button>
      </div>
      <div class="text-xs text-muted margin-top-sm">Ekleyen: ${task.created_by}</div>
    `;
    list.appendChild(li);
  });
}
