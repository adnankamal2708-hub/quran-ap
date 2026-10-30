#!/usr/bin/env node
/**
 * tracks-ui.test.js — the Learn tab: track cards and a track's path
 *
 * Tests: renderTracks() (joined cards, "Add a track", the "⋯" menu),
 * renderTrackPath('words') (levels, numbered lessons, locks, footer) and
 * what each card, lesson and footer item opens.
 *
 * Run: node test/tracks-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

// The two Learn views; everything is rendered into them as HTML.
var _views = {};
global.document = {
  getElementById: function(id) {
    if (id !== 'view-tracks' && id !== 'view-track') return null;
    if (!_views[id]) _views[id] = { id: id, innerHTML: '', onclick: null, onkeydown: null };
    return _views[id];
  },
};

// Premium stub: tests flip these flags.
var premiumGuided = false;
var premiumExpansion = false;
var upgradeReasons = [];
global.window = {
  __premium: {
    FEATURES: { GUIDED_READING: 'guided_reading', VOCABULARY_EXPANSION: 'vocabulary_expansion' },
    hasFeature: function(feature) {
      if (feature === 'guided_reading') return premiumGuided;
      if (feature === 'vocabulary_expansion') return premiumExpansion;
      return false;
    },
    requestUpgrade: function(reason) { upgradeReasons.push(reason); },
  },
};

// Foundation stubs: ten lessons.
var foundationDone = [];
var foundationTitles = {};
global.getFoundationLessonCount = function() { return 10; };
global.isFoundationLessonCompleted = function(i) { return foundationDone.indexOf(i) >= 0; };
global.isFoundationLessonUnlocked = function(i) { return i === 0 || foundationDone.indexOf(i - 1) >= 0; };
global.getFoundationLessonThematicTitle = function(i) { return foundationTitles[i] || 'Theme ' + (i + 1); };
var coveragePercent = 0;
global.calculateCoverage = function() { return { coveragePercent: coveragePercent }; };
var studiedSurahs = 0;
var completedRoots = 0;
global.getCompletedSurahCount = function() { return studiedSurahs; };
global.getCompletedRootFamilyCount = function() { return completedRoots; };

// Navigation stubs: record what each item opens.
var calls = [];
global.switchView = function(view, options) {
  calls.push('switchView:' + view + (options && options.trackId ? ':' + options.trackId : ''));
};
global.goToFoundationLesson = function(i) { calls.push('goToFoundationLesson:' + i); };
global.openSurahForReading = function(id) { calls.push('openSurahForReading:' + id); };
global.goToRootFamily = function() { calls.push('goToRootFamily'); };
global.goToDifficultyLevel = function(level) { calls.push('goToDifficultyLevel:' + level); };
global.getNextIncompleteDifficultyLevel = function() { return 2; };

// Same helper the bundle gets from auth-ui.js
global.escapeHtml = function(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

function load(rel) {
  // Indirect eval so top-level declarations become globals.
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
require('./load-components')();
load('js/i18n/strings-en.js');
load('js/data-core/tracks.js');
load('js/data-core/word-meanings-track.js');
load('js/phase2-surahs.js');
load('js/ui/learn-screen.js');
load('js/ui/tracks-ui.js');
load('js/ui/root-lesson-ui.js');

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  _storage = {};
  _views = {};
  calls = [];
  upgradeReasons = [];
  foundationDone = [];
  foundationTitles = {};
  coveragePercent = 0;
  studiedSurahs = 0;
  completedRoots = 0;
  premiumGuided = false;
  premiumExpansion = false;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

function html(viewId) {
  return document.getElementById(viewId).innerHTML;
}

/** The opening tags of the elements in `markup` that carry `className`. */
function tagsWithClass(markup, className) {
  var re = new RegExp('<[a-z]+[^>]*class="(?:[^"]*\\s)?' + className + '(?:\\s[^"]*)?"[^>]*>', 'g');
  return markup.match(re) || [];
}

/** Track cards: the markup of each <article class="track-card ...">. */
function cards() {
  return html('view-tracks').split('<article').slice(1);
}

/** Level sections of the path: the markup of each <section class="track-level ...">. */
function levels() {
  return html('view-track').split('<section').slice(1);
}

/** Simulate a click on an element with these data attributes inside a view. */
function clickAction(viewId, attrs) {
  var target = {
    getAttribute: function(name) { return attrs[name] === undefined ? null : String(attrs[name]); },
  };
  var view = document.getElementById(viewId);
  assert.strictEqual(typeof view.onclick, 'function', viewId + ' has a click handler');
  view.onclick({ target: { closest: function() { return target; } }, preventDefault: function() {} });
}

