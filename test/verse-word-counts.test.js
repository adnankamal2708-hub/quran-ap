#!/usr/bin/env node
/**
 * verse-word-counts.test.js — Unit tests for the per-verse word counts
 * behind the Tajweed progress figure
 *
 * Tests: the counts add up to the Quran's 77,428 words, cover all 114
 * surahs and 6,236 verses, and verseWordCount reads them (0 if unknown).
 *
 * Run: node test/verse-word-counts.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/tajweed/verse-word-counts.js');

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

console.log('\n📋 Verse word counts');

test('the counts sum to the Quran total of 77428', function () {
  var sum = 0;
  Object.keys(VERSE_WORD_COUNTS).forEach(function (s) {
    VERSE_WORD_COUNTS[s].forEach(function (n) { sum += n; });
  });
  assert.strictEqual(QURAN_WORD_TOTAL, 77428);
  assert.strictEqual(sum, 77428);
});

test('there are 114 surahs and 6236 verses', function () {
  var surahs = Object.keys(VERSE_WORD_COUNTS);
  assert.strictEqual(surahs.length, 114);
  var verses = 0;
  surahs.forEach(function (s) { verses += VERSE_WORD_COUNTS[s].length; });
  assert.strictEqual(verses, 6236);
});

test('verseWordCount(1, 1) is 4', function () {
  assert.strictEqual(verseWordCount(1, 1), 4);
});

test('verseWordCount is 0 for an unknown surah or ayah', function () {
  assert.strictEqual(verseWordCount(115, 1), 0);
  assert.strictEqual(verseWordCount(1, 8), 0);
  assert.strictEqual(verseWordCount(1, 0), 0);
});

console.log('\n' + '='.repeat(50));
console.log('  verse-word-counts.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
