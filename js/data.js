// ═══════════════════════════════════════════════════════════════
// ⚠ NOTE: This file is no longer loaded by the build process.
// The data layer has been split into focused modules in
//   js/data-core/
//   ├── vocab-data.js        — Core vocabulary setup
//   ├── surah-org.js         — Surah-based organization
//   ├── foundation.js        — Foundation Course
//   ├── lesson-system.js     — Lesson system & learning paths
//   ├── progress-aggregator.js — Learning path progress aggregator
//   ├── adaptive.js          — Adaptive learning engine
//   ├── quiz-history.js      — Quiz history tracking
//   └── surah-progress.js    — Surah completion tracking
//
// Edit the modules above instead of this file.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// data.js — Bayan Quranic Vocabulary Data Schema & Constants
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
//   contrastWords  — Array of arabic texts of Quranic contrast pairs (e.g. جنة ↔ نار)
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

// ── Surah-based Organization ────────────────────────────────────
// Words can be organized by Surah (surahId) or by sequential lessons.
// The system supports both modes: users can study by Surah or by
// traditional sequential lessons.

/** @type {'surah'|'lesson'|'foundation'} Current organization mode */
let _orgMode = 'lesson';

/**
 * Set the organization mode.
 */
function setOrganizationMode(mode) {
  if (mode === 'surah' || mode === 'lesson' || mode === 'foundation' || mode === 'root-family' || mode === 'difficulty') {
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
    
    // Compute comprehension projection for educational display
    var lessonCoverageNum = totalOcc > 0 ? (lessonOcc / totalOcc * 100) : 0;
    var cumulativeCoverageNum = totalOcc > 0 ? (cumulativeOcc / totalOcc * 100) : 0;
    var curComprehensionNum = cumulativeCoverageNum > 0 && cumulativeCoverageNum > lessonCoverageNum
      ? Math.min(95, Math.round(1.3 * Math.pow(Math.max(0, cumulativeCoverageNum - lessonCoverageNum), 0.7) * 10) / 10)
      : 0;
    var projComprehensionNum = cumulativeCoverageNum > 0
      ? Math.min(95, Math.round(1.3 * Math.pow(cumulativeCoverageNum, 0.7) * 10) / 10)
      : 0;
    var wordsRemaining = FOUNDATION_WORDS_PER_LESSON * (FOUNDATION_LESSON_COUNT - li - 1);
    
    // Thematic titles and context for each lesson
    var thematicTitles = [
      'The Essential Framework',
      'Core Quranic Verbs',
      'Divine Descriptions',
      'Key Particles & Ideas',
      'Review & Consolidation I',
      'Humanity & Faith',
      'Prophets & Revelation',
      'Judgment & Afterlife',
      'Advanced Quranic Terms',
      'Review & Mastery II',
    ];
    var lessonContexts = [
      'These are the most frequent words in the Quran. Mastering them unlocks the basic structure of every verse.',
      'These verbs and nouns appear hundreds of times. Understanding them transforms how you read passages about creation and faith.',
      'These words describe divine attributes, actions, and the relationship between Creator and creation.',
      'These particles connect Quranic ideas. They appear in nearly every verse and are essential for sentence structure.',
      'Review and reinforce the first 50 words. Strengthen your recall before the next tier of vocabulary.',
      'These words introduce key concepts about human nature, faith, and the purpose of life in the Quran.',
      'Vocabulary related to prophets, revelation, and the stories carrying the core message of the Quran.',
      'Words describing the Hereafter, judgment, and consequences of human actions — central Quranic themes.',
      'Nuanced vocabulary about knowledge, patience, and deeper spiritual concepts from the Quran.',
      'Final review of all 100 foundation words. After this you recognize ~84% of all Quranic word occurrences.',
    ];
    
    FOUNDATION_LESSONS.push({
      id: lessonNum,
      label: isReview ? 'Review ' + lessonNum : 'Foundation ' + lessonNum,
      thematicTitle: thematicTitles[li] || 'Foundation ' + lessonNum,
      lessonContext: lessonContexts[li] || '',
      start: start,
      end: end,
      wordCount: end - start,
      wordIds: wordIds,
      lessonCoverage: totalOcc > 0 ? lessonCoverageNum.toFixed(1) + '%' : '0%',
      cumulativeCoverage: totalOcc > 0 ? cumulativeCoverageNum.toFixed(1) + '%' : '0%',
      lessonCoverageNum: lessonCoverageNum,
      cumulativeCoverageNum: cumulativeCoverageNum,
      comprehensionGain: Math.round((projComprehensionNum - curComprehensionNum) * 10) / 10,
      projectedComprehension: projComprehensionNum,
      remainingAfterLesson: Math.max(0, wordsRemaining),
      isReview: isReview,
    });
  }
  
  console.log('[foundation] Built ' + FOUNDATION_LESSONS.length + ' foundation lessons from ' +
    FOUNDATION_WORDS.length + ' words. Covers ' +
    (totalOcc > 0 ? (totalFoundOcc / totalOcc * 100).toFixed(1) : '0') + '% of Quranic occurrences.');
  
  // Phase 2: Enrich canonical words with computed metadata using foundation course data
  enrichCanonicalMetadata(sorted, FOUNDATION_WORDS, totalOcc);
}

// ═══════════════════════════════════════════════════════════════
// ENRICHED CANONICAL METADATA — Frequency Analytics & Priority
//
// After foundation course is built, every canonical word gets:
//   frequencyRank     — Position when sorted by occ descending (1 = most frequent)
//   frequencyPercentile — Percentile rank (what % of words are less frequent)
//   learningPriority    — 1-5 priority based on frequency + difficulty
//   foundationLessonId  — Foundation lesson index, or -1 if not in foundation
//   firstOccurrence     — First verse this word appears in
//   lastOccurrence      — Last verse this word appears in
//   surahCount          — Number of surahs containing this word
// ═══════════════════════════════════════════════════════════════

/** Total Quranic occurrences across all canonical words (set during foundation build) */
let TOTAL_QURAN_OCCURRENCES = 0;

/**
 * Enrich canonical words with computed metadata.
 * Called once from buildFoundationCourse() after foundation is built.
 * Must be called after FOUNDATION_WORDS is populated.
 */
function enrichCanonicalMetadata(sortedByFreq, foundationWordIds, totalOcc) {
  if (!CANONICAL_WORDS || CANONICAL_WORDS.length === 0) return;
  TOTAL_QURAN_OCCURRENCES = totalOcc;
  
  // Build a lookup from canonical ID to foundation lesson index
  var foundationLessonMap = {};
  for (var fwi = 0; fwi < foundationWordIds.length; fwi++) {
    foundationLessonMap[foundationWordIds[fwi]] = Math.floor(fwi / FOUNDATION_WORDS_PER_LESSON);
  }
  
  // Build a sorted-by-frequency index for each canonical word
  var freqRankMap = {};
  for (var fi = 0; fi < sortedByFreq.length; fi++) {
    freqRankMap[sortedByFreq[fi].id] = fi + 1; // 1-based rank
  }
  
  var totalWords = CANONICAL_WORDS.length;
  
  for (var ci = 0; ci < totalWords; ci++) {
    var w = CANONICAL_WORDS[ci];
    
    // Frequency rank (1 = most frequent)
    var rank = freqRankMap[w.id] || totalWords;
    w.frequencyRank = rank;
    
    // Frequency percentile (what % of words this is more frequent than)
    w.frequencyPercentile = totalWords > 0 
      ? Math.round((1 - rank / totalWords) * 1000) / 10 
      : 0;
    
    // Learning priority: 1 (highest) to 5 (lowest)
    // Combines frequency rank (weighted 60%) and difficulty (weighted 40%)
    var normalizedRank = rank / totalWords; // 0 (most frequent) to 1 (least)
    var normalizedDifficulty = (w.difficulty || 3) / 5; // 0.2 (easiest) to 1 (hardest)
    var priorityScore = (normalizedRank * 0.6 + normalizedDifficulty * 0.4);
    // Map to 1-5 (lower score = higher priority = closer to 1)
    if (priorityScore < 0.15) w.learningPriority = 1;
    else if (priorityScore < 0.30) w.learningPriority = 2;
    else if (priorityScore < 0.50) w.learningPriority = 3;
    else if (priorityScore < 0.70) w.learningPriority = 4;
    else w.learningPriority = 5;
    
    // Foundation lesson assignment
    if (foundationLessonMap[w.id] !== undefined) {
      w.foundationLessonId = foundationLessonMap[w.id];
    } else {
      w.foundationLessonId = -1;
    }
    
    // First and last occurrence (based on surahId)
    w.surahCount = w.surahIds ? w.surahIds.length : 0;
    
    // First occurrence: earliest surah:verse
    if (w.occurrences && w.occurrences.length > 0) {
      var firstOcc = null;
      var lastOcc = null;
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        var o = w.occurrences[oi];
        if (o.surahId && o.verseKey) {
          if (!firstOcc || o.surahId < firstOcc.surahId || (o.surahId === firstOcc.surahId && parseInt(o.verseKey.split(':')[1] || '0') < parseInt(firstOcc.verseKey.split(':')[1] || '0'))) {
            firstOcc = { surahId: o.surahId, verseKey: o.verseKey };
          }
          if (!lastOcc || o.surahId > lastOcc.surahId || (o.surahId === lastOcc.surahId && parseInt(o.verseKey.split(':')[1] || '0') > parseInt(lastOcc.verseKey.split(':')[1] || '0'))) {
            lastOcc = { surahId: o.surahId, verseKey: o.verseKey };
          }
        }
      }
      w.firstOccurrence = firstOcc ? firstOcc.verseKey : '';
      w.lastOccurrence = lastOcc ? lastOcc.verseKey : '';
    } else {
      w.firstOccurrence = '';
      w.lastOccurrence = '';
    }
  }
  
  console.log('[metadata] Enriched ' + totalWords + ' canonical words with frequency rank, learning priority, first/last occurrence, and foundation lesson mapping.');
}

/**
 * Get the learning priority label for a word.
 */
function getLearningPriorityLabel(priority) {
  var labels = {
    1: 'Essential',
    2: 'High Priority',
    3: 'Medium Priority',
    4: 'Low Priority',
    5: 'Supplementary',
  };
  return labels[priority] || 'Unknown';
}

/**
 * Get all canonical words sorted by learning priority (highest first).
 */
function getWordsByPriority() {
  var words = getCanonicalWords();
  return words.slice().sort(function(a, b) {
    return (a.learningPriority || 5) - (b.learningPriority || 5);
  });
}

/**
 * Get the canonical word with the highest frequency rank (most common word).
 */
function getMostFrequentWord() {
  var words = getCanonicalWords();
  var best = null;
  var bestFreq = 0;
  for (var mi = 0; mi < words.length; mi++) {
    if (words[mi].occ > bestFreq) {
      bestFreq = words[mi].occ;
      best = words[mi];
    }
  }
  return best;
}

/**
 * Get the frequency rank of a canonical word (1 = most frequent).
 */
function getFrequencyRank(word) {
  if (word.frequencyRank !== undefined) return word.frequencyRank;
  return null;
}

