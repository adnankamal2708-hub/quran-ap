#!/usr/bin/env node
/**
 * service-worker.test.js — sw.js caching behaviour
 *
 * Runs the real sw.js in a vm sandbox with in-memory Cache Storage and a
 * mock fetch, then drives its install/activate/fetch handlers.
 *
 * Covers the release-update guarantees:
 *   - activate deletes caches from previous releases, including the
 *     release-scoped dynamic cache, but keeps fonts + Firebase SDK caches
 *   - the Firebase SDK is cached on first load and served offline
 *
 * Run: node test/service-worker.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var passed = 0;
var failed = 0;

async function t(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + ': ' + (e && e.message ? e.message : e).split('\n')[0]);
  }
}

// ── In-memory Cache Storage ─────────────────────────────────
function makeCacheStorage() {
  var stores = {};
  function keyOf(req) { return typeof req === 'string' ? req : req.url; }
  function open(name) {
    if (!stores[name]) {
      var entries = {};
      stores[name] = {
        _entries: entries,
        match: function (req) { return Promise.resolve(entries[keyOf(req)]); },
        put: function (req, res) { entries[keyOf(req)] = res; return Promise.resolve(); },
        addAll: function (urls) {
          urls.forEach(function (u) { entries[u] = { status: 200, body: 'precached ' + u, clone: function () { return this; } }; });
          return Promise.resolve();
        },
      };
    }
    return Promise.resolve(stores[name]);
  }
  return {
    _stores: stores,
    open: open,
    keys: function () { return Promise.resolve(Object.keys(stores)); },
    delete: function (name) { var had = !!stores[name]; delete stores[name]; return Promise.resolve(had); },
    match: function (req) {
      var names = Object.keys(stores);
      for (var i = 0; i < names.length; i++) {
        var hit = stores[names[i]]._entries[keyOf(req)];
        if (hit) return Promise.resolve(hit);
      }
      return Promise.resolve(undefined);
    },
  };
}

function okResponse(body) {
  return { status: 200, body: body, clone: function () { return this; } };
}

/** Load sw.js; returns its event handlers plus the sandbox hooks. */
function loadSW(opts) {
  opts = opts || {};
  var handlers = {};
  var cacheStorage = opts.caches || makeCacheStorage();
  var fetchLog = [];
  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    URL: URL,
    caches: cacheStorage,
    fetch: function (req) {
      var url = typeof req === 'string' ? req : req.url;
      fetchLog.push(url);
      if (opts.offline) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(okResponse('network ' + url));
    },
    self: {
      location: new URL('https://app.example/sw.js'),
      addEventListener: function (type, fn) { handlers[type] = fn; },
      skipWaiting: function () { return Promise.resolve(); },
      clients: { claim: function () { return Promise.resolve(); } },
    },
  };
  var src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  if (opts.cacheName) src = src.replace(/CACHE_NAME = '[^']*'/, "CACHE_NAME = '" + opts.cacheName + "'");
  vm.runInNewContext(src, sandbox);
  return { handlers: handlers, caches: cacheStorage, fetchLog: fetchLog };
}

/** Run a lifecycle event and wait for its waitUntil promise. */
function lifecycle(sw, type) {
  var p = Promise.resolve();
  sw.handlers[type]({ waitUntil: function (promise) { p = promise; } });
  return p;
}

/** Dispatch a GET fetch event; resolves with the responded value (or null if unhandled). */
function request(sw, url) {
  var responded = null;
  sw.handlers.fetch({
    request: { url: url, method: 'GET' },
    respondWith: function (r) { responded = Promise.resolve(r); },
  });
  return responded || Promise.resolve(null);
}

var FIREBASE_URL = 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';

async function run() {
  console.log('\n📋 Service worker — release updates');

  await t('activate removes previous-release caches and keeps shared ones', async function () {
    var shared = makeCacheStorage();
    // Release A installs and lazily caches a file in its dynamic cache
    var a = loadSW({ caches: shared, cacheName: 'bayan-aaaaaaaaaaaa' });
    await lifecycle(a, 'install');
    await lifecycle(a, 'activate');
    await request(a, 'https://app.example/js/quran.bundle.min.js');
    await request(a, FIREBASE_URL);
    await shared.open('bayan-fonts-v1');

    // Release B activates
    var b = loadSW({ caches: shared, cacheName: 'bayan-bbbbbbbbbbbb' });
    await lifecycle(b, 'install');
    await lifecycle(b, 'activate');

    var names = (await shared.keys()).sort();
    assert.deepStrictEqual(names, ['bayan-bbbbbbbbbbbb', 'bayan-firebase-v1', 'bayan-fonts-v1']);
  });

  await t('dynamic cache is scoped to the release', async function () {
    var sw = loadSW({ cacheName: 'bayan-cccccccccccc' });
    await lifecycle(sw, 'install');
    await request(sw, 'https://app.example/js/quran.bundle.min.js');
    assert.ok(sw.caches._stores['bayan-cccccccccccc-dynamic'], 'lazy JS cached under the release name');
  });

  await t('Firestore / Auth / API requests are not intercepted', async function () {
    // An intercepted long-lived Firestore listen channel keeps the old
    // worker busy, which blocks the new release from activating.
    var sw = loadSW();
    [
      'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8',
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
      'https://quran-ap-pzso.vercel.app/api/delete-account',
    ].forEach(function (url) {
      var responded = false;
      sw.handlers.fetch({ request: { url: url, method: 'GET' }, respondWith: function () { responded = true; } });
      assert.strictEqual(responded, false, url + ' should go straight to the network');
    });
  });

  console.log('\n📋 Service worker — Firebase SDK offline');

  await t('Firebase SDK is cached on first load', async function () {
    var sw = loadSW();
    var res = await request(sw, FIREBASE_URL);
    assert.strictEqual(res.status, 200);
    assert.ok(sw.caches._stores['bayan-firebase-v1']._entries[FIREBASE_URL]);
  });

  await t('cached Firebase SDK is served without the network', async function () {
    var shared = makeCacheStorage();
    await request(loadSW({ caches: shared }), FIREBASE_URL);
    var offline = loadSW({ caches: shared, offline: true });
    var res = await request(offline, FIREBASE_URL);
    assert.strictEqual(res.body, 'network ' + FIREBASE_URL);
    assert.strictEqual(offline.fetchLog.length, 0, 'cache-first: no network call');
  });

  await t('non-Firebase gstatic requests stay network-first and uncached', async function () {
    var sw = loadSW();
    var url = 'https://www.gstatic.com/other/thing.js';
    var res = await request(sw, url);
    assert.strictEqual(res.body, 'network ' + url);
    assert.ok(!sw.caches._stores['bayan-firebase-v1']);
  });

  var total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

run();
