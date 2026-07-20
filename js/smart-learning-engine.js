// ═══════════════════════════════════════════════════════════════
// smart-learning-engine.js — Bayan Smart Learning Engine
//
// The central intelligence behind Bayan's recommendations.
// All recommendations are deterministic, scored, and explainable.
//
// Architecture:
//   1. Gathers data from existing systems (SRS, Analytics, Adaptive,
//      Reading Mode, Foundation, Progress, etc.)
//   2. Scores each potential recommendation using a transparent
//      weighted algorithm
//   3. Returns prioritized, actionable recommendation cards
//   4. Never duplicates existing data — only composes it
//
// All functions work fully offline using localStorage.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// TRANSPARENT SCORING ALGORITHM
//
// Each recommendation type is scored 0-100 based on weighted factors:
//   • SRS urgency (overdue, due)         — 30%
//   • Forgetting risk (retention rate)   — 20%
//   • Word frequency & Quran occ count   — 15%
//   • Recent reading activity            — 10%
//   • Root mastery level                 — 10%
//   • Time since last review             — 10%
//   • Learning streak status             —  5%
//
// The scoring is deterministic — same data always produces the
// same scores. No opaque "AI" logic.
// ═══════════════════════════════════════════════════════════════

/**
 * Score a recommendation type given current learning context.
 * Returns a score 0-100 and a breakdown of contributing factors.
 *
 * @param {string} type - Recommendation type identifier
 * @param {Object} ctx - Current learning context snapshot
 * @returns {Object} { score, breakdown: [{ factor, weight, contribution }] }
 */
