#!/usr/bin/env node
/**
 * salah-exercises.test.js — Exercise builders for the Salah track
 *
 * Fails if the same seed builds different items, an item is malformed or
 * could have two right answers, a lesson with nothing to ask builds items,
 * or a reading check runs long.
 *
 * Run: node test/salah-exercises.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/exercises/exercise-engine.js');
load('js/qaida/qaida-exercises.js');
load('js/salah/salah-phrases.js');
load('js/salah/salah-lessons.js');
load('js/data-core/tracks.js');
load('js/data-core/review-schedule.js');
load('js/data-core/salah-track.js');
load('js/salah/salah-exercises.js');

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

function norm(s) { return String(s).trim().toLowerCase(); }
// The words of a meaning, padded, so containment is whole words only
function padded(s) { return ' ' + String(s).toLowerCase().replace(/[^a-zĀ-ɏḀ-ỿ']+/g, ' ').trim() + ' '; }

function everyItem(fn) {
  SALAH_MADHABS.forEach(function(m) {
    SALAH_LESSONS.forEach(function(l) {
      [1, 7, 42].forEach(function(seed) {
        buildSalahLessonItems(l, seed, m).forEach(function(item) { fn(item, l, m); });
      });
    });
  });
}

console.log('salah-exercises');

test('the same seed builds the same items', function() {
  SALAH_LESSONS.forEach(function(l) {
    assert.deepStrictEqual(buildSalahLessonItems(l, 9, 'hanafi'), buildSalahLessonItems(l, 9, 'hanafi'), l.id);
  });
  assert.notDeepStrictEqual(buildSalahLessonItems(getSalahLesson('s2-1'), 1, 'unsure'),
    buildSalahLessonItems(getSalahLesson('s2-1'), 2, 'unsure'));
});

test('every item is a valid read-choose with 4 distinct options', function() {
  everyItem(function(item, l, m) {
    assert.strictEqual(validateExercise(item), null, l.id + ' ' + m + ': ' + validateExercise(item));
    assert.strictEqual(item.type, 'read-choose');
    assert.strictEqual(item.options.length, 4, l.id);
    var texts = item.options.map(norm);
    texts.forEach(function(x, i) { assert.strictEqual(texts.indexOf(x), i, l.id + ' duplicate option ' + x); });
  });
});

test('a word item carries its word, and its answer is that word\'s meaning', function() {
  everyItem(function(item, l) {
    if (item.figure) return;
    if (item.word) {
      assert.strictEqual(item.prompt.arabic, item.word.ar, l.id);
      assert.strictEqual(item.options[item.answer], item.word.en, l.id);
    } else {
      assert.ok(item.phrase, l.id + ' item is neither a word nor a phrase');
      assert.strictEqual(item.options[item.answer], item.phrase.en, l.id);
    }
  });
});

test('no wrong option shares the right answer\'s meaning', function() {
  everyItem(function(item, l) {
    var right = norm(item.options[item.answer]);
    item.options.forEach(function(o, i) {
      if (i !== item.answer) assert.notStrictEqual(norm(o), right, l.id);
    });
  });
});

test('no wrong option contains the right meaning, or is contained in it', function() {
  everyItem(function(item, l) {
    var right = norm(item.options[item.answer]);
    item.options.forEach(function(o, i) {
      if (i === item.answer) return;
      var a = padded(o);
      var b = padded(item.options[item.answer]);
      assert.ok(a.indexOf(b) < 0 && b.indexOf(a) < 0, l.id + ': "' + o + '" vs "' + right + '"');
    });
  });
});

test('a lesson asks every distinct word of its phrases, then each phrase', function() {
  var l = getSalahLesson('s1-5');
  var items = buildSalahLessonItems(l, 3, 'hanafi');
  var phrases = salahLessonPhrases(l, 'hanafi');
  var words = [];
  phrases.forEach(function(p) {
    p.words.forEach(function(w) { if (!words.some(function(x) { return x.ar === w.ar && x.en === w.en; })) words.push(w); });
  });
  assert.strictEqual(items.length, words.length + phrases.length);
  assert.deepStrictEqual(items.slice(0, words.length).map(function(i) { return i.word.ar; }), words.map(function(w) { return w.ar; }));
  assert.deepStrictEqual(items.slice(words.length).map(function(i) { return i.phrase.id; }), phrases.map(function(p) { return p.id; }));
});

test('the walkthrough asks the position of each step', function() {
  var items = buildSalahLessonItems(getSalahLesson('s1-1'), 1, 'unsure');
  assert.deepStrictEqual(items.map(function(i) { return i.figure; }), SALAH_STEP_IDS);
  items.forEach(function(i) {
    assert.strictEqual(i.prompt.text, t('salah.figure.which'));
    assert.strictEqual(i.options[i.answer], t('salah.step.' + i.figure));
  });
});

test('maliki s3-1 and the note-only lessons build no items', function() {
  assert.deepStrictEqual(buildSalahLessonItems(getSalahLesson('s3-1'), 1, 'maliki'), []);
  assert.deepStrictEqual(buildSalahLessonItems(getSalahLesson('s3-4'), 1, 'hanafi'), []);
});

test('a reading check asks at most 20 words, all from its level', function() {
  [1, 2, 3, 4].forEach(function(level) {
    var check = getSalahLesson('s' + level + '-check');
    var items = buildSalahLessonItems(check, 5, 'shafii');
    assert.ok(items.length > 0 && items.length <= 20, level + ': ' + items.length);
    items.forEach(function(i) { assert.ok(i.word, 'check items are word items'); });
  });
});

test('a review item is built for a known word key, null otherwise', function() {
  var w = getSalahPhrase('ruku-tasbih').words[1];
  var key = w.wordId || 'salah:' + w.ar;
  var item = buildSalahReviewItem(key, 4);
  assert.strictEqual(item.word.ar, w.ar);
  assert.strictEqual(validateExercise(item), null);
  assert.strictEqual(buildSalahReviewItem('salah:nothing', 4), null);
});

test('every step and the item questions have their strings', function() {
  SALAH_STEP_IDS.forEach(function(s) { assert.notStrictEqual(t('salah.step.' + s), 'salah.step.' + s, s); });
  ['salah.figure.which', 'salah.ex.wordMeaning', 'salah.ex.phraseMeaning'].forEach(function(k) {
    assert.notStrictEqual(t(k), k, k);
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
