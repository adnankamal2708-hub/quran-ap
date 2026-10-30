#!/usr/bin/env node
/**
 * tracks.test.js — Unit tests for the learning-track state module
 *
 * Tests: default state, join/leave/main rules, levels, Quran percentage,
 * placement attempts, mergeTrackState, corrupt-storage fallback.
 *
 * Run: node test/tracks.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

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

// Indirect eval so the module's top-level declarations become globals.
var tracksPath = path.join(__dirname, '..', 'js', 'data-core', 'tracks.js');
(0, eval)(fs.readFileSync(tracksPath, 'utf8'));

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  clearStorage();
  var originalReleased = global.isTrackReleased;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  } finally {
    global.isTrackReleased = originalReleased;
  }
}

function suite(name, fn) {
  console.log('\n' + name);
  fn();
}

function trackRecord(overrides) {
  return Object.assign(
    { joined: false, level: 0, percentHigh: 0, placementAttempts: 0, updatedAt: 0 },
    overrides);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Track constants', function() {
  test('ids, level count and storage key', function() {
    assert.deepStrictEqual(TRACK_IDS, ['qaida', 'tajweed', 'words', 'understanding']);
    assert.strictEqual(TRACK_LEVEL_COUNT, 4);
    assert.strictEqual(TRACKS_KEY, 'quran_tracks');
  });

  test('only words is released in Phase 1', function() {
    TRACK_IDS.forEach(function(id) {
      assert.strictEqual(isTrackReleased(id), id === 'words', id);
    });
    assert.strictEqual(isTrackReleased('nope'), false);
  });
});

suite('Default state', function() {
  test('default state for an existing learner', function() {
    var progress = JSON.stringify({ completedLessons: [0, 1], currentLesson: 2, quizPassed: { 0: true } });
    localStorage.setItem('quran_foundation_progress', progress);
    assert.strictEqual(getMainTrackId(), 'words');
    assert.deepStrictEqual(getJoinedTrackIds(), ['words']);
    assert.strictEqual(localStorage.getItem('quran_foundation_progress'), progress);
  });

  test('reading the default state does not write storage', function() {
    loadTracks();
    getJoinedTrackIds();
    assert.strictEqual(localStorage.getItem(TRACKS_KEY), null);
  });

  test('corrupt JSON falls back to default', function() {
    localStorage.setItem(TRACKS_KEY, '{');
    assert.strictEqual(getMainTrackId(), 'words');
    assert.deepStrictEqual(getJoinedTrackIds(), ['words']);
  });
});

suite('Joining and leaving', function() {
  test('joinTrack refuses unreleased tracks', function() {
    assert.strictEqual(joinTrack('qaida'), false);
    assert.deepStrictEqual(getJoinedTrackIds(), ['words']);
  });

  test('joinTrack refuses unknown tracks', function() {
    assert.strictEqual(joinTrack('nope'), false);
  });

  test('leaveTrack refuses the last joined track', function() {
    assert.strictEqual(leaveTrack('words'), false);
    assert.deepStrictEqual(getJoinedTrackIds(), ['words']);
  });

  test('joined tracks list the main track first, then TRACK_IDS order', function() {
    global.isTrackReleased = function() { return true; };
    assert.strictEqual(joinTrack('understanding'), true);
    assert.strictEqual(joinTrack('qaida'), true);
    assert.deepStrictEqual(getJoinedTrackIds(), ['words', 'qaida', 'understanding']);
    assert.strictEqual(setMainTrack('understanding'), true);
    assert.deepStrictEqual(getJoinedTrackIds(), ['understanding', 'qaida', 'words']);
  });

  test('setMainTrack refuses a track that is not joined', function() {
    global.isTrackReleased = function() { return true; };
    assert.strictEqual(setMainTrack('qaida'), false);
    assert.strictEqual(getMainTrackId(), 'words');
  });

  test('leaving the main track promotes the next joined', function() {
    global.isTrackReleased = function() { return true; };
    assert.strictEqual(joinTrack('qaida'), true);
    assert.strictEqual(setMainTrack('qaida'), true);
    assert.strictEqual(getMainTrackId(), 'qaida');
    assert.strictEqual(leaveTrack('qaida'), true);
    assert.strictEqual(getMainTrackId(), 'words');
    assert.deepStrictEqual(getJoinedTrackIds(), ['words']);
  });

  test('rejoin restores level and percent', function() {
    global.isTrackReleased = function() { return true; };
    joinTrack('qaida');
    raiseTrackLevel('qaida', 2);
    recordTrackPercent('qaida', 30);
    assert.strictEqual(leaveTrack('qaida'), true);
    assert.strictEqual(joinTrack('qaida'), true);
    assert.strictEqual(getTrackLevel('qaida'), 2);
    assert.strictEqual(getTrackPercent('qaida'), 30);
  });
});

suite('Levels, percentage and attempts', function() {
  test('raiseTrackLevel never lowers', function() {
    assert.strictEqual(raiseTrackLevel('words', 2), true);
    assert.strictEqual(raiseTrackLevel('words', 1), false);
    assert.strictEqual(getTrackLevel('words'), 2);
    assert.strictEqual(raiseTrackLevel('words', 2), false);
  });

  test('raiseTrackLevel rejects levels outside the range', function() {
    assert.strictEqual(raiseTrackLevel('words', TRACK_LEVEL_COUNT), false);
    assert.strictEqual(raiseTrackLevel('words', -1), false);
    assert.strictEqual(raiseTrackLevel('nope', 1), false);
    assert.strictEqual(getTrackLevel('words'), 0);
    assert.strictEqual(getTrackLevel('nope'), 0);
  });

  test('recordTrackPercent only grows', function() {
    assert.deepStrictEqual(recordTrackPercent('words', 43.2), { percent: 43.2, gained: 43.2 });
    assert.deepStrictEqual(recordTrackPercent('words', 43.6), { percent: 43.6, gained: 0.4 });
    assert.deepStrictEqual(recordTrackPercent('words', 41), { percent: 43.6, gained: 0 });
    assert.strictEqual(getTrackPercent('words'), 43.6);
  });

  test('recordTrackPercent ignores bad input', function() {
    assert.deepStrictEqual(recordTrackPercent('words', NaN), { percent: 0, gained: 0 });
    assert.deepStrictEqual(recordTrackPercent('nope', 5), { percent: 0, gained: 0 });
  });

  test('start-from-zero flag round-trips', function() {
    assert.strictEqual(isStartFromZero(), false);
    setStartFromZero(true);
    assert.strictEqual(isStartFromZero(), true);
    setStartFromZero(false);
    assert.strictEqual(isStartFromZero(), false);
  });

  test('nextPlacementAttempt returns the count, then increments', function() {
    assert.strictEqual(nextPlacementAttempt('words'), 0);
    assert.strictEqual(nextPlacementAttempt('words'), 1);
    assert.strictEqual(nextPlacementAttempt('words'), 2);
  });

  test('state persists under quran_tracks and stamps updatedAt', function() {
    raiseTrackLevel('words', 1);
    var saved = JSON.parse(localStorage.getItem(TRACKS_KEY));
    assert.strictEqual(saved.version, 1);
    assert.strictEqual(saved.main, 'words');
    assert.ok(saved.updatedAt > 0);
    assert.ok(saved.tracks.words.updatedAt > 0);
    assert.strictEqual(saved.tracks.words.level, 1);
  });
});

suite('mergeTrackState', function() {
  function state(overrides) {
    return Object.assign({ version: 1, main: 'words', startFromZero: false, updatedAt: 0, tracks: {} }, overrides);
  }

  test('keeps the higher level and percent from either side', function() {
    var local = state({ updatedAt: 100, tracks: { words: trackRecord({ joined: true, level: 1, percentHigh: 10, updatedAt: 100 }) } });
    var cloud = state({ updatedAt: 50, tracks: { words: trackRecord({ joined: true, level: 2, percentHigh: 5, updatedAt: 50 }) } });
    var merged = mergeTrackState(local, cloud);
    assert.strictEqual(merged.tracks.words.level, 2);
    assert.strictEqual(merged.tracks.words.percentHigh, 10);
    assert.strictEqual(merged.updatedAt, 100);
  });

  test('membership and main follow the side with the higher updatedAt', function() {
    var local = state({
      main: 'words', updatedAt: 100, startFromZero: true,
      tracks: { words: trackRecord({ joined: true, updatedAt: 100 }) },
    });
    var cloud = state({
      main: 'qaida', updatedAt: 50,
      tracks: {
        words: trackRecord({ joined: true, updatedAt: 50 }),
        qaida: trackRecord({ joined: true, level: 1, updatedAt: 50 }),
      },
    });
    var merged = mergeTrackState(local, cloud);
    assert.strictEqual(merged.main, 'words');
    assert.strictEqual(merged.startFromZero, true);
    assert.strictEqual(merged.tracks.qaida.joined, false);
    assert.strictEqual(merged.tracks.qaida.level, 1, 'progress is still kept for a track left on the newer side');

    var flipped = mergeTrackState(cloud, local);
    assert.strictEqual(flipped.main, 'words', 'newer side decides regardless of argument order');
    assert.strictEqual(flipped.tracks.qaida.joined, false);

    var cloudNewer = mergeTrackState(local, Object.assign({}, cloud, { updatedAt: 200 }));
    assert.strictEqual(cloudNewer.main, 'qaida');
    assert.strictEqual(cloudNewer.tracks.qaida.joined, true);
  });

  test('takes the higher placementAttempts', function() {
    var local = state({ updatedAt: 100, tracks: { words: trackRecord({ joined: true, placementAttempts: 1, updatedAt: 100 }) } });
    var cloud = state({ updatedAt: 50, tracks: { words: trackRecord({ joined: true, placementAttempts: 3, updatedAt: 50 }) } });
    assert.strictEqual(mergeTrackState(local, cloud).tracks.words.placementAttempts, 3);
    assert.strictEqual(mergeTrackState(cloud, local).tracks.words.placementAttempts, 3);
  });

  test('a missing side yields the other, and neither yields the default', function() {
    var only = state({ updatedAt: 5, tracks: { words: trackRecord({ joined: true, level: 3, updatedAt: 5 }) } });
    assert.strictEqual(mergeTrackState(only, null).tracks.words.level, 3);
    assert.strictEqual(mergeTrackState(null, only).tracks.words.level, 3);
    var neither = mergeTrackState(null, null);
    assert.strictEqual(neither.main, 'words');
    assert.strictEqual(neither.tracks.words.joined, true);
  });

  test('the result always has a joined main track', function() {
    var left = state({ updatedAt: 100, tracks: { words: trackRecord({ joined: false, updatedAt: 100 }) } });
    var merged = mergeTrackState(left, state({ updatedAt: 1, tracks: {} }));
    assert.strictEqual(merged.tracks[merged.main].joined, true);
  });
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
