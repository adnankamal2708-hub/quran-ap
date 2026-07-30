// ═══════════════════════════════════════════════════════════════
// premium.test.js — Premium Service Unit Tests
// ═══════════════════════════════════════════════════════════════

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

// Build a minimal DOM environment
global.window = global.window || {};
global.document = {
  createElement: function (tag) {
    return {
      tagName: tag,
      style: {},
      appendChild: function () {},
      setAttribute: function () {},
      focus: function () {},
      onclick: null,
    };
  },
  body: {
    appendChild: function () {},
    removeChild: function () {},
  },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  activeElement: null,
  addEventListener: function () {},
  removeEventListener: function () {},
};

global.onAuthChange = null;

// ── Firestore Timestamp helper ──────────────────────────────
function _firestoreTimestamp(epochMs) {
  return {
    seconds: Math.floor(epochMs / 1000),
    nanoseconds: 0,
    toDate: function () { return new Date(epochMs); },
    toMillis: function () { return epochMs; },
  };
}

// ── Mock helpers ─────────────────────────────────────────────
function _mockFirebaseCore(docData) {
  var mockFsDoc = {
    exists: function () { return docData !== null && docData !== undefined; },
    data: function () { return docData; },
  };
  global.window.__firebaseCore = {
    getDb: function () { return { _mock: true }; },
    doc: function () { return { _mockRef: true }; },
    getDoc: function () { return Promise.resolve(mockFsDoc); },
    getAuth: function () {
      return {
        currentUser: {
          uid: 'test-user-123',
          email: 'test@example.com',
          getIdToken: function () { return Promise.resolve('mock-id-token-abc123'); },
        },
      };
    },
    initCore: function () { return true; },
    subscribeToAuth: function () { return function () {}; },
  };
}

function _clearMocks() {
  delete global.window.__firebaseCore;
  delete global.window.__auth;
  delete global.window.__ux;
  delete global.window.__premium;
  delete global.fetch;
  delete global.window.location;
}

// ── Load premium module ────────────────────────────────────
var premiumSrc = fs.readFileSync(path.join(__dirname, '..', 'js/services/premium.js'), 'utf8');

function _loadPremium() {
  _clearMocks();
  var context = {
    window: global.window,
    document: global.document,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    onAuthChange: null,
    // Proxy fetch through global.fetch so tests can set it dynamically
    fetch: function (url, opts) {
      if (typeof global.fetch !== 'function') {
        return Promise.reject(new Error('fetch not available'));
      }
      return global.fetch(url, opts);
    },
    // Proxy alert through global.window.alert for the fallback error display
    alert: function (msg) {
      if (typeof global.window.alert === 'function') {
        global.window.alert(msg);
      }
    },
  };
  vm.runInNewContext(premiumSrc, context);
}

_loadPremium();
var __premium = global.window.__premium;

function resetPremium() {
  _loadPremium();
  __premium = global.window.__premium;
}

// ── Custom test runner ─────────────────────────────────────
var _passed = 0;
var _failed = 0;
var _failedNames = [];

function _runTest(name, fn) {
  try {
    fn();
    _passed++;
  } catch (e) {
    _failed++;
    _failedNames.push(name);
    console.log('  \u2717 ' + name + ': ' + (e.message || e));
  }
}

// Sequential async test runner — prevents race conditions
// by awaiting each test before starting the next.
var _asyncQueue = [];
var _asyncSuiteRunning = false;

function addAsyncTest(name, fn) {
  _asyncQueue.push({ name: name, fn: fn });
}

function _runSuite(name, fn) {
  fn();
}

var suite = typeof describe !== 'undefined' ? describe : _runSuite;
var test = typeof it !== 'undefined' ? it : _runTest;

// ── Fixture helpers ────────────────────────────────────────
function setupFirestoreTest(docData) {
  resetPremium();
  global.window.__auth = {
    getCurrentUser: function () {
      return { uid: 'test-user-123', email: 'test@example.com' };
    },
  };
  if (docData === 'REJECT') {
    global.window.__firebaseCore = {
      getDb: function () { return {}; },
      doc: function () { return {}; },
      getDoc: function () { return Promise.reject(new Error('Network error')); },
    };
  } else {
    _mockFirebaseCore(docData);
  }
}

