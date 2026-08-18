
// ==========================================
// UNIFIED ADMIN DASHBOARD & SIMULATOR ENGINE
// ==========================================

import { state, logEvent, registerLoader } from './state.js';

// Guest-facing endpoints (service requests, free-text notes) accept unauthenticated
// input with no server-side sanitization for non-order request types, and that text
// ends up here via requests/audit-logs. Every such field must be escaped before being
// interpolated into innerHTML — never render req.details / log.details / staff-entered
// guest_name/phone raw.
function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

export function setupMobileAdminDashboard() {
  registerLoader('loadAdminDashboardData', loadAdminDashboardData);
  registerLoader('loadFinanceData', loadFinanceData);
}

export async function loadMobileAdminDashboardData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, tablesRes, reqsRes, invRes, auditsRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/tables${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/inventory/audits${tenantParam}`)
    ]);

    const rooms = roomsRes.ok ? await roomsRes.json() : [];
    const tables = tablesRes.ok ? await tablesRes.json() : [];
    const requests = reqsRes.ok ? await reqsRes.json() : [];
    const inventory = invRes.ok ? await invRes.json() : [];
    const audits = auditsRes.ok ? await auditsRes.json() : [];

    renderKpis(rooms, tables, requests, inventory);
    renderStockWarnings(inventory);
    renderDesktopVarianceReports(audits);
    renderDesktopActiveGuests(rooms);
    renderActiveRequestsTable(requests);

    // Render management panel items
    renderInventoryManagementList(inventory);
    renderCatalogManagementList(state.availableCatalog);
    populateRecipeSelectors(state.availableCatalog, inventory);
  } catch (err) {
    console.error("Error loading Admin Dashboard data:", err);
  }
}

function renderKpis(rooms, tables, requests, inventory) {
  // 1. Active Service & Guest Requests
  const activeRequests = requests.filter(r => 
    r.status !== 'completed' && 
    ['waiter_call', 'bill_call', 'towel_request', 'water_request', 'cleaning_request', 'linen_request', 'amenity_request', 'maintenance_request', 'transport_request', 'room_service_call', 'room_dnd_change', 'order'].includes(r.type)
  ).length;

  const kpiActiveRequests = document.getElementById('kpi-active-requests');
  if (kpiActiveRequests) {
    kpiActiveRequests.textContent = activeRequests;
    if (activeRequests > 0) {
      kpiActiveRequests.style.color = 'var(--color-warning)';
    } else {
      kpiActiveRequests.style.color = 'var(--color-success)';
    }
  }

  // 2. Hotel Occupancy Rate
  const totalRooms = rooms.length || 1;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
  
  const kpiOccupancy = document.getElementById('kpi-occupancy-rate');
  if (kpiOccupancy) {
    kpiOccupancy.textContent = `${occupancyRate}% (${occupiedRooms}/${totalRooms})`;
  }

  // 3. Low Stock Items count
  let lowStockCount = 0;
  inventory.forEach(item => {
    const minLevel = item.par_level || 10;
    if (item.stock < minLevel) {
      lowStockCount++;
    }
  });
  
  const kpiLowStocks = document.getElementById('kpi-low-stocks');
  if (kpiLowStocks) {
    kpiLowStocks.textContent = lowStockCount;
    if (lowStockCount > 0) {
      kpiLowStocks.style.color = 'var(--color-danger)';
    } else {
      kpiLowStocks.style.color = 'var(--color-success)';
    }
  }

  // 4. Pending Tasks
  const pendingTasks = requests.filter(r => r.type === 'staff_task' && r.status !== 'completed').length;
  const kpiTasks = document.getElementById('kpi-pending-tasks');
  if (kpiTasks) {
    kpiTasks.textContent = pendingTasks;
    if (pendingTasks > 0) {
      kpiTasks.style.color = 'var(--color-warning)';
    } else {
      kpiTasks.style.color = 'var(--color-success)';
    }
  }
}

function renderDesktopStockWarnings(inventory) {
  const tbody = document.getElementById('admin-stock-warnings-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const parLevels = {
    'inv_cin': 15,
    'inv_viski': 15,
    'inv_tonik': 30,
    'inv_kahve': 5,
    'inv_sut': 20,
    'inv_limon': 50
  };

  let count = 0;
  inventory.forEach(item => {
    const minLevel = item.par_level || 10;
    if (item.stock < minLevel) {
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="text-danger bold">${item.stock} ${item.unit}</span></td>
        <td>${minLevel} ${item.unit}</td>
        <td><span class="room-badge dirty_vacant" style="font-size:9px; padding:2px 6px;">KRİTİK STOK</span></td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (count === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted small padding-md">Kritik stok seviyesinde hammadde bulunmamaktadır.</td></tr>`;
  }
}

