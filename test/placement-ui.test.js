#!/usr/bin/env node
/**
 * placement-ui.test.js — the Word meanings placement test screen
 *
 * Tests: taking the adaptive test through the screen (counter, Next, result),
 * what it saves (level raised only, attempts counted at start, nothing on
 * quit), strength/gap chips and what "Start at ..." opens.
 *
 * The question bank and the exercise renderer are stubbed (the bank builds
 * ~1200 items; the renderer needs a real DOM). The adaptive algorithm itself
 * is the real js/exercises/placement.js.
 *
 * Run: node test/placement-ui.test.js
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

// The test view and the two slots inside it; everything is rendered as HTML.
var PLACEMENT_ELEMENTS = ['view-test', 'placement-exercise', 'placement-next'];
var _elements = {};
global.document = {
  getElementById: function(id) {
    if (PLACEMENT_ELEMENTS.indexOf(id) < 0) return null;
    if (!_elements[id]) _elements[id] = { id: id, innerHTML: '', onclick: null, focus: function() {} };
    if (id === 'view-test' && !_elements[id].fresh) {
      // Re-rendering the view replaces the slots inside it, as in a browser.
      var markup = '';
      Object.defineProperty(_elements[id], 'innerHTML', {
        get: function() { return markup; },
        set: function(value) { markup = value; delete _elements['placement-next']; delete _elements['placement-exercise']; },
      });
      _elements[id].fresh = true;
    }
    return _elements[id];
  },
};

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
global.getFoundationLessonCount = function() { return 10; };
global.isFoundationLessonCompleted = function() { return false; };
global.isFoundationLessonUnlocked = function(i) { return i === 0; };
global.getFoundationLessonThematicTitle = function(i) { return 'Theme ' + (i + 1); };
global.calculateCoverage = function() { return { coveragePercent: 0 }; };
global.getCompletedSurahCount = function() { return 0; };
global.getCompletedRootFamilyCount = function() { return 0; };

// Navigation stubs: record what each item opens.
var calls = [];
global.switchView = function(view, options) {
  calls.push('switchView:' + view + (options && options.trackId ? ':' + options.trackId : ''));
};
global.goToFoundationLesson = function(i) { calls.push('goToFoundationLesson:' + i); };
global.openSurahForReading = function(id) { calls.push('openSurahForReading:' + id); };
global.goToRootFamily = function() { calls.push('goToRootFamily'); };

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
load('js/exercises/placement.js');
load('js/ui/learn-screen.js');
load('js/ui/tracks-ui.js');
load('js/ui/placement-ui.js');

// Stubs that replace the heavy parts after the real files are loaded.
// The synthetic bank: 25 items per level, tagged noun/verb by level parity;
// the item's prompt says which level it came from ("L2-7").
var bankBuilds = [];
var bankTags = ['verb', 'noun'];   // tag of even and odd levels
global.buildWordMeaningsBank = function(attempt) {
  bankBuilds.push(attempt);
  var bank = {};
  [0, 1, 2, 3].forEach(function(level) {
    bank[level] = [];
    for (var i = 0; i < 25; i++) {
      bank[level].push({
        type: 'read-choose',
        prompt: { arabic: 'L' + level + '-' + i },
        options: ['a', 'b', 'c', 'd'],
        answer: 0,
        tag: bankTags[level % 2],
      });
    }
  });
  return bank;
};

var rendered = [];   // { container, item, onAnswer } for each renderExercise call
global.renderExercise = function(container, item, onAnswer) {
  rendered.push({ container: container, item: item, onAnswer: onAnswer });
};

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  _storage = {};
  _elements = {};
  global._placement = null;   // no test running (module state of placement-ui.js)
  calls = [];
  upgradeReasons = [];
  bankBuilds = [];
  bankTags = ['verb', 'noun'];
  rendered = [];
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

function html(id) {
  return document.getElementById(id || 'view-test').innerHTML;
}

/** Simulate a click on an element with this data-action inside the test view. */
function clickAction(action) {
  var target = {
    getAttribute: function(name) { return name === 'data-action' ? action : null; },
  };
  var view = document.getElementById('view-test');
  assert.strictEqual(typeof view.onclick, 'function', 'view-test has a click handler');
  view.onclick({ target: { closest: function() { return target; } }, preventDefault: function() {} });
}

/** The level a stubbed question came from. */
function itemLevel(item) {
  return Number(item.prompt.arabic.charAt(1));
}

/** Answer the question on screen, then press Next. */
function answerAndContinue(correct) {
  var current = rendered[rendered.length - 1];
  current.onAnswer(correct, 0);
  clickAction('next');
}

