// CCNA Mastery Pro - Service Worker v3.1
const APP_PREFIX = 'ccna-mastery';
const CACHE_VERSION = 'v3.1';
const CACHE_NAME = `${APP_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_SHELL = '/offline.html';

// Content-specific caching strategies
const CACHE_STRATEGIES = {
  NAVIGATION: 'network-first',
  STATIC: 'cache-first',
  DYNAMIC: 'stale-while-revalidate',
  DATA: 'network-first'
};

// Critical assets to precache
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/app.css',
  '/core/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/ccna-192.png',
  '/assets/audio/click.mp3',
  '/assets/audio/correct.mp3',
  '/assets/audio/incorrect.mp3'
];

const DATA_ENDPOINTS = [
  '/data/questions.json',
  '/data/subnetting.json',
  '/data/labs.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        CORE_ASSETS.map(asset => cache.add(asset).catch(err => {
          console.warn(`[SW] Failed to cache ${asset}:`, err);
          return null;
        }))
      );
      
      // Skip waiting to activate immediately
      self.skipWaiting();
      console.info(`[SW] Successfully installed ${CACHE_NAME} with ${CORE_ASSETS.length} assets`);
    } catch (error) {
      console.error('[SW] Installation failed:', error);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Clean up old caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(APP_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    
    // Claim clients immediately
    await self.clients.claim();
    console.info(`[SW] Activated ${CACHE_VERSION}. Cleaned up ${cacheNames.length - 1} old caches`);
    
    // Post-activation tasks
    self.registration.showNotification('CCNA Mastery Updated', {
      body: 'New questions and labs available!',
      icon: '/icons/ccna-96.png',
      badge: '/icons/badge-96.png',
      silent: true
    });
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and external domains
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }
  
  // Determine caching strategy
  const strategy = getStrategyForUrl(url);
  
  event.respondWith(handleRequestWithStrategy(request, strategy));
});

async function handleRequestWithStrategy(request, strategy) {
  switch (strategy) {
    case CACHE_STRATEGIES.NAVIGATION:
      return handleNavigation(request);
    case CACHE_STRATEGIES.STATIC:
      return handleStatic(request);
    case CACHE_STRATEGIES.DATA:
      return handleData(request);
    case CACHE_STRATEGIES.DYNAMIC:
    default:
      return handleDynamic(request);
  }
}

async function handleNavigation(request) {
  try {
    // Try network first with 3s timeout
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    if (networkResponse) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.debug('[SW] Navigation network fetch failed:', error);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  // Ultimate fallback
  return caches.match(OFFLINE_SHELL) || new Response('Offline', { status: 503 });
}

async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.debug('[SW] Static asset fetch failed:', error);
    return cachedResponse || caches.match(OFFLINE_SHELL);
  }
}

async function handleData(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      // Update last sync timestamp
      const syncTime = new Date().toISOString();
      self.registration.sync.register('background-sync');
    }
    return networkResponse;
  } catch (error) {
    console.debug('[SW] Data fetch failed, using cache:', error);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    
    // Return synthetic response with offline status
    return new Response(JSON.stringify({ 
      offline: true, 
      error: 'Unable to retrieve data while offline' 
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleDynamic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
  }).catch(() => {});
  
  return cachedResponse || fetch(request).catch(() => caches.match(OFFLINE_SHELL));
}

function getStrategyForUrl(url) {
  const pathname = url.pathname;
  
  // Navigation routes
  if (pathname === '/' || pathname.endsWith('.html')) {
    return CACHE_STRATEGIES.NAVIGATION;
  }
  
  // Data endpoints
  if (DATA_ENDPOINTS.some(endpoint => pathname.includes(endpoint))) {
    return CACHE_STRATEGIES.DATA;
  }
  
  // Static assets
  if (/\.(js|css|png|jpg|svg|woff2|mp3|wav)$/i.test(pathname)) {
    return CACHE_STRATEGIES.STATIC;
  }
  
  return CACHE_STRATEGIES.DYNAMIC;
}

// Background sync for progress data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncUserData());
  }
});

async function syncUserData() {
  const userId = await self.registration.pushManager.getSubscription()?.endpoint;
  if (!userId) return;
  
  try {
    const progress = JSON.parse(localStorage.getItem('ccna_progress') || '{}');
    await fetch('/api/sync-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, progress })
    });
    
    // Clear sync flag
    localStorage.setItem('needsSync', 'false');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    // Schedule retry
    setTimeout(() => self.registration.sync.register('background-sync'), 60000);
  }
}

// Push notifications for content updates
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'CCNA Mastery', {
      body: data.body || 'New content available',
      icon: '/icons/ccna-96.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/';
      const existingClient = clientList.find(c => c.url.includes(url));
      
      if (existingClient) {
        existingClient.focus();
      } else {
        clients.openWindow(url);
      }
    })
  );
});

console.log(`[SW] CCNA Mastery Service Worker ${CACHE_VERSION} registered`);
