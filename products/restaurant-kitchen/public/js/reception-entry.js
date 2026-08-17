import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

// Task/room fields below (guest names, task details/target identifiers) can carry free text
// that ultimately originated from a guest — a precheckin note, a channel-manager webhook, or a
// QR-menu order comment — so every interpolation into innerHTML goes through this first.
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

const TASK_TYPE_LABELS = {
  housekeeping_request: 'Housekeeping',
  maintenance_request: 'Teknik Servis',
  room_service: 'Oda Servisi',
  order: 'Sipariş',
  wakeup_call: 'Uyandırma',
  porter_request: 'Porter',
  taxi_request: 'Taksi / Vale',
  minibar_request: 'Minibar'
};
const taskTypeLabel = type => TASK_TYPE_LABELS[type] || escapeHtml(type || '-');

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and branding
  const user = await window.aeonBoot();
  if (!user || user.role.toLowerCase() !== 'reception') return;

  setupTabs();
  setupActions();
  setupModals();

  await loadReceptionData();

  // SSE connection for real-time updates
  initReceptionSSE();

  // Polling fallback
  setInterval(loadReceptionData, 15000);

  setupStaffPushNotifications(user);
  startRequestNotifications({ surface: 'reception' });
});

// SSE Specific to Reception
function initReceptionSSE() {
  const url = `/api/events?tenant_id=${state.currentTenant}`;
  const es = new EventSource(url);
  es.addEventListener('room_updated', loadReceptionData);
  es.addEventListener('request_updated', loadReceptionData);
  es.addEventListener('request_created', loadReceptionData);
  es.onerror = () => {
    es.close();
    setTimeout(initReceptionSSE, 3000);
  };
}

let receptionRooms = [];
let receptionRequests = [];
let receptionDataLoadedOnce = false;

function setReceptionError(visible) {
  const banner = document.getElementById('reception-error-banner');
  if (banner) banner.hidden = !visible;
}

async function loadReceptionData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, reqsRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/requests${tenantParam}`)
    ]);

    if (!roomsRes.ok || !reqsRes.ok) throw new Error('Oda veya istek verileri alınamadı.');
    receptionRooms = await roomsRes.json();
    receptionRequests = await reqsRes.json();

    receptionDataLoadedOnce = true;
    setReceptionError(false);
    renderFeed();
    renderRoomsGrid();
    loadShiftNotes();
  } catch (err) {
    console.error("Reception data load failed:", err);
    // Surface connectivity trouble instead of leaving the feed/room grid silently on stale
    // (or, on first load, empty) data — a blank "0 rooms" screen during a live check-in queue
    // reads as "the hotel is empty" rather than "the network dropped".
    setReceptionError(true);
  }
}

function setupTabs() {
  const tabs = ['feed', 'rooms', 'actions'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`nav-reception-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => {
          document.getElementById(`nav-reception-tab-${t}`).classList.remove('active');
          document.getElementById(`reception-subview-${t}`).classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(`reception-subview-${tab}`).classList.add('active');
      });
    }
  });
}

