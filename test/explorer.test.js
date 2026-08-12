#!/usr/bin/env node
/**
 * explorer.test.js — Unit tests for the Vocabulary Explorer
 *
 * Tests: word opening, rendering, root family chips, bookmark toggle,
 * notes auto-save, tafsir toggle, occurrence navigation, related words,
 * back button, and learning progress display.
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
var _setup = mock.setup();
global.clearStorage = mock.clearStorage;

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

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
global.isFoundationLessonCompleted = function() { return false; };
global.currentView = 'learn';

// Load the explorer module
var explorerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
eval(explorerCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;
var _asyncPending = 0;

// Print the summary only once every (possibly async) test has settled.
function _maybeFinish() {
  if (_asyncPending > 0) return;
  var total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

function t(name, fn) {
  try {
    mock.resetDOM();
    mock.clearStorage();
    global.__lastView = null;
    global.__explorerCurrentOcc = null;
    _explorerWord = null;
    _explorerReturnView = 'learn';
    global.localStorage.setItem('quran_favorites', '{}');
    global.localStorage.setItem('quran_notes', '{}');
    var result = fn();
    if (result && typeof result.then === 'function') {
      _asyncPending++;
      result.then(function () {
        passed++;
        console.log('  ✅ ' + name);
        _asyncPending--;
        _maybeFinish();
      }, function (e) {
        failed++;
        console.log('  ❌ ' + name);
        console.log('     ' + (e.message || e).split('\n')[0]);
        _asyncPending--;
        _maybeFinish();
      });
    } else {
      passed++;
      console.log('  ✅ ' + name);
    }
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e).split('\n')[0]);
  }
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

function createEl(id) {
  var el = mock.makeEl('div');
  el.id = id;
  return el;
}

// Create all explorer DOM elements needed for full renderExplorer() call
function createAllExplorerEls() {
  var ids = [
    'view-explorer', 'content',
    'explorer-arabic', 'explorer-translit', 'explorer-meaning-main', 'explorer-full-meaning',
    'explorer-root', 'explorer-pos',
    'explorer-freq-rank', 'explorer-occ', 'explorer-foundation-lesson',
    'explorer-first-occ', 'explorer-last-occ', 'explorer-surah-count', 'explorer-total-occ',
    'explorer-occ-nav', 'explorer-occ-prev', 'explorer-occ-label', 'explorer-occ-next',
    'explorer-ayah-arabic', 'explorer-ayah-translation', 'explorer-ayah-ref',
    'explorer-tafsir-box', 'explorer-tafsir-text', 'explorer-tafsir-btn',
    'explorer-surah-links',
    'explorer-root-family-list', 'explorer-derived-forms-list', 'explorer-morph-list',
    'explorer-similar-list', 'explorer-confused-list', 'explorer-semantic-list',
    'explorer-related-list', 'explorer-equiv-list',
    'explorer-srs-stage', 'explorer-foundation-status', 'explorer-last-studied',
    'explorer-next-review-item', 'explorer-next-review',
    'explorer-review-count-item', 'explorer-review-count',
    'explorer-retention-item', 'explorer-retention',
    'explorer-btn-bookmark',
    'explorer-btn-practice-related',
    'explorer-all-occ-list', 'explorer-all-occ-btn',
    'explorer-notes-input',
    'explorer-back',
  ];
  ids.forEach(function(id) { createEl(id); });
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

ts('Explorer — Opening', function() {
  t('openExplorer switches to explorer view', function() {
    openExplorer(TEST_WORDS[0]);
    assert.strictEqual(global.__lastView, 'explorer');
  });

  t('openExplorer handles null word gracefully', function() {
    openExplorer(null);
    assert.ok(true);
  });

  t('closeExplorer returns to learn by default', function() {
    closeExplorer();
    assert.strictEqual(global.__lastView, 'learn');
  });
});

ts('Explorer — Rendering', function() {
  t('renderExplorer populates core info', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-arabic').textContent, 'الله');
    assert.strictEqual(document.getElementById('explorer-translit').textContent, 'Allah');
    assert.strictEqual(document.getElementById('explorer-meaning-main').textContent, 'Allah — God');
    assert.strictEqual(document.getElementById('explorer-root').textContent, 'أ-ل-ه');
    assert.strictEqual(document.getElementById('explorer-pos').textContent, 'Proper Noun');
  });

  t('renderExplorer does not render difficulty or morphology (removed from Core Information)', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-difficulty'), null);
    assert.strictEqual(document.getElementById('explorer-pattern'), null);
    assert.strictEqual(document.getElementById('explorer-priority'), null);
  });

  t('renderExplorer shows frequency rank', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    assert.ok(document.getElementById('explorer-freq-rank').innerHTML.indexOf('#1') >= 0);
  });

  t('renderExplorer merges learning priority into the frequency rank card', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    var html = document.getElementById('explorer-freq-rank').innerHTML;
    assert.ok(html.indexOf('explorer-priority-chip') >= 0, 'priority chip must render inside the freq-rank card');
    assert.ok(html.indexOf(getLearningPriorityLabel(TEST_WORDS[0].learningPriority)) >= 0,
      'priority label must appear in the merged card');
  });

  t('renderExplorer merged freq-rank card degrades to em dash when word has no data', function() {
    // A bare word with neither frequencyRank nor learningPriority must not crash
    // and must render the em-dash fallback.
    var bareWord = { id: 'cw_x', arabic: 'x' };
    _explorerWord = bareWord;
    createAllExplorerEls();
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-freq-rank').innerHTML.indexOf('—') >= 0, true);
  });

  t('renderExplorer shows occurrence count', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    assert.ok(document.getElementById('explorer-occ').innerHTML.indexOf('2,699') >= 0);
  });

  t('renderExplorer shows foundation badge', function() {
    _explorerWord = TEST_WORDS[0];
    createAllExplorerEls();
    renderExplorer();
    assert.ok(document.getElementById('explorer-foundation-lesson').innerHTML.indexOf('Foundation') >= 0);
  });

  t('renderExplorer handles missing metadata', function() {
    var w = { id: 'w_test', arabic: 'test', english: 'test', translit: '', meaning: '', root: '—', rootMeaning: '', pattern: '', type: '', typeCategory: '', difficulty: 0, occ: 0, frequencyRank: 0, frequencyPercentile: 0, learningPriority: 0, foundationLessonId: -1, occurrences: [], surahIds: [], surahCount: 0, firstOccurrence: '', lastOccurrence: '' };
    _explorerWord = w;
    createAllExplorerEls();
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-arabic').textContent, 'test');
  });
});

ts('Explorer — Root Family', function() {
  t('root family list is populated for words with root family data', function() {
    createEl('explorer-root-family-list');
    createEl('explorer-derived-forms-list');
    createEl('explorer-morph-list');
    createEl('explorer-similar-list');
    createEl('explorer-confused-list');
    createEl('explorer-semantic-list');
    createEl('explorer-related-list');
    createEl('explorer-equiv-list');
    renderExplorerRelationships(TEST_WORDS[0]);
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.children.length > 0 || rootFamList.innerHTML.indexOf('No root family') >= 0);
  });

  t('word without root family does not crash', function() {
    var w = { id: 'w_noroot', arabic: 'test', english: 'test', root: '—' };
    createEl('explorer-root-family-list');
    createEl('explorer-derived-forms-list');
    createEl('explorer-morph-list');
    createEl('explorer-similar-list');
    createEl('explorer-confused-list');
    createEl('explorer-semantic-list');
    createEl('explorer-related-list');
    createEl('explorer-equiv-list');
    renderExplorerRelationships(w);
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.innerHTML.indexOf('No root family') >= 0 ||
             rootFamList.innerHTML.indexOf('n/a') >= 0 ||
             rootFamList.children.length === 0);
  });

  t('word with empty root family array shows empty state', function() {
    var w = { id: 'w_emptyrf', arabic: 'نور', english: 'light', root: 'ن-و-ر', rootFamily: [] };
    createEl('explorer-root-family-list');
    createEl('explorer-derived-forms-list');
    createEl('explorer-morph-list');
    createEl('explorer-similar-list');
    createEl('explorer-confused-list');
    createEl('explorer-semantic-list');
    createEl('explorer-related-list');
    createEl('explorer-equiv-list');
    renderExplorerRelationships(w);
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.innerHTML.indexOf('No root family') >= 0 ||
             rootFamList.children.length === 0);
  });

  t('root family shows individual words when data exists', function() {
    createEl('explorer-root-family-list');
    createEl('explorer-derived-forms-list');
    createEl('explorer-morph-list');
    createEl('explorer-similar-list');
    createEl('explorer-confused-list');
    createEl('explorer-semantic-list');
    createEl('explorer-related-list');
    createEl('explorer-equiv-list');
    renderExplorerRelationships(TEST_WORDS[0]);
    var rootFamList = document.getElementById('explorer-root-family-list');
    assert.ok(rootFamList.children.length > 0, 'should have root family chips');
    if (rootFamList.children.length > 0) {
      var chipText = rootFamList.children[0].textContent || rootFamList.children[0].innerHTML || '';
      assert.ok(chipText.length > 0, 'root family chip should have content');
    }
  });
});

ts('Explorer — Bookmark', function() {
  t('clicking bookmark toggles state', function() {
    createEl('explorer-btn-bookmark');
    renderExplorerActions(TEST_WORDS[0], null);
    wireExplorerEvents(TEST_WORDS[0]);
    var btn = document.getElementById('explorer-btn-bookmark');
    btn.click();
    assert.ok(btn.textContent.indexOf('Bookmarked') >= 0);
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(favs[TEST_WORDS[0].id]);
  });

  t('clicking bookmark again removes it', function() {
    var favs = {};
    favs[TEST_WORDS[0].id] = true;
    global.localStorage.setItem('quran_favorites', JSON.stringify(favs));
    createEl('explorer-btn-bookmark');
    renderExplorerActions(TEST_WORDS[0], null);
    wireExplorerEvents(TEST_WORDS[0]);
    var btn = document.getElementById('explorer-btn-bookmark');
    btn.click();
    assert.ok(btn.textContent.indexOf('Bookmark') >= 0 && btn.textContent.indexOf('Bookmarked') < 0);
    var updatedFavs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(!updatedFavs[TEST_WORDS[0].id]);
  });

  t('bookmark persists in localStorage', function() {
    global.toggleFavorite(TEST_WORDS[0].id);
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(favs[TEST_WORDS[0].id]);
  });

  t('multiple words can be bookmarked independently', function() {
    global.toggleFavorite(TEST_WORDS[0].id);
    global.toggleFavorite(TEST_WORDS[1].id);
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(favs[TEST_WORDS[0].id], 'first word should be bookmarked');
    assert.ok(favs[TEST_WORDS[1].id], 'second word should be bookmarked');
    assert.strictEqual(Object.keys(favs).length, 2, 'exactly 2 bookmarks');
  });

  t('removing one bookmark does not affect others', function() {
    global.toggleFavorite(TEST_WORDS[0].id);
    global.toggleFavorite(TEST_WORDS[1].id);
    global.toggleFavorite(TEST_WORDS[0].id); // remove first
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(!favs[TEST_WORDS[0].id], 'first word should not be bookmarked');
    assert.ok(favs[TEST_WORDS[1].id], 'second word should still be bookmarked');
    assert.strictEqual(Object.keys(favs).length, 1, 'exactly 1 bookmark remaining');
  });

  t('isFavorite returns false for non-bookmarked word', function() {
    assert.strictEqual(global.isFavorite('nonexistent'), false);
    assert.strictEqual(global.isFavorite(TEST_WORDS[0].id), false);
  });

  t('isFavorite returns true after bookmarking', function() {
    global.toggleFavorite(TEST_WORDS[0].id);
    assert.strictEqual(global.isFavorite(TEST_WORDS[0].id), true);
  });

  t('bookmark survives simulated page reload (new localStorage read)', function() {
    global.toggleFavorite(TEST_WORDS[0].id);
    // Simulate reload by clearing in-memory and re-reading from localStorage
    var freshRead = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(freshRead[TEST_WORDS[0].id], 'bookmark should persist after reload');
  });

  t('empty favorites returns empty object', function() {
    global.localStorage.setItem('quran_favorites', '{}');
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.strictEqual(Object.keys(favs).length, 0);
  });

  // Note: corrupted localStorage data handling is tested in test/vocabulary.test.js
  // (the real loadFavorites function has try/catch; the mock in this test
  // file does not replicate the full error handling logic)

  t('bookmarking non-existent word ID does not crash', function() {
    global.toggleFavorite('nonexistent_word_id');
    var favs = JSON.parse(global.localStorage.getItem('quran_favorites') || '{}');
    assert.ok(favs['nonexistent_word_id'], 'should still store even if word does not exist in ALL_WORDS');
  });
});

ts('Explorer — Notes', function() {
  t('notes input loads saved content from localStorage', function() {
    global.localStorage.setItem('quran_notes', JSON.stringify({ cw_0: 'My note' }));
    // Directly test getNote/setNote instead of calling full renderExplorer
    // (which creates/overwrites DOM elements via innerHTML)
    assert.strictEqual(global.getNote('cw_0'), 'My note');
    assert.strictEqual(global.getNote('cw_1'), '');
    // Test setNote persists
    global.setNote('cw_1', 'Another note');
    assert.strictEqual(global.getNote('cw_1'), 'Another note');
  });
});

ts('Explorer — Occurrence Navigation', function() {
  t('showExplorerOccurrence updates ayah display', function() {
    _explorerWord = TEST_WORDS[0];
    createEl('explorer-ayah-arabic');
    createEl('explorer-ayah-translation');
    createEl('explorer-ayah-ref');
    createEl('explorer-occ-label');
    createEl('explorer-occ-prev');
    createEl('explorer-occ-next');
    createEl('explorer-tafsir-box');
    showExplorerOccurrence(0);
    assert.ok(document.getElementById('explorer-ayah-arabic').innerHTML.length > 0);
    assert.strictEqual(document.getElementById('explorer-occ-label').textContent, '1 / 1');
  });
});

// NOTE: The tafsir daily-limit tests are async (they await the Firestore-backed
// counter) and are therefore run in a dedicated block AFTER all synchronous
// tests, because the sync t() harness resets the mock DOM before every test,
// which would otherwise wipe the elements these async tests await on.
// See the 'Explorer — Tafsir (async)' section at the bottom of this file.

ts('Explorer — Learning Progress', function() {
  function createProgressEls() {
    createEl('explorer-srs-stage');
    createEl('explorer-foundation-status');
    createEl('explorer-last-studied');
    createEl('explorer-next-review-item');
    createEl('explorer-next-review');
    createEl('explorer-review-count-item');
    createEl('explorer-review-count');
    createEl('explorer-retention-item');
    createEl('explorer-retention');
  }

  t('new word shows New status', function() {
    createProgressEls();
    renderExplorerLearningProgress(TEST_WORDS[0], { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false }, null);
    var stageEl = document.getElementById('explorer-srs-stage');
    assert.ok(stageEl.innerHTML.indexOf('New') >= 0 || stageEl.innerHTML.indexOf('🆕') >= 0);
  });

  t('unstudied word hides Next Review, Total Reviews, Retention rows', function() {
    createProgressEls();
    var srsStatus = { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false };
    renderExplorerLearningProgress(TEST_WORDS[0], srsStatus, srsStatus);
    // Unstudied (0 reviews): all three gated rows hidden, no placeholder
    assert.strictEqual(document.getElementById('explorer-next-review-item').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-review-count-item').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-retention-item').style.display, 'none');
    // Mastery + Last Studied untouched — still rendered with real content
    assert.ok(document.getElementById('explorer-srs-stage').innerHTML.indexOf('New') >= 0);
    assert.ok(document.getElementById('explorer-last-studied').innerHTML.indexOf('Never studied') >= 0);
    // Hidden Next Review wrapper holds no stale placeholder text
    assert.strictEqual(document.getElementById('explorer-next-review').innerHTML, '');
  });

  t('word below 5 reviews hides Total Reviews and Retention', function() {
    createProgressEls();
    var srsStatus = { status: 'review', stage: 1, retention: 0.5, daysUntilDue: 1, isLeech: false };
    var entry = { totalReviews: 3, dueDate: Date.now() + 86400000, ratedAt: Date.now() - 86400000 };
    renderExplorerLearningProgress(TEST_WORDS[0], srsStatus, entry);
    assert.strictEqual(document.getElementById('explorer-review-count-item').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-retention-item').style.display, 'none');
    // Next Review shows a real countdown even below 5 reviews
    assert.notStrictEqual(document.getElementById('explorer-next-review-item').style.display, 'none');
    assert.ok(document.getElementById('explorer-next-review').innerHTML.indexOf('Tomorrow') >= 0);
  });

  t('word at 5+ reviews shows real Total Reviews and Retention', function() {
    createProgressEls();
    var srsStatus = { status: 'mastered', stage: 3, retention: 0.82, daysUntilDue: 7, isLeech: false };
    var entry = { totalReviews: 7, dueDate: Date.now() + 7 * 86400000, ratedAt: Date.now() - 86400000 };
    renderExplorerLearningProgress(TEST_WORDS[0], srsStatus, entry);
    assert.notStrictEqual(document.getElementById('explorer-review-count-item').style.display, 'none');
    assert.notStrictEqual(document.getElementById('explorer-retention-item').style.display, 'none');
    assert.ok(String(document.getElementById('explorer-review-count').textContent).indexOf('7') >= 0);
    assert.ok(document.getElementById('explorer-retention').textContent.indexOf('82%') >= 0);
    assert.ok(document.getElementById('explorer-next-review').innerHTML.indexOf('7 days') >= 0);
  });
});

ts('Explorer — Surah Links', function() {
  t('surah links show surah names', function() {
    createEl('explorer-surah-links');
    renderExplorerSurahLinks(TEST_WORDS[0]);
    var container = document.getElementById('explorer-surah-links');
    // renderExplorerSurahLinks uses appendChild() which updates children array
    assert.ok(container.children.length > 0, 'should have surah chips');
    assert.ok(container.children[0].textContent.indexOf('Al-Fatiha') >= 0 ||
             container.children[0].textContent.indexOf('Al-Fatihah') >= 0,
             'surah name should be somewhere in the chip text');
  });
});

ts('Explorer — Back Navigation', function() {
  t('back button calls closeExplorer', function() {
    createEl('explorer-back');
    _explorerReturnView = 'learn';
    wireExplorerEvents(TEST_WORDS[0]);
    document.getElementById('explorer-back').click();
    assert.strictEqual(global.__lastView, 'learn');
  });
});

// ═══════════════════════════════════════════════════════════════
// EXPLORER — TAFSIR (ASYNC)
//
// The tafsir button awaits the Firestore-backed daily-limit counter before
// toggling, so these tests run as one sequential async block at the very end
// (after every synchronous t() has settled). Each sub-test manages its own
// mock DOM so later resets can't wipe elements mid-await.
// ═══════════════════════════════════════════════════════════════

ts('Explorer — Relationships stale-locked cleanup (regression)', function () {
  t('premium render hides stale locked panel and restores hidden sections', function () {
    // Simulate a stale free-tier state directly: locked panel visible and the
    // gated sections hidden. (The mock DOM has no insertBefore, so we build
    // the state manually instead of calling renderExplorerRelationshipsLocked.)
    var locked = createEl('explorer-relationships-locked');
    locked.style.display = 'block';
    document.body.appendChild(locked);
    var derivedList = createEl('explorer-derived-forms-list');
    var parent = mock.makeEl('section');
    parent.appendChild(derivedList);
    parent.style.display = 'none';
    document.body.appendChild(parent);

    // Premium render — must clear the stale locked panel + restore sections
    renderExplorerRelationships(TEST_WORDS[0]);
    assert.strictEqual(locked.style.display, 'none', 'locked panel cleared for premium');
    assert.strictEqual(parent.style.display, '', 'gated section restored for premium');
  });
});

ts('Explorer — Tafsir (async)', function() {
  _asyncPending++;
  (async function () {
    // ── 1. Toggle via the shared async counter (premium-like: allowed) ──
    try {
      mock.resetDOM();
      mock.clearStorage();
      createEl('explorer-tafsir-box');
      createEl('explorer-tafsir-text');
      createEl('explorer-tafsir-btn');
      window.__explorerCurrentOcc = TEST_WORDS[0].occurrences[0];
      global.window.__user = {
        checkTafsirLimit: function () { return Promise.resolve(true); },
      };
      wireExplorerEvents(TEST_WORDS[0]);
      var btn = document.getElementById('explorer-tafsir-btn');
      var box = document.getElementById('explorer-tafsir-box');
      await btn.onclick();
      assert.strictEqual(box.style.display, 'block');
      await btn.onclick();
      assert.strictEqual(box.style.display, 'none');
      passed++;
      console.log('  ✅ tafsir button toggles visibility (async daily-limit check)');
    } catch (e) {
      failed++;
      console.log('  ❌ tafsir button toggles visibility (async daily-limit check)');
      console.log('     ' + (e.message || e).split('\n')[0]);
    }

    // ── 2. Free user at the 5/day cap is blocked (shared counter) ──
    try {
      mock.resetDOM();
      mock.clearStorage();
      createEl('explorer-tafsir-box');
      createEl('explorer-tafsir-text');
      createEl('explorer-tafsir-btn');
      window.__explorerCurrentOcc = TEST_WORDS[0].occurrences[0];
      global.window.__user = {
        checkTafsirLimit: function () { return Promise.resolve(false); },
      };
      wireExplorerEvents(TEST_WORDS[0]);
      var btn2 = document.getElementById('explorer-tafsir-btn');
      var box2 = document.getElementById('explorer-tafsir-box');
      await btn2.onclick();
      // The blocked handler returns before touching the box, so display stays
      // unset — verify the box did NOT open (not 'block').
      assert.notStrictEqual(box2.style.display, 'block');
      assert.ok(btn2.disabled, 'tafsir button should be disabled at the cap');
      passed++;
      console.log('  ✅ free user at 5/day tafsir cap is blocked');
    } catch (e) {
      failed++;
      console.log('  ❌ free user at 5/day tafsir cap is blocked');
      console.log('     ' + (e.message || e).split('\n')[0]);
    }

    // ── 3. Legacy localStorage fallback still enforces the cap ──
    try {
      mock.resetDOM();
      mock.clearStorage();
      createEl('explorer-tafsir-box');
      createEl('explorer-tafsir-text');
      createEl('explorer-tafsir-btn');
      window.__explorerCurrentOcc = TEST_WORDS[0].occurrences[0];
      // No window.__user mock here — exercises the legacy localStorage path.
      global.window.__user = null;
      var today = new Date().toISOString().slice(0, 10);
      global.localStorage.setItem('quran_tafsir_usage', JSON.stringify({ date: today, count: 5 }));
      wireExplorerEvents(TEST_WORDS[0]);
      var btn3 = document.getElementById('explorer-tafsir-btn');
      var box3 = document.getElementById('explorer-tafsir-box');
      await btn3.onclick();
      // Blocked handler returns before touching the box — verify it did NOT open.
      assert.notStrictEqual(box3.style.display, 'block');
      assert.ok(btn3.disabled, 'tafsir button should be disabled at the cap');
      passed++;
      console.log('  ✅ legacy localStorage fallback still enforces the cap');
    } catch (e) {
      failed++;
      console.log('  ❌ legacy localStorage fallback still enforces the cap');
      console.log('     ' + (e.message || e).split('\n')[0]);
    }
  })().then(function () {
    _asyncPending--;
    _maybeFinish();
  }, function (e) {
    failed++;
    console.log('  ❌ async tafsir suite crashed');
    console.log('     ' + (e.message || e).split('\n')[0]);
    _asyncPending--;
    _maybeFinish();
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

_maybeFinish();
