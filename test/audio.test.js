#!/usr/bin/env node
/**
 * audio.test.js — Unit tests for the audio service and the service
 * worker's audio cache
 *
 * Tests: verse and word URLs, word numbering, empty Qaida slots, the
 * credit line, playback (one reused element, queues, stopping, files that
 * fail), and which requests sw.js keeps in the long-lived audio cache.
 *
 * Run: node test/audio.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
global.escapeHtml = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
load('js/i18n/strings-en.js');
load('js/qaida/qaida-audio-manifest.js');
load('js/services/audio.js');

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

console.log('\n📋 Audio service');

test('verse URLs point at Al-Husary on everyayah with 3-digit parts', function () {
  assert.strictEqual(verseAudioUrl(1, 1), 'https://everyayah.com/data/Husary_128kbps/001001.mp3');
  assert.strictEqual(verseAudioUrl(114, 6), 'https://everyayah.com/data/Husary_128kbps/114006.mp3');
});

test('teaching recitation URLs point at Al-Husary Muallim', function () {
  assert.ok(teachingVerseAudioUrl(1, 1).endsWith('Husary_Muallim_128kbps/001001.mp3'));
});

test('a Qaida skill without a recording has no URL', function () {
  assert.strictEqual(qaidaAudioUrl('ba'), null);
});

test('a skill listed in the manifest gets its file under assets/audio/qaida/', function () {
  QAIDA_AUDIO_MANIFEST.ba = 'ba.mp3';
  try {
    assert.strictEqual(qaidaAudioUrl('ba'), 'assets/audio/qaida/ba.mp3');
  } finally {
    delete QAIDA_AUDIO_MANIFEST.ba;
  }
});

test('the credit names the reciter and links everyayah.com', function () {
  var html = audioCreditHtml();
  assert.ok(html.indexOf('Recitation: Al-Husary') >= 0);
  assert.ok(html.indexOf('href="https://everyayah.com"') >= 0);
  assert.ok(html.indexOf('rel="noopener"') >= 0);
});

// A stand-in for the browser's <audio>: play() resolves unless the
// file is listed in `failing`; finish() plays the current file to its end.
var made = [];
var failing = {};
function FakeAudio() {
  this.paused = true; this.onended = null; made.push(this);
  this.play = function () {
    this.paused = false;
    return failing[this.src] ? Promise.reject(new Error('offline')) : Promise.resolve();
  };
  this.pause = function () { this.paused = true; };
}
function finish() { if (_audioEl.onended) _audioEl.onended(); }
function flush() { return new Promise(function (r) { setTimeout(r, 0); }); }

var asyncTests = [];
function testAsync(name, fn) { asyncTests.push([name, fn]); }

testAsync('one audio element is reused, and a new sound stops the old one', function () {
  global.Audio = FakeAudio;
  var stopped = 0;
  playAudio('a.mp3', null, function () { stopped++; });
  playAudio('b.mp3');
  assert.strictEqual(made.length, 1, 'phones keep playing only on the same element');
  assert.strictEqual(made[0].src, 'b.mp3');
  assert.strictEqual(stopped, 1, 'the first sound was told it stopped');
  stopAudio();
  assert.strictEqual(made[0].paused, true);
});

testAsync('a queue plays in order and calls onEach and onEnd', function () {
  var seen = [];
  var ended = 0;
  playAudioQueue(['1.mp3', '2.mp3', '3.mp3'], { onEach: function (i) { seen.push(i); }, onEnd: function () { ended++; } });
  assert.strictEqual(_audioEl.src, '1.mp3');
  finish();
  assert.strictEqual(_audioEl.src, '2.mp3');
  finish(); finish();
  assert.deepStrictEqual(seen, [0, 1, 2]);
  assert.strictEqual(ended, 1);
});

testAsync('stopping a queue calls onStop once and plays nothing more', function () {
  var stops = 0;
  var ended = 0;
  playAudioQueue(['1.mp3', '2.mp3'], { onEnd: function () { ended++; }, onStop: function () { stops++; } });
  stopAudio();
  stopAudio();
  assert.strictEqual(stops, 1);
  assert.strictEqual(ended, 0);
  assert.strictEqual(_audioEl.onended, null);
});

testAsync('a file that cannot play stops the queue once', function () {
  failing['bad.mp3'] = true;
  var stops = 0;
  playAudioQueue(['bad.mp3', '2.mp3'], { onStop: function () { stops++; } });
  return flush().then(function () {
    assert.strictEqual(stops, 1);
    stopAudio();
    assert.strictEqual(stops, 1, 'not called again by a later stop');
  });
});

testAsync('a failure from an older sound does not stop the newer one', function () {
  failing['bad2.mp3'] = true;
  var stops = 0;
  playAudio('bad2.mp3');
  playAudio('ok.mp3', null, function () { stops++; });
  return flush().then(function () {
    assert.strictEqual(stops, 0);
    stopAudio();
    delete global.Audio;
  });
});

console.log('\n📋 Word audio');

test('word URLs point at quran.com word-by-word audio with 3-digit parts', function () {
  assert.strictEqual(wordAudioUrl(2, 255, 1), 'https://audio.qurancdn.com/wbw/002_255_001.mp3');
  assert.strictEqual(wordAudioUrl(114, 6, 12), 'https://audio.qurancdn.com/wbw/114_006_012.mp3');
});

test('word positions count each word once', function () {
  assert.deepStrictEqual(quranWordPositions(3, null, null), [[1], [2], [3]]);
});

test('a token that continues the previous word has no recording of its own', function () {
  assert.deepStrictEqual(quranWordPositions(3, ['a', 0, 'b'], null), [[1], [], [2]]);
});

test('a token quran.com counts as two words gets both numbers', function () {
  assert.deepStrictEqual(quranWordPositions(3, null, { 1: 2 }), [[1], [2, 3], [4]]);
});

console.log('\n📋 Service worker audio cache');

var sw = { listeners: {} };
global.self = {
  location: { origin: 'https://bayan.example' },
  addEventListener: function (type, fn) { sw.listeners[type] = fn; },
};
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'));

test('everyayah recitation, quran.com word audio and app audio files use the audio cache', function () {
  assert.ok(isAudioRequest(new URL('https://audio.qurancdn.com/wbw/001_001_001.mp3')));
  assert.ok(isAudioRequest(new URL('https://everyayah.com/data/Husary_128kbps/001001.mp3')));
  assert.ok(isAudioRequest(new URL('https://bayan.example/assets/audio/qaida/ba.mp3')));
});

test('other requests do not', function () {
  assert.ok(!isAudioRequest(new URL('https://bayan.example/js/app.bundle.min.js')));
  assert.ok(!isAudioRequest(new URL('https://firestore.googleapis.com/x')));
});

test('the audio cache survives release cleanup', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/cacheWhitelist = \[[^\]]*AUDIO_CACHE/.test(src));
  assert.ok(/const AUDIO_CACHE = 'bayan-audio-v1'/.test(src), 'a fixed name, not tied to the release');
});

console.log('\n📋 Playback');
asyncTests.reduce(function (p, entry) {
  return p.then(function () {
    return Promise.resolve().then(entry[1]).then(function () {
      passed++; console.log('  ✅ ' + entry[0]);
    }, function (e) {
      failed++; console.log('  ❌ ' + entry[0]); console.log('     ' + (e.message || e));
    });
  });
}, Promise.resolve()).then(function () {
console.log('\n' + '='.repeat(50));
console.log('  audio.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
});
