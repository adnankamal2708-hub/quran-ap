#!/usr/bin/env node
/**
 * word-drills.test.js — the audio-free Practice drills (js/exercises/word-drills.js)
 *
 * "Spot the word" and "Build the verse" are built from real Quran text and
 * the words the learner has learned (SRS stage >= 1). Every item must pass
 * validateExercise and must be fair: a spot answer is every token of the
 * ayah that matches the word, a build item never starts in answer order.
 *
 * The Quran loader is stubbed with a few real ayahs; loadSRS is stubbed.
 * The vocabulary and the normalizer are the real ones.
 *
 * Run: node test/word-drills.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

var WORDS = require('./load-vocabulary').loadVocabularyWords();
global.getCanonicalWords = function() { return WORDS; };

load('js/i18n/strings-en.js');
load('js/data/occurrence-index.js');
load('js/exercises/exercise-engine.js');
load('js/exercises/word-drills.js');

// ═══════════════════════════════════════════════════════════════
// STUBS
// ═══════════════════════════════════════════════════════════════

// Real ayahs (1:1, 1:2, 112:1), plus 78:1 and 78:2 which are made up from
// real words (to repeat a word, and to hold an ambiguous one) and 78:3 whose
// word is shorter than a build item.
var AYAHS = {
  '1:1': { text: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful' },
  '1:2': { text: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ', translation: '[All] praise is [due] to Allah, Lord of the worlds' },
  '112:1': { text: 'قُلۡ هُوَ ٱللَّهُ أَحَدٌ', translation: 'Say, "He is Allah, [who is] One' },
  '78:1': { text: 'رَبِّ ٱلسَّمَٰوَٰتِ رَبِّ ٱلۡأَرۡضِ', translation: 'Lord of the heavens and Lord of the earth' },
  '78:2': { text: 'مَالِكِ يَوۡمِ ٱلدِّينِ', translation: 'Sovereign of the Day of the Recompense' },
  '78:3': { text: 'ٱللَّهُ ٱلصَّمَدُ', translation: 'Allah, the Eternal Refuge' },
};
var LOADED_SURAHS = [1, 112, 78];

global.__quranLoader = {
  isSurahLoaded: function(id) { return LOADED_SURAHS.indexOf(id) >= 0; },
  getSurahVerseCount: function(id) {
    var verses = Object.keys(AYAHS).filter(function(key) { return key.split(':')[0] === String(id); });
    return Math.max.apply(null, [0].concat(verses.map(function(key) { return Number(key.split(':')[1]); })));
  },
  getVerse: function(surah, verse) {
    var ayah = AYAHS[surah + ':' + verse];
    return ayah ? { id: verse, text: ayah.text, translation: ayah.translation } : null;
  },
};

var _srs = {};
global.loadSRS = function() { return JSON.parse(JSON.stringify(_srs)); };

function idOf(arabic) {
  var norm = window.OCCURRENCE_INDEX_NORM(arabic);
  var match = WORDS.filter(function(w) { return window.OCCURRENCE_INDEX_NORM(w.arabic) === norm; });
  assert.ok(match.length > 0, 'vocabulary has ' + arabic);
  return match.map(function(w) { return w.id; });
}

function learn(arabic, stage) {
  idOf(arabic).forEach(function(id) { _srs[id] = { stage: stage === undefined ? 1 : stage }; });
}

/** A random() that walks through the given values, then repeats the last. */
function sequence(values) {
  var i = 0;
  return function() { return values[Math.min(i++, values.length - 1)]; };
}

// ═══════════════════════════════════════════════════════════════
// HARNESS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;
function test(name, fn) {
  try {
    _srs = {};
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + '\n     ' + e.message.split('\n')[0]);
  }
}
function suite(name, fn) { console.log('\n📋 ' + name); fn(); }

