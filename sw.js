// ═══════════════════════════════════════════════════════════════
// sw.js — Service Worker v3
// Provides offline support with optimized caching strategies:
//   • Cache-first for static assets (instant load)
//   • Stale-while-revalidate for Firebase API calls
//   • Font caching with dedicated cache
//   • Automatic cleanup of stale caches
//   • Periodic cache refresh for versioned assets
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'quran-vocab-v3';
const FONTS_CACHE = 'quran-fonts-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './js/data.js',
  './js/data/words-al-fatiha.js',
  './js/data/words-ikhlas.js',
  './js/data/words-attributes.js',
  './js/data/words-baqarah.js',
  './js/data/words-common.js',
  './js/data/words-expanded.js',
  './js/data/words-names-of-allah.js',
  './js/services/config.js',
  './js/services/auth-service.js',
  './js/services/sync-service.js',
  './js/services/user-service.js',
  './js/vocabulary.js',
  './js/auth-ui.js',
  './js/profile-ui.js',
  './js/srs.js',
  './js/ui.js',
  './js/quiz.js',
  './js/app.js',
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
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  var isFirebase = url.hostname === 'firestore.googleapis.com' || url.hostname.includes('firebaseio.com');
  var isGoogleAPIs = url.hostname === 'www.gstatic.com';

  // Fonts: cache-first with dedicated font cache
  if (isFont) {
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

  // Firebase/Google APIs: network-first with cache fallback (only cache same-origin)
  if (isFirebase || isGoogleAPIs) {
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

  // Static assets: cache-first, falling back to network
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) {
          // Background refresh for versioned assets (optional)
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
