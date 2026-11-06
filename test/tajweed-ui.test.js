#!/usr/bin/env node
/**
 * tajweed-ui.test.js — the Tajweed lesson and verse-practice screens
 *
 * Tests: intro cards without a recording (no Play or Compare), the
 * microphone asked for only on Record, an unsupported or refused recorder
 * still leaving Got it / Not yet, Not yet queueing the letter, the finish
 * line's letters covered, a failed reading check offering a retry, and
 * verse practice (Smooth and its gain, Not yet moving on, everything
 * smooth, the text not loading).
 *
 * The track, lesson and exercise modules are the real ones over a stubbed
 * localStorage; the DOM, the recorder, audio and the exercise UI are stubs,
 * as in qaida-ui.test.js.
 *
 * Run: node test/tajweed-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

// A document whose elements exist for any id; the screens write innerHTML strings.
var _els = {};
global.document = {
  getElementById: function(id) {
    if (!_els[id]) _els[id] = { id: id, innerHTML: '', onclick: null, focus: function() {}, querySelector: function() { return null; } };
    return _els[id];
  },
};
global.escapeHtml = function(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
global.uiIcon = function() { return ''; };
global.getSurahInfo = function(id) { return id === 1 ? { nameSimple: 'Al-Fatihah' } : { nameSimple: 'Surah ' + id }; };

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/data-core/tracks.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-audio-manifest.js');
load('js/tajweed/tajweed-makharij.js');
load('js/tajweed/tajweed-lessons.js');
load('js/tajweed/verse-word-counts.js');
load('js/data-core/review-schedule.js');
load('js/data-core/tajweed-track.js');
load('js/services/audio.js');
load('js/exercises/exercise-engine.js');
load('js/exercises/placement.js');
load('js/qaida/qaida-exercises.js');
load('js/tajweed/tajweed-exercises.js');
load('js/ui/tajweed-ui.js');

// ── Stubs and spies ──

var _calls;
var _audioUrls;
var _exercises;
var _views;
var _recorder;

var _realRecordReview = recordTajweedReview;
var _realMarkVerse = markTajweedVerse;
var _realNextVerse = getNextTajweedVerse;
global.recordTajweedReview = function(id, ok, now) { _calls.review.push([id, ok]); return _realRecordReview(id, ok, now); };
global.markTajweedVerse = function(s, a, smooth, now) { _calls.verse.push([s, a, smooth]); return _realMarkVerse(s, a, smooth, now); };

global.qaidaAudioUrl = function(id) { return _audioUrls[id] || null; };
global.playAudio = function(url) { _calls.play.push(url); return Promise.resolve(true); };
global.stopAudio = function() { _calls.stopAudio++; };
global.cacheAudio = function(urls) { _calls.cache.push(urls); };
global.renderExercise = function(container, item, onAnswer) { _exercises.push({ item: item, onAnswer: onAnswer }); };
global.switchView = function(name, options) {
  _views.push([name, options]);
  if (name === 'tajweed-lesson') renderTajweedLesson();
};

global.isRecordingSupported = function() { return _recorder.supported; };
global.startRecording = function() { _recorder.starts++; return Promise.resolve(_recorder.startResult); };
global.stopRecording = function() { _recorder.stops++; return _recorder.stopPromise || Promise.resolve('blob:take'); };
global.getRecordingUrl = function() { return null; };
global.playComparison = function(url) { _calls.compare.push(url); };
global.discardRecording = function() { _recorder.discards++; };

var VERSES = { '1:1': 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '1:2': 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ' };
function loaderThatWorks() {
  return {
    load: function() { return Promise.resolve(true); },
    loadSurahs: function(ids) { return Promise.resolve(ids.map(function() { return true; })); },
    getVerse: function(s, a) { return VERSES[s + ':' + a] ? { text: VERSES[s + ':' + a] } : null; },
  };
}

function view() { return document.getElementById('view-tajweed-lesson'); }
function card(letterId) { return document.getElementById('tajweed-card-' + letterId); }
function verseCard() { return document.getElementById('tajweed-verse-card'); }

/**
 * Simulate a click on a button with this data-action inside `host`; the
 * click reaches `handler`'s onclick (the host's own by default), as it
 * would by bubbling.
 */
