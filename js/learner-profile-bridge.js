// ═══════════════════════════════════════════════════════════════
// learner-profile-bridge.js — Onboarding → Adaptive Engine Bridge
//
// Bridges the onboarding flow (ux-polish.js) with the adaptive
// learning engine (adaptive-engine.js). Uses onboarding answers
// as initial preferences until real learning data accumulates.
//
// All preferences are queryable via getLearnerPreferences() so
// any system (dashboard, adaptive engine, SRS) can consult them.
//
// Decay function: once sufficient real learning evidence exists
// (reviews, lessons completed, words mastered), onboarding
// preferences become irrelevant — the adaptive engine's
// data-driven decisions take over naturally.
// ═══════════════════════════════════════════════════════════════

// ── Storage keys (shared with ux-polish.js via bundle scope) ──
// _ONBOARDING_GOAL_KEY and _ONBOARDING_LEVEL_KEY are declared in
// ux-polish.js and are accessible in the concatenated bundle scope.

// ── Evidence thresholds ───────────────────────────────────────
// Once the learner exceeds ANY of these, onboarding preferences
// are considered superseded by real learning data.
var _MIN_TOTAL_REVIEWS = 10;
var _MIN_LESSONS_COMPLETED = 1;
var _MIN_WORDS_MASTERED = 5;

// ═══════════════════════════════════════════════════════════════
// LEARNING EVIDENCE CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Determine whether the user has sufficient learning evidence to
 * override onboarding preferences with real performance data.
 *
 * Returns an object with { hasSufficientEvidence, detail }.
 */
function getLearningEvidence() {
  var srsStats = (window.__srs && window.__srs.getStats)
    ? window.__srs.getStats() : {};

  var totalReviews = srsStats.totalReviews || 0;
  var mastered = srsStats.mature || 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function'
    ? getCompletedFoundationLessonCount() : 0;

  var hasEvidence = totalReviews >= _MIN_TOTAL_REVIEWS ||
                    fCompleted >= _MIN_LESSONS_COMPLETED ||
                    mastered >= _MIN_WORDS_MASTERED;

  return {
    hasSufficientEvidence: hasEvidence,
    totalReviews: totalReviews,
    foundationLessonsCompleted: fCompleted,
    masteredWords: mastered,
    detail: hasEvidence
      ? 'Real learning data available — onboarding preferences superseded'
      : 'Insufficient evidence — using onboarding preferences as defaults',
  };
}

// ═══════════════════════════════════════════════════════════════
// LEARNER PREFERENCES
// ═══════════════════════════════════════════════════════════════

/**
 * Map onboarding knowledge level string to difficulty profile.
 * These influence initial recommendations and session sizing
 * until real learning data takes over.
 */
var _knowledgeLevelMap = {
  'beginner': {
    label: 'Beginner',
    initialDifficultyInfluence: 0,  // 0 = no influence (let engine decide)
    defaultReviewLimit: 10,
    defaultSessionSize: 10,
    recommendedPath: 'foundation',
  },
  'some': {
    label: 'Some Knowledge',
    initialDifficultyInfluence: 15,
    defaultReviewLimit: 15,
    defaultSessionSize: 15,
    recommendedPath: 'foundation',
  },
  'intermediate': {
    label: 'Intermediate',
    initialDifficultyInfluence: 30,
    defaultReviewLimit: 20,
    defaultSessionSize: 18,
    recommendedPath: 'foundation',
  },
  'advanced': {
    label: 'Advanced',
    initialDifficultyInfluence: 45,
    defaultReviewLimit: 25,
    defaultSessionSize: 20,
    recommendedPath: 'foundation',
  },
};

/**
 * Map onboarding goal (minutes as string) to learning parameters.
 */
var _goalMap = {
  '5':  { minutes: 5,  reviewLimit: 10, sessionSize: 8 },
  '10': { minutes: 10, reviewLimit: 15, sessionSize: 12 },
  '15': { minutes: 15, reviewLimit: 20, sessionSize: 15 },
  '20': { minutes: 20, reviewLimit: 25, sessionSize: 20 },
};

