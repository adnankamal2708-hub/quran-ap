// ═══════════════════════════════════════════════════════════════
// phase2.js — Phase 2 Learning Engine
//
// Bridges the Foundation Course → Guided Reading → Independent Reading.
//
// After completing the Foundation Course, learners enter the
// Guided Reading stage: a curated sequence of surahs ordered
// by educational value. Each surah has a pre-reading preview
// and a post-surah inline completion card.
//
// Only after completing ALL guided surahs does Phase 2 unlock
// full independent reading with vocabulary expansion recommendations.
//
// Uses existing systems: SRS, Foundation, Comprehension, SURAH_INFO.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 1: GRADUATION STATE
// ═══════════════════════════════════════════════════════════════

/**
 * Check if the user has graduated from the Foundation Course.
 */
function isFoundationGraduate() {
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  return fTotal > 0 && fCompleted >= fTotal;
}

/**
 * Get the learner's current learning phase.
 * Returns: 'foundation' | 'foundation-complete' | 'guided-reading' | 'phase2'
 */
function getLearningPhase() {
  if (!isFoundationGraduate()) return 'foundation';
  if (!isGuidedReadingComplete()) return 'guided-reading';
  return 'phase2';
}

/**
 * Get graduation celebration data.
 * Shows when Foundation is completed for the first time.
 */
function getGraduationData() {
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var compPct = coverage ? coverage.estimatedComprehension || 0 : 0;
  var masteredCount = 0;
  if (window.__srs && window.__srs.getStats) {
    masteredCount = window.__srs.getStats().mature || 0;
  }
  return {
    title: 'Foundation Complete',
    icon: '🎉',
    message: 'You now know the 100 most frequent Quranic words — covering approximately ' + compPct + '% of all Quranic word occurrences.',
    nextStep: 'Begin your Guided Reading journey through the most essential surahs.',
    masteredWords: masteredCount,
    comprehension: compPct,
  };
}

// ═══════════════════════════════════════════════════════════════
// PART 3: PRE-READING SURAH PREVIEW
// ═══════════════════════════════════════════════════════════════

/**
 * Get a pre-reading preview for a surah in the Guided Reading stage.
 *
 * Returns:
 *   surahId, surahName, surahEnglish
 *   totalWords, knownWords, newWords
 *   recurringRoots
 *   estimatedComprehension
 *   difficulty, estMinutes
 *   isGuidedSurah
 */
function getSurahPreview(surahId) {
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(surahId) : null;
  var surahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var guidedInfo = typeof getGuidedSurahInfo === 'function' ? getGuidedSurahInfo(surahId) : null;
  var comprehension = typeof getSurahComprehension === 'function' ? getSurahComprehension(surahId) : null;

  var knownWords = [];
  var newWords = [];
  var rootSet = {};
  var knownRoots = {};

  for (var wi = 0; wi < surahWords.length; wi++) {
    var w = surahWords[wi];
    var entry = srsData[w.id];
    if (entry && entry.stage > 0) {
      knownWords.push(w);
      if (w.root && w.root !== '\u2014') {
        knownRoots[w.root] = true;
      }
    } else {
      newWords.push(w);
      if (w.root && w.root !== '\u2014') {
        rootSet[w.root] = true;
      }
    }
  }

  // Roots that appear in this surah AND were previously studied
  var recurringRoots = [];
  for (var rootKey in rootSet) {
    if (knownRoots[rootKey]) {
      recurringRoots.push(rootKey);
    }
  }

  return {
    surahId: surahId,
    surahName: surahInfo ? surahInfo.name : 'Surah ' + surahId,
    surahEnglish: surahInfo ? surahInfo.english : '',
    totalWords: surahWords.length,
    knownWords: knownWords.length,
    newWords: newWords.length,
    recurringRoots: recurringRoots.slice(0, 5),
    estimatedComprehension: comprehension ? comprehension.estimatedComprehension || 0 : 0,
    difficulty: guidedInfo ? guidedInfo.difficulty : 3,
    estMinutes: guidedInfo ? guidedInfo.estMinutes : Math.max(3, Math.round(surahWords.length / 5)),
    isGuidedSurah: guidedInfo !== null,
    isCompleted: typeof isGuidedSurahCompleted === 'function' && isGuidedSurahCompleted(surahId),
  };
}

