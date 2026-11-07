#!/usr/bin/env node
/**
 * tajweed-track.test.js — Unit tests for the Tajweed track module
 *
 * Tests: level locks ('coming' above Beginner), lesson order, reading-check
 * pass mark, letters covered, verse marks and percent, the verse order,
 * the review queue's id namespaces, merge, corrupt-storage fallback and
 * the release switch.
 *
 * Run: node test/tajweed-track.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/data-core/tracks.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-audio-manifest.js');
load('js/tajweed/tajweed-makharij.js');
load('js/tajweed/tajweed-lessons.js');
load('js/tajweed/verse-word-counts.js');
load('js/data-core/review-schedule.js');
load('js/data-core/tajweed-track.js');
load('js/services/audio.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  _storage = {};
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e));
  }
}

var T0 = 1700000000000;
var DAY = 24 * 60 * 60 * 1000;

console.log('\n📋 Tajweed track: levels and lessons');

test('four levels in the track-screen shape, titled from the strings', function () {
  var levels = getTajweedLevels();
  assert.strictEqual(levels.length, 4);
  var first = levels[0].lessons[0];
  assert.strictEqual(first.kind, 'tajweed');
  assert.strictEqual(first.ref, 'tj0-1');
  assert.strictEqual(first.title, 'The five areas');
  assert.strictEqual(first.completed, false);
  assert.strictEqual(levels[1].lessons.length, 0);
});

test('Beginner is open and levels 1-3 lock as coming, even when placed there', function () {
  assert.strictEqual(getTajweedLevelLock(0), null);
  for (var l = 1; l < 4; l++) assert.strictEqual(getTajweedLevelLock(l), 'coming', 'level ' + l);
  raiseTrackLevel('tajweed', 1);
  assert.strictEqual(getTajweedLevelLock(1), 'coming');
});

test('lessons open in order', function () {
  assert.ok(isTajweedLessonUnlocked('tj0-1'));
  assert.ok(!isTajweedLessonUnlocked('tj0-2'));
  assert.strictEqual(getTajweedNextLesson(0).ref, 'tj0-1');
  assert.strictEqual(completeTajweedLesson('tj0-1', 1), true);
  assert.ok(isTajweedLessonUnlocked('tj0-2'));
  assert.strictEqual(getTajweedNextLesson(0).ref, 'tj0-2');
  assert.strictEqual(getTajweedNextLesson(0).level, 0);
  assert.ok(!isTajweedLessonUnlocked('nope'));
});

test('a reading check scoring 0.79 is not finished, one scoring 0.8 is', function () {
  getTajweedLevelLessons(0).slice(0, -1).forEach(function (l) { completeTajweedLesson(l.id, 1); });
  assert.strictEqual(completeTajweedLesson('tj0-12', 0.79), false);
  assert.strictEqual(getTajweedLevel(), 0);
  assert.strictEqual(completeTajweedLesson('tj0-12', 0.8), true);
  assert.strictEqual(getTajweedLevel(), 1);
  assert.strictEqual(getTajweedNextLesson(0), null, 'nothing left on Beginner, and level 1 is coming');
});

test('a repeat with a better score is kept but not counted as new', function () {
  completeTajweedLesson('tj0-1', 0.5);
  assert.strictEqual(completeTajweedLesson('tj0-1', 0.9), false);
  assert.strictEqual(loadTajweedProgress().completed['tj0-1'].score, 0.9);
  assert.strictEqual(completeTajweedLesson('nope', 1), false);
});

console.log('\n📋 Tajweed track: letters covered');

test('letters covered counts finished lessons only, and reaches 28 after lessons 2-8', function () {
  assert.strictEqual(getTajweedLettersCovered(), 0);
  completeTajweedLesson('tj0-1', 1);
  assert.strictEqual(getTajweedLettersCovered(), 0, 'the areas lesson teaches no letters');
  completeTajweedLesson('tj0-2', 1);
  assert.strictEqual(getTajweedLettersCovered(), 5, 'hamza is not one of the 28');
  ['tj0-3', 'tj0-4', 'tj0-5', 'tj0-6', 'tj0-7', 'tj0-8'].forEach(function (id) { completeTajweedLesson(id, 1); });
  assert.strictEqual(getTajweedLettersCovered(), 28);
  completeTajweedLesson('tj0-9', 1);
  assert.strictEqual(getTajweedLettersCovered(), 28);
});

test('placement above Beginner covers all 28 letters', function () {
  raiseTrackLevel('tajweed', 1);
  assert.strictEqual(getTajweedLettersCovered(), 28);
});

test('getTajweedLetter covers the 28 letters and hamza', function () {
  assert.deepStrictEqual(getTajweedLetter('ba'), { id: 'ba', char: 'ب', nameKey: 'qaida.letter.ba.name' });
  assert.deepStrictEqual(getTajweedLetter('hamza'), { id: 'hamza', char: 'ء', nameKey: 'qaida.mark.hamza.name' });
  assert.strictEqual(getTajweedLetter('nope'), null);
  QAIDA_LETTERS.forEach(function (l) { assert.ok(getTajweedLetter(l.id), l.id); });
});

console.log('\n📋 Tajweed track: verses and percent');

test('a smooth verse raises the percent by its share of the words, once', function () {
  assert.strictEqual(getTajweedPercent(), 0);
  markTajweedVerse(1, 1, true, T0);
  assert.strictEqual(getTajweedPercent(), 4 / 77429 * 100);
  markTajweedVerse(1, 1, true, T0 + 5);
  assert.strictEqual(getTajweedPercent(), 4 / 77429 * 100);
  assert.strictEqual(loadTajweedProgress().smooth['1:1'], T0);
});

test('refreshTajweedPercent records the percent as the track high-water mark', function () {
  markTajweedVerse(1, 7, true, T0);
  refreshTajweedPercent();
  assert.strictEqual(getTrackPercent('tajweed'), 9 / 77429 * 100);
});

test('a not-yet verse joins the review queue, and a later smooth mark removes it', function () {
  markTajweedVerse(1, 2, false, T0);
  assert.deepStrictEqual(loadTajweedProgress().review['tj-verse:1:2'], { due: T0 + REVIEW_RETRY_MS, step: 0 });
  assert.deepStrictEqual(getDueTajweedItems(T0 + REVIEW_RETRY_MS), ['tj-verse:1:2']);
  assert.strictEqual(getTajweedPercent(), 0);
  markTajweedVerse(1, 2, true, T0 + DAY);
  assert.strictEqual(loadTajweedProgress().review['tj-verse:1:2'], undefined);
  assert.deepStrictEqual(getDueTajweedItems(T0 + 2 * DAY), []);
});

test('verses that do not exist are ignored', function () {
  markTajweedVerse(1, 8, true, T0);
  markTajweedVerse(115, 1, false, T0);
  assert.deepStrictEqual(loadTajweedProgress().smooth, {});
  assert.deepStrictEqual(loadTajweedProgress().review, {});
});

test('the verse order starts at 1:1, goes to 114:1 after Al-Fatihah, and ends', function () {
  assert.deepStrictEqual(getNextTajweedVerse(), { surah: 1, ayah: 1 });
  markTajweedVerse(1, 1, true, T0);
  assert.deepStrictEqual(getNextTajweedVerse(), { surah: 1, ayah: 2 });
  for (var a = 2; a <= 7; a++) markTajweedVerse(1, a, true, T0);
  assert.deepStrictEqual(getNextTajweedVerse(), { surah: 114, ayah: 1 });
  assert.strictEqual(TAJWEED_VERSE_ORDER.length, 114);
  assert.deepStrictEqual(TAJWEED_VERSE_ORDER.slice(0, 3), [1, 114, 113]);
  assert.deepStrictEqual(TAJWEED_VERSE_ORDER.slice(37, 40), [78, 2, 3]);
  var smooth = {};
  Object.keys(VERSE_WORD_COUNTS).forEach(function (s) {
    VERSE_WORD_COUNTS[s].forEach(function (n, i) { smooth[s + ':' + (i + 1)] = T0; });
  });
  _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify({ smooth: smooth });
  assert.strictEqual(getNextTajweedVerse(), null);
  assert.ok(Math.abs(getTajweedPercent() - 100) < 1e-9);
});

test('a start verse searches after it, across surahs in the verse order', function () {
  assert.deepStrictEqual(getNextTajweedVerse({ surah: 1, ayah: 3 }), { surah: 1, ayah: 4 });
  assert.deepStrictEqual(getNextTajweedVerse({ surah: 1, ayah: 7 }), { surah: 114, ayah: 1 });
  assert.deepStrictEqual(getNextTajweedVerse({ surah: 78, ayah: 40 }), { surah: 2, ayah: 1 });
});

test('a start verse skips smooth verses after it, but not before it', function () {
  markTajweedVerse(114, 1, true, T0);
  markTajweedVerse(114, 2, true, T0);
  assert.deepStrictEqual(getNextTajweedVerse({ surah: 1, ayah: 7 }), { surah: 114, ayah: 3 });
  assert.deepStrictEqual(getNextTajweedVerse(), { surah: 1, ayah: 1 });
});

test('a start verse at the end of the order, or one that does not exist, gives null', function () {
  var last = VERSE_WORD_COUNTS[77].length;
  assert.strictEqual(getNextTajweedVerse({ surah: 77, ayah: last }), null);
  assert.strictEqual(getNextTajweedVerse({ surah: 200, ayah: 1 }), null);
  assert.strictEqual(getNextTajweedVerse({ surah: 1, ayah: 99 }), null);
  assert.strictEqual(getNextTajweedVerse({ surah: 1, ayah: 0 }), null);
});

console.log('\n📋 Tajweed track: review queue');

test('letter and verse ids are scheduled like the Qaida queue', function () {
  recordTajweedReview('tj-letter:ba', false, T0);
  recordTajweedReview('tj-letter:hamza', false, T0 + 1000);
  assert.deepStrictEqual(getDueTajweedItems(T0), []);
  assert.deepStrictEqual(getDueTajweedItems(T0 + REVIEW_RETRY_MS + 1000), ['tj-letter:ba', 'tj-letter:hamza']);
  recordTajweedReview('tj-letter:ba', true, T0 + REVIEW_RETRY_MS);
  assert.deepStrictEqual(loadTajweedProgress().review['tj-letter:ba'], { due: T0 + REVIEW_RETRY_MS + DAY, step: 1 });
});

test('recordTajweedReview rejects ids outside the two namespaces', function () {
  ['ba', 'tj-letter:nope', 'tj-letter:', 'tj-verse:1:8', 'tj-verse:1', 'tj-verse:x:y', 'q-letter:ba', undefined].forEach(function (id) {
    recordTajweedReview(id, false, T0);
  });
  assert.deepStrictEqual(loadTajweedProgress().review, {});
  recordTajweedReview('tj-verse:114:6', false, T0);
  assert.deepStrictEqual(Object.keys(loadTajweedProgress().review), ['tj-verse:114:6']);
});

console.log('\n📋 Tajweed track: storage and merge');

test('merge keeps every finished lesson and smooth verse, the earliest time each, and the less advanced review', function () {
  var local = {
    completed: { 'tj0-1': { at: 200, score: 0.6 }, 'tj0-2': { at: 300, score: 1 } },
    smooth: { '1:1': 500, '1:2': 600 },
    review: { 'tj-letter:ba': { due: T0 + 3 * DAY, step: 2 } },
    updatedAt: 5,
  };
  var cloud = {
    completed: { 'tj0-1': { at: 100, score: 0.9 } },
    smooth: { '1:1': 400, '114:1': 700 },
    review: { 'tj-letter:ba': { due: T0 + DAY, step: 1 }, 'tj-verse:1:3': { due: T0, step: 0 } },
    updatedAt: 9,
  };
  var m = mergeTajweedProgress(local, cloud);
  assert.deepStrictEqual(Object.keys(m.completed).sort(), ['tj0-1', 'tj0-2']);
  assert.deepStrictEqual(m.completed['tj0-1'], { at: 100, score: 0.9 });
  assert.deepStrictEqual(m.smooth, { '1:1': 400, '1:2': 600, '114:1': 700 });
  assert.deepStrictEqual(m.review['tj-letter:ba'], { due: T0 + DAY, step: 1 });
  assert.ok(m.review['tj-verse:1:3']);
  assert.strictEqual(m.updatedAt, 9);

  function percentOf(progress) {
    _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify(progress);
    return getTajweedPercent();
  }
  var merged = percentOf(m);
  assert.ok(merged >= percentOf(local) && merged >= percentOf(cloud));
});

test('corrupt storage and unknown entries fall back to empty', function () {
  _storage[TAJWEED_PROGRESS_KEY] = '{not json';
  assert.deepStrictEqual(loadTajweedProgress(), { completed: {}, review: {}, cleared: {}, smooth: {}, updatedAt: 0 });
  _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify({
    completed: { 'zz-9': { at: 1 }, 'tj0-1': { at: 1, score: 7 } },
    smooth: { '1:1': 3, '1:99': 3, 'x': 3, '1:2': 'y' },
    review: { 'tj-letter:ba': { due: 5, step: 1 }, nope: { due: 5, step: 0 } },
  });
  var p = loadTajweedProgress();
  assert.deepStrictEqual(p.completed, { 'tj0-1': { at: 1, score: 1 } });
  assert.deepStrictEqual(p.smooth, { '1:1': 3, '1:2': 0 });
  assert.deepStrictEqual(Object.keys(p.review), ['tj-letter:ba']);
});

console.log('\n📋 Tajweed track: entries that left the queue');

test('a verse marked Smooth stays out of the queue after a merge with a stale copy that still has it', function () {
  markTajweedVerse(1, 2, false, T0);
  var stale = JSON.parse(JSON.stringify(loadTajweedProgress()));
  markTajweedVerse(1, 2, true, T0 + DAY);
  var m = mergeTajweedProgress(loadTajweedProgress(), stale);
  assert.strictEqual(m.review['tj-verse:1:2'], undefined, 'not brought back');
  assert.strictEqual(m.cleared['tj-verse:1:2'], T0 + DAY);
  assert.strictEqual(mergeTajweedProgress(stale, m).review['tj-verse:1:2'], undefined, 'either order');
});

test('Not yet after Smooth brings the verse back, through a merge too', function () {
  markTajweedVerse(1, 2, false, T0);
  var stale = JSON.parse(JSON.stringify(loadTajweedProgress()));
  markTajweedVerse(1, 2, true, T0 + DAY);
  markTajweedVerse(1, 2, false, T0 + 2 * DAY);
  var m = mergeTajweedProgress(loadTajweedProgress(), stale);
  assert.deepStrictEqual(m.review['tj-verse:1:2'], { due: T0 + 2 * DAY + REVIEW_RETRY_MS, step: 0 });
});

test('a letter that graduated stays gone after a merge, and a later miss brings it back', function () {
  var now = T0;
  recordTajweedReview('tj-letter:ba', false, now);
  var stale = JSON.parse(JSON.stringify(loadTajweedProgress()));
  now += REVIEW_RETRY_MS;
  recordTajweedReview('tj-letter:ba', true, now);
  REVIEW_DAYS.forEach(function (days) {
    now += days * DAY;
    recordTajweedReview('tj-letter:ba', true, now);
  });
  assert.strictEqual(loadTajweedProgress().review['tj-letter:ba'], undefined, 'graduated');
  var m = mergeTajweedProgress(loadTajweedProgress(), stale);
  assert.strictEqual(m.review['tj-letter:ba'], undefined, 'not brought back');
  assert.strictEqual(m.cleared['tj-letter:ba'], now);
  recordTajweedReview('tj-letter:ba', false, now + 1000);
  assert.ok(mergeTajweedProgress(loadTajweedProgress(), stale).review['tj-letter:ba'], 'the later miss wins');
});

test('cleared entries load from progress without the field, canonical and the latest time each', function () {
  _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify({ review: { 'tj-letter:ba': { due: 5, step: 1 } } });
  assert.deepStrictEqual(loadTajweedProgress().cleared, {});
  _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify({
    cleared: { 'tj-verse:1:2': 4, 'tj-verse:01:02': 9, 'tj-letter:nope': 5, 'tj-letter:ba': 'x' },
    review: { 'tj-verse:1:2': { due: 8 + REVIEW_RETRY_MS, step: 0 } },
  });
  var p = loadTajweedProgress();
  assert.deepStrictEqual(p.cleared, { 'tj-verse:1:2': 9 });
  assert.deepStrictEqual(p.review, {}, 'scheduled before it was cleared');
});

console.log('\n📋 Tajweed track: release switch');

test('the track is released only once all 28 letter recordings are in', function () {
  var original = Object.assign({}, QAIDA_AUDIO_MANIFEST);
  function setManifest(ids) {
    Object.keys(QAIDA_AUDIO_MANIFEST).forEach(function (k) { delete QAIDA_AUDIO_MANIFEST[k]; });
    ids.forEach(function (id) { QAIDA_AUDIO_MANIFEST[id] = id + '.mp3'; });
  }
  try {
    setManifest([]);
    assert.strictEqual(areLetterRecordingsComplete(), false);
    assert.strictEqual(isTrackReleased('tajweed'), false);
    setManifest(QAIDA_LETTERS.slice(1).map(function (l) { return l.id; }));
    assert.strictEqual(isTrackReleased('tajweed'), false, 'one letter missing');
    setManifest(QAIDA_LETTERS.map(function (l) { return l.id; }));
    assert.strictEqual(areLetterRecordingsComplete(), true);
    assert.strictEqual(isTrackReleased('tajweed'), true);
  } finally {
    setManifest([]);
    Object.assign(QAIDA_AUDIO_MANIFEST, original);
  }
  assert.deepStrictEqual(QAIDA_AUDIO_MANIFEST, original, 'manifest restored exactly');
});

console.log('\n📋 Tajweed track: canonical verse keys');

test('1:1, 01:1 and 001:01 in stored data count once', function () {
  _storage[TAJWEED_PROGRESS_KEY] = JSON.stringify({
    smooth: { '1:1': 9, '01:1': 4, '001:01': 6 },
    review: { 'tj-verse:1:2': { due: 9, step: 2 }, 'tj-verse:01:02': { due: 5, step: 1 } },
  });
  var p = loadTajweedProgress();
  assert.deepStrictEqual(p.smooth, { '1:1': 4 });
  assert.deepStrictEqual(p.review, { 'tj-verse:1:2': { due: 5, step: 1 } });
  assert.strictEqual(getTajweedPercent(), 4 / QURAN_WORD_TOTAL * 100);
});

test('markTajweedVerse with numeric strings uses the canonical key', function () {
  _storage = {};
  markTajweedVerse('01', '1', true, 5);
  markTajweedVerse(1, 1, true, 9);
  assert.deepStrictEqual(loadTajweedProgress().smooth, { '1:1': 5 });
});

console.log('\n' + '='.repeat(50));
console.log('  tajweed-track.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
