import { state, logEvent, initSSE } from './state.js';
import { setupStaffPushNotifications } from './push-notifications.js';
import { startRequestNotifications } from './request-notifications.js';

let hkRooms = [];
let hkCatalog = [];
let hkPublicAreas = [];
let hkLaundry = [];
let hkLostFound = [];
let currentFilter = 'all';
let activeRoom = null;

// Every string below can originate from free-text staff/guest input (lost & found
// descriptions, laundry notes, maintenance notes, etc.) and is rendered via innerHTML.
// Escape it first so a stray "<" or quote in a hurried note can never be interpreted as
// markup/script instead of literal text.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.round(diffMs / 60000);
  if (Number.isNaN(mins)) return '';
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

// Room status vocabulary, in the shared liquid-glass badge language where a matching
// token exists (see aeon-tokens.css), plus local fallbacks (defined in
// housekeeping-operations.css) for the intermediate housekeeping-only states that have
// no shared equivalent.
const ROOM_STATUS_META = {
  clean_vacant: { label: 'Temiz', badge: 'clean_vacant' },
  dirty_vacant: { label: 'Kirli', badge: 'dirty_vacant' },
  occupied: { label: 'Dolu', badge: 'occupied' },
  cleaning: { label: 'Temizleniyor', badge: 'cleaning' },
  assigned: { label: 'Atandı', badge: 'assigned' },
  inspected: { label: 'İnceleniyor', badge: 'inspected' },
  maintenance: { label: 'Bakımda', badge: 'maintenance' },
  out_of_order: { label: 'Hizmet Dışı', badge: 'maintenance' },
  blocked: { label: 'Bloke', badge: 'maintenance' }
};
function roomStatusMeta(status) {
  return ROOM_STATUS_META[status] || { label: status || '-', badge: 'maintenance' };
}

// Manual status-override options offered inside the room detail modal, mirroring the
// real transition rules enforced server-side (POST /api/rooms/status in
// modules/stay/rooms.js) so staff never hit a confusing 409 from an option that was
// never going to be legal. Everyday dirty->clean movement goes through the dedicated
// one-tap actions below instead (start cleaning / approve), not this dropdown.
const HK_MANUAL_TRANSITIONS = {
  clean_vacant: ['maintenance'],
  dirty_vacant: ['maintenance'],
  maintenance: ['dirty_vacant', 'clean_vacant'],
  occupied: [],
  cleaning: [],
  assigned: [],
  inspected: []
};

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
  // Public-area cleanliness and HK task-board pushes were previously never listened for
  // here, so the Ortak Alan tab only ever refreshed on the 15s poll (or not at all, since
  // it used to render hardcoded data — see renderPublicAreas below).
  es.addEventListener('area_updated', loadHousekeepingData);
  es.addEventListener('hk_task_updated', loadHousekeepingData);
  es.onerror = () => {
    es.close();
    setTimeout(initHkSSE, 3000);
  };
}