/**
 * Take the whole test: `isCorrect(item)` decides every answer. Returns the
 * number of questions asked.
 */
function takeTest(isCorrect) {
  var asked = 0;
  while (html().indexOf('placement-result') < 0) {
    assert.ok(asked < 40, 'the test should end');
    var current = rendered[rendered.length - 1];
    answerAndContinue(isCorrect(current.item));
    asked++;
  }
  return asked;
}

function allCorrect() { return true; }
function allWrong() { return false; }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\nStarting');

test('startPlacementTest("words") builds the bank once and opens the test view', function() {
  startPlacementTest('words');
  assert.deepStrictEqual(bankBuilds, [0]);
  assert.deepStrictEqual(calls, ['switchView:test']);
});

test('window.__placement.start is startPlacementTest', function() {
  assert.strictEqual(window.__placement.start, startPlacementTest);
});

test('each start counts an attempt and passes it to the bank', function() {
  startPlacementTest('words');
  startPlacementTest('words');
  startPlacementTest('words');
  assert.deepStrictEqual(bankBuilds, [0, 1, 2]);
});

test('building the bank happens once per test, not per question', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  assert.strictEqual(bankBuilds.length, 1);
});

test('tracks other than Word meanings are ignored', function() {
  startPlacementTest('qaida');
  assert.deepStrictEqual(bankBuilds, []);
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(nextPlacementAttempt('words'), 0, 'no attempt was counted');
});

test('with no test running the view offers to start one', function() {
  renderPlacementTest();
  assert.ok(html().indexOf('Word meanings placement test') >= 0);
  assert.ok(html().indexOf('About 5 minutes') >= 0);
  assert.strictEqual(rendered.length, 0);
  clickAction('begin');
  assert.deepStrictEqual(bankBuilds, [0]);
});

console.log('\nTaking the test');

test('a question shows "Question 1" with no maximum, in the placement container', function() {
  startPlacementTest('words');
  renderPlacementTest();
  var markup = html();
  assert.ok(markup.indexOf('Question 1') >= 0, markup);
  assert.ok(!/Question 1\s*(of|\/)/.test(markup), 'no maximum shown');
  assert.strictEqual(rendered.length, 1);
  assert.strictEqual(rendered[0].container, document.getElementById('placement-exercise'));
  assert.strictEqual(rendered[0].item.type, 'read-choose');
});

test('Next appears only after the question is answered, and moves to "Question 2"', function() {
  startPlacementTest('words');
  renderPlacementTest();
  assert.strictEqual(html('placement-next'), '');
  rendered[0].onAnswer(true, 0);
  assert.ok(html('placement-next').indexOf('data-action="next"') >= 0);
  clickAction('next');
  assert.ok(html().indexOf('Question 2') >= 0);
  assert.strictEqual(html('placement-next'), '', 'the new question has no Next yet');
  assert.strictEqual(rendered.length, 2);
});

test('the test follows the adaptive algorithm and ends within 20 questions', function() {
  startPlacementTest('words');
  renderPlacementTest();
  var asked = takeTest(allWrong);
  assert.ok(asked >= 10 && asked <= 20, 'asked ' + asked);
});

console.log('\nFinishing');

test('all correct: "Your level: Advanced" and the track level is 3', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  assert.ok(html().indexOf('Your level: Advanced') >= 0, html());
  assert.strictEqual(getTrackLevel('words'), 3);
});

test('the level is saved when the last answer is given', function() {
  startPlacementTest('words');
  renderPlacementTest();
  while (html().indexOf('placement-result') < 0) {
    var current = rendered[rendered.length - 1];
    current.onAnswer(true, 0);
    if (getTrackLevel('words') === 3) break;
    clickAction('next');
  }
  assert.strictEqual(getTrackLevel('words'), 3);
});

test('a lower retake says the level stays and keeps level 3', function() {
  raiseTrackLevel('words', 3);
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  assert.ok(html().indexOf("You&#39;re already at Advanced; your level stays.") >= 0, html());
  assert.ok(html().indexOf('Your level:') < 0);
  assert.strictEqual(getTrackLevel('words'), 3);
});

test('a first test that places at Beginner keeps level 0 and says so', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  assert.strictEqual(getTrackLevel('words'), 0);
  assert.ok(html().indexOf('already at Beginner; your level stays') >= 0, html());
});

test('the result lists strengths as chips', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  var markup = html();
  assert.ok(markup.indexOf('Strengths') >= 0);
  assert.ok(markup.indexOf('Nouns') >= 0);
  assert.ok(markup.indexOf('To work on') < 0, 'no gaps when everything was right');
});

