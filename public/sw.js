// Durgapur Enterprise POS Service Worker (v1.0)
const CACHE_NAME = 'durgapur-pos-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/public/icon.svg',
  '/public/pwa-192x192.png',
  '/public/pwa-512x512.png',
  '/public/pwa-maskable-512x512.png',
  '/public/apple-touch-icon.png',
  '/public/favicon.ico',
  '/public/manifest.webmanifest',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-First for HTML / navigation requests to guarantee latest version
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(req) || caches.match('/') || caches.match('/index.html');
      })
    );
    return;
  }

  // Stale-While-Revalidate for static assets and CDN fonts/scripts
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

