
// ==========================================
// UNIFIED STAFF PORTAL & SIMULATOR ENGINE
// ==========================================

import { state, logEvent, registerLoader } from './state.js';
import { startRequestNotifications } from './request-notifications.js';

// Guest-facing endpoints accept unauthenticated free text (waiter_call, cleaning_request,
// maintenance_request, etc. details) with no server-side sanitization — always escape
// before interpolating into innerHTML.
function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

let staffDataPollTimer = null;
let staffDataLoadVersion = 0;

export function setupMobileStaffSimulator() {
  const btnSelectHk = document.getElementById('btn-select-hk');
  const btnSelectFb = document.getElementById('btn-select-fb');
  const btnSelectTech = document.getElementById('btn-select-tech');
  const btnStaffLogout = document.getElementById('btn-staff-logout');
  
  const btnHkExit = document.getElementById('btn-staff-hk-exit');
  const btnFbExit = document.getElementById('btn-staff-fb-exit');
  const btnInvExit = document.getElementById('btn-staff-inv-exit');

  const btnSelectInv = document.getElementById('btn-select-inv');
  if (btnSelectHk) btnSelectHk.addEventListener('click', () => switchStaffSubView('staff-view-hk'));
  if (btnSelectFb) btnSelectFb.addEventListener('click', () => switchStaffSubView('staff-view-fb'));
  if (btnSelectInv) btnSelectInv.addEventListener('click', () => switchStaffSubView('staff-view-inv'));
  if (btnStaffLogout) btnStaffLogout.addEventListener('click', () => {
    if (window.aeonLogout) return window.aeonLogout();
    state.activeStaff = null;
    state.activeStaff = null;
    updateActiveStaffLabels();
    window.location.replace(`/login.html?tenant_id=${state.currentTenant}`);
  });

  // Department screen back buttons (go back to department selection or logout based on role)
  const handleExitClick = () => {
    if (window.aeonLogout) return window.aeonLogout();
    state.activeStaff = null;
    state.activeStaff = null;
    updateActiveStaffLabels();
    window.location.replace(`/login.html?tenant_id=${state.currentTenant}`);
  };

  document.querySelectorAll('.btn-staff-logout-action').forEach(btn => {
    btn.addEventListener('click', handleExitClick);
  });

  if (btnHkExit) btnHkExit.addEventListener('click', handleExitClick);
  if (btnFbExit) btnFbExit.addEventListener('click', handleExitClick);
  if (btnInvExit) btnInvExit.addEventListener('click', handleExitClick);

  // Restaurant bottom navigation
  const restaurantTabs = ['tables', 'service', 'order'];
  restaurantTabs.forEach(tabName => {
    const button = document.getElementById(`nav-restaurant-tab-${tabName}`);
    if (button) button.addEventListener('click', (e) => {
      e.preventDefault();
      window.switchFbSubTab(tabName);
    });
  });

  // KDS Queue Tab switcher
  const btnTabOrderTables = document.getElementById('btn-tab-order-tables');
  const btnTabOrderRooms = document.getElementById('btn-tab-order-rooms');
  const sectionOrderTables = document.getElementById('section-order-tables');
  const sectionOrderRooms = document.getElementById('section-order-rooms');

  if (btnTabOrderTables && btnTabOrderRooms && sectionOrderTables && sectionOrderRooms) {
    btnTabOrderTables.addEventListener('click', () => {
      btnTabOrderTables.classList.add('active');
      btnTabOrderRooms.classList.remove('active');
      sectionOrderTables.style.display = 'block';
      sectionOrderRooms.style.display = 'none';
    });

    btnTabOrderRooms.addEventListener('click', () => {
      btnTabOrderRooms.classList.add('active');
      btnTabOrderTables.classList.remove('active');
      sectionOrderTables.style.display = 'none';
      sectionOrderRooms.style.display = 'block';
    });
  }

  // Reception Sub-Tab navigation
  const btnRecTabFeed = document.getElementById('nav-reception-tab-feed');
  const btnRecTabRooms = document.getElementById('nav-reception-tab-rooms');
  const btnRecTabActions = document.getElementById('nav-reception-tab-actions');

  if (btnRecTabFeed) btnRecTabFeed.addEventListener('click', (e) => { e.preventDefault(); window.switchReceptionSubTab('feed'); });
  if (btnRecTabRooms) btnRecTabRooms.addEventListener('click', (e) => { e.preventDefault(); window.switchReceptionSubTab('rooms'); });
  if (btnRecTabActions) btnRecTabActions.addEventListener('click', (e) => { e.preventDefault(); window.switchReceptionSubTab('actions'); });

  window.switchReceptionSubTab = (tabName) => {
    const tabs = ['feed', 'rooms', 'actions'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-reception-tab-${t}`);
      if (btn) btn.classList.remove('active');
      const view = document.getElementById(`reception-subview-${t}`);
      if (view) view.style.display = 'none';
    });
    const activeBtn = document.getElementById(`nav-reception-tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');
    const activeView = document.getElementById(`reception-subview-${tabName}`);
    if (activeView) activeView.style.display = 'block';
  };

  window.switchFbSubTab = (tabName) => {
    const tabs = ['tables', 'service', 'order'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-restaurant-tab-${t}`);
      if (btn) btn.classList.remove('active');
      const view = document.getElementById(`restaurant-subview-${t}`);
      if (view) {
        view.classList.remove('active-sub');
        view.style.display = 'none';
      }
    });

    const activeBtn = document.getElementById(`nav-restaurant-tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');
    const activeView = document.getElementById(`restaurant-subview-${tabName}`);
    if (activeView) {
      activeView.classList.add('active-sub');
      activeView.style.display = 'block';
    }
  };

  // Housekeeping Sub-Tab Navigation
  const btnHkTabRooms = document.getElementById('nav-hk-tab-rooms');
  const btnHkTabPublic = document.getElementById('nav-hk-tab-public');
  const btnHkTabLaundry = document.getElementById('nav-hk-tab-laundry');
  const btnHkTabLostFound = document.getElementById('nav-hk-tab-lostfound');

  if (btnHkTabRooms) btnHkTabRooms.addEventListener('click', (e) => { e.preventDefault(); window.switchHkSubTab('rooms'); });
  if (btnHkTabPublic) btnHkTabPublic.addEventListener('click', (e) => { e.preventDefault(); window.switchHkSubTab('public'); });
  if (btnHkTabLaundry) btnHkTabLaundry.addEventListener('click', (e) => { e.preventDefault(); window.switchHkSubTab('laundry'); });
  if (btnHkTabLostFound) btnHkTabLostFound.addEventListener('click', (e) => { e.preventDefault(); window.switchHkSubTab('lostfound'); });

  window.switchHkSubTab = (tabName) => {
    // Update active states on nav items
    const tabs = ['rooms', 'public', 'laundry', 'lostfound'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-hk-tab-${t}`);
      if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`nav-hk-tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Manually trigger the correct filter view based on the bottom nav
    if (tabName === 'public') {
      currentHkFilter = 'public_areas';
    } else if (tabName === 'laundry') {
      currentHkFilter = 'laundry';
    } else if (tabName === 'lostfound') {
      currentHkFilter = 'lostfound';
    } else {
      // Revert back to the previously selected rooms filter, or 'all' by default
      const topActive = document.querySelector('.hk-filter-btn.active');
      currentHkFilter = topActive ? topActive.getAttribute('data-filter') : 'all';
      if (['public_areas', 'laundry', 'lostfound'].includes(currentHkFilter)) currentHkFilter = 'all'; // safety fallback
    }
    
    // Always render with the new filter
    renderStaffHkPanel(state.rooms || [], state.requests || []);
  };

  // HK Minibar billing form submission
  const minibarForm = document.getElementById('form-staff-hk-minibar');
  if (minibarForm) {
    minibarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomId = document.getElementById('staff-hk-minibar-room').value;
      const itemId = document.getElementById('staff-hk-minibar-item').value;
      const qty = parseInt(document.getElementById('staff-hk-minibar-qty').value) || 1;
      
      const roomObj = state.roomsList?.find(r => r.id === roomId);
      const targetIdentifier = roomObj ? `Room-${roomObj.room_number}` : `Room-${roomId}`;

      try {
        const res = await fetch(`/api/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order',
            target_identifier: targetIdentifier,
            details: [{ itemId, quantity: qty }],
            payment_method: 'room_charge',
            created_by: getActiveStaffLabel()
          })
        });
        if (res.ok) {
          logEvent('event', `Mobil HK: Minibar tüketimi kaydedildi: <strong>${targetIdentifier}</strong>`);
          minibarForm.reset();
          loadStaffData();
          alert("Minibar tüketimi odaya başarıyla yansıtıldı.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global helper functions to window for onclick triggers
  window.staffCheckoutRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil HK: Oda çıkışı tamamlandı. Oda temizlik sırasına alındı.`);
        if (state.featureFlags.MODULE_PRINTER) {
          const roomObj = state.roomsList?.find(r => r.id === roomId);
          const roomNum = roomObj ? roomObj.room_number : roomId;
          alert(`[Yazıcı Çıktısı] Check-out Fişi / Hesap Folyosu Gönderildi!\nOda: ${roomNum}`);
        }
        loadStaffData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffSetRoomClean = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'cleaning', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil HK: Temizlik tamamlandı, kalite incelemesi bekleniyor.`);
        loadStaffData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffResolveMaintenance = async (roomId) => {
    try {
      const list = await fetch('/api/maintenance');
      if (!list.ok) throw new Error('maintenance_list_failed');
      const payload = await list.json();
      const ticket = (payload.maintenance || []).find(item => item.room_id === roomId && !['resolved', 'cancelled'].includes(item.status));
      if (!ticket) throw new Error('maintenance_ticket_missing');
      const res = await fetch(`/api/maintenance/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      if (res.ok) {
        logEvent('event', `Mobil Teknik: Arıza giderildi, temizlik sırasına alındı.`);
        loadStaffData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffUpdateKdsStatus = async (requestId, status, reason = null) => {
    try {
      const payload = { requestId, status, completed_by: getActiveStaffLabel() };
      if (reason) payload.reason = reason;

      const res = await fetch(`/api/requests/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        logEvent('event', `Mobil KDS: Sipariş durumu güncellendi: <strong>${status}</strong> (#${requestId})`);
        loadStaffData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffCompleteTask = async (requestId) => {
    try {
      const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: 'completed', completed_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil Görev: Personel iş görevini tamamladı. (#${requestId})`);
        loadStaffData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.markRoomClean = window.staffSetRoomClean;
  window.fulfillRequest = window.staffCompleteTask;

  let inspectingRoomId = null;

  window.inspectRoom = async (roomId) => {
    inspectingRoomId = roomId;
    
    // Clear checklist
    document.querySelectorAll('.hk-check-item').forEach(cb => cb.checked = false);
    document.getElementById('hk-checklist-notes').value = '';
    
    document.getElementById('hk-checklist-modal').style.display = 'flex';
  };

  window.modalSubmitInspection = async () => {
    if (!inspectingRoomId) return;

    // Collect checklist values
    const checks = Array.from(document.querySelectorAll('.hk-check-item'))
                       .filter(cb => cb.checked)
                       .map(cb => cb.value);
    
    let checklistStr = checks.length > 0 ? checks.join(', ') : 'Kontrol listesi boş/tamamlanmadı';
    const notes = document.getElementById('hk-checklist-notes').value;
    if (notes) checklistStr += ` | Not: ${notes}`;

    try {
      const res = await fetch(`/api/rooms/inspect?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: inspectingRoomId, inspected_by: getActiveStaffLabel(), checklist: checklistStr })
      });
      if (res.ok) {
        logEvent('event', `HK: Oda kalite incelemesi tamamlandı. (${inspectingRoomId})`);
        document.getElementById('hk-checklist-modal').style.display = 'none';
        inspectingRoomId = null;
        if (window.showSuccessOverlay) window.showSuccessOverlay('İNCELENDİ', 'Oda onaylandı ✓');
        loadStaffData();
      }
    } catch (err) { console.error(err); }
  };

  window.markPublicAreaClean = async (id) => {
    try {
      const res = await fetch(`/api/public_areas/clean?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, staff_name: getActiveStaffLabel() })
      });
      if (res.ok) {
        if (window.showSuccessOverlay) window.showSuccessOverlay('TEMİZ', 'Alan temizlendi ✓');
        loadStaffData();
      }
    } catch (err) { console.error(err); }
  };

  window.markPublicAreaDirty = async (id) => {
    try {
      const res = await fetch(`/api/public_areas/dirty?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, staff_name: getActiveStaffLabel() })
      });
      if (res.ok) {
        if (window.showSuccessOverlay) window.showSuccessOverlay('KİRLİ', 'Alan kirlendi');
        loadStaffData();
      }
    } catch (err) { console.error(err); }
  };

  // Initial loading
  updateActiveStaffLabels();
  startRequestNotifications({ surface: 'staff' });
  const existingStaff = state.activeStaff;
  if (existingStaff) setupStaffPushNotifications(existingStaff);
  
  if (existingStaff) {
    state.activeStaff = existingStaff;
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get('tenant_id') || 'default';
    if (existingStaff.role === 'Yönetici' || existingStaff.role === 'Manager') {
      window.location.href = `admin_mobile.html?tenant_id=${tenantId}`;
    } else {
      updateActiveStaffLabels();
      const targetView = getStaffDefaultView(existingStaff.role, existingStaff.department);
      switchStaffSubView(targetView);
    }
  } else {
    document.body.className = 'mobile-app-container';
  }
  
  loadStaffData();
  if (!staffDataPollTimer) {
    staffDataPollTimer = setInterval(loadStaffData, 3500);
  }
}

async function setupStaffPushNotifications(staff) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, staff })
    });
  } catch (err) {
    console.error('Push setup failed:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getActiveStaffLabel() {
  const staff = state.activeStaff;
  if (!staff) return null;
  if (staff.role === 'Genel' || staff.name === 'Genel Personel') {
    return 'Reception Portal';
  }
  return `${staff.name} (${staff.role})`;
}

function getStaffDefaultView(role, department) {
  const r = role || '';
  const d = department || '';
  if (r === 'Housekeeping' || r === 'Kat Hizmetleri' || d === 'Housekeeping') {
    return 'staff-view-hk';
  }
  if (r === 'Waiter' || r === 'Servis' || d === 'Restaurant') {
    return 'staff-view-restaurant';
  }
  if (r === 'Chef' || r === 'Mutfak' || r === 'Stok' || r === 'Inventory' || d === 'Kitchen') {
    return 'staff-view-kitchen';
  }
  if (r === 'Maintenance' || r === 'Teknik' || d === 'Maintenance') {
    return 'staff-view-tech';
  }
  if (r === 'Reception' || r === 'Resepsiyon' || d === 'Reception' || r === 'Genel') {
    return 'staff-view-reception';
  }
  return 'staff-view-reception';
}

function updateActiveStaffLabels() {
  const staff = state.activeStaff;
  let label = 'Oturum yok';
  if (staff) {
    if (staff.role === 'Genel' || staff.name === 'Genel Personel') {
      label = 'Reception Portal';
    } else {
      label = `${staff.name} (${staff.role})`;
    }
  }
  document.querySelectorAll('[data-active-staff-label]').forEach(el => {
    el.textContent = label;
  });

  const isGenel = !staff || staff.role === 'Genel';
  const exitButtons = [
    { id: 'btn-staff-hk-exit', color: '#15803d', border: 'rgba(34, 197, 94, 0.3)' },
    { id: 'btn-staff-fb-exit', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' },
    { id: 'btn-staff-inv-exit', color: '#2dd4bf', border: 'rgba(20, 184, 166, 0.4)' }
  ];

  exitButtons.forEach(btnInfo => {
    const btn = document.getElementById(btnInfo.id);
    if (btn) {
      if (isGenel) {
        btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Kokpit';
        btn.style.color = btnInfo.color;
        btn.style.borderColor = btnInfo.border;
      } else {
        btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Çıkış Yap';
        btn.style.color = 'var(--color-danger)';
        btn.style.borderColor = 'rgba(220, 53, 69, 0.3)';
      }
    }
  });
}

function switchStaffSubView(viewId) {
  document.body.className = `mobile-app-container`;

  document.querySelectorAll('.guest-subview').forEach(v => {
    v.classList.remove('active');
  });
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
  updateActiveStaffLabels();
  loadStaffData();
}

export async function loadStaffData() {
  try {
    const loadVersion = ++staffDataLoadVersion;
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const contextRes = await fetch(`/api/operations/context${tenantParam}`);
    if (!contextRes.ok) throw new Error(`Operations context failed (${contextRes.status})`);
    const context = await contextRes.json();
    const rooms = context.rooms || [];
    const tables = context.tables || [];
    const requests = context.requests || [];
    const inventory = context.inventory || [];
    const catalog = context.catalog || [];
    const publicAreas = context.publicAreas || [];
    const [lauRes, lafRes] = await Promise.all([
      fetch(`/api/hk/laundry${tenantParam}`),
      fetch(`/api/hk/lost-found${tenantParam}`)
    ]);
    const laundry = lauRes.ok ? await lauRes.json() : [];
    const lostfound = lafRes.ok ? await lafRes.json() : [];

    if (loadVersion !== staffDataLoadVersion) return;

    state.roomsList = rooms;
    state.availableCatalog = catalog;
    state.inventoryList = inventory;
    state.tablesList = tables;
    state.publicAreas = publicAreas;
    state.laundryOrders = laundry;
    state.lostFoundItems = lostfound;
    
    // Feature flags for mobile view
    if (!state.featureFlags) state.featureFlags = {};
    state.featureFlags.MODULE_POOL = false; // Disabled for demo, enable when hotel has a pool
    
    window.__aeonLastInventory = inventory;

    renderStaffDashboardBadges(rooms, requests, inventory);
    
    // Load shift notes for Reception
    loadShiftNotes();

    renderDesktopStaffHkPanel(rooms, requests);
    renderStaffRestaurantPanel(requests, tables);
    renderStaffKitchenPanel(requests);
    renderDesktopStaffTechPanel(rooms, requests);
    renderStaffReceptionPanel(requests, rooms);
    renderReceptionRoomsGrid(rooms);
    if (window.renderReceptionRoomsGrid) window.renderReceptionRoomsGrid(rooms);
    populateFbOrderForm(rooms, catalog, tables);
    if (window.renderStaffInvPanel) window.renderStaffInvPanel(inventory);
    if (window.renderKitchenMenuPanel) window.renderKitchenMenuPanel(catalog);
    if (window.renderKitchenTablesPanel) window.renderKitchenTablesPanel(tables, requests);
  } catch (err) {
    console.error("Error loading staff data:", err);
  }
}

function renderStaffDashboardBadges(rooms, requests, inventory) {
  const dirtyCount = rooms.filter(r => r.status === 'dirty_vacant').length;
  const brokenCount = rooms.filter(r => r.ac_status === 'broken').length;
  const activeOrdersCount = requests.filter(r => r.type === 'order' && r.status !== 'completed').length;
  
  // Calculate critical stock alerts (stock < par_level)
  const criticalStockCount = inventory ? inventory.filter(item => item.stock < item.par_level).length : 0;

  // 1. Selector screen labels
  const labelHk = document.getElementById('staff-badge-hk-dirty');
  if (labelHk) labelHk.innerHTML = `<strong>${dirtyCount} Kirli / ${brokenCount} Arızalı</strong> Oda`;

  const labelFb = document.getElementById('staff-badge-fb-orders');
  if (labelFb) labelFb.innerHTML = `<strong>${activeOrdersCount} Aktif KDS</strong> Siparişi`;

  const labelInv = document.getElementById('staff-badge-inv-alerts');
  if (labelInv) labelInv.innerHTML = `<strong>${criticalStockCount} Malzeme</strong> Par Seviyesi Altında`;

  // 2. Summary badges in headers
  const badgeHk = document.getElementById('hk-summary-badge');
  if (badgeHk) badgeHk.textContent = `${dirtyCount} Kirli / ${brokenCount} Arızalı`;

  const badgeFb = document.getElementById('fb-summary-badge');
  if (badgeFb) badgeFb.textContent = `${activeOrdersCount} Sipariş`;

  const badgeInv = document.getElementById('inv-summary-badge');
  if (badgeInv) badgeInv.textContent = `${criticalStockCount} Kritik`;
}

let currentHkFilter = 'all';

function renderDesktopStaffHkPanel(rooms, requests) {
  // ── Metrics ──────────────────────────────────────────────────────────────
  const dirtyRooms    = rooms.filter(r => r.status === 'dirty_vacant');
  const cleanRooms    = rooms.filter(r => r.status === 'clean_vacant');
  const dndRooms      = rooms.filter(r => r.dnd_active);
  const activeHkReqs  = requests.filter(r =>
    r.status !== 'completed' && r.status !== 'rejected' &&
    ['towel_request','cleaning_request','water_request','amenity_request','laundry','lost_and_found'].includes(r.type)
  );

  const elDirty = document.getElementById('hk-metric-dirty');
  const elReq   = document.getElementById('hk-metric-requests');
  const elClean = document.getElementById('hk-metric-clean');
  if (elDirty) elDirty.textContent = dirtyRooms.length;
  if (elReq)   elReq.textContent   = activeHkReqs.length;
  if (elClean) elClean.textContent  = cleanRooms.length;

  // ── Filter Buttons ────────────────────────────────────────────────────────
  const filterBtns = document.querySelectorAll('.hk-filter-btn');
  filterBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const target = e.currentTarget;
      filterBtns.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      currentHkFilter = target.getAttribute('data-filter');
      
      renderStaffHkPanel(rooms, requests);
    };
  });

  const list = document.getElementById('staff-hk-rooms-list');
  if (!list) return;
  list.innerHTML = '';
  list.className = 'card-grid-mobile';
  
  // Conditionally hide/show the grids and the top filters/metrics based on the current filter
  const mainPublicList = document.getElementById('staff-hk-public-list');
  const mainLaundryList = document.getElementById('staff-hk-laundry-list');
  const mainLostFoundList = document.getElementById('staff-hk-lostfound-list');
  const hkFiltersWrapper = document.getElementById('hk-filters-wrapper');
  
  // Hide everything first
  list.style.display = 'none';
  if (mainPublicList) mainPublicList.style.display = 'none';
  if (mainLaundryList) mainLaundryList.style.display = 'none';
  if (mainLostFoundList) mainLostFoundList.style.display = 'none';
  if (hkFiltersWrapper) hkFiltersWrapper.style.display = 'none';

  if (currentHkFilter === 'public_areas') {
    if (mainPublicList) mainPublicList.style.display = 'grid';
  } else if (currentHkFilter === 'laundry') {
    if (mainLaundryList) mainLaundryList.style.display = 'grid';
    renderLaundryList();
  } else if (currentHkFilter === 'lostfound') {
    if (mainLostFoundList) mainLostFoundList.style.display = 'grid';
    renderLostFoundList();
  } else {
    list.style.display = 'grid'; 
    if (hkFiltersWrapper) hkFiltersWrapper.style.display = 'block';
  }
  
  list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(155px, 1fr))';

  // ── Filter Logic ──────────────────────────────────────────────────────────
  let itemsToShow = [];
  const guestReqs = requests.filter(r =>
    r.status !== 'completed' && r.status !== 'rejected' &&
    ['towel_request','cleaning_request','water_request','amenity_request'].includes(r.type)
  );

  if (currentHkFilter === 'all') {
    rooms.forEach(room => {
      const roomReqs = guestReqs.filter(r => r.target_identifier === `Room-${room.room_number}`);
      itemsToShow.push({ type: 'room', data: room, reqs: roomReqs });
    });
  } else if (currentHkFilter === 'dirty') {
    rooms.filter(r => r.status === 'dirty_vacant').forEach(room => {
      itemsToShow.push({ type: 'room', data: room, reqs: [] });
    });
  } else if (currentHkFilter === 'dnd') {
    rooms.filter(r => r.dnd_active).forEach(room => {
      itemsToShow.push({ type: 'room', data: room, reqs: [] });
    });
  } else if (currentHkFilter === 'requests') {
    guestReqs.forEach(req => itemsToShow.push({ type: 'request', data: req }));
  } else if (currentHkFilter === 'inspect') {
    rooms.filter(r => r.status === 'clean_vacant' && r.eta !== 'İncelendi ✓').forEach(room => {
      itemsToShow.push({ type: 'room', data: room, reqs: [], needsInspect: true });
    });
  }
  // ── Public Areas Rendering ──────────────────────────────────────────────────
  const publicAreaList = document.getElementById('staff-hk-public-list');
  if (publicAreaList) {
    publicAreaList.innerHTML = '';
    const publicAreas = state.publicAreas || [];
    
    if (publicAreas.length === 0) {
      publicAreaList.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
        <i class="fa-solid fa-check-circle" style="font-size:48px; color:var(--color-success); opacity:0.5; display:block; margin-bottom:16px;"></i>
        <div style="font-weight:600; font-size:16px;">Henüz Genel Alan Tanımlanmamış</div>
      </div>`;
    } else {
      publicAreas.forEach(p => {
        const isDirty = p.status === 'dirty';
        const card = document.createElement('div');
        card.className = 'card-mobile';
        card.style.minHeight = '160px';
        card.style.padding = '14px';
        card.innerHTML = `
          <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:6px; text-align:center;">
            <div style="font-size:22px; color: ${isDirty ? 'var(--color-danger)' : 'var(--color-success)'}">
              <i class="fa-solid ${isDirty ? 'fa-broom' : 'fa-check-circle'}"></i>
            </div>
            <div style="font-size:14px; font-weight:800; color:var(--color-text-main);">${p.name}</div>
            <div style="font-size:12px; font-weight:700; color:${isDirty ? 'var(--color-danger)' : 'var(--color-success)'};">${isDirty ? 'Kirli' : 'Temiz'}</div>
            ${p.last_cleaned_at ? `<div style="font-size:9px; color:var(--color-text-muted);">Son: ${new Date(p.last_cleaned_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</div>` : ''}
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = isDirty ? 'btn btn-success' : 'btn btn-danger';
        btn.style.cssText = 'padding:8px; font-size:11px; border-radius:8px; width:100%; margin-top:auto;';
        btn.innerHTML = isDirty ? '<i class="fa-solid fa-check"></i> Temizle' : '<i class="fa-solid fa-broom"></i> Kirlendi';
        btn.onclick = (e) => { 
          e.stopPropagation(); 
          isDirty ? window.markPublicAreaClean(p.id) : window.markPublicAreaDirty(p.id); 
        };
        card.appendChild(btn);
        publicAreaList.appendChild(card);
      });
    }
  }

  // ── Rooms Rendering ─────────────────────────────────────────────────────────
  const nonRoomTabs = ['public_areas', 'laundry', 'lostfound'];
  if (!nonRoomTabs.includes(currentHkFilter) && itemsToShow.length === 0) {
    list.style.display = 'block';
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-check-circle" style="font-size:48px; color:var(--color-success); opacity:0.5; display:block; margin-bottom:16px;"></i>
      <div style="font-weight:600; font-size:16px;">Her Şey Tamam!</div>
    </div>`;
    return;
  } else if (nonRoomTabs.includes(currentHkFilter)) {
    return; // Don't render rooms or empty states for rooms if we are on non-room tabs
  }

  // ── Card Rendering ─────────────────────────────────────────────────────────
  itemsToShow.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card-mobile';
    card.style.minHeight = '160px';
    card.style.padding = '14px';

    if (item.type === 'room') {
      const room = item.data;
      const hasReq = item.reqs && item.reqs.length > 0;
      const isDND  = !!room.dnd_active;
      const isVIP  = !!room.is_vip;

      let statusColor = 'var(--color-success)';
      let statusText  = 'Temiz';
      let icon        = 'fa-check';
      if (room.status === 'dirty_vacant')  { statusColor = 'var(--color-danger)';  statusText = 'Kirli';  icon = 'fa-broom'; }
      else if (room.status === 'occupied') { statusColor = 'var(--color-primary)'; statusText = 'Dolu';   icon = 'fa-bed'; }
      else if (room.status === 'maintenance') { statusColor = 'var(--color-warning)'; statusText = 'Bakım'; icon = 'fa-wrench'; }

      // Badges row
      let badges = '';
      if (isDND)   badges += `<span style="background:var(--color-danger); color:white; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:700; margin-right:4px;">🚫 DND</span>`;
      if (isVIP)   badges += `<span style="background:#d4af37; color:#111; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:700; margin-right:4px;">⭐ VIP</span>`;
      if (hasReq)  badges += `<span style="background:var(--color-warning); color:#111; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:700;">🔔 ${item.reqs.length}</span>`;
      if (room.eta === 'İncelendi ✓') badges += `<span style="background:var(--color-success); color:white; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:700;">✅ OK</span>`;

      card.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:6px;">
          <div style="font-size:16px; font-weight:900; color:var(--color-text-main); text-align:center; line-height:1.2;">${room.room_number}</div>
          <div style="color:${statusColor}; font-size:13px; font-weight:700; display:flex; align-items:center; gap:4px;">
            <i class="fa-solid ${icon}"></i> ${statusText}
          </div>
          ${badges ? `<div style="display:flex; flex-wrap:wrap; gap:3px; justify-content:center; margin-top:2px;">${badges}</div>` : ''}
        </div>
      `;

      // Action button area
      const actions = document.createElement('div');
      actions.style.width = '100%';
      actions.style.marginTop = 'auto';
      actions.style.display = 'flex';
      actions.style.flexDirection = 'column';
      actions.style.gap = '6px';

      if (isDND) {
        actions.innerHTML += `<div style="font-size:10px; color:var(--color-danger); text-align:center; font-weight:700;">Rahatsız Etme</div>`;
      } else if (room.status === 'dirty_vacant') {
        actions.innerHTML += `<button onclick="window.markRoomClean('${room.id}'); event.stopPropagation();" class="btn btn-success" style="padding:8px; font-size:11px; border-radius:8px; width:100%;"><i class="fa-solid fa-check"></i> Temizle</button>`;
      } else if (item.needsInspect) {
        actions.innerHTML += `<button onclick="window.inspectRoom('${room.id}'); event.stopPropagation();" class="btn btn-warning" style="padding:8px; font-size:11px; border-radius:8px; width:100%; color:#111;"><i class="fa-solid fa-clipboard-check"></i> İncele</button>`;
      } else if (hasReq) {
        actions.innerHTML += `<button onclick="openRoomDetailModal('${room.id}'); event.stopPropagation();" class="btn btn-warning" style="padding:8px; font-size:11px; border-radius:8px; width:100%; color:#111;"><i class="fa-solid fa-bell"></i> Talebi Gör</button>`;
      } else {
        actions.innerHTML += `<button onclick="openRoomDetailModal('${room.id}'); event.stopPropagation();" class="btn btn-secondary" style="padding:8px; font-size:11px; border-radius:8px; width:100%;"><i class="fa-solid fa-ellipsis"></i> Detay</button>`;
      }
      card.appendChild(actions);

    } else if (item.type === 'request') {
      const r = item.data;
      const typeMap = { towel_request:'Havlu', water_request:'Su', cleaning_request:'Temizlik', amenity_request:'Malzeme' };
      card.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:6px; text-align:center;">
          <div style="font-size:22px;">🔔</div>
          <div style="font-size:14px; font-weight:800; color:var(--color-text-main);">${r.target_identifier?.replace('Room-','Oda ')}</div>
          <div style="font-size:12px; font-weight:700; color:var(--color-warning);">${typeMap[r.type] || r.type}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'padding:8px; font-size:11px; border-radius:8px; width:100%; margin-top:auto;';
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Tamamla';
      btn.onclick = (e) => { e.stopPropagation(); window.fulfillRequest(r.id); };
      card.appendChild(btn);
    }

    list.appendChild(card);
  });

  // Populate minibar room select dropdown (kept for legacy support on minibar form)
  const roomSelect = document.getElementById('staff-hk-minibar-room');
  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">Oda Seçin...</option>';
    rooms.filter(r => r.status === 'occupied').forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `Oda ${r.room_number}`;
      roomSelect.appendChild(opt);
    });
  }

  // Populate minibar items select dropdown (kept for legacy support on minibar form)
  const itemSelect = document.getElementById('staff-hk-minibar-item');
  if (itemSelect) {
    itemSelect.innerHTML = '<option value="">Ürün...</option>';
    state.availableCatalog?.filter(c => c.category === 'minibar').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.price} TL)`;
      itemSelect.appendChild(opt);
    });
  }
}

window.renderLaundryList = () => {
  const list = document.getElementById('staff-hk-laundry-list');
  if (!list) return;
  list.innerHTML = '';
  const orders = state.laundryOrders || [];

  if (orders.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-shirt" style="font-size:48px; color:var(--color-primary); opacity:0.5; display:block; margin-bottom:16px;"></i>
      <div style="font-weight:600; font-size:16px;">Çamaşır Talebi Yok</div>
    </div>`;
  } else {
    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'card-mobile';
      card.style.padding = '14px';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:var(--color-primary);">Oda ${order.room_id}</strong>
          <span style="font-size:11px; background:var(--color-warning); padding:2px 6px; border-radius:10px;">${order.status}</span>
        </div>
        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">${order.guest_name || 'Bilinmiyor'}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${order.items}</div>
        <div style="font-size:10px; color:var(--text-muted); text-align:right;">${new Date(order.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</div>
      `;
      list.appendChild(card);
    });
  }
};

window.renderLostFoundList = () => {
  const list = document.getElementById('staff-hk-lostfound-list');
  if (!list) return;
  list.innerHTML = '';
  const items = state.lostFoundItems || [];

  if (items.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-box-archive" style="font-size:48px; color:var(--color-primary); opacity:0.5; display:block; margin-bottom:16px;"></i>
      <div style="font-weight:600; font-size:16px;">Kayıp Eşya Kaydı Yok</div>
    </div>`;
  } else {
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card-mobile';
      card.style.padding = '14px';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:var(--color-danger);">${item.item_name}</strong>
          <span style="font-size:11px; background:var(--color-warning); padding:2px 6px; border-radius:10px;">${item.status}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;"><i class="fa-solid fa-location-dot"></i> ${item.found_location}</div>
        <div style="font-size:12px; margin-bottom:8px;">${item.description || ''}</div>
        <div style="font-size:10px; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>Bulan: ${item.reported_by}</span>
          <span>${new Date(item.found_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }
};

function renderStaffTablesGrid(tables, requests) {
  const grid = document.getElementById('staff-restaurant-tables-grid');
  if (!grid) return;
  grid.innerHTML = '';

  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
  grid.style.gap = '14px';

  const sortedTables = [...tables].sort((a, b) => tableNumberValue(a) - tableNumberValue(b));
  sortedTables.forEach(table => {
    // Find active requests for this table
    const tableRequests = requests.filter(r => 
      r.target_identifier === `Table-${table.table_number}` && 
      r.status !== 'completed' &&
      r.status !== 'rejected' &&
      r.status !== 'cancelled'
    );

    // Check if table has waiter call, bill call, or orders
    const hasWaiterCall = tableRequests.some(r => r.type === 'waiter_call');
    const hasBillCall = tableRequests.some(r => r.type === 'bill_call');
    const orderRequests = tableRequests.filter(r => r.type === 'order');
    const hasOrder = orderRequests.length > 0;

    let orderItemsCount = 0;
    orderRequests.forEach(req => {
      try {
        const details = JSON.parse(req.details);
        if (Array.isArray(details)) {
          details.forEach(item => orderItemsCount += (item.quantity || 1));
        }
      } catch(e) {}
    });

    let statusClass = 'room-clean';
    let statusLabel = 'Boş / Müsait';

    if (hasWaiterCall) {
      statusClass = 'room-maintenance';
      statusLabel = '🛎️ Çağrı!';
    } else if (hasBillCall) {
      statusClass = 'room-maintenance';
      statusLabel = '💵 Hesap!';
    } else if (hasOrder) {
      statusClass = 'room-occupied';
      statusLabel = '🍳 Aktif Sipariş';
    } else if (table.status === 'occupied') {
      statusClass = 'room-occupied';
      statusLabel = 'Dolu';
    }

    const card = document.createElement('div');
    card.className = `aeon-card entity-card ${statusClass}`;
    card.style.cursor = 'pointer';
    card.style.background = 'var(--bg-card)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.boxShadow = 'var(--shadow-premium)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.minHeight = '0';
    card.style.aspectRatio = '1 / 1';
    
    // Clicking a table card opens the active account/payment detail when available.
    card.addEventListener('click', () => {
      window.openTableDetailModal(table, requests);
    });

    let badgesHtml = '';
    if (hasWaiterCall) badgesHtml += '<i class="fa-solid fa-bell text-danger"></i> ';
    if (hasBillCall) badgesHtml += '<i class="fa-solid fa-money-bill-wave text-info"></i> ';

    let bottomInfo = '';
    if (orderItemsCount > 0) {
      bottomInfo = `<div style="font-size:10px; color:var(--text-muted); margin-top:8px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 8px;">
        <i class="fa-solid fa-utensils"></i> ${orderItemsCount} Ürün Hazırlanıyor
      </div>`;
    }

    card.innerHTML = `
      <div class="aeon-card-content" style="padding: 10px; gap: 6px;">
        <div class="flex-between" style="align-items: flex-start; width: 100%;">
          <div style="font-size:14px; font-weight:800; color: var(--color-primary); line-height: 1;">${table.table_number}</div>
          <div style="display:flex; gap:4px; font-size:12px;">${badgesHtml}</div>
        </div>
        <div style="margin-top:auto;">
          <div class="card-desc" style="font-size:10px; font-weight:700; margin-top:4px; opacity:0.9;">${statusLabel}</div>
          ${bottomInfo}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function tableNumberValue(table) {
  const match = String(table?.table_number || '').match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

window.openTableDetailModal = (table, requests = state.requestsList || []) => {
  const modal = document.getElementById('table-detail-modal');
  const ordersContainer = document.getElementById('table-detail-orders');
  const totalEl = document.getElementById('table-detail-total');
  const paymentButton = document.getElementById('btn-collect-table-payment');
  if (!modal || !ordersContainer || !totalEl || !paymentButton) return;

  const target = `Table-${table.table_number}`;
  const activeRequests = requests.filter(req =>
    req.target_identifier === target &&
    req.status !== 'completed' &&
    req.status !== 'rejected' &&
    req.status !== 'cancelled'
  );
  const activeOrders = activeRequests.filter(req => req.type === 'order');
  const total = activeOrders.reduce((sum, req) => sum + (Number(req.total_amount) || 0), 0);
  window.activeTablePayment = { tableNumber: table.table_number };
  document.getElementById('table-detail-title').textContent = `Masa ${table.table_number}`;
  ordersContainer.innerHTML = activeOrders.length ? activeOrders.map(order => `
    <div style="padding:10px; background:var(--bg-app); border:1px solid var(--border-glass); border-radius:8px;">
      <div style="font-size:12px; font-weight:700;">${formatStaffRequestDetails(order.details)}</div>
      <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:11px; color:var(--text-muted);">
        <span>${order.status === 'pending' ? 'Bekliyor' : order.status === 'preparing' ? 'Hazırlanıyor' : order.status === 'ready' ? 'Servise Hazır' : order.status}</span>
        <strong>${(Number(order.total_amount) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</strong>
      </div>
    </div>
  `).join('') : '<div class="text-muted text-center" style="padding:20px 0;">Bu masada aktif sipariş yok.</div>';
  totalEl.textContent = `${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;
  paymentButton.disabled = activeRequests.length === 0;
  paymentButton.textContent = activeRequests.length ? 'Ödemeyi Al ve Masayı Kapat' : 'Aktif Hesap Yok';
  modal.style.display = 'flex';
};

window.closeTableDetailModal = () => {
  const modal = document.getElementById('table-detail-modal');
  if (modal) modal.style.display = 'none';
};

window.collectTablePayment = async () => {
  const payment = document.getElementById('table-payment-method')?.value || 'cash';
  const active = window.activeTablePayment;
  if (!active?.tableNumber) return;
  const button = document.getElementById('btn-collect-table-payment');
  if (button) {
    button.disabled = true;
    button.textContent = 'Kaydediliyor...';
  }
  try {
    const response = await fetch('/api/tables/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_number: active.tableNumber,
        completed_by: getActiveStaffLabel(),
        payment_method: payment
      })
    });
    if (!response.ok) throw new Error('Ödeme kaydı başarısız');
    window.closeTableDetailModal();
    await loadStaffData();
    alert('Ödeme kaydedildi, siparişler tamamlandı ve masa kapatıldı.');
  } catch (error) {
    console.error(error);
    if (button) {
      button.disabled = false;
      button.textContent = 'Ödemeyi Al ve Masayı Kapat';
    }
    alert('Ödeme kaydedilemedi. Lütfen tekrar deneyin.');
  }
};

window.promptKdsRejection = (id) => {
  const reason = prompt('İptal/Reddetme sebebi nedir? (Örn: Malzeme Bitti)');
  if (reason !== null && reason.trim() !== '') {
    window.staffUpdateKdsStatus(id, 'rejected', reason.trim());
  }
};

function createKdsOrderCard(order) {
  const card = document.createElement('div');
  card.className = `aeon-card status-${order.status} aeon-card`;
  card.style.margin = '0';
  card.style.boxShadow = 'var(--shadow-premium)';
  card.style.border = '1px solid var(--border-glass)';
  card.style.background = 'var(--bg-card)';
  card.style.textAlign = 'left';
  card.style.padding = '16px';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  
  let itemsListHtml = '';
  try {
    const items = JSON.parse(order.details);
    if (Array.isArray(items)) {
      itemsListHtml = items.map(i => {
        const isStarter = i.name.toUpperCase().includes('[BAŞLANGIÇ]');
        const nameClean = i.name.replace(/\s*\[BAŞLANGIÇ\]\s*/i, '');
        return `<div style="padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.1); font-size:13px;">
          ${isStarter ? '<span style="color:#d97706; font-weight:bold; margin-right:4px;">[Başlangıç]</span>' : ''}
          <strong style="color:var(--color-primary);">${esc(i.quantity || 1)}x</strong> ${esc(nameClean)}
        </div>`;
      }).join('');
    }
  } catch (e) {
    itemsListHtml = `<div style="padding: 6px 0; font-size:13px;">${esc(order.details)}</div>`;
  }

  const orderTimeMs = new Date(order.created_at).getTime();
  const nowMs = new Date().getTime();
  const minsPassed = Math.floor((nowMs - orderTimeMs) / 60000);
  const isDelayed = minsPassed >= 15;
  const timeColor = isDelayed ? 'var(--color-danger)' : 'var(--text-muted)';
  const timeIcon = isDelayed ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-regular fa-clock"></i>';

  let actionBtnHtml = '';
  if (order.status === 'pending') {
    actionBtnHtml = `
      <div style="display:flex; gap:8px;">
        <button class="btn btn-accent btn-xs" style="flex:1; border-radius:8px; font-weight:bold; padding:10px; font-size:13px;" onclick="staffUpdateKdsStatus('${order.id}', 'preparing')">Hazırlamaya Başla</button>
        <button class="btn btn-success btn-xs" style="flex:1; border-radius:8px; opacity:0.9; font-weight:bold; padding:10px; font-size:13px;" onclick="staffUpdateKdsStatus('${order.id}', 'ready')">Direkt Hazır</button>
      </div>
      <button class="btn btn-secondary btn-xs" style="width:100%; border-radius:8px; margin-top:8px; color:var(--color-danger); font-weight:bold; padding:8px;" onclick="promptKdsRejection('${order.id}')">İptal / Reddet</button>
    `;
  } else if (order.status === 'preparing') {
    actionBtnHtml = `
      <button class="btn btn-success btn-xs" style="width:100%; border-radius:8px; font-weight:bold; padding:10px; font-size:13px;" onclick="staffUpdateKdsStatus('${order.id}', 'ready')"><i class="fa-solid fa-bell-concierge"></i> Hazır / Servise Çıkar</button>
      <button class="btn btn-secondary btn-xs" style="width:100%; border-radius:8px; margin-top:8px; color:var(--color-danger); font-weight:bold; padding:8px;" onclick="promptKdsRejection('${order.id}')">İptal / Reddet</button>
    `;
  } else if (order.status === 'ready') {
    actionBtnHtml = `<button class="btn btn-primary btn-xs" style="width:100%; border-radius:8px; font-weight:bold; padding:10px; font-size:13px;" onclick="staffUpdateKdsStatus('${order.id}', 'completed')"><i class="fa-solid fa-check"></i> Teslim Edildi</button>`;
  }

  card.innerHTML = `
    <div class="kds-header flex-between" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; margin-bottom: 12px; align-items: flex-start;">
      <strong style="color:var(--color-primary); font-size:16px;">${order.target_identifier}</strong>
      <span style="color: ${timeColor}; font-size: 11px; font-weight:bold; background:rgba(0,0,0,0.04); padding:4px 8px; border-radius:12px;">${timeIcon} ${minsPassed} dk</span>
    </div>
    <div class="text-sm" style="color: var(--color-text-main); font-weight:500; line-height:1.5; margin-bottom: 16px;">
      ${itemsListHtml}
    </div>
    <div class="text-xs text-muted" style="font-size: 10px; margin-bottom: 16px;">Oluşturan: ${order.created_by || '-'}${order.completed_by ? ` | Tamamlayan: ${order.completed_by}` : ''}</div>
    <div class="kds-actions margin-top-sm" style="margin-top: auto;">${actionBtnHtml}</div>
  `;
  return card;
}

function renderStaffKitchenPanel(requests) {
  const list = document.getElementById('staff-kitchen-grid');
  if (!list) return;
  
  // Use the standard task card grid format
  list.style.display = 'grid';
  list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
  list.style.gap = '16px';
  list.innerHTML = '';

  const kitchenTasks = requests.filter(r => ((r.department === 'Kitchen' || r.type === 'order' || r.departments?.includes('Kitchen'))) && r.status !== 'completed' && r.status !== 'delivered');
  if (kitchenTasks.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm" style="grid-column: 1 / -1;">Bekleyen mutfak siparişi bulunmuyor.</div>`;
  } else {
    kitchenTasks.forEach(order => {
      list.appendChild(createKdsOrderCard(order));
    });
  }
}

function formatStaffRequestDetails(details) {
  if (!details) return '-';
  try {
    const parsed = Array.isArray(details) ? details : JSON.parse(details);
    if (Array.isArray(parsed)) {
      return parsed.map(item => `${esc(item.quantity || 1)}x ${esc(item.name || item.itemId || 'Ürün')}`).join(', ');
    }
  } catch (e) {}
  return esc(details);
}

function renderStaffRestaurantPanel(requests, tables) {
  if (tables) {
    renderStaffTablesGrid(tables, requests);
  }

  const readyList = document.getElementById('staff-restaurant-ready-grid');
  if (!readyList) return;
  readyList.innerHTML = '';

  const restaurantTasks = requests.filter(r => {
    if (r.status === 'completed' || r.status === 'delivered') return false;
    if (r.type === 'order') return false;
    return r.department === 'Restaurant' || r.type === 'waiter_call' || r.type === 'bill_call' || r.departments?.includes('Restaurant');
  });
  if (restaurantTasks.length === 0) {
    readyList.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Servis bekleyen görev yok.</div>`;
  } else {
    restaurantTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `aeon-card status-ready aeon-card`;
      card.innerHTML = `
        <div class="kds-header flex-between">
          <strong style="color:var(--color-primary);">${task.target_identifier}</strong>
          <span class="room-badge occupied" style="font-size:9px; padding: 2px 6px;">${task.type}</span>
        </div>
        <div class="text-xs text-muted" style="margin-top: 4px;">${formatStaffRequestDetails(task.details)}</div>
        <div class="kds-actions margin-top-sm">
          <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteTask('${task.id}')" style="width:100%; border-radius:8px;">Tamamlandı (Servis Edildi)</button>
        </div>
      `;
      readyList.appendChild(card);
    });
  }
}

function renderStaffReceptionPanel(requests, rooms = []) {
  const list = document.getElementById('staff-reception-grid');
  const statsContainer = document.getElementById('reception-dashboard-stats');
  
  if (statsContainer && rooms.length > 0) {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const dirtyRooms = rooms.filter(r => r.status === 'dirty_vacant').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    
    const activeTasks = requests.filter(r => r.status !== 'completed' && r.status !== 'delivered').length;
    
    statsContainer.innerHTML = `
      <div style="flex:1; background:#fff; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center;">
        <div style="font-size:22px; font-weight:800; color:var(--color-primary);">${occupancyRate}%</div>
        <div style="font-size:9px; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-top:2px;">Doluluk</div>
      </div>
      <div style="flex:1; background:#fff; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center;">
        <div style="font-size:22px; font-weight:800; color:var(--color-danger);">${dirtyRooms}</div>
        <div style="font-size:9px; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-top:2px;">Kirli Oda</div>
      </div>
      <div style="flex:1; background:#fff; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center;">
        <div style="font-size:22px; font-weight:800; color:var(--color-warning);">${activeTasks}</div>
        <div style="font-size:9px; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-top:2px;">Bekleyen</div>
      </div>
    `;
  }

  if (!list) return;
  list.innerHTML = '';
  
  const activeRequests = requests.filter(r => r.status !== 'completed' && r.status !== 'delivered' && r.type !== 'order');
  
  if (activeRequests.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Bekleyen genel istek bulunmuyor.</div>`;
    return;
  }

  // Group requests
  const groups = {
    'Uyandırma Servisi': [],
    'Bagaj & Vale': [],
    'Housekeeping': [],
    'Teknik Servis': [],
    'Restoran & Mutfak': [],
    'Ön Büro & Genel': []
  };

  activeRequests.forEach(task => {
    const dept = task.department || '';
    const type = task.type || '';
    if (type === 'wakeup_call') groups['Uyandırma Servisi'].push(task);
    else if (type === 'porter_request' || type === 'taxi_request') groups['Bagaj & Vale'].push(task);
    else if (dept === 'Housekeeping' || type === 'hk_request') groups['Housekeeping'].push(task);
    else if (dept === 'Technical' || type === 'tech_issue') groups['Teknik Servis'].push(task);
    else if (dept === 'Restaurant' || dept === 'Kitchen' || type === 'order' || type === 'waiter_call') groups['Restoran & Mutfak'].push(task);
    else groups['Ön Büro & Genel'].push(task);
  });

  let html = '';
  for (const [groupName, tasks] of Object.entries(groups)) {
    if (tasks.length === 0) continue;
    
    let groupIcon = 'fa-bell';
    let groupColor = 'var(--color-primary)';
    if (groupName === 'Uyandırma Servisi') { groupIcon = 'fa-clock'; groupColor = '#7c3aed'; } // Purple
    if (groupName === 'Bagaj & Vale') { groupIcon = 'fa-suitcase'; groupColor = '#475569'; } // Slate gray
    if (groupName === 'Housekeeping') { groupIcon = 'fa-broom'; groupColor = '#0284c7'; } // Info blue
    if (groupName === 'Teknik Servis') { groupIcon = 'fa-wrench'; groupColor = '#dc2626'; } // Danger red
    if (groupName === 'Restoran & Mutfak') { groupIcon = 'fa-utensils'; groupColor = '#d97706'; } // Warning orange
    
    html += `
      <div style="margin-bottom: 20px;">
        <h5 style="font-size:12px; text-transform:uppercase; color:${groupColor}; margin-bottom:12px; font-weight:800; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
          <i class="fa-solid ${groupIcon}" style="margin-right:4px;"></i> ${groupName} (${tasks.length})
        </h5>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
    `;
    
    tasks.forEach(task => {
      let detailsHtml = task.details || '-';
      try {
        if (typeof task.details === 'string' && task.details.trim().startsWith('[')) {
          const arr = JSON.parse(task.details);
          if (Array.isArray(arr)) {
            detailsHtml = arr.map(item => `<strong style="color:var(--color-primary);">${item.quantity || 1}x</strong> ${item.name || item.itemId}`).join('<br>');
          }
        }
      } catch(e) {}
      
      html += `
        <div class="aeon-card status-pending aeon-card" style="margin:0; box-shadow: var(--shadow-premium); border: 1px solid var(--border-glass); background: var(--bg-card); text-align: left; padding: 16px; display: flex; flex-direction: column;">
          <div class="kds-header flex-between" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; margin-bottom: 12px; align-items: flex-start;">
            <strong style="color:var(--color-primary); font-size:16px;">${task.target_identifier}</strong>
            <span class="room-badge occupied" style="font-size:10px; padding: 4px 8px; border-radius:12px; background: rgba(0,0,0,0.05); color: #475569; border:none; font-weight:bold;">${task.department || task.type}</span>
          </div>
          <div class="text-sm" style="color: var(--color-text-main); font-weight:500; line-height:1.5; margin-bottom: 16px;">${detailsHtml}</div>
          <div class="kds-actions margin-top-sm" style="margin-top: auto;">
            <button class="btn btn-success" onclick="staffCompleteTask('${task.id}')" style="width:100%; border-radius:8px; font-weight:bold; padding:10px; font-size:13px;"><i class="fa-solid fa-check"></i> Tamamlandı</button>
          </div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  }
  
  list.innerHTML = html;
}

window.renderReceptionRoomsGrid = function(rooms) {
  const grid = document.getElementById('reception-rooms-grid');
  if (!grid) return;
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
  grid.style.gap = '16px';
  grid.innerHTML = '';

  rooms.forEach(room => {
    const card = document.createElement('div');
    
    let statusClass = 'room-clean';
    let statusLabel = 'Boş / Temiz';

    if (room.status === 'dirty_vacant') {
      statusClass = 'room-dirty';
      statusLabel = 'Kirli (Boş)';
    } else if (room.status === 'occupied') {
      statusClass = 'room-occupied';
      statusLabel = `Dolu`;
    } else if (room.status === 'maintenance') {
      statusClass = 'room-maintenance';
      statusLabel = 'Bakımda';
    }

    card.className = `aeon-card entity-card ${statusClass}`;
    card.style.cursor = 'pointer';
    card.style.background = 'var(--bg-card)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.boxShadow = 'var(--shadow-premium)';
    card.style.padding = '16px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.aspectRatio = '1 / 1';
    card.style.overflow = 'hidden';
    
    let badgesHtml = '';
    if (room.vip) badgesHtml += '<span class="room-badge" style="background:#8b5cf6; color:white; font-size:10px; padding:4px 8px; border-radius:12px; font-weight:bold; margin-right:4px; border:none;">VIP</span>';
    if (room.late_checkout) badgesHtml += '<span class="room-badge" style="background:#f59e0b; color:white; font-size:10px; padding:4px 8px; border-radius:12px; font-weight:bold; margin-right:4px; border:none;">Geç Çıkış</span>';

    let acText = room.ac_status === 'working' ? 'Klima OK' : 'Klima Arızalı';

    let innerHtml = `
      <div class="flex-between" style="align-items: flex-start; margin-bottom: 8px;">
        <div>
          <div style="font-size:15px; font-weight:800; color: var(--color-primary); margin-bottom: 4px;">Oda ${room.room_number}</div>
          ${badgesHtml ? `<div style="margin-top: 4px;">${badgesHtml}</div>` : ''}
        </div>
        <div style="font-size:10px; font-weight:bold; background:rgba(0,0,0,0.05); padding:4px 6px; border-radius:12px;">${acText}</div>
      </div>
      <div class="card-desc" style="font-size:13px; font-weight:600; color: var(--color-text-main); margin-bottom: 8px;">Durum: ${statusLabel}</div>
    `;

    if (room.status === 'occupied') {
      innerHtml += `
        <div class="text-xs" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 8px; margin-bottom: 8px;">
          Misafir: <strong style="color:var(--color-primary);">${room.guest_name || 'Gizli (Demo)'}</strong><br>
          Folyo: <strong class="text-success">Açık</strong>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:auto;">
          <button class="btn btn-secondary" style="width:100%; padding:8px; font-size:12px;" onclick="openRoomDetailModal('${room.id}'); event.stopPropagation();"><i class="fa-solid fa-receipt"></i> Harcama Ekle</button>
          <button class="btn btn-danger" style="width:100%; padding:8px; font-size:12px;" onclick="staffCheckoutRoom('${room.id}'); event.stopPropagation();"><i class="fa-solid fa-right-from-bracket"></i> Check-out</button>
        </div>
      `;
    } else {
      card.style.cursor = 'pointer';
      card.setAttribute('onclick', `openRoomDetailModal('${room.id}')`);
    }
    
    card.innerHTML = innerHtml;
    grid.appendChild(card);
  });
};

function renderStaffTechPanel(rooms, requests = []) {
  const list = document.getElementById('staff-tech-grid');
  if (!list) return;
  
  list.style.display = 'grid';
  list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
  list.style.gap = '16px';
  list.innerHTML = '';

  const technicalRequests = requests.filter(request =>
    request.status !== 'completed' &&
    request.status !== 'delivered' &&
    (request.department === 'Maintenance' || request.type === 'maintenance_request' || request.type === 'tech_issue')
  );
  const technicalRooms = rooms.filter(r => r.status === 'maintenance' || r.ac_status === 'broken');

  if (technicalRooms.length === 0 && technicalRequests.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm" style="grid-column: 1 / -1;">Aktif teknik sorun veya arıza talebi bulunmuyor.</div>`;
    return;
  }

  technicalRooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'aeon-card status-pending aeon-card';
    card.style.margin = '0';
    card.style.boxShadow = 'var(--shadow-premium)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.background = 'var(--bg-card)';
    card.style.textAlign = 'left';
    card.style.padding = '16px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.cursor = 'pointer';
    card.setAttribute('onclick', `openRoomDetailModal('${room.id}')`);
    
    let issueText = [];
    if (room.status === 'maintenance') issueText.push(`<i class="fa-solid fa-wrench"></i> ${room.maintenance_notes || room.eta || 'Genel Tadilat'}`);
    if (room.ac_status === 'broken') issueText.push(`<i class="fa-solid fa-snowflake"></i> Klima Arızalı`);

    card.innerHTML = `
      <div class="kds-header flex-between" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; margin-bottom: 12px; align-items: flex-start;">
        <strong style="color:var(--color-primary); font-size:16px;">Oda ${room.room_number}</strong>
        <span style="color:var(--color-danger); font-size: 11px; font-weight:bold; background:rgba(220,38,38,0.1); padding:4px 8px; border-radius:12px;">ARIZA / TEKNİK</span>
      </div>
      <div class="text-sm" style="color: var(--color-text-main); font-weight:500; line-height:1.5; margin-bottom: 16px;">
        ${issueText.join('<br><br>')}
      </div>
      <div class="kds-actions margin-top-sm" style="margin-top: auto;">
        <button class="btn btn-secondary btn-xs" style="width:100%; border-radius:8px; font-weight:bold; padding:10px; font-size:13px; color:var(--color-primary);"><i class="fa-solid fa-circle-info"></i> Detay ve Yönetim</button>
      </div>
    `;
    list.appendChild(card);
  });

  technicalRequests.forEach(request => {
    const card = document.createElement('div');
    card.className = 'aeon-card status-pending';
    card.style.margin = '0';
    card.style.boxShadow = 'var(--shadow-premium)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.background = 'var(--bg-card)';
    card.style.textAlign = 'left';
    card.style.padding = '16px';
    card.innerHTML = `
      <div class="kds-header flex-between" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; margin-bottom: 12px;">
        <strong style="color:var(--color-primary); font-size:16px;">${request.target_identifier || 'Genel Alan'}</strong>
        <span style="color:var(--color-danger); font-size:11px; font-weight:bold;">TEKNİK TALEP</span>
      </div>
      <div class="text-sm" style="color:var(--color-text-main); line-height:1.5; margin-bottom:16px;">${esc(request.details || 'Teknik servis talebi')}</div>
      <button class="btn btn-success btn-xs" style="width:100%; border-radius:8px; font-weight:bold; padding:10px;" onclick="staffCompleteTask('${request.id}')">Tamamlandı</button>
    `;
    list.appendChild(card);
  });
}

function renderTechRoomsPanel(rooms) {
  const grid = document.getElementById('staff-tech-rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (rooms.length === 0) {
    grid.innerHTML = `<div class="text-muted text-xs text-center padding-sm" style="grid-column: 1 / -1;">Oda verisi bulunamadı.</div>`;
    return;
  }

  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'aeon-card';
    card.style.padding = '12px 16px';
    
    // Default to working if not explicitly broken
    const isAcBroken = room.ac_status === 'broken';
    const acColor = isAcBroken ? 'var(--color-danger)' : 'var(--color-success)';
    const acText = isAcBroken ? 'Arızalı' : 'Aktif';
    const acIcon = isAcBroken ? 'fa-snowflake' : 'fa-check';

    // Same for minibar (mocking minibar status for display)
    const isMinibarEmpty = room.status === 'dirty_vacant'; // Mock logic for demo
    const mbColor = isMinibarEmpty ? 'var(--color-warning)' : 'var(--color-success)';
    const mbText = isMinibarEmpty ? 'Eksik' : 'Tam';

    card.innerHTML = `
      <div class="flex-between" style="margin-bottom: 8px;">
        <strong style="font-size: 15px; color: var(--color-primary);">${room.room_number}</strong>
        <span style="font-size: 11px; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 12px; color: var(--color-text-main);">${room.status.replace('_', ' ').toUpperCase()}</span>
      </div>
      
      <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 13px;">
        <div style="flex: 1; display: flex; align-items: center; gap: 6px; color: ${acColor};">
          <i class="fa-solid ${acIcon}"></i> <strong>Klima:</strong> ${acText}
        </div>
        <div style="flex: 1; display: flex; align-items: center; gap: 6px; color: ${mbColor};">
          <i class="fa-solid fa-wine-bottle"></i> <strong>Minibar:</strong> ${mbText}
        </div>
      </div>
      
      <div style="margin-top: 12px;">
        <button class="btn btn-xs ${isAcBroken ? 'btn-success' : 'btn-danger'}" style="width:100%; padding: 8px; font-weight:bold;" onclick="toggleRoomAc('${room.id}', '${isAcBroken}')">
          <i class="fa-solid fa-power-off"></i> ${isAcBroken ? 'Klimayı Tamir Edildi İşaretle' : 'Klima Arızası Bildir'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.toggleRoomAc = async (roomId, currentlyBroken) => {
  const room = state.roomsList.find(r => r.id === roomId);
  if (!room) return;

  const newStatus = currentlyBroken === 'true' ? 'working' : 'broken';

  // Optimistic UI update — but this must also be persisted server-side (via the same
  // endpoint the room-detail modal uses), otherwise the next 3.5s poll (loadStaffData)
  // silently reverts it since it overwrites state.roomsList with server truth.
  room.ac_status = newStatus;
  renderTechRoomsPanel(state.roomsList);
  renderStaffTechPanel(state.roomsList);

  try {
    const res = await fetch(`/api/rooms/update-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        status: room.status,
        acStatus: newStatus,
        maintenanceNotes: room.maintenance_notes || room.eta || '',
        eta: room.status === 'maintenance' ? (room.maintenance_notes || room.eta || '') : '',
        vip: !!room.vip,
        lateCheckout: !!room.late_checkout
      })
    });
    if (!res.ok) throw new Error('AC status update failed');
  } catch (err) {
    console.error(err);
    // Revert optimistic change on failure and re-sync with the server.
    room.ac_status = currentlyBroken === 'true' ? 'broken' : 'working';
    renderTechRoomsPanel(state.roomsList);
    renderStaffTechPanel(state.roomsList);
    loadStaffData();
  }
};

function renderTechRoutinePanel() {
  const historyList = document.getElementById('staff-tech-routine-history');
  if (!historyList) return;
  
  historyList.innerHTML = '';
  const checks = window.__aeonTechRoutineChecks || [];
  
  if (checks.length === 0) {
    historyList.innerHTML = `<div class="text-muted text-xs text-center padding-sm" style="grid-column: 1 / -1;">Henüz kayıtlı kontrol yok.</div>`;
    return;
  }
  
  const typeLabels = {
    'pool_ph': 'Havuz PH/Klor',
    'electric_meter': 'Elektrik Sayacı',
    'water_meter': 'Su Sayacı',
    'boiler_temp': 'Kazan Sıcaklığı',
    'generator_test': 'Jeneratör Testi'
  };

  // Optional Pool Logic
  const poolOption = document.querySelector('#tech-routine-type option[value="pool_ph"]');
  if (poolOption && state.featureFlags && state.featureFlags.MODULE_POOL === false) {
    poolOption.style.display = 'none';
    // If it was selected, change selection
    const select = document.getElementById('tech-routine-type');
    if (select.value === 'pool_ph') select.value = 'electric_meter';
  } else if (poolOption) {
    poolOption.style.display = 'block';
  }

  checks.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(check => {
    const card = document.createElement('div');
    card.className = 'aeon-card';
    card.style.padding = '16px';
    card.innerHTML = `
      <div class="flex-between" style="margin-bottom: 8px;">
        <strong style="font-size: 14px; color: var(--color-primary);">${typeLabels[check.type] || check.type}</strong>
        <span style="font-size: 11px; color: var(--color-text-muted);">${new Date(check.created_at).toLocaleDateString('tr-TR')}</span>
      </div>
      <div style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">${check.value}</div>
      <div style="font-size: 12px; color: var(--color-text-muted);">
        ${check.notes ? `Not: ${check.notes}<br>` : ''}
        ${check.staff}
      </div>
    `;
    historyList.appendChild(card);
  });
}

window.submitTechRoutineCheck = () => {
  const type = document.getElementById('tech-routine-type').value;
  const value = document.getElementById('tech-routine-value').value;
  const notes = document.getElementById('tech-routine-notes').value;
  
  if (!value) {
    alert('Lütfen bir değer girin.');
    return;
  }
  
  const activeStaff = state.activeStaff || {};
  
  window.__aeonTechRoutineChecks.push({
    id: 'rtc' + Date.now(),
    type,
    value,
    notes,
    created_at: new Date().toISOString(),
    staff: activeStaff.name || 'Bilinmeyen Personel'
  });
  
  document.getElementById('tech-routine-value').value = '';
  document.getElementById('tech-routine-notes').value = '';
  
  renderTechRoutinePanel();
  alert('Kontrol kaydedildi.');
};

function renderTechInventoryPanel(inventory) {
  const grid = document.getElementById('staff-tech-inventory-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const techItems = inventory.filter(i => i.module_type === 'hotel' || i.module_type === 'technical');
  
  if (techItems.length === 0) {
    grid.innerHTML = `<div class="text-muted text-xs text-center padding-sm" style="grid-column: 1 / -1;">Teknik malzeme bulunmuyor.</div>`;
    return;
  }

  techItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'aeon-card';
    card.style.padding = '12px 16px';
    card.innerHTML = `
      <div class="flex-between">
        <strong style="font-size: 14px;">${item.name}</strong>
        <span style="font-weight: bold; color: ${item.stock <= (item.par_level || 5) ? 'var(--color-danger)' : 'var(--color-success)'};">${item.stock} ${item.unit}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  // Populate PR select
  const select = document.getElementById('tech-pr-item');
  if (select) {
    select.innerHTML = '';
    techItems.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.name;
      opt.textContent = i.name;
      select.appendChild(opt);
    });
  }
}

window.openTechPRModal = () => {
  document.getElementById('tech-pr-modal').style.display = 'flex';
  renderTechPurchaseRequests();
};

document.getElementById('tech-form-pr')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = document.getElementById('tech-pr-item').value;
  const qty = document.getElementById('tech-pr-qty').value;
  const notes = document.getElementById('tech-pr-notes').value;
  const activeStaff = state.activeStaff || {};
  
  window.__aeonTechPurchaseRequests.push({
    item_name: item,
    quantity: qty,
    notes: notes,
    status: 'Pending',
    created_by: activeStaff.name || 'Personel',
    created_at: new Date().toISOString()
  });
  
  document.getElementById('tech-form-pr').reset();
  renderTechPurchaseRequests();
});

function renderTechPurchaseRequests() {
  const list = document.getElementById('tech-purchase-requests-list');
  if (!list) return;
  list.innerHTML = '';
  
  window.__aeonTechPurchaseRequests.forEach(pr => {
    const card = document.createElement('div');
    card.style.background = 'rgba(0,0,0,0.03)';
    card.style.padding = '12px';
    card.style.borderRadius = '8px';
    card.style.fontSize = '12px';
    card.innerHTML = `
      <div class="flex-between">
        <strong>${pr.item_name}</strong>
        <span class="badge">${pr.status}</span>
      </div>
      <div style="color:var(--color-text-muted); margin-top:4px;">${pr.quantity} | Not: ${pr.notes || '-'}</div>
    `;
    list.appendChild(card);
  });
}

// --- Shift Notes Logic ---
async function loadShiftNotes() {
  const notesEl = document.getElementById('reception-shift-notes');
  if (!notesEl) return;
  try {
    const res = await fetch('/api/tenant/config');
    if (res.ok) {
      const config = await res.json();
      notesEl.value = config['SHIFT_NOTES'] || '';
    }
  } catch(e) { console.error(e); }
}

window.saveShiftNotes = async () => {
  const notesEl = document.getElementById('reception-shift-notes');
  if (!notesEl) return;
  const val = notesEl.value;
  try {
    const res = await fetch('/api/tenant/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'SHIFT_NOTES', value: val })
    });
    if (res.ok) {
      if (window.showSuccessOverlay) window.showSuccessOverlay("BAŞARILI", "Vardiya notları kaydedildi.");
    } else {
      if (window.showErrorOverlay) window.showErrorOverlay("HATA", "Notlar kaydedilemedi.");
    }
  } catch(e) {
    if (window.showErrorOverlay) window.showErrorOverlay("HATA", "Bağlantı hatası.");
  }
};

// --- Create Task / Request Logic ---
window.openCreateTaskModal = (defaultType) => {
  const modal = document.getElementById('create-task-modal');
  if (!modal) return;
  
  const typeSelect = document.getElementById('modal-task-type');
  if (typeSelect && defaultType) {
    if (defaultType === 'housekeeping') typeSelect.value = 'housekeeping_request';
    if (defaultType === 'maintenance') typeSelect.value = 'maintenance_request';
    if (defaultType === 'room_service') typeSelect.value = 'room_service';
    if (defaultType === 'wakeup') typeSelect.value = 'wakeup_call';
    if (defaultType === 'porter') typeSelect.value = 'porter_request';
    if (defaultType === 'taxi') typeSelect.value = 'taxi_request';
    if (defaultType === 'minibar') typeSelect.value = 'minibar_request';
    if (defaultType === 'cart_restock') typeSelect.value = 'cart_restock';
  }

  const roomGrid = document.getElementById('modal-task-room-grid');
  const roomInput = document.getElementById('modal-task-room');
  if (roomGrid && roomInput) {
    roomInput.value = ''; // Reset selection
    roomGrid.innerHTML = '';

    const renderRoomOption = (val, label, sublabel = '') => {
      const box = document.createElement('div');
      box.className = 'modal-room-box';
      box.style.border = '2px solid var(--border-glass)';
      box.style.borderRadius = '12px';
      box.style.padding = '8px';
      box.style.textAlign = 'center';
      box.style.cursor = 'pointer';
      box.style.background = 'var(--bg-card)';
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.justifyContent = 'center';
      box.style.aspectRatio = '1/1';
      box.style.transition = 'all 0.2s ease';
      
      box.innerHTML = `
        <div style="font-weight: 800; font-size: 14px; color: var(--color-primary);">${label}</div>
        ${sublabel ? `<div style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${sublabel}</div>` : ''}
      `;

      box.addEventListener('click', () => {
        document.querySelectorAll('.modal-room-box').forEach(b => {
          b.style.borderColor = 'var(--border-glass)';
          b.style.background = 'var(--bg-card)';
        });
        box.style.borderColor = 'var(--color-primary)';
        box.style.background = 'rgba(3, 102, 214, 0.08)';
        roomInput.value = val;
      });

      roomGrid.appendChild(box);
    };

    // Default option
    renderRoomOption('', 'Genel / Odasız', 'Genel Alan');

    if (state.roomsList) {
      const sortedRooms = [...state.roomsList].sort((a, b) => {
         const numA = parseInt(a.room_number) || 0;
         const numB = parseInt(b.room_number) || 0;
         return numA - numB;
      });
      sortedRooms.forEach(room => {
        renderRoomOption(`Room-${room.room_number}`, `Oda ${room.room_number}`, room.guest_name || 'Boş / İsimsiz');
      });
    }
  }

  document.getElementById('modal-task-details').value = '';
  modal.style.display = 'flex';
};

window.submitCreateTask = async () => {
  const type = document.getElementById('modal-task-type').value;
  const targetId = document.getElementById('modal-task-room').value || 'Genel';
  const details = document.getElementById('modal-task-details').value;
  const staff = state.activeStaff;
  
  if (!details.trim()) {
    if (window.showErrorOverlay) window.showErrorOverlay("HATA", "Lütfen talep detayını girin!");
    else alert("Lütfen talep detayını girin!");
    return;
  }
  
  let dept = 'Reception';
  if (type === 'housekeeping_request') dept = 'Housekeeping';
  if (type === 'maintenance_request') dept = 'Maintenance';
  if (type === 'room_service') dept = 'Kitchen';
  if (type === 'wakeup_call') dept = 'Reception';
  if (type === 'porter_request') dept = 'Reception';
  if (type === 'taxi_request') dept = 'Reception';

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type,
        target_identifier: targetId,
        details: details,
        created_by: staff ? staff.name : 'Staff Portal',
        department: dept
      })
    });
    if (res.ok) {
      document.getElementById('create-task-modal').style.display = 'none';
      if (window.showSuccessOverlay) window.showSuccessOverlay("BAŞARILI", "Talep başarıyla oluşturuldu.");
      if (typeof fetchData === 'function') fetchData();
    } else {
      if (window.showErrorOverlay) window.showErrorOverlay("HATA", "Talep oluşturulamadı.");
    }
  } catch(err) {
    if (window.showErrorOverlay) window.showErrorOverlay("HATA", "Bağlantı hatası!");
  }
};

// Window Room Detail Modal Management functions
window.activeRoomId = null;

window.openRoomDetailModal = (roomId) => {
  window.activeRoomId = roomId;
  const room = state.roomsList?.find(r => r.id === roomId);
  if (!room) return;

  document.getElementById('modal-room-title').textContent = `Oda ${room.room_number}`;
  document.getElementById('modal-room-status').value = room.status;
  document.getElementById('modal-room-ac').value = room.ac_status || 'working';
  const notesInput = document.getElementById('modal-room-notes');
  if (notesInput) {
    notesInput.value = room.maintenance_notes || room.eta || '';
    if (!notesInput.dataset.focusHandlerAttached) {
      notesInput.dataset.focusHandlerAttached = 'true';
      notesInput.addEventListener('focus', () => {
        const val = notesInput.value.trim().toLowerCase();
        if (val === 'hazır' || val === 'temizlik bekleniyor' || val === 'hazir') {
          notesInput.value = '';
        }
      });
    }
  }
  // Badges
  const vipCheckbox = document.getElementById('modal-room-vip');
  if (vipCheckbox) vipCheckbox.checked = !!room.vip;
  const lateCheckoutCheckbox = document.getElementById('modal-room-late-checkout');
  if (lateCheckoutCheckbox) lateCheckoutCheckbox.checked = !!room.late_checkout;

  // DND Toggle
  const dndCheckbox = document.getElementById('modal-room-dnd');
  const dndLabel    = document.getElementById('modal-dnd-label');
  if (dndCheckbox) {
    dndCheckbox.checked = !!room.dnd_active;
    if (dndLabel) dndLabel.textContent = room.dnd_active ? 'Açık 🚫' : 'Kapalı';
    dndCheckbox.onchange = async () => {
      const newDnd = dndCheckbox.checked;
      if (dndLabel) dndLabel.textContent = newDnd ? 'Açık 🚫' : 'Kapalı';
      await fetch(`/api/rooms/dnd?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, dnd_active: newDnd, updated_by: getActiveStaffLabel() })
      });
      loadStaffData();
    };
  }
  // Clear laundry/lostfound inputs
  const laundryInput = document.getElementById('modal-laundry-items');
  if (laundryInput) laundryInput.value = '';
  const lostInput = document.getElementById('modal-lostfound-desc');
  if (lostInput) lostInput.value = '';

  // Setup Minibar Item selector
  const minibarSelect = document.getElementById('modal-minibar-item');
  if (minibarSelect) {
    minibarSelect.innerHTML = '<option value="">Minibar Ürünü Seçin...</option>';
    state.availableCatalog?.filter(c => c.category === 'minibar').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.price} TL)`;
      minibarSelect.appendChild(opt);
    });
  }

  // Setup Guest registry & Check-in form views
  const guestSec = document.getElementById('modal-guest-section');
  const checkinSec = document.getElementById('modal-checkin-section');
  const minibarSec = document.getElementById('modal-minibar-section');

  if (room.status === 'occupied') {
    guestSec.style.display = 'block';
    minibarSec.style.display = 'block';
    checkinSec.style.display = 'none';

    document.getElementById('modal-guest-name-disp').textContent = room.guest_name || '-';
  } else {
    guestSec.style.display = 'none';
    minibarSec.style.display = 'none';
    checkinSec.style.display = 'block';
  }

  document.getElementById('room-detail-modal').style.display = 'flex';
};

window.closeRoomDetailModal = () => {
  document.getElementById('room-detail-modal').style.display = 'none';
  // Clear forms
  document.getElementById('checkin-guestname').value = '';
};

window.saveRoomDetailModal = async () => {
  const status = document.getElementById('modal-room-status').value;
  const acStatus = document.getElementById('modal-room-ac').value;
  const maintenanceNotes = document.getElementById('modal-room-notes').value;
  const vip = document.getElementById('modal-room-vip')?.checked;
  const lateCheckout = document.getElementById('modal-room-late-checkout')?.checked;

  try {
    const res = await fetch(`/api/rooms/update-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: window.activeRoomId,
        status,
        acStatus,
        maintenanceNotes,
        eta: status === 'maintenance' ? maintenanceNotes : '',
        vip,
        lateCheckout
      })
    });
    if (res.ok) {
      logEvent('event', `Mobil Yönetim: Oda detayları güncellendi (Oda ID: ${window.activeRoomId})`);
      window.closeRoomDetailModal();
      loadStaffData();
      alert("Değişiklikler başarıyla kaydedildi!");
    } else {
      const errData = await res.json();
      alert("Hata: " + (errData.error || 'Kaydedilemedi.'));
    }
  } catch (err) {
    console.error(err);
  }
};

