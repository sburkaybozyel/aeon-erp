import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

let techRooms = [];
let techRequests = [];
let techInventory = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || !['maintenance', 'technical'].includes(user.role.toLowerCase())) return;

  setupTabs();
  setupModals();
  setupActions();

  await loadMaintenanceData();

  initTechSSE();
  setInterval(loadMaintenanceData, 15000);

  setupStaffPushNotifications(user);
  startRequestNotifications({ surface: 'maintenance' });
});

function initTechSSE() {
  const url = `/api/events?tenant_id=${state.currentTenant}`;
  const es = new EventSource(url);
  es.addEventListener('room_updated', loadMaintenanceData);
  es.addEventListener('request_updated', loadMaintenanceData);
  es.addEventListener('request_created', loadMaintenanceData);
  es.onerror = () => {
    es.close();
    setTimeout(initTechSSE, 3000);
  };
}

async function loadMaintenanceData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, reqsRes, invRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`)
    ]);

    if (roomsRes.ok) techRooms = await roomsRes.json();
    if (reqsRes.ok) techRequests = await reqsRes.json();
    if (invRes.ok) techInventory = await invRes.json();

    renderTasks();
    renderRoomsGrid();
    renderRoutines();
    renderInventory();
    populatePrItemDropdown();
  } catch (err) {
    console.error(err);
  }
}

function setupTabs() {
  const tabs = ['tasks', 'rooms', 'routine', 'inventory'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`nav-tech-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => {
          document.getElementById(`nav-tech-tab-${t}`).classList.remove('active');
          document.getElementById(`tech-subview-${t}`).classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(`tech-subview-${tab}`).classList.add('active');
      });
    }
  });
}

function renderTasks() {
  const list = document.getElementById('staff-tech-tasks-list');
  if (!list) return;
  list.innerHTML = '';

  const tasks = techRequests.filter(r => (r.department === 'Technical' || r.department === 'Maintenance' || r.type === 'maintenance_request') && r.status !== 'completed');
  if (tasks.length === 0) {
    list.innerHTML = '<div class="text-muted text-center small">Açık arıza veya teknik iş kaydı bulunmuyor.</div>';
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '14px';
    card.style.borderLeft = `4px solid var(--color-danger)`;
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center" style="border-bottom: 1px solid var(--border-glass); padding-bottom:6px; margin-bottom:8px;">
        <strong>${task.target_identifier}</strong>
        <span class="badge badge-danger">${task.status}</span>
      </div>
      <div class="small" style="margin-bottom:12px;">${task.details || '-'}</div>
      <button class="btn btn-success btn-xs btn-block" onclick="completeTask('${task.id}')">Arıza Giderildi / Tamamlandı</button>
    `;
    list.appendChild(card);
  });
}

window.completeTask = async function(id) {
  try {
    const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed', updated_by: 'Teknik Servis' })
    });
    if (res.ok) {
      loadMaintenanceData();
    }
  } catch (err) {
    console.error(err);
  }
};

function renderRoomsGrid() {
  const grid = document.getElementById('staff-tech-rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';

  techRooms.forEach(room => {
    // Show room if maintenance or ac broken or has notes
    const isBroken = room.ac_status === 'broken';
    const isMaintenance = room.status === 'maintenance';

    const card = document.createElement('div');
    card.className = `room-card room-status-${room.status === 'clean_vacant' ? 'clean' : room.status === 'dirty_vacant' ? 'dirty' : room.status === 'occupied' ? 'occupied' : 'maintenance'}`;
    
    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-number">${room.room_number}</span>
        ${isBroken ? '<span class="badge badge-danger">Klima Arıza</span>' : ''}
        ${isMaintenance ? '<span class="badge badge-warning">Bakımda</span>' : ''}
      </div>
      <div class="room-guest">${room.status === 'occupied' ? (room.guest_name || 'Dolu') : 'Boş'}</div>
      <div class="room-details">${room.maintenance_notes || 'Sorun bildirilmedi'}</div>
    `;

    card.addEventListener('click', () => openRoomDetail(room));
    grid.appendChild(card);
  });
}

let activeRoom = null;

function openRoomDetail(room) {
  activeRoom = room;
  document.getElementById('modal-room-title').textContent = `Oda ${room.room_number} Donanım Ayarları`;
  document.getElementById('modal-room-status').value = room.status;
  document.getElementById('modal-room-ac').value = room.ac_status || 'working';
  document.getElementById('modal-room-notes').value = room.maintenance_notes || '';
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

  // Tech PR Modal
  document.getElementById('btn-close-pr-modal').addEventListener('click', () => {
    document.getElementById('tech-pr-modal').style.display = 'none';
  });
  document.getElementById('tech-form-pr').addEventListener('submit', submitPrRequest);

  // Create task modal
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

  try {
    if (status && status !== activeRoom.status) {
      const statusRes = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_number: activeRoom.room_number, status, updated_by: 'Teknik Servis' })
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
        updated_by: 'Teknik Servis'
      })
    });
    if (detailsRes.ok) {
      document.getElementById('room-detail-modal').style.display = 'none';
      loadMaintenanceData();
    } else {
      const body = await detailsRes.json().catch(() => ({}));
      alert(body.error || 'Oda bilgileri güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Oda bilgileri güncellenemedi.');
  }
}

