// ═══════════════════════════════════════════════════════════════
// data.js — Quranic Vocabulary Data Schema & Constants
//
// Architecture:
//   This file defines the data model constants and an empty ALL_WORDS
//   array. Individual word files in js/data/ populate the array.
//
//   To add new vocabulary, create or edit files in js/data/ —
//   no other files need changing.
//
// Schema (all fields per word):
//
//   arabic         — Arabic script (key field for SRS/bookmarks)
//   translit       — Transliteration (romanized)
//   english        — Short English gloss
//   meaning        — Full meaning with written context
//   type           — Part of speech label (display, e.g. "Verb")
//   typeCategory   — Normalized: noun|verb|particle|adjective|pronoun|exclamation
//   pattern        — Arabic morphological pattern (e.g. فَعَلَ, فَاعِل)
//   root           — Arabic root letters (e.g. ك-ت-ب)
//   rootMeaning    — Core concept of the root
//   rootPattern    — How words from this root behave
//   rootFamily     — Array of { a: arabic, e: english } related words
//   occ            — Occurrence count in the Quran
//   frequency      — "very-high"|"high"|"medium"|"low"
//   difficulty     — 1 (easiest) to 5 (hardest)
//   tags           — Array of category tags
//   lesson         — Suggested surah/lesson grouping (legacy, kept for backward compat)
//   surahId        — Surah number (1-114). Optional: if set, word belongs to this Surah.
//   verseKey       — Verse reference like "1:1" (Surah:Verse). Optional.
//   ayahA          — Example ayah in Arabic (with <span> highlights)
//   ayahT          — Example ayah translation
//   ayahR          — Example ayah reference (Surah X:Y)
//   tafsir         — Ibn Kathir tafsir excerpt
//   similarWords   — Array of arabic texts of words with similar meaning
//   oppositeWords  — Array of arabic texts of antonyms
//   relatedWords   — Array of arabic texts of conceptually related words
//   derivedForms   — (Computed) Array of { arabic, english, pattern, formName } sharing same root
//   semanticGroup  — (Computed) Array of { group, count, sampleWords } thematic groupings
//   confusedWith   — (Computed) Array of { arabic, english, similarity, reason } confused words
//   contextualEquivalents — (Computed) Array of { arabic, english, difficulty } same-context words
//   morphRelations — (Computed) Array of { arabic, english, relationshipType } morphological links
//   bookmarked     — Default bookmark state (false)
// ═══════════════════════════════════════════════════════════════


/** Words per lesson */
const WORDS_PER_LESSON = 10;

/** Master word list — populated by individual files in js/data/ */
const ALL_WORDS = [];

/** Internal counter for assigning unique word IDs */
let _wordIdCounter = 0;

/**
 * Assign a unique sequential ID to every word in ALL_WORDS that
 * doesn't already have one. IDs use the format "w_<N>" where N
 * is an auto-incrementing counter. This ensures every vocabulary
 * instance has a stable, unique identifier regardless of the
 * Arabic text (so identical words across different Surahs are
 * distinct entries).
 *
 * Call this once after all word files have been loaded.
 */
function assignWordIds() {
  for (var i = 0; i < ALL_WORDS.length; i++) {
    if (!ALL_WORDS[i].id) {
      ALL_WORDS[i].id = 'w_' + (_wordIdCounter++);
    }
  }
}

/** findWordById is defined in vocabulary.js (O(1) via cached index) */

// ═══════════════════════════════════════════════════════════════
// CANONICAL VOCABULARY — Deduplication System
//
// Groups identical Arabic words (same spelling, root, type, and
// core meaning) into single canonical entries with occurrence arrays
// preserving every verse context where the word appears.
//
// CANONICAL_WORDS — array of canonical vocabulary entries
// OLD_ID_TO_CANONICAL — maps old w_N IDs to new cw_N canonical IDs
// ═══════════════════════════════════════════════════════════════

/** Canonical word list — populated by deduplicateVocabulary() */
const CANONICAL_WORDS = [];

/** Maps old word IDs (w_N) to canonical word IDs (cw_N) */
const OLD_ID_TO_CANONICAL = {};

/** Internal counter for canonical word IDs */
let _canonicalIdCounter = 0;

/**
 * Build a uniqueness key for deduplication: arabic + root + typeCategory + core meaning
 * This ensures words are only merged when they genuinely share the same form and sense.
 */
function _wordUniquenessKey(w) {
  var coreMeaning = (w.meaning || w.english || '').split('\u2014')[0].trim().toLowerCase();
  return (w.arabic || '') + '|' + (w.root || '') + '|' + (w.typeCategory || '') + '|' + coreMeaning;
}

/**
 * Deduplicate ALL_WORDS into CANONICAL_WORDS by grouping
 * entries that share the same arabic + root + type + core meaning.
 *
 * Each canonical entry stores:
 *   - The base fields (arabic, translit, english, meaning, root, etc.)
 *   - occurrences: Array of { surahId, verseKey, ayahA, ayahT, ayahR, tafsir }
 *   - surahIds: Array of surah numbers where this word appears
 *   - occ: Total Quranic occurrence count (sum of all occurrences)
 *   - id: Canonical ID in format "cw_N"
 *
 * Also builds OLD_ID_TO_CANONICAL mapping for SRS migration.
 */
