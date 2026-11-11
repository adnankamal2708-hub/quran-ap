#!/usr/bin/env node
/**
 * qaida-word-audio.test.js — Unit tests for the Qaida's word recordings
 * and listening questions
 *
 * Tests: every letter has a word that starts with it; every word the
 * Qaida shows has a recording; each recording's place in the Quran holds
 * exactly that word (checked against quran.com's own word list in
 * data-sources/quran-wbw-en.json); listening questions are valid, fair
 * and the same for the same seed.
 *
 * Run: node test/qaida-word-audio.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-marks.js');
load('js/qaida/qaida-lessons.js');
load('js/qaida/qaida-readability.js');
load('js/services/audio.js');
load('js/exercises/exercise-engine.js');
load('js/qaida/qaida-exercises.js');
load('js/qaida/qaida-word-audio.js');
load('js/qaida/qaida-listen-exercises.js');

var SOURCE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-sources', 'quran-wbw-en.json'), 'utf8'));
var ARABIC_LETTER = /[ء-ي]/g;
// Bare letters, so the two Quran texts' different marks (and the
// tatweel stretch) don't matter
function lettersOf(word) {
  return (word.replace(/ٱ/g, 'ا').replace(/ى/g, 'ي').replace(/ـ/g, '').match(ARABIC_LETTER) || []).join('');
}

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e));
  }
}

console.log('\n📋 Qaida word recordings');

test('every letter has a short word that starts with it', function () {
  QAIDA_LETTERS.forEach(function (letter) {
    var word = QAIDA_LETTER_WORDS[letter.id];
    assert.ok(word, letter.id + ' has no word');
    assert.strictEqual(word.charAt(0), letter.id === 'alif' ? 'أ' : letter.char, letter.id + ': ' + word);
  });
});

test('every word the Qaida shows has a recording', function () {
  var shown = Object.keys(QAIDA_LETTER_WORDS).map(function (id) { return QAIDA_LETTER_WORDS[id]; });
  Object.keys(QAIDA_EXAMPLES).forEach(function (id) { shown = shown.concat(QAIDA_EXAMPLES[id]); });
  QAIDA_LESSONS.forEach(function (lesson) { if (lesson.kind === 'muqattaat') shown = shown.concat(lesson.examples); });
  shown.forEach(function (word) { assert.ok(qaidaWordAudioUrls(word).length > 0, word + ' has no recording'); });
});

test('each recording is of exactly that word, in quran.com\'s own numbering', function () {
  Object.keys(QAIDA_WORD_REFS).forEach(function (word) {
    var ref = QAIDA_WORD_REFS[word];
    var words = SOURCE[ref[0] + ':' + ref[1]];
    assert.ok(words, word + ': no verse ' + ref[0] + ':' + ref[1]);
    var heard = ref[2].map(function (n) { return words[n - 1][0]; }).join('');
    assert.strictEqual(lettersOf(heard), lettersOf(word), word + ' at ' + ref.join(':') + ' is ' + heard);
  });
});

test('a lesson fetches the recordings it plays', function () {
  var urls = qaidaLessonWordAudio(getQaidaLesson('q0-1'));
  getQaidaLesson('q0-1').teaches.forEach(function (id) {
    assert.ok(urls.indexOf(qaidaWordAudioUrls(QAIDA_LETTER_WORDS[id])[0]) >= 0, id);
  });
});

console.log('\n📋 Qaida listening questions');

test('every letters and marks lesson gets listening questions that are valid', function () {
  QAIDA_LESSONS.forEach(function (lesson) {
    var items = buildQaidaListenItems(lesson, 7);
    if (lesson.kind === 'letters') assert.strictEqual(items.length, QAIDA_LISTEN_PER_LESSON, lesson.id);
    items.forEach(function (item) {
      assert.strictEqual(validateExercise(item), null, lesson.id + ' ' + JSON.stringify(item));
      assert.ok(/^https:\/\/audio\.qurancdn\.com\/wbw\//.test(item.prompt.audio));
      assert.strictEqual(new Set(item.options).size, item.options.length, 'no repeated options');
    });
  });
});

test('"which letter does this word start with?" plays a word starting with the answer', function () {
  QAIDA_LESSONS.filter(function (l) { return l.kind === 'letters'; }).forEach(function (lesson) {
    buildQaidaListenItems(lesson, 3).forEach(function (item) {
      var letter = QAIDA_LETTERS.filter(function (l) { return l.char === item.options[item.answer]; })[0];
      assert.strictEqual(item.prompt.audio, qaidaWordAudioUrls(QAIDA_LETTER_WORDS[letter.id])[0]);
      assert.ok(lesson.teaches.indexOf(letter.id) >= 0, 'the answer is a letter the lesson teaches');
    });
  });
});

test('"which word do you hear?" plays the answer', function () {
  QAIDA_LESSONS.filter(function (l) { return l.kind === 'marks'; }).forEach(function (lesson) {
    buildQaidaListenItems(lesson, 3).forEach(function (item) {
      assert.deepStrictEqual([item.prompt.audio], qaidaWordAudioUrls(item.options[item.answer]));
    });
  });
});

test('the same seed gives the same questions', function () {
  var lesson = getQaidaLesson('q0-1');
  assert.deepStrictEqual(buildQaidaListenItems(lesson, 5), buildQaidaListenItems(lesson, 5));
});

test('lessons mix listening questions in without going over the limit', function () {
  var lesson = getQaidaLesson('q0-1');
  var items = buildQaidaLessonItems(lesson, 5);
  assert.ok(items.length <= QAIDA_ITEMS_PER_LESSON);
  assert.strictEqual(items.filter(function (i) { return i.type === 'listen-choose'; }).length, QAIDA_LISTEN_PER_LESSON);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-word-audio.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
