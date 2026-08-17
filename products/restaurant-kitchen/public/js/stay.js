import { state, logEvent, registerLoader, loadAllData } from './state.js';

export function setupStayModule() {
  const checkinForm = document.getElementById('form-checkin');
  if (checkinForm) {
    checkinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const arrivalDate = document.getElementById('checkin-arrival')?.value || '';
      const departureDate = document.getElementById('checkin-departure')?.value || '';
      const data = {
        roomId: document.getElementById('checkin-room').value,
        firstName: document.getElementById('checkin-fname')?.value?.trim() || 'Misafir',
        lastName: document.getElementById('checkin-lname')?.value?.trim() || '',
        phone: document.getElementById('checkin-phone')?.value || '',
        eta: arrivalDate || document.getElementById('checkin-eta')?.value || '',
        idNumber: document.getElementById('checkin-id')?.value || '',
        nationality: document.getElementById('checkin-nationality')?.value || 'TR',
        arrivalDate,
        departureDate,
        adultCount: parseInt(document.getElementById('checkin-adults')?.value) || 1,
        childCount: parseInt(document.getElementById('checkin-children')?.value) || 0,
        carPlate: document.getElementById('checkin-plate')?.value || '',
        dailyRate: parseFloat(document.getElementById('checkin-rate')?.value) || 0,
        bookingSource: document.getElementById('checkin-source')?.value || 'walk_in',
        boardType: document.getElementById('checkin-board-type')?.value || 'BB',
        specialOccasion: document.getElementById('checkin-occasion')?.value || '',
        specialNotes: document.getElementById('checkin-notes')?.value || ''
      };
      
      try {
        const res = await fetch(`/api/rooms/checkin?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          const nights = (data.arrivalDate && data.departureDate)
            ? Math.max(1, Math.ceil((new Date(data.departureDate) - new Date(data.arrivalDate)) / 86400000))
            : 1;
          logEvent('event', `Check-in: <strong>${data.firstName} ${data.lastName}</strong> — Oda: ${data.roomId} — ${nights} gece — ${result.totalDue?.toFixed(2) || 0} TL`);
          if (state.featureFlags.MODULE_PRINTER) {
            alert(`[Yazıcı Çıktısı] Check-in Fişi Gönderildi!\nMisafir: ${data.firstName} ${data.lastName}\nGiriş: Dolu`);
          }
          checkinForm.reset();
          loadStayData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Hotel departments sub-tab switching logic
  const subTabs = document.querySelectorAll('.stay-sub-tabs button');
  subTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetSection = tab.getAttribute('data-sub-target');
      document.querySelectorAll('.stay-sub-section').forEach(sec => {
        sec.classList.remove('active-sub');
      });
      const targetEl = document.getElementById(targetSection);
      if (targetEl) targetEl.classList.add('active-sub');
    });
  });

  // HK Minibar billing form submission
  const minibarForm = document.getElementById('form-hk-minibar');
  if (minibarForm) {
    minibarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomId = document.getElementById('hk-minibar-room').value;
      const itemId = document.getElementById('hk-minibar-item').value;
      const qty = parseInt(document.getElementById('hk-minibar-qty').value) || 1;
      
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
          logEvent('event', `Housekeeping: Minibar tüketimi girildi: <strong>${targetIdentifier}</strong> - Tutar: ${result.totalAmount} TL`);
          minibarForm.reset();
          loadStayData();
          alert("Minibar tüketimi başarıyla odaya yansıtıldı.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global helper functions to window for onclick handlers
  window.checkoutRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/checkout?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Resepsiyon: Oda çıkışı tamamlandı. Oda "kirli" durumuna alındı.`);
        if (state.featureFlags.MODULE_PRINTER) {
          const roomObj = state.roomsList?.find(r => r.id === roomId);
          const roomNum = roomObj ? roomObj.room_number : roomId;
          alert(`[Yazıcı Çıktısı] Check-out Fişi / Hesap Folyosu Gönderildi!\nOda: ${roomNum}`);
        }
        loadStayData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.setRoomClean = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'cleaning', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Oda temizlendi olarak işaretlendi.`);
        loadStayData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.setRoomMaintenance = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'maintenance', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Oda bakıma alındı.`);
        loadStayData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.resolveMaintenance = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: 'dirty_vacant', updated_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Oda arızası çözüldü, temizlik (HK) sırasına alındı.`);
        loadStayData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.completeRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: 'completed', completed_by: getActiveStaffLabel() })
      });
      if (res.ok) {
        logEvent('event', `Misafir isteği tamamlandı: <strong>#${requestId}</strong>`);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  registerLoader('loadStayData', loadStayData);

  // Ensure updateKdsStatus is always available (defined in dining.js but used here too)
  if (!window.updateKdsStatus) {
    window.updateKdsStatus = async (requestId, status) => {
      try {
        const res = await fetch(`/api/requests/status?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, status, completed_by: null })
        });
        if (res.ok) {
          loadStayData();
        }
      } catch (err) { console.error(err); }
    };
  }
  window.__aeonLoadStayData = loadStayData;
}

function getActiveStaffLabel() {
  const staff = state.activeStaff;
  if (!staff) return null;
  return `${staff.name} (${staff.role})`;
}

export async function loadStayData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [roomsRes, reqsRes] = await Promise.all([
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/requests${tenantParam}`)
    ]);

    const rooms = roomsRes.ok ? await roomsRes.json() : [];
    const requests = reqsRes.ok ? await reqsRes.json() : [];
    
    state.roomsList = rooms;

    renderRoomGrid(rooms);
    renderCheckinRoomSelect(rooms);
    renderHotelRequests(requests);
    
    // HK & Technical panels
    renderHkPanel(rooms);
    renderRoomServiceKds(requests);
    renderTechPanel(rooms);
  } catch (err) {
    console.error(err);
  }
}

window.activeRoomFilter = 'all';
window.filterRoomRack = (filter) => {
  window.activeRoomFilter = filter;
  const buttons = document.querySelectorAll('#rack-filter-bar .rack-filter-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    if(btn.getAttribute('onclick').includes(`'${filter}'`)) {
      btn.classList.add('active');
    }
  });
  renderRoomGrid(state.roomsList || []);
};

