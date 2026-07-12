// ═══════════════════════════════════════════════════════════════
// sw.js — Bayan Service Worker v4
// Provides offline support with optimized caching strategies:
//   • Cache-first for static assets (instant load)
//   • Stale-while-revalidate for dynamic content
//   • Font caching with dedicated cache
//   • Network-first for Firebase CDN (with cache fallback)
//   • Automatic cleanup of stale caches
//   • Periodic cache refresh for versioned assets
//   • Offline reader support via aggressive vocabulary caching
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'bayan-v4';
const FONTS_CACHE = 'bayan-fonts-v1';
const DYNAMIC_CACHE = 'bayan-dynamic-v1';

// Production assets only — individual dev files are NOT cached.
// The build script (build.js) generates these bundles from all source files,
// so new surah data files are automatically included without editing this list.
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.min.css',
  './js/data.bundle.min.js',
  './js/app.bundle.min.js',
  './js/services/firebase-core.js',
  './js/ux-polish.js',
  './manifest.json',
  './favicon.ico',
];

// Install: pre-cache all static assets, then skip waiting to activate immediately
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches and take control of all open clients immediately
self.addEventListener('activate', function (event) {
  var cacheWhitelist = [CACHE_NAME, FONTS_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return cacheWhitelist.indexOf(name) === -1;
          })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Helper: stale-while-revalidate strategy
function staleWhileRevalidate(request, cacheName) {
  cacheName = cacheName || DYNAMIC_CACHE;
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cachedResponse) {
      var fetchPromise = fetch(request).then(function (networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(function () {
        return cachedResponse;
      });
      return cachedResponse || fetchPromise;
    });
  });
}

// Fetch: only handle GET requests (avoids cache poisoning from non-GET requests)
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Firebase CDN scripts: network-first with cache fallback (for module scripts)
  if (url.hostname === 'www.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          return response;
        })
        .catch(function () {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Fonts: cache-first with dedicated font cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (response) {
          if (response) return response;
          return fetch(event.request).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // App image/icon assets: cache-first with dynamic cache fallback
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // JS/JSON data files: stale-while-revalidate for fresh data with offline fallback
  if (url.pathname.match(/\.(js|json)$/) && !url.pathname.match(/\/sw\.js$/)) {
    event.respondWith(staleWhileRevalidate(event.request, DYNAMIC_CACHE));
    return;
  }

  // CSS files: cache-first with periodic revalidation
  if (url.pathname.match(/\.css$/)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            // Revalidate in background
            fetch(event.request).then(function (networkResponse) {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
            }).catch(function () {});
            return cachedResponse;
          }
          return fetch(event.request).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Static assets: cache-first, falling back to network (primary strategy)
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(function (networkResponse) {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !event.request.url.includes('chrome-extension') &&
            event.request.method === 'GET'
          ) {
            var responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
          }
          return networkResponse;
        });
      });
    })
  );
});