async function loadHousekeepingData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, catRes, areasRes, laundryRes, lfRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`),
      fetch(`/api/public_areas${tenantParam}`),
      fetch(`/api/hk/laundry${tenantParam}`),
      fetch(`/api/hk/lost-found${tenantParam}`)
    ]);

    if (roomsRes.ok) hkRooms = await roomsRes.json();
    if (catRes.ok) hkCatalog = await catRes.json();
    if (areasRes.ok) hkPublicAreas = await areasRes.json();
    if (laundryRes.ok) hkLaundry = await laundryRes.json();
    if (lfRes.ok) hkLostFound = await lfRes.json();

    renderRooms();
    renderPublicAreas();
    renderLaundry();
    renderLostFound();
    populateMinibarDropdown();
  } catch (err) {
    console.error(err);
    // A failed load previously left every tab silently stuck on stale data with zero
    // indication anything was wrong. Surface it once so staff know to check connectivity
    // instead of trusting a board that stopped updating.
    const grid = document.getElementById('hk-rooms-grid');
    if (grid && !grid.children.length) {
      grid.innerHTML = '<div class="hk-empty-state">Veriler yüklenemedi. Bağlantınızı kontrol edin, otomatik olarak tekrar denenecek.</div>';
    }
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

function roomPrimaryAction(room) {
  if (['dirty_vacant', 'assigned', 'out_of_order', 'blocked'].includes(room.status)) {
    return { label: 'Temizliğe Başla', icon: 'fa-spray-can-sparkles', run: () => startCleaning(room) };
  }
  if (room.status === 'cleaning') {
    return { label: 'Odayı Onayla', icon: 'fa-clipboard-check', run: () => openInspectionChecklist(room) };
  }
  return null;
}

function renderRooms() {
  const grid = document.getElementById('hk-rooms-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = hkRooms;
  if (currentFilter === 'dirty') filtered = hkRooms.filter(r => r.status === 'dirty_vacant');
  if (currentFilter === 'clean') filtered = hkRooms.filter(r => r.status === 'clean_vacant');
  // Bug: the DND filter/badge/checkbox previously read `room.is_dnd`, a field the API
  // never sends (the real column — and API field — is `dnd_active`). The filter always
  // returned an empty list and the badge never showed, even for rooms with DND active.
  if (currentFilter === 'dnd') filtered = hkRooms.filter(r => Number(r.dnd_active) === 1);

  if (!filtered.length) {
    grid.innerHTML = '<div class="hk-empty-state">Bu filtreye uyan oda yok.</div>';
    return;
  }

  filtered.forEach(room => {
    const meta = roomStatusMeta(room.status);
    const action = roomPrimaryAction(room);
    const card = document.createElement('div');
    card.className = `room-card room-status-${meta.badge === 'clean_vacant' ? 'clean' : meta.badge === 'dirty_vacant' ? 'dirty' : meta.badge === 'occupied' ? 'occupied' : 'maintenance'}`;

    card.innerHTML = `
      <div class="room-card-header">
        <span class="room-number">${escapeHtml(room.room_number)}</span>
        <span class="room-badge ${meta.badge}">${escapeHtml(meta.label)}</span>
      </div>
      <div class="room-details">${escapeHtml(room.bed_type || 'Standard')} · Kat ${escapeHtml(room.floor ?? '-')}</div>
      <div class="hk-room-flags">
        ${Number(room.dnd_active) === 1 ? '<span class="badge badge-danger"><i class="fa-solid fa-ban"></i> DND</span>' : ''}
        ${room.late_checkout ? '<span class="badge badge-warning">Geç Çıkış</span>' : ''}
      </div>
      ${action ? `<button type="button" class="card-action tap-target-lg" data-action><i class="fa-solid ${action.icon}"></i> ${escapeHtml(action.label)}</button>` : ''}
    `;

    if (action) {
      card.querySelector('[data-action]').addEventListener('click', (e) => {
        e.stopPropagation();
        action.run();
      });
    }
    card.addEventListener('click', () => openRoomDetail(room));
    grid.appendChild(card);
  });
}

async function startCleaning(room) {
  await runRoomAction(`/api/hk/rooms/${room.id}/start`, {}, {
    onDndBlocked: async (body) => {
      if (!confirm(`${body.error || 'Oda DND modunda.'}\n\nYine de temizliğe başlamak istiyor musunuz?`)) return;
      await runRoomAction(`/api/hk/rooms/${room.id}/start`, { override_dnd: true });
    }
  });
}

async function runRoomAction(url, payload, opts = {}) {
  try {
    const res = await fetch(`${url}?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      loadHousekeepingData();
      return true;
    }
    const body = await res.json().catch(() => ({}));
    if (body.dnd_active && opts.onDndBlocked) {
      await opts.onDndBlocked(body);
      return false;
    }
    alert(body.error || 'İşlem tamamlanamadı.');
    return false;
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. İşlem tamamlanamadı, tekrar deneyin.');
    return false;
  }
}