function renderRoomGrid(rooms) {
  const container = document.getElementById('room-grid-container');
  if (!container) return;
  container.innerHTML = '';

  let filteredRooms = rooms;
  if(window.activeRoomFilter && window.activeRoomFilter !== 'all') {
    if(window.activeRoomFilter === 'balayi') {
      filteredRooms = rooms.filter(r => r.special_occasion === 'balayi');
    } else {
      filteredRooms = rooms.filter(r => r.status === window.activeRoomFilter);
    }
  }

  if (filteredRooms.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center padding-md">Bu filtreye uygun oda yok.</div>`;
    return;
  }

  filteredRooms.forEach(room => {
    const card = document.createElement('div');
    const statusColors = {
      clean_vacant: '#22c55e',
      dirty_vacant: '#f59e0b',
      occupied: '#3b82f6',
      maintenance: '#6b7280'
    };
    const color = statusColors[room.status] || '#6b7280';
    const dndHtml = room.dnd_active
      ? `<span style="color:#ef4444; font-size:10px; font-weight:700;"><i class="fa-solid fa-ban"></i> DND</span>`
      : '';
    const vipHtml = room.vip
      ? `<span style="color:#d97706; font-size:10px;"><i class="fa-solid fa-star"></i> VIP</span>`
      : '';
    const lateHtml = room.late_checkout
      ? `<span style="color:#7c3aed; font-size:10px;"><i class="fa-solid fa-clock"></i> Geç Çıkış</span>`
      : '';

    const roomTypeLabel = { standard: 'Std', double: 'Dbl', suite: 'Suite', family: 'Aile', single: 'Tek' };
    const bedTypeLabel = { double: '🛏 Çift', single: '🛏 Tek', twin: '🛏 İki', king: '🛏 King' };

    card.className = 'aeon-card room-rack-card';
    card.style.cssText = `border-left: 4px solid ${color}; cursor: pointer;`;
    card.setAttribute('onclick', `window.openRoomFolio('${room.id}')`);

    card.innerHTML = `
      <div class="aeon-card-content">
        <div class="aeon-card-header" style="margin-bottom:4px;">
          <h4 class="aeon-card-title" style="font-size:18px; font-weight:800;">Oda ${room.room_number}</h4>
          <span class="aeon-badge ${room.status}" style="font-size:10px;">${translateRoomStatus(room.status)}</span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; font-size:10px; color:var(--text-muted);">
          ${room.room_type ? `<span>${roomTypeLabel[room.room_type] || room.room_type}</span>` : ''}
          ${room.bed_type ? `<span>${bedTypeLabel[room.bed_type] || room.bed_type}</span>` : ''}
          ${room.floor ? `<span>Kat ${room.floor}</span>` : ''}
          ${room.base_rate ? `<span>${room.base_rate} TL/gece</span>` : ''}
          ${room.board_type ? `<span style="background:var(--color-accent); color:#fff; padding:2px 6px; border-radius:4px;">[${room.board_type}]</span>` : ''}
          ${room.special_occasion ? `<span style="background:#ec4899; color:#fff; padding:2px 6px; border-radius:4px;">${translateOccasion(room.special_occasion)}</span>` : ''}
        </div>
        <div class="aeon-card-body" style="padding:0;">
          ${room.guest_name ? `<p class="aeon-card-text" style="font-weight:600; margin:2px 0;"><i class="fa-solid fa-user" style="width:14px;"></i> ${room.guest_name}</p>` : '<p class="aeon-card-text text-muted" style="font-size:11px; margin:2px 0;">Misafir yok</p>'}
          ${room.eta ? `<p class="aeon-card-text muted" style="font-size:11px; margin:2px 0;"><i class="fa-solid fa-clock" style="width:14px;"></i> ${room.eta}</p>` : ''}
          <div style="display:flex; gap:6px; margin-top:4px;">${dndHtml}${vipHtml}${lateHtml}</div>
        </div>
        <div class="aeon-card-footer" style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
          ${room.status === 'occupied'
            ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); checkoutRoom('${room.id}')" style="font-size:10px;"><i class="fa-solid fa-right-from-bracket"></i> Çıkış</button>`
            : `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); setRoomClean('${room.id}')" style="font-size:10px;"><i class="fa-solid fa-broom"></i> Temizlendi</button>`
          }
          <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); setRoomMaintenance('${room.id}')" style="font-size:10px; border-color:var(--color-warning); color:var(--color-warning);"><i class="fa-solid fa-wrench"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function translateRoomStatus(status) {
  const map = {
    clean_vacant: 'Boş Temiz',
    dirty_vacant: 'Boş Kirli',
    occupied: 'Dolu',
    maintenance: 'Bakımda'
  };
  return map[status] || status;
}