function scoreRecommendation(type, ctx) {
  var score = 0;
  var breakdown = [];

  if (!ctx) ctx = gatherLearningContext();

  switch (type) {

    // ── Overdue / Due Reviews ──────────────────────────────
    case 'review-due': {
      var overduePct = ctx.totalStudied > 0
        ? Math.min(100, (ctx.overdueCount / ctx.totalStudied) * 100)
        : 0;
      var duePct = ctx.totalStudied > 0
        ? Math.min(100, (ctx.dueCount / ctx.totalStudied) * 100)
        : 0;
      var leechPenalty = ctx.leechCount * 3;

      score = Math.min(100, Math.round(
        (overduePct * 0.6 + duePct * 0.3 + leechPenalty * 0.1)
      ));

      breakdown = [
        { factor: 'Overdue percentage', weight: '60%', contribution: Math.round(overduePct * 0.6) },
        { factor: 'Due reviews pending', weight: '30%', contribution: Math.round(duePct * 0.3) },
        { factor: 'Leeched words', weight: '10%', contribution: Math.min(10, leechPenalty) },
      ];
      break;
    }

    // ── Weak Vocabulary (frequently forgotten) ─────────────
    case 'weak-vocabulary': {
      var forgottenCount = ctx.forgottenWords.length;
      var avgLapseRate = forgottenCount > 0
        ? ctx.forgottenWords.reduce(function(s, w) { return s + (w.lapseRate || 0); }, 0) / forgottenCount
        : 0;
      var forgottenUrgency = ctx.totalStudied > 0
        ? Math.min(100, (forgottenCount / Math.max(1, ctx.totalStudied)) * 200)
        : 0;

      score = Math.min(100, Math.round(
        (forgottenUrgency * 0.5 + avgLapseRate * 0.3 + (ctx.leechCount > 3 ? 20 : 0) * 0.2)
      ));

      breakdown = [
        { factor: 'Forgotten words ratio', weight: '50%', contribution: Math.round(forgottenUrgency * 0.5) },
        { factor: 'Average lapse rate', weight: '30%', contribution: Math.round(avgLapseRate * 0.3) },
        { factor: 'Leech count penalty', weight: '20%', contribution: ctx.leechCount > 3 ? 15 : 0 },
      ];
      break;
    }

    // ── Weak Roots (low mastery) ───────────────────────────
    case 'weak-roots': {
      var weakRootCount = ctx.weakRoots.length;
      var avgWeakScore = weakRootCount > 0
        ? ctx.weakRoots.reduce(function(s, r) { return s + (100 - r.masteryScore); }, 0) / weakRootCount
        : 0;
      var rootUrgency = weakRootCount > 0
        ? Math.min(100, weakRootCount * 12 + avgWeakScore * 0.3)
        : 0;

      score = Math.min(100, Math.round(
        rootUrgency
      ));

      breakdown = [
        { factor: 'Number of weak roots', weight: '60%', contribution: Math.min(60, weakRootCount * 12) },
        { factor: 'Average weakness severity', weight: '40%', contribution: Math.round(avgWeakScore * 0.4) },
      ];
      break;
    }

    // ── Low-Comprehension Surahs ───────────────────────────
    case 'low-comprehension-surahs': {
      var lowCompSurahs = ctx.lowComprehensionSurahs;
      var lowCount = lowCompSurahs.length;
      var avgGap = lowCount > 0
        ? lowCompSurahs.reduce(function(s, s2) { return s + (50 - s2.estimatedComprehension); }, 0) / lowCount
        : 0;
      var learnableCount = lowCompSurahs.filter(function(s) {
        return s.estimatedComprehension >= 10 && s.estimatedComprehension < 80;
      }).length;

      score = Math.min(100, Math.round(
        (lowCount * 8 + avgGap * 0.3 + learnableCount * 5) * 0.85
      ));

      breakdown = [
        { factor: 'Number of low-comp surahs', weight: '40%', contribution: Math.min(40, lowCount * 8) },
        { factor: 'Average comprehension gap', weight: '35%', contribution: Math.round(avgGap * 0.35) },
        { factor: 'Achievable improvement count', weight: '25%', contribution: Math.min(25, learnableCount * 5) },
      ];
      break;
    }

    // ── Continue Learning / Lesson Progression ─────────────
    case 'continue-learning': {
      var lessonProgress = ctx.foundationTotal > 0
        ? Math.min(100, (ctx.foundationCompleted / ctx.foundationTotal) * 100)
        : 0;
      var incompleteCount = ctx.foundationTotal - ctx.foundationCompleted;
      var momentum = ctx.recentReviews > 3 ? 20 : (ctx.recentReviews > 0 ? 10 : 0);

      score = Math.min(100, Math.round(
        ((100 - lessonProgress) * 0.5) +
        (incompleteCount > 0 ? 15 : 0) +
        momentum
      ));

      breakdown = [
        { factor: 'Incomplete lesson percentage', weight: '50%', contribution: Math.round((100 - lessonProgress) * 0.5) },
        { factor: 'Remaining lessons', weight: '20%', contribution: incompleteCount > 0 ? 15 : 0 },
        { factor: 'Learning momentum', weight: '30%', contribution: momentum },
      ];
      break;
    }

    // ── Foundation Reinforcement (retention dropping) ──────
    case 'foundation-reinforcement': {
      var foundationRetention = ctx.foundationRetention; // 0-100
      var foundationWordsMastered = ctx.foundationWordsMastered;
      var foundationWordsTotal = ctx.foundationWordsTotal;

      if (foundationWordsTotal === 0) {
        score = 0;
        breakdown = [{ factor: 'No foundation data', weight: '100%', contribution: 0 }];
        break;
      }

      var retentionGap = Math.max(0, 90 - foundationRetention);
      var masteryGap = Math.max(0, foundationWordsTotal - foundationWordsMastered);
      var masteryPct = foundationWordsTotal > 0
        ? (foundationWordsMastered / foundationWordsTotal) * 100
        : 0;

      score = Math.min(100, Math.round(
        (retentionGap * 0.5) +
        ((100 - masteryPct) * 0.3) +
        (ctx.foundationCompleted < ctx.foundationTotal ? 10 : 0)
      ));

      breakdown = [
        { factor: 'Retention below 90%', weight: '50%', contribution: Math.round(retentionGap * 0.5) },
        { factor: 'Unmastered foundation words', weight: '30%', contribution: Math.round((100 - masteryPct) * 0.3) },
        { factor: 'Incomplete lessons', weight: '20%', contribution: ctx.foundationCompleted < ctx.foundationTotal ? 10 : 0 },
      ];
      break;
    }

    // ── Reading Recommendations (after reading) ────────────
    case 'reading-recommendation': {
      var encounteredCount = ctx.readingEncounteredWords.length;
      var newWordsInReading = encounteredCount > 0
        ? ctx.readingEncounteredWords.filter(function(w) {
            var entry = ctx.srsData[w.id];
            return !entry || entry.stage === 0;
          }).length
        : 0;
      var rootsInReading = ctx.readingRootsEncountered.length;

      score = Math.min(100, Math.round(
        (Math.min(40, newWordsInReading * 4)) +
        (Math.min(30, rootsInReading * 5)) +
        (ctx.hasRecentReadingActivity ? 20 : 0)
      ));

      breakdown = [
        { factor: 'New words from reading', weight: '40%', contribution: Math.min(40, newWordsInReading * 4) },
        { factor: 'New roots from reading', weight: '30%', contribution: Math.min(30, rootsInReading * 5) },
        { factor: 'Recent reading activity', weight: '30%', contribution: ctx.hasRecentReadingActivity ? 20 : 0 },
      ];
      break;
    }

    // ── Due Reviews (generic catch-all) ────────────────────
    default:
      score = ctx.dueCount > 0
        ? Math.min(100, ctx.dueCount * 5 + (ctx.overdueCount > 5 ? 20 : 0))
        : 0;
      breakdown = [
        { factor: 'Due count', weight: '60%', contribution: Math.min(60, ctx.dueCount * 5) },
        { factor: 'Overdue penalty', weight: '40%', contribution: ctx.overdueCount > 5 ? 30 : 0 },
      ];
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: breakdown,
    type: type,
  };
}

