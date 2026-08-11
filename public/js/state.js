// Read tenant_id from URL (supports index.html?tenant_id=aeon)
let _tenantFromUrl = 'aeon';

// Save original fetch
const _origFetch = window.fetch;

function canQueueOffline(url, method) {
  return method === 'POST' && url.includes('/api/requests') && !url.includes('/api/requests/status');
}

function offlineBlockedResponse() {
  return new Response(JSON.stringify({ error: 'Bu işlem çevrimdışı güvenli değildir. Bağlantıyı geri getirdikten sonra yeniden deneyin.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

Object.keys(localStorage)
  .filter(key => key.startsWith('offline_cache_'))
  .forEach(key => localStorage.removeItem(key));

// Intercept fetch globally
window.fetch = async function(input, init) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) {
    return _origFetch(input, init);
  }

  // Inject tenant_id if missing
  const tid = _tenantFromUrl;
  const sep = input.includes('?') ? '&' : '?';
  if (!input.includes('tenant_id=')) {
    input = `${input}${sep}tenant_id=${tid}`;
  }

  const method = (init && init.method || 'GET').toUpperCase();

  if (method === 'GET') {
    return _origFetch(input, { ...(init || {}), cache: 'no-store' });
  }

  if (method === 'POST' || method === 'DELETE' || method === 'PUT' || method === 'PATCH') {
    if (!navigator.onLine) {
      const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (urlStr.includes('/api/log') || urlStr.includes('/api/push/subscribe')) {
        return new Response(JSON.stringify({ success: true, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }
      if (!canQueueOffline(urlStr, method)) return offlineBlockedResponse();

      console.warn("Offline! Queueing modification request:", input);
      const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
      queue.push({
        url: input,
        init: init ? {
          method: init.method,
          headers: Object.fromEntries(new Headers(init.headers || {}).entries()),
          body: init.body
        } : { method }
      });
      localStorage.setItem('offline_request_queue', JSON.stringify(queue));

      logEvent('system', `<span class="text-danger">Bağlantı Yok!</span> İşlem sıraya alındı.`);
      alert("İnternet bağlantısı yok! İşleminiz sıraya alındı, internet geldiğinde otomatik olarak kaydedilecek.");

      return new Response(JSON.stringify({ success: true, offline: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      return await _origFetch(input, init);
    } catch (err) {
      const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (urlStr.includes('/api/log') || urlStr.includes('/api/push/subscribe')) {
        return new Response(JSON.stringify({ success: true, offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }
      if (!canQueueOffline(urlStr, method)) return offlineBlockedResponse();
      
      console.warn("Server unreachable. Queueing modification request:", input);
      const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
      queue.push({
        url: input,
        init: init ? {
          method: init.method,
          headers: Object.fromEntries(new Headers(init.headers || {}).entries()),
          body: init.body
        } : { method }
      });
      localStorage.setItem('offline_request_queue', JSON.stringify(queue));

      logEvent('system', `<span class="text-danger">Sunucuya Erişilemedi!</span> İşlem sıraya alındı.`);
      alert("Sunucuya erişilemedi. İşleminiz sıraya alındı, bağlantı kurulduğunda kaydedilecek.");

      return new Response(JSON.stringify({ success: true, offline: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Shared App State
export let state = {
  currentTenant: window.tenantId || 'aeon',
  activePanel: 'panel-admin',
  featureFlags: {
    MODULE_DINING: true,
    MODULE_STAY: true,
    MODULE_CRUISE: true,
    MODULE_PRINTER: false
  },
  simulatedTarget: 'Table-Masa 1',
  guestCart: [],
  availableCatalog: [],
  paymentMethods: [],
  activeStaff: window.aeonUser || null
};
window.aeonState = state;

// Log Console
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

// Global loaders registry to avoid circular imports
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

    // FETCH CONFIG & CATALOG CONCURRENTLY
    const [cfgRes, catRes, pmRes] = await Promise.all([
      fetch(`/api/tenant/config${tenantParam}`),
      fetch(`/api/catalog${tenantParam}`),
      fetch(`/api/payment-methods${tenantParam}`)
    ]);

    let config = { MODULE_DINING: true, MODULE_STAY: true, MODULE_CRUISE: true, MODULE_PRINTER: true, MODULE_POOL: false };
    if (cfgRes.ok) {
      const cfgData = await cfgRes.json();
      Object.keys(cfgData).forEach(k => {
        config[k] = (cfgData[k] === 'true' || cfgData[k] === true);
      });
    }
    state.featureFlags = config;
    triggerLoader('applyFeatureFlags', state.featureFlags);
    
    state.availableCatalog = catRes.ok ? await catRes.json() : [];

    state.paymentMethods = pmRes.ok ? await pmRes.json() : [
      { id: 'pm1', name: 'Nakit (TRY)', type: 'cash', active: true },
      { id: 'pm2', name: 'Kredi Kartı', type: 'credit_card', active: true },
      { id: 'pm3', name: 'Oda Hesabına Yaz', type: 'room_charge', active: true }
    ];
    logEvent('hook', `payment_methods kancası çağrıldı. Aktif yöntemler: [${state.paymentMethods.map(p => p.name).join(', ')}]`);
    triggerLoader('updatePaymentDropdowns', state.paymentMethods);
    
    // Module specific loaders
    if (state.activePanel === 'panel-stay' && state.featureFlags.MODULE_STAY) {
      triggerLoader('loadStayData');
    }
    if (state.activePanel === 'panel-dining' && state.featureFlags.MODULE_DINING) {
      triggerLoader('loadDiningData');
    }
    if (state.activePanel === 'panel-cruise' && state.featureFlags.MODULE_CRUISE) {
      triggerLoader('loadCruiseData');
    }
    if (state.activePanel === 'panel-guest') {
      triggerLoader('loadGuestSimulatorData');
    }
    if (state.activePanel === 'panel-staff') {
      triggerLoader('loadStaffSimulatorData');
    }
    if (state.activePanel === 'panel-admin') {
      triggerLoader('loadAdminDashboardData');
    }
    if (state.activePanel === 'panel-system') {
      triggerLoader('loadStaffManagementData');
    }
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

export async function syncOfflineData() {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
  if (queue.length === 0) return;

  logEvent('system', `Çevrimdışı kuyruktaki <strong>${queue.length}</strong> işlem senkronize ediliyor...`);
  
  const remainingQueue = [];
  for (const item of queue) {
    try {
      const res = await _origFetch(item.url, {
        method: item.init.method,
        headers: item.init.headers ? new Headers(item.init.headers) : undefined,
        body: item.init.body
      });
      if (!res.ok) {
        remainingQueue.push(item);
      }
    } catch (err) {
      console.error("Senkronizasyon hatası:", err);
      remainingQueue.push(item);
    }
  }

  localStorage.setItem('offline_request_queue', JSON.stringify(remainingQueue));
  
  if (remainingQueue.length === 0) {
    logEvent('system', `Tüm çevrimdışı işlemler başarıyla senkronize edildi! Veriler güncelleniyor.`);
    loadAllData();
  } else {
    logEvent('system', `Senkronizasyon yarım kaldı. Kalan işlem: ${remainingQueue.length}`);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineData);
  setInterval(syncOfflineData, 10000);
}

// Expose to window for plain-script access
window.__aeonState = state;
window.__aeonLoadAllData = loadAllData;

let _sseReconnectTimer = null;

export function initSSE(tenantId) {
  const url = `/api/events?tenant_id=${tenantId}`;
  let es;

  function connect() {
    es = new EventSource(url);

    es.addEventListener('request_created', () => {
      if (loaders['loadStaffSimulatorData']) loaders['loadStaffSimulatorData']();
      if (loaders['loadDiningData']) loaders['loadDiningData']();
      if (loaders['loadAdminDashboardData']) loaders['loadAdminDashboardData']();
    });

    es.addEventListener('request_updated', () => {
      if (loaders['loadStaffSimulatorData']) loaders['loadStaffSimulatorData']();
      if (loaders['loadDiningData']) loaders['loadDiningData']();
      if (loaders['loadAdminDashboardData']) loaders['loadAdminDashboardData']();
    });

    es.addEventListener('room_updated', () => {
      if (loaders['loadStayData']) loaders['loadStayData']();
      if (loaders['loadStaffSimulatorData']) loaders['loadStaffSimulatorData']();
      if (loaders['loadAdminDashboardData']) loaders['loadAdminDashboardData']();
    });

    es.addEventListener('table_updated', () => {
      if (loaders['loadDiningData']) loaders['loadDiningData']();
      if (loaders['loadStaffSimulatorData']) loaders['loadStaffSimulatorData']();
      if (loaders['loadAdminDashboardData']) loaders['loadAdminDashboardData']();
    });

    es.addEventListener('area_updated', () => {
      if (loaders['loadStayData']) loaders['loadStayData']();
      if (loaders['loadAdminDashboardData']) loaders['loadAdminDashboardData']();
    });

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      clearTimeout(_sseReconnectTimer);
      _sseReconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();
}
