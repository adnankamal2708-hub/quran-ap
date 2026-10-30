#!/usr/bin/env node
/**
 * word-meanings-track.test.js — Word meanings track level map
 *
 * Tests: the four-level lesson map, level locks (premium / progress),
 * the guided-reading gate in phase2.js, and the coverage high-water mark.
 *
 * Run: node test/word-meanings-track.test.js
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

global.window = {};

// Premium stub: tests flip these two flags.
var premiumGuided = false;
var premiumExpansion = false;
global.window.__premium = {
  FEATURES: { GUIDED_READING: 'guided_reading', VOCABULARY_EXPANSION: 'vocabulary_expansion' },
  hasFeature: function(feature) {
    if (feature === 'guided_reading') return premiumGuided;
    if (feature === 'vocabulary_expansion') return premiumExpansion;
    return false;
  },
};

// Foundation stubs: ten lessons, a mutable completed set.
var FOUNDATION_TOTAL = 10;
var foundationDone = [];
global.getFoundationLessonCount = function() { return FOUNDATION_TOTAL; };
global.isFoundationLessonCompleted = function(i) { return foundationDone.indexOf(i) >= 0; };
global.isFoundationLessonUnlocked = function(i) { return i === 0 || foundationDone.indexOf(i - 1) >= 0; };
global.getCompletedFoundationLessonCount = function() { return foundationDone.length; };
global.getFoundationLessonThematicTitle = function(i) { return 'Theme ' + (i + 1); };
var coveragePercent = 0;
global.calculateCoverage = function() { return { coveragePercent: coveragePercent }; };

// Surah study / root family stubs
var studiedSurahs = 0;
var completedRoots = 0;
global.getCompletedSurahCount = function() { return studiedSurahs; };
global.getCompletedRootFamilyCount = function() { return completedRoots; };

function load(rel) {
  // Indirect eval so top-level declarations become globals.
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
load('js/data-core/tracks.js');
load('js/data-core/word-meanings-track.js');
load('js/phase2-surahs.js');
load('js/phase2.js');

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  clearStorage();
  foundationDone = [];
  coveragePercent = 0;
  studiedSurahs = 0;
  completedRoots = 0;
  premiumGuided = false;
  premiumExpansion = false;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

function completeFoundation(count) {
  foundationDone = [];
  for (var i = 0; i < count; i++) foundationDone.push(i);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\nLevel map');

test('level 0 holds the 10 Foundation lessons, numbered 1-10', function() {
  var levels = getWordMeaningsLevels();
  assert.strictEqual(levels.length, 4);
  assert.strictEqual(levels[0].level, 0);
  assert.strictEqual(levels[0].lessons.length, 10);
  levels[0].lessons.forEach(function(lesson, i) {
    assert.strictEqual(lesson.kind, 'foundation');
    assert.strictEqual(lesson.number, i + 1);
    assert.strictEqual(lesson.ref, i);
  });
});

test('Foundation lessons report completion', function() {
  completeFoundation(3);
  var lessons = getWordMeaningsLevels()[0].lessons;
  assert.deepStrictEqual(lessons.map(function(l) { return l.completed; }),
    [true, true, true, false, false, false, false, false, false, false]);
});

test('level 1 is the guided surahs with difficulty <= 2, starting at surah 1', function() {
  var lessons = getWordMeaningsLevels()[1].lessons;
  var expected = PHASE2_GUIDED_SURAHS.filter(function(s) { return s.difficulty <= 2; })
    .map(function(s) { return s.surahId; });
  assert.deepStrictEqual(lessons.map(function(l) { return l.ref; }), expected);
  assert.strictEqual(lessons[0].ref, 1);
  assert.strictEqual(lessons[0].number, 1);
  assert.strictEqual(lessons[lessons.length - 1].number, expected.length);
  lessons.forEach(function(l) { assert.strictEqual(l.kind, 'guided-surah'); });
});

test('level 2 is the guided surahs with difficulty >= 3, starting at surah 102', function() {
  var lessons = getWordMeaningsLevels()[2].lessons;
  var expected = PHASE2_GUIDED_SURAHS.filter(function(s) { return s.difficulty >= 3; })
    .map(function(s) { return s.surahId; });
  assert.deepStrictEqual(lessons.map(function(l) { return l.ref; }), expected);
  assert.strictEqual(lessons[0].ref, 102);
  assert.strictEqual(getWordMeaningsLevels()[1].lessons.length + lessons.length, PHASE2_GUIDED_SURAHS.length);
});

test('level 3 is surah study then root families', function() {
  var lessons = getWordMeaningsLevels()[3].lessons;
  assert.deepStrictEqual(lessons.map(function(l) { return l.kind; }), ['surah-study', 'root-families']);
  assert.deepStrictEqual(lessons.map(function(l) { return l.number; }), [1, 2]);
  assert.strictEqual(lessons[0].completed, false);
  studiedSurahs = 1;
  completedRoots = 1;
  lessons = getWordMeaningsLevels()[3].lessons;
  assert.strictEqual(lessons[0].completed, true);
  assert.strictEqual(lessons[1].completed, true);
});

test('guided surah lessons report completion and every lesson has a title', function() {
  completeGuidedSurah(1);
  var levels = getWordMeaningsLevels();
  assert.strictEqual(levels[1].lessons[0].completed, true);
  assert.strictEqual(levels[1].lessons[1].completed, false);
  levels.forEach(function(level) {
    level.lessons.forEach(function(l) {
      assert.ok(typeof l.title === 'string' && l.title.length > 0, 'title for ' + l.kind + ' ' + l.number);
    });
  });
});

console.log('\nLevel locks');

test('level 0 is never locked', function() {
  assert.strictEqual(getWordMeaningsLevelLock(0), null);
});

test('levels 1-2 are premium-locked without GUIDED_READING', function() {
  assert.strictEqual(getWordMeaningsLevelLock(1), 'premium');
  assert.strictEqual(getWordMeaningsLevelLock(2), 'premium');
});

test('level 3 is premium-locked without VOCABULARY_EXPANSION', function() {
  premiumGuided = true;
  assert.strictEqual(getWordMeaningsLevelLock(3), 'premium');
});

test('premium learner with Foundation 3/10 at track level 0: level 1 is progress-locked', function() {
  premiumGuided = true;
  completeFoundation(3);
  assert.strictEqual(getWordMeaningsLevelLock(1), 'progress');
});

test('raising the track level to 1 opens level 1', function() {
  premiumGuided = true;
  completeFoundation(3);
  assert.strictEqual(raiseTrackLevel('words', 1), true);
  assert.strictEqual(getWordMeaningsLevelLock(1), null);
});

test('finishing every Foundation lesson opens level 1', function() {
  premiumGuided = true;
  completeFoundation(10);
  assert.strictEqual(getWordMeaningsLevelLock(1), null);
});

test('level 2 needs level 1 complete or a placed track level', function() {
  premiumGuided = true;
  completeFoundation(10);
  assert.strictEqual(getWordMeaningsLevelLock(2), 'progress');
  getWordMeaningsLevels()[1].lessons.forEach(function(l) { completeGuidedSurah(l.ref); });
  assert.strictEqual(getWordMeaningsLevelLock(2), null);
});

test('level 3 is progress-locked until level 2 is complete or placed', function() {
  premiumGuided = true;
  premiumExpansion = true;
  assert.strictEqual(getWordMeaningsLevelLock(3), 'progress');
  raiseTrackLevel('words', 3);
  assert.strictEqual(getWordMeaningsLevelLock(3), null);
});

console.log('\nGuided-reading gate');

test('hasReachedGuidedReading is false for a new learner', function() {
  assert.strictEqual(hasReachedGuidedReading(), false);
});

test('hasReachedGuidedReading is true for a Foundation graduate', function() {
  completeFoundation(10);
  assert.strictEqual(hasReachedGuidedReading(), true);
});

test('hasReachedGuidedReading is true for a learner placed at level 1', function() {
  raiseTrackLevel('words', 1);
  assert.strictEqual(hasReachedGuidedReading(), true);
});

test('free non-graduate placed at level 1 is in guided-reading and still gated', function() {
  raiseTrackLevel('words', 1);
  assert.strictEqual(isFoundationGraduate(), false);
  assert.strictEqual(getLearningPhase(), 'guided-reading');
  assert.strictEqual(_isPhase2Gated(), true);
});

test('free non-graduate at track level 0 stays in the foundation phase and is not gated', function() {
  assert.strictEqual(getLearningPhase(), 'foundation');
  assert.strictEqual(_isPhase2Gated(), false);
});

console.log('\nCoverage percentage');

test('getWordMeaningsPercent returns the coverage percent', function() {
  coveragePercent = 43.2;
  assert.strictEqual(getWordMeaningsPercent(), 43.2);
});

test('refreshWordMeaningsPercent records the high-water mark once', function() {
  coveragePercent = 43.2;
  assert.deepStrictEqual(refreshWordMeaningsPercent(), { percent: 43.2, gained: 43.2 });
  assert.deepStrictEqual(refreshWordMeaningsPercent(), { percent: 43.2, gained: 0 });
  assert.strictEqual(getTrackPercent('words'), 43.2);
});

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
