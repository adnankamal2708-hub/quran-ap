#!/usr/bin/env node
/**
 * word-card-occurrence.test.js — Regression tests for occurrence (context)
 * navigation in the Learn word card.
 *
 * Guards the bug where clicking "Next context" / "Prev context" did not change
 * the displayed ayah: renderWordCard() hides the ayah panel on every re-render
 * but left the OLD occurrence's text stale inside it, so a user navigating a
 * multi-context word (e.g. آيَاتِ "Signs", 2 contexts) saw the same context
 * no matter which button they pressed.
 *
 * Loads the REAL dom-helpers.js + word-card.js with an auto-vivifying DOM mock
 * and verifies that next/prev occurrence:
 *   1. advances the occurrence index and nav label,
 *   2. re-populates the ayah panel with the NEW occurrence (and keeps it open),
 *   3. stops at the boundaries,
 *   4. clears stale ayah content when the panel is hidden.
 *
 * Run: node test/word-card-occurrence.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var mock = require('./shared-mock');
mock.setup();
global.clearStorage = mock.clearStorage;

// ── Auto-vivifying DOM mock ────────────────────────────────────
// Any element id the UI touches is created on demand, so renderWordCard()
// can run against a minimal DOM exactly like the real one (which has all
// these elements in index.html).
var _els = {};

function makeDoc() {
  return {
    getElementById: function (id) {
      if (!_els[id]) { var el = mock.makeEl('div'); el.id = id; _els[id] = el; }
      return _els[id];
    },
    createElement: function (tag) { return mock.makeEl(tag); },
    createDocumentFragment: function () {
      return { children: [], appendChild: function (c) { this.children.push(c); } };
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    body: { style: {}, appendChild: function () {}, dispatchEvent: function () {} },
    addEventListener: function () {},
  };
}
global.document = makeDoc();
global.window = global;

// ── Load REAL UI sources ───────────────────────────────────────
function load(rel) {
  var code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // let/const at eval top level do not leak to global scope; convert to var
  // exactly like coverage-accuracy.test.js does.
  code = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  global.eval(code);
}
load('js/data/surahs.js');      // SURAH_INFO
load('js/ui/dom-helpers.js');   // DOM
load('js/ui/word-card.js');     // renderWordCard / showAyah / nextOccurrence / prevOccurrence

// ── App-level stubs (mirror app.js contracts) ──────────────────
var _currentWord = null;

global.getCurrentWord = function () { return _currentWord; };
global.updateWordCard = function () {
  var w = global.getCurrentWord();
  if (!w) return;
  renderWordCard(w, 0, 1, false);
  var btnNext = document.getElementById('btn-next');
  if (btnNext) btnNext.onclick = function () {};
};
global.getSRSStatus = function () {
  return { status: 'new', stage: 0, retention: 0, daysUntilDue: 0, isLeech: false };
};
global.getNote = function () { return ''; };
global.isFavorite = function () { return false; };
global.loadSRS = function () { return {}; };
// Vocabulary lookups used by the relationship renderers (free tier hides them,
// but the functions are still invoked defensively by the render path).
global.findWordByArabic = function () { return null; };
global.findWordsByArabicList = function () { return []; };
global.getRelatedWordObjects = function () { return []; };
global.getDerivedForms = function () { return []; };
global.getSemanticGroups = function () { return []; };
global.getConfusedWith = function () { return []; };
global.getMorphologicalRelationships = function () { return []; };
global.getContextualEquivalents = function () { return []; };
global.buildRelationsCache = function () {};
global.getWordRelationships = function () { return {}; };
global.window.__premium = { hasFeature: function () { return false; }, FEATURES: {} };

// ── Fixtures ───────────────────────────────────────────────────
var OCC1 = {
  surahId: 10, verseKey: '10:6',
  ayahA: 'إِنَّ فِي اخْتِلَافِ اللَّيْلِ وَالنَّهَارِ وَمَا خَلَقَ اللَّهُ فِي السَّمَاوَاتِ وَالْأَرْضِ لَآيَاتٍ لِّقَوْمٍ يَتَّقُونَ',
  ayahT: 'Indeed, in the alternation of night and day are signs for people who are mindful.',
  ayahR: 'Yunus 10:6', tafsir: '',
};
var OCC2 = {
  surahId: 54, verseKey: '54:22',
  ayahA: 'وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ',
  ayahT: 'And We have certainly made the Quran easy to remember.',
  ayahR: 'Al-Qamar 54:22', tafsir: '',
};
function makeMultiContextWord(id) {
  return {
    id: id,
    arabic: 'آيَاتِ',
    translit: 'Āyāt',
    type: 'Noun',
    occ: 65,
    frequency: 'very-high',
    difficulty: 1,
    tags: [],
    surahIds: [10, 54],
    occurrences: [OCC1, OCC2],
  };
}

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + (e.message || e).split('\n').join('\n     '));
  }
}

function suite(name, fn) {
  console.log('\n\uD83D\uDCCB ' + name);
  fn();
}

function render(word) {
  _currentWord = word;
  global.updateWordCard();
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Word card occurrence navigation', function () {
  test('Shows occurrence nav (1/2) for a multi-context word', function () {
    render(makeMultiContextWord('cw_t1'));
    assert.strictEqual(document.getElementById('occ-label').textContent, '1/2');
    assert.strictEqual(document.getElementById('occ-prev').disabled, true);
    assert.strictEqual(document.getElementById('occ-next').disabled, false);
    assert.strictEqual(document.getElementById('surah-badge').textContent.indexOf('(1/2)') >= 0, true);
  });

  test('Next context advances the label and updates the ayah display', function () {
    render(makeMultiContextWord('cw_t2'));
    showAyah(_currentWord);
    assert.strictEqual(document.getElementById('ayah-box').classList.contains('visible'), true);
    assert.strictEqual(document.getElementById('ayah-ref').textContent, 'Yunus 10:6');

    nextOccurrence();
    assert.strictEqual(document.getElementById('occ-label').textContent, '2/2');
    assert.strictEqual(document.getElementById('ayah-ref').textContent, 'Al-Qamar 54:22');
    assert.strictEqual(document.getElementById('ayah-arabic').innerHTML.indexOf('يَسَّرْنَا') >= 0, true);
    // The panel stays open with the new context — it must NOT hide or linger stale.
    assert.strictEqual(document.getElementById('ayah-box').classList.contains('visible'), true);
    assert.strictEqual(window.__currentOccurrence.verseKey, '54:22');
  });

  test('Prev context goes back and updates the ayah display', function () {
    render(makeMultiContextWord('cw_t3'));
    showAyah(_currentWord);
    nextOccurrence();
    assert.strictEqual(document.getElementById('ayah-ref').textContent, 'Al-Qamar 54:22');

    prevOccurrence();
    assert.strictEqual(document.getElementById('occ-label').textContent, '1/2');
    assert.strictEqual(document.getElementById('ayah-ref').textContent, 'Yunus 10:6');
    assert.strictEqual(document.getElementById('ayah-box').classList.contains('visible'), true);
    assert.strictEqual(window.__currentOccurrence.verseKey, '10:6');
  });

  test('Next does nothing at the last occurrence; Prev does nothing at the first', function () {
    render(makeMultiContextWord('cw_t4'));
    nextOccurrence();
    assert.strictEqual(document.getElementById('occ-label').textContent, '2/2');
    assert.strictEqual(document.getElementById('occ-next').disabled, true);
    nextOccurrence(); // boundary — no change
    assert.strictEqual(document.getElementById('occ-label').textContent, '2/2');
    assert.strictEqual(window.__currentOccurrence.verseKey, '54:22');

    prevOccurrence();
    prevOccurrence(); // boundary at 1/2 — no change
    assert.strictEqual(document.getElementById('occ-label').textContent, '1/2');
    assert.strictEqual(document.getElementById('occ-prev').disabled, true);
    assert.strictEqual(window.__currentOccurrence.verseKey, '10:6');
  });

  test('Ayah panel is cleared (no stale context) when navigating to a new word', function () {
    render(makeMultiContextWord('cw_t5'));
    showAyah(_currentWord);
    assert.strictEqual(document.getElementById('ayah-arabic').innerHTML.indexOf('اخْتِلَافِ') >= 0, true);

    // Moving to a different word hides the panel and clears its content.
    render(makeMultiContextWord('cw_t5b'));
    assert.strictEqual(document.getElementById('ayah-box').classList.contains('visible'), false);
    assert.strictEqual(document.getElementById('ayah-arabic').innerHTML, '');
    assert.strictEqual(document.getElementById('ayah-translation').innerHTML, '');
    assert.strictEqual(document.getElementById('ayah-ref').textContent, '');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('  word-card-occurrence.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