/**
 * Get the learning priority of a canonical word (1-5).
 */
function getLearningPriority(word) {
  if (word.learningPriority !== undefined) return word.learningPriority;
  return 3;
}

/**
 * Get words sorted by frequency rank (most frequent first).
 */
function getWordsByFrequency() {
  var words = getCanonicalWords();
  return words.slice().sort(function(a, b) {
    return (a.frequencyRank || 9999) - (b.frequencyRank || 9999);
  });
}

// ── Foundation Course Relationship Context ─────────────────────
// Functions that connect foundation lessons to the broader
// vocabulary relationship network. These help learners understand
// how foundation words relate to each other and to future vocabulary.

/**
 * Get root families introduced in a specific foundation lesson.
 * Returns an array of { root, rootMeaning, words: [arabic, english, ...] }
 */
function getFoundationLessonRoots(lessonIndex) {
  var words = getFoundationLessonWords(lessonIndex);
  var rootMap = {};
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    if (!w.root || w.root === '—') continue;
    if (!rootMap[w.root]) {
      rootMap[w.root] = { root: w.root, rootMeaning: w.rootMeaning, words: [] };
    }
    rootMap[w.root].words.push({ arabic: w.arabic, english: w.english, wordId: w.id });
  }
  var result = [];
  Object.keys(rootMap).forEach(function(r) { result.push(rootMap[r]); });
  return result;
}

/**
 * For a given foundation lesson, find related words from other foundation
 * lessons (already learned or coming up).
 */
function getFoundationLessonRelationshipContext(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) {
    return { alreadyLearnedRelated: [], upcomingRelated: [], rootFamilies: [] };
  }
  
  var currentWords = getFoundationLessonWords(lessonIndex);
  var allFoundationWords = getAllFoundationWords();
  
  // Get all root sets mentioned in this lesson
  var currentRoots = {};
  for (var ci = 0; ci < currentWords.length; ci++) {
    var cw = currentWords[ci];
    if (cw.root && cw.root !== '—') currentRoots[cw.root] = true;
  }
  
  var alreadyLearned = [];
  var upcoming = [];
  var completedLessons = typeof loadFoundationProgress === 'function' 
    ? loadFoundationProgress().completedLessons 
    : [];
  
  // Scan all foundation words for same-root connections
  for (var fi = 0; fi < allFoundationWords.length; fi++) {
    var fw = allFoundationWords[fi];
    
    // Skip current lesson words
    var foundInCurrent = false;
    for (var sj = 0; sj < currentWords.length; sj++) {
      if (currentWords[sj].id === fw.id) { foundInCurrent = true; break; }
    }
    if (foundInCurrent) continue;
    
    // Check if this word shares a root with a current lesson word
    var sharesRoot = fw.root && fw.root !== '—' && currentRoots[fw.root];
    if (!sharesRoot) continue;
    
    // Find which lesson this word belongs to
    var wordLesson = -1;
    for (var li = 0; li < FOUNDATION_LESSONS.length; li++) {
      if (FOUNDATION_LESSONS[li].wordIds.indexOf(fw.id) >= 0) {
        wordLesson = li;
        break;
      }
    }
    
    var isAlreadyLearned = completedLessons.indexOf(wordLesson) >= 0;
    var isUpcoming = !isAlreadyLearned && wordLesson >= 0 && wordLesson !== lessonIndex;
    
    if (isAlreadyLearned) {
      alreadyLearned.push({ arabic: fw.arabic, english: fw.english, wordId: fw.id, lessonId: wordLesson });
    } else if (isUpcoming) {
      upcoming.push({ arabic: fw.arabic, english: fw.english, wordId: fw.id, lessonId: wordLesson });
    }
  }
  
  return {
    alreadyLearnedRelated: alreadyLearned,
    upcomingRelated: upcoming,
    rootFamilies: getFoundationLessonRoots(lessonIndex),
  };
}

/**
 * Get the foundation lesson index for a given canonical word, or -1 if not in foundation.
 */
function getFoundationLessonForWord(canonicalWordId) {
  if (!FOUNDATION_WORDS || FOUNDATION_WORDS.length === 0) return -1;
  var idx = FOUNDATION_WORDS.indexOf(canonicalWordId);
  if (idx < 0) return -1;
  return Math.floor(idx / FOUNDATION_WORDS_PER_LESSON);
}

/**
 * Get aggregate foundation relationship statistics.
 */
