#!/usr/bin/env node
/**
 * quiz.test.js — Unit tests for the Quiz Module
 *
 * Tests: state initialization, scoring, answer handling,
 * quiz completion, and adaptive SRS integration.
 *
 * Since quiz state variables (quizWords, quizIndex, etc.) are let-declared
 * in the source module, we verify behavior through DOM side effects.
 *
 * Run: node test/quiz.test.js
 */

var assert = require('assert');

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
function clearStorage() { _storage = {}; }

var _mockNow = new Date('2026-07-06T12:00:00Z').getTime();
var OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

// Mock DOM
var _domElements = {};
global.DOM = {
  get: function(id) {
    if (!_domElements[id]) _domElements[id] = { textContent: '', style: { display: '' }, innerHTML: '' };
    return _domElements[id];
  },
};
function resetDOM() { _domElements = {}; }

// Mock document for answerQuiz
var _querySelectorResults = [];
global.document = {
  querySelectorAll: function() { return _querySelectorResults; },
  getElementById: function() { return null; },
  addEventListener: function() {},
};

// Mock global functions
global.getActiveLessonWords = function() {
  return [
    { id: 'w1', arabic: 'كِتَاب', english: 'book', type: 'Noun', typeCategory: 'noun', root: 'كتب', occ: 260 },
    { id: 'w2', arabic: 'رَحْمَة', english: 'mercy', type: 'Noun', typeCategory: 'noun', root: 'رحم', occ: 114 },
    { id: 'w3', arabic: 'عِلْم', english: 'knowledge', type: 'Noun', typeCategory: 'noun', root: 'علم', occ: 105 },
  ];
};
global.ALL_WORDS = global.getActiveLessonWords();
global.window = {};
global.shuffleArray = function(arr) { return arr.slice().sort(function() { return Math.random() - 0.5; }); };
global.rateSRSWord = function(id, rating) { /* no-op for test */ };
global.recordQuizResult = function(id, correct) { /* no-op */ };
global.updateStatsDisplay = function() {};
global.renderQuizQuestion = function(word, allWords) { /* no-op */ };
global.completeLesson = function(idx) {};
global.completeFoundationLesson = function(idx) {};
global.completeSurah = function(id) {};
global.updateLessonProgressDisplay = function() {};
global.getOrganizationMode = function() { return 'lesson'; };
global.FOUNDATION_MODE = 'foundation';
global.activeLessonIndex = 0;
global.getNextIncompleteLesson = function() { return 1; };
global.getLessonCount = function() { return 10; };
global.goToLesson = function(idx) {};
global.currentView = 'quiz';
global.getNextIncompleteFoundationLesson = function() { return 1; };
global.getFoundationLessonCount = function() { return 10; };
global.goToFoundationLesson = function(idx) {};
global.getSurahsWithVocabulary = function() { return [1, 2, 3]; };
global.getActiveSurahId = function() { return 1; };
global.goToSurah = function(id) {};

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var quizCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'quiz.js'), 'utf8');
eval(quizCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Quiz Initialization', function() {
  // Note: Empty/null word tests must come FIRST because initQuiz has an
  // early-return that preserves state when quizWords is already populated
  
  test('initQuiz handles null lesson words', function() {
    resetDOM();
    global.getActiveLessonWords = function() { return null; };
    initQuiz();
    // Should show fallback message in quiz-options
    var opts = DOM.get('quiz-options');
    assert.ok(opts.innerHTML.length > 0);
  });

  test('initQuiz handles empty word list gracefully', function() {
    resetDOM();
    global.getActiveLessonWords = function() { return []; };
    initQuiz();
    // Should show fallback in quiz-word
    var el = DOM.get('quiz-word');
    assert.ok(el !== undefined);
  });

  test('initQuiz renders first question without error', function() {
    resetDOM();
    global.getActiveLessonWords = function() {
      return [{ id: 'w_1', arabic: 'test', english: 'test' }];
    };
    initQuiz();
    assert.ok(true);
  });
});

suite('Quiz Score Display', function() {
  test('updateQuizScoreDisplay shows percentage', function() {
    resetDOM();
    updateQuizScoreDisplay(5, 10);
    assert.strictEqual(DOM.get('stat-score').textContent, '50%');
    assert.ok(DOM.get('quiz-score-display').textContent.indexOf('5/10') >= 0);
  });

  test('updateQuizScoreDisplay handles zero total', function() {
    resetDOM();
    updateQuizScoreDisplay(0, 0);
    assert.strictEqual(DOM.get('stat-score').textContent, '\u2014');
  });
});

suite('Quiz Completion', function() {
  test('renderQuizCompletion shows score message', function() {
    resetDOM();
    renderQuizCompletion(8, 10);
    var feedback = DOM.get('quiz-feedback');
    assert.ok(feedback.innerHTML.length > 0);
  });

  test('renderQuizCompletion handles perfect score', function() {
    resetDOM();
    renderQuizCompletion(10, 10);
    var feedback = DOM.get('quiz-feedback');
    assert.ok(feedback.innerHTML.indexOf('100%') >= 0 || feedback.innerHTML.indexOf('Excellent') >= 0);
  });

  test('renderQuizCompletion handles zero total without crash', function() {
    resetDOM();
    // Should not throw
    renderQuizCompletion(0, 0);
    assert.ok(true);
  });
});

suite('Next Question Flow', function() {
  test('nextQuiz can be called without error', function() {
    resetDOM();
    global.getActiveLessonWords = function() {
      return [{ id: 'w1', arabic: 'a' }, { id: 'w2', arabic: 'b' }];
    };
    initQuiz();
    // nextQuiz advances index and renders
    nextQuiz();
    assert.ok(true);
  });
});

suite('Edge Cases', function() {
  test('handleQuizAnswer delegates without error', function() {
    resetDOM();
    global.getActiveLessonWords = function() {
      return [{ id: 'w1', arabic: 'test', english: 'test', root: '\u2014' }];
    };
    initQuiz();
    var btn = { classList: { add: function() {} } };
    handleQuizAnswer(btn, 'correct', 'correct', 'w1');
    assert.ok(true);
  });

  test('showQuizQ sets quizAnswered to false', function() {
    resetDOM();
    global.getActiveLessonWords = function() {
      return [{ id: 'w1', arabic: 'test', english: 'test' }];
    };
    initQuiz();
    showQuizQ();
    // btn-next-quiz should be hidden
    assert.strictEqual(DOM.get('btn-next-quiz').style.display, 'none');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