function openRoomDetail(room) {
  activeRoom = room;
  document.getElementById('modal-room-title').textContent = `Oda ${room.room_number} Temizlik Kaydı`;

  const statusSelect = document.getElementById('modal-room-status');
  const manualOptions = HK_MANUAL_TRANSITIONS[room.status] || [];
  const optionValues = [room.status, ...manualOptions];
  statusSelect.innerHTML = optionValues.map(value => `<option value="${value}">${escapeHtml(roomStatusMeta(value).label)}</option>`).join('');
  statusSelect.value = room.status;
  statusSelect.disabled = manualOptions.length === 0;

  const hint = document.getElementById('modal-room-status-hint');
  if (hint) {
    hint.textContent = manualOptions.length === 0
      ? (room.status === 'cleaning' ? 'Bu odayı onaylamak için oda kartındaki "Odayı Onayla" düğmesini kullanın.' : 'Bu oda için manuel durum değişikliği yok.')
      : '';
  }

  document.getElementById('modal-room-dnd').checked = Number(room.dnd_active) === 1;

  const minibarSection = document.getElementById('modal-minibar-section');
  minibarSection.style.display = room.status === 'occupied' ? 'block' : 'none';

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
  const statusSelect = document.getElementById('modal-room-status');
  const status = statusSelect.value;
  const dnd = document.getElementById('modal-room-dnd').checked;
  const statusChanged = !statusSelect.disabled && status !== activeRoom.status;
  const dndChanged = dnd !== (Number(activeRoom.dnd_active) === 1);

  try {
    if (statusChanged) {
      // Bug: this used to send `room_number` in the body, but the backend
      // (POST /api/rooms/status in modules/stay/rooms.js) reads `roomId` and looks the
      // room up by id — so every save here silently 404'd ("Room not found") no matter
      // what status was picked.
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoom.id, status, updated_by: 'Kat Hizmetleri' })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Oda durumu güncellenemedi.');
        return;
      }
    }

    if (dndChanged) {
      // DND has its own dedicated endpoint (POST /api/rooms/dnd) — the generic status
      // route doesn't accept a dnd field at all, so a `dnd_active` flip was previously
      // silently dropped no matter what the checkbox said.
      const dndRes = await fetch(`/api/rooms/dnd?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoom.id, dnd_active: dnd })
      });
      if (!dndRes.ok) {
        const body = await dndRes.json().catch(() => ({}));
        alert(body.error || 'DND durumu güncellenemedi.');
        return;
      }
    }

    document.getElementById('room-detail-modal').style.display = 'none';
    loadHousekeepingData();
  } catch (err) {
    console.error(err);
    alert('Oda bilgileri güncellenemedi. Bağlantınızı kontrol edin.');
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
  const checked = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
  if (checked.length !== checkboxes.length) {
    alert('Lütfen tüm kontrol listesi öğelerini doğrulayın!');
    return;
  }
  const notes = document.getElementById('hk-checklist-notes').value;

  // Bug: this used to re-POST /api/rooms/status with room_number (same 404 as above)
  // and, even if that were fixed, /api/rooms/status has no `cleaning -> clean_vacant`
  // transition — only the dedicated inspect endpoint does — so the checklist the
  // supervisor just filled in was thrown away and never written to
  // housekeeping_inspections. Route to the endpoint actually built for this.
  const ok = await runRoomAction(`/api/hk/rooms/${activeRoom.id}/inspect`, { checklist: checked, notes });
  if (ok) {
    document.getElementById('hk-checklist-modal').style.display = 'none';
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
  const qty = parseInt(document.getElementById('modal-minibar-qty').value, 10) || 1;
  if (!itemId) return;

  try {
    // Bug: this used to POST a generic `/api/requests` order for the minibar item. Since
    // minibar items are neither `food` nor `drink`, that request landed in the Restaurant
    // department's queue as a stuck "pending" order nobody would ever prepare/serve,
    // instead of using the dedicated minibar endpoint that posts straight to the folio
    // (or deducts stock if the room is vacant) with no phantom order left behind.
    const res = await fetch(`/api/hk/rooms/${activeRoom.id}/minibar?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ catalogItemId: itemId, quantity: qty }] })
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.charged ? `Minibar tüketimi oda hesabına yazıldı (${body.totalCharged} TL).` : 'Minibar tüketimi stoktan düşüldü.');
      document.getElementById('room-detail-modal').style.display = 'none';
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Minibar tüketimi kaydedilemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. Minibar tüketimi kaydedilemedi.');
  }
}

