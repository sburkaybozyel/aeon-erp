const CACHE_NAME = 'aeon-erp-static-20260729-v10';
const ASSETS = [
  '/css/aeon-tokens.css',
  '/css/aeon-base.css',
  '/css/aeon-shell.css',
  '/css/aeon-components.css',
  '/css/aeon-responsive.css',
  '/brands/aeon/logo.png',
  '/brands/aeon/icon-180.png',
  '/brands/aeon/icon-192.png',
  '/brands/aeon/icon-512.png',
  '/brands/aeon/favicon-32.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim()) // Force all clients to be controlled by the new service worker
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept HTTP/HTTPS schemes, ignore chrome-extension or other protocols
  if (e.request.url.startsWith('http')) {
    // Navigations (the standalone app's document itself) and the boot script must never
    // be served from the HTTP cache — a stale login.html/boot.js is what silently
    // reintroduces "already logged in but still asked for PIN" once fixed server-side.
    const bypassCache = e.request.mode === 'navigate' || e.request.url.includes('/js/boot.js');
    e.respondWith(
      fetch(bypassCache ? new Request(e.request, { cache: 'no-store' }) : e.request).catch(() => {
        return caches.match(e.request);
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: 'Yeni Bildirim', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Aeon ERP';
  const options = {
    body: payload.body || 'Yeni işlem var.',
    icon: '/brands/aeon/icon-192.png',
    badge: '/brands/aeon/icon-192.png',
    tag: payload.tag || 'aeon-erp',
    data: {
      url: payload.url || '/login.html?tenant_id=aeon'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/login.html?tenant_id=aeon';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
