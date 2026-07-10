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
