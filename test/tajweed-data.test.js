#!/usr/bin/env node
/**
 * tajweed-data.test.js — Unit tests for the makharij data and the Tajweed
 * Beginner lessons
 *
 * Tests: every letter has one makhraj in a known area, the 17 points,
 * the heavy and qalqalah letters, the lesson numbering, lessons 2-8 teach
 * the 28 letters once in the spec's grouping, and every string the data
 * implies exists.
 *
 * Run: node test/tajweed-data.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-letters.js');
load('js/tajweed/tajweed-makharij.js');
load('js/tajweed/tajweed-lessons.js');

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

function sorted(list) { return list.slice().sort(); }

function hasString(key) { return t(key) !== key; }

// Every makhraj entry is one of the 28 letters, or hamzah (ruling R4).
var LETTER_IDS = QAIDA_LETTERS.map(function (l) { return l.id; });
var SOUND_IDS = LETTER_IDS.concat(['hamza']);

console.log('\n📋 Tajweed makharij');

test('the five areas', function () {
  assert.deepStrictEqual(TAJWEED_AREAS, ['throat', 'tongue', 'lips', 'nose', 'cavity']);
});

test('there are 17 points, each in a known area', function () {
  assert.strictEqual(TAJWEED_POINTS.length, 17);
  var seen = {};
  TAJWEED_POINTS.forEach(function (p) {
    assert.ok(!seen[p.id], 'duplicate point ' + p.id);
    seen[p.id] = true;
    assert.ok(TAJWEED_AREAS.indexOf(p.area) >= 0, p.id + ' area ' + p.area);
  });
});

test('the points per area follow the 17-point scheme (1, 3, 10, 2, 1)', function () {
  var count = {};
  TAJWEED_POINTS.forEach(function (p) { count[p.area] = (count[p.area] || 0) + 1; });
  assert.deepStrictEqual(count, { cavity: 1, throat: 3, tongue: 10, lips: 2, nose: 1 });
});

test('every one of the 28 letters has exactly one makhraj in a known area', function () {
  LETTER_IDS.forEach(function (id) {
    var entries = TAJWEED_MAKHARIJ.filter(function (m) { return m.letter === id; });
    assert.strictEqual(entries.length, 1, id);
    assert.ok(TAJWEED_AREAS.indexOf(entries[0].area) >= 0, id + ' area ' + entries[0].area);
  });
});

test('hamzah has the deepest throat point; nothing else is listed', function () {
  assert.deepStrictEqual(sorted(TAJWEED_MAKHARIJ.map(function (m) { return m.letter; })), sorted(SOUND_IDS));
  var hamza = TAJWEED_MAKHARIJ.filter(function (m) { return m.letter === 'hamza'; })[0];
  var ha = TAJWEED_MAKHARIJ.filter(function (m) { return m.letter === 'ha'; })[0];
  assert.strictEqual(hamza.area, 'throat');
  assert.strictEqual(hamza.point, ha.point);
});

test("each makhraj's area is its point's area", function () {
  var areaOf = {};
  TAJWEED_POINTS.forEach(function (p) { areaOf[p.id] = p.area; });
  TAJWEED_MAKHARIJ.forEach(function (m) {
    assert.ok(areaOf[m.point], m.letter + ' point ' + m.point);
    assert.strictEqual(m.area, areaOf[m.point], m.letter);
  });
});

test('alif comes from the mouth cavity', function () {
  var alif = TAJWEED_MAKHARIJ.filter(function (m) { return m.letter === 'alif'; })[0];
  assert.strictEqual(alif.area, 'cavity');
});

console.log('\n📋 Tajweed qualities and confused pairs');

test('the qalqalah letters are exactly qaf, tta, ba, jim, dal', function () {
  assert.deepStrictEqual(sorted(TAJWEED_QUALITIES.qalqalah), sorted(['qaf', 'tta', 'ba', 'jim', 'dal']));
});

test('the heavy letters are exactly kha, sad, dad, ghayn, tta, qaf, zza', function () {
  assert.deepStrictEqual(sorted(TAJWEED_QUALITIES.heavy), sorted(['kha', 'sad', 'dad', 'ghayn', 'tta', 'qaf', 'zza']));
});

test('the whispered letters are the ten of "fa-hath-thahu shakhsun sakat"', function () {
  assert.deepStrictEqual(sorted(TAJWEED_QUALITIES.whispered),
    sorted(['fa', 'hha', 'tha', 'ha', 'shin', 'kha', 'sad', 'sin', 'kaf', 'ta']));
});

test('every quality lists known letters, each once', function () {
  Object.keys(TAJWEED_QUALITIES).forEach(function (q) {
    var seen = {};
    TAJWEED_QUALITIES[q].forEach(function (id) {
      assert.ok(LETTER_IDS.indexOf(id) >= 0, q + ' has unknown ' + id);
      assert.ok(!seen[id], q + ' lists ' + id + ' twice');
      seen[id] = true;
    });
  });
});

test('the confused pairs are the spec list, of known sounds', function () {
  assert.deepStrictEqual(TAJWEED_CONFUSED_PAIRS, [
    ['hha', 'ha'], ['ain', 'hamza'], ['sad', 'sin'], ['tta', 'ta'],
    ['dad', 'dal'], ['zza', 'dhal'], ['qaf', 'kaf'], ['tha', 'sin'],
  ]);
});

console.log('\n📋 Tajweed Beginner lessons');

var TOPICS = ['areas', 'points', 'qualities', 'confused', 'check'];

test('the lesson ids are tj0-1..tj0-12, numbered 1..12, all level 0', function () {
  assert.strictEqual(TAJWEED_LESSONS.length, 12);
  TAJWEED_LESSONS.forEach(function (l, i) {
    assert.strictEqual(l.id, 'tj0-' + (i + 1));
    assert.strictEqual(l.number, i + 1);
    assert.strictEqual(l.level, 0);
  });
});

test('there is one check and it comes last', function () {
  var checks = TAJWEED_LESSONS.filter(function (l) { return l.kind === 'check'; });
  assert.strictEqual(checks.length, 1);
  assert.strictEqual(TAJWEED_LESSONS[11].kind, 'check');
  assert.strictEqual(TAJWEED_LESSONS[11].topic, 'check');
  TAJWEED_LESSONS.slice(0, 11).forEach(function (l) { assert.strictEqual(l.kind, 'lesson', l.id); });
});

test('the topics follow the spec order', function () {
  assert.deepStrictEqual(TAJWEED_LESSONS.map(function (l) { return l.topic; }), [
    'areas', 'points', 'points', 'points', 'points', 'points', 'points', 'points',
    'qualities', 'qualities', 'confused', 'check',
  ]);
  TAJWEED_LESSONS.forEach(function (l) { assert.ok(TOPICS.indexOf(l.topic) >= 0, l.id); });
});

test("lessons 2-8 teach all 28 letters once, in the spec's grouping", function () {
  var groups = TAJWEED_LESSONS.slice(1, 8).map(function (l) { return sorted(l.letters); });
  assert.deepStrictEqual(groups, [
    sorted(['hamza', 'ha', 'ain', 'hha', 'ghayn', 'kha']),
    sorted(['qaf', 'kaf']),
    sorted(['jim', 'shin', 'ya']),
    sorted(['dad', 'lam', 'nun', 'ra']),
    sorted(['ta', 'dal', 'tta', 'tha', 'dhal', 'zza', 'sad', 'sin', 'zay']),
    sorted(['fa', 'ba', 'mim', 'waw']),
    sorted(['alif']),
  ]);
  var all = [].concat.apply([], groups).filter(function (id) { return id !== 'hamza'; });
  assert.deepStrictEqual(sorted(all), sorted(LETTER_IDS));
});

test("a points lesson's letters are listed in makhraj order", function () {
  var order = TAJWEED_MAKHARIJ.map(function (m) { return m.letter; });
  TAJWEED_LESSONS.filter(function (l) { return l.topic === 'points'; }).forEach(function (l) {
    var idx = l.letters.map(function (id) { return order.indexOf(id); });
    assert.deepStrictEqual(idx, idx.slice().sort(function (a, b) { return a - b; }), l.id);
  });
});

test('the qualities lessons cover every quality once, and list its letters', function () {
  var lessons = TAJWEED_LESSONS.filter(function (l) { return l.topic === 'qualities'; });
  var covered = [].concat.apply([], lessons.map(function (l) { return l.qualities; }));
  assert.deepStrictEqual(sorted(covered), sorted(Object.keys(TAJWEED_QUALITIES)));
  assert.ok(lessons[0].qualities.indexOf('heavy') >= 0 && lessons[0].qualities.indexOf('whispered') >= 0);
  assert.ok(lessons[1].qualities.indexOf('qalqalah') >= 0);
  lessons.forEach(function (l) {
    var expected = {};
    l.qualities.forEach(function (q) { TAJWEED_QUALITIES[q].forEach(function (id) { expected[id] = true; }); });
    assert.deepStrictEqual(sorted(l.letters), sorted(Object.keys(expected)), l.id);
  });
});

test('the confused-letters lesson lists the letters of every pair once', function () {
  var lesson = getTajweedLesson('tj0-11');
  var expected = {};
  TAJWEED_CONFUSED_PAIRS.forEach(function (p) { expected[p[0]] = true; expected[p[1]] = true; });
  assert.deepStrictEqual(sorted(lesson.letters), sorted(Object.keys(expected)));
});

test('every lesson letter has a makhraj', function () {
  TAJWEED_LESSONS.forEach(function (l) {
    l.letters.forEach(function (id) { assert.ok(SOUND_IDS.indexOf(id) >= 0, l.id + ' ' + id); });
  });
});

test('getTajweedLesson and getTajweedLevelLessons', function () {
  assert.strictEqual(getTajweedLesson('tj0-3').number, 3);
  assert.strictEqual(getTajweedLesson('nope'), null);
  assert.strictEqual(getTajweedLevelLessons(0).length, 12);
  assert.deepStrictEqual(getTajweedLevelLessons(1), []);
});

console.log('\n📋 Tajweed strings');

test('every area has a name and a description', function () {
  TAJWEED_AREAS.forEach(function (a) {
    assert.ok(hasString('tajweed.area.' + a + '.name'), a + ' name');
    assert.ok(hasString('tajweed.area.' + a + '.desc'), a + ' desc');
  });
});

test('every point has its one-line description', function () {
  TAJWEED_POINTS.forEach(function (p) { assert.ok(hasString('tajweed.point.' + p.id), p.id); });
});

test('every quality has a name and a description', function () {
  Object.keys(TAJWEED_QUALITIES).forEach(function (q) {
    assert.ok(hasString('tajweed.quality.' + q + '.name'), q + ' name');
    assert.ok(hasString('tajweed.quality.' + q + '.desc'), q + ' desc');
  });
});

test('every lesson has a title', function () {
  TAJWEED_LESSONS.forEach(function (l) { assert.ok(hasString('tajweed.lesson.' + l.id + '.title'), l.id); });
});

console.log('\n' + '='.repeat(50));
console.log('  tajweed-data.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
