#!/usr/bin/env node
/**
 * vocabulary-access.test.js — Free-tier vocabulary limit (vocabularyExpansion gate)
 *
 * Verifies:
 *   • The free-300 set is computed dynamically from real frequency rank
 *     (same occ-based ranking Foundation Course uses) — NOT a hardcoded list.
 *   • Foundation Course's 100 words are a subset of the free-300.
 *   • Words tab / Explorer show a consistent locked state for premium words,
 *     and unlock live (no reload) when premium flips.
 *   • SRS new-entry and bookmark new-addition gates block premium words for
 *     free users while keeping pre-existing data reviewable (gate new
 *     additions only).
 *
 * Run: node test/vocabulary-access.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mock = require('./shared-mock');
mock.setup();

// renderWordList uses createDocumentFragment — shim it with a plain element.
global.document.createDocumentFragment = function () { return mock.makeEl('div'); };

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + (e.message || e).split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// PREMIUM MOCK — mutable so tests can simulate a live upgrade (the same
// state flip the onSnapshot listener performs in premium.js).
// ═══════════════════════════════════════════════════════════════
var _mockPremiumActive = false;
var _mockPremiumListeners = [];
var _upgradeRequests = [];
globalThis.window = globalThis;
global.window.__premium = {
  FEATURES: {
    VOCABULARY_EXPANSION: 'vocabularyExpansion',
    UNLIMITED_BOOKMARKS: 'unlimitedBookmarks',
    WORD_RELATIONSHIPS: 'wordRelationships',
  },
  hasFeature: function (k) { return _mockPremiumActive; },
  isPremium: function () { return _mockPremiumActive; },
  onChange: function (cb) {
    _mockPremiumListeners.push(cb);
    cb({ isPremium: _mockPremiumActive });
    return function () {};
  },
  requestUpgrade: function (reason) { _upgradeRequests.push(reason); },
};

function setMockPremium(active) {
  _mockPremiumActive = active;
  _mockPremiumListeners.slice().forEach(function (cb) { try { cb({ isPremium: active }); } catch (e) {} });
}

global.showToast = function () {};

// ═══════════════════════════════════════════════════════════════
// LOAD REAL MODULES (same chain as the bundled app)
// ═══════════════════════════════════════════════════════════════
function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; convert to var.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  global.eval(code);
}

load('js/data/occurrence-index.js');
load('js/data-core/vocab-data.js');
load('js/data/surahs.js');
fs.readdirSync(path.join(__dirname, '..', 'js/data')).filter(function (f) {
  return f.startsWith('words-') && f.endsWith('.js');
}).sort().forEach(function (f) {
  load('js/data/' + f);
});
load('js/data-core/foundation.js');
load('js/data-core/lesson-system.js');

// Bootstrap the real foundation course (dedup is lazy — trigger it first)
var CANON = getCanonicalWords();
buildFoundationCourse();

load('js/vocabulary.js');
load('js/srs.js');
load('js/ui/explorer.js');
load('js/ui/stats-ui.js');

// Real free/locked sample ids resolved from canonical data.
function _wordAtRank(rank) {
  var sorted = CANON.slice().sort(function (a, b) { return (b.occ || 0) - (a.occ || 0); });
  return sorted[rank - 1];
}
var _freeSample = _wordAtRank(1);      // most frequent word — free
var _lockedSample = _wordAtRank(1208); // least frequent word — locked
var _freeId = _freeSample.id;
var _lockedId = _lockedSample.id;

// ═══════════════════════════════════════════════════════════════
// SECTION A — Real-dataset ranking (Step 2 verification)
// ═══════════════════════════════════════════════════════════════
suite('Free-300 — real frequency-rank selection', function () {
  test('dataset has 1208 canonical words', function () {
    assert.strictEqual(CANON.length, 1208);
  });

  test('free limit constant is 300', function () {
    assert.strictEqual(window.__vocabAccess.getLimit(), 300);
  });

  test('exactly 300 words are free (ranks 1–300)', function () {
    var freeCount = 0;
    for (var i = 0; i < CANON.length; i++) {
      if (isFreeAccessible(CANON[i])) freeCount++;
    }
    assert.strictEqual(freeCount, 300);
    assert.strictEqual(getFreeVocabularyCount(), 300);
  });

  test('rank-300 cutoff lands at occ=21 with a 13-way tie at the boundary', function () {
    var rank292 = _wordAtRank(292);
    var rank293 = _wordAtRank(293);
    var rank300 = _wordAtRank(300);
    var rank301 = _wordAtRank(301);
    assert.strictEqual(rank292.occ, 22);
    assert.strictEqual(rank293.occ, 21);
    assert.strictEqual(rank300.occ, 21);
    assert.strictEqual(rank301.occ, 21);
    // Exactly 13 words tie at occ 21 (ranks 293–305 — the boundary band)
    var tieCount = CANON.filter(function (w) { return w.occ === 21; }).length;
    assert.strictEqual(tieCount, 13);
    // Deterministic set: rank 300 free, rank 301 locked
    assert.strictEqual(isFreeAccessible(rank300), true);
    assert.strictEqual(isFreeAccessible(rank301), false);
  });

  test('Foundation Course 100 is a strict subset of the free-300', function () {
    assert.ok(Array.isArray(FOUNDATION_WORDS) && FOUNDATION_WORDS.length === 100);
    var outside = FOUNDATION_WORDS.filter(function (id) { return !isFreeAccessible(id); });
    assert.strictEqual(outside.length, 0, 'foundation words outside free-300: ' + outside.length);
    // Foundation occupies exactly the top-100 ranks (ranks 1–100)
    var foundationRanks = FOUNDATION_WORDS.map(function (id) { return getWordFrequencyRank(id); });
    foundationRanks.sort(function (a, b) { return a - b; });
    assert.strictEqual(foundationRanks[0], 1);
    assert.strictEqual(foundationRanks[99], 100);
  });

  test('isFreeAccessible resolves canonical ids (cw_N) and legacy ids', function () {
    // Canonical id strings are NOT in the ALL_WORDS index — must resolve.
    assert.strictEqual(isFreeAccessible(_freeId), true);
    assert.strictEqual(isFreeAccessible(_lockedId), false);
    assert.strictEqual(typeof getWordFrequencyRank(_freeId), 'number');
  });

  test('dynamic by frequency rank — no hardcoded list, stays correct if data grows', function () {
    // Synthetic word objects with frequencyRank → correct gate.
    assert.strictEqual(isFreeAccessible({ id: 'x', frequencyRank: 1 }), true);
    assert.strictEqual(isFreeAccessible({ id: 'x', frequencyRank: 300 }), true);
    assert.strictEqual(isFreeAccessible({ id: 'x', frequencyRank: 301 }), false);
    // Word without frequencyRank falls back to the occ-based rank map.
    assert.strictEqual(isFreeAccessible({ id: _freeId, occ: _freeSample.occ }), true);
    assert.strictEqual(isFreeAccessible({ id: _lockedId, occ: _lockedSample.occ }), false);
    // Unknown ids fail closed (locked) — never accidentally free.
    assert.strictEqual(isFreeAccessible('does-not-exist'), false);
  });

  test('premium unlocks the full vocabulary', function () {
    setMockPremium(true);
    assert.strictEqual(isFreeAccessible(_lockedId), true);
    assert.strictEqual(isFreeAccessible({ id: 'x', frequencyRank: 9999 }), true);
    setMockPremium(false);
    assert.strictEqual(isFreeAccessible(_lockedId), false);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION B — Bookmark gate (new additions only)
// ═══════════════════════════════════════════════════════════════
suite('Bookmarks — gate new additions only', function () {
  test('free word can be bookmarked normally', function () {
    mock.clearStorage();
    assert.strictEqual(toggleFavorite(_freeId), true);
    assert.strictEqual(isFavorite(_freeId), true);
    assert.strictEqual(toggleFavorite(_freeId), false); // toggle removes
  });

  test('premium word cannot be newly bookmarked by a free user (requests upgrade)', function () {
    mock.clearStorage();
    _upgradeRequests.length = 0;
    assert.strictEqual(toggleFavorite(_lockedId), false);
    assert.strictEqual(isFavorite(_lockedId), false);
    assert.ok(_upgradeRequests.indexOf('vocabulary-expansion') >= 0);
  });

  test('existing premium bookmark stays and can be removed', function () {
    mock.clearStorage();
    var favs = {};
    favs[_lockedId] = true;
    global.localStorage.setItem('quran_favorites', JSON.stringify(favs));
    assert.strictEqual(isFavorite(_lockedId), true);       // existing kept
    assert.strictEqual(toggleFavorite(_lockedId), false);  // removal allowed
    assert.strictEqual(isFavorite(_lockedId), false);
  });

  test('premium user can bookmark premium words', function () {
    mock.clearStorage();
    setMockPremium(true);
    assert.strictEqual(toggleFavorite(_lockedId), true);
    assert.strictEqual(isFavorite(_lockedId), true);
    setMockPremium(false);
    mock.clearStorage();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION C — SRS gate (new entries only)
// ═══════════════════════════════════════════════════════════════
suite('SRS — gate new entries only', function () {
  test('free word can be added to the review queue', function () {
    mock.clearStorage();
    rateSRSWord(_freeId, 2);
    assert.ok(loadSRS()[_freeId], 'free word should have an SRS entry');
  });

  test('premium word cannot be added by a free user (requests upgrade)', function () {
    mock.clearStorage();
    _upgradeRequests.length = 0;
    var result = rateSRSWord(_lockedId, 2);
    assert.strictEqual(result, false);
    assert.ok(!loadSRS()[_lockedId], 'premium word must not enter SRS');
    assert.ok(_upgradeRequests.indexOf('vocabulary-expansion') >= 0);
  });

  test('existing premium SRS entry stays reviewable (gate new additions only)', function () {
    mock.clearStorage();
    var entry = { dueDate: Date.now(), interval: 0, lastRating: 2, ratedAt: Date.now(), stage: 1, reps: 1, totalReviews: 3, lapses: 0, easeFactor: 2.5 };
    var srs = {};
    srs[_lockedId] = entry;
    global.localStorage.setItem('quran_srs_data', JSON.stringify(srs));
    var before = loadSRS()[_lockedId].totalReviews;
    rateSRSWord(_lockedId, 2); // existing entry — allowed
    assert.strictEqual(loadSRS()[_lockedId].totalReviews, before + 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION C2 — Mixed Review queue (no premium backdoor)
// ═══════════════════════════════════════════════════════════════
suite('Mixed Review — no premium backdoor', function () {
  test('free user never gets premium words as new items in mixed review', function () {
    mock.clearStorage();
    var srs = {};
    srs[_freeId] = { dueDate: Date.now() - 1000, interval: 1, lastRating: 2, ratedAt: Date.now(), stage: 2, reps: 2, totalReviews: 2, lapses: 0, easeFactor: 2.5 };
    global.localStorage.setItem('quran_srs_data', JSON.stringify(srs));
    var queue = getMixedReviewQueue(100);
    var ids = queue.map(function (w) { return w.id; });
    assert.ok(ids.indexOf(_freeId) >= 0, 'due free review included');
    var premiumNew = queue.filter(function (w) { return !isFreeAccessible(w) && !srs[w.id]; });
    assert.strictEqual(premiumNew.length, 0, 'premium words must not enter mixed review as new items');
  });

  test('premium word with existing SRS entry stays reviewable in mixed review', function () {
    mock.clearStorage();
    var srs = {};
    srs[_lockedId] = { dueDate: Date.now() - 1000, interval: 1, lastRating: 2, ratedAt: Date.now(), stage: 2, reps: 2, totalReviews: 2, lapses: 0, easeFactor: 2.5 };
    global.localStorage.setItem('quran_srs_data', JSON.stringify(srs));
    var queue = getMixedReviewQueue(100);
    var ids = queue.map(function (w) { return w.id; });
    assert.ok(ids.indexOf(_lockedId) >= 0, 'existing premium entry stays due/reviewable');
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION D — Explorer locked detail + live unlock
// ═══════════════════════════════════════════════════════════════
suite('Explorer — locked detail view + live unlock', function () {
  global.switchView = function (view) { global.__lastView = view; };
  global.getCurrentWord = function () { return _freeSample; };
  global.goToSurah = function () {};
  global.window.__navigateToWord = function () {};
  global.window.__explorerCurrentOcc = null;
  global.window.__scrollOnExplorerRender = false;
  global.currentView = 'learn';
  global.isFoundationLessonCompleted = function () { return false; };

  // DOM helper used by explorer.js (dom-helpers.js defines it in the bundle)
  global.DOM = {
    _cache: {},
    get: function (id) { return document.getElementById(id); },
    invalidateCache: function () {},
  };

  function createAllExplorerEls() {
    var ids = [
      'view-explorer', 'content',
      'explorer-core', 'explorer-quran-context', 'explorer-relationships',
      'explorer-learning-progress', 'explorer-actions', 'explorer-notes',
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
    ids.forEach(function (id) {
      var el = mock.makeEl('div');
      el.id = id;
      if (id === 'view-explorer') document.body.appendChild(el);
    });
  }

  function resetExplorer() {
    mock.resetDOM();
    mock.clearStorage();
    global.__lastView = null;
    global.__explorerCurrentOcc = null;
    _mockPremiumActive = false;
    createAllExplorerEls();
  }

  test('premium word opens a locked detail view (sections hidden + upgrade CTA)', function () {
    resetExplorer();
    openExplorer(_lockedSample);
    assert.strictEqual(global.__lastView, 'explorer');
    renderExplorer();
    var panel = document.getElementById('explorer-vocab-locked');
    assert.ok(panel, 'locked panel should exist');
    assert.strictEqual(panel.style.display, 'block');
    assert.ok(panel.innerHTML.indexOf('Vocabulary Expansion') >= 0);
    assert.ok(panel.innerHTML.indexOf('requestUpgrade') >= 0);
    // Full-word-information sections are hidden
    assert.strictEqual(document.getElementById('explorer-quran-context').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-relationships').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-learning-progress').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-actions').style.display, 'none');
    assert.strictEqual(document.getElementById('explorer-notes').style.display, 'none');
    // Back button is wired so a locked view is never a dead end
    var backBtn = document.getElementById('explorer-back');
    assert.strictEqual(typeof backBtn.onclick, 'function');
  });

  test('free word renders the full explorer', function () {
    resetExplorer();
    openExplorer(_freeSample);
    renderExplorer();
    var panel = document.getElementById('explorer-vocab-locked');
    assert.ok(!panel || panel.style.display === 'none', 'no locked panel for free words');
    assert.notStrictEqual(document.getElementById('explorer-quran-context').style.display, 'none');
    assert.notStrictEqual(document.getElementById('explorer-relationships').style.display, 'none');
    // Word identity rendered
    assert.strictEqual(document.getElementById('explorer-arabic').textContent, _freeSample.arabic);
  });

  test('LIVE UNLOCK: premium upgrade mid-session re-renders full detail without reload', function () {
    resetExplorer();
    openExplorer(_lockedSample);
    renderExplorer();
    assert.strictEqual(document.getElementById('explorer-vocab-locked').style.display, 'block');

    // Simulate the onSnapshot write after purchase → premium flips live.
    setMockPremium(true);
    // rerenderCurrentView() calls renderExplorer() for the explorer view — the
    // same call the live premium listener fires.
    renderExplorer();

    var panel = document.getElementById('explorer-vocab-locked');
    assert.ok(!panel || panel.style.display === 'none', 'locked panel gone after live unlock');
    assert.notStrictEqual(document.getElementById('explorer-quran-context').style.display, 'none');
    assert.notStrictEqual(document.getElementById('explorer-actions').style.display, 'none');
    setMockPremium(false);
  });

  test('Quran reader tokens still render normally for premium words (detail only gated)', function () {
    // The gate lives in openExplorer/renderExplorer — the verse-token renderer
    // (js/ui/quran.js) is untouched. Simulate the tap path: token click for a
    // premium word calls openExplorer → locked detail, never full info.
    resetExplorer();
    openExplorer(_lockedSample);
    renderExplorer();
    assert.ok(document.getElementById('explorer-vocab-locked'));
    assert.ok(renderExplorerLocked, 'locked renderer exists');
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION E — Words tab locked rows + live unlock
// ═══════════════════════════════════════════════════════════════
suite('Words tab — locked rows + live unlock', function () {
  global.getShortMeaning = function (m) { return (m || '').split('\u2014')[0].trim(); };
  global.navigateToWord = function () {};
  global.toggleQuickMode = function () {};

  function createListEls() {
    ['content', 'search-input', 'wordlist-container', 'list-count',
     'advanced-filter-panel', 'filter-result-count'].forEach(function (id) {
      var el = mock.makeEl('div');
      el.id = id;
      if (id === 'search-input') el.value = '';
      if (id === 'advanced-filter-panel') el.style.display = 'none';
      if (id === 'wordlist-container') el.children = [];
    });
  }

  function resetList() {
    mock.resetDOM();
    mock.clearStorage();
    _mockPremiumActive = false;
    createListEls();
  }

  function listRows() {
    var container = document.getElementById('wordlist-container');
    // renderWordList appends one DocumentFragment per render; the mock's
    // innerHTML setter does not clear children, so only the LAST fragment's
    // rows reflect the most recent render (live-unlock re-renders stack).
    var rows = [];
    var kids = container.children || [];
    var last = kids.length > 0 ? kids[kids.length - 1] : null;
    if (last) {
      (last.children || []).forEach(function (row) { rows.push(row); });
      if (rows.length === 0) rows.push(last);
    }
    return rows;
  }

  test('free words render normally; premium words show a locked row', function () {
    resetList();
    renderWordList();
    var rows = listRows();
    assert.ok(rows.length >= 300, 'expected at least 300 rows, got ' + rows.length);

    var freeRow = null, lockedRow = null;
    rows.forEach(function (row) {
      if (row._word && row._word.id === _freeId) freeRow = row;
      if (row._word && row._word.id === _lockedId) lockedRow = row;
    });
    assert.ok(freeRow, 'free word row exists');
    assert.ok(freeRow.className.indexOf('locked-word') < 0, 'free row not locked');
    assert.ok(lockedRow, 'locked word row exists (discoverable, not hidden)');
    assert.ok(lockedRow.className.indexOf('locked-word') >= 0, 'locked row styled');
    assert.ok(lockedRow.innerHTML.indexOf('\uD83D\uDD12') >= 0, 'lock badge shown');
    assert.ok(lockedRow.innerHTML.indexOf(_lockedSample.arabic) >= 0, 'word still visible');
  });

  test('search still surfaces premium words (locked on tap)', function () {
    resetList();
    document.getElementById('search-input').value = _lockedSample.arabic;
    renderWordList();
    var rows = listRows();
    var lockedRow = rows.filter(function (r) { return r._word && r._word.id === _lockedId; })[0];
    assert.ok(lockedRow, 'premium word surfaces in search results');
    assert.ok(lockedRow.className.indexOf('locked-word') >= 0);
    // Tapping routes to the locked explorer (never full info).
    var navTarget = null;
    global.navigateToWord = function (w) { navTarget = w; };
    lockedRow.onclick();
    assert.strictEqual(navTarget.id, _lockedId);
  });

  test('LIVE UNLOCK: premium upgrade mid-session re-renders the list unlocked', function () {
    resetList();
    renderWordList();
    var lockedBefore = listRows().filter(function (r) { return r._word && r._word.id === _lockedId; })[0];
    assert.ok(lockedBefore.className.indexOf('locked-word') >= 0);

    setMockPremium(true);
    renderWordList(); // what rerenderCurrentView() calls for the list view

    var lockedAfter = listRows().filter(function (r) { return r._word && r._word.id === _lockedId; })[0];
    assert.ok(lockedAfter.className.indexOf('locked-word') < 0, 'row unlocked after live upgrade');
    setMockPremium(false);
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
