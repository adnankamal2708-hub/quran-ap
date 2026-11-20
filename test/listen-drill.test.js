#!/usr/bin/env node
/**
 * listen-drill.test.js — "Hear the word" (js/exercises/listen-drill.js)
 *
 * The learner hears quran.com's recording of a word they have learned and
 * picks its meaning. Every item must pass validateExercise and be fair: the
 * clip is exactly that one word (never two clips, never a clip that runs on
 * into the next word), and no other option means the same thing.
 *
 * The Quran loader is stubbed with a few ayahs; loadSRS is stubbed. The
 * vocabulary and the normalizer are the real ones.
 *
 * Run: node test/listen-drill.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

var WORDS = require('./load-vocabulary').loadVocabularyWords();
global.getCanonicalWords = function() { return WORDS; };

load('js/i18n/strings-en.js');
load('js/data-core/word-forms.js');
load('js/data/occurrence-index.js');
load('js/services/audio.js');
load('js/exercises/exercise-engine.js');
load('js/exercises/word-drills.js');
load('js/exercises/listen-drill.js');

// ═══════════════════════════════════════════════════════════════
// STUBS
// ═══════════════════════════════════════════════════════════════

// `w` is each word's meaning in the verse; 0 marks a word quran.com records
// together with the one before it. `ws` lists words quran.com counts as two.
var AYAHS = {
  '1:2': { text: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ', w: ['All praise', 'to Allah', 'Lord', 'of the worlds'] },
  '78:1': { text: 'رَبِّ ٱلسَّمَٰوَٰتِ رَبِّ ٱلۡأَرۡضِ', w: ['Lord', 0, 'Lord', 'of the earth'] },
  '78:2': { text: 'مَالِكِ يَوۡمِ ٱلدِّينِ', w: ['Sovereign', 'of the Day', 'of the Recompense'], ws: { 1: 2 } },
};
var LOADED_SURAHS = [1, 78];

global.__quranLoader = {
  isSurahLoaded: function(id) { return LOADED_SURAHS.indexOf(id) >= 0; },
  getSurahVerseCount: function(id) {
    var verses = Object.keys(AYAHS).filter(function(key) { return key.split(':')[0] === String(id); });
    return Math.max.apply(null, [0].concat(verses.map(function(key) { return Number(key.split(':')[1]); })));
  },
  getVerse: function(surah, verse) {
    var ayah = AYAHS[surah + ':' + verse];
    return ayah ? { id: verse, text: ayah.text, translation: '', w: ayah.w, ws: ayah.ws } : null;
  },
};

var _srs = {};
global.loadSRS = function() { return JSON.parse(JSON.stringify(_srs)); };

function wordsOf(arabic) {
  var norm = window.OCCURRENCE_INDEX_NORM(arabic);
  var match = WORDS.filter(function(w) { return window.OCCURRENCE_INDEX_NORM(w.arabic) === norm; });
  assert.ok(match.length > 0, 'vocabulary has ' + arabic);
  return match;
}

function learn(arabic, stage) {
  wordsOf(arabic).forEach(function(w) { _srs[w.id] = { stage: stage === undefined ? 1 : stage }; });
}

function fixed(value) { return function() { return value; }; }

var RANDOMS = [0, 0.2, 0.4, 0.6, 0.8, 0.99];

// ═══════════════════════════════════════════════════════════════
// HARNESS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;
function test(name, fn) {
  try {
    _srs = {};
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + '\n     ' + e.message.split('\n')[0]);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\n📋 buildListenDrill');

test('returns null when nothing is learned', function() {
  assert.strictEqual(buildListenDrill(fixed(0)), null);
});

test('returns null for words still at stage 0', function() {
  learn('رَبِّ', 0);
  assert.strictEqual(buildListenDrill(fixed(0)), null);
});

test('plays a learned word and asks its meaning among four', function() {
  learn('رَبِّ');
  var meaning = wordsOf('رَبِّ')[0].english;
  RANDOMS.forEach(function(r) {
    var item = buildListenDrill(fixed(r));
    assert.ok(item, 'an item is built');
    assert.strictEqual(validateExercise(item), null);
    assert.strictEqual(item.type, 'listen-choose');
    assert.strictEqual(item.options.length, 4);
    assert.strictEqual(item.options[item.answer], meaning);
    assert.strictEqual(item.prompt.ask, 'What does this word mean?');
    assert.ok(/^https:\/\/audio\.qurancdn\.com\/wbw\/\d{3}_\d{3}_\d{3}\.mp3$/.test(item.prompt.audio), item.prompt.audio);
  });
});

test('the clip is the word itself, numbered as quran.com numbers it', function() {
  learn('رَبِّ');
  var seen = {};
  RANDOMS.forEach(function(r) { seen[buildListenDrill(fixed(r)).prompt.audio] = true; });
  // 1:2 word 3, and 78:1's second رَبِّ (quran.com's word 2: its first two words are one clip)
  assert.deepStrictEqual(Object.keys(seen).sort(), [
    'https://audio.qurancdn.com/wbw/001_002_003.mp3',
    'https://audio.qurancdn.com/wbw/078_001_002.mp3',
  ]);
});

test('never asks a word whose recording is split in two', function() {
  learn('يَوۡمِ');
  assert.strictEqual(buildListenDrill(fixed(0)), null);
  var splits = AYAHS['78:2'].ws;
  AYAHS['78:2'].ws = null;
  try {
    assert.ok(buildListenDrill(fixed(0)), 'asked once its recording is one clip');
  } finally {
    AYAHS['78:2'].ws = splits;
  }
});

test('no wrong option means the same as the answer', function() {
  learn('رَبِّ');
  RANDOMS.forEach(function(r) {
    var item = buildListenDrill(fixed(r));
    var answer = item.options[item.answer].trim().toLowerCase();
    item.options.forEach(function(option, i) {
      if (i !== item.answer) assert.notStrictEqual(option.trim().toLowerCase(), answer);
    });
  });
});

test('the same random numbers give the same question', function() {
  learn('رَبِّ');
  learn('ٱلۡعَٰلَمِينَ');
  var a = buildListenDrill(fixed(0.37));
  var b = buildListenDrill(fixed(0.37));
  assert.deepStrictEqual(a, b);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
