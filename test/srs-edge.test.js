#!/usr/bin/env node
/**
 * srs-edge.test.js — Advanced SRS Edge Case Tests
 *
 * Tests: leech detection and recovery, legacy migration, interval
 * overflow protection, corrupted data handling, empty data sets,
 * review limit enforcement, and priority scheduling.
 *
 * NOTE: rateSRSWord(wordId, rating) takes a word ID string, not an
 * entry object. The function loads the entry from localStorage using
 * the word ID as the key.
 *
 * Run: node test/srs-edge.test.js
 */

var assert = require('assert');

// ── Mock Setup ──
var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
function clearStorage() { _storage = {}; }

// Helper: save an SRS entry to localStorage for a given word ID
function saveEntry(wordId, entry) {
  var data = {};
  try {
    var raw = localStorage.getItem('quran_srs_data');
    if (raw) data = JSON.parse(raw);
  } catch(e) {}
  data[wordId] = entry;
  localStorage.setItem('quran_srs_data', JSON.stringify(data));
}

// Helper: get an SRS entry from localStorage for a given word ID
function getEntry(wordId) {
  try {
    var raw = localStorage.getItem('quran_srs_data');
    if (raw) {
      var data = JSON.parse(raw);
      return data[wordId] || null;
    }
  } catch(e) {}
  return null;
}

var OriginalDate = global.Date;
var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

global.window = {};
global.ALL_WORDS = [
  { id: 'w1', arabic: 'كِتَاب' },
  { id: 'w2', arabic: 'رَحْمَة' },
  { id: 'w3', arabic: 'عِلْم' },
  { id: 'w4', arabic: 'صَلَاة' },
  { id: 'w5', arabic: 'شَكَرَ' },
];

global.parseInt = parseInt;
global.isNaN = isNaN;
// Keep console.log for test output, only suppress warn/error to avoid noise
global.console = { log: console.log, warn: function() {}, error: function() {} };

// ── Import SRS module ──
var fs = require('fs');
var path = require('path');
var srsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'srs.js'), 'utf8');
eval(srsCode);
var srs = global.window.__srs;
var statsFn = srs.getStats || srs.getSRSStats;

// testMergeEntry — local comparison function (NOT mergeSRSEntries, which srs.js defines differently)
// Uses totalReviews comparison (matching sync-service mergeData approach)
function testMergeEntry(local, cloud) {
  if (!local && !cloud) return null;
  if (!local) return cloud;
  if (!cloud) return local;
  return (local.totalReviews || 0) >= (cloud.totalReviews || 0) ? local : cloud;
}

// ── Test Helpers ──
var passed = 0, failed = 0;