function renderRoutines() {
  const list = document.getElementById('staff-tech-routine-list');
  if (!list) return;
  list.innerHTML = '';

  const routines = [
    { name: 'Jeneratör Yağ & Filtre Kontrolü', status: 'Her Pazartesi' },
    { name: 'Havuz Klor & pH Ölçümü', status: 'Günde 2 kez' },
    { name: 'Merkezi Klima Su Seviyesi', status: 'Her sabah' },
    { name: 'Güneş Paneli İnverter Kontrolü', status: 'Haftalık' }
  ];

  routines.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '12px 16px';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${r.name}</strong>
          <div class="text-muted small" style="margin-top:2px;">Sıklık: ${r.status}</div>
        </div>
        <button class="btn btn-success btn-xs" onclick="alert('${r.name} rutin bakımı onaylandı.')">Yapıldı</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderInventory() {
  const body = document.getElementById('staff-tech-inventory-body');
  if (!body) return;
  body.innerHTML = '';

  // Filter tech inventory items (bar/kitchen is for dining/KDS)
  const techInv = techInventory.filter(i => i.module !== 'bar' && i.module !== 'kitchen');
  if (techInv.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="text-center text-muted text-xs">Teknik malzeme kaydı bulunmuyor.</td></tr>';
  } else {
    techInv.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>${item.stock}</td>
        <td>${item.unit}</td>
      `;
      body.appendChild(row);
    });
  }

  // Render past material/parts purchase requests
  const prList = document.getElementById('tech-purchase-requests-list');
  if (!prList) return;
  prList.innerHTML = '';

  const reqs = techRequests.filter(r => r.type === 'tech_material_request' || ((r.department === 'Technical' || r.department === 'Maintenance') && r.type === 'purchase_request'));
  if (reqs.length === 0) {
    prList.innerHTML = '<div class="text-muted text-center small">Malzeme talebi bulunmuyor.</div>';
  } else {
    reqs.forEach(req => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = '10px';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <strong>${req.target_identifier || 'Teknik Depo'}</strong>
          <span class="badge badge-secondary">${req.status}</span>
        </div>
        <div class="small" style="margin-top: 4px;">${req.details}</div>
      `;
      prList.appendChild(card);
    });
  }
}

function populatePrItemDropdown() {
  const select = document.getElementById('tech-pr-item');
  if (!select) return;
  select.innerHTML = '';
  // Let user pick from technical items, or add generic fallback options
  const techInv = techInventory.filter(i => i.module !== 'bar' && i.module !== 'kitchen');
  if (techInv.length > 0) {
    techInv.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
  } else {
    const defaultOptions = [
      { id: 'bulb', name: 'Ampul LED' },
      { id: 'battery', name: 'AA Pil' },
      { id: 'tape', name: 'Teflon Bant' },
      { id: 'seal', name: 'Musluk Contası' }
    ];
    defaultOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.name;
      select.appendChild(o);
    });
  }
}

async function submitPrRequest(e) {
  e.preventDefault();
  const select = document.getElementById('tech-pr-item');
  const qty = document.getElementById('tech-pr-qty').value;
  const notes = document.getElementById('tech-pr-notes').value;

  const itemName = select.options[select.selectedIndex].text;

  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'tech_material_request',
        target_identifier: 'Teknik Servis',
        details: `Malzeme İsteği: ${itemName} (Miktar: ${qty}). Not: ${notes}`,
        department: 'Maintenance',
        created_by: 'Teknik Servis Personeli'
      })
    });

    if (res.ok) {
      document.getElementById('tech-pr-modal').style.display = 'none';
      loadMaintenanceData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Malzeme isteği oluşturulamadı.');
    }
  } catch (err) {
    console.error(err);
    alert('Malzeme isteği oluşturulamadı.');
  }
}

function setupActions() {
  document.getElementById('btn-staff-logout').addEventListener('click', () => {
    if (window.aeonLogout) window.aeonLogout();
  });

  document.getElementById('btn-trigger-tech-pr').addEventListener('click', () => {
    document.getElementById('tech-pr-qty').value = '';
    document.getElementById('tech-pr-notes').value = '';
    document.getElementById('tech-pr-modal').style.display = 'flex';
  });

  document.getElementById('btn-create-tech-task').addEventListener('click', () => {
    openTaskModal();
  });
}

function openTaskModal() {
  document.getElementById('modal-task-details').value = '';
  document.getElementById('modal-task-room').value = '';

  const roomGrid = document.getElementById('modal-task-room-grid');
  roomGrid.innerHTML = '';

  techRooms.forEach(room => {
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
  const room = document.getElementById('modal-task-room').value;
  const details = document.getElementById('modal-task-details').value;

  if (!room || !details) {
    alert("Lütfen oda seçip arıza detayını yazın!");
    return;
  }

  try {
    const res = await fetch(`/api/requests?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'maintenance_request',
        target_identifier: `Room-${room}`,
        details: `Arıza Bildirimi: ${details}`,
        department: 'Maintenance',
        created_by: 'Teknik Servis'
      })
    });
    if (res.ok) {
      document.getElementById('create-task-modal').style.display = 'none';
      loadMaintenanceData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Arıza bildirimi oluşturulamadı.');
    }
  } catch (err) {
    console.error(err);
    alert('Arıza bildirimi oluşturulamadı.');
  }
}
