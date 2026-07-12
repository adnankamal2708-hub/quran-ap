// ═══════════════════════════════════════════════════════════════
// smart-learning.test.js — Smart Learning Engine Tests
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ── Load the smart learning engine ─────────────────────────────
const SLE_PATH = path.join(__dirname, '..', 'js', 'smart-learning-engine.js');
const SLE_CODE = fs.readFileSync(SLE_PATH, 'utf8');

// Mock the browser environment and existing modules
global.window = {
  __DEV__: false,
  __srs: null,
  __adaptive: null,
  __analytics: null,
  __smartLearning: null,
  __reader: null,
};

// Mock localStorage
var localStorageData = {};
global.localStorage = {
  getItem: function(key) { return localStorageData[key] || null; },
  setItem: function(key, val) { localStorageData[key] = String(val); },
  removeItem: function(key) { delete localStorageData[key]; },
  clear: function() { localStorageData = {}; },
};

// Mock ALL_WORDS with test data
global.ALL_WORDS = [
  { id: 'cw_0', arabic: 'الله', english: 'Allah', root: 'أ-ل-ه', rootMeaning: 'Deity', occ: 2699, difficulty: 1, typeCategory: 'noun', frequency: 'very-high', learningPriority: 1, foundationLessonId: 0 },
  { id: 'cw_1', arabic: 'رب', english: 'Lord', root: 'ر-ب-ب', rootMeaning: 'Lordship', occ: 980, difficulty: 1, typeCategory: 'noun', frequency: 'very-high', learningPriority: 1, foundationLessonId: 0 },
  { id: 'cw_2', arabic: 'رحمن', english: 'Most Gracious', root: 'ر-ح-م', rootMeaning: 'Mercy', occ: 57, difficulty: 2, typeCategory: 'adjective', frequency: 'high', learningPriority: 1, foundationLessonId: 0 },
  { id: 'cw_3', arabic: 'رحيم', english: 'Most Merciful', root: 'ر-ح-م', rootMeaning: 'Mercy', occ: 95, difficulty: 2, typeCategory: 'adjective', frequency: 'high', learningPriority: 1, foundationLessonId: 0 },
  { id: 'cw_4', arabic: 'ملك', english: 'King', root: 'م-ل-ك', rootMeaning: 'Kingship', occ: 50, difficulty: 2, typeCategory: 'noun', frequency: 'high', learningPriority: 2, foundationLessonId: 0 },
  { id: 'cw_5', arabic: 'يوم', english: 'Day', root: 'ي-و-م', rootMeaning: 'Day', occ: 475, difficulty: 1, typeCategory: 'noun', frequency: 'very-high', learningPriority: 1, foundationLessonId: 0 },
  { id: 'cw_6', arabic: 'دين', english: 'Judgment', root: 'د-ي-ن', rootMeaning: 'Judgment', occ: 95, difficulty: 2, typeCategory: 'noun', frequency: 'high', learningPriority: 1, foundationLessonId: 1 },
  { id: 'cw_7', arabic: 'نعبد', english: 'We worship', root: 'ع-ب-د', rootMeaning: 'Worship', occ: 30, difficulty: 3, typeCategory: 'verb', frequency: 'medium', learningPriority: 2, foundationLessonId: 1 },
  { id: 'cw_8', arabic: 'نستعين', english: 'We seek help', root: 'ع-و-ن', rootMeaning: 'Help', occ: 25, difficulty: 3, typeCategory: 'verb', frequency: 'medium', learningPriority: 2, foundationLessonId: 1 },
  { id: 'cw_9', arabic: 'صراط', english: 'Path', root: 'ص-ر-ط', rootMeaning: 'Path', occ: 45, difficulty: 2, typeCategory: 'noun', frequency: 'high', learningPriority: 1, foundationLessonId: 1 },
];