function renderPublicAreas() {
  const list = document.getElementById('hk-public-areas-list');
  if (!list) return;
  list.innerHTML = '';

  // Bug: this rendered a hardcoded, static list of four areas with an onclick="alert(...)"
  // button that called no API at all — the tab was purely decorative and never reflected
  // (or changed) real public_areas data even though the backend routes for it already
  // exist and work (GET /api/public_areas, POST /api/public_areas/clean).
  if (!hkPublicAreas.length) {
    list.innerHTML = '<div class="hk-empty-state">Tanımlı ortak alan yok.</div>';
    return;
  }

  hkPublicAreas.forEach(area => {
    const isDirty = area.status === 'dirty';
    const card = document.createElement('div');
    card.className = 'area-card';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <strong>${escapeHtml(area.name)}</strong>
        <span class="room-badge ${isDirty ? 'dirty' : 'clean'}">${isDirty ? 'Kirli' : 'Temiz'}</span>
      </div>
      <div class="text-muted small" style="margin-top:4px;">${area.last_cleaned_at ? `Son temizlik: ${escapeHtml(timeAgo(area.last_cleaned_at))}${area.last_cleaned_by ? ' · ' + escapeHtml(area.last_cleaned_by) : ''}` : 'Henüz temizlenmedi'}</div>
      ${isDirty ? '<button type="button" class="card-action tap-target-lg" data-clean><i class="fa-solid fa-broom"></i> Temizlendi</button>' : ''}
    `;
    if (isDirty) {
      card.querySelector('[data-clean]').addEventListener('click', () => markAreaClean(area.id));
    }
    list.appendChild(card);
  });
}

async function markAreaClean(id) {
  try {
    const res = await fetch(`/api/public_areas/clean?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, staff_name: 'Kat Hizmetleri' })
    });
    if (res.ok) {
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Alan güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. Alan güncellenemedi.');
  }
}

function renderLaundry() {
  const list = document.getElementById('hk-laundry-list');
  if (!list) return;
  list.innerHTML = '';

  // Bug: this used to filter `hkRequests` (the generic /api/requests table) for
  // type === 'laundry_request', a type that is never created anywhere in the app —
  // laundry orders live in their own `laundry_orders` table via /api/hk/laundry, so this
  // list was permanently empty regardless of real laundry activity.
  if (!hkLaundry.length) {
    list.innerHTML = '<div class="hk-empty-state">Aktif çamaşır talebi bulunmuyor.</div>';
    return;
  }

  const statusLabel = { open: 'Bekliyor', in_progress: 'İşlemde', delivered: 'Teslim Edildi', cancelled: 'İptal' };
  hkLaundry.forEach(order => {
    const room = hkRooms.find(r => r.id === order.room_id);
    const card = document.createElement('div');
    card.className = 'stack-item';
    card.innerHTML = `
      <div>
        <div class="d-flex justify-content-between align-items-center" style="gap:8px;">
          <strong>${room ? `Oda ${escapeHtml(room.room_number)}` : escapeHtml(order.guest_name || 'Çamaşır')}</strong>
          <span class="badge badge-secondary">${escapeHtml(statusLabel[order.status] || order.status)}</span>
        </div>
        <div class="hk-muted">${escapeHtml(order.items || '-')}</div>
      </div>
    `;
    if (order.status === 'open' || order.status === 'in_progress') {
      const nextStatus = order.status === 'open' ? 'in_progress' : 'delivered';
      const nextLabel = order.status === 'open' ? 'İşleme Al' : 'Teslim Edildi';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'small-button tap-target-lg';
      btn.textContent = nextLabel;
      btn.addEventListener('click', () => updateLaundryStatus(order.id, nextStatus));
      card.appendChild(btn);
    }
    list.appendChild(card);
  });
}

