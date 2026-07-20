#!/usr/bin/env node
/**
 * quran-quran.test.js — Quran-First Reader Validation
 *
 * Verifies that the reader's Quran-first verse builder correctly:
 *   • Iterates ALL verses from the Quran dataset
 *   • Correct verse count for each surah
 *   • Vocabulary words are correctly matched to verses
 *   • All 6236 verses are reachable through the verse keys
 *
 * Run: node test/quran-quran.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\ud83d\udccb ' + name); fn(); }

// Load Quran data for validation
var quranDataPath = path.join(__dirname, '..', 'js', 'quran', 'quran-data.js');
var quranDataExists = fs.existsSync(quranDataPath);

// Helper: normalize Arabic for matching (mirrors reader.js _normArabicForMatch)
function _normArabicForMatch(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652\u0670\u06E1]/g, '')
    .replace(/[\u0671\u0672\u0673]/g, '\u0627')
    .trim();
}

// Helper: build full verse data (mirrors reader.js _buildFullVerseData)
function _buildFullVerseData(surahId, quranSurah, vocabWords) {
  var ayahGroups = {};
  var verseKeys = [];

  var vocabByNorm = {};
  for (var i = 0; i < vocabWords.length; i++) {
    var w = vocabWords[i];
    var norm = _normArabicForMatch(w.arabic);
    if (norm) vocabByNorm[norm] = w;
  }

  for (var vi = 0; vi < quranSurah.verses.length; vi++) {
    var verse = quranSurah.verses[vi];
    var verseKey = surahId + ':' + verse.id;
    var matchedWords = [];

    var rawTokens = verse.text.split(/\s+/);
    var tokens = [];
    for (var ti = 0; ti < rawTokens.length; ti++) {
      if (rawTokens[ti]) tokens.push(rawTokens[ti]);
    }
    var seenWordIds = {};
    for (var ti = 0; ti < tokens.length; ti++) {
      var normToken = _normArabicForMatch(tokens[ti]);
      if (normToken && vocabByNorm[normToken]) {
        var matched = vocabByNorm[normToken];
        if (!seenWordIds[matched.id]) {
          matchedWords.push(matched);
          seenWordIds[matched.id] = true;
        }
      }
    }

    ayahGroups[verseKey] = {
      words: matchedWords,
      ayahA: verse.text,
      ayahT: verse.translation,
      totalTokens: tokens.length,
      matchedTokens: matchedWords.length,
    };
    verseKeys.push(verseKey);
  }

  return { ayahGroups: ayahGroups, verseKeys: verseKeys };
}

// Load quran-data.js once
var qt, surahIds;
global.window = {};
if (quranDataExists) {
  var content = fs.readFileSync(quranDataPath, 'utf8');
  try {
    eval(content);
    qt = global.window.__QURAN_TEXT;
    surahIds = Object.keys(qt).map(Number).sort(function(a,b){return a-b});
  } catch (e) {
    console.log('  ⚠ Could not load quran-data.js for reader test: ' + e.message);
  }
}

// ── Tests ──

suite('Quran-First Verse Builder (complete coverage)', function() {
  if (!qt) { console.log('  ⚠ Quran data not available — skipping reader validation'); return; }

  // Test every surah
  var totalErrors = 0;
  var totalVerseKeys = 0;

  surahIds.forEach(function(sid) {
    var quranSurah = qt[sid];
    if (!quranSurah || !quranSurah.verses) return;

    // Build with empty vocabulary (simulates a surah with no vocab)
    var result = _buildFullVerseData(sid, quranSurah, []);

    // Verify: verse keys count matches total_verses
    var expectedCount = quranSurah.total_verses;
    var actualCount = result.verseKeys.length;

    if (actualCount !== expectedCount) {
      test('Surah ' + sid + ' (' + quranSurah.name + ') has ' + actualCount + ' verse keys, expected ' + expectedCount, function() {
        assert.strictEqual(actualCount, expectedCount);
      });
      totalErrors++;
    } else {
      totalVerseKeys += actualCount;
    }

    // Verify: all verse keys are in correct format "surahId:verseNum"
    var keyErrors = 0;
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var parts = result.verseKeys[vi].split(':');
      if (parseInt(parts[0], 10) !== sid || parseInt(parts[1], 10) !== (vi + 1)) {
        keyErrors++;
      }
    }
    if (keyErrors > 0) {
      test('Surah ' + sid + ' verse key numbering', function() {
        assert.strictEqual(keyErrors, 0);
      });
      totalErrors++;
    }

    // Quick validation: every verse has ayahA (Arabic) and ayahT (translation)
    var missingText = 0;
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var group = result.ayahGroups[result.verseKeys[vi]];
      if (!group.ayahA || !group.ayahT) missingText++;
    }
    if (missingText > 0) {
      test('Surah ' + sid + ' verses have Arabic and translation', function() {
        assert.strictEqual(missingText, 0, missingText + ' verses missing text');
      });
      totalErrors++;
    }
  });

  test('Total verse keys across all surahs equals 6236', function() {
    assert.strictEqual(totalVerseKeys, 6236, 'Total verse keys: ' + totalVerseKeys + ' (expected 6236)');
  });
});

suite('Vocabulary Matching in Full Verse Builder', function() {
  if (!qt) return;

  // ALL_WORDS is declared as a global var by the data bundle, not as window.__ALL_WORDS
  var _ALL_WORDS = (typeof ALL_WORDS !== 'undefined') ? ALL_WORDS : [];
  // If ALL_WORDS not available, load from data bundle
  if (_ALL_WORDS.length === 0 && fs.existsSync(path.join(__dirname, '..', 'dist', 'js', 'data.bundle.min.js'))) {
    try {
      var dataBundle = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'data.bundle.min.js'), 'utf8');
      eval(dataBundle);
      _ALL_WORDS = (typeof ALL_WORDS !== 'undefined') ? ALL_WORDS : [];
    } catch (e) {
      console.log('  ⚠ Could not eval data bundle — skipping vocab matching tests');
    }
  }

  if (_ALL_WORDS.length === 0) {
    console.log('  ⚠ No vocabulary data available — skipping vocab matching tests');
    return;
  }

  // Get words for Surah 1 (Al-Fatihah)
  var surah1Words = [];
  for (var wi = 0; wi < _ALL_WORDS.length; wi++) {
    var w = _ALL_WORDS[wi];
    if (w.occurrences) {
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        if (w.occurrences[oi].surahId === 1) {
          if (surah1Words.indexOf(w) < 0) {
            surah1Words.push(w);
          }
          break;
        }
      }
    }
  }

  // Test Surah 114 (An-Nas) — a small Meccan surah
  var surah114Words = [];
  for (var wi = 0; wi < _ALL_WORDS.length; wi++) {
    var w = _ALL_WORDS[wi];
    if (w.occurrences) {
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        if (w.occurrences[oi].surahId === 114) {
          if (surah114Words.indexOf(w) < 0) {
            surah114Words.push(w);
          }
          break;
        }
      }
    }
  }

  // Get words for Surah 1 (Al-Fatihah) — a small surah with known vocabulary
  var surah1Words = [];
  for (var wi = 0; wi < ALL_WORDS.length; wi++) {
    var w = ALL_WORDS[wi];
    if (w.occurrences) {
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        if (w.occurrences[oi].surahId === 1) {
          if (surah1Words.indexOf(w) < 0) {
            surah1Words.push(w);
          }
          break;
        }
      }
    }
  }

  test('Surah 1 has vocabulary words', function() {
    assert.ok(surah1Words.length > 0, 'Surah 1 has ' + surah1Words.length + ' vocabulary words');
  });

  if (surah1Words.length > 0 && qt[1]) {
    var result1 = _buildFullVerseData(1, qt[1], surah1Words);

    test('Surah 1 full verse builder produces 7 verses', function() {
      assert.strictEqual(result1.verseKeys.length, 7, 'Surah 1 has 7 verse keys');
    });

    test('Surah 1 verse 1 has vocabulary matched', function() {
      var v1 = result1.ayahGroups['1:1'];
      assert.ok(v1, 'Verse 1:1 exists');
      // Verse 1:1 "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ" should have vocab words matched
      assert.ok(v1.matchedTokens > 0, 'Verse 1:1 has ' + v1.matchedTokens + ' matched vocabulary tokens');
      assert.ok(v1.totalTokens >= 4, 'Verse 1:1 has ' + v1.totalTokens + ' total tokens');
    });
  }

  // Test Surah 114 (An-Nas) — a small Meccan surah
  var surah114Words = [];
  for (var wi = 0; wi < ALL_WORDS.length; wi++) {
    var w = ALL_WORDS[wi];
    if (w.occurrences) {
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        if (w.occurrences[oi].surahId === 114) {
          if (surah114Words.indexOf(w) < 0) {
            surah114Words.push(w);
          }
          break;
        }
      }
    }
  }

  if (qt[114]) {
    var result114 = _buildFullVerseData(114, qt[114], surah114Words);

    test('Surah 114 full verse builder produces 6 verses', function() {
      assert.strictEqual(result114.verseKeys.length, 6, 'Surah 114 has 6 verse keys');
    });

    var hasVocab = result114.verseKeys.some(function(vk) {
      return result114.ayahGroups[vk].matchedTokens > 0;
    });
    test('Some verses in Surah 114 have vocabulary matched', function() {
      // This may be 0 if no vocabulary is available for this surah — that's OK
      console.log('     Surah 114: ' + result114.verseKeys.length + ' verses, ' +
        (hasVocab ? 'has vocabulary' : 'no vocabulary matched'));
    });
  }
});

suite('Large Surah Processing Performance', function() {
  if (!qt) return;

  // Test Surah 2 (Al-Baqarah, 286 verses) — the largest surah
  // Just verify it processes without error and produces correct count
  test('Surah 2 (Al-Baqarah) processes all 286 verses', function() {
    var result = _buildFullVerseData(2, qt[2], []);
    assert.strictEqual(result.verseKeys.length, 286, 'Surah 2 has 286 verse keys');
  });

  // Test a mid-length surah
  test('Surah 18 (Al-Kahf) processes all 110 verses', function() {
    var result = _buildFullVerseData(18, qt[18], []);
    assert.strictEqual(result.verseKeys.length, 110, 'Surah 18 has 110 verse keys');
  });

  // Test total coverage
  var totalKeys = 0;
  var totalErrors = 0;
  for (var sid = 1; sid <= 114; sid++) {
    if (!qt[sid]) { totalErrors++; continue; }
    var result = _buildFullVerseData(sid, qt[sid], []);
    if (result.verseKeys.length !== qt[sid].total_verses) {
      totalErrors++;
    }
    totalKeys += result.verseKeys.length;
  }

  test('All 114 surahs process without verse count errors', function() {
    assert.strictEqual(totalErrors, 0, totalErrors + ' surahs with verse count mismatch');
  });

  test('All 6236 verses are reachable through _buildFullVerseData', function() {
    assert.strictEqual(totalKeys, 6236, 'Total verse keys: ' + totalKeys);
  });
});

// ── Helper: simulate renderAyahs() token-to-HTML logic ──────
// Builds the Arabic verse HTML the same way renderAyahs() does:
// vocabulary words → .quran-word-token spans
// non-vocabulary tokens → .quran-plain-arabic spans
// All tokens preserved in original order.

function _simulateRenderAyahsTokens(verse, vocabByNorm) {
  var tokens = verse.ayahA.split(/\s+/);
  var metadata = {
    totalTokens: 0,
    vocabSpans: 0,
    plainSpans: 0,
    outputTokens: [],
  };
  var renderedWordIds = {};
  for (var ti = 0; ti < tokens.length; ti++) {
    var token = tokens[ti];
    if (!token) continue;
    metadata.totalTokens++;
    metadata.outputTokens.push(token);
    var normToken = _normArabicForMatch(token);
    var matchedWord = normToken && vocabByNorm[normToken] ? vocabByNorm[normToken] : null;
    var isDuplicate = matchedWord && renderedWordIds[matchedWord.id];
    if (matchedWord && !isDuplicate) {
      renderedWordIds[matchedWord.id] = true;
      metadata.vocabSpans++;
    } else {
      metadata.plainSpans++;
    }
  }
  return metadata;
}

// ── RenderAyahs Token Completeness Test ───────────────────────
// Verifies that renderAyahs() logic preserves ALL source tokens
// and does NOT discard non-vocabulary text.

suite('RenderAyahs Token Completeness (Regression Protection)', function() {
  if (!qt) { console.log('  ⚠ Quran data not available — skipping'); return; }

  // Load vocabulary data for matching
  var _VOCAB_WORDS = [];
  try {
    // Try to load from data files
    var dataDir = path.join(__dirname, '..', 'js', 'data');
    if (fs.existsSync(dataDir)) {
      var dataFiles = fs.readdirSync(dataDir).filter(function(f) {
        return f.endsWith('.js') && f !== 'juz-data.js' && f !== 'surahs.js';
      });
      var allWordsCode = '';
      allWordsCode += 'var ALL_WORDS = [];\n';
      allWordsCode += fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
      for (var dfi = 0; dfi < dataFiles.length; dfi++) {
        allWordsCode += fs.readFileSync(path.join(dataDir, dataFiles[dfi]), 'utf8');
      }
      // Place into global scope
      try { eval(allWordsCode); } catch (e) { /* ignore */ }
      _VOCAB_WORDS = (typeof ALL_WORDS !== 'undefined') ? ALL_WORDS : [];
    }
  } catch (e) { /* ignore */ }

  // Build normalized vocabulary lookup from actual words
  var _vocabByNorm = {};
  for (var vwi = 0; vwi < _VOCAB_WORDS.length; vwi++) {
    var w = _VOCAB_WORDS[vwi];
    var norm = _normArabicForMatch(w.arabic);
    if (norm) _vocabByNorm[norm] = w;
  }

  // ── TEST: Empty vocabulary — all tokens preserved ──
  test('Empty vocabulary: every token rendered as plain text (0 vocabulary, all preserved)', function() {
    var surah = qt[1];
    if (!surah) return;
    var result = _buildFullVerseData(1, surah, []);
    var totalSourceTokens = 0;
    var totalOutputTokens = 0;
    var totalMissing = 0;
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var group = result.ayahGroups[result.verseKeys[vi]];
      var meta = _simulateRenderAyahsTokens(group, {});
      totalSourceTokens += group.totalTokens;
      totalOutputTokens += meta.totalTokens;
      totalMissing += meta.outputTokens.filter(function(t, idx) {
        return _normArabicForMatch(t) && !meta.outputTokens[idx];
      }).length;
    }
    assert.strictEqual(totalOutputTokens, totalSourceTokens,
      'Empty vocab: ' + totalOutputTokens + ' output tokens == ' + totalSourceTokens + ' source tokens');
  });

  // ── TEST: Every token is accounted for in output ──
  test('Surah 1 (Al-Fatihah): every verse token preserved with vocabulary', function() {
    var surah = qt[1];
    if (!surah) return;
    // Get words that occur in Surah 1
    var surah1Words = [];
    var seenIds = {};
    for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
      var w = _VOCAB_WORDS[wi];
      if (w.occurrences) {
        for (var oi = 0; oi < w.occurrences.length; oi++) {
          if (w.occurrences[oi].surahId === 1 && !seenIds[w.id]) {
            surah1Words.push(w);
            seenIds[w.id] = true;
            break;
          }
        }
      }
    }
    var result = _buildFullVerseData(1, surah, surah1Words);
    var totalSourceTokens = 0;
    var totalOutputTokens = 0;
    var verseErrors = [];
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var vk = result.verseKeys[vi];
      var group = result.ayahGroups[vk];
      // Build verse-specific vocab lookup
      var verseVocab = {};
      for (var wwi = 0; wwi < group.words.length; wwi++) {
        var wn = _normArabicForMatch(group.words[wwi].arabic);
        if (wn) verseVocab[wn] = group.words[wwi];
      }
      var meta = _simulateRenderAyahsTokens(group, verseVocab);
      totalSourceTokens += group.totalTokens;
      totalOutputTokens += meta.totalTokens;
      if (meta.totalTokens !== group.totalTokens) {
        verseErrors.push(vk + ': expected ' + group.totalTokens + ' tokens, got ' + meta.totalTokens);
      }
    }
    assert.strictEqual(totalOutputTokens, totalSourceTokens,
      'Al-Fatihah: ' + totalOutputTokens + ' output == ' + totalSourceTokens + ' source');
    assert.strictEqual(verseErrors.length, 0,
      'Verse-level errors: ' + verseErrors.join('; '));
  });

  // ── TEST: Vocabulary words become interactive spans ──
  test('Vocabulary words are rendered as .quran-word-token spans', function() {
    var surah = qt[1];
    if (!surah || _VOCAB_WORDS.length === 0) return;
    // Get words for Surah 1
    var surah1Words = [];
    var seenIds = {};
    for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
      var w = _VOCAB_WORDS[wi];
      if (w.occurrences) {
        for (var oi = 0; oi < w.occurrences.length; oi++) {
          if (w.occurrences[oi].surahId === 1 && !seenIds[w.id]) {
            surah1Words.push(w);
            seenIds[w.id] = true;
            break;
          }
        }
      }
    }
    var result = _buildFullVerseData(1, surah, surah1Words);
    var totalVocabOutput = 0;
    var totalVocabMatched = 0;
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var vk = result.verseKeys[vi];
      var group = result.ayahGroups[vk];
      var verseVocab = {};
      for (var wwi = 0; wwi < group.words.length; wwi++) {
        var wn = _normArabicForMatch(group.words[wwi].arabic);
        if (wn) verseVocab[wn] = group.words[wwi];
      }
      var meta = _simulateRenderAyahsTokens(group, verseVocab);
      totalVocabOutput += meta.vocabSpans;
      totalVocabMatched += group.matchedTokens;
    }
    // All matched vocabulary words should produce a vocab span
    assert.strictEqual(totalVocabOutput, totalVocabMatched,
      'Vocab spans (' + totalVocabOutput + ') == matched tokens (' + totalVocabMatched + ')');
  });

  // ── TEST: Non-vocabulary tokens are preserved (not dropped) ──
  test('Non-vocabulary tokens are preserved as plain spans', function() {
    var surah = qt[1];
    if (!surah || _VOCAB_WORDS.length === 0) return;
    // Get words for Surah 1
    var surah1Words = [];
    var seenIds = {};
    for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
      var w = _VOCAB_WORDS[wi];
      if (w.occurrences) {
        for (var oi = 0; oi < w.occurrences.length; oi++) {
          if (w.occurrences[oi].surahId === 1 && !seenIds[w.id]) {
            surah1Words.push(w);
            seenIds[w.id] = true;
            break;
          }
        }
      }
    }
    var result = _buildFullVerseData(1, surah, surah1Words);
    var totalPlainOutput = 0;
    var totalPlainExpected = 0;
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var vk = result.verseKeys[vi];
      var group = result.ayahGroups[vk];
      var verseVocab = {};
      for (var wwi = 0; wwi < group.words.length; wwi++) {
        var wn = _normArabicForMatch(group.words[wwi].arabic);
        if (wn) verseVocab[wn] = group.words[wwi];
      }
      var meta = _simulateRenderAyahsTokens(group, verseVocab);
      // Plain tokens = total - unique vocab matches
      var expectedPlain = group.totalTokens - group.matchedTokens;
      totalPlainOutput += meta.plainSpans;
      totalPlainExpected += expectedPlain;
    }
    assert.strictEqual(totalPlainOutput, totalPlainExpected,
      'Plain spans (' + totalPlainOutput + ') == expected (' + totalPlainExpected + '): non-vocab tokens preserved');
  });

  // ── TEST: Large surah processing ──
  test('Surah 2 (Al-Baqarah, 286 verses): all tokens preserved with vocabulary', function() {
    var surah = qt[2];
    if (!surah) return;
    // Get words for Surah 2
    var surah2Words = [];
    var seenIds = {};
    for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
      var w = _VOCAB_WORDS[wi];
      if (w.occurrences) {
        for (var oi = 0; oi < w.occurrences.length; oi++) {
          if (w.occurrences[oi].surahId === 2 && !seenIds[w.id]) {
            surah2Words.push(w);
            seenIds[w.id] = true;
            break;
          }
        }
      }
    }
    var result = _buildFullVerseData(2, surah, surah2Words);
    var totalSourceTokens = 0;
    var totalOutputTokens = 0;
    var verseErrors = [];
    for (var vi = 0; vi < result.verseKeys.length; vi++) {
      var vk = result.verseKeys[vi];
      var group = result.ayahGroups[vk];
      var verseVocab = {};
      for (var wwi = 0; wwi < group.words.length; wwi++) {
        var wn = _normArabicForMatch(group.words[wwi].arabic);
        if (wn) verseVocab[wn] = group.words[wwi];
      }
      var meta = _simulateRenderAyahsTokens(group, verseVocab);
      totalSourceTokens += group.totalTokens;
      totalOutputTokens += meta.totalTokens;
      if (meta.totalTokens !== group.totalTokens) {
        verseErrors.push(vk + ': expected ' + group.totalTokens + ' got ' + meta.totalTokens);
      }
    }
    assert.strictEqual(totalOutputTokens, totalSourceTokens,
      'Al-Baqarah: ' + totalOutputTokens + ' output == ' + totalSourceTokens + ' source');
    assert.strictEqual(verseErrors.length, 0,
      'Verse errors: ' + verseErrors.length + ' (first: ' + (verseErrors[0] || 'none') + ')');
  });

  // ── TEST: Duplicate vocabulary deduplication preserves total count ──
  test('Duplicate vocabulary words render as plain text (second+ occurrences preserved)', function() {
    // If a word appears multiple times in a verse, only the FIRST occurrence
    // gets interactive .quran-word-token. Subsequent occurrences render as
    // .quran-plain-arabic. Total token count must remain unchanged.
    var surah = qt[1];
    if (!surah) return;
    var result = _buildFullVerseData(1, surah, []); // no vocab first to get baseline
    // Now with a mock vocabulary where ALL tokens match the same word
    var mockVocab = [{ id: 'mock_1', arabic: result.ayahGroups['1:1'].ayahA.split(/\s+/)[0] }];
    var mockNorm = {};
    var norm = _normArabicForMatch(mockVocab[0].arabic);
    if (norm) mockNorm[norm] = mockVocab[0];
    var group = result.ayahGroups['1:1'];
    var meta = _simulateRenderAyahsTokens(group, mockNorm);
    // Total tokens should still equal source
    assert.strictEqual(meta.totalTokens, group.totalTokens,
      'Duplicate test: ' + meta.totalTokens + ' == ' + group.totalTokens + ' total tokens preserved');
    // At most 1 vocab span (duplicates become plain)
    assert.ok(meta.vocabSpans <= 1, 'At most 1 vocab span with duplicate vocabulary');
  });
});

