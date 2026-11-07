#!/usr/bin/env node
/**
 * qaida-track.test.js — Unit tests for the Qaida track module
 *
 * Tests: level shape, lesson order, reading-check pass mark, level locks,
 * placement opening levels, next lesson, learned skills, merge, and
 * corrupt-storage fallback.
 *
 * Run: node test/qaida-track.test.js
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
load('js/qaida/qaida-marks.js');
load('js/qaida/qaida-lessons.js');
load('js/data-core/review-schedule.js');
load('js/data-core/qaida-track.js');

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

function finishLevel(level) {
  getQaidaLevelLessons(level).forEach(function (l) { completeQaidaLesson(l.id, 1); });
}

console.log('\n📋 Qaida track');

test('four levels in the track-screen shape, titled from the strings', function () {
  var levels = getQaidaLevels();
  assert.strictEqual(levels.length, 4);
  var first = levels[0].lessons[0];
  assert.strictEqual(first.kind, 'qaida');
  assert.strictEqual(first.ref, 'q0-1');
  assert.strictEqual(first.title, 'Letters alif to khā');
  assert.strictEqual(first.completed, false);
});

test('a new learner starts at Beginner lesson 1 with only it unlocked', function () {
  assert.strictEqual(getQaidaNextLesson(0).ref, 'q0-1');
  assert.ok(isQaidaLessonUnlocked('q0-1'));
  assert.ok(!isQaidaLessonUnlocked('q0-2'));
  assert.strictEqual(getQaidaLevel(), 0);
});

test('finishing a lesson unlocks the next one and moves Up next', function () {
  assert.strictEqual(completeQaidaLesson('q0-1', 1), true);
  assert.ok(isQaidaLessonUnlocked('q0-2'));
  assert.strictEqual(getQaidaNextLesson(0).ref, 'q0-2');
});

test('a repeat with a better score is kept but not counted as new', function () {
  completeQaidaLesson('q0-1', 0.5);
  assert.strictEqual(completeQaidaLesson('q0-1', 0.9), false);
  assert.strictEqual(loadQaidaProgress().completed['q0-1'].score, 0.9);
});

test('a reading check below 80% does not count and keeps the next level locked', function () {
  getQaidaLevelLessons(0).slice(0, -1).forEach(function (l) { completeQaidaLesson(l.id, 1); });
  assert.strictEqual(completeQaidaLesson('q0-9', 0.7), false);
  assert.strictEqual(getQaidaLevelLock(1), 'progress');
  assert.strictEqual(completeQaidaLesson('q0-9', 0.8), true);
  assert.strictEqual(getQaidaLevelLock(1), null);
  assert.strictEqual(getQaidaLevel(), 1);
});

test('Qaida has no premium lock on any level', function () {
  for (var l = 0; l < 4; l++) assert.notStrictEqual(getQaidaLevelLock(l), 'premium');
});

test('placement opens the placed level and counts earlier skills as learned', function () {
  raiseTrackLevel('qaida', 2);
  assert.strictEqual(getQaidaLevelLock(2), null);
  assert.strictEqual(getQaidaNextLesson(2).ref, 'q2-1');
  var skills = getLearnedQaidaSkills();
  assert.ok(skills.indexOf('ya') >= 0 && skills.indexOf('long-vowels') >= 0);
  assert.strictEqual(skills.indexOf('sukun'), -1);
});

test('learned skills are those of finished lessons', function () {
  completeQaidaLesson('q0-1', 1);
  assert.deepStrictEqual(getLearnedQaidaSkills(), ['alif', 'ba', 'ta', 'tha', 'jim', 'hha', 'kha']);
});

test('nothing left gives no next lesson', function () {
  for (var l = 0; l < 4; l++) finishLevel(l);
  assert.strictEqual(getQaidaNextLesson(0), null);
  assert.strictEqual(getQaidaLevel(), 3);
});

test('merge keeps every finished lesson, the earliest time and the best score', function () {
  var local = { completed: { 'q0-1': { at: 200, score: 0.6 }, 'q0-2': { at: 300, score: 1 } }, updatedAt: 5 };
  var cloud = { completed: { 'q0-1': { at: 100, score: 0.9 }, 'q0-3': { at: 400, score: 1 } }, updatedAt: 9 };
  var m = mergeQaidaProgress(local, cloud);
  assert.deepStrictEqual(Object.keys(m.completed).sort(), ['q0-1', 'q0-2', 'q0-3']);
  assert.deepStrictEqual(m.completed['q0-1'], { at: 100, score: 0.9 });
  assert.strictEqual(m.updatedAt, 9);
});

test('corrupt storage and unknown lesson ids are ignored', function () {
  _storage[QAIDA_PROGRESS_KEY] = '{not json';
  assert.deepStrictEqual(loadQaidaProgress().completed, {});
  _storage[QAIDA_PROGRESS_KEY] = JSON.stringify({ completed: { 'zz-9': { at: 1 }, 'q0-1': { at: 1, score: 7 } } });
  assert.deepStrictEqual(loadQaidaProgress().completed, { 'q0-1': { at: 1, score: 1 } });
  assert.strictEqual(completeQaidaLesson('nope', 1), false);
});

console.log('\n📋 Qaida review queue');

var T0 = 1700000000000;
var DAY = 24 * 60 * 60 * 1000;

test('a missed skill is due again a little later, not straight away', function () {
  recordQaidaAnswer('ba', false, T0);
  assert.deepStrictEqual(getDueQaidaSkills(T0), []);
  assert.deepStrictEqual(getDueQaidaSkills(T0 + QAIDA_REVIEW_RETRY_MS), ['ba']);
});

test('right answers when due space a skill out, then it leaves the queue', function () {
  recordQaidaAnswer('ba', false, T0);
  var now = T0 + QAIDA_REVIEW_RETRY_MS;
  QAIDA_REVIEW_DAYS.forEach(function (days) {
    recordQaidaAnswer('ba', true, now);
    assert.deepStrictEqual(getDueQaidaSkills(now + days * DAY - 1), [], 'not due before ' + days + ' days');
    now += days * DAY;
    assert.deepStrictEqual(getDueQaidaSkills(now), ['ba'], 'due after ' + days + ' days');
  });
  recordQaidaAnswer('ba', true, now);
  assert.deepStrictEqual(getDueQaidaSkills(now + 365 * DAY), []);
  assert.strictEqual(loadQaidaProgress().review.ba, undefined);
});

test('a miss sends a spaced-out skill back to the start', function () {
  recordQaidaAnswer('fatha', false, T0);
  recordQaidaAnswer('fatha', true, T0 + QAIDA_REVIEW_RETRY_MS);
  recordQaidaAnswer('fatha', false, T0 + 2 * DAY);
  assert.deepStrictEqual(getDueQaidaSkills(T0 + 2 * DAY + QAIDA_REVIEW_RETRY_MS), ['fatha']);
  assert.strictEqual(loadQaidaProgress().review.fatha.step, 0);
});

test('a right answer on a skill not in the queue, or not yet due, changes nothing', function () {
  recordQaidaAnswer('ta', true, T0);
  assert.deepStrictEqual(loadQaidaProgress().review, {});
  recordQaidaAnswer('ba', false, T0);
  recordQaidaAnswer('ba', true, T0 + 1);
  assert.strictEqual(loadQaidaProgress().review.ba.step, 0);
});

test('unknown skills are ignored', function () {
  recordQaidaAnswer('nope', false, T0);
  recordQaidaAnswer(undefined, false, T0);
  assert.deepStrictEqual(loadQaidaProgress().review, {});
});

test('the most overdue skill comes first', function () {
  recordQaidaAnswer('jim', false, T0 + 1000);
  recordQaidaAnswer('ba', false, T0);
  recordQaidaAnswer('sukun', false, T0 + 2000);
  assert.deepStrictEqual(getDueQaidaSkills(T0 + DAY), ['ba', 'jim', 'sukun']);
});

test('the queue survives older progress with no review field, and bad entries are dropped', function () {
  _storage[QAIDA_PROGRESS_KEY] = JSON.stringify({ completed: { 'q0-1': { at: 1, score: 1 } } });
  assert.deepStrictEqual(loadQaidaProgress().review, {});
  _storage[QAIDA_PROGRESS_KEY] = JSON.stringify({ review: { ba: { due: 5, step: 1 }, nope: { due: 5, step: 0 }, ta: { due: 'x', step: 0 }, jim: { due: 5, step: 99 } } });
  assert.deepStrictEqual(Object.keys(loadQaidaProgress().review), ['ba']);
});

test('merge keeps every queued skill, the less advanced copy when both have one', function () {
  var local = { review: { ba: { due: T0 + 3 * DAY, step: 2 }, ta: { due: T0, step: 0 } } };
  var cloud = { review: { ba: { due: T0 + DAY, step: 1 }, jim: { due: T0, step: 0 } } };
  var m = mergeQaidaProgress(local, cloud);
  assert.deepStrictEqual(m.review.ba, { due: T0 + DAY, step: 1 });
  assert.ok(m.review.ta && m.review.jim);
});

/** Bring `skill` through every review step until it leaves the queue; returns the time it left. */
function graduate(skill) {
  var now = T0;
  recordQaidaAnswer(skill, false, now);
  now += QAIDA_REVIEW_RETRY_MS;
  recordQaidaAnswer(skill, true, now);
  QAIDA_REVIEW_DAYS.forEach(function (days) {
    now += days * DAY;
    recordQaidaAnswer(skill, true, now);
  });
  assert.strictEqual(loadQaidaProgress().review[skill], undefined, 'left the queue');
  return now;
}

