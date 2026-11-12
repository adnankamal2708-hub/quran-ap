#!/usr/bin/env node
/**
 * quiz-tiles.test.js — the "Arabic from English" tiles question.
 *
 * Uses the real Quran text and the real checked word-by-word meanings (the
 * same alignment build.js attaches as verse.w), so every phrase is checked
 * against the data the app ships.
 *
 * Run: node test/quiz-tiles.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var words = require('./load-vocabulary').loadVocabularyWords();

var ROOT = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// The Quran text with each verse's meanings attached, as build.js does.
var quran = { window: {} };
vm.createContext(quran);
vm.runInContext(read('js/quran/quran-data.js'), quran);
vm.runInContext(read('js/data/occurrence-index.js'), quran);
var TEXT = quran.window.__QURAN_TEXT;
var wm = require('../scripts/word-meanings.js');
var aligned = wm.alignWordMeanings(TEXT, wm.loadSource(), quran.window.OCCURRENCE_INDEX_NORM);
assert.strictEqual(aligned.errors.length, 0, 'meanings line up');
Object.keys(TEXT).forEach(function (s) {
  TEXT[s].verses.forEach(function (v, i) { v.w = aligned.bySurah[s][i]; });
});

function loaderWith(loaded) {
  return {
    isSurahLoaded: function (id) { return loaded.indexOf(id) >= 0 && !!TEXT[id]; },
    getVerse: function (s, v) { return TEXT[s].verses[v - 1] || null; },
  };
}
var allLoaded = loaderWith(Object.keys(TEXT).map(Number));

var ctx = { window: {}, shuffleArray: function (a) { return a.slice().reverse(); } };
vm.createContext(ctx);
['js/exercises/quiz-verse.js', 'js/exercises/quiz-tiles.js'].forEach(function (f) { vm.runInContext(read(f), ctx); });

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
var PAUSE = /[\u06D6-\u06DC]/g;
function strip(s) { return s.replace(PAUSE, ''); }
function wordsOf(ref) {
  var p = ref.split(':');
  var v = TEXT[p[0]].verses[p[1] - 1];
  return ctx.quizTilesWords(v.text.split(/\s+/).filter(Boolean), v.w);
}
/** Where the answer's words start in the ayah's word list, or -1. */
function phraseAt(list, answer) {
  for (var i = 0; i + answer.length <= list.length; i++) {
    var texts = list.slice(i, i + answer.length).map(function (x) { return x.text; });
    if (texts.join('|') === answer.join('|')) return i;
  }
  return -1;
}

test('questions 2, 6 and 10 are tiles slots, never a verse slot', function () {
  var slots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(ctx.isQuizTilesSlot);
  assert.strictEqual(JSON.stringify(slots), '[1,5,9]');
  slots.forEach(function (i) { assert.ok(!ctx.isQuizVerseSlot(i)); });
});

test('a token with no meaning of its own joins the word before it (2:181)', function () {
  var list = wordsOf('2:181');
  var after = list.filter(function (x) { return x.gloss === 'after what'; })[0];
  assert.strictEqual(after.text, 'بَعۡدَ مَا');
  assert.strictEqual(list.length, TEXT[2].verses[180].w.length - 1);
});

test('a missing meaning means no question', function () {
  assert.strictEqual(ctx.quizTilesWords(['a', 'b'], ['x', '']), null);
  assert.strictEqual(ctx.quizTilesWords(['a', 'b'], ['x']), null);
  assert.strictEqual(ctx.quizTilesWords(['a'], undefined), null);
});

var built = [];
words.forEach(function (w) {
  var q = ctx.buildQuizTiles(w, allLoaded);
  if (q) built.push({ word: w, q: q });
});

// The rest fall back to the meaning question (short ayahs, repeated words).
test('most lesson words get a tiles question', function () {
  assert.ok(built.length > words.length * 0.75, built.length + ' of ' + words.length);
});

test('every phrase is real: its words and meanings appear in that order in the ayah', function () {
  built.forEach(function (b) {
    var list = wordsOf(b.q.ref);
    var n = b.q.answer.length;
    var at = phraseAt(list, b.q.answer);
    assert.ok(at >= 0, b.q.ref + ' phrase not in ayah');
    var glosses = list.slice(at, at + n).map(function (x) { return x.gloss; });
    assert.strictEqual(JSON.stringify(b.q.glosses), JSON.stringify(glosses), b.q.ref);
  });
});

