import { esc } from './utils.js';

export function renderLiveOperationsTracker(rooms, tables, inventory, requests, logs) {
  // 1. Oda Durumları (Rooms)
  const roomsContainer = document.getElementById('live-tracker-rooms');
  if (roomsContainer) {
    roomsContainer.innerHTML = '';
    rooms.forEach(r => {
      const status = String(r.status || 'clean_vacant');
      const meta = { occupied: ['Konaklıyor', 'occupied'], reserved: ['Rezervasyonlu', 'reserved'], dirty_vacant: ['Kirli', 'dirty'], maintenance: ['Bakım', 'maintenance'], out_of_order: ['Kullanım dışı', 'maintenance'], blocked: ['Blokeli', 'maintenance'], cleaning: ['Temizlikte', 'dirty'], clean_vacant: ['Hazır', 'clean'] }[status] || ['Hazır', 'clean'];
      const card = document.createElement('article');
      card.className = `admin-room-status-card ${meta[1]}`;
      card.innerHTML = `<div><span class="admin-room-number">Oda ${esc(r.room_number)}</span><strong>${esc(r.guest_name || (status === 'occupied' ? 'Konaklayan misafir' : r.room_type || 'Standart oda'))}</strong><small>${esc(r.floor ? `${r.floor}. kat` : '')}${r.dnd_active ? ' · DND aktif' : ''}${r.ac_status === 'broken' ? ' · Klima arızalı' : ''}</small></div><span class="admin-room-status-pill ${meta[1]}">${meta[0]}</span>`;
      roomsContainer.appendChild(card);
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
        
        const div = document.createElement('article');
        div.className = 'admin-table-live-card';
        div.innerHTML = `<div><span>Masa ${esc(t.table_number)}</span><strong>${esc(t.section || 'Restoran')}</strong></div><b style="color:${statusColor};">${statusText}</b>`;
        tablesContainer.appendChild(div);
      });
    } else {
      const div = document.createElement('div');
      div.className = 'text-muted text-xs';
      div.textContent = 'Aktif masa bulunmuyor.';
      tablesContainer.appendChild(div);
    }
    
    // Active KDS Orders (Pending / Preparing / Ready)
    const terminal = new Set(['completed', 'paid', 'delivered', 'cancelled', 'rejected']);
    const activeOrders = requests.filter(r => r.type === 'order' && !terminal.has(String(r.status || '').toLowerCase()));
    if (activeOrders.length > 0) {
      activeOrders.forEach(o => {
        let itemsList = '';
        try {
          const items = JSON.parse(o.details);
          if (Array.isArray(items)) {
            itemsList = items.map(i => `${esc(i.name)} x ${esc(i.quantity)}`).join(', ');
          }
        } catch(e) { itemsList = esc(o.details); }

        const div = document.createElement('article');
        div.className = 'admin-table-live-card order';
        div.innerHTML = `<div><span>${esc(o.target_identifier)}</span><strong>${itemsList || 'Sipariş detayı'}</strong></div><b>${esc(o.status)}</b>`;
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
        <span class="text-muted" style="font-size:9px;">${esc(dateStr)}</span>
      </div>
      <div style="font-size:10px; color:rgba(255,255,255,0.85); margin-top:2px;">${esc(log.action)}: ${esc(log.details)}</div>
    `;
    container.appendChild(div);
  });
}
