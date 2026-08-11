const CACHE_NAME = 'aeon-erp-static-20260719-v1';
const ASSETS = [
  '/css/aeon-tokens.css',
  '/css/aeon-base.css',
  '/css/aeon-shell.css',
  '/css/aeon-components.css',
  '/css/aeon-responsive.css',
  '/brands/aeon/logo.svg'
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
    e.respondWith(
      fetch(e.request).catch(() => {
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

  const title = payload.title || 'AEON ERP';
  const options = {
    body: payload.body || 'Yeni işlem var.',
    icon: '/brands/aeon/logo.svg',
    badge: '/brands/aeon/logo.svg',
    tag: payload.tag || 'aeon-erp',
    data: {
      url: payload.url || '/staff.html?tenant_id=aeon'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/staff.html?tenant_id=aeon';
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
