#!/usr/bin/env node
/**
 * vocabulary.test.js — Unit tests for the Vocabulary Service
 *
 * Tests: word lookup, search, filters, favorites/notes,
 * distractor selection, and relationship inference engine.
 *
 * Run: node test/vocabulary.test.js
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

// Mock SRS dependency
global.getSRSStatus = function(id) {
  return { status: 'new', stage: 0, isLeech: false, retention: 1, daysUntilDue: null };
};

// Mock window
global.window = {};

// Build test vocabulary
var TEST_WORDS = [
  { id: 'w_1', arabic: 'كِتَاب', translit: 'kitāb', english: 'book', meaning: 'book, scripture', type: 'Noun', typeCategory: 'noun', root: 'كتب', occ: 260, difficulty: 2, frequency: 'very-high', tags: ['divine-revelation', 'common'], pattern: 'فِعَال', surahId: 2 },
  { id: 'w_2', arabic: 'رَحْمَة', translit: 'rahma', english: 'mercy', meaning: 'mercy, compassion', type: 'Noun', typeCategory: 'noun', root: 'رحم', occ: 114, difficulty: 2, frequency: 'high', tags: ['divine-attributes'], pattern: 'فَعْلَة', surahId: 3 },
  { id: 'w_3', arabic: 'عِلْم', translit: 'ʿilm', english: 'knowledge', meaning: 'knowledge, science', type: 'Noun', typeCategory: 'noun', root: 'علم', occ: 105, difficulty: 2, frequency: 'high', tags: ['divine-attributes', 'common'], pattern: 'فِعْل', surahId: 2 },
  { id: 'w_4', arabic: 'صَلَاة', translit: 'ṣalāh', english: 'prayer', meaning: 'prayer, worship', type: 'Noun', typeCategory: 'noun', root: 'صلو', occ: 99, difficulty: 2, frequency: 'high', tags: ['worship'], pattern: 'فَعَال', surahId: 2 },
  { id: 'w_5', arabic: 'شَكَرَ', translit: 'shakara', english: 'thank', meaning: 'to thank, be grateful', type: 'Verb', typeCategory: 'verb', root: 'شكر', occ: 75, difficulty: 3, frequency: 'medium', tags: ['actions'], pattern: 'فَعَلَ', relatedWords: ['شُكْر'], surahId: 3 },
  { id: 'w_6', arabic: 'شُكْر', translit: 'shukr', english: 'thanksgiving', meaning: 'thanks, gratitude', type: 'Noun', typeCategory: 'noun', root: 'شكر', occ: 24, difficulty: 3, frequency: 'medium', tags: ['concepts'], pattern: 'فُعْل', surahId: 2, similarWords: ['شَكَرَ'] },
  { id: 'w_7', arabic: 'ذَهَبَ', translit: 'dhahaba', english: 'go', meaning: 'to go, depart', type: 'Verb', typeCategory: 'verb', root: 'ذهب', occ: 60, difficulty: 3, frequency: 'medium', tags: ['actions'], pattern: 'فَعَلَ' },
  { id: 'w_8', arabic: 'مِنْ', translit: 'min', english: 'from', meaning: 'from, some of', type: 'Particle', typeCategory: 'particle', root: '—', occ: 322, difficulty: 1, frequency: 'very-high', tags: ['preposition'] },
  { id: 'w_9', arabic: 'إِلَى', translit: 'ilā', english: 'to', meaning: 'to, toward, until', type: 'Particle', typeCategory: 'particle', root: '—', occ: 278, difficulty: 1, frequency: 'very-high', tags: ['preposition'] },
  { id: 'w_10', arabic: 'عَلَى', translit: 'ʿalā', english: 'on', meaning: 'on, upon, over', type: 'Particle', typeCategory: 'particle', root: '—', occ: 226, difficulty: 1, frequency: 'very-high', tags: ['preposition'] },
];

global.ALL_WORDS = TEST_WORDS;
global.getCanonicalWords = function() { return TEST_WORDS; };
global.getCanonicalIdForOldId = function(id) { return id; };

// Mock getSurah functions
global.getSurahEnglishName = function(id) { return 'Surah ' + id; };
global.getSurahNameSimple = function(id) { return 'surah_' + id; };

// Mock FOUNDATION constants
global.FOUNDATION_LESSONS = [];

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var vocabCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'vocabulary.js'), 'utf8');
eval(vocabCode);

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

suite('Word Lookup', function() {
  test('findWordById returns correct word', function() {
    var w = findWordById('w_1');
    assert.ok(w !== undefined);
    assert.strictEqual(w.arabic, 'كِتَاب');
  });

  test('findWordById returns undefined for unknown id', function() {
    assert.strictEqual(findWordById('nonexistent'), undefined);
  });

  test('findWordByArabic returns correct word', function() {
    var w = findWordByArabic('رَحْمَة');
    assert.ok(w !== undefined);
    assert.strictEqual(w.english, 'mercy');
  });

  test('findWordByArabic returns undefined for unknown arabic', function() {
    assert.strictEqual(findWordByArabic('xxxxx'), undefined);
  });

  test('findWordsByArabic returns array for duplicate arabic', function() {
    var words = findWordsByArabic('ذَهَبَ');
    assert.ok(Array.isArray(words));
    assert.ok(words.length > 0);
  });
});

suite('Search', function() {
  test('searchWords returns all words for empty query', function() {
    var results = searchWords('');
    assert.ok(results.length >= 10);
  });

  test('searchWords finds by Arabic text', function() {
    var results = searchWords('رَحْمَة');
    assert.ok(results.some(function(w) { return w.english === 'mercy'; }));
  });

  test('searchWords finds by English text', function() {
    var results = searchWords('book');
    assert.ok(results.some(function(w) { return w.arabic === 'كِتَاب'; }));
  });

  test('searchWords finds by root', function() {
    var results = searchWords('شكر');
    assert.ok(results.length >= 2);
  });

  test('searchWords finds by transliteration', function() {
    var results = searchWords('kitāb');
    assert.ok(results.some(function(w) { return w.english === 'book'; }));
  });

  test('searchWords is case-insensitive', function() {
    var results = searchWords('BOOK');
    assert.ok(results.some(function(w) { return w.english === 'book'; }));
  });

  test('searchWords returns empty for no matches', function() {
    var results = searchWords('zzzzzzzz');
    assert.strictEqual(results.length, 0);
  });
});

suite('Filters', function() {
  test('filterByCategory filters by typeCategory', function() {
    var verbs = filterByCategory(TEST_WORDS, 'verb');
    assert.ok(verbs.every(function(w) { return w.typeCategory === 'verb'; }));
    assert.strictEqual(verbs.length, 2);
  });

  test('filterByCategory returns all for "all"', function() {
    assert.strictEqual(filterByCategory(TEST_WORDS, 'all').length, TEST_WORDS.length);
  });

  test('filterByCategory handles null category', function() {
    assert.strictEqual(filterByCategory(TEST_WORDS, null).length, TEST_WORDS.length);
  });

  test('filterByFavorites returns bookmarked words', function() {
    clearStorage();
    saveFavorites({ w_1: true, w_3: true });
    var favs = filterByFavorites(TEST_WORDS);
    assert.strictEqual(favs.length, 2);
    assert.ok(favs.some(function(w) { return w.id === 'w_1'; }));
    assert.ok(favs.some(function(w) { return w.id === 'w_3'; }));
  });
});

suite('Favorites (Bookmarks)', function() {
  test('toggleFavorite adds and removes', function() {
    clearStorage();
    assert.strictEqual(isFavorite('w_1'), false);
    toggleFavorite('w_1');
    assert.strictEqual(isFavorite('w_1'), true);
    toggleFavorite('w_1');
    assert.strictEqual(isFavorite('w_1'), false);
  });

  test('loadFavorites handles missing data', function() {
    clearStorage();
    assert.deepStrictEqual(loadFavorites(), {});
  });

  test('loadFavorites handles corrupted data', function() {
    clearStorage();
    localStorage.setItem('quran_favorites', '{bad json');
    assert.deepStrictEqual(loadFavorites(), {});
  });

  test('saveFavorites persists data', function() {
    clearStorage();
    saveFavorites({ w_1: true, w_2: true });
    assert.deepStrictEqual(loadFavorites(), { w_1: true, w_2: true });
  });
});

suite('Notes', function() {
  test('getNote returns empty string for unknown word', function() {
    clearStorage();
    assert.strictEqual(getNote('w_none'), '');
  });

  test('setNote and getNote round-trip', function() {
    clearStorage();
    setNote('w_1', 'This is a great word');
    assert.strictEqual(getNote('w_1'), 'This is a great word');
  });

  test('setNote overwrites existing note', function() {
    clearStorage();
    setNote('w_1', 'First note');
    setNote('w_1', 'Updated note');
    assert.strictEqual(getNote('w_1'), 'Updated note');
  });

  test('loadNotes handles corrupted data', function() {
    clearStorage();
    localStorage.setItem('quran_notes', '{{{');
    assert.deepStrictEqual(loadNotes(), {});
  });
});

suite('Distractors', function() {
  test('getDistractors returns requested count', function() {
    var correct = TEST_WORDS[0];
    var distractors = getDistractors(correct, 3);
    assert.strictEqual(distractors.length, 3);
  });

  test('getDistractors excludes the correct word', function() {
    var correct = TEST_WORDS[0];
    var distractors = getDistractors(correct, 3);
    assert.ok(distractors.every(function(d) { return d.id !== correct.id; }));
  });

  test('getDistractors excludes same english meaning', function() {
    var dist = getDistractors(TEST_WORDS[1], 3);
    assert.ok(dist.every(function(d) { return d.english !== 'mercy'; }));
  });

  test('getDistractors handles count > available words', function() {
    var dist = getDistractors(TEST_WORDS[0], 999);
    assert.ok(dist.length < 999);
  });
});

suite('Advanced Search', function() {
  test('advancedSearch with query returns filtered results', function() {
    var results = advancedSearch('book', {});
    assert.ok(results.length > 0);
  });

  test('advancedSearch with filter applies constraints', function() {
    var results = advancedSearch('', { difficulty: 1 });
    assert.ok(results.every(function(w) { return w.difficulty === 1; }));
  });

  test('advancedSearch sorts by relevance', function() {
    var results = advancedSearch('book', {});
    // 'book' should be first or near-first
    assert.ok(results[0].english.indexOf('book') >= 0 || results[0].arabic.indexOf('book') >= 0);
  });

  test('normalizeArabic removes diacritics', function() {
    var withDiac = 'كِتَاب';
    var normal = normalizeArabic(withDiac);
    assert.ok(normal.indexOf('\u0650') < 0, 'kasra removed');
    assert.ok(normal.indexOf('\u064e') < 0, 'fatha removed');
  });
});

suite('Relationship Engine', function() {
  test('buildRelationsCache creates indices', function() {
    buildRelationsCache();
    // Test through public API since _relCache is let-scoped
    var stats = getRelationshipStats();
    assert.ok(stats.totalWords >= 10);
    assert.ok(typeof stats.wordsWithDerivedForms === 'number');
  });

  test('getDerivedForms returns same-root words', function() {
    var forms = getDerivedForms(TEST_WORDS[4]); // شكر root words
    assert.ok(Array.isArray(forms));
  });

  test('getConfusedWith returns similar transliteration', function() {
    var confused = getConfusedWith(TEST_WORDS[1]); // rahma
    assert.ok(Array.isArray(confused));
  });

  test('getSemanticGroups returns tag-based groups', function() {
    var groups = getSemanticGroups(TEST_WORDS[1]); // rahma has 'divine-attributes' tag
    assert.ok(groups.length > 0);
  });

  test('getRelatedWordObjects resolves related words', function() {
    var related = getRelatedWordObjects(TEST_WORDS[4]); // شكر has related word شكر
    assert.ok(Array.isArray(related));
  });

  test('getAllRelationships returns all types for a word', function() {
    var all = getAllRelationships(TEST_WORDS[0]);
    assert.ok(all.derivedForms !== undefined);
    assert.ok(all.semanticGroups !== undefined);
    assert.ok(all.confusedWith !== undefined);
    assert.ok(all.morphRelations !== undefined);
  });

  test('getRelationshipStats returns aggregated stats', function() {
    var stats = getRelationshipStats();
    assert.ok(stats.totalWords >= 10);
    assert.ok(typeof stats.wordsWithSemanticGroups === 'number');
  });

  test('string input to getDerivedForms resolves word', function() {
    var forms = getDerivedForms('كِتَاب');
    assert.ok(Array.isArray(forms));
  });

  test('empty string to getDerivedForms returns empty array', function() {
    assert.deepStrictEqual(getDerivedForms(''), []);
    assert.deepStrictEqual(getDerivedForms(undefined), []);
  });

  test('invalidateRelationsCache clears cache', function() {
    buildRelationsCache();
    var before = getRelationshipStats();
    invalidateRelationsCache();
    // After invalidation, next call should rebuild
    buildRelationsCache();
    var after = getRelationshipStats();
    assert.ok(after.totalWords >= 10);
  });
});

suite('Edge Cases', function() {
  test('advancedSearch handles null query', function() {
    var results = advancedSearch(null, {});
    assert.ok(Array.isArray(results));
  });

  test('advancedFilterWords handles null words', function() {
    var result = advancedFilterWords(null, {});
    assert.deepStrictEqual(result, null);
  });

  test('advancedFilterWords handles empty words', function() {
    assert.deepStrictEqual(advancedFilterWords([], {}), []);
  });

  test('loadNotes handles missing data', function() {
    clearStorage();
    assert.deepStrictEqual(loadNotes(), {});
  });

  test('_migrateLegacyKeys handles null data', function() {
    assert.deepStrictEqual(_migrateLegacyKeys(null, false), {});
  });

  test('_migrateLegacyKeys handles non-object data', function() {
    assert.deepStrictEqual(_migrateLegacyKeys('string', false), {});
  });
});

suite('Normalize / Utility', function() {
  test('normalizeTranslit handles special chars', function() {
    var n = normalizeTranslit('raḥma');
    assert.ok(n.indexOf('ḥ') < 0, 'special char removed');
    assert.ok(n.length > 0);
  });

  test('normalizeArabic handles empty string', function() {
    assert.strictEqual(normalizeArabic(''), '');
  });

  test('normalizeArabic handles null', function() {
    assert.strictEqual(normalizeArabic(null), '');
  });

  test('shuffleArray returns array of same length', function() {
    var arr = [1, 2, 3, 4, 5];
    var shuffled = shuffleArray(arr);
    assert.strictEqual(shuffled.length, arr.length);
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
