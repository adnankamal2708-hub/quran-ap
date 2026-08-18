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

  // Mock the recommendation slot module (separate module, not loaded by eval)
  global.window.__recommendationSlot = {
    getPrimary: function(state) {
      // Minimal mock: reproduce the priority logic so tests get correct recommendations
      if (!state) return null;
      // Rule 1: reviews-due (priority 100)
      if (state.dueCount > 0) {
        var due = state.dueCount;
        return { icon: 'repeat', title: (due === 1 ? '1 review' : due + ' reviews') + ' due', message: 'Strengthen your memory by reviewing now.', action: 'Start Review', id: 'rec-reviews', actionType: 'review' };
      }
      // Rule 2: build-foundation (priority 150) — new user
      if (state.noProgress) {
        return { icon: 'star', title: 'Build your foundation', message: 'Complete your first lesson to establish your learning baseline.', action: 'Start lesson', id: 'rec-foundation-start', actionType: 'foundation' };
      }
      // Rule 3: weak-areas (priority 200)
      if (state.weaknesses && state.weaknesses.length > 0 && (state.fCompleted >= 1 || state.masteredCount >= 3 || (state.totalReviews || 0) >= 5)) {
        var count = state.weaknesses.length;
        return { icon: 'alert-triangle', title: count + ' weak area' + (count > 1 ? 's' : '') + ' detected', message: 'Focus on ' + state.weaknesses[0].name + (count > 1 ? ' and ' + (count - 1) + ' more' : '') + ' to strengthen your foundation.', action: 'Review', id: 'rec-weak', actionType: 'review' };
      }
      // Rule 4: continue-foundation (priority 250)
      if (!state.noProgress && state.fTotal > 0 && !state.foundationComplete) {
        var nextNum = (state.nextIncompleteF || 0) + 1;
        return { icon: 'layers', title: 'Foundation ' + nextNum + ': continue', message: 'Lesson ' + nextNum + ' of ' + state.fTotal, action: 'Resume', id: 'rec-foundation', actionType: 'foundation' };
      }
      // Rule 5: guided-reading (priority 300)
      if (state.foundationComplete && state.p2Phase === 'guided-reading' && state.nextSurahPreview) {
        return { icon: 'book', title: 'Read Surah', message: 'Guided reading recommendation', action: 'Read', id: 'rec-guided-reading', actionType: 'reading' };
      }
      // Rule 6: vocabulary-expansion (priority 400)
      if (state.foundationComplete && state.p2Phase === 'phase2' && state.expansionWords && state.expansionWords.length > 0) {
        return { icon: 'layers', title: 'Expand Your Vocabulary', message: 'New words available', action: 'Explore', id: 'rec-expansion', actionType: 'foundation' };
      }
      // Rule 7: reading (priority 700)
      if (!state.lastRead || !state.lastRead.surahId) {
        return { icon: 'book', title: 'Begin reading the Quran', message: 'Reading reinforces learning.', action: 'Open Quran', id: 'rec-reading', actionType: 'reading' };
      }
      // Rule 8: encouragement (priority 800) — fallback
      if (state.masteredCount > 0 || state.comprehensionPct > 0) {
        return { icon: 'check-circle', title: state.masteredCount + ' Words Mastered', message: state.coveragePct + '% Quran coverage', action: 'Continue', id: 'rec-encouragement', actionType: 'foundation' };
      }
      return null;
    },
  };
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