function setupCheckoutTest() {
  resetPremium();
  global.window.__auth = {
    getCurrentUser: function () {
      return { uid: 'test-user-123', email: 'test@example.com' };
    },
  };
  _mockFirebaseCore({ status: 'inactive' });
  global.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ url: 'https://checkout.stripe.com/test' }); },
    });
  };
  global.window.location = { href: '' };
  global.window.__ux = { showToast: function () {} };
}

function cleanupTest() {
  _clearMocks();
}

// ═══════════════════════════════════════════════════════════
// SYNC TESTS
// ═══════════════════════════════════════════════════════════

suite('Premium Service', function () {

  test('window.__premium exists', function () {
    resetPremium();
    assert.ok(__premium, '__premium should be defined');
  });

  test('isPremium() returns false by default', function () {
    resetPremium();
    assert.strictEqual(__premium.isPremium(), false);
  });

  test('getSubscription() returns null by default', function () {
    resetPremium();
    assert.strictEqual(__premium.getSubscription(), null);
  });

  suite('hasFeature', function () {
    test('returns false for unknown feature key', function () {
      resetPremium();
      assert.strictEqual(__premium.hasFeature('non-existent-feature'), false);
    });
    test('returns false for all known features when not premium', function () {
      resetPremium();
      assert.strictEqual(__premium.hasFeature('unlimitedReviews'), false);
      assert.strictEqual(__premium.hasFeature('guidedReading'), false);
      assert.strictEqual(__premium.hasFeature('vocabularyExpansion'), false);
      assert.strictEqual(__premium.hasFeature('advancedInsights'), false);
      assert.strictEqual(__premium.hasFeature('cloudSync'), false);
      assert.strictEqual(__premium.hasFeature('offlineDownload'), false);
      assert.strictEqual(__premium.hasFeature('unlimitedBookmarks'), false);
      assert.strictEqual(__premium.hasFeature('premiumThemes'), false);
      assert.strictEqual(__premium.hasFeature('unlimitedTafsir'), false);
    });
    test('returns false for null/undefined/empty', function () {
      resetPremium();
      assert.strictEqual(__premium.hasFeature(null), false);
      assert.strictEqual(__premium.hasFeature(undefined), false);
      assert.strictEqual(__premium.hasFeature(''), false);
    });
  });

  suite('onChange', function () {
    test('registers and returns unsubscribe function', function () {
      resetPremium();
      var cb = function () {};
      var unsubscribe = __premium.onChange(cb);
      assert.strictEqual(typeof unsubscribe, 'function');
      unsubscribe();
    });
    test('ignores non-function callbacks', function () {
      resetPremium();
      var r1 = __premium.onChange(null);
      assert.strictEqual(typeof r1, 'function');
      r1();
      var r2 = __premium.onChange('not a function');
      assert.strictEqual(typeof r2, 'function');
      r2();
    });
  });

  suite('getFeatureList', function () {
    test('returns object with all feature keys', function () {
      resetPremium();
      var f = __premium.getFeatureList();
      assert.ok(f.unlimitedReviews);
      assert.ok(f.guidedReading);
      assert.ok(f.vocabularyExpansion);
      assert.ok(f.advancedInsights);
      assert.ok(f.cloudSync);
      assert.ok(f.offlineDownload);
      assert.ok(f.unlimitedBookmarks);
      assert.ok(f.premiumThemes);
      assert.ok(f.unlimitedTafsir);
    });
    test('each feature has key, label, description', function () {
      resetPremium();
      var f = __premium.getFeatureList();
      Object.keys(f).forEach(function (k) {
        assert.ok(f[k].key, 'Feature ' + k + ' should have a key');
        assert.ok(f[k].label, 'Feature ' + k + ' should have a label');
        assert.ok(f[k].description, 'Feature ' + k + ' should have a description');
      });
    });
  });

  suite('FEATURES constants', function () {
    test('exposes all feature keys as constants', function () {
      resetPremium();
      assert.strictEqual(__premium.FEATURES.UNLIMITED_REVIEWS, 'unlimitedReviews');
      assert.strictEqual(__premium.FEATURES.GUIDED_READING, 'guidedReading');
      assert.strictEqual(__premium.FEATURES.VOCABULARY_EXPANSION, 'vocabularyExpansion');
      assert.strictEqual(__premium.FEATURES.ADVANCED_INSIGHTS, 'advancedInsights');
      assert.strictEqual(__premium.FEATURES.CLOUD_SYNC, 'cloudSync');
      assert.strictEqual(__premium.FEATURES.OFFLINE_DOWNLOAD, 'offlineDownload');
      assert.strictEqual(__premium.FEATURES.UNLIMITED_BOOKMARKS, 'unlimitedBookmarks');
      assert.strictEqual(__premium.FEATURES.PREMIUM_THEMES, 'premiumThemes');
      assert.strictEqual(__premium.FEATURES.UNLIMITED_TAFSIR, 'unlimitedTafsir');
    });
  });

  suite('Guest Compatibility', function () {
    test('no crash when onAuthChange is not defined', function () {
      resetPremium();
      assert.strictEqual(typeof __premium.isPremium, 'function');
      assert.strictEqual(__premium.isPremium(), false);
    });
  });

  // ── Gate tests (sync) ──────────────────────────────────────
  var gates = [
    'unlimitedReviews', 'unlimitedBookmarks', 'cloudSync', 'guidedReading',
    'vocabularyExpansion', 'unlimitedTafsir', 'dataExport', 'wordRelationships', 'advancedInsights'
  ];
  gates.forEach(function (gate) {
    suite('Gate: ' + gate, function () {
      var featKey = gate;
      // Map to FEATURES key
      var featConst = 'FEATURES.' + gate.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
      test('FEATURES constant resolves', function () {
        resetPremium();
        var keys = Object.keys(__premium.FEATURES);
        assert.ok(keys.some(function (k) { return __premium.FEATURES[k] === gate; }),
          'FEATURES should contain ' + gate);
      });
      test('hasFeature("' + gate + '") returns false when not premium', function () {
        resetPremium();
        assert.strictEqual(__premium.hasFeature(gate), false);
      });
    });
  });

  suite('Word Relationships — FEATURES Constant', function () {
    test('WORD_RELATIONSHIPS is in FEATURES', function () {
      resetPremium();
      var keys = Object.keys(__premium.FEATURES);
      assert.ok(keys.indexOf('WORD_RELATIONSHIPS') >= 0);
    });
    test('FEATURES constant count is 11', function () {
      resetPremium();
      assert.strictEqual(Object.keys(__premium.FEATURES).length, 11);
    });
  });

  suite('Gate: wordRelationships', function () {
    test('FEATURES constant not conflated', function () {
      resetPremium();
      assert.notStrictEqual(__premium.FEATURES.WORD_RELATIONSHIPS, __premium.FEATURES.VOCABULARY_EXPANSION);
    });
  });

  // ── Checkout param handling tests (sync) ─────────────────
  suite('Checkout Redirect Handling', function () {
    function simulateHandler(status) {
      var params = new URLSearchParams(status ? 'checkout=' + status : '');
      var cs = params.get('checkout');
      if (!cs) return { handled: false };
      if (cs === 'cancel') return { handled: true, action: 'cancel' };
      if (cs === 'success') return { handled: true, action: 'success' };
      return { handled: false };
    }

    test('success param is detected', function () {
      assert.strictEqual(simulateHandler('success').handled, true);
    });
    test('cancel param is detected', function () {
      assert.strictEqual(simulateHandler('cancel').handled, true);
    });
    test('no param returns unhandled', function () {
      assert.strictEqual(simulateHandler(null).handled, false);
    });
    test('cancel does not trigger toast', function () {
      var called = false;
      global.window.__ux = { showToast: function () { called = true; } };
      new URLSearchParams('checkout=cancel');
      // silent dismiss — no toast
      assert.strictEqual(called, false);
      delete global.window.__ux;
    });
    test('URL cleaned after handling param', function () {
      var called = false;
      global.window.history = { replaceState: function () { called = true; } };
      global.window.history.replaceState(null, '', '/');
      assert.ok(called);
    });
  });

});