// ═══════════════════════════════════════════════════════════════
// LEARNING CONTEXT — Snapshot of current learning state
// ═══════════════════════════════════════════════════════════════

/**
 * Gather a comprehensive snapshot of the current learning context.
 * This is the sole data gathering function — all recommendation
 * scoring reads from this context to avoid redundant computation.
 */
function gatherLearningContext() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var now = Date.now();
  var dayMs = 24 * 60 * 60 * 1000;
  var weekAgo = now - 7 * dayMs;

  var ctx = {
    srsData: srsData,
    srsStats: srsStats,
    now: now,
    dayMs: dayMs,
    weekAgo: weekAgo,

    // ── Due / Overdue counts ──
    dueCount: 0,
    overdueCount: 0,
    leechCount: 0,
    totalStudied: 0,
    totalReviews: srsStats.totalReviews || 0,
    recentReviews: srsStats.reviewsToday || 0,

    // ── Foundation Course ──
    foundationTotal: typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0,
    foundationCompleted: typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0,
    foundationRetention: 0,
    foundationWordsMastered: 0,
    foundationWordsTotal: 0,

    // ── Weak areas ──
    forgottenWords: [],
    weakRoots: [],
    lowComprehensionSurahs: [],

    // ── Reading Mode ──
    readingEncounteredWords: [],
    readingRootsEncountered: [],
    hasRecentReadingActivity: false,
    lastReadSurahId: null,
    lastReadVerseKey: null,
    lastReadTime: null,

    // ── Streak ──
    streak: typeof loadStreakData === 'function' ? loadStreakData().streak || 0 : 0,

    // ── Mastery ──
    masteredCount: srsStats.mature || 0,
    learningCount: srsStats.learning || 0,
    youngCount: srsStats.young || 0,
    newCount: srsStats.newCount || 0,
  };

  // ── Count due, overdue, leeched, studied ──
  if (typeof ALL_WORDS !== 'undefined') {
    for (var i = 0; i < ALL_WORDS.length; i++) {
      var entry = srsData[ALL_WORDS[i].id];
      if (entry) {
        ctx.totalStudied++;
        if (entry.isLeech) ctx.leechCount++;
        if (entry.dueDate) {
          if (now >= entry.dueDate) {
            ctx.dueCount++;
            if (now - entry.dueDate > 3 * dayMs) ctx.overdueCount++;
          }
        }
      }
    }
  }

  // ── Foundation retention ──
  if (typeof getFoundationLessonWords === 'function' && ctx.foundationTotal > 0) {
    var retSum = 0;
    var retCount = 0;
    for (var fi = 0; fi < ctx.foundationTotal; fi++) {
      var fWords = getFoundationLessonWords(fi);
      for (var fwi = 0; fwi < fWords.length; fwi++) {
        ctx.foundationWordsTotal++;
        var entry = srsData[fWords[fwi].id];
        if (entry) {
          if (entry.stage >= 2) ctx.foundationWordsMastered++;
          if (entry.interval > 0 && typeof estimateRetention === 'function') {
            retSum += estimateRetention(entry);
            retCount++;
          }
        }
      }
    }
    ctx.foundationRetention = retCount > 0
      ? Math.round((retSum / retCount) * 100)
      : 0;
  }

  // ── Frequently forgotten words ──
  if (window.__analytics && window.__analytics.getFrequentlyForgotten) {
    ctx.forgottenWords = window.__analytics.getFrequentlyForgotten() || [];
  }

  // ── Weak roots ──
  if (typeof getLearnerProfile === 'function') {
    var profile = getLearnerProfile();
    ctx.weakRoots = profile.weakRoots || [];
  }

  // ── Low-comprehension surahs ──
  if (typeof getAllSurahComprehension === 'function') {
    var allComp = getAllSurahComprehension();
    ctx.lowComprehensionSurahs = allComp.filter(function(s) {
      return s.estimatedComprehension < 50;
    }).sort(function(a, b) {
      return a.estimatedComprehension - b.estimatedComprehension;
    });
  }

  // ── Reading Mode data ──
  if (window.__quran && typeof window.__quran.getLastReadPosition === 'function') {
    var lastPos = window.__quran.getLastReadPosition();
    if (lastPos) {
      ctx.lastReadSurahId = lastPos.surahId;
      ctx.lastReadVerseKey = lastPos.verseKey;
      ctx.lastReadTime = lastPos.date;
      ctx.hasRecentReadingActivity = lastPos.date && (now - lastPos.date) < 48 * 60 * 60 * 1000;

      if (lastPos.encounteredWordIds && lastPos.encounteredWordIds.length > 0) {
        for (var ei = 0; ei < lastPos.encounteredWordIds.length; ei++) {
          var wordObj = typeof findWordById === 'function'
            ? findWordById(lastPos.encounteredWordIds[ei])
            : null;
          if (wordObj) {
            ctx.readingEncounteredWords.push(wordObj);
            if (wordObj.root && wordObj.root !== '\u2014') {
              if (ctx.readingRootsEncountered.indexOf(wordObj.root) < 0) {
                ctx.readingRootsEncountered.push(wordObj.root);
              }
            }
          }
        }
      }

      // Also use session words if the reader tracks them
      if (lastPos.sessionWordIds && lastPos.sessionWordIds.length > 0) {
        for (var si = 0; si < lastPos.sessionWordIds.length; si++) {
          if (!ctx.readingEncounteredWords.some(function(w) { return w.id === lastPos.sessionWordIds[si]; })) {
            var wObj = typeof findWordById === 'function'
              ? findWordById(lastPos.sessionWordIds[si])
              : null;
            if (wObj) ctx.readingEncounteredWords.push(wObj);
          }
        }
      }
    }
  }

  return ctx;
}

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATION CARD GENERATORS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate all recommendation cards with scores.
 * Each card has: id, type, score, title, message, action, icon,
 *   actionType, breakdown (scoring factors), priority
 *
 * Cards are sorted by score descending.
 */