function getFoundationRelationshipStats() {
  var totalWithRoots = 0;
  var totalRootFamilies = 0;
  var totalCrossLessonConnections = 0;
  var rootSet = {};
  
  var fWords = getAllFoundationWords();
  for (var fi = 0; fi < fWords.length; fi++) {
    var w = fWords[fi];
    if (w.root && w.root !== '—') {
      rootSet[w.root] = (rootSet[w.root] || 0) + 1;
      totalWithRoots++;
    }
  }
  
  totalRootFamilies = Object.keys(rootSet).length;
  
  // Count cross-lesson root connections
  for (var ri = 0; ri < FOUNDATION_LESSONS.length; ri++) {
    var lessonWords = getFoundationLessonWords(ri);
    var lessonRoots = {};
    for (var wi = 0; wi < lessonWords.length; wi++) {
      if (lessonWords[wi].root && lessonWords[wi].root !== '—') {
        lessonRoots[lessonWords[wi].root] = true;
      }
    }
    // Check if any other lesson has same root
    for (var rj = 0; rj < FOUNDATION_LESSONS.length; rj++) {
      if (rj === ri) continue;
      var otherWords = getFoundationLessonWords(rj);
      for (var wi2 = 0; wi2 < otherWords.length; wi2++) {
        if (otherWords[wi2].root && lessonRoots[otherWords[wi2].root]) {
          totalCrossLessonConnections++;
        }
      }
    }
  }
  
  return {
    totalFoundationWords: fWords.length,
    totalWithRoots: totalWithRoots,
    uniqueRootFamilies: totalRootFamilies,
    crossLessonConnections: totalCrossLessonConnections / 2, // each counted twice
  };
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

/** Cached coverage result */
let _coverageCache = null;

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
  
  var result = {
    totalOccurrences: totalOcc,
    masteredWords: masteredCount,
    totalWords: totalWords,
    masteredOccurrences: masteredOcc,
    coveragePercent: Math.round(coveragePct * 10) / 10,
    wordMasteryPercent: Math.round(wordMasteryPct * 10) / 10,
    estimatedComprehension: estimatedComprehension,
  };
  _coverageCache = result;
  return result;
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

// ═══════════════════════════════════════════════════════════════
// QURAN COMPREHENSION TRACKER — Understanding & Milestones
//
// Provides:
//   • Current comprehension percentage (estimated from occurrence coverage)
//   • Previous comprehension values (yesterday, last week, last month)
//   • Deltas (today's gain, weekly gain, monthly gain)
//   • Educational milestone messages at every key threshold
//   • Smooth animation-ready values for UI display
// ═══════════════════════════════════════════════════════════════

/**
 * Comprehension Milestones with educational explanations.
 * Each threshold explains what the learner can now do.
 */
const COMPREHENSION_MILESTONES = [
  { pct: 5, label: 'First Glimpses', icon: '🌱', insight: 'You can now recognize approximately one out of every twenty Quran words.' },
  { pct: 10, label: 'Building Blocks', icon: '🧱', insight: 'One in ten words familiar! You can begin to spot repeated vocabulary across different surahs.' },
  { pct: 15, label: 'Growing Familiarity', icon: '🌿', insight: 'You now understand enough that short verses begin to feel accessible.' },
  { pct: 20, label: 'Recognizing Patterns', icon: '📖', insight: 'One in five words is known! You can identify the topic of many verses.' },
  { pct: 25, label: 'Quarter Milestone', icon: '⭐', insight: 'You can now recognize approximately one out of every four Quran words.' },
  { pct: 30, label: 'Solid Foundation', icon: '🏗️', insight: 'Nearly one in three words familiar! You can grasp the flow of longer passages.' },
  { pct: 40, label: 'Strong Progress', icon: '🔥', insight: 'Two in five words! You can follow the structure of most verses.' },
  { pct: 50, label: 'Major Milestone', icon: '👑', insight: 'Half the words recognized! You understand key Quranic concepts directly.' },
  { pct: 60, label: 'Confident Reader', icon: '📚', insight: 'Three in five words! You can study most verses with a tafsir.' },
  { pct: 70, label: 'Advanced Understanding', icon: '🎯', insight: 'Seven in ten words! Only specialized or rare vocabulary remains unfamiliar.' },
  { pct: 80, label: 'Near Complete', icon: '💎', insight: 'Four in five words! Working knowledge of almost the entire Quranic vocabulary.' },
  { pct: 90, label: 'Expert Level', icon: '🏆', insight: 'Nine in ten words! Deep understanding of Quranic Arabic.' },
  { pct: 95, label: 'Virtually Complete', icon: '🌟', insight: 'Only the rarest words remain unfamiliar.' },
  { pct: 100, label: 'Complete Mastery', icon: '💫', insight: 'All vocabulary mastered! The Quran is now open to you.' },
];

/**
 * Get the current comprehension milestone and next milestone.
 */
function getComprehensionMilestone(comprehensionPercent) {
  var current = null;
  var next = null;
  for (var mi = 0; mi < COMPREHENSION_MILESTONES.length; mi++) {
    if (comprehensionPercent >= COMPREHENSION_MILESTONES[mi].pct) {
      current = COMPREHENSION_MILESTONES[mi];
    } else {
      next = COMPREHENSION_MILESTONES[mi];
      break;
    }
  }
  var progressToNext = 0;
  if (current && next) {
    var range = next.pct - current.pct;
    var achieved = comprehensionPercent - current.pct;
    progressToNext = range > 0 ? Math.min(100, Math.round((achieved / range) * 100)) : 0;
  } else if (current && !next) {
    progressToNext = 100;
  }
  return { current: current, next: next, progressToNext: progressToNext };
}

/**
 * Get an educational insight message for the current comprehension level.
 */
function getComprehensionInsightMessage(comprehensionPercent) {
  var milestone = getComprehensionMilestone(comprehensionPercent);
  if (milestone && milestone.current) {
    return milestone.current.insight;
  }
  return 'Start learning Quranic vocabulary to build your comprehension.';
}

/**
 * Get comprehension deltas (changes over time) from analytics history.
 */
function getComprehensionDeltas() {
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var currentValue = coverage ? coverage.estimatedComprehension : 0;
  var history = (typeof window.__analytics !== 'undefined' && window.__analytics.getHistory)
    ? window.__analytics.getHistory() : [];
  if (history.length > 0) {
    history.sort(function(a, b) { return a.date.localeCompare(b.date); });
  }
  var today = _getTodayKey();
  var yesterday = _getRelativeDateKey(-1);
  var weekAgo = _getRelativeDateKey(-7);
  var monthAgo = _getRelativeDateKey(-30);
  var yesterdayValue = 0;
  var weekAgoValue = 0;
  var monthAgoValue = 0;
  for (var hi = 0; hi < history.length; hi++) {
    var entry = history[hi];
    if (entry.date === yesterday) yesterdayValue = entry.comprehension || 0;
    if (entry.date === weekAgo || (!weekAgoValue && entry.date <= yesterday)) weekAgoValue = entry.comprehension || 0;
    if (entry.date === monthAgo || (!monthAgoValue && entry.date <= weekAgo)) monthAgoValue = entry.comprehension || 0;
  }
  return {
    currentValue: currentValue,
    yesterdayValue: yesterdayValue,
    weekAgoValue: weekAgoValue,
    monthAgoValue: monthAgoValue,
    todayChange: currentValue - yesterdayValue,
    weekChange: currentValue - weekAgoValue,
    monthChange: currentValue - monthAgoValue,
  };
}

/**
 * Format a comprehension delta as a display string.
 */
function formatComprehensionDelta(value) {
  if (value === 0) return '0';
  var sign = value > 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

/**
 * Get the full comprehension insight object for dashboard display.
 */
function getComprehensionInsight() {
  var deltas = getComprehensionDeltas();
  var milestone = getComprehensionMilestone(deltas.currentValue);
  var insightMessage = getComprehensionInsightMessage(deltas.currentValue);
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  return {
    currentValue: deltas.currentValue,
    yesterdayValue: deltas.yesterdayValue,
    weekAgoValue: deltas.weekAgoValue,
    monthAgoValue: deltas.monthAgoValue,
    todayChange: deltas.todayChange,
    weekChange: deltas.weekChange,
    monthChange: deltas.monthChange,
    milestoneCurrent: milestone.current,
    milestoneNext: milestone.next,
    progressToNextMilestone: milestone.progressToNext,
    insightMessage: insightMessage,
    masteredOccurrences: coverage ? coverage.masteredOccurrences : 0,
    totalOccurrences: coverage ? coverage.totalOccurrences : 0,
    masteredWords: coverage ? coverage.masteredWords : 0,
    totalWords: coverage ? coverage.totalWords : 0,
  };
}

/** Format a number with leading zero */
function _padDate(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** Get today's date as YYYY-MM-DD (padded, matching analytics.js format) */
function _getTodayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + _padDate(d.getMonth() + 1) + '-' + _padDate(d.getDate());
}

/** Get a date offset by offsetDays from today, as YYYY-MM-DD */
function _getRelativeDateKey(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + _padDate(d.getMonth() + 1) + '-' + _padDate(d.getDate());
}
/**
 * shown at different Foundation Course progress levels.
 * Each level has multiple messages for variety when displayed to the user.
 */
var FOUNDATION_MILESTONE_MESSAGES = [
  { pct: 0, messages: [
    'Every great journey begins with a single word. You are taking the most effective path to understanding the Quran.',
    'The 100 most frequent words make up ~84% of all word occurrences. Each lesson brings you closer.',
  ] },
  { pct: 10, messages: [
    'You now understand approximately {comprehension}% of all word occurrences. This is real, measurable progress.',
    'You are building a foundation that will serve every verse you read. Keep going!',
  ] },
  { pct: 25, messages: [
    'One quarter complete! You recognize vocabulary used in most Quranic verses.',
    'These words appear {occurrences} times throughout the Quran. You are building real comprehension.',
  ] },
  { pct: 50, messages: [
    'Halfway through the Foundation Course! You now understand approximately {comprehension}% of word occurrences.',
    'Fifty words mastered. These alone cover a significant portion of every surah you read.',
  ] },
  { pct: 75, messages: [
    'Three quarters done! Most short surahs are now accessible to you.',
    'You have mastered vocabulary from {roots} unique root families. The patterns of Arabic are becoming clear.',
  ] },
  { pct: 90, messages: [
    'The final stretch! Nearly all foundation words mastered. The Quran is opening to you.',
    'After this course, you will recognize approximately {comprehension}% of all word occurrences.',
  ] },
  { pct: 100, messages: [
    'Foundation Course Complete! You now understand approximately {comprehension}% of all word occurrences \u2014 covering ~84% of the entire Quran.',
    'You mastered the 100 most frequent Quranic words \u2014 vocabulary used thousands of times throughout the Quran.',
    'The Foundation Course has given you the essential vocabulary. Now explore surah by surah, or continue with reviews.',
  ] },
];

/**
 * Get an educational context message explaining why the current foundation lesson matters.
 * Returns an object with title, context, comprehensionGain, cumulativeMsg, totalOccurrences, rootCount.
 */
function getFoundationLessonContextMsg(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) {
    return { title: '', context: '', comprehensionGain: '', cumulativeMsg: '', totalOccurrences: 0, rootCount: 0 };
  }
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(lessonIndex) : [];
  var totalOcc = 0;
  for (var wi = 0; wi < words.length; wi++) totalOcc += words[wi].occ || 0;
  var uniqueRoots = {};
  for (var rwi = 0; rwi < words.length; rwi++) {
    if (words[rwi].root && words[rwi].root !== '\u2014') uniqueRoots[words[rwi].root] = true;
  }
  var rootCount = Object.keys(uniqueRoots).length;
  return {
    title: lesson.thematicTitle || '',
    context: lesson.lessonContext || '',
    comprehensionGain: lesson.comprehensionGain !== undefined ? '+' + lesson.comprehensionGain + '% comprehension' : '',
    cumulativeMsg: lesson.cumulativeCoverageNum
      ? 'Cumulative: ' + lesson.cumulativeCoverage + ' of Quranic occurrences'
      : '',
    totalOccurrences: totalOcc,
    rootCount: rootCount,
  };
}

/**
 * Get a meaningful educational milestone message based on Foundation Course progress.
 * Returns { message, icon, progress } where message is a dynamic string with real stats.
 */
function getFoundationMilestoneMessage() {
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var pct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  var comprehension = coverage ? coverage.estimatedComprehension : 0;
  var masteredOcc = coverage ? coverage.masteredOccurrences : 0;
  var roots = typeof getRootFamilyMastery === 'function' ? getRootFamilyMastery() : null;
  var rootCount = roots ? roots.fullyMasteredRoots : 0;
  
  // Find the matching milestone level
  var selected = FOUNDATION_MILESTONE_MESSAGES[0];
  for (var mi = 0; mi < FOUNDATION_MILESTONE_MESSAGES.length; mi++) {
    if (pct >= FOUNDATION_MILESTONE_MESSAGES[mi].pct) {
      selected = FOUNDATION_MILESTONE_MESSAGES[mi];
    }
  }
  
  // Pick a random message from this level
  var msgs = selected.messages;
  var msg = msgs[Math.floor(Math.random() * msgs.length)];
  msg = msg.replace('{comprehension}', String(comprehension));
  msg = msg.replace('{occurrences}', masteredOcc.toLocaleString());
  msg = msg.replace('{roots}', String(rootCount));
  
  var icon = pct >= 100 ? '\uD83C\uDF89' : pct >= 50 ? '\u2B50' : pct >= 25 ? '\uD83D\uDCA1' : '\uD83C\uDF31';
  
  return { message: msg, icon: icon, progress: pct };
}

/**
 * Get the thematic title for a foundation lesson.
 */
function getFoundationLessonThematicTitle(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) return '';
  return FOUNDATION_LESSONS[lessonIndex].thematicTitle || '';
}

/**
 * Get comprehensive foundation course statistics for display on dashboard and lesson headers.
 */
function getFoundationCourseStats() {
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var fCoverage = typeof getFoundationCoverage === 'function' ? getFoundationCoverage() : null;
  var milestone = getFoundationMilestoneMessage();
  return {
    completed: fCompleted,
    total: fTotal,
    percent: fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0,
    coveragePercent: coverage ? coverage.coveragePercent : 0,
    estimatedComprehension: coverage ? coverage.estimatedComprehension : 0,
    masteredWords: coverage ? coverage.masteredWords : 0,
    totalWords: coverage ? coverage.totalWords : 0,
    foundationCoveragePercent: fCoverage ? fCoverage.foundationCoveragePercent : 0,
    masteredFoundationWords: fCoverage ? fCoverage.masteredFoundationWords : 0,
    totalFoundationWords: fCoverage ? fCoverage.totalFoundationWords : 0,
    milestoneMessage: milestone.message,
    milestoneIcon: milestone.icon,
  };
}



/**
 * Validate educational consistency across all vocabulary.
 * Checks:
 *   - Difficulty progression across foundation lessons
 *   - Root family relationships (all members present)
 *   - Similar word links (bidirectional when possible)
 *   - Contrast word references exist
 *   - Consistent typeCategory assignments
 * Reports issues to console for manual review.
 */
function validateEducationalConsistency() {
  var issues = [];
  var words = typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0 
    ? getCanonicalWords() : ALL_WORDS;
  
  if (!words || words.length === 0) {
    console.warn('[edu-validate] No vocabulary data.');
    return { valid: false, issues: ['No vocabulary data'] };
  }
  
  // Build arabic lookup
  var arabicMap = {};
  for (var vi = 0; vi < words.length; vi++) {
    if (words[vi].arabic) arabicMap[words[vi].arabic] = words[vi];
  }
  
  // 1. Check difficulty distribution in foundation lessons
  if (typeof getFoundationLessonCount === 'function') {
    var fCount = getFoundationLessonCount();
    for (var li = 0; li < fCount; li++) {
      var lessonWords = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(li) : [];
      var diffs = lessonWords.map(function(w) { return w.difficulty || 3; });
      var maxDiff = Math.max.apply(null, diffs);
      var minDiff = Math.min.apply(null, diffs);
      if (maxDiff - minDiff > 3) {
        issues.push('Foundation lesson ' + (li + 1) + ' has large difficulty spread: ' + minDiff + '-' + maxDiff);
      }
    }
  }
  
  // 2. Check root family references exist
  var totalRootFamilyRefs = 0;
  var missingRootFamilyRefs = 0;
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    if (w.rootFamily && Array.isArray(w.rootFamily)) {
      for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
        totalRootFamilyRefs++;
        var rfArabic = w.rootFamily[rfi].a;
        if (rfArabic && !arabicMap[rfArabic]) {
          missingRootFamilyRefs++;
        }
      }
    }
  }
  if (missingRootFamilyRefs > 0) {
    console.log('[edu-validate] ℹ ' + missingRootFamilyRefs + '/' + totalRootFamilyRefs + ' root family refs point to non-vocabulary words (may be intentional)');
  }
  
  // 3. Check similar/opposite/contrast word references
  var refFields = ['similarWords', 'oppositeWords', 'contrastWords'];
  for (var fi = 0; fi < refFields.length; fi++) {
    var field = refFields[fi];
    var missingRefs = 0;
    var totalRefs = 0;
    for (var wj = 0; wj < words.length; wj++) {
      var refs = words[wj][field];
      if (refs && Array.isArray(refs)) {
        totalRefs += refs.length;
        for (var rj = 0; rj < refs.length; rj++) {
          if (!arabicMap[refs[rj]]) {
            missingRefs++;
            if (missingRefs <= 3) {
              console.log('[edu-validate] ℹ ' + words[wj].arabic + ' references missing ' + field + ': \'' + refs[rj] + '\'');
            }
          }
        }
      }
    }
    if (missingRefs > 0) {
      console.log('[edu-validate] ℹ ' + field + ': ' + missingRefs + '/' + totalRefs + ' refs missing from vocabulary');
    }
  }
  
  // 4. Check typeCategory consistency
  var validCategories = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation', 'adverb', 'proper noun', 'name'];
  var invalidCat = 0;
  for (var ci = 0; ci < words.length; ci++) {
    if (words[ci].typeCategory && validCategories.indexOf(words[ci].typeCategory) < 0) {
      invalidCat++;
      if (invalidCat <= 5) {
        issues.push('Invalid typeCategory \'' + words[ci].typeCategory + '\' for word ' + words[ci].arabic);
      }
    }
  }
  
  // 5. Check for missing difficulty
  var missingDiff = 0;
  for (var di = 0; di < words.length; di++) {
    if (!words[di].difficulty) missingDiff++;
  }
  if (missingDiff > 0) {
    issues.push(missingDiff + ' words missing difficulty level');
  }
  
  // Report
  if (issues.length > 0) {
    console.log('[edu-validate] Found ' + issues.length + ' issue(s):');
    issues.forEach(function(iss) { console.log('  ' + iss); });
  } else {
    console.log('[edu-validate] ✓ All checks passed for ' + words.length + ' words.');
  }
  
  return { valid: issues.length === 0, issues: issues };
}