function renderDesktopVarianceReports(audits) {
  const tbody = document.getElementById('admin-variances-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (audits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted small padding-md">Kör sayım denetim kaydı bulunmuyor.</td></tr>`;
    return;
  }

  audits.forEach(audit => {
    const tr = document.createElement('tr');
    const colorClass = audit.variance < 0 ? 'text-danger bold' : (audit.variance > 0 ? 'text-success bold' : 'text-muted');
    const sign = audit.variance > 0 ? '+' : '';
    
    tr.innerHTML = `
      <td><span class="text-xs text-muted">${new Date(audit.recorded_at).toLocaleDateString()}</span></td>
      <td><strong>${audit.inventory_name}</strong></td>
      <td>${audit.expected_amount} ${audit.unit}</td>
      <td>${audit.physical_amount} ${audit.unit}</td>
      <td><span class="${colorClass}">${sign}${audit.variance} ${audit.unit}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDesktopActiveGuests(rooms) {
  const tbody = document.getElementById('admin-guests-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeGuests = rooms.filter(r => r.status === 'occupied');

  if (activeGuests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted small padding-md">Şu an dolu oda bulunmuyor.</td></tr>`;
    return;
  }

  activeGuests.forEach(room => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Oda ${room.room_number}</strong></td>
      <td><span class="room-badge occupied" style="font-size:10px; font-family: monospace; padding:2px 8px;">Dolu</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderActiveRequestsTable(requests) {
  const tbody = document.getElementById('admin-active-requests-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const active = requests.filter(r => 
    r.status !== 'completed' && 
    ['waiter_call', 'bill_call', 'towel_request', 'water_request', 'cleaning_request', 'linen_request', 'amenity_request', 'maintenance_request', 'transport_request', 'room_service_call', 'room_dnd_change', 'order'].includes(r.type)
  );

  if (active.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted small padding-md">Aktif hizmet talebi bulunmuyor.</td></tr>`;
    return;
  }

  active.forEach(req => {
    const tr = document.createElement('tr');
    
    // Request details formatting
    let detailsText = '';
    if (req.type === 'order') {
      try {
        const items = JSON.parse(req.details || '[]');
        detailsText = items.map(it => `${it.quantity}x ${it.name || it.itemId}`).join(', ');
      } catch(e) {
        detailsText = req.details;
      }
    } else {
      detailsText = req.details || '';
    }

    // Type labels
    let typeLabel = '';
    if (req.type === 'waiter_call') typeLabel = '<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">Garson Çağrısı</span>';
    else if (req.type === 'bill_call') typeLabel = '<span class="room-badge occupied" style="background-color:rgba(0,199,255,0.15); color:#00c7ff; font-size:9px; padding:2px 6px;">Hesap Talebi</span>';
    else if (req.type === 'towel_request') typeLabel = '<span class="room-badge clean_vacant" style="font-size:9px; padding:2px 6px;">Temiz Havlu</span>';
    else if (req.type === 'water_request') typeLabel = '<span class="room-badge clean_vacant" style="font-size:9px; padding:2px 6px;">Su Talebi</span>';
    else if (req.type === 'cleaning_request') typeLabel = '<span class="room-badge clean_vacant" style="font-size:9px; padding:2px 6px;">Oda Temizliği</span>';
    else if (req.type === 'linen_request') typeLabel = '<span class="room-badge clean_vacant" style="font-size:9px; padding:2px 6px;">Çarşaf / Yastık</span>';
    else if (req.type === 'amenity_request') typeLabel = '<span class="room-badge clean_vacant" style="font-size:9px; padding:2px 6px;">Banyo Seti</span>';
    else if (req.type === 'maintenance_request') typeLabel = '<span class="room-badge maintenance" style="font-size:9px; padding:2px 6px;">Teknik Servis</span>';
    else if (req.type === 'transport_request') typeLabel = '<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">Transfer</span>';
    else if (req.type === 'room_service_call') typeLabel = '<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">Oda Servisi</span>';
    else if (req.type === 'room_dnd_change') typeLabel = '<span class="room-badge maintenance" style="font-size:9px; padding:2px 6px;">Rahatsız Etmeyin</span>';
    else if (req.type === 'order') typeLabel = '<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">F&B Sipariş</span>';
    else typeLabel = `<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">${req.type}</span>`;

    const timeString = new Date(req.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
      <td><strong>${req.target_identifier}</strong></td>
      <td><span class="text-sm">${detailsText}</span></td>
      <td>${typeLabel}</td>
      <td><span class="text-xs text-muted">${timeString}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Inventory CRUD List
function renderInventoryManagementList(inventory) {
  const tbody = document.getElementById('mgmt-inventory-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  inventory.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong> <span class="text-muted small">(${item.module_type === 'bar' ? 'Bar' : 'Mutfak'})</span></td>
      <td>${item.unit}</td>
      <td>${item.stock} / ${item.par_level}</td>
      <td>${item.unit_cost.toFixed(2)} TL</td>
      <td>
        <button class="btn btn-danger btn-xs" onclick="deleteInventoryItem('${item.id}')">
          <i class="fa-solid fa-trash"></i> Sil
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Catalog CRUD List
function renderCatalogManagementList(catalog) {
  const tbody = document.getElementById('mgmt-catalog-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  catalog.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.price.toFixed(2)} TL</td>
      <td><span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">${item.category.toUpperCase()}</span></td>
      <td>
        <button class="btn btn-danger btn-xs" onclick="deleteCatalogItem('${item.id}')">
          <i class="fa-solid fa-trash"></i> Sil
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Populate Dropdowns in Recipe Builder
function populateRecipeSelectors(catalog, inventory) {
  const catSelect = document.getElementById('recipe-cat-select');
  const invSelect = document.getElementById('recipe-inv-select');
  if (!catSelect || !invSelect) return;

  // Preserve selected value if any
  const prevCatVal = catSelect.value;
  catSelect.innerHTML = '<option value="">Menü Öğesi Seçin...</option>';
  catalog.filter(c => c.category === 'food' || c.category === 'drink').forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.price} TL)`;
    catSelect.appendChild(opt);
  });
  if (prevCatVal) catSelect.value = prevCatVal;

  invSelect.innerHTML = '<option value="">Malzeme Seçin...</option>';
  
  const receiptInvSelect = document.getElementById('receipt-inv-select');
  if (receiptInvSelect) receiptInvSelect.innerHTML = '<option value="">Malzeme Seçin...</option>';

  inventory.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.unit})`;
    invSelect.appendChild(opt);
    
    if (receiptInvSelect) {
      const opt2 = document.createElement('option');
      opt2.value = item.id;
      opt2.textContent = `${item.name} (${item.unit}) - ${item.stock} mevcut`;
      receiptInvSelect.appendChild(opt2);
    }
  });
}

// Load and render ingredients for the selected catalog item
window.loadRecipeForSelectedCatalogItem = async () => {
  const catSelect = document.getElementById('recipe-cat-select');
  const tbody = document.getElementById('mgmt-recipe-ingredients-body');
  if (!catSelect || !tbody) return;

  const catalogItemId = catSelect.value;
  if (!catalogItemId) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Lütfen listelemek veya eklemek için sol taraftan bir menü öğesi seçin.</td></tr>';
    return;
  }

  try {
    const res = await fetch('/api/recipes');
    if (res.ok) {
      const allRecipes = await res.json();
      const filtered = allRecipes.filter(r => r.catalog_item_id === catalogItemId);
      
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Bu ürüne ait tanımlı reçete bulunmuyor. Yeni malzeme ekleyebilirsiniz.</td></tr>';
        return;
      }

      filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${r.inventory_name}</strong></td>
          <td>${r.amount_needed}</td>
          <td>${r.unit}</td>
          <td>
            <button class="btn btn-danger btn-xs" onclick="deleteRecipeIngredient('${r.catalog_item_id}', '${r.inventory_id}')">
              <i class="fa-solid fa-trash"></i> Sil
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Deletion Handlers
window.deleteInventoryItem = async (id) => {
  if (confirm("Bu hammaddeyi silmek istediğinize emin misiniz? Reçetelerden de kaldırılacaktır.")) {
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Refresh global catalog cache
        const configRes = await fetch(`/api/catalog/availability`);
        if (configRes.ok) state.availableCatalog = await configRes.json();
        loadAdminDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  }
};

window.deleteCatalogItem = async (id) => {
  if (confirm("Bu menü kartını silmek istediğinize emin misiniz? Reçeteleri de silinecektir.")) {
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const configRes = await fetch(`/api/catalog/availability`);
        if (configRes.ok) state.availableCatalog = await configRes.json();
        loadAdminDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  }
};

window.deleteRecipeIngredient = async (catalogItemId, inventoryId) => {
  if (confirm("Bu reçete kalemini kaldırmak istediğinize emin misiniz?")) {
    try {
      const res = await fetch(`/api/recipes/${catalogItemId}/${inventoryId}`, { method: 'DELETE' });
      if (res.ok) {
        window.loadRecipeForSelectedCatalogItem();
      }
    } catch (err) {
      console.error(err);
    }
  }
};

// Form listeners initialization
document.addEventListener('DOMContentLoaded', () => {
  // Add Inventory Item Form
  const formAddInv = document.getElementById('form-add-inventory');
  if (formAddInv) {
    formAddInv.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('inv-name').value;
      const unit = document.getElementById('inv-unit').value;
      const stock = parseFloat(document.getElementById('inv-stock').value) || 0;
      const par_level = parseFloat(document.getElementById('inv-par').value) || 0;
      const unit_cost = parseFloat(document.getElementById('inv-cost').value) || 0;
      const module_type = document.getElementById('inv-type').value;

      try {
        const res = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, unit, stock, par_level, unit_cost, module_type })
        });
        if (res.ok) {
          formAddInv.reset();
          loadAdminDashboardData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Add Catalog Item Form
  const formAddCat = document.getElementById('form-add-catalog');
  if (formAddCat) {
    formAddCat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value;
      const price = parseFloat(document.getElementById('cat-price').value) || 0;
      const category = document.getElementById('cat-category').value;
      const module_type = category === 'minibar' || category === 'service' ? 'hotel' : 'dining';

      try {
        const res = await fetch('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, price, category, module_type })
        });
        if (res.ok) {
          formAddCat.reset();
          // Refresh global catalog cache
          const configRes = await fetch(`/api/catalog/availability`);
          if (configRes.ok) state.availableCatalog = await configRes.json();
          loadAdminDashboardData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Add Recipe Ingredient Form
  const formAddRecipe = document.getElementById('form-add-recipe-ingredient');
  if (formAddRecipe) {
    formAddRecipe.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catalog_item_id = document.getElementById('recipe-cat-select').value;
      const inventory_id = document.getElementById('recipe-inv-select').value;
      const amount_needed = parseFloat(document.getElementById('recipe-amount').value);

      if (!catalog_item_id) {
        alert("Lütfen önce üst kısımdan bir menü öğesi seçin!");
        return;
      }

      try {
        const res = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalog_item_id, inventory_id, amount_needed })
        });
        if (res.ok) {
          formAddRecipe.reset();
          window.loadRecipeForSelectedCatalogItem();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
});

export async function loadFinanceData() {
  try {
    const requestsRes = await fetch(`/api/requests`);
    if (requestsRes.ok) {
      const requests = await requestsRes.json();
      renderFinanceDashboard(requests);
    }
  } catch (err) {
    console.error("Error loading Finance data:", err);
  }
}

function renderFinanceDashboard(requests) {
  let diningRev = 0;
  let stayRev = 0;

  requests.forEach(req => {
    // Complete requests or room service charges only
    if (req.status === 'completed' || req.type === 'room_service_charge') {
      if (req.payment_method === 'room_charge' || req.type === 'room_service_charge') {
        stayRev += req.total_amount || 0;
      } else {
        diningRev += req.total_amount || 0;
      }
    }
  });

  const totalRev = diningRev + stayRev;

  // Set top KPIs
  const elTotal = document.getElementById('finance-total-revenue');
  if (elTotal) elTotal.textContent = `${totalRev.toFixed(2)} TL`;

  const elDining = document.getElementById('finance-rev-dining');
  if (elDining) elDining.textContent = `${diningRev.toFixed(2)} TL`;

  const elStay = document.getElementById('finance-rev-stay');
  if (elStay) elStay.textContent = `${stayRev.toFixed(2)} TL`;

  // Render ledger body
  const tbody = document.getElementById('finance-ledger-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Show all requests that generated revenue, or completed requests
  const completed = requests.filter(r => r.status === 'completed' || r.type === 'room_service_charge' || r.type === 'order');
  
  if (completed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted small padding-md">Kayıtlı ciro hareketi bulunmamaktadır.</td></tr>`;
    return;
  }

  completed.forEach(req => {
    const tr = document.createElement('tr');
    
    let detailsText = '';
    if (req.type === 'order') {
      try {
        const items = JSON.parse(req.details || '[]');
        detailsText = items.map(it => `${it.quantity}x ${it.name || it.itemId}`).join(', ');
      } catch(e) {
        detailsText = req.details;
      }
    } else {
      detailsText = req.details || '';
    }

    const timeString = new Date(req.created_at || Date.now()).toLocaleString();
    const payMethod = req.payment_method === 'room_charge' ? 'Oda Hesabı' : (req.payment_method === 'cash' ? 'Nakit' : (req.payment_method === 'card' ? 'Kredi Kartı' : req.payment_method || '-'));

    tr.innerHTML = `
      <td><span class="text-xs text-muted">${timeString}</span></td>
      <td><strong>${req.target_identifier}</strong></td>
      <td><span class="text-sm">${detailsText}</span></td>
      <td><span class="text-xs">${payMethod}</span></td>
      <td><span class="bold text-accent">${(req.total_amount || 0).toFixed(2)} TL</span></td>
      <td><span class="room-badge ${req.status === 'completed' ? 'clean_vacant' : 'dirty_vacant'}" style="font-size:9px; padding:2px 6px;">${req.status === 'completed' ? 'TAMAMLANDI' : req.status.toUpperCase()}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- ADMIN STAFF MANAGEMENT ---
window.loadAdminStaff = async () => {
  const tbody = document.getElementById('mgmt-staff-body');
  if (!tbody) return;
  try {
    const res = await fetch('/api/staff');
    const staffList = await res.json();
    tbody.innerHTML = '';
    if (!staffList || staffList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted small padding-md">Kayıtlı personel yok.</td></tr>';
      return;
    }
    staffList.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.role}</td>
        <td><span class="text-muted">PIN gizli</span></td>
        <td><button class="btn btn-danger btn-xs" onclick="window.deleteAdminStaff('${s.id}')"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
};

window.addAdminStaff = async (e) => {
  e.preventDefault();
  const name = document.getElementById('staff-name').value;
  const pin = document.getElementById('staff-pin').value;
  const role = document.getElementById('staff-role').value;
  if (!name || !pin || !role) return;
  
  try {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin, role })
    });
    if (res.ok) {
      alert("Personel eklendi.");
      document.getElementById('form-add-staff').reset();
      window.loadAdminStaff();
    } else {
      const err = await res.json();
      alert("Hata: " + err.error);
    }
  } catch (err) { console.error(err); }
};
document.getElementById('form-add-staff')?.addEventListener('submit', window.addAdminStaff);

window.deleteAdminStaff = async (id) => {
  if(!confirm("Personeli silmek istediğinize emin misiniz?")) return;
  try {
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
    if(res.ok) window.loadAdminStaff();
  } catch(err) { console.error(err); }
};

// --- ADMIN SPACES MANAGEMENT ---
window.loadAdminSpaces = async () => {
  const tbody = document.getElementById('mgmt-spaces-body');
  if (!tbody) return;
  try {
    const [resRooms, resTables] = await Promise.all([
      fetch('/api/rooms'),
      fetch('/api/tables')
    ]);
    const rooms = await resRooms.json();
    const tables = await resTables.json();
    
    tbody.innerHTML = '';
    
    rooms.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><i class="fa-solid fa-bed text-primary"></i> Oda</td>
        <td>${r.room_number}</td>
        <td>-</td>
        <td><button class="btn btn-danger btn-xs" onclick="window.deleteAdminSpace('rooms', '${r.id}')"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    
    tables.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><i class="fa-solid fa-chair text-primary"></i> Masa</td>
        <td>${t.table_number}</td>
        <td>${t.section}</td>
        <td><button class="btn btn-danger btn-xs" onclick="window.deleteAdminSpace('tables', '${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    
    if (rooms.length === 0 && tables.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted small padding-md">Kayıtlı alan yok.</td></tr>';
    }
  } catch (err) { console.error(err); }
};

window.addAdminRoom = async (e) => {
  e.preventDefault();
  const room_number = document.getElementById('space-room-no').value;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number })
    });
    if(res.ok) {
      alert("Oda eklendi.");
      document.getElementById('form-add-room').reset();
      window.loadAdminSpaces();
    } else {
      const err = await res.json();
      alert("Hata: " + err.error);
    }
  } catch(err) { console.error(err); }
};
document.getElementById('form-add-room')?.addEventListener('submit', window.addAdminRoom);

window.addAdminTable = async (e) => {
  e.preventDefault();
  const tableNumber = document.getElementById('space-table-no').value;
  const section = document.getElementById('space-table-section').value;
  try {
    const res = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, section })
    });
    if(res.ok) {
      alert("Masa eklendi.");
      document.getElementById('form-add-table').reset();
      window.loadAdminSpaces();
    } else {
      const err = await res.json();
      alert("Hata: " + err.error);
    }
  } catch(err) { console.error(err); }
};
document.getElementById('form-add-table')?.addEventListener('submit', window.addAdminTable);

window.deleteAdminSpace = async (type, id) => {
  if(!confirm("Bu alanı silmek istediğinize emin misiniz?")) return;
  try {
    const res = await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
    if(res.ok) window.loadAdminSpaces();
  } catch(err) { console.error(err); }
};

// --- ADMIN AUDIT LOGS ---
window.loadAdminAuditLogs = async () => {
  const tbody = document.getElementById('mgmt-audit-body');
  if (!tbody) return;
  try {
    const res = await fetch('/api/audit-logs');
    const logs = await res.json();
    tbody.innerHTML = '';
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted small padding-md">Kayıtlı log yok.</td></tr>';
      return;
    }
    logs.forEach(l => {
      const tr = document.createElement('tr');
      const timeString = new Date(l.created_at).toLocaleString();
      tr.innerHTML = `
        <td>${timeString}</td>
        <td><strong>${l.staff_name}</strong></td>
        <td><span class="text-primary">${l.action}</span></td>
        <td><span class="text-muted">${l.details}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
};

// --- ADMIN PURCHASING RECEIPT ---
window.addAdminInventoryReceipt = async (e) => {
  e.preventDefault();
  const invId = document.getElementById('receipt-inv-select').value;
  const vendor = document.getElementById('receipt-vendor').value;
  const qty = parseFloat(document.getElementById('receipt-qty').value);
  const total = parseFloat(document.getElementById('receipt-total').value);
  
  if (!invId || isNaN(qty) || isNaN(total)) return;
  
  const receipt_number = 'FTR-' + Date.now().toString().slice(-6);
  const unit_price = total / qty;
  
  try {
    const res = await fetch('/api/inventory/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_number,
        vendor: vendor || 'N/A',
        total_amount: total,
        created_by: 'Yönetici',
        items: [{
          inventory_id: invId,
          quantity: qty,
          unit_price: unit_price,
          total_price: total
        }]
      })
    });
    if (res.ok) {
      alert("Mal Kabul ve Gider Kaydı başarıyla eklendi.");
      document.getElementById('form-add-receipt').reset();
      
      // Reload inventory data
      const invRes = await fetch('/api/inventory');
      if (invRes.ok) {
        const inv = await invRes.json();
        const tbody = document.getElementById('mgmt-inventory-list');
        if (tbody) {
          tbody.innerHTML = '';
          inv.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${item.name}</td>
              <td>${item.unit}</td>
              <td>${item.stock} / ${item.par_level}</td>
              <td>${item.unit_cost} TL</td>
              <td><button class="btn btn-danger btn-xs" onclick="window.deleteAdminInventory('${item.id}')"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } else {
      const err = await res.json();
      alert("Hata: " + err.error);
    }
  } catch (err) { console.error(err); }
};
document.getElementById('form-add-receipt')?.addEventListener('submit', window.addAdminInventoryReceipt);


// ==========================================
// DESKTOP ADMIN DASHBOARD SPECIFIC CODE
// ==========================================



export function setupDesktopAdminDashboard() {
  registerLoader('loadAdminDashboardData', loadAdminDashboardData);
  registerLoader('loadStaffManagementData', loadStaffManagementData);
  setupLiveManagementForms();
  setupStaffManagementForm();

  const btnRefreshAuditLogs = document.getElementById('btn-refresh-audit-logs');
  if (btnRefreshAuditLogs) {
    btnRefreshAuditLogs.addEventListener('click', loadStaffManagementData);
  }


}

export async function loadDesktopAdminDashboardData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    
    // FETCH REAL DATA FROM BACKEND API
    const [dashboardRes, roomsRes, tablesRes, reqsRes, invRes, auditsRes, apaRes, logsRes] = await Promise.all([
      fetch('/api/admin/dashboard'),
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/tables${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/inventory/audits${tenantParam}`),
      fetch(`/api/apa/summary${tenantParam}`),
      fetch(`/api/audit-logs${tenantParam}`)
    ]);

    const dashboard = dashboardRes.ok ? await dashboardRes.json() : null;
    const rooms = roomsRes.ok ? await roomsRes.json() : [];
    const tables = tablesRes.ok ? await tablesRes.json() : [];
    const requests = reqsRes.ok ? await reqsRes.json() : [];
    const inventory = invRes.ok ? await invRes.json() : [];
    const audits = auditsRes.ok ? await auditsRes.json() : [];
    const apaSummary = apaRes.ok ? await apaRes.json() : { cash: 0, credit: 0, room_charge: 0, total_expenses: 0, net: 0, totalSpentEur: 0 };
    const auditLogs = logsRes.ok ? await logsRes.json() : [];

    // Check for new requests to trigger notifications
    if (!window.adminKnownRequestIds) {
      window.adminKnownRequestIds = new Set(requests.map(r => r.id));
    } else {
      requests.forEach(req => {
        if (!window.adminKnownRequestIds.has(req.id)) {
          window.adminKnownRequestIds.add(req.id);
          triggerRequestNotification(req, state.availableCatalog);
        }
      });
    }

    renderDesktopKpis(rooms, tables, requests, apaSummary, dashboard);
    renderDesktopStockWarnings(dashboard?.critical_stock || inventory);
    renderVarianceReports(audits);
    renderActiveGuests(rooms);
    renderRevenueDetail(requests, apaSummary);
    loadMobileConnectionCard();
    renderLiveManagementLists(rooms, tables, inventory, state.availableCatalog);
    renderPatronPanel(requests, audits, inventory, state.availableCatalog);
    
    // Render Live Operations Tracker (Tüm Olan Biten)
    renderLiveOperationsTracker(rooms, tables, inventory, requests, auditLogs);
    renderControlSummary(dashboard);
  } catch (err) {
    console.error("Error loading Admin Dashboard data:", err);
  }
}

async function loadStaffManagementData() {
  try {
    const res = await fetch(`/api/staff?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const staff = await res.json();
      renderStaffManagement(staff);
    }

    const auditRes = await fetch(`/api/audit-logs?tenant_id=${state.currentTenant}`);
    if (auditRes.ok) {
      const logs = await auditRes.json();
      renderAuditLogs(logs);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('audit-logs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">İşlem kaydı bulunmuyor.</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    const dateStr = new Date(log.created_at).toLocaleString('tr-TR');
    tr.innerHTML = `
      <td><span class="text-muted text-xs">${dateStr}</span></td>
      <td><strong>${esc(log.staff_name)}</strong></td>
      <td><span class="badge ${getLogActionBadgeClass(log.action)}" style="font-size:10px; padding:2px 6px;">${esc(log.action)}</span></td>
      <td><span class="text-xs">${esc(log.details)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function getLogActionBadgeClass(action) {
  if (action.includes('Giriş') || action.includes('Oluşturuldu') || action.includes('Eklendi')) return 'clean_vacant';
  if (action.includes('Çıkış') || action.includes('Silindi') || action.includes('Zayiat')) return 'dirty_vacant';
  return 'maintenance';
}

function renderStaffManagement(staff) {
  const tbody = document.getElementById('staff-management-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (staff.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Personel kaydı bulunmuyor.</td></tr>';
    return;
  }

  staff.forEach(person => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${person.name}</strong></td>
      <td>${person.role}</td>
      <td><span class="text-muted">PIN gizli</span></td>
      <td><button class="btn btn-danger btn-xs" onclick="deleteStaffLive('${person.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function setupStaffManagementForm() {
  const form = document.getElementById('form-add-staff');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('add-staff-name').value.trim();
    const role = document.getElementById('add-staff-role').value.trim();
    const pin = document.getElementById('add-staff-pin').value.trim();

    const res = await fetch(`/api/staff?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, pin })
    });

    if (res.ok) {
      form.reset();
      logEvent('system', `Personel eklendi: <strong>${name}</strong>`);
      loadStaffManagementData();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Personel eklenemedi.');
    }
  });
}

window.deleteStaffLive = async (id) => {
  if (!confirm("Bu personel kaydını silmek istediğinize emin misiniz?")) return;
  const res = await fetch(`/api/staff/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
  if (res.ok) {
    logEvent('system', 'Personel silindi.');
    loadStaffManagementData();
  }
};

function renderDesktopKpis(rooms, tables, requests, apaSummary, dashboard = null) {
  // 1. Consolidated Revenue (Dining + Stay) in TL
  let totalRevenueTl = 0;
  requests.forEach(req => {
    if (req.status === 'completed' || req.type === 'room_service_charge') {
      totalRevenueTl += req.total_amount || 0;
    }
  });

  const kpiRevenue = document.getElementById('kpi-total-revenue');
  if (kpiRevenue) {
    kpiRevenue.textContent = `${totalRevenueTl.toFixed(2)} TL`;
  }

  // 2. Hotel Occupancy Rate
  const totalRooms = rooms.length || 1;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
  
  const kpiOccupancy = document.getElementById('kpi-occupancy-rate');
  if (kpiOccupancy) {
    kpiOccupancy.textContent = `${occupancyRate}% (${occupiedRooms}/${totalRooms})`;
  }

  // 3. Active Tables
  const totalTables = tables.length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  
  const kpiTables = document.getElementById('kpi-active-tables');
  if (kpiTables) {
    kpiTables.textContent = `${occupiedTables} / ${totalTables}`;
  }

  // 4. Pending Tasks
  const pendingTasks = dashboard ? dashboard.open_tasks : requests.filter(r => r.type === 'staff_task' && r.status !== 'completed').length;
  const kpiTasks = document.getElementById('kpi-pending-tasks');
  if (kpiTasks) {
    kpiTasks.textContent = pendingTasks;
    if (pendingTasks > 0) {
      kpiTasks.style.color = 'var(--color-warning)';
    } else {
      kpiTasks.style.color = 'var(--color-success)';
    }
  }
}

function renderControlSummary(dashboard) {
  const node = document.getElementById('admin-control-summary');
  if (!node || !dashboard) return;
  const maintenance = Array.isArray(dashboard.maintenance) ? dashboard.maintenance.length : 0;
  node.textContent = `Operasyon özeti · KDS: ${dashboard.kitchen_queue} · Açık masa: ${dashboard.open_tables} · Bakım: ${maintenance} · Tahsilat bekleyen: ${Number(dashboard.receivables || 0).toFixed(2)} TL`;
}

function renderStockWarnings(inventory) {
  const tbody = document.getElementById('admin-stock-warnings-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let count = 0;
  inventory.forEach(item => {
    const minLevel = item.par_level || 10;
    if (item.stock < minLevel) {
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="text-danger bold">${item.stock} ${item.unit}</span></td>
        <td>${minLevel} ${item.unit}</td>
        <td><span class="room-badge dirty_vacant" style="font-size:9px; padding:2px 6px;">KRİTİK STOK</span></td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (count === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted small padding-md">Kritik stok seviyesinde hammadde bulunmamaktadır.</td></tr>`;
  }
}

function renderVarianceReports(audits) {
  const tbody = document.getElementById('admin-variances-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (audits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted small padding-md">Kör sayım denetim kaydı bulunmuyor.</td></tr>`;
    return;
  }

  audits.forEach(audit => {
    const tr = document.createElement('tr');
    const colorClass = audit.variance < 0 ? 'text-danger bold' : (audit.variance > 0 ? 'text-success bold' : 'text-muted');
    const sign = audit.variance > 0 ? '+' : '';
    
    tr.innerHTML = `
      <td><span class="text-xs text-muted">${new Date(audit.created_at).toLocaleDateString()}</span></td>
      <td><strong>${audit.inventory_name}</strong></td>
      <td>${audit.expected_amount} ${audit.unit}</td>
      <td>${audit.physical_amount} ${audit.unit}</td>
      <td><span class="${colorClass}">${sign}${audit.variance} ${audit.unit}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderActiveGuests(rooms) {
  const tbody = document.getElementById('admin-guests-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeGuests = rooms.filter(r => r.status === 'occupied');

  if (activeGuests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted small padding-md">Şu an otelde konaklayan misafir bulunmuyor.</td></tr>`;
    return;
  }

  activeGuests.forEach(room => {
    const tr = document.createElement('tr');
    const guestName = room.guest_name || room.canonical_guest_name || '-';
    const phone = room.phone || '-';
    const arrival = room.arrival_date ? new Date(room.arrival_date).toLocaleDateString('tr-TR') : '-';
    const departure = room.departure_date ? new Date(room.departure_date).toLocaleDateString('tr-TR') : '-';
    const nights = (room.arrival_date && room.departure_date)
      ? Math.ceil((new Date(room.departure_date) - new Date(room.arrival_date)) / 86400000)
      : '-';
    const dnd = room.dnd_active ? '<span style="color:#ef4444; font-size:10px;"><i class="fa-solid fa-ban"></i> DND</span>' : '';
    tr.innerHTML = `
      <td><strong>Oda ${esc(room.room_number)}</strong>${dnd}</td>
      <td>${esc(guestName)}</td>
      <td>${esc(phone)}</td>
      <td>${arrival}</td>
      <td>${departure}</td>
      <td>${nights} gece</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRevenueDetail(requests, apaSummary) {
  let diningRev = 0;
  let stayRev = 0;

  requests.forEach(req => {
    if (req.status === 'completed' || req.type === 'room_service_charge') {
      if (req.payment_method === 'room_charge' || req.type === 'room_service_charge') {
        stayRev += req.total_amount || 0;
      } else {
        diningRev += req.total_amount || 0;
      }
    }
  });

  const elDining = document.getElementById('admin-rev-dining');
  if (elDining) elDining.textContent = `${diningRev.toFixed(2)} TL`;

  const elStay = document.getElementById('admin-rev-stay');
  if (elStay) elStay.textContent = `${stayRev.toFixed(2)} TL`;

  const elCruise = document.getElementById('admin-rev-cruise');
  if (elCruise) elCruise.textContent = `€${(apaSummary.totalSpentEur || 0).toFixed(2)}`;
}

async function loadMobileConnectionCard() {
  try {
    const origin = window.location.origin;

    // Core 3 Entry Points (served directly by this module — reception bundles its own guest portal)
    const roomUrl = `${origin}/guest.html?target=Room-1&type=room&tenant_id=${state.currentTenant}`;
    const restaurantUrl = `${origin}/guest.html?target=${encodeURIComponent('Table-Garden 1')}&type=restaurant&tenant_id=${state.currentTenant}`;
    const staffUrl = `${origin}/staff-reception.html?tenant_id=${state.currentTenant}`;

    const elRoom = document.getElementById('mobile-room-url');
    if (elRoom) {
      elRoom.href = roomUrl;
      elRoom.textContent = roomUrl;
    }

    const elRestaurant = document.getElementById('mobile-restaurant-url');
    if (elRestaurant) {
      elRestaurant.href = restaurantUrl;
      elRestaurant.textContent = restaurantUrl;
    }

    const elStaff = document.getElementById('mobile-staff-url');
    if (elStaff) {
      elStaff.href = staffUrl;
      elStaff.textContent = staffUrl;
    }

    // Default QR to the Room URL for the guest
    const elQr = document.getElementById('mobile-qr-img');
    if (elQr) {
      elQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(roomUrl)}`;
    }
  } catch (err) {
    console.error("Error loading system network details:", err);
  }
}

function renderLiveManagementLists(rooms, tables, inventory, catalog) {
  // Rooms
  const roomsBody = document.getElementById('mgmt-rooms-tbody-live');
  if (roomsBody) {
    roomsBody.innerHTML = '';
    rooms.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>Oda ${r.room_number}</strong></td>
        <td>
          <button class="btn btn-danger btn-xs" onclick="deleteRoomLive('${r.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button>
        </td>
      `;
      roomsBody.appendChild(tr);
    });
  }

  // Tables
  const tablesBody = document.getElementById('mgmt-tables-tbody-live');
  if (tablesBody) {
    tablesBody.innerHTML = '';
    tables.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t.table_number}</strong></td>
        <td>${t.section}</td>
        <td>
          <button class="btn btn-danger btn-xs" onclick="deleteTableLive('${t.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button>
        </td>
      `;
      tablesBody.appendChild(tr);
    });
  }

  // Inventory
  const invBody = document.getElementById('mgmt-inventory-tbody-live');
  if (invBody) {
    invBody.innerHTML = '';
    inventory.forEach(i => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${i.name}</strong> <span class="text-muted small">(${i.module_type === 'bar' ? 'Bar' : 'Mutfak'})</span></td>
        <td>${i.stock}</td>
        <td>${i.par_level}</td>
        <td>${i.unit}</td>
        <td>${i.unit_cost.toFixed(2)} TL</td>
        <td>
          <button class="btn btn-danger btn-xs" onclick="deleteInventoryLive('${i.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button>
        </td>
      `;
      invBody.appendChild(tr);
    });
  }

  // Products
  const prodBody = document.getElementById('mgmt-products-tbody-live');
  if (prodBody) {
    if (window.catalogPriceSaveInFlight || prodBody.contains(document.activeElement)) return;
    prodBody.innerHTML = '';
    catalog.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td>
          <div class="catalog-price-cell">
            <input type="text" inputmode="decimal" class="form-control catalog-price-input" value="${Number(c.price || 0).toFixed(2)}" data-id="${c.id}" data-original-price="${Number(c.price || 0).toFixed(2)}" onkeydown="window.handleCatalogPriceKey(event)">
            <span>TL</span>
            <button type="button" class="btn btn-success btn-xs catalog-price-save" onclick="window.saveCatalogPriceFromButton(this)">
              <i class="fa-solid fa-floppy-disk"></i> Kaydet
            </button>
            <span class="catalog-price-status" aria-live="polite"></span>
          </div>
        </td>
        <td><span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">${c.category.toUpperCase()}</span></td>
        <td>
          <button class="btn btn-danger btn-xs" onclick="deleteProductLive('${c.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button>
        </td>
      `;
      prodBody.appendChild(tr);
    });
  }

  // Populate Recipe Dropdowns
  populateRecipeSelectorsLive(catalog, inventory);
}

function populateRecipeSelectorsLive(catalog, inventory) {
  const prodSelect = document.getElementById('add-recipe-prod-select');
  const invSelect = document.getElementById('add-recipe-inv-select');
  if (!prodSelect || !invSelect) return;

  const prevProd = prodSelect.value;
  prodSelect.innerHTML = '<option value="">Ürün Seçin...</option>';
  catalog.filter(c => c.category === 'food' || c.category === 'drink').forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.price} TL)`;
    prodSelect.appendChild(opt);
  });
  if (prevProd) prodSelect.value = prevProd;

  invSelect.innerHTML = '<option value="">Hammadde Seçin...</option>';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.id;
    opt.textContent = `${i.name} (${i.unit})`;
    invSelect.appendChild(opt);
  });
}

function setupLiveManagementForms() {
  // Add Room
  const formRoom = document.getElementById('form-add-room-live');
  if (formRoom) {
    formRoom.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomNumber = document.getElementById('add-room-num').value;
      const roomType = document.getElementById('add-room-type')?.value || 'standard';
      const floor = parseInt(document.getElementById('add-room-floor')?.value) || 1;
      const bedType = document.getElementById('add-room-bed-type')?.value || 'double';
      const capacity = parseInt(document.getElementById('add-room-capacity')?.value) || 2;
      const baseRate = parseFloat(document.getElementById('add-room-base-rate')?.value) || 0;
      
      const res = await fetch(`/api/rooms?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomNumber, roomType, floor, bedType, capacity, baseRate 
        })
      });
      if (res.ok) {
        formRoom.reset();
        logEvent('system', `Yeni Oda Eklendi: <strong>Oda ${roomNumber}</strong>`);
        loadAdminDashboardData();
      }
    });
  }

  // Add Table
  const formTable = document.getElementById('form-add-table-live');
  if (formTable) {
    formTable.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tableNumber = document.getElementById('add-table-num').value;
      const section = document.getElementById('add-table-sec').value;

      const res = await fetch(`/api/tables?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber, section })
      });
      if (res.ok) {
        formTable.reset();
        logEvent('system', `Yeni Masa Eklendi: <strong>${tableNumber}</strong>`);
        loadAdminDashboardData();
      }
    });
  }

  // Add Inventory
  const formInv = document.getElementById('form-add-inventory-live');
  if (formInv) {
    formInv.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('add-inv-name').value;
      const unit = document.getElementById('add-inv-unit').value;
      const stock = parseFloat(document.getElementById('add-inv-stock').value) || 0;
      const par_level = parseFloat(document.getElementById('add-inv-par').value) || 0;
      const unit_cost = parseFloat(document.getElementById('add-inv-cost').value) || 0;
      const module_type = document.getElementById('add-inv-module').value;

      const res = await fetch(`/api/inventory?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, unit, stock, par_level, unit_cost, module_type })
      });
      if (res.ok) {
        formInv.reset();
        logEvent('system', `Yeni Hammadde Eklendi: <strong>${name}</strong>`);
        loadAdminDashboardData();
      }
    });
  }

  // Add Product
  const formProd = document.getElementById('form-add-product-live');
  if (formProd) {
    formProd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('add-prod-name').value;
      const price = parseFloat(document.getElementById('add-prod-price').value) || 0;
      const category = document.getElementById('add-prod-category').value;
      const module_type = category === 'minibar' || category === 'service' ? 'hotel' : 'dining';

      const res = await fetch(`/api/catalog?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, category, module_type })
      });
      if (res.ok) {
        formProd.reset();
        logEvent('system', `Yeni Menü Ürünü Eklendi: <strong>${name}</strong>`);
        // Refresh catalog cache
        const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
        if (configRes.ok) state.availableCatalog = await configRes.json();
        loadAdminDashboardData();
      }
    });
  }

  // Add Recipe
  const formRecipe = document.getElementById('form-add-recipe-live');
  if (formRecipe) {
    formRecipe.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catalog_item_id = document.getElementById('add-recipe-prod-select').value;
      const inventory_id = document.getElementById('add-recipe-inv-select').value;
      const amount_needed = parseFloat(document.getElementById('add-recipe-amount').value);

      if (!catalog_item_id) {
        alert("Lütfen önce bir ürün seçin!");
        return;
      }

      const res = await fetch(`/api/recipes?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog_item_id, inventory_id, amount_needed })
      });
      if (res.ok) {
        formRecipe.reset();
        logEvent('system', `Reçete Malzemesi Eklendi.`);
        loadRecipeForSelectedCatalogItemLive();
      }
    });
  }

  // Select Product in recipe builder to load ingredients
  const prodSelect = document.getElementById('add-recipe-prod-select');
  if (prodSelect) {
    prodSelect.addEventListener('change', loadRecipeForSelectedCatalogItemLive);
  }

}

