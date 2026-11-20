#!/usr/bin/env node
/**
 * share-progress.test.js — what the progress card says
 * (js/data-core/share-progress.js)
 *
 * The card shows the share of the Quran's words the learner understands
 * and, when there is one, a short ayah whose every word they know. No
 * streak, no word count, no name.
 *
 * Run: node test/share-progress.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
load('js/i18n/strings-en.js');
load('js/data-core/daily-ayah.js');
load('js/data-core/share-progress.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

/** SRS entries at `stage` for these word numbers, mastered in this order. */
function srs(ids, stage) {
  var out = {};
  ids.forEach(function (n, i) { out['cw_' + n] = { stage: stage === undefined ? 2 : stage, ratedAt: 1000 + i }; });
  return out;
}

console.log('\n📋 pickShareAyah');

test('null when no ayah has every word known', function () {
  assert.strictEqual(pickShareAyah({ '1:2': [1, 2, 3] }, {}), null);
  assert.strictEqual(pickShareAyah({ '1:2': [1, 2, 3] }, srs([1, 2])), null);
  assert.strictEqual(pickShareAyah({}, srs([1])), null);
});

test('a word not yet mastered (stage 1) does not count as known', function () {
  assert.strictEqual(pickShareAyah({ '1:2': [1, 2] }, srs([1, 2], 1)), null);
});

test('a word with no lesson word (null) is never known', function () {
  assert.strictEqual(pickShareAyah({ '1:2': [1, null] }, srs([1])), null);
});

test('picks an ayah whose every word is known, with وَ/فَ words counted', function () {
  assert.strictEqual(pickShareAyah({ '1:2': [1, '+2'], '1:3': [1, 3] }, srs([1, 2])), '1:2');
});

test('skips an ayah too long for the card', function () {
  var long = [];
  for (var i = 1; i <= SHARE_AYAH_MAX_WORDS + 1; i++) long.push(i);
  var fits = long.slice(0, SHARE_AYAH_MAX_WORDS);
  assert.strictEqual(pickShareAyah({ '2:5': long }, srs(long)), null);
  assert.strictEqual(pickShareAyah({ '2:5': fits }, srs(fits)), '2:5');
});

test('prefers the ayah with the most recently mastered word', function () {
  // word 3 is mastered last
  assert.strictEqual(pickShareAyah({ '1:2': [1, 2], '1:3': [1, 3] }, srs([1, 2, 3])), '1:3');
});

test('ties go to the earlier ayah in the Quran, by number not by text', function () {
  var index = { '10:1': [1], '2:5': [1], '2:40': [1] };
  assert.strictEqual(pickShareAyah(index, srs([1])), '2:5');
});

console.log('\n📋 shareCardContent');

var VERSE = { text: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ', translation: '[All] praise is [due] to Allah, Lord of the worlds -' };

test('the % reads to one decimal place, with no trailing .0', function () {
  assert.strictEqual(shareCardContent(12.44, null, '').percent, '12.4%');
  assert.strictEqual(shareCardContent(7, null, '').percent, '7%');
  assert.strictEqual(shareCardContent(0.06, null, '').percent, '0.1%');
});

test('says what the % means, in the strings', function () {
  var c = shareCardContent(12, null, '');
  assert.strictEqual(c.claim, "of the Quran's words I understand");
  assert.strictEqual(c.footer, 'Learning with Bayan');
});

test('carries the ayah, its translation, where it is from and the translation\'s name', function () {
  var c = shareCardContent(12, { ref: '1:2', verse: VERSE }, 'Al-Fatihah');
  assert.strictEqual(c.ayah.arabic, VERSE.text);
  assert.strictEqual(c.ayah.translation, VERSE.translation);
  assert.strictEqual(c.ayah.source, 'Al-Fatihah 1:2 · Saheeh International');
  assert.strictEqual(c.ayah.intro, 'An ayah I understand every word of');
});

test('no ayah on the card when there is none', function () {
  assert.strictEqual(shareCardContent(12, null, '').ayah, null);
});

test('never shows a streak, a word count or a name', function () {
  var c = JSON.stringify(shareCardContent(12, { ref: '1:2', verse: VERSE }, 'Al-Fatihah'));
  assert.ok(!/streak|day|words learned|mastered/i.test(c), c);
});

console.log('\n📋 canShareProgress and the message');

test('there is nothing to share at 0%', function () {
  assert.strictEqual(canShareProgress(0), false);
  assert.strictEqual(canShareProgress(NaN), false);
  assert.strictEqual(canShareProgress(0.1), true);
});

test('the message names the % and the app link', function () {
  assert.strictEqual(shareProgressMessage(12.44, 'https://example.org/app/'),
    "I understand 12.4% of the Quran's words. Learning with Bayan: https://example.org/app/");
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