// Mock SRS data
global.loadSRS = function() {
  try {
    var raw = global.localStorage.getItem('quran_srs_data');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

global.DAY_MS = 24 * 60 * 60 * 1000;

// Mock foundation course functions
global.FOUNDATION_LESSONS = [
  { id: 1, label: 'Foundation 1', wordIds: ['cw_0','cw_1','cw_2','cw_3','cw_4','cw_5','cw_6','cw_7','cw_8','cw_9'] },
];

global.getFoundationLessonCount = function() { return global.FOUNDATION_LESSONS.length || 10; };
global.getCompletedFoundationLessonCount = function() { return 1; };
global.getFoundationLessonWords = function(idx) {
  if (idx === 0) return global.ALL_WORDS; // all words are lesson 0
  return global.ALL_WORDS;
};
global.getNextIncompleteFoundationLesson = function() { return 1; };
global.getFoundationRetention = function() { return 85; };
global.getTotalQuranOccurrences = function() { return 4551; };
global.getCanonicalWords = function() { return global.ALL_WORDS; };
global.getCanonicalWordCount = function() { return global.ALL_WORDS.length; };
global.getSurahComprehension = function(surahId) { return null; };
global.getAllSurahComprehension = function() { return []; };
global.isFoundationLessonCompleted = function(idx) { return idx < 1; };
global.getCurrentFoundationLessonIndex = function() { return 1; };
global.estimateRetention = function(entry) { return 0.85; };
global.loadStreakData = function() { return { streak: 3, lastDate: new Date().toISOString().split('T')[0] }; };

// Mock weak roots
global.getLearnerProfile = function() {
  return {
    weakRoots: [
      { root: 'ع-ب-د', rootMeaning: 'Worship', masteryScore: 25, total: 3, mastered: 1, dueCount: 2 },
      { root: 'م-ل-ك', rootMeaning: 'Kingship', masteryScore: 40, total: 2, mastered: 1, dueCount: 1 },
    ],
    strongRoots: [
      { root: 'أ-ل-ه', rootMeaning: 'Deity', masteryScore: 90, total: 2, mastered: 2 },
    ],
    confusedWords: [],
  };
};

// Mock analytic functions
global.window.__analytics = {
  getFrequentlyForgotten: function() {
    return [
      { arabic: 'نعبد', english: 'We worship', lapseRate: 45, totalReviews: 5, isLeech: false },
      { arabic: 'نستعين', english: 'We seek help', lapseRate: 40, totalReviews: 4, isLeech: false },
    ];
  },
};

// Mock surah functions
global.getSurahsWithVocabulary = function() { return [1, 36, 67, 112]; };
global.getSurahInfo = function(id) {
  var info = {
    1: { name: 'Al-Fatiha', english: 'The Opening', verses: 7 },
    36: { name: 'Ya-Seen', english: 'Ya Seen', verses: 83 },
    67: { name: 'Al-Mulk', english: 'The Sovereignty', verses: 30 },
    112: { name: 'Al-Ikhlas', english: 'Sincerity', verses: 4 },
  };
  return info[id] || null;
};
global.getSurahWords = function(id) { return global.ALL_WORDS; };
global.isSurahCompleted = function(id) { return id === 1; };
global.getCompletedSurahCount = function() { return 1; };
global.getRootFamilyWords = function(rootKey) {
  return global.ALL_WORDS.filter(function(w) { return w.root === rootKey; });
};
global.findWordById = function(id) {
  for (var i = 0; i < global.ALL_WORDS.length; i++) {
    if (global.ALL_WORDS[i].id === id) return global.ALL_WORDS[i];
  }
  return null;
};
global.getAllFoundationWords = function() { return global.ALL_WORDS; };

var testsPassed = 0;
var testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log('  ✓ ' + message);
  } else {
    testsFailed++;
    console.log('  ✗ FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    testsPassed++;
    console.log('  ✓ ' + message + ' (' + actual + ')');
  } else {
    testsFailed++;
    console.log('  ✗ FAIL: ' + message + ' — expected "' + expected + '", got "' + actual + '"');
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) <= tolerance) {
    testsPassed++;
    console.log('  ✓ ' + message + ' (' + actual + ')');
  } else {
    testsFailed++;
    console.log('  ✗ FAIL: ' + message + ' — expected ~' + expected + ', got ' + actual);
  }
}

// ── Load the Smart Learning Engine ──────────────────────────────
console.log('\n📚 Smart Learning Engine Tests\n');
console.log('  Loading engine...');

