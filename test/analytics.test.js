#!/usr/bin/env node
/**
 * analytics.test.js — Unit tests for the Analytics Engine
 *
 * Tests: daily snapshots, progress trends, forecasts, period summaries,
 * achievements, and helper functions.
 *
 * Run: node test/analytics.test.js
 */

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

const assert = require('assert');

// ── Mock localStorage ──
let _storage = {};
global.localStorage = {
  getItem: (key) => _storage[key] !== undefined ? _storage[key] : null,
  setItem: (key, val) => { _storage[key] = String(val); },
  removeItem: (key) => { delete _storage[key]; },
  clear: () => { _storage = {}; },
};

function clearStorage() { _storage = {}; }

// ── Mock state variables ──
let _mockSRS = {};
let _mockCanonicalWords = [];
let _mockQuizHistory = null;
let _mockFoundationCompleted = 0;
let _mockFoundationTotal = 10;
let _mockProfile = null;
let _mockRootMastery = null;
let _mockCoverage = null;
let _mockSRSStats = null;

function setMockSRS(data) { _mockSRS = data; }
function setMockWords(words) { _mockCanonicalWords = words; }

// ── Global functions that analytics.js expects ──
global.loadSRS = () => ({ ..._mockSRS });
global.getCanonicalWords = () => [..._mockCanonicalWords];
global.ALL_WORDS = [];
global.calculateCoverage = () => _mockCoverage ? { ..._mockCoverage } : null;
global.getCompletedFoundationLessonCount = () => _mockFoundationCompleted;
global.getFoundationLessonCount = () => _mockFoundationTotal;
global.estimateRetention = (entry) => {
  if (!entry || !entry.interval) return 0.9;
  return Math.max(0.5, Math.min(1.0, Math.exp(-entry.interval / 30)));
};
global.loadQuizHistory = () => _mockQuizHistory ? { ..._mockQuizHistory } : null;
global.getLearnerProfile = () => _mockProfile ? { ..._mockProfile } : null;
global.getRootFamilyMastery = () => _mockRootMastery ? { ..._mockRootMastery } : null;
global.getCompletedSurahCount = () => 0;
global.getCompletedDifficultyLevelCount = () => 0;
global.window = {
  __srs: { getStats: () => _mockSRSStats ? { ..._mockSRSStats } : null },
};

// ── Mock Date for deterministic tests ──
let _mockNow = new Date('2026-07-05T12:00:00Z').getTime();
const OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) {
    return new OriginalDate(_mockNow);
  }
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

function setMockDate(dateStr) {
  _mockNow = new OriginalDate(dateStr).getTime();
}

// ── Import analytics.js (evaluate it in this context) ──
const fs = require('fs');
const path = require('path');
const analyticsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'analytics.js'), 'utf8');
eval(analyticsCode);

const analytics = global.window.__analytics;

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) {
  console.log('\n\uD83D\uDCCB ' + name);
  fn();
}

function assertApprox(actual, expected, tolerance, msg) {
  var diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, msg + ': expected ' + expected + ' \u00B1' + tolerance + ', got ' + actual);
}

// ── Setup helpers ──
function setupDailySnapshot() {
  clearStorage();
  setMockDate('2026-07-05T12:00:00Z');
  setMockWords([{ id: 'w1', occ: 5 }, { id: 'w2', occ: 10 }, { id: 'w3', occ: 3 }]);
  setMockSRS({
    w1: { stage: 2, interval: 10, ratedAt: _mockNow - 1000 },
    w2: { stage: 0, interval: 0 },
    w3: { stage: 3, interval: 30, ratedAt: _mockNow - 5000 },
  });
  _mockCoverage = { coveragePercent: 42.5, estimatedComprehension: 65, masteredWords: 2, totalWords: 3, masteredOccurrences: 8, totalOccurrences: 18 };
  _mockFoundationCompleted = 3;
  _mockFoundationTotal = 10;
  _mockQuizHistory = { correct: 8, total: 10 };
}

function seedHistory(days, startDate, genFn) {
  var history = [];
  for (var i = 0; i < days; i++) {
    var d = new OriginalDate(startDate);
    d.setDate(d.getDate() + i);
    history.push(genFn(i, d));
  }
  localStorage.setItem('quran_analytics_history', JSON.stringify(history));
}

