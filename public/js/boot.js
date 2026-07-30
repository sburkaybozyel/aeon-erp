window.addEventListener('pageshow', event => {
  if (event.persisted) {
    window.location.reload();
  }
});

(function() {
  if (window.__aeon_bootstrapped) return;
  window.__aeon_bootstrapped = true;

  // 1. Tenant Resolution & Validation
  const params = new URLSearchParams(window.location.search);
  let tenantId = params.get('tenant_id');
  if (!tenantId) {
    tenantId = 'aeon';
  }
  if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
    tenantId = 'aeon';
  }
  window.tenantId = tenantId;
  window.aeonSessionToken = localStorage.getItem('aeon_session_token') || '';
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.json';
  document.head.appendChild(manifest);
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#078fd0"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Aeon ERP">');

  const initialPath = window.location.pathname;
  const isLoginPath = /\/login(?:\.html)?$/.test(initialPath);
  const isPublicSurface = isLoginPath || /\/(?:guest|room|restaurant|precheckin)(?:\.html)?$/.test(initialPath);
  const revealPage = () => document.documentElement.classList.remove('aeon-auth-pending');
  const redirectTo = target => {
    if (window.__aeon_redirecting) return false;
    window.__aeon_redirecting = true;
    window.location.replace(target);
    return true;
  };
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-target],[data-view],[data-pms-view],[data-restaurant-tab],[data-kitchen-view]');
    if (!control) return;
    const pmsView = control.dataset.pmsView;
    if (pmsView && document.querySelector('#pms-nav')) {
      document.querySelector(`#pms-nav [data-view="${pmsView}"]`)?.click();
      document.querySelectorAll('[data-pms-view]').forEach(item => item.classList.toggle('active', item.dataset.pmsView === pmsView));
      return;
    }
    const target = control.dataset.target;
    if (target && document.getElementById(target)) {
      event.preventDefault();
      document.querySelectorAll('.nav-item[data-target]').forEach(item => item.classList.toggle('active', item === control));
      document.querySelectorAll('.panel-section').forEach(panel => panel.classList.toggle('active', panel.id === target));
      return;
    }
    const view = control.dataset.view;
    if (view && document.querySelector('.bar-view')) {
      document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
      document.querySelectorAll('.bar-view').forEach(panel => panel.classList.toggle('active', panel.id === `bar-view-${view}`));
      return;
    }
    if (view && document.querySelector('.hk-view')) {
      document.querySelectorAll('.hk-nav [data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
      document.querySelectorAll('.hk-view').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
      return;
    }
    if (view && document.querySelector('.maintenance-view')) {
      document.querySelectorAll('.maintenance-nav [data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
      document.querySelectorAll('.maintenance-view').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
      return;
    }
    const restaurantTab = control.dataset.restaurantTab;
    if (restaurantTab) {
      document.querySelectorAll('[data-restaurant-tab]').forEach(item => item.classList.toggle('active', item.dataset.restaurantTab === restaurantTab));
      document.querySelectorAll('[id^="restaurant-subview-"]').forEach(panel => panel.classList.toggle('active', panel.id === `restaurant-subview-${restaurantTab}`));
      return;
    }
    const kitchenView = control.dataset.kitchenView;
    if (kitchenView) {
      document.querySelectorAll('[data-kitchen-view]').forEach(item => item.classList.toggle('active', item.dataset.kitchenView === kitchenView));
      document.querySelectorAll('[id^="kitchen-subview-"]').forEach(panel => panel.classList.toggle('active', panel.id === `kitchen-subview-${kitchenView}`));
    }
  });
  if (!isPublicSurface) {
    document.documentElement.classList.add('aeon-auth-pending');
    const gateStyle = document.createElement('style');
    gateStyle.textContent = '.aeon-auth-pending body{visibility:hidden}';
    document.head.appendChild(gateStyle);
  }

  let installPrompt = null;
  let pwaRegistration = null;
  function appPanel() {
    if (document.getElementById('aeon-app-panel')) return;
    const style = document.createElement('style');
    style.textContent = '.aeon-app-launcher{position:fixed;right:16px;bottom:88px;z-index:9999;border:0;border-radius:999px;padding:12px 16px;background:#078fd0;color:#fff;font:600 14px system-ui;box-shadow:0 8px 24px rgba(7,143,208,.28)}.aeon-app-panel{position:fixed;right:16px;bottom:140px;z-index:10000;width:min(320px,calc(100vw - 32px));padding:18px;border:1px solid #d8e7f2;border-radius:18px;background:#fff;box-shadow:0 16px 42px rgba(15,37,60,.22);font:14px system-ui;color:#18324b}.aeon-app-panel[hidden]{display:none}.aeon-app-panel h2{margin:0 0 6px;font-size:18px}.aeon-app-panel p{margin:0 0 14px;color:#667f97;line-height:1.45}.aeon-app-panel button{width:100%;margin-top:8px;padding:11px 12px;border-radius:10px;border:1px solid #cbdce9;background:#fff;color:#18324b;font:600 14px system-ui}.aeon-app-panel button.primary{background:#078fd0;color:#fff;border-color:#078fd0}@media(min-width:621px){.aeon-app-launcher{bottom:16px}.aeon-app-panel{bottom:68px}}';
    document.head.appendChild(style);
    const launcher = document.createElement('button');
    launcher.className = 'aeon-app-launcher';
    launcher.type = 'button';
    launcher.textContent = 'Uygulama';
    const panel = document.createElement('section');
    panel.id = 'aeon-app-panel';
    panel.className = 'aeon-app-panel';
    panel.hidden = true;
    panel.innerHTML = '<h2>Aeon ERP</h2><p>Tüm portal ve departmanlardan işlem bildirimlerini bu cihazda alın.</p><button type="button" data-app-install class="primary">Uygulamayı Yükle</button><button type="button" data-app-notifications>Bildirimleri Aç</button>';
    launcher.addEventListener('click', () => { panel.hidden = !panel.hidden; });
    panel.querySelector('[data-app-install]').addEventListener('click', installApp);
    panel.querySelector('[data-app-notifications]').addEventListener('click', enableNotifications);
    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.textContent = 'Bildirim Testi Gönder';
    testButton.addEventListener('click', async () => {
      try {
        const response = await window.fetch('/api/push/test', { method: 'POST' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Bildirim testi gönderilemedi.');
        window.alert('Test bildirimi gönderildi. Bildirim ekranınıza düşmelidir.');
      } catch (error) {
        window.alert(error.message);
      }
    });
    panel.appendChild(testButton);
    document.body.append(launcher, panel);
  }
  async function installApp() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    window.alert(ios ? 'Safari paylaş menüsünden Ana Ekrana Ekle seçeneğini kullanın.' : 'Tarayıcınızın menüsünden Uygulamayı yükle veya Ana ekrana ekle seçeneğini kullanın.');
  }
  async function enableNotifications(silent) {
    try {
      if (!pwaRegistration || !('PushManager' in window) || !('Notification' in window)) { if (!silent) window.alert('Bu tarayıcı bildirimleri desteklemiyor.'); return; }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { if (!silent) window.alert('Bildirim izni verilmedi.'); return; }
      const keyResponse = await window.fetch('/api/push/public-key');
      const keyData = await keyResponse.json().catch(() => ({}));
      if (!keyData.publicKey) { if (!silent) window.alert('Bildirim altyapısı henüz hazır değil.'); return; }
      const bytes = Uint8Array.from(atob(keyData.publicKey.replace(/-/g, '+').replace(/_/g, '/')), value => value.charCodeAt(0));
      let subscription = await pwaRegistration.pushManager.getSubscription();
      const registeredKey = subscription?.options?.applicationServerKey ? new Uint8Array(subscription.options.applicationServerKey) : null;
      const keyMatches = registeredKey && registeredKey.length === bytes.length && registeredKey.every((value, index) => value === bytes[index]);
      if (subscription && !keyMatches) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription = subscription || await pwaRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const response = await window.fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription }) });
      if (!response.ok) throw new Error('Bildirim kaydı yapılamadı.');
      if (!silent) window.alert('Bildirimler bu cihaz için açıldı.');
    } catch (error) { if (!silent) window.alert(`Bildirimler açılamadı: ${error.message}`); }
  }
  window.aeonEnableNotifications = enableNotifications;
  async function setupMobileApp() {
    if (isPublicSurface || !('serviceWorker' in navigator) || !('Notification' in window) || !window.isSecureContext) return;
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      pwaRegistration = await navigator.serviceWorker.ready;
    } catch (error) { return; }
    if (Notification.permission === 'granted') enableNotifications(true);
    appPanel();
    if (Notification.permission === 'default') {
      const panel = document.getElementById('aeon-app-panel');
      if (panel) panel.hidden = false;
    }
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; appPanel(); });
  }

  // Cross-tab logout listener
  window.addEventListener('storage', (event) => {
    if (event.key === 'aeon_auth_event') {
      if (!isLoginPath) {
        redirectTo(`/login.html?tenant_id=${window.tenantId}`);
      }
    }
  });

  // Double-submit guard: disable the submitting button for the duration of any in-flight
  // mutation so a fast double-click/double-tap produces one fetch() call, not two. This is the
  // primary defense against duplicate check-ins/payments/orders/tasks — an Idempotency-Key header
  // only protects a *retry* of the same request; it cannot correlate two independently-fired
  // clicks, each of which gets its own key. A single guard here covers every department screen
  // since they all load boot.js, instead of patching each entry file's submit handlers.
  let pendingMutations = 0;
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const button = event.submitter || form.querySelector('button[type="submit"]');
    if (button && !button.disabled) {
      button.disabled = true;
      button.dataset.aeonLock = '1';
      // Safety net: if a handler never triggers a fetch (e.g. client-side validation stops it
      // before calling the API), don't leave the button stuck disabled forever.
      setTimeout(() => { if (button.dataset.aeonLock === '1' && pendingMutations === 0) { button.disabled = false; delete button.dataset.aeonLock; } }, 4000);
    }
  }, true);
  function releaseLockedButtons() {
    document.querySelectorAll('[data-aeon-lock="1"]').forEach(button => { button.disabled = false; delete button.dataset.aeonLock; });
  }

  // Fetch interceptor
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url.startsWith('/api/')) {
      const sep = url.includes('?') ? '&' : '?';
      if (!url.includes('tenant_id=')) {
        url = `${url}${sep}tenant_id=${window.tenantId}`;
      }

      const request = init ? { ...init } : {};
      request.credentials = 'same-origin'; // Shift to cookie-only

      const headers = new Headers(request.headers || {});
      if (window.aeonSessionToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${window.aeonSessionToken}`);
      }
      const method = (request.method || 'GET').toUpperCase();
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      if (isMutation && !headers.has('Idempotency-Key')) {
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        headers.set('Idempotency-Key', uuid);
      }

      request.headers = headers;
      if (isMutation) pendingMutations += 1;

      try {
        const response = await originalFetch(url, request);
        if (response.status === 401 && !isPublicSurface) {
          localStorage.setItem('aeon_auth_event', Date.now().toString());
          redirectTo(`/login.html?tenant_id=${window.tenantId}`);
        }
        return response;
      } catch (err) {
        throw err;
      } finally {
        if (isMutation) {
          pendingMutations = Math.max(0, pendingMutations - 1);
          if (pendingMutations === 0) releaseLockedButtons();
        }
      }
    }
    return originalFetch(input, init);
  };

  // Helper to logout
  window.aeonLogout = async function() {
    try {
      await window.fetch(`/api/auth/logout?tenant_id=${window.tenantId}`, {
        method: 'POST'
      });
    } catch (e) {
      console.warn("Logout request failed:", e);
    } finally {
      localStorage.removeItem('aeon_session_token');
      window.aeonSessionToken = '';
      localStorage.setItem('aeon_auth_event', Date.now().toString());
      if (!isLoginPath) {
        redirectTo(`/login.html?tenant_id=${window.tenantId}`);
      }
    }
  };

  // Centralized Boot & Auth Hydration logic
  let bootPromise = null;
  window.aeonBoot = function() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      // 1. Branding Resolution
      try {
        const brandRes = await originalFetch(`/api/tenant/branding?tenant_id=${window.tenantId}`, { cache: 'no-store' });
        if (brandRes.ok) {
          const branding = await brandRes.json();
          document.querySelectorAll('.logo-brand-path, #login-logo, #onboarding-logo, img[alt="Logo"]').forEach(el => {
            el.src = branding.logo;
          });
          document.querySelectorAll('.brand-title, #login-brand-name, #current-tenant-label').forEach(el => {
            el.textContent = branding.name;
          });
          const headerTitle = document.querySelector('.mobile-header .mobile-title');
          if (headerTitle) {
            headerTitle.innerHTML = `<img src="${branding.logo}" alt="logo" style="height:22px; width:22px; border-radius:50%; object-fit:cover; border:1px solid rgba(212,175,55,0.4); margin-right:8px;"> ${branding.name.toUpperCase()}`;
          }
          document.title = `${branding.name} | ERP`;
        }
      } catch (e) {
        console.warn("Could not load branding", e);
      }

      // 2. Auth checks
      const isLoginPage = isLoginPath;
      const isPublicPage = isPublicSurface;

      try {
        const sessionHeaders = new Headers();
        if (window.aeonSessionToken) {
          sessionHeaders.set('Authorization', `Bearer ${window.aeonSessionToken}`);
        }
        const res = await originalFetch(`/api/auth/session?tenant_id=${window.tenantId}`, {
          credentials: 'same-origin',
          headers: sessionHeaders,
          cache: 'no-store'
        });

        if (!res.ok) {
          if (!isPublicPage) redirectTo(`/login.html?tenant_id=${window.tenantId}`);
          else revealPage();
          return null;
        }
        
        const data = await res.json();
        window.aeonUser = data.user;
        if (window.aeonState) {
          window.aeonState.activeStaff = data.user;
        }

        if (isPublicPage && !isLoginPage) {
          revealPage();
          return data.user;
        }

        // Role redirect logic
        const role = String(data.user?.role || '').toLowerCase();
        
        function getPortalForRole(r) {
          const roleLower = String(r || '').toLowerCase();
          if (['admin', 'manager', 'yönetici'].includes(roleLower)) {
            return '/index.html';
          } else if (roleLower === 'reception') {
            return '/staff-reception.html';
          } else if (roleLower === 'housekeeping') {
            return '/staff-housekeeping.html';
          } else if (['restaurant', 'waiter'].includes(roleLower)) {
            return '/staff-restaurant.html';
          } else if (['bar', 'barmen', 'bartender'].includes(roleLower)) {
            return '/staff-bar.html';
          } else if (['kitchen', 'chef'].includes(roleLower)) {
            return '/staff-kitchen.html';
          } else if (['maintenance', 'technical'].includes(roleLower)) {
            return '/staff-maintenance.html';
          }
          return null; // Unknown role
        }

        const targetPortal = getPortalForRole(role);
        const path = window.location.pathname;

        if (isLoginPage) {
          if (targetPortal) {
            const inbox = params.get('inbox') === 'orders' ? '&inbox=orders' : '';
            redirectTo(`${targetPortal}?tenant_id=${window.tenantId}${inbox}`);
          } else {
            alert("Yetkisiz rol veya erişim engellendi!");
            window.aeonLogout();
          }
          return data.user;
        } else {
          {
            const isMgrPage = path === '/' || /\/index(?:\.html)?$/.test(path);
            const isReceptionPage = /\/staff-reception(?:\.html)?$/.test(path);
            const isHkPage = /\/staff-housekeeping(?:\.html)?$/.test(path);
            const isRestaurantPage = /\/staff-restaurant(?:\.html)?$/.test(path);
            const isBarPage = /\/staff-bar(?:\.html)?$/.test(path);
            const isKitchenPage = /\/staff-kitchen(?:\.html)?$/.test(path);
            const isMaintenancePage = /\/staff-maintenance(?:\.html)?$/.test(path);
            const isChannelManagerPage = /\/channel-manager(?:\.html)?$/.test(path);
            
            let isCorrectPage = false;
            if (isMgrPage && ['admin', 'manager', 'yönetici'].includes(role)) isCorrectPage = true;
            else if (isReceptionPage && ['reception', 'admin', 'manager', 'yönetici'].includes(role)) isCorrectPage = true;
            else if (isHkPage && role === 'housekeeping') isCorrectPage = true;
            else if (isRestaurantPage && ['restaurant', 'waiter', 'admin', 'manager', 'yönetici'].includes(role)) isCorrectPage = true;
            else if (isBarPage && ['bar', 'barmen', 'bartender', 'admin', 'manager', 'yönetici'].includes(role)) isCorrectPage = true;
            else if (isKitchenPage && ['kitchen', 'chef'].includes(role)) isCorrectPage = true;
            else if (isMaintenancePage && ['maintenance', 'technical'].includes(role)) isCorrectPage = true;
            else if (isChannelManagerPage && ['reception', 'admin', 'manager', 'yönetici'].includes(role)) isCorrectPage = true;
            
            if (!isCorrectPage) {
              if (targetPortal) {
                redirectTo(`${targetPortal}?tenant_id=${window.tenantId}`);
                return null;
              } else {
                alert("Oturum yetkisiz!");
                window.aeonLogout();
                return null;
              }
            }
          }
        }
        revealPage();
        setupMobileApp();
        if (!/\/staff-restaurant(?:\.html)?$/.test(window.location.pathname) && !['admin', 'manager', 'yönetici'].includes(role) && !window.__aeonOperationsInboxLoading) {
          window.__aeonOperationsInboxLoading = true;
          import('/js/operations-inbox.js?v=20260729-request-flow').then(module => module.mountOperationsInbox({ tenantId: window.tenantId })).catch(() => {});
        }
        return data.user;
      } catch (e) {
        if (!isPublicPage) redirectTo(`/login.html?tenant_id=${window.tenantId}`);
        else revealPage();
        return null;
      }
    })();
    return bootPromise;
  };

  // Run automatically if script loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.aeonBoot());
  } else {
    window.aeonBoot();
  }
})();
