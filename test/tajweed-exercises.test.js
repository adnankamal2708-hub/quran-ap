#!/usr/bin/env node
/**
 * tajweed-exercises.test.js — Unit tests for the generated Tajweed exercises
 *
 * Tests: every lesson and seed yields valid items, the answer is always an
 * option, items are deterministic per seed, listening items exist only when
 * recordings do, wrong options are fair (same-area points, no overlap with
 * the answer's quality), the nose point is never asked, and the placement
 * bank fills levels 0 and 1 and runs through the placement engine.
 *
 * Run: node test/tajweed-exercises.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/data-core/tracks.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-audio-manifest.js');
load('js/tajweed/tajweed-makharij.js');
load('js/tajweed/tajweed-lessons.js');
load('js/tajweed/verse-word-counts.js');
load('js/data-core/review-schedule.js');
load('js/data-core/tajweed-track.js');
load('js/services/audio.js');
load('js/exercises/exercise-engine.js');
load('js/exercises/placement.js');
load('js/qaida/qaida-exercises.js');
load('js/tajweed/tajweed-exercises.js');

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

var SEEDS = [1, 7, 42, 1234, 99991];
var ALL_IDS = TAJWEED_MAKHARIJ.map(function (m) { return m.letter; });

function checkItems(items, label) {
  items.forEach(function (item, i) {
    var err = validateExercise(item);
    assert.strictEqual(err, null, label + ' item ' + i + ': ' + err + ' ' + JSON.stringify(item));
    var m = /^tj-letter:(.+)$/.exec(item.skill || '');
    assert.ok(m && getTajweedLetter(m[1]), label + ' item ' + i + ' skill ' + item.skill);
    assert.ok(typeof item.tag === 'string' && item.tag, label + ' item ' + i + ' tag');
  });
}

function withAudio(ids, fn) {
  var original = Object.assign({}, QAIDA_AUDIO_MANIFEST);
  try {
    Object.keys(QAIDA_AUDIO_MANIFEST).forEach(function (k) { delete QAIDA_AUDIO_MANIFEST[k]; });
    ids.forEach(function (id) { QAIDA_AUDIO_MANIFEST[id] = id + '.mp3'; });
    fn();
  } finally {
    Object.keys(QAIDA_AUDIO_MANIFEST).forEach(function (k) { delete QAIDA_AUDIO_MANIFEST[k]; });
    Object.assign(QAIDA_AUDIO_MANIFEST, original);
  }
}

function allLessonItems() {
  var out = [];
  TAJWEED_LESSONS.forEach(function (lesson) {
    SEEDS.forEach(function (seed) {
      buildTajweedLessonItems(lesson, seed).forEach(function (item) { out.push({ lesson: lesson, item: item }); });
    });
  });
  return out;
}

function letterOfOption(text) {
  for (var i = 0; i < ALL_IDS.length; i++) {
    if (getTajweedLetter(ALL_IDS[i]).char === text) return ALL_IDS[i];
  }
  return null;
}

function makharijOf(letter) {
  return TAJWEED_MAKHARIJ.filter(function (m) { return m.letter === letter; })[0];
}

console.log('\n📋 Tajweed lesson exercises');

test('every lesson yields valid items for every seed, with a skill and a tag', function () {
  TAJWEED_LESSONS.forEach(function (lesson) {
    SEEDS.forEach(function (seed) {
      var items = buildTajweedLessonItems(lesson, seed);
      assert.ok(items.length >= 3, lesson.id + ' has only ' + items.length + ' items');
      checkItems(items, lesson.id + '/' + seed);
    });
  });
});

test('the answer is always among the options', function () {
  allLessonItems().forEach(function (e) {
    assert.ok(e.item.answer >= 0 && e.item.answer < e.item.options.length, e.lesson.id);
  });
});

test('items are deterministic per seed and differ between seeds', function () {
  TAJWEED_LESSONS.forEach(function (lesson) {
    var a = JSON.stringify(buildTajweedLessonItems(lesson, 5));
    assert.strictEqual(JSON.stringify(buildTajweedLessonItems(lesson, 5)), a, lesson.id);
  });
  var lesson = getTajweedLesson('tj0-6');
  assert.notStrictEqual(JSON.stringify(buildTajweedLessonItems(lesson, 5)), JSON.stringify(buildTajweedLessonItems(lesson, 6)));
});

test('an unknown lesson has no items', function () {
  assert.deepStrictEqual(buildTajweedLessonItems(null, 1), []);
});

test('the areas lesson and the check draw from all letters, not just their (empty) letter list', function () {
  var areas = buildTajweedLessonItems(getTajweedLesson('tj0-1'), 3);
  assert.ok(areas.length >= 6);
  areas.forEach(function (item) { assert.strictEqual(item.tag, 'areas'); });
  var check = buildTajweedLessonItems(getTajweedLesson('tj0-12'), 3);
  assert.ok(check.length >= 10);
  var tags = {};
  check.forEach(function (item) { tags[item.tag] = true; });
  assert.ok(Object.keys(tags).length >= 3, 'the check mixes item kinds: ' + Object.keys(tags));
});

test('the nose is never offered as an area or a point', function () {
  allLessonItems().forEach(function (e) {
    assert.ok(e.item.options.indexOf(t('tajweed.point.nose')) < 0, 'nose point offered in ' + e.lesson.id);
    assert.ok(e.item.options.indexOf(t('tajweed.area.nose.name')) < 0, 'nose area offered in ' + e.lesson.id);
  });
});

console.log('\n📋 Fair options');

test('a "which point" question offers another point of the same area, and the right point', function () {
  var checked = 0;
  allLessonItems().forEach(function (e) {
    if (e.item.tag !== 'points' || !e.item.prompt.arabic) return;
    var letter = letterOfOption(e.item.prompt.arabic);
    var mk = makharijOf(letter);
    assert.strictEqual(e.item.options[e.item.answer], t('tajweed.point.' + mk.point), letter);
    var sameArea = TAJWEED_POINTS.filter(function (p) { return p.area === mk.area && p.id !== mk.point; });
    if (sameArea.length === 0) return;
    checked++;
    assert.ok(sameArea.some(function (p) { return e.item.options.indexOf(t('tajweed.point.' + p.id)) >= 0; }),
      'no same-area point offered for ' + letter);
  });
  assert.ok(checked > 10);
});

test('an area question offers distinct areas that include the answer', function () {
  var checked = 0;
  allLessonItems().forEach(function (e) {
    if (e.item.tag !== 'areas') return;
    checked++;
    var mk = makharijOf(letterOfOption(e.item.prompt.arabic));
    assert.strictEqual(e.item.options[e.item.answer], t('tajweed.area.' + mk.area + '.name'));
    assert.strictEqual(new Set(e.item.options).size, e.item.options.length);
  });
  assert.ok(checked > 10);
});

test('wāw and yā are never asked against the cavity, where they sound as long vowels', function () {
  allLessonItems().forEach(function (e) {
    var arabic = e.item.prompt.arabic;
    if (arabic && ['waw', 'ya'].indexOf(letterOfOption(arabic)) >= 0) {
      assert.ok(e.item.options.indexOf(t('tajweed.area.cavity.name')) < 0, 'cavity area offered');
      assert.ok(e.item.options.indexOf(t('tajweed.point.cavity')) < 0, 'cavity point offered');
    }
    var cavityPrompt = e.item.prompt.text && e.item.prompt.text.indexOf(t('tajweed.point.cavity')) >= 0;
    if (cavityPrompt) {
      e.item.options.forEach(function (o) { assert.ok(['waw', 'ya'].indexOf(letterOfOption(o)) < 0, 'wāw/yā offered'); });
    }
  });
});

test('a quality question has exactly one option with the quality', function () {
  var checked = 0;
  TAJWEED_LESSONS.filter(function (l) { return l.topic === 'qualities'; }).forEach(function (lesson) {
    SEEDS.forEach(function (seed) {
      buildTajweedLessonItems(lesson, seed).filter(function (it) { return it.tag === 'qualities'; }).forEach(function (item) {
        checked++;
        var quality = lesson.qualities.filter(function (q) { return item.prompt.text === t('tajweed.ex.which.' + q); })[0];
        assert.ok(quality, 'prompt ' + item.prompt.text);
        var having = item.options.filter(function (o) { return TAJWEED_QUALITIES[quality].indexOf(letterOfOption(o)) >= 0; });
        assert.deepStrictEqual(having, [item.options[item.answer]], quality);
        assert.strictEqual('tj-letter:' + letterOfOption(item.options[item.answer]), item.skill);
      });
    });
  });
  assert.ok(checked >= 10);
});

test('a "pick the letter" question offers one letter from its point', function () {
  var checked = 0;
  allLessonItems().forEach(function (e) {
    if (e.item.tag !== 'points' || !e.item.prompt.text) return;
    checked++;
    var mk = makharijOf(letterOfOption(e.item.options[e.item.answer]));
    var sharing = e.item.options.filter(function (o) { return makharijOf(letterOfOption(o)).point === mk.point; });
    assert.strictEqual(sharing.length, 1, 'two options share the answer point');
  });
  assert.ok(checked > 10);
});

test('no two consecutive items share the correct option, for every lesson and seeds 1-5', function () {
  TAJWEED_LESSONS.forEach(function (lesson) {
    [1, 2, 3, 4, 5].forEach(function (seed) {
      var items = buildTajweedLessonItems(lesson, seed);
      for (var i = 1; i < items.length; i++) {
        assert.notStrictEqual(items[i].options[items[i].answer], items[i - 1].options[items[i - 1].answer],
          lesson.id + '/' + seed + ' items ' + (i - 1) + ' and ' + i);
      }
    });
  });
});

test('a points lesson with 4 or more letters mixes at least two item kinds', function () {
  var checked = 0;
  TAJWEED_LESSONS.filter(function (l) { return l.topic === 'points' && l.letters.length >= 4; }).forEach(function (lesson) {
    [1, 2, 3, 4, 5].forEach(function (seed) {
      checked++;
      var kinds = {};
      buildTajweedLessonItems(lesson, seed).forEach(function (it) { kinds[it.type + it.tag + (it.prompt.arabic ? 'a' : 't')] = true; });
      assert.ok(Object.keys(kinds).length >= 2, lesson.id + '/' + seed + ': ' + Object.keys(kinds));
    });
  });
  assert.ok(checked >= 10);
});

test('a heavy question never offers ra, lam or alif as a wrong option', function () {
  var checked = 0;
  var heavyText = t('tajweed.ex.which.heavy');
  var items = allLessonItems().map(function (e) { return e.item; });
  [0, 1, 2, 3, 4, 5].forEach(function (a) { var b = buildTajweedBank(a); items = items.concat(b[0], b[1]); });
  items.forEach(function (item) {
    if (item.prompt.text !== heavyText) return;
    checked++;
    item.options.forEach(function (o) { assert.ok(['ra', 'lam', 'alif'].indexOf(letterOfOption(o)) < 0, 'offered ' + letterOfOption(o)); });
  });
  assert.ok(checked >= 10);
});

test('a confused-pair question offers the partner of its answer', function () {
  var checked = 0;
  var lesson = getTajweedLesson('tj0-11');
  SEEDS.forEach(function (seed) {
    buildTajweedLessonItems(lesson, seed).forEach(function (item) {
      checked++;
      assert.strictEqual(item.tag, 'confused');
      var right = letterOfOption(item.options[item.answer]);
      var partners = [];
      TAJWEED_CONFUSED_PAIRS.forEach(function (p) {
        if (p.indexOf(right) >= 0) partners.push(p[0] === right ? p[1] : p[0]);
      });
      assert.ok(partners.some(function (p) { return item.options.indexOf(getTajweedLetter(p).char) >= 0; }), right);
    });
  });
  assert.ok(checked >= 8);
});

console.log('\n📋 Listening items');

test('with an empty manifest there are no listen-choose items', function () {
  withAudio([], function () {
    allLessonItems().forEach(function (e) { assert.notStrictEqual(e.item.type, 'listen-choose'); });
    var bank = buildTajweedBank(0);
    [0, 1].forEach(function (l) { bank[l].forEach(function (it) { assert.notStrictEqual(it.type, 'listen-choose'); }); });
  });
});

test('with every recording present there are listen-choose items, valid and pointing at the audio', function () {
  withAudio(ALL_IDS, function () {
    var listen = allLessonItems().filter(function (e) { return e.item.type === 'listen-choose'; });
    assert.ok(listen.length > 10, 'only ' + listen.length);
    listen.forEach(function (e) {
      assert.strictEqual(validateExercise(e.item), null);
      var right = letterOfOption(e.item.options[e.item.answer]);
      assert.strictEqual(e.item.prompt.audio, qaidaAudioUrl(right));
      assert.strictEqual(e.item.skill, 'tj-letter:' + right);
    });
    var confused = buildTajweedLessonItems(getTajweedLesson('tj0-11'), 4).filter(function (it) { return it.type === 'listen-choose'; });
    assert.ok(confused.length > 0, 'the confused-pair lesson listens too');
    allLessonItems().forEach(function (e) { checkItems([e.item], e.lesson.id); });
  });
});

test('a letter without a recording is never played', function () {
  withAudio(['ba'], function () {
    allLessonItems().forEach(function (e) {
      if (e.item.type === 'listen-choose') assert.strictEqual(e.item.skill, 'tj-letter:ba');
    });
  });
});

console.log('\n📋 Placement bank');

test('levels 0 and 1 have at least 8 valid items; levels 2 and 3 are empty', function () {
  var bank = buildTajweedBank(0);
  assert.deepStrictEqual(Object.keys(bank), ['0', '1', '2', '3']);
  [0, 1].forEach(function (l) {
    assert.ok(bank[l].length >= 8, 'level ' + l + ' has ' + bank[l].length);
    checkItems(bank[l], 'bank ' + l);
  });
  assert.deepStrictEqual(bank[2], []);
  assert.deepStrictEqual(bank[3], []);
});

test('level 0 asks areas and qualities, level 1 points and confused pairs', function () {
  var bank = buildTajweedBank(0);
  var tags = function (l) { return Array.from(new Set(bank[l].map(function (i) { return i.tag; }))).sort(); };
  assert.deepStrictEqual(tags(0), ['areas', 'qualities']);
  assert.deepStrictEqual(tags(1), ['confused', 'points']);
});

test('retakes differ and the same attempt repeats', function () {
  assert.strictEqual(JSON.stringify(buildTajweedBank(2)), JSON.stringify(buildTajweedBank(2)));
  assert.notStrictEqual(JSON.stringify(buildTajweedBank(0)), JSON.stringify(buildTajweedBank(1)));
});

function runPlacement(bank, correct) {
  var state = createPlacementTest(bank);
  var guard = 0;
  while (nextPlacementItem(state) && guard++ < 100) state = answerPlacementItem(state, correct);
  assert.ok(guard < 100, 'placement never finished');
  return state;
}

test('a placement run answering everything right ends at level 1', function () {
  [0, 1, 2].forEach(function (attempt) {
    var state = runPlacement(buildTajweedBank(attempt), true);
    assert.strictEqual(getPlacementResult(state).level, 1);
    assert.deepStrictEqual(getPlacementResult(state).gaps, []);
  });
});

test('a placement run answering everything wrong ends at level 0', function () {
  [0, 1, 2].forEach(function (attempt) {
    var state = runPlacement(buildTajweedBank(attempt), false);
    assert.strictEqual(getPlacementResult(state).level, 0);
    assert.ok(getPlacementResult(state).gaps.length > 0);
  });
});

test('every tag has a placement label string', function () {
  ['areas', 'points', 'qualities', 'confused'].forEach(function (tag) {
    assert.notStrictEqual(t('test.tag.tajweed.' + tag), 'test.tag.tajweed.' + tag);
  });
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
