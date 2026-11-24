#!/usr/bin/env node
/**
 * salah-track.test.js — Unit tests for the Salah track module
 *
 * Tests: level shape, lesson order, reading-check pass mark, the madhab
 * setting (and that changing it never lowers progress), word answers going
 * to the right review queue, the percentage, merge, and corrupt storage.
 *
 * Run: node test/salah-track.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
global.window = global;

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/data-core/tracks.js');
load('js/data-core/review-schedule.js');
load('js/salah/salah-phrases.js');
load('js/salah/salah-lessons.js');
load('js/data-core/salah-track.js');

var srsCalls = [];
var srsResult;
global.rateSRSWord = function(id, rating) { srsCalls.push([id, rating]); return srsResult; };

var passed = 0;
var failed = 0;
function test(name, fn) {
  _storage = {};
  srsCalls = [];
  srsResult = undefined;
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

function finishLevel1(madhab) {
  getSalahLevelLessons(1).forEach(function(l) {
    salahLessonPhrases(l, madhab).forEach(function(p) {
      p.words.forEach(function(w) { recordSalahWord(w, true, 1000); });
    });
    completeSalahLesson(l.id, 1);
  });
}

console.log('salah-track');

test('track id is last and released; an old tracks record has salah not joined', function() {
  assert.strictEqual(TRACK_IDS[TRACK_IDS.length - 1], 'salah');
  assert.strictEqual(isTrackReleased('salah'), true);
  var state = normalizeTrackState({ main: 'words', tracks: { words: { joined: true } } });
  assert.strictEqual(state.tracks.salah.joined, false);
  assert.strictEqual(state.tracks.salah.percentHigh, 0);
});

test('levels have the qaida shape with kind salah, in path order', function() {
  var levels = getSalahLevels();
  assert.strictEqual(levels.length, TRACK_LEVEL_COUNT);
  assert.strictEqual(levels[0].level, 0);
  assert.deepStrictEqual(Object.keys(levels[0].lessons[0]).sort(), ['completed', 'kind', 'number', 'ref', 'title']);
  assert.strictEqual(levels[0].lessons[0].kind, 'salah');
  assert.deepStrictEqual(levels[0].lessons.map(function(l) { return l.ref; }),
    getSalahLevelLessons(1).map(function(l) { return l.id; }));
  assert.strictEqual(levels[3].lessons[0].ref, 's4-1');
});

test('first lesson is open; the second opens once the first is done', function() {
  assert.strictEqual(isSalahLessonUnlocked('s1-1'), true);
  assert.strictEqual(isSalahLessonUnlocked('s1-2'), false);
  assert.strictEqual(completeSalahLesson('s1-1', 1), true);
  assert.strictEqual(isSalahLessonUnlocked('s1-2'), true);
  assert.strictEqual(isSalahLessonUnlocked('nope'), false);
});

test('a level opens when the previous reading check passes at 0.8', function() {
  assert.strictEqual(getSalahLevelLock(0), null);
  assert.strictEqual(getSalahLevelLock(1), 'progress');
  getSalahLevelLessons(1).slice(0, -1).forEach(function(l) { completeSalahLesson(l.id, 1); });
  assert.strictEqual(completeSalahLesson('s1-check', 0.79), false);
  assert.strictEqual(getSalahLevelLock(1), 'progress');
  assert.strictEqual(completeSalahLesson('s1-check', 0.8), true);
  assert.strictEqual(getSalahLevelLock(1), null);
  assert.strictEqual(getSalahLevel(), 1);
  assert.strictEqual(isSalahLessonUnlocked('s2-1'), true);
});

test('madhab: null until chosen, rejects unknown ids, survives a reload', function() {
  assert.strictEqual(getSalahMadhab(), null);
  assert.strictEqual(setSalahMadhab('x'), false);
  assert.strictEqual(getSalahMadhab(), null);
  assert.strictEqual(setSalahMadhab('shafii'), true);
  assert.strictEqual(getSalahMadhab(), 'shafii');
  assert.strictEqual(JSON.parse(_storage[SALAH_PROGRESS_KEY]).madhab, 'shafii');
});

test('changing madhab keeps completed lessons and never lowers the stored %', function() {
  setSalahMadhab('hanafi');
  finishLevel1('hanafi');
  completeSalahLesson('s3-1', 1);
  var before = refreshSalahPercent().percent;
  assert.ok(before > 0, 'some % after level 1');
  var done = Object.keys(loadSalahProgress().completed).sort();
  setSalahMadhab('shafii');
  refreshSalahPercent();
  assert.strictEqual(getTrackPercent('salah'), before);
  assert.deepStrictEqual(Object.keys(loadSalahProgress().completed).sort(), done);
});

test('percent counts known words over the madhab\'s distinct words, 0..100, one decimal', function() {
  assert.strictEqual(getSalahPercent(), 0);
  var w = getSalahPhrase('takbir').words[0];
  recordSalahWord(w, true, 1);
  var p = getSalahPercent();
  assert.ok(p > 0 && p < 100, p);
  assert.strictEqual(Math.round(p * 10) / 10, p);
  assert.strictEqual(salahWordKey(w), w.wordId || 'salah:' + w.ar);
  assert.strictEqual(salahWordKey({ ar: 'آمِينَ' }), 'salah:آمِينَ');
});

test('a wrong answer on a Quran word rates it in the SRS', function() {
  var w = getSalahPhrase('fatiha').words.filter(function(x) { return x.wordId; })[0];
  recordSalahWord(w, true, 1);
  recordSalahWord(w, false, 2);
  assert.deepStrictEqual(srsCalls, [[w.wordId, 0]]);
  assert.ok(!loadSalahProgress().known[w.wordId], 'no longer known');
  assert.deepStrictEqual(getDueSalahWords(Date.now() + 1e9), []);
});

test('a Quran word the SRS refuses (free gate) goes to the Salah queue', function() {
  srsResult = false;
  var w = getSalahPhrase('fatiha').words.filter(function(x) { return x.wordId; })[0];
  recordSalahWord(w, false, 5);
  assert.deepStrictEqual(getDueSalahWords(5 + REVIEW_RETRY_MS), [w.wordId]);
});

test('a word not in the Quran goes to the Salah queue and leaves it after its steps', function() {
  var w = getSalahPhrase('ruku-tasbih').words.filter(function(x) { return !x.wordId; })[0];
  assert.ok(w, 'a non-Quran word exists');
  recordSalahWord(w, false, 0);
  assert.strictEqual(srsCalls.length, 0);
  var key = salahWordKey(w);
  assert.deepStrictEqual(getDueSalahWords(REVIEW_RETRY_MS), [key]);
  var now = REVIEW_RETRY_MS;
  for (var i = 0; i <= REVIEW_DAYS.length; i++) {
    recordSalahWord(w, true, now);
    now += 400 * 24 * 60 * 60 * 1000;
  }
  assert.deepStrictEqual(getDueSalahWords(now), []);
});

test('merge: later madhabAt wins; completed and known union; review merged', function() {
  var a = { completed: { 's1-1': { at: 5, score: 1 } }, known: { 'salah:x': 1 }, review: { 'salah:y': { due: 10, step: 0 } },
    madhab: 'hanafi', madhabAt: 100, updatedAt: 1 };
  var b = { completed: { 's1-2': { at: 6, score: 0.9 } }, known: { cw_1: 2 }, review: { 'salah:z': { due: 20, step: 1 } },
    madhab: 'shafii', madhabAt: 200, updatedAt: 2 };
  var m = mergeSalahProgress(a, b);
  assert.strictEqual(m.madhab, 'shafii');
  assert.strictEqual(m.madhabAt, 200);
  assert.deepStrictEqual(Object.keys(m.completed).sort(), ['s1-1', 's1-2']);
  assert.deepStrictEqual(Object.keys(m.known).sort(), ['cw_1', 'salah:x']);
  assert.deepStrictEqual(Object.keys(m.review).sort(), ['salah:y', 'salah:z']);
  assert.strictEqual(mergeSalahProgress(b, a).madhab, 'shafii');
});

test('corrupt storage loads as empty', function() {
  _storage[SALAH_PROGRESS_KEY] = '{not json';
  var p = loadSalahProgress();
  assert.deepStrictEqual(p.completed, {});
  assert.deepStrictEqual(p.known, {});
  assert.strictEqual(p.madhab, null);
  _storage[SALAH_PROGRESS_KEY] = JSON.stringify({ completed: { bogus: {} }, known: { a: 'x' }, madhab: 'nope' });
  p = loadSalahProgress();
  assert.deepStrictEqual(p.completed, {});
  assert.deepStrictEqual(p.known, {});
  assert.strictEqual(p.madhab, null);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