function finishFoundation() {
  for (var i = 0; i < 10; i++) foundationDone.push(i);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\nTrack cards');

test('default state: one joined "Word meanings" card and three "Coming soon" cards', function() {
  renderTracks();
  var all = cards();
  var joined = all.filter(function(c) { return c.indexOf('is-joined') >= 0; });
  var soon = all.filter(function(c) { return c.indexOf('Coming soon') >= 0; });
  assert.strictEqual(joined.length, 1);
  assert.ok(joined[0].indexOf('Word meanings') >= 0, 'joined card is Word meanings');
  assert.strictEqual(soon.length, 3);
  assert.strictEqual(all.length, 4);
});

test('joined cards come first, then the "Add a track" heading', function() {
  renderTracks();
  var markup = html('view-tracks');
  assert.ok(markup.indexOf('Word meanings') < markup.indexOf('Add a track'));
  assert.ok(markup.indexOf('Add a track') < markup.indexOf('Coming soon'));
});

test('the main track card is marked "Main track"', function() {
  renderTracks();
  assert.ok(cards()[0].indexOf('Main track') >= 0);
});

test('the Word meanings card shows its level and percentage and records the high-water mark', function() {
  coveragePercent = 43.2;
  renderTracks();
  assert.ok(cards()[0].indexOf('Beginner') >= 0);
  assert.ok(cards()[0].indexOf('43.2% of the Quran&#39;s words understood') >= 0);
  assert.strictEqual(getTrackPercent('words'), 43.2);
});

test('the Leave item is disabled with one track joined', function() {
  renderTracks();
  var leave = tagsWithClass(cards()[0], 'track-menu-leave');
  assert.strictEqual(leave.length, 1);
  assert.ok(/\sdisabled\b/.test(leave[0]), leave[0]);
});

test('the "⋯" menu holds Make main track and Leave track, hidden until opened', function() {
  renderTracks();
  var card = cards()[0];
  assert.ok(card.indexOf('Make main track') >= 0);
  assert.ok(card.indexOf('Leave track') >= 0);
  var menu = tagsWithClass(card, 'track-menu');
  assert.ok(/\shidden\b/.test(menu[0]), menu[0]);
  var toggle = tagsWithClass(card, 'track-card-more')[0];
  assert.ok(toggle.indexOf('aria-expanded="false"') >= 0);
  assert.ok(toggle.indexOf('aria-label="Options for Word meanings"') >= 0);
});

test('tapping a joined card opens its path', function() {
  renderTracks();
  clickAction('view-tracks', { 'data-action': 'open', 'data-track': 'words' });
  assert.deepStrictEqual(calls, ['switchView:track:words']);
});

console.log('\nWord meanings path');

test('the path shows "Beginner" with 10 numbered lessons', function() {
  renderTrackPath('words');
  var level0 = levels()[0];
  assert.ok(level0.indexOf('Beginner') >= 0);
  var nums = (level0.match(/<span class="track-lesson-num">(\d+)<\/span>/g) || []).map(function(s) {
    return Number(s.replace(/\D/g, ''));
  });
  assert.deepStrictEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('the path has four levels named Beginner to Advanced', function() {
  renderTrackPath('words');
  var names = levels().map(function(l) { return l.match(/class="track-level-name"[^>]*>([^<]+)</)[1]; });
  assert.deepStrictEqual(names, ['Beginner', 'Elementary', 'Intermediate', 'Advanced']);
});

test('the path header shows the track name and percentage', function() {
  coveragePercent = 12.5;
  renderTrackPath('words');
  var markup = html('view-track');
  assert.ok(markup.indexOf('Word meanings') >= 0);
  assert.ok(markup.indexOf('12.5% of the Quran&#39;s words understood') >= 0);
});

test('a free learner sees a Premium lock on level 1', function() {
  renderTrackPath('words');
  var level1 = levels()[1];
  var lock = tagsWithClass(level1, 'track-level-lock');
  assert.strictEqual(lock.length, 1);
  assert.ok(level1.indexOf('Premium') >= 0);
});

test('a premium-locked lesson opens the guided-reading upgrade prompt', function() {
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'upgrade', 'data-level': 1 });
  assert.deepStrictEqual(upgradeReasons, ['guided-reading']);
  clickAction('view-track', { 'data-action': 'upgrade', 'data-level': 3 });
  assert.deepStrictEqual(upgradeReasons, ['guided-reading', 'vocabulary-expansion']);
});

test('a progress-locked level shows a hint and disables its lessons', function() {
  premiumGuided = true;
  premiumExpansion = true;
  renderTrackPath('words');
  var level1 = levels()[1];
  assert.ok(level1.indexOf('Finish Beginner to unlock') >= 0);
  assert.ok(level1.indexOf('Premium') < 0);
  var lessons = tagsWithClass(level1, 'track-lesson');
  assert.ok(lessons.length > 0);
  lessons.forEach(function(tag) { assert.ok(/\sdisabled\b/.test(tag), tag); });
});

test('an open level has no lock', function() {
  premiumGuided = true;
  finishFoundation();
  renderTrackPath('words');
  assert.strictEqual(tagsWithClass(levels()[1], 'track-level-lock').length, 0);
});

test('Foundation lessons show finished and locked states', function() {
  foundationDone = [0];
  renderTrackPath('words');
  var lessons = tagsWithClass(levels()[0], 'track-lesson');
  assert.ok(lessons[0].indexOf('is-done') >= 0, 'lesson 1 finished');
  assert.ok(!/\sdisabled\b/.test(lessons[1]), 'lesson 2 open');
  assert.ok(/\sdisabled\b/.test(lessons[2]), 'lesson 3 locked');
});

test('level-3 entries never show a finished mark', function() {
  premiumGuided = true;
  premiumExpansion = true;
  studiedSurahs = 2;
  completedRoots = 1;
  raiseTrackLevel('words', 3);
  renderTrackPath('words');
  var lessons = tagsWithClass(levels()[3], 'track-lesson');
  assert.strictEqual(lessons.length, 2);
  lessons.forEach(function(tag) { assert.ok(tag.indexOf('is-done') < 0, tag); });
});

test('lesson titles are escaped', function() {
  foundationTitles[0] = '<img src=x>';
  renderTrackPath('words');
  var markup = html('view-track');
  assert.ok(markup.indexOf('<img src=x>') < 0);
  assert.ok(markup.indexOf('&lt;img src=x&gt;') >= 0);
});

test('a Foundation lesson opens goToFoundationLesson', function() {
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'lesson', 'data-kind': 'foundation', 'data-ref': 0 });
  assert.deepStrictEqual(calls, ['goToFoundationLesson:0']);
});