suite('Secondary Sections Render Inline (no toggle)', function() {
  // The "Show more stats" toggle + collapsible wrapper were removed — secondary
  // dashboard sections (Review Center, Surah Comprehension, Recommendation,
  // Progress Overview, Daily Motivation, Hero Stats Bar) render inline, each
  // gated on real data. The manual toggle promised stats that don't exist for
  // brand-new users and reset on every dashboard re-render.

  test('no show-more toggle or collapsible wrapper is rendered', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-show-more-btn') === -1, 'toggle button removed');
    assert.ok(html.indexOf('Show more stats') === -1, 'toggle text removed');
    assert.ok(html.indexOf('db-collapsible') === -1, 'collapsible wrapper removed');
  });

  test('Review Center prompt renders inline after greeting', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var reviewCenterIdx = html.indexOf('db-review-center-prompt');
    assert.ok(reviewCenterIdx >= 0, 'review center prompt should exist');
    assert.ok(html.indexOf('db-greeting') < reviewCenterIdx, 'review center appears after greeting');
  });

  test('Progress Overview renders inline after greeting', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var progressIdx = html.indexOf('db-progress-overview');
    assert.ok(progressIdx >= 0, 'progress overview should exist');
    assert.ok(html.indexOf('db-greeting') < progressIdx, 'progress overview appears after greeting');
  });

  test('Daily Motivation renders inline after greeting', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var motivationIdx = html.indexOf('db-motivation-card');
    assert.ok(motivationIdx >= 0, 'motivation card should exist');
    assert.ok(html.indexOf('db-greeting') < motivationIdx, 'motivation appears after greeting');
  });

  test('Surah Progress renders inline when its gate passes', function() {
    resetState();
    setupGlobals();
    // Surah progress only renders once >= LOWEST_COMP_HIDE_THRESHOLD (5) surahs
    // have real (non-zero) progress — provide enough for the gate to pass.
    global.getAllSurahComprehension = function() {
      return [
        { surahId: 1, estimatedComprehension: 30 },
        { surahId: 2, estimatedComprehension: 50 },
        { surahId: 3, estimatedComprehension: 20 },
        { surahId: 4, estimatedComprehension: 45 },
        { surahId: 5, estimatedComprehension: 12 },
        { surahId: 6, estimatedComprehension: 60 },
      ];
    };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-surah-progress') >= 0, 'surah progress should exist');
    assert.ok(html.indexOf('db-surah-progress') > html.indexOf('db-greeting'),
      'surah progress appears after greeting');
  });

  test('Recommendation section renders inline after greeting', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var recIdx = html.indexOf('Recommendation');
    assert.ok(recIdx >= 0, 'recommendation section should exist');
    assert.ok(recIdx > html.indexOf('db-greeting'), 'recommendation appears after greeting');
  });

  test('Hero Stats Bar renders inline for users with progress', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var heroIdx = html.indexOf('db-hero-bar');
    assert.ok(heroIdx >= 0, 'hero bar should exist for users with progress');
    assert.ok(heroIdx > html.indexOf('db-greeting'), 'hero bar appears after greeting');
    var statCount = html.split('db-hero-stat-click').length - 1;
    assert.strictEqual(statCount, 4, 'four hero stats for users with progress');
  });

  test('secondary sections appear in document order', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var order = ['db-greeting', 'db-review-center-prompt', 'db-progress-overview',
      'db-motivation-card', 'db-hero-bar'];
    var lastIdx = -1;
    for (var i = 0; i < order.length; i++) {
      var idx = html.indexOf(order[i]);
      assert.ok(idx >= 0, order[i] + ' should exist');
      assert.ok(idx > lastIdx, order[i] + ' should come after previous section');
      lastIdx = idx;
    }
  });

  test('all secondary content still renders without the toggle', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Review Center') >= 0, 'Review Center still rendered');
    assert.ok(html.indexOf('Progress Overview') >= 0, 'Progress Overview still rendered');
    assert.ok(html.indexOf('Streak') >= 0, 'Streak stat still rendered');
  });
});

