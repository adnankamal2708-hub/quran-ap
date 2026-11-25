#!/usr/bin/env node
/**
 * quran-player.test.js — the reader's recitation options (Speed, Repeat;
 * js/ui/quran-player-options.js) and how the player picks what to play
 * (js/ui/quran-player.js), with fake storage and audio.
 *
 * Run: node test/quran-player.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = globalThis;
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
};
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/ui/quran-player-options.js');
global.document = { getElementById: function () { return null; }, querySelectorAll: function () { return []; } };
global.t = function (k) { return k; };
global.uiIcon = function () { return ''; };
load('js/ui/quran-player.js');

// Fake sound: records what plays and at what speed; end() finishes it.
var plays, current;
global.verseAudioUrl = function (s, v) { return s + ':' + v; };
global.playAudio = function (url, onEnd, onStop, rate) { plays.push(url + '@' + rate); current = onEnd; };
global.stopAudio = function () {};
global.cacheAudio = function () {};
global.loadRecitationTiming = function () {};
global.startFollowAlong = function () {};
global.stopFollowAlong = function () {};
function end() { var f = current; current = null; if (f) f(); }
function endAll() { for (var i = 0; i < 50 && current; i++) end(); }

var passed = 0, failed = 0;
function test(name, fn) {
  try { store = {}; fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e)); }
}

console.log('\n📋 Recitation options');

test('defaults are 1× speed and one recitation of each verse', function () {
  assert.deepStrictEqual(quranPlayerOptions(), { rate: 1, repeat: 1 });
});

test('a chosen speed is remembered', function () {
  setQuranPlayerOption('rate', 0.75);
  assert.strictEqual(quranPlayerOptions().rate, 0.75);
});

test('values outside the menus are ignored, saved or set', function () {
  store[QURAN_PLAYER_OPTIONS_KEY] = JSON.stringify({ rate: 7, repeat: 4 });
  assert.deepStrictEqual(quranPlayerOptions(), { rate: 1, repeat: 1 });
  setQuranPlayerOption('rate', 3);
  setQuranPlayerOption('volume', 1);
  assert.deepStrictEqual(quranPlayerOptions(), { rate: 1, repeat: 1 });
});

test('corrupt storage gives the defaults', function () {
  store[QURAN_PLAYER_OPTIONS_KEY] = '{not json';
  assert.deepStrictEqual(quranPlayerOptions(), { rate: 1, repeat: 1 });
});

test('a speed change reaches the recitation playing now, and only then', function () {
  var rates = [];
  global.setCurrentAudioRate = function (r) { rates.push(r); };
  global._quranRecitation = null;
  setQuranPlayerOption('rate', 1.25);
  global._quranRecitation = { surah: 1, mode: 'surah', verse: 2 };
  setQuranPlayerOption('rate', 1.5);
  assert.deepStrictEqual(rates, [1.5]);
  global._quranRecitation = null;
});

console.log('\n📋 What plays next');

test('one recitation each: on to the next verse, then done', function () {
  assert.deepStrictEqual(quranNextPlay([1, 2], 0, 1, 1), { index: 1, played: 1 });
  assert.strictEqual(quranNextPlay([1, 2], 1, 1, 1), null);
});

test('Repeat 3 recites a verse three times before moving on', function () {
  assert.deepStrictEqual(quranNextPlay([1, 2], 0, 1, 3), { index: 0, played: 2 });
  assert.deepStrictEqual(quranNextPlay([1, 2], 0, 3, 3), { index: 1, played: 1 });
  assert.strictEqual(quranNextPlay([1], 0, 3, 3), null);
});

test('Repeat lowered below the plays so far moves on', function () {
  assert.deepStrictEqual(quranNextPlay([1, 2], 0, 2, 1), { index: 1, played: 1 });
});

test('a verse button with Repeat 2 plays that verse twice, at the chosen speed', function () {
  plays = [];
  global._quranSurahId = 112;
  setQuranPlayerOption('repeat', 2);
  setQuranPlayerOption('rate', 1.25);
  toggleVerseRecitation(3);
  endAll();
  assert.deepStrictEqual(plays, ['112:3@1.25', '112:3@1.25']);
  assert.strictEqual(_quranRecitation, null, 'finished');
});

test('Listen with Repeat 2: basmala once, then each verse twice', function () {
  plays = [];
  global._quranSurahId = 112;
  global._quranVerseKeys = ['112:1', '112:2'];
  setQuranPlayerOption('repeat', 2);
  toggleSurahRecitation();
  endAll();
  assert.deepStrictEqual(plays, ['1:1@1', '112:1@1', '112:1@1', '112:2@1', '112:2@1']);
});

test('changing Repeat while a verse plays applies when it ends', function () {
  plays = [];
  global._quranSurahId = 112;
  global._quranVerseKeys = ['112:1', '112:2'];
  toggleSurahRecitation(); // repeat 1
  end(); // basmala
  setQuranPlayerOption('repeat', 2);
  endAll();
  assert.deepStrictEqual(plays, ['1:1@1', '112:1@1', '112:1@1', '112:2@1', '112:2@1']);
});

console.log('\n📋 Tap a verse');

test('tapping verse 3 plays on from it, with no basmala', function () {
  plays = [];
  global._quranSurahId = 112;
  global._quranVerseKeys = ['112:1', '112:2', '112:3', '112:4'];
  reciteSurahFrom(3);
  assert.strictEqual(_quranRecitation.mode, 'surah', 'Listen shows Stop');
  endAll();
  assert.deepStrictEqual(plays, ['112:3@1', '112:4@1']);
});

test('tapping verse 1 plays the basmala first', function () {
  plays = [];
  reciteSurahFrom(1);
  endAll();
  assert.deepStrictEqual(plays, ['1:1@1', '112:1@1', '112:2@1', '112:3@1', '112:4@1']);
});

test('tapping another verse while playing jumps there', function () {
  plays = [];
  reciteSurahFrom(1);
  end(); // basmala
  reciteSurahFrom(4);
  endAll();
  assert.deepStrictEqual(plays, ['1:1@1', '112:1@1', '112:4@1']);
});

// ── A recording that cannot play (offline, not saved yet) ──

async function failedPlay(setup) {
  var toasts = [];
  global.showToast = function (msg) { toasts.push(msg); };
  global.currentAudioElement = function () { return null; };
  global.playAudio = function (url, onEnd, onStop) {
    plays.push(url);
    return Promise.resolve().then(function () { if (setup.fail) onStop(); return !setup.fail; });
  };
  plays = [];
  reciteSurahFrom(2);
  if (setup.stop) stopQuranRecitation();
  await new Promise(function (r) { setTimeout(r, 0); });
  return toasts;
}

async function asyncTests() {
  console.log('\n📋 When a recording cannot play');
  var cases = [
    ['the reader is told why, and the player resets', { fail: true }, ['reader.audioFailed']],
    ['nothing is said when it plays', { fail: false }, []],
    ['nothing is said when the reader pressed Stop', { fail: true, stop: true }, []],
  ];
  for (var i = 0; i < cases.length; i++) {
    try {
      var toasts = await failedPlay(cases[i][1]);
      assert.deepStrictEqual(toasts, cases[i][2]);
      if (cases[i][1].fail) assert.strictEqual(global._quranRecitation, null);
      passed++; console.log('  ✅ ' + cases[i][0]);
    } catch (e) { failed++; console.log('  ❌ ' + cases[i][0] + '\n     ' + (e.message || e)); }
    global._quranRecitation = null;
  }
}

asyncTests().then(function () {
  console.log('\n' + '='.repeat(50));
  console.log('  quran-player.test.js');
  console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
});