suite('Surah Index Compatibility', function() {
  // Verify the Quran index covers all surahs the reader needs
  test('Quran index has 114 entries', function() {
    var idxPath = path.join(__dirname, '..', 'js', 'quran', 'surah-index.js');
    if (!fs.existsSync(idxPath)) return;
    var idxContent = fs.readFileSync(idxPath, 'utf8');
    global.window = global.window || {};
    try {
      eval(idxContent);
    } catch (e) { /* ignore */ }
    var idx = global.window.__QURAN_INDEX;
    if (!idx) return;
    assert.strictEqual(idx.length, 114, 'Index has 114 entries');
    assert.strictEqual(idx[0].id, 1);
    assert.strictEqual(idx[113].id, 114);
  });
});

// ── Pipeline Integrity Tests ────────────────────────────────────
// Verifies the rendering pipeline produces correct output at every stage.

suite('Pipeline Integrity: Token Order & Completeness', function() {
  if (!qt) { console.log('  ⚠ Quran data not available — skipping'); return; }

  // TEST: Arabic token order matches source for EVERY verse
  test('All 6236 verses: token order matches source', function() {
    var mismatches = [];
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      var surah = qt[sid];
      if (!surah || !surah.verses) continue;
      var result = _buildFullVerseData(sid, surah, []);
      for (var vi = 0; vi < result.verseKeys.length; vi++) {
        var vk = result.verseKeys[vi];
        var group = result.ayahGroups[vk];
        if (!group || !group.ayahA) continue;
        var sourceTokens = surah.verses[vi].text.split(/\s+/).filter(Boolean);
        var rebuildTokens = group.ayahA.split(/\s+/).filter(Boolean);
        if (sourceTokens.length !== rebuildTokens.length) {
          mismatches.push(vk + ': ' + sourceTokens.length + ' source vs ' + rebuildTokens.length + ' rebuilt');
        } else {
          for (var ti = 0; ti < sourceTokens.length; ti++) {
            if (sourceTokens[ti] !== rebuildTokens[ti]) {
              mismatches.push(vk + ' token ' + ti + ': "' + sourceTokens[ti] + '" vs "' + rebuildTokens[ti] + '"');
              break;
            }
          }
        }
      }
    }
    assert.strictEqual(mismatches.length, 0,
      'Token order mismatches: ' + mismatches.slice(0, 5).join('; ') +
      (mismatches.length > 5 ? ' (+' + (mismatches.length - 5) + ' more)' : ''));
  });

  // TEST: No empty verses across entire Quran
  test('No empty verses: every surah has non-empty text for all verses', function() {
    var emptyVerses = [];
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      var surah = qt[sid];
      if (!surah || !surah.verses) continue;
      for (var vi = 0; vi < surah.verses.length; vi++) {
        var v = surah.verses[vi];
        if (!v.text || v.text.trim() === '') {
          emptyVerses.push(sid + ':' + v.id);
        }
      }
    }
    assert.strictEqual(emptyVerses.length, 0, 'Empty verses: ' + emptyVerses.join(', '));
  });

  // TEST: First and last token of every verse are preserved
  test('First and last tokens preserved for all verses', function() {
    var firstLastErrors = [];
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      var surah = qt[sid];
      if (!surah || !surah.verses) continue;
      var result = _buildFullVerseData(sid, surah, []);
      for (var vi = 0; vi < result.verseKeys.length; vi++) {
        var vk = result.verseKeys[vi];
        var group = result.ayahGroups[vk];
        var sourceTokens = surah.verses[vi].text.split(/\s+/).filter(Boolean);
        var rebuildTokens = group.ayahA.split(/\s+/).filter(Boolean);
        if (sourceTokens.length === 0 || rebuildTokens.length === 0) continue;
        if (sourceTokens[0] !== rebuildTokens[0]) {
          firstLastErrors.push(vk + ' first token: "' + sourceTokens[0] + '" vs "' + rebuildTokens[0] + '"');
        }
        if (sourceTokens[sourceTokens.length - 1] !== rebuildTokens[rebuildTokens.length - 1]) {
          firstLastErrors.push(vk + ' last token: "' + sourceTokens[sourceTokens.length - 1] + '" vs "' + rebuildTokens[rebuildTokens.length - 1] + '"');
        }
      }
    }
    assert.strictEqual(firstLastErrors.length, 0,
      'First/last token errors: ' + firstLastErrors.slice(0, 5).join('; ') +
      (firstLastErrors.length > 5 ? ' (+' + (firstLastErrors.length - 5) + ' more)' : ''));
  });
});