function renderFeed() {
  const statsContainer = document.getElementById('reception-dashboard-stats');
  if (statsContainer) {
    if (receptionRooms.length > 0) {
      const total = receptionRooms.length;
      const occupied = receptionRooms.filter(r => r.status === 'occupied').length;
      const dirty = receptionRooms.filter(r => r.status === 'dirty_vacant').length;
      const occRate = Math.round((occupied / total) * 100);
      const pending = receptionRequests.filter(r => r.status === 'pending').length;

      statsContainer.innerHTML = `
        <div class="rcp-kpi-card" style="--kpi-color: var(--color-primary)">
          <div class="rcp-kpi-value">${occRate}%</div>
          <div class="rcp-kpi-label">Doluluk</div>
        </div>
        <div class="rcp-kpi-card" style="--kpi-color: var(--status-dirty)">
          <div class="rcp-kpi-value">${dirty}</div>
          <div class="rcp-kpi-label">Kirli Oda</div>
        </div>
        <div class="rcp-kpi-card" style="--kpi-color: var(--color-warning)">
          <div class="rcp-kpi-value">${pending}</div>
          <div class="rcp-kpi-label">Bekleyen</div>
        </div>
      `;
    } else if (!receptionDataLoadedOnce) {
      statsContainer.innerHTML = `<div class="rcp-kpi-card rcp-kpi-skeleton"></div><div class="rcp-kpi-card rcp-kpi-skeleton"></div><div class="rcp-kpi-card rcp-kpi-skeleton"></div>`;
    }
  }

  const list = document.getElementById('staff-reception-grid');
  if (!list) return;

  const active = receptionRequests.filter(r => r.status !== 'completed' && r.status !== 'delivered');
  if (active.length === 0) {
    list.innerHTML = `<div class="rcp-empty"><i class="fa-solid fa-circle-check"></i><span>Bekleyen istek bulunmamaktadır.</span></div>`;
    return;
  }

  list.innerHTML = active.map(task => `
    <div class="rcp-feed-card">
      <div class="rcp-feed-card-head">
        <strong>${escapeHtml(task.target_identifier)}</strong>
        <span class="badge badge-warning">${taskTypeLabel(task.type)}</span>
      </div>
      <div class="rcp-feed-card-details">${escapeHtml(task.details) || '-'}</div>
      <button class="btn btn-success btn-sm btn-block" data-complete-task="${escapeHtml(task.id)}">Tamamlandı</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-complete-task]').forEach(btn => btn.addEventListener('click', () => window.completeTask(btn.dataset.completeTask)));
}

window.completeTask = async function(id) {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed', updated_by: 'Resepsiyon' })
    });
    if (res.ok) {
      loadReceptionData();
    }
  } catch (err) {
    console.error(err);
  }
};

function renderRoomsGrid() {
  const grid = document.getElementById('reception-rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';

  receptionRooms.forEach(room => {
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
      <div class="room-guest">${room.status === 'occupied' ? (room.guest_name || 'Dolu') : 'Boş'}</div>
      <div class="room-details">Bed: ${room.bed_type || 'Standard'} | Fiyat: ${room.base_rate} TL</div>
    `;

    card.addEventListener('click', () => openRoomDetail(room));
    grid.appendChild(card);
  });
}

let activeRoom = null;

function openRoomDetail(room) {
  activeRoom = room;
  document.getElementById('modal-room-title').textContent = `Oda ${room.room_number} Yönetimi`;
  document.getElementById('modal-room-status').value = room.status;
  document.getElementById('modal-room-ac').value = room.ac_status || 'working';
  document.getElementById('modal-room-notes').value = room.maintenance_notes || '';
  document.getElementById('modal-room-vip').checked = room.is_vip || false;
  document.getElementById('modal-room-late-checkout').checked = room.late_checkout || false;

  const guestSec = document.getElementById('modal-guest-section');
  const checkinSec = document.getElementById('modal-checkin-section');

  if (room.status === 'occupied') {
    guestSec.style.display = 'block';
    checkinSec.style.display = 'none';
    document.getElementById('modal-guest-name-disp').textContent = room.guest_name || 'Dolu';
  } else {
    guestSec.style.display = 'none';
    checkinSec.style.display = 'block';
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

  document.getElementById('btn-modal-checkout').addEventListener('click', checkoutRoom);
  document.getElementById('btn-modal-checkin').addEventListener('click', checkinRoom);

  // Task creation modals
  document.getElementById('btn-close-task-modal').addEventListener('click', () => {
    document.getElementById('create-task-modal').style.display = 'none';
  });
  document.getElementById('btn-cancel-task-modal').addEventListener('click', () => {
    document.getElementById('create-task-modal').style.display = 'none';
  });
  document.getElementById('btn-submit-task-modal').addEventListener('click', submitTask);
}

async function saveRoomDetails() {
  if (!activeRoom) return;
  const status = document.getElementById('modal-room-status').value;
  const ac = document.getElementById('modal-room-ac').value;
  const notes = document.getElementById('modal-room-notes').value;
  const vip = document.getElementById('modal-room-vip').checked;
  const late = document.getElementById('modal-room-late-checkout').checked;

  try {
    if (status && status !== activeRoom.status) {
      const statusRes = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_number: activeRoom.room_number, status, updated_by: 'Resepsiyon' })
      });
      if (!statusRes.ok) {
        const body = await statusRes.json().catch(() => ({}));
        alert(body.error || 'Oda durumu güncellenemedi.');
        return;
      }
    }

    const detailsRes = await fetch(`/api/rooms/update-details?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: activeRoom.room_number,
        acStatus: ac,
        maintenanceNotes: notes,
        vip,
        lateCheckout: late,
        updated_by: 'Resepsiyon'
      })
    });
    if (detailsRes.ok) {
      document.getElementById('room-detail-modal').style.display = 'none';
      loadReceptionData();
    } else {
      const body = await detailsRes.json().catch(() => ({}));
      alert(body.error || 'Oda bilgileri güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Oda bilgileri güncellenemedi.');
  }
}

async function checkoutRoom() {
  if (!activeRoom) return;
  if (!confirm(`Oda ${activeRoom.room_number} çıkış işlemini onaylıyor musunuz?`)) return;
  try {
    const res = await fetch(`/api/rooms/checkout?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number: activeRoom.room_number, updated_by: 'Resepsiyon' })
    });
    if (res.ok) {
      document.getElementById('room-detail-modal').style.display = 'none';
      loadReceptionData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Check-out yapılamadı.');
    }
  } catch (err) {
    console.error(err);
    alert('Check-out yapılamadı.');
  }
}

