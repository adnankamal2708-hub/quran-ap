#!/usr/bin/env node
/**
 * occurrence-index.test.js — Tests for the generated Quran occurrence index
 * (js/data/occurrence-index.js) and the merged "Show all occurrences"
 * renderer (renderExplorerAllOccurrences in js/ui/analytics-ui.js).
 *
 * Verifies:
 *  - the generated index exposes OCCURRENCE_INDEX + OCCURRENCE_INDEX_NORM
 *  - common words (الله، من، في، الذين) contain MANY occurrences
 *  - every verse ref is well-formed and unique per word
 *  - a random sample of refs points at real verses in the corpus
 *  - renderExplorerAllOccurrences renders EVERY indexed occurrence
 *  - backward compat: word.occurrences-only words still render
 *  - lazy surah loading for unloaded verses, with re-render on arrival
 *
 * Run: node test/occurrence-index.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var mock = require('./shared-mock');
mock.setup();
global.clearStorage = mock.clearStorage;

// ═══════════════════════════════════════════════════════════════
// LOAD THE GENERATED OCCURRENCE INDEX (same mechanism as the bundle)
// ═══════════════════════════════════════════════════════════════

var indexSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'occurrence-index.js'), 'utf8');
var sandbox = { window: {}, console: console };
sandbox.window = sandbox; // generated IIFE assigns onto window
vm.createContext(sandbox);
vm.runInContext(indexSource, sandbox);
var OCCURRENCE_INDEX = sandbox.window.OCCURRENCE_INDEX;
var NORM = sandbox.window.OCCURRENCE_INDEX_NORM;

// ═══════════════════════════════════════════════════════════════
// LOAD THE RENDERER (eval analytics-ui.js like other UI tests)
// ═══════════════════════════════════════════════════════════════

global.openExplorer = function () {};
global.SURAH_INFO = {
  1: { name: 'Al-Fatihah', english: 'The Opening', verses: 7 },
  2: { name: 'Al-Baqarah', english: 'The Cow', verses: 286 },
  3: { name: "Ali 'Imran", english: 'Family of Imran', verses: 200 },
  95: { name: 'At-Tin', english: 'The Fig', verses: 8 },
  96: { name: 'Al-Alaq', english: 'The Clot', verses: 19 },
};
var analyticsCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'analytics-ui.js'), 'utf8');
eval(analyticsCode);

// ═══════════════════════════════════════════════════════════════
// TEST HARNESS (supports async tests via tAsync)
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;
var asyncPromises = [];

function t(name, fn) {
  try {
    mock.resetDOM();
    mock.clearStorage();
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e).split('\n')[0]);
  }
}

function tAsync(name, fn) {
  asyncPromises.push(Promise.resolve().then(fn).then(function () {
    passed++;
    console.log('  ✅ ' + name);
  }, function (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e).split('\n')[0]);
  }));
}

function ts(name, fn) {
  console.log('\n📋 ' + name);
  fn();
}

// ═══════════════════════════════════════════════════════════════
// TESTS — GENERATED DATA
// ═══════════════════════════════════════════════════════════════

ts('Occurrence Index — generated data', function () {
  t('index exposes OCCURRENCE_INDEX object and NORM function', function () {
    assert.ok(OCCURRENCE_INDEX, 'OCCURRENCE_INDEX is defined');
    assert.strictEqual(typeof OCCURRENCE_INDEX, 'object');
    assert.strictEqual(typeof NORM, 'function');
    assert.ok(Object.keys(OCCURRENCE_INDEX).length >= 500, 'has 500+ keys');
  });

  t('NORM strips diacritics the same way rebuild-occurrences.js does', function () {
    assert.strictEqual(NORM('اللَّهُ'), 'الله');
    assert.strictEqual(NORM('مِنْ'), 'من');
    assert.strictEqual(NORM('فِي'), 'في');
    assert.strictEqual(NORM('ٱلَّذِينَ'), 'الذين');
  });

  t('common words contain MANY occurrences (not just 1)', function () {
    var allah = (OCCURRENCE_INDEX['الله'] || []).length;
    var min = (OCCURRENCE_INDEX['من'] || []).length;
    var fee = (OCCURRENCE_INDEX['في'] || []).length;
    var allatheena = (OCCURRENCE_INDEX['الذين'] || []).length;
    assert.ok(allah >= 500, 'الله has ' + allah + ' refs (expected 500+)');
    assert.ok(min >= 500, 'من has ' + min + ' refs (expected 500+)');
    assert.ok(fee >= 300, 'في has ' + fee + ' refs (expected 300+)');
    assert.ok(allatheena >= 300, 'الذين has ' + allatheena + ' refs (expected 300+)');
  });

  t('every verse ref is well-formed and unique per word', function () {
    Object.keys(OCCURRENCE_INDEX).forEach(function (key) {
      var seen = {};
      OCCURRENCE_INDEX[key].forEach(function (ref) {
        var m = /^(\d+):(\d+)$/.exec(ref);
        assert.ok(m, 'malformed ref "' + ref + '" for key "' + key + '"');
        var sid = parseInt(m[1], 10);
        assert.ok(sid >= 1 && sid <= 114, 'surah out of range in ref ' + ref);
        assert.ok(!seen[ref], 'duplicate ref ' + ref + ' for key "' + key + '"');
        seen[ref] = true;
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS — RENDERER (renderExplorerAllOccurrences)
// ═══════════════════════════════════════════════════════════════

ts('renderExplorerAllOccurrences — merged rendering', function () {
  t('renders every indexed occurrence when index has many refs', function () {
    global.window.OCCURRENCE_INDEX = {
      'الله': ['2:255', '2:256', '3:18', '3:26', '3:27'],
    };
    global.window.OCCURRENCE_INDEX_NORM = function (a) { return NORM(a); };
    // Pre-load the surahs so no lazy fetch is needed
    global.window.__QURAN_TEXT = {
      2: { verses: [
        { id: 255, text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ', translation: 'Allah — none has the right to be worshipped but He' },
        { id: 256, text: 'اللَّهُ وَلِيُّ الَّذِينَ آمَنُوا', translation: 'Allah is the ally of those who believe' },
      ] },
      3: { verses: [
        { id: 18, text: 'شَهِدَ اللَّهُ أَنَّهُ لَا إِلَٰهَ إِلَّا هُوَ', translation: 'Allah bears witness' },
        { id: 26, text: 'قُلِ اللَّهُمَّ مَالِكَ الْمُلْكِ', translation: 'Say: O Allah, Owner of Sovereignty' },
        { id: 27, text: 'تُولِجُ اللَّيْلَ فِي النَّهَارِ', translation: 'You cause the night to enter the day' },
      ] },
    };
    delete global.window.__quranLoader;
    var listEl = mock.makeEl('div');
    renderExplorerAllOccurrences(listEl, {
      arabic: 'اللَّهُ',
      translit: 'Allah',
      occurrences: [],
    });
    var itemCount = (listEl.innerHTML.match(/explorer-occ-item/g) || []).length;
    assert.strictEqual(itemCount, 5, 'renders all 5 indexed occurrences, got ' + itemCount);
    assert.ok(listEl.innerHTML.indexOf('Al-Baqarah') >= 0, 'surah name shown');
  });

  t('dedupes: word.occurrences entries merge with index refs (no double-count)', function () {
    global.window.OCCURRENCE_INDEX = {
      'الله': ['2:255', '2:256'],
    };
    global.window.OCCURRENCE_INDEX_NORM = function (a) { return NORM(a); };
    global.window.__QURAN_TEXT = {
      2: { verses: [
        { id: 255, text: 'اللَّهُ لَا إِلَٰهَ', translation: 'Allah — none' },
        { id: 256, text: 'اللَّهُ وَلِيُّ', translation: 'Allah is ally' },
      ] },
    };
    delete global.window.__quranLoader;
    var listEl = mock.makeEl('div');
    renderExplorerAllOccurrences(listEl, {
      arabic: 'اللَّهُ',
      occurrences: [
        { surahId: 2, verseKey: '2:255', ayahA: 'اللَّهُ لَا إِلَٰهَ', ayahT: 'Allah — none', ayahR: '2:255', tafsir: 'x' },
      ],
    });
    var itemCount = (listEl.innerHTML.match(/explorer-occ-item/g) || []).length;
    assert.strictEqual(itemCount, 2, 'rich 2:255 + index 2:256 = 2 items (deduped), got ' + itemCount);
  });

  t('backward compat: words with only rich occurrences render exactly as before', function () {
    delete global.window.OCCURRENCE_INDEX;
    delete global.window.OCCURRENCE_INDEX_NORM;
    delete global.window.__QURAN_TEXT;
    delete global.window.__quranLoader;
    var listEl = mock.makeEl('div');
    renderExplorerAllOccurrences(listEl, {
      arabic: 'اللَّهُ',
      occurrences: [
        { surahId: 1, verseKey: '1:1', ayahA: 'بِسْمِ اللَّهِ', ayahT: 'In the name of Allah', ayahR: '1:1', tafsir: 't' },
      ],
    });
    var itemCount = (listEl.innerHTML.match(/explorer-occ-item/g) || []).length;
    assert.strictEqual(itemCount, 1, 'one rich occurrence renders, got ' + itemCount);
    assert.ok(listEl.innerHTML.indexOf('In the name of Allah') >= 0);
    assert.ok(listEl.innerHTML.indexOf('Al-Fatihah') >= 0);
  });

  t('empty state when a word has no occurrences and no index entry', function () {
    delete global.window.OCCURRENCE_INDEX;
    delete global.window.OCCURRENCE_INDEX_NORM;
    delete global.window.__QURAN_TEXT;
    delete global.window.__quranLoader;
    var listEl = mock.makeEl('div');
    renderExplorerAllOccurrences(listEl, { arabic: 'اللَّهُ', occurrences: [] });
    assert.ok(listEl.innerHTML.indexOf('No occurrence data available') >= 0);
  });

  tAsync('lazily loads unloaded surahs and re-renders on arrival', function () {
    var loadedSurahs = {};
    global.window.OCCURRENCE_INDEX = { 'الله': ['95:6', '96:1'] };
    global.window.OCCURRENCE_INDEX_NORM = function (a) { return NORM(a); };
    delete global.window.__QURAN_TEXT;
    global.window.__quranLoader = {
      isSurahLoaded: function (sid) { return !!loadedSurahs[sid]; },
      getVerse: function (sid, vid) {
        if (!loadedSurahs[sid]) return null;
        return { text: 'آيَة ' + sid + ':' + vid, translation: 'verse ' + vid };
      },
      loadSurah: function (sid) {
        loadedSurahs[sid] = true;
        return Promise.resolve(true);
      },
    };
    var listEl = mock.makeEl('div');
    renderExplorerAllOccurrences(listEl, { arabic: 'اللَّهُ', occurrences: [] });
    // Immediately: both refs present as pending items (Loading…)
    assert.ok(listEl.innerHTML.indexOf('95:6') >= 0, 'ref 95:6 listed immediately');
    assert.ok(listEl.innerHTML.indexOf('96:1') >= 0, 'ref 96:1 listed immediately');
    assert.ok(loadedSurahs[95] === true && loadedSurahs[96] === true, 'both surahs requested');
    // Wait a macrotask so Promise.all's re-render (a few microtask hops) has
    // definitely run before asserting the hydrated output.
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          assert.ok(listEl.innerHTML.indexOf('آيَة 95:6') >= 0, 'surah 95 verse text hydrated');
          assert.ok(listEl.innerHTML.indexOf('آيَة 96:1') >= 0, 'surah 96 verse text hydrated');
          assert.ok(listEl.innerHTML.indexOf('Loading') < 0, 'loading placeholders gone');
          resolve();
        } catch (e) { reject(e); }
      }, 20);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS — CORPUS SPOT CHECK (random sample of refs exist)
// ═══════════════════════════════════════════════════════════════

ts('Occurrence Index — corpus spot check', function () {
  t('random sample of refs points at real verses in the corpus', function () {
    var corpus = null;
    try {
      var corpusPath = path.join(__dirname, '..', 'js', 'quran', 'quran-data.js');
      if (!fs.existsSync(corpusPath)) throw new Error('corpus missing');
      var cs = { window: {}, console: console };
      cs.window = cs;
      vm.createContext(cs);
      vm.runInContext(fs.readFileSync(corpusPath, 'utf8'), cs);
      corpus = cs.QURAN_TEXT;
    } catch (e) {
      // Corpus not loadable — skip (the generator validates this at build time)
      console.log('     (corpus unavailable — skipping ref-existence check)');
      return;
    }
    // Deterministic sample: every Nth key's FIRST ref, verify surah/verse exist
    var keys = Object.keys(OCCURRENCE_INDEX);
    var step = Math.max(1, Math.floor(keys.length / 40));
    var checked = 0;
    for (var ki = 0; ki < keys.length; ki += step) {
      var refs = OCCURRENCE_INDEX[keys[ki]];
      var ref = refs[0];
      var m = /^(\d+):(\d+)$/.exec(ref);
      var sid = parseInt(m[1], 10);
      var vid = parseInt(m[2], 10);
      assert.ok(corpus[sid], 'surah ' + sid + ' exists for ref ' + ref);
      assert.ok(corpus[sid].verses && corpus[sid].verses[vid - 1], 'verse ' + ref + ' exists');
      checked++;
    }
    assert.ok(checked >= 20, 'checked ' + checked + ' sample refs');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

Promise.all(asyncPromises).then(function () {
  var total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log('  occurrence-index.test.js');
  console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
});
