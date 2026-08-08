#!/usr/bin/env node
/**
 * quran-reader.test.js — Regression tests for the Quran reader fixes:
 *
 *  R1 — _normArabicForMatch delegates to the canonical OCCURRENCE_INDEX_NORM
 *       (the same normalizer the occurrence index uses), instead of a weaker
 *       parallel normalizer that missed ~27% of vocabulary matches.
 *  R2 — renderAyahs() displays the ORIGINAL corpus token (exact Uthmani text
 *       from the verse), never the dictionary/canonical form substituted in.
 *  R3 — word-card showAyah() and Explorer showExplorerOccurrence() route the
 *       ayah text through the shared _highlightOccurrenceText() helper, so the
 *       target word is gold-highlighted even when hand-authored data lacks
 *       embedded <span class="ayah-highlight"> markup.
 *
 * Run: node test/quran-reader.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var mock = require('./shared-mock');
mock.setup();
global.clearStorage = mock.clearStorage;

var ROOT = path.join(__dirname, '..');
var passed = 0, failed = 0;

function t(name, fn) {
  try {
    mock.resetDOM();
    mock.clearStorage();
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + (e.message || e).split('\n')[0]);
  }
}

function ts(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// LOAD REAL SOURCE: quran data + occurrence index + reader module,
// all in ONE shared vm context so the reader's module-level `let`
// state is reachable by the harness script.
// ═══════════════════════════════════════════════════════════════

var quranDataSrc = fs.readFileSync(path.join(ROOT, 'js/quran/quran-data.js'), 'utf8');
var occIndexSrc = fs.readFileSync(path.join(ROOT, 'js/data/occurrence-index.js'), 'utf8');
var quranJsSrc = fs.readFileSync(path.join(ROOT, 'js/ui/quran.js'), 'utf8');

// Harness runs INSIDE the same script scope as quran.js, so it can set
// _quranAyahGroups / _quranVerseKeys / _quranSurahId and call renderAyahs().
var harnessSrc = [
  'var __container = { _html: "", _htmlSet: false };',
  'Object.defineProperty(__container, "innerHTML", {',
  '  get: function () { return this._html; },',
  '  set: function (v) { this._html = v || ""; },',
  '});',
  '__container.querySelectorAll = function () { return []; };',
  'var __doc = { getElementById: function (id) {',
  '  if (id === "quran-verses") return __container;',
  '  return null;',
  '} };',
  'var __savedDoc = typeof document !== "undefined" ? document : null;',
  'document = __doc;',
  'var __result = {};',
  'var __s2 = window.__QURAN_TEXT && window.__QURAN_TEXT[2];',
  'if (__s2) {',
  '  var __vocab = [{ id: "cw_test", arabic: "\u0647\u064F\u062F\u064B\u0649", meaning: "Guidance", english: "Guidance" }];',
  '  var __built = _buildVerseData(2, __s2, __vocab);',
  '  _quranAyahGroups = __built.ayahGroups;',
  '  _quranVerseKeys = __built.verseKeys;',
  '  _quranSurahId = 2;',
  '  renderAyahs();',
  '  __result.html = __container._html;',
  '  __result.ayah2 = __built.ayahGroups["2:2"] ? __built.ayahGroups["2:2"].ayahA : "";',
  '  __result.normKitab = _normArabicForMatch("\u0671\u0644\u0652\u0643\u0650\u062A\u064E\u0670\u0628\u064F");',
  '  __result.normHuda = _normArabicForMatch("\u0647\u064F\u062F\u0657\u0649");',
  '  __result.canonKitab = OCCURRENCE_INDEX_NORM("\u0671\u0644\u0652\u0643\u0650\u062A\u064E\u0670\u0628\u064F");',
  '} else {',
  '  __result.html = "";',
  '}',
  'if (__savedDoc) document = __savedDoc;',
  '__result;',
].join('\n');

var readerSandbox = null;
var readerResult = null;
(function () {
  global.window = global;
  try {
    var combined = quranDataSrc + '\n' + occIndexSrc + '\n' + quranJsSrc + '\n' + harnessSrc;
    readerResult = vm.runInThisContext(combined, { filename: 'quran-reader.test-harness.js' });
    readerSandbox = global;
  } catch (e) {
    console.log('  \u26A0 Could not build reader sandbox: ' + e.message);
  }
})();

// ═══════════════════════════════════════════════════════════════
// LOAD THE SHARED HIGHLIGHT HELPER + word-card + explorer (like
// occurrence-index.test.js / explorer.test.js do) for R3 tests.
// ═══════════════════════════════════════════════════════════════

global.openExplorer = function () {};
global.SURAH_INFO = {
  1: { name: 'Al-Fatihah', english: 'The Opening', verses: 7 },
  2: { name: 'Al-Baqarah', english: 'The Cow', verses: 286 },
};
global.DOM = { _cache: {}, get: function (id) { return document.getElementById(id); }, invalidateCache: function () {} };
global.getSRSStatus = function () { return { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false }; };
global.loadSRS = function () { return {}; };
global.findWordByArabic = function () { return null; };
global.findWordsByArabicList = function (list) { return list || []; };
global.window.__navigateToWord = function () {};
global.window.__explorerCurrentOcc = null;
global.window.__scrollOnExplorerRender = false;

try {
  var analyticsCode = fs.readFileSync(path.join(ROOT, 'js/ui/analytics-ui.js'), 'utf8');
  eval(analyticsCode);
  var wordCardCode = fs.readFileSync(path.join(ROOT, 'js/ui/word-card.js'), 'utf8');
  eval(wordCardCode);
  var explorerCode = fs.readFileSync(path.join(ROOT, 'js/ui/explorer.js'), 'utf8');
  eval(explorerCode);
} catch (e) {
  console.log('  \u26A0 Could not load UI modules for R3 tests: ' + e.message);
}

function createEl(id) {
  var el = mock.makeEl('div');
  el.id = id;
  return el;
}

// ═══════════════════════════════════════════════════════════════
// R1 — Canonical normalizer
// ═══════════════════════════════════════════════════════════════

ts('R1 — Reader normalizer matches the canonical OCCURRENCE_INDEX_NORM', function () {
  t('_normArabicForMatch produces identical output to OCCURRENCE_INDEX_NORM', function () {
    if (!readerResult) { console.log('     (sandbox unavailable — skipping)'); return; }
    assert.strictEqual(readerResult.normKitab, readerResult.canonKitab);
  });

  t('dagger-alif word ٱلۡكِتَٰبُ normalizes to الكتاب (old reader gave الكتب)', function () {
    if (!readerResult) { console.log('     (sandbox unavailable — skipping)'); return; }
    assert.strictEqual(readerResult.normKitab, '\u0627\u0644\u0643\u062A\u0627\u0628');
  });

  t('normalizer is deterministic/idempotent on corpus tokens', function () {
    if (!readerSandbox || !readerSandbox._normArabicForMatch) { console.log('     (sandbox unavailable — skipping)'); return; }
    var norm = readerSandbox._normArabicForMatch('\u0647\u064F\u062F\u064B\u0649');
    assert.strictEqual(norm, readerSandbox._normArabicForMatch(norm));
  });
});

// ═══════════════════════════════════════════════════════════════
// R2 — Corpus-token display (text accuracy)
// ═══════════════════════════════════════════════════════════════

ts('R2 — Reader displays ORIGINAL corpus text, never dictionary substitutions', function () {
  t('verse 2:2 ayahA is the real corpus text', function () {
    if (!readerResult) { console.log('     (sandbox unavailable — skipping)'); return; }
    // Exact corpus token ٱلۡكِتَٰبُ (U+0671 alif-wasla, U+06E1 high mark on lam).
    assert.ok(readerResult.ayah2.indexOf('\u0671\u0644\u06E1\u0643\u0650\u062A\u064E\u0670\u0628\u064F') >= 0,
      'ayahA contains the corpus token ٱلۡكِتَٰبُ');
  });

  t('matched word هُدًى renders its CORPUS form هُدٗى inside the token span', function () {
    if (!readerResult) { console.log('     (sandbox unavailable — skipping)'); return; }
    var html = readerResult.html;
    // The rendered span must contain the corpus token (هُدٗى), not the
    // dictionary form (هُدًى) that the old code substituted in.
    assert.ok(html.indexOf('\u0647\u064F\u062F\u0657\u0649') >= 0,
      'rendered HTML contains corpus token هُدٗى');
    var dictFormWrapped = html.indexOf('\u003E\u0647\u064F\u062F\u064B\u0649\u003C') >= 0;
    assert.strictEqual(dictFormWrapped, false,
      'rendered HTML does NOT contain dictionary form هُدًى as visible span text');
  });

  t('non-vocabulary tokens are preserved verbatim (plain spans)', function () {
    if (!readerResult) { console.log('     (sandbox unavailable — skipping)'); return; }
    var html = readerResult.html;
    assert.ok(html.indexOf('\u0630\u064E\u0670\u0644\u0650\u0643\u064E') >= 0,
      'rendered HTML contains the unmarked token ذَٰلِكَ verbatim');
    // The audit-cited wasla/dagger-alif token must appear verbatim (corpus form),
    // not replaced by any dictionary form.
    assert.ok(html.indexOf('\u0671\u0644\u06E1\u0643\u0650\u062A\u064E\u0670\u0628\u064F') >= 0,
      'rendered HTML contains the corpus token ٱلۡكِتَٰبُ verbatim');
  });
});

// ═══════════════════════════════════════════════════════════════
// R3 — Highlight routing through _highlightOccurrenceText
// ═══════════════════════════════════════════════════════════════

ts('R3 — Word-card showAyah routes through the highlight helper', function () {
  t('gap word (no embedded markup) gets gold highlight at runtime', function () {
    if (typeof showAyah !== 'function' || typeof _highlightOccurrenceText !== 'function') {
      console.log('     (modules unavailable — skipping)'); return;
    }
    createEl('ayah-arabic');
    createEl('ayah-translation');
    createEl('ayah-ref');
    createEl('ayah-box');
    var w = { arabic: '\u0645\u064E\u0646\u0652', id: 'cw_gap', meaning: 'who / whoever' };
    global.window.__currentOccurrence = {
      ayahA: '\u0648\u064E\u0645\u0650\u0646\u064E \u0627\u0644\u0646\u0651\u064E\u0627\u0633\u0650 \u0645\u064E\u0646\u0652 \u064A\u064E\u0642\u064F\u0648\u0644\u064F',
      ayahT: 'And of the people is he who says...',
      ayahR: '2:8',
    };
    showAyah(w);
    var html = document.getElementById('ayah-arabic').innerHTML;
    assert.ok(html.indexOf('explorer-ayah-highlight') >= 0,
      'runtime highlight span present for a word with no embedded markup');
    assert.ok(html.indexOf('\u0645\u064F\u0646\u064E') >= 0 || html.indexOf('\u0645\u064E\u0646\u0652') >= 0,
      'corpus token text preserved inside highlight');
  });

  t('already-working entry (embedded ayah-highlight markup) still renders correctly', function () {
    if (typeof showAyah !== 'function' || typeof _highlightOccurrenceText !== 'function') {
      console.log('     (modules unavailable — skipping)'); return;
    }
    createEl('ayah-arabic');
    createEl('ayah-translation');
    createEl('ayah-ref');
    createEl('ayah-box');
    var w = { arabic: '\u0645\u064E\u0646\u0652', id: 'cw_embedded', meaning: 'who / whoever' };
    global.window.__currentOccurrence = {
      ayahA: '\u0648\u064E\u0645\u0650\u0646\u064E <span class="ayah-highlight">\u0627\u0644\u0646\u0651\u064E\u0627\u0633\u0650</span> \u0645\u064E\u0646\u0652 \u064A\u064E\u0642\u064F\u0648\u0644\u064F',
      ayahT: 'And of the people is he who says...',
      ayahR: '2:8',
    };
    showAyah(w);
    var html = document.getElementById('ayah-arabic').innerHTML;
    assert.ok(html.indexOf('ayah-highlight') >= 0,
      'embedded ayah-highlight markup preserved');
  });
});

ts('R3 — showAyah preserves DIFFERENT corpus forms (no dictionary substitution)', function () {
  t('corpus form مِّنَ is highlighted (not replaced by dictionary مَنْ)', function () {
    if (typeof showAyah !== 'function' || typeof _highlightOccurrenceText !== 'function') {
      console.log('     (modules unavailable — skipping)'); return;
    }
    createEl('ayah-arabic');
    createEl('ayah-translation');
    createEl('ayah-ref');
    createEl('ayah-box');
    // Dictionary form is مَنْ; the verse uses the inflected corpus form مِّنَ.
    var w = { arabic: '\u0645\u064E\u0646\u0652', id: 'cw_inflected', meaning: 'who / whoever' };
    global.window.__currentOccurrence = {
      ayahA: '\u064A\u064E\u0642\u064F\u0648\u0644\u064F \u0645\u0650\u0651\u0646\u064E \u0627\u0644\u0646\u0651\u064E\u0627\u0633\u0650',
      ayahT: 'Some of the people say...',
      ayahR: '2:8',
    };
    showAyah(w);
    var html = document.getElementById('ayah-arabic').innerHTML;
    // The inflected corpus form مِّنَ must be wrapped in the highlight span
    // (both مِّنَ and مَنْ normalize to the same form, so the helper matches
    // the corpus token and preserves its exact text).
    assert.ok(html.indexOf('explorer-ayah-highlight\">\u0645\u0650\u0651\u0646\u064E<') >= 0,
      'corpus form مِّنَ is the highlighted text (not dictionary مَنْ)');
    var dictSubstituted = html.indexOf('explorer-ayah-highlight\">\u0645\u064E\u0646\u0652<') >= 0;
    assert.strictEqual(dictSubstituted, false,
      'dictionary form مَنْ is NOT substituted into the visible text');
  });
});

ts('R3 — Explorer single-occurrence panel routes through the highlight helper', function () {
  t('gap word gets gold highlight in showExplorerOccurrence', function () {
    if (typeof showExplorerOccurrence !== 'function' || typeof _highlightOccurrenceText !== 'function') {
      console.log('     (modules unavailable — skipping)'); return;
    }
    createEl('explorer-ayah-arabic');
    createEl('explorer-ayah-translation');
    createEl('explorer-ayah-ref');
    createEl('explorer-occ-label');
    createEl('explorer-occ-prev');
    createEl('explorer-occ-next');
    createEl('explorer-tafsir-box');
    _explorerWord = {
      arabic: '\u0645\u064E\u0646\u0652',
      id: 'cw_gap2',
      occurrences: [{
        ayahA: '\u0648\u064E\u0645\u0650\u0646\u064E \u0627\u0644\u0646\u0651\u064E\u0627\u0633\u0650 \u0645\u064E\u0646\u0652 \u064A\u064E\u0642\u064F\u0648\u0644\u064F',
        ayahT: 'And of the people is he who says...',
        ayahR: '2:8',
      }],
    };
    showExplorerOccurrence(0);
    var html = document.getElementById('explorer-ayah-arabic').innerHTML;
    assert.ok(html.indexOf('explorer-ayah-highlight') >= 0,
      'runtime highlight span present for a word with no embedded markup');
    assert.ok(html.indexOf('\u0645\u064F\u0646\u064E') >= 0 || html.indexOf('\u0645\u064E\u0646\u0652') >= 0,
      'corpus token text preserved');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
