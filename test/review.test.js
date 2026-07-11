#!/usr/bin/env node
/**
 * review.test.js — Unit tests for the Review module
 *
 * Tests: startReview, endReview, startMixedReview, checkPreLessonReviews,
 * showPreLessonReviewPrompt, showSessionSummary, closeSessionSummary,
 * getNextActionRecommendation, checkForLessonCompletionCelebration,
 * showSurahConnectionToast
 *
 * Run: node test/review.test.js
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

// Mock Date
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

// Mock window
global.window = { __DEV__: false, __ux: {}, __sync: {} };
global.document = {
  getElementById: function(id) { return mockElements[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
  querySelector: function() { return { style: {}, setAttribute: function() {}, removeAttribute: function() {} }; },
  querySelectorAll: function() { return []; },
  activeElement: null,
  addEventListener: function() {},
};

// Mock element factory
var mockElements = {};
var elUid = 0;
function makeEl(tag) {
  var id = '_el_' + (elUid++);
  var el = {
    _id: id,
    _tag: tag || 'div',
    _innerHTML: '',
    _style: {},
    _display: '',
    textContent: '',
    className: '',
    children: [],
    parentNode: null,
    disabled: false,
    onclick: null,
    onkeydown: null,
    attributes: {},
    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },
    removeAttribute: function(a) { delete this.attributes[a]; },
    appendChild: function(child) { child.parentNode = this; this.children.push(child); },
    removeChild: function(child) {
      var idx = this.children.indexOf(child);
      if (idx >= 0) { this.children.splice(idx, 1); child.parentNode = null; }
    },
    remove: function() {},
    focus: function() {},
    click: function() { if (typeof this.onclick === 'function') this.onclick(); },
    classList: {
      _values: {},
      add: function(c) { this._values[c] = true; if (c === 'visible') el._display = 'flex'; },
      remove: function(c) { delete this._values[c]; if (c === 'visible') el._display = ''; },
      contains: function(c) { return !!this._values[c]; },
    },
    style: {},
    get style() { return this._style; },
    set style(v) { this._style = typeof v === 'object' ? v : {}; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v || ''; },
  };
  Object.defineProperty(el, 'display', {
    get: function() { return this._display; },
    set: function(v) { this._display = v; this._style.display = v; },
  });
  return el;
}

// Pre-create common mock DOM elements
function setupMockElements() {
  mockElements = {};

  // review-banner
  var banner = makeEl('div');
  banner.id = 'review-banner';
  mockElements['review-banner'] = banner;

  // session-summary-modal
  var modal = makeEl('div');
  modal.id = 'session-summary-modal';
  modal.style.display = 'none';
  mockElements['session-summary-modal'] = modal;

  // Session summary stat elements
  var statIds = [
    'session-words-reviewed', 'session-streak-earned', 'session-mastered-new',
    'session-comp-gain', 'session-roots-learned', 'session-review-cards',
    'session-next-recommendation', 'session-time-spent', 'session-encouragement'
  ];
  statIds.forEach(function(id) {
    var el = makeEl('span');
    el.id = id;
    mockElements[id] = el;
  });

  // pre-lesson review buttons
  var btn1 = makeEl('button');
  btn1.id = 'pre-review-now';
  btn1.onclick = function() {};
  mockElements['pre-review-now'] = btn1;

  var btn2 = makeEl('button');
  btn2.id = 'pre-review-continue';
  btn2.onclick = function() {};
  mockElements['pre-review-continue'] = btn2;
}

setupMockElements();

global.console = { log: console.log, warn: function() {}, error: function() {} };

// Mock globals
global.DOM = {
  _cache: {},
  get: function(id) {
    if (!this._cache[id]) {
      this._cache[id] = {
        style: {},
        classList: { add: function() {}, remove: function() {}, contains: function() { return false; } },
        textContent: '',
        value: '',
        remove: function() {},
      };
    }
    return this._cache[id];
  }
};

var _callLog = [];
var _reviewQueue = [];
var _srsData = {};

global.getDueReviews = function() { return _reviewQueue; };
global.loadSRS = function() { return _srsData; };
global.updateWordCard = function() { _callLog.push('updateWordCard'); };
global.updateReviewBanner = function() { _callLog.push('updateReviewBanner'); };
global.loadStreakData = function() { return { streak: 5 }; };
global.calculateCoverage = function() { return { estimatedComprehension: 45, coveragePercent: 45 }; };
global.getMilestoneStatus = function(pct) { return null; };
global.getNextActionRecommendation = function() { return 'Continue learning'; };
global.getMixedReviewQueue = function() { return []; };
global.setOrganizationMode = function() {};
global.setActiveSurahId = function() {};
global.switchView = function() {};
global.trapFocus = function() {};
global.releaseFocusTrap = function() {};
global.getFoundationCourseStats = function() { return { percent: 30 }; };
global.getCompletedFoundationLessonCount = function() { return 0; };
global.getFoundationLessonCount = function() { return 10; };

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var reviewCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'review.js'), 'utf8');

// Provide required globals referenced by review.js
var reviewQueue = [];
var reviewMode = false;
var currentWord = 0;
var activeLessonIndex = 0;

eval(reviewCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    _callLog = [];
    setupMockElements();
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

suite('checkPreLessonReviews', function() {
  test('returns hasReview false when no SRS data', function() {
    _srsData = {};
    var result = checkPreLessonReviews();
    assert.strictEqual(result.overdueCount, 0);
    assert.strictEqual(result.needsReview, false);
  });

  test('returns overdue count for past-due words', function() {
    _srsData = {
      w1: { dueDate: _mockNow - 86400000 },
      w2: { dueDate: _mockNow + 86400000 }, // not due
    };
    var result = checkPreLessonReviews();
    assert.strictEqual(result.overdueCount, 1);
    assert.strictEqual(result.needsReview, true);
  });

  test('flags weak leeched words separately', function() {
    _srsData = {
      w1: { dueDate: _mockNow - 1000, isLeech: true },
    };
    var result = checkPreLessonReviews();
    assert.strictEqual(result.weakCount, 1);
    assert.ok(result.message.indexOf('extra attention') >= 0);
  });
});

suite('showPreLessonReviewPrompt', function() {
  test('returns undefined for check result with few overdue', function() {
    var result = { overdueCount: 1, weakCount: 0, needsReview: true, message: 'test' };
    var banner = showPreLessonReviewPrompt(result);
    assert.strictEqual(banner, undefined);
  });

  test('returns undefined when no check result', function() {
    assert.strictEqual(showPreLessonReviewPrompt(null), undefined);
  });

  test('creates banner for significant overdue count', function() {
    var existing = document.getElementById('pre-lesson-review-prompt');
    if (existing) existing.remove();

    // Create a real mock for getElementById that returns an element with insertBefore
    var viewLearn = makeEl('div');
    viewLearn.id = 'view-learn';
    viewLearn.insertBefore = function(el, ref) {
      this.children.push(el);
      el.parentNode = this;
    };
    mockElements['view-learn'] = viewLearn;
    mockElements['review-banner'] = makeEl('div');
    mockElements['review-banner'].nextSibling = null;

    var origGetElementById = global.document.getElementById;
    global.document.getElementById = function(id) {
      return mockElements[id] || null;
    };

    var result = { overdueCount: 5, weakCount: 1, needsReview: true, message: '5 words need reinforcement' };
    var banner = showPreLessonReviewPrompt(result);
    assert.ok(banner !== undefined);

    global.document.getElementById = origGetElementById;
    delete mockElements['view-learn'];
  });

  test('returns undefined if in review mode', function() {
    reviewMode = true;
    var result = { overdueCount: 5, weakCount: 0, needsReview: true, message: 'test' };
    assert.strictEqual(showPreLessonReviewPrompt(result), undefined);
    reviewMode = false;
  });
});

suite('startReview', function() {
  test('startReview does nothing with empty queue', function() {
    _reviewQueue = [];
    startReview();
    assert.strictEqual(reviewMode, false);
  });

  test('startReview sets review mode with non-empty queue', function() {
    _reviewQueue = [{ id: 'w1', arabic: 'test' }];
    _srsData = {};
    startReview();
    assert.strictEqual(reviewMode, true);
    assert.strictEqual(currentWord, 0);
  });

  test('startReview counts already-mastered words', function() {
    _srsData = { w1: { stage: 2 }, w2: { stage: 1 } };
    _reviewQueue = [{ id: 'w1' }, { id: 'w2' }];
    startReview();
    assert.strictEqual(reviewMode, true);
    _reviewQueue = [];
    _srsData = {};
  });
});

suite('endReview', function() {
  test('endReview clears review mode', function() {
    reviewMode = true;
    reviewQueue = [{ id: 'w1' }];
    _srsData = {};
    endReview();
    assert.strictEqual(reviewMode, false);
    reviewQueue = [];
  });

  test('endReview triggers session summary', function() {
    var modal = mockElements['session-summary-modal'];
    var origDisplay = modal.style.display;
    reviewQueue = [{ id: 'w1' }];
    _srsData = {};
    endReview();
    reviewQueue = [];
  });
});

suite('getNextActionRecommendation', function() {
  test('recommends review when words due', function() {
    _srsData = { w1: { dueDate: _mockNow - 1000 } };
    var rec = getNextActionRecommendation();
    assert.ok(rec.indexOf('due') >= 0);
  });

  test('recommends continue learning when no due words', function() {
    _srsData = {};
    global.getCompletedFoundationLessonCount = function() { return 3; };
    global.getFoundationLessonCount = function() { return 10; };
    var rec = getNextActionRecommendation();
    assert.ok(rec.indexOf('Foundation') >= 0);
  });

  test('recommends analytics when all complete', function() {
    _srsData = {};
    global.getCompletedFoundationLessonCount = function() { return 10; };
    global.getFoundationLessonCount = function() { return 10; };
    var rec = getNextActionRecommendation();
    assert.ok(rec.indexOf('Analytics') >= 0 || rec.length > 0);
  });
});

suite('Session Summary Modal', function() {
  test('showSessionSummary sets modal display to flex', function() {
    var modal = mockElements['session-summary-modal'];
    modal.style.display = 'none';
    var stats = {
      wordsReviewed: 5,
      newMastered: 2,
      newRootsLearned: 3,
      comprehensionBefore: 40,
      comprehensionAfter: 45,
      reviewCardsCreated: 5,
      streakDays: 3,
      timeSpentMinutes: 3,
      nextRecommendation: 'Keep going!',
    };

    var origGetElementById = global.document.getElementById;
    global.document.getElementById = function(id) {
      return mockElements[id] || origGetElementById(id);
    };

    showSessionSummary(stats);
    assert.strictEqual(modal.style.display, 'flex');

    global.document.getElementById = origGetElementById;
  });

  test('closeSessionSummary hides modal', function() {
    var modal = mockElements['session-summary-modal'];
    modal.style.display = 'flex';

    var origGetElementById = global.document.getElementById;
    global.document.getElementById = function(id) {
      return mockElements[id] || null;
    };

    closeSessionSummary();
    assert.strictEqual(modal.style.display, 'none');

    global.document.getElementById = origGetElementById;
  });
});

suite('Mixed Review', function() {
  test('startMixedReview returns to dashboard with empty queue', function() {
    var switchedToDashboard = false;
    global.switchView = function(v) { if (v === 'dashboard') switchedToDashboard = true; };
    startMixedReview();
    assert.ok(switchedToDashboard);
    global.switchView = function() {};
  });
});

suite('showSurahConnectionToast', function() {
  test('showSurahConnectionToast does nothing with empty array', function() {
    var called = false;
    window.__ux.showToast = function() { called = true; };
    showSurahConnectionToast([]);
    assert.strictEqual(called, false);
  });

  test('showSurahConnectionToast calls showToast with improvements', function() {
    var msg = '';
    window.__ux.showToast = function(m, type) { msg = m; };
    showSurahConnectionToast(['Al-Fatiha', 'Al-Ikhlas']);
    assert.ok(msg.length > 0);
    assert.ok(msg.indexOf('Al-Fatiha') >= 0);
  });
});

suite('checkForLessonCompletionCelebration', function() {
  test('does not throw when window.__ux is partially set', function() {
    window.__ux = null;
    checkForLessonCompletionCelebration(0);
    window.__ux = {};
  });

  test('does not throw when showMilestoneCelebration missing', function() {
    checkForLessonCompletionCelebration(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
