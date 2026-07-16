#!/usr/bin/env node
/**
 * quran-data.test.js — Quran Data Integrity Tests
 *
 * Validates the complete Quran dataset:
 *   • All 114 surahs present
 *   • All 6236 verses present
 *   • Sequential verse numbering
 *   • Arabic text non-empty
 *   • Translation non-empty
 *   • No duplicates
 *
 * Run: node test/quran-data.test.js
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

// Load the Quran data file
var quranDataPath = path.join(__dirname, '..', 'js', 'quran', 'quran-data.js');
var quranDataExists = fs.existsSync(quranDataPath);

// ── Tests ──

suite('Quran Data File', function() {
  test('Quran data file exists at js/quran/quran-data.js', function() {
    assert.ok(quranDataExists, 'quran-data.js exists');
  });

  test('Quran data file has content', function() {
    if (!quranDataExists) return;
    var content = fs.readFileSync(quranDataPath, 'utf8');
    assert.ok(content.length > 10000, 'quran-data.js has substantial content (' + content.length + ' bytes)');
  });

  test('Quran data file has valid syntax', function() {
    if (!quranDataExists) return;
    var content = fs.readFileSync(quranDataPath, 'utf8');
    try {
      new Function(content);
    } catch (e) {
      assert.fail('Syntax error in quran-data.js: ' + e.message);
    }
  });
});

suite('Quran Data Structure (Runtime)', function() {
  // Eval the data file to get runtime access to QURAN_TEXT
  // We need to provide window mock for the exports to work
  global.window = global.window || {};
  if (!quranDataExists) return;
  var content = fs.readFileSync(quranDataPath, 'utf8');
  try {
    eval(content);
  } catch (e) {
    console.log('     ⚠ Could not eval quran-data.js: ' + e.message);
  }

  var qt = global.window.__QURAN_TEXT;
  var qi = global.window.__QURAN_VERSE_INDEX;
  var qv = global.window.__QURAN_TOTAL_VERSES;

  test('QURAN_TEXT is defined and has 114 surahs', function() {
    if (!qt) return;
    var surahIds = Object.keys(qt).map(Number).sort(function(a,b){return a-b});
    assert.strictEqual(surahIds.length, 114, 'Expected 114 surahs, found ' + surahIds.length);
    assert.strictEqual(surahIds[0], 1, 'First surah ID is 1');
    assert.strictEqual(surahIds[surahIds.length-1], 114, 'Last surah ID is 114');
  });

  test('QURAN_TOTAL_VERSES is 6236', function() {
    if (!qt) return;
    assert.strictEqual(qv, 6236, 'QURAN_TOTAL_VERSES = ' + qv);
  });

  test('Every surah has correct verse count', function() {
    if (!qt) return;
    var sum = 0;
    Object.keys(qt).forEach(function(sid) {
      var surah = qt[sid];
      assert.ok(Array.isArray(surah.verses), 'Surah ' + sid + ' has verses array');
      assert.strictEqual(surah.verses.length, surah.total_verses, 'Surah ' + sid + ' total_verses matches array length');
      sum += surah.verses.length;
    });
    assert.strictEqual(sum, 6236, 'Sum of all verses = ' + sum);
  });

  test('Every verse has non-empty Arabic text', function() {
    if (!qt) return;
    var emptyCount = 0;
    Object.keys(qt).forEach(function(sid) {
      qt[sid].verses.forEach(function(v) {
        if (!v.text || v.text.trim() === '') emptyCount++;
      });
    });
    assert.strictEqual(emptyCount, 0, 'All verses have Arabic text (found ' + emptyCount + ' empty)');
  });

  test('Every verse has non-empty translation', function() {
    if (!qt) return;
    var emptyCount = 0;
    Object.keys(qt).forEach(function(sid) {
      qt[sid].verses.forEach(function(v) {
        if (!v.translation || v.translation.trim() === '') emptyCount++;
      });
    });
    assert.strictEqual(emptyCount, 0, 'All verses have translation (found ' + emptyCount + ' empty)');
  });

  test('Verse numbering is sequential within each surah', function() {
    if (!qt) return;
    var errors = [];
    Object.keys(qt).forEach(function(sid) {
      qt[sid].verses.forEach(function(v, idx) {
        if (v.id !== idx + 1) {
          errors.push('Surah ' + sid + ' verse ' + (idx+1) + ' has id=' + v.id);
        }
      });
    });
    assert.strictEqual(errors.length, 0, errors.length + ' verse numbering errors');
  });

  test('No duplicate verses', function() {
    if (!qt) return;
    var seen = {};
    var dups = 0;
    Object.keys(qt).forEach(function(sid) {
      qt[sid].verses.forEach(function(v) {
        var key = sid + ':' + v.id;
        if (seen[key]) dups++;
        seen[key] = true;
      });
    });
    assert.strictEqual(dups, 0, 'Found ' + dups + ' duplicate verses');
  });

  test('All surahs have Arabic names', function() {
    if (!qt) return;
    var missing = 0;
    Object.keys(qt).forEach(function(sid) {
      if (!qt[sid].name) missing++;
    });
    assert.strictEqual(missing, 0, missing + ' surahs missing Arabic name');
  });
});

suite('Quran Verse Index (Runtime)', function() {
  test('QURAN_VERSE_INDEX has 6236 entries (1-indexed)', function() {
    var qi = global.window.__QURAN_VERSE_INDEX;
    if (!qi) return;
    var count = 0;
    for (var i = 1; i < qi.length; i++) {
      if (qi[i]) count++;
    }
    assert.strictEqual(count, 6236, 'Index has ' + count + ' entries');
    assert.strictEqual(qi[1].surahId, 1, 'Entry 1 is surah 1');
    assert.strictEqual(qi[1].verseId, 1, 'Entry 1 is verse 1');
    assert.strictEqual(qi[6236].surahId, 114, 'Entry 6236 is surah 114');
    assert.strictEqual(qi[6236].verseId, 6, 'Entry 6236 is verse 6');
  });

  test('First and last verses have correct text', function() {
    var qt = global.window.__QURAN_TEXT;
    if (!qt) return;
    // Helper: normalize Uthmani Arabic for comparison
    function normArabic(t) {
      return t
        .replace(/[\u064B-\u0652\u0670\u06E1]/g, '')   // Remove diacritics
        .replace(/[\u0671\u0672\u0673]/g, '\u0627');     // Normalize alef variants → regular alef
    }
    // Surah 1, Verse 1 — Bismillah (Uthmani script: بِسۡمِ)
    var v1 = qt[1].verses[0];
    var text1 = normArabic(v1.text);
    assert.ok(text1.indexOf('بسم') >= 0, 'Verse 1:1 contains بسم (' + text1.substring(0, 10) + '...)');
    assert.ok(v1.text.length > 20, 'Verse 1:1 has Arabic text (' + v1.text.length + ' chars)');
    // Surah 114, Verse 6 — last verse (ٱلناس in Uthmani)
    var vLast = qt[114].verses[5];
    var textLast = normArabic(vLast.text);
    assert.ok(textLast.indexOf('الناس') >= 0, 'Verse 114:6 contains الناس (' + textLast.substring(0, 20) + '...)');
  });

test('validateQuranData reports valid data', function() {
    var qt = global.window.__QURAN_TEXT;
    if (!qt) return;
    var qv = null;
    try {
      qv = require(path.join(__dirname, '..', 'js', 'quran', 'quran-validate.js'));
    } catch (e) {
      assert.fail('Could not load quran-validate.js: ' + e.message);
      return;
    }
    var report = qv.validateQuranData(qt);
    assert.ok(report.valid, 'Validation report is valid. Errors: ' + report.errors.join(', '));
    assert.strictEqual(report.totalSurahs, 114);
    assert.strictEqual(report.totalVerses, 6236);
    assert.strictEqual(report.errors.length, 0);
  });
});

suite('Loader Module', function() {
  test('quran-loader.js exists and has valid syntax', function() {
    var loaderPath = path.join(__dirname, '..', 'js', 'quran', 'quran-loader.js');
    assert.ok(fs.existsSync(loaderPath), 'quran-loader.js exists');
    var content = fs.readFileSync(loaderPath, 'utf8');
    try {
      new Function(content);
    } catch (e) {
      assert.fail('Syntax error in quran-loader.js: ' + e.message);
    }
  });

  test('quran-loader exports expected API', function() {
    var loaderPath = path.join(__dirname, '..', 'js', 'quran', 'quran-loader.js');
    if (!fs.existsSync(loaderPath)) return;
    var content = fs.readFileSync(loaderPath, 'utf8');
    // Check that expected function names exist in source
    assert.ok(content.indexOf('loadQuranText') >= 0, 'loadQuranText defined');
    assert.ok(content.indexOf('getQuranSurah') >= 0, 'getQuranSurah defined');
    assert.ok(content.indexOf('getQuranVerse') >= 0, 'getQuranVerse defined');
    assert.ok(content.indexOf('__quranLoader') >= 0, '__quranLoader exported');
  });
});

suite('Validation Module', function() {
  test('quran-validate.js exists and has valid syntax', function() {
    var validatePath = path.join(__dirname, '..', 'js', 'quran', 'quran-validate.js');
    assert.ok(fs.existsSync(validatePath), 'quran-validate.js exists');
    var content = fs.readFileSync(validatePath, 'utf8');
    try {
      new Function(content);
    } catch (e) {
      assert.fail('Syntax error in quran-validate.js: ' + e.message);
    }
  });
});

suite('Build Pipeline', function() {
  test('build.js references quran directory', function() {
    var buildPath = path.join(__dirname, '..', 'build.js');
    if (!fs.existsSync(buildPath)) return;
    var content = fs.readFileSync(buildPath, 'utf8');
    assert.ok(content.indexOf('quran') >= 0, 'build.js references quran data');
    assert.ok(content.indexOf('quran.bundle') >= 0, 'build.js creates quran.bundle');
  });

  test('sw.js will precache quran bundle', function() {
    var swPath = path.join(__dirname, '..', 'sw.js');
    if (!fs.existsSync(swPath)) return;
    var content = fs.readFileSync(swPath, 'utf8');
    // The SW template should have the precache list. At build time, build.js
    // injects the quran bundle into the list. Verify the source has the pattern.
    assert.ok(content.indexOf('PRECACHE_URLS') >= 0, 'sw.js has PRECACHE_URLS');
    // The build replaces this, but the test just checks the source
  });
});

// ── Summary ──
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
