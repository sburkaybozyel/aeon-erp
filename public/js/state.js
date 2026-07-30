export let state = {
  currentTenant: window.tenantId || 'aeon',
  activePanel: 'panel-admin',
  simulatedTarget: 'Table-Masa 1',
  guestCart: [],
  availableCatalog: [],
  paymentMethods: [],
  activeStaff: window.aeonUser || null
};
window.aeonState = state;

export function logEvent(type, message) {
  const eventLog = document.getElementById('event-log');
  if (!eventLog) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `[${time}] ${message}`;
  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

const loaders = {};

export function registerLoader(name, fn) {
  loaders[name] = fn;
}

export function triggerLoader(name, data) {
  if (loaders[name]) {
    loaders[name](data);
  }
}

export async function loadAllData() {
  try {
    const tenantParam = `?tenant_id=${state.currentTenant}`;
    const [catRes, pmRes] = await Promise.all([
      fetch(`/api/catalog${tenantParam}`),
      fetch(`/api/payment-methods${tenantParam}`)
    ]);
    state.availableCatalog = catRes.ok ? await catRes.json() : [];
    state.paymentMethods = pmRes.ok ? await pmRes.json() : [];
    triggerLoader('updatePaymentDropdowns', state.paymentMethods);
    if (['panel-admin', 'panel-reception', 'panel-housekeeping', 'panel-restaurant', 'panel-bar', 'panel-maintenance'].includes(state.activePanel)) {
      triggerLoader('loadAdminDashboardData');
    }
    if (state.activePanel === 'panel-system') {
      triggerLoader('loadStaffManagementData');
      triggerLoader('loadHotelProfile');
    }
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

window.__aeonState = state;
window.__aeonLoadAllData = loadAllData;

let _sseReconnectTimer = null;

export function initSSE(tenantId) {
  const url = `/api/events?tenant_id=${tenantId}`;
  let es;

  function connect() {
    es = new EventSource(url);

    ['request_created', 'request_updated', 'room_updated', 'table_updated', 'area_updated', 'maintenance_updated', 'hk_task_updated', 'bar_inventory_updated', 'bar_menu_updated'].forEach(event => {
      es.addEventListener(event, () => triggerLoader('loadAdminDashboardData'));
    });

    es.onerror = () => {
      es.close();
      clearTimeout(_sseReconnectTimer);
      _sseReconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();
}
