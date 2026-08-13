#!/usr/bin/env node
/**
 * occurrence-uniqueness.test.js — Regression guard: every "context" of a
 * word must be unique.
 *
 * Guards against the bug class where a word's occurrence list contained two
 * entries that display the SAME ayah text, so clicking "Next context" in the
 * word card showed the same verse with no visible change. Root cause found in
 * js/data/words-surah-26-shuara.js: the Fir'awn entry for 26:11 had
 * copy-pasted the 20:24 ayah text ("اذْهَبْ إِلَىٰ فِرْعَوْنَ إِنَّهُ طَغَىٰ"),
 * making contexts [1] and [2] identical.
 *
 * Scans every canonical word (after the real deduplication pipeline) and
 * asserts:
 *   - no two occurrences share the same normalized ayah text
 *   - no two occurrences share the same verse key (surahId:verseKey)
 *   - every occurrence of a multi-context word carries actual ayah content
 *
 * Run: node test/occurrence-uniqueness.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + (e.message || e).split('\n').join('\n     '));
  }
}

function suite(name, fn) {
  console.log('\n\uD83D\uDCCB ' + name);
  fn();
}

// ═══════════════════════════════════════════════════════════════
// LOAD THE REAL DATA PIPELINE (same load order as build.js)
// ═══════════════════════════════════════════════════════════════

function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; convert to var
  // exactly like coverage-accuracy.test.js / corpus-characters.test.js do.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  global.eval(code);
}

load('js/data-core/vocab-data.js');
load('js/data/surahs.js');

// Thematic + per-surah word files (build.js order: thematic alphabetical,
// then per-surah sorted by surah number). juz-data / occurrence-index are
// derived artifacts, not word sources.
var dataDir = path.join(__dirname, '..', 'js', 'data');
var entries = fs.readdirSync(dataDir).filter(function (f) {
  return f.slice(-3) === '.js' && f.indexOf('words-') === 0;
});
var thematic = entries.filter(function (f) { return !/^words-surah-\d+-/.test(f); }).sort();
var perSurah = entries.filter(function (f) { return /^words-surah-\d+-/.test(f); })
  .sort(function (a, b) {
    return parseInt(a.match(/words-surah-(\d+)/)[1], 10) - parseInt(b.match(/words-surah-(\d+)/)[1], 10);
  });
thematic.concat(perSurah).forEach(function (f) { load('js/data/' + f); });

assignWordIds();
deduplicateVocabulary();

var canonical = global.CANONICAL_WORDS || [];

// Normalize for comparison: strip HTML and Arabic diacritics so two contexts
// that render identically are treated as duplicates.
function normalizeAyah(t) {
  return (t || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Occurrence uniqueness (canonical vocabulary)', function () {
  test('Pipeline loads: canonical words populated', function () {
    assert.ok(Array.isArray(canonical) && canonical.length > 0,
      'CANONICAL_WORDS should be populated (got ' + (canonical ? canonical.length : 'none') + ')');
  });

  test('No word has two occurrences with identical ayah text', function () {
    var problems = [];
    for (var ci = 0; ci < canonical.length; ci++) {
      var w = canonical[ci];
      var occs = w.occurrences || [];
      if (occs.length < 2) continue;
      var seen = {};
      for (var oi = 0; oi < occs.length; oi++) {
        var key = normalizeAyah(occs[oi].ayahA);
        if (!key) continue; // empty text handled by the content test below
        if (seen[key] !== undefined) {
          problems.push(w.id + ' ' + w.arabic + ' — occurrences [' + seen[key] + '] (' +
            occs[seen[key]].verseKey + ') and [' + oi + '] (' + occs[oi].verseKey +
            ') show the same ayah text: ' + key.slice(0, 60));
        } else {
          seen[key] = oi;
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' word(s) with duplicate contexts:\n  ' + problems.slice(0, 10).join('\n  '));
  });

  test('No word has two occurrences with the same verse key', function () {
    var problems = [];
    for (var ci = 0; ci < canonical.length; ci++) {
      var w = canonical[ci];
      var occs = w.occurrences || [];
      if (occs.length < 2) continue;
      var seen = {};
      for (var oi = 0; oi < occs.length; oi++) {
        var key = (occs[oi].surahId || '') + ':' + (occs[oi].verseKey || '');
        if (seen[key] !== undefined) {
          problems.push(w.id + ' ' + w.arabic + ' — duplicate verse key ' + key +
            ' at occurrences [' + seen[key] + '] and [' + oi + ']');
        } else {
          seen[key] = oi;
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' word(s) with duplicate verse keys:\n  ' + problems.slice(0, 10).join('\n  '));
  });

  test('Every occurrence of a multi-context word has real ayah content', function () {
    var problems = [];
    for (var ci = 0; ci < canonical.length; ci++) {
      var w = canonical[ci];
      var occs = w.occurrences || [];
      if (occs.length < 2) continue;
      for (var oi = 0; oi < occs.length; oi++) {
        if (!normalizeAyah(occs[oi].ayahA)) {
          problems.push(w.id + ' ' + w.arabic + ' — occurrence [' + oi + '] (' +
            occs[oi].verseKey + ') has no ayah text');
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' occurrence(s) without ayah content:\n  ' + problems.slice(0, 10).join('\n  '));
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('  occurrence-uniqueness.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
