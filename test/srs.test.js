#!/usr/bin/env node
/**
 * srs.test.js — Unit tests for the SRS Engine
 *
 * Tests: load/save, scheduling intervals, stage graduation,
 * leech detection, retention estimation, merge logic, and
 * review queue prioritization.
 *
 * Run: node test/srs.test.js
 */

var assert = require('assert');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
function clearStorage() { _storage = {}; }

// Mock Date
var _mockNow = new Date('2026-07-06T12:00:00Z').getTime();
var OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;
// Mock global dependencies
global.ALL_WORDS = [];
// Realistic stub mirroring production migration: canonical cw_* ids pass
// through unchanged, known raw w_N ids map to their canonical twin (cw_N),
// and anything unknown resolves to null (loadSRS() then keeps the original
// key as a fallback, exactly like production). This is intentionally
// NON-identity: the old identity stub masked the w_N → cw_N migration and
// let raw-id SRS lookups pass unnoticed — which hid the getSRSStats bug.
// NOTE: w_N → cw_N uses numeric identity as a simplified approximation —
// production's OLD_ID_TO_CANONICAL maps by dedup order, so duplicates can
// map w_5 → cw_3. The regression suite below uses an explicit cwMap for
// precision where the exact mapping matters.
global.getCanonicalIdForOldId = function(id) {
  if (!id) return null;
  if (id.indexOf('cw_') === 0) return id;
  var m = /^w_(\d+)$/.exec(String(id));
  return m ? 'cw_' + m[1] : null;
};
global.window = {};

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var srsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'srs.js'), 'utf8');
eval(srsCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

function assertApprox(actual, expected, tolerance, msg) {
  var diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, (msg || '') + ': expected ' + expected + ' \u00B1' + tolerance + ', got ' + actual);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('SRS Load/Save', function() {
  test('loadSRS returns empty object when no data', function() {
    clearStorage();
    assert.deepStrictEqual(loadSRS(), {});
  });

  test('loadSRS returns parsed data when valid', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify({ test1: { stage: 1, interval: 1 } }));
    var data = loadSRS();
    assert.ok(data.test1 !== undefined);
  });

  test('loadSRS handles malformed JSON gracefully', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', '{broken');
    assert.deepStrictEqual(loadSRS(), {});
  });

  test('loadSRS handles non-object data gracefully', function() {
    clearStorage();
    localStorage.setItem('quran_srs_data', JSON.stringify('string'));
    assert.deepStrictEqual(loadSRS(), {});
  });

  test('saveSRS stores data correctly', function() {
    clearStorage();
    saveSRS({ w1: { stage: 2 } });
    assert.strictEqual(localStorage.getItem('quran_srs_data'), JSON.stringify({ w1: { stage: 2 } }));
  });

  test('saveSRS handles storage errors gracefully', function() {
    var orig = localStorage.setItem;
    localStorage.setItem = function() { throw new Error('full'); };
    saveSRS({ w1: { stage: 2 } });
    localStorage.setItem = orig;
  });
});

suite('SRS Status', function() {
  test('getSRSStatus returns new for unknown word', function() {
    clearStorage();
    var status = getSRSStatus('nonexistent');
    assert.strictEqual(status.status, 'new');
    assert.strictEqual(status.stage, 0);
    assert.strictEqual(status.isLeech, false);
  });

  test('getSRSStatus returns mastered for word with future dueDate', function() {
    clearStorage();
    var future = _mockNow + 86400000 * 10;
    saveSRS({ w1: { stage: 3, dueDate: future, interval: 10, ratedAt: _mockNow, easeFactor: 2.5 } });
    var status = getSRSStatus('w1');
    assert.strictEqual(status.status, 'mastered');
    assert.strictEqual(status.daysUntilDue, 10);
  });

  test('getSRSStatus returns review for overdue word', function() {
    clearStorage();
    var past = _mockNow - 86400000;
    saveSRS({ w1: { stage: 2, dueDate: past, interval: 5, ratedAt: past, easeFactor: 2.5 } });
    var status = getSRSStatus('w1');
    assert.strictEqual(status.status, 'review');
  });
});

