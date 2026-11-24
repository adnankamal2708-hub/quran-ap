#!/usr/bin/env node
/**
 * salah-ui.test.js — The Salah lesson screens
 *
 * Fails if a learner with no madhab reaches a lesson before choosing one,
 * the picker does not save the choice, an intro leaves out the Arabic, a
 * word's meaning or the source, a lesson with nothing to ask cannot be
 * finished, the teacher note shows when it should not (or the reverse), or
 * a word answer is not recorded.
 *
 * Run: node test/salah-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
var _store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
};
var _view = { innerHTML: '', onclick: null };
global.document = { getElementById: function (id) { return id === 'view-salah-lesson' ? _view : null; } };
global.escapeHtml = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
global.uiIcon = function () { return ''; };
global.stopAudio = function () {};
global.renderExercise = function () {};
global.queueTracksSync = function () {};
var _views = [];
global.switchView = function (name) { _views.push(name); if (name === 'salah-lesson') renderSalahLesson(); };
global.matchMedia = function () { return { matches: true }; };

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/qaida/qaida-exercises.js');
load('js/salah/salah-phrases.js');
load('js/salah/salah-lessons.js');
load('js/salah/salah-figure-poses.js');
load('js/data-core/tracks.js');
load('js/data-core/review-schedule.js');
load('js/data-core/salah-track.js');
load('js/salah/salah-exercises.js');
load('js/ui/salah-figure.js');
load('js/ui/salah-madhab-ui.js');
load('js/ui/salah-ui.js');
global.queueTracksSync = function () {};

var passed = 0;
var failed = 0;
function test(name, fn) {
  _store = {};
  _views = [];
  _view.innerHTML = '';
  _salahRun = null;
  SALAH_TEACHER_REVIEWED = false;
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function esc(s) { return escapeHtml(s); }
function click(action, attrs) {
  attrs = attrs || {};
  var el = { getAttribute: function (k) { return k === 'data-action' ? action : attrs[k] || null; } };
  _view.onclick({ target: { closest: function () { return el; } } });
}

console.log('salah-ui');

test('with no madhab, opening a lesson shows the picker, not the lesson', function () {
  startSalahLesson('s1-2', 1);
  assert.strictEqual(_salahRun.step, 'madhab');
  SALAH_MADHABS.forEach(function (m) { assert.ok(_view.innerHTML.indexOf('data-madhab="' + m + '"') >= 0, m); });
  assert.ok(_view.innerHTML.indexOf(esc(t('salah.lesson.s1-2'))) < 0, 'the lesson title is not shown');
});

test('choosing in the picker saves the madhab and opens the lesson', function () {
  startSalahLesson('s1-2', 1);
  click('madhab', { 'data-madhab': 'maliki' });
  assert.strictEqual(getSalahMadhab(), 'maliki');
  assert.strictEqual(_salahRun.step, 'intro');
  assert.strictEqual(_salahRun.lesson.id, 's1-2');
});

test('every madhab and the unsure choice have a name and a line', function () {
  SALAH_MADHABS.forEach(function (m) {
    ['salah.madhab.' + m, 'salah.madhab.' + m + '.desc'].forEach(function (k) { assert.notStrictEqual(t(k), k, k); });
  });
});

test('an intro shows the Arabic, each word with its meaning, and the sources', function () {
  setSalahMadhab('hanafi');
  startSalahLesson('s1-4', 1);
  var html = _view.innerHTML;
  var phrase = getSalahPhrase('ruku-tasbih');
  assert.ok(html.indexOf(esc(phrase.ar)) >= 0, 'the Arabic');
  phrase.words.forEach(function (w) {
    assert.ok(html.indexOf(esc(w.ar)) >= 0 && html.indexOf(esc(w.en)) >= 0, w.ar);
  });
  assert.ok(html.indexOf(esc(phrase.en)) >= 0, 'the meaning');
  assert.ok(html.indexOf('Muslim 772') >= 0 && html.indexOf('Abū Dāwūd 869') >= 0, 'the sources');
  assert.ok(html.indexOf('<svg') >= 0, 'the figure');
});

test('every lesson and note has its string', function () {
  SALAH_LESSONS.forEach(function (l) {
    assert.notStrictEqual(t(l.titleKey), l.titleKey, l.titleKey);
    if (l.noteKey) assert.notStrictEqual(t(l.noteKey), l.noteKey, l.noteKey);
  });
  ['salah.teacherReview', 'salah.madhab.title', 'salah.madhab.yours', 'salah.madhab.change'].forEach(function (k) {
    assert.notStrictEqual(t(k), k, k);
  });
});

test('Mālikī s3-1 shows its note and finishes with Done', function () {
  setSalahMadhab('maliki');
  startSalahLesson('s3-1', 1);
  assert.ok(_view.innerHTML.indexOf(esc(t('salah.note.malikiThana'))) >= 0, 'the note');
  assert.ok(_view.innerHTML.indexOf('data-action="done"') >= 0, 'a Done button');
  click('done');
  assert.strictEqual(_salahRun.step, 'finish');
  assert.ok(loadSalahProgress().completed['s3-1'], 'the lesson is complete');
});

test('the teacher note shows on Level 3–4 intros until reviewed', function () {
  setSalahMadhab('hanafi');
  startSalahLesson('s3-2', 1);
  assert.ok(_view.innerHTML.indexOf(esc(t('salah.teacherReview'))) >= 0, 'level 3 has it');
  startSalahLesson('s1-2', 1);
  assert.ok(_view.innerHTML.indexOf(esc(t('salah.teacherReview'))) < 0, 'level 1 does not');
  SALAH_TEACHER_REVIEWED = true;
  startSalahLesson('s4-1', 1);
  assert.ok(_view.innerHTML.indexOf(esc(t('salah.teacherReview'))) < 0, 'gone once reviewed');
});

test('a word answer is recorded; a second answer to it is ignored', function () {
  setSalahMadhab('hanafi');
  startSalahLesson('s1-2', 1);
  click('practice');
  var item = _salahRun.items[0];
  assert.ok(item.word);
  _onSalahAnswer(true);
  _onSalahAnswer(false);
  assert.ok(loadSalahProgress().known[salahWordKey(item.word)], 'the word is known');
  assert.strictEqual(_salahRun.correct, 1);
});

test('a reading check below the pass mark is not recorded and offers a retry', function () {
  setSalahMadhab('hanafi');
  startSalahLesson('s1-check', 1);
  click('practice');
  _salahRun.items.forEach(function () { _onSalahAnswer(false); click('next'); });
  assert.strictEqual(_salahRun.step, 'finish');
  assert.ok(!loadSalahProgress().completed['s1-check']);
  assert.ok(_view.innerHTML.indexOf('data-action="retry"') >= 0);
});

test('the path header names the madhab and offers a change', function () {
  assert.ok(salahPathHeaderHtml().indexOf('data-action="salah-madhab"') >= 0);
  setSalahMadhab('shafii');
  assert.ok(salahPathHeaderHtml().indexOf(esc(t('salah.madhab.shafii'))) >= 0);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
