#!/usr/bin/env node
/**
 * audio.test.js — Unit tests for the audio service and the service
 * worker's audio cache
 *
 * Tests: verse URLs, empty Qaida slots, the credit line, playAudio
 * stopping the previous sound, and which requests sw.js keeps in the
 * long-lived audio cache.
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

test('starting a sound stops the one already playing', function () {
  var made = [];
  global.Audio = function (src) {
    this.src = src; this.paused = false; made.push(this);
    this.play = function () { return Promise.resolve(); };
    this.pause = function () { this.paused = true; };
    this.addEventListener = function () {};
  };
  playAudio('a.mp3');
  playAudio('b.mp3');
  assert.strictEqual(made[0].paused, true);
  assert.strictEqual(made[1].paused, false);
  stopAudio();
  assert.strictEqual(made[1].paused, true);
  delete global.Audio;
});

console.log('\n📋 Service worker audio cache');

var sw = { listeners: {} };
global.self = {
  location: { origin: 'https://bayan.example' },
  addEventListener: function (type, fn) { sw.listeners[type] = fn; },
};
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'));

test('everyayah recitation and app audio files use the audio cache', function () {
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

console.log('\n' + '='.repeat(50));
console.log('  audio.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