test('a skill that left the queue stays gone after a merge with a stale copy that still has it', function () {
  var stale = JSON.parse(JSON.stringify(loadQaidaProgress()));
  stale.review.ba = { due: T0 + DAY, step: 1 };
  var left = graduate('ba');
  var m = mergeQaidaProgress(loadQaidaProgress(), stale);
  assert.strictEqual(m.review.ba, undefined, 'not brought back');
  assert.strictEqual(m.cleared.ba, left);
  assert.strictEqual(mergeQaidaProgress(stale, m).review.ba, undefined, 'either order');
});

test('a miss after the skill left the queue brings it back through a merge', function () {
  var left = graduate('ba');
  var cleared = loadQaidaProgress();
  _storage = {};
  recordQaidaAnswer('ba', false, left + 1000);
  var m = mergeQaidaProgress(cleared, loadQaidaProgress());
  assert.deepStrictEqual(m.review.ba, { due: left + 1000 + QAIDA_REVIEW_RETRY_MS, step: 0 });
});

test('a later entry is kept even when the stale copy holds a less advanced one', function () {
  var left = graduate('ba');
  recordQaidaAnswer('ba', false, left + 1000);
  recordQaidaAnswer('ba', true, left + 1000 + QAIDA_REVIEW_RETRY_MS);
  var m = mergeQaidaProgress(loadQaidaProgress(), { review: { ba: { due: T0 + QAIDA_REVIEW_RETRY_MS, step: 0 } } });
  assert.strictEqual(m.review.ba.step, 1);
});

test('progress without a cleared field loads, with none', function () {
  _storage[QAIDA_PROGRESS_KEY] = JSON.stringify({ review: { ba: { due: 5, step: 1 } } });
  assert.deepStrictEqual(loadQaidaProgress().cleared, {});
  assert.deepStrictEqual(Object.keys(loadQaidaProgress().review), ['ba']);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-track.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
