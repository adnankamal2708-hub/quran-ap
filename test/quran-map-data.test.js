#!/usr/bin/env node
/**
 * quran-map-data.test.js — the data behind the Quran map.
 *
 * js/quran/quran-map-data.js holds Tanzil's Madinah page and juz starts and,
 * for every ayah, each word's occurrence-index key (the matcher behind
 * "% of the Quran"), so the map can never disagree with that figure.
 *
 * Run: node test/quran-map-data.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'js/quran/quran-map-data.js');
var builder = require('../scripts/build-quran-map.js');

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

var inputs = builder.loadInputs();
var src = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
var map = JSON.parse(JSON.stringify(ctx.window.__QURAN_MAP || { pages: [], juz: [], keys: [], ayahs: [] }));

var occCtx = { window: {} };
vm.createContext(occCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/occurrence-index.js'), 'utf8'), occCtx);
var occ = occCtx.window;

function ayahKeys(ref) {
  var p = ref.split(':');
  return builder.decodeAyah(map.ayahs[p[0] - 1][p[1] - 1]);
}
function allRefs() {
  var refs = [];
  map.ayahs.forEach(function (surah, i) { surah.forEach(function (_, j) { refs.push((i + 1) + ':' + (j + 1)); }); });
  return refs;
}

console.log('\n📋 Pages and juz');
t('604 pages plus the end marker, in order', function () {
  assert.strictEqual(map.pages.length, 605);
  assert.deepStrictEqual(map.pages[0], [1, 1]);
  assert.deepStrictEqual(map.pages[603], [112, 1]);
  assert.deepStrictEqual(map.pages[604], [115, 1]);
  for (var i = 1; i < map.pages.length; i++) {
    var a = map.pages[i - 1], b = map.pages[i];
    assert.ok(a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]), 'page ' + (i + 1));
  }
});
t('30 juz plus the end marker; juz 30 starts at 78:1', function () {
  assert.strictEqual(map.juz.length, 31);
  assert.deepStrictEqual(map.juz[1], [2, 142]);
  assert.deepStrictEqual(map.juz[29], [78, 1]);
});

console.log('\n📋 Words');
t('every ayah, with one entry per word', function () {
  var n = 0;
  for (var s = 1; s <= 114; s++) {
    inputs.quranText[s].verses.forEach(function (v) {
      var ref = s + ':' + v.id;
      assert.ok(typeof (map.ayahs[s - 1] || [])[v.id - 1] === 'string', ref);
      assert.strictEqual(ayahKeys(ref).length, v.text.split(/\s+/).filter(Boolean).length, ref);
      n++;
    });
  }
  assert.strictEqual(allRefs().length, n);
});
t('word total matches the % of the Quran figure', function () {
  var total = 0;
  allRefs().forEach(function (ref) { total += ayahKeys(ref).length; });
  assert.strictEqual(total, occ.OCCURRENCE_INDEX_TOTAL_TOKENS);
});
t('each key counts exactly the words the % figure counts', function () {
  var counts = {};
  allRefs().forEach(function (ref) {
    ayahKeys(ref).forEach(function (k) { if (k >= 0) counts[map.keys[k]] = (counts[map.keys[k]] || 0) + 1; });
  });
  assert.deepStrictEqual(counts, JSON.parse(JSON.stringify(occ.OCCURRENCE_INDEX_TOKEN_COUNTS)));
});
t('قُلْ هُوَ اللَّهُ أَحَدٌ: all four are lesson words', function () {
  var keys = ayahKeys('112:1');
  assert.strictEqual(keys.length, 4);
  keys.forEach(function (k) { assert.ok(k >= 0); });
});

console.log('\n📋 The file');
t('the committed file is up to date', function () {
  assert.strictEqual(src.replace(/\r\n/g, '\n'), builder.generateFile(builder.buildQuranMap(inputs)));
});
t('under 200 KB', function () {
  assert.ok(Buffer.byteLength(src) < 200 * 1024, Buffer.byteLength(src) + ' bytes');
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