function click(host, action, handler) {
  assert.ok(host.innerHTML.indexOf('data-action="' + action + '"') >= 0, 'no "' + action + '" button to click');
  var el = { getAttribute: function(n) { return n === 'data-action' ? action : null; } };
  (handler || host).onclick({ target: { closest: function() { return el; } } });
}

function nextSlot() { return document.getElementById('tajweed-next'); }

function settle() {
  var p = Promise.resolve();
  for (var i = 0; i < 6; i++) p = p.then(function() { return new Promise(function(r) { setImmediate(r); }); });
  return p;
}

/** Answer every exercise of the open lesson and finish it. */
function answerAll(correct) {
  click(view(), 'practice');
  while (_tajweedRun.step === 'practice') {
    _exercises[_exercises.length - 1].onAnswer(correct);
    click(nextSlot(), 'next', view());
  }
}

// ── Runner ──

var passed = 0;
var failed = 0;
var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function section(title) { tests.push({ title: title }); }

function reset() {
  _storage = {};
  _els = {};
  _calls = { review: [], verse: [], play: [], cache: [], compare: [], stopAudio: 0 };
  _audioUrls = {};
  _exercises = [];
  _views = [];
  _recorder = { supported: true, startResult: 'recording', starts: 0, stops: 0, discards: 0, stopPromise: null };
  global.getNextTajweedVerse = _realNextVerse;
  window.__quranLoader = loaderThatWorks();
  _tajweedRun = null;
}

section('Tajweed lesson intro');

test('a letter without a recording has no Play or Compare, but has its letter, name, makhraj and Record', function () {
  startTajweedLesson('tj0-2', 1);
  var h = card('ha').innerHTML;
  assert.ok(h.indexOf('ه') >= 0, 'letter shown');
  assert.ok(h.indexOf(t('qaida.letter.ha.name')) >= 0, 'name shown');
  assert.ok(h.indexOf(escapeHtml(t('tajweed.point.throat-deepest'))) >= 0, 'makhraj line shown');
  assert.ok(h.indexOf('data-action="tj-play"') < 0, 'no Play');
  assert.ok(h.indexOf('data-action="tj-compare"') < 0, 'no Compare');
  assert.ok(h.indexOf('data-action="tj-record"') >= 0, 'Record still there');
  assert.ok(card('hamza').innerHTML.indexOf('ء') >= 0, 'hamza rendered through getTajweedLetter');
  assert.strictEqual(_recorder.starts, 0, 'the microphone is not asked for on render');
});

test('a letter with a recording has Play, and Compare once the learner has recorded', async function () {
  _audioUrls = { ha: 'assets/audio/qaida/ha.mp3' };
  startTajweedLesson('tj0-2', 1);
  assert.deepStrictEqual(_calls.cache, [['assets/audio/qaida/ha.mp3']], 'the lesson caches its recordings');
  var host = card('ha');
  assert.ok(host.innerHTML.indexOf('data-action="tj-play"') >= 0);
  assert.ok(host.innerHTML.indexOf('data-action="tj-compare"') < 0);
  click(host, 'tj-record');
  assert.strictEqual(_recorder.starts, 1);
  await settle();
  assert.ok(host.innerHTML.indexOf('data-action="tj-stop"') >= 0, 'Stop while recording');
  click(host, 'tj-stop');
  await settle();
  assert.ok(host.innerHTML.indexOf('data-action="tj-compare"') >= 0, 'Compare after a recording');
  assert.ok(card('hha').innerHTML.indexOf('data-action="tj-compare"') < 0, 'only on the card that was recorded');
  click(host, 'tj-compare');
  assert.deepStrictEqual(_calls.compare, ['assets/audio/qaida/ha.mp3']);
});

