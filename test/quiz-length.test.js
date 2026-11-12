#!/usr/bin/env node
/**
 * quiz-length.test.js — Short / Normal / Long quiz length.
 *
 * Run: node test/quiz-length.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var store = {};
var ctx = {
  localStorage: {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data-core', 'quiz-length.js'), 'utf8'), ctx);

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
// A shuffle that reverses, so rounds are predictable
function reverse(a) { return a.slice().reverse(); }
function words(n) { var out = []; for (var i = 0; i < n; i++) out.push({ id: 'w' + i }); return out; }

test('lengths are 10, 15 and 25 questions', function () {
  assert.strictEqual(JSON.stringify(ctx.QUIZ_LENGTHS), '{"short":10,"normal":15,"long":25}');
});

test('Normal is the default', function () {
  store = {};
  assert.strictEqual(ctx.getQuizLength(), 'normal');
});

test('a chosen length is kept', function () {
  store = {};
  assert.strictEqual(ctx.setQuizLength('long'), true);
  assert.strictEqual(ctx.getQuizLength(), 'long');
});

test('an unknown length is refused and a bad saved value ignored', function () {
  store = {};
  assert.strictEqual(ctx.setQuizLength('huge'), false);
  store.quran_quiz_length = 'huge';
  assert.strictEqual(ctx.getQuizLength(), 'normal');
});

test('blocked storage falls back to Normal', function () {
  var saved = ctx.localStorage;
  ctx.localStorage = { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } };
  assert.strictEqual(ctx.getQuizLength(), 'normal');
  assert.strictEqual(ctx.setQuizLength('short'), true);
  ctx.localStorage = saved;
});

test('10 words, Normal: every word once, then 5 asked again', function () {
  var list = ctx.buildQuizRounds(words(10), 15, reverse);
  assert.strictEqual(list.length, 15);
  var firstRound = list.slice(0, 10).map(function (w) { return w.id; }).sort();
  assert.strictEqual(new Set(firstRound).size, 10, 'each word once in the first round');
});

test('never fewer questions than lesson words', function () {
  assert.strictEqual(ctx.buildQuizRounds(words(12), 10, reverse).length, 12);
});

test('the same word is never asked twice in a row', function () {
  var list = ctx.buildQuizRounds(words(3), 25, reverse);
  for (var i = 1; i < list.length; i++) assert.notStrictEqual(list[i], list[i - 1], 'at ' + i);
});

test('a one-word lesson still fills the length', function () {
  assert.strictEqual(ctx.buildQuizRounds(words(1), 10, reverse).length, 10);
});

test('no words gives no questions', function () {
  assert.strictEqual(ctx.buildQuizRounds([], 15, reverse).length, 0);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
