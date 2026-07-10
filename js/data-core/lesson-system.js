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