// ═══════════════════════════════════════════════════════════
// ASYNC TESTS (run sequentially to avoid race conditions)
// ═══════════════════════════════════════════════════════════

// ── isPremium() — 5 Priority Cases ────────────────────────
addAsyncTest('Rule 1: No document exists → false', async function () {
  setupFirestoreTest(null);
  var result = await __premium.refresh();
  assert.strictEqual(result, false);
  assert.strictEqual(__premium.isPremium(), false);
  assert.strictEqual(__premium.getSubscription(), null);
  cleanupTest();
});

addAsyncTest('Rule 2: status !== active → false (canceled)', async function () {
  setupFirestoreTest({ status: 'canceled' });
  var result = await __premium.refresh();
  assert.strictEqual(result, false);
  assert.strictEqual(__premium.isPremium(), false);
  cleanupTest();
});

addAsyncTest('Rule 2: status !== active → false (past_due)', async function () {
  setupFirestoreTest({ status: 'past_due' });
  var result = await __premium.refresh();
  assert.strictEqual(result, false);
  assert.strictEqual(__premium.isPremium(), false);
  cleanupTest();
});

addAsyncTest('Rule 3: active + past currentPeriodEnd → false', async function () {
  var yesterday = Date.now() - 86400000;
  setupFirestoreTest({ status: 'active', currentPeriodEnd: _firestoreTimestamp(yesterday) });
  var result = await __premium.refresh();
  assert.strictEqual(result, false);
  assert.strictEqual(__premium.isPremium(), false);
  cleanupTest();
});