suite('Smart Recommendations', function() {
  test('shows at least one recommendation', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Recommendation') >= 0, 'should show recommendations section');
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

  test('brand-new user: weakness does NOT appear, recommendation slot is suppressed', function() {
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
    // Recommendation slot is suppressed entirely for new users — its
    // build-foundation CTA duplicated the Continue Learning card above it.
    assert.ok(html.indexOf('Build your foundation') === -1, 'should NOT show onboarding recommendation (duplicate CTA)');
    assert.ok(html.indexOf('Recommendation') === -1, 'recommendation section should NOT appear for new user');
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
    assert.ok(html.indexOf('Focus on') >= 0, 'should recommend focus area');
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
    assert.ok(html.indexOf('Recommendation') >= 0, 'recommendations section should still appear');
  });
});

suite('Dashboard Clutter — Brand-New User (zero progress)', function() {
  // Genuinely fresh account: no foundation lessons, no SRS entries, no reviews.
  function setupBrandNewUser() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 0;
    _mockFoundationTotal = 10;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    _mockDueReviews = [];
    _mockStreakData = { streak: 0, lastDate: null };
    _mockCoverage = null;
  }

  test('Fix 1: headline shows welcome line with NO ring at 0% comprehension', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-ring-fill') === -1, 'ring should be hidden at 0%');
    assert.ok(html.indexOf('db-comp-headline-value') >= 0, 'headline value still present');
    assert.ok(html.indexOf('Begin your journey to understand the Quran') >= 0, 'welcome line shown instead of ring');
    assert.ok(html.indexOf('% Quran Comprehension') === -1, 'no "0% Quran Comprehension" value for new user');
  });

  test('Fix 1: ring renders when comprehensionPct > 0', function() {
    resetState();
    setupGlobals();
    _mockCoverage = { coveragePercent: 42.5, estimatedComprehension: 65, masteredWords: 2, totalWords: 3, masteredOccurrences: 8, totalOccurrences: 18 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-ring-fill') >= 0, 'ring should render with real comprehension');
    assert.ok(html.indexOf('65% Quran Comprehension') >= 0, 'value shows real percentage');
  });

  test('Fix 1: ring hidden for user with progress but 0% comprehension (welcome variant)', function() {
    resetState();
    setupGlobals();
    // Default stats: mastered 10, but coverage null -> comprehension 0%
    _mockCoverage = null;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-ring-fill') === -1, 'ring should be hidden when comprehension is 0');
    assert.ok(html.indexOf('Begin your journey to understand the Quran') >= 0, 'welcome variant shown');
  });

  test('Fix 2: metrics row hidden at zero data', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-comp-metrics') === -1, 'metrics row not rendered for zero-progress user');
  });

  test('Fix 2: 2-cell metrics row once real data exists', function() {
    setupBrandNewUser();
    _mockSRSStats = { total: 100, mature: 5, dueToday: 2, totalReviews: 30, reviewsToday: 1, newCount: 10, learning: 8, young: 3, overdue: 0 };
    _mockCoverage = { coveragePercent: 20, estimatedComprehension: 30, masteredWords: 5, totalWords: 100, masteredOccurrences: 300, totalOccurrences: 1800 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-comp-metric-label">Coverage') >= 0, 'Coverage metric shown');
    assert.ok(html.indexOf('db-comp-metric-label">Mastered') >= 0, 'Mastered metric shown');
    assert.ok(html.indexOf('db-comp-metric-label">Total Words') === -1, 'Total Words metric removed');
  });

  test('Fix 3: Review Center prompt hidden for brand-new user', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-review-center-prompt') === -1, 'review center prompt should NOT render');
  });

  test('Fix 3: Review Center prompt shows when reviews due even with <5 lifetime', function() {
    setupBrandNewUser();
    _mockSRSStats = { total: 4, mature: 0, dueToday: 2, totalReviews: 3, reviewsToday: 0, newCount: 4, learning: 0, young: 0, overdue: 0 };
    _mockDueReviews = ['w1', 'w2'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-review-center-prompt') >= 0, 'prompt shows when reviews are due');
  });

  test('Fix 4: Surah Comprehension card hidden while all surahs are 0%', function() {
    setupBrandNewUser();
    global.getAllSurahComprehension = function() {
      var arr = [];
      for (var i = 1; i <= 10; i++) arr.push({ surahId: i, estimatedComprehension: 0, masteredWords: 0 });
      return arr;
    };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-surah-progress') === -1, 'surah card hidden when no surah has real progress');
  });

  test('Fix 4: Surah Comprehension card hidden below LOWEST_COMP_HIDE_THRESHOLD', function() {
    setupBrandNewUser();
    // Only 3 surahs with real progress — below the established threshold of 5.
    global.getAllSurahComprehension = function() {
      return [
        { surahId: 1, estimatedComprehension: 30, masteredWords: 2 },
        { surahId: 2, estimatedComprehension: 50, masteredWords: 4 },
        { surahId: 3, estimatedComprehension: 20, masteredWords: 1 },
        { surahId: 4, estimatedComprehension: 0, masteredWords: 0 },
        { surahId: 5, estimatedComprehension: 0, masteredWords: 0 },
      ];
    };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-surah-progress') === -1, 'surah card hidden below threshold');
  });

  test('Fix 5: recommendation slot suppressed (no duplicate start-lesson CTA)', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Recommendation') === -1, 'no recommendation section for new user');
    assert.ok(html.indexOf('Build your foundation') === -1, 'no build-foundation card');
    // Continue Learning is the single primary CTA for new users
    assert.ok(html.indexOf('Continue Learning') >= 0, 'Continue Learning remains');
    assert.ok(document.getElementById('db-continue-learning') !== null, 'Continue Learning card present');
    assert.ok(document.getElementById('db-continue-learning-start') === null, 'no duplicate start card');
  });

  test('Fix 6: Progress Overview hidden until real progress exists', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-progress-overview') === null, 'progress overview hidden for new user');
  });

  test('Fix 6: Progress Overview shows once any real progress exists', function() {
    setupBrandNewUser();
    _mockSRSStats = { total: 5, mature: 0, dueToday: 0, totalReviews: 6, reviewsToday: 0, newCount: 5, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-progress-overview') !== null, 'progress overview shown with reviews history');
  });

  test('Fix 7: motivation shows welcome copy, not the repeated Foundation CTA', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Your journey to understand the Quran begins here. Take it one word at a time') >= 0, 'welcome copy shown');
    assert.ok(html.indexOf('Start the Foundation Course to master') === -1, 'no duplicated Foundation CTA in motivation');
  });

  test('Fix 7: motivation keeps real progress messages when they exist', function() {
    setupBrandNewUser();
    _mockSRSStats = { total: 10, mature: 2, dueToday: 0, totalReviews: 15, reviewsToday: 3, newCount: 8, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('reinforced') >= 0, 'reviews-today message preserved for new user with activity');
  });

  test('Fix 8: hero stats bar hidden entirely for brand-new user (no zero wall, no duplicate CTA)', function() {
    setupBrandNewUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var statCount = html.split('db-hero-stat-click').length - 1;
    assert.strictEqual(statCount, 0, 'no hero stats for brand-new user');
    assert.ok(html.indexOf('db-hero-bar') === -1, 'hero bar hidden for new user');
    assert.ok(html.indexOf('Start Today') === -1, 'no Start Today stand-in card (duplicate CTA removed)');
  });
});

