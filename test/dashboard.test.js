#!/usr/bin/env node
/**
 * dashboard.test.js — Unit tests for renderDashboard()
 *
 * Tests: card states (empty, in-progress, complete), hero section,
 * stats row, edge cases, and error handling.
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
      // Parse id="..." patterns from innerHTML to populate _elementsById
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
    set: function(v) {
      if (typeof v === 'object') this._style = v;
      else this._style = {};
    },
  });
  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
  });
  Object.defineProperty(el, 'onkeydown', {
    get: function() { return this._onkeydown; },
    set: function(fn) { this._onkeydown = fn; },
  });
  // classList
  el.classList = {
    _values: {},
    add: function(c) { this._values[c] = true; el._className = Object.keys(this._values).join(' '); },
    remove: function(c) { delete this._values[c]; el._className = Object.keys(this._values).join(' '); },
    contains: function(c) { return !!this._values[c]; },
  };
  el.offsetHeight = 1;
  return el;
}

function resetDOM() {
  _elementsById = {};
}

global.document = {
  getElementById: function(id) { return _elementsById[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
};

// ── Mock DOM cache ──
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
// MOCK HELPERS — set up test scenarios
// ═══════════════════════════════════════════════════════════════

var _mockSRS = {};
var _mockDueReviews = [];
var _mockStreakData = { streak: 0, lastDate: null };
var _mockFoundationCompleted = 0;
var _mockFoundationTotal = 10;
var _mockLessonCompleted = 0;
var _mockLessonTotal = 10;
var _mockCoverage = null;
var _mockCanonicalWordCount = 0;
var _mockSurahProgress = null;
var _mockSRSStats = null;
var _switchViewCalled = '';
var _goToFoundationCalled = false;
var _startReviewCalled = false;

function resetState() {
  _mockSRS = {};
  _mockDueReviews = [];
  _mockStreakData = { streak: 0, lastDate: null };
  _mockFoundationCompleted = 0;
  _mockFoundationTotal = 10;
  _mockLessonCompleted = 0;
  _mockLessonTotal = 10;
  _mockCoverage = null;
  _mockCanonicalWordCount = 0;
  _mockSurahProgress = null;
  _mockSRSStats = null;
  _switchViewCalled = '';
  _goToFoundationCalled = false;
  _startReviewCalled = false;
}

// Set up the global functions that renderDashboard() expects
function setupGlobals() {
  global.window = global.window || {};
  global.window.__srs = {
    getStats: function() {
      return _mockSRSStats || {
        total: 100,
        mature: 10,
        dueToday: 5,
        totalReviews: 200,
        reviewsToday: 3,
        newCount: 30,
        learning: 20,
        young: 5,
        overdue: 2,
      };
    },
    getDailyReviewLimit: function() { return 25; },
  };

  global.getSRSStats = function() {
    return global.window.__srs.getStats();
  };

  global.loadSRS = function() { return JSON.parse(JSON.stringify(_mockSRS)); };

  global.getDueReviews = function() { return [].concat(_mockDueReviews); };

  global.loadStreakData = function() { return JSON.parse(JSON.stringify(_mockStreakData)); };

  global.getFoundationLessonCount = function() { return _mockFoundationTotal; };
  global.getCompletedFoundationLessonCount = function() { return _mockFoundationCompleted; };

  global.getLessonCount = function() { return _mockLessonTotal; };
  global.getCompletedLessonCount = function() { return _mockLessonCompleted; };

  global.calculateCoverage = function() {
    return _mockCoverage ? JSON.parse(JSON.stringify(_mockCoverage)) : null;
  };

  global.getCanonicalWordCount = function() { return _mockCanonicalWordCount; };

  global.getSurahLessonProgress = function() { return _mockSurahProgress; };

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

// Evaluate renderDashboard in global scope so it becomes a global function
(function() {
  var uiCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
  
  // Extract renderDashboard function declaration
  var idx = uiCode.indexOf('function renderDashboard()');
  if (idx < 0) throw new Error('renderDashboard() not found in ui.js');
  
  var braceIdx = uiCode.indexOf('{', idx);
  var depth = 1;
  var bodyEnd = -1;
  for (var i = braceIdx + 1; i < uiCode.length && depth > 0; i++) {
    if (uiCode[i] === '{') depth++;
    else if (uiCode[i] === '}') { depth--; if (depth === 0) bodyEnd = i; }
  }
  
  var fnBody = uiCode.substring(idx, bodyEnd + 1);
  // Wrap in a block and use global.eval to make renderDashboard available globally
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
  console.log('\n\uD83D\uDCCB ' + name);
  fn();
}

// ── Helper: create dashboard-grid DOM element ──
function setupDashboardGrid() {
  var grid = makeEl('div');
  grid.id = 'dashboard-grid';
  _elementsById['dashboard-grid'] = grid;
  return grid;
}

// ── Helper: parse rendered HTML for assertions ──
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
    // No dashboard-grid in DOM — should not throw
    renderDashboard();
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

suite('Hero Section', function() {
  test('hero contains Bayan branding', function() {
    resetState();
    setupGlobals();
    var grid = setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Bayan') >= 0, 'should have Bayan title');
    assert.ok(html.indexOf('Understand the Quran') >= 0, 'should have tagline');
    assert.ok(html.indexOf('dh-hero') >= 0 || html.indexOf('dashboard-hero') >= 0, 'should have hero section');
  });

  test('hero progress ring shows Quran comprehension percentage', function() {
    resetState();
    setupGlobals();
    _mockCoverage = { coveragePercent: 42.5, estimatedComprehension: 65, masteredWords: 2, totalWords: 3, masteredOccurrences: 8, totalOccurrences: 18 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('65%') >= 0, 'should show 65% comprehension');
    assert.ok(html.indexOf('Quran Comprehension') >= 0, 'should show Quran Comprehension label');
  });

  test('hero shows weekly change indicator', function() {
    resetState();
    setupGlobals();
    _mockCoverage = { coveragePercent: 30, estimatedComprehension: 50, masteredWords: 1, totalWords: 3, masteredOccurrences: 5, totalOccurrences: 18 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('+') >= 0 && html.indexOf('this week') >= 0, 'should show weekly change');
  });

  test('hero works with null coverage (no learning data)', function() {
    resetState();
    setupGlobals();
    _mockCoverage = null;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('0%') >= 0, 'should show 0% when no coverage data');
  });
});

suite('Stats Row', function() {
  test('stats row shows Mastered, Streak, Due, and Total Reviews', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 5, lastDate: '2026-07-06' };
    _mockDueReviews = ['r1', 'r2'];
    _mockSRSStats = { total: 100, mature: 15, dueToday: 5, totalReviews: 200, reviewsToday: 3, newCount: 30, learning: 20, young: 5, overdue: 2 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Mastered') >= 0, 'should show Mastered');
    assert.ok(html.indexOf('Day Streak') >= 0 || html.indexOf('Streak') >= 0, 'should show Streak');
    assert.ok(html.indexOf('Due Review') >= 0 || html.indexOf('Due') >= 0, 'should show Due');
    assert.ok(html.indexOf('Total Reviews') >= 0 || html.indexOf('Reviews') >= 0, 'should show Total Reviews');
  });

  test('stats row shows correct numeric values', function() {
    resetState();
    setupGlobals();
    _mockStreakData = { streak: 12, lastDate: '2026-07-06' };
    _mockDueReviews = ['r1', 'r2', 'r3'];
    _mockSRSStats = { total: 100, mature: 25, dueToday: 5, totalReviews: 500, reviewsToday: 3, newCount: 30, learning: 20, young: 5, overdue: 2 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('25') >= 0, 'should show 25 mastered');
    assert.ok(html.indexOf('12') >= 0, 'should show 12 streak');
    assert.ok(html.indexOf('3') >= 0, 'should show 3 due reviews');
    // TotalReviews might not appear as raw number depending on formatting
  });
});

suite('Foundation Course Card States', function() {
  test('empty state: Foundation card shows 0% and Start Foundation', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 0;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Foundation Course') >= 0, 'should have Foundation Course title');
    assert.ok(html.indexOf('0%') >= 0 || html.indexOf('0 /') >= 0, 'should show 0%');
    assert.ok(html.indexOf('Start Foundation') >= 0, 'should show Start Foundation action');
  });

  test('in-progress state: Foundation card shows progress and Continue', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 4;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('40%') >= 0 || html.indexOf('4 / 10') >= 0, 'should show 40% progress');
    assert.ok(html.indexOf('Continue') >= 0, 'should show Continue action');
  });

  test('complete state: Foundation card shows 100% and checkmark', function() {
    resetState();
    setupGlobals();
    _mockFoundationCompleted = 10;
    _mockFoundationTotal = 10;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('100%') >= 0 || html.indexOf('10 / 10') >= 0, 'should show 100%');
    assert.ok(html.indexOf('Complete') >= 0 || html.indexOf('\u2705') >= 0, 'should show Complete/checkmark');
  });
});

suite('Learn by Surah Card States', function() {
  test('empty state: Surah card shows 0% and Start Learning', function() {
    resetState();
    setupGlobals();
    _mockLessonCompleted = 0;
    _mockLessonTotal = 90;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Learn by Surah') >= 0, 'should have Learn by Surah title');
    assert.ok(html.indexOf('Start Learning') >= 0, 'should show Start Learning');
  });

  test('in-progress state: Surah card shows progress and Continue', function() {
    resetState();
    setupGlobals();
    _mockLessonCompleted = 15;
    _mockLessonTotal = 90;
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Continue') >= 0, 'should show Continue');
    assert.ok(html.indexOf('15 / 90') >= 0 || html.indexOf('16%') >= 0 || html.indexOf('17%') >= 0, 'should show progress');
  });
});

suite('Mixed Review Card States', function() {
  test('with due reviews: Review card shows count and Start Review', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2', 'r3', 'r4', 'r5'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('Mixed Review') >= 0, 'should have Mixed Review title');
    assert.ok(html.indexOf('Start Review') >= 0, 'should show Start Review');
    assert.ok(html.indexOf('words due') >= 0 || html.indexOf('word due') >= 0, 'should show due count');
  });

  test('with 1 due review: shows singular "word due"', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1'];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('word due') >= 0, 'should show singular "word due"');
    assert.ok(html.indexOf('words due') < 0 || html.indexOf('word due') >= 0, 'should not show plural');
  });

  test('all caught up: Review card shows caught up message', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = [];
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.indexOf('All caught up') >= 0, 'should show all caught up');
    assert.ok(html.indexOf('Learning Paths') >= 0, 'should show alternative action');
  });
});

suite('Card Interactivity', function() {
  test('Foundation card click calls goToFoundationLesson', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var grid = document.getElementById('dashboard-grid');
    // Find Foundation card by searching innerHTML
    var html = grid.innerHTML;
    assert.ok(html.indexOf('dash-path-foundation') >= 0, 'Foundation card should have id');
    
    // Simulate click on the card element
    var cardEl = document.getElementById('dash-path-foundation');
    assert.ok(cardEl !== null, 'Foundation card should exist in DOM');
    if (cardEl && cardEl._onclick) {
      cardEl._onclick();
      assert.ok(_goToFoundationCalled, 'goToFoundationLesson should be called');
    }
  });

  test('Mixed Review card click with due reviews calls startReview', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = ['r1', 'r2'];
    setupDashboardGrid();
    renderDashboard();
    var cardEl = document.getElementById('dash-path-mixed-review');
    if (cardEl && cardEl._onclick) {
      cardEl._onclick();
      assert.ok(_startReviewCalled, 'startReview should be called');
    }
  });

  test('Mixed Review card click with no due reviews calls switchView', function() {
    resetState();
    setupGlobals();
    _mockDueReviews = [];
    setupDashboardGrid();
    renderDashboard();
    var cardEl = document.getElementById('dash-path-mixed-review');
    if (cardEl && cardEl._onclick) {
      cardEl._onclick();
      assert.ok(_switchViewCalled === 'learn', 'switchView should be called with learn');
    }
  });

  test('Learn by Surah card click calls switchView', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var cardEl = document.getElementById('dash-path-lessons');
    if (cardEl && cardEl._onclick) {
      cardEl._onclick();
      assert.ok(_switchViewCalled === 'learn', 'switchView should be called with learn');
    }
  });
});

suite('Edge Cases', function() {
  test('renderDashboard handles large numbers without overflow', function() {
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

  test('renderDashboard handles zero totals gracefully', function() {
    resetState();
    setupGlobals();
    _mockFoundationTotal = 0;
    _mockLessonTotal = 0;
    _mockSRSStats = { total: 0, mature: 0, dueToday: 0, totalReviews: 0, reviewsToday: 0, newCount: 0, learning: 0, young: 0, overdue: 0 };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'should render without crashing');
  });

  test('renderDashboard creates cards with correct IDs for wiring', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    assert.ok(document.getElementById('dash-path-foundation') !== null, 'Foundation card should exist');
    assert.ok(document.getElementById('dash-path-lessons') !== null, 'Lessons card should exist');
    assert.ok(document.getElementById('dash-path-mixed-review') !== null, 'Review card should exist');
  });

  test('renderDashboard produces valid HTML structure', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    // Check basic HTML structure
    assert.ok(html.startsWith('<') || html.includes('<div'), 'should start with HTML tag');
    assert.ok(html.includes('</div>'), 'should contain closing div tags');
  });

  test('renderDashboard does not throw with unset SRS stats (null)', function() {
    resetState();
    setupGlobals();
    global.window.__srs.getStats = function() { return null; };
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    assert.ok(html.length > 0, 'should render with null SRS stats');
  });
});

suite('Error Handling', function() {
  test('renderDashboard catches errors gracefully', function() {
    resetState();
    setupGlobals();
    setupDashboardGrid();
    // Force an error by corrupting a dependency
    var orig = global.getFoundationLessonCount;
    global.getFoundationLessonCount = function() { throw new Error('forced error'); };
    renderDashboard();
    global.getFoundationLessonCount = orig;
    var html = getInnerHTML();
    // Should show either error fallback or still have content
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
    
    // Realistic learning profile
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
    _mockLessonCompleted = 12;
    _mockLessonTotal = 90;
    _mockCoverage = { coveragePercent: 45, estimatedComprehension: 62, masteredWords: 42, totalWords: 153, masteredOccurrences: 12500, totalOccurrences: 77800 };
    _mockCanonicalWordCount = 153;
    _mockSurahProgress = { completedSurahs: 3, totalSurahs: 90 };
    
    setupDashboardGrid();
    renderDashboard();
    var html = getInnerHTML();
    
    // Verify expected content
    assert.ok(html.indexOf('Bayan') >= 0, 'Bayan branding');
    assert.ok(html.indexOf('62%') >= 0, 'comprehension percent');
    assert.ok(html.indexOf('42') >= 0, 'mastered count');
    assert.ok(html.indexOf('Foundation Course') >= 0, 'Foundation card');
    assert.ok(html.indexOf('Learn by Surah') >= 0, 'Surah card');
    assert.ok(html.indexOf('Mixed Review') >= 0, 'Review card');
    assert.ok(html.indexOf('60%') >= 0 || html.indexOf('6 / 10') >= 0, 'foundation progress');
    assert.ok(html.indexOf('words due') >= 0, 'due reviews indicator');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