async function loadRecipeForSelectedCatalogItemLive() {
  const catSelect = document.getElementById('add-recipe-prod-select');
  const tbody = document.getElementById('mgmt-recipes-tbody-live');
  if (!catSelect || !tbody) return;

  const catalogItemId = catSelect.value;
  if (!catalogItemId) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Lütfen sol taraftan bir menü ürünü seçin.</td></tr>';
    return;
  }

  try {
    const res = await fetch(`/api/recipes?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const allRecipes = await res.json();
      const filtered = allRecipes.filter(r => r.catalog_item_id === catalogItemId);
      
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Bu ürüne ait tanımlı reçete bulunmuyor. Yeni malzeme ekleyebilirsiniz.</td></tr>';
        return;
      }

      filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${r.inventory_name}</strong></td>
          <td>${r.amount_needed}</td>
          <td>${r.unit}</td>
          <td>
            <button class="btn btn-danger btn-xs" onclick="deleteRecipeIngredientLive('${r.catalog_item_id}', '${r.inventory_id}')">
              <i class="fa-solid fa-trash-can"></i> Sil
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

window.deleteRoomLive = async (id) => {
  if (confirm("Bu odayı silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/rooms/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Oda Silindi.');
      loadAdminDashboardData();
    }
  }
};

window.deleteTableLive = async (id) => {
  if (confirm("Bu masayı silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/tables/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Masa Silindi.');
      loadAdminDashboardData();
    }
  }
};

window.deleteInventoryLive = async (id) => {
  if (confirm("Bu hammaddeyi silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/inventory/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Hammadde Silindi.');
      loadAdminDashboardData();
    }
  }
};

window.deleteProductLive = async (id) => {
  if (confirm("Bu menü ürününü silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/catalog/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Menü Ürünü Silindi.');
      const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
      if (configRes.ok) state.availableCatalog = await configRes.json();
      loadAdminDashboardData();
    }
  }
};

window.handleCatalogPriceKey = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    window.updateCatalogItemPriceLive(event.currentTarget);
  }
};

window.saveCatalogPriceFromButton = (button) => {
  const input = button.closest('.catalog-price-cell')?.querySelector('.catalog-price-input');
  if (input) window.updateCatalogItemPriceLive(input);
};

function parseCatalogPriceValue(value) {
  const raw = String(value || '').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!normalized) return NaN;
  return Number(normalized);
}

window.updateCatalogItemPriceLive = async (input) => {
  const id = input.dataset.id;
  const originalPrice = input.dataset.originalPrice;
  const price = parseCatalogPriceValue(input.value);
  const saveButton = input.closest('.catalog-price-cell')?.querySelector('.catalog-price-save');
  const status = input.closest('.catalog-price-cell')?.querySelector('.catalog-price-status');

  if (!id || !Number.isFinite(price) || price < 0) {
    input.value = originalPrice;
    return;
  }

  const normalizedPrice = price.toFixed(2);
  if (normalizedPrice === originalPrice) {
    input.value = normalizedPrice;
    return;
  }

  input.disabled = true;
  window.catalogPriceSaveInFlight = true;
  if (saveButton) saveButton.disabled = true;
  if (status) status.textContent = 'Kaydediliyor';
  try {
    const res = await fetch(`/api/catalog/${id}?tenant_id=${state.currentTenant}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
      cache: 'no-store'
    });

    if (res.ok) {
      const payload = await res.json().catch(() => null);
      const savedPrice = Number(payload?.item?.price ?? NaN);
      if (!Number.isFinite(savedPrice) || savedPrice.toFixed(2) !== normalizedPrice) {
        throw new Error('Fiyat doğrulanamadı');
      }
      const savedNormalizedPrice = savedPrice.toFixed(2);
      input.dataset.originalPrice = savedNormalizedPrice;
      input.value = savedNormalizedPrice;
      const item = state.availableCatalog.find(c => c.id === id);
      if (item) {
        item.price = savedPrice;
        item.originalPrice = savedPrice;
      }
      logEvent('system', `Menü fiyatı güncellendi: <strong>${savedNormalizedPrice} TL</strong>`);
      if (status) status.textContent = 'Kaydedildi';
    } else {
      throw new Error('Fiyat güncellenemedi');
    }
  } catch (err) {
    input.value = originalPrice;
    if (status) status.textContent = 'Hata';
    alert("Fiyat güncellenemedi.");
  } finally {
    input.disabled = false;
    if (saveButton) saveButton.disabled = false;
    setTimeout(() => {
      window.catalogPriceSaveInFlight = false;
    }, 1200);
  }
};