// ═══════════════════════════════════════════════════════════════
// PART 4: POST-SURAH COMPLETION SUMMARY
// ═══════════════════════════════════════════════════════════════

/**
 * Get a completion summary after reading a surah.
 * Records the surah as completed in guided reading progress.
 *
 * Returns: { surahName, knownWords, newWords, comprehensionBefore,
 *            comprehensionAfter, gain, recurringRoots, nextSurah }
 */
function getSurahCompletionSummary(surahId) {
  // Record completion
  if (typeof completeGuidedSurah === 'function') {
    completeGuidedSurah(surahId);
  }

  // Get pre-reading stats (calculated before marking complete)
  var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(surahId) : null;
  var surahWords = typeof getSurahWords === 'function' ? getSurahWords(surahId) : [];
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var comprehension = typeof getSurahComprehension === 'function' ? getSurahComprehension(surahId) : null;
  var guidedInfo = typeof getGuidedSurahInfo === 'function' ? getGuidedSurahInfo(surahId) : null;

  var knownCount = 0;
  var newCount = 0;
  var rootSet = {};
  var knownRootsSet = {};
  var newlyLearned = [];

  for (var wi = 0; wi < surahWords.length; wi++) {
    var w = surahWords[wi];
    var entry = srsData[w.id];
    if (entry && entry.stage > 0) {
      knownCount++;
      if (w.root && w.root !== '\u2014') {
        knownRootsSet[w.root] = true;
      }
    } else {
      newCount++;
      newlyLearned.push(w);
      if (w.root && w.root !== '\u2014') {
        rootSet[w.root] = true;
      }
    }
  }

  // Recurring roots (known + new)
  var recurring = [];
  for (var rk in rootSet) {
    if (knownRootsSet[rk]) recurring.push(rk);
  }

  // Next surah recommendation
  var nextSurah = null;
  if (typeof getNextGuidedSurah === 'function') {
    var ns = getNextGuidedSurah();
    if (ns) {
      var nsInfo = typeof getSurahInfo === 'function' ? getSurahInfo(ns.surahId) : null;
      nextSurah = {
        surahId: ns.surahId,
        name: nsInfo ? nsInfo.name : 'Surah ' + ns.surahId,
        difficulty: ns.difficulty,
        estMinutes: ns.estMinutes,
      };
    }
  }

  // Record momentum
  if (window.__learningJourney && window.__learningJourney.recordMomentum && newCount > 0) {
    window.__learningJourney.recordMomentum('ayah_read', surahWords.length);
  }

  return {
    surahId: surahId,
    surahName: surahInfo ? surahInfo.name : 'Surah ' + surahId,
    totalWords: surahWords.length,
    knownWords: knownCount,
    newWords: newCount,
    comprehensionBefore: comprehension ? comprehension.estimatedComprehension || 0 : 0,
    recurringRoots: recurring.slice(0, 3),
    newlyLearned: newlyLearned.slice(0, 5),
    isGuidedSurah: guidedInfo !== null,
    nextSurah: nextSurah,
    isGuidedComplete: typeof isGuidedReadingComplete === 'function' ? isGuidedReadingComplete() : false,
  };
}

// ═══════════════════════════════════════════════════════════════
// PART 5: VOCABULARY EXPANSION
// ═══════════════════════════════════════════════════════════════

/**
 * Get recommended vocabulary words for expansion.
 *
 * Priority:
 *   1. Highest-frequency unknown words from recommended surahs
 *   2. Words appearing across multiple recommended surahs
 *   3. Words sharing roots with already-known words
 *   4. Globally high-frequency unknown words
 *
 * @param {number} limit - Max number of words to return
 * @returns {Array} Sorted array of word objects with relevance scores
 */
