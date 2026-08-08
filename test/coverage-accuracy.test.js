#!/usr/bin/env node
/**
 * coverage-accuracy.test.js — REAL token-level coverage regression tests
 *
 * The app previously claimed the Foundation Course's 100 words cover
 * "~84% of the Quran" — computed from an inflated legacy formula
 * (sum of hand-authored w.occ estimates divided by another legacy
 * estimate). The real measured coverage is ~21% for those 100 words
 * and ~24% for the full 901-word set.
 *
 * These tests lock in the real numbers (verified at fix time from a
 * token-level scan of the actual corpus via OCCURRENCE_INDEX_* data):
 *   - total corpus tokens: 77,429
 *   - full 901-word union coverage: 18,908 tokens = 24.42%
 *   - Foundation 100-word union coverage: 16,459 tokens = 21.26%
 *
 * If the corpus or vocabulary changes, re-run
 * `node scripts/build-occurrence-index.js` and update these constants
 * (a deliberate failure — coverage claims must always be re-verified).
 *
 * Run: node test/coverage-accuracy.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + (e.message || e).split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// LOAD REAL MODULES (same chain as the bundled app)
// ═══════════════════════════════════════════════════════════════

globalThis.window = globalThis;

function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; the app's
  // modules rely on shared globals (ALL_WORDS, CANONICAL_WORDS, ...),
  // so convert to var exactly like foundation-course.test.js does.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  global.eval(code);
}

load('js/data/occurrence-index.js');
load('js/data-core/vocab-data.js');
fs.readdirSync(path.join(__dirname, '..', 'js/data')).filter(function(f) {
  return f.startsWith('words-') && f.endsWith('.js');
}).sort().forEach(function(f) {
  load('js/data/' + f);
});
load('js/data-core/foundation.js');

// Bootstrap the real foundation course (dedup is lazy — trigger it first)
var CANON = getCanonicalWords();
buildFoundationCourse();

// Deterministic SRS stub: mastered set of canonical ids
var _masteredIds = {};
global.loadSRS = function() { return JSON.parse(JSON.stringify(_masteredIds)); };

function masterAll() {
  _masteredIds = {};
  for (var i = 0; i < CANON.length; i++) _masteredIds[CANON[i].id] = { stage: 3, interval: 365 };
}
function masterNone() { _masteredIds = {}; }
function masterFirstN(n) {
  _masteredIds = {};
  for (var i = 0; i < Math.min(n, CANON.length); i++) _masteredIds[CANON[i].id] = { stage: 3, interval: 365 };
}

// ═══════════════════════════════════════════════════════════════
// REAL CORPUS STATS (from OCCURRENCE_INDEX_TOKEN_COUNTS)
// ═══════════════════════════════════════════════════════════════

suite('Real corpus stats', function() {
  test('Total corpus tokens is the real token count (77,429)', function() {
    var stats = getRealCorpusStats();
    assert.strictEqual(stats.totalTokens, 77429,
      'Total corpus tokens should be 77,429 (re-verify if the corpus changed), got ' + stats.totalTokens);
  });

  test('Per-key token counts are present and sum to the union coverage (18,908)', function() {
    var stats = getRealCorpusStats();
    assert.ok(stats.counts, 'counts should be populated');
    var sum = 0;
    for (var k in stats.counts) sum += stats.counts[k];
    assert.strictEqual(sum, 18908,
      'Sum of per-key token counts should be 18,908 (union coverage), got ' + sum);
  });

  test('getRealWordTokenCount returns real counts (> 0 for common words)', function() {
    var stats = getRealCorpusStats();
    var found = 0;
    for (var i = 0; i < CANON.length && found < 5; i++) {
      var c = getRealWordTokenCount(CANON[i]);
      if (c !== null && c > 0) { found++; assert.ok(typeof c === 'number'); }
    }
    assert.ok(found >= 5, 'Expected several canonical words with real token counts');
  });
});

// ═══════════════════════════════════════════════════════════════
// REAL COVERAGE CALCULATIONS
// ═══════════════════════════════════════════════════════════════

suite('Real coverage calculations', function() {
  test('calculateCoverage reports 0 coverage with nothing mastered', function() {
    masterNone();
    var cov = calculateCoverage();
    assert.strictEqual(cov.coveragePercent, 0);
    assert.strictEqual(cov.masteredWords, 0);
    assert.strictEqual(cov.totalOccurrences, 77429, 'totalOccurrences should be real corpus tokens');
  });

  test('calculateCoverage reports ~24.4% (NOT 84%+) with every word mastered', function() {
    masterAll();
    var cov = calculateCoverage();
    assert.ok(Math.abs(cov.coveragePercent - 24.4) < 0.5,
      'Full-set coverage should be ~24.4% (real token coverage), got ' + cov.coveragePercent);
    assert.strictEqual(cov.wordMasteryPercent, 100);
    assert.strictEqual(cov.masteredWords, CANON.length);
    assert.strictEqual(cov.totalOccurrences, 77429);
  });

  test('Partial mastery produces intermediate real coverage', function() {
    masterFirstN(50);
    var cov = calculateCoverage();
    assert.ok(cov.coveragePercent > 0 && cov.coveragePercent < 24.4,
      'Partial coverage should be between 0 and 24.4, got ' + cov.coveragePercent);
  });

  test('getFoundationTotalCoveragePercent reports ~21.3% (NOT 84+)', function() {
    var pct = getFoundationTotalCoveragePercent();
    assert.ok(Math.abs(pct - 21.3) < 0.5,
      'Foundation total coverage should be ~21.3% (real), got ' + pct);
  });

  test('getFoundationCoverage reports ~21.3% when all foundation words mastered', function() {
    masterAll();
    var fc = getFoundationCoverage();
    assert.strictEqual(fc.totalFoundationWords, 100);
    assert.ok(Math.abs(fc.foundationCoveragePercent - 21.3) < 0.5,
      'Foundation coverage should be ~21.3% (real), got ' + fc.foundationCoveragePercent);
  });

  test('No impossible "next milestone" targets at full real coverage', function() {
    masterAll();
    var cov = calculateCoverage();
    var ms = getMilestoneStatus(cov.coveragePercent);
    assert.strictEqual(ms.nextMilestone, null,
      'At full real coverage there should be no unreachable next milestone');
    assert.ok(ms.currentMilestone && ms.currentMilestone.pct <= 25,
      'Current milestone should be within the real reachable range');
  });
});

// ═══════════════════════════════════════════════════════════════
// LESSON DISPLAY STRINGS & COPY
// ═══════════════════════════════════════════════════════════════

suite('Lesson display strings & user-facing copy', function() {
  test('Lesson display strings use real cumulative coverage (21.3% at lesson 10)', function() {
    var ds = getFoundationLessonDisplayStrings(9);
    assert.ok(ds, 'display strings should exist for lesson 10');
    assert.strictEqual(ds.cumulativeCoverage, '21.3%',
      'Lesson 10 cumulative should be the real ~21.3%, got ' + ds.cumulativeCoverage);
  });

  test('Cumulative coverage grows across lessons (monotonic)', function() {
    var prev = 0;
    for (var li = 0; li < 10; li++) {
      var ds = getFoundationLessonDisplayStrings(li);
      assert.ok(ds, 'display strings for lesson ' + (li + 1));
      var num = parseFloat(ds.cumulativeCoverage);
      assert.ok(num >= prev - 0.05, 'cumulative should not decrease (lesson ' + (li + 1) + ': ' + num + ' < ' + prev + ')');
      prev = num;
    }
  });

  test('Lesson 10 context resolves the real {coverage} number', function() {
    var ctx = getFoundationLessonContextMsg(9);
    assert.ok(ctx.context.indexOf('{coverage}') < 0, 'placeholder should be resolved');
    assert.ok(ctx.context.indexOf('21.3%') >= 0,
      'lesson 10 context should contain the real 21.3% figure, got: ' + ctx.context);
    assert.ok(ctx.context.indexOf('84') < 0, 'no legacy 84% claim in lesson context');
  });

  test('Milestone message contains no legacy 84% claim', function() {
    masterAll();
    var msg = getFoundationMilestoneMessage().message;
    assert.ok(msg.indexOf('{coverage}') < 0, 'coverage placeholder should be resolved');
    assert.ok(msg.indexOf('84%') < 0, 'no 84% claim in milestone message: ' + msg);
  });

  test('No "84%" claim remains in user-facing source files', function() {
    var files = [
      'js/data.js',
      'js/data-core/foundation.js',
      'js/data-core/adaptive.js',
      'js/data-core/progress-aggregator.js',
      'js/app.js',
      'js/ui/stats-ui.js',
    ];
    var hits = [];
    files.forEach(function(rel) {
      var lines = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').split('\n');
      lines.forEach(function(line, idx) {
        if (line.indexOf('84%') >= 0) hits.push(rel + ':' + (idx + 1) + ': ' + line.trim());
      });
    });
    assert.strictEqual(hits.length, 0, 'Found legacy 84% references:\n' + hits.join('\n'));
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exitCode = failed > 0 ? 1 : 0;