function setupTrends() {
  clearStorage();
  seedHistory(14, '2026-06-21', function(i) {
    return {
      date: function(i) { var d = new OriginalDate('2026-06-21'); d.setDate(d.getDate() + i); var m = d.getMonth() + 1; var day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day); }(i),
      masteredCount: 1 + i,
      studiedCount: 5 + i,
      coveragePercent: 10 + i * 2,
      comprehension: 30 + i,
      reviewsDone: Math.max(0, 10 - i),
      quizAccuracy: 70 + i,
      streak: i,
      foundationCompleted: Math.min(10, i),
      foundationTotal: 10,
      avgRetention: 80 + i,
    };
  });
}

function setupForecasts() {
  clearStorage();
  setMockWords([{ id: 'w1', occ: 5 }, { id: 'w2', occ: 10 }, { id: 'w3', occ: 3 }]);
  seedHistory(30, '2026-06-05', function(i) {
    var d = new OriginalDate('2026-06-05');
    d.setDate(d.getDate() + i);
    return {
      date: function(d2) { var m = d2.getMonth() + 1; var day = d2.getDate(); return d2.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day); }(d),
      masteredCount: 2 + i * 2,
      studiedCount: 5 + i,
      coveragePercent: 5 + i * 1.5,
      comprehension: 20 + i * 2,
      reviewsDone: 15,
      quizAccuracy: 80,
      streak: i,
      foundationCompleted: Math.min(10, Math.floor(i / 3)),
      foundationTotal: 10,
      avgRetention: 85,
    };
  });
  _mockFoundationCompleted = 9;
  _mockFoundationTotal = 10;
}

function setupPeriodSummaries() {
  clearStorage();
  setMockDate('2026-07-05T12:00:00Z');
  seedHistory(45, '2026-05-21', function(i) {
    var d = new OriginalDate('2026-05-21');
    d.setDate(d.getDate() + i);
    return {
      date: function(d2) { var m = d2.getMonth() + 1; var day = d2.getDate(); return d2.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day); }(d),
      masteredCount: 10 + i,
      studiedCount: 20 + i * 2,
      coveragePercent: 20 + i * 0.5,
      comprehension: 40 + i,
      reviewsDone: i % 7 === 0 ? 0 : 10 + (i % 5),
      quizAccuracy: 75 + (i % 15),
      streak: i,
      foundationCompleted: Math.min(10, Math.floor(i / 4)),
      foundationTotal: 10,
      avgRetention: 80,
    };
  });
}

function setupAchievements() {
  clearStorage();
  setMockSRS({});
  setMockWords([]);
  _mockProfile = null;
  _mockRootMastery = null;
  _mockFoundationCompleted = 0;
  _mockCoverage = null;
  _mockQuizHistory = { correct: 0, total: 0 };
  _mockSRSStats = { totalReviews: 0 };
  localStorage.removeItem('quran_streak');
}

