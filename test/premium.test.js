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
  getElementById: function () {
    return null;
  },
  addEventListener: function () {},
  removeEventListener: function () {},
};

// Simulate onAuthChange (may or may not be defined)
global.onAuthChange = null;

// Load the premium service source
var premiumSrc = fs.readFileSync(path.join(__dirname, '..', 'js/services/premium.js'), 'utf8');
vm.runInNewContext(premiumSrc, {
  window: global.window,
  document: global.document,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  onAuthChange: null,
});

var __premium = global.window.__premium;

// ── Custom test runner counters (for run-all.js compatibility) ──
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
    console.log('  ✗ ' + name + ': ' + (e.message || e));
  }
}

function _runSuite(name, fn) {
  // Run suite — pass the test runner helpers
  fn();
}

var suite = typeof describe !== 'undefined' ? describe : _runSuite;
var test = typeof it !== 'undefined' ? it : _runTest;

suite('Premium Service', function () {

  test('window.__premium exists', function () {
    assert.ok(__premium, '__premium should be defined');
  });

  test('isPremium() returns false by default', function () {
    assert.strictEqual(__premium.isPremium(), false);
  });

  test('getSubscription() returns null by default', function () {
    assert.strictEqual(__premium.getSubscription(), null);
  });

  suite('hasFeature', function () {

    test('returns false for unknown feature key', function () {
      assert.strictEqual(__premium.hasFeature('non-existent-feature'), false);
    });

    test('returns false for all known features when not premium', function () {
      assert.strictEqual(__premium.hasFeature('unlimitedReviews'), false);
      assert.strictEqual(__premium.hasFeature('guidedReading'), false);
      assert.strictEqual(__premium.hasFeature('vocabularyExpansion'), false);
      assert.strictEqual(__premium.hasFeature('advancedInsights'), false);
      assert.strictEqual(__premium.hasFeature('cloudSync'), false);
      assert.strictEqual(__premium.hasFeature('offlineDownload'), false);
      assert.strictEqual(__premium.hasFeature('unlimitedBookmarks'), false);
      assert.strictEqual(__premium.hasFeature('premiumThemes'), false);
    });

    test('returns false for null/undefined/empty feature key', function () {
      assert.strictEqual(__premium.hasFeature(null), false);
      assert.strictEqual(__premium.hasFeature(undefined), false);
      assert.strictEqual(__premium.hasFeature(''), false);
    });

  });

  suite('onChange', function () {

    test('registers and returns unsubscribe function', function () {
      var cb = function () {};
      var unsubscribe = __premium.onChange(cb);
      assert.strictEqual(typeof unsubscribe, 'function');
      // Calling unsubscribe should not throw
      unsubscribe();
    });

    test('ignores non-function callbacks', function () {
      var result1 = __premium.onChange(null);
      assert.strictEqual(typeof result1, 'function');
      result1(); // should not throw

      var result2 = __premium.onChange('not a function');
      assert.strictEqual(typeof result2, 'function');
      result2(); // should not throw
    });

  });

  suite('refresh', function () {

    test('refresh() returns false (no active subscription)', async function () {
      var result = await __premium.refresh();
      assert.strictEqual(result, false);
    });

  });

  suite('getFeatureList', function () {

    test('returns object with all feature keys', function () {
      var features = __premium.getFeatureList();
      assert.ok(features.unlimitedReviews);
      assert.ok(features.guidedReading);
      assert.ok(features.vocabularyExpansion);
      assert.ok(features.advancedInsights);
      assert.ok(features.cloudSync);
      assert.ok(features.offlineDownload);
      assert.ok(features.unlimitedBookmarks);
      assert.ok(features.premiumThemes);
    });

    test('each feature has key, label, and description', function () {
      var features = __premium.getFeatureList();
      Object.keys(features).forEach(function (k) {
        assert.ok(features[k].key, 'Feature ' + k + ' should have a key');
        assert.ok(features[k].label, 'Feature ' + k + ' should have a label');
        assert.ok(features[k].description, 'Feature ' + k + ' should have a description');
      });
    });

  });

  suite('requestUpgrade', function () {

    test('does not throw when called without arguments', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade();
      });
    });

    test('does not throw when called with a reason string', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('guided-reading-locked');
      });
    });

  });

  suite('FEATURES constants', function () {

    test('exposes all feature keys as constants', function () {
      assert.strictEqual(__premium.FEATURES.UNLIMITED_REVIEWS, 'unlimitedReviews');
      assert.strictEqual(__premium.FEATURES.GUIDED_READING, 'guidedReading');
      assert.strictEqual(__premium.FEATURES.VOCABULARY_EXPANSION, 'vocabularyExpansion');
      assert.strictEqual(__premium.FEATURES.ADVANCED_INSIGHTS, 'advancedInsights');
      assert.strictEqual(__premium.FEATURES.CLOUD_SYNC, 'cloudSync');
      assert.strictEqual(__premium.FEATURES.OFFLINE_DOWNLOAD, 'offlineDownload');
      assert.strictEqual(__premium.FEATURES.UNLIMITED_BOOKMARKS, 'unlimitedBookmarks');
      assert.strictEqual(__premium.FEATURES.PREMIUM_THEMES, 'premiumThemes');
    });

  });

  suite('Guest Compatibility', function () {

    test('no crash when onAuthChange is not defined', function () {
      // The service should init gracefully without onAuthChange
      assert.strictEqual(typeof __premium.isPremium, 'function');
      assert.strictEqual(__premium.isPremium(), false);
    });

  });

});

// Print results summary for run-all.js parser
console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed, ' + (_passed + _failed) + ' total');
if (_failed > 0) {
  console.log('  Failed: ' + _failedNames.join(', '));
}