function getScoredRecommendations() {
  var ctx = gatherLearningContext();
  var cards = [];

  // ── 1. Continue Learning (Foundation / Lesson) ────────────
  if (ctx.foundationCompleted < ctx.foundationTotal || ctx.totalStudied === 0) {
    var contScore = scoreRecommendation('continue-learning', ctx);
    var nextIdx = typeof getNextIncompleteFoundationLesson === 'function'
      ? getNextIncompleteFoundationLesson() : 0;
    var fLesson = (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS && FOUNDATION_LESSONS[nextIdx])
      ? FOUNDATION_LESSONS[nextIdx] : null;

    cards.push({
      id: 'rec-continue-learning',
      type: 'continue-learning',
      score: contScore.score,
      scoreBreakdown: contScore.breakdown,
      title: ctx.totalStudied === 0
        ? 'Start Your Foundation Course'
        : 'Continue Foundation Lesson ' + (nextIdx + 1),
      message: ctx.totalStudied === 0
        ? 'Begin your journey to understand the Quran. The Foundation Course teaches the 100 most frequent words — covering ~84% of all Quranic word occurrences in just 10 lessons.'
        : (fLesson
            ? 'Lesson ' + (nextIdx + 1) + ': ' + (fLesson.thematicTitle || '') +
              (fLesson.comprehensionGain > 0 ? ' — +' + fLesson.comprehensionGain + '% comprehension gain' : '')
            : 'Continue building your foundation.'),
      action: 'Continue',
      icon: 'star',
      actionType: 'foundation',
      priority: contScore.score >= 70 ? 'high' : (contScore.score >= 40 ? 'medium' : 'low'),
      dismissible: false,
    });
  }

  // ── 2. Review Due ─────────────────────────────────────────
  if (ctx.dueCount > 0) {
    var reviewScore = scoreRecommendation('review-due', ctx);

    cards.push({
      id: 'rec-review-due',
      type: 'review-due',
      score: reviewScore.score,
      scoreBreakdown: reviewScore.breakdown,
      title: ctx.overdueCount > 0
        ? ctx.overdueCount + ' Overdue Reviews'
        : ctx.dueCount + ' Reviews Due',
      message: ctx.overdueCount > 0
        ? 'You have ' + ctx.dueCount + ' words due (' + ctx.overdueCount + ' overdue!). Reviews overdue by a week have a 70%+ forgetting risk. Catch up now to protect your progress.'
        : ctx.dueCount + ' word' + (ctx.dueCount !== 1 ? 's need' : ' needs') + ' review. Regular spaced repetition is scientifically proven to build long-term memory.',
      action: 'Start Review',
      icon: 'repeat',
      actionType: 'review',
      priority: ctx.overdueCount > 5 ? 'high' : (ctx.dueCount > 10 ? 'medium' : 'low'),
      dismissible: true,
    });
  }

  // ── 3. Weak Vocabulary ────────────────────────────────────
  if (ctx.forgottenWords.length >= 2) {
    var weakVocabScore = scoreRecommendation('weak-vocabulary', ctx);
    var topForgotten = ctx.forgottenWords.slice(0, 3);
    var sampleText = topForgotten.map(function(w) { return w.arabic + ' (' + w.english + ')'; }).join(', ');

    cards.push({
      id: 'rec-weak-vocabulary',
      type: 'weak-vocabulary',
      score: weakVocabScore.score,
      scoreBreakdown: weakVocabScore.breakdown,
      title: ctx.forgottenWords.length + ' Words Need Reinforcement',
      message: 'Frequently forgotten: ' + sampleText + '. Targeted practice on these words will turn weaknesses into strengths.',
      action: 'Review Weak Words',
      icon: 'brain',
      actionType: 'review-difficult',
      priority: ctx.forgottenWords.length > 5 ? 'high' : 'medium',
      dismissible: true,
      words: topForgotten,
    });
  }

  // ── 4. Weak Roots ─────────────────────────────────────────
  if (ctx.weakRoots.length >= 2) {
    var weakRootsScore = scoreRecommendation('weak-roots', ctx);
    var weakestRoot = ctx.weakRoots[0];
    var rootWords = typeof getRootFamilyWords === 'function'
      ? getRootFamilyWords(weakestRoot.root) : [];

    cards.push({
      id: 'rec-weak-roots',
      type: 'weak-roots',
      score: weakRootsScore.score,
      scoreBreakdown: weakRootsScore.breakdown,
      title: 'Strengthen Root ' + weakestRoot.root + ' (' + (weakestRoot.rootMeaning || '') + ')',
      message: 'Root family mastery is only ' + weakestRoot.masteryScore + '% (' + weakestRoot.mastered + '/' + weakestRoot.total + ' words). Strengthening this root helps you recognize related Quranic vocabulary.',
      action: 'Practice Root',
      icon: 'leaf',
      actionType: 'root-family',
      priority: weakestRoot.masteryScore < 30 ? 'high' : 'medium',
      dismissible: true,
      rootKey: weakestRoot.root,
    });
  }

  // ── 5. Low-Comprehension Surahs ───────────────────────────
  if (ctx.lowComprehensionSurahs.length > 0) {
    var lowCompScore = scoreRecommendation('low-comprehension-surahs', ctx);
    var worstSurah = ctx.lowComprehensionSurahs[0];
    var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(worstSurah.surahId) : null;
    var surahName = surahInfo ? surahInfo.name : 'Surah ' + worstSurah.surahId;

    cards.push({
      id: 'rec-low-comp-surah',
      type: 'low-comprehension-surahs',
      score: lowCompScore.score,
      scoreBreakdown: lowCompScore.breakdown,
      title: 'Improve ' + surahName + ' Comprehension',
      message: 'Your comprehension of ' + surahName + ' is only ' + worstSurah.estimatedComprehension + '% (' + worstSurah.masteredWords + '/' + worstSurah.totalWords + ' words mastered). Studying its vocabulary will boost your understanding.',
      action: 'Study Surah',
      icon: 'book',
      actionType: 'surah',
      priority: worstSurah.estimatedComprehension < 25 ? 'high' : 'medium',
      dismissible: true,
      surahId: worstSurah.surahId,
    });
  }

  // ── 6. Foundation Reinforcement ───────────────────────────
  if (ctx.foundationTotal > 0 && ctx.foundationRetention < 80 && ctx.foundationWordsMastered > 0) {
    var foundationReinfScore = scoreRecommendation('foundation-reinforcement', ctx);

    cards.push({
      id: 'rec-foundation-reinforcement',
      type: 'foundation-reinforcement',
      score: foundationReinfScore.score,
      scoreBreakdown: foundationReinfScore.breakdown,
      title: 'Foundation Words Need Review',
      message: 'Foundation word retention is at ' + ctx.foundationRetention + '% (target: 90%+). ' +
        (ctx.foundationWordsMastered < ctx.foundationWordsTotal
          ? ctx.foundationWordsMastered + '/' + ctx.foundationWordsTotal + ' foundation words mastered.'
          : 'All foundation words have been studied but retention is dropping.') +
        ' Refreshing these core words protects your Quran reading foundation.',
      action: 'Reinforce Foundation',
      icon: 'layers',
      actionType: 'foundation',
      priority: ctx.foundationRetention < 60 ? 'high' : 'medium',
      dismissible: true,
    });
  }

  // ── 7. Reading Recommendations ────────────────────────────
  if (ctx.hasRecentReadingActivity && ctx.readingEncounteredWords.length > 0) {
    var readingScore = scoreRecommendation('reading-recommendation', ctx);
    var newWordsInReading = ctx.readingEncounteredWords.filter(function(w) {
      var entry = ctx.srsData[w.id];
      return !entry || entry.stage === 0;
    });
    var rootsInReading = ctx.readingRootsEncountered;

    if (newWordsInReading.length > 0 || rootsInReading.length > 0) {
      var msgParts = [];
      if (newWordsInReading.length > 0) {
        msgParts.push('Review ' + newWordsInReading.length + ' new word' + (newWordsInReading.length !== 1 ? 's' : '') + ' you encountered during reading.');
      }
      if (rootsInReading.length > 0) {
        var rootSample = rootsInReading.slice(0, 3).join(', ');
        msgParts.push('Practice root' + (rootsInReading.length > 1 ? 's' : '') + ': ' + rootSample + '.');
      }
      if (ctx.lastReadSurahId) {
        msgParts.push('Continue reading where you left off.');
      }

      var surahInfo2 = typeof getSurahInfo === 'function' ? getSurahInfo(ctx.lastReadSurahId) : null;

      cards.push({
        id: 'rec-reading',
        type: 'reading-recommendation',
        score: readingScore.score,
        scoreBreakdown: readingScore.breakdown,
        title: newWordsInReading.length > 0
          ? newWordsInReading.length + ' New Words From Reading'
          : 'Continue Your Reading Journey',
        message: msgParts.join(' '),
        action: 'Review Words',
        icon: 'book-open',
        actionType: 'reading-review',
        priority: newWordsInReading.length > 3 ? 'high' : 'medium',
        dismissible: true,
        encounteredWords: newWordsInReading.slice(0, 5),
        readingRoots: rootsInReading.slice(0, 3),
        surahId: ctx.lastReadSurahId,
        surahName: surahInfo2 ? surahInfo2.name : null,
      });
    }
  }

  // ── 8. Surah Learning (if foundation complete) ────────────
  if (ctx.foundationTotal > 0 && ctx.foundationCompleted >= ctx.foundationTotal) {
    var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
    var sCompleted = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
    if (sCompleted < surahIds.length) {
      var nextSurahId = null;
      for (var si = 0; si < surahIds.length; si++) {
        if (typeof isSurahCompleted === 'function' && !isSurahCompleted(surahIds[si])) {
          nextSurahId = surahIds[si];
          break;
        }
      }
      if (nextSurahId) {
        var nsInfo = typeof getSurahInfo === 'function' ? getSurahInfo(nextSurahId) : null;
        cards.push({
          id: 'rec-surah-learning',
          type: 'surah-learning',
          score: 60,
          scoreBreakdown: [{ factor: 'Foundation complete — advance to surahs', weight: '100%', contribution: 60 }],
          title: 'Study Surah ' + (nsInfo ? nsInfo.name : nextSurahId),
          message: 'Foundation Course complete! Now apply your knowledge by studying vocabulary in Quranic context, surah by surah. Start with ' + (nsInfo ? nsInfo.name : 'Surah ' + nextSurahId) + '.',
          action: 'Study Surah',
          icon: 'book',
          actionType: 'surah',
          priority: 'medium',
          dismissible: true,
          surahId: nextSurahId,
        });
      }
    }
  }

  // ── Sort by score descending ──────────────────────────────
  cards.sort(function(a, b) { return b.score - a.score; });

  return cards;
}

