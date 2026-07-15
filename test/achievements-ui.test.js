#!/usr/bin/env node
/**
 * achievements-ui.test.js — Unit tests for Profile Achievements UI
 *
 * Tests: renderProfileAchievements() output for all three states:
 *   - Completed (earned achievements with dates)
 *   - In Progress (category partially earned)
 *   - Locked (no progress in category)
 *   - Empty state (no achievements at all)
 *   - Progress summary with category breakdown
 *   - Edge cases: all locked, all earned, missing analytics
 *
 * Run: node test/achievements-ui.test.js
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

global.window = { __DEV__: false, __components: null, __analytics: null };
global.console = { log: console.log, warn: function() {}, error: function() {} };

// Mock DOM with a container that captures innerHTML
var _profileAchievementsContainer = null;

function _resetContainer() {
  _profileAchievementsContainer = {
    innerHTML: '',
    style: {},
    classList: { add: function() {}, remove: function() {}, contains: function() { return false; } },
    textContent: '',
    value: '',
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getAttribute: function() { return null; },
    setAttribute: function() {},
    removeAttribute: function() {},
    appendChild: function() {},
    focus: function() {},
    scrollIntoView: function() {},
    children: [],
    id: 'profile-achievements',
  };
}

global.document = {
  getElementById: function(id) {
    if (id === 'profile-achievements') return _profileAchievementsContainer;
    return null;
  },
  createElement: function(tag) {
    return {
      style: {},
      classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
      textContent: '',
      innerHTML: '',
      value: '',
      disabled: false,
      options: [],
      children: [],
      appendChild: function() {},
      remove: function() {},
      addEventListener: function() {},
      setAttribute: function() {},
      getAttribute: function() { return null; },
      removeAttribute: function() {},
      focus: function() {},
    };
  },
  activeElement: null,
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; },
  addEventListener: function() {},
};

// ═══════════════════════════════════════════════════════════════
// IMPORT PROFILE-UI MODULE
// ═══════════════════════════════════════════════════════════════

var profileUICode = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile-ui.js'), 'utf8');

try {
  eval(profileUICode);
} catch (e) {
  console.error('Failed to load profile-ui.js:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    _resetContainer();
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) { console.log('\n\ud83d\udccb ' + name); fn(); }

function rendered() {
  return _profileAchievementsContainer ? _profileAchievementsContainer.innerHTML : '';
}

// ═══════════════════════════════════════════════════════════════
// MOCK ACHIEVEMENT DATA
// ═══════════════════════════════════════════════════════════════

// 3 categories: foundation (2 earned, 1 locked), coverage (0 earned, 2 locked),
// mastery (1 earned, 1 locked) => 3 completed, 2 in-progress, 2 locked
var _mockAchievements = [
  // Foundation (2/3 earned)
  { id: 'foundation_first', title: 'First Steps', description: 'Complete first lesson', icon: '\ud83c\udf31', category: 'foundation', earned: true, earnedDate: '2026-07-01' },
  { id: 'foundation_half', title: 'Halfway There', description: 'Complete 5 lessons', icon: '\ud83d\udd25', category: 'foundation', earned: true, earnedDate: '2026-07-05' },
  { id: 'foundation_complete', title: 'Foundation Master', description: 'Complete all 10 lessons', icon: '\ud83d\udc51', category: 'foundation', earned: false, earnedDate: null },
  // Coverage (0/2 earned — truly locked)
  { id: 'coverage_10', title: 'Building Blocks', description: 'Reach 10% coverage', icon: '\ud83e\uddf1', category: 'coverage', earned: false, earnedDate: null },
  { id: 'coverage_25', title: 'Quarter Way', description: 'Reach 25% coverage', icon: '\ud83d\udcd6', category: 'coverage', earned: false, earnedDate: null },
  // Mastery (1/2 earned)
  { id: 'mastery_10', title: 'First Ten', description: 'Master 10 words', icon: '\ud83c\udf1f', category: 'mastery', earned: true, earnedDate: '2026-07-03' },
  { id: 'mastery_50', title: 'Vocab Builder', description: 'Master 50 words', icon: '\ud83d\udcda', category: 'mastery', earned: false, earnedDate: null },
];

var _mockStats = {
  earnedCount: 3,
  totalCount: 7,
  progressPercent: 42,
  byCategory: {
    foundation: { total: 3, earned: 2 },
    coverage: { total: 2, earned: 0 },
    mastery: { total: 2, earned: 1 },
  },
};

function _setMockData(achievements, stats) {
  window.__analytics = {
    getAllAchievements: function() { return achievements || _mockAchievements; },
    getAchievementStats: function() { return stats || _mockStats; },
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('renderProfileAchievements - Empty State', function() {
  test('renders empty state message when no achievements', function() {
    window.__analytics = {
      getAllAchievements: function() { return []; },
      getAchievementStats: function() { return null; },
    };
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('Complete your first lesson') >= 0, 'should show empty message');
    assert.ok(html.indexOf('profile-ach-empty') >= 0, 'should have empty state class');
  });
});

suite('renderProfileAchievements - Progress Summary', function() {
  test('renders premium progress summary card', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('profile-ach-summary') >= 0, 'should have summary container');
    assert.ok(html.indexOf('3 of 7') >= 0, 'should show earned/total count: 3 of 7');
    assert.ok(html.indexOf('42%') >= 0, 'should show percentage: 42%');
    assert.ok(html.indexOf('profile-ach-progress') >= 0, 'should have progress bar');
    assert.ok(html.indexOf('profile-ach-cats') >= 0, 'should have category breakdown');
    assert.ok(html.indexOf('Foundation') >= 0, 'should list Foundation category');
    assert.ok(html.indexOf('Coverage') >= 0, 'should list Coverage category');
    assert.ok(html.indexOf('Mastery') >= 0, 'should list Mastery category');
    assert.ok(html.indexOf('2/3') >= 0, 'should show Foundation 2/3');
    assert.ok(html.indexOf('0/2') >= 0, 'should show Coverage 0/2');
    assert.ok(html.indexOf('1/2') >= 0, 'should show Mastery 1/2');
  });
});

suite('renderProfileAchievements - Completed Section', function() {
  test('shows completed section with 3 earned achievements', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('Completed') >= 0, 'should have Completed section header');
    assert.ok(html.indexOf('First Steps') >= 0, 'should include First Steps');
    assert.ok(html.indexOf('Halfway There') >= 0, 'should include Halfway There');
    assert.ok(html.indexOf('First Ten') >= 0, 'should include First Ten');
    assert.ok(html.indexOf('2026-07-01') >= 0, 'should show earned date for First Steps');
    assert.ok(html.indexOf('2026-07-05') >= 0, 'should show earned date for Halfway There');
    assert.ok(html.indexOf('2026-07-03') >= 0, 'should show earned date for First Ten');
    assert.ok(html.indexOf('profile-ach-card earned') >= 0, 'earned cards should have earned class');
    // Ensure earned cards don't have conflicting state classes
    var earnedSection = html.substring(html.indexOf('Completed'), html.indexOf('In Progress'));
    assert.ok(earnedSection.indexOf('in-progress') < 0, 'earned cards should not have in-progress class');
    assert.ok(earnedSection.indexOf('locked') < 0, 'earned cards should not have locked class');
    assert.ok(html.indexOf('profile-ach-check') >= 0, 'completed cards should have checkmark');
  });

  test('completed card shows earned date with date prefix', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('Earned 2026') >= 0, 'earned date should have Earned prefix');
  });
});

suite('renderProfileAchievements - In Progress Section', function() {
  test('shows in-progress section for partially-completed categories', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('In Progress') >= 0, 'should have In Progress section header');

    // Foundation: 2/3 earned => remaining 1 is in-progress
    // Mastery: 1/2 earned => remaining 1 is in-progress
    assert.ok(html.indexOf('Foundation Master') >= 0, 'should show Foundation Master (in-progress)');
    assert.ok(html.indexOf('Vocab Builder') >= 0, 'should show Vocab Builder (in-progress)');

    assert.ok(html.indexOf('profile-ach-card in-progress') >= 0, 'in-progress cards should have in-progress class');
    assert.ok(html.indexOf('profile-ach-progress-row') >= 0, 'in-progress cards should have progress indicator');
    assert.ok(html.indexOf('In progress') >= 0, 'should have progress text');
  });
});

suite('renderProfileAchievements - Locked Section', function() {
  test('shows locked section for untouched categories', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('Locked') >= 0, 'should have Locked section header');

    // Coverage: 0/2 earned => both should be in Locked (not In Progress)
    assert.ok(html.indexOf('Building Blocks') >= 0, 'should show Building Blocks (locked)');
    assert.ok(html.indexOf('Quarter Way') >= 0, 'should show Quarter Way (locked)');
    assert.ok(html.indexOf('profile-ach-card locked') >= 0, 'locked cards should have locked class');

    // Ensure in-progress achievements do NOT appear in locked section
    var lockedSection = html.substring(html.indexOf('Locked'));
    assert.ok(lockedSection.indexOf('Foundation Master') < 0, 'Foundation Master should not be in locked section');
    assert.ok(lockedSection.indexOf('Vocab Builder') < 0, 'Vocab Builder should not be in locked section');
  });
});

suite('renderProfileAchievements - Missing Analytics', function() {
  test('gracefully handles null analytics module', function() {
    window.__analytics = null;
    renderProfileAchievements();
    var html = rendered();
    // Should render empty state since getAllAchievements is undefined => []
    assert.ok(html.indexOf('Complete your first lesson') >= 0, 'should show empty message when analytics is null');
  });

  test('gracefully handles missing getAchievementStats', function() {
    window.__analytics = {
      getAllAchievements: function() { return _mockAchievements; },
      getAchievementStats: null,
    };
    renderProfileAchievements();
    var html = rendered();
    // Should render summary without category breakdown
    assert.ok(html.indexOf('3 of 7') >= 0, 'should still show earned count without stats');
    assert.ok(html.indexOf('profile-ach-cats') < 0, 'should not show category breakdown when no stats');
  });
});

suite('renderProfileAchievements - Single Achievement', function() {
  test('handles single achievement (all earned)', function() {
    window.__analytics = {
      getAllAchievements: function() {
        return [{ id: 'only_one', title: 'Only One', description: 'Single', icon: '\u2b50', category: 'foundation', earned: true, earnedDate: '2026-07-01' }];
      },
      getAchievementStats: function() {
        return { earnedCount: 1, totalCount: 1, progressPercent: 100, byCategory: { foundation: { total: 1, earned: 1 } } };
      },
    };
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('1 of 1') >= 0, 'should show 1 of 1');
    assert.ok(html.indexOf('100%') >= 0, 'should show 100%');
    assert.ok(html.indexOf('Completed') >= 0, 'should have completed section');
    assert.ok(html.indexOf('Locked') < 0, 'should not have locked section when all earned');
  });
});

suite('renderProfileAchievements - Section Order', function() {
  test('orders sections: Completed first, then In Progress, then Locked', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    var idxCompleted = html.indexOf('Completed');
    var idxInProgress = html.indexOf('In Progress');
    var idxLocked = html.indexOf('Locked');

    assert.ok(idxCompleted >= 0, 'Completed section must exist');
    assert.ok(idxInProgress >= 0, 'In Progress section must exist');
    assert.ok(idxLocked >= 0, 'Locked section must exist');
    assert.ok(idxCompleted < idxInProgress, 'Completed should come before In Progress');
    assert.ok(idxInProgress < idxLocked, 'In Progress should come before Locked');
  });

  test('summary section appears before achievement sections', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    var idxSummary = html.indexOf('profile-ach-summary');
    var idxCompleted = html.indexOf('Completed');
    assert.ok(idxSummary >= 0, 'summary must exist');
    assert.ok(idxCompleted >= 0, 'completed section must exist');
    assert.ok(idxSummary < idxCompleted, 'summary should appear before completed section');
  });

  test('section headers show correct counts', function() {
    _setMockData();
    renderProfileAchievements();
    var html = rendered();
    // 3 earned => Completed count = 3
    // 2 in-progress => In Progress count = 2
    // 2 locked => Locked count = 2
    assert.ok(html.indexOf('profile-ach-section-count') >= 0, 'section headers should have count badges');
  });
});

suite('renderProfileAchievements - Edge Cases', function() {
  test('all achievements locked shows 0%, no completed section', function() {
    var allLocked = [
      { id: 'a1', title: 'Locked A', description: 'Desc A', icon: '\u2b50', category: 'foundation', earned: false, earnedDate: null },
      { id: 'a2', title: 'Locked B', description: 'Desc B', icon: '\u2b50', category: 'foundation', earned: false, earnedDate: null },
    ];
    window.__analytics = {
      getAllAchievements: function() { return allLocked; },
      getAchievementStats: function() { return { earnedCount: 0, totalCount: 2, progressPercent: 0, byCategory: { foundation: { total: 2, earned: 0 } } }; },
    };
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('0 of 2') >= 0, 'should show 0 of N');
    assert.ok(html.indexOf('0%') >= 0, 'should show 0%');
    assert.ok(html.indexOf('Completed') < 0, 'should not have completed section when all locked');
    assert.ok(html.indexOf('In Progress') < 0, 'should not have in-progress section when all locked');
    assert.ok(html.indexOf('Locked') >= 0, 'should have locked section');
  });

  test('all achievements earned shows 100%, no locked section', function() {
    var allEarned = [
      { id: 'b1', title: 'Earned A', description: 'Desc A', icon: '\u2b50', category: 'mastery', earned: true, earnedDate: '2026-07-01' },
      { id: 'b2', title: 'Earned B', description: 'Desc B', icon: '\u2b50', category: 'mastery', earned: true, earnedDate: '2026-07-02' },
    ];
    window.__analytics = {
      getAllAchievements: function() { return allEarned; },
      getAchievementStats: function() { return { earnedCount: 2, totalCount: 2, progressPercent: 100, byCategory: { mastery: { total: 2, earned: 2 } } }; },
    };
    renderProfileAchievements();
    var html = rendered();
    assert.ok(html.indexOf('100%') >= 0, 'should show 100%');
    assert.ok(html.indexOf('In Progress') < 0, 'should not have in-progress section when all earned');
    assert.ok(html.indexOf('Locked') < 0, 'should not have locked section');
    assert.ok(html.indexOf('Completed') >= 0, 'should have completed section');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