function setupInsights() {
  clearStorage();
  setMockWords([{ id: 'w1', occ: 5 }]);
  setMockSRS({ w1: { stage: 2, interval: 10, ratedAt: _mockNow - 1000 } });
  _mockCoverage = { coveragePercent: 30 };
  _mockFoundationCompleted = 5;
  _mockProfile = { masteredWords: 10, studiedWords: 15, adaptiveDifficulty: 2, quizAccuracy: '80%', streak: 7 };
  seedHistory(10, '2026-06-25', function(i) {
    var d = new OriginalDate('2026-06-25');
    d.setDate(d.getDate() + i);
    return {
      date: function(d2) { var m = d2.getMonth() + 1; var day = d2.getDate(); return d2.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day); }(d),
      masteredCount: 1 + i,
      studiedCount: 5 + i,
      coveragePercent: 10 + i * 2,
      reviewsDone: 5,
      quizAccuracy: 80,
      foundationCompleted: Math.min(10, i),
      foundationTotal: 10,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Helper Functions', function() {
  test('formatDateLabel formats date string correctly', function() {
    assert.strictEqual(formatDateLabel('2026-7-5'), 'Jul 5');
    assert.strictEqual(formatDateLabel('2026-1-15'), 'Jan 15');
    assert.strictEqual(formatDateLabel('2026-12-25'), 'Dec 25');
  });

  test('formatDateKey formats Date object correctly', function() {
    var d = new OriginalDate('2026-07-05');
    assert.strictEqual(formatDateKey(d), '2026-07-05');
  });

  test('getDateKeyAnalytics returns today date string', function() {
    setMockDate('2026-07-05T10:00:00Z');
    assert.strictEqual(getDateKeyAnalytics(), '2026-07-05');
  });
});

// ── Daily Snapshots ──

suite('Daily Snapshots', function() {
  test('recordDailySnapshot creates a new entry', function() {
    setupDailySnapshot();
    analytics.recordDailySnapshot();
    var history = analytics.getHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].date, '2026-07-05');
    assert.strictEqual(history[0].masteredCount, 2);
    assert.strictEqual(history[0].studiedCount, 3);
    assert.strictEqual(history[0].coveragePercent, 42.5);
    assert.strictEqual(history[0].quizAccuracy, 80);
    assert.strictEqual(history[0].foundationCompleted, 3);
  });

  test('recordDailySnapshot updates existing entry for same day', function() {
    setupDailySnapshot();
    analytics.recordDailySnapshot();
    setMockSRS({
      w1: { stage: 3, interval: 20, ratedAt: _mockNow - 1000 },
      w2: { stage: 1, interval: 5, ratedAt: _mockNow - 2000 },
      w3: { stage: 3, interval: 30, ratedAt: _mockNow - 5000 },
    });
    _mockFoundationCompleted = 4;
    analytics.recordDailySnapshot();
    var history = analytics.getHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].masteredCount, 2);
    assert.strictEqual(history[0].foundationCompleted, 4);
  });

  test('recordDailySnapshot caps history at 365 entries', function() {
    setupDailySnapshot();
    for (var i = 0; i < 370; i++) {
      var d = new OriginalDate('2025-01-01');
      d.setDate(d.getDate() + i);
      setMockDate(d.toISOString());
      analytics.recordDailySnapshot();
    }
    assert.ok(analytics.getHistory().length <= 365);
  });

  test('snapshot captures reviews done today', function() {
    setupDailySnapshot();
    setMockSRS({
      w1: { stage: 2, interval: 10, ratedAt: _mockNow - 100 },
      w2: { stage: 1, interval: 5, ratedAt: _mockNow - 200 },
      w3: { stage: 3, interval: 30, ratedAt: _mockNow - 86400000 * 2 },
    });
    analytics.recordDailySnapshot();
    assert.strictEqual(analytics.getHistory()[0].reviewsDone, 2);
  });
});

// ── Trends ──

suite('Progress Trends', function() {
  test('getTrends returns null with no data', function() {
    clearStorage();
    assert.strictEqual(analytics.getTrends('7days'), null);
  });

  test('getTrends returns null with less than 2 entries', function() {
    clearStorage();
    localStorage.setItem('quran_analytics_history', JSON.stringify([{ date: '2026-7-5', masteredCount: 5 }]));
    assert.strictEqual(analytics.getTrends('7days'), null);
  });

  test('getTrends returns 7-day data structure', function() {
    setupTrends();
    var result = analytics.getTrends('7days');
    assert.ok(result !== null);
    assert.ok(Array.isArray(result.labels));
    assert.ok(Array.isArray(result.mastered));
    assert.ok(Array.isArray(result.coverage));
    assert.strictEqual(result.labels.length, result.mastered.length);
  });

  test('getTrends computes gainMastered correctly', function() {
    setupTrends();
    var result = analytics.getTrends('7days');
    assert.strictEqual(result.gainMastered, 6);
  });

  test('getTrends computes gainCoverage correctly', function() {
    setupTrends();
    var result = analytics.getTrends('7days');
    assert.strictEqual(parseFloat(result.gainCoverage), 12);
  });

  test('getTrends 30-day uses all available data', function() {
    setupTrends();
    var result = analytics.getTrends('30days');
    assert.ok(result !== null);
    assert.strictEqual(result.labels.length, 14);
  });

  test('getTrends counts active days correctly', function() {
    setupTrends();
    var result = analytics.getTrends('7days');
    assert.ok(result.daysActive > 0 && result.daysActive <= 7);
  });
});

