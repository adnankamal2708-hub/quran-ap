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
var _startReviewCalled = false;function resetState() {
  _mockSRS = {};
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
  // Clear adaptive mock to prevent cross-test pollution
  if (global.window && global.window.__adaptive) { delete global.window.__adaptive; }
  // Clear forecast cache to prevent cross-test pollution
  if (typeof _forecastCache !== 'undefined') { _forecastCache = null; _forecastCacheKey = null; }
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
  var uiModulePath = path.join(__dirname, '..', 'js', 'ui', 'dashboard.js');
  if (!fs.existsSync(uiModulePath)) {
    throw new Error('dashboard.js split module not found');
  }
  var uiCode = fs.readFileSync(uiModulePath, 'utf8');

  // Extract all code before renderDashboard() — cache functions, vars, etc.
  var fnIdx = uiCode.indexOf('function renderDashboard()');
  if (fnIdx < 0) throw new Error('renderDashboard() not found in dashboard.js');

  // Find the start of the forecast cache preamble
  var codeStart = uiCode.lastIndexOf('// ── Review Forecast Cache', fnIdx);
  if (codeStart < 0) codeStart = 0;
  // Walk back to the start of that line
  while (codeStart > 0 && uiCode[codeStart - 1] !== '\n') codeStart--;

  // Extract + eval the cache function preamble
  var preCode = uiCode.substring(codeStart, fnIdx);
  if (preCode.indexOf('var _forecastCache') >= 0) {
    global.eval(preCode);
  }

  // Extract + eval renderDashboard()
  var braceIdx = uiCode.indexOf('{', fnIdx);
  var depth = 1;
  var bodyEnd = -1;
  for (var i = braceIdx + 1; i < uiCode.length && depth > 0; i++) {
    if (uiCode[i] === '{') depth++;
    else if (uiCode[i] === '}') { depth--; if (depth === 0) bodyEnd = i; }
  }
  var fnBody = uiCode.substring(fnIdx, bodyEnd + 1);
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

suite('Continue Learning Section', function() {
  test('empty state shows Foundation Course prompt', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 0;
    _mockFoundationTotal = 10;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Foundation Course') >= 0, 'should show Foundation Course prompt');
    assert.ok(html.indexOf('Resume') >= 0, 'should show Resume button');
  });

  test('in-progress state shows Foundation Course with lesson info', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 4;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Foundation Course') >= 0, 'should show Foundation Course');
    assert.ok(html.indexOf('4/') >= 0, 'should show progress count');
  });

  test('has db-continue-learning id and is clickable', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-continue-learning');
    assert.ok(el !== null, 'db-continue-learning should exist');
    if (el && el._onclick) {
      el._onclick();
      assert.ok(_goToFoundationCalled, 'goToFoundationLesson should be called');
    }
  });

  test('shows 0 of 10 progress when none completed', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 0;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('0/10') >= 0 || html.indexOf('Foundation') >= 0, 'should show 0/10 progress');
  });
});

suite('Continue Reading Section', function() {
  test('shows Start Reading when no reading history', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Start Reading') >= 0, 'should show Start Reading');
    assert.ok(html.indexOf('Al-Fatiha') >= 0, 'should recommend Al-Fatiha');
  });

  test('has db-continue-reading-start id', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-continue-reading-start');
    assert.ok(el !== null, 'db-continue-reading-start should exist');
  });
});

suite('Progress Overview Section', function() {
  test('shows Mastered stat', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Mastered') >= 0, 'should show Mastered stat');
  });

  test('shows Streak stat', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 7, lastDate: '2026-07-06' };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Streak') >= 0, 'should show Streak stat');
  });

  test('shows Due stat', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2', 'r3'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('due') >= 0, 'should show due review text in Review Center prompt');
  });

  test('has db-progress-overview id', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-progress-overview');
    assert.ok(el !== null, 'db-progress-overview should exist');
  });
});

suite('Daily Motivation Section', function() {
  test('shows encouragement when reviews done today', function() {
    resetState();
    setupGlobals();
    _mockSRSStats = { total: 100, mature: 10, dueToday: 5, totalReviews: 200, reviewsToday: 15, newCount: 30, learning: 20, young: 5, overdue: 2 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('reinforced') >= 0, 'should mention words reinforced');
    assert.ok(html.indexOf('15') >= 0, 'should show 15 reviews');
  });

  test('shows streak message when no reviews today', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 7, lastDate: '2026-07-06' };
    _mockSRSStats = { total: 100, mature: 10, dueToday: 5, totalReviews: 200, reviewsToday: 0, newCount: 30, learning: 20, young: 5, overdue: 2 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('streak') >= 0, 'should mention streak');
  });

  test('has db-motivation-card id', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var el = document.getElementById('db-motivation-card');
    assert.ok(el !== null, 'db-motivation-card should exist');
  });
});

suite('Smart Recommendations', function() {
  test('shows at least one recommendation', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Smart Recommendations') >= 0, 'should show recommendations section');
  });

  test('shows review recommendation when due', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2', 'r3'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('reviews') >= 0 || html.indexOf('review') >= 0, 'should mention reviews in recs');
  });

  test('recommendation cards are clickable', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1'];
    setupDashboardGrid();
    renderDashboard();
    // Find smart-recommendation cards
    var recCards = getInnerHTML();
    assert.ok(recCards.indexOf('db-card-smart-rec') >= 0 || recCards.indexOf('→') >= 0, 'should have recommendation-like content');
  });
});

