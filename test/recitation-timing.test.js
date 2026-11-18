#!/usr/bin/env node
/**
 * recitation-timing.test.js — reading one ayah's word times and finding the
 * word being recited at a given moment (js/data-core/recitation-timing.js).
 *
 * Run: node test/recitation-timing.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/quran/recitation-timing.js');
load('js/data-core/recitation-timing.js');

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

var T = window.__RECITATION_TIMING;

console.log('\n📋 Recitation timing lookup');

t('112:1 decodes to the source times', function () {
  assert.deepStrictEqual(recitationWordTimes(T, 112, 1), { starts: [850, 1380, 2100, 3720], end: 4610 });
});

t('the word at a moment: none before the first word or from the end', function () {
  var w = recitationWordTimes(T, 112, 1);
  assert.strictEqual(recitationWordAt(w, 0), -1);
  assert.strictEqual(recitationWordAt(w, 849), -1);
  assert.strictEqual(recitationWordAt(w, 850), 0);
  assert.strictEqual(recitationWordAt(w, 1379), 0);
  assert.strictEqual(recitationWordAt(w, 1380), 1);
  assert.strictEqual(recitationWordAt(w, 4609), 3);
  assert.strictEqual(recitationWordAt(w, 4610), -1);
});

t('a word with no time keeps the word before it lit', function () {
  var fake = { unit: 10, ayahs: [['a,,b;c']] };
  var w = recitationWordTimes(fake, 1, 1);
  assert.deepStrictEqual(w, { starts: [100, null, 210], end: 330 });
  assert.strictEqual(recitationWordAt(w, 150), 0);
  assert.strictEqual(recitationWordAt(w, 215), 2);
});

t('the same moment always gives the same word (a stalled stream holds still)', function () {
  var w = recitationWordTimes(T, 112, 1);
  assert.strictEqual(recitationWordAt(w, 2500), recitationWordAt(w, 2500));
  assert.strictEqual(recitationWordAt(w, 2500), 2);
});

t('untimed or missing ayahs give null', function () {
  assert.strictEqual(recitationWordTimes(T, 2, 181), null);
  assert.strictEqual(recitationWordTimes(null, 1, 1), null);
  assert.strictEqual(recitationWordTimes(T, 115, 1), null);
  assert.strictEqual(recitationWordTimes(T, 1, 99), null);
  assert.strictEqual(recitationWordAt(null, 500), -1);
});

t('no lead offset by default', function () {
  assert.strictEqual(RECITATION_LEAD_MS, 0);
});

console.log('\n  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
