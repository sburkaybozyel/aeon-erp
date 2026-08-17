import { state, logEvent, registerLoader } from '../state.js';

function setupDesktopGuestAdapter() {
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
      loadGuestDesktopAdapterData();
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
          loadGuestDesktopAdapterData();
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
              loadGuestDesktopAdapterData();
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
          loadGuestDesktopAdapterData();
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
          loadGuestDesktopAdapterData();
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
          loadGuestDesktopAdapterData();
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
          loadGuestDesktopAdapterData();
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

  registerLoader('loadGuestDesktopAdapterData', loadGuestDesktopAdapterData);
}

async function loadGuestDesktopAdapterData() {
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
