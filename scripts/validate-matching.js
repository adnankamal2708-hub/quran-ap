#!/usr/bin/env node
/**
 * scripts/validate-matching.js
 *
 * Corpus Matching Validation — Phase 1.5
 *
 * Investigates:
 *   1. Tokenization: Do attached particles prevent matches?
 *   2. Normalization: Are Uthmani/simple/vocab pipelines consistent?
 *   3. Categorize all 274 unmatched vocabulary entries
 *   4. Cross-reference top-50 words against independent frequency data
 *   5. Produce a counting methodology specification
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var QURAN_DATA_PATH = path.join(ROOT, 'js/quran/quran-data.js');
var VOCAB_DIR = path.join(ROOT, 'js/data');

// ── Normalization (same as rebuild script) ──
var DIACRITICS_RANGE = /[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g;

function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(/\u0640/g, '')
    .replace(DIACRITICS_RANGE, '')
    .replace(/[\uFD3E\uFD3F]/g, '')
    .replace(/\u0671/g, '\u0627')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0649\u0670/g, '\u064A')
    .replace(/\u0670/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/[\u0624\u0626]/g, function(m) { return m === '\u0624' ? '\u0648' : '\u064A'; })
    .replace(/[\u06E5\u06E6]/g, function(m) { return m === '\u06E5' ? '\u0648' : '\u064A'; })
    .replace(/\u0621\u0627/g, '\u0627')
    .replace(/\u0621/g, '\u0627')
    .replace(/\s+/g, ' ')
    .trim();
}

// More aggressive: strip common Arabic prefixes for matching
// NOTE: This is EXPERIMENTAL for investigation purposes only
function stripArabicPrefixes(text) {
  // Arabic prefixes (one-character particles): و ف ب ل ك س
  // These are always attached to the following word
  // Also: بِ (bi-), لِ (li-), فَ (fa-), وَ (wa-), كَ (ka-), سَ (sa-)
  // The definite article ال is also a prefix
  
  var result = text;
  
  // Strip single-character particles (with any attached diacritics)
  // و (waw), ف (fa), ب (ba), ل (lam), ك (kaf), س (seen)
  // These can have diacritics attached (e.g., وَ, فَ, بِ, لِ)
  
  // Pattern: prefix followed by non-space (the word body)
  // Prefixes: و, ف, ب, ل, ك, س (each optionally followed by diacritic)
  
  // Strip و (waw-and)
  result = result.replace(/^و/g, '');
  // Strip ف (fa-so)
  result = result.replace(/^ف/g, '');
  // Strip ب (ba-with/by)
  result = result.replace(/^ب/g, '');
  // Strip ل (lam-to/for) - but careful with لله (lillah) which has double lam
  // Only strip if followed by another lam (the definite article)
  result = result.replace(/^لل/g, 'ل');  // ل + ال → ل (just the preposition)
  // Actually, be more careful: strip ل only when it's a prefix, not part of root
  // For now, strip ل only when followed by a non-lam letter
  result = result.replace(/^ل(?!ل)/, '');  // ل prefix (not followed by another ل)
  // Strip ك (ka-as/like)
  result = result.replace(/^ك/g, '');
  // Strip س (sa-future tense)
  result = result.replace(/^س/g, '');
  
  // Strip definite article ال
  // This should be done after single-particle prefixes since they can combine
  // e.g., بِال (bi + al = with the)
  result = result.replace(/^ال/g, '');
  
  return result;
}

// ── Load datasets ──
function loadQuranCorpus() {
  var code = fs.readFileSync(QURAN_DATA_PATH, 'utf8');
  var sandbox = { window: {}, console: console };
  vm.runInContext(code, vm.createContext(sandbox));
  return sandbox.QURAN_TEXT;
}

function loadVocabulary() {
  var ALL_WORDS = [];
  var files = fs.readdirSync(VOCAB_DIR).filter(function(f) {
    return f.startsWith('words-') && f.endsWith('.js');
  }).sort();
  files.forEach(function(f) {
    try {
      var content = fs.readFileSync(path.join(VOCAB_DIR, f), 'utf8');
      vm.runInNewContext(content, { ALL_WORDS: ALL_WORDS });
    } catch(e) {}
  });
  return { words: ALL_WORDS, files: files };
}

// ── Build multiple indexes (different normalization levels) ──
function buildIndexes(quranText) {
  var indexes = {
    raw: {},       // raw tokens (no normalization)
    normalized: {}, // token → { count, verses }
    stripped: {},   // prefix-stripped → { count, verses }
  };
  
  function addToIndex(idx, key, verseKey) {
    if (!idx[key]) idx[key] = { count: 0, verses: [] };
    idx[key].count++;
    idx[key].verses.push(verseKey);
  }

  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        var token = tokens[ti].trim();
        if (!token) continue;
        var vk = sid + ':' + verse.id;
        
        addToIndex(indexes.raw, token, vk);
        
        var normed = normalizeArabic(token);
        if (normed) addToIndex(indexes.normalized, normed, vk);
        
        var stripped = stripArabicPrefixes(normed);
        if (stripped && stripped !== normed) {
          addToIndex(indexes.stripped, stripped, vk);
        } else if (stripped) {
          addToIndex(indexes.stripped, stripped + ' (no-change)', '');
        }
      }
    }
  }
  
  return indexes;
}

// ═══════════════════════════════════════════════════════════════
// 1. TOKENIZATION ANALYSIS — Attached Particles
// ═══════════════════════════════════════════════════════════════

function analyzeTokenization(quranText) {
  var results = [];
  var prefixPatterns = {
    'waw':    /^و[\u064B-\u065F]?/,
    'fa':     /^ف[\u064B-\u065F]?/,
    'ba':     /^ب[\u064B-\u065F]?/,
    'lam':    /^ل[\u064B-\u065F]?/,
    'kaf':    /^ك[\u064B-\u065F]?/,
    'seen':   /^س[\u064B-\u065F]?/,
    'ta':     /^ت[\u064B-\u065F]?/,  // Future tense marker (2nd person)
  };
  
  var stats = {};
  Object.keys(prefixPatterns).forEach(function(k) { stats[k] = { total: 0, stripped: '' }; });
  stats['total_tokens'] = 0;
  stats['prefixed_tokens'] = 0;
  stats['non_prefixed_tokens'] = 0;
  stats['bare_alef_lam'] = 0;
  stats['alef_lam'] = 0;

  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        var token = tokens[ti].trim();
        if (!token) continue;
        stats['total_tokens']++;
        
        var hasPrefix = false;
        Object.keys(prefixPatterns).forEach(function(pk) {
          if (prefixPatterns[pk].test(token)) {
            stats[pk].total++;
            hasPrefix = true;
          }
        });
        
        if (hasPrefix) stats['prefixed_tokens']++;
        else stats['non_prefixed_tokens']++;
        
        // Check if starts with ال (alif lam)
        if (token.charAt(0) === '\u0627' || token.charAt(0) === '\u0671') {
          stats['bare_alef_lam']++;
          // Check for definite article ال
          if (token.length >= 2 && 
              (token.charAt(1) === '\u0644' || token.charAt(1) === '\u06E0')) {
            stats['alef_lam']++;
          }
        }
      }
    }
  }
  
  return stats;
}

// ═══════════════════════════════════════════════════════════════
// 2. NORMALIZATION COMPARISON
// ═══════════════════════════════════════════════════════════════

function analyzeNormalization(quranText, vocabWords) {
  // Take top 20 vocab words by old occ
  var topWords = vocabWords.slice().sort(function(a,b) { return (b.occ||0) - (a.occ||0); }).slice(0, 30);
  
  var results = [];
  
  topWords.forEach(function(w) {
    var normed = normalizeArabic(w.arabic);
    var stripped = stripArabicPrefixes(normed);
    
    // Find examples of this word in the corpus
    var corpusExamples = [];
    for (var sid = 1; sid <= 5 && corpusExamples.length < 3; sid++) { // just surah 1-5
      var surah = quranText[sid];
      if (!surah || !surah.verses) continue;
      for (var vi = 0; vi < Math.min(surah.verses.length, 30); vi++) { // first 30 verses
        var verse = surah.verses[vi];
        if (!verse || !verse.text) continue;
        var tokens = verse.text.split(/\s+/);
        for (var ti = 0; ti < tokens.length; ti++) {
          var token = tokens[ti];
          var tokenNormed = normalizeArabic(token);
          var tokenStripped = stripArabicPrefixes(tokenNormed);
          
          // Check if this token matches (normalized or stripped)
          var matchNorm = (tokenNormed === normed);
          var matchStripped = (tokenStripped === normed) || (tokenStripped === stripped);
          
          if (matchNorm || matchStripped) {
            corpusExamples.push({
              token: token,
              normalized: tokenNormed,
              stripped: tokenStripped,
              matchType: matchNorm ? 'direct' : 'stripped',
              verseKey: sid + ':' + verse.id
            });
            break;
          }
        }
        if (corpusExamples.length >= 2) break;
      }
      if (corpusExamples.length >= 2) break;
    }
    
    results.push({
      arabic: w.arabic,
      english: w.english,
      oldOcc: w.occ,
      normalized: normed,
      stripped: stripped,
      hasPrefix: normed !== stripped,
      corpusExamples: corpusExamples,
      matchCount: corpusExamples.length,
    });
  });
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// 3. UNMATCHED ENTRIES CATEGORIZATION
// ═══════════════════════════════════════════════════════════════

function categorizeUnmatched(vocabWords, quranIndex) {
  var unmatched = [];
  
  vocabWords.forEach(function(w, idx) {
    var normed = normalizeArabic(w.arabic || '');
    if (!normed) {
      unmatched.push({ idx: idx, arabic: w.arabic, english: w.english, oldOcc: w.occ, category: 'empty-normalized' });
      return;
    }
    
    // Check direct normalized match
    var direct = quranIndex.normalized[normed];
    if (direct) return; // matched
    
    // Check prefix-stripped match
    var stripped = stripArabicPrefixes(normed);
    var strippedMatch = quranIndex.stripped[stripped];
    
    // Determine category
    var category = 'unknown';
    var details = {};
    
    if (normed.indexOf(' ') >= 0) {
      // Multi-word / phrase
      var parts = normed.split(/\s+/);
      var allPartsMatch = true;
      var somePartsMatch = false;
      parts.forEach(function(p) {
        if (quranIndex.normalized[p]) somePartsMatch = true;
        else allPartsMatch = false;
      });
      category = allPartsMatch ? 'multi-word-all-match' : 'multi-word-partial';
      details.parts = parts;
      details.somePartsMatch = somePartsMatch;
    } else if (stripped && strippedMatch) {
      category = 'prefix-mismatch';
      details.stripped = stripped;
    } else {
      // Try to find why it doesn't match
      // Check if it starts with Alif Lam
      var startsWithAL = normed.indexOf('ال') === 0;
      // Try looking for just the word without ال
      var withoutAL = startsWithAL ? normed.substring(2) : null;
      var withoutALMatch = withoutAL && quranIndex.normalized[withoutAL];
      
      if (withoutALMatch) {
        category = 'definite-article-mismatch';
      } else {
        // Check for character-level differences
        category = 'orthography-mismatch';
        details.normedLen = normed.length;
        details.first3 = normed.substring(0, 3);
        details.last3 = normed.substring(Math.max(0, normed.length - 3));
      }
    }
    
    unmatched.push({
      idx: idx,
      arabic: w.arabic,
      english: w.english,
      oldOcc: w.occ,
      normalized: normed,
      category: category,
      details: details,
      stripped: stripped,
    });
  });
  
  return unmatched;
}

// ═══════════════════════════════════════════════════════════════
// 4. CROSS-REFERENCE — Top 50 Words
// ═══════════════════════════════════════════════════════════════

function crossReferenceTop50(vocabWords, quranIndex) {
  // Take top 50 vocab words by old occ
  var top50 = vocabWords.slice().sort(function(a,b) { return (b.occ||0) - (a.occ||0); }).slice(0, 50);
  
  var results = [];
  top50.forEach(function(w, rank) {
    var normed = normalizeArabic(w.arabic || '');
    var direct = quranIndex.normalized[normed];
    var directCount = direct ? direct.count : 0;
    
    // Stripped count
    var stripped = stripArabicPrefixes(normed);
    var strippedEntry = quranIndex.stripped[stripped];
    var strippedCount = strippedEntry ? strippedEntry.count : 0;
    
    // Token-summed count (if multi-word phrase)
    var phraseSumCount = 0;
    if (normed.indexOf(' ') >= 0) {
      var parts = normed.split(/\s+/);
      parts.forEach(function(p) {
        var e = quranIndex.normalized[p];
        if (e) phraseSumCount += e.count;
      });
    }
    
    // Also try: prefix-stripped matching directly against normalized index
    // (Some vocab words may have prefixes that need stripping)
    var prefixStrippedMatch = stripped && quranIndex.normalized[stripped];
    var prefixStrippedCount = prefixStrippedMatch ? quranIndex.normalized[stripped].count : 0;
    
    // Count prefixed corpus tokens that match the vocab word
    // I.e., tokens like "وَقَالَ" that match vocab "قَالَ" after stripping
    var corpusTokensWithPrefix = 0;
    if (normed && quranIndex.normalized) {
      Object.keys(quranIndex.normalized).forEach(function(key) {
        var strippedKey = stripArabicPrefixes(key);
        if (strippedKey === normed && key !== normed) {
          corpusTokensWithPrefix += quranIndex.normalized[key].count;
        }
      });
    }
    
    results.push({
      rank: rank + 1,
      arabic: w.arabic,
      english: (w.english || '').substring(0, 30),
      oldOcc: w.occ,
      directMatch: directCount,
      strippedMatch: prefixStrippedCount,
      withPrefixVariants: corpusTokensWithPrefix,
      totalWithPrefixes: directCount + (corpusTokensWithPrefix || 0),
      phraseSum: phraseSumCount,
    });
  });
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  var lines = [];
  function emit(l) { lines.push(l); }
  function hr() { emit('\u2500'.repeat(70)); }
  
  emit('');
  emit('  Corpus Matching Validation');
  emit('  ==========================');
  emit('');
  
  // Load data
  var quranText = loadQuranCorpus();
  var vocab = loadVocabulary();
  emit('  Quran: ' + Object.keys(quranText).length + ' surahs');
  emit('  Vocabulary: ' + vocab.words.length + ' entries');
  
  // Build indexes
  var indexes = buildIndexes(quranText);
  emit('  Quran tokens: ' + Object.keys(indexes.raw).length + ' unique raw, ' +
    Object.keys(indexes.normalized).length + ' unique normalized, ' +
    Object.keys(indexes.stripped).length + ' unique stripped');
  emit('');
  
  // ═══ 1. TOKENIZATION ═══
  emit('═'.repeat(70));
  emit('  1. TOKENIZATION ANALYSIS — Attached Particles');
  emit('═'.repeat(70));
  
  var tokenStats = analyzeTokenization(quranText);
  emit('');
  emit('  Total Quran tokens:         ' + tokenStats.total_tokens);
  emit('  Tokens WITH particle prefix: ' + tokenStats.prefixed_tokens + ' (' +
    Math.round(tokenStats.prefixed_tokens / tokenStats.total_tokens * 100) + '%)');
  emit('  Tokens WITHOUT prefix:      ' + tokenStats.non_prefixed_tokens + ' (' +
    Math.round(tokenStats.non_prefixed_tokens / tokenStats.total_tokens * 100) + '%)');
  emit('');
  emit('  Prefix breakdown:');
  emit('    و (waw-and):      ' + tokenStats.waw + ' tokens (' +
    Math.round(tokenStats.waw / tokenStats.total_tokens * 100) + '%)');
  emit('    ف (fa-so):        ' + tokenStats.fa + ' tokens (' +
    Math.round(tokenStats.fa / tokenStats.total_tokens * 100) + '%)');
  emit('    ب (ba-with):      ' + tokenStats.ba + ' tokens (' +
    Math.round(tokenStats.ba / tokenStats.total_tokens * 100) + '%)');
  emit('    ل (lam-to/for):   ' + tokenStats.lam + ' tokens (' +
    Math.round(tokenStats.lam / tokenStats.total_tokens * 100) + '%)');
  emit('    ك (kaf-as/like):  ' + tokenStats.kaf + ' tokens (' +
    Math.round(tokenStats.kaf / tokenStats.total_tokens * 100) + '%)');
  emit('    س (sa-will):      ' + tokenStats.seen + ' tokens (' +
    Math.round(tokenStats.seen / tokenStats.total_tokens * 100) + '%)');
  emit('');
  emit('  Tokens with ال (definite article): ' + tokenStats.alef_lam + ' (' +
    Math.round(tokenStats.alef_lam / tokenStats.total_tokens * 100) + '%)');
  emit('');
  
  // ═══ 2. NORMALIZATION ═══
  emit('═'.repeat(70));
  emit('  2. NORMALIZATION COMPARISON — Top 30 Words');
  emit('═'.repeat(70));
  emit('');
  
  var normResults = analyzeNormalization(quranText, vocab.words);
  normResults.forEach(function(r, idx) {
    emit('  [' + (idx+1) + '] ' + r.arabic.padEnd(18) + ' occ=' + r.oldOcc.toString().padStart(5) +
      '  norm="' + r.normalized.substring(0, 20).padEnd(20) + '"' +
      '  stripped="' + (r.stripped || r.normalized).substring(0, 20).padEnd(20) + '"');
    if (r.corpusExamples.length > 0) {
      r.corpusExamples.forEach(function(ex) {
        emit('       Corpus: "' + ex.token.substring(0, 25).padEnd(25) + '" → norm="' +
          ex.normalized.substring(0, 20).padEnd(20) + '" [' + ex.matchType + '] at ' + ex.verseKey);
      });
    } else {
      emit('       NO MATCH FOUND in first 5 surahs');
    }
    emit('');
  });
  
  // ═══ 3. UNMATCHED CATEGORIZATION ═══
  emit('═'.repeat(70));
  emit('  3. UNMATCHED ENTRIES — Categorization');
  emit('═'.repeat(70));
  
  var unmatched = categorizeUnmatched(vocab.words, indexes);
  var byCategory = {};
  unmatched.forEach(function(u) {
    byCategory[u.category] = (byCategory[u.category] || 0) + 1;
  });
  
  emit('');
  emit('  Total unmatched: ' + unmatched.length + ' entries\n');
  emit('  By category:');
  var sortedCats = Object.keys(byCategory).sort(function(a,b) { return byCategory[b] - byCategory[a]; });
  sortedCats.forEach(function(cat) {
    var pct = Math.round(byCategory[cat] / unmatched.length * 100);
    emit('    ' + cat.padEnd(35) + byCategory[cat] + ' (' + pct + '%)');
  });
  
  emit('');
  emit('  Samples from each category:');
  var shown = {};
  unmatched.forEach(function(u) {
    if (shown[u.category]) return;
    shown[u.category] = true;
    emit('    [' + u.category + '] "' + (u.arabic || '').padEnd(30) + '" norm="' +
      (u.normalized || '').substring(0, 25).padEnd(25) + '" eng="' + (u.english || '').substring(0, 25) + '"');
    if (u.details && u.details.parts) {
      emit('           parts: ' + u.details.parts.join(', '));
    }
  });
  
  // ═══ 4. CROSS-REFERENCE — Top 50 ═══
  emit('');
  emit('═'.repeat(70));
  emit('  4. CROSS-REFERENCE — Top 50 Words');
  emit('═'.repeat(70));
  emit('');
  
  var xref = crossReferenceTop50(vocab.words, indexes);
  
  emit('  #  Word         Old    Direct  Stripped  +Prefix  Total   %Old');
  emit('  ' + '\u2500'.repeat(70));
  
  var xrefReport = {
    oldSum: 0, directSum: 0, strippedSum: 0, withPrefixSum: 0, totalWithPrefixSum: 0,
    directMatches: 0, strippedMatches: 0, prefixMatchGains: 0,
  };
  
  xref.forEach(function(r) {
    xrefReport.oldSum += r.oldOcc;
    xrefReport.directSum += r.directMatch;
    xrefReport.strippedSum += r.strippedMatch;
    xrefReport.withPrefixSum += r.withPrefixVariants;
    xrefReport.totalWithPrefixSum += r.totalWithPrefixes;
    if (r.directMatch > 0) xrefReport.directMatches++;
    if (r.strippedMatch > 0) xrefReport.strippedMatches++;
    if (r.withPrefixVariants > 0) xrefReport.prefixMatchGains++;
    
    var bestCount = r.totalWithPrefixes > 0 ? r.totalWithPrefixes : (r.strippedMatch > 0 ? r.strippedMatch : r.directMatch);
    var pctOfOld = r.oldOcc > 0 ? Math.round(bestCount / r.oldOcc * 100) : 0;
    
    emit('  ' + String(r.rank).padStart(2) + ' ' +
      (r.arabic || '').padEnd(12) +
      String(r.oldOcc).padStart(6) + ' ' +
      String(r.directMatch).padStart(6) + ' ' +
      String(r.strippedMatch).padStart(6) + ' ' +
      String(r.withPrefixVariants).padStart(6) + ' ' +
      String(r.totalWithPrefixes).padStart(6) + '  ' +
      pctOfOld + '%');
  });
  
  emit('');
  emit('  Summary:');
  emit('    Old total (stored):         ' + xrefReport.oldSum);
  emit('    Direct matches (normalized): ' + xrefReport.directSum + ' (' +
    Math.round(xrefReport.directSum / xrefReport.oldSum * 100) + '% of old)');
  emit('    Stripped matches:           ' + xrefReport.strippedSum);
  emit('    Additional prefix variants:  ' + xrefReport.withPrefixSum);
  emit('    Total with prefixes:        ' + xrefReport.totalWithPrefixSum + ' (' +
    Math.round(xrefReport.totalWithPrefixSum / xrefReport.oldSum * 100) + '% of old)');
  emit('');
  emit('    Words with direct match:    ' + xrefReport.directMatches + '/50');
  emit('    Words with stripped match:  ' + xrefReport.strippedMatches + '/50');
  emit('    Words improved by prefix:    ' + xrefReport.prefixMatchGains + '/50');
  
  // ═══ 5. Establish coverage with prefix stripping ═══
  emit('');
  emit('═'.repeat(70));
  emit('  5. COVERAGE WITH PREFIX-STRIPPED MATCHING');
  emit('═'.repeat(70));
  emit('');
  
  // Count how many corpus tokens (with prefixes stripped) match ANY vocabulary word
  var strippedVocabSet = {};
  vocab.words.forEach(function(w) {
    var normed = normalizeArabic(w.arabic || '');
    if (normed) {
      strippedVocabSet[normed] = true;  // the word itself
      var s = stripArabicPrefixes(normed);
      if (s && s !== normed) strippedVocabSet[s] = true;
    }
  });
  
  var matchedTokens = 0;
  var unmatchedTokens = 0;
  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        var token = tokens[ti].trim();
        if (!token) continue;
        var normed = normalizeArabic(token);
        var stripped = stripArabicPrefixes(normed);
        if (strippedVocabSet[stripped] || strippedVocabSet[normed]) {
          matchedTokens++;
        } else {
          unmatchedTokens++;
        }
      }
    }
  }
  
  var totalTokens = matchedTokens + unmatchedTokens;
  var coveragePct = Math.round(matchedTokens / totalTokens * 10000) / 100;
  emit('  Total Quran tokens:                ' + totalTokens);
  emit('  Matched by vocabulary (prefix-aware): ' + matchedTokens + ' (' + coveragePct + '%)');
  emit('  Unmatched:                         ' + unmatchedTokens + ' (' + (100 - coveragePct).toFixed(2) + '%)');
  emit('');
  
  // Simple text frequency reference (non-Uthmani)
  // This gives us a baseline: what if we strip ALL diacritics and just count?
  emit('  For reference — the 10 most common simple forms in the Quran corpus:');
  var sortedTokens = Object.keys(indexes.normalized)
    .filter(function(k) { return k.length > 1; })  // skip single-char tokens
    .sort(function(a, b) { return indexes.normalized[b].count - indexes.normalized[a].count; });
  sortedTokens.slice(0, 10).forEach(function(k, i) {
    emit('    ' + (i+1) + '. "' + k.substring(0, 20).padEnd(20) + '" ' + indexes.normalized[k].count + ' occurrences');
  });
  
  emit('');
  emit('  Most common prefix-stripped forms:');
  var strippedTokens = Object.keys(indexes.stripped)
    .filter(function(k) { return k.indexOf('(no-change)') < 0 && k.length > 1; })
    .sort(function(a, b) { return indexes.stripped[b].count - indexes.stripped[a].count; });
  strippedTokens.slice(0, 10).forEach(function(k, i) {
    emit('    ' + (i+1) + '. "' + k.substring(0, 20).padEnd(20) + '" ' + indexes.stripped[k].count + ' occurrences');
  });
  
  // Save report
  var reportPath = path.join(ROOT, 'scripts/matching-validation-report.txt');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  
  emit('');
  emit('═'.repeat(70));
  emit('  Report saved to: scripts/matching-validation-report.txt');
  emit('═'.repeat(70));
}

main();