async function checkinRoom() {
  if (!activeRoom) return;
  const name = prompt("Misafir Adı Soyadı girin:", "");
  if (!name) return;
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;

  try {
    const res = await fetch(`/api/rooms/checkin?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: activeRoom.room_number,
        firstName,
        lastName,
        updated_by: 'Resepsiyon'
      })
    });
    if (res.ok) {
      document.getElementById('room-detail-modal').style.display = 'none';
      loadReceptionData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Check-in yapılamadı.');
    }
  } catch (err) {
    console.error(err);
    alert('Check-in yapılamadı.');
  }
}

function setupActions() {
  const actionsMap = {
    'btn-action-hk': 'housekeeping_request',
    'btn-action-tech': 'maintenance_request',
    'btn-action-service': 'room_service',
    'btn-action-wakeup': 'wakeup_call',
    'btn-action-porter': 'porter_request',
    'btn-action-taxi': 'taxi_request',
    'btn-action-minibar': 'minibar_request'
  };

  Object.entries(actionsMap).forEach(([btnId, type]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        openTaskModal(type);
      });
    }
  });

  const btnNewCheckin = document.getElementById('btn-reception-new-checkin');
  if (btnNewCheckin) {
    btnNewCheckin.addEventListener('click', () => {
      // Find first clean vacant room
      const cleanRoom = receptionRooms.find(r => r.status === 'clean_vacant');
      if (cleanRoom) {
        openRoomDetail(cleanRoom);
      } else {
        alert("Giriş yapılabilecek temiz boş oda bulunmamaktadır!");
      }
    });
  }

  const btnLogout = document.getElementById('btn-staff-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (window.aeonLogout) window.aeonLogout();
    });
  }

  const btnSaveNotes = document.getElementById('btn-save-shift-notes');
  if (btnSaveNotes) {
    btnSaveNotes.addEventListener('click', saveShiftNotes);
  }
}

function openTaskModal(type) {
  document.getElementById('modal-task-type').value = type;
  document.getElementById('modal-task-details').value = '';
  document.getElementById('modal-task-room').value = '';

  const roomGrid = document.getElementById('modal-task-room-grid');
  roomGrid.innerHTML = '';

  receptionRooms.forEach(room => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-xs';
    btn.textContent = room.room_number;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      Array.from(roomGrid.children).forEach(c => c.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      document.getElementById('modal-task-room').value = room.room_number;
    });
    roomGrid.appendChild(btn);
  });

  document.getElementById('create-task-modal').style.display = 'flex';
}

async function submitTask() {
  const type = document.getElementById('modal-task-type').value;
  const room = document.getElementById('modal-task-room').value;
  const details = document.getElementById('modal-task-details').value;

  if (!room) {
    alert("Lütfen bir oda seçin!");
    return;
  }

  try {
    const targetIdentifier = `Room-${room}`;
    let dept = 'Reception';
    if (type === 'housekeeping_request' || type === 'minibar_request') dept = 'Housekeeping';
    if (type === 'maintenance_request') dept = 'Maintenance';
    if (type === 'room_service') dept = 'Kitchen';

    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type === 'room_service' ? 'order' : type,
        target_identifier: targetIdentifier,
        details,
        department: dept,
        created_by: 'Resepsiyon'
      })
    });

    if (res.ok) {
      document.getElementById('create-task-modal').style.display = 'none';
      loadReceptionData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'İstek oluşturulamadı, lütfen tekrar deneyin.');
    }
  } catch (err) {
    console.error(err);
    alert('İstek oluşturulamadı, lütfen tekrar deneyin.');
  }
}

async function loadShiftNotes() {
  try {
    const res = await fetch(`/api/system/shift_notes?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('reception-shift-notes').value = data.notes || '';
    }
  } catch (err) {
    console.error(err);
  }
}

async function saveShiftNotes() {
  const notes = document.getElementById('reception-shift-notes').value;
  try {
    const res = await fetch(`/api/system/shift_notes?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    if (res.ok) {
      alert("Vardiya notları kaydedildi.");
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Vardiya notları kaydedilemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Vardiya notları kaydedilemedi.');
  }
}
