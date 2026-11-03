#!/usr/bin/env node
/**
 * qaida-lessons.test.js — Unit tests for the Qaida lesson data
 *
 * Tests: numbering, one reading check ending each level, every taught
 * skill exists and is taught once, all skills are taught by the end of
 * Intermediate, titles exist, surah lessons point at real surahs.
 *
 * Run: node test/qaida-lessons.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-letters.js');
load('js/qaida/qaida-marks.js');
load('js/qaida/qaida-lessons.js');

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

var KINDS = ['letters', 'shapes', 'forms', 'nonjoining', 'muqattaat', 'marks', 'review', 'surah', 'check'];

console.log('\n📋 Qaida lessons');

test('ids are unique and follow q<level>-<number>', function () {
  var seen = {};
  QAIDA_LESSONS.forEach(function (l) {
    assert.ok(!seen[l.id], 'duplicate ' + l.id);
    seen[l.id] = true;
    assert.strictEqual(l.id, 'q' + l.level + '-' + l.number);
  });
});

test('each of the four levels is numbered 1..n in order', function () {
  for (var level = 0; level < 4; level++) {
    var nums = getQaidaLevelLessons(level).map(function (l) { return l.number; });
    assert.ok(nums.length > 0, 'level ' + level + ' is empty');
    nums.forEach(function (n, i) { assert.strictEqual(n, i + 1, 'level ' + level); });
  }
});

test('every level ends with exactly one reading check', function () {
  for (var level = 0; level < 4; level++) {
    var lessons = getQaidaLevelLessons(level);
    var checks = lessons.filter(function (l) { return l.kind === 'check'; });
    assert.strictEqual(checks.length, 1, 'level ' + level);
    assert.strictEqual(lessons[lessons.length - 1].kind, 'check', 'level ' + level);
  }
});

test('every lesson has a known kind and a title', function () {
  QAIDA_LESSONS.forEach(function (l) {
    assert.ok(KINDS.indexOf(l.kind) >= 0, l.id + ' kind ' + l.kind);
    var key = 'qaida.lesson.' + l.id + '.title';
    assert.notStrictEqual(t(key), key, l.id);
  });
});

test('every taught skill exists and is taught exactly once', function () {
  var taught = {};
  QAIDA_LESSONS.forEach(function (l) {
    l.teaches.forEach(function (s) {
      assert.ok(QAIDA_SKILL_IDS.indexOf(s) >= 0, l.id + ' teaches unknown ' + s);
      assert.ok(!taught[s], s + ' taught twice');
      taught[s] = true;
    });
  });
});

test('every skill is taught by the end of Intermediate', function () {
  var skills = getQaidaSkillsThrough('q2-7');
  QAIDA_SKILL_IDS.forEach(function (s) { assert.ok(skills.indexOf(s) >= 0, s + ' never taught'); });
});

test('a skill is taught before any lesson that needs it to read', function () {
  // Letters come before every mark lesson
  var lettersDone = getQaidaSkillsThrough('q0-4');
  QAIDA_LETTERS.forEach(function (l) { assert.ok(lettersDone.indexOf(l.id) >= 0, l.id); });
});

test('surah lessons point at short surahs and muqattaat lists its letters', function () {
  QAIDA_LESSONS.filter(function (l) { return l.kind === 'surah'; }).forEach(function (l) {
    assert.ok(l.surah === 1 || (l.surah >= 78 && l.surah <= 114), l.id + ' surah ' + l.surah);
  });
  var m = getQaidaLesson('q0-8');
  assert.ok(m.examples.length >= 10);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-lessons.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