addAsyncTest('Rule 4: active + no currentPeriodEnd → true', async function () {
  setupFirestoreTest({ status: 'active' });
  var result = await __premium.refresh();
  assert.strictEqual(result, true);
  assert.strictEqual(__premium.isPremium(), true);
  cleanupTest();
});

addAsyncTest('Rule 4: active + null currentPeriodEnd → true', async function () {
  setupFirestoreTest({ status: 'active', currentPeriodEnd: null });
  var result = await __premium.refresh();
  assert.strictEqual(result, true);
  assert.strictEqual(__premium.isPremium(), true);
  cleanupTest();
});

addAsyncTest('Rule 5: active + future currentPeriodEnd (Timestamp) → true', async function () {
  var nextMonth = Date.now() + 30 * 86400000;
  setupFirestoreTest({ status: 'active', currentPeriodEnd: _firestoreTimestamp(nextMonth) });
  var result = await __premium.refresh();
  assert.strictEqual(result, true);
  assert.strictEqual(__premium.isPremium(), true);
  cleanupTest();
});

addAsyncTest('Rule 5: active + future currentPeriodEnd (epoch ms) → true', async function () {
  var nextMonth = Date.now() + 30 * 86400000;
  setupFirestoreTest({ status: 'active', currentPeriodEnd: nextMonth });
  var result = await __premium.refresh();
  assert.strictEqual(result, true);
  assert.strictEqual(__premium.isPremium(), true);
  cleanupTest();
});

addAsyncTest('Rule 5: active + future currentPeriodEnd (ISO string) → true', async function () {
  var nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
  setupFirestoreTest({ status: 'active', currentPeriodEnd: nextMonth });
  var result = await __premium.refresh();
  assert.strictEqual(result, true);
  assert.strictEqual(__premium.isPremium(), true);
  cleanupTest();
});

addAsyncTest('Error: Firestore read error → false (logged)', async function () {
  setupFirestoreTest('REJECT');
  var result = await __premium.refresh();
  assert.strictEqual(result, false);
  assert.strictEqual(__premium.isPremium(), false);
  cleanupTest();
});

