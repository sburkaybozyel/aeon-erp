import { state, logEvent } from '../state.js';
import { moduleTypeLabel, esc } from './utils.js';
import { loadAdminDashboardData } from './dispatch.js';

export function renderLiveManagementLists(rooms, tables, inventory, catalog) {
  // Rooms
  const roomsBody = document.getElementById('mgmt-rooms-tbody-live');
  if (roomsBody) {
    roomsBody.innerHTML = '';
    rooms.forEach(r => {
      const card = document.createElement('article');
      const occupied = r.status === 'occupied';
      card.className = `admin-room-management-card ${occupied ? 'occupied' : ''}`;
      card.innerHTML = `<div><span class="admin-room-number">Oda ${esc(r.room_number)}</span><strong>${esc(r.room_type || 'Standart')} · ${Number(r.capacity || 0)} kişi</strong><small>${esc(r.floor || '-')} . kat · ${r.status === 'clean_vacant' ? 'Temiz ve hazır' : esc(r.status)}</small></div><div class="admin-room-management-actions">${occupied ? '<span class="admin-guest-tag">Konaklıyor</span>' : ''}<a class="admin-quick-link" href="/staff-reception.html?tenant_id=${encodeURIComponent(state.currentTenant || 'restaurant_kitchen')}">Ön büro</a>${occupied ? '' : `<button class="btn btn-danger btn-xs" onclick="deleteRoomLive('${r.id}')"><i class="fa-solid fa-trash-can"></i></button>`}</div>`;
      roomsBody.appendChild(card);
    });
  }

  // Tables
  const tablesBody = document.getElementById('mgmt-tables-tbody-live');
  if (tablesBody) {
    tablesBody.innerHTML = '';
    tables.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(t.table_number)}</strong></td>
        <td>${esc(t.section)}</td>
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
      const stock = Number(i.stock || 0);
      const par = Number(i.par_level || 0);
      const isZero = stock <= 0;
      const isCritical = stock <= par && stock > 0;
      const purchaseUnit = i.purchase_unit || i.unit;
      const purchaseAmt = Number(i.purchase_unit_amount) || 1;
      const stockInPurchase = purchaseAmt > 1 ? ` (≈${(stock / purchaseAmt).toFixed(1)} ${purchaseUnit})` : '';
      const tr = document.createElement('tr');
      if (isZero) tr.style.background = '#fff0f0';
      else if (isCritical) tr.style.background = '#fff8e6';
      tr.innerHTML = `
        <td><strong>${esc(i.name)}</strong> <span class="text-muted small">(${moduleTypeLabel(i.module_type)})</span></td>
        <td><span style="font-weight:700;color:${isZero ? '#dc3545' : isCritical ? '#e67e22' : 'inherit'}">${stock.toFixed(1)}</span> ${i.unit}${stockInPurchase}</td>
        <td>${par}</td>
        <td>${i.unit}${purchaseAmt > 1 ? ` <small class="text-muted">(1 ${purchaseUnit} = ${purchaseAmt} ${i.unit})</small>` : ''}</td>
        <td>${Number(i.unit_cost || 0).toFixed(2)} TL</td>
        <td>
          <div style="display:flex;gap:4px;align-items:center;">
            <input type="number" min="0.1" step="0.1" value="1" style="width:55px;padding:3px 6px;border:1px solid #ddd;border-radius:6px;text-align:center;font-size:12px" class="admin-inv-add-qty" data-inv-id="${i.id}">
            <button class="btn btn-primary btn-xs admin-inv-add-btn" data-inv-id="${i.id}" title="Stok Ekle (+${purchaseUnit})"><i class="fa-solid fa-plus"></i></button>
            <button class="btn btn-xs admin-inv-edit-btn" data-inv-id="${i.id}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-xs" onclick="deleteInventoryLive('${i.id}')"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      `;
      invBody.appendChild(tr);
    });
    // Wire add-stock buttons
    invBody.querySelectorAll('.admin-inv-add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invId = btn.dataset.invId;
        const qtyInput = invBody.querySelector(`.admin-inv-add-qty[data-inv-id="${invId}"]`);
        const qty = Number(qtyInput?.value || 1);
        if (qty <= 0) return;
        try {
          const resp = await fetch('/api/inventory/add-stock?tenant_id=' + encodeURIComponent(window.__currentTenantId || 'restaurant_kitchen'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventory_id: invId, purchase_quantity: qty }) });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error);
          window.__aeonToast?.('Stok eklendi.', 'success');
          if (window.loadAdminDashboardData) window.loadAdminDashboardData();
        } catch (e) { window.__aeonToast?.(e.message, 'error'); }
      });
    });
    // Wire edit buttons
    invBody.querySelectorAll('.admin-inv-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const invId = btn.dataset.invId;
        const item = inventory.find(x => x.id === invId);
        if (!item) return;
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px 32px;width:min(420px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.2)">
          <h3 style="margin:0 0 16px"><i class="fa-solid fa-pen" style="color:#d8730b"></i> ${esc(item.name)} Düzenle</h3>
          <form id="admin-inv-edit-form">
            <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:600">Mevcut Stok (${item.unit})<input type="number" step="0.1" value="${stock}" name="stock" style="padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:600">Min. Stok<input type="number" step="0.1" value="${par}" name="par_level" style="padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:600">Birim Maliyet (₺)<input type="number" step="0.01" value="${Number(item.unit_cost||0)}" name="unit_cost" style="padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:600">Ambalaj Birimi<input type="text" value="${esc(item.purchase_unit||'')}" name="purchase_unit" placeholder="paket, şişe..." style="padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:13px;font-weight:600">1 Ambalaj = kaç ${item.unit}?<input type="number" step="0.1" value="${Number(item.purchase_unit_amount||0)}" name="purchase_unit_amount" style="padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
              <button type="button" class="btn" id="admin-inv-cancel">İptal</button>
              <button type="submit" class="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#admin-inv-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        modal.querySelector('#admin-inv-edit-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = {};
          for (const [k, v] of fd.entries()) body[k] = k === 'purchase_unit' ? v : Number(v);
          try {
            const resp = await fetch('/api/inventory/' + encodeURIComponent(invId) + '?tenant_id=' + encodeURIComponent(window.__currentTenantId || 'restaurant_kitchen'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            modal.remove();
            window.__aeonToast?.('Envanter güncellendi.', 'success');
            if (window.loadAdminDashboardData) window.loadAdminDashboardData();
          } catch (err) { window.__aeonToast?.(err.message, 'error'); }
        });
      });
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
        <td><strong>${esc(c.name)}</strong></td>
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
  catalog.filter(c => c.category === 'food' || c.category === 'drink' || c.category === 'minibar').forEach(c => {
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

export function setupLiveManagementForms() {
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