function normalizedAt(item, index) { return window.OCCURRENCE_INDEX_NORM(item.tokens[index]); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('hasLearnedWords', function() {
  test('is false when nothing is learned', function() {
    assert.strictEqual(hasLearnedWords(), false);
  });
  test('is false for stage 0 entries', function() {
    learn('رَبِّ', 0);
    assert.strictEqual(hasLearnedWords(), false);
  });
  test('is true once a word reaches stage 1', function() {
    learn('رَبِّ', 1);
    assert.strictEqual(hasLearnedWords(), true);
  });
});

suite('buildSpotDrill', function() {
  test('returns null when the learner has learned nothing', function() {
    assert.strictEqual(buildSpotDrill(), null);
  });

  test('returns null when only stage 0 words exist', function() {
    learn('رَبِّ', 0);
    assert.strictEqual(buildSpotDrill(), null);
  });

  test('with a learned word, the item is valid and answers point at matching tokens', function() {
    learn('رَبِّ');
    var item = buildSpotDrill();
    assert.ok(item, 'an item is built');
    assert.strictEqual(validateExercise(item), null);
    assert.strictEqual(item.type, 'spot');
    var target = window.OCCURRENCE_INDEX_NORM('رَبِّ');
    item.answer.forEach(function(index) {
      assert.strictEqual(normalizedAt(item, index), target);
    });
  });

  test('the prompt names the learned word meaning', function() {
    learn('رَبِّ');
    var item = buildSpotDrill();
    assert.strictEqual(item.prompt.text, t('drill.spot.prompt', { meaning: 'Lord/Sustainer' }));
  });

  test('the answer includes every matching token and nothing else', function() {
    learn('رَبِّ');
    // 78:1 repeats رَبِّ; 1:2 holds it once. Whichever is picked, all matches are answers.
    [0, 0.4, 0.7, 0.99].forEach(function(r) {
      var item = buildSpotDrill(function() { return r; });
      var target = window.OCCURRENCE_INDEX_NORM('رَبِّ');
      var expected = [];
      item.tokens.forEach(function(token, i) {
        if (window.OCCURRENCE_INDEX_NORM(token) === target) expected.push(i);
      });
      assert.deepStrictEqual(item.answer.slice().sort(), expected);
    });
  });

  test('a repeated word has all its tokens in the answer', function() {
    learn('رَبِّ');
    var found = false;
    for (var r = 0; r < 1; r += 0.05) {
      var item = buildSpotDrill(function() { return r; });
      if (item.tokens.length === 4 && item.answer.length === 2) {
        found = true;
        assert.deepStrictEqual(item.answer.slice().sort(), [0, 2]);
      }
    }
    assert.ok(found, 'the repeating ayah (78:1) is reachable');
  });

  test('is a plain answer: the tapped tokens solve it', function() {
    learn('رَبِّ');
    var item = buildSpotDrill();
    assert.strictEqual(checkExercise(item, item.answer), true);
  });

  test('never uses a word whose form has more than one meaning', function() {
    // ٱلدِّينِ is Debt/Judgment/Religion in the vocabulary: no single right answer.
    learn('ٱلدِّينِ');
    assert.strictEqual(buildSpotDrill(), null);
  });

  test('never builds an item whose answer is the whole ayah', function() {
    AYAHS['78:9'] = { text: 'رَبِّ رَبِّ رَبِّ', translation: 'x' };
    LOADED_SURAHS.splice(0, LOADED_SURAHS.length, 78);
    delete AYAHS['78:1'];
    try {
      learn('رَبِّ');
      assert.strictEqual(buildSpotDrill(), null);
    } finally {
      LOADED_SURAHS.splice(0, LOADED_SURAHS.length, 1, 112, 78);
      delete AYAHS['78:9'];
      AYAHS['78:1'] = { text: 'رَبِّ ٱلسَّمَٰوَٰتِ رَبِّ ٱلۡأَرۡضِ', translation: 'Lord of the heavens and Lord of the earth' };
    }
  });

  test('skips an ayah where the word also appears with a prefix (it would be marked wrong)', function() {
    // لِلَّهِ is li + al- + Allah: tapping it would be right but is not in the answer.
    AYAHS['78:5'] = { text: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱللَّهِ', translation: 'x' };
    try {
      learn('ٱللَّهِ');
      for (var r = 0; r < 1; r += 0.05) {
        var item = buildSpotDrill(function() { return r; });
        assert.ok(item, 'other ayahs still give an item');
        assert.notStrictEqual(item.tokens.join(' '), AYAHS['78:5'].text);
      }
    } finally {
      delete AYAHS['78:5'];
    }
  });

  test('skips ayahs with a wa- prefixed copy of the word', function() {
    AYAHS['78:4'] = { text: 'رَبِّ ٱلسَّمَٰوَٰتِ وَرَبِّ ٱلۡأَرۡضِ', translation: 'x' };
    try {
      learn('رَبِّ');
      for (var r = 0; r < 1; r += 0.05) {
        var item = buildSpotDrill(function() { return r; });
        assert.notStrictEqual(item.tokens.join(' '), AYAHS['78:4'].text);
      }
    } finally {
      delete AYAHS['78:4'];
    }
  });

  test('a multi-tap ayah is accepted and the prompt asks for every word', function() {
    learn('رَبِّ');
    assert.ok(/every word/.test(t('drill.spot.prompt', { meaning: 'x' })), 'prompt says "every word"');
    var found = false;
    for (var r = 0; r < 1; r += 0.05) {
      var item = buildSpotDrill(function() { return r; });
      if (item.answer.length > 1) {
        found = true;
        assert.strictEqual(checkExercise(item, item.answer), true);
      }
    }
    assert.ok(found, 'a two-tap ayah (78:1) is used');
  });

  test('returns null when no learned word occurs in the loaded ayahs', function() {
    learn('كِتَٰب');
    assert.strictEqual(buildSpotDrill(), null);
  });

  test('uses only ayahs of Al-Fatihah and Juz Amma', function() {
    LOADED_SURAHS.push(2);
    AYAHS['2:1'] = { text: 'رَبِّ ٱلۡكِتَٰبِ رَبِّ ٱلنَّاسِ', translation: 'x' };
    try {
      learn('رَبِّ');
      for (var r = 0; r < 1; r += 0.05) {
        var item = buildSpotDrill(function() { return r; });
        assert.notStrictEqual(item.tokens.join(' '), AYAHS['2:1'].text);
      }
    } finally {
      LOADED_SURAHS.pop();
      delete AYAHS['2:1'];
    }
  });

  test('skips surahs whose text is not loaded', function() {
    var saved = LOADED_SURAHS.slice();
    LOADED_SURAHS.length = 0;
    try {
      learn('رَبِّ');
      assert.strictEqual(buildSpotDrill(), null);
    } finally {
      saved.forEach(function(id) { LOADED_SURAHS.push(id); });
    }
  });
});

suite('buildVerseBuildDrill', function() {
  test('the item is valid and uses the verse translation as the prompt', function() {
    var item = buildVerseBuildDrill();
    assert.ok(item, 'an item is built');
    assert.strictEqual(validateExercise(item), null);
    assert.strictEqual(item.type, 'build');
    var translations = Object.keys(AYAHS).map(function(k) { return AYAHS[k].translation; });
    assert.ok(translations.indexOf(item.prompt.text) >= 0);
  });

  test('answer is the ayah words in order and pieces are a shuffle of them', function() {
    var item = buildVerseBuildDrill();
    var ayah = Object.keys(AYAHS).map(function(k) { return AYAHS[k]; }).filter(function(a) {
      return a.translation === item.prompt.text;
    })[0];
    assert.deepStrictEqual(item.answer, ayah.text.split(/\s+/));
    assert.deepStrictEqual(item.pieces.slice().sort(), item.answer.slice().sort());
  });

  test('pieces are never already in answer order, whatever the random numbers', function() {
    [0, 0.001, 0.5, 0.999].forEach(function(r) {
      for (var run = 0; run < 30; run++) {
        var item = buildVerseBuildDrill(sequence([r, run / 30, r, 0, 0, 0, 0, 0, 0, 0]));
        assert.notDeepStrictEqual(item.pieces, item.answer);
      }
    });
    for (var i = 0; i < 200; i++) {
      var plain = buildVerseBuildDrill();
      assert.notDeepStrictEqual(plain.pieces, plain.answer);
    }
  });

  test('only ayahs of 3 to 5 words are used', function() {
    for (var i = 0; i < 100; i++) {
      var item = buildVerseBuildDrill();
      assert.ok(item.answer.length >= 3 && item.answer.length <= 5, item.answer.length + ' words');
    }
  });

  test('skips an ayah whose words are all identical', function() {
    AYAHS['78:9'] = { text: 'كَلَّا كَلَّا كَلَّا', translation: 'No, no, no' };
    try {
      for (var i = 0; i < 200; i++) {
        assert.notStrictEqual(buildVerseBuildDrill().prompt.text, 'No, no, no');
      }
    } finally {
      delete AYAHS['78:9'];
    }
  });

  test('skips an ayah without a translation', function() {
    AYAHS['78:9'] = { text: 'كَلَّا سَيَعۡلَمُونَ ثُمَّ', translation: '' };
    try {
      for (var i = 0; i < 200; i++) {
        assert.notStrictEqual(buildVerseBuildDrill().answer[0], 'كَلَّا');
      }
    } finally {
      delete AYAHS['78:9'];
    }
  });

  test('returns null when no text is loaded', function() {
    var saved = LOADED_SURAHS.slice();
    LOADED_SURAHS.length = 0;
    try {
      assert.strictEqual(buildVerseBuildDrill(), null);
    } finally {
      saved.forEach(function(id) { LOADED_SURAHS.push(id); });
    }
  });

  test('does not need any learned words', function() {
    assert.ok(buildVerseBuildDrill());
  });
});

suite('drill surfaces', function() {
  test('the drill surahs are Al-Fatihah then Juz Amma', function() {
    assert.strictEqual(DRILL_SURAH_IDS[0], 1);
    assert.strictEqual(DRILL_SURAH_IDS[1], 78);
    assert.strictEqual(DRILL_SURAH_IDS[DRILL_SURAH_IDS.length - 1], 114);
    assert.strictEqual(DRILL_SURAH_IDS.length, 1 + 37);
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
