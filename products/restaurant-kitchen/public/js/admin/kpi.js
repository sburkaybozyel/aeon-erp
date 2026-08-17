import { state } from '../state.js';

export function renderDesktopKpis(rooms, tables, requests, apaSummary, dashboard = null) {
  // 1. Consolidated Revenue (Dining + Stay) in TL
  let totalRevenueTl = Number(dashboard?.finance?.daily_revenue || 0);
  if (!dashboard) requests.forEach(req => { if (req.status === 'completed' || req.type === 'room_service_charge') totalRevenueTl += req.total_amount || 0; });

  const kpiRevenue = document.getElementById('kpi-total-revenue');
  if (kpiRevenue) {
    kpiRevenue.textContent = `${totalRevenueTl.toFixed(2)} TL`;
  }

  // 2. Hotel Occupancy Rate
  const totalRooms = rooms.length || 1;
  const occupiedRooms = Number(dashboard?.operations?.reception?.occupied_rooms ?? rooms.filter(r => r.status === 'occupied').length);
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

export function renderControlSummary(dashboard) {
  const node = document.getElementById('admin-control-summary');
  if (!node || !dashboard) return;
  const maintenance = Array.isArray(dashboard.maintenance) ? dashboard.maintenance.length : 0;
  const finance = dashboard.finance || {};
  const operations = dashboard.operations || {};
  const kitchen = operations.kitchen || {};
  const bar = operations.bar || {};
  const reception = operations.reception || {};
  const criticalStock = Number(kitchen.critical_stock || 0) + Number(bar.critical_stock || 0);
  const readyTickets = Number(kitchen.ready_tickets || 0) + Number(bar.ready_tickets || 0);
  const attention = [
    [Number(reception.identity_pending || 0), 'KBS bildirimi işlem bekliyor', 'critical'],
    [maintenance, 'bakım kaydı açık', maintenance ? 'critical' : ''],
    [criticalStock, 'kritik stok kalemi var', criticalStock ? 'critical' : ''],
    [readyTickets, 'sipariş servis bekliyor', '']
  ].filter(([value]) => value > 0);
  const tenant = encodeURIComponent(state.currentTenant || 'restaurant_kitchen');
  const link = (path, label, icon) => `<a class="admin-quick-link" href="/${path}?tenant_id=${tenant}"><i class="fa-solid ${icon}"></i>${label}</a>`;
  node.innerHTML = `<div class="admin-overview-head"><div><p class="admin-overline">YÖNETİCİ KONTROLÜ</p><h3><i class="fa-solid fa-tower-observation"></i>Operasyon Özeti</h3><p>Vardiyadaki öncelikleri görün, ilgili ekrana tek adımda geçin.</p></div><span class="admin-live-stamp"><i class="fa-solid fa-circle"></i> Canlı veri</span></div><div class="admin-overview-metrics"><article class="admin-overview-metric ${readyTickets ? 'alert' : ''}"><span>Servis bekleyen</span><strong>${readyTickets}</strong><small>Mutfak ve bar hazırları</small></article><article class="admin-overview-metric ${criticalStock ? 'danger' : ''}"><span>Kritik stok</span><strong>${criticalStock}</strong><small>Üretimi etkileyebilecek kalem</small></article><article class="admin-overview-metric ${maintenance ? 'alert' : ''}"><span>Açık bakım</span><strong>${maintenance}</strong><small>Teknik iş emri ve oda bakımda</small></article><article class="admin-overview-metric"><span>Bekleyen tahsilat</span><strong>${Number(finance.restaurant_receivables || 0).toFixed(0)} TL</strong><small>Restoran açık adisyonu</small></article></div><div class="admin-overview-bottom"><div class="admin-attention-list"><h4>Şimdi ilgilenilmesi gerekenler</h4><div class="admin-attention-items">${attention.length ? attention.map(([value, text, level]) => `<div class="admin-attention-item ${level}"><i class="fa-solid fa-triangle-exclamation"></i><strong>${value}</strong> ${text}</div>`).join('') : '<div class="admin-attention-clear"><i class="fa-solid fa-circle-check"></i> Şu an kritik operasyon uyarısı yok.</div>'}</div></div><div class="admin-overview-actions"><h4>Hızlı geçiş</h4><div class="admin-quick-links">${link('staff-kitchen.html', 'Mutfak', 'fa-fire-burner')}${link('staff-bar.html', 'Bar', 'fa-martini-glass-citrus')}${link('staff-maintenance.html', 'Teknik', 'fa-screwdriver-wrench')}${link('staff-reception.html', 'Resepsiyon', 'fa-bed')}</div></div></div>`;
}

export function renderDepartmentOperations(operations) {
  const node = document.getElementById('admin-department-operations');
  if (!node || !operations) return;
  const tenant = encodeURIComponent(state.currentTenant || 'restaurant_kitchen');
  const departments = [
    { icon: 'fa-hotel', title: 'Resepsiyon', portal: 'staff-reception.html', open: Number(operations.reception?.open_tasks || 0), critical: Number(operations.reception?.identity_pending || 0), metrics: [[operations.reception?.occupied_rooms || 0, 'Dolu oda'], [operations.reception?.open_tasks || 0, 'Açık görev'], [operations.reception?.identity_pending || 0, 'KBS bekleyen'], [operations.reception?.precheckins_pending || 0, 'Ön giriş']] },
    { icon: 'fa-broom-ball', title: 'Kat Hizmetleri', portal: 'staff-housekeeping.html', open: Number(operations.housekeeping?.open_tasks || 0), critical: Number(operations.housekeeping?.rooms_in_cleaning || 0), metrics: [[operations.housekeeping?.open_tasks || 0, 'Açık görev'], [operations.housekeeping?.rooms_in_cleaning || 0, 'Temizlikte oda'], [operations.housekeeping?.dirty_areas || 0, 'Ortak alan'], [operations.housekeeping?.open_laundry || 0, 'Açık çamaşır']] },
    { icon: 'fa-utensils', title: 'Restoran & Servis', portal: 'staff-restaurant.html', open: Number(operations.restaurant?.open_orders || 0), critical: Number(operations.restaurant?.open_tables || 0), metrics: [[operations.restaurant?.open_tables || 0, 'Açık masa'], [operations.restaurant?.open_orders || 0, 'Açık adisyon'], [operations.restaurant?.open_adisyon || 0, 'Bekleyen TL'], [operations.kitchen?.ready_tickets || 0, 'Hazır servis']] },
    { icon: 'fa-fire-burner', title: 'Mutfak', portal: 'staff-kitchen.html', open: Number(operations.kitchen?.active_tickets || 0), critical: Number(operations.kitchen?.critical_stock || 0), metrics: [[operations.kitchen?.active_tickets || 0, 'Aktif KDS'], [operations.kitchen?.ready_tickets || 0, 'Servise hazır'], [operations.kitchen?.disabled_menu_items || 0, 'Kapalı ürün'], [operations.kitchen?.critical_stock || 0, 'Kritik stok']] },
    { icon: 'fa-martini-glass-citrus', title: 'Bar', portal: 'staff-bar.html', open: Number(operations.bar?.active_tickets || 0), critical: Number(operations.bar?.critical_stock || 0), metrics: [[operations.bar?.active_tickets || 0, 'Üretimde'], [operations.bar?.ready_tickets || 0, 'Servise hazır'], [operations.bar?.active_products || 0, 'Satışa açık'], [operations.bar?.critical_stock || 0, 'Kritik stok']] },
    { icon: 'fa-screwdriver-wrench', title: 'Teknik Servis', portal: 'staff-maintenance.html', open: Number(operations.technical?.open_work_orders || 0), critical: Number(operations.technical?.maintenance_rooms || 0), metrics: [[operations.technical?.open_work_orders || 0, 'Açık iş emri'], [operations.technical?.maintenance_rooms || 0, 'Bakımda oda'], [operations.technical?.plans_due_7_days || 0, 'Planlı bakım'], [operations.technical?.purchase_requests || 0, 'Satın alma']] }
  ];
  const internalPanel = { 'staff-housekeeping.html': 'panel-housekeeping', 'staff-maintenance.html': 'panel-maintenance' };
  node.innerHTML = departments.map(item => { const level = item.critical ? 'critical' : item.open ? 'needs-attention' : ''; const label = item.critical ? 'Öncelikli' : item.open ? 'Takipte' : 'Dengeli'; const panelTarget = internalPanel[item.portal]; const action = panelTarget ? `<a class="admin-department-action" href="#" onclick="window.aeonGoToPanel('${panelTarget}'); return false;">Detayları gör <i class="fa-solid fa-arrow-right"></i></a>` : `<a class="admin-department-action" href="/${item.portal}?tenant_id=${tenant}">Operasyon ekranını aç <i class="fa-solid fa-arrow-right"></i></a>`; return `<article class="admin-department-card ${level}"><div class="admin-department-card-head"><div class="admin-department-title"><span class="admin-department-icon"><i class="fa-solid ${item.icon}"></i></span><div><strong>${item.title}</strong><small>Canlı operasyon görünümü</small></div></div><span class="admin-status-pill ${item.critical ? 'critical' : item.open ? 'attention' : ''}">${label}</span></div><div class="admin-department-metrics">${item.metrics.map(([value, label]) => `<div class="admin-department-metric"><b>${Number(value || 0).toLocaleString('tr-TR')}</b><span>${label}</span></div>`).join('')}</div>${action}</article>`; }).join('');
  const stamp = document.getElementById('admin-department-updated');
  if (stamp) stamp.innerHTML = `<i class="fa-solid fa-circle"></i> ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} güncellendi`;
}

export function renderActiveGuests(rooms) {
  const node = document.getElementById('admin-guests-body');
  if (!node) return;
  node.innerHTML = '';

  const activeGuests = rooms.filter(r => r.status === 'occupied' || r.status === 'reserved');

  if (activeGuests.length === 0) {
    node.innerHTML = `<div class="admin-room-empty"><i class="fa-solid fa-bed"></i><strong>Aktif konaklama kaydı yok</strong><span>Resepsiyonda check-in tamamlandığında misafir burada otomatik görünür.</span></div>`;
    return;
  }

  activeGuests.forEach(room => {
    const guestName = room.guest_name || room.canonical_guest_name || '-';
    const phone = room.phone || '-';
    const arrival = room.arrival_date ? new Date(room.arrival_date).toLocaleDateString('tr-TR') : '-';
    const departure = room.departure_date ? new Date(room.departure_date).toLocaleDateString('tr-TR') : '-';
    const nights = (room.arrival_date && room.departure_date)
      ? Math.ceil((new Date(room.departure_date) - new Date(room.arrival_date)) / 86400000)
      : '-';
    const reservation = room.occupancy_source === 'reservation';
    const dnd = room.dnd_active ? '<span class="admin-guest-tag danger"><i class="fa-solid fa-ban"></i> DND</span>' : '';
    const balance = Number(room.folio_balance || 0);
    const folioButton = !reservation && room.folio_id ? `<button class="btn btn-secondary btn-xs" onclick="window.openRoomFolio('${room.folio_id}')"><i class="fa-solid fa-receipt"></i> Folyo</button>` : '';
    const card = document.createElement('article');
    card.className = 'admin-inhouse-card';
    card.innerHTML = `<div class="admin-inhouse-card-head"><span class="admin-room-number">Oda ${room.room_number}</span><span class="admin-guest-tag ${reservation ? 'muted' : ''}">${reservation ? 'Rezervasyonlu' : 'Konaklıyor'}</span></div><strong>${guestName}</strong><span class="admin-guest-phone"><i class="fa-solid fa-phone"></i> ${phone || 'Telefon kaydı yok'}</span><div class="admin-inhouse-stay"><span><small>Giriş</small>${arrival}</span><span><small>Çıkış</small>${departure}</span><span><small>Geceleme</small>${nights} gece</span></div><div class="admin-inhouse-card-foot">${dnd || `<span class="admin-guest-tag muted">${reservation ? 'Ön büro onayı bekliyor' : 'Oda servisi açık'}</span>`}<span class="admin-folio-balance ${balance > 0 ? 'due' : ''}">${reservation ? 'Folyo check-in sonrası açılır' : balance > 0 ? `${balance.toFixed(2)} TL bakiye` : 'Folyo dengede'}</span>${folioButton}</div>`;
    node.appendChild(card);
  });
}

export function renderRoomLiveSummary(rooms) {
  const node = document.getElementById('admin-room-live-summary');
  if (!node) return;
  const count = status => rooms.filter(room => room.status === status).length;
  const metrics = [[count('occupied'), 'Konaklayan'], [count('reserved'), 'Rezervasyonlu'], [count('clean_vacant'), 'Hazır oda'], [count('dirty_vacant') + count('cleaning') + count('maintenance') + count('out_of_order') + count('blocked'), 'Operasyon bekleyen']];
  node.innerHTML = metrics.map(([value, label]) => `<article><b>${value}</b><span>${label}</span></article>`).join('');
}

export function renderRevenueDetail(requests, apaSummary, dashboard = null) {
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
  if (dashboard?.finance) {
    diningRev = Number(dashboard.finance.daily_restaurant_revenue || 0);
    stayRev = Number(dashboard.finance.daily_folio_accrual || 0);
  }

  const elDining = document.getElementById('admin-rev-dining');
  if (elDining) elDining.textContent = `${diningRev.toFixed(2)} TL`;

  const elStay = document.getElementById('admin-rev-stay');
  if (elStay) elStay.textContent = `${stayRev.toFixed(2)} TL`;

  const elCruise = document.getElementById('admin-rev-cruise');
  if (elCruise) elCruise.textContent = `€${(apaSummary.totalSpentEur || 0).toFixed(2)}`;
}

export async function loadBranding() {
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
