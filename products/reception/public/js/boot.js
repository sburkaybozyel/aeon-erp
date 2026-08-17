(function() {
  if (window.__aeon_bootstrapped) return;
  window.__aeon_bootstrapped = true;
  const moduleTenant = 'reception';

  // 1. Tenant Resolution & Validation
  const params = new URLSearchParams(window.location.search);
  let tenantId = params.get('tenant_id');
  if (!tenantId) {
    tenantId = moduleTenant;
  }
  if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
    tenantId = moduleTenant;
  }
  window.tenantId = tenantId;
  const publicPortalPaths = new Set(['/guest', '/guest/', '/guest.html', '/room', '/room/', '/room.html', '/room-portal', '/room-portal/', '/room-portal.html', '/restaurant', '/restaurant/', '/restaurant.html', '/menu', '/menu/', '/menu.html', '/restaurant-menu', '/restaurant-menu/']);
  const isPublicPortalPath = (path = window.location.pathname) => publicPortalPaths.has(path);
  const isGuestSurface = isPublicPortalPath();
  window.aeonSessionToken = isGuestSurface ? '' : (window.aeonSessionToken || '');

  function revealPage() {
    document.documentElement.removeAttribute('data-auth-pending');
    document.body?.removeAttribute('data-auth-pending');
  }

  // Cross-tab logout listener
  window.addEventListener('storage', (event) => {
    if (event.key === 'aeon_auth_event') {
      if (!window.location.pathname.includes('login.html') && !isPublicPortalPath()) {
        window.location.replace(`/login.html?tenant_id=${window.tenantId}`);
      }
    }
  });

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
      request.credentials = isGuestSurface ? 'omit' : 'same-origin';
      
      const headers = new Headers(request.headers || {});
      const method = (request.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('Idempotency-Key')) {
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        headers.set('Idempotency-Key', uuid);
      }
      
      request.headers = headers;
      
      try {
        const response = await originalFetch(url, request);
        if (response.status === 401 && !window.location.pathname.includes('login.html') && !isPublicPortalPath()) {
          localStorage.setItem('aeon_auth_event', Date.now().toString());
          window.location.replace(`/login.html?tenant_id=${window.tenantId}`);
        }
        return response;
      } catch (err) {
        throw err;
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
      localStorage.setItem('aeon_auth_event', Date.now().toString());
      if (!window.location.pathname.includes('login.html')) {
        window.location.replace(`/login.html?tenant_id=${window.tenantId}`);
      }
    }
  };

  // Centralized Boot & Auth Hydration logic
  let bootPromise = null;
  window.aeonBoot = function() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      if (isGuestSurface) {
        revealPage();
        return null;
      }
      // 1. Branding Resolution
      try {
        const brandRes = await originalFetch(`/api/tenant/branding?tenant_id=${window.tenantId}`);
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
      const isLoginPage = window.location.pathname.includes('login.html');
      const isPublicPage = isLoginPage || isPublicPortalPath();

      try {
        const res = await originalFetch(`/api/auth/session?tenant_id=${window.tenantId}`, {
          credentials: 'same-origin'
        });
        
        if (!res.ok) {
          if (!isPublicPage) {
            window.location.replace(`/login.html?tenant_id=${window.tenantId}`);
          }
          return null;
        }
        
        const data = await res.json();
        window.aeonUser = data.user;
        if (window.aeonState) {
          window.aeonState.activeStaff = data.user;
        }
        if (isPublicPage && !isLoginPage) return data.user;

        // Role redirect logic
        const role = String(data.user?.role || '').toLowerCase();
        
        function getPortalForRole(r) {
          const roleLower = String(r || '').toLowerCase();
          if (['admin', 'manager', 'yönetici', 'restoran müdürü'].includes(roleLower)) {
            return '/admin.html';
          } else if (['reception', 'resepsiyon'].includes(roleLower)) {
            return '/staff-reception.html';
          } else if (['maintenance', 'technical'].includes(roleLower)) {
            return null;
          }
          return null; // Unknown role
        }

        const targetPortal = getPortalForRole(role);
        const path = window.location.pathname;
        const isLoginPage = path.includes('login.html');
        
        if (isLoginPage) {
          if (targetPortal) {
            window.location.replace(`${targetPortal}?tenant_id=${window.tenantId}`);
          } else {
            alert("Yetkisiz rol veya erişim engellendi!");
            window.aeonLogout();
          }
        } else {
          if (path.includes('staff.html') || path.includes('admin_mobile.html')) {
            if (targetPortal) {
              window.location.replace(`${targetPortal}?tenant_id=${window.tenantId}`);
            } else {
              alert("Yetkisiz rol!");
              window.aeonLogout();
            }
          } else {
            const isReceptionPage = path.includes('staff-reception.html');
            const isAdminPage = path.includes('admin.html');
            
            let isCorrectPage = false;
            if (isReceptionPage && ['admin', 'manager', 'yönetici', 'restoran müdürü', 'reception'].includes(role)) isCorrectPage = true;
            if (isAdminPage && ['admin', 'manager', 'yönetici', 'restoran müdürü'].includes(role)) isCorrectPage = true;
            
            if (!isCorrectPage) {
              if (targetPortal) {
                window.location.replace(`${targetPortal}?tenant_id=${window.tenantId}`);
              } else {
                alert("Oturum yetkisiz!");
                window.aeonLogout();
              }
            }
          }
        }
        return data.user;
      } catch (e) {
        if (!isPublicPage) {
          window.location.replace(`/login.html?tenant_id=${window.tenantId}`);
        }
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