window.deleteRecipeIngredientLive = async (catalogItemId, inventoryId) => {
  if (confirm("Bu reçete malzemesini silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/recipes/${catalogItemId}/${inventoryId}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Reçete Malzemesi Silindi.');
      loadRecipeForSelectedCatalogItemLive();
    }
  }
};

async function renderPatronPanel(requests, audits, inventory, catalog) {
  // 1. Calculate Average completion speed (difference between created_at and completed_at)
  let totalSpeedMs = 0;
  let completedCount = 0;
  const closedRequests = requests.filter(r => r.status === 'completed' && r.completed_at);

  closedRequests.forEach(req => {
    const start = new Date(req.created_at);
    const end = new Date(req.completed_at);
    const diff = end - start;
    if (diff > 0) {
      totalSpeedMs += diff;
      completedCount++;
    }
  });

  const avgSpeedEl = document.getElementById('patron-kpi-speed');
  if (avgSpeedEl) {
    if (completedCount > 0) {
      const avgMinutes = Math.round((totalSpeedMs / completedCount) / 1000 / 60);
      avgSpeedEl.textContent = `${avgMinutes} Dakika`;
    } else {
      avgSpeedEl.textContent = 'Veri Yok';
    }
  }

  // 2. Calculate prevented leakage/loss (TL) from audits variance
  let totalLeakVal = 0;
  const inventoryMap = {};
  inventory.forEach(i => {
    inventoryMap[i.id] = i;
  });

  audits.forEach(aud => {
    const inv = inventoryMap[aud.inventory_id];
    if (inv) {
      totalLeakVal += Math.abs(aud.variance * inv.unit_cost);
    }
  });

  const leakEl = document.getElementById('patron-kpi-leak');
  if (leakEl) {
    leakEl.textContent = `${totalLeakVal.toFixed(2)} TL`;
  }

  // 3. Render Audit Speed Logs table
  const auditLogsBody = document.getElementById('patron-audit-speed-tbody');
  if (auditLogsBody) {
    auditLogsBody.innerHTML = '';
    if (closedRequests.length === 0) {
      auditLogsBody.innerHTML = '<tr><td colspan="9" class="text-muted text-center text-xs">Kapatılmış hizmet talebi kaydı bulunmuyor.</td></tr>';
    } else {
      closedRequests.forEach(req => {
        const start = new Date(req.created_at);
        const end = new Date(req.completed_at);
        const diffMs = end - start;
        const diffMinutes = diffMs > 0 ? Math.round(diffMs / 1000 / 60) : 0;
        const speedClass = diffMinutes < 10 ? 'text-success' : (diffMinutes < 30 ? 'text-warning' : 'text-danger');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="text-xs text-muted">${start.toLocaleDateString()}</span></td>
          <td><strong>${esc(req.target_identifier)}</strong></td>
          <td><span class="text-sm">${esc(req.details || req.type)}</span></td>
          <td><span class="room-badge clean_vacant" style="font-size:9px;">TAMAMLANDI</span></td>
          <td>${esc(req.created_by || '-')}</td>
          <td>${esc(req.completed_by || '-')}</td>
          <td>${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td><span class="bold ${speedClass}">${diffMinutes} dk</span></td>
        `;
        auditLogsBody.appendChild(tr);
      });
    }
  }

  // 4. Fetch and render campaigns list
  try {
    const campRes = await fetch(`/api/campaigns?tenant_id=${state.currentTenant}`);
    if (campRes.ok) {
      const campaigns = await campRes.json();
      
      const activeCount = campaigns.filter(c => c.active === 1).length;
      const activeCampEl = document.getElementById('patron-kpi-active-campaigns');
      if (activeCampEl) activeCampEl.textContent = activeCount;

      const campBody = document.getElementById('patron-campaigns-tbody');
      if (campBody) {
        campBody.innerHTML = '';
        if (campaigns.length === 0) {
          campBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center text-xs">Aktif tanımlı kampanya bulunmuyor.</td></tr>';
        } else {
          campaigns.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${c.title}</strong></td>
              <td>${c.catalog_item_name}</td>
              <td>%${c.discount_rate * 100}</td>
              <td><span class="room-badge ${c.active ? 'clean_vacant' : 'dirty_vacant'}" style="font-size:9px;">${c.active ? 'AKTİF' : 'PASİF'}</span></td>
              <td>
                <button class="btn ${c.active ? 'btn-danger' : 'btn-success'} btn-xs" style="padding: 2px 6px; font-size:10px; font-weight:700;" onclick="toggleCampaignLive('${c.id}', ${c.active ? 0 : 1})">
                  ${c.active ? 'Kapat' : 'Aç'}
                </button>
                <button class="btn btn-glass btn-xs" style="padding: 2px 4px;" onclick="deleteCampaignLive('${c.id}')"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            `;
            campBody.appendChild(tr);
          });
        }
      }
    }
  } catch (err) {
    console.error(err);
  }

  // 5. Run AI Campaign Suggestion Engine
  runAiRecommendationEngine(requests, audits, inventory, catalog);
}

