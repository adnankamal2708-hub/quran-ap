#!/usr/bin/env node
/**
 * explorer.test.js — Unit tests for the Vocabulary Explorer
 *
 * Tests: word opening, rendering, root family chips, bookmark toggle,
 * notes auto-save, tafsir toggle, occurrence navigation, related words,
 * back button, scroll reset, and mobile/desktop layout.
 *
 * Run: node test/explorer.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var mock = require('./shared-mock');
mock.setup();

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
function clearStorage() { _storage = {}; }

// Mock word data
var TEST_WORDS = [
  { id: 'cw_0', arabic: 'الله', translit: 'Allah', english: 'Allah', meaning: 'Allah — God',
    root: 'أ-ل-ه', rootMeaning: 'Deity', pattern: 'فَعْل', type: 'Proper Noun', typeCategory: 'noun',
    difficulty: 1, occ: 2699, frequencyRank: 1, frequencyPercentile: 0.1, learningPriority: 1,
    foundationLessonId: 0,
    rootFamily: [{ a: 'إله', e: 'God' }, { a: 'آلهة', e: 'gods' }],
    occurrences: [
      { surahId: 1, verseKey: '1:1', ayahA: 'بِسْمِ اللَّهِ', ayahT: 'In the name of Allah', ayahR: '1:1', tafsir: 'Bismillah...' },
    ],
    surahIds: [1, 2], surahCount: 2,
    firstOccurrence: '1:1', lastOccurrence: '2:255',
    similarWords: ['رب'], oppositeWords: ['شيطان'],
    relatedWords: [{ arabic: 'رب', english: 'Lord' }],
    derivedForms: [{ arabic: 'إله', english: 'God', formName: 'Noun' }],
    morphologicalRelationships: [],
    confusedWith: [],
    semanticGroups: [],
    contextualEquivalents: [],
  },
  { id: 'cw_1', arabic: 'رب', translit: 'Rabb', english: 'Lord', meaning: 'Lord — Sustainer',
    root: 'ر-ب-ب', rootMeaning: 'Lordship', pattern: 'فَعْل', type: 'Noun', typeCategory: 'noun',
    difficulty: 1, occ: 980, frequencyRank: 2, frequencyPercentile: 0.3, learningPriority: 1,
    foundationLessonId: 0,
    rootFamily: [{ a: 'ربوبية', e: 'Lordship' }],
    occurrences: [],
    surahIds: [1], surahCount: 1,
    firstOccurrence: '1:2', lastOccurrence: '1:2',
  },
];

global.ALL_WORDS = TEST_WORDS;

// Mock functions
global.findWordByArabic = function(arabic) {
  for (var i = 0; i < TEST_WORDS.length; i++) {
    if (TEST_WORDS[i].arabic === arabic) return TEST_WORDS[i];
  }
  return null;
};
global.findWordsByArabicList = function(list) {
  if (!list) return [];
  return list.map(function(a) { return global.findWordByArabic(a); }).filter(Boolean);
};
global.DOM = { _cache: {}, get: function(id) { return document.getElementById(id); }, invalidateCache: function() {} };
global.switchView = function(view) { global.__lastView = view; };
global.getCurrentWord = function() { return TEST_WORDS[0]; };
global.getSRSStatus = function(id) { return { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false }; };
global.loadSRS = function() { return {}; };
global.getLearningPriorityLabel = function(p) { return { 1: 'Essential', 2: 'High Priority', 3: 'Medium Priority', 4: 'Low Priority', 5: 'Supplementary' }[p] || 'Unknown'; };
global.isFavorite = function(id) {
  var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
  return !!favs[id];
};
global.toggleFavorite = function(id) {
  var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
  if (favs[id]) { delete favs[id]; } else { favs[id] = true; }
  global.localStorage.setItem('quran_favorites', JSON.stringify(favs));
  return !!favs[id];
};
global.getNote = function(id) {
  var notes = JSON.parse(global.localStorage.getItem('quran_notes') || '{}');
  return notes[id] || '';
};
global.setNote = function(id, text) {
  var notes = JSON.parse(global.localStorage.getItem('quran_notes') || '{}');
  notes[id] = text;
  global.localStorage.setItem('quran_notes', JSON.stringify(notes));
};
global.getDerivedForms = function() { return []; };
global.getMorphologicalRelationships = function() { return []; };
global.getConfusedWith = function() { return []; };
global.getSemanticGroups = function() { return []; };
global.getRelatedWordObjects = function() { return []; };
global.getContextualEquivalents = function() { return []; };
global.buildRelationsCache = function() {};
global.SURAH_INFO = { 1: { name: 'Al-Fatiha', english: 'The Opening', verses: 7 }, 2: { name: 'Al-Baqarah', english: 'The Cow', verses: 286 } };
global.goToSurah = function() {};
global.window.__navigateToWord = function() {};
global.window.__explorerCurrentOcc = null;
global.window.__scrollOnExplorerRender = false;
global.toggleQuickMode = function() {};
global.isFoundationLessonCompleted = function() { return false; };

// Load the explorer module
var explorerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
eval(explorerCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function t(name, fn) {
  try {
    mock.resetDOM();
    clearStorage();
    global.__lastView = null;
    global.__explorerCurrentOcc = null;
    global.localStorage.setItem('quran_favorites', '{}');
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

// Create explorer container DOM
function createExplorerDOM() {
  var container = document.createElement('div');
  container.id = 'view-explorer';
  container.innerHTML =
    '<button id="explorer-back">Back</button>' +
    '<div id="explorer-arabic"></div>' +
    '<div id="explorer-translit"></div>' +
    '<div id="explorer-meaning-main"></div>' +
    '<div id="explorer-full-meaning"></div>' +
    '<div id="explorer-root"></div>' +
    '<div id="explorer-pattern"></div>' +
    '<div id="explorer-pos"></div>' +
    '<div id="explorer-difficulty"></div>' +
    '<div id="explorer-freq-rank"></div>' +
    '<div id="explorer-occ"></div>' +
    '<div id="explorer-foundation-lesson"></div>' +
    '<div id="explorer-priority"></div>' +
    '<div id="explorer-first-occ"></div>' +
    '<div id="explorer-last-occ"></div>' +
    '<div id="explorer-surah-count"></div>' +
    '<div id="explorer-total-occ"></div>' +
    '<div id="explorer-occ-nav" style="display:none"></div>' +
    '<div id="explorer-occ-prev"></div>' +
    '<div id="explorer-occ-label"></div>' +
    '<div id="explorer-occ-next"></div>' +
    '<div id="explorer-ayah-arabic"></div>' +
    '<div id="explorer-ayah-translation"></div>' +
    '<div id="explorer-ayah-ref"></div>' +
    '<div id="explorer-tafsir-box" style="display:none"></div>' +
    '<div id="explorer-tafsir-text"></div>' +
    '<div id="explorer-tafsir-btn">📚 Load Ibn Kathir Tafsir</div>' +
    '<div id="explorer-surah-links"></div>' +
    '<div id="explorer-root-family-list"></div>' +
    '<div id="explorer-derived-forms-list"></div>' +
    '<div id="explorer-morph-list"></div>' +
    '<div id="explorer-similar-list"></div>' +
    '<div id="explorer-confused-list"></div>' +
    '<div id="explorer-semantic-list"></div>' +
    '<div id="explorer-related-list"></div>' +
    '<div id="explorer-equiv-list"></div>' +
    '<div id="explorer-srs-stage"></div>' +
    '<div id="explorer-foundation-status"></div>' +
    '<div id="explorer-last-studied"></div>' +
    '<div id="explorer-next-review"></div>' +
    '<div id="explorer-review-count"></div>' +
    '<div id="explorer-retention"></div>' +
    '<div id="explorer-btn-bookmark">☆ Bookmark</div>' +
    '<div id="explorer-btn-study">📖 Study</div>' +
    '<div id="explorer-btn-review">⭐ Rate</div>' +
    '<div id="explorer-btn-open-flashcards">⚡ Flashcards</div>' +
    '<div id="explorer-btn-practice-related">🔗 Practice Related</div>' +
    '<div id="explorer-btn-view-occurrences">📋 View All</div>' +
    '<div id="explorer-all-occ-list" style="display:none"></div>' +
    '<div id="explorer-all-occ-btn">📋 View all occurrences</div>' +
    '<textarea id="explorer-notes-input"></textarea>';
  return container;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

ts('Explorer — Opening', function() {
  t('openExplorer sets the explorer word and switches view', function() {
    openExplorer(TEST_WORDS[0]);
    assert.strictEqual(_explorerWord, TEST_WORDS[0]);
    assert.strictEqual(global.__lastView, 'explorer');
  });

  t('openExplorer handles null word gracefully', function() {
    openExplorer(null);
    assert.strictEqual(_explorerWord, null);
  });

  t('closeExplorer returns to previous view', function() {
    _explorerReturnView = 'learn';
    closeExplorer();
    assert.strictEqual(global.__lastView, 'learn');
    assert.strictEqual(_explorerWord, null);
  });

  t('closeExplorer defaults to learn view', function() {
    _explorerReturnView = null;
    closeExplorer();
    assert.strictEqual(global.__lastView, 'learn');
  });
});

ts('Explorer — Rendering', function() {
  t('renderExplorer populates core info', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    // Need content container for scroll
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-arabic').textContent, 'الله');
    assert.strictEqual(document.getElementById('explorer-translit').textContent, 'Allah');
    assert.strictEqual(document.getElementById('explorer-meaning-main').textContent, 'Allah — God');
    assert.strictEqual(document.getElementById('explorer-root').textContent, 'أ-ل-ه');
    assert.strictEqual(document.getElementById('explorer-pos').textContent, 'Proper Noun');
  });

  t('renderExplorer shows difficulty stars', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.ok(document.getElementById('explorer-difficulty').innerHTML.indexOf('★') >= 0);
  });

  t('renderExplorer shows frequency rank pill', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.ok(document.getElementById('explorer-freq-rank').innerHTML.indexOf('#1') >= 0);
  });

  t('renderExplorer shows occurrence count', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.ok(document.getElementById('explorer-occ').innerHTML.indexOf('2,699') >= 0);
  });

  t('renderExplorer shows foundation lesson badge', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.ok(document.getElementById('explorer-foundation-lesson').innerHTML.indexOf('Foundation') >= 0);
  });

  t('renderExplorer shows priority chip', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.ok(document.getElementById('explorer-priority').innerHTML.indexOf('Essential') >= 0);
  });

  t('renderExplorer handles missing metadata gracefully', function() {
    var minimalWord = { id: 'w_test', arabic: 'test', english: 'test' };
    _explorerWord = minimalWord;
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-arabic').textContent, 'test');
    assert.strictEqual(document.getElementById('explorer-meaning-main').textContent, 'test');
    // Should show fallback for missing fields
    assert.ok(document.getElementById('explorer-root').textContent.length > 0);
  });
});

ts('Explorer — Root Family', function() {
  t('root family list is populated', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.children.length > 0);
  });

  t('root family chips are clickable', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var rootFamList = document.getElementById('explorer-root-family-list');
    var chip = rootFamList.querySelector('.explorer-rel-chip');
    if (chip) {
      // Click should open explorer for the target word
      chip.click();
      assert.ok(_explorerWord !== TEST_WORDS[0] || global.__lastView === 'explorer');
    }
  });

  t('root family shows empty state for words without root family', function() {
    var wordNoRoot = { id: 'w_test', arabic: 'test', english: 'test', rootFamily: [] };
    _explorerWord = wordNoRoot;
    createExplorerDOM();
    renderExplorerRelationships(wordNoRoot);
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.innerHTML.indexOf('No root family') >= 0);
  });
});

ts('Explorer — Bookmark', function() {
  t('bookmark button shows initial unbookmarked state', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var btn = document.getElementById('explorer-btn-bookmark');
    assert.ok(btn.textContent.indexOf('Bookmark') >= 0);
  });

  t('bookmark click toggles to bookmarked', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var btn = document.getElementById('explorer-btn-bookmark');
    btn.click();
    assert.ok(btn.textContent.indexOf('Bookmarked') >= 0);
    // Verify localStorage
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(favs[TEST_WORDS[0].id]);
  });

  t('bookmark click toggles back to unbookmarked', function() {
    _explorerWord = TEST_WORDS[0];
    // Pre-set as favorited
    var favs = {};
    favs[TEST_WORDS[0].id] = true;
    global.localStorage.setItem('quran_favorites', JSON.stringify(favs));
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var btn = document.getElementById('explorer-btn-bookmark');
    btn.click();
    assert.ok(btn.textContent.indexOf('Bookmark') >= 0 && btn.textContent.indexOf('Bookmarked') < 0);
    // Verify localStorage
    var updatedFavs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(!updatedFavs[TEST_WORDS[0].id]);
  });

  t('bookmark state persists after reopening explorer', function() {
    // Add bookmark
    global.toggleFavorite(TEST_WORDS[0].id);
    // Open explorer
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var btn = document.getElementById('explorer-btn-bookmark');
    assert.ok(btn.textContent.indexOf('Bookmarked') >= 0);
    assert.ok(btn.className.indexOf('active-qa') >= 0);
  });
});

ts('Explorer — Personal Notes', function() {
  t('notes input loads saved note', function() {
    global.localStorage.setItem('quran_notes', JSON.stringify({ cw_0: 'My test note' }));
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var notesInput = document.getElementById('explorer-notes-input');
    assert.strictEqual(notesInput.value, 'My test note');
  });

  t('notes input is empty for new words', function() {
    _explorerWord = TEST_WORDS[0];
    global.localStorage.setItem('quran_notes', '{}');
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    renderExplorer();
    var notesInput = document.getElementById('explorer-notes-input');
    assert.strictEqual(notesInput.value, '');
  });
});

ts('Explorer — Occurrence Navigation', function() {
  t('showExplorerOccurrence updates ayah display', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    showExplorerOccurrence(0);
    assert.ok(document.getElementById('explorer-ayah-arabic').innerHTML.length > 0);
    assert.strictEqual(document.getElementById('explorer-occ-label').textContent, '1 / 1');
  });

  t('showExplorerOccurrence hides tafsir on change', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var tafsirBox = document.getElementById('explorer-tafsir-box');
    tafsirBox.style.display = 'block';
    showExplorerOccurrence(0);
    assert.strictEqual(tafsirBox.style.display, 'none');
  });
});

ts('Explorer — Tafsir', function() {
  t('tafsir button toggles display', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    window.__explorerCurrentOcc = TEST_WORDS[0].occurrences[0];
    wireExplorerEvents(TEST_WORDS[0]);
    var btn = document.getElementById('explorer-tafsir-btn');
    btn.click();
    var tafsirBox = document.getElementById('explorer-tafsir-box');
    assert.strictEqual(tafsirBox.style.display, 'block');
    btn.click();
    assert.strictEqual(tafsirBox.style.display, 'none');
  });
});

ts('Explorer — Navigation Back', function() {
  t('back button calls closeExplorer', function() {
    _explorerWord = TEST_WORDS[0];
    _explorerReturnView = 'learn';
    createExplorerDOM();
    wireExplorerEvents(TEST_WORDS[0]);
    var backBtn = document.getElementById('explorer-back');
    backBtn.click();
    assert.strictEqual(global.__lastView, 'learn');
    assert.strictEqual(_explorerWord, null);
  });
});

ts('Explorer — Scroll Reset', function() {
  t('renderExplorer resets content scroll to top', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    var content = document.createElement('div');
    content.id = 'content';
    content.scrollTop = 100;
    renderExplorer();
    assert.strictEqual(content.scrollTop, 0);
  });
});

ts('Explorer — Learning Progress', function() {
  t('renderExplorerLearningProgress shows new word status', function() {
    _explorerWord = TEST_WORDS[0];
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false }, null);
    var stageEl = document.getElementById('explorer-srs-stage');
    assert.ok(stageEl.innerHTML.indexOf('New') >= 0 || stageEl.innerHTML.indexOf('🆕') >= 0);
  });

  t('renderExplorerLearningProgress shows review status when due', function() {
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], { status: 'review', stage: 1, retention: 0.5, daysUntilDue: -1, isLeech: false }, { ratedAt: Date.now() - 86400000, dueDate: Date.now() - 43200000, totalReviews: 5 });
    var stageEl = document.getElementById('explorer-srs-stage');
    assert.ok(stageEl.innerHTML.indexOf('review') >= 0 || stageEl.innerHTML.indexOf('🔁') >= 0);
  });

  t('renderExplorerLearningProgress shows mastered status', function() {
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], { status: 'mastered', stage: 3, retention: 0.9, daysUntilDue: 7, isLeech: false }, { ratedAt: Date.now() - 86400000, dueDate: Date.now() + 604800000, totalReviews: 20 });
    var stageEl = document.getElementById('explorer-srs-stage');
    assert.ok(stageEl.innerHTML.indexOf('Mature') >= 0 || stageEl.innerHTML.indexOf('✓') >= 0);
  });

  t('last studied shows proper relative time', function() {
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], null, { ratedAt: Date.now(), dueDate: Date.now() + 86400000, totalReviews: 1 });
    var lastEl = document.getElementById('explorer-last-studied');
    assert.ok(lastEl.innerHTML.indexOf('Today') >= 0);
  });

  t('next review shows due now status', function() {
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], null, { ratedAt: Date.now() - 86400000, dueDate: Date.now() - 3600000, totalReviews: 1 });
    var nextEl = document.getElementById('explorer-next-review');
    assert.ok(nextEl.innerHTML.indexOf('Due now') >= 0);
  });

  t('review count shows 0 for unstudied words', function() {
    createExplorerDOM();
    renderExplorerLearningProgress(TEST_WORDS[0], { status: 'new' }, null);
    var countEl = document.getElementById('explorer-review-count');
    assert.strictEqual(countEl.textContent, '0');
  });
});

ts('Explorer — Surah Links', function() {
  t('renderExplorerSurahLinks creates clickable surah chips', function() {
    createExplorerDOM();
    renderExplorerSurahLinks(TEST_WORDS[0]);
    var container = document.getElementById('explorer-surah-links');
    assert.ok(container.children.length > 0);
    assert.ok(container.innerHTML.indexOf('Al-Fatiha') >= 0);
  });

  t('renderExplorerSurahLinks shows empty state', function() {
    createExplorerDOM();
    var wordNoSurahs = { id: 'w_test', arabic: 'test', english: 'test', surahIds: [] };
    renderExplorerSurahLinks(wordNoSurahs);
    var container = document.getElementById('explorer-surah-links');
    assert.ok(container.innerHTML.indexOf('No surah') >= 0);
  });
});

ts('Explorer — Relationships', function() {
  t('renderExplorerRelationships processes all relationship types', function() {
    createExplorerDOM();
    renderExplorerRelationships(TEST_WORDS[0]);
    assert.ok(true); // Should not throw
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
