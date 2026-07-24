#!/usr/bin/env node
/**
 * production-build.test.js — Production Bundle Integrity
 *
 * Verifies the ACTUAL production build output, NOT source files.
 * Run ONLY after `node build.js` has generated dist/.
 *
 * These tests ensure that no critical runtime dependency can be
 * silently omitted from the production bundle.
 *
 * Run: node build.js && node test/production-build.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\ud83d\udccb ' + name); fn(); }

var DIST = path.join(__dirname, '..', 'dist');


// ═══════════════════════════════════════════════════════════════
// BUNDLE EXISTENCE
// ═══════════════════════════════════════════════════════════════

suite('Production Bundle Existence', function() {
  test('dist/ directory exists', function() {
    assert.ok(fs.existsSync(DIST), 'dist/ not found. Run `node build.js` first.');
  });

  var requiredFiles = [
    'js/data.bundle.min.js',
    'js/app.bundle.min.js',
    'index.html',
    'styles.min.css',
    'manifest.json',
  ];

  requiredFiles.forEach(function(filePath) {
    test('File exists: ' + filePath, function() {
      var abs = path.join(DIST, filePath);
      assert.ok(fs.existsSync(abs), 'Missing: ' + filePath);
      var stat = fs.statSync(abs);
      assert.ok(stat.size > 0, 'Empty file: ' + filePath + ' (' + stat.size + ' bytes)');
    });
  });

  // sw.js is a REQUIRED production asset. If missing, the build step 7 may
  // have been skipped due to a partial build failure. On some Node versions
  // or CI environments, the service worker may need separate handling.
  // We check it separately so the build summary always shows its status.
  test('File exists: sw.js', function() {
    var abs = path.join(DIST, 'sw.js');
    var ok = fs.existsSync(abs);
    if (!ok) {
      console.log('    \u26A0  sw.js not found — service worker will not be available');
      console.log('       Ensure build step 7 completed. See test.yml CI diagnostic step.');
    }
    assert.ok(ok, 'Missing production asset: sw.js (required for offline/PWA support)');
  });
});

// ═══════════════════════════════════════════════════════════════
// CRITICAL RUNTIME DEPENDENCIES IN APP BUNDLE
// ═══════════════════════════════════════════════════════════════

suite('Critical Runtime Dependencies (app.bundle.min.js)', function() {
  var appBundlePath = path.join(DIST, 'js/app.bundle.min.js');
  if (!fs.existsSync(appBundlePath)) {
    console.log('  \u26A0 Bundle not found — skipping (run node build.js)');
    return;
  }
  var bundleCode = fs.readFileSync(appBundlePath, 'utf8');

  // These symbols MUST be present in the production bundle for the app to work.
  // If a developer removes a required file from build.js, the corresponding
  // symbol will disappear and these tests will catch it.

  var criticalSymbols = [
    // Quran loader (was MISSING — the bug this test prevents)
    { symbol: '__quranLoader', reason: 'Quran async loader — missing = verses never load' },

    // Quran UI
    { symbol: 'openSurahForReading', reason: 'Entry point for opening a surah' },
    { symbol: 'renderAyahs', reason: 'Renders individual ayah cards' },
    { symbol: '_buildVerseData', reason: 'Builds complete verse data from Quran dataset' },
    { symbol: '_buildFromVocabOnly', reason: 'Fallback when Quran data not yet loaded' },
    { symbol: '_normArabicForMatch', reason: 'Arabic normalization for vocabulary matching' },
    { symbol: 'renderQuran', reason: 'Main Quran view renderer' },

    // Vocabulary / SRS
    { symbol: 'loadSRS', reason: 'Loads spaced repetition data' },
    { symbol: 'getSurahWords', reason: 'Gets vocabulary words for a surah' },
    { symbol: 'getCanonicalWords', reason: 'Canonical vocabulary list' },

    // Foundation Course
    { symbol: 'getFoundationLessonCount', reason: 'Foundation course lesson count' },
    { symbol: 'getCompletedFoundationLessonCount', reason: 'Foundation course progress' },

    // Analytics
    { symbol: '__analytics', reason: 'Analytics engine' },

    // Navigation
    { symbol: 'switchView', reason: 'View switching' },
    { symbol: 'openExplorer', reason: 'Word explorer' },
  ];

  criticalSymbols.forEach(function(item) {
    test('Symbol "' + item.symbol + '" exists in app bundle', function() {
      var count = (bundleCode.match(new RegExp('\\b' + item.symbol + '\\b', 'g')) || []).length;
      assert.ok(count > 0, 'Missing: ' + item.symbol + ' (' + item.reason + ')');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// RUNTIME DEPENDENCIES IN DATA BUNDLE
// ═══════════════════════════════════════════════════════════════

suite('Critical Runtime Dependencies (data.bundle.min.js)', function() {
  var dataBundlePath = path.join(DIST, 'js/data.bundle.min.js');
  if (!fs.existsSync(dataBundlePath)) {
    console.log('  \u26A0 Bundle not found — skipping (run node build.js)');
    return;
  }
  var bundleCode = fs.readFileSync(dataBundlePath, 'utf8');

  var criticalSymbols = [
    { symbol: 'ALL_WORDS', reason: 'Master vocabulary array' },
    { symbol: 'deduplicateVocabulary', reason: 'Vocabulary deduplication' },
    { symbol: 'CANONICAL_WORDS', reason: 'Deduplicated canonical vocabulary' },
  ];

  criticalSymbols.forEach(function(item) {
    test('Symbol "' + item.symbol + '" exists in data bundle', function() {
      var count = (bundleCode.match(new RegExp('\\b' + item.symbol + '\\b', 'g')) || []).length;
      assert.ok(count > 0, 'Missing: ' + item.symbol + ' (' + item.reason + ')');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// BUNDLE LOAD ORDER: quran-loader BEFORE quran.js
// ═══════════════════════════════════════════════════════════════

suite('Bundle Load Order Integrity', function() {
  var appBundlePath = path.join(DIST, 'js/app.bundle.min.js');
  if (!fs.existsSync(appBundlePath)) {
    console.log('  \u26A0 Bundle not found — skipping');
    return;
  }
  var bundleCode = fs.readFileSync(appBundlePath, 'utf8');

  // Verify that __quranLoader (from quran-loader.js) is defined
  // BEFORE keys that reference it (like openSurahForReading from quran.js).
  // The bundle concatenates files in UI_FILES order, so quran-loader.js
  // should appear before quran.js in the bundle text.
  var loaderPos = bundleCode.indexOf('__quranLoader');
  var quranUIPos = bundleCode.indexOf('openSurahForReading');

  test('__quranLoader appears before openSurahForReading in bundle', function() {
    assert.ok(loaderPos >= 0, '__quranLoader not found in bundle');
    assert.ok(quranUIPos >= 0, 'openSurahForReading not found in bundle');
    // __quranLoader must be defined before any function that uses it
    // (quran-loader.js is bundled before quran.js)
    assert.ok(loaderPos < quranUIPos,
      'Load order violated: __quranLoader at position ' + loaderPos +
      ' but openSurahForReading at ' + quranUIPos +
      ' — quran-loader.js must be before quran.js in UI_FILES');
  });

  test('loadQuranSurah (from loader) appears before renderAyahs (from quran.js)', function() {
    var loadPos = bundleCode.indexOf('loadQuranSurah');
    var renderPos = bundleCode.indexOf('renderAyahs');
    assert.ok(loadPos >= 0, 'loadQuranSurah not found in bundle');
    assert.ok(renderPos >= 0, 'renderAyahs not found in bundle');
    assert.ok(loadPos < renderPos,
      'Load order violated: loadQuranSurah at ' + loadPos +
      ' but renderAyahs at ' + renderPos);
  });
});

// ═══════════════════════════════════════════════════════════════
// APP BUNDLE CAN LOAD (Runtime Execution)
// ═══════════════════════════════════════════════════════════════

suite('App Bundle Runtime Loading', function() {
  test('app.bundle.min.js can be evaluated without syntax errors', function() {
    var bundlePath = path.join(DIST, 'js/app.bundle.min.js');
    if (!fs.existsSync(bundlePath)) throw new Error('Bundle not found');
    var code = fs.readFileSync(bundlePath, 'utf8');
    // Just verify the code parses as valid JavaScript
    // We don't execute it here as it requires browser globals,
    // but a SyntaxError would indicate a corrupted bundle
    try {
      new Function(code);
    } catch (e) {
      // Function() is OK for syntax checking but will fail at runtime
      // because the code references browser APIs. That's expected.
      // A SyntaxError is what we want to catch.
      assert.fail('Syntax error in bundle: ' + e.message.substring(0, 100));
    }
  });

  test('data.bundle.min.js can be evaluated without syntax errors', function() {
    var bundlePath = path.join(DIST, 'js/data.bundle.min.js');
    if (!fs.existsSync(bundlePath)) throw new Error('Bundle not found');
    var code = fs.readFileSync(bundlePath, 'utf8');
    try {
      new Function(code);
    } catch (e) {
      assert.fail('Syntax error in data bundle: ' + e.message.substring(0, 100));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// QURAN DATA INTEGRITY IN PRODUCTION BUILD
// ═══════════════════════════════════════════════════════════════

suite('Quran Data Integrity (from data bundle)', function() {
  var dataBundlePath = path.join(DIST, 'js/data.bundle.min.js');
  if (!fs.existsSync(dataBundlePath)) {
    console.log('  \u26A0 Data bundle not found — skipping');
    return;
  }

  var bundleCode = fs.readFileSync(dataBundlePath, 'utf8');

  // Verify surah-org is included (provides surah info for the reader)
  test('SURAH_INFO is defined in data bundle', function() {
    assert.ok(bundleCode.indexOf('SURAH_INFO') >= 0, 'SURAH_INFO missing from data bundle');
  });

  test('FOUNDATION_LESSONS are defined in data bundle', function() {
    assert.ok(bundleCode.indexOf('FOUNDATION_LESSONS') >= 0,
      'FOUNDATION_LESSONS missing from data bundle');
  });

  test('getSurahWords function exists in data bundle', function() {
    assert.ok(bundleCode.indexOf('getSurahWords') >= 0,
      'getSurahWords missing from data bundle');
  });
});

// ═══════════════════════════════════════════════════════════════
// HTML REFERENCES TO PRODUCTION ASSETS
// ═══════════════════════════════════════════════════════════════

suite('Production HTML Asset References', function() {
  var htmlPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('  \u26A0 index.html not found — skipping');
    return;
  }
  var html = fs.readFileSync(htmlPath, 'utf8');

  test('HTML references app.bundle.min.js', function() {
    assert.ok(html.indexOf('app.bundle.min.js') >= 0,
      'Missing app.bundle.min.js reference');
  });

  test('HTML references data.bundle.min.js', function() {
    assert.ok(html.indexOf('data.bundle.min.js') >= 0,
      'Missing data.bundle.min.js reference');
  });

  test('HTML references manifest.json', function() {
    assert.ok(html.indexOf('manifest.json') >= 0,
      'Missing manifest.json reference');
  });

  test('CSS is inlined in HTML (production bundles CSS into <style>)', function() {
    assert.ok(html.indexOf('<style>') >= 0 && html.indexOf('--bg:') >= 0,
      'Missing inline CSS in production HTML');
  });

  test('SW registration exists in app bundle (not in HTML)', function() {
    var bundlePath = path.join(DIST, 'js/app.bundle.min.js');
    if (!fs.existsSync(bundlePath)) return;
    var bundle = fs.readFileSync(bundlePath, 'utf8');
    assert.ok(bundle.indexOf('serviceWorker') >= 0 || bundle.indexOf('sw.js') >= 0,
      'SW registration not found in app bundle');
  });

  test('No stale source references (app.bundle.js without .min)', function() {
    assert.ok(html.indexOf('app.bundle.js') < 0 ||
      html.indexOf('app.bundle.min.js') >= 0,
      'Stale app.bundle.js reference found (should use .min version)');
  });
});

// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER PRECACHE INTEGRITY
// ═══════════════════════════════════════════════════════════════

suite('Service Worker Precache', function() {
  var swPath = path.join(DIST, 'sw.js');
  if (!fs.existsSync(swPath)) {
    console.log('  \u26A0 sw.js not found — skipping');
    return;
  }
  var sw = fs.readFileSync(swPath, 'utf8');

  // Per-surah files are generated by build step 4b.
  // If they don't exist, the Quran reader falls back to monolithic bundle.
  var quranDir = path.join(DIST, 'js', 'quran');
  var perSurahExist = fs.existsSync(quranDir);
  if (!perSurahExist) {
    console.log('    \u26A0  dist/js/quran/ not found — per-surah async loading unavailable');
    console.log('       App will fall back to monolithic quran.bundle.min.js');
  }

  test('SW precaches app.bundle.min.js', function() {
    assert.ok(sw.indexOf('app.bundle.min.js') >= 0,
      'app.bundle.min.js not in SW precache');
  });

  test('SW precaches data.bundle.min.js', function() {
    assert.ok(sw.indexOf('data.bundle.min.js') >= 0,
      'data.bundle.min.js not in SW precache');
  });

  test('SW precaches styles.min.css', function() {
    assert.ok(sw.indexOf('styles.min.css') >= 0,
      'styles.min.css not in SW precache');
  });

  test('SW precaches index.html', function() {
    assert.ok(sw.indexOf('index.html') >= 0,
      'index.html not in SW precache');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