window.modalCheckoutRoom = async () => {
  if (confirm("Oda çıkışı yapmak istediğinize emin misiniz?")) {
    await window.staffCheckoutRoom(window.activeRoomId);
    window.openRoomDetailModal(window.activeRoomId); // Refresh modal view
  }
};

window.modalCheckinRoom = async () => {
  try {
    const res = await fetch(`/api/rooms/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: window.activeRoomId,
        firstName: 'Dolu',
        lastName: '',
        idPassportNo: '000000',
        phone: '',
        carPlate: ''
      })
    });
    if (res.ok) {
      logEvent('event', `Mobil Check-in: Oda dolu olarak işaretlendi.`);
      loadStaffData();
      window.openRoomDetailModal(window.activeRoomId); // Refresh modal view
    }
  } catch (err) {
    console.error(err);
  }
};

window.modalAddMinibar = async () => {
  const itemId = document.getElementById('modal-minibar-item').value;
  const qty = parseInt(document.getElementById('modal-minibar-qty').value) || 1;

  if (!itemId) {
    alert("Lütfen bir minibar ürünü seçin.");
    return;
  }

  const room = state.roomsList?.find(r => r.id === window.activeRoomId);
  const targetIdentifier = room ? `Room-${room.room_number}` : `Room-${window.activeRoomId}`;

  try {
    const res = await fetch(`/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: targetIdentifier,
        details: [{ itemId, quantity: qty }],
        payment_method: 'room_charge',
        created_by: getActiveStaffLabel()
      })
    });
    if (res.ok) {
      logEvent('event', `Mobil Minibar: Minibar eklendi: <strong>${targetIdentifier}</strong>`);
      alert("Minibar tüketimi başarıyla odaya yansıtıldı.");
      document.getElementById('modal-minibar-qty').value = "1";
      loadStaffData();
    }
  } catch (err) {
    console.error(err);
  }
};
window.modalSubmitLaundry = async () => {
  const desc = document.getElementById('modal-laundry-items')?.value?.trim();
  if (!desc) { alert('Lütfen çamaşır listesini girin.'); return; }
  const room = state.roomsList?.find(r => r.id === window.activeRoomId);
  try {
    const res = await fetch(`/api/hk/laundry?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: window.activeRoomId, items_description: desc, created_by: getActiveStaffLabel() })
    });
    if (res.ok) {
      document.getElementById('modal-laundry-items').value = '';
      if (window.showSuccessOverlay) window.showSuccessOverlay('ÇAMAŞIR', 'Çamaşır talebi oluşturuldu.');
      logEvent('event', `HK: Çamaşır talebi - ${room?.room_number}: ${desc}`);
    }
  } catch (err) { console.error(err); }
};

window.modalSubmitLostFound = async () => {
  const desc = document.getElementById('modal-lostfound-desc')?.value?.trim();
  if (!desc) { alert('Lütfen bulunan eşyayı tanımlayın.'); return; }
  const room = state.roomsList?.find(r => r.id === window.activeRoomId);
  try {
    const res = await fetch(`/api/hk/lost-found?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: window.activeRoomId, item_description: desc, found_by: getActiveStaffLabel() })
    });
    if (res.ok) {
      document.getElementById('modal-lostfound-desc').value = '';
      if (window.showSuccessOverlay) window.showSuccessOverlay('KAYIP EŞYA', 'Kayıp eşya sisteme kaydedildi.');
      logEvent('event', `HK: Kayıp eşya - ${room?.room_number}: ${desc}`);
    }
  } catch (err) { console.error(err); }
};

