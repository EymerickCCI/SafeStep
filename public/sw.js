const CACHE_NAME = 'safestep-v1';
const STATIC_ASSETS = [
  '/SafeStep/public/',
  '/SafeStep/public/index.html',
  '/SafeStep/public/css/style.css',
  '/SafeStep/public/js/app.js',
  '/SafeStep/public/js/db.js',
  'https://unpkg.com/dexie@3/dist/dexie.js',
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache-first pour assets, network-first pour l'API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes API → network-first (pas de cache)
  if (url.pathname.startsWith('/SafeStep/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Assets statiques → cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
