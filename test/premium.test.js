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
      assert.strictEqual(__premium.hasFeature('unlimitedTafsir'), false);
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
      assert.ok(features.unlimitedTafsir);
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
      assert.strictEqual(__premium.FEATURES.UNLIMITED_TAFSIR, 'unlimitedTafsir');
    });

  });

  suite('Guest Compatibility', function () {

    test('no crash when onAuthChange is not defined', function () {
      // The service should init gracefully without onAuthChange
      assert.strictEqual(typeof __premium.isPremium, 'function');
      assert.strictEqual(__premium.isPremium(), false);
    });

  });

  // ═══════════════════════════════════════════════════════════════
  // PREMIUM GATE TESTS
  // ═══════════════════════════════════════════════════════════════

  suite('Gate: unlimitedReviews', function () {

    test('FEATURES.UNLIMITED_REVIEWS resolves to "unlimitedReviews"', function () {
      assert.strictEqual(__premium.FEATURES.UNLIMITED_REVIEWS, 'unlimitedReviews');
    });

    test('hasFeature("unlimitedReviews") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('unlimitedReviews'), false);
    });

    test('requestUpgrade is callable from unlimitedReviews gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('unlimited-reviews');
      });
    });

  });

  suite('Gate: unlimitedBookmarks', function () {

    test('FEATURES.UNLIMITED_BOOKMARKS resolves to "unlimitedBookmarks"', function () {
      assert.strictEqual(__premium.FEATURES.UNLIMITED_BOOKMARKS, 'unlimitedBookmarks');
    });

    test('hasFeature("unlimitedBookmarks") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('unlimitedBookmarks'), false);
    });

    test('requestUpgrade is callable from unlimitedBookmarks gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('unlimited-bookmarks');
      });
    });

  });

  suite('Gate: cloudSync', function () {

    test('FEATURES.CLOUD_SYNC resolves to "cloudSync"', function () {
      assert.strictEqual(__premium.FEATURES.CLOUD_SYNC, 'cloudSync');
    });

    test('hasFeature("cloudSync") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('cloudSync'), false);
    });

    test('requestUpgrade is callable from cloudSync gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('cloud-sync');
      });
    });

  });

  suite('Gate: guidedReading', function () {

    test('FEATURES.GUIDED_READING resolves to "guidedReading"', function () {
      assert.strictEqual(__premium.FEATURES.GUIDED_READING, 'guidedReading');
    });

    test('hasFeature("guidedReading") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('guidedReading'), false);
    });

    test('requestUpgrade is callable from guidedReading gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('guided-reading');
      });
    });

  });

  suite('Gate: vocabularyExpansion', function () {

    test('FEATURES.VOCABULARY_EXPANSION resolves to "vocabularyExpansion"', function () {
      assert.strictEqual(__premium.FEATURES.VOCABULARY_EXPANSION, 'vocabularyExpansion');
    });

    test('hasFeature("vocabularyExpansion") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('vocabularyExpansion'), false);
    });

    test('requestUpgrade is callable from vocabularyExpansion gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('vocabulary-expansion');
      });
    });

  });

  suite('Gate: unlimitedTafsir', function () {

    test('FEATURES.UNLIMITED_TAFSIR resolves to "unlimitedTafsir"', function () {
      assert.strictEqual(__premium.FEATURES.UNLIMITED_TAFSIR, 'unlimitedTafsir');
    });

    test('hasFeature("unlimitedTafsir") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('unlimitedTafsir'), false);
    });

    test('requestUpgrade is callable from unlimitedTafsir gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('unlimited-tafsir');
      });
    });

  });

  suite('Gate: dataExport', function () {

    test('FEATURES.DATA_EXPORT resolves to "dataExport"', function () {
      assert.strictEqual(__premium.FEATURES.DATA_EXPORT, 'dataExport');
    });

    test('hasFeature("dataExport") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('dataExport'), false);
    });

    test('requestUpgrade is callable from dataExport gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('data-export');
      });
    });

  });

  suite('Tafsir Daily Limit (localStorage pattern)', function () {
    // Setup localStorage mock for these tests
    var _tafsirStorage = {};
    var origLocalStorage = global.localStorage;

    function setupTafsirTestEnv() {
      _tafsirStorage = {};
      global.localStorage = {
        getItem: function(k) { return _tafsirStorage[k] !== undefined ? _tafsirStorage[k] : null; },
        setItem: function(k, v) { _tafsirStorage[k] = String(v); },
        removeItem: function(k) { delete _tafsirStorage[k]; },
        clear: function() { _tafsirStorage = {}; },
      };
    }

    function teardownTafsirTestEnv() {
      global.localStorage = origLocalStorage;
    }

    // Replica of the daily-limit check pattern used in word-card.js and explorer.js
    function simulateTafsirCheck(isPremium) {
      if (isPremium) return { allowed: true };
      try {
        var usage = JSON.parse(global.localStorage.getItem('quran_tafsir_usage') || '{}');
        var today = new Date().toISOString().slice(0, 10);
        if (usage.date !== today) {
          usage = { date: today, count: 0 };
        }
        if (usage.count >= 5) {
          return { allowed: false, reason: 'cap_reached' };
        }
        usage.count++;
        global.localStorage.setItem('quran_tafsir_usage', JSON.stringify(usage));
        return { allowed: true, remaining: 5 - usage.count };
      } catch (e) {
        return { allowed: true };
      }
    }

    test('free user is capped at 5 per calendar day', function () {
      setupTafsirTestEnv();
      var results = [];
      for (var i = 0; i < 6; i++) {
        results.push(simulateTafsirCheck(false).allowed);
      }
      // First 5 should be allowed, 6th should be blocked
      assert.strictEqual(results[0], true, '1st tafsir load allowed');
      assert.strictEqual(results[1], true, '2nd allowed');
      assert.strictEqual(results[2], true, '3rd allowed');
      assert.strictEqual(results[3], true, '4th allowed');
      assert.strictEqual(results[4], true, '5th allowed');
      assert.strictEqual(results[5], false, '6th blocked (cap reached)');
      teardownTafsirTestEnv();
    });

    test('cap resets on a new calendar day', function () {
      setupTafsirTestEnv();
      // Simulate hitting the cap
      for (var i = 0; i < 5; i++) simulateTafsirCheck(false);
      assert.strictEqual(simulateTafsirCheck(false).allowed, false, 'blocked after 5');
      // Simulate a new day by changing the stored date
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      global.localStorage.setItem('quran_tafsir_usage', JSON.stringify({ date: yesterday, count: 5 }));
      // Should be allowed again (new day resets)
      assert.strictEqual(simulateTafsirCheck(false).allowed, true, 'allowed next day');
      assert.strictEqual(simulateTafsirCheck(false).allowed, true, '2nd next day');
      teardownTafsirTestEnv();
    });

    test('premium user is never capped', function () {
      setupTafsirTestEnv();
      var results = [];
      for (var i = 0; i < 10; i++) {
        results.push(simulateTafsirCheck(true).allowed);
      }
      results.forEach(function(r, idx) {
        assert.strictEqual(r, true, 'premium load #' + (idx + 1) + ' allowed');
      });
      teardownTafsirTestEnv();
    });

    test('daily limit localStorage key is quran_tafsir_usage', function () {
      setupTafsirTestEnv();
      simulateTafsirCheck(false);
      var stored = global.localStorage.getItem('quran_tafsir_usage');
      assert.ok(stored !== null, 'localStorage key exists');
      var parsed = JSON.parse(stored);
      assert.ok(parsed.date, 'has date field');
      assert.strictEqual(parsed.count, 1, 'count is 1 after first load');
      teardownTafsirTestEnv();
    });

  });

  suite('Gate: advancedInsights', function () {

    test('FEATURES.ADVANCED_INSIGHTS resolves to "advancedInsights"', function () {
      assert.strictEqual(__premium.FEATURES.ADVANCED_INSIGHTS, 'advancedInsights');
    });

    test('hasFeature("advancedInsights") returns false when not premium', function () {
      assert.strictEqual(__premium.hasFeature('advancedInsights'), false);
    });

    test('requestUpgrade is callable from advancedInsights gate', function () {
      assert.doesNotThrow(function () {
        __premium.requestUpgrade('advanced-insights');
      });
    });

  });

});

// Print results summary for run-all.js parser
console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed, ' + (_passed + _failed) + ' total');
if (_failed > 0) {
  console.log('  Failed: ' + _failedNames.join(', '));
}
