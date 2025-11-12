const CACHE = 'ccna-trainer-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/data.json'
];

// --- INSTALL ---
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// --- ACTIVATE (Cleanup) ---
self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete old caches that don't match the current CACHE name
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  // Ensure control is claimed by the current service worker immediately
  self.clients.claim();
});

// --- FETCH (Improved Strategy) ---
self.addEventListener('fetch', e => {
  const req = e.request;

  // 1. Network-first strategy for dynamic data (/data.json)
  if (req.url.endsWith('/data.json')) {
    e.respondWith(
      fetch(req)
        .then(response => {
          // Update the cache with the fresh response
          return caches.open(CACHE).then(cache => {
            cache.put(req, response.clone());
            return response;
          });
        })
        .catch(() => {
          // If network fails, return the cached version
          return caches.match(req);
        })
    );
    return;
  }

  // 2. Cache-first strategy for static assets (HTML, CSS, JS, etc.)
  e.respondWith(
    caches.match(req)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) return cachedResponse;

        // Otherwise, fetch from the network
        return fetch(req).catch(() => {
          // Optional: If fetch fails, check cache again (useful for navigations)
          // For example, if a specific page or resource wasn't precached.
          return caches.match('/'); 
        });
      })
  );
});
