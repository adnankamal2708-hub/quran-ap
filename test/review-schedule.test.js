#!/usr/bin/env node
/**
 * review-schedule.test.js — Unit tests for the shared review scheduler
 *
 * Tests: miss and right-answer steps, leaving the queue, no-change cases,
 * map normalising, merging and the due list.
 *
 * Run: node test/review-schedule.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/data-core/review-schedule.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
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

console.log('\n📋 Review schedule');

test('the retry delay and day steps', function () {
  assert.strictEqual(REVIEW_RETRY_MS, 600000);
  assert.deepStrictEqual(REVIEW_DAYS, [1, 3, 7, 21]);
});

test('a miss schedules a retry at step 0, whatever the record', function () {
  assert.deepStrictEqual(scheduleReviewAnswer(undefined, false, T0), { due: T0 + 600000, step: 0 });
  assert.deepStrictEqual(scheduleReviewAnswer({ due: T0 + DAY, step: 3 }, false, T0), { due: T0 + 600000, step: 0 });
});

test('a right answer on a due step-k record moves it to the next day step', function () {
  for (var k = 0; k < REVIEW_DAYS.length; k++) {
    assert.deepStrictEqual(scheduleReviewAnswer({ due: T0, step: k }, true, T0),
      { due: T0 + REVIEW_DAYS[k] * DAY, step: k + 1 });
  }
});

test('a right answer at the last step leaves the queue', function () {
  assert.strictEqual(scheduleReviewAnswer({ due: T0, step: 4 }, true, T0), null);
});

test('a right answer on a record that is not due, or not present, changes nothing', function () {
  assert.strictEqual(scheduleReviewAnswer({ due: T0 + 1, step: 1 }, true, T0), undefined);
  assert.strictEqual(scheduleReviewAnswer(undefined, true, T0), undefined);
});

test('normalizeReviewMap drops bad due, bad step and rejected ids', function () {
  var ok = function (id) { return id !== 'nope'; };
  var out = normalizeReviewMap({
    ba: { due: 5, step: 1 }, nope: { due: 5, step: 0 }, ta: { due: 'x', step: 0 },
    jim: { due: 5, step: 99 }, kha: { due: 5, step: 1.5 }, ha: { due: Infinity, step: 0 },
    dal: { due: 7, step: 4 }, ra: null,
  }, ok);
  assert.deepStrictEqual(out, { ba: { due: 5, step: 1 }, dal: { due: 7, step: 4 } });
  assert.deepStrictEqual(normalizeReviewMap(null, ok), {});
});

test('mergeReviewMaps keeps the lower step, then the earlier due, and the union', function () {
  var a = { ba: { due: T0 + 3 * DAY, step: 2 }, ta: { due: T0, step: 0 }, sa: { due: T0 + 5, step: 1 } };
  var b = { ba: { due: T0 + DAY, step: 1 }, jim: { due: T0, step: 0 }, sa: { due: T0 + 2, step: 1 } };
  var m = mergeReviewMaps(a, b);
  assert.deepStrictEqual(m.ba, { due: T0 + DAY, step: 1 });
  assert.deepStrictEqual(m.sa, { due: T0 + 2, step: 1 });
  assert.ok(m.ta && m.jim);
});

test('a record was scheduled at its due time less its step\'s wait', function () {
  assert.strictEqual(reviewScheduledAt(scheduleReviewAnswer(undefined, false, T0)), T0);
  for (var k = 0; k < REVIEW_DAYS.length; k++) {
    assert.strictEqual(reviewScheduledAt(scheduleReviewAnswer({ due: T0, step: k }, true, T0)), T0, 'step ' + (k + 1));
  }
});

test('normalizeClearedMap keeps finite times under accepted ids', function () {
  var ok = function (id) { return id !== 'nope'; };
  assert.deepStrictEqual(normalizeClearedMap({ ba: T0, nope: T0, ta: 'x', jim: Infinity, kha: null }, ok), { ba: T0 });
  assert.deepStrictEqual(normalizeClearedMap(undefined, ok), {});
});

test('mergeClearedMaps keeps the later time of each id, and the union', function () {
  assert.deepStrictEqual(mergeClearedMaps({ ba: 5, ta: 9 }, { ba: 7, jim: 1 }), { ba: 7, ta: 9, jim: 1 });
});

test('dropClearedReviews drops records scheduled at or before their id was cleared, and keeps later ones', function () {
  var review = {
    ba: { due: T0 - DAY + 3 * DAY, step: 2 },          // scheduled T0 - DAY
    ta: { due: T0 + REVIEW_RETRY_MS, step: 0 },        // scheduled T0
    jim: { due: T0 + 1 + REVIEW_RETRY_MS, step: 0 },   // scheduled just after
    kha: { due: T0, step: 0 },
  };
  var out = dropClearedReviews(review, { ba: T0, ta: T0, jim: T0 });
  assert.deepStrictEqual(Object.keys(out).sort(), ['jim', 'kha']);
  assert.strictEqual(Object.keys(review).length, 4, 'the input is not changed');
});

test('dueReviewIds lists due ids, most overdue first', function () {
  var map = { a: { due: T0 - 5, step: 0 }, b: { due: T0 - 50, step: 1 }, c: { due: T0 + 1, step: 0 } };
  assert.deepStrictEqual(dueReviewIds(map, T0), ['b', 'a']);
  assert.deepStrictEqual(dueReviewIds({}, T0), []);
});

console.log('\n' + '='.repeat(50));
console.log('  review-schedule.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