function getExpansionVocabulary(limit) {
  limit = limit || 10;
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var allWords = typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : [];
  if (allWords.length === 0) return [];

  // Find unknown words (no SRS entry or stage 0)
  var unknownWords = [];
  for (var wi = 0; wi < allWords.length; wi++) {
    var w = allWords[wi];
    var entry = srsData[w.id];
    if (!entry || entry.stage === 0) {
      unknownWords.push(w);
    }
  }

  if (unknownWords.length === 0) return [];

  // Score each unknown word by relevance
  var scored = [];
  for (var ui = 0; ui < unknownWords.length; ui++) {
    var uw = unknownWords[ui];
    var score = 0;

    // Priority 1: Appears in recommended surahs
    if (uw.surahIds && uw.surahIds.length > 0) {
      for (var si = 0; si < PHASE2_GUIDED_SURAHS.length; si++) {
        if (uw.surahIds.indexOf(PHASE2_GUIDED_SURAHS[si].surahId) >= 0) {
          score += 30; // High priority for recommended surah words
          break;
        }
      }
    }

    // Priority 2: Appears across many surahs (broad utility)
    if (uw.surahCount && uw.surahCount > 1) {
      score += Math.min(20, uw.surahCount * 2);
    } else if (uw.surahIds && uw.surahIds.length > 1) {
      score += Math.min(20, uw.surahIds.length * 2);
    }

    // Priority 3: Shares root with known words
    if (uw.root && uw.root !== '\u2014') {
      for (var rwi = 0; rwi < allWords.length; rwi++) {
        if (allWords[rwi].root === uw.root && srsData[allWords[rwi].id] && srsData[allWords[rwi].id].stage > 0) {
          score += 15;
          break;
        }
      }
    }

    // Priority 4: Global frequency
    if (uw.occ && uw.occ > 0) {
      score += Math.min(15, Math.round(uw.occ / 20));
    }

    // Priority 5: Foundation course words (should already be known but just in case)
    if (uw.foundationLessonId !== undefined && uw.foundationLessonId >= 0) {
      score += 10;
    }

    scored.push({ word: uw, score: score });
  }

  // Sort by score descending, take top N
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, limit).map(function(s) { return s.word; });
}

// ═══════════════════════════════════════════════════════════════
// PART 6: DASHBOARD CARD HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the Phase 2 primary action for the Dashboard.
 * Returns null if Foundation not yet complete.
 */
function getPhase2DashboardAction() {
  if (!isFoundationGraduate()) return null;

  var phase = getLearningPhase();

  if (phase === 'guided-reading') {
    var nextSurah = typeof getNextGuidedSurah === 'function' ? getNextGuidedSurah() : null;
    if (nextSurah) {
      var preview = getSurahPreview(nextSurah.surahId);
      var guidedProgress = typeof getGuidedReadingProgress === 'function' ? getGuidedReadingProgress() : null;
      return {
        type: 'guided-reading',
        title: 'Guided Reading',
        subtitle: 'Surah ' + preview.surahName,
        description: 'Estimated comprehension: ' + preview.estimatedComprehension + '% · ' +
          preview.knownWords + ' of ' + preview.totalWords + ' words known',
        progress: guidedProgress ? guidedProgress.percent + '% complete' : '',
        surahId: nextSurah.surahId,
        icon: '📖',
      };
    }
  }

  if (phase === 'phase2') {
    var expansionWords = getExpansionVocabulary(5);
    var masteredCount = 0;
    if (window.__srs && window.__srs.getStats) {
      masteredCount = window.__srs.getStats().mature || 0;
    }
    return {
      type: 'phase2',
      title: 'Independent Reading',
      subtitle: masteredCount + ' words mastered',
      description: 'Explore any surah. ' + (expansionWords.length > 0 ? expansionWords.length + ' new words recommended.' : 'All vocabulary familiar.'),
      icon: '📚',
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__phase2 = {
  isFoundationGraduate: isFoundationGraduate,
  getLearningPhase: getLearningPhase,
  getGraduationData: getGraduationData,
  getSurahPreview: getSurahPreview,
  getSurahCompletionSummary: getSurahCompletionSummary,
  getExpansionVocabulary: getExpansionVocabulary,
  getPhase2DashboardAction: getPhase2DashboardAction,
};