test('a guided surah opens the Quran reader at that surah', function() {
  var realSetTimeout = global.setTimeout;
  global.setTimeout = function(fn) { fn(); };
  try {
    premiumGuided = true;
    finishFoundation();
    renderTrackPath('words');
    clickAction('view-track', { 'data-action': 'lesson', 'data-kind': 'guided-surah', 'data-ref': 112 });
  } finally {
    global.setTimeout = realSetTimeout;
  }
  assert.deepStrictEqual(calls, ['switchView:quran', 'openSurahForReading:112']);
});

test('surah study opens the Learn view and root families open the root list', function() {
  premiumGuided = true;
  premiumExpansion = true;
  raiseTrackLevel('words', 3);
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'lesson', 'data-kind': 'surah-study' });
  clickAction('view-track', { 'data-action': 'lesson', 'data-kind': 'root-families' });
  assert.deepStrictEqual(calls, ['switchView:learn', 'switchView:root-lesson']);
});

test('the footer row holds All words, Roots, Difficulty and Quiz', function() {
  renderTrackPath('words');
  var footer = html('view-track').split('track-path-footer')[1] || '';
  ['All words', 'Roots', 'Difficulty', 'Quiz'].forEach(function(label) {
    assert.ok(footer.indexOf('>' + label + '<') >= 0, label);
  });
});

test('footer items open the word list, roots, difficulty and quiz', function() {
  renderTrackPath('words');
  ['all-words', 'roots', 'difficulty', 'quiz'].forEach(function(action) {
    clickAction('view-track', { 'data-action': action });
  });
  assert.deepStrictEqual(calls, ['switchView:list', 'goToDifficultyLevel:2', 'switchView:quiz']);
  assert.deepStrictEqual(upgradeReasons, ['vocabulary-expansion'], 'Roots asks a free learner to upgrade');
});

test('a free learner is asked to upgrade, and never reaches the root list', function() {
  raiseTrackLevel('words', 3);
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'upgrade', 'data-level': 3 });
  clickAction('view-track', { 'data-action': 'roots' });
  assert.deepStrictEqual(calls, []);
  assert.deepStrictEqual(upgradeReasons, ['vocabulary-expansion', 'vocabulary-expansion']);
});

test('a premium learner opens the root list from the Roots footer item', function() {
  premiumExpansion = true;
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'roots' });
  assert.deepStrictEqual(calls, ['switchView:root-lesson']);
  assert.deepStrictEqual(upgradeReasons, []);
});

test('the back button returns to the track list', function() {
  renderTrackPath('words');
  clickAction('view-track', { 'data-action': 'back' });
  assert.deepStrictEqual(calls, ['switchView:tracks']);
});

test('renderTrackPath() without an id keeps the last opened track', function() {
  renderTrackPath('words');
  _views = {};
  renderTrackPath();
  assert.ok(html('view-track').indexOf('Word meanings') >= 0);
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