test('Record is disabled while a stop is pending', async function () {
  startTajweedLesson('tj0-2', 1);
  var host = card('ha');
  click(host, 'tj-record');
  await settle();
  var finish;
  _recorder.stopPromise = new Promise(function(r) { finish = r; });
  click(host, 'tj-stop');
  assert.ok(/<button[^>]*data-action="tj-record"[^>]*disabled/.test(host.innerHTML), 'Record disabled while stopping');
  finish('blob:take');
  await settle();
  assert.ok(/<button[^>]*data-action="tj-record"(?![^>]*disabled)[^>]*>/.test(host.innerHTML), 'Record enabled again');
});

test('with the recorder unsupported, the card says so and Got it / Not yet still work', function () {
  _recorder.supported = false;
  startTajweedLesson('tj0-2', 1);
  var host = card('ha');
  assert.ok(host.innerHTML.indexOf(escapeHtml(t('tajweed.record.unsupported'))) >= 0, 'unsupported message');
  assert.ok(host.innerHTML.indexOf('data-action="tj-record"') < 0, 'no Record button to tap');
  click(host, 'tj-ok');
  click(card('kha'), 'tj-miss');
  assert.deepStrictEqual(_calls.review, [['tj-letter:ha', true], ['tj-letter:kha', false]]);
});

test('a refused microphone shows the denied message and the marks still work', async function () {
  _recorder.startResult = 'denied';
  startTajweedLesson('tj0-2', 1);
  var host = card('ha');
  click(host, 'tj-record');
  await settle();
  assert.ok(host.innerHTML.indexOf(escapeHtml(t('tajweed.record.denied'))) >= 0, 'denied message');
  click(host, 'tj-miss');
  assert.deepStrictEqual(_calls.review, [['tj-letter:ha', false]]);
});

test('Not yet records a miss for tj-letter:ha, which then waits in the review queue', function () {
  startTajweedLesson('tj0-2', 1);
  click(card('ha'), 'tj-miss');
  assert.deepStrictEqual(_calls.review, [['tj-letter:ha', false]]);
  assert.ok(loadTajweedProgress().review['tj-letter:ha'], 'queued');
  assert.ok(card('ha').innerHTML.indexOf('data-action="tj-miss"') < 0, 'marked once');
});

test('leaving the lesson discards the recording and stops audio', function () {
  startTajweedLesson('tj0-2', 1);
  var discards = _recorder.discards;
  var stops = _calls.stopAudio;
  click(view(), 'back');
  assert.ok(_recorder.discards > discards && _calls.stopAudio > stops);
  assert.deepStrictEqual(_views[_views.length - 1], ['track', { trackId: 'tajweed' }]);
  assert.strictEqual(_tajweedCards.length, 0, 'the cards are let go');
});

section('Tajweed lesson practice and finish');

test('exercise answers go to the review queue under their skill', function () {
  startTajweedLesson('tj0-2', 1);
  click(view(), 'practice');
  var item = _exercises[0].item;
  _exercises[0].onAnswer(false);
  _exercises[0].onAnswer(true);
  assert.deepStrictEqual(_calls.review, [[item.skill, false]]);
});

test('finishing Throat letters shows "5 of 28 letters covered" and Next lesson', function () {
  completeTajweedLesson('tj0-1', 1);
  startTajweedLesson('tj0-2', 1);
  answerAll(true);
  assert.ok(view().innerHTML.indexOf('Throat letters done · 5 of 28 letters covered') >= 0, view().innerHTML);
  assert.ok(view().innerHTML.indexOf('data-ref="tj0-3"') >= 0, 'Next lesson goes to tj0-3');
  assert.ok(isTajweedLessonCompleted('tj0-2'));
});

test('a reading check below 0.8 is not recorded and offers a retry', function () {
  startTajweedLesson('tj0-12', 1);
  answerAll(false);
  assert.ok(!isTajweedLessonCompleted('tj0-12'), 'not recorded');
  assert.ok(view().innerHTML.indexOf('data-action="retry"') >= 0, 'retry offered');
  assert.ok(view().innerHTML.indexOf('letters covered') < 0);
});

section('Tajweed verse practice');