function deduplicateVocabulary() {
  // Clear existing
  CANONICAL_WORDS.length = 0;
  Object.keys(OLD_ID_TO_CANONICAL).forEach(function(k) { delete OLD_ID_TO_CANONICAL[k]; });
  _canonicalIdCounter = 0;
  
  if (ALL_WORDS.length === 0) return;
  
  // Group by uniqueness key
  var groups = {};
  
  for (var i = 0; i < ALL_WORDS.length; i++) {
    var w = ALL_WORDS[i];
    var key = _wordUniquenessKey(w);
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  }
  
  // Build canonical entries from groups
  var keys = Object.keys(groups).sort();
  
  for (var gi = 0; gi < keys.length; gi++) {
    var group = groups[keys[gi]];
    var base = group[0];
    var occurrences = [];
    var surahIds = [];
    var seenKeys = {};
    
    for (var wj = 0; wj < group.length; wj++) {
      var gw = group[wj];
      
      // Track surah IDs
      if (gw.surahId && surahIds.indexOf(gw.surahId) < 0) {
        surahIds.push(gw.surahId);
      }
      
      // Build occurrence entry (deduplicate by verseKey)
      var occKey = gw.surahId + ':' + (gw.verseKey || '');
      if (!seenKeys[occKey] && (gw.ayahA || gw.ayahT || gw.verseKey)) {
        seenKeys[occKey] = true;
        occurrences.push({
          surahId: gw.surahId || 0,
          verseKey: gw.verseKey || '',
          ayahA: gw.ayahA || '',
          ayahT: gw.ayahT || '',
          ayahR: gw.ayahR || '',
          tafsir: gw.tafsir || ''
        });
      }
      
      // Map old ID to canonical ID
      if (gw.id) {
        OLD_ID_TO_CANONICAL[gw.id] = null; // Will set after we know the canonical ID
      }
    }
    
    // Compute total occurrence count
    var totalOcc = 0;
    group.forEach(function(gw) { totalOcc += (gw.occ || 0); });
    totalOcc = Math.max(totalOcc, occurrences.length);
    
    // Compute best difficulty from group (most frequent = mode)
    var diffCounts = {};
    group.forEach(function(gw) {
      var d = gw.difficulty || 3;
      diffCounts[d] = (diffCounts[d] || 0) + 1;
    });
    var bestDifficulty = base.difficulty || 3;
    var maxCount = 0;
    Object.keys(diffCounts).forEach(function(d) {
      if (diffCounts[d] > maxCount) {
        maxCount = diffCounts[d];
        bestDifficulty = parseInt(d, 10);
      }
    });
    
    // Compute best frequency from group (most frequent = mode)
    var freqCounts = {};
    group.forEach(function(gw) {
      var f = gw.frequency || 'medium';
      freqCounts[f] = (freqCounts[f] || 0) + 1;
    });
    var bestFrequency = base.frequency || 'medium';
    var maxFreqCount = 0;
    Object.keys(freqCounts).forEach(function(f) {
      if (freqCounts[f] > maxFreqCount) {
        maxFreqCount = freqCounts[f];
        bestFrequency = f;
      }
    });
    
    // Merge tags from all group entries
    var mergedTags = [];
    var seenTags = {};
    group.forEach(function(gw) {
      (gw.tags || []).forEach(function(t) {
        if (!seenTags[t]) {
          seenTags[t] = true;
          mergedTags.push(t);
        }
      });
    });
    
    // Create canonical ID
    var canonicalId = 'cw_' + (_canonicalIdCounter++);
    
    // Create canonical entry
    var canonical = {
      id: canonicalId,
      arabic: base.arabic,
      translit: base.translit,
      type: base.type,
      typeCategory: base.typeCategory,
      pattern: base.pattern,
      english: base.english,
      meaning: base.meaning,
      root: base.root,
      rootMeaning: base.rootMeaning,
      rootPattern: base.rootPattern,
      rootFamily: base.rootFamily,
      occ: totalOcc,
      frequency: bestFrequency,
      difficulty: bestDifficulty,
      tags: mergedTags,
      lesson: base.lesson,
      surahIds: surahIds,
      occurrences: occurrences,
      similarWords: base.similarWords,
      oppositeWords: base.oppositeWords,
      relatedWords: base.relatedWords,
    };
    
    CANONICAL_WORDS.push(canonical);
    
    // Update OLD_ID_TO_CANONICAL for all words in this group
    group.forEach(function(gw) {
      if (gw.id) {
        OLD_ID_TO_CANONICAL[gw.id] = canonicalId;
      }
    });
  }
  
  console.log('[canonical] Deduplicated ' + ALL_WORDS.length + ' words into ' + CANONICAL_WORDS.length + ' canonical entries.');
  console.log('[canonical] ' + Object.keys(groups).filter(function(k) { return groups[k].length > 1; }).length + ' groups had duplicates merged.');
}

/**
 * Get a canonical word by its canonical ID (cw_N).
 */
function getCanonicalWordById(canonicalId) {
  if (!CANONICAL_WORDS || CANONICAL_WORDS.length === 0) {
    deduplicateVocabulary();
  }
  for (var ci = 0; ci < CANONICAL_WORDS.length; ci++) {
    if (CANONICAL_WORDS[ci].id === canonicalId) return CANONICAL_WORDS[ci];
  }
  return null;
}

/**
 * Get all canonical words.
 */
function getCanonicalWords() {
  if (!CANONICAL_WORDS || CANONICAL_WORDS.length === 0) {
    deduplicateVocabulary();
  }
  return CANONICAL_WORDS;
}

