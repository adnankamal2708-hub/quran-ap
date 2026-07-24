// ═══════════════════════════════════════════════════════════════
// learning-journey.js — Centralized Learning Journey State
//
// Provides a single source of truth that any screen can query
// to understand where the learner currently is and what they
// should do next. Eliminates duplicate logic across screens.
//
// Exposes: window.__learningJourney.getCurrentState()
//
// All data is read from existing systems (SRS, Foundation,
// Adaptive Engine, Quran) — no new state is created.
// ═══════════════════════════════════════════════════════════════

// ── Momentum tracking key ─────────────────────────────────────
var _MOMENTUM_KEY = 'bayan_learning_momentum';

// ═══════════════════════════════════════════════════════════════
// PART 6: LEARNING MOMENTUM — Track today's tiny wins
// ═══════════════════════════════════════════════════════════════

function _momentumTodayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Load today's learning momentum data from localStorage.
 */
function loadMomentum() {
  try {
    var raw = localStorage.getItem(_MOMENTUM_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (data.date === _momentumTodayKey()) return data;
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Save today's learning momentum data to localStorage.
 */
function _saveMomentum(data) {
  try {
    data.date = _momentumTodayKey();
    localStorage.setItem(_MOMENTUM_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

/**
 * Record a learning event for today's momentum.
 * @param {string} type - 'word_reviewed', 'word_learned', 'word_mastered', 'ayah_read', 'lesson_completed'
 * @param {number} [count=1] - How many of this event occurred
 */
function recordMomentum(type, count) {
  count = count || 1;
  var momentum = loadMomentum() || {
    date: _getTodayKey(),
    wordsReviewed: 0,
    wordsLearned: 0,
    wordsMastered: 0,
    ayahsRead: 0,
    lessonsCompleted: 0,
    reviewsCompleted: 0,
  };

  switch (type) {
    case 'word_reviewed': momentum.wordsReviewed += count; break;
    case 'word_learned':  momentum.wordsLearned += count; break;
    case 'word_mastered': momentum.wordsMastered += count; break;
    case 'ayah_read':     momentum.ayahsRead += count; break;
    case 'lesson_completed': momentum.lessonsCompleted += count; break;
    case 'review_completed': momentum.reviewsCompleted += count; break;
  }

  _saveMomentum(momentum);
}

/**
 * Get today's learning momentum summary.
 * Returns { wordsReviewed, wordsLearned, wordsMastered, ayahsRead, lessonsCompleted, reviewsCompleted }
 * All default to 0 if no data exists.
 */
function getMomentum() {
  var m = loadMomentum();
  return m ? {
    wordsReviewed: m.wordsReviewed || 0,
    wordsLearned: m.wordsLearned || 0,
    wordsMastered: m.wordsMastered || 0,
    ayahsRead: m.ayahsRead || 0,
    lessonsCompleted: m.lessonsCompleted || 0,
    reviewsCompleted: m.reviewsCompleted || 0,
  } : {
    wordsReviewed: 0, wordsLearned: 0, wordsMastered: 0,
    ayahsRead: 0, lessonsCompleted: 0, reviewsCompleted: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// PART 7: REDUCE REPETITION — Track card dismissal in localStorage
// ═══════════════════════════════════════════════════════════════

var _DISMISS_KEY = 'bayan_dismissed_cards';

function _loadDismissedCards() {
  try {
    var raw = localStorage.getItem(_DISMISS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

function _saveDismissedCards(cards) {
  try {
    localStorage.setItem(_DISMISS_KEY, JSON.stringify(cards));
  } catch (e) { /* ignore */ }
}

/**
 * Check if a card has been dismissed.
 * @param {string} cardId - Unique card identifier (e.g., 'quran-encourage')
 * @param {number} [cooldownHours=24] - Show again after this many hours
 * @returns {boolean} Whether the card should be hidden
 */
function isCardDismissed(cardId, cooldownHours) {
  cooldownHours = cooldownHours || 24;
  var cards = _loadDismissedCards();
  var entry = cards[cardId];
  if (!entry) return false;
  // If cooldown has elapsed, consider it not dismissed
  var elapsed = Date.now() - entry.dismissedAt;
  if (elapsed >= cooldownHours * 60 * 60 * 1000) {
    delete cards[cardId];
    _saveDismissedCards(cards);
    return false;
  }
  return true;
}

/**
 * Mark a card as dismissed.
 * @param {string} cardId - Unique card identifier
 */
function dismissCard(cardId) {
  var cards = _loadDismissedCards();
  cards[cardId] = { dismissedAt: Date.now() };
  _saveDismissedCards(cards);
}

// ═══════════════════════════════════════════════════════════════
// PART 1: CENTRALIZED LEARNING STATE
// ═══════════════════════════════════════════════════════════════

/**
 * Get the complete learning journey state.
 * Every screen can call this instead of calculating separately.
 *
 * Returns {
 *   phase: 'new' | 'foundation' | 'foundation-complete' | 'advanced',
 *   stage: { label, icon },
 *   foundation: { completed, total, percent, currentLesson, complete },
 *   vocabulary: { mastered, totalWords, coverage, comprehension },
 *   reviews: { due, overdue, reviewsToday, forecastPreview },
 *   dailyGoal: { target, progress, percent, remaining },
 *   nextAction: { type, label, description },
 *   momentum: { ...getMomentum() },
 *   learningPreferences: { ... },
 *   hasLearningEvidence: boolean,
 * }
 */
function getLearningJourneyState() {
  // ── Gather SRS stats ──
  var $srsStats = (window.__srs && window.__srs.getStats)
    ? window.__srs.getStats() : {};
  var $mastered = $srsStats.mature || 0;
  var $dueToday = $srsStats.dueToday || 0;
  var $reviewsToday = $srsStats.reviewsToday || 0;
  var $totalReviews = $srsStats.totalReviews || 0;
  var $overdue = $srsStats.overdue || 0;

  // ── Foundation data ──
  var $fTotal = typeof getFoundationLessonCount === 'function'
    ? getFoundationLessonCount() : 0;
  var $fCompleted = typeof getCompletedFoundationLessonCount === 'function'
    ? getCompletedFoundationLessonCount() : 0;
  var $fPct = $fTotal > 0 ? Math.round(($fCompleted / $fTotal) * 100) : 0;
  var $fNextIdx = typeof getNextIncompleteFoundationLesson === 'function'
    ? getNextIncompleteFoundationLesson() : 0;
  var $foundationComplete = $fTotal > 0 && $fCompleted >= $fTotal;

  // ── Coverage ──
  var $coverage = typeof calculateCoverage === 'function'
    ? calculateCoverage() : null;
  var $comprehension = $coverage ? $coverage.estimatedComprehension || 0 : 0;
  var $coveragePct = $coverage ? $coverage.coveragePercent || 0 : 0;
  var $totalWords = $coverage ? $coverage.totalWords || 0 : (
    typeof getCanonicalWordCount === 'function'
      ? getCanonicalWordCount() : 0
  );

  // ── Due reviews ──
  var $dueReviews = typeof getDueReviews === 'function'
    ? getDueReviews() : [];
  var $dueCount = $dueReviews.length;

  // ── Daily goal ──
  var $goalProgress = null;
  if (window.__adaptive && window.__adaptive.getDashboardData) {
    var $ad = window.__adaptive.getDashboardData();
    $goalProgress = $ad ? $ad.goalProgress : null;
  }
  var $dailyGoalTarget = 25;
  var $dailyGoalProgress = $reviewsToday;
  if ($goalProgress && $goalProgress.targetMinutes) {
    $dailyGoalTarget = $goalProgress.targetMinutes;
    $dailyGoalProgress = $goalProgress.progressMinutes || 0;
  } else if ($dueCount > 0) {
    $dailyGoalTarget = Math.max($dueCount, 10);
    $dailyGoalProgress = $reviewsToday;
  }
  var $goalPct = Math.min(100, $dailyGoalTarget > 0
    ? Math.round(($dailyGoalProgress / $dailyGoalTarget) * 100) : 0);
  var $goalRemaining = Math.max(0, $dailyGoalTarget - $dailyGoalProgress);

  // ── Learning preferences ──
  var $prefs = (window.__learnerProfile && window.__learnerProfile.getPreferences)
    ? window.__learnerProfile.getPreferences() : null;

  // ── Determine phase ──
  var $noProgress = $fCompleted === 0 && $mastered === 0 && $totalReviews === 0;
  var $phase = 'new';
  var $stageLabel = 'Beginning your journey';
  var $stageIcon = '🌱';

  if ($foundationComplete) {
    $phase = 'foundation-complete';
    $stageLabel = 'Independent Quran learner';
    $stageIcon = '📖';
  } else if ($fTotal > 0) {
    $phase = 'foundation';
    if ($fPct >= 50) {
      $stageLabel = 'Building strong foundation';
      $stageIcon = '🏗️';
    } else if ($fCompleted > 0) {
      $stageLabel = 'Building your foundation';
      $stageIcon = '🌟';
    }
  }

  // ── Next action (priority order: due reviews > resume lesson > continue foundation > quran > explore) ──
  var $nextAction = { type: 'explore', label: 'Explore vocabulary', description: 'Discover new words and root families.' };

  if ($dueCount > 0) {
    $nextAction = {
      type: 'review',
      label: 'Review ' + $dueCount + ' Word' + ($dueCount !== 1 ? 's' : ''),
      description: $dueCount + ' word' + ($dueCount !== 1 ? 's' : '') + ' due for reinforcement' +
        ($overdue > 0 ? ' (' + $overdue + ' overdue)' : ''),
    };
  } else if ($fTotal > 0 && !$foundationComplete && $fCompleted > 0) {
    $nextAction = {
      type: 'foundation',
      label: 'Continue Lesson ' + ($fNextIdx + 1),
      description: 'Foundation ' + $fPct + '% complete',
    };
  } else if ($noProgress) {
    $nextAction = {
      type: 'foundation',
      label: 'Start Foundation Course',
      description: 'Begin mastering the most frequent Quranic words',
    };
  } else if ($foundationComplete) {
    $nextAction = {
      type: 'reading',
      label: 'Read the Quran',
      description: 'Apply your vocabulary knowledge through real reading',
    };
  }

  return {
    phase: $phase,
    stage: { label: $stageLabel, icon: $stageIcon },
    foundation: {
      completed: $fCompleted,
      total: $fTotal,
      percent: $fPct,
      currentLesson: $fNextIdx + 1,
      complete: $foundationComplete,
    },
    vocabulary: {
      mastered: $mastered,
      totalWords: $totalWords,
      coverage: $coveragePct,
      comprehension: $comprehension,
    },
    reviews: {
      due: $dueCount,
      overdue: $overdue,
      reviewsToday: $reviewsToday,
      totalReviews: $totalReviews,
    },
    dailyGoal: {
      target: $dailyGoalTarget,
      progress: $dailyGoalProgress,
      percent: $goalPct,
      remaining: $goalRemaining,
    },
    nextAction: $nextAction,
    momentum: getMomentum(),
    learningPreferences: $prefs ? {
      dailyGoalMinutes: $prefs.dailyGoalMinutes,
      knowledgeLevel: $prefs.knowledgeLevelLabel,
      source: $prefs.source,
    } : null,
    hasLearningEvidence: $fCompleted > 0 || $mastered >= 3 || $totalReviews >= 5,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__learningJourney = {
  getCurrentState: getLearningJourneyState,
  recordMomentum: recordMomentum,
  getMomentum: getMomentum,
  isCardDismissed: isCardDismissed,
  dismissCard: dismissCard,
};