try {
  // Evaluate the engine code to define all functions
  eval(SLE_CODE);
  console.log('  Engine loaded successfully.\n');
} catch (e) {
  console.log('  ✗ Engine failed to load: ' + e.message);
  process.exit(1);
}

// ── Test 1: gatherLearningContext() ────────────────────────────
console.log('── Context Gathering ──');

var ctx = null;
try {
  ctx = gatherLearningContext();
  assert(ctx !== null, 'Context object created');
  assertEqual(typeof ctx, 'object', 'Context is an object');
} catch (e) {
  assert(false, 'gatherLearningContext() does not throw: ' + e.message);
}

if (ctx) {
  assert(typeof ctx.dueCount === 'number', 'ctx.dueCount is a number');
  assert(typeof ctx.totalStudied === 'number', 'ctx.totalStudied is a number');
  assert(typeof ctx.foundationTotal === 'number', 'ctx.foundationTotal is a number');
  assert(Array.isArray(ctx.forgottenWords), 'ctx.forgottenWords is an array');
  assert(Array.isArray(ctx.weakRoots), 'ctx.weakRoots is an array');
}

// ── Test 2: scoreRecommendation() ──────────────────────────────
console.log('\n── Scoring Algorithm ──');

try {
  var scoreResult = scoreRecommendation('review-due', ctx);
  assert(scoreResult !== null, 'scoreRecommendation returns result');
  assert(typeof scoreResult.score === 'number', 'Score is a number');
  assert(scoreResult.score >= 0 && scoreResult.score <= 100, 'Score is between 0-100');
  assert(Array.isArray(scoreResult.breakdown), 'Breakdown is an array');

  // Test all recommendation types
  var types = ['review-due', 'weak-vocabulary', 'weak-roots', 'low-comprehension-surahs', 'continue-learning', 'foundation-reinforcement', 'reading-recommendation'];
  for (var ti = 0; ti < types.length; ti++) {
    var s = scoreRecommendation(types[ti], ctx);
    assert(typeof s.score === 'number' && s.score >= 0 && s.score <= 100, types[ti] + ' returns 0-100 score');
  }
} catch (e) {
  assert(false, 'scoreRecommendation does not throw: ' + e.message);
}

// ── Test 3: getScoredRecommendations() ─────────────────────────
console.log('\n── Scored Recommendations ──');

try {
  var recs = getScoredRecommendations();
  assert(Array.isArray(recs), 'returns an array');
  assert(recs.length > 0, 'returns at least 1 recommendation');

  // Verify each recommendation has required fields
  for (var ri = 0; ri < recs.length; ri++) {
    var r = recs[ri];
    assert(typeof r.id === 'string', 'rec ' + ri + ' has id: ' + r.id);
    assert(typeof r.title === 'string' && r.title.length > 0, 'rec ' + ri + ' has non-empty title');
    assert(typeof r.message === 'string' && r.message.length > 0, 'rec ' + ri + ' has non-empty message');
    assert(typeof r.score === 'number' && r.score >= 0 && r.score <= 100, 'rec ' + ri + ' score is 0-100');
    assert(typeof r.priority === 'string', 'rec ' + ri + ' has priority string');
    assert(typeof r.actionType === 'string', 'rec ' + ri + ' has actionType');
    assert(typeof r.dismissible === 'boolean', 'rec ' + ri + ' has dismissible boolean');
  }

  // Verify sorted by score descending
  var sorted = true;
  for (var si = 1; si < recs.length; si++) {
    if (recs[si].score > recs[si - 1].score) { sorted = false; break; }
  }
  assert(sorted, 'recommendations sorted by score descending');

  // Verify review-due is present (we have no SRS data so dueCount should be 0, but continue-learning should be present)
  var hasContinue = recs.some(function(r) { return r.type === 'continue-learning'; });
  assert(hasContinue, 'continue-learning recommendation present');
} catch (e) {
  assert(false, 'getScoredRecommendations does not throw: ' + e.message);
}

// ── Test 4: getDailyFocusPlan() ────────────────────────────────
console.log('\n── Daily Focus Plan ──');