/**
 * Get the learner's current preferences.
 *
 * Returns { source, dailyGoalMinutes, knowledgeLevel,
 *           reviewLimit, sessionSize, hasSufficientEvidence,
 *           recommendedPath }
 *
 * - source: 'onboarding' | 'evidence'
 * - Returns onboarding preferences when learning data is
 *   insufficient, or evidence-based defaults otherwise.
 */
function getLearnerPreferences() {
  var evidence = getLearningEvidence();

  // Read onboarding data from localStorage
  var onboardingGoal = null;
  var onboardingLevel = null;
  try {
    onboardingGoal = localStorage.getItem(_ONBOARDING_GOAL_KEY);
    onboardingLevel = localStorage.getItem(_ONBOARDING_LEVEL_KEY);
  } catch (e) { /* localStorage may be unavailable */ }

  // Apply defaults if onboarding not completed
  var goal = _goalMap[onboardingGoal] || _goalMap['10'];
  var level = _knowledgeLevelMap[onboardingLevel] || _knowledgeLevelMap['beginner'];

  // If sufficient evidence exists, onboarding is superseded
  if (evidence.hasSufficientEvidence) {
    return {
      source: 'evidence',
      dailyGoalMinutes: goal.minutes,
      knowledgeLevel: onboardingLevel || 'beginner',
      knowledgeLevelLabel: level.label,
      reviewLimit: level.defaultReviewLimit,
      sessionSize: level.defaultSessionSize,
      recommendedPath: level.recommendedPath,
      hasSufficientEvidence: true,
      evidence: evidence,
    };
  }

  // No real data yet — use onboarding preferences
  return {
    source: 'onboarding',
    dailyGoalMinutes: goal.minutes,
    knowledgeLevel: onboardingLevel || 'beginner',
    knowledgeLevelLabel: level.label,
    reviewLimit: goal.reviewLimit,
    sessionSize: goal.sessionSize,
    recommendedPath: level.recommendedPath,
    hasSufficientEvidence: false,
    evidence: evidence,
  };
}

// ═══════════════════════════════════════════════════════════════
// APPLY ONBOARDING TO ADAPTIVE ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Called when onboarding completes. Applies the user's selected
 * goal to the adaptive engine's personal goal system so that:
 *   - Daily goal card reflects the selected study time
 *   - Review limit is adjusted
 *   - Session size is personalized
 *
 * This is the single integration point between onboarding and
 * the rest of the application.
 */
function applyOnboardingToAdaptiveEngine() {
  var prefs = getLearnerPreferences();

  // Map minutes to adaptive goal type
  var goalTypeMap = {
    5:  '10min',
    10: '15min',
    15: '20min',
    20: '30min',
  };
  var goalType = goalTypeMap[prefs.dailyGoalMinutes] || 'balanced';

  // Apply to adaptive engine
  if (window.__adaptive && window.__adaptive.setUserGoal) {
    window.__adaptive.setUserGoal(goalType);
    window.__DEV__ && console.log('[learner-profile] Applied onboarding goal:', goalType, '(', prefs.dailyGoalMinutes, 'min)');
  }

  // Also ensure SRS daily review limit reflects onboarding
  if (window.__srs && window.__srs.updateDailyReviewLimit) {
    window.__srs.updateDailyReviewLimit(prefs.reviewLimit);
    window.__DEV__ && console.log('[learner-profile] Set daily review limit:', prefs.reviewLimit);
  }

  // Note: sessionSize is available via getLearnerPreferences() for
  // future use by SRS session sizing or lesson generation systems.
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__learnerProfile = {
  getPreferences: getLearnerPreferences,
  getEvidence: getLearningEvidence,
  applyOnboarding: applyOnboardingToAdaptiveEngine,
};
