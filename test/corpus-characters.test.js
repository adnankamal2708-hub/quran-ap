#!/usr/bin/env node
/**
 * corpus-characters.test.js — Regression guard against unrenderable
 * characters in Quranic text data.
 *
 * Guards against the corruption class that shipped white "?" placeholders
 * mid-verse in the Quran reader: 96 literal U+FFFD replacement characters
 * had been baked into 48 verses of quran-data.js (plus 3 vocabulary
 * ayahA strings) by a bad encoding round-trip. A font can never render
 * U+FFFD or garbage code points — the data must be clean at the source.
 *
 * Scans:
 *   - js/quran/quran-data.js  : every verse text, translation, surah name
 *   - js/data/words-*.js      : every word's `arabic` and occurrence
 *                               `ayahA` (rendered Quranic text)
 *
 * Flagged code points (all render as tofu/boxes or invisible garbage):
 *   - U+FFFD replacement character (the "?" bug)
 *   - C0/C1 control characters (except tab / LF / CR)
 *   - private-use code points (U+E000–U+F8FF, supplementary planes)
 *   - Unicode noncharacters (U+FDD0–U+FDEF, U+xFFFE/U+xFFFF)
 *   - legacy Arabic presentation forms (U+FB50–U+FDFF, U+FE70–U+FEFF)
 *
 * Run: node test/corpus-characters.test.js
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
// SUSPICIOUS-CHARACTER DETECTOR
// ═══════════════════════════════════════════════════════════════

function suspiciousCodePoints(text) {
  var out = [];
  for (var i = 0; i < text.length; i++) {
    var cp = text.codePointAt(i);
    var reason = null;
    if (cp === 0xFFFD) {
      reason = 'U+FFFD replacement character — data corruption (the "?" tofu bug)';
    } else if (cp <= 0x1F && cp !== 0x09 && cp !== 0x0A && cp !== 0x0D) {
      reason = 'C0 control character';
    } else if (cp >= 0x7F && cp <= 0x9F) {
      reason = 'C1 control character';
    } else if ((cp >= 0xE000 && cp <= 0xF8FF) ||
               (cp >= 0xF0000 && cp <= 0xFFFFD) ||
               (cp >= 0x100000 && cp <= 0x10FFFD)) {
      reason = 'private-use code point (renders as tofu)';
    } else if (cp >= 0xFDD0 && cp <= 0xFDEF ||
               (cp & 0xFFFF) === 0xFFFE ||
               (cp & 0xFFFF) === 0xFFFF) {
      reason = 'Unicode noncharacter (unrenderable by design)';
    } else if ((cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)) {
      reason = 'legacy Arabic presentation form — use the U+0600 block instead';
    }
    if (reason) {
      if (cp > 0xFFFF) i++; // skip low surrogate of a pair already reported
      out.push({ cp: cp, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), reason: reason });
    }
  }
  return out;
}

function describe(issues) {
  return issues.map(function (s) { return s.hex + ' ' + s.reason; }).join('; ');
}

// ═══════════════════════════════════════════════════════════════
// LOAD THE QURAN CORPUS (same parse path as build.js)
// ═══════════════════════════════════════════════════════════════

var QURAN_TEXT = null;
try {
  global.window = {};
  new Function(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran', 'quran-data.js'), 'utf8'))();
  QURAN_TEXT = global.window.__QURAN_TEXT;
} catch (e) {
  console.log('  \u274C Could not parse quran-data.js: ' + e.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Quran corpus (js/quran/quran-data.js)', function () {
  test('Parses and exposes all 6,236 verses', function () {
    assert.ok(QURAN_TEXT, 'QURAN_TEXT should be exposed on window.__QURAN_TEXT');
    var total = 0;
    for (var sid in QURAN_TEXT) total += (QURAN_TEXT[sid].verses || []).length;
    assert.strictEqual(total, 6236, 'expected 6,236 verses, got ' + total);
  });

  test('No unrenderable characters in any verse text', function () {
    var problems = [];
    for (var sid in QURAN_TEXT) {
      var verses = QURAN_TEXT[sid].verses || [];
      for (var vi = 0; vi < verses.length; vi++) {
        var issues = suspiciousCodePoints(verses[vi].text || '');
        if (issues.length > 0) {
          problems.push(sid + ':' + verses[vi].id + ' → ' + describe(issues));
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' verse(s) with unrenderable characters:\n  ' + problems.slice(0, 10).join('\n  '));
  });

  test('No unrenderable characters in any verse translation', function () {
    var problems = [];
    for (var sid in QURAN_TEXT) {
      var verses = QURAN_TEXT[sid].verses || [];
      for (var vi = 0; vi < verses.length; vi++) {
        var issues = suspiciousCodePoints(verses[vi].translation || '');
        if (issues.length > 0) {
          problems.push(sid + ':' + verses[vi].id + ' → ' + describe(issues));
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' translation(s) with unrenderable characters:\n  ' + problems.slice(0, 10).join('\n  '));
  });

  test('No unrenderable characters in any surah name', function () {
    var problems = [];
    for (var sid in QURAN_TEXT) {
      var issues = suspiciousCodePoints(QURAN_TEXT[sid].name || '');
      if (issues.length > 0) problems.push(sid + ' → ' + describe(issues));
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' surah name(s) with unrenderable characters:\n  ' + problems.join('\n  '));
  });
});

suite('Vocabulary data (js/data/words-*.js)', function () {
  test('No unrenderable characters in word arabic or occurrence ayahA fields', function () {
    // Load the same module chain the app uses (defines ALL_WORDS).
    function load(rel) {
      var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      // let/const at eval top level do not leak to global scope; convert to var
      // exactly like coverage-accuracy.test.js does.
      code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
      global.eval(code);
    }
    load('js/data-core/vocab-data.js');
    fs.readdirSync(path.join(__dirname, '..', 'js/data')).filter(function (f) {
      return f.indexOf('words-') === 0 && f.slice(-3) === '.js';
    }).sort().forEach(function (f) {
      load('js/data/' + f);
    });

    assert.ok(Array.isArray(global.ALL_WORDS) && global.ALL_WORDS.length > 0,
      'ALL_WORDS should be populated (got ' + (global.ALL_WORDS ? global.ALL_WORDS.length : 'none') + ')');

    var problems = [];
    for (var wi = 0; wi < global.ALL_WORDS.length; wi++) {
      var w = global.ALL_WORDS[wi];
      var arabicIssues = suspiciousCodePoints(w.arabic || '');
      if (arabicIssues.length > 0) {
        problems.push(w.id + ' ' + w.arabic + ' [arabic] → ' + describe(arabicIssues));
      }
      if (w.occurrences) {
        for (var oi = 0; oi < w.occurrences.length; oi++) {
          var occ = w.occurrences[oi];
          var ayahIssues = suspiciousCodePoints(occ.ayahA || '');
          if (ayahIssues.length > 0) {
            problems.push(w.id + ' ' + (occ.verseKey || '') + ' [ayahA] → ' + describe(ayahIssues));
          }
        }
      }
    }
    assert.strictEqual(problems.length, 0,
      'Found ' + problems.length + ' word field(s) with unrenderable characters:\n  ' + problems.slice(0, 10).join('\n  '));
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('  corpus-characters.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