window.renderStaffInvPanel = (inventory) => {
  const list = document.getElementById('staff-inv-list');
  if (!list) return;

  list.innerHTML = '';
  
  // Group by category (module_type)
  const grouped = {};
  inventory.forEach(item => {
    const cat = item.module_type === 'bar' ? 'Bar' : 'Mutfak';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  for (const cat in grouped) {
    // Add Category Header
    const header = document.createElement('h5');
    header.style.cssText = 'font-size: 14px; font-weight: bold; margin: 16px 0 8px 0; color: var(--color-text-main); border-bottom: 2px solid var(--border-glass); padding-bottom: 4px;';
    header.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${cat} Envanteri`;
    list.appendChild(header);

    // Add Grid Container
    const grid = document.createElement('div');
    grid.className = 'card-grid-mobile';
    grid.style.paddingBottom = '10px';

    grouped[cat].forEach(item => {
      const isCritical = item.stock < item.par_level;
      const card = document.createElement('div');
      card.className = 'aeon-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.textAlign = 'center';
      card.style.padding = '12px 10px';
      card.style.background = isCritical ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)';
      card.style.border = isCritical ? '1px solid var(--color-danger)' : '1px solid var(--border-glass)';
      card.style.cursor = 'pointer';
      card.setAttribute('onclick', `window.openInvAdjustScreen('${item.id}')`);

      card.innerHTML = `
        <div style="font-size: 12px; font-weight: bold; color: ${isCritical ? 'var(--color-danger)' : 'var(--color-primary)'}; margin-bottom: 5px; line-height: 1.2;">${item.name}</div>
        <div style="font-size: 18px; font-weight: 800; color: ${isCritical ? 'var(--color-danger)' : 'var(--color-text-main)'};">
          ${item.stock.toFixed(1)} <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">${item.unit}</span>
        </div>
        <div style="font-size: 9px; color: var(--text-muted); margin-top: 4px;">Hedef: ${item.par_level} ${item.unit}</div>
        <div style="font-size: 9px; color: var(--color-primary); font-weight: 700; margin-top: 8px; border-top: 1px solid var(--border-glass); padding-top: 4px; width: 100%;">
          <i class="fa-solid fa-pen-to-square"></i> Ayarla
        </div>
      `;
      grid.appendChild(card);
    });

    list.appendChild(grid);
  }
};

window.openInvAdjustScreen = (itemId) => {
  const item = state.inventoryList?.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('adjust-screen-id').value = item.id;
  document.getElementById('adjust-screen-title').textContent = item.name;
  document.getElementById('adjust-screen-category').textContent = `Kategori: ${item.module_type === 'bar' ? 'Bar' : 'Mutfak'}`;
  document.getElementById('adjust-screen-current-stock').textContent = `${item.stock.toFixed(1)} ${item.unit}`;
  document.getElementById('adjust-screen-par-level').textContent = `Hedef Seviye: ${item.par_level} ${item.unit}`;
  document.getElementById('adjust-screen-qty').value = '1';
  document.getElementById('adjust-screen-reason').value = '';

  window.setInvAdjustScreenSegment('in');

  document.getElementById('inv-screen-list').style.display = 'none';
  document.getElementById('inv-screen-adjust').style.display = 'block';
};

window.showInvList = () => {
  document.getElementById('inv-screen-adjust').style.display = 'none';
  document.getElementById('inv-screen-list').style.display = 'block';
};

window.setInvAdjustScreenSegment = (type) => {
  document.getElementById('adjust-screen-type').value = type;
  const segments = ['in', 'out', 'waste'];
  segments.forEach(s => {
    const btn = document.getElementById(`btn-screen-segment-${s}`);
    if (btn) {
      if (s === type) {
        btn.classList.add('active-segment-btn');
        btn.style.background = 'var(--color-primary)';
        btn.style.color = 'black';
      } else {
        btn.classList.remove('active-segment-btn');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-muted)';
      }
    }
  });
};

window.adjustScreenQty = (amount) => {
  const input = document.getElementById('adjust-screen-qty');
  if (!input) return;
  let val = parseFloat(input.value) || 0;
  val = Math.max(0, val + amount);
  input.value = val.toString();
};

// Form listener for envanter screen movement
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-screen-inv-movement');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inventoryId = document.getElementById('adjust-screen-id').value;
      const type = document.getElementById('adjust-screen-type').value;
      const qty = parseFloat(document.getElementById('adjust-screen-qty').value);
      const reason = document.getElementById('adjust-screen-reason').value || 'Mobil Hızlı İşlem';

      if (!inventoryId || isNaN(qty) || qty <= 0) {
        alert("Lütfen geçerli bir miktar girin.");
        return;
      }

      try {
        const res = await fetch('/api/inventory/movement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventoryId,
            type,
            quantity: qty,
            reason,
            staff_name: getActiveStaffLabel(),
            created_by: getActiveStaffLabel()
          })
        });
        if (res.ok) {
          alert("Stok hareketi başarıyla kaydedildi!");
          window.showInvList();
          loadStaffData();
        } else {
          const errData = await res.json();
          alert("Hata: " + (errData.error || 'İşlem tamamlanamadı.'));
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
});

window.populateFbOrderForm = (rooms, catalog, tables) => {
  const targetSelect = document.getElementById('staff-restaurant-order-target');
  if (!targetSelect) return;

  // 1. Populate destinations (Tables & Occupied Rooms)
  if (targetSelect.children.length === 0) {
    targetSelect.innerHTML = '<option value="">Masa / Oda Seçin...</option>';
    
    // Add custom tables from DB
    if (tables && tables.length > 0) {
      tables.forEach(t => {
        const opt = document.createElement('option');
        opt.value = `Table-${t.table_number}`;
        opt.textContent = `Masa ${t.table_number}`;
        targetSelect.appendChild(opt);
      });
    } else {
      // Fallback
      for (let i = 1; i <= 30; i++) {
        const opt = document.createElement('option');
        opt.value = `Table-Masa ${i}`;
        opt.textContent = `Masa ${i}`;
        targetSelect.appendChild(opt);
      }
    }
    
    // Add Occupied Rooms
    rooms.filter(r => r.status === 'occupied').forEach(r => {
      const opt = document.createElement('option');
      opt.value = `Room-${r.room_number}`;
      opt.textContent = `Oda ${r.room_number}`;
      targetSelect.appendChild(opt);
    });
  }

  // 2. Render menu grid
  window.renderMenuItemsGrid(catalog);
};

let staffRestaurantOrderCart = [];
window.activeMenuCategory = 'all';

window.renderMenuItemsGrid = (catalog) => {
  const grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const activeCat = window.activeMenuCategory || 'all';
  const items = catalog.filter(c => {
    const category = String(c.category || '').toLocaleLowerCase('tr-TR');
    const isMinibar = category.includes('minibar') || category.includes('mini bar');
    const isDrink = category.includes('drink') || category.includes('içecek') || category.includes('bar') || category.includes('alkol');
    const isFood = category.includes('food') || category.includes('yemek') || category.includes('kahvaltı') || category.includes('çorba') || category.includes('başlangıç') || category.includes('ara sıcak') || category.includes('tatlı');
    if (activeCat === 'all') return isFood || isDrink || isMinibar;
    if (activeCat === 'minibar') return isMinibar;
    if (activeCat === 'drink') return isDrink && !isMinibar;
    if (activeCat === 'food') return isFood && !isMinibar;
    return false;
  });

  if (items.length === 0) {
    grid.innerHTML = '<div class="text-muted text-xs text-center" style="grid-column: span 2; padding:20px;">Bu kategoride ürün bulunamadı.</div>';
    return;
  }

  items.forEach(item => {
    const cartItem = staffRestaurantOrderCart.find(c => c.itemId === item.id);
    const qty = cartItem ? cartItem.quantity : 0;

    const card = document.createElement('div');
    card.className = 'menu-item-card';
    card.innerHTML = `
      <div>
        <div style="font-weight:700; font-size:12px; color:#0c4a6e; line-height:1.2;">${item.name}</div>
        <div style="font-size:11px; color:var(--color-primary); font-weight:700; margin-top:4px;">${item.price} TL</div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <button type="button" class="btn btn-glass btn-xs" style="padding:2px 8px; font-size:10px; border-radius:6px;" onclick="window.decreaseMenuCartQty('${item.id}')">-</button>
        <span id="menu-qty-${item.id}" style="font-weight:700; font-size:11px;">${qty}</span>
        <button type="button" class="btn btn-glass btn-xs" style="padding:2px 8px; font-size:10px; border-radius:6px;" onclick="window.increaseMenuCartQty('${item.id}')">+</button>
      </div>
    `;
    grid.appendChild(card);
  });
};

window.filterMenuCategory = (cat) => {
  window.activeMenuCategory = cat;
  const categories = ['all', 'food', 'drink', 'minibar'];
  categories.forEach(c => {
    const btn = document.getElementById(`btn-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.classList.add('active-cat-btn');
      } else {
        btn.classList.remove('active-cat-btn');
      }
    }
  });

  if (state.availableCatalog) {
    window.renderMenuItemsGrid(state.availableCatalog);
  }
};