test('the result lists gaps as chips', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  var markup = html();
  assert.ok(markup.indexOf('To work on') >= 0);
  assert.ok(markup.indexOf('Verbs') >= 0);
  assert.ok(markup.indexOf('Strengths') < 0, 'no strengths when everything was wrong');
});

test('tags without a label of their own are shown once as "Other words"', function() {
  bankTags = ['proper noun', 'exclamation'];
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  assert.strictEqual((html().match(/Other words/g) || []).length, 1);
});

console.log('\nQuitting');

test('quitting after 3 answers leaves level and percentage unchanged, only attempts move', function() {
  recordTrackPercent('words', 12.5);
  startPlacementTest('words');
  renderPlacementTest();
  for (var i = 0; i < 3; i++) answerAndContinue(true);
  assert.ok(html().indexOf('Question 4') >= 0);
  clickAction('quit');
  assert.strictEqual(getTrackLevel('words'), 0);
  assert.strictEqual(getTrackPercent('words'), 12.5);
  assert.strictEqual(nextPlacementAttempt('words'), 1, 'one attempt was counted at start');
});

test('quitting returns to the view the test was started from', function() {
  global.currentView = 'review-center';
  try {
    startPlacementTest('words');
  } finally {
    delete global.currentView;
  }
  calls = [];
  renderPlacementTest();
  clickAction('quit');
  assert.deepStrictEqual(calls, ['switchView:review-center']);
});

test('quitting with no known origin returns to the track list', function() {
  startPlacementTest('words');
  calls = [];
  renderPlacementTest();
  clickAction('quit');
  assert.deepStrictEqual(calls, ['switchView:tracks']);
});

test('after quitting, the view no longer holds the old test', function() {
  startPlacementTest('words');
  renderPlacementTest();
  clickAction('quit');
  rendered = [];
  renderPlacementTest();
  assert.strictEqual(rendered.length, 0);
  assert.ok(html().indexOf('data-action="begin"') >= 0);
});

test('Close on the result screen leaves it', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  calls = [];
  clickAction('quit');
  assert.deepStrictEqual(calls, ['switchView:tracks']);
  assert.strictEqual(getTrackLevel('words'), 3, 'the saved level stays');
});

console.log('\nStart at ...');

test('placed at Beginner: "Start at Foundation lesson 1" opens that lesson', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  assert.ok(html().indexOf('Start at Foundation lesson 1') >= 0, html());
  calls = [];
  clickAction('start-lesson');
  assert.deepStrictEqual(calls, ['goToFoundationLesson:0']);
});

test('placed at Elementary with guided reading: the button opens the first guided surah', function() {
  premiumGuided = true;
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(function(item) { return itemLevel(item) <= 1; });
  assert.strictEqual(getTrackLevel('words'), 1);
  var first = getWordMeaningsLevels()[1].lessons[0];
  assert.ok(html().indexOf('Start at ' + escapeHtml(first.title)) >= 0, html());
  var realSetTimeout = global.setTimeout;
  global.setTimeout = function(fn) { fn(); };
  calls = [];
  try {
    clickAction('start-lesson');
  } finally {
    global.setTimeout = realSetTimeout;
  }
  assert.deepStrictEqual(calls, ['switchView:quran', 'openSurahForReading:' + first.ref]);
});

test('placed at a premium-locked level: the button opens the track path, not the lesson', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  assert.strictEqual(getWordMeaningsLevelLock(3), 'premium');
  calls = [];
  clickAction('start-lesson');
  assert.deepStrictEqual(calls, ['switchView:track:words']);
});

test('placed at Advanced with premium: the button opens the first Advanced item', function() {
  premiumGuided = true;
  premiumExpansion = true;
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allCorrect);
  assert.ok(html().indexOf('Start at Surah study') >= 0, html());
  calls = [];
  clickAction('start-lesson');
  assert.deepStrictEqual(calls, ['switchView:learn']);
});

test('after a lower retake the button starts at the level the learner keeps', function() {
  premiumGuided = true;
  premiumExpansion = true;
  raiseTrackLevel('words', 3);
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  assert.ok(html().indexOf('Start at Surah study') >= 0, html());
});

test('starting a lesson ends the test session', function() {
  startPlacementTest('words');
  renderPlacementTest();
  takeTest(allWrong);
  clickAction('start-lesson');
  rendered = [];
  renderPlacementTest();
  assert.ok(html().indexOf('data-action="begin"') >= 0);
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