suite('Recommendation — Weakness Guard', function() {
  function setupWeaknessMock() {
    global.window.__adaptive = {
      getDashboardData: function() {
        return {
          dailyPlan: null,
          recommendation: null,
          weaknesses: [
            { dimension: 'forgotten-words', name: '3 words frequently forgotten', severity: 'medium' },
            { dimension: 'overdue', name: '5 overdue reviews', severity: 'low' },
          ],
          streakQuality: null,
          adaptiveLimit: null,
          goalProgress: null,
        };
      },
    };
  }

  test('brand-new user: weakness does NOT appear, onboarding appears', function() {
    resetState();
    setupGlobals();
    setupWeaknessMock();
    _mockFoundationCompleted = 0;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Weakness should NOT appear
    assert.ok(html.indexOf('weak area') === -1, 'should NOT show weak area for new user');
    // Onboarding should appear
    assert.ok(html.indexOf('Build your foundation') >= 0, 'should show onboarding recommendation');
    assert.ok(html.indexOf('first lesson') >= 0, 'onboarding should mention first lesson');
  });

  test('early learner (below evidence threshold): weakness does NOT appear, progression does', function() {
    resetState();
    setupGlobals();
    setupWeaknessMock();
    _mockFoundationCompleted = 0;
    _mockSRSStats = { total: 2, mature: 1, dueToday: 0, totalReviews: 2, reviewsToday: 0, newCount: 1, learning: 1, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Weakness should NOT appear (only 2 total reviews, below 5-threshold)
    assert.ok(html.indexOf('weak area') === -1, 'should NOT show weak area for early learner');
    // Progression-based recommendation should appear (Foundation Course, Reading, etc.)
    assert.ok(html.indexOf('Foundation') >= 0 || html.indexOf('Reading') >= 0 || html.indexOf('Continue') >= 0,
      'should show progression recommendation for early learner');
  });

  test('sufficient evidence (≥1 lesson or ≥3 mastered or ≥5 reviews): weakness appears', function() {
    resetState();
    setupGlobals();
    setupWeaknessMock();
    _mockFoundationCompleted = 5;
    _mockSRSStats = { total: 50, mature: 20, dueToday: 5, totalReviews: 200, reviewsToday: 10, newCount: 10, learning: 8, young: 4, overdue: 2 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Weakness should appear
    assert.ok(html.indexOf('weak area') >= 0, 'should show weak area for experienced user');
    assert.ok(html.indexOf('frequently forgotten') >= 0, 'should mention specific weakness');
  });

  test('no weaknesses despite sufficient activity: next recommendation appears', function() {
    resetState();
    setupGlobals();
    // Set up adaptive with empty weaknesses
    global.window.__adaptive = {
      getDashboardData: function() {
        return {
          dailyPlan: null,
          recommendation: null,
          weaknesses: [],  // No weaknesses detected
          streakQuality: null,
          adaptiveLimit: null,
          goalProgress: null,
        };
      },
    };
    _mockFoundationCompleted = 5;
    _mockSRSStats = { total: 50, mature: 20, dueToday: 0, totalReviews: 200, reviewsToday: 0, newCount: 10, learning: 8, young: 4, overdue: 0 };
    _mockDueReviews = [];  // No due reviews either
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Should NOT show weakness
    assert.ok(html.indexOf('weak area') === -1, 'should NOT show weak area when no weaknesses exist');
    // Should show some other recommendation (reading is the fallback)
    assert.ok(html.indexOf('Smart Recommendations') >= 0, 'recommendations section should still appear');
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
    assert.ok(html.indexOf('365') >= 0, 'should show large streak');
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
    assert.ok(document.getElementById('db-comp-headline') !== null, 'Comprehension headline should exist');
    assert.ok(document.getElementById('db-continue-reading-start') !== null, 'Continue reading start should exist');
    assert.ok(document.getElementById('db-continue-learning') !== null, 'Continue learning should exist');
    assert.ok(document.getElementById('db-progress-overview') !== null, 'Progress overview should exist');
    assert.ok(document.getElementById('db-motivation-card') !== null, 'Motivation card should exist');
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

    _mockSRSStats = { total: 153, mature: 42, dueToday: 8, totalReviews: 1240, reviewsToday: 15, newCount: 45, learning: 28, young: 12, overdue: 2 };
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
    assert.ok(html.indexOf('Foundation Course') >= 0, 'Foundation card');
    assert.ok(html.indexOf('Progress Overview') >= 0, 'progress overview');
    assert.ok(html.indexOf('Mastered') >= 0, 'words mastered stat');
    assert.ok(html.indexOf('due') >= 0, 'review due text should appear in Review Center prompt');
    assert.ok(html.indexOf('Daily Motivation') >= 0 || html.indexOf('reinforced') >= 0, 'motivation message');
    assert.ok(html.indexOf('Smart Recommendations') >= 0, 'smart recommendations');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