/**
 * Get the count of canonical vocabulary entries.
 */
function getCanonicalWordCount() {
  return getCanonicalWords().length;
}

/**
 * Map an old word ID (w_N) to its canonical ID (cw_N).
 * Returns the canonical ID or null if not found.
 */
function getCanonicalIdForOldId(oldId) {
  if (CANONICAL_WORDS.length === 0) {
    deduplicateVocabulary();
  }
  return OLD_ID_TO_CANONICAL[oldId] || null;
}

/**
 * Map an array of old word IDs to their canonical IDs.
 * Returns a deduplicated array of canonical IDs.
 */
function getCanonicalIdsForOldIds(oldIds) {
  if (!oldIds || !oldIds.length) return [];
  var result = {};
  for (var i = 0; i < oldIds.length; i++) {
    var cid = getCanonicalIdForOldId(oldIds[i]);
    if (cid) result[cid] = true;
  }
  return Object.keys(result);
}

// ── Surah-based Organization ────────────────────────────────────
// Words can be organized by Surah (surahId) or by sequential lessons.
// The system supports both modes: users can study by Surah or by
// traditional sequential lessons.

/** @type {'surah'|'lesson'} Current organization mode */
let _orgMode = 'lesson';

/**
 * Set the organization mode.
 */
function setOrganizationMode(mode) {
  if (mode === 'surah' || mode === 'lesson') {
    _orgMode = mode;
  }
}

/**
 * Get the current organization mode.
 */
function getOrganizationMode() {
  return _orgMode;
}

/** @type {number|null} Current active Surah ID (when in surah mode) */
let _activeSurahId = null;

/**
 * Set the active Surah ID for study.
 */
function setActiveSurahId(surahId) {
  _activeSurahId = surahId;
}

/**
 * Get the active Surah ID.
 */
function getActiveSurahId() {
  return _activeSurahId;
}

// ── Surah-based Word Functions ──────────────────────────────────

/**
 * Get all canonical words belonging to a specific Surah.
 * Searches both the old surahId field (for backward compat) and
 * the surahIds array on canonical entries.
 */
function getSurahWords(surahId) {
  if (!surahId) return [];
  var words = getCanonicalWords();
  return words.filter(function (w) {
    return (
      w.surahId === surahId ||
      (w.surahIds && w.surahIds.indexOf(surahId) >= 0)
    );
  });
}

/**
 * Get an array of surah IDs that have vocabulary entries.
 */
function getSurahsWithVocabulary() {
  var surahIds = {};
  // Check canonical words first
  var words = CANONICAL_WORDS.length > 0 ? CANONICAL_WORDS : ALL_WORDS;
  for (var si = 0; si < words.length; si++) {
    var w = words[si];
    if (w.surahIds) {
      w.surahIds.forEach(function(sid) { surahIds[sid] = true; });
    } else if (w.surahId) {
      surahIds[w.surahId] = true;
    }
  }
  return Object.keys(surahIds).map(Number).sort(function(a,b) { return a - b; });
}

// ── Foundation Course ────────────────────────────────────────────
// The Foundation Course teaches the 100 most frequent Quranic words
// organized into 10 progressive lessons (10 words each, every 5th is review).
// Completing all 10 lessons covers ~84% of all Quranic word occurrences.

/** Foundation Course mode constant */
const FOUNDATION_MODE = 'foundation';

/** Number of foundation lessons */
const FOUNDATION_LESSON_COUNT = 10;

/** Words per foundation lesson */
const FOUNDATION_WORDS_PER_LESSON = 10;

/**
 * Foundation Course words — canonical IDs of the top 100 most frequent
 * Quranic words, sorted by occurrence count (highest first).
 * These are computed once after canonical vocabulary is built.
 */
let FOUNDATION_WORDS = [];

/**
 * Foundation Course lesson definitions.
 * Each lesson has: id, label, wordIds (array of canonical IDs), coveragePct.
 */
let FOUNDATION_LESSONS = [];

/**
 * Build the Foundation Course from canonical vocabulary.
 * Must be called after deduplicateVocabulary().
 */
function buildFoundationCourse() {
  FOUNDATION_WORDS = [];
  FOUNDATION_LESSONS = [];
  
  if (CANONICAL_WORDS.length === 0) {
    console.warn('[foundation] No canonical words available.');
    return;
  }
  
  // Sort canonical words by frequency (highest first)
  var sorted = CANONICAL_WORDS.slice().sort(function(a, b) {
    return (b.occ || 0) - (a.occ || 0);
  });
  
  // Take top 100 words
  var topWords = sorted.slice(0, 100);
  
  // Compute total occurrences for coverage calculation
  var totalOcc = 0;
  for (var ti = 0; ti < CANONICAL_WORDS.length; ti++) {
    totalOcc += CANONICAL_WORDS[ti].occ || 0;
  }
  
  // Store canonical IDs
  FOUNDATION_WORDS = topWords.map(function(w) { return w.id; });
  
  // Build lesson groupings (10 words each)
  var cumulativeOcc = 0;
  var totalFoundOcc = 0;
  for (var fi = 0; fi < topWords.length; fi++) {
    totalFoundOcc += topWords[fi].occ || 0;
  }
  
  for (var li = 0; li < FOUNDATION_LESSON_COUNT; li++) {
    var start = li * FOUNDATION_WORDS_PER_LESSON;
    var end = Math.min(start + FOUNDATION_WORDS_PER_LESSON, topWords.length);
    var wordIds = [];
    var lessonOcc = 0;
    for (var wi = start; wi < end; wi++) {
      wordIds.push(topWords[wi].id);
      lessonOcc += topWords[wi].occ || 0;
    }
    cumulativeOcc += lessonOcc;
    
    var lessonNum = li + 1;
    var isReview = (lessonNum % 5 === 0);
    
    FOUNDATION_LESSONS.push({
      id: lessonNum,
      label: isReview ? 'Review ' + lessonNum : 'Foundation ' + lessonNum,
      start: start,
      end: end,
      wordCount: end - start,
      wordIds: wordIds,
      lessonCoverage: totalOcc > 0 ? (lessonOcc / totalOcc * 100).toFixed(1) + '%' : '0%',
      cumulativeCoverage: totalOcc > 0 ? (cumulativeOcc / totalOcc * 100).toFixed(1) + '%' : '0%',
      isReview: isReview,
    });
  }
  
  console.log('[foundation] Built ' + FOUNDATION_LESSONS.length + ' foundation lessons from ' +
    FOUNDATION_WORDS.length + ' words. Covers ' +
    (totalOcc > 0 ? (totalFoundOcc / totalOcc * 100).toFixed(1) : '0') + '% of Quranic occurrences.');
}

