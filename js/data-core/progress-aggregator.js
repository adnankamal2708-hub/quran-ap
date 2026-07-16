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
 * Get a smart recommendation for the user's best next action.
 * Priority order:
 *   1. Due reviews (words actively needing reinforcement)
 *   2. Finish current lesson (if quiz not passed)
 *   3. Continue Foundation Course
 *   4. Continue Surah learning
 *   5. Review weak words (leeched or frequently forgotten)
 *   6. Explore statistics
 *
 * Returns { pathId, label, reason, icon, action }.
 */
function getPathRecommendation() {
  var progress = getLearningPathProgress();
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var hasAnyReviews = Object.keys(srsData).length > 0;
  var now = Date.now();
  
  // ── Priority 1: Due reviews ──
  var dueCount = 0;
  var overdueCount = 0;
  var leechCount = 0;
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (!entry) return;
    if (entry.dueDate && now >= entry.dueDate) {
      dueCount++;
      if (now - entry.dueDate > 3 * DAY_MS) overdueCount++;
    }
    if (entry.isLeech) leechCount++;
  });
  
  if (dueCount > 0) {
    var urgency = overdueCount > 0 ? 'urgent' : 'recommended';
    var reason = '';
    if (overdueCount > 5) {
      reason = 'You have ' + dueCount + ' words due for review (' + overdueCount + ' overdue). Strengthening memory before it fades is the most effective learning strategy.';
    } else if (leechCount > 0) {
      reason = overdueCount + ' words are overdue and ' + leechCount + ' need extra attention. Reviewing now reinforces your long-term memory.';
    } else {
      reason = 'You have ' + dueCount + ' words ready for review. Regular review is the key to making Quranic vocabulary stick.';
    }
    return {
      pathId: 'mixed-review',
      label: 'Review Due Words',
      reason: reason,
      icon: '\uD83D\uDD01',
      priority: 'high',
      action: 'start-review',
    };
  }
  
  // ── Priority 2: Finish current Foundation lesson ──
  if (progress.foundation.percent < 100 && progress.foundation.total > 0) {
    var fLesson = null;
    var fCurrentIdx = typeof getCurrentFoundationLessonIndex === 'function' ? getCurrentFoundationLessonIndex() : 0;
    if (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS[fCurrentIdx]) {
      fLesson = FOUNDATION_LESSONS[fCurrentIdx];
    }
    var lessonWordIds = fLesson ? fLesson.wordIds : [];
    var masteredInLesson = 0;
    lessonWordIds.forEach(function(wid) {
      var entry = srsData[wid];
      if (entry && entry.stage >= 2) masteredInLesson++;
    });
    
    var completionHint = '';
    if (masteredInLesson > 0 && masteredInLesson < lessonWordIds.length) {
      completionHint = ' You have already mastered ' + masteredInLesson + ' of ' + lessonWordIds.length + ' words in the current lesson.';
    } else if (masteredInLesson === 0) {
      completionHint = ' A fresh lesson with new Quranic vocabulary awaits.';
    } else {
      completionHint = ' All words in this lesson are ready! Take the quiz to mark it complete.';
    }
    
    return {
      pathId: 'foundation',
      label: 'Foundation ' + (fCurrentIdx + 1) + ': ' + (fLesson ? fLesson.thematicTitle : ''),
      reason: progress.foundation.percent >= 80 
        ? 'Almost done with the Foundation Course! ' + (progress.foundation.total - progress.foundation.completed) + ' lesson' + (progress.foundation.total - progress.foundation.completed !== 1 ? 's' : '') + ' remaining.' + completionHint
        : 'Continue building your foundation. Each lesson brings you closer to understanding the Quran.' + completionHint,
      icon: '\u2B50',
      priority: 'high',
      action: 'continue-foundation',
    };
  }
  
  // ── Priority 3: Weak words needing attention ──
  if (leechCount > 2) {
    return {
      pathId: 'mixed-review',
      label: 'Focus on Difficult Words',
      reason: leechCount + ' words need extra attention. These are words you have struggled with — giving them focused review now will turn them into strengths.',
      icon: '\uD83D\uDCA2',
      priority: 'medium',
      action: 'review-leeches',
    };
  }
  
  // ── Priority 4: Continue Surah learning ──
  if (progress.surah.percent < 100 && progress.surah.total > 0) {
    return {
      pathId: 'surah',
      label: 'Learn by Surah',
      reason: 'Foundation complete! Now apply your knowledge by studying vocabulary in Quranic context, surah by surah. You have completed ' + progress.surah.completed + ' of ' + progress.surah.total + ' surahs.',
      icon: '\uD83D\uDCD6',
      priority: 'medium',
      action: 'continue-surah',
    };
  }
  
  // ── Priority 5: Check for frequently forgotten words ──
  var forgottenWords = (typeof window.__analytics !== 'undefined' && window.__analytics.getFrequentlyForgotten)
    ? window.__analytics.getFrequentlyForgotten() : [];
  if (forgottenWords && forgottenWords.length >= 3) {
    var sampleWords = forgottenWords.slice(0, 2).map(function(w) { return w.arabic; }).join(', ');
    return {
      pathId: 'mixed-review',
      label: 'Reinforce Weak Vocabulary',
      reason: forgottenWords.length + ' words (like ' + sampleWords + ') need reinforcement. Targeted practice on weak words builds durable knowledge.',
      icon: '\uD83C\uDFAD',
      priority: 'medium',
      action: 'review-difficult',
    };
  }
  
  // ── Priority 6: Explore stats — review achievements ──
  if (hasAnyReviews) {
    return {
      pathId: 'stats',
      label: 'Review Your Progress',
      reason: 'You have made great progress! Review your learning statistics, achievements, and see how far you have come in understanding the Quran.',
      icon: '\uD83D\uDCCA',
      priority: 'low',
      action: 'view-stats',
    };
  }
  
  // ── New user: Foundation Course ──
  return {
    pathId: 'foundation',
    label: 'Start Foundation Course',
    reason: 'Begin your journey to understand the Quran. The Foundation Course teaches the 100 most frequent words — covering ~84% of all Quranic word occurrences in just 10 lessons.',
    icon: '\u2B50',
    priority: 'high',
    action: 'start-foundation',
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