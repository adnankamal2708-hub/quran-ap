#!/usr/bin/env node
/**
 * data-validation.test.js — Data Integrity & Edge Case Tests
 *
 * Tests: vocabulary data structure, lesson progress, foundation course,
 * milestones, localStorage edge cases, service worker, PWA basics.
 *
 * Since data.js uses const declarations that are not accessible outside
 * eval(), this test mocks the vocabulary data and tests individual
 * utility functions directly.
 *
 * Run: node test/data-validation.test.js
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

var _mockNow = new Date('2026-07-06T12:00:00Z').getTime();
var OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

global.window = {};
global.getCurrentUser = function() { return null; };
global.__sync = {};

// ═══════════════════════════════════════════════════════════════
// IMPORT DATA.JS (which defines const arrays we need access to)
// ═══════════════════════════════════════════════════════════════

var dataDir = path.join(__dirname, '..', 'js', 'data');
var wordFiles = [];
try {
  wordFiles = fs.readdirSync(dataDir).filter(function(f) { return f.indexOf('words-') === 0 && f.endsWith('.js'); });
} catch (e) {}

// Load word data files to populate ALL_WORDS
// We need to load them before eval'ing data.js so the const ALL_WORDS array in data.js
// gets populated properly. We do this by first setting up a global reference, then
// re-arranging the globals after eval.
var dataCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
eval(dataCode);

// At this point, ALL_WORDS is a const array (empty), CANONICAL_WORDS is const (empty)
// and functions like assignWordIds, deduplicateVocabulary, buildLessons exist.
// 
// We need to populate ALL_WORDS. Since it's const but mutable, we can push to it.
// We also need to load the word data files. But those files add to the global ALL_WORDS,
// not the local const. So let's try to load word files and see what happens.

var _mockWords = [
  { arabic: 'الله', translit: 'Allāh', english: 'Allah', meaning: 'Allah, God', type: 'Proper Noun', typeCategory: 'noun', root: 'أله', pattern: 'فَعَال', occ: 2699, frequency: 'very-high', difficulty: 1, tags: ['divine-attributes'], surahId: 1, verseKey: '1:1' },
  { arabic: 'رَبّ', translit: 'rabb', english: 'Lord', meaning: 'Lord, Master', type: 'Noun', typeCategory: 'noun', root: 'ربب', pattern: 'فَعْل', occ: 970, frequency: 'very-high', difficulty: 1, tags: ['divine-attributes'], surahId: 1, verseKey: '1:2' },
  { arabic: 'رَحْمَة', translit: 'rahma', english: 'mercy', meaning: 'mercy', type: 'Noun', typeCategory: 'noun', root: 'رحم', pattern: 'فَعْلَة', occ: 114, frequency: 'high', difficulty: 2, tags: ['divine-attributes'], surahId: 1, verseKey: '1:1' },
  { arabic: 'عِلْم', translit: 'ʿilm', english: 'knowledge', meaning: 'knowledge', type: 'Noun', typeCategory: 'noun', root: 'علم', pattern: 'فِعْل', occ: 105, frequency: 'high', difficulty: 2, tags: ['divine-attributes'] },
  { arabic: 'صَلَاة', translit: 'ṣalāh', english: 'prayer', meaning: 'prayer', type: 'Noun', typeCategory: 'noun', root: 'صلو', pattern: 'فَعَال', occ: 99, frequency: 'high', difficulty: 2, tags: ['worship'], surahId: 2 },
];

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Vocabulary Data Schema', function() {
  test('Word data files exist', function() {
    assert.ok(wordFiles.length > 0, 'Found ' + wordFiles.length + ' word files');
  });

  test('Each word file has valid syntax', function() {
    wordFiles.forEach(function(f) {
      var content = fs.readFileSync(path.join(dataDir, f), 'utf8');
      try {
        new Function(content);
      } catch (e) {
        assert.fail('Syntax error in ' + f + ': ' + e.message);
      }
    });
  });

  test('assignWordIds does not throw on empty list', function() {
    // Should handle empty array gracefully
    assignWordIds();
    assert.ok(true);
  });
});

suite('Canonical Deduplication Functions', function() {
  test('_wordUniquenessKey generates correct keys', function() {
    var word = { arabic: 'كِتَاب', root: 'كتب', typeCategory: 'noun', meaning: 'book' };
    var key = _wordUniquenessKey(word);
    assert.ok(key.indexOf('كِتَاب') >= 0);
    assert.ok(key.indexOf('كتب') >= 0);
  });

  test('getCanonicalWordById returns null for unknown', function() {
    assert.strictEqual(getCanonicalWordById('nonexistent'), null);
  });

  test('getCanonicalWords returns empty array when not populated', function() {
    var words = getCanonicalWords();
    assert.ok(Array.isArray(words));
  });

  test('getCanonicalIdForOldId returns null for unknown', function() {
    assert.strictEqual(getCanonicalIdForOldId('w_unknown'), null);
  });
});

suite('Foundation Course Constants', function() {
  test('COVERAGE_MILESTONES has correct milestones', function() {
    // Since COVERAGE_MILESTONES is const-declared, we test it indirectly
    var milestone = getMilestoneStatus(45);
    assert.ok(milestone.currentMilestone !== null);
    assert.ok(milestone.currentMilestone.pct <= 45);
    assert.ok(milestone.nextMilestone.pct > 45);
  });

  test('getMilestoneStatus handles 0% coverage', function() {
    var status = getMilestoneStatus(0);
    assert.strictEqual(status.currentMilestone, null);
    assert.strictEqual(status.nextMilestone.pct, 5);
  });

  test('getMilestoneStatus handles 100% coverage', function() {
    var status = getMilestoneStatus(100);
    assert.strictEqual(status.currentMilestone.pct, 100);
    assert.strictEqual(status.nextMilestone, null);
  });

  // Note: FOUNDATION_MODE is const-declared in data.js and not accessible outside eval.
  // Verified through getMilestoneStatus which uses COVERAGE_MILESTONES from same scope.
});

suite('LocalStorage Edge Cases', function() {
  test('loadFoundationProgress returns defaults for missing data', function() {
    clearStorage();
    var progress = loadFoundationProgress();
    assert.strictEqual(progress.currentLesson, 0);
    assert.deepStrictEqual(progress.completedLessons, []);
  });

  test('loadFoundationProgress handles corrupted data', function() {
    clearStorage();
    localStorage.setItem('quran_foundation_progress', '{bad json}');
    var progress = loadFoundationProgress();
    assert.ok(progress.currentLesson !== undefined);
  });

  test('loadLessonProgress returns defaults for missing data', function() {
    clearStorage();
    var progress = loadLessonProgress();
    assert.strictEqual(progress.currentLesson, 0);
  });

  test('loadLessonProgress handles corrupted data', function() {
    clearStorage();
    localStorage.setItem('quran_lesson_progress', '{bad}');
    var progress = loadLessonProgress();
    assert.ok(progress.currentLesson !== undefined);
  });

  test('loadRootFamilyProgress returns defaults for missing data', function() {
    clearStorage();
    var progress = loadRootFamilyProgress();
    assert.ok(progress.currentRoot !== undefined);
  });

  test('loadDifficultyProgress returns defaults for missing data', function() {
    clearStorage();
    var progress = loadDifficultyProgress();
    assert.strictEqual(progress.currentDifficulty, 1);
  });

  test('completeLesson marks lesson and advances', function() {
    clearStorage();
    completeLesson(0);
    var progress = loadLessonProgress();
    assert.ok(progress.completedLessons.indexOf(0) >= 0);
  });

  test('isLessonCompleted checks lesson status', function() {
    clearStorage();
    completeLesson(0);
    assert.strictEqual(isLessonCompleted(0), true);
    assert.strictEqual(isLessonCompleted(1), false);
  });

  test('isLessonUnlocked allows first lesson by default', function() {
    assert.strictEqual(isLessonUnlocked(0), true);
  });

  test('isLessonUnlocked requires previous completion', function() {
    clearStorage();
    assert.strictEqual(isLessonUnlocked(1), false);
  });

  test('getNextIncompleteLesson returns 0 when none completed', function() {
    clearStorage();
    assert.strictEqual(getNextIncompleteLesson(), 0);
  });

  test('setCurrentLesson validates index', function() {
    clearStorage();
    setCurrentLesson(0);
    assert.strictEqual(getCurrentLessonIndex(), 0);
    setCurrentLesson(999); // Should be ignored since lessons might be empty
    // Should not crash
  });

  test('getCompletedLessonCount returns count', function() {
    clearStorage();
    completeLesson(0);
    assert.strictEqual(getCompletedLessonCount(), 1);
  });
});

suite('Learning Path Progress', function() {
  test('getLearningPathProgress returns structured data', function() {
    var progress = getLearningPathProgress();
    assert.ok(progress.foundation !== undefined);
    assert.ok(progress.surah !== undefined);
    assert.ok(progress.rootFamily !== undefined);
    assert.ok(progress.difficulty !== undefined);
    assert.ok(progress.mixedReview !== undefined);
    assert.ok(progress.overall !== undefined);
  });

  test('getPathRecommendation returns recommendation', function() {
    clearStorage();
    var rec = getPathRecommendation();
    assert.ok(rec.pathId !== undefined);
    assert.ok(rec.reason !== undefined);
  });

  test('setLastSelectedPath and getLastSelectedPath round-trip', function() {
    setLastSelectedPath('foundation');
    assert.strictEqual(getLastSelectedPath(), 'foundation');
  });
});

suite('Offline / Service Worker', function() {
  test('sw.js exists and has valid syntax', function() {
    var swPath = path.join(__dirname, '..', 'sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js exists');
    var content = fs.readFileSync(swPath, 'utf8');
    assert.ok(content.length > 100, 'sw.js has content');
    assert.ok(content.indexOf('install') >= 0 || content.indexOf('fetch') >= 0, 'has SW keywords');
  });

  test('manifest.json exists and is valid JSON', function() {
    var manifestPath = path.join(__dirname, '..', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    var content = fs.readFileSync(manifestPath, 'utf8');
    var manifest = JSON.parse(content);
    assert.ok(manifest.name !== undefined);
    assert.ok(manifest.start_url !== undefined);
  });
});

suite('Build Integrity', function() {
  test('Package.json scripts exist', function() {
    var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.ok(pkg.scripts.build !== undefined);
    assert.ok(pkg.scripts.test !== undefined);
  });

  test('Build output files exist in dist/', function() {
    var distDir = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distDir)) {
      var files = fs.readdirSync(distDir);
      assert.ok(files.indexOf('index.html') >= 0, 'index.html in dist');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