// ── Forecasts ──

suite('Forecasts', function() {
  test('getForecasts returns null with less than 3 data points', function() {
    clearStorage();
    localStorage.setItem('quran_analytics_history', JSON.stringify([
      { date: '2026-7-5', masteredCount: 5 },
      { date: '2026-7-6', masteredCount: 6 },
    ]));
    assert.strictEqual(analytics.getForecasts(), null);
  });

  test('getForecasts returns prediction structure', function() {
    setupForecasts();
    var result = analytics.getForecasts();
    assert.ok(result !== null);
    assert.ok(result.predictedMastered !== undefined);
    assert.ok(result.predictedCoverage !== undefined);
    assert.ok(typeof result.masteryRatePerDay === 'number');
  });

  test('getForecasts predicts positive growth', function() {
    setupForecasts();
    var result = analytics.getForecasts();
    assert.ok(result.masteryRatePerDay > 0);
    assertApprox(result.masteryRatePerDay, 2.0, 0.5, 'masteryRatePerDay');
  });

  test('getForecasts 90-day > 30-day > 7-day predictions', function() {
    setupForecasts();
    var result = analytics.getForecasts();
    assert.ok(result.predictedMastered['90'] >= result.predictedMastered['30']);
    assert.ok(result.predictedMastered['30'] >= result.predictedMastered['7']);
  });

  test('getForecasts computes daysToFoundationCompletion', function() {
    setupForecasts();
    var result = analytics.getForecasts();
    assert.ok(result.daysToFoundationCompletion !== null && result.daysToFoundationCompletion > 0);
  });
});

// ── Period Summaries ──

suite('Period Summaries', function() {
  test('getPeriodSummaries returns week, month, allTime', function() {
    setupPeriodSummaries();
    var result = analytics.getPeriodSummaries();
    assert.ok(result !== null);
    assert.ok(result.week !== null);
    assert.ok(result.month !== null);
    assert.ok(result.allTime !== null);
  });

  test('getPeriodSummaries has consistency percentage', function() {
    setupPeriodSummaries();
    var result = analytics.getPeriodSummaries();
    assert.ok(typeof result.consistency === 'number');
    assert.ok(result.consistency >= 0 && result.consistency <= 100);
  });

  test('getPeriodSummaries aggregates totalReviews across periods', function() {
    setupPeriodSummaries();
    var result = analytics.getPeriodSummaries();
    assert.ok(result.month.totalReviews >= result.week.totalReviews);
    assert.ok(result.allTime.totalReviews >= result.month.totalReviews);
  });

  test('getPeriodSummaries returns null with no data', function() {
    clearStorage();
    assert.strictEqual(analytics.getPeriodSummaries(), null);
  });
});

// ── Achievements ──

