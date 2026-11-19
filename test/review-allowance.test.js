#!/usr/bin/env node
/**
 * review-allowance.test.js — how many reviews each plan gets a day
 * (js/data-core/review-allowance.js): Free 10, Monthly 100, Yearly no limit,
 * counted per calendar day.
 *
 * Run: node test/review-allowance.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var _store = {};
global.window = global;
global.localStorage = {
  getItem: function (k) { return k in _store ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
};
function load(rel) {
  global.eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var '));
}
load('js/data-core/app-facts.js');
load('js/data-core/review-allowance.js');

var passed = 0, failed = 0;
function t(name, fn) {
  _store = {};
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
  delete global.__premium;
}
function onPlan(plan) { global.__premium = { getPlan: function () { return plan; } }; }

console.log('\n📋 Review allowance');

t('each plan has its daily cap: Free 10, Monthly 100, Yearly none', function () {
  assert.strictEqual(reviewCap('free'), 10);
  assert.strictEqual(reviewCap('monthly'), 100);
  assert.strictEqual(reviewCap('yearly'), Infinity);
});

t('without a premium service the learner is on Free', function () {
  assert.strictEqual(currentReviewPlan(), 'free');
  onPlan('yearly');
  assert.strictEqual(currentReviewPlan(), 'yearly');
});

t('reviews done today count down the allowance', function () {
  assert.strictEqual(reviewsLeftToday(), 10);
  for (var i = 0; i < 4; i++) recordReviewDone();
  assert.strictEqual(reviewsDoneToday(), 4);
  assert.strictEqual(reviewsLeftToday(), 6);
  for (var j = 0; j < 9; j++) recordReviewDone();
  assert.strictEqual(reviewsLeftToday(), 0, 'never below zero');
});

t('Monthly gets 100 and Yearly never runs out', function () {
  for (var i = 0; i < 30; i++) recordReviewDone();
  onPlan('monthly');
  assert.strictEqual(reviewsLeftToday(), 70);
  onPlan('yearly');
  assert.strictEqual(reviewsLeftToday(), Infinity);
});

t('a new day starts a fresh count', function () {
  localStorage.setItem('quran_reviews_today', JSON.stringify({ day: '2000-01-01', count: 10 }));
  assert.strictEqual(reviewsDoneToday(), 0);
  assert.strictEqual(reviewsLeftToday(), 10);
});

t('a damaged saved count is treated as none', function () {
  localStorage.setItem('quran_reviews_today', '{not json');
  assert.strictEqual(reviewsDoneToday(), 0);
});

t('the daily goal can be set up to the cap, and never above 100', function () {
  assert.strictEqual(reviewGoalMax('free'), 10);
  assert.strictEqual(reviewGoalMax('monthly'), 100);
  assert.strictEqual(reviewGoalMax('yearly'), 100);
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