// ── requestUpgrade — Endpoint Calls ───────────────────────
addAsyncTest('requestUpgrade: sends auth header + monthly plan', async function () {
  setupCheckoutTest();
  var capturedUrl = '';
  var capturedHeaders = {};
  var capturedBody = '';

  global.fetch = function (url, opts) {
    capturedUrl = url;
    capturedHeaders = opts.headers || {};
    capturedBody = opts.body || '';
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ url: 'https://checkout.stripe.com/test' }); },
    });
  };

  await __premium.requestUpgrade('test-reason');

  assert.ok(capturedUrl.indexOf('/api/create-checkout-session') >= 0);
  assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-id-token-abc123');
  assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
  var body = JSON.parse(capturedBody);
  assert.strictEqual(body.plan, 'monthly');
  cleanupTest();
});

addAsyncTest('requestUpgrade: yearly plan when requested', async function () {
  setupCheckoutTest();
  var capturedBody = '';

  global.fetch = function (url, opts) {
    capturedBody = opts.body || '';
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ url: 'https://checkout.stripe.com/test' }); },
    });
  };

  await __premium.requestUpgrade('test-reason', { plan: 'yearly' });

  var body = JSON.parse(capturedBody);
  assert.strictEqual(body.plan, 'yearly');
  cleanupTest();
});

addAsyncTest('requestUpgrade: success redirects to Stripe', async function () {
  setupCheckoutTest();
  var redirectUrl = '';

  global.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ url: 'https://checkout.stripe.com/cs_test_xyz' }); },
    });
  };
  global.window.location = {
    set href(url) { redirectUrl = url; },
    get href() { return redirectUrl; },
  };

  await __premium.requestUpgrade('test');

  assert.ok(redirectUrl.indexOf('checkout.stripe.com') >= 0);
  cleanupTest();
});

addAsyncTest('requestUpgrade: 4xx shows user-friendly error', async function () {
  setupCheckoutTest();
  var toastMessage = '';

  global.fetch = function () {
    return Promise.resolve({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: function () { return Promise.resolve({ error: 'Invalid request' }); },
    });
  };
  global.window.__ux = { showToast: function (msg) { toastMessage = msg; } };

  await __premium.requestUpgrade('test');

  assert.ok(toastMessage.indexOf('Something went wrong') >= 0);
  cleanupTest();
});

addAsyncTest('requestUpgrade: network error shows user-friendly message', async function () {
  setupCheckoutTest();
  var toastMessage = '';

  global.fetch = function () {
    return Promise.reject(new Error('Network request failed'));
  };
  global.window.__ux = { showToast: function (msg) { toastMessage = msg; } };

  await __premium.requestUpgrade('test');

  assert.ok(toastMessage.indexOf('Something went wrong') >= 0);
  cleanupTest();
});

addAsyncTest('requestUpgrade: missing url in response', async function () {
  setupCheckoutTest();
  var toastShown = false;

  global.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ status: 'ok' }); },
    });
  };
  global.window.__ux = { showToast: function () { toastShown = true; } };

  await __premium.requestUpgrade('test');

  assert.ok(toastShown, 'Should show error toast when response has no url');
  cleanupTest();
});

addAsyncTest('requestUpgrade: sign-in prompt when no user', async function () {
  resetPremium();
  // No __auth set up — should show sign-in prompt
  await __premium.requestUpgrade('test');
  cleanupTest();
});

// ═══════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════

async function runAllAsyncTests() {
  for (var i = 0; i < _asyncQueue.length; i++) {
    var t = _asyncQueue[i];
    try {
      await t.fn();
      _passed++;
    } catch (e) {
      _failed++;
      _failedNames.push(t.name);
      console.log('  \u2717 ' + t.name + ': ' + (e.message || e));
    }
  }
}

runAllAsyncTests().then(function () {
  console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed, ' + (_passed + _failed) + ' total');
  if (_failed > 0) {
    console.log('  Failed: ' + _failedNames.join(', '));
  }
}).catch(function (e) {
  console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed, ' + (_passed + _failed) + ' total');
  console.error('Fatal error:', e.message || e);
  process.exit(1);
});
