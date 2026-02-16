// Service Worker for Poki2 - Caching and Offline Support
// Bump these values to force a fresh Service Worker install on deploy
const CACHE_NAME = 'poki2-v20260216n';
const STATIC_CACHE = 'poki2-static-v20260216n';
const DYNAMIC_CACHE = 'poki2-dynamic-v20260216n';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/js/app.bundle.js',
  '/js/webp-detect.js',
  '/js/consent.js',
  '/js/fix-root-href.js',
  '/favicon.png',
  '/favicon.webp',
  '/manifest.json',
  '/sw.js'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/games.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service Worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method !== 'GET') return;

  // API requests - Network first, cache fallback
  if (API_ENDPOINTS.some(endpoint => url.pathname === endpoint)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache first, network fallback
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Game iframes - Network only (don't cache games)
  if (url.pathname.includes('/games/') || url.hostname !== location.hostname) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML pages - Network first, cache fallback, offline page
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const cache = caches.open(DYNAMIC_CACHE);
            cache.then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Try cache first
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              // Return offline page for HTML requests
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // Other requests - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first failed:', error);
    // Return offline fallback for HTML pages
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Network-first strategy for API calls
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync implementation
async function doBackgroundSync() {
  // Implement any offline actions that need to be synced
  console.log('[SW] Performing background sync');
  // This could include sending analytics, saving user preferences, etc.
}

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);

  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Poki2', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});