window.increaseMenuCartQty = (itemId) => {
  const catalogItem = state.availableCatalog?.find(c => c.id === itemId);
  if (!catalogItem) return;

  const existing = staffRestaurantOrderCart.find(c => c.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    staffRestaurantOrderCart.push({
      itemId,
      name: catalogItem.name,
      quantity: 1,
      price: catalogItem.price
    });
  }

  const qtySpan = document.getElementById(`menu-qty-${itemId}`);
  if (qtySpan) {
    qtySpan.textContent = (existing ? existing.quantity : 1).toString();
  }

  window.renderFbCartPreview();
};

window.decreaseMenuCartQty = (itemId) => {
  const existing = staffRestaurantOrderCart.find(c => c.itemId === itemId);
  if (!existing) return;

  existing.quantity -= 1;
  if (existing.quantity <= 0) {
    staffRestaurantOrderCart = staffRestaurantOrderCart.filter(c => c.itemId !== itemId);
  }

  const qtySpan = document.getElementById(`menu-qty-${itemId}`);
  if (qtySpan) {
    qtySpan.textContent = (existing.quantity > 0 ? existing.quantity : 0).toString();
  }

  window.renderFbCartPreview();
};

window.renderFbCartPreview = () => {
  const card = document.getElementById('staff-restaurant-cart-card');
  const list = document.getElementById('staff-restaurant-cart-items-list');
  if (!card || !list) return;

  if (staffRestaurantOrderCart.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  let html = '';
  
  let total = 0;
  staffRestaurantOrderCart.forEach(item => {
    total += item.price * item.quantity;
    html += `
      <div class="flex-between" style="marginBottom: 4px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span>${item.name} x ${item.quantity}</span>
          <label style="font-size:10px; color:var(--text-muted);"><input type="checkbox" onchange="window.toggleFbCartStarter('${item.itemId}')" ${item.isStarter ? 'checked' : ''}> Başlangıç olarak ayarla</label>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${item.price * item.quantity} TL</span>
          <span class="text-danger" style="cursor:pointer;" onclick="window.removeFbCartItemDirect('${item.itemId}')"><i class="fa-solid fa-trash"></i></span>
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
};

window.removeFbCartItemDirect = (itemId) => {
  staffRestaurantOrderCart = staffRestaurantOrderCart.filter(c => c.itemId !== itemId);
  const qtySpan = document.getElementById(`menu-qty-${itemId}`);
  if (qtySpan) qtySpan.textContent = '0';
  window.renderFbCartPreview();
};

window.toggleFbCartStarter = (itemId) => {
  const item = staffRestaurantOrderCart.find(c => c.itemId === itemId);
  if (item) item.isStarter = !item.isStarter;
};

window.submitStaffRestaurantOrder = async () => {
  const targetSelect = document.getElementById('staff-restaurant-order-target');
  if (!targetSelect) return;
  const target = targetSelect.value;
  const paymentMethod = 'Hesaba Yaz'; // Default since payment dropdown is removed in mobile

  if (!target) {
    alert("Lütfen bir masa veya oda seçin.");
    return;
  }

  if (staffRestaurantOrderCart.length === 0) {
    alert("Lütfen en az bir ürün seçin.");
    return;
  }

  const payloadCart = staffRestaurantOrderCart.map(c => ({
    ...c,
    name: c.isStarter ? `[BAŞLANGIÇ] ${c.name}` : c.name
  }));

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: target,
        details: JSON.stringify(payloadCart),
        payment_method: paymentMethod,
        created_by: getActiveStaffLabel()
      })
    });
    if (res.ok) {
      alert("Sipariş başarıyla gönderildi!");
      staffRestaurantOrderCart = [];
      window.renderFbCartPreview();
      
      document.querySelectorAll('[id^="menu-qty-"]').forEach(span => {
        span.textContent = '0';
      });

      document.getElementById('staff-restaurant-order-target').value = '';
      loadStaffData();
      
      // Auto-switch to Tables tab
      window.switchFbSubTab('tables');
    } else {
      const errData = await res.json();
      alert("Hata: " + (errData.error || 'İşlem tamamlanamadı.'));
    }
  } catch (err) {
    console.error(err);
  }
};

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
      <div style="font-weight: 800; font-size: 13px; color: #f8fafc; font-family: var(--font-title);">${title}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${message}</div>
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

// --- KITCHEN DASHBOARD LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const navOrders = document.getElementById('nav-kitchen-tab-orders');
  const navInv = document.getElementById('nav-kitchen-tab-inv');
  const navMenu = document.getElementById('nav-kitchen-tab-menu');
  const navTables = document.getElementById('nav-kitchen-tab-tables');
  const navActions = document.getElementById('nav-kitchen-tab-actions');

  if (navOrders) navOrders.addEventListener('click', (e) => { e.preventDefault(); window.switchKitchenSubTab('orders'); });
  if (navInv) navInv.addEventListener('click', (e) => { e.preventDefault(); window.switchKitchenSubTab('inv'); });
  if (navMenu) navMenu.addEventListener('click', (e) => { e.preventDefault(); window.switchKitchenSubTab('menu'); });
  if (navTables) navTables.addEventListener('click', (e) => { e.preventDefault(); window.switchKitchenSubTab('tables'); });
  if (navActions) navActions.addEventListener('click', (e) => { e.preventDefault(); window.switchKitchenSubTab('actions'); });

  // Tech Nav Event Listeners
  const navTechTasks = document.getElementById('nav-tech-tab-tasks');
  const navTechRoutine = document.getElementById('nav-tech-tab-routine');
  const navTechRooms = document.getElementById('nav-tech-tab-rooms');
  const navTechInv = document.getElementById('nav-tech-tab-inv');

  if (navTechTasks) navTechTasks.addEventListener('click', (e) => { e.preventDefault(); window.switchTechSubTab('tasks'); });
  if (navTechRoutine) navTechRoutine.addEventListener('click', (e) => { e.preventDefault(); window.switchTechSubTab('routine'); });
  if (navTechRooms) navTechRooms.addEventListener('click', (e) => { e.preventDefault(); window.switchTechSubTab('rooms'); });
  if (navTechInv) navTechInv.addEventListener('click', (e) => { e.preventDefault(); window.switchTechSubTab('inv'); });
});

window.switchKitchenSubTab = (tab) => {
  const navOrders = document.getElementById('nav-kitchen-tab-orders');
  const navInv = document.getElementById('nav-kitchen-tab-inv');
  const navMenu = document.getElementById('nav-kitchen-tab-menu');
  const navTables = document.getElementById('nav-kitchen-tab-tables');
  const navActions = document.getElementById('nav-kitchen-tab-actions');
  
  const viewOrders = document.getElementById('kitchen-subview-orders');
  const viewInv = document.getElementById('kitchen-subview-inv');
  const viewMenu = document.getElementById('kitchen-subview-menu');
  const viewTables = document.getElementById('kitchen-subview-tables');
  const viewActions = document.getElementById('kitchen-subview-actions');

  if (navOrders) {
    navOrders.classList.remove('active');
    navInv.classList.remove('active');
    navMenu.classList.remove('active');
    if (navTables) navTables.classList.remove('active');
    if (navActions) navActions.classList.remove('active');
    
    viewOrders.style.display = 'none';
    viewInv.style.display = 'none';
    viewMenu.style.display = 'none';
    if (viewTables) viewTables.style.display = 'none';
    if (viewActions) viewActions.style.display = 'none';

    if (tab === 'orders') {
      navOrders.classList.add('active');
      viewOrders.style.display = 'block';
    } else if (tab === 'inv') {
      navInv.classList.add('active');
      viewInv.style.display = 'block';
    } else if (tab === 'menu') {
      navMenu.classList.add('active');
      viewMenu.style.display = 'block';
    } else if (tab === 'tables') {
      if (navTables) navTables.classList.add('active');
      if (viewTables) viewTables.style.display = 'block';
    } else if (tab === 'actions') {
      if (navActions) navActions.classList.add('active');
      if (viewActions) viewActions.style.display = 'block';
    }
  }
};

window.switchTechSubTab = (tab) => {
  const navTasks = document.getElementById('nav-tech-tab-tasks');
  const navRoutine = document.getElementById('nav-tech-tab-routine');
  const navRooms = document.getElementById('nav-tech-tab-rooms');
  const navInv = document.getElementById('nav-tech-tab-inv');
  
  const viewTasks = document.getElementById('tech-subview-tasks');
  const viewRoutine = document.getElementById('tech-subview-routine');
  const viewRooms = document.getElementById('tech-subview-rooms');
  const viewInv = document.getElementById('tech-subview-inv');

  if (navTasks) {
    navTasks.classList.remove('active');
    navRoutine.classList.remove('active');
    if (navRooms) navRooms.classList.remove('active');
    navInv.classList.remove('active');
    
    viewTasks.style.display = 'none';
    viewRoutine.style.display = 'none';
    if (viewRooms) viewRooms.style.display = 'none';
    viewInv.style.display = 'none';

    if (tab === 'tasks') {
      navTasks.classList.add('active');
      viewTasks.style.display = 'block';
    } else if (tab === 'routine') {
      navRoutine.classList.add('active');
      viewRoutine.style.display = 'block';
      renderTechRoutinePanel();
    } else if (tab === 'rooms') {
      if (navRooms) navRooms.classList.add('active');
      if (viewRooms) viewRooms.style.display = 'block';
      renderTechRoomsPanel(state.roomsList || []);
    } else if (tab === 'inv') {
      navInv.classList.add('active');
      viewInv.style.display = 'block';
      renderTechInventoryPanel(window.__aeonLastInventory || []);
    }
  }
};

// --- MOCK DATA FOR TECH ---
window.__aeonTechRoutineChecks = [
  { id: 'rtc1', type: 'pool_ph', value: '7.3', notes: 'Normal', created_at: new Date(Date.now() - 86400000).toISOString(), staff: 'Veli (Teknisyen)' },
  { id: 'rtc2', type: 'electric_meter', value: '450210', notes: 'Aylık okuma', created_at: new Date(Date.now() - 172800000).toISOString(), staff: 'Veli (Teknisyen)' }
];
window.__aeonTechPurchaseRequests = [];

window.renderKitchenMenuPanel = (catalog) => {
  const list = document.getElementById('kitchen-menu-list');
  if (!list) return;

  const kitchenCatalog = catalog.filter(c => c.module_type !== 'bar');
  list.innerHTML = '';

  // Group by category
  const grouped = {};
  kitchenCatalog.forEach(item => {
    const cat = item.category || 'Diğer';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  for (const cat in grouped) {
    // Add Category Header
    const header = document.createElement('h5');
    header.style.cssText = 'font-size: 14px; font-weight: bold; margin: 16px 0 8px 0; color: var(--color-text-main); border-bottom: 2px solid var(--border-glass); padding-bottom: 4px;';
    header.innerHTML = `<i class="fa-solid fa-utensils"></i> ${cat}`;
    list.appendChild(header);

    // Add Grid Container
    const grid = document.createElement('div');
    grid.className = 'card-grid-mobile';
    grid.style.paddingBottom = '10px';

    grouped[cat].forEach(item => {
      const inStock = item.in_stock === 1 || item.in_stock === true || item.in_stock === undefined;
      const card = document.createElement('div');
      card.className = 'aeon-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.textAlign = 'center';
      card.style.padding = '12px 10px';
      card.style.background = inStock ? 'var(--bg-card)' : 'rgba(239, 68, 68, 0.08)';
      card.style.border = inStock ? '1px solid var(--border-glass)' : '1px solid var(--color-danger)';
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div style="font-size: 12px; font-weight: bold; color: ${inStock ? 'var(--color-primary)' : 'var(--color-danger)'}; margin-bottom: 5px; line-height: 1.2;">${item.name}</div>
        <div style="font-size: 14px; font-weight: 800; color: var(--color-text-main);">${item.price} <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">TL</span></div>
        <div style="margin-top: 10px; width: 100%;">
          <button class="btn btn-xs ${inStock ? 'btn-danger' : 'btn-primary'}" style="width: 100%; padding: 6px 0;" onclick="window.toggleCatalogItemStock('${item.id}', ${inStock})">
            ${inStock ? 'Tükendi İşaretle' : 'Stoğa Girdi'}
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    list.appendChild(grid);
  }
};

window.toggleCatalogItemStock = async (catalogId, currentlyInStock) => {
  try {
    const res = await fetch('/api/catalog/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog_id: catalogId, in_stock: !currentlyInStock })
    });
    if (res.ok) {
      loadStaffData(); // reload
    }
  } catch (err) {
    console.error('Failed to toggle stock:', err);
  }
};

// MARKET RECEIPT LOGIC
let marketReceiptItems = [];

window.openMarketReceiptModal = () => {
  const modal = document.getElementById('market-receipt-modal');
  if (!modal) return;
  document.getElementById('mr-number').value = '';
  document.getElementById('mr-vendor').value = '';
  document.getElementById('mr-total').value = '';
  marketReceiptItems = [];
  window.renderMarketReceiptItems();

  const select = document.getElementById('mr-item-select');
  select.innerHTML = '<option value="">-- Ürün Seçin --</option>';
  if (window.state && window.state.inventoryList) {
    window.state.inventoryList.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = `${i.name} (${i.unit})`;
      select.appendChild(opt);
    });
  }

  modal.style.display = 'flex';
};

window.addMarketReceiptItem = () => {
  const select = document.getElementById('mr-item-select');
  const qtyInput = document.getElementById('mr-item-qty');
  const priceInput = document.getElementById('mr-item-price');

  const invId = select.value;
  const qty = parseFloat(qtyInput.value);
  const price = parseFloat(priceInput.value);

  if (!invId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
    alert('Lütfen geçerli ürün, miktar ve fiyat girin.');
    return;
  }

  const invItem = window.state.inventoryList.find(i => i.id === invId);
  marketReceiptItems.push({
    inventory_id: invId,
    name: invItem.name,
    unit: invItem.unit,
    quantity: qty,
    unit_price: price,
    total_price: qty * price
  });

  select.value = '';
  qtyInput.value = '';
  priceInput.value = '';
  window.renderMarketReceiptItems();
};

window.renderMarketReceiptItems = () => {
  const list = document.getElementById('mr-items-list');
  if (!list) return;

  if (marketReceiptItems.length === 0) {
    list.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">Henüz kalem eklenmedi.</div>';
    return;
  }

  let html = '';
  marketReceiptItems.forEach((item, index) => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:8px; border-radius:4px; border:1px solid rgba(0,0,0,0.08); margin-bottom: 4px;">
        <div style="font-size:11px;">
          <strong style="color:var(--color-primary);">${item.name}</strong><br>
          ${item.quantity} ${item.unit} x ${item.unit_price} TL = <strong style="color:var(--text-main);">${item.total_price} TL</strong>
        </div>
        <button class="btn-icon text-danger" style="background:none; border:none; cursor:pointer;" onclick="window.removeMarketReceiptItem(${index})"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });
  list.innerHTML = html;
};

window.removeMarketReceiptItem = (index) => {
  marketReceiptItems.splice(index, 1);
  window.renderMarketReceiptItems();
};

window.submitMarketReceipt = async () => {
  const num = document.getElementById('mr-number').value;
  const vendor = document.getElementById('mr-vendor').value;
  const total = parseFloat(document.getElementById('mr-total').value) || 0;

  if (marketReceiptItems.length === 0) {
    alert('Faturada en az bir kalem olmalıdır.');
    return;
  }

  try {
    const res = await fetch('/api/inventory/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_number: num,
        vendor: vendor,
        total_amount: total,
        items: marketReceiptItems,
        created_by: getActiveStaffLabel()
      })
    });

    if (res.ok) {
      alert('Fatura / Fiş başarıyla işlendi!');
      document.getElementById('market-receipt-modal').style.display = 'none';
      if (window.loadStaffData) window.loadStaffData();
    } else {
      const err = await res.json();
      alert('Hata: ' + (err.error || 'Bilinmeyen hata'));
    }
  } catch (err) {
    console.error(err);
    alert('Sunucuya bağlanılamadı.');
  }
};

window.handleReceiptImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const overlay = document.getElementById('receipt-loading-overlay');
  if (overlay) overlay.style.display = 'flex';

  try {
    // Convert file to Base64
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
          // Try to fuzzy match with state.inventoryList
          const invItem = window.state.inventoryList.find(i => 
            i.name.toLowerCase().includes(pItem.name.toLowerCase()) || 
            pItem.name.toLowerCase().includes(i.name.toLowerCase())
          );
          
          if (invItem) {
            marketReceiptItems.push({
              inventory_id: invItem.id,
              name: invItem.name,
              unit: invItem.unit,
              quantity: pItem.quantity || 1,
              unit_price: pItem.unit_price || 0,
              total_price: (pItem.quantity || 1) * (pItem.unit_price || 0)
            });
          } else {
             // Let user know AI found an item but couldn't match it
             console.log("AI extracted item not in inventory:", pItem.name);
          }
        });
        window.renderMarketReceiptItems();
      }
    } else {
      alert("AI okuma hatası oluştu.");
    }
  } catch (err) {
    console.error(err);
    alert("Fotoğraf yüklenirken bir sorun oluştu.");
  } finally {
    if (overlay) overlay.style.display = 'none';
    event.target.value = ''; // Reset input
  }
};

window.renderKitchenTablesPanel = (tables, requests) => {
  const grid = document.getElementById('kitchen-tables-grid');
  if (!grid) return;
  grid.innerHTML = '';

  tables.forEach(table => {
    // Find active requests for this table
    const tableRequests = requests.filter(r => 
      r.target_identifier === `Table-${table.table_number}` && 
      r.status !== 'completed'
    );

    // Check if table has waiter call, bill call, or orders
    const hasWaiterCall = tableRequests.some(r => r.type === 'waiter_call');
    const hasBillCall = tableRequests.some(r => r.type === 'bill_call');
    const hasOrder = tableRequests.some(r => r.type === 'order');

    let statusClass = 'room-clean';
    let statusLabel = 'Boş / Müsait';

    if (hasWaiterCall) {
      statusClass = 'room-maintenance';
      statusLabel = '🛎️ Garson Çağrısı!';
    } else if (hasBillCall) {
      statusClass = 'room-maintenance';
      statusLabel = '💵 Hesap İstiyor!';
    } else if (hasOrder) {
      statusClass = 'room-occupied';
      statusLabel = '🍳 Aktif Sipariş';
    } else if (table.status === 'occupied') {
      statusClass = 'room-occupied';
      statusLabel = 'Dolu';
    }

    const card = document.createElement('div');
    card.className = `aeon-card ${statusClass}`;
    card.style.cursor = 'pointer';
    card.style.background = 'var(--bg-card)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.boxShadow = 'var(--shadow-premium)';
    
    card.innerHTML = `
      <div class="aeon-card-content" style="padding: 10px; gap: 6px;">
        <div class="kds-header flex-between" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 6px; margin-bottom: 6px;">
          <strong style="color:var(--color-primary); font-size:14px;">Masa ${table.table_number}</strong>
          <span class="room-badge ${statusClass}" style="font-size:10px;">${statusLabel}</span>
        </div>
        <div class="text-xs text-muted" style="font-size:10px;">
          ${hasOrder ? '<span style="color:#fbbf24;">Sipariş Hazırlanıyor...</span>' : 'Bekleyen sipariş yok.'}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
};

// --- KITCHEN ADVANCED FEATURES (STAFF PORTAL) ---

window.openStaffPrepTasksModal = async () => {
  document.getElementById('staff-prep-tasks-modal').style.display = 'flex';
  const list = document.getElementById('staff-prep-tasks-list');
  if(!list) return;
  list.innerHTML = '<div class="spinner-border"></div> Yükleniyor...';
  
  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`);
    const data = await res.json();
    const tasks = data.filter(r => r.type === 'Görev' && r.department === 'Kitchen');
    
    list.innerHTML = '';
    if (tasks.length === 0) {
      list.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Bekleyen görev yok.</div>';
      return;
    }
    
    tasks.forEach(task => {
      const isDone = task.status === 'completed';
      const card = document.createElement('div');
      card.className = 'aeon-card';
      card.style.background = isDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card)';
      card.style.border = isDone ? '1px solid var(--success)' : '1px solid var(--border-glass)';
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <strong style="color: ${isDone ? 'var(--success)' : 'var(--color-primary)'}; font-size: 14px;">${task.target_identifier}</strong>
          <span class="badge" style="background: ${isDone ? 'var(--success)' : '#f59e0b'}; color: #fff;">${isDone ? 'Tamamlandı' : 'Bekliyor'}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Oluşturan: ${task.created_by || 'Bilinmiyor'}</div>
        ${!isDone ? `<button class="btn btn-primary btn-block btn-sm" onclick="window.completeStaffPrepTask('${task.id}')">Tamamla</button>` : ''}
      `;
      list.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div style="color:red; font-size:12px;">Yükleme hatası.</div>';
  }
};

window.completeStaffPrepTask = async (id) => {
  try {
    const res = await fetch(`/api/requests/${id}/status?tenant_id=${state.currentTenant}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', details: 'Mutfak ekibi tarafından tamamlandı.', completed_by: state.activeStaff.name })
    });
    if (res.ok) {
      window.openStaffPrepTasksModal();
    }
  } catch (err) {
    console.error(err);
  }
};

// Purchase Requests
window.openStaffPurchaseRequestsModal = async () => {
  document.getElementById('staff-purchase-requests-modal').style.display = 'flex';
  const list = document.getElementById('staff-purchase-requests-list');
  if(!list) return;
  list.innerHTML = '<div class="spinner-border"></div> Yükleniyor...';
  
  try {
    const res = await fetch(`/api/purchase_requests?tenant_id=${state.currentTenant}`);
    const data = await res.json();
    
    list.innerHTML = '';
    if (data.length === 0) {
      list.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Geçmiş talep bulunamadı.</div>';
    } else {
      data.forEach(req => {
        let badgeColor = req.status === 'pending' ? '#f59e0b' : (req.status === 'approved' ? 'var(--success)' : 'var(--danger)');
        let badgeText = req.status === 'pending' ? 'Bekliyor' : (req.status === 'approved' ? 'Onaylandı' : 'Reddedildi');
        
        const card = document.createElement('div');
        card.className = 'aeon-card';
        card.style.background = 'var(--bg-card)';
        
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <strong style="color: var(--color-primary); font-size: 14px;">${req.item_name}</strong>
            <span class="badge" style="background: ${badgeColor}; color: #fff;">${badgeText}</span>
          </div>
          <div style="font-size: 12px; color: var(--color-text-main); font-weight: bold; margin-bottom: 4px;">Miktar: ${req.quantity}</div>
          <div style="font-size: 10px; color: var(--text-muted);">İsteyen: ${req.requested_by} | ${new Date(req.created_at).toLocaleString('tr-TR')}</div>
        `;
        list.appendChild(card);
      });
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div style="color:red; font-size:12px;">Yükleme hatası.</div>';
  }
};

document.getElementById('staff-form-purchase-request')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const itemName = document.getElementById('staff-pr-item').value;
  const qty = parseFloat(document.getElementById('staff-pr-qty').value);
  
  try {
    const res = await fetch(`/api/purchase_requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: itemName, quantity: qty, requested_by: state.activeStaff.name })
    });
    if (res.ok) {
      e.target.reset();
      window.openStaffPurchaseRequestsModal(); // refresh
      alert('Satın alma talebi oluşturuldu!');
    } else {
      alert('Hata oluştu.');
    }
  } catch (err) {
    console.error(err);
  }
});

// Wastage Modal
window.openStaffWastageModal = async () => {
  document.getElementById('staff-wastage-modal').style.display = 'flex';
  const select = document.getElementById('staff-wastage-item');
  if(!select) return;
  select.innerHTML = '<option value="">Yükleniyor...</option>';
  
  try {
    const res = await fetch(`/api/inventory?tenant_id=${state.currentTenant}`);
    const inventory = await res.json();
    
    select.innerHTML = '<option value="">Seçiniz...</option>';
    inventory.filter(i => i.module_type !== 'bar').forEach(inv => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = `${inv.name} (${inv.stock.toFixed(1)} ${inv.unit} mevcut)`;
      opt.dataset.unit = inv.unit;
      opt.dataset.stock = inv.stock;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
};

document.getElementById('staff-form-wastage')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const select = document.getElementById('staff-wastage-item');
  const inventoryId = select.value;
  const qty = parseFloat(document.getElementById('staff-wastage-qty').value);
  const selectedOption = select.options[select.selectedIndex];
  
  if (!inventoryId || qty <= 0) return alert('Geçerli bir miktar girin.');
  if (qty > parseFloat(selectedOption.dataset.stock)) return alert('Stokta bu kadar miktar yok!');
  
  try {
    const res = await fetch(`/api/inventory/${inventoryId}/waste?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, staff_name: state.activeStaff.name })
    });
    if (res.ok) {
      e.target.reset();
      document.getElementById('staff-wastage-modal').style.display = 'none';
      alert('Fire stoktan düşüldü ve kaydedildi!');
      if (window.loadStaffData) window.loadStaffData(); // reload dashboard
    } else {
      alert('Hata oluştu.');
    }
  } catch (err) {
    console.error(err);
  }
});