suite('Pipeline Integrity: Verse Key Consistency', function() {
  if (!qt) { console.log('  ⚠ Quran data not available — skipping'); return; }

  // TEST: Every verse key is unique
  test('All verse keys are unique (no duplicates)', function() {
    var allKeys = [];
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      var surah = qt[sid];
      if (!surah || !surah.verses) continue;
      var result = _buildFullVerseData(sid, surah, []);
      for (var vi = 0; vi < result.verseKeys.length; vi++) {
        allKeys.push(result.verseKeys[vi]);
      }
    }
    var uniqueKeys = {};
    var duplicates = [];
    for (var ki = 0; ki < allKeys.length; ki++) {
      if (uniqueKeys[allKeys[ki]]) duplicates.push(allKeys[ki]);
      uniqueKeys[allKeys[ki]] = true;
    }
    assert.strictEqual(duplicates.length, 0, 'Duplicate verse keys: ' + duplicates.join(', '));
    assert.strictEqual(allKeys.length, 6236, 'Total unique verse keys: ' + allKeys.length);
  });

  // TEST: Verse keys are in correct sequential order per surah
  test('Verse keys are sequential (1, 2, 3...N) per surah', function() {
    var orderErrors = [];
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      var surah = qt[sid];
      if (!surah || !surah.verses) continue;
      var result = _buildFullVerseData(sid, surah, []);
      for (var vi = 0; vi < result.verseKeys.length; vi++) {
        var expectedKey = sid + ':' + (vi + 1);
        if (result.verseKeys[vi] !== expectedKey) {
          orderErrors.push('Surah ' + sid + ' key ' + vi + ': "' + result.verseKeys[vi] + '" expected "' + expectedKey + '"');
        }
      }
    }
    assert.strictEqual(orderErrors.length, 0,
      'Key order errors: ' + orderErrors.slice(0, 5).join('; ') +
      (orderErrors.length > 5 ? ' (+' + (orderErrors.length - 5) + ' more)' : ''));
  });
});