/**
 * Get the words for a specific foundation lesson (0-based index).
 * Returns canonical word objects.
 */
function getFoundationLessonWords(lessonIndex) {
  if (!FOUNDATION_LESSONS || FOUNDATION_LESSONS.length === 0) return [];
  if (lessonIndex < 0 || lessonIndex >= FOUNDATION_LESSONS.length) return [];
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = [];
  for (var fi = 0; fi < lesson.wordIds.length; fi++) {
    var w = getCanonicalWordById(lesson.wordIds[fi]);
    if (w) words.push(w);
  }
  return words;
}

/**
 * Get the total number of foundation lessons.
 */
function getFoundationLessonCount() {
  return FOUNDATION_LESSONS.length;
}

/**
 * Get all foundation course words (canonical word objects).
 */
function getAllFoundationWords() {
  if (!FOUNDATION_WORDS || FOUNDATION_WORDS.length === 0) return [];
  return FOUNDATION_WORDS.map(function(cid) {
    return getCanonicalWordById(cid);
  }).filter(Boolean);
}

// ── Foundation Course Coverage & Analytics ─────────────────────
// These functions compute Quran reading coverage, milestones,
// surah comprehension, and other analytics from canonical words
// and SRS data.

/** Cached total Quranic occurrences across all canonical words */
let _totalQuranOccurrences = 0;

/**
 * Compute total Quranic occurrences across all canonical words.
 */
function getTotalQuranOccurrences() {
  if (_totalQuranOccurrences > 0) return _totalQuranOccurrences;
  var words = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  if (words.length === 0) words = ALL_WORDS;
  var total = 0;
  for (var ti = 0; ti < words.length; ti++) {
    total += words[ti].occ || 0;
  }
  _totalQuranOccurrences = total;
  return total;
}

/**
 * Get the canonical IDs of all mastered words (stage >= 2 in SRS).
 * Returns an object: { canonicalId: true }
 */
function getMasteredWordIds() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var mastered = {};
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.stage >= 2) {
      mastered[id] = true;
    }
  });
  return mastered;
}

/**
 * Calculate Quran Reading Coverage based on mastered words.
 * Returns an object with detailed coverage metrics.
 */
function calculateCoverage() {
  var totalOcc = getTotalQuranOccurrences();
  var mastered = getMasteredWordIds();
  
  // Count mastered canonical words and their occurrences
  var allCanonical = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  if (allCanonical.length === 0) allCanonical = ALL_WORDS;
  
  var masteredCount = 0;
  var masteredOcc = 0;
  var totalWords = allCanonical.length;
  
  for (var ci = 0; ci < allCanonical.length; ci++) {
    var w = allCanonical[ci];
    if (mastered[w.id]) {
      masteredCount++;
      masteredOcc += w.occ || 0;
    }
  }
  
  var coveragePct = totalOcc > 0 ? (masteredOcc / totalOcc * 100) : 0;
  var wordMasteryPct = totalWords > 0 ? (masteredCount / totalWords * 100) : 0;
  
  // Estimate reading comprehension: based on coverage with diminishing returns
  // At 0% coverage → 0% comprehension
  // At ~84% coverage (100 foundation words) → ~60% comprehension
  // The curve: comprehension ≈ 1.3 * coverage^0.7 (diminishing at high coverage)
  var estimatedComprehension = coveragePct > 0 
    ? Math.min(95, Math.round(1.3 * Math.pow(coveragePct, 0.7) * 10) / 10)
    : 0;
  
  return {
    totalOccurrences: totalOcc,
    masteredWords: masteredCount,
    totalWords: totalWords,
    masteredOccurrences: masteredOcc,
    coveragePercent: Math.round(coveragePct * 10) / 10,
    wordMasteryPercent: Math.round(wordMasteryPct * 10) / 10,
    estimatedComprehension: estimatedComprehension,
  };
}

/**
 * Get Foundation Course-specific coverage metrics.
 * Shows coverage from foundation words specifically.
 */
