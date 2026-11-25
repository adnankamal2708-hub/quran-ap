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

console.log('\n' + '='.repeat(50));
console.log('  quran-player.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
