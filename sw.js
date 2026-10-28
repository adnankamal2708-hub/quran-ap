// ═══════════════════════════════════════════════════════════════
// sw.js — Bayan Service Worker v4
// Provides offline support with optimized caching strategies:
//   • Cache-first for static assets (instant load)
//   • Stale-while-revalidate for dynamic content
//   • Font caching with dedicated cache
//   • Cache-first for the Firebase SDK (versioned URLs) so sign-in and
//     sync code load offline
//   • Automatic cleanup of stale caches on every release
//   • Offline reader support via aggressive vocabulary caching
// ═══════════════════════════════════════════════════════════════

// build.js sets CACHE_NAME to a hash of every file in dist/, so any change
// to the app produces a new service worker and a fresh cache. The page
// (registerServiceWorker in js/app.js) then offers a reload.
const CACHE_NAME = 'bayan-dev'; // placeholder — replaced in dist/sw.js by build.js
const FONTS_CACHE = 'bayan-fonts-v1';
// Release-scoped so lazily cached app files (e.g. the Quran bundle) are
// dropped with the release that produced them.
const DYNAMIC_CACHE = CACHE_NAME + '-dynamic';
// Firebase SDK URLs embed the SDK version, so entries never go stale.
const FIREBASE_CACHE = 'bayan-firebase-v1';

// Production assets only — individual dev files are NOT cached.
// The build script (build.js) generates these bundles from all source files,
// so new surah data files are automatically included without editing this list.
const PRECACHE_URLS = [
  './',
  './index.html',
  './privacy-policy.html',
  './terms-of-service.html',
  './landing.html',
  './styles.css',
  './styles.min.css',
  './js/data.bundle.min.js',
  './js/app.bundle.min.js',
  './js/services/firebase-core.js',
  './js/services/auth-service.js',
  './js/landing/landing-auth-gate.js',
  './manifest.json',
  './favicon.ico',
  './assets/logo/bayan-logo-transparent-full.png',
  './assets/logo/bayan-icon-emblem-square.png',
  './assets/logo/favicon-16.png',
  './assets/logo/favicon-32.png',
  './assets/logo/apple-touch-icon-180.png',
  './assets/logo/pwa-icon-192-solid.png',
  './assets/logo/pwa-icon-512-solid.png',
  './js/quran/surah-index.min.js',
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
  var cacheWhitelist = [CACHE_NAME, FONTS_CACHE, DYNAMIC_CACHE, FIREBASE_CACHE];
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

// Helper: stale-while-revalidate strategy (dynamic cache first, precache
// second, network last). The precache (CACHE_NAME) holds the install-time
// bundles (app/data/firebase-core), so a freshly installed app that goes
// offline immediately can still load them — checking only the dynamic cache
// used to fail every JS request with ERR_FAILED.
function staleWhileRevalidate(request) {
  return caches.open(DYNAMIC_CACHE).then(function (cache) {
    return cache.match(request).then(function (cachedResponse) {
      if (cachedResponse) {
        // Revalidate in the background
        fetch(request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
        }).catch(function () {});
        return cachedResponse;
      }
      return caches.open(CACHE_NAME).then(function (preCache) {
        return preCache.match(request).then(function (precachedResponse) {
          if (precachedResponse) return precachedResponse;
          return fetch(request).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      });
    });
  });
}

// Fetch: only handle GET requests (avoids cache poisoning from non-GET requests)
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Firebase SDK modules: cache-first. The URLs are version-pinned
  // (firebasejs/<version>/...), so a cached copy is always the right one.
  // Previously these were never cached, so an offline cold start could not
  // load auth/Firestore at all.
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) {
    event.respondWith(
      caches.open(FIREBASE_CACHE).then(function (cache) {
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

  // Any other gstatic resource: network-first with cache fallback
  if (url.hostname === 'www.gstatic.com') {
    event.respondWith(
      fetch(event.request).catch(function () {
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

  // Every other cross-origin request (Firestore, Firebase Auth, the Vercel
  // API) goes straight to the network. Intercepting them used to route
  // Firestore's long-lived listen channel through this worker; a worker
  // with a fetch in flight cannot be replaced, so new releases sat in
  // "waiting" for as long as the app was open. It also risked caching
  // private API responses.
  if (url.origin !== self.location.origin) return;

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

  // JS/JSON data files: stale-while-revalidate for fresh data with offline
  // fallback (dynamic cache -> precache -> network, see helper above)
  if (url.pathname.match(/\.(js|json)$/) && !url.pathname.match(/\/sw\.js$/)) {
    event.respondWith(staleWhileRevalidate(event.request));
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