async function updateLaundryStatus(id, status) {
  try {
    const res = await fetch(`/api/hk/laundry/${id}/status?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, updated_by: 'Kat Hizmetleri' })
    });
    if (res.ok) {
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Çamaşır durumu güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. Çamaşır durumu güncellenemedi.');
  }
}

function renderLostFound() {
  const list = document.getElementById('hk-lostfound-list');
  if (!list) return;
  list.innerHTML = '';

  // Bug: this used to filter hkRequests for type === 'lostfound_report' (never created —
  // submitLostFound posted type:'task', which /api/requests always rejects with 400) —
  // so the list was always empty and new reports always silently failed to save.
  if (!hkLostFound.length) {
    list.innerHTML = '<div class="hk-empty-state">Bildirilmiş kayıp eşya bulunmuyor.</div>';
    return;
  }

  hkLostFound.forEach(item => {
    const claimed = item.status === 'claimed';
    const card = document.createElement('div');
    card.className = 'stack-item';
    card.innerHTML = `
      <div>
        <div class="d-flex justify-content-between align-items-center" style="gap:8px;">
          <strong>${escapeHtml(item.item_name)}</strong>
          <span class="badge ${claimed ? 'badge-secondary' : 'badge-warning'}">${claimed ? 'Teslim Edildi' : 'Bekliyor'}</span>
        </div>
        <div class="hk-muted">${escapeHtml(item.found_location || '-')}${item.description ? ' · ' + escapeHtml(item.description) : ''}</div>
      </div>
    `;
    if (!claimed) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'small-button tap-target-lg';
      btn.textContent = 'Teslim Edildi';
      btn.addEventListener('click', () => claimLostFound(item.id));
      card.appendChild(btn);
    }
    list.appendChild(card);
  });
}

async function claimLostFound(id) {
  try {
    const res = await fetch(`/api/hk/lost-found/${id}/claim?tenant_id=${state.currentTenant}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimed_by: 'Kat Hizmetleri' })
    });
    if (res.ok) {
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Kayıp eşya güncellenemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. Kayıp eşya güncellenemedi.');
  }
}

async function submitLostFound() {
  const item = document.getElementById('lf-item-name').value.trim();
  const location = document.getElementById('lf-location').value.trim();
  const desc = document.getElementById('lf-description').value.trim();

  if (!item || !location) {
    alert('Eşya adı ve konum zorunludur!');
    return;
  }

  try {
    // Bug: this used to POST type:'task' to the generic /api/requests endpoint, which
    // only accepts a fixed allow-list of types and always rejected 'task' with 400 —
    // and the failure was swallowed (no else/catch feedback), so "Kaydet" silently did
    // nothing. Use the dedicated lost & found endpoint instead.
    const res = await fetch(`/api/hk/lost-found?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: item, description: desc, found_location: location, found_by: 'Kat Hizmetleri' })
    });
    if (res.ok) {
      document.getElementById('lost-found-modal').style.display = 'none';
      loadHousekeepingData();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Kayıp eşya kaydedilemedi.');
    }
  } catch (err) {
    console.error(err);
    alert('Bağlantı hatası. Kayıp eşya kaydedilemedi.');
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
