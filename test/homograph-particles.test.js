#!/usr/bin/env node
/**
 * homograph-particles.test.js — إِنَّ, أَنْ, إِنْ and أَنَّ are four words.
 *
 * Without vowels all four are written ان. Each is its own lesson word, so
 * each counts its own Quran occurrences towards % of the Quran, and adding
 * the last three left the Foundation Course and the free words unchanged.
 *
 * Run: node test/homograph-particles.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/occurrence-index.js'), 'utf8'), ctx);
var W = ctx.window;

var realLog = console.log;
console.log = function () {};
var words = require('./load-vocabulary').loadVocabularyWords();
console.log = realLog;

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + e.message); }
}
function count(arabic) { return W.OCCURRENCE_INDEX_TOKEN_COUNTS[W.OCCURRENCE_INDEX_KEY(arabic)] || 0; }
var NEW_IDS = ['cw_1311', 'cw_1312', 'cw_1313'];
function byOcc(list) {
  return list.slice().sort(function (a, b) { return (b.occ || 0) - (a.occ || 0); }).map(function (w) { return w.id; });
}

t('each of the four words has its own key', function () {
  var keys = ['إِنَّ', 'أَنْ', 'إِنْ', 'أَنَّ'].map(W.OCCURRENCE_INDEX_KEY);
  assert.strictEqual(new Set(keys).size, 4, keys.join(', '));
});

t('each counts only its own occurrences (أَنِ and إِنِ count with أَنْ and إِنْ)', function () {
  assert.strictEqual(count('إِنَّ'), 609);
  assert.strictEqual(count('أَنْ'), 539);
  assert.strictEqual(count('إِنْ'), 357);
  assert.strictEqual(count('أَنَّ'), 99);
});

t('the three new words are lesson words with these ids', function () {
  var got = words.filter(function (w) { return NEW_IDS.indexOf(w.id) >= 0; }).map(function (w) { return w.arabic; });
  assert.deepStrictEqual(got.sort(), ['أَنَّ', 'أَنْ', 'إِنْ'].sort());
});

t('the Foundation Course keeps the same 100 words in the same order', function () {
  var old = words.filter(function (w) { return NEW_IDS.indexOf(w.id) < 0; });
  assert.deepStrictEqual(byOcc(words).slice(0, 100), byOcc(old).slice(0, 100));
});

t('every word free before stays free, and the three new words are free', function () {
  var src = fs.readFileSync(path.join(ROOT, 'js/vocabulary.js'), 'utf8');
  var limit = Number(/var FREE_VOCABULARY_LIMIT = (\d+);/.exec(src)[1]);
  var free = byOcc(words).slice(0, limit);
  var oldFree = byOcc(words.filter(function (w) { return NEW_IDS.indexOf(w.id) < 0; })).slice(0, 300);
  oldFree.concat(NEW_IDS).forEach(function (id) { assert.ok(free.indexOf(id) >= 0, id + ' not free'); });
  assert.strictEqual(free.length, 303);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
