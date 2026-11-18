#!/usr/bin/env node
/**
 * quran-follow-along.test.js — the word being recited lights up in the
 * reader (js/ui/quran-follow-along.js), with a tiny fake DOM, a fake audio
 * element and animation frames stepped by hand.
 *
 * Run: node test/quran-follow-along.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = globalThis;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/quran/recitation-timing.js');
load('js/data-core/recitation-timing.js');
global.verseAudioUrl = function (s, a) { return 'https://audio.test/' + s + '-' + a + '.mp3'; };
load('js/ui/quran-follow-along.js');

// ── Fake DOM: ayah elements holding word spans ──
function fakeSpan(n, text) {
  var classes = {};
  return {
    n: n, textContent: text,
    classList: {
      add: function (c) { classes[c] = true; },
      remove: function (c) { delete classes[c]; },
      contains: function (c) { return !!classes[c]; },
    },
  };
}
var ayahs = {};
function addAyah(surah, verse, words) {
  var spans = words.map(function (w, i) { return fakeSpan(i + 1, w); });
  ayahs['quran-ayah-' + surah + '-' + verse] = {
    spans: spans,
    querySelectorAll: function () { return spans; },
    querySelector: function (sel) {
      var n = parseInt(sel.match(/data-n="(\d+)"/)[1], 10);
      return spans.filter(function (s) { return s.n === n; })[0] || null;
    },
  };
}
function lit(surah, verse) {
  return ayahs['quran-ayah-' + surah + '-' + verse].spans.filter(function (s) { return s.classList.contains('is-recited'); })
    .map(function (s) { return s.n; });
}
global.document = {
  getElementById: function (id) { return ayahs[id] || null; },
  querySelectorAll: function () {
    var all = [];
    Object.keys(ayahs).forEach(function (k) {
      ayahs[k].spans.forEach(function (s) { if (s.classList.contains('is-recited')) all.push(s); });
    });
    return all;
  },
};

// ── Hand-stepped animation frames and a fake audio element ──
var queued = null, nextId = 1;
global.requestAnimationFrame = function (fn) { queued = fn; return nextId++; };
global.cancelAnimationFrame = function () { queued = null; };
function frame() { var fn = queued; queued = null; if (fn) fn(); }
var audio = { src: '', currentTime: 0, paused: false, ended: false };
global.currentAudioElement = function () { return audio; };
function playing(surah, verse, seconds) {
  audio.src = verseAudioUrl(surah, verse); audio.currentTime = seconds; audio.paused = false; audio.ended = false;
}

addAyah(112, 1, ['قُلۡ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ']);
addAyah(112, 2, ['ٱللَّهُ', 'ٱلصَّمَدُ']);

var passed = 0, failed = 0;
function t(name, fn) {
  try { stopFollowAlong(); fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

console.log('\n📋 Follow along');

t('the word being recited is the only one lit', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4);
  frame();
  assert.deepStrictEqual(lit(112, 1), [2]);
});

t('the highlight moves with the voice', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4); frame();
  audio.currentTime = 3.8; frame();
  assert.deepStrictEqual(lit(112, 1), [4]);
});

t('nothing is lit before the first word or after the last', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 0.5); frame();
  assert.deepStrictEqual(lit(112, 1), []);
  audio.currentTime = 4.7; frame();
  assert.deepStrictEqual(lit(112, 1), []);
});

t('pausing clears the highlight', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4); frame();
  audio.paused = true; frame();
  assert.deepStrictEqual(lit(112, 1), []);
});

t('stopping clears the highlight and asks for no more frames', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4); frame();
  stopFollowAlong();
  assert.deepStrictEqual(lit(112, 1), []);
  assert.strictEqual(queued, null);
});

t('moving to another verse leaves nothing lit on the first', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4); frame();
  startFollowAlong(112, 2);
  assert.deepStrictEqual(lit(112, 1), []);
});

t('a different sound playing (the basmala, the last verse) lights nothing', function () {
  startFollowAlong(112, 2);
  playing(1, 1, 2.0); frame();      // basmala clip still in the element (2.0 s is inside 112:2's first word)
  assert.deepStrictEqual(lit(112, 2), []);
});

t('a stalled stream holds the same word', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 2.5); frame(); frame(); frame();
  assert.deepStrictEqual(lit(112, 1), [3]);
});

t('the verse redrawn or gone mid-play does not throw', function () {
  startFollowAlong(112, 1);
  playing(112, 1, 1.4); frame();
  var saved = ayahs['quran-ayah-112-1'];
  delete ayahs['quran-ayah-112-1'];
  frame();
  ayahs['quran-ayah-112-1'] = saved;
  assert.ok(queued, 'keeps following');
});

t('a verse with no timings asks for no frames', function () {
  startFollowAlong(2, 181);
  assert.strictEqual(queued, null);
});

t('words on screen that don\'t match the timings light nothing', function () {
  addAyah(112, 3, ['لَمۡ', 'يَلِدۡ']); // 112:3 has 4 words in the timings
  startFollowAlong(112, 3);
  playing(112, 3, 1.0); frame();
  assert.deepStrictEqual(lit(112, 3), []);
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
