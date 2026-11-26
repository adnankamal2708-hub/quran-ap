#!/usr/bin/env node
/**
 * streak.test.js — a streak only counts while it is unbroken.
 *
 * Tests: loadStreakData (stats-ui.js) and updateStreak (quiz-ui.js).
 *
 * Run: node test/streak.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var _storage = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(_storage, k) ? _storage[k] : null; },
  setItem: function (k, v) { _storage[k] = String(v); },
  removeItem: function (k) { delete _storage[k]; },
};
global.window = {};

['js/ui/stats-ui.js', 'js/ui/quiz-ui.js'].forEach(function (f) {
  var full = path.join(__dirname, '..', f);
  vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
});

var passed = 0;
var failed = 0;
function test(name, fn) {
  _storage = {};
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name); console.log('    ' + e.message); }
}
function setStreak(streak, lastDate) { localStorage.setItem('quran_streak', JSON.stringify({ streak: streak, lastDate: lastDate })); }

console.log('\n🔥 Streak');

test('no streak saved is 0', function () {
  assert.strictEqual(loadStreakData().streak, 0);
});

test('a streak last kept today counts', function () {
  setStreak(5, getDateKey());
  assert.strictEqual(loadStreakData().streak, 5);
});

test('a streak last kept yesterday still counts until today ends', function () {
  setStreak(5, getYesterdayKey());
  assert.strictEqual(loadStreakData().streak, 5);
});

test('a streak last kept months ago is broken and shows 0', function () {
  setStreak(1, '2020-6-29');
  assert.strictEqual(loadStreakData().streak, 0);
});

test('studying after a broken streak starts again at 1', function () {
  setStreak(9, '2020-6-29');
  updateStreak();
  assert.strictEqual(loadStreakData().streak, 1);
  assert.strictEqual(loadStreakData().lastDate, getDateKey());
});

test('studying the day after continues the streak', function () {
  setStreak(4, getYesterdayKey());
  updateStreak();
  assert.strictEqual(loadStreakData().streak, 5);
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