try {
  var plan = getDailyFocusPlan();
  assert(Array.isArray(plan), 'returns an array');
  assert(plan.length > 0, 'returns at least 1 task');

  for (var pi = 0; pi < plan.length; pi++) {
    var task = plan[pi];
    assert(typeof task.id === 'string', 'task ' + pi + ' has id');
    assert(typeof task.label === 'string' && task.label.length > 0, 'task ' + pi + ' has non-empty label');
    assert(typeof task.type === 'string', 'task ' + pi + ' has type');
    assert(typeof task.priority === 'string', 'task ' + pi + ' has priority');
    assert(typeof task.done === 'function', 'task ' + pi + ' has done() function');
  }

  // Verify sorted by score descending
  var sortedPlan = true;
  for (var sj = 1; sj < plan.length; sj++) {
    if (plan[sj].score > plan[sj - 1].score) { sortedPlan = false; break; }
  }
  assert(sortedPlan, 'plan tasks sorted by score descending');
} catch (e) {
  assert(false, 'getDailyFocusPlan does not throw: ' + e.message);
}

// ── Test 5: getFoundationRetentionStatus() ─────────────────────
console.log('\n── Foundation Retention ──');

try {
  var retention = getFoundationRetentionStatus();
  assert(retention !== null, 'returns a value');
  assert(typeof retention.overallRetention === 'number', 'overallRetention is a number');
  assert(Array.isArray(retention.lessons), 'lessons is an array');
  assert(Array.isArray(retention.atRiskLessons), 'atRiskLessons is an array');
} catch (e) {
  assert(false, 'getFoundationRetentionStatus does not throw: ' + e.message);
}

// ── Test 6: getReadingSessionRecommendations() ─────────────────
console.log('\n── Reading Mode Integration ──');

// Mock reader with no reading activity
try {
  var readingRecs = getReadingSessionRecommendations();
  // Should return null since no reading activity is tracked
  assert(readingRecs === null, 'returns null when no reading activity');
} catch (e) {
  assert(false, 'getReadingSessionRecommendations does not throw: ' + e.message);
}

// With reading activity
global.window.__reader = {
  getLastReadPosition: function() {
    return {
      surahId: 1,
      verseKey: '1:3',
      date: Date.now() - 3600000, // 1 hour ago
      encounteredWordIds: ['cw_0', 'cw_1', 'cw_2', 'cw_7', 'cw_8'],
      sessionWordIds: ['cw_0', 'cw_1', 'cw_7'],
    };
  },
  getEncounteredWordIds: function() { return ['cw_0', 'cw_1', 'cw_2', 'cw_7', 'cw_8']; },
};

try {
  // Recompute context with reader data
  var ctxWithReading = gatherLearningContext();
  assert(ctxWithReading.hasRecentReadingActivity === true, 'detects recent reading activity');
  assert(ctxWithReading.readingEncounteredWords.length > 0, 'reading encountered words populated');
  assert(ctxWithReading.readingRootsEncountered.length > 0, 'reading roots populated');

  // Now get recommendations
  var readingRecs = getReadingSessionRecommendations();
  assert(readingRecs !== null, 'returns recommendations when reading activity present');
  assert(readingRecs.newWordCount >= 0, 'newWordCount is a number');
  assert(Array.isArray(readingRecs.recommendations), 'recommendations array present');
  assert(readingRecs.recommendations.length > 0, 'has at least 1 recommendation');
} catch (e) {
  assert(false, 'Reading integration does not throw: ' + e.message);
}

// ── Test 7: getSmartLearningDashboardData() ────────────────────
console.log('\n── Dashboard Data ──');

try {
  var data = getSmartLearningDashboardData();
  assert(data !== null, 'returns a value');
  assert(Array.isArray(data.recommendations), 'recommendations is an array');
  assert(Array.isArray(data.dailyPlan), 'dailyPlan is an array');
  assert(data.foundationRetention !== null, 'foundationRetention is present');
} catch (e) {
  assert(false, 'getSmartLearningDashboardData does not throw: ' + e.message);
}

// ── Test 8: Determinism (same input = same output) ─────────────
console.log('\n── Determinism ──');

