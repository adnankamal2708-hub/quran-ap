#!/usr/bin/env node
/**
 * recitation-timing-data.test.js — when Al-Husary says each word.
 *
 * js/quran/recitation-timing.js is generated from quran-align's timings
 * (scripts/build-recitation-timing.js). Every timed ayah must have exactly
 * one field per word of the app's own text, or the reader would light the
 * wrong word.
 *
 * Run: node test/recitation-timing-data.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'js/quran/recitation-timing.js');
var builder = require('../scripts/build-recitation-timing.js');
var quranText = require('../scripts/build-occurrence-index.js').loadQuranCorpus();

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

var ctx = { window: {} };
vm.createContext(ctx);
if (fs.existsSync(OUT)) vm.runInContext(fs.readFileSync(OUT, 'utf8'), ctx);
var timing = ctx.window.__RECITATION_TIMING || { ayahs: [] };
var DROPPED = ['2:181', '8:6', '12:1', '13:37', '15:1', '15:7', '27:20', '36:22', '37:164', '41:47'];

console.log('\n📋 Recitation timing data');

t('every surah has one entry per verse, in 10 ms units', function () {
  assert.strictEqual(timing.unit, 10);
  assert.strictEqual(timing.ayahs.length, 114);
  for (var s = 1; s <= 114; s++) assert.strictEqual(timing.ayahs[s - 1].length, quranText[s].verses.length, 'surah ' + s);
});

t('6,226 ayahs are timed; the 10 whose words differ from the app text are not', function () {
  var empty = [];
  timing.ayahs.forEach(function (surah, si) {
    surah.forEach(function (e, ai) { if (!e) empty.push((si + 1) + ':' + (ai + 1)); });
  });
  DROPPED.forEach(function (ref) { assert.ok(empty.indexOf(ref) >= 0, ref + ' should be untimed'); });
  assert.deepStrictEqual(empty.sort(), DROPPED.slice().sort());
});

t('a timed ayah has exactly one field per word of the app text', function () {
  timing.ayahs.forEach(function (surah, si) {
    surah.forEach(function (e, ai) {
      if (!e) return;
      var words = quranText[si + 1].verses[ai].text.split(/\s+/).filter(Boolean).length;
      assert.strictEqual(e.split(';')[0].split(',').length, words, (si + 1) + ':' + (ai + 1));
    });
  });
});

t('112:1 is stored as the source times it (850, 1380, 2100, 3720; ends 4610)', function () {
  // deltas 85, 53, 72, 162 and end 89, in 10 ms units, base 36
  assert.strictEqual(timing.ayahs[111][0], '2d,1h,20,4i;2h');
});

t('a failed alignment (end before start) leaves that word untimed', function () {
  assert.strictEqual(builder.encodeAyah([[0, 1, 100, 200], [1, 2, 300, 250], [2, 3, 400, 500]], 3), 'a,,u;a');
});

t('words out of order or not matching the text give no timings', function () {
  assert.strictEqual(builder.encodeAyah([[0, 1, 500, 600], [1, 2, 100, 200]], 2), '');
  assert.strictEqual(builder.encodeAyah([[0, 1, 100, 200]], 2), '');
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
