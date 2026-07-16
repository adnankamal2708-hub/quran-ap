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
