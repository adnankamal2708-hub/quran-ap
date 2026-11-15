#!/usr/bin/env node
/**
 * daily-ayah.test.js — choosing Today's ayah (js/data-core/daily-ayah.js)
 *
 * Run: node test/daily-ayah.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var store = {};
global.localStorage = {
  getItem: function (k) { return store.hasOwnProperty(k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
};
// Indirect eval so the module's top-level declarations become globals
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js/data-core/daily-ayah.js'), 'utf8'));

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

/** Mastered (stage 2) SRS entries for these word numbers. */
function srs(ids) {
  var out = {};
  ids.forEach(function (n, i) { out['cw_' + n] = { stage: 2, ratedAt: 1000 + i }; });
  return out;
}
var EMPTY = { date: '', ref: '', done: [], readCount: 0 };
var DAY = '2026-11-16';

console.log('\n📋 Picking');
t('null when nothing fits', function () {
  assert.strictEqual(pickDailyAyah({ '1:1': [1, 2, 3, 4] }, {}, EMPTY, DAY), null);
  assert.strictEqual(pickDailyAyah({}, srs([1]), EMPTY, DAY), null);
});
t('2/3 known with 2 hints is a first choice', function () {
  var p = pickDailyAyah({ '1:1': [1, 2, 3, 4, null, null] }, srs([1, 2, 3, 4]), EMPTY, DAY);
  assert.strictEqual(p.ref, '1:1');
  assert.strictEqual(p.known, 4);
  assert.strictEqual(p.total, 6);
  assert.deepStrictEqual(p.hints, [4, 5]);
});
t('3 hints only through the fallback, and only when no first choice exists', function () {
  var index = { '1:1': [1, 2, 3, null, null, null], '1:2': [1, 2, 3, null] };
  assert.strictEqual(pickDailyAyah(index, srs([1, 2, 3]), EMPTY, DAY).ref, '1:2');
  delete index['1:2'];
  assert.strictEqual(pickDailyAyah(index, srs([1, 2, 3]), EMPTY, DAY).ref, '1:1');
});
t('under half known is never picked', function () {
  assert.strictEqual(pickDailyAyah({ '1:1': [1, 2, 3, 4, 5] }, srs([1, 2]), EMPTY, DAY), null);
});
t('a word learned but not mastered (stage 1) is a hint', function () {
  var s = srs([1, 2]); s.cw_3 = { stage: 1, ratedAt: 5 };
  var p = pickDailyAyah({ '1:1': [1, 2, 3, null] }, s, EMPTY, DAY);
  assert.deepStrictEqual(p.hints, [2, 3]);
});
t('"+N" is known when cw_N is mastered', function () {
  var p = pickDailyAyah({ '1:1': [1, '+2', 3, 4] }, srs([1, 2, 3, 4]), EMPTY, DAY);
  assert.strictEqual(p.known, 4);
});
t('prefers the ayah with the most recently mastered word', function () {
  var s = srs([1, 2, 3]); s.cw_9 = { stage: 2, ratedAt: 99999 };
  var p = pickDailyAyah({ '1:1': [1, 2, 3, null], '2:1': [1, 2, 9, null] }, s, EMPTY, DAY);
  assert.strictEqual(p.ref, '2:1');
});
t('deterministic for the same inputs', function () {
  var index = {};
  for (var i = 1; i <= 40; i++) index['3:' + i] = [1, 2, 3, null];
  var s = { cw_1: { stage: 2, ratedAt: 5 }, cw_2: { stage: 2, ratedAt: 5 }, cw_3: { stage: 2, ratedAt: 5 } };
  var a = pickDailyAyah(index, s, EMPTY, DAY).ref;
  assert.strictEqual(pickDailyAyah(index, s, EMPTY, DAY).ref, a);
  var other = ['2026-11-17', '2026-11-18', '2026-11-19'].map(function (d) { return pickDailyAyah(index, s, EMPTY, d).ref; });
  assert.ok(other.some(function (r) { return r !== a; }), 'ties should vary by day');
});

console.log('\n📋 The day');
t('same pick all day, even after mastering more words', function () {
  var index = { '1:1': [1, 2, 3, null], '2:1': [1, 2, 9, null] };
  var state = { date: DAY, ref: '1:1', done: [], readCount: 0 };
  var s = srs([1, 2, 3]); s.cw_9 = { stage: 2, ratedAt: 99999 };
  assert.strictEqual(pickDailyAyah(index, s, state, DAY).ref, '1:1');
});
t('new pick on a new day, never one already done', function () {
  var index = { '1:1': [1, 2, 3, null], '2:1': [1, 2, 3, null] };
  var state = { date: DAY, ref: '1:1', done: ['1:1'], readCount: 1 };
  assert.strictEqual(pickDailyAyah(index, srs([1, 2, 3]), state, '2026-11-17').ref, '2:1');
  state.done.push('2:1');
  assert.strictEqual(pickDailyAyah(index, srs([1, 2, 3]), state, '2026-11-18'), null);
});
t('the date key is the local calendar day', function () {
  assert.strictEqual(dailyAyahDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

console.log('\n📋 Finishing and saving');
t('"I understood it" counts once; "Show translation" only marks it done', function () {
  var s1 = completeDailyAyah(EMPTY, '1:1', true);
  assert.deepStrictEqual(s1.done, ['1:1']);
  assert.strictEqual(s1.readCount, 1);
  assert.strictEqual(completeDailyAyah(s1, '1:1', true).readCount, 1);
  var s2 = completeDailyAyah(s1, '2:1', false);
  assert.deepStrictEqual(s2.done, ['1:1', '2:1']);
  assert.strictEqual(s2.readCount, 1);
  assert.deepStrictEqual(EMPTY.done, [], 'input state is not changed');
});
t('state saves and loads; bad data gives the empty state', function () {
  saveDailyAyahState({ date: DAY, ref: '1:1', done: ['1:1'], readCount: 3 });
  assert.strictEqual(loadDailyAyahState().readCount, 3);
  store.quran_daily_ayah = '{not json';
  assert.deepStrictEqual(loadDailyAyahState(), EMPTY);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