suite('Achievements', function() {
  test('checkAchievements returns empty for new users', function() {
    setupAchievements();
    assert.strictEqual(analytics.checkAchievements().length, 0);
  });

  test('getAllAchievements returns 24 definitions with correct structure', function() {
    setupAchievements();
    var all = analytics.getAllAchievements();
    assert.strictEqual(all.length, 24);
    all.forEach(function(ach) {
      assert.ok(ach.id && ach.title && ach.category);
      assert.strictEqual(typeof ach.earned, 'boolean');
    });
  });

  test('getAchievementStats returns correct counts for clean state', function() {
    setupAchievements();
    var stats = analytics.getAchievementStats();
    assert.strictEqual(stats.totalCount, 24);
    assert.strictEqual(stats.earnedCount, 0);
    assert.strictEqual(stats.progressPercent, 0);
    assert.ok(stats.byCategory !== undefined);
  });

  test('foundation_first earns on 1 completed lesson', function() {
    setupAchievements();
    _mockFoundationCompleted = 1;
    assert.ok(analytics.checkAchievements().find(function(a) { return a.id === 'foundation_first'; }));
  });

  test('foundation_half earns on 5 completed lessons', function() {
    setupAchievements();
    _mockFoundationCompleted = 5;
    assert.ok(analytics.checkAchievements().find(function(a) { return a.id === 'foundation_half'; }));
  });

  test('foundation_complete earns when all done', function() {
    setupAchievements();
    _mockFoundationCompleted = 10;
    _mockFoundationTotal = 10;
    assert.ok(analytics.checkAchievements().find(function(a) { return a.id === 'foundation_complete'; }));
  });

  test('coverage achievements earn at milestones', function() {
    setupAchievements();
    _mockCoverage = { coveragePercent: 50 };
    var earned = analytics.checkAchievements();
    assert.ok(earned.find(function(a) { return a.id === 'coverage_10'; }));
    assert.ok(earned.find(function(a) { return a.id === 'coverage_25'; }));
    assert.ok(earned.find(function(a) { return a.id === 'coverage_50'; }));
    assert.strictEqual(earned.find(function(a) { return a.id === 'coverage_75'; }), undefined);
  });

  test('mastery achievements earn at milestones', function() {
    setupAchievements();
    _mockProfile = { masteredWords: 100 };
    var earned = analytics.checkAchievements();
    assert.ok(earned.find(function(a) { return a.id === 'mastery_10'; }));
    assert.ok(earned.find(function(a) { return a.id === 'mastery_50'; }));
    assert.ok(earned.find(function(a) { return a.id === 'mastery_100'; }));
    assert.strictEqual(earned.find(function(a) { return a.id === 'mastery_200'; }), undefined);
  });

  test('streak achievements earn at milestones', function() {
    setupAchievements();
    localStorage.setItem('quran_streak', JSON.stringify({ streak: 30, lastDate: '2026-7-5' }));
    var earned = analytics.checkAchievements();
    assert.ok(earned.find(function(a) { return a.id === 'streak_7'; }));
    assert.ok(earned.find(function(a) { return a.id === 'streak_30'; }));
    assert.strictEqual(earned.find(function(a) { return a.id === 'streak_100'; }), undefined);
  });

  test('review achievements earn at milestones', function() {
    setupAchievements();
    _mockSRSStats = { totalReviews: 500 };
    var earned = analytics.checkAchievements();
    assert.ok(earned.find(function(a) { return a.id === 'review_100'; }));
    assert.ok(earned.find(function(a) { return a.id === 'review_500'; }));
    assert.strictEqual(earned.find(function(a) { return a.id === 'review_1000'; }), undefined);
  });

  test('quiz achievements earn with high accuracy', function() {
    setupAchievements();
    _mockQuizHistory = { correct: 8, total: 10 };
    assert.ok(analytics.checkAchievements().find(function(a) { return a.id === 'quiz_10'; }));
  });

  test('quiz_perfect earns with 100% accuracy on 5+ questions', function() {
    setupAchievements();
    _mockQuizHistory = { correct: 10, total: 10 };
    assert.ok(analytics.checkAchievements().find(function(a) { return a.id === 'quiz_perfect'; }));
  });

  test('root achievements earn at milestones', function() {
    setupAchievements();
    _mockRootMastery = { fullyMasteredRoots: 20, totalRoots: 50 };
    var earned = analytics.checkAchievements();
    assert.ok(earned.find(function(a) { return a.id === 'root_5'; }));
    assert.ok(earned.find(function(a) { return a.id === 'root_20'; }));
  });

  test('achievements persist across calls', function() {
    setupAchievements();
    _mockFoundationCompleted = 1;
    analytics.checkAchievements();
    assert.strictEqual(analytics.checkAchievements().length, 0);
  });

  test('getAchievementStats returns earned count after earning', function() {
    setupAchievements();
    _mockFoundationCompleted = 10;
    _mockFoundationTotal = 10;
    _mockCoverage = { coveragePercent: 50 };
    analytics.checkAchievements();
    var stats = analytics.getAchievementStats();
    assert.ok(stats.earnedCount >= 4);
    assert.ok(stats.progressPercent > 0);
  });
});

// ── Comprehensive Insights ──

suite('Comprehensive Insights', function() {
  test('getComprehensiveInsights returns complete profile structure', function() {
    setupInsights();
    var insights = analytics.getComprehensiveInsights();
    assert.ok(insights.profile !== null);
    assert.ok(insights.periods !== null);
    assert.ok(insights.achievements !== null);
    assert.strictEqual(insights.profile.masteredWords, 10);
    assert.strictEqual(insights.profile.streak, 7);
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