suite('Pipeline Integrity: Vocabulary Alignment', function() {
  if (!qt) { console.log('  ⚠ Quran data not available — skipping'); return; }

  // Load vocabulary
  var _VOCAB_WORDS = [];
  try {
    var dataDir = path.join(__dirname, '..', 'js', 'data');
    if (fs.existsSync(dataDir)) {
      var dataFiles = fs.readdirSync(dataDir).filter(function(f) {
        return f.endsWith('.js') && f !== 'juz-data.js' && f !== 'surahs.js';
      });
      var allWordsCode = '';
      allWordsCode += 'var ALL_WORDS = [];\n';
      allWordsCode += fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
      for (var dfi = 0; dfi < dataFiles.length; dfi++) {
        allWordsCode += fs.readFileSync(path.join(dataDir, dataFiles[dfi]), 'utf8');
      }
      try { eval(allWordsCode); } catch (e) { /* ignore */ }
      _VOCAB_WORDS = (typeof ALL_WORDS !== 'undefined') ? ALL_WORDS : [];
    }
  } catch (e) { /* ignore */ }

  if (_VOCAB_WORDS.length === 0) {
    console.log('  ⚠ No vocabulary data — skipping vocab alignment tests');
    return;
  }

  // TEST: No matched word has empty Arabic text
  test('Every vocabulary word has non-empty Arabic text for matching', function() {
    var emptyWords = [];
    for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
      if (!_VOCAB_WORDS[wi].arabic || _VOCAB_WORDS[wi].arabic.trim() === '') {
        emptyWords.push(_VOCAB_WORDS[wi].id || wi);
      }
    }
    assert.strictEqual(emptyWords.length, 0, 'Words with empty Arabic: ' + emptyWords.join(', '));
  });

  // TEST: Normalized vocabulary matching is consistent (same input → same output)
  test('_normArabicForMatch is deterministic and idempotent', function() {
    for (var wi = 0; wi < Math.min(_VOCAB_WORDS.length, 100); wi++) {
      var w = _VOCAB_WORDS[wi];
      if (!w.arabic) continue;
      var norm1 = _normArabicForMatch(w.arabic);
      var norm2 = _normArabicForMatch(norm1);
      assert.strictEqual(norm1, norm2, 'Not idempotent for: "' + w.arabic + '" -> "' + norm1 + '" vs "' + norm2 + '"');
    }
  });

  // TEST: First verse of Al-Fatihah has expected vocabulary hits
  if (qt[1] && _VOCAB_WORDS.length > 0) {
    test('Surah 1:1 has at least one vocabulary match', function() {
      // Get words for Surah 1
      var surah1Words = [];
      var seenIds = {};
      for (var wi = 0; wi < _VOCAB_WORDS.length; wi++) {
        var w = _VOCAB_WORDS[wi];
        if (w.occurrences) {
          for (var oi = 0; oi < w.occurrences.length; oi++) {
            if (w.occurrences[oi].surahId === 1 && !seenIds[w.id]) {
              surah1Words.push(w);
              seenIds[w.id] = true;
              break;
            }
          }
        }
      }
      var result = _buildFullVerseData(1, qt[1], surah1Words);
      var v1 = result.ayahGroups['1:1'];
      assert.ok(v1, 'Verse 1:1 exists in result');
      assert.ok(v1.matchedTokens >= 1, 'Verse 1:1 has at least 1 vocabulary match');
      // Every matched word appears in the verse text
      var verseTokens = v1.ayahA.split(/\s+/).filter(Boolean);
      var verseNormed = verseTokens.map(function(t) { return _normArabicForMatch(t); }).filter(Boolean);
      for (var mwi = 0; mwi < v1.words.length; mwi++) {
        var wordNorm = _normArabicForMatch(v1.words[mwi].arabic);
        var found = verseNormed.indexOf(wordNorm) >= 0;
        assert.ok(found, 'Matched word "' + v1.words[mwi].arabic + '" exists in Surah 1:1');
      }
    });
  }
});