function getFoundationCoverage() {
  var totalOcc = getTotalQuranOccurrences();
  var mastered = getMasteredWordIds();
  var fWords = getAllFoundationWords();
  
  var fMastered = 0;
  var fMasteredOcc = 0;
  var fTotalOcc = 0;
  
  for (var fi = 0; fi < fWords.length; fi++) {
    var w = fWords[fi];
    fTotalOcc += w.occ || 0;
    if (mastered[w.id]) {
      fMastered++;
      fMasteredOcc += w.occ || 0;
    }
  }
  
  var fCoveragePct = totalOcc > 0 ? (fMasteredOcc / totalOcc * 100) : 0;
  var fProgressPct = fWords.length > 0 ? (fMastered / fWords.length * 100) : 0;
  
  return {
    totalFoundationWords: fWords.length,
    masteredFoundationWords: fMastered,
    totalFoundationOccurrences: fTotalOcc,
    masteredFoundationOccurrences: fMasteredOcc,
    foundationCoveragePercent: Math.round(fCoveragePct * 10) / 10,
    foundationProgressPercent: Math.round(fProgressPct),
    totalQuranOccurrences: totalOcc,
  };
}

/**
 * Get the coverage gained from completing a specific foundation lesson.
 */
function getFoundationLessonCoverage(lessonIndex) {
  if (!FOUNDATION_LESSONS || !FOUNDATION_LESSONS[lessonIndex]) return 0;
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  // Parse the coverage string (e.g. "8.3%") to number
  var covStr = lesson.lessonCoverage;
  var num = parseFloat(covStr) || 0;
  return num;
}

/**
 * Surah Comprehension: Calculate estimated comprehension for every surah
 * based on which vocabulary words appearing in that surah are mastered.
 */
function getSurahComprehension(surahId) {
  if (!surahId) return null;
  var words = getSurahWords(surahId);
  if (!words || words.length === 0) return null;
  
  var mastered = getMasteredWordIds();
  var totalWords = words.length;
  var masteredInSurah = 0;
  var totalOccInSurah = 0;
  var masteredOccInSurah = 0;
  
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var occ = w.occ || 0;
    totalOccInSurah += occ;
    if (mastered[w.id]) {
      masteredInSurah++;
      masteredOccInSurah += occ;
    }
  }
  
  // Comprehension estimate based on vocabulary coverage in this surah
  var wordCoverage = totalWords > 0 ? (masteredInSurah / totalWords * 100) : 0;
  var occCoverage = totalOccInSurah > 0 ? (masteredOccInSurah / totalOccInSurah * 100) : 0;
  
  // Estimated comprehension: weighted average of word count and occurrence coverage
  var comprehension = (wordCoverage * 0.4 + occCoverage * 0.6);
  comprehension = Math.round(Math.min(100, comprehension));
  
  return {
    surahId: surahId,
    totalWords: totalWords,
    masteredWords: masteredInSurah,
    totalOccurrences: totalOccInSurah,
    masteredOccurrences: masteredOccInSurah,
    wordCoveragePercent: Math.round(wordCoverage * 10) / 10,
    occurrenceCoveragePercent: Math.round(occCoverage * 10) / 10,
    estimatedComprehension: comprehension,
  };
}

/**
 * Get comprehension for all surahs.
 */
function getAllSurahComprehension() {
  var surahIds = getSurahsWithVocabulary();
  var results = [];
  for (var si = 0; si < surahIds.length; si++) {
    var comp = getSurahComprehension(surahIds[si]);
    if (comp) results.push(comp);
  }
  return results;
}

/**
 * Coverage Milestones with celebration data.
 */
const COVERAGE_MILESTONES = [
  { pct: 5, label: 'First Steps', icon: '🌱', insight: 'You can recognize 1 in 20 words! Every word builds your foundation.' },
  { pct: 10, label: 'Building Blocks', icon: '🧱', insight: '1 in 10 words familiar! You\'re starting to see patterns in the text.' },
  { pct: 20, label: 'Growing Strong', icon: '🌿', insight: '1 in 5 words known! Short verses become recognizable.' },
  { pct: 30, label: 'Solid Foundation', icon: '🏗️', insight: 'Nearly 1 in 3 words! You can grasp the topic of many verses.' },
  { pct: 40, label: 'Halfway There', icon: '🔥', insight: '2 in 5 words! You can follow the flow of longer passages.' },
  { pct: 50, label: 'Major Milestone', icon: '⭐', insight: 'Half the words! You understand key concepts across the Quran.' },
  { pct: 60, label: 'Strong Reader', icon: '📖', insight: '3 in 5 words! With tafsir, you can study most verses.' },
  { pct: 70, label: 'Advanced', icon: '🎯', insight: '7 in 10 words! Only specialized vocabulary remains unfamiliar.' },
  { pct: 80, label: 'Near Complete', icon: '👑', insight: '4 in 5 words! You have working knowledge of almost the entire Quranic vocabulary.' },
  { pct: 90, label: 'Expert Level', icon: '🏆', insight: '9 in 10 words! You can read with deep understanding.' },
  { pct: 95, label: 'Mastery', icon: '💎', insight: 'Only the rarest words remain. You are among the few.' },
  { pct: 100, label: 'Quran Complete', icon: '🌟', insight: 'All vocabulary mastered! The Quran is now open to you.' },
];

/**
 * Get the current milestone and next milestone based on coverage.
 */
