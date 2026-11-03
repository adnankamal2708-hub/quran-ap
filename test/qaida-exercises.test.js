#!/usr/bin/env node
/**
 * qaida-exercises.test.js — Unit tests for the generated Qaida exercises
 *
 * Tests: every lesson (and the placement bank) yields valid items, the
 * answer is always an option, items are deterministic per seed, wrong
 * options are lookalikes, syllable sounds are right, surah lessons use
 * the verses they are given, and every item names its skill and tag.
 *
 * Run: node test/qaida-exercises.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-marks.js');
load('js/qaida/qaida-lessons.js');
load('js/qaida/qaida-readability.js');
load('js/exercises/exercise-engine.js');
load('js/qaida/qaida-exercises.js');

global.window = {};
new Function(fs.readFileSync(path.join(__dirname, '..', 'js', 'quran', 'quran-data.js'), 'utf8'))();
var QURAN = global.window.__QURAN_TEXT;
function versesFor(lesson) {
  var out = {};
  getQaidaLessonSurahs(lesson).forEach(function (s) { out[s] = QURAN[s].verses.map(function (v) { return v.text; }); });
  return out;
}

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

function checkItems(items, label) {
  items.forEach(function (item, i) {
    var err = validateExercise(item);
    assert.strictEqual(err, null, label + ' item ' + i + ': ' + err + ' ' + JSON.stringify(item));
    assert.ok(item.skill && QAIDA_SKILL_IDS.indexOf(item.skill) >= 0, label + ' item ' + i + ' skill ' + item.skill);
    assert.ok(typeof item.tag === 'string' && item.tag, label + ' item ' + i + ' tag');
  });
}

console.log('\n📋 Qaida lesson exercises');

test('every lesson yields valid items with a skill and tag, for several seeds', function () {
  QAIDA_LESSONS.forEach(function (lesson) {
    [1, 2, 99, 12345].forEach(function (seed) {
      var items = buildQaidaLessonItems(lesson, seed, versesFor(lesson));
      assert.ok(items.length >= 4, lesson.id + ' seed ' + seed + ' has ' + items.length + ' items');
      checkItems(items, lesson.id);
    });
  });
});

test('the same seed gives the same items; another seed differs', function () {
  var lesson = getQaidaLesson('q1-1');
  assert.deepStrictEqual(buildQaidaLessonItems(lesson, 5), buildQaidaLessonItems(lesson, 5));
  assert.notDeepStrictEqual(buildQaidaLessonItems(lesson, 5), buildQaidaLessonItems(lesson, 6));
});

test('"which letter is Tā?" offers its lookalikes ب and ث', function () {
  var letters = [getQaidaLetter('ba'), getQaidaLetter('ta'), getQaidaLetter('tha'), getQaidaLetter('jim')];
  var item = _qaidaPickLetterItem(getQaidaLetter('ta'), letters, qaidaRandom(3));
  assert.strictEqual(item.options[item.answer], 'ت');
  assert.ok(item.options.indexOf('ب') >= 0 && item.options.indexOf('ث') >= 0);
});

test('a fatḥah syllable reads with a, and the answer matches its letter', function () {
  for (var seed = 1; seed < 30; seed++) {
    var item = _qaidaSyllableItem(QAIDA_SHORT_VOWELS[0], ['fatha'], qaidaRandom(seed));
    var letter = null;
    QAIDA_LETTERS.forEach(function (l) { if (l.char === item.prompt.arabic[0]) letter = l; });
    assert.strictEqual(item.options[item.answer], letter.sound + 'a');
  }
});

test('sukun and shaddah clusters read as expected (بَتْ bat, بَتَّ batta)', function () {
  for (var seed = 1; seed < 20; seed++) {
    var s = _qaidaClusterItem('sukun', qaidaRandom(seed));
    var d = _qaidaClusterItem('shadda', qaidaRandom(seed));
    assert.ok(/ْ$/.test(s.prompt.arabic));
    assert.ok(/َّ$/.test(d.prompt.arabic));
    assert.strictEqual(validateExercise(s), null);
    assert.strictEqual(validateExercise(d), null);
  }
});

test('word-spotting answers are exactly the words with the mark', function () {
  var words = ['بِسۡمِ', 'ٱللَّهِ', 'قَالَ', 'إِنَّ', 'مِن'];
  var item = _qaidaSpotWordsItem('shadda', words, qaidaRandom(1));
  item.tokens.forEach(function (w, i) {
    assert.strictEqual(item.answer.indexOf(i) >= 0, qaidaWordSkills(w).indexOf('shadda') >= 0, w);
  });
});

test('a surah lesson builds verse-order items from the verses it is given', function () {
  var lesson = getQaidaLesson('q3-5');
  var items = buildQaidaLessonItems(lesson, 1, versesFor(lesson));
  var builds = items.filter(function (i) { return i.type === 'build'; });
  assert.ok(builds.length >= 3);
  assert.strictEqual(builds[0].answer.join(' '), QURAN[112].verses[builds[0].verse - 1].text);
});

test('a surah lesson without its verses has no items yet', function () {
  assert.deepStrictEqual(buildQaidaLessonItems(getQaidaLesson('q3-5'), 1, {}), []);
});

test('the muqattaat question accepts the names in reading order', function () {
  var item = buildQaidaLessonItems(getQaidaLesson('q0-8'), 1)[0];
  assert.strictEqual(item.prompt.arabic, 'الم');
  assert.strictEqual(item.options[item.answer], 'Alif · Lām · Mīm');
});

console.log('\n📋 Qaida placement bank');

test('every level has valid items, and retakes differ', function () {
  [0, 1, 2].forEach(function (attempt) {
    var bank = buildQaidaBank(attempt);
    for (var level = 0; level < 4; level++) {
      assert.ok(bank[level].length >= 4, 'level ' + level + ' has ' + bank[level].length);
      checkItems(bank[level], 'bank ' + level);
    }
  });
  assert.notDeepStrictEqual(buildQaidaBank(0)[0], buildQaidaBank(1)[0]);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-exercises.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
