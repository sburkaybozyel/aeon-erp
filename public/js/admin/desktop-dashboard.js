import { state, registerLoader } from '../state.js';
import { loadAdminDashboardData } from './dispatch.js';
import { loadStaffManagementData, loadHotelProfile, setupStaffManagementForm, setupHotelProfileForm } from './staff-management.js';
import { setupLiveManagementForms, renderLiveManagementLists } from './live-management.js';
import { renderDesktopKpis, renderControlSummary, renderDepartmentOperations, renderActiveGuests, renderRevenueDetail, renderRoomLiveSummary } from './kpi.js';
import { renderDesktopStockWarnings, renderVarianceReports } from './inventory-stock.js';
import { renderPatronPanel } from './patron-ai.js';
import { renderLiveOperationsTracker } from './tracker.js';
import { triggerRequestNotification } from './notifications.js';
import { esc } from './utils.js';

export function setupDesktopAdminDashboard() {
  registerLoader('loadAdminDashboardData', loadAdminDashboardData);
  registerLoader('loadStaffManagementData', loadStaffManagementData);
  registerLoader('loadHotelProfile', loadHotelProfile);
  setupLiveManagementForms();
  setupStaffManagementForm();
  setupHotelProfileForm();

  const btnRefreshAuditLogs = document.getElementById('btn-refresh-audit-logs');
  if (btnRefreshAuditLogs) {
    btnRefreshAuditLogs.addEventListener('click', loadStaffManagementData);
  }
  document.getElementById('admin-room-create-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('admin-room-create-panel');
    if (panel) panel.hidden = !panel.hidden;
  });

  document.getElementById('admin-migrate-checkin')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const resultBox = document.getElementById('admin-migrate-checkin-result');
    button.disabled = true;
    button.textContent = 'Çalışıyor…';
    try {
      const response = await fetch(`/api/reception/reservations/bulk-migrate-checkin?tenant_id=${state.currentTenant}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'İşlem başarısız.');
      const missingIdentity = result.migrated.filter(item => item.identity_missing).length;
      resultBox.innerHTML = `<strong>${result.migrated_count}</strong> rezervasyon check-in yapıldı (${missingIdentity} tanesi kimlik bilgisi eksik, KBS kuyruğuna manuel inceleme olarak eklendi). <strong>${result.skipped_count}</strong> rezervasyon atlandı.${result.skipped.length ? `<ul>${result.skipped.map(item => `<li>${esc(item.reservation_number)} — ${esc(item.reason)}</li>`).join('')}</ul>` : ''}`;
      loadAdminDashboardData();
    } catch (error) {
      resultBox.textContent = error.message;
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-play"></i> Şimdi Çalıştır';
    }
  });
}

export async function loadDesktopAdminDashboardData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    
    // FETCH REAL DATA FROM BACKEND API
    const businessDate = new Date().toISOString().slice(0, 10);
    const [dashboardRes, roomsRes, staysRes, rackRes, tablesRes, reqsRes, invRes, auditsRes, apaRes, logsRes, hkTasksRes, workOrdersRes] = await Promise.all([
      fetch(`/api/admin/dashboard${tenantParam}`),
      fetch(`/api/rooms${tenantParam}`),
      fetch(`/api/reception/stays${tenantParam}`),
      fetch(`/api/reception/room-rack?from=${businessDate}&days=1&tenant_id=${state.currentTenant}`),
      fetch(`/api/tables${tenantParam}`),
      fetch(`/api/requests${tenantParam}`),
      fetch(`/api/inventory${tenantParam}`),
      fetch(`/api/inventory/audits${tenantParam}`),
      fetch(`/api/apa/summary${tenantParam}`),
      fetch(`/api/audit-logs${tenantParam}`),
      fetch(`/api/hk/tasks${tenantParam}`),
      fetch(`/api/maintenance/work-orders${tenantParam}`)
    ]);

    const dashboard = dashboardRes.ok ? await dashboardRes.json() : null;
    const rooms = mergeRoomsWithReception(roomsRes.ok ? await roomsRes.json() : [], staysRes.ok ? await staysRes.json() : [], rackRes.ok ? await rackRes.json() : null);
    const tables = tablesRes.ok ? await tablesRes.json() : [];
    const requests = reqsRes.ok ? await reqsRes.json() : [];
    const inventory = invRes.ok ? await invRes.json() : [];
    const audits = auditsRes.ok ? await auditsRes.json() : [];
    const apaSummary = apaRes.ok ? await apaRes.json() : { cash: 0, credit: 0, room_charge: 0, total_expenses: 0, net: 0, totalSpentEur: 0 };
    const auditLogs = logsRes.ok ? await logsRes.json() : [];
    const hkTasks = hkTasksRes.ok ? await hkTasksRes.json() : [];
    const workOrders = workOrdersRes.ok ? await workOrdersRes.json() : [];

    // Check for new requests to trigger notifications
    if (!window.adminKnownRequestIds) {
      window.adminKnownRequestIds = new Set(requests.map(r => r.id));
    } else {
      requests.forEach(req => {
        if (!window.adminKnownRequestIds.has(req.id)) {
          window.adminKnownRequestIds.add(req.id);
          triggerRequestNotification(req, state.availableCatalog);
        }
      });
    }

    renderDesktopKpis(rooms, tables, requests, apaSummary, dashboard);
    renderCommerceSummaries(tables, requests, inventory, audits);
    renderDesktopStockWarnings(dashboard?.critical_stock || inventory);
    renderVarianceReports(audits);
    renderRoomLiveSummary(rooms);
    renderActiveGuests(rooms);
    renderRevenueDetail(requests, apaSummary, dashboard);
    renderLiveManagementLists(rooms, tables, inventory, state.availableCatalog);
    renderPatronPanel(requests, audits, inventory, state.availableCatalog);
    
    // Render Live Operations Tracker (Tüm Olan Biten)
    renderLiveOperationsTracker(rooms, tables, inventory, requests, dashboard?.activity || auditLogs);
    renderControlSummary(dashboard);
    renderDepartmentOperations(dashboard?.operations);
    renderHousekeepingTasks(hkTasks);
    renderMaintenanceOrders(workOrders);
  } catch (err) {
    console.error("Error loading Admin Dashboard data:", err);
  }
}

function renderHousekeepingTasks(tasks) {
  const container = document.getElementById('admin-hk-tasks');
  const open = tasks.filter(task => task.status !== 'completed');

  const summary = document.getElementById('admin-housekeeping-summary');
  if (summary) {
    const urgent = open.filter(task => task.priority === 'urgent' || task.priority === 'high').length;
    summary.innerHTML = [[open.length, 'Açık görev'], [urgent, 'Yüksek öncelik']].map(([value, label]) => `<article><b>${value}</b><span>${label}</span></article>`).join('');
  }

  if (!container) return;
  container.innerHTML = open.length === 0
    ? '<div class="admin-empty-state"><i class="fa-solid fa-circle-check"></i><span>Açık kat hizmetleri görevi bulunmuyor.</span></div>'
    : open.map(task => `
      <div style="border-bottom:1px solid var(--border-glass); padding-bottom:6px;">
        <div class="flex-between"><strong>${esc(task.room_number || 'Genel')}</strong><span class="text-xs text-muted">${new Date(task.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="text-xs text-muted">${esc(task.task_type)} · ${esc(task.details || '-')}</div>
      </div>
    `).join('');
}

function renderMaintenanceOrders(orders) {
  const container = document.getElementById('admin-maintenance-orders');
  const open = orders.filter(order => order.status !== 'resolved');

  const summary = document.getElementById('admin-maintenance-summary');
  if (summary) {
    const critical = open.filter(order => order.priority === 'critical').length;
    summary.innerHTML = [[open.length, 'Açık iş emri'], [critical, 'Kritik öncelik']].map(([value, label]) => `<article><b>${value}</b><span>${label}</span></article>`).join('');
  }

  if (!container) return;
  container.innerHTML = open.length === 0
    ? '<div class="admin-empty-state"><i class="fa-solid fa-circle-check"></i><span>Açık bakım iş emri bulunmuyor.</span></div>'
    : open.map(order => `
      <div style="border-bottom:1px solid var(--border-glass); padding-bottom:6px;">
        <div class="flex-between"><strong>${esc(order.room_number ? `Oda ${order.room_number}` : (order.asset_name || 'Genel'))}</strong><span class="text-xs text-muted">${new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="text-xs text-muted">${esc(order.category)} · ${esc(order.summary || '-')} · <span class="text-warning">${esc(order.status)}</span></div>
      </div>
    `).join('');
}

function renderCommerceSummaries(tables, requests, inventory, audits) {
  const terminal = new Set(['completed', 'paid', 'delivered', 'cancelled', 'rejected']);
  const activeOrders = requests.filter(request => request.type === 'order' && !terminal.has(String(request.status || '').toLowerCase()));
  const readyOrders = activeOrders.filter(request => String(request.status || '').toLowerCase() === 'ready');
  const restaurant = document.getElementById('admin-restaurant-summary');
  if (restaurant) restaurant.innerHTML = [[tables.filter(table => table.status === 'occupied').length, 'Açık masa'], [activeOrders.length, 'Aktif sipariş'], [readyOrders.length, 'Servis bekleyen']].map(([value, label]) => `<article><b>${value}</b><span>${label}</span></article>`).join('');
  const barInventory = inventory.filter(item => String(item.module_type || '').toLowerCase() === 'bar');
  const critical = barInventory.filter(item => Number(item.stock || 0) <= Number(item.par_level || 0)).length;
  const variance = audits.filter(audit => Number(audit.variance || 0) !== 0).length;
  const bar = document.getElementById('admin-bar-summary');
  if (bar) bar.innerHTML = [[barInventory.length, 'Bar stok kalemi'], [critical, 'Kritik stok'], [variance, 'Sayım sapması']].map(([value, label]) => `<article><b>${value}</b><span>${label}</span></article>`).join('');
}

function mergeRoomsWithReception(rooms, stays, rack) {
  const byRoomId = new Map(stays.map(stay => [String(stay.room_id), stay]));
  const assignments = new Map((rack?.assignments || []).filter(assignment => ['reserved', 'checked_in', 'active'].includes(String(assignment.status || '').toLowerCase()) || ['confirmed', 'guaranteed', 'option', 'checked_in'].includes(String(assignment.reservation_status || '').toLowerCase())).map(assignment => [String(assignment.room_id), assignment]));
  return rooms.map(room => {
    const stay = byRoomId.get(String(room.id));
    if (stay) return {
      ...room,
      status: 'occupied',
      occupancy_source: 'stay',
      active_stay_id: stay.id,
      guest_name: `${stay.first_name || ''} ${stay.last_name || ''}`.trim() || room.guest_name || 'Konaklayan misafir',
      phone: stay.phone || room.phone || '',
      arrival_date: stay.arrival_date || room.arrival_date,
      departure_date: stay.departure_date || room.departure_date,
      checkin_at: stay.checkin_at,
      folio_id: stay.folio_id,
      folio_balance: Number(stay.balance || 0)
    };
    const assignment = assignments.get(String(room.id));
    if (!assignment) return room;
    return {
      ...room,
      status: 'reserved',
      occupancy_source: 'reservation',
      reservation_id: assignment.reservation_id,
      guest_name: assignment.guest_name || room.guest_name || 'Rezervasyon misafiri',
      phone: assignment.phone || room.phone || '',
      arrival_date: assignment.start_date || room.arrival_date,
      departure_date: assignment.end_date || room.departure_date,
      reservation_status: assignment.reservation_status || 'confirmed'
    };
  });
}
