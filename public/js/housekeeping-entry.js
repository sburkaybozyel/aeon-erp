import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

let hkRooms = [];
let hkRequests = [];
let hkCatalog = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || user.role.toLowerCase() !== 'housekeeping') return;

  setupTabs();
  setupFilters();
  setupModals();
  setupActions();

  await loadHousekeepingData();

  initHkSSE();
  setInterval(loadHousekeepingData, 15000);

  setupStaffPushNotifications(user);
  startRequestNotifications({ surface: 'housekeeping' });
});

function initHkSSE() {
  const url = `/api/events?tenant_id=${state.currentTenant}`;
  const es = new EventSource(url);
  es.addEventListener('room_updated', loadHousekeepingData);
  es.addEventListener('request_updated', loadHousekeepingData);
  es.addEventListener('request_created', loadHousekeepingData);
  es.onerror = () => {
    es.close();
    setTimeout(initHkSSE, 3000);
  };
}

async function loadHousekeepingData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, reqsRes, catRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`)
    ]);

    if (roomsRes.ok) hkRooms = await roomsRes.json();
    if (reqsRes.ok) hkRequests = await reqsRes.json();
    if (catRes.ok) hkCatalog = await catRes.json();

    renderRooms();
    renderPublicAreas();
    renderLaundry();
    renderLostFound();
    populateMinibarDropdown();
  } catch (err) {
    console.error(err);
  }
}

function setupTabs() {
  const tabs = ['rooms', 'public', 'laundry', 'lostfound'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`nav-hk-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => {
          document.getElementById(`nav-hk-tab-${t}`).classList.remove('active');
          document.getElementById(`hk-subview-${t}`).classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(`hk-subview-${tab}`).classList.add('active');
      });
    }
  });
}

function setupFilters() {
  const filters = ['all', 'dirty', 'clean', 'dnd'];
  filters.forEach(filter => {
    const btn = document.querySelector(`.hk-filter-btn[data-filter="${filter}"]`);
    if (btn) {
      btn.addEventListener('click', () => {
        filters.forEach(f => {
          document.querySelector(`.hk-filter-btn[data-filter="${f}"]`).classList.remove('active');
        });
        btn.classList.add('active');
        currentFilter = filter;
        renderRooms();
      });
    }
  });
}