try {
  var recs1 = getScoredRecommendations();
  var recs2 = getScoredRecommendations();

  assert(recs1.length === recs2.length, 'same number of recommendations on repeated calls');

  // Check scores are deterministic
  for (var di = 0; di < recs1.length && di < recs2.length; di++) {
    assertEqual(recs1[di].score, recs2[di].score, 'Score for "' + recs1[di].title + '" is deterministic');
  }
} catch (e) {
  assert(false, 'Determinism test does not throw: ' + e.message);
}

// ── Test 9: Edge Cases ────────────────────────────────────────
console.log('\n── Edge Cases ──');

// Empty data
try {
  // Clear SRS data
  global.localStorage.removeItem('quran_srs_data');
  var emptyCtx = gatherLearningContext();
  assert(emptyCtx.dueCount === 0, 'dueCount is 0 when no SRS data');
  assert(emptyCtx.totalStudied === 0, 'totalStudied is 0 when no SRS data');

  var emptyRecs = getScoredRecommendations();
  assert(Array.isArray(emptyRecs), 'recommendations still return array with empty data');
  assert(emptyRecs.length > 0, 'still has recommendations (continue-learning for new users)');
} catch (e) {
  assert(false, 'Empty data handling does not throw: ' + e.message);
}

// Reset SRS data with some entries
var now = Date.now();
var srsData = {};
srsData['cw_0'] = { stage: 3, dueDate: now + 86400000, interval: 30, easeFactor: 2.5, ratedAt: now - 86400000, reps: 10, totalReviews: 15, lapses: 1, leechCount: 0, isLeech: false };
srsData['cw_1'] = { stage: 2, dueDate: now - 43200000, interval: 7, easeFactor: 2.3, ratedAt: now - 86400000, reps: 5, totalReviews: 8, lapses: 2, leechCount: 0, isLeech: false };
srsData['cw_2'] = { stage: 1, dueDate: now - 259200000, interval: 2, easeFactor: 2.0, ratedAt: now - 86400000, reps: 3, totalReviews: 5, lapses: 3, leechCount: 1, isLeech: true };
srsData['cw_3'] = { stage: 0, dueDate: now - 604800000, interval: 1, easeFactor: 1.8, ratedAt: now - 604800000, reps: 2, totalReviews: 3, lapses: 3, leechCount: 0, isLeech: false };
global.localStorage.setItem('quran_srs_data', JSON.stringify(srsData));

try {
  var populatedCtx = gatherLearningContext();
  assert(populatedCtx.dueCount >= 2, 'dueCount detects overdue words');
  assert(populatedCtx.overdueCount >= 1, 'overdueCount detects critically overdue words');
  assert(populatedCtx.leechCount >= 1, 'leechCount detects leeched words');
  assert(populatedCtx.totalStudied >= 4, 'totalStudied counts words with entries');
} catch (e) {
  assert(false, 'Populated data context does not throw: ' + e.message);
}

// ── Test 10: Foundation reinforcement detection ────────────────
console.log('\n── Foundation Detection ──');

try {
  global.getCompletedFoundationLessonCount = function() { return 0; };
  var ctx2 = gatherLearningContext();
  var recs3 = getScoredRecommendations();
  var hasRec = recs3.some(function(r) { return r.type === 'foundation-reinforcement'; });
  // Because foundationTotal > 0 and completed = 0, we should have continue-learning
  var hasCont = recs3.some(function(r) { return r.type === 'continue-learning'; });
  assert(hasCont, 'continue-learning recommended when foundation not started');
} catch (e) {
  assert(false, 'Foundation detection does not throw: ' + e.message);
}

// Reset
global.getCompletedFoundationLessonCount = function() { return 1; };
global.getNextIncompleteFoundationLesson = function() { return 1; };

// ── Summary ────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(40));
var total = testsPassed + testsFailed;
var pct = total > 0 ? Math.round((testsPassed / total) * 100) : 0;
console.log('Results: ' + testsPassed + '/' + total + ' passed (' + pct + '%)');
if (testsFailed === 0) {
  console.log('All Smart Learning Engine tests passed! ✓');
} else {
  console.log(testsFailed + ' test(s) FAILED ✗');
  process.exit(1);
}
