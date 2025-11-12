const CACHE_NAME = 'ccna-mastery-pro-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/ccna-mastery-pro.html',
  '/app.css',
  '/app.js',
  '/data.json',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// Install service worker and cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch handler with network-first strategy
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (event.request.url.startsWith('http') && 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // For data.json, use network-first with cache fallback
  if (event.request.url.includes('data.json')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // For other resources, use cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