function getMilestoneStatus(coveragePercent) {
  var currentMilestone = null;
  var nextMilestone = null;
  
  for (var mi = 0; mi < COVERAGE_MILESTONES.length; mi++) {
    if (coveragePercent >= COVERAGE_MILESTONES[mi].pct) {
      currentMilestone = COVERAGE_MILESTONES[mi];
    } else {
      nextMilestone = COVERAGE_MILESTONES[mi];
      break;
    }
  }
  
  var wordsToNext = 0;
  var lessonsToNext = 0;
  
  if (nextMilestone) {
    // Estimate words needed: each word adds roughly its occurrence count to coverage
    var neededCoverage = nextMilestone.pct - coveragePercent;
    var totalOcc = getTotalQuranOccurrences();
    var neededOccurrences = Math.ceil((neededCoverage / 100) * totalOcc);
    var avgOccPerFoundationWord = totalOcc > 0 && FOUNDATION_WORDS.length > 0
      ? getTotalFoundationOccurrences() / FOUNDATION_WORDS.length
      : 100;
    wordsToNext = Math.ceil(neededOccurrences / avgOccPerFoundationWord);
    lessonsToNext = Math.ceil(wordsToNext / FOUNDATION_WORDS_PER_LESSON);
  }
  
  return {
    currentMilestone: currentMilestone,
    nextMilestone: nextMilestone,
    wordsToNextMilestone: wordsToNext,
    lessonsToNextMilestone: lessonsToNext,
  };
}

function getTotalFoundationOccurrences() {
  var fWords = getAllFoundationWords();
  var total = 0;
  for (var fi = 0; fi < fWords.length; fi++) {
    total += fWords[fi].occ || 0;
  }
  return total;
}

/**
 * Track root families mastered.
 */
function getRootFamilyMastery() {
  var mastered = getMasteredWordIds();
  var allCanonical = typeof getCanonicalWords === 'function' ? getCanonicalWords() : ALL_WORDS;
  var rootGroups = {};
  var masteredRoots = {};
  
  for (var ri = 0; ri < allCanonical.length; ri++) {
    var w = allCanonical[ri];
    if (!w.root || w.root === '—') continue;
    if (!rootGroups[w.root]) rootGroups[w.root] = { total: 0, mastered: 0, rootMeaning: w.rootMeaning };
    rootGroups[w.root].total++;
    if (mastered[w.id]) {
      rootGroups[w.root].mastered++;
    }
  }
  
  var totalRoots = Object.keys(rootGroups).length;
  var fullyMasteredRoots = 0;
  var partiallyMasteredRoots = 0;
  
  Object.keys(rootGroups).forEach(function(root) {
    var g = rootGroups[root];
    if (g.mastered === g.total) {
      fullyMasteredRoots++;
      masteredRoots[root] = 'complete';
    } else if (g.mastered > 0) {
      partiallyMasteredRoots++;
      masteredRoots[root] = 'partial';
    }
  });
  
  return {
    totalRoots: totalRoots,
    fullyMasteredRoots: fullyMasteredRoots,
    partiallyMasteredRoots: partiallyMasteredRoots,
  };
}

/**
 * Calculate coverage growth over time by analyzing completed lessons.
 */
function getCoverageGrowth() {
  var progress = loadFoundationProgress();
  var completed = progress.completedLessons || [];
  var growth = [];
  var totalOcc = getTotalQuranOccurrences();
  var cumulativeOcc = 0;
  
  // Sort completed lessons
  var sorted = completed.slice().sort(function(a, b) { return a - b; });
  
  for (var gi = 0; gi < sorted.length; gi++) {
    var lessonIdx = sorted[gi];
    if (FOUNDATION_LESSONS[lessonIdx]) {
      var lessonCov = parseFloat(FOUNDATION_LESSONS[lessonIdx].lessonCoverage) || 0;
      cumulativeOcc += Math.round((lessonCov / 100) * totalOcc);
      growth.push({
        lesson: lessonIdx + 1,
        coverage: Math.round(((lessonCov / 100) * totalOcc) / totalOcc * 100 * 10) / 10,
        cumulativeCoverage: totalOcc > 0 ? Math.round(cumulativeOcc / totalOcc * 100 * 10) / 10 : 0,
      });
    }
  }
  
  return growth;
}

// ── Rich Lesson Summary Data ─────────────────────────────────────

/**
 * Create a rich lesson summary after completing a foundation lesson.
 */
function createLessonSummary(lessonIndex, quizCorrect, quizTotal, timeStudiedMs) {
  if (!FOUNDATION_LESSONS[lessonIndex]) return null;
  
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = getFoundationLessonWords(lessonIndex);
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  
  var newWords = 0;
  var reviewWords = 0;
  var rootFamiliesInLesson = {};
  
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var entry = srsData[w.id];
    if (!entry || entry.totalReviews <= 1) {
      newWords++;
    } else {
      reviewWords++;
    }
    if (w.root && w.root !== '—') {
      rootFamiliesInLesson[w.root] = (rootFamiliesInLesson[w.root] || 0) + 1;
    }
  }
  
  // Coverage before completing this lesson (excluding this lesson's words)
  var coveredBefore = 0;
  var masteredBefore = getMasteredWordIds();
  var wordsBeforeOcc = 0;
  for (var bi = 0; bi < words.length; bi++) {
    if (masteredBefore[words[bi].id]) {
      coveredBefore += words[bi].occ || 0;
    }
  }
  
  var totalOcc = getTotalQuranOccurrences();
  var coverageBefore = totalOcc > 0 ? Math.round((coveredBefore / totalOcc) * 100 * 10) / 10 : 0;
  var covFromLesson = parseFloat(lesson.lessonCoverage) || 0;
  var coverageAfter = Math.min(100, coverageBefore + covFromLesson);
  var accuracy = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  
  return {
    lessonIndex: lessonIndex,
    lessonNumber: lessonIndex + 1,
    isReview: lesson.isReview,
    newWords: newWords,
    reviewWords: reviewWords,
    totalWords: words.length,
    accuracy: accuracy,
    quizCorrect: quizCorrect,
    quizTotal: quizTotal,
    timeStudiedMs: timeStudiedMs || 0,
    rootFamiliesIntroduced: Object.keys(rootFamiliesInLesson).length,
    rootFamilyDetails: rootFamiliesInLesson,
    coverageBefore: coverageBefore,
    coverageAfter: coverageAfter,
    coverageGained: Math.round(covFromLesson * 10) / 10,
    nextLessonPreview: lessonIndex + 1 < FOUNDATION_LESSONS.length
      ? {
          number: lessonIndex + 2,
          label: FOUNDATION_LESSONS[lessonIndex + 1].label,
          estimatedCoverageGain: parseFloat(FOUNDATION_LESSONS[lessonIndex + 1].lessonCoverage) || 0,
        }
      : null,
  };
}


