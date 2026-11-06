#!/usr/bin/env node
/**
 * qaida-readability.test.js — Unit tests for "% of the Quran's words you
 * can read" (Qaida track)
 *
 * Tests: the generated data is current and covers every lesson, the
 * figure never falls along the lesson order, 0% with nothing learned,
 * 100% once every skill is learned, placement, the high-water mark, and
 * example words only use skills taught by their lesson.
 *
 * Run: node test/qaida-readability.test.js
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
load('js/qaida/qaida-readability.js');
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

console.log('\n📋 Qaida readability');

test('counts the same 77,429 Quran words as the coverage figure', function () {
  assert.strictEqual(QAIDA_WORD_TOTAL, 77429);
});

test('has a figure for every lesson, never falling along the lesson order', function () {
  var prev = 0;
  QAIDA_LESSONS.forEach(function (l) {
    var p = QAIDA_READABLE_PERCENT[l.id];
    assert.strictEqual(typeof p, 'number', l.id);
    assert.ok(p >= prev, l.id + ' fell from ' + prev + ' to ' + p);
    prev = p;
  });
  assert.strictEqual(prev, 100, 'every word is readable once every skill is learned');
});

test('letters alone read nothing: the Quran text is fully vowelled', function () {
  assert.strictEqual(QAIDA_READABLE_PERCENT['q0-9'], 0);
});

test('the generated file is current (rerun scripts/build-qaida-readability.js)', function () {
  var file = path.join(__dirname, '..', 'js', 'qaida', 'qaida-readability.js');
  // Compared without line endings, which git may rewrite on checkout
  var before = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-qaida-readability.js')]);
  var after = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(before === after, 'qaida-readability.js was out of date and has been regenerated; commit it');
});

test('a new learner can read 0%', function () {
  assert.strictEqual(getQaidaPercent(), 0);
});

test('finishing fatḥah gives that lesson\'s figure, and records the gain', function () {
  QAIDA_LESSONS.slice(0, QAIDA_LESSONS.indexOf(getQaidaLesson('q1-1')) + 1).forEach(function (l) {
    completeQaidaLesson(l.id, 1);
  });
  assert.strictEqual(getQaidaPercent(), QAIDA_READABLE_PERCENT['q1-1']);
  var r = refreshQaidaPercent();
  assert.ok(r.gained > 0);
  assert.strictEqual(refreshQaidaPercent().gained, 0, 'the same figure gains nothing');
});

test('placement into Intermediate reads what Beginner and Elementary teach', function () {
  raiseTrackLevel('qaida', 2);
  assert.strictEqual(getQaidaPercent(), QAIDA_READABLE_PERCENT['q1-9']);
});

test('example words only use skills taught by their lesson or earlier', function () {
  Object.keys(QAIDA_EXAMPLES).forEach(function (id) {
    var known = getQaidaSkillsThrough(id);
    QAIDA_EXAMPLES[id].forEach(function (w) {
      qaidaWordSkills(w).forEach(function (s) {
        assert.ok(known.indexOf(s) >= 0, id + ': ' + w + ' needs ' + s);
      });
    });
  });
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-readability.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