// Recipe Manager
window.openStaffRecipeManagerModal = async () => {
  document.getElementById('staff-recipe-manager-modal').style.display = 'flex';
  const list = document.getElementById('staff-recipes-list');
  if(!list) return;
  list.innerHTML = '<div class="spinner-border"></div> Yükleniyor...';
  
  try {
    const [resRecipes, resCatalog, resInv] = await Promise.all([
      fetch(`/api/recipes?tenant_id=${state.currentTenant}`),
      fetch(`/api/catalog?tenant_id=${state.currentTenant}`),
      fetch(`/api/inventory?tenant_id=${state.currentTenant}`)
    ]);
    const recipes = await resRecipes.json();
    const catalog = await resCatalog.json();
    const inventory = await resInv.json();
    
    list.innerHTML = '';
    
    // Group recipes by catalog item
    const map = {};
    recipes.forEach(r => {
      if (!map[r.catalog_item_id]) map[r.catalog_item_id] = [];
      map[r.catalog_item_id].push(r);
    });
    
    catalog.filter(c => c.module_type !== 'bar').forEach(catItem => {
      const itemRecipes = map[catItem.id];
      if (!itemRecipes || itemRecipes.length === 0) return; // Skip if no recipe
      
      const card = document.createElement('div');
      card.className = 'aeon-card';
      card.style.background = 'var(--bg-card)';
      card.style.padding = '12px';
      
      let html = `<strong style="color: var(--color-primary); font-size: 14px; display: block; margin-bottom: 8px;">${catItem.name}</strong>`;
      html += `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <tr style="border-bottom: 1px solid var(--border-glass); color: var(--text-muted);"><th style="text-align:left; padding-bottom:4px;">Malzeme</th><th style="text-align:right; padding-bottom:4px;">Miktar</th></tr>`;
      
      itemRecipes.forEach(r => {
        const invItem = inventory.find(i => i.id === r.inventory_id);
        if (invItem) {
          html += `<tr style="border-bottom: 1px dashed rgba(0,0,0,0.05);">
            <td style="padding: 6px 0; color: var(--color-text-main);">${invItem.name}</td>
            <td style="padding: 6px 0; text-align:right; font-weight: bold; color: var(--color-primary);">${r.amount_needed} ${invItem.unit}</td>
          </tr>`;
        }
      });
      html += `</table>`;
      card.innerHTML = html;
      list.appendChild(card);
    });
    
    if (list.innerHTML === '') {
      list.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Kayıtlı mutfak reçetesi bulunamadı.</div>';
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div style="color:red; font-size:12px;">Yükleme hatası.</div>';
  }
};


// ==========================================
// DESKTOP SIMULATOR SPECIFIC CODE
// ==========================================



export function setupDesktopStaffSimulator() {
  const btnStaffLogout = document.getElementById('btn-staff-logout');
  function performLogout() {
    if (window.aeonLogout) return window.aeonLogout();
    state.activeStaff = null;
    state.activeStaff = null;
    updateActiveStaffLabels();
    window.location.replace(`/login.html?tenant_id=${state.currentTenant}`);
  }

  if (btnStaffLogout) btnStaffLogout.addEventListener('click', performLogout);

  document.querySelectorAll('.btn-staff-logout-action').forEach(btn => btn.addEventListener('click', performLogout));

  // HK Minibar billing form submission
  const minibarForm = document.getElementById('form-staff-hk-minibar');
  if (minibarForm) {
    minibarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomId = document.getElementById('staff-hk-minibar-room').value;
      const itemId = document.getElementById('staff-hk-minibar-item').value;
      const qty = parseInt(document.getElementById('staff-hk-minibar-qty').value) || 1;

      const roomObj = state.roomsList?.find(r => r.id === roomId);
      const targetIdentifier = roomObj ? `Room-${roomObj.room_number}` : `Room-${roomId}`;

      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order',
            target_identifier: targetIdentifier,
            details: [{ itemId, quantity: qty }],
            payment_method: 'room_charge',
            created_by: getActiveStaffLabel()
          })
        });
        if (res.ok) {
          const result = await res.json();
          logEvent('event', `Mobil HK: Minibar tüketimi girildi: <strong>${targetIdentifier}</strong> - Tutar: ${result.totalAmount} TL`);
          minibarForm.reset();
          loadStaffSimulatorData();
          alert("Minibar tüketimi başarıyla faturaya yansıtıldı.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Inter-departmental Task Sending form submission
  document.addEventListener('submit', async (e) => {
    if (e.target && e.target.classList.contains('form-staff-send-task')) {
      e.preventDefault();
      const form = e.target;
      const fromDept = form.getAttribute('data-from');
      const toDept = form.querySelector('.task-to-dept').value;
      const location = form.querySelector('.task-location').value;
      const desc = form.querySelector('.task-desc').value;

      try {
        const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'staff_task',
            target_identifier: `Staff-${toDept}`,
            details: `${fromDept.toUpperCase()} Birimi ➡️ ${desc} (${location})`,
            payment_method: 'none',
            created_by: getActiveStaffLabel()
          })
        });
        if (res.ok) {
          logEvent('event', `Mobil Görev: <strong>${fromDept.toUpperCase()} ➡️ ${toDept.toUpperCase()}</strong> Görevi iletildi: "${desc}"`);
          form.reset();
          loadStaffSimulatorData();
          alert("İş görevi başarıyla ilgili departmana iletildi!");
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Stock Movement form submission
  const stockForm = document.getElementById('form-staff-stock-movement');
  if (stockForm) {
    stockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inventoryId = document.getElementById('staff-stock-item').value;
      const type = document.getElementById('staff-stock-type').value;
      const qty = parseFloat(document.getElementById('staff-stock-qty').value) || 0;

      const itemSelect = document.getElementById('staff-stock-item');
      const itemName = itemSelect.options[itemSelect.selectedIndex].text;

      try {
        const res = await fetch(`/api/inventory/movement?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventoryId, type, quantity: qty, staff_name: getActiveStaffLabel() })
        });
        if (res.ok) {
          const result = await res.json();
          logEvent('event', `Mobil Depo: Stok Hareketi işlendi: <strong>${itemName}</strong> (${type === 'in' ? '+' : '-'}${qty}) - Yeni Stok: ${result.newStock}`);
          stockForm.reset();
          loadStaffSimulatorData();
          loadAllData(); // reload desktop POS limits immediately
          alert(`Stok hareketi kaydedildi. Yeni Stok: ${result.newStock}`);
        } else {
          const errData = await res.json();
          alert(errData.error || "Stok hareketi işlenemedi.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global helper functions to window for staff triggers
  window.staffCheckoutRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/checkout?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil HK: Oda çıkışı tamamlandı. Oda temizlik sırasına alındı.`);
        loadStaffSimulatorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffSetRoomClean = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'cleaning', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil HK: Oda temizlendi olarak işaretlendi.`);
        loadStaffSimulatorData();
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffResolveMaintenance = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'dirty_vacant', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil Teknik: Arıza giderildi, temizlik sırasına alındı.`);
        loadStaffSimulatorData();
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffUpdateKdsStatus = async (requestId, status) => {
    try {
      const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, completed_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil KDS: Sipariş durumu güncellendi: <strong>${status}</strong> (#${requestId})`);
        loadStaffSimulatorData();
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffCompleteTask = async (requestId) => {
    try {
      const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: 'completed', completed_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Mobil Görev: Personel iş görevini tamamladı. (#${requestId})`);
        loadStaffSimulatorData();
        loadAllData();
        alert("Görev tamamlandı olarak işaretlendi.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.staffCompleteLaundry = async (id) => {
    try {
      const res = await fetch(`/api/hk/laundry/${id}/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) { loadStaffSimulatorData(); }
    } catch (err) { console.error(err); }
  };

  window.staffClaimLostFound = async (id) => {
    try {
      const res = await fetch(`/api/hk/lost-found/${id}/claim?tenant_id=${state.currentTenant}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimed_by: getActiveStaffLabel() })
      });
      if (res.ok) { loadStaffSimulatorData(); }
    } catch (err) { console.error(err); }
  };

  window.openLostFoundModal = () => {
    document.getElementById('lost-found-modal').style.display = 'flex';
  };

  window.submitLostFound = async () => {
    const item_name = document.getElementById('lf-item-name').value.trim();
    const found_location = document.getElementById('lf-location').value.trim();
    const description = document.getElementById('lf-description').value.trim();
    if (!item_name) { alert('Eşya adı gereklidir.'); return; }
    try {
      const res = await fetch(`/api/hk/lost-found?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name, found_location, description, found_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        document.getElementById('lost-found-modal').style.display = 'none';
        document.getElementById('lf-item-name').value = '';
        document.getElementById('lf-location').value = '';
        document.getElementById('lf-description').value = '';
        loadStaffSimulatorData();
      }
    } catch (err) { console.error(err); }
  };

  registerLoader('loadStaffSimulatorData', loadStaffSimulatorData);
  updateActiveStaffLabels();
}







export async function loadStaffSimulatorData() {
  const activeSub = document.querySelector('#staff-screen-content .guest-subview.active') || document.querySelector('body > .guest-subview.active') || document.querySelector('.guest-subview.active');
  if (!activeSub) return;
  const viewId = activeSub.id;

  try {
    const roomsRes = await fetch(`/api/rooms?tenant_id=${state.currentTenant}`);
    const requestsRes = await fetch(`/api/requests?tenant_id=${state.currentTenant}`);
    const inventoryRes = await fetch(`/api/inventory?tenant_id=${state.currentTenant}`);
    
    if (roomsRes.ok && requestsRes.ok && inventoryRes.ok) {
      const rooms = await roomsRes.json();
      const requests = await requestsRes.json();
      const inventory = await inventoryRes.json();
      
      state.roomsList = rooms;

      if (viewId === 'staff-view-hk') {
        renderStaffHkPanel(rooms, requests);
        // Load laundry and lost-found in parallel
        const [laundryRes, lfRes] = await Promise.all([
          fetch(`/api/hk/laundry?tenant_id=${state.currentTenant}`).catch(() => null),
          fetch(`/api/hk/lost-found?tenant_id=${state.currentTenant}`).catch(() => null)
        ]);
        if (laundryRes && laundryRes.ok) renderLaundryList(await laundryRes.json());
        if (lfRes && lfRes.ok) renderLostFoundList(await lfRes.json());
      }
      else if (viewId === 'staff-view-kitchen') renderDesktopStaffKitchenPanel(requests, inventory);
      else if (viewId === 'staff-view-restaurant') renderDesktopStaffRestaurantPanel(rooms, requests, inventory);
      else if (viewId === 'staff-view-tech') renderStaffTechPanel(rooms, requests);
      else if (viewId === 'staff-view-reception') renderDesktopStaffReceptionPanel(rooms, requests);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderStaffHkPanel(rooms, requests) {
  const list = document.getElementById('staff-hk-rooms-list');
  if (!list) return;
  list.innerHTML = '';

  const dirtyRooms = rooms.filter(r => r.status === 'dirty_vacant');
  
  if (dirtyRooms.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Temizlik bekleyen kirli oda bulunmuyor.</div>`;
  } else {
    dirtyRooms.forEach(room => {
      const item = document.createElement('div');
      item.className = 'kds-card status-pending';
      item.innerHTML = `
        <div class="kds-header">
          <span>Oda ${room.room_number}</span>
          <span class="room-badge dirty_vacant" style="font-size: 9px; padding: 2px 6px;">KİRLİ</span>
        </div>
        <div class="text-xs text-muted" style="margin-top: 4px;">
          ${room.dnd_active ? '<span class="text-danger">⚠️ DND AKTİF</span>' : 'DND Kapalı, temizlik yapılabilir.'}
        </div>
        <div class="kds-actions margin-top-sm">
          <button class="btn btn-success btn-xs btn-block" onclick="staffSetRoomClean('${room.id}')">
            <i class="fa-solid fa-broom"></i> Temizlendi Olarak İşaretle
          </button>
        </div>
      `;
      list.appendChild(item);
    });
  }

  // Render tasks assigned to HK
  const tasksContainer = document.getElementById('staff-hk-tasks-list');
  if (tasksContainer) {
    tasksContainer.innerHTML = '';
    const hkTasks = requests.filter(r => (r.department === 'Housekeeping' || r.target_identifier === 'Staff-hk') && r.status !== 'completed');
    if (hkTasks.length === 0) {
      tasksContainer.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Şu an atanmış özel görev bulunmuyor.</div>`;
    } else {
      hkTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'kds-card status-preparing';
        item.innerHTML = `
          <div class="kds-header">
            <span>Görev #${task.id.slice(-4)}</span>
            <span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">AÇIK</span>
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;">
            ${esc(task.details)}
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;">Oluşturan: ${task.created_by || '-'}</div>
          <div class="kds-actions margin-top-sm">
            <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteTask('${task.id}')">Tamamlandı</button>
          </div>
        `;
        tasksContainer.appendChild(item);
      });
    }
  }

  // Populate minibar room dropdown
  const roomSelect = document.getElementById('staff-hk-minibar-room');
  if (roomSelect) {
    roomSelect.innerHTML = '';
    rooms.filter(r => r.status === 'occupied').forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `Oda ${r.room_number}`;
      roomSelect.appendChild(opt);
    });
  }

  // Populate minibar items select
  const itemSelect = document.getElementById('staff-hk-minibar-item');
  if (itemSelect) {
    itemSelect.innerHTML = '';
    state.availableCatalog.filter(c => c.category === 'minibar').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.price} TL)`;
      itemSelect.appendChild(opt);
    });
  }
}

function renderDesktopStaffKitchenPanel(requests, inventory) {
  const list = document.getElementById('staff-kitchen-grid');
  if (!list) return;
  list.innerHTML = '';

  const now = Date.now();
  const kitchenTasks = requests.filter(r => {
    if (r.status === 'completed' || r.status === 'rejected') return false;
    if (r.department === 'Kitchen') return true;
    try {
      const depts = typeof r.departments === 'string' ? JSON.parse(r.departments) : (r.departments || []);
      return Array.isArray(depts) && depts.includes('Kitchen');
    } catch (e) { return false; }
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (kitchenTasks.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm"><i class="fa-solid fa-check-circle" style="color:var(--color-success);"></i> Bekleyen mutfak siparişi yok.</div>`;
  } else {
    kitchenTasks.forEach(order => {
      const card = document.createElement('div');
      const ageMs = now - new Date(order.created_at).getTime();
      const ageMins = Math.floor(ageMs / 60000);
      let urgencyColor = '#22c55e'; // green < 5 min
      if (ageMins >= 5 && ageMins < 12) urgencyColor = '#f59e0b'; // yellow
      if (ageMins >= 12) urgencyColor = '#ef4444'; // red

      let itemsList = order.details;
      if (order.type === 'order') {
        try {
          const items = typeof order.details === 'string' ? JSON.parse(order.details) : order.details;
          if (Array.isArray(items)) itemsList = items.map(i => `<strong>${i.quantity}x</strong> ${i.name || i.itemId}`).join('<br>');
        } catch(e) {}
      }

      const statusMap = { pending: 'BEKLİYOR', preparing: 'HAZIRLANIYOR', ready: 'HAZIR', in_progress: 'DEVAM EDIYOR' };
      let actionBtnHtml = '';
      if (order.status === 'pending' || order.status === 'in_progress') {
        actionBtnHtml = `<button class="btn btn-accent btn-xs btn-block" onclick="staffUpdateKdsStatus('${order.id}', 'preparing')"><i class="fa-solid fa-fire"></i> Hazırlamaya Başla</button>`;
      } else if (order.status === 'preparing') {
        actionBtnHtml = `<button class="btn btn-success btn-xs btn-block" onclick="staffUpdateKdsStatus('${order.id}', 'ready')"><i class="fa-solid fa-bell"></i> Hazır — Servise Çıkar</button>`;
      } else if (order.status === 'ready') {
        actionBtnHtml = `<button class="btn btn-primary btn-xs btn-block" onclick="staffUpdateKdsStatus('${order.id}', 'completed')"><i class="fa-solid fa-check"></i> Teslim Edildi</button>`;
      }

      const isRoomService = order.target_identifier && order.target_identifier.startsWith('Room-');
      card.className = `kds-card status-${order.status}`;
      card.style.borderLeft = `4px solid ${urgencyColor}`;
      card.innerHTML = `
        <div class="kds-header">
          <span style="font-weight:800; font-size:15px;">${order.target_identifier}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            ${isRoomService ? '<span style="font-size:9px; background:#7c3aed; color:#fff; border-radius:4px; padding:2px 5px;">ODA SERVİSİ</span>' : ''}
            <span style="font-size:9px; background:${urgencyColor}; color:#fff; border-radius:4px; padding:2px 5px;">${statusMap[order.status] || order.status.toUpperCase()}</span>
          </div>
        </div>
        <div style="font-size:12px; margin:6px 0; line-height:1.5;">${itemsList}</div>
        <div style="font-size:10px; color:${urgencyColor}; font-weight:700; margin-bottom:6px;"><i class="fa-solid fa-clock"></i> ${ageMins} dk önce</div>
        <div class="kds-actions">${actionBtnHtml}</div>
      `;
      list.appendChild(card);
    });
  }

  // Also render inventory in kitchen-subview-inv
  const invList = document.getElementById('staff-inv-list');
  if (invList && inventory && inventory.length > 0) {
    invList.innerHTML = '';
    const kitchenInv = inventory.filter(i => i.module_type === 'restaurant' || i.module_type === 'kitchen' || i.module_type === 'bar');
    if (kitchenInv.length === 0) {
      invList.innerHTML = `<div class="text-muted text-xs text-center">Mutfak/bar stok kalemi bulunamadı.</div>`;
    } else {
      kitchenInv.forEach(item => {
        const isLow = item.stock <= item.par_level;
        const div = document.createElement('div');
        div.className = 'kds-card';
        div.style.borderLeft = `4px solid ${isLow ? '#ef4444' : '#22c55e'}`;
        div.innerHTML = `
          <div class="kds-header">
            <span style="font-weight:600;">${item.name}</span>
            <span style="font-size:11px; font-weight:700; color:${isLow ? '#ef4444' : '#22c55e'}">${item.stock} ${item.unit}</span>
          </div>
          <div style="font-size:10px; color:var(--text-muted);">Par Seviyesi: ${item.par_level} ${item.unit} ${isLow ? '⚠️ DÜŞÜK STOK' : ''}</div>
        `;
        invList.appendChild(div);
      });
    }
  }
}

function renderDesktopStaffRestaurantPanel(rooms, requests, inventory) {
  const tablesList = document.getElementById('staff-restaurant-tables-grid');
  const readyList = document.getElementById('staff-restaurant-ready-grid');
  if (tablesList) tablesList.innerHTML = '';
  if (readyList) readyList.innerHTML = '';

  const restaurantTasks = requests.filter(r => (r.department === 'Restaurant') && r.status !== 'completed');
  if (readyList) {
      if (restaurantTasks.length === 0) {
        readyList.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Servis bekleyen görev yok.</div>`;
      } else {
        restaurantTasks.forEach(task => {
          const card = document.createElement('div');
          card.className = `kds-card status-ready`;
          card.innerHTML = `
            <div class="kds-header">
              <span>${task.target_identifier}</span>
              <span class="room-badge occupied" style="font-size:9px; padding: 2px 6px;">${task.type}</span>
            </div>
            <div class="text-xs text-muted" style="margin-top: 4px;">${esc(task.details)}</div>
            <div class="kds-actions margin-top-sm">
              <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteTask('${task.id}')">Tamamlandı</button>
            </div>
          `;
          readyList.appendChild(card);
        });
      }
  }
}

function renderDesktopStaffReceptionPanel(rooms, requests) {
  const list = document.getElementById('staff-reception-grid');
  if (!list) return;
  list.innerHTML = '';
  const tasks = requests.filter(r => r.department === 'Reception' && r.status !== 'completed');
  if (tasks.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Bekleyen genel istek bulunmuyor.</div>`;
  } else {
    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `kds-card status-pending`;
      card.innerHTML = `
        <div class="kds-header">
          <span>${task.target_identifier}</span>
          <span class="room-badge occupied" style="font-size:9px; padding: 2px 6px;">${task.type}</span>
        </div>
        <div class="text-xs text-muted" style="margin-top: 4px;">${esc(task.details)}</div>
        <div class="kds-actions margin-top-sm">
          <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteTask('${task.id}')">Tamamlandı</button>
        </div>
      `;
      list.appendChild(card);
    });
  }
}

function renderDesktopStaffTechPanel(rooms, requests) {
  const list = document.getElementById('staff-tech-rooms-list');
  if (!list) return;
  list.innerHTML = '';

  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance');
  
  if (maintenanceRooms.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Arızalı/bakımda olan oda bulunmuyor.</div>`;
  } else {
    maintenanceRooms.forEach(room => {
      const card = document.createElement('div');
      card.className = 'kds-card status-pending';
      card.innerHTML = `
        <div class="kds-header">
          <span>Oda ${room.room_number}</span>
          <span class="room-badge maintenance" style="font-size:9px; padding:2px 6px;">BAKIM</span>
        </div>
        <div class="text-xs text-muted" style="margin-top: 4px;">
          Sorun: Arızalı oda bakıma alındı (Simüle)
        </div>
        <div class="kds-actions margin-top-sm">
          <button class="btn btn-success btn-xs btn-block" onclick="staffResolveMaintenance('${room.id}')">
            <i class="fa-solid fa-wrench"></i> Arızayı Giderdim
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // Render tasks assigned to Tech
  const tasksContainer = document.getElementById('staff-tech-tasks-list');
  if (tasksContainer) {
    tasksContainer.innerHTML = '';
    const techTasks = requests.filter(r => (r.department === 'Maintenance' || r.target_identifier === 'Staff-tech') && r.status !== 'completed');
    if (techTasks.length === 0) {
      tasksContainer.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Şu an atanmış özel arıza/bakım görevi bulunmuyor.</div>`;
    } else {
      techTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'kds-card status-preparing';
        item.innerHTML = `
          <div class="kds-header">
            <span>Görev #${task.id.slice(-4)}</span>
            <span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">AÇIK</span>
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;">
            ${esc(task.details)}
          </div>
          <div class="text-xs text-muted" style="margin-top:4px;">Oluşturan: ${task.created_by || '-'}</div>
          <div class="kds-actions margin-top-sm">
            <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteTask('${task.id}')">Tamamlandı</button>
          </div>
        `;
        tasksContainer.appendChild(item);
      });
    }
  }
}

function renderLaundryList(orders) {
  const list = document.getElementById('staff-hk-laundry-list');
  if (!list) return;
  list.innerHTML = '';
  const pending = orders.filter(o => o.status !== 'completed');
  if (pending.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Bekleyen çamaşır talebi yok.</div>`;
    return;
  }
  pending.forEach(order => {
    const div = document.createElement('div');
    div.className = 'kds-card status-pending';
    div.innerHTML = `
      <div class="kds-header">
        <span style="font-weight:600;">Oda ${order.room_id}</span>
        <span style="font-size:9px; background:rgba(245,158,11,0.2); color:#f59e0b; border-radius:4px; padding:2px 5px;">BEKLIYOR</span>
      </div>
      <div style="font-size:12px; margin:4px 0;">${order.items || '-'}</div>
      <div class="kds-actions margin-top-sm">
        <button class="btn btn-success btn-xs btn-block" onclick="staffCompleteLaundry('${order.id}')">Tamamlandı</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderLostFoundList(items) {
  const list = document.getElementById('staff-hk-lost-found-list');
  if (!list) return;
  list.innerHTML = '';
  const open = items.filter(i => i.status !== 'claimed');
  if (open.length === 0) {
    list.innerHTML = `<div class="text-muted text-xs text-center padding-sm">Teslim bekleyen kayıp eşya yok.</div>`;
    return;
  }
  open.forEach(item => {
    const div = document.createElement('div');
    div.className = 'kds-card';
    div.innerHTML = `
      <div class="kds-header">
        <span style="font-weight:600;">${item.item_name}</span>
        <span style="font-size:9px; background:rgba(239,68,68,0.15); color:#ef4444; border-radius:4px; padding:2px 5px;">TESLİM BEKLİYOR</span>
      </div>
      <div style="font-size:11px; color:var(--text-muted); margin:4px 0;">Yer: ${item.found_location || '-'}</div>
      <div style="font-size:11px; margin:4px 0;">${item.description || ''}</div>
      <div class="kds-actions margin-top-sm">
        <button class="btn btn-primary btn-xs btn-block" onclick="staffClaimLostFound('${item.id}')">Teslim Edildi</button>
      </div>
    `;
    list.appendChild(div);
  });
}


// ==========================================
// DYNAMIC DISPATCH ROUTER
// ==========================================
export function setupStaffSimulator() {
  const isMobile = document.body.classList.contains('mobile-app-container') || document.getElementById('btn-select-hk') || document.getElementById('btn-staff-logout');
  if (isMobile) {
    return setupMobileStaffSimulator();
  } else {
    return setupDesktopStaffSimulator();
  }
}