function renderRooms() {
  const grid = document.getElementById('hk-rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = hkRooms;
  if (currentFilter === 'dirty') filtered = hkRooms.filter(r => r.status === 'dirty_vacant');
  if (currentFilter === 'clean') filtered = hkRooms.filter(r => r.status === 'clean_vacant');
  if (currentFilter === 'dnd') filtered = hkRooms.filter(r => r.is_dnd);

  filtered.forEach(room => {
    const card = document.createElement('div');
    card.className = `room-card room-status-${room.status === 'clean_vacant' ? 'clean' : room.status === 'dirty_vacant' ? 'dirty' : room.status === 'occupied' ? 'occupied' : 'maintenance'}`;
    
    let badgeClass = 'badge-secondary';
    let statusText = 'Boş';
    if (room.status === 'clean_vacant') { badgeClass = 'badge-success'; statusText = 'Temiz'; }
    if (room.status === 'dirty_vacant') { badgeClass = 'badge-warning'; statusText = 'Kirli'; }
    if (room.status === 'occupied') { badgeClass = 'badge-primary'; statusText = 'Dolu'; }
    if (room.status === 'maintenance') { badgeClass = 'badge-danger'; statusText = 'Teknik'; }

    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-number">${room.room_number}</span>
        <span class="badge ${badgeClass}">${statusText}</span>
      </div>
      <div class="room-guest">${room.status === 'occupied' ? 'Dolu' : 'Boş'}</div>
      <div class="room-details">Oda Tipi: ${room.bed_type || 'Standard'}</div>
      <div style="font-size:10px; margin-top:5px; color:var(--color-text-muted)">
        ${room.is_dnd ? '<span class="badge badge-danger">DND</span> ' : ''}
        ${room.late_checkout ? '<span class="badge badge-warning">Geç Çıkış</span> ' : ''}
      </div>
    `;

    card.addEventListener('click', () => openRoomDetail(room));
    grid.appendChild(card);
  });
}

let activeRoom = null;

function openRoomDetail(room) {
  activeRoom = room;
  document.getElementById('modal-room-title').textContent = `Oda ${room.room_number} Temizlik Kaydı`;
  document.getElementById('modal-room-status').value = room.status;
  document.getElementById('modal-room-dnd').checked = room.is_dnd || false;

  const minibarSection = document.getElementById('modal-minibar-section');
  if (room.status === 'occupied') {
    minibarSection.style.display = 'block';
  } else {
    minibarSection.style.display = 'none';
  }

  document.getElementById('room-detail-modal').style.display = 'flex';
}

function setupModals() {
  document.getElementById('btn-close-room-modal').addEventListener('click', () => {
    document.getElementById('room-detail-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-room-modal').addEventListener('click', () => {
    document.getElementById('room-detail-modal').style.display = 'none';
  });
  document.getElementById('btn-save-room-modal').addEventListener('click', saveRoomDetails);

  document.getElementById('btn-modal-add-minibar').addEventListener('click', postMinibarCharge);

  // Inspection checklist
  document.getElementById('btn-close-checklist-modal').addEventListener('click', () => {
    document.getElementById('hk-checklist-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-checklist-modal').addEventListener('click', () => {
    document.getElementById('hk-checklist-modal').style.display = 'none';
  });
  document.getElementById('btn-submit-inspection').addEventListener('click', submitInspection);

  // Lost & Found
  document.getElementById('btn-add-lostfound').addEventListener('click', () => {
    document.getElementById('lf-item-name').value = '';
    document.getElementById('lf-location').value = '';
    document.getElementById('lf-description').value = '';
    document.getElementById('lost-found-modal').style.display = 'flex';
  });
  document.getElementById('btn-close-lf-modal').addEventListener('click', () => {
    document.getElementById('lost-found-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-lf-modal').addEventListener('click', () => {
    document.getElementById('lost-found-modal').style.display = 'none';
  });
  document.getElementById('btn-submit-lostfound').addEventListener('click', submitLostFound);
}

async function saveRoomDetails() {
  if (!activeRoom) return;
  const status = document.getElementById('modal-room-status').value;
  const dnd = document.getElementById('modal-room-dnd').checked;

  try {
    const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: activeRoom.room_number,
        status,
        is_dnd: dnd,
        updated_by: 'Housekeeping'
      })
    });
    if (res.ok) {
      document.getElementById('room-detail-modal').style.display = 'none';

      // If room is changed to dirty_vacant or standard checkouts, trigger inspection if manager approved
      if (status === 'clean_vacant') {
        openInspectionChecklist(activeRoom);
      } else {
        loadHousekeepingData();
      }
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Oda durumu güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Oda durumu güncellenemedi.');
  }
}

function openInspectionChecklist(room) {
  activeRoom = room;
  document.querySelectorAll('.hk-check-item').forEach(c => c.checked = false);
  document.getElementById('hk-checklist-notes').value = '';
  document.getElementById('hk-checklist-modal').style.display = 'flex';
}

async function submitInspection() {
  if (!activeRoom) return;
  const checkboxes = document.querySelectorAll('.hk-check-item');
  const unchecked = Array.from(checkboxes).filter(c => !c.checked);
  if (unchecked.length > 0) {
    alert("Lütfen tüm kontrol listesi öğelerini doğrulayın!");
    return;
  }
  const notes = document.getElementById('hk-checklist-notes').value;

  try {
    const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: activeRoom.room_number,
        status: 'clean_vacant',
        inspection_completed: true,
        maintenance_notes: notes,
        updated_by: 'Housekeeping Supervisor'
      })
    });
    if (res.ok) {
      document.getElementById('hk-checklist-modal').style.display = 'none';
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Denetim kaydedilemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Denetim kaydedilemedi.');
  }
}

function populateMinibarDropdown() {
  const select = document.getElementById('modal-minibar-item');
  if (!select) return;
  select.innerHTML = '';
  
  const minibarItems = hkCatalog.filter(item => item.category === 'minibar');
  minibarItems.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.price} TL)`;
    select.appendChild(opt);
  });
}

async function postMinibarCharge() {
  if (!activeRoom) return;
  const itemId = document.getElementById('modal-minibar-item').value;
  const qty = parseInt(document.getElementById('modal-minibar-qty').value) || 1;
  if (!itemId) return;

  try {
    const targetIdentifier = `Room-${activeRoom.room_number}`;
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: targetIdentifier,
        details: [{ itemId, quantity: qty }],
        payment_method: 'room_charge',
        created_by: 'Housekeeping'
      })
    });
    if (res.ok) {
      alert("Minibar harcaması odaya eklendi.");
      document.getElementById('room-detail-modal').style.display = 'none';
      loadHousekeepingData();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderPublicAreas() {
  const list = document.getElementById('hk-public-areas-list');
  if (!list) return;
  list.innerHTML = '';

  const areas = [
    { name: 'Lobi & Resepsiyon Alanı', schedule: 'Her 2 saatte bir' },
    { name: 'Havuz & Çevre Alanı', schedule: 'Günde 3 kez' },
    { name: 'Genel Tuvaletler', schedule: 'Saatlik' },
    { name: 'Spa & Fitness Salonu', schedule: 'Her 4 saatte bir' }
  ];

  areas.forEach(area => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '12px 16px';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong style="font-size: 14px;">${area.name}</strong>
          <div class="text-muted small" style="margin-top:2px;">Plan: ${area.schedule}</div>
        </div>
        <button class="btn btn-success btn-xs" onclick="alert('${area.name} temizliği onaylandı.')">Temizlendi</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderLaundry() {
  const list = document.getElementById('hk-laundry-list');
  if (!list) return;
  list.innerHTML = '';

  const laundryTasks = hkRequests.filter(r => r.type === 'laundry_request' || r.details?.includes('laundry') || r.details?.includes('çamaşır'));
  if (laundryTasks.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Aktif çamaşır talebi bulunmuyor.</div>';
    return;
  }

  laundryTasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '14px';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${task.target_identifier}</strong>
        <span class="badge badge-warning">${task.status}</span>
      </div>
      <div class="small" style="margin-top: 6px; margin-bottom: 8px;">${task.details}</div>
      ${task.status !== 'completed' ? `<button class="btn btn-success btn-xs btn-block" onclick="completeTask('${task.id}')">Teslim Edildi / Tamamlandı</button>` : ''}
    `;
    list.appendChild(card);
  });
}

window.completeTask = async function(id) {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed', updated_by: 'Housekeeping' })
    });
    if (res.ok) {
      loadHousekeepingData();
    }
  } catch (err) {
    console.error(err);
  }
};

function renderLostFound() {
  const list = document.getElementById('hk-lostfound-list');
  if (!list) return;
  list.innerHTML = '';

  // Get lost & found records from server or mock
  const lfItems = hkRequests.filter(r => r.type === 'lostfound_report' || r.details?.includes('Kayıp Eşya') || r.details?.includes('lostfound'));
  if (lfItems.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Bildirilmiş kayıp eşya bulunmuyor.</div>';
    return;
  }

  lfItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '12px';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${item.target_identifier}</strong>
        <span class="badge badge-secondary">Bulundu</span>
      </div>
      <div class="small" style="margin-top: 6px;">${item.details}</div>
    `;
    list.appendChild(card);
  });
}

async function submitLostFound() {
  const item = document.getElementById('lf-item-name').value;
  const location = document.getElementById('lf-location').value;
  const desc = document.getElementById('lf-description').value;

  if (!item || !location) {
    alert("Eşya adı ve konum zorunludur!");
    return;
  }

  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task',
        target_identifier: location,
        details: `Kayıp Eşya: ${item}. Açıklama: ${desc}`,
        department: 'Housekeeping',
        created_by: 'Housekeeping'
      })
    });
    if (res.ok) {
      document.getElementById('lost-found-modal').style.display = 'none';
      loadHousekeepingData();
    }
  } catch (err) {
    console.error(err);
  }
}

function setupActions() {
  const btnLogout = document.getElementById('btn-staff-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (window.aeonLogout) window.aeonLogout();
    });
  }
}