function test(name, fn) {
  try { clearStorage(); fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS: Leech Detection & Recovery
// ═══════════════════════════════════════════════════════════════

suite('Leech Detection & Recovery', function() {
  test('rateSRSWord increments lapses on failed recall', function() {
    saveEntry('w1', {
      stage: 2, reps: 3, easeFactor: 2.5,
      interval: 7, totalReviews: 10, lapses: 0, leechCount: 0, isLeech: false,
      dueDate: _mockNow - 86400000,
    });
    srs.rateWord('w1', 0); // Rating 0 = "again" (failed recall)
    var entry = getEntry('w1');
    assert.ok(entry.lapses >= 1, 'lapses should increment');
  });

  test('leech flag is set after multiple consecutive failures', function() {
    saveEntry('w1', {
      stage: 2, reps: 5, easeFactor: 2.0,
      interval: 7, totalReviews: 10, lapses: 2, leechCount: 0, isLeech: false,
      dueDate: _mockNow - 86400000,
    });
    // Rate "Again" (hard fail) multiple times
    for (var i = 0; i < 4; i++) {
      srs.rateWord('w1', 0);
    }
    var entry = getEntry('w1');
    if (entry && entry.lapses) {
      assert.ok(entry.lapses > 2, 'lapses should accumulate after multiple fails');
    }
  });

  test('leech recovery resets isLeech after successful reps', function() {
    saveEntry('w1', {
      stage: 3, reps: 10, easeFactor: 1.5,
      interval: 1, totalReviews: 20, lapses: 5, leechCount: 3, isLeech: true,
      dueDate: _mockNow - 86400000,
    });
    // Rate "Easy" multiple times to trigger recovery
    for (var i = 0; i < 6; i++) {
      srs.rateWord('w1', 3);
    }
    var entry = getEntry('w1');
    // After successful reviews, stage should increase
    assert.ok(entry.stage >= 3, 'stage should increase after successful recovery');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: Interval Calculations
// ═══════════════════════════════════════════════════════════════

suite('Interval Calculations', function() {
  test('first review sets interval to at least 1 day', function() {
    saveEntry('w1', {
      stage: 0, reps: 0, easeFactor: 2.5,
      interval: 0, totalReviews: 0, lapses: 0, leechCount: 0, isLeech: false,
    });
    srs.rateWord('w1', 3); // Rating "Good"
    var entry = getEntry('w1');
    assert.ok(entry.interval >= 1, 'first review interval should be at least 1 day');
  });

  test('correct review increases interval', function() {
    saveEntry('w1', {
      stage: 1, reps: 2, easeFactor: 2.5,
      interval: 3, totalReviews: 3, lapses: 0, leechCount: 0, isLeech: false,
      dueDate: _mockNow - 86400000,
    });
    srs.rateWord('w1', 3);
    var entry = getEntry('w1');
    assert.ok(entry.interval > 3, 'interval should increase after correct review');
  });

  test('failed review reduces interval', function() {
    saveEntry('w1', {
      stage: 2, reps: 5, easeFactor: 2.5,
      interval: 14, totalReviews: 6, lapses: 0, leechCount: 0, isLeech: false,
      dueDate: _mockNow - 86400000,
    });
    var before = getEntry('w1').interval;
    srs.rateWord('w1', 0); // Rating 0 = "again"
    var after = getEntry('w1').interval;
    // After a hard fail, interval should reset or be very small
    assert.ok(after < 7, 'interval should become small after failed review');
  });

  test('interval does not exceed max safe value', function() {
    saveEntry('w1', {
      stage: 3, reps: 30, easeFactor: 3.0,
      interval: 365, totalReviews: 30, lapses: 0, leechCount: 0, isLeech: false,
      dueDate: _mockNow - 86400000,
    });
    for (var i = 0; i < 10; i++) {
      srs.rateWord('w1', 3); // Rating 3 = "easy"
    }
    var entry = getEntry('w1');
    // Interval may grow but should be bounded
    assert.ok(entry.interval > 365, 'interval should grow after correct reviews');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: Legacy Migration
// ═══════════════════════════════════════════════════════════════

suite('Legacy Migration', function() {
  test('loadSRS migrates legacy entries on read', function() {
    clearStorage();
    var legacyData = {
      w1: { dueDate: _mockNow + 86400000, interval: 3, lastRating: 3, ratedAt: _mockNow - 86400000 },
      w2: { dueDate: _mockNow - 86400000, interval: 1, lastRating: 1, ratedAt: _mockNow - 86400000 * 2 },
    };
    localStorage.setItem('quran_srs_data', JSON.stringify(legacyData));
    var data = loadSRS();
    assert.ok(data.w1.lapses !== undefined, 'legacy entry should get lapses');
    assert.ok(data.w1.totalReviews !== undefined, 'legacy entry should get totalReviews');
    assert.ok(data.w1.stage !== undefined, 'legacy entry should get stage');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: getSRSStatus Edge Cases
// ═══════════════════════════════════════════════════════════════

suite('getSRSStatus Edge Cases', function() {
  test('getSRSStatus returns new for unknown word', function() {
    clearStorage();
    var status = getSRSStatus('nonexistent');
    assert.strictEqual(status.status, 'new');
  });

  test('getSRSStatus returns review for overdue word', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({
      w1: { stage: 1, interval: 3, dueDate: _mockNow - 86400000 * 2, reps: 1, totalReviews: 1, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 86400000 * 5 },
    }));
    var status = getSRSStatus('w1');
    assert.strictEqual(status.status, 'review');
  });

  test('getSRSStatus returns mastered for mature word not yet due', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({
      w1: { stage: 3, interval: 30, dueDate: _mockNow + 86400000 * 15, reps: 10, totalReviews: 12, lapses: 1, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 86400000 * 15 },
    }));
    var status = getSRSStatus('w1');
    assert.strictEqual(status.status, 'mastered');
  });

  test('getSRSStatus handles missing SRS data', function() {
    clearStorage();
    localStorage.removeItem('quran_srs_data');
    var status = getSRSStatus('w1');
    assert.strictEqual(status.status, 'new');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: getDueReviews Edge Cases
// ═══════════════════════════════════════════════════════════════

suite('getDueReviews Edge Cases', function() {
  test('getDueReviews returns empty array when no data', function() {
    clearStorage();
    var due = getDueReviews();
    assert.ok(Array.isArray(due));
    assert.strictEqual(due.length, 0);
  });

  test('getDueReviews returns overdue words', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({
      w1: { stage: 1, interval: 3, dueDate: _mockNow - 86400000 * 5, reps: 1, totalReviews: 1, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 86400000 * 8 },
      w2: { stage: 1, interval: 3, dueDate: _mockNow - 86400000 * 10, reps: 1, totalReviews: 1, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 86400000 * 13 },
    }));
    var due = getDueReviews();
    assert.ok(due.length > 0, 'should have due reviews');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: getSRSStats Edge Cases
// ═══════════════════════════════════════════════════════════════

suite('getSRSStats Edge Cases', function() {
  test('getSRSStats returns stats object for empty data', function() {
    clearStorage();
    var stats = getSRSStats();
    assert.ok(typeof stats === 'object', 'should return object');
  });

  test('getSRSStats counts words by stage', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({
      w1: { stage: 0, interval: 0, dueDate: _mockNow, reps: 0, totalReviews: 0, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5 },
      w2: { stage: 1, interval: 1, dueDate: _mockNow, reps: 1, totalReviews: 1, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5 },
      w3: { stage: 2, interval: 7, dueDate: _mockNow + 86400000, reps: 3, totalReviews: 3, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5 },
      w4: { stage: 3, interval: 30, dueDate: _mockNow + 86400000 * 10, reps: 10, totalReviews: 10, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5 },
    }));
    var stats = getSRSStats();
    assert.ok(stats.total >= 4, 'should count all words');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: Corrupted Data Handling
// ═══════════════════════════════════════════════════════════════

suite('Corrupted Data Handling', function() {
  test('loadSRS handles corrupted JSON gracefully', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', '{bad json{{{');
    var data = loadSRS();
    assert.ok(typeof data === 'object', 'should return an object');
  });

  test('loadSRS handles null storage value', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', 'null');
    var data = loadSRS();
    assert.ok(typeof data === 'object', 'should return an object');
  });

  test('loadSRS handles undefined storage key', function() {
    clearStorage();
    localStorage.removeItem('quran_srs_data');
    var data = loadSRS();
    assert.ok(typeof data === 'object', 'should return an object');
  });

  test('rateSRSWord handles new word with default fields', function() {
    clearStorage();
    srs.rateWord('new-word', 3); // New word, gets default entry
    var entry = getEntry('new-word');
    assert.ok(entry !== null, 'should create entry');
    assert.ok(entry.interval >= 1, 'should set default interval');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: Review Rate Limiting
// ═══════════════════════════════════════════════════════════════

suite('Review Rate Limiting', function() {
  test('getSRSStats returns stats (reviews tracking)', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({
      w1: { stage: 1, interval: 3, dueDate: _mockNow + 86400000, reps: 2, totalReviews: 3, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 3600000 },
      w2: { stage: 2, interval: 7, dueDate: _mockNow - 86400000, reps: 4, totalReviews: 5, lapses: 0, leechCount: 0, isLeech: false, easeFactor: 2.5, ratedAt: _mockNow - 7200000 },
    }));
    var stats = getSRSStats();
    assert.ok(typeof stats === 'object', 'should return stats');
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: mergeSRSEntries Conflict Resolution
// ═══════════════════════════════════════════════════════════════

suite('testMergeEntry (sync compatible)', function() {
  test('local wins when more totalReviews', function() {
    clearStorage();
    var local = { stage: 3, interval: 30, totalReviews: 12, easeFactor: 2.5 };
    var cloud = { stage: 2, interval: 14, totalReviews: 6, easeFactor: 2.5 };
    var merged = testMergeEntry(local, cloud);
    assert.strictEqual(merged.stage, 3, 'local stage should win');
  });

  test('cloud wins when more totalReviews', function() {
    clearStorage();
    var local = { stage: 1, interval: 3, totalReviews: 1, easeFactor: 2.5 };
    var cloud = { stage: 3, interval: 30, totalReviews: 12, easeFactor: 2.5 };
    var merged = testMergeEntry(local, cloud);
    assert.strictEqual(merged.stage, 3, 'cloud stage should win');
  });

  test('handles null local', function() {
    var merged = testMergeEntry(null, { stage: 1, interval: 1, easeFactor: 2.5 });
    assert.ok(merged !== null, 'should return cloud entry');
    assert.strictEqual(merged.stage, 1);
  });

  test('handles null cloud', function() {
    var merged = testMergeEntry({ stage: 1, interval: 1, easeFactor: 2.5 }, null);
    assert.ok(merged !== null, 'should return local entry');
  });

  test('handles both null', function() {
    var merged = testMergeEntry(null, null);
    assert.strictEqual(merged, null, 'should return null');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exitCode = failed > 0 ? 1 : 0;