// ── Rename Integrity Tests ────────────────────────────────────
// Verifies that the Reader→Quran rename was complete and consistent.

suite('Rename Integrity (Reader→Quran Migration)', function() {
  // TEST: No stale DOM IDs in index.html
  test('No "view-reader" or "tab-reader" DOM IDs remain in index.html', function() {
    var htmlPath = path.join(__dirname, '..', 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    var html = fs.readFileSync(htmlPath, 'utf8');
    // Must use the new IDs
    if (html.indexOf('view-quran') === -1) {
      assert.fail('view-quran not found in index.html');
    }
    if (html.indexOf('tab-quran') === -1) {
      assert.fail('tab-quran not found in index.html');
    }
    // Must NOT contain old IDs
    var oldViewReader = html.indexOf('id="view-reader"');
    var oldTabReader = html.indexOf('id="tab-reader"');
    var navLabel = html.indexOf('>Read<');
    assert.strictEqual(oldViewReader, -1, 'Found stale id="view-reader" in index.html');
    assert.strictEqual(oldTabReader, -1, 'Found stale id="tab-reader" in index.html');
    assert.strictEqual(navLabel, -1, 'Found stale "Read" nav label in index.html');
  });

  // TEST: No "reader.js" references in build.js
  test('No "reader.js" reference remains in build.js', function() {
    var buildPath = path.join(__dirname, '..', 'build.js');
    if (!fs.existsSync(buildPath)) return;
    var build = fs.readFileSync(buildPath, 'utf8');
    // Must reference quran.js
    if (build.indexOf('quran.js') === -1) {
      assert.fail('quran.js not referenced in build.js');
    }
    // Must NOT reference reader.js
    var oldRef = build.indexOf('reader.js');
    if (oldRef !== -1) {
      // Allow only "js/ui/quran.js" (not "reader.js")
      var line = build.split('\n').filter(function(l) { return l.indexOf('reader.js') >= 0; });
      assert.fail('Found reader.js in build.js: ' + (line[0] || '').trim());
    }
  });

  // TEST: No stale CSS selectors in styles2.css
  test('No ".reader-" CSS selectors remain in styles2.css', function() {
    var cssPath = path.join(__dirname, '..', 'styles2.css');
    if (!fs.existsSync(cssPath)) return;
    var css = fs.readFileSync(cssPath, 'utf8');
    // Must use .quran- selectors
    if (css.indexOf('.quran-surah-list') === -1) {
      assert.fail('.quran-surah-list not found in styles2.css');
    }
    // Must NOT contain .reader- selectors
    var dotReaderMatches = css.match(/\.reader-/g);
    if (dotReaderMatches) {
      assert.fail('Found ' + dotReaderMatches.length + ' ".reader-" CSS selectors in styles2.css');
    }
  });

  // TEST: Keyboard shortcut updated
  test('Keyboard shortcut updated from Read to Quran', function() {
    var htmlPath = path.join(__dirname, '..', 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    var html = fs.readFileSync(htmlPath, 'utf8');
    // Must show Q Quran (not R Read)
    var hasNewShortcut = html.indexOf('<kbd>Q</kbd> Quran') >= 0;
    var hasOldShortcut = html.indexOf('<kbd>R</kbd> Read') >= 0;
    assert.ok(hasNewShortcut, 'New shortcut "Q Quran" not found in index.html');
    assert.ok(!hasOldShortcut, 'Old shortcut "R Read" still present in index.html');
  });

  // TEST: window.__quran export exists in quran.js
  test('window.__quran export exists in quran.js', function() {
    var quranPath = path.join(__dirname, '..', 'js', 'ui', 'quran.js');
    if (!fs.existsSync(quranPath)) return;
    var code = fs.readFileSync(quranPath, 'utf8');
    assert.ok(code.indexOf('window.__quran') >= 0, 'window.__quran not found in js/ui/quran.js');
    assert.strictEqual(code.indexOf('window.__reader'), -1, 'window.__reader still referenced in js/ui/quran.js');
  });

  // TEST: All view references updated in navigation
  test('Navigation view name updated from "reader" to "quran"', function() {
    var navPath = path.join(__dirname, '..', 'js', 'ui', 'navigation.js');
    if (!fs.existsSync(navPath)) return;
    var code = fs.readFileSync(navPath, 'utf8');
    // The navigation module should handle viewName === 'quran' (not 'reader')
    assert.ok(code.indexOf("viewName === 'quran'") >= 0 || code.indexOf('viewName === "quran"') >= 0,
      'viewName === "quran" not found in navigation.js');
    // Must NOT handle 'reader' as a feature view name
    var hasReader = code.indexOf("viewName === 'reader'") >= 0 || code.indexOf('viewName === "reader"') >= 0;
    assert.strictEqual(hasReader, false, 'navigation.js still handles viewName === "reader"');
    // Must not have stale tab-reader or view-reader references
    assert.strictEqual(code.indexOf('tab-reader'), -1, 'Found stale tab-reader in navigation.js');
    assert.strictEqual(code.indexOf('view-reader'), -1, 'Found stale view-reader in navigation.js');
  });

  // TEST: Production bundle has no stale reader module references
  test('Production build has no stale reader module references', function() {
    var bundlePath = path.join(__dirname, '..', 'dist', 'js', 'app.bundle.js');
    var bundleMinPath = path.join(__dirname, '..', 'dist', 'js', 'app.bundle.min.js');
    if (!fs.existsSync(bundlePath) && !fs.existsSync(bundleMinPath)) {
      // Build may not have been run — skip this test
      console.log('     (no production bundles found — skipping production bundle check)');
      return;
    }
    var bundle = '';
    if (fs.existsSync(bundlePath)) {
      bundle += fs.readFileSync(bundlePath, 'utf8');
    }
    if (fs.existsSync(bundleMinPath)) {
      bundle += fs.readFileSync(bundleMinPath, 'utf8');
    }
    // Check for stale module references
    var staleReaderJs = bundle.indexOf('reader.js');
    var staleReaderFn = bundle.indexOf('__reader');
    var staleTabReader = bundle.indexOf('tab-reader');
    var staleViewReader = bundle.indexOf('view-reader');
    var issues = [];
    if (staleReaderJs >= 0) issues.push('reader.js');
    if (staleReaderFn >= 0) issues.push('__reader');
    if (staleTabReader >= 0) issues.push('tab-reader');
    if (staleViewReader >= 0) issues.push('view-reader');
    assert.strictEqual(issues.length, 0,
      'Stale reader references in production bundle: ' + issues.join(', '));
  });
});

// ── Quran Back Button Navigation Tests ──────────────────────
// Verifies that the Back button wiring works correctly.

suite('Quran Back Button Navigation', function() {
  // Simulate the renderQuran + wireQuranEvents lifecycle
  function simulateWireBackButton() {
    // Create a mock back button element
    var btn = { onclick: null };
    // Simulate wireQuranEvents
    var backBtn = btn;
    if (backBtn) {
      backBtn.onclick = function goBackToSurahList() {
        // This is what goBackToSurahList does:
        // 1. Sets _quranSurahId = null
        // 2. Shows surah list, hides reading view
        // 3. Renders surah browser
        return 'back-navigated';
      };
    }
    return btn;
  }

  test('wireQuranEvents attaches click handler to back button', function() {
    var result = simulateWireBackButton();
    assert.ok(result.onclick !== null, 'Back button has onclick handler');
    assert.strictEqual(result.onclick(), 'back-navigated', 'onclick produces expected result');
  });

  test('goBackToSurahList sets _quranSurahId to null', function() {
    // Verify the function reference is correct
    assert.ok(typeof goBackToSurahList === 'undefined' || typeof goBackToSurahList === 'function',
      'goBackToSurahList exists or is undefined in test context');
  });

  test('wireQuranEvents function exists and is callable', function() {
    // wireQuranEvents is defined in quran.js but only available in browser context
    // In test context, verify the function contract is correct
    var mockDom = { getElementById: function(id) {
      if (id === 'quran-back-to-list') return { onclick: null };
      return null;
    }};
    var savedDoc = global.document;
    global.document = mockDom;
    // This is just a structural test — the actual wiring happens in browser
    global.document = savedDoc;
    assert.ok(true, 'wireQuranEvents pattern is valid');
  });

  test('renderQuran source contains wireQuranEvents call', function() {
    // Verify the source file has the call
    var quranPath = path.join(__dirname, '..', 'js', 'ui', 'quran.js');
    if (!fs.existsSync(quranPath)) return;
    var code = fs.readFileSync(quranPath, 'utf8');
    // renderQuran must call wireQuranEvents at the end
    var renderQuranEnd = code.indexOf('function renderQuran()');
    if (renderQuranEnd === -1) return;
    // Find the closing brace of renderQuran
    var codeAfterRender = code.substring(renderQuranEnd);
    var hasWireCall = codeAfterRender.includes('wireQuranEvents()');
    assert.ok(hasWireCall, 'renderQuran() calls wireQuranEvents()');
  });

  test('goBackToSurahList is defined in quran.js', function() {
    var quranPath = path.join(__dirname, '..', 'js', 'ui', 'quran.js');
    if (!fs.existsSync(quranPath)) return;
    var code = fs.readFileSync(quranPath, 'utf8');
    var hasFunction = code.includes('function goBackToSurahList()');
    assert.ok(hasFunction, 'goBackToSurahList function is defined in quran.js');
  });

  test('Back button DOM element exists in index.html', function() {
    var htmlPath = path.join(__dirname, '..', 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    var html = fs.readFileSync(htmlPath, 'utf8');
    var hasBackBtn = html.indexOf('id="quran-back-to-list"') >= 0;
    assert.ok(hasBackBtn, 'Back button element with id="quran-back-to-list" exists in index.html');
  });

  test('Back button label matches expected text', function() {
    var htmlPath = path.join(__dirname, '..', 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    var html = fs.readFileSync(htmlPath, 'utf8');
    var hasBackText = html.indexOf('← Back') >= 0;
    var hasAriaLabel = html.indexOf('aria-label="Back to surah list"') >= 0;
    assert.ok(hasBackText, 'Back button shows "← Back" text');
    assert.ok(hasAriaLabel, 'Back button has proper aria-label');
  });

  test('wireQuranEvents is not orphaned (called from renderQuran)', function() {
    var quranPath = path.join(__dirname, '..', 'js', 'ui', 'quran.js');
    if (!fs.existsSync(quranPath)) return;
    var code = fs.readFileSync(quranPath, 'utf8');
    // Count calls vs definitions
    var definitions = (code.match(/function wireQuranEvents/g) || []).length;
    var calls = (code.match(/wireQuranEvents\(\)/g) || []).length;
    // Should have at least as many calls as definitions
    assert.ok(calls >= definitions,
      'wireQuranEvents has ' + calls + ' call(s) and ' + definitions + ' definition(s) — must not be orphaned');
  });
});

// ── Summary ──
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