function runAiRecommendationEngine(requests, audits, inventory, catalog) {
  const recommendationsList = document.getElementById('patron-ai-recommendations-list');
  if (!recommendationsList) return;
  recommendationsList.innerHTML = '';

  const recommendations = [];

  // Rule 1: High stock + slow sales recommendation
  inventory.forEach(inv => {
    if (inv.stock > inv.par_level * 1.2) {
      catalog.forEach(item => {
        const match = item.ingredients?.find(ing => ing.name === inv.name);
        if (match) {
          recommendations.push({
            type: 'stock_excess',
            title: `Fazla Stok Alarmı: ${inv.name}`,
            desc: `Deponuzdaki ${inv.name} stoğu (${inv.stock} ${inv.unit}) par seviyesinin oldukça üzerinde. Nakit akışı ve tüketimi artırmak için bu hammaddeyi kullanan <strong>${item.name}</strong> ürününe saatlik %15 indirimli kampanya uygulayabilirsiniz.`,
            actionLabel: '%15 İndirim Kampanyası Öner',
            catalogItemId: item.id,
            discountRate: 0.15,
            campaignTitle: `Saatlik Fırsat: ${item.name} %15 İndirimli!`
          });
        }
      });
    }
  });

  // Rule 2: Happy Hour suggestion (based on bar items in the evening)
  const hour = new Date().getHours();
  if (hour >= 17 && hour <= 23) {
    const drinks = catalog.filter(c => c.category === 'drink');
    if (drinks.length > 0) {
      const luckyDrink = drinks[Math.floor(Math.random() * drinks.length)];
      recommendations.push({
        type: 'happy_hour',
        title: `Happy Hour Kampanyası (Saat ${hour}:00)`,
        desc: `Akşam saatleri yoğunluğu başladı. Barda ciroyu maksimize etmek için popüler alkollü/alkolsüz içeceğimiz olan <strong>${luckyDrink.name}</strong> için saatlik %20 indirim tanımlayabilirsiniz.`,
        actionLabel: '%20 Happy Hour Etkinleştir',
        catalogItemId: luckyDrink.id,
        discountRate: 0.20,
        campaignTitle: `Happy Hour: ${luckyDrink.name} %20 İndirimli!`
      });
    }
  }

  if (recommendations.length === 0) {
    recommendationsList.innerHTML = `
      <div style="background: rgba(228, 211, 167,0.02); border: 1px dashed rgba(228, 211, 167,0.1); padding: 12px; border-radius: 6px; text-align: center;">
        <span class="text-muted text-xs">Şu an sistem tarafından algılanan acil bir kampanya önerisi bulunmuyor. Depo ve satışlar dengeli görünüyor.</span>
      </div>
    `;
    return;
  }

  recommendations.forEach((rec, index) => {
    const div = document.createElement('div');
    div.style.background = rec.type === 'stock_excess' ? 'rgba(255,193,7,0.05)' : 'rgba(40,167,69,0.05)';
    div.style.border = rec.type === 'stock_excess' ? '1px solid rgba(255,193,7,0.15)' : '1px solid rgba(40,167,69,0.15)';
    div.style.padding = '12px';
    div.style.borderRadius = '8px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '8px';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:12px; color: ${rec.type === 'stock_excess' ? 'var(--color-warning)' : 'var(--color-success)'};"><i class="fa-solid fa-wand-magic-sparkles"></i> ${rec.title}</strong>
        <span class="text-xs text-muted" style="font-size: 10px;">AI Önerisi</span>
      </div>
      <p class="text-xs" style="line-height:1.4; color:rgba(228, 211, 167,0.85);">${rec.desc}</p>
      <button class="btn btn-primary btn-xs" style="align-self: flex-start; margin-top:4px;" onclick="createCampaignFromSuggestion('${rec.campaignTitle}', ${rec.discountRate}, '${rec.catalogItemId}')">
        <i class="fa-solid fa-bolt"></i> ${rec.actionLabel}
      </button>
    `;
    recommendationsList.appendChild(div);
  });
}

window.createCampaignFromSuggestion = async (title, discountRate, catalogItemId) => {
  const res = await fetch(`/api/campaigns?tenant_id=${state.currentTenant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, discount_rate: discountRate, catalog_item_id: catalogItemId })
  });
  if (res.ok) {
    const data = await res.json();
    await fetch(`/api/campaigns/${data.id}/toggle?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 1 })
    });
    logEvent('system', `AI Kampanyası Aktifleştirildi: <strong>${title}</strong>`);
    
    const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
    if (configRes.ok) state.availableCatalog = await configRes.json();

    loadAdminDashboardData();
  }
};

window.toggleCampaignLive = async (id, active) => {
  const res = await fetch(`/api/campaigns/${id}/toggle?tenant_id=${state.currentTenant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
  if (res.ok) {
    logEvent('system', `Kampanya durumu güncellendi.`);
    const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
    if (configRes.ok) state.availableCatalog = await configRes.json();
    loadAdminDashboardData();
  }
};

window.deleteCampaignLive = async (id) => {
  if (confirm("Bu kampanyayı silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/campaigns/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Kampanya silindi.');
      const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
      if (configRes.ok) state.availableCatalog = await configRes.json();
      loadAdminDashboardData();
    }
  }
};

async function loadBranding() {
  try {
    const res = await fetch(`/api/tenant/branding?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const branding = await res.json();
      
      // Update page title
      document.title = `${branding.name} - Yönetici Paneli`;

      // Update sidebar title
      const brandTitleEl = document.getElementById('brand-title');
      if (brandTitleEl) brandTitleEl.textContent = branding.name;

      // Update sidebar subtitle
      const brandSpan = document.querySelector('.sidebar .brand .brand-text span');
      if (brandSpan) brandSpan.textContent = 'PANSİYON ERP SİSTEMİ';

      // Update sidebar footer badge
      const tenantLabelEl = document.getElementById('current-tenant-label');
      if (tenantLabelEl) tenantLabelEl.textContent = branding.name;

      // Replace sidebar icon with logo image
      const brandLogoEl = document.querySelector('.sidebar .brand .brand-logo');
      if (brandLogoEl) {
        brandLogoEl.outerHTML = `<img src="${branding.logo}" style="height: 36px; width: 36px; border-radius: 50%; object-fit: cover; margin-right: 8px; border: 1.5px solid var(--color-primary);" class="brand-logo-img">`;
      } else {
        const logoImg = document.querySelector('.sidebar .brand .brand-logo-img');
        if (logoImg) logoImg.src = branding.logo;
      }

      // Update color settings if specified
      const cssVarMap = {
        primary_color: '--color-primary',
        accent_color: '--color-accent',
        bg_app: '--bg-app',
        bg_sidebar: '--bg-sidebar',
        bg_card: '--bg-card',
        color_text_main: '--color-text-main',
        color_text_muted: '--color-text-muted',
        border_glass: '--border-glass',
        border_glass_active: '--border-glass-active'
      };
      for (const [key, varName] of Object.entries(cssVarMap)) {
        if (branding[key]) {
          document.documentElement.style.setProperty(varName, branding[key]);
        }
      }
    }
  } catch (err) {
    console.error("Error loading branding details:", err);
  }
}

function renderLiveOperationsTracker(rooms, tables, inventory, requests, logs) {
  // 1. Oda Durumları (Rooms)
  const roomsContainer = document.getElementById('live-tracker-rooms');
  if (roomsContainer) {
    roomsContainer.innerHTML = '';
    rooms.forEach(r => {
      let statusBadge = '';
      if (r.status === 'occupied') {
        statusBadge = `<span class="room-badge occupied" style="font-size:9px; padding:1px 4px;">DOLU${r.dnd_active === 1 ? ' (DND)' : ''}</span>`;
      } else if (r.status === 'dirty_vacant') {
        statusBadge = `<span class="room-badge occupied" style="background:#dc3545; font-size:9px; padding:1px 4px;">KİRLİ</span>`;
      } else if (r.status === 'maintenance') {
        statusBadge = `<span class="room-badge maintenance" style="font-size:9px; padding:1px 4px;">BAKIM</span>`;
      } else {
        statusBadge = `<span class="room-badge clean_vacant" style="font-size:9px; padding:1px 4px;">BOŞ</span>`;
      }
      
      let acWarning = r.ac_status === 'broken' ? ' <i class="fa-solid fa-triangle-exclamation text-danger" title="Klima Arızalı"></i>' : '';

      const div = document.createElement('div');
      div.className = 'flex-between';
      div.style.marginBottom = '6px';
      div.innerHTML = `
        <span>Oda <strong>${r.room_number}</strong>${acWarning}</span>
        ${statusBadge}
      `;
      roomsContainer.appendChild(div);
    });
  }

  // 2. Masa & Sipariş Durumları
  const tablesContainer = document.getElementById('live-tracker-tables');
  if (tablesContainer) {
    tablesContainer.innerHTML = '';
    
    // Active Tables
    const activeTables = tables.filter(t => t.status !== 'empty');
    if (activeTables.length > 0) {
      activeTables.forEach(t => {
        let statusText = 'Dolu';
        let statusColor = 'var(--color-success)';
        if (t.status === 'requested_service') {
          statusText = 'Garson İstiyor';
          statusColor = 'var(--color-warning)';
        } else if (t.status === 'requested_bill') {
          statusText = 'Hesap İstiyor';
          statusColor = 'var(--color-accent)';
        }
        
        const div = document.createElement('div');
        div.style.marginBottom = '6px';
        div.innerHTML = `Masa <strong>${t.table_number}</strong>: <span style="color:${statusColor}; font-weight:700;">${statusText}</span>`;
        tablesContainer.appendChild(div);
      });
    } else {
      const div = document.createElement('div');
      div.className = 'text-muted text-xs';
      div.textContent = 'Aktif masa bulunmuyor.';
      tablesContainer.appendChild(div);
    }
    
    // Active KDS Orders (Pending / Preparing / Ready)
    const activeOrders = requests.filter(r => r.type === 'order' && r.status !== 'completed' && r.status !== 'delivered');
    if (activeOrders.length > 0) {
      const title = document.createElement('div');
      title.style.margin = '10px 0 6px 0';
      title.style.fontWeight = '700';
      title.style.fontSize = '10px';
      title.style.color = 'var(--color-primary)';
      title.textContent = 'AKTİF KDS SİPARİŞLERİ:';
      tablesContainer.appendChild(title);
      
      activeOrders.forEach(o => {
        let itemsList = '';
        try {
          const items = JSON.parse(o.details);
          if (Array.isArray(items)) {
            itemsList = items.map(i => `${esc(i.name)} x ${esc(i.quantity)}`).join(', ');
          }
        } catch(e) { itemsList = esc(o.details); }

        const div = document.createElement('div');
        div.className = 'flex-between';
        div.style.fontSize = '10px';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.padding = '4px';
        div.style.borderRadius = '4px';
        div.style.marginBottom = '4px';
        div.innerHTML = `
          <span><strong>${esc(o.target_identifier)}</strong>: ${itemsList}</span>
          <span style="text-transform:uppercase; font-weight:bold; font-size:8px; color:var(--color-warning);">${esc(o.status)}</span>
        `;
        tablesContainer.appendChild(div);
      });
    }
  }

  // 3. Son Stok Hareketleri
  renderLiveTrackerStock(logs);

  // 4. Son Aktivite Akışı (Audit Logs)
  renderLiveTrackerAudit(logs);
}

function renderLiveTrackerStock(logs) {
  const container = document.getElementById('live-tracker-stock');
  if (!container) return;
  container.innerHTML = '';
  
  const stockLogs = logs.filter(log => 
    log.action.includes('Stok') || log.action.includes('Zayiat') || log.action.includes('Sayım')
  ).slice(0, 5);
  
  if (stockLogs.length === 0) {
    container.innerHTML = '<div class="text-muted text-xs">Son stok hareketi bulunmuyor.</div>';
    return;
  }
  
  stockLogs.forEach(log => {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    div.style.paddingBottom = '4px';
    
    let actionColor = 'var(--color-success)';
    if (log.action.includes('Zayiat') || log.action.includes('Çıkış')) {
      actionColor = 'var(--color-danger)';
    } else if (log.action.includes('Sayım')) {
      actionColor = 'var(--color-warning)';
    }

    div.innerHTML = `
      <div class="flex-between">
        <span style="font-weight:700; color:${actionColor};">${esc(log.action)}</span>
        <span class="text-muted" style="font-size:9px;">${esc(log.staff_name)}</span>
      </div>
      <div style="font-size:10px; margin-top:2px;">${esc(log.details)}</div>
    `;
    container.appendChild(div);
  });
}

function renderLiveTrackerAudit(logs) {
  const container = document.getElementById('live-tracker-audit');
  if (!container) return;
  container.innerHTML = '';
  
  const recentLogs = logs.slice(0, 6);
  if (recentLogs.length === 0) {
    container.innerHTML = '<div class="text-muted text-xs">İşlem kaydı bulunmuyor.</div>';
    return;
  }
  
  recentLogs.forEach(log => {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    div.style.paddingBottom = '4px';
    
    const dateStr = new Date(log.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});

    div.innerHTML = `
      <div class="flex-between">
        <strong>${esc(log.staff_name)}</strong>
        <span class="text-muted" style="font-size:9px;">${dateStr}</span>
      </div>
      <div style="font-size:10px; color:rgba(255,255,255,0.85); margin-top:2px;">${esc(log.action)}: ${esc(log.details)}</div>
    `;
    container.appendChild(div);
  });
}

function playNotificationSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'bar' || type === 'kitchen') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'hk') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'tech') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(293.66, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio Context playback failed:", e);
  }
}

function showNotificationToast(title, message, iconClass, type) {
  let container = document.getElementById('staff-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'staff-toast-container';
    container.style.position = 'fixed';
    container.style.top = '16px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = 'calc(100% - 32px)';
    container.style.maxWidth = '360px';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.background = 'rgba(15, 23, 42, 0.95)';
  toast.style.backdropFilter = 'blur(10px)';
  toast.style.borderRadius = '14px';
  toast.style.padding = '12px 16px';
  toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
  
  let borderColor = 'rgba(8, 145, 178, 0.3)';
  let iconColor = 'var(--color-primary)';
  if (type === 'bar') {
    borderColor = 'rgba(245, 158, 11, 0.5)';
    iconColor = 'var(--color-accent)';
  } else if (type === 'kitchen') {
    borderColor = 'rgba(5, 150, 105, 0.5)';
    iconColor = 'var(--color-success)';
  } else if (type === 'hk') {
    borderColor = 'rgba(52, 199, 89, 0.5)';
    iconColor = '#34c759';
  } else if (type === 'tech') {
    borderColor = 'rgba(0, 180, 216, 0.5)';
    iconColor = '#00b4d8';
  }

  toast.style.border = `1px solid ${borderColor}`;
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  toast.style.transform = 'translateY(-20px)';
  toast.style.opacity = '0';
  toast.style.textAlign = 'left';

  toast.innerHTML = `
    <div style="font-size: 20px; color: ${iconColor}; flex-shrink: 0;"><i class="fa-solid ${iconClass}"></i></div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; font-size: 13px; color: #f8fafc; font-family: var(--font-title);">${esc(title)}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${esc(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 50);

  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 350);
  }, 4000);
}

function triggerRequestNotification(req, catalog) {
  let title = "Yeni Bildirim";
  let message = req.details || "";
  let type = "general";
  let icon = "fa-bell";
  
  let parsedDetails = [];
  try {
    if (req.type === 'order') {
      parsedDetails = Array.isArray(req.details) ? req.details : JSON.parse(req.details);
    }
  } catch(e) {}

  if (req.type === 'order') {
    const isDrink = parsedDetails.some(item => {
      const catItem = catalog?.find(c => c.id === item.itemId);
      return catItem && catItem.category === 'drink';
    });
    
    const itemsText = parsedDetails.map(i => `${i.name || 'Ürün'} x ${i.quantity}`).join(', ');

    if (isDrink) {
      title = "Yeni Bar Siparişi! 🍹";
      message = `${req.target_identifier}: ${itemsText}`;
      type = "bar";
      icon = "fa-glass-martini-alt";
    } else {
      title = "Yeni Mutfak Siparişi! 🍳";
      message = `${req.target_identifier}: ${itemsText}`;
      type = "kitchen";
      icon = "fa-utensils";
    }
  } else if (req.type === 'clean') {
    title = "Oda Temizlik Talebi 🧹";
    message = `${req.target_identifier} temizlik bekliyor.`;
    type = "hk";
    icon = "fa-broom";
  } else if (req.type === 'maintenance') {
    title = "Yeni Teknik Arıza Görevi 🛠️";
    message = `${req.target_identifier}: ${req.details}`;
    type = "tech";
    icon = "fa-wrench";
  } else if (req.type === 'bill') {
    title = "Masa Hesap Talebi 💳";
    message = `${req.target_identifier} hesap istiyor.`;
    type = "bar";
    icon = "fa-receipt";
  } else if (req.type === 'service') {
    const detailsLower = (req.details || "").toLowerCase();
    if (detailsLower.includes('havlu') || detailsLower.includes('towel') || detailsLower.includes('çarşaf') || detailsLower.includes('cleaning')) {
      title = "Oda Havlu/HK Talebi 🧺";
      message = `${req.target_identifier}: ${req.details}`;
      type = "hk";
      icon = "fa-soap";
    } else if (detailsLower.includes('resepsiyon') || detailsLower.includes('ön büro') || detailsLower.includes('reception')) {
      title = "Resepsiyon Talebi 🛎️";
      message = `${req.target_identifier}: ${req.details}`;
      type = "tech";
      icon = "fa-concierge-bell";
    } else {
      title = "Masa Garson Çağrısı 🔔";
      message = `${req.target_identifier} garson bekliyor.`;
      type = "bar";
      icon = "fa-bell";
    }
  }

  playNotificationSound(type);
  showNotificationToast(title, message, icon, type);
}


// ==========================================
// DYNAMIC DISPATCH ROUTER
// ==========================================
export function setupAdminDashboard() {
  const isMobile = document.body.classList.contains('mobile-app-container') || document.getElementById('btn-admin-logout');
  if (isMobile) {
    return setupMobileAdminDashboard();
  } else {
    return setupDesktopAdminDashboard();
  }
}

export async function loadAdminDashboardData() {
  const isMobile = document.body.classList.contains('mobile-app-container') || document.getElementById('btn-admin-logout');
  if (isMobile) {
    return loadMobileAdminDashboardData();
  } else {
    return loadDesktopAdminDashboardData();
  }
}