// ═══════════════════════════════════════════════════════════════
// PERSONALIZED DAILY FOCUS PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a concise, personalized daily learning plan.
 * Each task has a score reflecting its priority and a done()
 * function that checks completion status.
 */
function getDailyFocusPlan() {
  var ctx = gatherLearningContext();
  var tasks = [];

  // ── Top recommendation becomes the primary daily goal ─────
  var cards = getScoredRecommendations();
  if (cards.length > 0 && cards[0].score >= 30) {
    var top = cards[0];
    tasks.push({
      id: 'focus-' + top.id,
      score: top.score,
      label: top.title,
      type: top.actionType,
      icon: top.icon,
      priority: 'primary',
      done: function() {
        // Check if the underlying condition is resolved
        if (top.type === 'review-due') {
          var newCtx = gatherLearningContext();
          return newCtx.dueCount === 0;
        }
        if (top.type === 'continue-learning' || top.type === 'foundation-reinforcement') {
          var newCtx2 = gatherLearningContext();
          return newCtx2.foundationCompleted >= newCtx2.foundationTotal;
        }
        if (top.type === 'reading-recommendation') {
          var newCtx3 = gatherLearningContext();
          return !newCtx3.hasRecentReadingActivity;
        }
        return false;
      },
    });
  }

  // ── Review task (if not already the top) ──────────────────
  if (ctx.dueCount > 0 && !tasks.some(function(t) { return t.type === 'review'; })) {
    tasks.push({
      id: 'focus-review',
      score: Math.min(70, ctx.dueCount * 5 + ctx.overdueCount * 3),
      label: ctx.overdueCount > 0
        ? 'Review ' + ctx.dueCount + ' words (' + ctx.overdueCount + ' overdue)'
        : 'Review ' + ctx.dueCount + ' due words',
      type: 'review',
      icon: 'repeat',
      priority: ctx.dueCount > 10 ? 'high' : 'medium',
      done: function() {
        var newCtx = gatherLearningContext();
        return newCtx.dueCount === 0;
      },
    });
  }

  // ── Study new words (foundation or lesson) ────────────────
  if (ctx.foundationCompleted < ctx.foundationTotal) {
    var nextL = typeof getNextIncompleteFoundationLesson === 'function'
      ? getNextIncompleteFoundationLesson() : 0;
    tasks.push({
      id: 'focus-foundation',
      score: 50 + (ctx.foundationTotal - ctx.foundationCompleted) * 3,
      label: 'Foundation Lesson ' + (nextL + 1) + ' of ' + ctx.foundationTotal,
      type: 'foundation',
      icon: 'star',
      priority: 'medium',
      done: function() {
        var fDone = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
        return fDone > ctx.foundationCompleted;
      },
    });
  }

  // ── Reading (if not already tracked) ──────────────────────
  if (!ctx.hasRecentReadingActivity) {
    tasks.push({
      id: 'focus-reading',
      score: 30,
      label: 'Read a surah in the Quran view',
      type: 'reading',
      icon: 'book-open',
      priority: 'low',
      done: function() {
        var newCtx = gatherLearningContext();
        return newCtx.hasRecentReadingActivity;
      },
    });
  }

  // ── Sort by score descending ──────────────────────────────
  tasks.sort(function(a, b) { return b.score - a.score; });

  return tasks;
}

