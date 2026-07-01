// ═══════════════════════════════════════════════════════════════
// sw.js — Service Worker v4
// Provides offline support with optimized caching strategies:
//   • Cache-first for static assets (instant load)
//   • Stale-while-revalidate for Firebase API calls
//   • Font caching with dedicated cache
//   • Automatic cleanup of stale caches
//   • Periodic cache refresh for versioned assets
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'quran-vocab-v4';
const FONTS_CACHE = 'quran-fonts-v1';

// Production assets only — individual dev files are NOT cached.
// The build script (build.js) generates these bundles from all source files,
// so new surah data files are automatically included without editing this list.
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './js/data.bundle.min.js',
  './js/app.bundle.min.js',
  './js/services/firebase-core.js',
  './manifest.json',
  './favicon.ico',
];

// Install: pre-cache all static assets
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function (event) {
  var cacheWhitelist = [CACHE_NAME, FONTS_CACHE];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return cacheWhitelist.indexOf(name) === -1;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: optimized caching strategy
self.addEventListener('fetch', function (event) {
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

  // Static assets: cache-first, falling back to network
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
            !event.request.url.includes('chrome-extension')
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