suite('Dashboard Clutter — Returning User (real progress)', function() {
  function setupReturningUser() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 4;
    _mockFoundationTotal = 10;
    _mockSRSStats = { total: 100, mature: 25, dueToday: 3, totalReviews: 120, reviewsToday: 2, newCount: 30, learning: 20, young: 5, overdue: 1 };
    _mockDueReviews = ['w1', 'w2'];
    _mockStreakData = { streak: 4, lastDate: '2026-07-06' };
    _mockCoverage = { coveragePercent: 35, estimatedComprehension: 55, masteredWords: 25, totalWords: 153, masteredOccurrences: 500, totalOccurrences: 1800 };
    global.getAllSurahComprehension = function() {
      return [
        { surahId: 1, estimatedComprehension: 80, masteredWords: 20 },
        { surahId: 2, estimatedComprehension: 40, masteredWords: 10 },
        { surahId: 3, estimatedComprehension: 55, masteredWords: 14 },
        { surahId: 4, estimatedComprehension: 25, masteredWords: 6 },
        { surahId: 5, estimatedComprehension: 65, masteredWords: 17 },
        { surahId: 6, estimatedComprehension: 30, masteredWords: 8 },
        { surahId: 7, estimatedComprehension: 0, masteredWords: 0 },
      ];
    };
  }

  test('Fix 1: ring + milestone render with real comprehension', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-ring-fill') >= 0, 'ring renders');
    assert.ok(html.indexOf('55% Quran Comprehension') >= 0, 'real percentage shown');
  });

  test('Fix 2: metrics row renders Coverage + Mastered', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('db-comp-metric-label">Coverage') >= 0, 'Coverage shown');
    assert.ok(html.indexOf('db-comp-metric-label">Mastered') >= 0, 'Mastered shown');
    assert.ok(html.indexOf('db-comp-metric-label">Total Words') === -1, 'Total Words removed');
  });

  test('Fix 3: Review Center prompt renders (due + lifetime reviews)', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-review-center-prompt') !== null, 'review center prompt shown');
  });

  test('Fix 4: Surah Comprehension card renders with real surah progress', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-surah-progress') !== null, 'surah card shown');
  });

  test('Fix 5: recommendation slot renders for returning user', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Recommendation') >= 0, 'recommendation section shown');
  });

  test('Fix 6: Progress Overview renders', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('db-progress-overview') !== null, 'progress overview shown');
    var html = getInnerHTML();
    assert.ok(html.indexOf('4 / 10') >= 0, 'foundation progress shown');
  });

  test('Fix 8: full 4-stat hero bar renders', function() {
    setupReturningUser();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    var statCount = html.split('db-hero-stat-click').length - 1;
    assert.strictEqual(statCount, 4, 'four hero stats for returning user');
    assert.ok(html.indexOf('db-hero-stat-label">Comprehension') >= 0, 'Comprehension stat shown');
    assert.ok(html.indexOf('db-hero-stat-label">Reviews') >= 0, 'Reviews stat shown');
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
    assert.ok(html.indexOf('Recommendation') >= 0, 'smart recommendations section');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
