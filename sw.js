// ═══════════════════════════════════════════════════════════════
// sw.js — Service Worker
// Provides offline support with cache-first strategy for static assets
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'quran-vocab-v2';

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
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first, falling back to network
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function (networkResponse) {
        // Cache successful same-origin responses
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          !event.request.url.includes('chrome-extension')
        ) {
          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
