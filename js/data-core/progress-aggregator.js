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