function translateOccasion(occ) {
  const map = {
    balayi: '🎉 Balayı',
    dogumgunu: '🎂 Doğum Günü',
    yildonumu: '💍 Yıldönümü',
    meyve_sampanya: '🍾 Meyve & Şampanya',
    ek_yatak: '🛌 Ek Yatak',
    sessiz_oda: '🔇 Sessiz Oda'
  };
  return map[occ] || occ;
}

function renderCheckinRoomSelect(rooms) {
  const select = document.getElementById('checkin-room');
  if (!select) return;
  select.innerHTML = '';
  rooms.filter(r => r.status === 'clean_vacant' || r.status === 'dirty_vacant').forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `Oda ${r.room_number} (${translateRoomStatus(r.status)})`;
    select.appendChild(opt);
  });
}

function renderHotelRequests(requests) {
  const container = document.getElementById('hotel-requests-container');
  if (!container) return;
  container.innerHTML = '';
  
  const hotelRequests = requests.filter(r => 
    r.type === 'towel_request' || 
    r.type === 'water_request' || 
    r.type === 'cleaning_request' ||
    r.type === 'linen_request' ||
    r.type === 'amenity_request' ||
    r.type === 'maintenance_request' ||
    r.type === 'transport_request' ||
    r.type === 'room_service_call' ||
    r.type === 'room_service_charge' ||
    r.type === 'room_dnd_change'
  );
  
  if (hotelRequests.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center padding-md">Aktif servis talebi bulunmuyor.</div>`;
    return;
  }
  
  hotelRequests.forEach(req => {
    const card = document.createElement('div');
    const isCompleted = req.status === 'completed';
    card.className = `aeon-card ${isCompleted ? 'status-completed' : 'status-pending'}`;
    
    let text = req.type === 'towel_request' ? 'Temiz Havlu İsteği' : 'Su İsteği';
    if (req.type === 'cleaning_request') text = 'Oda Temizliği Talebi';
    if (req.type === 'linen_request') text = 'Çarşaf / Yastık Talebi';
    if (req.type === 'amenity_request') text = 'Banyo Seti Talebi';
    if (req.type === 'maintenance_request') text = 'Teknik Servis Talebi';
    if (req.type === 'transport_request') text = 'Transfer / Taksi Talebi';
    if (req.type === 'room_service_call') text = 'Oda Servisi Çağrısı';
    if (req.type === 'room_service_charge') text = `Oda Hesabına Yazma: ${req.details}`;
    if (req.type === 'room_dnd_change') text = `DND Modu Değişti: ${req.details}`;
    
    card.innerHTML = `
      <div class="aeon-card-content">
        <div class="aeon-card-header">
          <h4 class="aeon-card-title">${req.target_identifier}</h4>
          <span class="aeon-badge ${isCompleted ? 'clean_vacant' : 'dirty_vacant'}">${req.status}</span>
        </div>
        <div class="aeon-card-body">
          <p class="aeon-card-text"><strong>İstek:</strong> ${text}</p>
          <p class="aeon-card-subtitle">Oluşturan: ${req.created_by || '-'}${req.completed_by ? ` | Tamamlayan: ${req.completed_by}` : ''}</p>
        </div>
        ${!isCompleted ? `
        <div class="aeon-card-footer">
          <button class="btn btn-success btn-xs" onclick="completeRequest('${req.id}')">Tamamlandı</button>
        </div>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderHkPanel(rooms) {
  const tbody = document.getElementById('hk-rooms-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  rooms.forEach(room => {
    const tr = document.createElement('tr');
    
    let actionBtn = '';
    if (room.status === 'dirty_vacant') {
      actionBtn = `<button class="btn btn-success btn-xs" onclick="setRoomClean('${room.id}')"><i class="fa-solid fa-check"></i> Temizlendi</button>`;
    } else {
      actionBtn = `<span class="text-muted small">-</span>`;
    }

    tr.innerHTML = `
      <td><strong>Oda ${room.room_number}</strong></td>
      <td><span class="room-badge ${room.status}">${translateRoomStatus(room.status)}</span></td>
      <td>${room.dnd_active ? '<span class="text-danger"><i class="fa-solid fa-ban"></i> Evet</span>' : 'Hayır'}</td>
      <td>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });

  // Populate occupied rooms select for minibar
  const roomSelect = document.getElementById('hk-minibar-room');
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
  const itemSelect = document.getElementById('hk-minibar-item');
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

function renderRoomServiceKds(requests) {
  const container = document.getElementById('room-kds-orders-container');
  if (!container) return;
  container.innerHTML = '';

  const roomOrders = requests.filter(r => r.type === 'order' && r.target_identifier.startsWith('Room-'));
  
  if (roomOrders.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center padding-md">Kuyrukta oda servisi siparişi bulunmuyor.</div>`;
    return;
  }

  roomOrders.forEach(order => {
    const card = document.createElement('div');
    card.className = `aeon-card status-${order.status}`;

    let itemsListHtml = '';
    try {
      const items = typeof order.details === 'string' ? JSON.parse(order.details) : order.details;
      if (Array.isArray(items)) {
        items.forEach(item => {
          itemsListHtml += `<p class="aeon-card-text">• ${item.name || item.itemId} x ${item.quantity}</p>`;
        });
      } else {
        itemsListHtml = `<p class="aeon-card-text">${order.details}</p>`;
      }
    } catch(e) {
      itemsListHtml = `<p class="aeon-card-text">${order.details}</p>`;
    }

    let actionBtnHtml = '';
    if (order.status === 'pending') {
      actionBtnHtml = `<button class="btn btn-accent btn-xs" onclick="updateKdsStatus('${order.id}', 'preparing')">Mutfakta Hazırlanıyor</button>`;
    } else if (order.status === 'preparing') {
      actionBtnHtml = `<button class="btn btn-success btn-xs" onclick="updateKdsStatus('${order.id}', 'ready')">Odaya Gönder</button>`;
    } else if (order.status === 'ready') {
      actionBtnHtml = `<button class="btn btn-primary btn-xs" onclick="updateKdsStatus('${order.id}', 'completed')">Teslim Edildi</button>`;
    }

    card.innerHTML = `
      <div class="aeon-card-content">
        <div class="aeon-card-header">
          <h4 class="aeon-card-title">${order.target_identifier}</h4>
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

function renderTechPanel(rooms) {
  const tbody = document.getElementById('tech-rooms-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance');
  
  if (maintenanceRooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted small">Bakımda olan arızalı oda bulunmamaktadır.</td></tr>`;
    return;
  }

  maintenanceRooms.forEach(room => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Oda ${room.room_number}</strong></td>
      <td><span class="room-badge maintenance">Arızalı / Bakımda</span></td>
      <td>Lavabo su akıtıyor, minibar soğutmuyor vb. (Simüle)</td>
      <td>
        <button class="btn btn-success btn-xs" onclick="resolveMaintenance('${room.id}')">
          <i class="fa-solid fa-wrench"></i> Sorun Giderildi
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


// ─── GUEST SEARCH ─────────────────────────────────────────────────────────────
window.toggleGuestSearch = () => {
  const panel = document.getElementById('guest-search-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
      document.getElementById('guest-search-input')?.focus();
    }
  }
};

window.searchGuests = async (q) => {
  const results = document.getElementById('guest-search-results');
  if (!results) return;
  if (!q || q.length < 2) { results.innerHTML = ''; return; }
  try {
    const res = await fetch(`/api/guests/search?q=${encodeURIComponent(q)}&tenant_id=${state.currentTenant}`);
    if (!res.ok) return;
    const guests = await res.json();
    results.innerHTML = '';
    if (guests.length === 0) {
      results.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--text-muted);">Misafir bulunamadı.</div>`;
      return;
    }
    guests.forEach(g => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border-glass);';
      div.innerHTML = `<strong>${g.first_name} ${g.last_name}</strong> <span style="color:var(--text-muted); font-size:11px;">${g.phone || ''} ${g.id_number ? '| ' + g.id_number : ''}</span>`;
      div.addEventListener('mouseenter', () => div.style.background = 'rgba(59,130,246,0.08)');
      div.addEventListener('mouseleave', () => div.style.background = '');
      div.addEventListener('click', () => {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('checkin-fname', g.first_name);
        setVal('checkin-lname', g.last_name);
        setVal('checkin-phone', g.phone);
        setVal('checkin-id', g.id_number);
        setVal('checkin-plate', g.car_plate);
        setVal('checkin-rate', g.daily_rate);
        setVal('checkin-adults', g.adult_count || 1);
        setVal('checkin-children', g.child_count || 0);
        const natEl = document.getElementById('checkin-nationality');
        if (natEl && g.nationality) natEl.value = g.nationality;
        results.innerHTML = '';
        document.getElementById('guest-search-panel').style.display = 'none';
        window.updateCheckinTotal();
      });
      results.appendChild(div);
    });
  } catch (err) { console.error(err); }
};

window.updateCheckinTotal = () => {
  const arrival = document.getElementById('checkin-arrival')?.value;
  const departure = document.getElementById('checkin-departure')?.value;
  const rate = parseFloat(document.getElementById('checkin-rate')?.value) || 0;
  const display = document.getElementById('checkin-total-display');
  if (!display) return;
  if (arrival && departure && rate > 0) {
    const nights = Math.max(1, Math.ceil((new Date(departure) - new Date(arrival)) / 86400000));
    display.textContent = `${(nights * rate).toFixed(2)} TL (${nights} gece × ${rate} TL)`;
    display.style.color = 'var(--color-primary)';
  } else {
    display.textContent = '—';
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('change', (e) => {
    if (e.target.id === 'checkin-arrival' || e.target.id === 'checkin-departure') {
      window.updateCheckinTotal();
    }
  });
}

let _folioCurrentRoomId = null;

window.openRoomFolio = async (roomId) => {
  _folioCurrentRoomId = roomId;
  const modal = document.getElementById('room-folio-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const titleEl = document.getElementById('folio-modal-title');
  const guestInfoEl = document.getElementById('folio-guest-info');
  const chargesEl = document.getElementById('folio-charges-list');
  const totalEl = document.getElementById('folio-total-amount');

  if (titleEl) titleEl.textContent = 'Yükleniyor...';
  if (chargesEl) chargesEl.innerHTML = '<div class="text-muted text-xs">Yükleniyor...</div>';

  try {
    const res = await fetch(`/api/rooms/${roomId}/folio?tenant_id=${state.currentTenant}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const room = data.room;
    const charges = data.charges || [];

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-receipt"></i> Oda ${room.room_number} — Folyo`;

    if (guestInfoEl) {
      const gName = room.guest_name || room.canonical_guest_name || 'Misafir yok';
      guestInfoEl.innerHTML = [
        `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`,
        `<div><span style="color:var(--text-muted); font-size:11px;">Misafir</span><br><strong>${gName}</strong></div>`,
        `<div><span style="color:var(--text-muted); font-size:11px;">Oda Tipi</span><br>${room.room_type || '-'} / ${room.bed_type || '-'}</div>`,
        room.phone ? `<div><span style="color:var(--text-muted); font-size:11px;">Telefon</span><br>${room.phone}</div>` : '',
        room.eta ? `<div><span style="color:var(--text-muted); font-size:11px;">ETA</span><br>${room.eta}</div>` : '',
        `<div><span style="color:var(--text-muted); font-size:11px;">Pansiyon Tipi</span><br>${room.board_type || '-'}</div>`,
        `<div><span style="color:var(--text-muted); font-size:11px;">Özel Gün</span><br>${room.special_occasion ? translateOccasion(room.special_occasion) : '-'}</div>`,
        `</div>`
      ].join('');
    }

    let total = 0;
    if (chargesEl) {
      chargesEl.innerHTML = '';
      if (charges.length === 0) {
        chargesEl.innerHTML = `<div class="text-muted text-xs text-center" style="padding:12px;">Henüz hesaba yansıtılan ücret yok.</div>`;
      } else {
        charges.forEach(c => {
          const amount = parseFloat(c.total_amount) || 0;
          total += amount;
          const typeMap = {
            order: 'Sipariş', manual_charge: 'Manuel', room_service_charge: 'Oda Servisi',
            minibar_charge: 'Minibar', laundry_charge: 'Çamaşır', spa_charge: 'Spa',
            parking_charge: 'Park', extra_night: 'Ekstra Gece'
          };
          const div = document.createElement('div');
          div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;';
          div.innerHTML = `
            <div>
              <span style="font-size:10px; background:rgba(59,130,246,0.15); color:#3b82f6; border-radius:4px; padding:1px 6px; margin-right:6px;">${typeMap[c.type] || c.type}</span>
              <span>${typeof c.details === 'string' && c.details.length < 80 ? c.details : (c.type)}</span>
              <div style="font-size:10px; color:var(--text-muted);">${new Date(c.created_at).toLocaleString('tr-TR')}</div>
            </div>
            <strong style="color:var(--color-primary); white-space:nowrap; margin-left:12px;">${amount.toFixed(2)} TL</strong>
          `;
          chargesEl.appendChild(div);
        });
      }
    }

    if (totalEl) totalEl.textContent = `${total.toFixed(2)} TL`;

  } catch (err) {
    if (chargesEl) chargesEl.innerHTML = `<div class="text-danger text-xs">Folyo yüklenemedi: ${err.message}</div>`;
  }
};

window.submitFolioCharge = async () => {
  const description = document.getElementById('folio-charge-desc')?.value?.trim();
  const amount = parseFloat(document.getElementById('folio-charge-amount')?.value) || 0;
  const chargeType = document.getElementById('folio-charge-type')?.value || 'manual_charge';

  if (!description || amount <= 0) {
    alert('Açıklama ve tutar gereklidir.'); return;
  }

  try {
    const res = await fetch(`/api/rooms/folio-charge?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: _folioCurrentRoomId,
        description, amount, charge_type: chargeType,
        created_by: 'Resepsiyon'
      })
    });
    if (res.ok) {
      document.getElementById('folio-charge-desc').value = '';
      document.getElementById('folio-charge-amount').value = '';
      window.openRoomFolio(_folioCurrentRoomId);
    }
  } catch (err) { console.error(err); }
};

window.folioCheckout = async () => {
  if (!_folioCurrentRoomId) return;
  if (!confirm('Check-out yapmak istediğinize emin misiniz?')) return;
  try {
    const res = await fetch(`/api/rooms/checkout?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: _folioCurrentRoomId, updated_by: 'Resepsiyon' })
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('room-folio-modal').style.display = 'none';
      logEvent('event', `Check-out: Oda tamamlandı. Toplam tahakkuk: <strong>${data.folioSummary?.totalCharged?.toFixed(2) || 0} TL</strong>`);
      loadStayData();
    }
  } catch (err) { console.error(err); }
};