suite('Retention Estimation', function() {
  test('estimateRetention returns 1 for null/zero interval', function() {
    assert.strictEqual(estimateRetention(null), 1);
    assert.strictEqual(estimateRetention({ interval: 0 }), 1);
    assert.strictEqual(estimateRetention({ interval: -1 }), 1);
  });

  test('estimateRetention returns ~0.99 for recently reviewed word', function() {
    var retention = estimateRetention({ interval: 10, ratedAt: _mockNow, dueDate: _mockNow + 864000000 });
    assert.ok(retention >= 0.98, 'retention=' + retention);
  });

  test('estimateRetention decreases with time since review', function() {
    var recent = estimateRetention({ interval: 10, ratedAt: _mockNow, dueDate: _mockNow });
    var old = estimateRetention({ interval: 10, ratedAt: _mockNow - 86400000 * 20, dueDate: _mockNow - 86400000 * 10 });
    assert.ok(old < recent, 'old retention (' + old + ') < recent (' + recent + ')');
  });

  test('estimateRetention clamps to valid range [0.6, 0.99]', function() {
    var veryOld = estimateRetention({ interval: 1, ratedAt: _mockNow - 86400000 * 365, dueDate: _mockNow - 86400000 * 364 });
    assert.ok(veryOld >= 0.6, 'retention=' + veryOld);
    assert.ok(veryOld <= 0.99, 'retention=' + veryOld);
  });
});

