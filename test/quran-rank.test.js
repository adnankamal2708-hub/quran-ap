#!/usr/bin/env node
/**
 * quran-rank.test.js — "#N most frequent" follows the Quran count on the card.
 *
 * The audit found مَنْ (870 times) ranked #1 and مِنْ (3,215 times) #2,
 * because the rank came from the shared lesson-ordering occ figure.
 *
 * Run: node test/quran-rank.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var words = require('./load-vocabulary').loadVocabularyWords();

global.getCanonicalWords = function () { return words; };
var vocabSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'vocabulary.js'), 'utf8');
(0, eval)(vocabSrc.slice(0, vocabSrc.indexOf('// Build an index')));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran-rank.js'), 'utf8'));

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function byArabic(a) {
  for (var i = 0; i < words.length; i++) if (words[i].arabic === a) return words[i];
  throw new Error('no word ' + a);
}

test('a more frequent word never ranks below a less frequent one', function () {
  var min = byArabic('مِنْ'), man = byArabic('مَنْ');
  assert.ok(getQuranCount(min) > getQuranCount(man));
  assert.ok(getQuranRank(min).rank < getQuranRank(man).rank,
    'مِنْ #' + getQuranRank(min).rank + ' vs مَنْ #' + getQuranRank(man).rank);
});

test('rank order matches count order across the whole word list', function () {
  var ranked = words.filter(function (w) { return getQuranCount(w) > 0; });
  ranked.forEach(function (w) {
    var r = getQuranRank(w).rank;
    var higher = ranked.filter(function (o) { return getQuranCount(o) > getQuranCount(w); }).length;
    assert.strictEqual(r, higher + 1, w.arabic);
  });
});

test('the most frequent word is #1 in the top 0.1%', function () {
  var top = words.reduce(function (a, b) { return getQuranCount(b) > getQuranCount(a) ? b : a; });
  var r = getQuranRank(top);
  assert.strictEqual(r.rank, 1);
  assert.strictEqual(r.topPercent, 0.1);
});

test('no "top X%" for the bottom half, and no rank without a count', function () {
  var low = words.reduce(function (a, b) {
    var cb = getQuranCount(b), ca = getQuranCount(a);
    return cb > 0 && (ca <= 0 || cb < ca) ? b : a;
  });
  assert.strictEqual(getQuranRank(low).topPercent, null);
  assert.strictEqual(getQuranRank({ id: 'x', occ: 0 }), null);
  assert.strictEqual(getQuranRank({ id: 'x', hadithName: true, occ: 5 }), null);
});

console.log('\n  quran-rank.test.js: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