test('verse practice shows the verse, Listen with the credit, and Smooth marks it and shows the gain', async function () {
  startTajweedVersePractice();
  await settle();
  var h = verseCard().innerHTML;
  assert.ok(h.indexOf(VERSES['1:1']) >= 0, 'verse text');
  assert.ok(h.indexOf('Al-Fatihah') >= 0, 'surah name');
  assert.ok(h.indexOf('data-src="' + teachingVerseAudioUrl(1, 1) + '"') >= 0, 'Listen plays the teaching recitation');
  assert.ok(h.indexOf('audio-credit') >= 0, 'credit line');
  assert.ok(h.indexOf('data-action="tj-compare"') < 0, 'no Compare before a recording');
  click(verseCard(), 'tj-ok');
  assert.deepStrictEqual(_calls.verse, [[1, 1, true]]);
  assert.ok(verseCard().innerHTML.indexOf('+0.01%') >= 0, verseCard().innerHTML);
  click(nextSlot(), 'verse-next', view());
  await settle();
  assert.ok(verseCard().innerHTML.indexOf(VERSES['1:2']) >= 0, 'moves on to 1:2');
});

test('Not yet queues the verse and still moves on to the next one', async function () {
  startTajweedVersePractice();
  await settle();
  click(verseCard(), 'tj-miss');
  assert.deepStrictEqual(_calls.verse, [[1, 1, false]]);
  assert.ok(loadTajweedProgress().review['tj-verse:1:1'], 'queued');
  assert.ok(verseCard().innerHTML.indexOf('%') < 0, 'no gain line');
  click(nextSlot(), 'verse-next', view());
  await settle();
  assert.ok(verseCard().innerHTML.indexOf(VERSES['1:2']) >= 0, 'moves on to 1:2');
});

test('the gain is rounded first: nothing below 0.005, 2 decimals under 0.1%, else 1', function () {
  function gained(p) { return t('percent.tajweed.gained', { p: p }); }
  assert.strictEqual(_tajweedGainText(0), '');
  assert.strictEqual(_tajweedGainText(0.004), '', 'rounds to 0.00: no line');
  assert.strictEqual(_tajweedGainText(0.0052), gained('0.01'));
  assert.strictEqual(_tajweedGainText(0.012), gained('0.01'));
  assert.strictEqual(_tajweedGainText(0.054), gained('0.05'));
  assert.strictEqual(_tajweedGainText(0.096), gained('0.1'), 'rounds to 0.10, so 1 decimal');
  assert.strictEqual(_tajweedGainText(0.25), gained('0.3'));
  assert.strictEqual(_tajweedGainText(0.34), gained('0.3'));
});

test('when every verse is smooth it shows the done message', function () {
  global.getNextTajweedVerse = function() { return null; };
  startTajweedVersePractice();
  assert.ok(view().innerHTML.indexOf(escapeHtml(t('tajweed.verses.done'))) >= 0);
});

test('a verse that fails to load shows drill.unavailable and a Next verse button', async function () {
  window.__quranLoader = {
    load: function() { return Promise.reject(new Error('offline')); },
    loadSurahs: function() { return Promise.reject(new Error('offline')); },
    getVerse: function() { return null; },
  };
  startTajweedVersePractice();
  await settle();
  assert.ok(verseCard().innerHTML.indexOf(escapeHtml(t('drill.unavailable'))) >= 0, verseCard().innerHTML);
  assert.ok(verseCard().innerHTML.indexOf('data-action="tj-ok"') < 0, 'nothing to mark');
  click(nextSlot(), 'verse-next', view());
  await settle();
  assert.ok(verseCard().innerHTML.indexOf('Al-Fatihah · 1:2') >= 0, 'moves on to 1:2: ' + verseCard().innerHTML);
  assert.deepStrictEqual(_calls.verse, [], 'the skipped verse is not marked');
});

(async function run() {
  for (var i = 0; i < tests.length; i++) {
    if (tests[i].title) { console.log('\n📋 ' + tests[i].title); continue; }
    reset();
    try {
      await tests[i].fn();
      passed++;
      console.log('  ✅ ' + tests[i].name);
    } catch (e) {
      failed++;
      console.log('  ❌ ' + tests[i].name);
      console.log('     ' + (e.message || e));
    }
  }
  console.log('\n' + '='.repeat(50));
  console.log('  tajweed-ui.test.js');
  console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
})();