test('the phrase holds the lesson word', function () {
  built.forEach(function (b) {
    var joined = ' ' + b.q.answer.join(' ') + ' ';
    var ok = ctx._quizVerseCandidates(b.word).some(function (c) {
      return joined.indexOf(' ' + strip(c.token) + ' ') >= 0;
    });
    assert.ok(ok, b.word.arabic + ' not in ' + b.q.answer.join(' '));
  });
});

test('fair tiles: three words, a spare or two, no repeated spelling or meaning', function () {
  built.forEach(function (b) {
    var q = b.q;
    assert.strictEqual(q.answer.length, 3);
    assert.ok(q.tiles.length >= 4 && q.tiles.length <= 5, q.ref);
    assert.strictEqual(new Set(q.tiles).size, q.tiles.length, q.ref + ' repeated tile');
    q.answer.forEach(function (a) { assert.ok(q.tiles.indexOf(a) >= 0); });
    var keys = q.glosses.map(function (g) { return g.toLowerCase(); });
    assert.strictEqual(new Set(keys).size, 3, q.ref + ' repeated meaning');
    q.tiles.forEach(function (t) { assert.ok(!PAUSE.test(t), q.ref + ' pause mark left'); PAUSE.lastIndex = 0; });
  });
});

test('no spare tile could pass for a phrase word (same letters or meaning)', function () {
  built.forEach(function (b) {
    var list = wordsOf(b.q.ref);
    var taken = list.filter(function (x) { return b.q.answer.indexOf(x.text) >= 0; }).map(function (x) {
      return { g: ctx._quizTilesGlossKey(x.gloss), t: ctx._quizTilesTextKey(x.text) };
    });
    b.q.tiles.filter(function (t) { return b.q.answer.indexOf(t) < 0; }).forEach(function (t) {
      var spare = list.filter(function (x) { return x.text === t; })[0];
      assert.ok(spare && !ctx._quizTilesClash(spare, taken), b.q.ref + ' ' + t);
    });
  });
});

test('helper words in brackets and vowel marks are ignored when comparing', function () {
  assert.strictEqual(ctx._quizTilesGlossKey('(is) Allah'), ctx._quizTilesGlossKey('Allah'));
  assert.strictEqual(ctx._quizTilesGlossKey('any [one]'), 'any');
  assert.strictEqual(ctx._quizTilesTextKey('ٱللَّهَ'), ctx._quizTilesTextKey('ٱللَّهُ'));
  assert.notStrictEqual(ctx._quizTilesTextKey('رَبِّ'), ctx._quizTilesTextKey('ٱللَّهِ'));
});

test('a phrase never runs past the end of a clause', function () {
  built.forEach(function (b) {
    var list = wordsOf(b.q.ref);
    var i = phraseAt(list, b.q.answer);
    list.slice(i, i + 2).forEach(function (x) { assert.ok(!x.pause, b.q.ref + ' crosses a pause at ' + x.text); });
  });
});

test('the same word gives the same question', function () {
  var b = built[0];
  assert.strictEqual(JSON.stringify(ctx.buildQuizTiles(b.word, allLoaded)), JSON.stringify(b.q));
});

test('no question until the surah is loaded', function () {
  assert.strictEqual(ctx.buildQuizTiles(built[0].word, loaderWith([])), null);
});

test('only tiles in the phrase order are right', function () {
  assert.strictEqual(ctx.isQuizTilesCorrect(['a', 'b', 'c'], ['a', 'b', 'c']), true);
  assert.strictEqual(ctx.isQuizTilesCorrect(['b', 'a', 'c'], ['a', 'b', 'c']), false);
  assert.strictEqual(ctx.isQuizTilesCorrect(['a', 'b'], ['a', 'b', 'c']), false);
});

test('only a tiles slot gets a question', function () {
  ctx.window.__quranLoader = allLoaded;
  assert.strictEqual(ctx.buildQuizTilesQuestion(built[0].word, 0), null);
  assert.ok(ctx.buildQuizTilesQuestion(built[0].word, 1));
});

console.log('\nTiles built for ' + built.length + ' of ' + words.length + ' words');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
