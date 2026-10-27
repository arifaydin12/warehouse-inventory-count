// Service worker: offline support for the static app.
//
// All URLs are relative to the worker's scope, so it works at "/" and at
// "/warehouse-inventory-count/" (GitHub Pages) without changes.
//
// Strategy: precache the app shell on install; network-first for same-origin requests
// (always fresh when online) with the cache as offline fallback; vendored libraries are cache-first.

const VERSION = '4.0.0';
const CACHE = `wic-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/main.js',
  'js/app.js',
  'js/i18n.js',
  'js/locales/en.js',
  'js/locales/de.js',
  'js/locales/pl.js',
  'js/core/actions.js',
  'js/core/auth.js',
  'js/core/seed.js',
  'js/core/storage.js',
  'js/core/store.js',
  'js/domain/barcode.js',
  'js/domain/categories.js',
  'js/domain/csv.js',
  'js/domain/discrepancy.js',
  'js/domain/permissions.js',
  'js/domain/validation.js',
  'js/domain/workflow.js',
  'js/services/camera.js',
  'js/services/pdf.js',
  'js/services/sound.js',
  'js/ui/charts.js',
  'js/ui/components.js',
  'js/ui/controls.js',
  'js/ui/dom.js',
  'js/ui/format.js',
  'js/ui/icons.js',
  'js/ui/table.js',
  'js/ui/views/audit.js',
  'js/ui/views/dashboard.js',
  'js/ui/views/login.js',
  'js/ui/views/products.js',
  'js/ui/views/sessionDetail.js',
  'js/ui/views/sessions.js',
  'js/ui/views/users.js',
  'js/ui/views/warehouses.js',
  'vendor/pdfmake/pdfmake.min.js',
  'vendor/pdfmake/vfs_fonts.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('wic-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match(new URL('index.html', self.registration.scope).href);
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/vendor/')) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});
