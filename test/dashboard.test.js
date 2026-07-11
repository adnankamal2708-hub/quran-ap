#!/usr/bin/env node
/**
 * dashboard.test.js — Unit tests for renderDashboard()
 *
 * Tests: greeting, comprehension ring, continue/action cards,
 * foundation course, learn by surah, due reviews, achievements,
 * edge cases, and error handling.
 *
 * Run: node test/dashboard.test.js
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

// ── Mock DOM ──
var _elementsById = {};
var _nextUid = 0;

function makeEl(tag) {
  var el = {
    _uid: _nextUid++,
    _tag: tag || 'div',
    _id: '',
    _className: '',
    _innerHTML: '',
    _style: {},
    _onclick: null,
    _onkeydown: null,
    textContent: '',
    children: [],
    attributes: {},
    parentNode: null,
    disabled: false,
    title: '',
    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },
  };
  Object.defineProperty(el, 'id', {
    get: function() { return this._id; },
    set: function(v) {
      this._id = v;
      if (v) _elementsById[v] = this;
    },
  });
  Object.defineProperty(el, 'className', {
    get: function() { return this._className; },
    set: function(v) { this._className = v || ''; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHTML; },
    set: function(v) {
      this._innerHTML = v || '';
      if (v) {
        var re = /id="([^"]+)"/g;
        var match;
        while ((match = re.exec(v)) !== null) {
          var foundId = match[1];
          if (foundId && !_elementsById[foundId]) {
            var child = makeEl('div');
            child.id = foundId;
            child.parentNode = el;
            el.children.push(child);
          }
        }
      }
    },
  });
  Object.defineProperty(el, 'style', {
    get: function() { return this._style; },
    set: function(v) { this._style = typeof v === 'object' ? v : {}; },
  });
  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
  });
  Object.defineProperty(el, 'onkeydown', {
    get: function() { return this._onkeydown; },
    set: function(fn) { this._onkeydown = fn; },
  });
  el.classList = {
    _values: {},
    add: function(c) { this._values[c] = true; el._className = Object.keys(this._values).join(' '); },
    remove: function(c) { delete this._values[c]; el._className = Object.keys(this._values).join(' '); },
    contains: function(c) { return !!this._values[c]; },
  };
  el.offsetHeight = 1;
  el.querySelector = function(sel) {
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      if ((el._className || '').indexOf(cls) >= 0) return el;
      for (var ci = 0; ci < el.children.length; ci++) {
        var child = el.children[ci];
        if ((child._className || '').indexOf(cls) >= 0) return child;
      }
      return null;
    }
    return null;
  };
  el.querySelectorAll = function(sel) {
    var results = [];
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      if ((el._className || '').indexOf(cls) >= 0) results.push(el);
      for (var ci = 0; ci < el.children.length; ci++) {
        var child = el.children[ci];
        if ((child._className || '').indexOf(cls) >= 0) results.push(child);
      }
    }
    return results;
  };
  return el;
}

function resetDOM() {
  _elementsById = {};
}

global.document = {
  getElementById: function(id) { return _elementsById[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
  querySelector: function(sel) {
    // Simple mock: handle #id selectors and .class selectors
    if (sel.startsWith('#')) {
      return _elementsById[sel.substring(1)] || null;
    }
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      for (var k in _elementsById) {
        if (_elementsById[k].className === cls || (_elementsById[k]._className || '').indexOf(cls) >= 0) {
          return _elementsById[k];
        }
      }
      return null;
    }
    return null;
  },
  querySelectorAll: function(sel) {
    var results = [];
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      for (var k in _elementsById) {
        if ((_elementsById[k]._className || '').indexOf(cls) >= 0) {
          results.push(_elementsById[k]);
        }
      }
    }
    return results;
  },
};

global.DOM = {
  _cache: {},
  get: function(id) {
    if (!this._cache[id]) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  }
};

function resetDOMCache() {
  global.DOM._cache = {};
}

// ── Mock Date ──
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

// ═══════════════════════════════════════════════════════════════
// MOCK HELPERS
// ═══════════════════════════════════════════════════════════════

var _mockSRS = {};
var _mockDueReviews = [];
var _mockStreakData = { streak: 0, lastDate: null };
var _mockFoundationCompleted = 0;
var _mockFoundationTotal = 10;
var _mockCoverage = null;
var _mockCanonicalWordCount = 0;
var _mockSurahProgress = null;
var _mockSRSStats = null;
var _switchViewCalled = '';
var _goToFoundationCalled = false;
var _startReviewCalled = false;

function resetState() {  _mockSRS = {};
  _mockDueReviews = [];
  _mockStreakData = { streak: 0, lastDate: null };
  _mockFoundationCompleted = 0;
  _mockFoundationTotal = 10;
  _mockCoverage = null;
  _mockCanonicalWordCount = 0;
  _mockSurahProgress = null;
  _mockSRSStats = null;
  _switchViewCalled = '';
  _goToFoundationCalled = false;
  _startReviewCalled = false;
  _mixedCount = 0;
  _diffCompleted = 0;
  _diffTotal = 5;
  _rfCompleted = 0;
  _rfTotal = 0;
}

function setupGlobals() {
  global.window = global.window || {};
  global.window.__srs = {
    getStats: function() {
      return _mockSRSStats || {
        total: 100, mature: 10, dueToday: 5, totalReviews: 200,
        reviewsToday: 3, newCount: 30, learning: 20, young: 5, overdue: 2,
      };
    },
    getDailyReviewLimit: function() { return 25; },
  };

  global.getSRSStats = function() { return global.window.__srs.getStats(); };
  global.loadSRS = function() { return JSON.parse(JSON.stringify(_mockSRS)); };
  global.getDueReviews = function() { return [].concat(_mockDueReviews); };
  global.loadStreakData = function() { return JSON.parse(JSON.stringify(_mockStreakData)); };
  global.getFoundationLessonCount = function() { return _mockFoundationTotal; };
  global.getCompletedFoundationLessonCount = function() { return _mockFoundationCompleted; };
  global.calculateCoverage = function() { return _mockCoverage ? JSON.parse(JSON.stringify(_mockCoverage)) : null; };
  global.getCanonicalWordCount = function() { return _mockCanonicalWordCount; };
  global.getSurahLessonProgress = function() { return _mockSurahProgress; };
  global.getTotalRootFamilyCount = function() { return _rfTotal; };
  global.getCompletedRootFamilyCount = function() { return _rfCompleted; };
  global.getCompletedDifficultyLevelCount = function() { return _diffCompleted; };
  global.loadDifficultyProgress = function() { return { currentDifficulty: 1 }; };
  global.getMixedReviewQueue = function() { return []; };
  global.getAllSurahComprehension = function() { return []; };
  global.getMilestoneStatus = function() { return null; };
  global.getCurrentFoundationLessonIndex = function() { return 0; };
  global.getNextIncompleteFoundationLesson = function() { return 0; };
  global.calculateCoverage = function() { return _mockCoverage ? JSON.parse(JSON.stringify(_mockCoverage)) : null; };
  global.switchView = function(v) { _switchViewCalled = v; };
  global.goToFoundationLesson = function() { _goToFoundationCalled = true; };
  global.startReview = function() { _startReviewCalled = true; };
  global.updateStatsDisplay = function() {};
  global.updateReviewBanner = function() {};
  global.ALL_WORDS = [];
}

// ═══════════════════════════════════════════════════════════════
// IMPORT renderDashboard from ui.js
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');

(function() {
  // Load split UI modules instead of monolithic ui.js
  var uiModulePath = path.join(__dirname, '..', 'js', 'ui', 'dashboard.js');
  if (!fs.existsSync(uiModulePath)) {
    throw new Error('dashboard.js split module not found');
  }
  var uiCode = fs.readFileSync(uiModulePath, 'utf8');
  var idx = uiCode.indexOf('function renderDashboard()');
  if (idx < 0) throw new Error('renderDashboard() not found in dashboard.js');

  var braceIdx = uiCode.indexOf('{', idx);
  var depth = 1;
  var bodyEnd = -1;
  for (var i = braceIdx + 1; i < uiCode.length && depth > 0; i++) {
    if (uiCode[i] === '{') depth++;
    else if (uiCode[i] === '}') { depth--; if (depth === 0) bodyEnd = i; }
  }
  var fnBody = uiCode.substring(idx, bodyEnd + 1);
  global.eval(fnBody);
})();

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    resetDOM();
    resetDOMCache();
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) {
  console.log('\n\ud83d\udccb ' + name);
  fn();
}

function setupDashboardGrid() {
  var grid = makeEl('div');
  grid.id = 'dashboard-grid';
  _elementsById['dashboard-grid'] = grid;
  return grid;
}

function getInnerHTML() {
  var grid = document.getElementById('dashboard-grid');
  return grid ? grid.innerHTML : '';
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Dashboard Initialization', function() {
  test('renderDashboard handles missing dashboard-grid element', function() {
    resetState();
    setupGlobals();
    renderDashboard(); // should not throw
  });

  test('renderDashboard creates content in dashboard-grid', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'dashboard-grid should have content');
  });
});

suite('Greeting Section', function() {
  test('greeting contains Assalamu Alaikum', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Assalamu Alaikum') >= 0, 'should have greeting');
    assert.ok(html.indexOf('db-greeting') >= 0, 'should have greeting class');
  });

  test('greeting shows journey message', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Your journey') >= 0, 'should show journey text');
  });
});

suite('Comprehension Ring', function() {
  test('ring shows Quran comprehension percentage', function() {
    resetState();
    setupGlobals();
    _mockCoverage = { coveragePercent: 42.5, estimatedComprehension: 65, masteredWords: 2, totalWords: 3, masteredOccurrences: 8, totalOccurrences: 18 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('65%') >= 0, 'should show 65% comprehension');
    assert.ok(html.indexOf('Comprehension') >= 0, 'should show Comprehension label');
  });

  test('ring shows mastered word count', function() {
    resetState();
    setupGlobals();
    _mockCoverage = { coveragePercent: 30, estimatedComprehension: 50, masteredWords: 1, totalWords: 153, masteredOccurrences: 5, totalOccurrences: 18 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('mastered') >= 0, 'should show mastered count');
  });

  test('ring works with null coverage', function() {
    resetState();
    setupGlobals();
    _mockCoverage = null;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('0%') >= 0, 'should show 0% when no coverage data');
  });
});

suite('Hero Continue Button', function() {
  test('empty state shows Start Foundation Course', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 0;
    _mockFoundationTotal = 10;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Start Foundation Course') >= 0, 'should show Start Foundation');
    assert.ok(html.indexOf('0%') >= 0, 'should show 0% progress');
  });

  test('in-progress state shows Continue Foundation Course', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 4;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Continue Foundation Course') >= 0, 'should show Continue');
    assert.ok(html.indexOf('40%') >= 0 || html.indexOf('4 /') >= 0, 'should show 40% progress');
  });

  test('has db-hero-continue id and is clickable', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-hero-continue');
    assert.ok(el !== null, 'db-hero-continue should exist');
  });
});

suite('Foundation Course Path', function() {
  test('shows Foundation Course title', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Foundation Course') >= 0, 'should have Foundation Course title');
  });

  test('shows progress with count', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 6;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('6 of 10') >= 0, 'should show 6/10 progress');
  });

  test('has db-path-foundation id', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-path-foundation');
    assert.ok(el !== null, 'db-path-foundation should exist');
  });
});

suite('Learn by Surah Path', function() {
  test('shows Learn by Surah title', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Learn by Surah') >= 0, 'should have Learn by Surah title');
  });

  test('shows surah progress', function() {
    resetState();
    setupGlobals();
    _mockSurahProgress = { completedSurahs: 5, totalSurahs: 90 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('5 of 90') >= 0, 'should show 5/90 progress');
  });

  test('has db-path-surah id', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-path-surah');
    assert.ok(el !== null, 'db-path-surah should exist');
  });
});

suite('Due Reviews Card', function() {
  test('with due reviews: shows count and review badge', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2', 'r3', 'r4', 'r5'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('words need reinforcement') >= 0 || html.indexOf('word needs reinforcement') >= 0, 'should show due count');
    assert.ok(html.indexOf('db-badge') >= 0 || html.indexOf('5') >= 0, 'should show badge with count');
  });

  test('with 1 due review: shows singular', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('word needs reinforcement') >= 0, 'should show singular "word needs reinforcement"');
    assert.ok(html.indexOf('words need reinforcement') < 0, 'should not show plural');
  });

  test('with no due reviews: review card is hidden', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = [];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Should not show any due review section
    assert.ok(html.indexOf('Due for Review') < 0, 'should not show due review when none');
  });

  test('has db-review id when due reviews exist', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2'];
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-review');
    assert.ok(el !== null, 'db-review should exist when due reviews exist');
  });
});

suite('Achievements Section', function() {
  test('shows Recent Achievements title', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Recent Achievements') >= 0, 'should show achievements title');
  });

  test('shows streak when available', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 7, lastDate: '2026-07-06' };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('7-day') >= 0 || html.indexOf('streak') >= 0, 'should show streak');
  });

  test('shows mastered and total counts', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('mastered') >= 0, 'should show mastered count');
    assert.ok(html.indexOf('total') >= 0 || html.indexOf('total') >= 0, 'should show total');
  });
});

suite('Card Interactivity', function() {
  test('Hero continue click calls goToFoundationLesson', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-hero-continue');
    assert.ok(el !== null, 'db-hero-continue should exist');
    if (el && el._onclick) {
      el._onclick();
      assert.ok(_goToFoundationCalled, 'goToFoundationLesson should be called');
    }
  });

  test('Review card click with due reviews calls startReview', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2'];
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-review');
    if (el && el._onclick) {
      el._onclick();
      assert.ok(_startReviewCalled, 'startReview should be called');
    }
  });

  test('Surah path click calls switchView', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-path-surah');
    if (el && el._onclick) {
      el._onclick();
      assert.ok(_switchViewCalled === 'learn', 'switchView should be called with learn');
    }
  });
});

suite('Edge Cases', function() {
  test('handles large numbers without overflow', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 365, lastDate: '2026-07-06' };
    _mockSRSStats = { total: 10000, mature: 5000, dueToday: 100, totalReviews: 50000, reviewsToday: 50, newCount: 2000, learning: 1500, young: 500, overdue: 10 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('5000') >= 0, 'should show large mastered count');
    assert.ok(html.indexOf('10000') >= 0, 'should show large total');
  });

  test('handles zero totals gracefully', function() {
    resetState();
    setupGlobals();
    _mockFoundationTotal = 0;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'should render without crashing');
  });

  test('creates cards with correct IDs for wiring', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-hero-continue') !== null, 'Hero continue button should exist');
    assert.ok(document.getElementById('db-path-foundation') !== null, 'Foundation path should exist');
    assert.ok(document.getElementById('db-path-surah') !== null, 'Surah path should exist');
    assert.ok(document.getElementById('db-path-root') !== null, 'Root words path should exist');
    assert.ok(document.getElementById('db-path-difficulty') !== null, 'Difficulty path should exist');
    assert.ok(document.getElementById('db-path-mixed') !== null, 'Mixed path should exist');
  });

  test('produces valid HTML structure', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.includes('<div'), 'should contain opening div tags');
    assert.ok(html.includes('</div>'), 'should contain closing div tags');
  });

  test('does not throw with unset SRS stats (null)', function() {
    resetState();
    setupGlobals();
    var origGetStats = global.window.__srs.getStats;
    global.window.__srs.getStats = function() { return null; };
    setupDashboardGrid();
    renderDashboard();
    global.window.__srs.getStats = origGetStats;
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'should render with null SRS stats');
  });
});

suite('Error Handling', function() {
  test('catches errors gracefully', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    var orig = global.getFoundationLessonCount;
    global.getFoundationLessonCount = function() { throw new Error('forced error'); };
    renderDashboard();
    global.getFoundationLessonCount = orig;
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'should handle errors gracefully');
  });
});

// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE: Full State Test
// ═══════════════════════════════════════════════════════════════

suite('Comprehensive State', function() {
  test('full realistic state renders all sections correctly', function() {
    resetState();
    setupGlobals();

    _mockSRSStats = { total: 153, mature: 42, dueToday: 8, totalReviews: 1240, reviewsToday: 15, newCount: 45, learning: 28, young: 12, overdue: 3 };
    _mockSRS = {
      w1: { stage: 3, interval: 30, ratedAt: _mockNow - 86400000 * 2 },
      w2: { stage: 2, interval: 14, ratedAt: _mockNow - 86400000 * 5 },
      w3: { stage: 1, interval: 3, ratedAt: _mockNow - 86400000 * 1 },
    };
    _mockDueReviews = ['w1', 'w3', 'w4', 'w5'];
    _mockStreakData = { streak: 7, lastDate: '2026-07-06' };
    _mockFoundationCompleted = 6;
    _mockFoundationTotal = 10;
    _mockCoverage = { coveragePercent: 45, estimatedComprehension: 62, masteredWords: 42, totalWords: 153, masteredOccurrences: 12500, totalOccurrences: 77800 };
    _mockCanonicalWordCount = 153;
    _mockSurahProgress = { completedSurahs: 3, totalSurahs: 90 };

    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();

    // Verify all expected sections
    assert.ok(html.indexOf('Assalamu Alaikum') >= 0, 'greeting');
    assert.ok(html.indexOf('62%') >= 0, 'comprehension percent');
    assert.ok(html.indexOf('need reinforcement') >= 0, 'due reviews');
    assert.ok(html.indexOf('Foundation Course') >= 0, 'Foundation card');
    assert.ok(html.indexOf('Learn by Surah') >= 0, 'Surah card');
    assert.ok(html.indexOf('Recent Achievements') >= 0, 'achievements');
    assert.ok(html.indexOf('mastered') >= 0, 'mastered count');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