// ── Foundation Progress (localStorage) ──────────────────────────

const FOUNDATION_PROGRESS_KEY = 'quran_foundation_progress';

function getDefaultFoundationProgress() {
  return {
    currentLesson: 0,        // 0-based index of the active foundation lesson
    completedLessons: [],     // array of 0-based foundation lesson indices that are finished
    quizPassed: {},           // { "0": true, "1": false, ... }
  };
}

function loadFoundationProgress() {
  try {
    var raw = localStorage.getItem(FOUNDATION_PROGRESS_KEY);
    if (!raw) return getDefaultFoundationProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultFoundationProgress();
  }
}

function saveFoundationProgress(data) {
  try {
    localStorage.setItem(FOUNDATION_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save foundation progress:', e.message);
  }
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
  saveFoundationProgress(progress);
  progress.currentLesson = getNextIncompleteFoundationLesson();
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
  saveLessonProgress(progress);
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

// ═══════════════════════════════════════════════════════════════
// LEARNING PATH DASHBOARD — Multi-Path Progress & Recommendations
//
// Each learning path maintains independent lesson progression while
// sharing the same vocabulary mastery and SRS data. This means:
//   - A word mastered in Foundation Course appears learned everywhere
//   - Users can switch paths without losing progress or creating duplicates
//   - Statistics combine mastery from every learning path
// ═══════════════════════════════════════════════════════════════

/** @type {string|null} Last selected learning path for dashboard display */
let _lastSelectedPath = null;

// ── Root Family Learning Path ──────────────────────────────────
// Groups words by root into studyable "families." Each family is
// a set of words sharing the same root letters, presented together
// to build morphological awareness. Families are sorted by total
// Quranic frequency of the root.

const ROOT_FAMILY_PROGRESS_KEY = 'quran_root_family_progress';

/**
 * Build root family "lessons" — groups of words sharing the same root.
 * Returns an array of { root, rootMeaning, words, totalFrequency, wordCount }.
 */
function getRootFamilyLessons() {
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  var rootGroups = {};
  
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (!w.root || w.root === '\u2014') continue;
    
    if (!rootGroups[w.root]) {
      rootGroups[w.root] = {
        root: w.root,
        rootMeaning: w.rootMeaning || '',
        words: [],
        totalFrequency: 0,
      };
    }
    rootGroups[w.root].words.push(w);
    rootGroups[w.root].totalFrequency += w.occ || 0;
  }
  
  // Convert to array and sort by total frequency (most frequent first)
  var families = Object.keys(rootGroups).map(function(r) { return rootGroups[r]; });
  families.sort(function(a, b) { return b.totalFrequency - a.totalFrequency; });
  
  // Add word count
  for (var fi = 0; fi < families.length; fi++) {
    families[fi].wordCount = families[fi].words.length;
  }
  
  return families;
}

/**
 * Get the total number of root families.
 */
function getRootFamilyLessonCount() {
  return getRootFamilyLessons().length;
}

/**
 * Get words for a specific root family by root key.
 */
function getRootFamilyWords(rootKey) {
  var families = getRootFamilyLessons();
  for (var fi = 0; fi < families.length; fi++) {
    if (families[fi].root === rootKey) return families[fi].words;
  }
  return [];
}

/**
 * Get the words for the currently active root family.
 */
function getActiveRootFamilyWords() {
  var progress = loadRootFamilyProgress();
  return getRootFamilyWords(progress.currentRoot);
}

// ── Root Family Progress ───────────────────────────────────────

function getDefaultRootFamilyProgress() {
  var families = getRootFamilyLessons();
  return {
    currentRoot: families.length > 0 ? families[0].root : '',
    completedRoots: [],
  };
}

function loadRootFamilyProgress() {
  try {
    var raw = localStorage.getItem(ROOT_FAMILY_PROGRESS_KEY);
    if (!raw) return getDefaultRootFamilyProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultRootFamilyProgress();
  }
}

function saveRootFamilyProgress(data) {
  try {
    localStorage.setItem(ROOT_FAMILY_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[path] Could not save root family progress:', e.message);
  }
}

function isRootFamilyCompleted(rootKey) {
  var progress = loadRootFamilyProgress();
  return progress.completedRoots.indexOf(rootKey) >= 0;
}

/**
 * A root family is "unlocked" if it's the current one or any previous one is completed.
 * Since root families are independently selectable, all are unlocked.
 */
function isRootFamilyUnlocked(rootKey) {
  return true; // All root families are accessible at any time
}

function getNextIncompleteRootFamily() {
  var families = getRootFamilyLessons();
  for (var fi = 0; fi < families.length; fi++) {
    if (!isRootFamilyCompleted(families[fi].root)) return families[fi].root;
  }
  return families.length > 0 ? families[0].root : '';
}

function completeRootFamily(rootKey) {
  var progress = loadRootFamilyProgress();
  if (progress.completedRoots.indexOf(rootKey) < 0) {
    progress.completedRoots.push(rootKey);
  }
  saveRootFamilyProgress(progress);
  var next = getNextIncompleteRootFamily();
  progress.currentRoot = next;
  saveRootFamilyProgress(progress);
  // Queue cloud sync
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function setCurrentRootFamily(rootKey) {
  var families = getRootFamilyLessons();
  for (var fi = 0; fi < families.length; fi++) {
    if (families[fi].root === rootKey) {
      var progress = loadRootFamilyProgress();
      progress.currentRoot = rootKey;
      saveRootFamilyProgress(progress);
      return;
    }
  }
}

function getRootFamilyProgressPercent() {
  var families = getRootFamilyLessons();
  var progress = loadRootFamilyProgress();
  return families.length > 0 
    ? Math.round((progress.completedRoots.length / families.length) * 100)
    : 0;
}

function getCompletedRootFamilyCount() {
  var progress = loadRootFamilyProgress();
  return progress.completedRoots.length;
}

function getTotalRootFamilyCount() {
  return getRootFamilyLessons().length;
}

// ── Difficulty Learning Path ───────────────────────────────────
// Groups words by difficulty level (1-5). Learners progress through
// easier words first, building confidence before tackling harder vocabulary.
// Each difficulty level requires the previous level to be completed.

const DIFFICULTY_PROGRESS_KEY = 'quran_difficulty_progress';

/**
 * Get words grouped by difficulty level.
 * Returns an object: { 1: [words], 2: [words], 3: [words], 4: [words], 5: [words] }
 * Words within each level are sorted by frequency (most frequent first).
 */
function getDifficultyLevels() {
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  var levels = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var diff = w.difficulty || 3;
    if (levels[diff]) {
      levels[diff].push(w);
    } else {
      levels[3].push(w); // fallback to medium
    }
  }
  
  // Sort each level by frequency (highest first)
  for (var d = 1; d <= 5; d++) {
    levels[d].sort(function(a, b) {
      return (b.occ || 0) - (a.occ || 0);
    });
  }
  
  return levels;
}

/**
 * Get words for a specific difficulty level.
 */
function getDifficultyLevelWords(level) {
  var levels = getDifficultyLevels();
  return levels[level] || [];
}

/**
 * Get the words for the currently active difficulty level.
 */
function getActiveDifficultyWords() {
  var progress = loadDifficultyProgress();
  return getDifficultyLevelWords(progress.currentDifficulty);
}

// ── Difficulty Progress ────────────────────────────────────────

function getDefaultDifficultyProgress() {
  return {
    currentDifficulty: 1,
    completedLevels: [],
  };
}

function loadDifficultyProgress() {
  try {
    var raw = localStorage.getItem(DIFFICULTY_PROGRESS_KEY);
    if (!raw) return getDefaultDifficultyProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultDifficultyProgress();
  }
}

function saveDifficultyProgress(data) {
  try {
    localStorage.setItem(DIFFICULTY_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[path] Could not save difficulty progress:', e.message);
  }
}

function isDifficultyLevelCompleted(level) {
  var progress = loadDifficultyProgress();
  return progress.completedLevels.indexOf(level) >= 0;
}

function isDifficultyLevelUnlocked(level) {
  if (level === 1) return true;
  return isDifficultyLevelCompleted(level - 1);
}

function getNextIncompleteDifficultyLevel() {
  for (var d = 1; d <= 5; d++) {
    if (!isDifficultyLevelCompleted(d)) return d;
  }
  return 1;
}

function completeDifficultyLevel(level) {
  var progress = loadDifficultyProgress();
  if (progress.completedLevels.indexOf(level) < 0) {
    progress.completedLevels.push(level);
  }
  saveDifficultyProgress(progress);
  var next = getNextIncompleteDifficultyLevel();
  progress.currentDifficulty = next;
  saveDifficultyProgress(progress);
  // Queue cloud sync
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function setCurrentDifficulty(level) {
  if (level < 1 || level > 5) return;
  var progress = loadDifficultyProgress();
  progress.currentDifficulty = level;
  saveDifficultyProgress(progress);
}

function getDifficultyProgressPercent() {
  var progress = loadDifficultyProgress();
  return Math.round((progress.completedLevels.length / 5) * 100);
}

function getCompletedDifficultyLevelCount() {
  var progress = loadDifficultyProgress();
  return progress.completedLevels.length;
}

// ── Mixed Review Path ──────────────────────────────────────────
// Combines due reviews from all vocabulary with smart balancing:
// ~70% due reviews, ~30% new words. Caps at daily review limit.

const MIXED_REVIEW_KEY = 'quran_mixed_review_state';

/**
 * Get a mixed review queue combining due reviews and new words.
 * @param {number} limit - Max words in the queue (default: daily review limit)
 * @returns {Array} Array of word objects
 */
function getMixedReviewQueue(limit) {
  if (!limit) limit = typeof DAILY_REVIEW_LIMIT !== 'undefined' ? DAILY_REVIEW_LIMIT : 25;
  
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  
  // Gather due reviews from ALL words (not just active path)
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  var dueWords = [];
  var masteredWords = [];
  var newWords = [];
  
  for (var i = 0; i < allWords.length; i++) {
    var w = allWords[i];
    var entry = srsData[w.id];
    if (!entry || entry.stage === 0) {
      newWords.push(w);
    } else if (entry.dueDate && now >= entry.dueDate) {
      dueWords.push(w);
    } else {
      masteredWords.push(w);
    }
  }
  
  // Sort due words: most overdue first, leeched first
  dueWords.sort(function(a, b) {
    var aEntry = srsData[a.id];
    var bEntry = srsData[b.id];
    if (aEntry.isLeech && !bEntry.isLeech) return -1;
    if (!aEntry.isLeech && bEntry.isLeech) return 1;
    return (aEntry.dueDate || 0) - (bEntry.dueDate || 0);
  });
  
  // Mix: ~70% due reviews, ~30% new words
  var dueLimit = Math.min(dueWords.length, Math.round(limit * 0.7));
  var newLimit = Math.min(newWords.length, limit - dueLimit);
  
  // Shuffle new words for variety
  var shuffledNew = newWords.slice().sort(function() { return Math.random() - 0.5; });
  
  // Interleave: due, new, due, new...
  var queue = [];
  var dueIdx = 0;
  var newIdx = 0;
 
  while (dueIdx < dueLimit || newIdx < newLimit) {
    if (dueIdx < dueLimit) {
      queue.push(dueWords[dueIdx]);
      dueIdx++;
    }
    if (newIdx < newLimit) {
      queue.push(shuffledNew[newIdx]);
      newIdx++;
    }
  }
  
  return queue;
}

// ── Learning Path Progress Aggregator ──────────────────────────

/**
 * Get progress for all learning paths.
 * Returns an object with path keys containing progress data.
 */
function getLearningPathProgress() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  // Foundation Course
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fPct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  
  // Learn by Surah
  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var sCompleted = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
  var sPct = surahIds.length > 0 ? Math.round((sCompleted / surahIds.length) * 100) : 0;
  
  // Root Family
  var rfTotal = getTotalRootFamilyCount();
  var rfCompleted = getCompletedRootFamilyCount();
  var rfPct = rfTotal > 0 ? Math.round((rfCompleted / rfTotal) * 100) : 0;
  
  // Difficulty
  var dTotal = 5;
  var dCompleted = getCompletedDifficultyLevelCount();
  var dPct = Math.round((dCompleted / dTotal) * 100);
  
  // Overall mastery (shared across all paths)
  var totalWords = allWords.length;
  var masteredCount = 0;
  var dueCount = 0;
  for (var i = 0; i < allWords.length; i++) {
    var entry = srsData[allWords[i].id];
    if (entry && entry.stage >= 2) masteredCount++;
    if (entry && entry.dueDate && Date.now() >= entry.dueDate) dueCount++;
  }
  
  // Coverage
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  
  return {
    foundation: {
      id: 'foundation',
      label: 'Foundation Course',
      icon: '\u2B50',
      description: 'Master the 100 most frequent Quranic words across 10 progressive lessons. Covers ~84% of all Quranic word occurrences.',
      completed: fCompleted,
      total: fTotal,
      percent: fPct,
      isRecommended: true,
      isNewUserPath: true,
    },
    surah: {
      id: 'surah',
      label: 'Learn by Surah',
      icon: '\uD83D\uDCD6',
      description: 'Study vocabulary surah by surah. Perfect after completing the Foundation Course to build contextual understanding.',
      completed: sCompleted,
      total: surahIds.length,
      percent: sPct,
      isRecommended: fPct >= 80,
      isNewUserPath: false,
    },
    rootFamily: {
      id: 'root-family',
      label: 'Learn by Root Family',
      icon: '\uD83C\uDF31',
      description: 'Study words grouped by root letters to understand Arabic morphology. Great for those interested in language structure.',
      completed: rfCompleted,
      total: rfTotal,
      percent: rfPct,
      isRecommended: false,
      isNewUserPath: false,
    },
    difficulty: {
      id: 'difficulty',
      label: 'Learn by Difficulty',
      icon: '\uD83D\uDCE8',
      description: 'Progress from easy to hard words. Build confidence with simpler vocabulary before tackling advanced words.',
      completed: dCompleted,
      total: dTotal,
      percent: dPct,
      isRecommended: false,
      isNewUserPath: false,
    },
    mixedReview: {
      id: 'mixed-review',
      label: 'Mixed Review',
      icon: '\uD83D\uDD04',
      description: 'Smart review combining due words and new vocabulary from all paths. Optimized for daily practice.',
      completed: 0,
      total: 0,
      percent: 0,
      dueCount: dueCount,
      masteredCount: masteredCount,
      totalWords: totalWords,
      isRecommended: masteredCount > 0,
      isNewUserPath: false,
    },
    overall: {
      masteredWords: masteredCount,
      totalWords: totalWords,
      dueReviews: dueCount,
      coveragePercent: coverage ? coverage.coveragePercent : 0,
      estimatedComprehension: coverage ? coverage.estimatedComprehension : 0,
    },
  };
}

/**
 * Get a smart recommendation for which learning path the user should focus on.
 * Returns { pathId, label, reason }.
 */
function getPathRecommendation() {
  var progress = getLearningPathProgress();
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var hasAnyReviews = Object.keys(srsData).length > 0;
  
  // New user: recommend Foundation Course
  if (!hasAnyReviews) {
    return {
      pathId: 'foundation',
      label: 'Foundation Course',
      reason: 'Start with the most frequent Quranic words. You will learn 84% of all Quranic word occurrences in just 10 lessons!',
      icon: '\u2B50',
    };
  }
  
  // Foundation available and not complete: recommend Foundation
  if (progress.foundation.percent < 100 && progress.foundation.total > 0) {
    return {
      pathId: 'foundation',
      label: 'Foundation Course',
      reason: progress.foundation.percent >= 80 
        ? 'Almost done with the Foundation Course! Finish the remaining lessons for a strong base.'
        : 'Continue building your foundation. Each lesson increases Quran reading coverage.',
      icon: '\u2B50',
    };
  }
  
  // Foundation complete: recommend Surah learning
  if (progress.surah.percent < 100 && progress.surah.total > 0) {
    return {
      pathId: 'surah',
      label: 'Learn by Surah',
      reason: 'Foundation complete! Now apply your knowledge by studying vocabulary in Quranic context, surah by surah.',
      icon: '\uD83D\uDCD6',
    };
  }
  
  // Due reviews: recommend Mixed Review
  if (progress.overall.dueReviews > 0) {
    return {
      pathId: 'mixed-review',
      label: 'Mixed Review',
      reason: 'You have ' + progress.overall.dueReviews + ' words due for review. Strengthen your memory with a mixed review session.',
      icon: '\uD83D\uDD04',
    };
  }
  
  // Root families: recommend for morphology interest
  if (progress.rootFamily.total > 0 && progress.rootFamily.percent < 50) {
    return {
      pathId: 'root-family',
      label: 'Learn by Root Family',
      reason: 'Explore Arabic morphology by studying root families. Understand how words are formed and connected.',
      icon: '\uD83C\uDF31',
    };
  }
  
  // Default: Difficulty path
  return {
    pathId: 'difficulty',
    label: 'Learn by Difficulty',
    reason: 'Master vocabulary from easy to advanced. Challenge yourself with harder words.',
    icon: '\uD83D\uDCE8',
  };
}

/**
 * Set the last selected path for dashboard display.
 */
function setLastSelectedPath(pathId) {
  _lastSelectedPath = pathId;
}

function getLastSelectedPath() {
  return _lastSelectedPath;
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE LEARNING ENGINE — Learner Profile Builder
//
// Analyzes learner data to build a comprehensive profile used by the
// adaptive lesson generator and recommendation engine. The profile
// is computed on-demand (cached briefly) so it always reflects the
// latest SRS data, quiz results, and review history.
// ═══════════════════════════════════════════════════════════════

/** @type {Object|null} Cached learner profile */
let _learnerProfile = null;

/** @type {number} Timestamp of last profile computation */
let _profileTimestamp = 0;

/** Profile cache TTL (5 seconds — fresh enough for interactive use, stale enough to avoid recomputing on every click) */
const PROFILE_CACHE_TTL = 5000;

/**
 * Invalidate the learner profile cache (call after any SRS rating, quiz completion, or review).
 */
function invalidateLearnerProfile() {
  _learnerProfile = null;
  _profileTimestamp = 0;
}

/**
 * Build a comprehensive learner profile from SRS data, quiz history, and review patterns.
 * Returns a rich object with all metrics needed for adaptive decisions.
 */
function buildLearnerProfile() {
  var now = Date.now();
  if (_learnerProfile && (now - _profileTimestamp) < PROFILE_CACHE_TTL) {
    return _learnerProfile;
  }
  
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  if (!allWords || allWords.length === 0) {
    return { totalWords: 0, studiedWords: 0, masteryByDimension: {}, weakRoots: [], recommendations: [] };
  }
  
  // ── Dimension Analysis ──────────────────────────────────────
  // Analyze mastery across multiple vocabulary dimensions
  
  /** @type {Object.<string, {total: number, mastered: number, stageSum: number, dueCount: number, retentionSum: number, leechCount: number, lastReviewDate: number, avgLapses: number}>} */
  var byRoot = {};
  var byType = {};
  var byDifficulty = {};
  var byFrequency = {};
  
  var studiedCount = 0;
  var masteredCount = 0;
  var dueCount = 0;
  var leechCount = 0;
  var totalReviews = 0;
  var recentReviewCount = 0; // last 7 days
  var weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  var monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // For forgetting curve: track review recency by stage
  var stage0Count = 0;
  var stage1Count = 0;
  var stage2Count = 0;
  var stage3Count = 0;
  
  // For confused word analysis: words with high lapse rates
  var highLapseWords = [];
  
  // For weak root identification: roots with below-average mastery
  var rootMasteryScores = {};
  
  for (var i = 0; i < allWords.length; i++) {
    var w = allWords[i];
    var entry = srsData[w.id];
    
    // Track per dimension
    var dims = {
      root: w.root && w.root !== '\u2014' ? w.root : null,
      type: w.typeCategory || null,
      difficulty: String(w.difficulty || 3),
      frequency: w.frequency || 'medium',
    };
    
    // Initialize dimension accumulators
    var dimMap = {
      root: byRoot,
      type: byType,
      difficulty: byDifficulty,
      frequency: byFrequency,
    };
    
    Object.keys(dimMap).forEach(function(dimKey) {
      var val = dims[dimKey];
      if (!val) return;
      var map = dimMap[dimKey];
      if (!map[val]) {
        map[val] = { total: 0, mastered: 0, stageSum: 0, dueCount: 0, retentionSum: 0, leechCount: 0, lastReviewDate: 0, avgLapses: 0, lapsesSum: 0, entriesWithEntry: 0 };
      }
      map[val].total++;
      if (entry) {
        map[val].stageSum += entry.stage || 0;
        if (entry.stage >= 2) map[val].mastered++;
        if (entry.dueDate && now >= entry.dueDate) map[val].dueCount++;
        if (entry.isLeech) map[val].leechCount++;
        map[val].lapsesSum += entry.lapses || 0;
        map[val].entriesWithEntry++;
        if (entry.ratedAt && entry.ratedAt > map[val].lastReviewDate) {
          map[val].lastReviewDate = entry.ratedAt;
        }
      }
    });
    
    // Aggregate counts
    if (entry) {
      studiedCount++;
      totalReviews += entry.totalReviews || 0;
      if (entry.stage >= 2) masteredCount++;
      if (entry.dueDate && now >= entry.dueDate) dueCount++;
      if (entry.isLeech) leechCount++;
      if (entry.ratedAt && entry.ratedAt >= weekAgo) recentReviewCount++;
      
      // Stage distribution
      if (entry.stage === 0) stage0Count++;
      else if (entry.stage === 1) stage1Count++;
      else if (entry.stage === 2) stage2Count++;
      else stage3Count++;
      
      // High lapse detection
      var lapseRate = entry.totalReviews > 0 ? (entry.lapses || 0) / entry.totalReviews : 0;
      if (lapseRate > 0.4) {
        highLapseWords.push({
          word: w,
          lapseRate: lapseRate,
          lapses: entry.lapses || 0,
          totalReviews: entry.totalReviews || 0,
          isLeech: !!entry.isLeech,
        });
      }
    } else {
      stage0Count++;
    }
  }
  
  // Compute average lapse rate per root for weak root identification
  Object.keys(byRoot).forEach(function(root) {
    var r = byRoot[root];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    // Mastery score: 0-100, weighted by stage / 3 (max stage) * % studied
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
    rootMasteryScores[root] = r.masteryScore;
  });
  
  Object.keys(byType).forEach(function(t) {
    var r = byType[t];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  Object.keys(byDifficulty).forEach(function(d) {
    var r = byDifficulty[d];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  Object.keys(byFrequency).forEach(function(f) {
    var r = byFrequency[f];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  // ── Identify Weakest Roots ──────────────────────────────────
  var weakRoots = Object.keys(byRoot)
    .filter(function(r) { return byRoot[r].total >= 2; }) // only roots with 2+ words
    .sort(function(a, b) { return byRoot[a].masteryScore - byRoot[b].masteryScore; })
    .slice(0, 10)
    .map(function(r) {
      return {
        root: r,
        rootMeaning: getRootMeaningForRoot(r),
        masteryScore: byRoot[r].masteryScore,
        total: byRoot[r].total,
        mastered: byRoot[r].mastered,
        avgLapses: Math.round(byRoot[r].avgLapses * 10) / 10,
        dueCount: byRoot[r].dueCount,
      };
    });
  
  // ── Identify Strongest Roots ────────────────────────────────
  var strongRoots = Object.keys(byRoot)
    .filter(function(r) { return byRoot[r].total >= 2; })
    .sort(function(a, b) { return byRoot[b].masteryScore - byRoot[a].masteryScore; })
    .slice(0, 5)
    .map(function(r) {
      return {
        root: r,
        rootMeaning: getRootMeaningForRoot(r),
        masteryScore: byRoot[r].masteryScore,
        total: byRoot[r].total,
        mastered: byRoot[r].mastered,
      };
    });
  
  // ── Identify Frequently Confused Words ──────────────────────
  var confusedWords = highLapseWords
    .sort(function(a, b) { return b.lapseRate - a.lapseRate; })
    .slice(0, 10)
    .map(function(h) {
      return {
        arabic: h.word.arabic,
        english: h.word.english,
        lapseRate: Math.round(h.lapseRate * 100),
        lapses: h.lapses,
        totalReviews: h.totalReviews,
        isLeech: h.isLeech,
        wordId: h.word.id,
      };
    });
  
  // ── Retention by Dimension ──────────────────────────────────
  var retentionByRoot = {};
  Object.keys(byRoot).forEach(function(r) {
    retentionByRoot[r] = byRoot[r].masteryScore;
  });
  var retentionByType = {};
  Object.keys(byType).forEach(function(t) {
    retentionByType[t] = byType[t].masteryScore;
  });
  var retentionByDifficulty = {};
  Object.keys(byDifficulty).forEach(function(d) {
    retentionByDifficulty[d] = byDifficulty[d].masteryScore;
  });
  
  // ── Forgetting Curve Analysis ───────────────────────────────
  // Analyze how many words are overdue by stage
  var totalDue = 0;
  var criticallyOverdue = 0; // overdue > 7 days
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.dueDate && now >= entry.dueDate) {
      totalDue++;
      if (now - entry.dueDate > 7 * 24 * 60 * 60 * 1000) {
        criticallyOverdue++;
      }
    }
  });
  
  // ── Quiz Performance ────────────────────────────────────────
  var quizHistory = typeof loadQuizHistory === 'function' ? loadQuizHistory() : null;
  var quizAccuracy = 0;
  var quizTotalAttempts = 0;
  var quizCorrect = 0;
  if (quizHistory) {
    quizCorrect = quizHistory.correct || 0;
    quizTotalAttempts = quizHistory.total || 0;
    quizAccuracy = quizTotalAttempts > 0 ? Math.round((quizCorrect / quizTotalAttempts) * 100) : 0;
  }
  
  // ── Build Profile ───────────────────────────────────────────
  var profile = {
    // Metadata
    computedAt: now,
    totalWords: allWords.length,
    studiedWords: studiedCount,
    masteredWords: masteredCount,
    
    // Performance metrics
    totalReviews: totalReviews,
    recentReviews: recentReviewCount,
    dueCount: dueCount,
    criticallyOverdue: criticallyOverdue,
    leechCount: leechCount,
    
    // Stage distribution
    stage0: stage0Count,
    stage1: stage1Count,
    stage2: stage2Count,
    stage3: stage3Count,
    
    // Quiz performance
    quizAccuracy: quizAccuracy,
    quizTotalAttempts: quizTotalAttempts,
    quizCorrect: quizCorrect,
    
    // Adaptive difficulty level
    adaptiveDifficulty: computeAdaptiveDifficulty(masteredCount, studiedCount, quizAccuracy),
    
    // Dimension mastery
    masteryByType: byType,
    masteryByDifficulty: byDifficulty,
    masteryByFrequency: byFrequency,
    masteryByRoot: byRoot,
    
    // Retention scores (0-100) by dimension
    retentionByRoot: retentionByRoot,
    retentionByType: retentionByType,
    retentionByDifficulty: retentionByDifficulty,
    
    // Insights
    weakRoots: weakRoots,
    strongRoots: strongRoots,
    confusedWords: confusedWords,
    
    // Coverage
    coverage: typeof calculateCoverage === 'function' ? calculateCoverage() : null,
  };
  
  _learnerProfile = profile;
  _profileTimestamp = now;
  return profile;
}

/**
 * Get the root meaning text for a root string.
 */
function getRootMeaningForRoot(rootStr) {
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  for (var ri = 0; ri < words.length; ri++) {
    if (words[ri].root === rootStr && words[ri].rootMeaning) {
      return words[ri].rootMeaning;
    }
  }
  return '';
}

/**
 * Compute the learner's adaptive difficulty level (1-5).
 * Uses mastery rate and quiz accuracy to determine appropriate challenge.
 * 1 = Easy (new learner, needs confidence building)
 * 5 = Expert (high mastery, needs challenge)
 */
function computeAdaptiveDifficulty(masteredCount, studiedCount, quizAccuracy) {
  var masterRate = studiedCount > 0 ? masteredCount / studiedCount : 0;
  var accuracyAdjusted = quizAccuracy > 0 ? quizAccuracy / 100 : masterRate;
  
  if (accuracyAdjusted >= 0.85 && studiedCount > 50) return 5;
  if (accuracyAdjusted >= 0.75 && studiedCount > 30) return 4;
  if (accuracyAdjusted >= 0.60) return 3;
  if (accuracyAdjusted >= 0.40) return 2;
  return 1;
}

/**
 * Get the cached or freshly computed learner profile.
 */
function getLearnerProfile() {
  return buildLearnerProfile();
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE LESSON GENERATOR — Dynamic, Personalized Lessons
//
// Generates lessons tailored to the learner's profile:
//   • ~40% Review (overdue + weak words)
//   • ~30% New (high-priority new vocabulary)
//   • ~20% Reinforcement (frequently confused or leeched words)
//   • ~10% Challenge (slightly harder words for growth)
//
// Word ordering within lessons follows a psychologically optimized
// sequence: review first (warm-up), then new (focus), then challenge.
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a personalized lesson for the learner.
 * @param {number} wordCount - Desired number of words (default: WORDS_PER_LESSON)
 * @param {Object} options - Optional constraints:
 *   - path: 'foundation'|'surah'|'root-family'|'difficulty'|null (null = all vocab)
 *   - sourceWords: Array of candidate words to pick from (for path-specific lessons)
 *   - includeReview: boolean (default: true)
 *   - includeNew: boolean (default: true)
 * @returns {Array} Ordered array of word objects
 */
function generateAdaptiveLesson(wordCount, options) {
  if (!wordCount || wordCount < 3) wordCount = WORDS_PER_LESSON;
  if (!options) options = {};
  
  var profile = buildLearnerProfile();
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  
  // Determine candidate word pool
  var pool = options.sourceWords && options.sourceWords.length > 0
    ? options.sourceWords
    : ((typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
        ? getCanonicalWords() : ALL_WORDS);
  
  if (!pool || pool.length === 0) return [];
  
  // ── Categorize words ──
  var reviewWords = [];  // Overdue or due soon
  var weakWords = [];    // High lapse rate, low retention
  var newWords = [];     // Never studied
  var challengeWords = []; // Slightly harder, not yet studied
  var masteredWords = []; // Well-known, not needed
  
  for (var i = 0; i < pool.length; i++) {
    var w = pool[i];
    var entry = srsData[w.id];
    
    if (!entry || entry.stage === 0) {
      // Never studied: candidate for new or challenge
      var diff = w.difficulty || 3;
      var priority = w.learningPriority || 3;
      
      if (priority <= 2 && diff <= profile.adaptiveDifficulty + 1) {
        newWords.push(w);
      } else if (diff <= profile.adaptiveDifficulty + 1) {
        newWords.push(w);
      } else {
        challengeWords.push(w);
      }
    } else if (entry.dueDate && now >= entry.dueDate) {
      // Due for review
      reviewWords.push({ word: w, overdueMs: now - entry.dueDate, entry: entry });
      
      // Flag high-lapse words as weak
      var lapseRate = entry.totalReviews > 0 ? (entry.lapses || 0) / entry.totalReviews : 0;
      if (lapseRate > 0.3 || entry.isLeech) {
        weakWords.push({ word: w, lapseRate: lapseRate, entry: entry });
      }
    } else {
      masteredWords.push(w);
    }
  }
  
  // Sort review by urgency (most overdue + weakest first)
  reviewWords.sort(function(a, b) {
    if (a.entry.isLeech && !b.entry.isLeech) return -1;
    if (!a.entry.isLeech && b.entry.isLeech) return 1;
    return b.overdueMs - a.overdueMs;
  });
  
  // Sort weak by severity
  weakWords.sort(function(a, b) {
    return (b.lapseRate || 0) - (a.lapseRate || 0);
  });
  
  // Sort new by learning priority (highest first), then by frequency rank
  newWords.sort(function(a, b) {
    var aP = a.learningPriority || 5;
    var bP = b.learningPriority || 5;
    if (aP !== bP) return aP - bP;
    return (a.frequencyRank || 9999) - (b.frequencyRank || 9999);
  });
  
  // Sort challenge by difficulty (closest to adaptive + 1, but not too easy)
  challengeWords.sort(function(a, b) {
    var aDiff = Math.abs((a.difficulty || 3) - profile.adaptiveDifficulty - 1);
    var bDiff = Math.abs((b.difficulty || 3) - profile.adaptiveDifficulty - 1);
    return aDiff - bDiff;
  });
  
  // ── Compose lesson ─────────────────────────────────────────
  // Ratios based on learner profile
  // - New learners (adaptiveDifficulty = 1): focus on new words + reviews
  // - Intermediate (adaptiveDifficulty = 2-3): balanced mix
  // - Advanced (adaptiveDifficulty = 4-5): more challenge + weak areas
  
  var reviewRatio, newRatio, weakRatio, challengeRatio;
  
  if (profile.adaptiveDifficulty <= 1 && profile.studiedWords < 20) {
    // New learner: 50% new, 30% review, 10% weak, 10% challenge
    reviewRatio = 0.3; newRatio = 0.5; weakRatio = 0.1; challengeRatio = 0.1;
  } else if (profile.adaptiveDifficulty <= 2) {
    // Beginner: 35% review, 35% new, 15% weak, 15% challenge
    reviewRatio = 0.35; newRatio = 0.35; weakRatio = 0.15; challengeRatio = 0.15;
  } else if (profile.adaptiveDifficulty <= 3) {
    // Intermediate: 40% review, 25% new, 20% weak, 15% challenge
    reviewRatio = 0.4; newRatio = 0.25; weakRatio = 0.2; challengeRatio = 0.15;
  } else {
    // Advanced: 35% review, 15% new, 30% weak/reinforcement, 20% challenge
    reviewRatio = 0.35; newRatio = 0.15; weakRatio = 0.3; challengeRatio = 0.2;
  }
  
  // If no options, adjust: new learners without reviews get more new words
  if (!options.includeReview && !options.includeNew) {
    // Default: include both
  }
  if (options.includeReview === false) reviewRatio = 0;
  if (options.includeNew === false) newRatio = 0;
  
  // Normalize ratios
  var totalRatio = reviewRatio + newRatio + weakRatio + challengeRatio;
  if (totalRatio === 0) { reviewRatio = 0.5; newRatio = 0.5; totalRatio = 1; }
  
  var reviewCount = Math.min(reviewWords.length, Math.max(1, Math.round(wordCount * reviewRatio / totalRatio)));
  var weakCount = Math.min(weakWords.length, Math.max(0, Math.round(wordCount * weakRatio / totalRatio)));
  var newCount = Math.min(newWords.length, Math.max(0, Math.round(wordCount * newRatio / totalRatio)));
  var challengeCount = Math.min(challengeWords.length, Math.max(0, wordCount - reviewCount - weakCount - newCount));
  
  // Redistribute excess if any category is exhausted
  var remainingSlots = wordCount - reviewCount - weakCount - newCount - challengeCount;
  if (remainingSlots > 0) {
    // Add more reviews first, then new words
    var extraReview = Math.min(reviewWords.length - reviewCount, Math.round(remainingSlots * 0.6));
    reviewCount += extraReview;
    remainingSlots -= extraReview;
    if (remainingSlots > 0) {
      var extraNew = Math.min(newWords.length - newCount, remainingSlots);
      newCount += extraNew;
      remainingSlots -= extraNew;
    }
    if (remainingSlots > 0) {
      challengeCount += remainingSlots;
    }
  } else if (remainingSlots < 0) {
    // Trim from the end: challenge first, then weak, then new
    if (challengeCount > 0) {
      var trimChallenge = Math.min(challengeCount, -remainingSlots);
      challengeCount -= trimChallenge;
      remainingSlots += trimChallenge;
    }
    if (remainingSlots < 0 && weakCount > 0) {
      var trimWeak = Math.min(weakCount, -remainingSlots);
      weakCount -= trimWeak;
      remainingSlots += trimWeak;
    }
    if (remainingSlots < 0 && newCount > 0) {
      var trimNew = Math.min(newCount, -remainingSlots);
      newCount -= trimNew;
      remainingSlots += trimNew;
    }
    if (remainingSlots < 0 && reviewCount > 0) {
      var trimReview = Math.min(reviewCount, -remainingSlots);
      reviewCount -= trimReview;
      remainingSlots += trimReview;
    }
  }
  
  // ── Build lesson with optimal ordering ─────────────────────
  // Warm-up: 1-2 review/weak words
  // Focus: interleaved new + weak + review
  // Cool-down: 1 challenge word (optional)
  
  var lesson = [];
  var revIdx = 0;
  var weakIdx = 0;
  var newIdx = 0;
  var chalIdx = 0;
  
  // Warm-up: start with 1-2 strong review words to build confidence
  if (reviewCount > 0 && revIdx < reviewCount) {
    lesson.push(reviewWords[revIdx].word);
    revIdx++;
  }
  if (weakCount > 0 && weakIdx < weakCount && lesson.length < 2) {
    lesson.push(weakWords[weakIdx].word);
    weakIdx++;
  }
  
  // Main content: interleave categories for optimal learning
  var maxIterations = wordCount * 2; // safety limit
  var iterations = 0;
  while (lesson.length < wordCount && iterations < maxIterations) {
    iterations++;
    var added = false;
    
    // Add a weak word (high priority for improvement)
    if (weakIdx < weakCount && lesson.length < wordCount) {
      lesson.push(weakWords[weakIdx].word);
      weakIdx++;
      added = true;
    }
    
    // Add a new word
    if (newIdx < newCount && lesson.length < wordCount) {
      lesson.push(newWords[newIdx]);
      newIdx++;
      added = true;
    }
    
    // Add a review word (if not already included as weak)
    if (revIdx < reviewCount && lesson.length < wordCount) {
      var revWord = reviewWords[revIdx].word;
      // Avoid duplicating words already added from weak
      var alreadyInLesson = false;
      for (var li = 0; li < lesson.length; li++) {
        if (lesson[li].id === revWord.id) { alreadyInLesson = true; break; }
      }
      if (!alreadyInLesson) {
        lesson.push(revWord);
      }
      revIdx++;
      added = true;
    }
    
    // If nothing was added, break to avoid infinite loop
    if (!added) break;
  }
  
  // Cool-down: add a challenge word at the end if room
  if (chalIdx < challengeCount && lesson.length < wordCount) {
    lesson.push(challengeWords[chalIdx]);
    chalIdx++;
  }
  
  // If still short, pad with any remaining review words
  while (revIdx < reviewCount && lesson.length < wordCount) {
    var revWord = reviewWords[revIdx].word;
    var alreadyIn = false;
    for (var ri = 0; ri < lesson.length; ri++) {
      if (lesson[ri].id === revWord.id) { alreadyIn = true; break; }
    }
    if (!alreadyIn) lesson.push(revWord);
    revIdx++;
  }
  
  // If still short, pad with mastered words (least harm)
  if (lesson.length < wordCount) {
    var shuffledMastered = masteredWords.slice().sort(function() { return Math.random() - 0.5; });
    for (var mi = 0; mi < shuffledMastered.length && lesson.length < wordCount; mi++) {
      lesson.push(shuffledMastered[mi]);
    }
  }
  
  return lesson.slice(0, wordCount);
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENT RECOMMENDATION ENGINE
//
// Analyzes the learner profile to recommend the most impactful
// next learning action with an explanation of why.
// ═══════════════════════════════════════════════════════════════

/**
 * Get the personalized next-lesson recommendation with explanation.
 * Returns an object: { type, path, label, reason, details, action }
 */
function getAdaptiveRecommendation() {
  var profile = buildLearnerProfile();
  var now = Date.now();
  
  // ── Priority 1: Critically overdue reviews ─────────────────
  if (profile.criticallyOverdue >= 5) {
    var overdueRoots = findOverdueRoots(profile);
    var reason = 'You have ' + profile.criticallyOverdue + ' words overdue by more than a week. ' +
      'Review them now before they are completely forgotten. ' +
      (overdueRoots ? 'Focus on root: ' + overdueRoots : '');
    return {
      type: 'critical-review',
      path: 'mixedReview',
      label: 'Overdue Words Review',
      reason: reason,
      details: profile.criticallyOverdue + ' critically overdue words',
      action: 'startCriticalReview',
      urgency: 'high',
    };
  }
  
  // ── Priority 2: New user → Foundation Course ───────────────
  if (profile.studiedWords < 10 && typeof getFoundationLessonCount === 'function' && getFoundationLessonCount() > 0) {
    var foundationNext = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
    return {
      type: 'new-learner',
      path: 'foundation',
      label: 'Foundation Course',
      reason: 'Start your Quran vocabulary journey! The Foundation Course teaches the 100 most frequent words, covering ~84% of the Quran. ' +
        'Each lesson takes just a few minutes.',
      details: 'Continue with Foundation ' + (foundationNext + 1),
      action: 'startFoundation',
      urgency: 'medium',
    };
  }
  
  // ── Priority 3: Weak roots need strengthening ──────────────
  if (profile.weakRoots.length > 0 && profile.weakRoots[0].masteryScore < 30) {
    var weakest = profile.weakRoots[0];
    return {
      type: 'strengthen-roots',
      path: 'rootFamily',
      label: 'Strengthen Weak Root Family',
      reason: 'Your mastery of root ' + weakest.root + ' (' + weakest.rootMeaning + ') is only ' + weakest.masteryScore + '%. ' +
        'Strengthening this root family will help you recognize ' + weakest.total + ' related Quranic words.',
      details: 'Root: ' + weakest.root + ' (' + weakest.rootMeaning + ') — ' + weakest.total + ' words',
      action: 'strengthenRoot',
      rootKey: weakest.root,
      urgency: 'high',
    };
  }
  
  // ── Priority 4: Review backlog ──────────────────────────────
  if (profile.dueCount >= 5) {
    var pctOverdue = profile.studiedWords > 0 ? Math.round((profile.dueCount / profile.studiedWords) * 100) : 0;
    return {
      type: 'review-backlog',
      path: 'mixedReview',
      label: 'Clear Review Backlog',
      reason: 'You have ' + profile.dueCount + ' words due for review (' + pctOverdue + '% of studied vocabulary). ' +
        'Regular reviews are essential for long-term retention.',
      details: profile.dueCount + ' due · ' + profile.leechCount + ' leeched',
      action: 'startReview',
      urgency: 'medium',
    };
  }
  
  // ── Priority 5: Foundation Course progression ──────────────
  if (typeof getFoundationLessonCount === 'function' && getFoundationLessonCount() > 0) {
    var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
    var fTotal = getFoundationLessonCount();
    if (fCompleted < fTotal) {
      var nextF = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
      var progressPct = Math.round((fCompleted / fTotal) * 100);
      var completionBoost = (fCompleted + 1) <= fTotal ? getFoundationLessonWords(nextF) : [];
      var coverageGain = 0;
      if (completionBoost.length > 0) {
        for (var gi = 0; gi < completionBoost.length; gi++) {
          coverageGain += completionBoost[gi].occ || 0;
        }
      }
      var totalOcc = getTotalQuranOccurrences();
      var coverageBoostPct = totalOcc > 0 ? (coverageGain / totalOcc * 100).toFixed(1) : 0;
      
      return {
        type: 'foundation-progress',
        path: 'foundation',
        label: 'Continue Foundation Course',
        reason: 'Foundation Course ' + progressPct + '% complete. Next lesson adds ~' + coverageBoostPct + '% Quran coverage. ' +
          'Complete all ' + fTotal + ' lessons for ~84% coverage.',
        details: 'Foundation ' + (nextF + 1) + ' of ' + fTotal + ' · +' + coverageBoostPct + '% coverage',
        action: 'continueFoundation',
        lessonIndex: nextF,
        urgency: 'medium',
      };
    }
  }
  
  // ── Priority 6: Surah comprehension gaps ───────────────────
  if (typeof getAllSurahComprehension === 'function') {
    var allComp = getAllSurahComprehension();
    if (allComp && allComp.length > 0) {
      var worstSurah = null;
      for (var sci = 0; sci < allComp.length; sci++) {
        if (allComp[sci].estimatedComprehension < 50) {
          worstSurah = allComp[sci];
          break;
        }
      }
      if (worstSurah) {
        var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(worstSurah.surahId) : null;
        return {
          type: 'surah-comprehension',
          path: 'surah',
          label: 'Improve Surah Comprehension',
          reason: 'Your comprehension of ' + (surahInfo ? surahInfo.name : 'Surah ' + worstSurah.surahId) +
            ' is only ' + worstSurah.estimatedComprehension + '%. Studying its vocabulary will boost your understanding.',
          details: worstSurah.surahId + '. ' + (surahInfo ? surahInfo.name : '') +
            ' · ' + worstSurah.masteredWords + '/' + worstSurah.totalWords + ' words mastered',
          action: 'studySurah',
          surahId: worstSurah.surahId,
          urgency: 'low',
        };
      }
    }
  }
  
  // ── Priority 7: Frequently confused words ──────────────────
  if (profile.confusedWords.length >= 3) {
    var topConfused = profile.confusedWords[0];
    return {
      type: 'confused-words',
      path: 'foundation',
      label: 'Reinforce Confused Words',
      reason: 'You often confuse ' + topConfused.arabic + ' (' + topConfused.english + ') — ' +
        topConfused.lapseRate + '% lapse rate. Dedicated practice will strengthen this.',
      details: topConfused.lapseRate + '% lapse rate · ' + topConfused.totalReviews + ' reviews',
      action: 'reviewConfused',
      wordId: topConfused.wordId,
      urgency: 'low',
    };
  }
  
  // ── Priority 8: Difficulty progression ─────────────────────
  if (profile.adaptiveDifficulty >= 3 && profile.masteredWords > 30) {
    var nextDifficulty = typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1;
    return {
      type: 'difficulty-advance',
      path: 'difficulty',
      label: 'Advance Difficulty Level',
      reason: 'You are ready for harder vocabulary! Your mastery rate (' +
        Math.round((profile.masteredWords / Math.max(1, profile.studiedWords)) * 100) + '%) shows strong retention.',
      details: 'Next: Difficulty Level ' + nextDifficulty,
      action: 'advanceDifficulty',
      level: nextDifficulty,
      urgency: 'low',
    };
  }
  
  // ── Default: Mixed Review ───────────────────────────────────
  return {
    type: 'general-review',
    path: 'mixedReview',
    label: 'Mixed Review Session',
    reason: 'A balanced review session keeps your vocabulary strong. ' +
      'Includes due reviews, some new words, and targeted practice on weak areas.',
    details: profile.dueCount + ' due · ' + (profile.totalWords - profile.studiedWords) + ' unstudied',
    action: 'startMixedReview',
    urgency: 'low',
  };
}

/**
 * Find the root with the most overdue words for targeted review recommendations.
 */
function findOverdueRoots(profile) {
  if (!profile.weakRoots || profile.weakRoots.length === 0) return null;
  // Find weak root with highest due count
  var best = null;
  var bestDue = 0;
  for (var ri = 0; ri < profile.weakRoots.length; ri++) {
    var r = profile.weakRoots[ri];
    if (r.dueCount > bestDue) {
      bestDue = r.dueCount;
      best = r;
    }
  }
  return best ? best.root + ' (' + best.rootMeaning + ')' : null;
}

/**
 * Get learning insights summary for the personalized dashboard.
 */
function getLearningInsights() {
  var profile = buildLearnerProfile();
  var rec = getAdaptiveRecommendation();
  
  // Compute estimated coverage after next lesson
  var currentCoverage = profile.coverage ? profile.coverage.coveragePercent : 0;
  var estimatedNextCoverage = currentCoverage;
  
  if (rec.type === 'foundation-progress' && rec.lessonIndex !== undefined) {
    var fWords = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(rec.lessonIndex) : [];
    var gainOcc = 0;
    for (var fi = 0; fi < fWords.length; fi++) {
      gainOcc += fWords[fi].occ || 0;
    }
    var totalOcc = getTotalQuranOccurrences();
    var gainPct = totalOcc > 0 ? (gainOcc / totalOcc * 100) : 0;
    estimatedNextCoverage = Math.min(100, currentCoverage + gainPct);
  }
  
  // Predict time to Foundation completion
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fRemaining = fTotal - fCompleted;
  var predictedDaysToFoundationCompletion = 0;
  if (fRemaining > 0) {
    var reviewsPerDay = profile.recentReviews > 0 ? Math.max(1, Math.round(profile.recentReviews / 7)) : 1;
    // Assume ~10 words per foundation lesson, requiring ~1 review session per lesson
    var sessionsPerWeek = reviewsPerDay;
    var lessonsPerSession = 1; // conservative estimate
    var weeksToComplete = fRemaining / Math.max(1, sessionsPerWeek * lessonsPerSession);
    predictedDaysToFoundationCompletion = Math.round(weeksToComplete * 7);
  }
  
  return {
    recommendation: rec,
    currentCoverage: currentCoverage,
    estimatedNextCoverage: estimatedNextCoverage,
    coverageGain: (estimatedNextCoverage - currentCoverage).toFixed(1),
    predictedDaysToFoundationCompletion: predictedDaysToFoundationCompletion,
    weakRoots: profile.weakRoots.slice(0, 3),
    strongRoots: profile.strongRoots.slice(0, 3),
    confusedWords: profile.confusedWords.slice(0, 5),
    reviewBacklog: profile.dueCount,
    adaptiveDifficulty: profile.adaptiveDifficulty,
    studiedWords: profile.studiedWords,
    masteredWords: profile.masteredWords,
    totalWords: profile.totalWords,
    totalReviews: profile.totalReviews,
    quizAccuracy: profile.quizAccuracy,
    criticallyOverdue: profile.criticallyOverdue,
  };
}

// ── Quiz History (for adaptive analysis) ──────────────────────

const QUIZ_HISTORY_KEY = 'quran_quiz_history';

function getDefaultQuizHistory() {
  return {
    correct: 0,
    total: 0,
    byWordId: {}, // { wordId: { correct: N, total: N } }
  };
}

function loadQuizHistory() {
  try {
    var raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveQuizHistory(data) {
  try {
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[adaptive] Could not save quiz history:', e.message);
  }
}

/**
 * Record a quiz result for a specific word.
 */
function recordQuizResult(wordId, wasCorrect) {
  var history = loadQuizHistory() || getDefaultQuizHistory();
  history.total++;
  if (wasCorrect) history.correct++;
  
  if (!history.byWordId) history.byWordId = {};
  if (!history.byWordId[wordId]) {
    history.byWordId[wordId] = { correct: 0, total: 0 };
  }
  history.byWordId[wordId].total++;
  if (wasCorrect) history.byWordId[wordId].correct++;
  
  saveQuizHistory(history);
  invalidateLearnerProfile();
}

// ── Export Adaptive Engine ─────────────────────────────────────

// Export learning path functions for cross-module access
if (typeof window !== 'undefined') {
  window.__adaptive = {
    getProfile: getLearnerProfile,
    invalidateProfile: invalidateLearnerProfile,
    generateLesson: generateAdaptiveLesson,
    getRecommendation: getAdaptiveRecommendation,
    getInsights: getLearningInsights,
    recordQuizResult: recordQuizResult,
    loadQuizHistory: loadQuizHistory,
  };
  
  window.__learningPaths = {
    getProgress: getLearningPathProgress,
    getRecommendation: getPathRecommendation,
    getRootFamilyLessons: getRootFamilyLessons,
    getRootFamilyWords: getRootFamilyWords,
    getActiveRootFamilyWords: getActiveRootFamilyWords,
    loadRootFamilyProgress: loadRootFamilyProgress,
    saveRootFamilyProgress: saveRootFamilyProgress,
    isRootFamilyCompleted: isRootFamilyCompleted,
    completeRootFamily: completeRootFamily,
    setCurrentRootFamily: setCurrentRootFamily,
    getRootFamilyProgressPercent: getRootFamilyProgressPercent,
    getDifficultyLevels: getDifficultyLevels,
    getDifficultyLevelWords: getDifficultyLevelWords,
    getActiveDifficultyWords: getActiveDifficultyWords,
    loadDifficultyProgress: loadDifficultyProgress,
    saveDifficultyProgress: saveDifficultyProgress,
    isDifficultyLevelCompleted: isDifficultyLevelCompleted,
    isDifficultyLevelUnlocked: isDifficultyLevelUnlocked,
    completeDifficultyLevel: completeDifficultyLevel,
    setCurrentDifficulty: setCurrentDifficulty,
    getDifficultyProgressPercent: getDifficultyProgressPercent,
    getMixedReviewQueue: getMixedReviewQueue,
    setLastSelectedPath: setLastSelectedPath,
    getLastSelectedPath: getLastSelectedPath,
  };
}

// ── Export Enriched Metadata Functions ──────────────────────────

// Add the new metadata functions to window for use by UI modules
// Guarded with typeof check for Node.js compatibility during validation
if (typeof window !== 'undefined') {
  window.__metadata = {
    getFrequencyRank: getFrequencyRank,
    getLearningPriority: getLearningPriority,
    getLearningPriorityLabel: getLearningPriorityLabel,
    getWordsByPriority: getWordsByPriority,
    getWordsByFrequency: getWordsByFrequency,
    getMostFrequentWord: getMostFrequentWord,
    getFoundationLessonRoots: getFoundationLessonRoots,
    getFoundationLessonRelationshipContext: getFoundationLessonRelationshipContext,
    getFoundationLessonForWord: getFoundationLessonForWord,
    getFoundationRelationshipStats: getFoundationRelationshipStats,
  };
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
