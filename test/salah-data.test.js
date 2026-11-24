#!/usr/bin/env node
/**
 * salah-data.test.js — Audit of the Salah track's prayer phrases
 *
 * Fails if a phrase has no source, a word has no meaning, a Quran passage
 * differs from the app's own Quran text, a word id is unknown, or a madhab
 * is left without (or with two of) its opening duʿāʾ, tashahhud or qunūt.
 *
 * Run: node test/salah-data.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var loadVocabularyWords = require('./load-vocabulary.js').loadVocabularyWords;

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/quran/quran-data.js');
load('js/salah/salah-phrases.js');

var WORD_IDS = {};
loadVocabularyWords().forEach(function(w) { WORD_IDS[w.id] = true; });

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

var IDS = ['takbir', 'taawwudh', 'basmalah', 'ruku-tasbih', 'tasmi', 'tahmid', 'sujud-tasbih',
  'between-sajdah', 'taslim', 'fatiha', 'ikhlas', 'kawthar', 'asr', 'falaq', 'nas',
  'thana-subhanaka', 'thana-wajjahtu', 'tashahhud-ibn-masud', 'tashahhud-ibn-abbas',
  'tashahhud-umar', 'salawat-ibrahimiyyah', 'dua-abu-bakr', 'refuge-four', 'qunut-hadini',
  'qunut-nastainuka'];

// The phrase's words, in order, are exactly the ayahs' words in the app's text
function matchesQuranText(phrase) {
  var q = phrase.quran;
  var tokens = [];
  for (var v = q.from; v <= q.to; v++) {
    tokens = tokens.concat(QURAN_TEXT[q.surah].verses[v - 1].text.split(/\s+/));
  }
  return phrase.words.map(function(w) { return w.ar; }).join(' ') === tokens.join(' ');
}

function idsFor(madhab, prefix) {
  var pick = salahPhraseFor(madhab);
  return SALAH_PHRASES.filter(function(p) { return p.id.indexOf(prefix) === 0 && pick(p.id); })
    .map(function(p) { return p.id; });
}

console.log('salah-data');

test('every phrase has ar, tr, en, a step and at least one source with book and number', function() {
  SALAH_PHRASES.forEach(function(p) {
    assert.ok(p.ar && p.tr && p.en && p.step, p.id);
    assert.ok(p.sources && p.sources.length > 0, p.id + ' has no source');
    p.sources.forEach(function(s) { assert.ok(s.book && s.number, p.id + ' source'); });
  });
});

test('every word has ar, tr and en', function() {
  SALAH_PHRASES.forEach(function(p) {
    assert.ok(p.words.length > 0, p.id);
    p.words.forEach(function(w, i) { assert.ok(w.ar && w.tr && w.en, p.id + ' word ' + i); });
  });
});

test('phrase ids are unique and match the list', function() {
  assert.deepStrictEqual(SALAH_PHRASES.map(function(p) { return p.id; }), IDS);
});

test('a phrase\'s Arabic is its words in order', function() {
  SALAH_PHRASES.forEach(function(p) {
    assert.strictEqual(p.ar, p.words.map(function(w) { return w.ar; }).join(' '), p.id);
  });
});

test('Quran passages equal the app\'s text', function() {
  var expected = { basmalah: [1, 1, 1], fatiha: [1, 1, 7], ikhlas: [112, 1, 4], kawthar: [108, 1, 3],
    asr: [103, 1, 3], falaq: [113, 1, 5], nas: [114, 1, 6] };
  Object.keys(expected).forEach(function(id) {
    var p = getSalahPhrase(id);
    var e = expected[id];
    assert.deepStrictEqual(p.quran, { surah: e[0], from: e[1], to: e[2] }, id);
    assert.ok(matchesQuranText(p), id + ' differs from quran-data.js');
  });
});

test('every wordId exists', function() {
  SALAH_PHRASES.forEach(function(p) {
    p.words.forEach(function(w) { if (w.wordId) assert.ok(WORD_IDS[w.wordId], p.id + ' ' + w.wordId); });
  });
});

test('madhab lists use only known ids', function() {
  SALAH_PHRASES.forEach(function(p) {
    (p.madhab || []).forEach(function(m) { assert.ok(SALAH_MADHABS.indexOf(m) >= 0, p.id + ' ' + m); });
  });
});

test('each madhab gets one opening duʿāʾ (none for maliki), one tashahhud and one Witr qunūt', function() {
  var want = {
    hanafi: ['thana-subhanaka', 'tashahhud-ibn-masud', 'qunut-nastainuka'],
    maliki: [null, 'tashahhud-umar', 'qunut-nastainuka'],
    shafii: ['thana-wajjahtu', 'tashahhud-ibn-abbas', 'qunut-hadini'],
    hanbali: ['thana-subhanaka', 'tashahhud-ibn-masud', 'qunut-hadini'],
    unsure: ['thana-subhanaka', 'tashahhud-ibn-masud', 'qunut-hadini'],
  };
  SALAH_MADHABS.forEach(function(m) {
    assert.deepStrictEqual(idsFor(m, 'thana-'), want[m][0] ? [want[m][0]] : [], m + ' thana');
    assert.deepStrictEqual(idsFor(m, 'tashahhud-'), [want[m][1]], m + ' tashahhud');
    assert.deepStrictEqual(idsFor(m, 'qunut-'), [want[m][2]], m + ' qunut');
  });
});

test('shared phrases apply to every madhab', function() {
  SALAH_MADHABS.forEach(function(m) { assert.ok(salahPhraseFor(m)('fatiha'), m); });
  assert.strictEqual(getSalahPhrase('nope'), null);
});

test('a drifted Quran passage fails the check', function() {
  var copy = JSON.parse(JSON.stringify(getSalahPhrase('fatiha')));
  copy.words.pop();
  assert.strictEqual(matchesQuranText(copy), false);
  var marked = JSON.parse(JSON.stringify(getSalahPhrase('ikhlas')));
  marked.words[0].ar = 'قُلْ'; // a different sukūn mark
  assert.strictEqual(matchesQuranText(marked), false);
});

test('teacher review flag starts unset', function() {
  assert.strictEqual(SALAH_TEACHER_REVIEWED, false);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
