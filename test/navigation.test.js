#!/usr/bin/env node
/**
 * navigation.test.js — Unit tests for the Navigation module
 *
 * Tests: switchView dispatching, lesson navigation, surah navigation,
 * continueLearning, goToRootFamily, goToDifficultyLevel, goToDashboard,
 * populateSurahSelector, validateSurahCoverage, setupOnlineSync,
 * window.__navigateToWord, window.__navigateToWordIndex
 *
 * Run: node test/navigation.test.js
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

var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();
var OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

global.window = { __DEV__: false, __sync: {}, addEventListener: function() {} };
global.document = {
  getElementById: function() { return null; },
  createElement: function(tag) {
    var el = { style: {}, appendChild: function() {}, children: [], _tag: tag, value: '', textContent: '', disabled: false, options: [], remove: function(idx) { if (idx < this.options.length) this.options.splice(idx, 1); }, addEventListener: function() {} };
    return el;
  },
  activeElement: null,
  querySelector: function() { return { style: {} }; },
  addEventListener: function() {},
};
global.console = { log: console.log, warn: function() {}, error: function() {} };

// Mock DOM helper
global.DOM = {
  _cache: {},
  get: function(id) {
    if (!this._cache[id]) {
      this._cache[id] = { style: {}, classList: { add: function() {}, remove: function() {}, contains: function() { return false; } }, textContent: '', value: '', options: [], remove: function(idx) { if (idx < this.options.length) this.options.splice(idx, 1); }, appendChild: function() {}, removeAttribute: function() {}, setAttribute: function() {} };
    }
    return this._cache[id];
  }
};

// Mock globals used by navigation.js
global.setView = function() {};
global.FOUNDATION_MODE = 'foundation';
global.SURAH_INFO = {
  1: { name: 'Al-Fatiha', english: 'The Opening', verses: 7 },
  2: { name: 'Al-Baqarah', english: 'The Cow', verses: 286 },
};
global.ALL_WORDS = [];

// Call log for tracking function calls
var _callLog = [];

// Mock app functions
global.renderDashboard = function() { _callLog.push('renderDashboard'); };
global.updateReviewBanner = function() { _callLog.push('updateReviewBanner'); };
global.updateLessonProgressDisplay = function() { _callLog.push('updateLessonProgressDisplay'); };
global.initQuiz = function() { _callLog.push('initQuiz'); };
global.renderWordList = function() { _callLog.push('renderWordList'); };
global.renderStats = function() { _callLog.push('renderStats'); };
global.renderProfileView = function() { _callLog.push('renderProfileView'); };
global.renderExplorer = function() { _callLog.push('renderExplorer'); };
global.renderAnalytics = function() { _callLog.push('renderAnalytics'); };
global.renderReader = function() { _callLog.push('renderReader'); };
global.updateWordCard = function() { _callLog.push('updateWordCard'); };

global.getFoundationLessonCount = function() { return 5; };
global.getOrganizationMode = function() { return 'lesson'; };
global.setOrganizationMode = function(mode) { _callLog.push('setOrgMode:' + mode); };
global.setActiveSurahId = function(id) { _callLog.push('setActiveSurah:' + id); };
global.isFoundationLessonUnlocked = function(idx) { return idx < 2; };
global.setCurrentFoundationLesson = function(idx) { _callLog.push('setCurrFoundation:' + idx); };
global.getLessonCount = function() { return 16; };
global.isLessonUnlocked = function(idx) { return idx < 8; };
global.setCurrentLesson = function(idx) { _callLog.push('setCurrLesson:' + idx); };
global.getNextIncompleteFoundationLesson = function() { return 2; };
global.getNextIncompleteLesson = function() { return 3; };
global.getSurahsWithVocabulary = function() { return [1, 2]; };
global.getSurahInfo = function(sid) { return global.SURAH_INFO[sid] || null; };
global.getActiveLessonWordCount = function() { return 10; };
global.getActiveLessonWords = function() { return []; };
global.getCanonicalWords = function() { return []; };
global.getCurrentUser = function() { return null; };
global.getRootFamilyLessons = function() { return [{ root: 'كتب', name: 'K-T-B' }]; };
global.getRootFamilyWords = function() { return []; };
global.setCurrentRootFamily = function() {};
global.setCurrentDifficulty = function() {};
global.getCurrentLessonIndex = function() { return 0; };
global.WORDS_PER_LESSON = 10;
global.trapFocus = function() {};
global.releaseFocusTrap = function() {};
global.getCurrentWord = function() { return null; };

// Variables that app.js declares but navigation.js references
var currentWord = 0;
var reviewMode = false;
var activeLessonIndex = 0;

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var navCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'navigation.js'), 'utf8');
eval(navCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    _callLog = [];
    global.window.__validation = null;
    global.window.__diag = null;
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('switchView Dispatching', function() {
  test('switchView calls renderDashboard for dashboard', function() {
    switchView('dashboard');
    assert.ok(_callLog.indexOf('renderDashboard') >= 0, 'renderDashboard not called');
  });

  test('switchView calls initQuiz for quiz', function() {
    switchView('quiz');
    assert.ok(_callLog.indexOf('initQuiz') >= 0);
  });

  test('switchView calls renderWordList for list', function() {
    switchView('list');
    assert.ok(_callLog.indexOf('renderWordList') >= 0);
  });

  test('switchView calls renderStats for stats', function() {
    switchView('stats');
    assert.ok(_callLog.indexOf('renderStats') >= 0);
  });

  test('switchView calls renderProfileView for profile', function() {
    switchView('profile');
    assert.ok(_callLog.indexOf('renderProfileView') >= 0);
  });

  test('switchView calls renderExplorer for explorer', function() {
    switchView('explorer');
    assert.ok(_callLog.indexOf('renderExplorer') >= 0);
  });

  test('switchView calls renderAnalytics for analytics', function() {
    switchView('analytics');
    assert.ok(_callLog.indexOf('renderAnalytics') >= 0);
  });

  test('switchView calls renderReader for reader', function() {
    switchView('reader');
    assert.ok(_callLog.indexOf('renderReader') >= 0);
  });

  test('switchView calls learn view updaters', function() {
    switchView('learn');
    assert.ok(_callLog.indexOf('updateReviewBanner') >= 0);
    assert.ok(_callLog.indexOf('updateLessonProgressDisplay') >= 0);
  });

  test('switchView calls validation hook if present', function() {
    var called = false;
    global.window.__validation = { onRouteChange: function() { called = true; } };
    switchView('dashboard');
    assert.ok(called);
  });
});

suite('Foundation Lesson Navigation', function() {
  test('goToFoundationLesson ignores invalid negative index', function() {
    goToFoundationLesson(-1);
    // No setOrgMode should be called
    assert.strictEqual(_callLog.filter(function(c) { return c.indexOf('setOrgMode') >= 0; }).length, 0);
  });

  test('goToFoundationLesson ignores out-of-range index', function() {
    goToFoundationLesson(10); // beyond getFoundationLessonCount
    assert.strictEqual(_callLog.filter(function(c) { return c.indexOf('setOrgMode') >= 0; }).length, 0);
  });

  test('goToFoundationLesson sets foundation mode', function() {
    goToFoundationLesson(0);
    assert.ok(_callLog.indexOf('setOrgMode:foundation') >= 0);
    assert.ok(_callLog.indexOf('setActiveSurah:null') >= 0);
    assert.ok(_callLog.indexOf('setCurrFoundation:0') >= 0);
  });
});

suite('Surah Navigation', function() {
  test('goToSurah ignores non-existent surah', function() {
    goToSurah(999);
    assert.strictEqual(_callLog.filter(function(c) { return c.indexOf('setOrgMode') >= 0; }).length, 0);
  });

  test('goToSurah sets surah mode and navigates', function() {
    goToSurah(1);
    assert.ok(_callLog.indexOf('setOrgMode:surah') >= 0);
    assert.ok(_callLog.indexOf('setActiveSurah:1') >= 0);
  });
});

suite('Standard Lesson Navigation', function() {
  test('goToLesson ignores invalid lesson index', function() {
    goToLesson(-1);
    assert.strictEqual(_callLog.filter(function(c) { return c.indexOf('setOrgMode') >= 0; }).length, 0);
  });

  test('goToLesson sets current lesson and navigates', function() {
    // First switch to surah mode so lesson mode is not active
    global.getOrganizationMode = function() { return 'surah'; };
    goToLesson(0);
    assert.ok(_callLog.indexOf('setOrgMode:lesson') >= 0, 'should set lesson mode');
    assert.ok(_callLog.indexOf('setActiveSurah:null') >= 0, 'should clear active surah');
    assert.ok(_callLog.indexOf('setCurrLesson:0') >= 0, 'should set current lesson');
    global.getOrganizationMode = function() { return 'lesson'; };
  });

  test('goToLessonMode switches back to lesson', function() {
    goToLessonMode();
    assert.ok(_callLog.indexOf('setOrgMode:lesson') >= 0);
  });
});

suite('Continue Learning', function() {
  test('continueLearning uses next incomplete lesson', function() {
    continueLearning();
    assert.ok(_callLog.indexOf('setCurrLesson:3') >= 0);
  });
});

suite('Root Family Navigation', function() {
  test('goToRootFamily with null root uses first family', function() {
    goToRootFamily(null);
    assert.ok(_callLog.indexOf('setOrgMode:root-family') >= 0);
  });

  test('goToRootFamily with specific root', function() {
    goToRootFamily('كتب');
    assert.ok(_callLog.indexOf('setOrgMode:root-family') >= 0);
  });
});

suite('Difficulty Level Navigation', function() {
  test('goToDifficultyLevel clamps too-low level', function() {
    goToDifficultyLevel(0);
    assert.ok(_callLog.indexOf('setOrgMode:difficulty') >= 0);
  });

  test('goToDifficultyLevel clamps too-high level', function() {
    goToDifficultyLevel(10);
    assert.ok(_callLog.indexOf('setOrgMode:difficulty') >= 0);
  });

  test('goToDifficultyLevel accepts valid level', function() {
    goToDifficultyLevel(3);
    assert.ok(_callLog.indexOf('setOrgMode:difficulty') >= 0);
  });
});

suite('goToDashboard', function() {
  test('goToDashboard switches to dashboard view', function() {
    goToDashboard();
    // Should call switchView('dashboard') → renderDashboard
    assert.ok(_callLog.indexOf('renderDashboard') >= 0);
  });
});

suite('Surah Selector', function() {
  test('populateSurahSelector uses DOM.get for select element', function() {
    var selectMock = {
      options: [],
      remove: function(idx) { if (idx < this.options.length) this.options.splice(idx, 1); },
      appendChild: function(opt) { this.options.push(opt); },
    };
    DOM._cache['surah-select'] = selectMock;
    populateSurahSelector();
    assert.ok(selectMock.options.length >= 6, 'should have at least 6 options, got ' + selectMock.options.length);
    delete DOM._cache['surah-select'];
  });

  test('populateSurahSelector returns early if no select', function() {
    populateSurahSelector();
  });
});

suite('Surah Coverage Validation', function() {
  test('validateSurahCoverage warns if no words loaded', function() {
    global.ALL_WORDS = [];
    var warned = false;
    global.console.warn = function(msg) { warned = true; };
    validateSurahCoverage();
    assert.ok(warned);
    global.console.warn = function() {};
  });

  test('validateSurahCoverage warns if too few surahs', function() {
    global.ALL_WORDS = [{ id: 'w1' }];
    global.getSurahsWithVocabulary = function() { return [1, 2]; };
    var warned = false;
    global.console.warn = function(msg) { warned = true; };
    validateSurahCoverage();
    assert.ok(warned);
    global.getSurahsWithVocabulary = function() { return [1, 2]; };
    global.console.warn = function() {};
  });

  test('validateSurahCoverage handles missing mid surahs', function() {
    global.ALL_WORDS = [{ id: 'w1' }];
    global.getSurahsWithVocabulary = function() { return [1, 2, 3]; };
    validateSurahCoverage();
    global.getSurahsWithVocabulary = function() { return [1, 2]; };
  });
});

suite('Online Sync', function() {
  test('setupOnlineSync adds online event listener', function() {
    var added = false;
    global.window.addEventListener = function(event, handler) {
      if (event === 'online') added = true;
    };
    setupOnlineSync();
    assert.ok(added);
    global.window.addEventListener = function() {};
  });
});

suite('Window Bridge', function() {
  test('window.__navigateToWordIndex handles zero word count', function() {
    global.getActiveLessonWordCount = function() { return 0; };
    window.__navigateToWordIndex(5);
    global.getActiveLessonWordCount = function() { return 10; };
  });

  test('window.__navigateToWord handles null input', function() {
    window.__navigateToWord(null);
    window.__navigateToWord(undefined);
  });

  test('window.__getCurrentWord is set', function() {
    assert.ok(typeof window.__getCurrentWord === 'function');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