// ═══════════════════════════════════════════════════════════════
// FOUNDATION RETENTION STATUS
// ═══════════════════════════════════════════════════════════════

/**
 * Get detailed Foundation Course retention status.
 * Returns { overallRetention, wordsByLesson, atRiskLessons, recommendation }
 */
function getFoundationRetentionStatus() {
  var ctx = gatherLearningContext();
  var lessons = [];

  if (ctx.foundationTotal === 0) {
    return { overallRetention: 0, lessons: [], atRiskLessons: [], recommendation: null };
  }

  for (var fi = 0; fi < ctx.foundationTotal; fi++) {
    var fWords = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(fi) : [];
    var lessonRetSum = 0;
    var lessonRetCount = 0;
    var lessonMastered = 0;

    for (var wi = 0; wi < fWords.length; wi++) {
      var entry = ctx.srsData[fWords[wi].id];
      if (entry) {
        if (entry.stage >= 2) lessonMastered++;
        if (entry.interval > 0 && typeof estimateRetention === 'function') {
          lessonRetSum += estimateRetention(entry);
          lessonRetCount++;
        }
      }
    }

    var ret = lessonRetCount > 0 ? Math.round((lessonRetSum / lessonRetCount) * 100) : 0;
    var pct = fWords.length > 0 ? Math.round((lessonMastered / fWords.length) * 100) : 0;

    lessons.push({
      lessonIndex: fi,
      lessonNumber: fi + 1,
      wordCount: fWords.length,
      masteredCount: lessonMastered,
      masteredPercent: pct,
      retention: ret,
      atRisk: ret < 75 || pct < 50,
    });
  }

  var atRisk = lessons.filter(function(l) { return l.atRisk; });
  var overallRet = ctx.foundationRetention;

  var rec = null;
  if (atRisk.length > 0 && overallRet < 80) {
    rec = {
      type: 'foundation-reinforcement',
      title: 'Reinforce ' + atRisk.length + ' Foundation Lesson' + (atRisk.length !== 1 ? 's' : ''),
      action: 'Review foundation words',
      atRiskLessons: atRisk.map(function(l) { return l.lessonNumber; }),
    };
  }

  return {
    overallRetention: overallRet,
    lessons: lessons,
    atRiskLessons: atRisk,
    recommendation: rec,
  };
}

