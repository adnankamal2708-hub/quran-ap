#!/usr/bin/env node
/**
 * salah-lessons.test.js — The Salah track's lesson path
 *
 * Fails if a lesson id repeats or skips a number, a level does not end with
 * its reading check, a lesson names an unknown phrase or part, a phrase is
 * never taught, or some madhab meets a lesson with nothing to show.
 *
 * Run: node test/salah-lessons.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/salah/salah-phrases.js');
load('js/salah/salah-lessons.js');

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

var LEVEL_SIZES = { 1: 8, 2: 8, 3: 5, 4: 6 };

console.log('salah-lessons');

test('lesson ids are unique and numbered 1..n per level, as the spec\'s path', function() {
  var seen = {};
  Object.keys(LEVEL_SIZES).forEach(function(level) {
    var lessons = getSalahLevelLessons(Number(level)).filter(function(l) { return l.kind !== 'check'; });
    assert.strictEqual(lessons.length, LEVEL_SIZES[level], 'level ' + level);
    lessons.forEach(function(l, i) {
      assert.strictEqual(l.number, i + 1, l.id);
      assert.strictEqual(l.id, 's' + level + '-' + (i + 1));
    });
  });
  SALAH_LESSONS.forEach(function(l) {
    assert.ok(!seen[l.id], 'duplicate ' + l.id);
    seen[l.id] = true;
    assert.ok(l.titleKey, l.id + ' has no title');
  });
});

test('every level ends with a check that holds every phrase of the level', function() {
  Object.keys(LEVEL_SIZES).forEach(function(level) {
    var lessons = getSalahLevelLessons(Number(level));
    var last = lessons[lessons.length - 1];
    assert.strictEqual(last.kind, 'check', 'level ' + level);
    assert.strictEqual(last.id, 's' + level + '-check');
    var taught = [];
    lessons.slice(0, -1).forEach(function(l) {
      l.phrases.forEach(function(id) { if (taught.indexOf(id) < 0) taught.push(id); });
    });
    assert.deepStrictEqual(last.phrases, taught, 'level ' + level);
  });
});

test('only lesson 1.1 is the walkthrough', function() {
  var walks = SALAH_LESSONS.filter(function(l) { return l.kind === 'walkthrough'; });
  assert.deepStrictEqual(walks.map(function(l) { return l.id; }), ['s1-1']);
});

test('every phrase id exists, and every part index is a part of its phrase', function() {
  SALAH_LESSONS.forEach(function(l) {
    l.phrases.forEach(function(id) {
      var p = getSalahPhrase(id);
      assert.ok(p, l.id + ' ' + id);
      if (l.part !== undefined) assert.ok(p.parts && p.parts[l.part], l.id + ' part of ' + id);
    });
  });
});

test('every phrase appears in some lesson', function() {
  var used = {};
  SALAH_LESSONS.forEach(function(l) { l.phrases.forEach(function(id) { used[id] = true; }); });
  SALAH_PHRASES.forEach(function(p) { assert.ok(used[p.id], p.id + ' is never taught'); });
});

test('every part of a split phrase is taught', function() {
  SALAH_PHRASES.filter(function(p) { return p.parts; }).forEach(function(p) {
    p.parts.forEach(function(_, i) {
      var found = SALAH_LESSONS.some(function(l) { return l.part === i && l.phrases.indexOf(p.id) >= 0; });
      assert.ok(found, p.id + ' part ' + i);
    });
  });
});

test('for every madhab, every non-walkthrough lesson resolves to a phrase or has a note', function() {
  SALAH_MADHABS.forEach(function(m) {
    SALAH_LESSONS.filter(function(l) { return l.kind !== 'walkthrough'; }).forEach(function(l) {
      assert.ok(salahLessonPhrases(l, m).length > 0 || l.noteKey, m + ' ' + l.id);
    });
  });
});

test('maliki lesson s3-1 resolves to [] and has the note', function() {
  var l = getSalahLesson('s3-1');
  assert.deepStrictEqual(salahLessonPhrases(l, 'maliki'), []);
  assert.strictEqual(l.noteKey, 'salah.note.malikiThana');
  assert.deepStrictEqual(salahLessonPhrases(l, 'shafii').map(function(p) { return p.id; }), ['thana-wajjahtu']);
});

test('a part lesson gives that part\'s words and meaning only', function() {
  var p = getSalahPhrase('fatiha');
  var mid = salahLessonPhrases(getSalahLesson('s2-2'), 'unsure')[0];
  assert.deepStrictEqual(mid.words, p.words.slice(p.parts[1].from, p.parts[1].to));
  assert.strictEqual(mid.en, p.parts[1].en);
  assert.strictEqual(mid.ar, mid.words.map(function(w) { return w.ar; }).join(' '));
  assert.strictEqual(p.words.length, 29, 'the record itself is untouched');
});

test('a whole-phrase lesson gives the record itself', function() {
  assert.strictEqual(salahLessonPhrases(getSalahLesson('s1-2'), 'hanafi')[0], getSalahPhrase('takbir'));
});

test('unknown lesson and level give null and []', function() {
  assert.strictEqual(getSalahLesson('s9-9'), null);
  assert.deepStrictEqual(getSalahLevelLessons(9), []);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
