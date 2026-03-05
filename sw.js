/* ============================================================
   Poki2 Service Worker — Cache-First static, Network-First games.json
   Version: v2
   ============================================================ */

const CACHE_NAME = 'poki2-v3';
const STATIC_EXTS = /\.(css|js|png|webp|ico|svg|woff2?|ttf|eot|otf|gif|jpg|jpeg)(\?.*)?$/i;

/* ---- Install: pre-cache shell ---- */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/', '/index.html', '/css/style.css', '/js/app.js', '/manifest.json'])
        .catch(() => { /* non-fatal: versioned filenames may differ */ })
    )
  );
});

/* ---- Activate: purge old caches ---- */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

/* ---- Fetch strategy ---- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return; // skip cross-origin (game iframes)

  const path = new URL(req.url).pathname;

  /* Network-first for games.json — always want fresh data */
  if (path.endsWith('/games.json')) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  /* Cache-first for static assets (hashed filenames, images, fonts, CSS/JS) */
  if (STATIC_EXTS.test(path) || path.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok && res.status < 300) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  /* Stale-while-revalidate for HTML pages (fast open, refresh in background) */
  if (path.endsWith('.html') || path === '/' || !path.includes('.')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req).then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
