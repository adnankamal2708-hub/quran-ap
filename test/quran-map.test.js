#!/usr/bin/env node
/**
 * quran-map.test.js — the Quran map's logic (js/data-core/quran-map.js)
 *
 * Run: node test/quran-map.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
(0, eval)(fs.readFileSync(path.join(ROOT, 'js/data-core/quran-map.js'), 'utf8'));

function load(file) {
  var ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  return ctx.window;
}
var MAP = JSON.parse(JSON.stringify(load('js/quran/quran-map-data.js').__QURAN_MAP));
var OCC = load('js/data/occurrence-index.js');
var WORDS = require('../scripts/build-occurrence-index.js').loadVocabulary()
  .filter(function (w) { return w && w.arabic; })
  .map(function (w, i) { return { id: 'w' + i, arabic: w.arabic }; });

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}
function masteredOf(words) {
  var m = {};
  words.forEach(function (w) { m[w.id] = true; });
  return m;
}
function sum(stats, field) {
  return stats.reduce(function (n, p) { return n + p[field]; }, 0);
}

console.log('\n📋 Pages');
var none = quranMapPageStats(MAP, {});
t('604 pages, each with words', function () {
  assert.strictEqual(none.length, 604);
  none.forEach(function (p, i) { assert.strictEqual(p.page, i + 1); assert.ok(p.total > 0, 'page ' + p.page); });
  assert.strictEqual(sum(none, 'total'), OCC.OCCURRENCE_INDEX_TOTAL_TOKENS);
});
t('page 1 is 1:1–1:7', function () {
  var refs = quranMapPageAyahs(MAP, 1, {}).map(function (a) { return a.surah + ':' + a.ayah; });
  assert.deepStrictEqual(refs, ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
});
t('page 604 is 112:1–114:6', function () {
  var ayahs = quranMapPageAyahs(MAP, 604, {});
  assert.deepStrictEqual([ayahs[0].surah, ayahs[0].ayah], [112, 1]);
  var last = ayahs[ayahs.length - 1];
  assert.deepStrictEqual([last.surah, last.ayah], [114, 6]);
  assert.strictEqual(ayahs.length, 4 + 5 + 6);
});
t('every ayah is on exactly one page', function () {
  var seen = {}, n = 0;
  for (var p = 1; p <= 604; p++) {
    quranMapPageAyahs(MAP, p, {}).forEach(function (a) {
      var ref = a.surah + ':' + a.ayah;
      assert.ok(!seen[ref], ref + ' twice');
      seen[ref] = true; n++;
    });
  }
  assert.strictEqual(n, 6236);
});
t('juz of pages 1, 22, 582 and 604', function () {
  assert.strictEqual(none[0].juz, 1);
  assert.strictEqual(none[21].juz, 2);
  assert.strictEqual(none[581].juz, 30);
  assert.strictEqual(none[603].juz, 30);
});

console.log('\n📋 Known words');
t('no mastered words: nothing known, every page shade 0', function () {
  assert.deepStrictEqual(quranMapKnownKeys(MAP, {}, WORDS, OCC.OCCURRENCE_INDEX_KEY), {});
  assert.strictEqual(sum(none, 'known'), 0);
  none.forEach(function (p) { assert.strictEqual(quranMapShade(p.known, p.total), 0); });
});
t('known words over all pages equal the words behind % of the Quran', function () {
  [WORDS.slice(0, 50), WORDS.slice(100, 400), WORDS].forEach(function (words) {
    var known = quranMapKnownKeys(MAP, masteredOf(words), WORDS, OCC.OCCURRENCE_INDEX_KEY);
    var seen = {}, covered = 0;
    words.forEach(function (w) {
      var key = OCC.OCCURRENCE_INDEX_KEY(w.arabic);
      if (key && !seen[key]) { seen[key] = true; covered += OCC.OCCURRENCE_INDEX_TOKEN_COUNTS[key] || 0; }
    });
    assert.strictEqual(sum(quranMapPageStats(MAP, known), 'known'), covered);
  });
});
t('page view flags each word, one flag per word', function () {
  var words = WORDS.filter(function (w) { return ['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ'].indexOf(w.arabic) >= 0; });
  var known = quranMapKnownKeys(MAP, masteredOf(words), WORDS, OCC.OCCURRENCE_INDEX_KEY);
  var first = quranMapPageAyahs(MAP, 604, known)[0];
  assert.strictEqual(first.known.length, 4);
  assert.ok(first.known.some(Boolean));
  assert.deepStrictEqual(quranMapPageAyahs(MAP, 604, {})[0].known, [false, false, false, false]);
});
t('unmastered words in the list are not known', function () {
  var known = quranMapKnownKeys(MAP, {}, WORDS.slice(0, 10), OCC.OCCURRENCE_INDEX_KEY);
  assert.deepStrictEqual(known, {});
});

console.log('\n📋 Shades');
t('equal 20% bands', function () {
  assert.strictEqual(quranMapShade(0, 0), 0);
  assert.strictEqual(quranMapShade(0, 100), 0);
  assert.strictEqual(quranMapShade(199, 1000), 0);
  assert.strictEqual(quranMapShade(20, 100), 1);
  assert.strictEqual(quranMapShade(59, 100), 2);
  assert.strictEqual(quranMapShade(60, 100), 3);
  assert.strictEqual(quranMapShade(80, 100), 4);
  assert.strictEqual(quranMapShade(100, 100), 4);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
