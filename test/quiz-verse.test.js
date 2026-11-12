#!/usr/bin/env node
/**
 * quiz-verse.test.js — the verse fill-in question in the lesson quiz.
 *
 * Checks that the gap is always a real word of a real ayah (taken from the
 * Quran text, appearing exactly once), and that the Arabic options are fair:
 * one right answer, no repeated form or meaning.
 *
 * Run: node test/quiz-verse.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var words = require('./load-vocabulary').loadVocabularyWords();

var ROOT = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// The real Quran text, in its own context.
var quran = { window: {} };
vm.createContext(quran);
vm.runInContext(read('js/quran/quran-data.js'), quran);
var TEXT = quran.window.__QURAN_TEXT;

function loaderWith(loaded) {
  return {
    isSurahLoaded: function (id) { return loaded.indexOf(id) >= 0 && !!TEXT[id]; },
    getVerse: function (s, v) { return TEXT[s].verses[v - 1] || null; },
  };
}
var allLoaded = loaderWith(Object.keys(TEXT).map(Number));

var ctx = { window: {}, shuffleArray: function (a) { return a.slice(); } };
vm.createContext(ctx);
['js/ui/dom-helpers.js', 'js/ui/quiz-ui.js', 'js/exercises/quiz-verse.js'].forEach(function (f) {
  try { vm.runInContext(read(f), ctx); } catch (e) { /* DOM-only setup in dom-helpers */ }
});
assert.strictEqual(typeof ctx.buildQuizVerse, 'function', 'quiz-verse.js loaded');
assert.strictEqual(typeof ctx.getShortMeaning, 'function', 'getShortMeaning loaded');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function byArabic(a) {
  for (var i = 0; i < words.length; i++) if (words[i].arabic === a) return words[i];
  throw new Error('no word ' + a);
}
function stripEllipsis(s) { return s.replace(/…/g, '').trim(); }

test('every 4th question is a verse slot', function () {
  var slots = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(ctx.isQuizVerseSlot);
  assert.strictEqual(JSON.stringify(slots), '[3,7]');
});

test('the gap is a word that appears exactly once in the real ayah', function () {
  var built = 0;
  words.forEach(function (w) {
    var v = ctx.buildQuizVerse(w, allLoaded);
    if (!v) return;
    built++;
    var parts = v.ref.split(':').map(Number);
    var tokens = TEXT[parts[0]].verses[parts[1] - 1].text.split(/\s+/).filter(Boolean);
    assert.strictEqual(tokens.filter(function (t) { return t === v.token; }).length, 1, w.arabic + ' ' + v.ref);
    // The shown words are the ayah's own words, in order, around the gap.
    var shown = (stripEllipsis(v.before) + ' ' + v.token + ' ' + stripEllipsis(v.after)).trim();
    assert.ok(tokens.join(' ').indexOf(shown) >= 0, 'context matches ' + v.ref);
    assert.ok(v.translation, 'has a translation ' + v.ref);
  });
  // Nearly every word has a usable ayah (1296 of 1311 when written).
  assert.ok(built > words.length * 0.9, 'built ' + built + ' of ' + words.length);
});

test('no verse while its surah is not loaded', function () {
  var w = byArabic('مِنْ');
  assert.strictEqual(ctx.buildQuizVerse(w, loaderWith([])), null);
});

test('no verse when the word appears twice in the ayah', function () {
  var w = { arabic: 'x', occurrences: [{ verseKey: '1:1', ayahA: '<span class="ayah-highlight">ب</span>' }] };
  var twice = { isSurahLoaded: function () { return true; }, getVerse: function () { return { text: 'ا ب ج ب', translation: 't' }; } };
  assert.strictEqual(ctx.buildQuizVerse(w, twice), null);
});

test('a long ayah is cut around the gap with an ellipsis', function () {
  var text = 'a1 a2 a3 a4 a5 a6 a7 a8 a9 GAP b1 b2 b3 b4 b5 b6 b7 b8 b9';
  var w = { occurrences: [{ verseKey: '2:5', ayahA: 'x <span class="ayah-highlight">GAP</span>' }] };
  var one = { isSurahLoaded: function () { return true; }, getVerse: function () { return { text: text, translation: 't' }; } };
  var v = ctx.buildQuizVerse(w, one);
  assert.strictEqual(v.before, '… a3 a4 a5 a6 a7 a8 a9');
  assert.strictEqual(v.after, 'b1 b2 b3 b4 b5 b6 b7 …');
  assert.strictEqual(v.ref, '2:5');
});

test('options: the right word plus fair, distinct wrong ones', function () {
  var lesson = words.slice(0, 10);
  lesson.forEach(function (w) {
    var opts = ctx.buildQuizVerseOptions(w, lesson, []);
    assert.ok(opts && opts.length === 4, w.arabic + ' has 4 options');
    assert.ok(opts.indexOf(w.arabic) >= 0, 'right answer offered');
    assert.strictEqual(new Set(opts).size, opts.length, 'no repeated form');
    var others = opts.filter(function (o) { return o !== w.arabic; }).map(function (o) {
      return lesson.filter(function (x) { return x.arabic === o; })[0];
    });
    var meanings = others.map(function (x) { return ctx.getShortMeaning(x.meaning); });
    assert.ok(meanings.indexOf(ctx.getShortMeaning(w.meaning)) < 0, 'no wrong option shares the meaning');
    others.forEach(function (x) { assert.ok(!ctx.sharesQuizSense(w, x), 'no shared sense'); });
  });
});

test('مَا never gets لَا as a wrong option (both can mean "not")', function () {
  var opts = ctx.buildQuizVerseOptions(byArabic('مَا'), [byArabic('مَا'), byArabic('لَا'), byArabic('مِنْ'), byArabic('فِي')], []);
  assert.ok(opts.indexOf('لَا') < 0);
});

test('too few distinct words gives no options', function () {
  var w = byArabic('مِنْ');
  assert.strictEqual(ctx.buildQuizVerseOptions(w, [w, w], []), null);
});

test('only verse slots ask for surah files', function () {
  var a = { occurrences: [{ verseKey: '2:3', ayahA: '<span class="ayah-highlight">x</span>' }] };
  var b = { occurrences: [{ verseKey: '112:1', ayahA: '<span class="ayah-highlight">y</span>' }] };
  assert.strictEqual(JSON.stringify(ctx.quizVerseSurahIds([a, a, a, b])), '[112]');
});

test('a multi-word highlight is never used as a gap', function () {
  var w = { occurrences: [{ verseKey: '1:1', ayahA: '<span class="ayah-highlight">بِسۡمِ ٱللَّهِ</span>' }] };
  assert.strictEqual(ctx.buildQuizVerse(w, allLoaded), null);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
