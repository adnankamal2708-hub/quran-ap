/**
 * Tests for js/data-core/word-forms.js — arabicSameWord(), which tells a
 * lesson word from a Quran word with the same letters but other vowels —
 * and the per-form keys the occurrence index builds with it.
 *
 * Run: node test/word-forms.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var arabicSameWord = require('../js/data-core/word-forms.js').arabicSameWord;

var passed = 0;
var failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + '\n     ' + e.message.split('\n')[0]);
  }
}
function suite(name, fn) { console.log('\n📋 ' + name); fn(); }

// [lesson word, Quran token]
var DIFFERENT = [
  ['إِنَّ', 'أَن'],          // "indeed" / "that"
  ['إِنَّ', 'إِن'],          // "indeed" / "if"
  ['مِنْ', 'مَن'],          // "from" / "who"
  ['لَمْ', 'لِمَ'],          // "did not" / "why"
  ['الْجَنَّةَ', 'ٱلۡجِنَّةِ'],  // "paradise" / "the jinn"
  ['الْيَمِّ', 'أَلِيمٞ'],     // "the sea" / "painful"
  ['الْآخِرُ', 'ٱلۡأٓخَرُ'],    // "the last" / "the other"
  ['إِذَا', 'إِذٗا'],         // "when" / "then"
  ['كَانَ', 'كَأَن'],         // "was" / "as if"
  ['عَلِمَ', 'عِلۡمٖ'],        // "knew" / "knowledge"
  ['إِلَّا', 'أَلَّا'],        // "except" / "that not"
];

var SAME = [
  ['مِنْ', 'مِّن'],            // shadda from the word before
  ['رَبَّنَا', 'رَبُّنَا'],       // case ending before a pronoun
  ['قَلِيلًا', 'قَلِيلٗا'],       // two ways to write -an
  ['شَيْءٍ', 'شَيۡـٔٗا'],        // hamza on a tatweel, case ending
  ['الْآخِرُ', 'ٱلۡأٓخِرِ'],      // case ending
  ['الضَّالِّينَ', 'ٱلضَّآلِّينَ'], // آ written for a plain long ā
];

suite('arabicSameWord', function() {
  DIFFERENT.forEach(function(pair) {
    test(pair[0] + ' is not ' + pair[1], function() {
      assert.strictEqual(arabicSameWord(pair[0], pair[1]), false);
    });
  });
  SAME.forEach(function(pair) {
    test(pair[0] + ' is ' + pair[1], function() {
      assert.strictEqual(arabicSameWord(pair[0], pair[1]), true);
    });
  });
  test('never splits a phrase or a word with other letters (the normalizer decides those)', function() {
    assert.strictEqual(arabicSameWord('يَوْمِ الدِّينِ', 'يَوۡمِ'), true);
    assert.strictEqual(arabicSameWord('مِنْ', 'عَنْ'), true);
  });
});

suite('Occurrence index keys', function() {
  var ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/data/occurrence-index.js'), 'utf8'), ctx);
  var T = ctx.window;

  test('look-alike lesson words get their own keys and token counts', function() {
    assert.notStrictEqual(T.OCCURRENCE_INDEX_KEY('مِنْ'), T.OCCURRENCE_INDEX_KEY('مَنْ'));
    assert.ok(T.OCCURRENCE_INDEX_TOKEN_COUNTS[T.OCCURRENCE_INDEX_KEY('مِنْ')] > 2000);
    assert.ok(T.OCCURRENCE_INDEX_TOKEN_COUNTS[T.OCCURRENCE_INDEX_KEY('مَنْ')] > 300);
  });

  test('a word with no look-alike keeps its plain normalized key', function() {
    assert.strictEqual(T.OCCURRENCE_INDEX_KEY('ٱللَّهِ'), T.OCCURRENCE_INDEX_NORM('ٱللَّهِ'));
  });

  test('every key with a token count has verse references', function() {
    Object.keys(T.OCCURRENCE_INDEX_TOKEN_COUNTS).forEach(function(key) {
      assert.ok(T.OCCURRENCE_INDEX[key] && T.OCCURRENCE_INDEX[key].length > 0, key);
    });
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
