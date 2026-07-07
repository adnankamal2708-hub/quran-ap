#!/usr/bin/env node
/**
 * foundation-course.test.js — Foundation Course Unit Tests
 *
 * Tests the core Foundation Course logic in js/data.js:
 *   - Progress state management (localStorage)
 *   - Course construction (buildFoundationCourse)
 *   - Coverage calculations (calculateCoverage, getFoundationCoverage)
 *   - Milestone tracking (getMilestoneStatus)
 *   - Enriched metadata
 *   - Data integrity of constants
 *
 * Run: node test/foundation-course.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
var _elementsById = {};
var _nextUid = 0;

function clearStorage() { _storage = {}; }

global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

// Mock Date (deterministic)
var OriginalDate = global.Date;
var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

// Mock DOM
function makeEl(tag) {
  return { _tag: tag || 'div', _id: '', _innerHTML: '', _style: {}, _onclick: null, children: [], parentNode: null,
    setAttribute: function() {}, getAttribute: function() { return null; },
    appendChild: function(c) { c.parentNode = this; this.children.push(c); },
    removeChild: function(c) { var i = this.children.indexOf(c); if(i>=0) { this.children.splice(i,1); c.parentNode=null; } },
    focus: function() {}, click: function() { if(typeof this._onclick==='function') this._onclick(); },
    get id() { return this._id; },
    set id(v) { this._id = v; if(v) _elementsById[v] = this; },
  };
}
global.document = {
  getElementById: function(id) { return _elementsById[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
  addEventListener: function() {},
};

global.window = {};

// ═══════════════════════════════════════════════════════════════
// HELPER: Create test canonical words
// ═══════════════════════════════════════════════════════════════

function makeCanonicalWords(count) {
  var words = [];
  for (var i = 0; i < count; i++) {
    var occ = Math.max(1, Math.round(5000 * (1 - i / count)));
    var rootIdx = i % 20;
    var diff = (i % 5) + 1;
    var typeIdx = i % 4;
    var types = ['noun', 'verb', 'particle', 'adjective'];
    words.push({
      id: 'cw_' + i,
      arabic: '\u0643\u0644\u0645\u0629_' + i,
      english: 'word_' + i,
      translit: 'kalima_' + i,
      occ: occ,
      root: 'root_' + rootIdx,
      rootMeaning: 'meaning_of_root_' + rootIdx,
      typeCategory: types[typeIdx],
      difficulty: diff,
      frequency: occ > 2000 ? 'very-high' : occ > 1000 ? 'high' : occ > 500 ? 'medium' : 'low',
      tags: ['test'],
      surahIds: [1, 2, 3],
      occurrences: [
        { surahId: 1, verseKey: '1:1', ayahA: 'test', ayahT: 'test' },
      ],
      similarWords: [],
      oppositeWords: [],
      relatedWords: [],
      rootFamily: [],
    });
  }
  return words;
}

// ═══════════════════════════════════════════════════════════════
// EVAL data.js to make functions available globally
// ═══════════════════════════════════════════════════════════════

var dataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
dataCode = dataCode.replace(/\bconst\s+/g, 'var ');
dataCode = dataCode.replace(/\blet\s+/g, 'var ');
global.eval(dataCode);

// ═══════════════════════════════════════════════════════════════
// MOCK GLOBAL DEPENDENCIES
// ═══════════════════════════════════════════════════════════════

var _mockSRS = {};

global.loadSRS = function() { return JSON.parse(JSON.stringify(_mockSRS)); };
global.saveSRS = function(data) { _mockSRS = JSON.parse(JSON.stringify(data)); };
global.getCurrentUser = function() { return null; };
global.getSurahsWithVocabulary = function() {
  return typeof CANONICAL_WORDS !== 'undefined' && CANONICAL_WORDS.length > 0
    ? [1, 2, 3] : [];
};

global.window.__sync = { queueSync: function() {} };

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP: Build foundation course once before all tests
// ═══════════════════════════════════════════════════════════════

// Populate CANONICAL_WORDS with 150 test words
var testWords = makeCanonicalWords(150);
CANONICAL_WORDS.length = 0;
for (var bi = 0; bi < testWords.length; bi++) {
  CANONICAL_WORDS.push(testWords[bi]);
}
// Build the foundation course so all progress functions work
buildFoundationCourse();

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { clearStorage(); _elementsById = {}; _mockSRS = {}; fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + (e.message || e).split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// DATA INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════════

suite('Data Integrity — Constants', function() {
  test('FOUNDATION_LESSON_COUNT is 10', function() {
    assert.strictEqual(FOUNDATION_LESSON_COUNT, 10);
  });

  test('FOUNDATION_WORDS_PER_LESSON is 10', function() {
    assert.strictEqual(FOUNDATION_WORDS_PER_LESSON, 10);
  });

  test('COVERAGE_MILESTONES has 12 entries sorted ascending by pct', function() {
    assert.ok(Array.isArray(COVERAGE_MILESTONES));
    assert.strictEqual(COVERAGE_MILESTONES.length, 12);
    for (var mi = 1; mi < COVERAGE_MILESTONES.length; mi++) {
      assert.ok(COVERAGE_MILESTONES[mi].pct > COVERAGE_MILESTONES[mi-1].pct);
    }
  });

  test('Each milestone has label, icon, and insight', function() {
    COVERAGE_MILESTONES.forEach(function(m, i) {
      assert.ok(typeof m.label === 'string' && m.label.length > 0, 'Milestone ' + i + ' missing label');
      assert.ok(typeof m.icon === 'string' && m.icon.length > 0, 'Milestone ' + i + ' missing icon');
      assert.ok(typeof m.insight === 'string' && m.insight.length > 0, 'Milestone ' + i + ' missing insight');
    });
  });

  test('FOUNDATION_MODE constant is \"foundation\"', function() {
    assert.strictEqual(FOUNDATION_MODE, 'foundation');
  });

  test('First milestone is 5% and last is 100%', function() {
    assert.strictEqual(COVERAGE_MILESTONES[0].pct, 5);
    assert.strictEqual(COVERAGE_MILESTONES[11].pct, 100);
  });
});

// ═══════════════════════════════════════════════════════════════
// FOUNDATION PROGRESS STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

suite('Foundation Progress — Default State', function() {
  test('getDefaultFoundationProgress returns expected structure', function() {
    var prog = getDefaultFoundationProgress();
    assert.strictEqual(prog.currentLesson, 0);
    assert.ok(Array.isArray(prog.completedLessons));
    assert.strictEqual(prog.completedLessons.length, 0);
    assert.ok(typeof prog.quizPassed === 'object');
    assert.strictEqual(Object.keys(prog.quizPassed).length, 0);
  });
});

suite('Foundation Progress — loadFoundationProgress', function() {
  test('Returns defaults when localStorage is empty', function() {
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.currentLesson, 0);
    assert.strictEqual(prog.completedLessons.length, 0);
  });

  test('Returns saved data from localStorage', function() {
    localStorage.setItem('quran_foundation_progress', JSON.stringify({
      currentLesson: 3, completedLessons: [0, 1, 2], quizPassed: { '0': true },
    }));
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.currentLesson, 3);
    assert.strictEqual(prog.completedLessons.length, 3);
    assert.strictEqual(prog.quizPassed['0'], true);
  });

  test('Handles corrupted JSON gracefully', function() {
    localStorage.setItem('quran_foundation_progress', '{bad json}');
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.currentLesson, 0);
  });

  test('Handles empty string gracefully', function() {
    localStorage.setItem('quran_foundation_progress', '');
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.currentLesson, 0);
  });
});

suite('Foundation Progress — saveFoundationProgress', function() {
  test('Persists data to localStorage', function() {
    saveFoundationProgress({ currentLesson: 5, completedLessons: [0,1,2,3,4], quizPassed: {} });
    var parsed = JSON.parse(localStorage.getItem('quran_foundation_progress'));
    assert.strictEqual(parsed.currentLesson, 5);
    assert.strictEqual(parsed.completedLessons.length, 5);
  });
});

suite('Foundation Progress — isFoundationLessonCompleted', function() {
  test('Returns false for lesson 0 when nothing completed', function() {
    assert.strictEqual(isFoundationLessonCompleted(0), false);
  });

  test('Returns true after completing the lesson', function() {
    saveFoundationProgress({ currentLesson: 1, completedLessons: [0], quizPassed: { '0': true } });
    assert.strictEqual(isFoundationLessonCompleted(0), true);
    assert.strictEqual(isFoundationLessonCompleted(1), false);
  });

  test('Returns false for negative index', function() {
    assert.strictEqual(isFoundationLessonCompleted(-1), false);
  });
});

suite('Foundation Progress — isFoundationLessonUnlocked', function() {
  test('Lesson 0 is always unlocked', function() {
    assert.strictEqual(isFoundationLessonUnlocked(0), true);
  });

  test('Lesson 1 is locked when lesson 0 is not completed', function() {
    assert.strictEqual(isFoundationLessonUnlocked(1), false);
  });

  test('Lesson 1 is unlocked when lesson 0 is completed', function() {
    saveFoundationProgress({ currentLesson: 1, completedLessons: [0], quizPassed: { '0': true } });
    assert.strictEqual(isFoundationLessonUnlocked(1), true);
  });

  test('Sequential unlocking: lesson 2 needs lesson 1', function() {
    saveFoundationProgress({ currentLesson: 1, completedLessons: [0], quizPassed: { '0': true } });
    assert.strictEqual(isFoundationLessonUnlocked(2), false);
  });

  test('All lessons before a completed lesson are unlocked', function() {
    saveFoundationProgress({ currentLesson: 5, completedLessons: [0,1,2,3,4], quizPassed: {} });
    for (var i = 0; i <= 5; i++) {
      assert.strictEqual(isFoundationLessonUnlocked(i), true, 'Lesson ' + i + ' should be unlocked');
    }
    assert.strictEqual(isFoundationLessonUnlocked(6), false);
  });
});

suite('Foundation Progress — getNextIncompleteFoundationLesson', function() {
  test('Returns 0 when nothing completed', function() {
    assert.strictEqual(getNextIncompleteFoundationLesson(), 0);
  });

  test('Returns 1 after lesson 0 completed', function() {
    saveFoundationProgress({ currentLesson: 1, completedLessons: [0], quizPassed: { '0': true } });
    assert.strictEqual(getNextIncompleteFoundationLesson(), 1);
  });

  test('Returns 0 when all 10 lessons completed (loops around)', function() {
    saveFoundationProgress({
      currentLesson: 0, completedLessons: [0,1,2,3,4,5,6,7,8,9], quizPassed: {},
    });
    assert.strictEqual(getNextIncompleteFoundationLesson(), 0);
  });
});

suite('Foundation Progress — completeFoundationLesson', function() {
  test('Marks lesson as completed and advances to next', function() {
    completeFoundationLesson(0);
    var prog = loadFoundationProgress();
    assert.ok(prog.completedLessons.indexOf(0) >= 0, 'Lesson 0 should be in completedLessons');
    assert.strictEqual(prog.currentLesson, 1, 'Should advance to lesson 1');
    assert.strictEqual(prog.quizPassed['0'], true, 'Quiz should be marked passed');
  });

  test('Can complete lessons sequentially without duplicates', function() {
    for (var li = 0; li < 5; li++) {
      completeFoundationLesson(li);
    }
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.completedLessons.length, 5, 'Should have 5 unique completed lessons');
    assert.strictEqual(prog.currentLesson, 5, 'Should advance to lesson 5');
  });

  test('Re-completing same lesson does not duplicate', function() {
    completeFoundationLesson(0);
    completeFoundationLesson(0);
    var prog = loadFoundationProgress();
    assert.strictEqual(prog.completedLessons.length, 1);
  });
});

suite('Foundation Progress — getCurrentFoundationLessonIndex', function() {
  test('Returns 0 by default', function() {
    assert.strictEqual(getCurrentFoundationLessonIndex(), 0);
  });

  test('Returns saved current lesson', function() {
    saveFoundationProgress({ currentLesson: 7, completedLessons: [], quizPassed: {} });
    assert.strictEqual(getCurrentFoundationLessonIndex(), 7);
  });
});

suite('Foundation Progress — setCurrentFoundationLesson', function() {
  test('Sets current lesson within bounds', function() {
    setCurrentFoundationLesson(3);
    assert.strictEqual(getCurrentFoundationLessonIndex(), 3);
  });

  test('Ignores negative indices', function() {
    setCurrentFoundationLesson(-1);
    assert.strictEqual(getCurrentFoundationLessonIndex(), 0);
  });

  test('Ignores out-of-bounds indices', function() {
    setCurrentFoundationLesson(999);
    assert.strictEqual(getCurrentFoundationLessonIndex(), 0);
  });
});

suite('Foundation Progress — getCompletedFoundationLessonCount', function() {
  test('Returns 0 when no lessons completed', function() {
    assert.strictEqual(getCompletedFoundationLessonCount(), 0);
  });

  test('Returns correct count after completing lessons', function() {
    completeFoundationLesson(0);
    completeFoundationLesson(1);
    completeFoundationLesson(2);
    assert.strictEqual(getCompletedFoundationLessonCount(), 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// FOUNDATION COURSE CONSTRUCTION
// ═══════════════════════════════════════════════════════════════

suite('Foundation Course — buildFoundationCourse', function() {
  test('buildFoundationCourse with empty canonical words returns empty', function() {
    CANONICAL_WORDS.length = 0;
    buildFoundationCourse();
    assert.strictEqual(getFoundationLessonCount(), 0);
    assert.strictEqual(getAllFoundationWords().length, 0);
  });

  test('Creates 10 lessons from 150 canonical words', function() {
    // Restore test words
    CANONICAL_WORDS.length = 0;
    for (var i = 0; i < testWords.length; i++) {
      CANONICAL_WORDS.push(testWords[i]);
    }
    buildFoundationCourse();
    assert.strictEqual(getFoundationLessonCount(), 10);
    assert.strictEqual(FOUNDATION_WORDS.length, 100);

    // Each lesson has exactly 10 words
    for (var li = 0; li < 10; li++) {
      assert.strictEqual(getFoundationLessonWords(li).length, 10, 'Lesson ' + li + ' should have 10 words');
    }
  });

  test('Lessons ordered by frequency (first lesson has highest occ)', function() {
    var lesson0Words = getFoundationLessonWords(0);
    var lesson9Words = getFoundationLessonWords(9);
    assert.ok((lesson0Words[0].occ || 0) >= (lesson9Words[9].occ || 0),
      'First lesson words should have higher frequency');
  });

  test('Each lesson has lessonCoverage and cumulativeCoverage percentages', function() {
    for (var li = 0; li < FOUNDATION_LESSON_COUNT; li++) {
      var lesson = FOUNDATION_LESSONS[li];
      assert.ok(typeof lesson.lessonCoverage === 'string' && lesson.lessonCoverage.indexOf('%') >= 0,
        'Lesson ' + li + ' missing lessonCoverage');
      assert.ok(typeof lesson.cumulativeCoverage === 'string' && lesson.cumulativeCoverage.indexOf('%') >= 0,
        'Lesson ' + li + ' missing cumulativeCoverage');
    }
  });

  test('Every 5th lesson is marked as review', function() {
    for (var li = 0; li < FOUNDATION_LESSON_COUNT; li++) {
      var isReviewExpected = (li + 1) % 5 === 0;
      assert.strictEqual(FOUNDATION_LESSONS[li].isReview, isReviewExpected,
        'Lesson ' + (li + 1) + ' isReview should be ' + isReviewExpected);
    }
  });

  test('Cumulative coverage increases monotonically', function() {
    var prev = -1;
    for (var li = 0; li < FOUNDATION_LESSON_COUNT; li++) {
      var val = parseFloat(FOUNDATION_LESSONS[li].cumulativeCoverage);
      assert.ok(val >= prev, 'Cumulative coverage should not decrease');
      prev = val;
    }
  });

  test('Enriches canonical words with metadata', function() {
    var w = getCanonicalWordById('cw_0');
    assert.ok(w, 'cw_0 should exist');
    assert.ok(w.frequencyRank !== undefined, 'frequencyRank');
    assert.ok(w.learningPriority !== undefined, 'learningPriority');
    assert.ok(w.foundationLessonId !== undefined, 'foundationLessonId');
    assert.ok(w.frequencyPercentile !== undefined, 'frequencyPercentile');
    assert.ok(w.surahCount !== undefined, 'surahCount');
    assert.ok(typeof w.firstOccurrence === 'string', 'firstOccurrence');
    assert.ok(typeof w.lastOccurrence === 'string', 'lastOccurrence');
  });

  test('Top 100 words have foundationLessonId >= 0', function() {
    for (var fi = 0; fi < 100; fi++) {
      var w = getCanonicalWordById('cw_' + fi);
      if (w) assert.ok(w.foundationLessonId >= 0, 'cw_' + fi + ' should be in foundation');
    }
  });

  test('Words beyond top 100 have foundationLessonId of -1', function() {
    var w = getCanonicalWordById('cw_101');
    if (w) assert.strictEqual(w.foundationLessonId, -1);
  });

  test('buildFoundationCourse is idempotent', function() {
    buildFoundationCourse();
    assert.strictEqual(getFoundationLessonCount(), 10);
    assert.strictEqual(FOUNDATION_WORDS.length, 100);
  });
});

suite('Foundation Course — Lesson Word Functions', function() {
  test('getFoundationLessonWords returns empty for out-of-range index', function() {
    assert.strictEqual(getFoundationLessonWords(-1).length, 0);
    assert.strictEqual(getFoundationLessonWords(999).length, 0);
  });

  test('getFoundationLessonWords returns word objects with expected structure', function() {
    var words = getFoundationLessonWords(0);
    assert.ok(words.length > 0);
    assert.ok(words[0].id !== undefined);
    assert.ok(words[0].arabic !== undefined);
    assert.ok(words[0].occ !== undefined);
  });

  test('getFoundationLessonForWord returns correct mapping', function() {
    assert.strictEqual(getFoundationLessonForWord('cw_0'), 0);
    assert.strictEqual(getFoundationLessonForWord('cw_9'), 0);
    assert.strictEqual(getFoundationLessonForWord('cw_10'), 1);
    assert.strictEqual(getFoundationLessonForWord('cw_99'), 9);
  });

  test('getFoundationLessonForWord returns -1 for non-foundation words', function() {
    assert.strictEqual(getFoundationLessonForWord('cw_100'), -1);
    assert.strictEqual(getFoundationLessonForWord('nonexistent'), -1);
  });

  test('getFoundationLessonRoots returns array of root groups', function() {
    var roots = getFoundationLessonRoots(0);
    assert.ok(Array.isArray(roots));
  });

  test('getFoundationLessonRoots returns empty for invalid index', function() {
    assert.strictEqual(getFoundationLessonRoots(-1).length, 0);
  });

  test('getFoundationRelationshipStats returns expected structure', function() {
    var stats = getFoundationRelationshipStats();
    assert.ok(typeof stats.totalFoundationWords === 'number');
    assert.ok(typeof stats.totalWithRoots === 'number');
    assert.ok(typeof stats.uniqueRootFamilies === 'number');
    assert.ok(typeof stats.crossLessonConnections === 'number');
  });

  test('getAllFoundationWords returns 100 words', function() {
    assert.strictEqual(getAllFoundationWords().length, 100);
  });

  test('getFoundationLessonRelationshipContext returns structure with relationship arrays', function() {
    var ctx = getFoundationLessonRelationshipContext(0);
    assert.ok(ctx !== undefined);
    assert.ok(Array.isArray(ctx.alreadyLearnedRelated));
    assert.ok(Array.isArray(ctx.upcomingRelated));
    assert.ok(Array.isArray(ctx.rootFamilies));
  });
});

// ═══════════════════════════════════════════════════════════════
// COVERAGE CALCULATIONS
// ═══════════════════════════════════════════════════════════════

suite('Coverage — getTotalQuranOccurrences', function() {
  test('Returns 0 when no words exist', function() {
    var saved = CANONICAL_WORDS.slice();
    CANONICAL_WORDS.length = 0;
    _totalQuranOccurrences = 0;
    assert.strictEqual(getTotalQuranOccurrences(), 0);
    // Restore
    _totalQuranOccurrences = 0;
    saved.forEach(function(w) { CANONICAL_WORDS.push(w); });
  });

  test('Returns sum of all word occurrences', function() {
    _totalQuranOccurrences = 0;
    var total = getTotalQuranOccurrences();
    var expected = 0;
    for (var i = 0; i < CANONICAL_WORDS.length; i++) {
      expected += CANONICAL_WORDS[i].occ || 0;
    }
    assert.strictEqual(total, expected);
  });
});

suite('Coverage — getMasteredWordIds', function() {
  test('Returns empty object when no SRS data', function() {
    assert.strictEqual(Object.keys(getMasteredWordIds()).length, 0);
  });

  test('Returns only words with stage >= 2', function() {
    _mockSRS = {
      cw_0: { stage: 3, interval: 30 },
      cw_1: { stage: 2, interval: 14 },
      cw_2: { stage: 1, interval: 3 },
      cw_3: { stage: 0, interval: 0 },
    };
    var m = getMasteredWordIds();
    assert.strictEqual(m['cw_0'], true, 'stage 3 should be mastered');
    assert.strictEqual(m['cw_1'], true, 'stage 2 should be mastered');
    assert.strictEqual(m['cw_2'], undefined, 'stage 1 should not be mastered');
    assert.strictEqual(m['cw_3'], undefined, 'stage 0 should not be mastered');
  });
});

suite('Coverage — calculateCoverage', function() {
  test('Returns zero coverage when no words mastered', function() {
    var cov = calculateCoverage();
    assert.strictEqual(cov.coveragePercent, 0);
    assert.strictEqual(cov.wordMasteryPercent, 0);
    assert.strictEqual(cov.estimatedComprehension, 0);
    assert.strictEqual(cov.masteredWords, 0);
    assert.ok(cov.totalOccurrences > 0);
    assert.ok(cov.totalWords > 0);
  });

  test('Returns partial coverage when some words mastered', function() {
    _mockSRS = {};
    for (var mi = 0; mi < 10; mi++) {
      _mockSRS['cw_' + mi] = { stage: 3, interval: 30 };
    }
    var cov = calculateCoverage();
    assert.ok(cov.masteredWords >= 10, 'Should have mastered words');
    assert.ok(cov.coveragePercent > 0, 'Should have positive coverage');
    assert.ok(cov.masteredOccurrences > 0, 'Should have mastered occurrences');
  });

  test('Returns high coverage when all words mastered', function() {
    _mockSRS = {};
    for (var mi = 0; mi < CANONICAL_WORDS.length; mi++) {
      _mockSRS['cw_' + mi] = { stage: 3, interval: 365 };
    }
    var cov = calculateCoverage();
    assert.ok(cov.coveragePercent >= 99, 'Should have near 100% coverage');
    assert.ok(cov.wordMasteryPercent >= 99, 'Should have near 100% word mastery');
    assert.ok(cov.estimatedComprehension > 20, 'Should have meaningful comprehension estimate (> 20 at full coverage)');
  });

  test('Comprehension increases with coverage (monotonic)', function() {
    _mockSRS = { cw_0: { stage: 3, interval: 30 } };
    var lowCov = calculateCoverage();

    _mockSRS = {};
    for (var hi = 0; hi < 50; hi++) {
      _mockSRS['cw_' + hi] = { stage: 3, interval: 30 };
    }
    var highCov = calculateCoverage();

    assert.ok(highCov.estimatedComprehension >= lowCov.estimatedComprehension,
      'Higher coverage should have >= comprehension');
  });
});

suite('Coverage — getFoundationCoverage', function() {
  test('Returns structure with all required fields', function() {
    var fc = getFoundationCoverage();
    assert.ok(typeof fc.totalFoundationWords === 'number');
    assert.ok(typeof fc.masteredFoundationWords === 'number');
    assert.ok(typeof fc.foundationCoveragePercent === 'number');
    assert.ok(typeof fc.foundationProgressPercent === 'number');
    assert.ok(typeof fc.totalQuranOccurrences === 'number');
  });

  test('Returns zero mastery when no foundation words mastered', function() {
    var fc = getFoundationCoverage();
    assert.strictEqual(fc.masteredFoundationWords, 0);
    assert.strictEqual(fc.foundationProgressPercent, 0);
  });

  test('Returns partial mastery when some foundation words mastered', function() {
    _mockSRS = {};
    for (var mi = 0; mi < 30; mi++) {
      _mockSRS['cw_' + mi] = { stage: 2, interval: 14 };
    }
    var fc = getFoundationCoverage();
    assert.ok(fc.masteredFoundationWords >= 30, 'Should have mastered foundation words');
    assert.ok(fc.foundationProgressPercent >= 30, 'Should have progress percentage');
  });
});

// ═══════════════════════════════════════════════════════════════
// MILESTONE TRACKING
// ═══════════════════════════════════════════════════════════════

suite('Milestones — getMilestoneStatus', function() {
  test('Exact percentage returns matching current milestone', function() {
    var s = getMilestoneStatus(5);
    assert.strictEqual(s.currentMilestone.pct, 5);
    assert.strictEqual(s.currentMilestone.label, 'First Steps');
  });

  test('Intermediate percentage rounds down to nearest milestone', function() {
    var s = getMilestoneStatus(25);
    assert.strictEqual(s.currentMilestone.pct, 20);
    assert.strictEqual(s.currentMilestone.label, 'Growing Strong');
    assert.strictEqual(s.nextMilestone.pct, 30);
  });

  test('Boundary: exactly 50% maps to Major Milestone', function() {
    var s = getMilestoneStatus(50);
    assert.strictEqual(s.currentMilestone.pct, 50);
    assert.strictEqual(s.currentMilestone.label, 'Major Milestone');
    assert.strictEqual(s.nextMilestone.pct, 60);
  });

  test('0% returns null current milestone, next is 5%', function() {
    var s = getMilestoneStatus(0);
    assert.strictEqual(s.currentMilestone, null);
    assert.strictEqual(s.nextMilestone.pct, 5);
  });

  test('100% returns final milestone with no next', function() {
    var s = getMilestoneStatus(100);
    assert.strictEqual(s.currentMilestone.pct, 100);
    assert.strictEqual(s.currentMilestone.label, 'Quran Complete');
    assert.strictEqual(s.nextMilestone, null);
  });

  test('wordsToNextMilestone is positive for incomplete progress', function() {
    var s = getMilestoneStatus(25);
    assert.ok(s.wordsToNextMilestone > 0);
    assert.ok(s.lessonsToNextMilestone >= 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// ENRICHED METADATA
// ═══════════════════════════════════════════════════════════════

suite('Enriched Metadata — Priority Labels', function() {
  test('getLearningPriorityLabel returns correct labels for 1-5', function() {
    assert.strictEqual(getLearningPriorityLabel(1), 'Essential');
    assert.strictEqual(getLearningPriorityLabel(2), 'High Priority');
    assert.strictEqual(getLearningPriorityLabel(3), 'Medium Priority');
    assert.strictEqual(getLearningPriorityLabel(4), 'Low Priority');
    assert.strictEqual(getLearningPriorityLabel(5), 'Supplementary');
  });

  test('getLearningPriorityLabel returns Unknown for invalid', function() {
    assert.strictEqual(getLearningPriorityLabel(0), 'Unknown');
    assert.strictEqual(getLearningPriorityLabel(99), 'Unknown');
  });
});

suite('Enriched Metadata — Word Queries', function() {
  test('getMostFrequentWord returns highest occ word', function() {
    var mfw = getMostFrequentWord();
    assert.ok(mfw !== null);
    assert.ok(mfw.occ > 0);
    assert.strictEqual(mfw.id, 'cw_0');
  });

  test('getFrequencyRank returns rank from word metadata', function() {
    var w0 = getCanonicalWordById('cw_0');
    if (w0 && w0.frequencyRank !== undefined) {
      assert.strictEqual(getFrequencyRank(w0), w0.frequencyRank);
    }
  });

  test('getFrequencyRank returns null for words without rank', function() {
    assert.strictEqual(getFrequencyRank({}), null);
  });

  test('getLearningPriority returns priority from word metadata', function() {
    var w0 = getCanonicalWordById('cw_0');
    if (w0 && w0.learningPriority !== undefined) {
      assert.strictEqual(getLearningPriority(w0), w0.learningPriority);
    }
  });

  test('getLearningPriority returns 3 for words without priority', function() {
    assert.strictEqual(getLearningPriority({}), 3);
  });

  test('getWordsByPriority returns ascending priority order', function() {
    var sorted = getWordsByPriority();
    assert.ok(sorted.length > 0);
    for (var i = 1; i < Math.min(sorted.length, 50); i++) {
      var prev = sorted[i-1].learningPriority || 5;
      var curr = sorted[i].learningPriority || 5;
      assert.ok(prev <= curr, 'Should be sorted by priority ascending');
    }
  });

  test('getWordsByFrequency returns ascending frequency rank', function() {
    var sorted = getWordsByFrequency();
    assert.ok(sorted.length > 0);
    for (var i = 1; i < Math.min(sorted.length, 50); i++) {
      var prev = sorted[i-1].frequencyRank || 9999;
      var curr = sorted[i].frequencyRank || 9999;
      assert.ok(prev <= curr, 'Should be sorted by frequency rank ascending');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ROOT FAMILY MASTERY
// ═══════════════════════════════════════════════════════════════

suite('Root Family — getRootFamilyMastery', function() {
  test('Returns expected structure with zero mastery', function() {
    var rm = getRootFamilyMastery();
    assert.ok(typeof rm.totalRoots === 'number');
    assert.ok(typeof rm.fullyMasteredRoots === 'number');
    assert.ok(typeof rm.partiallyMasteredRoots === 'number');
    assert.strictEqual(rm.fullyMasteredRoots, 0);
    assert.strictEqual(rm.partiallyMasteredRoots, 0);
  });

  test('Returns partial mastery when some roots partially mastered', function() {
    _mockSRS = {
      cw_0: { stage: 3, interval: 30 },
      cw_20: { stage: 3, interval: 30 },
    };
    var rm = getRootFamilyMastery();
    assert.ok(rm.partiallyMasteredRoots >= 1 || rm.fullyMasteredRoots >= 1,
      'Should have some mastered roots');
  });
});

// ═══════════════════════════════════════════════════════════════
// SURAH COMPREHENSION
// ═══════════════════════════════════════════════════════════════

suite('Surah Comprehension', function() {
  test('getSurahComprehension returns null for null surahId', function() {
    assert.strictEqual(getSurahComprehension(null), null);
  });

  test('getSurahComprehension returns null for surah with no words', function() {
    assert.strictEqual(getSurahComprehension(999), null);
  });

  test('getSurahComprehension returns valid structure for existing surah', function() {
    var comp = getSurahComprehension(1);
    if (comp) {
      assert.strictEqual(comp.surahId, 1);
      assert.ok(typeof comp.totalWords === 'number');
      assert.ok(typeof comp.masteredWords === 'number');
      assert.ok(typeof comp.estimatedComprehension === 'number');
      assert.ok(comp.estimatedComprehension >= 0 && comp.estimatedComprehension <= 100);
    }
  });

  test('getAllSurahComprehension returns array of results', function() {
    var results = getAllSurahComprehension();
    assert.ok(Array.isArray(results));
    results.forEach(function(r) {
      assert.ok(r.surahId !== undefined);
      assert.ok(typeof r.estimatedComprehension === 'number');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exitCode = failed > 0 ? 1 : 0;