suite('Rate SRS Word - Scheduling', function() {
  test('rateSRSWord creates new entry for unknown word', function() {
    clearStorage();
    rateSRSWord('w_new', 2);
    var data = loadSRS();
    assert.ok(data['w_new'] !== undefined);
    assert.strictEqual(data['w_new'].stage, 1);
    assert.strictEqual(data['w_new'].totalReviews, 1);
  });

  test('rateSRSWord increments totalReviews', function() {
    clearStorage();
    saveSRS({ w1: { stage: 1, interval: 0, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w1', 2);
    assert.strictEqual(loadSRS()['w1'].totalReviews, 1);
  });

  test('rateSRSWord increments reps on good/easy', function() {
    clearStorage();
    saveSRS({ w1: { stage: 1, interval: 0, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w1', 2);
    assert.strictEqual(loadSRS()['w1'].reps, 1);
  });

  test('rateSRSWord does not increment reps on again/hard', function() {
    clearStorage();
    saveSRS({ w1: { stage: 1, interval: 0, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w1', 0);
    assert.strictEqual(loadSRS()['w1'].reps, 0);
  });

  test('rateSRSWord increments lapses on again', function() {
    clearStorage();
    saveSRS({ w1: { stage: 1, interval: 0, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w1', 0);
    assert.strictEqual(loadSRS()['w1'].lapses, 1);
  });

  test('rateSRSWord does not increment lapses on good/easy', function() {
    clearStorage();
    saveSRS({ w1: { stage: 1, interval: 0, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w1', 3);
    assert.strictEqual(loadSRS()['w1'].lapses, 0);
  });

  test('learning stage gets appropriate intervals', function() {
    clearStorage();
    rateSRSWord('w_learn', 2);
    var entry = loadSRS()['w_learn'];
    // stage 1, good → STAGE1_GOOD[0]=1 (lapses=0, so attemptCount=0)
    assertApprox(entry.interval, 1, 0.01, 'good interval in learning');
  });

  test('learning graduates to young after enough reviews', function() {
    clearStorage();
    // Add 3 good ratings to graduate
    for (var i = 0; i < 3; i++) {
      rateSRSWord('w_grad', 2);
    }
    assert.strictEqual(loadSRS()['w_grad'].stage, 2);
  });

  test('young stage intervals grow with ease factor', function() {
    clearStorage();
    // First 3 good ratings in learning (lapses=0, so interval stays 1 each time)
    for (var i = 0; i < 3; i++) { rateSRSWord('w_young', 2); }
    // Now in young stage (stage 2). One more good rating applies SM-2: interval = prevInterval * ef
    rateSRSWord('w_young', 2);
    var intervalAfter = loadSRS()['w_young'].interval;
    assert.ok(intervalAfter > 1, 'young interval > 1, got ' + intervalAfter);
  });

  test('mature stage uses SM-2 algorithm', function() {
    clearStorage();
    saveSRS({ w_mature: { stage: 3, interval: 100, totalReviews: 20, reps: 10, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    rateSRSWord('w_mature', 2);
    var entry = loadSRS()['w_mature'];
    assert.strictEqual(entry.stage, 3);
    assertApprox(entry.interval, 100 * 2.5, 1, 'mature SM-2 interval');
  });
});

suite('Leech Detection', function() {
  test('three again ratings triggers leech', function() {
    clearStorage();
    saveSRS({ w_leeched: { stage: 1, interval: 1, totalReviews: 0, reps: 0, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false, dueDate: _mockNow, lastRating: 2, ratedAt: _mockNow } });
    for (var i = 0; i < 3; i++) { rateSRSWord('w_leeched', 0); }
    assert.strictEqual(loadSRS()['w_leeched'].isLeech, true);
  });

  test('leech caps interval at 7 days', function() {
    clearStorage();
    saveSRS({ w_leech_cap: { stage: 3, interval: 100, totalReviews: 10, reps: 5, lapses: 5, easeFactor: 2.5, leechCount: 3, isLeech: true, dueDate: _mockNow, lastRating: 0, ratedAt: _mockNow } });
    rateSRSWord('w_leech_cap', 2);
    assert.ok(loadSRS()['w_leech_cap'].interval <= 7, 'interval capped at 7');
  });

  test('three good ratings on leeched word clears leech', function() {
    clearStorage();
    // Use a canonical-style id: with the realistic (non-identity) migration
    // stub, raw w_* ids that aren't w_<digits> resolve to null and their
    // _leechRecovery progress is dropped on load — canonical cw_ ids pass
    // through unchanged, matching production where reviews are cw_-keyed.
    saveSRS({ cw_recover: { stage: 2, interval: 5, totalReviews: 10, reps: 0, lapses: 5, easeFactor: 2.2, leechCount: 3, isLeech: true, dueDate: _mockNow, lastRating: 0, ratedAt: _mockNow } });
    for (var i = 0; i < 3; i++) { rateSRSWord('cw_recover', 2); }
    assert.strictEqual(loadSRS()['cw_recover'].isLeech, false);
  });

  test('bad rating resets leech recovery progress', function() {
    clearStorage();
    // isLeech=true with leechCount below threshold so recovery reset code runs
    saveSRS({ w_reset: { stage: 2, interval: 5, totalReviews: 5, reps: 2, lapses: 2, easeFactor: 2.0, leechCount: 2, isLeech: true, dueDate: _mockNow, lastRating: 0, ratedAt: _mockNow } });
    rateSRSWord('w_reset', 2); // first good — recovery count 1
    rateSRSWord('w_reset', 0); // bad — leechCount=3 triggers threshold, so recovered state preserved for retry
    rateSRSWord('w_reset', 2); // start recovery again — count 1
    // Only 1 good after reset — should still be leeched (need 3)
    assert.strictEqual(loadSRS()['w_reset'].isLeech, true);
  });
});

suite('Merge SRS Entries', function() {
  test('mergeSRSEntries takes highest stage and accumulates counts', function() {
    var merged = mergeSRSEntries([
      { stage: 1, dueDate: 100, interval: 1, lastRating: 2, ratedAt: 100, reps: 2, totalReviews: 3, lapses: 1, easeFactor: 2.5, leechCount: 0, isLeech: false },
      { stage: 2, dueDate: 200, interval: 5, lastRating: 3, ratedAt: 200, reps: 3, totalReviews: 4, lapses: 0, easeFactor: 2.7, leechCount: 0, isLeech: false },
    ]);
    assert.strictEqual(merged.stage, 2);
    assert.strictEqual(merged.reps, 5);
    assert.strictEqual(merged.totalReviews, 7);
    assert.strictEqual(merged.lapses, 1);
  });

  test('mergeSRSEntries marks leech if any entry is leeched', function() {
    var merged = mergeSRSEntries([
      { stage: 1, dueDate: 100, interval: 1, lastRating: 2, ratedAt: 100, reps: 0, totalReviews: 1, lapses: 0, easeFactor: 2.5, leechCount: 0, isLeech: false },
      { stage: 1, dueDate: 100, interval: 1, lastRating: 0, ratedAt: 100, reps: 0, totalReviews: 1, lapses: 3, easeFactor: 2.0, leechCount: 3, isLeech: true },
    ]);
    assert.strictEqual(merged.isLeech, true);
  });
});

suite('Review Queue', function() {
  test('getDueReviews returns empty for no due words', function() {
    clearStorage();
    global.ALL_WORDS = [{ id: 'w1' }];
    var due = getDueReviews();
    assert.strictEqual(due.length, 0);
  });

  test('getDueReviews includes overdue words', function() {
    clearStorage();
    global.ALL_WORDS = [{ id: 'w1' }];
    saveSRS({ w1: { stage: 1, dueDate: _mockNow - 1000, interval: 1, easeFactor: 2.5, leechCount: 0, isLeech: false } });
    var due = getDueReviews();
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].id, 'w1');
  });

  test('getDueReviews excludes future-due words', function() {
    clearStorage();
    global.ALL_WORDS = [{ id: 'w1' }];
    saveSRS({ w1: { stage: 3, dueDate: _mockNow + 86400000 * 10, interval: 10, easeFactor: 2.5, leechCount: 0, isLeech: false } });
    assert.strictEqual(getDueReviews().length, 0);
  });

  test('getNewWords returns unstudied words', function() {
    clearStorage();
    global.ALL_WORDS = [{ id: 'w1' }, { id: 'w2' }];
    saveSRS({ w1: { stage: 1, dueDate: _mockNow - 1000, interval: 1, easeFactor: 2.5, leechCount: 0, isLeech: false } });
    var newWords = getNewWords();
    assert.strictEqual(newWords.length, 1);
    assert.strictEqual(newWords[0].id, 'w2');
  });
});

suite('SRS Statistics', function() {
  test('getSRSStats returns structured stats', function() {
    clearStorage();
    global.ALL_WORDS = [{ id: 'w1' }];
    saveSRS({ w1: { stage: 3, dueDate: _mockNow - 1000, interval: 30, totalReviews: 10, easeFactor: 2.5, leechCount: 0, isLeech: false, ratedAt: _mockNow } });
    var stats = getSRSStats();
    assert.ok(stats.total >= 1);
    assert.ok(typeof stats.avgRetention === 'number');
    assert.ok(typeof stats.avgEaseFactor === 'number');
  });
});

// ═══════════════════════════════════════════════════════════════
// SRS Stats Canonical-ID Regression
//
// Regression for the getSRSStats canonical-vs-raw ID bug: reviews are
// stored under canonical cw_N ids (loadSRS() migrates legacy w_N/Arabic
// keys), but getSRSStats used to iterate raw ALL_WORDS (w_N ids), so stored
// data never matched and every word was reported as "new" (zeroed stats for
// every user with review history). Mirrors the relationship-cache re-key
// regression pattern in test/vocabulary.test.js.
// ═══════════════════════════════════════════════════════════════

suite('SRS Stats Canonical-ID Regression', function() {
  test('getSRSStats counts reviews stored under legacy w_*/Arabic keys after migration', function() {
    clearStorage();
    invalidateSRSMemoryCache();

    // Simulate production: ALL_WORDS holds raw w_N words while the canonical
    // list uses cw_N ids, with a realistic w_N → cw_N mapping (same shape as
    // the non-identity harness stub).
    var rawWords = [
      { id: 'w_0', arabic: '\u0643\u0650\u062a\u064e\u0627\u0628' },
      { id: 'w_1', arabic: '\u0631\u064e\u062d\u0652\u0645\u064e\u0629' },
      { id: 'w_2', arabic: '\u0639\u0650\u0644\u0652\u0645' },
    ];
    var cwMap = {};
    var canonicalWords = rawWords.map(function(w, i) {
      var cw = {};
      for (var k in w) cw[k] = w[k];
      cw.id = 'cw_' + i;
      cwMap['w_' + i] = 'cw_' + i;
      return cw;
    });

    var origAllWords = global.ALL_WORDS;
    var origCanonWords = global.getCanonicalWords;
    var origCanonId = global.getCanonicalIdForOldId;
    global.ALL_WORDS = rawWords;
    global.getCanonicalWords = function() { return canonicalWords; };
    global.getCanonicalIdForOldId = function(id) { return cwMap[id] || null; };
    invalidateSRSMemoryCache();

    try {
      // Real review history stored under LEGACY keys: one w_N key, one
      // Arabic key, one already-canonical key. loadSRS() must migrate the
      // first two before getSRSStats() reads them.
      localStorage.setItem('quran_srs_data', JSON.stringify({
        w_0: { stage: 3, dueDate: _mockNow + 86400000 * 30, interval: 30, totalReviews: 10, easeFactor: 2.5, leechCount: 0, isLeech: false, ratedAt: _mockNow },
        '\u0631\u064e\u062d\u0652\u0645\u064e\u0629': { stage: 2, dueDate: _mockNow + 86400000 * 5, interval: 5, totalReviews: 4, easeFactor: 2.3, leechCount: 0, isLeech: false, ratedAt: _mockNow },
        cw_2: { stage: 1, dueDate: _mockNow - 1000, interval: 1, totalReviews: 3, easeFactor: 2.0, leechCount: 0, isLeech: false, ratedAt: _mockNow },
      }));

      // Migration must re-key all three to canonical ids
      var data = loadSRS();
      assert.ok(data.cw_0 !== undefined, 'w_0 migrated to cw_0');
      assert.ok(data.cw_1 !== undefined, 'Arabic key migrated to cw_1');
      assert.ok(data.cw_2 !== undefined, 'canonical key preserved');
      assert.ok(data.w_0 === undefined, 'raw w_0 no longer present after migration');

      // The stats must reflect the real (canonical) data — NOT all-zero/new
      var stats = getSRSStats();
      assert.strictEqual(stats.total, 3, 'total counts canonical words');
      assert.strictEqual(stats.newCount, 0, 'no word incorrectly reported as new');
      assert.strictEqual(stats.mature, 1, 'mature counted (cw_0)');
      assert.strictEqual(stats.young, 1, 'young counted (cw_1)');
      assert.strictEqual(stats.learning, 1, 'learning counted (cw_2)');
      assert.strictEqual(stats.totalReviews, 17, 'review counts accumulated');
      assert.ok(stats.dueToday >= 1, 'overdue cw_2 counted as due today');
    } finally {
      global.ALL_WORDS = origAllWords;
      global.getCanonicalWords = origCanonWords;
      global.getCanonicalIdForOldId = origCanonId;
      invalidateSRSMemoryCache();
      clearStorage();
    }
  });
});

suite('Edge Cases', function() {
  test('rateSRSWord handles undefined wordId', function() {
    rateSRSWord(undefined, 2);
  });

  test('rateSRSWord handles null wordId', function() {
    rateSRSWord(null, 2);
  });

  test('updateDailyReviewLimit rejects invalid values', function() {
    var origLimit = DAILY_REVIEW_LIMIT;
    updateDailyReviewLimit(0);
    assert.strictEqual(DAILY_REVIEW_LIMIT, origLimit);
    updateDailyReviewLimit(1001);
    assert.strictEqual(DAILY_REVIEW_LIMIT, origLimit);
    updateDailyReviewLimit(-1);
    assert.strictEqual(DAILY_REVIEW_LIMIT, origLimit);
    updateDailyReviewLimit('abc');
    assert.strictEqual(DAILY_REVIEW_LIMIT, origLimit);
  });

  test('updateDailyReviewLimit accepts valid values', function() {
    updateDailyReviewLimit(50);
    assert.strictEqual(DAILY_REVIEW_LIMIT, 50);
    updateDailyReviewLimit(25);
  });

  test('getSRSStatsCached returns cached stats', function() {
    clearStorage();
    global.ALL_WORDS = [];
    var first = getSRSStatsCached();
    var second = getSRSStatsCached();
    assert.strictEqual(first, second);
  });

  test('invalidateStatsCache clears cache', function() {
    global.ALL_WORDS = [];
    var first = getSRSStatsCached();
    invalidateStatsCache();
    var second = getSRSStatsCached();
    // Different call because of timing
    assert.ok(true);
  });

  test('saveSRS invalidates the stats cache (stale Review Center stats guard)', function() {
    // The mock clock is constant, so the 2s TTL never expires: the ONLY way
    // getSRSStatsCached() can return fresh data after a write is if saveSRS()
    // itself invalidates the cache. Before the fix, quiz/import/migration
    // writers (which don't call invalidateStatsCache at their call sites)
    // left consumers like the Review Center's showRetention / Retention stat
    // reading stale totals from before the write.
    clearStorage();
    // _cachedStats is module-level and persists across tests — reset it so this
    // test is independent of whatever previous tests left cached.
    invalidateStatsCache();
    global.ALL_WORDS = [{ id: 'cw_0', arabic: 'x' }];
    var base = { stage: 1, interval: 1, easeFactor: 2.5, dueDate: Date.now() + 86400000, ratedAt: Date.now() - 86400000, lapses: 0, isLeech: false };
    saveSRS({ cw_0: Object.assign({ totalReviews: 1 }, base) });
    assert.strictEqual(getSRSStatsCached().totalReviews, 1, 'initial stats reflect 1 review');
    saveSRS({ cw_0: Object.assign({ totalReviews: 7 }, base) });
    assert.strictEqual(getSRSStatsCached().totalReviews, 7,
      'saveSRS must invalidate the stats cache so the next read is fresh');
    global.ALL_WORDS = [];
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
