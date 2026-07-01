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
//   bookmarked     — Default bookmark state (false)
// ═══════════════════════════════════════════════════════════════

/** Number of words shown per study session (legacy — kept for backward compat) */
const SESSION_SIZE = 20;

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
    // Clamp to at least the number of distinct occurrences we have
    totalOcc = Math.max(totalOcc, occurrences.length);
    
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
      frequency: base.frequency,
      difficulty: base.difficulty,
      tags: base.tags,
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