function isFoundationLessonCompleted(lessonIndex) {
  var progress = loadFoundationProgress();
  return progress.completedLessons.indexOf(lessonIndex) >= 0;
}

function isFoundationLessonUnlocked(lessonIndex) {
  if (lessonIndex === 0) return true;
  return isFoundationLessonCompleted(lessonIndex - 1);
}

function getNextIncompleteFoundationLesson() {
  var total = getFoundationLessonCount();
  for (var i = 0; i < total; i++) {
    if (!isFoundationLessonCompleted(i)) return i;
  }
  return 0;
}

function completeFoundationLesson(lessonIndex) {
  var progress = loadFoundationProgress();
  if (progress.completedLessons.indexOf(lessonIndex) < 0) {
    progress.completedLessons.push(lessonIndex);
  }
  progress.quizPassed[String(lessonIndex)] = true;
  var next = getNextIncompleteFoundationLesson();
  progress.currentLesson = next;
  saveFoundationProgress(progress);
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function getCurrentFoundationLessonIndex() {
  var progress = loadFoundationProgress();
  return progress.currentLesson;
}

function setCurrentFoundationLesson(lessonIndex) {
  var total = getFoundationLessonCount();
  if (lessonIndex < 0 || lessonIndex >= total) return;
  var progress = loadFoundationProgress();
  progress.currentLesson = lessonIndex;
  saveFoundationProgress(progress);
}

function getCompletedFoundationLessonCount() {
  var progress = loadFoundationProgress();
  return progress.completedLessons.length;
}

function exportFoundationProgress() {
  return loadFoundationProgress();
}

function importFoundationProgress(data) {
  if (!data || typeof data !== 'object') return;
  var current = loadFoundationProgress();
  if (data.completedLessons && data.completedLessons.length > current.completedLessons.length) {
    current.completedLessons = data.completedLessons;
  }
  if (data.quizPassed) {
    Object.keys(data.quizPassed).forEach(function(k) {
      if (data.quizPassed[k]) current.quizPassed[k] = true;
    });
  }
  if (data.currentLesson !== undefined && data.currentLesson < current.currentLesson) {
    current.currentLesson = data.currentLesson;
  } else if (data.currentLesson !== undefined && !current.currentLesson) {
    current.currentLesson = data.currentLesson;
  }
  saveFoundationProgress(current);
}

// ── Lesson System ───────────────────────────────────────────────
// Lessons are computed from ALL_WORDS after all data files load.
// Each lesson contains WORDS_PER_LESSON words, except the last.

/** @type {Array<{id:number, label:string, start:number, end:number}>} */
let LESSONS = [];

/**
 * Build the LESSONS array from ALL_WORDS (or CANONICAL_WORDS if available).
 * Call this once after all word files have been loaded.
 */
function buildLessons() {
  // Ensure all words have IDs before building lessons
  assignWordIds();
  
  // Build canonical vocabulary (deduplicate)
  deduplicateVocabulary();
  
  // Build Foundation Course from canonical words
  buildFoundationCourse();
  
  // Use canonical words for lessons if available, otherwise raw ALL_WORDS
  var wordPool = CANONICAL_WORDS.length > 0 ? CANONICAL_WORDS : ALL_WORDS;
  
  LESSONS = [];
  var total = wordPool.length;
  if (total === 0) return;
  var lessonNum = 1;
  for (var i = 0; i < total; i += WORDS_PER_LESSON) {
    var end = Math.min(i + WORDS_PER_LESSON, total);
    LESSONS.push({
      id: lessonNum,
      label: 'Lesson ' + lessonNum,
      start: i,
      end: end,
      wordCount: end - i,
    });
    lessonNum++;
  }
  
  console.log('[lessons] Built ' + LESSONS.length + ' lessons from ' + total + ' canonical words.');
}

/**
 * Get the words for a specific lesson index (0-based).
 * Returns canonical words.
 */
function getLessonWords(lessonIndex) {
  if (!LESSONS || LESSONS.length === 0) return [];
  if (lessonIndex < 0 || lessonIndex >= LESSONS.length) return [];
  var lesson = LESSONS[lessonIndex];
  var wordPool = CANONICAL_WORDS.length > 0 ? CANONICAL_WORDS : ALL_WORDS;
  return wordPool.slice(lesson.start, lesson.end);
}

/**
 * Get the total number of lessons.
 */
function getLessonCount() {
  return LESSONS.length;
}

// ── Lesson Progress (localStorage) ─────────────────────────────

const LESSON_PROGRESS_KEY = 'quran_lesson_progress';

function getDefaultLessonProgress() {
  return {
    currentLesson: 0,        // 0-based index of the active lesson
    completedLessons: [],     // array of 0-based lesson indices that are finished
    quizPassed: {},           // { "0": true, "1": false, ... }
  };
}

function loadLessonProgress() {
  try {
    var raw = localStorage.getItem(LESSON_PROGRESS_KEY);
    if (!raw) return getDefaultLessonProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultLessonProgress();
  }
}

function saveLessonProgress(data) {
  try {
    localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save lesson progress:', e.message);
  }
}

/**
 * Check if a lesson is completed (quiz passed).
 */
function isLessonCompleted(lessonIndex) {
  var progress = loadLessonProgress();
  return progress.completedLessons.indexOf(lessonIndex) >= 0;
}

/**
 * Check if a lesson is unlocked (previous lesson completed, or first lesson).
 */
function isLessonUnlocked(lessonIndex) {
  if (lessonIndex === 0) return true;
  return isLessonCompleted(lessonIndex - 1);
}

/**
 * Get the next incomplete lesson index.
 */
function getNextIncompleteLesson() {
  var total = getLessonCount();
  for (var i = 0; i < total; i++) {
    if (!isLessonCompleted(i)) return i;
  }
  return 0; // all completed — stay on first
}

/**
 * Mark a lesson as completed (quiz passed).
 */
function completeLesson(lessonIndex) {
  var progress = loadLessonProgress();
  if (progress.completedLessons.indexOf(lessonIndex) < 0) {
    progress.completedLessons.push(lessonIndex);
  }
  progress.quizPassed[String(lessonIndex)] = true;
  // Advance current lesson to next incomplete
  var next = getNextIncompleteLesson();
  progress.currentLesson = next;
  saveLessonProgress(progress);
  // Queue cloud sync
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

/**
 * Get the current lesson index (0-based).
 */
function getCurrentLessonIndex() {
  var progress = loadLessonProgress();
  return progress.currentLesson;
}

/**
 * Set the current lesson index.
 */
function setCurrentLesson(lessonIndex) {
  var total = getLessonCount();
  if (lessonIndex < 0 || lessonIndex >= total) return;
  var progress = loadLessonProgress();
  progress.currentLesson = lessonIndex;
  saveLessonProgress(progress);
}

/**
 * Get the overall lesson completion count.
 */
function getCompletedLessonCount() {
  var progress = loadLessonProgress();
  return progress.completedLessons.length;
}

/**
 * Export lesson progress for cloud sync.
 */
function exportLessonProgress() {
  return loadLessonProgress();
}

/**
 * Import lesson progress from cloud sync.
 */
function importLessonProgress(data) {
  if (!data || typeof data !== 'object') return;
  var current = loadLessonProgress();
  // Merge: take higher completed count (more progress)
  if (data.completedLessons && data.completedLessons.length > current.completedLessons.length) {
    current.completedLessons = data.completedLessons;
  }
  if (data.quizPassed) {
    Object.keys(data.quizPassed).forEach(function (k) {
      if (data.quizPassed[k]) current.quizPassed[k] = true;
    });
  }
  // Take earlier current lesson as hint (more conservative)
  if (data.currentLesson !== undefined && data.currentLesson < current.currentLesson) {
    current.currentLesson = data.currentLesson;
  } else if (data.currentLesson !== undefined && !current.currentLesson) {
    current.currentLesson = data.currentLesson;
  }
  saveLessonProgress(current);
}

// ── Surah Progress Tracking ─────────────────────────────────────

const SURAH_PROGRESS_KEY = 'quran_surah_progress';

function getDefaultSurahProgress() {
  return {
    completedSurahs: [],
    quizPassed: {},
  };
}

function loadSurahProgress() {
  try {
    var raw = localStorage.getItem(SURAH_PROGRESS_KEY);
    if (!raw) return getDefaultSurahProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultSurahProgress();
  }
}

function saveSurahProgress(data) {
  try {
    localStorage.setItem(SURAH_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save surah progress:', e.message);
  }
}

function isSurahCompleted(surahId) {
  var progress = loadSurahProgress();
  return progress.completedSurahs.indexOf(surahId) >= 0;
}

function completeSurah(surahId) {
  var progress = loadSurahProgress();
  if (progress.completedSurahs.indexOf(surahId) < 0) {
    progress.completedSurahs.push(surahId);
  }
  progress.quizPassed[String(surahId)] = true;
  saveSurahProgress(progress);
  // Queue cloud sync
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function getCompletedSurahCount() {
  var progress = loadSurahProgress();
  return progress.completedSurahs.length;
}

function exportSurahProgress() {
  return loadSurahProgress();
}

function importSurahProgress(data) {
  if (!data || typeof data !== 'object') return;
  var current = loadSurahProgress();
  if (data.completedSurahs && data.completedSurahs.length > current.completedSurahs.length) {
    current.completedSurahs = data.completedSurahs;
  }
  if (data.quizPassed) {
    Object.keys(data.quizPassed).forEach(function (k) {
      if (data.quizPassed[k]) current.quizPassed[k] = true;
    });
  }
  saveSurahProgress(current);
}