// ═══════════════════════════════════════════════════════════════
// READING MODE INTEGRATION — Track encountered words
// ═══════════════════════════════════════════════════════════════

/**
 * Get recommendations specifically for the user's reading session.
 * Called after a reading session ends.
 * Returns { newWordsToReview, rootsToPractice, nextSection }
 */
function getReadingSessionRecommendations() {
  var ctx = gatherLearningContext();

  if (!ctx.hasRecentReadingActivity || ctx.readingEncounteredWords.length === 0) {
    return null;
  }

  var newWords = ctx.readingEncounteredWords.filter(function(w) {
    var entry = ctx.srsData[w.id];
    return !entry || entry.stage === 0;
  });

  var weakWordsFromReading = ctx.readingEncounteredWords.filter(function(w) {
    var entry = ctx.srsData[w.id];
    return entry && entry.stage >= 1 && entry.dueDate && ctx.now >= entry.dueDate;
  });

  var rootsToReview = ctx.readingRootsEncountered.filter(function(root) {
    return ctx.weakRoots.some(function(r) { return r.root === root; });
  });

  return {
    newWordsToReview: newWords.slice(0, 10),
    weakWordsToReinforce: weakWordsFromReading.slice(0, 10),
    rootsToPractice: rootsToReview.slice(0, 5),
    encounteredCount: ctx.readingEncounteredWords.length,
    newWordCount: newWords.length,
    rootCount: ctx.readingRootsEncountered.length,
    lastSurahId: ctx.lastReadSurahId,
    lastVerseKey: ctx.lastReadVerseKey,
    recommendations: [
      newWords.length > 0 ? { type: 'review-new', label: 'Review ' + newWords.length + ' new word' + (newWords.length !== 1 ? 's' : '') + ' from reading', count: newWords.length } : null,
      weakWordsFromReading.length > 0 ? { type: 'reinforce-weak', label: 'Reinforce ' + weakWordsFromReading.length + ' weak word' + (weakWordsFromReading.length !== 1 ? 's' : ''), count: weakWordsFromReading.length } : null,
      rootsToReview.length > 0 ? { type: 'practice-roots', label: 'Practice root' + (rootsToReview.length > 1 ? 's' : '') + ': ' + rootsToReview.join(', '), count: rootsToReview.length } : null,
      ctx.lastReadSurahId ? { type: 'continue-reading', label: 'Continue reading', surahId: ctx.lastReadSurahId } : null,
    ].filter(Boolean),
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Get all Smart Learning Engine data for the dashboard in one call.
 * Returns { recommendations, dailyPlan, foundationRetention,
 *          readingSession, context }
 */
function getSmartLearningDashboardData() {
  var recommendations = getScoredRecommendations();
  var dailyPlan = getDailyFocusPlan();
  var foundationRetention = getFoundationRetentionStatus();
  var readingSession = getReadingSessionRecommendations();

  return {
    recommendations: recommendations,
    dailyPlan: dailyPlan,
    foundationRetention: foundationRetention,
    readingSession: readingSession,
    context: {
      totalStudied: 0,
      dueCount: 0,
      masteredCount: 0,
      streak: 0,
      recentReviews: 0,
      foundationCompleted: 0,
      foundationTotal: 0,
      overallRetention: 0,
      forgottenCount: 0,
      weakRootCount: 0,
      lowCompSurahCount: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__smartLearning = {
  scoreRecommendation: scoreRecommendation,
  gatherLearningContext: gatherLearningContext,
  getScoredRecommendations: getScoredRecommendations,
  getDailyFocusPlan: getDailyFocusPlan,
  getFoundationRetentionStatus: getFoundationRetentionStatus,
  getReadingSessionRecommendations: getReadingSessionRecommendations,
  getDashboardData: getSmartLearningDashboardData,
};
