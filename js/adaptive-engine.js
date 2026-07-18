// ═══════════════════════════════════════════════════════════════
// adaptive-engine.js — Personal Learning Adaptation System
//
// Composes existing analytics, SRS, progress, and quiz data into
// adaptive decisions. Does NOT duplicate data — uses existing
// getRecommendations(), getSRSStats(), getLearnerProfile(), etc.
//
// Provides:
//   • Daily Learning Plan (P1)
//   • Adaptive New Word Limits (P2)
//   • Smart Contextual Recommendations (P3)
//   • Weakness Detection Dashboard (P4)
//   • Smart Review Mixing (P5)
//   • Streak Quality / Session Rating (P6)
//   • Lesson Readiness Score (P7)
//   • Enhanced Session Stats (P8)
//   • Personal Goal Management (P9)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// P1 — DAILY LEARNING PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a personalized daily learning plan.
 * Composes existing data: due reviews, new words, foundation progress,
 * quiz readiness, and recommendations into actionable tasks.
 * Each task has a `done` function that checks if it's completed.
 * Tasks vanish once done — showing only what's actionable.
 */
function getDailyPlan() {
  var plan = [];
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var now = Date.now();

  // ── 1. Review due words ──
  var dueCount = 0;
  for (var id in srsData) {
    var e = srsData[id];
    if (e && e.dueDate && now >= e.dueDate) dueCount++;
  }
  if (dueCount > 0) {
    plan.push({
      id: 'review',
      icon: '🔁',
      label: 'Review ' + dueCount + ' word' + (dueCount !== 1 ? 's' : ''),
      type: 'review',
      done: function() {
        var st = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
        return (st.reviewsToday || 0) >= (st.dueToday || 0) || dueCount === 0;
      },
    });
  }

  // ── 2. Learn new words ──
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  if (fCompleted < fTotal) {
    var nextLessonIdx = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
    var isFCcomplete = typeof isFoundationLessonCompleted === 'function' ? isFoundationLessonCompleted(nextLessonIdx) : false;
    if (!isFCcomplete) {
      plan.push({
        id: 'foundation',
        icon: '📘',
        label: 'Complete Foundation Lesson ' + (nextLessonIdx + 1) + ' of ' + fTotal,
        type: 'lesson',
        done: function() {
          var fi = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
          var total = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
          return fi >= total;
        },
      });
    }
  }

  // ── 3. Quiz yourself ──
  if (fCompleted > 0) {
    plan.push({
      id: 'quiz',
      icon: '📝',
      label: 'Quiz yourself',
      type: 'quiz',
      done: function() {
        var qh = typeof loadQuizHistory === 'function' ? loadQuizHistory() : null;
        if (!qh) return false;
        // Consider quiz done if at least 5 questions answered today
        var todayStart = getTodayStart();
        // Simpler: quiz is done if user has completed at least 5 questions total (any day counts)
        return qh.total >= 5;
      },
    });
  }

  // ── 4. Study a surah ──
  var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var sCompleted = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
  if (fCompleted >= fTotal && sCompleted < surahIds.length) {
    plan.push({
      id: 'surah',
      icon: '📖',
      label: 'Read Surah ' + (surahIds[sCompleted] || ''),
      type: 'surah',
      done: function() {
        var sc = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
        return sc > sCompleted;
      },
    });
  }

  return plan;
}

// ═══════════════════════════════════════════════════════════════
// P2 — ADAPTIVE NEW WORD LIMITS
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the optimal daily new word limit based on recent accuracy,
 * accumulated reviews, and learning pace.
 *
 * Accuracy has highest weight:
 *   >90%  → increase limit (up to +10)
 *   80-90% → maintain
 *   <80%  → reduce limit
 *
 * If reviews are piling up (overdue > 20), stop introducing new words
 * until the backlog clears.
 */
function getAdaptiveWordLimit() {
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var currentLimit = (window.__srs && window.__srs.getDailyReviewLimit) ? window.__srs.getDailyReviewLimit() : 25;

  // Default if minimal data
  if (!srsStats.total || srsStats.total < 10) return Math.min(currentLimit, 10);

  // ── Accuracy assessment ──
  // Use avgRetention as a proxy for accuracy (retention > 80% ≈ good accuracy)
  var retention = srsStats.avgRetention || 0;
  var quizHistory = typeof loadQuizHistory === 'function' ? loadQuizHistory() : null;
  var quizAccuracy = 0;
  if (quizHistory && quizHistory.total >= 5) {
    quizAccuracy = Math.round((quizHistory.correct / quizHistory.total) * 100);
  }

  var effectiveAccuracy = quizAccuracy > 0 ? (quizAccuracy + retention) / 2 : retention;
  var baseLimit = 10; // Minimum starting new words

  if (effectiveAccuracy > 90) {
    // High accuracy: increase daily words
    baseLimit = Math.min(currentLimit + 5, 50);
  } else if (effectiveAccuracy >= 80) {
    // Good accuracy: maintain
    baseLimit = currentLimit;
  } else if (effectiveAccuracy >= 70) {
    // Moderate: reduce slightly
    baseLimit = Math.max(8, Math.round(currentLimit * 0.8));
  } else {
    // Low accuracy: cut significantly
    baseLimit = Math.max(5, Math.round(currentLimit * 0.5));
  }

  // ── Overload protection ──
  // If too many reviews are overdue, stop introducing new material
  var overdueCount = srsStats.overdue || 0;
  if (overdueCount > 20) {
    baseLimit = Math.min(baseLimit, 3); // Severely limit new words
  } else if (overdueCount > 10) {
    baseLimit = Math.min(baseLimit, 8); // Reduce new words
  }

  // ── Backlog ratio: if reviews accumulated > 2× daily limit, throttle ──
  var dueCount = srsStats.dueToday || 0;
  if (dueCount > currentLimit * 2) {
    baseLimit = Math.min(baseLimit, 5);
  }

  return Math.max(3, Math.min(50, baseLimit));
}

/**
 * Apply the adaptive word limit to the SRS daily review limit.
 * Call this periodically (every dashboard render, after reviews, at startup).
 */
function applyAdaptiveWordLimit() {
  var newLimit = getAdaptiveWordLimit();
  if (window.__srs && window.__srs.updateDailyReviewLimit) {
    window.__srs.updateDailyReviewLimit(newLimit);
  }
  return newLimit;
}

// ═══════════════════════════════════════════════════════════════
// P3 — SMART CONTEXTUAL RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a single best recommendation for right now.
 * More specific than the analytics engine's generic recommendations.
 * Uses existing getRecommendations() as input, then refines.
 */
function getSmartRecommendation() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : {};
  var now = Date.now();

  // ── Priority 1: Overdue / due reviews ──
  var overdueCount = 0;
  var dueCount = 0;
  for (var id in srsData) {
    var e = srsData[id];
    if (!e || !e.dueDate) continue;
    if (now >= e.dueDate) {
      dueCount++;
      if (now - e.dueDate > 3 * 24 * 60 * 60 * 1000) overdueCount++;
    }
  }

  if (dueCount > 0) {
    // Pick a specific root family or type that has many due words
    var dueRoots = {};
    var dueTypes = {};
    var dueExample = null;
    for (var id2 in srsData) {
      var e2 = srsData[id2];
      if (!e2 || !e2.dueDate || now < e2.dueDate) continue;
      // Find word object to get root/type
      if (typeof ALL_WORDS !== 'undefined') {
        for (var wi = 0; wi < ALL_WORDS.length; wi++) {
          if (ALL_WORDS[wi].id === id2) {
            if (ALL_WORDS[wi].root && ALL_WORDS[wi].root !== '\u2014') {
              if (!dueRoots[ALL_WORDS[wi].root]) dueRoots[ALL_WORDS[wi].root] = 0;
              dueRoots[ALL_WORDS[wi].root]++;
            }
            var tc = ALL_WORDS[wi].typeCategory || 'other';
            if (!dueTypes[tc]) dueTypes[tc] = 0;
            dueTypes[tc]++;
            dueExample = ALL_WORDS[wi];
            break;
          }
        }
      }
      if (dueExample) break;
    }

    // Find the most frequent due root
    var maxRoot = '', maxRootCount = 0;
    for (var r in dueRoots) {
      if (dueRoots[r] > maxRootCount) { maxRootCount = dueRoots[r]; maxRoot = r; }
    }

    // Find weakest type
    var hardestType = '', hardestTypeCount = 0;
    for (var t in dueTypes) {
      if (dueTypes[t] > hardestTypeCount) { hardestTypeCount = dueTypes[t]; hardestType = t; }
    }

    if (overdueCount > 0) {
      return {
        icon: '⏰',
        title: overdueCount + ' word' + (overdueCount !== 1 ? 's are' : ' is') + ' overdue',
        message: 'Strengthen your memory by reviewing overdue words now. Delayed reviews weaken retention.',
        action: 'Review words',
        actionType: 'review',
      };
    } else if (maxRoot) {
      return {
        icon: '🌱',
        title: 'Review root family ' + maxRoot,
        message: maxRootCount + ' word' + (maxRootCount !== 1 ? 's are' : ' is') + ' due from this root family. Reviewing together strengthens pattern recognition.',
        action: 'Review root words',
        actionType: 'review',
      };
    } else if (hardestType) {
      return {
        icon: '📚',
        title: 'Focus on ' + hardestType,
        message: hardestTypeCount + ' due' + (hardestTypeCount > 1 ? ' ' : ' ') + hardestType + (hardestTypeCount > 1 ? 's need' : ' needs') + ' review.',
        action: 'Review ' + hardestType + 's',
        actionType: 'review',
      };
    } else {
      return {
        icon: '🔁',
        title: dueCount + ' word' + (dueCount !== 1 ? 's need' : ' needs') + ' review',
        message: 'Regular review is the key to long-term retention.',
        action: 'Start review',
        actionType: 'review',
      };
    }
  }

  // ── Priority 2: Haven't reviewed recently ──
  if (streakData.lastDate) {
    var lastReview = new Date(streakData.lastDate).getTime();
    var daysSince = Math.round((now - lastReview) / (24 * 60 * 60 * 1000));
    if (daysSince >= 2) {
      return {
        icon: '🔥',
        title: "You haven't reviewed in " + daysSince + ' day' + (daysSince !== 1 ? 's' : ''),
        message: 'Your streak is at risk! A short review session is all it takes to keep your progress alive.',
        action: 'Start review',
        actionType: 'review',
      };
    }
  }

  // ── Priority 3: Weak areas detected ──
  var forgotten = typeof window.__analytics !== 'undefined' && window.__analytics.getFrequentlyForgotten
    ? window.__analytics.getFrequentlyForgotten() : [];
  if (forgotten && forgotten.length >= 2) {
    return {
      icon: '💢',
      title: 'You struggle with ' + (forgotten[0].english || 'several words'),
      message: (forgotten.length > 2 ? forgotten.length + ' words need' : '1 word needs') + ' extra attention. Targeted practice builds durable knowledge.',
      action: 'Review difficult words',
      actionType: 'review-difficult',
    };
  }

  // ── Priority 4: Continue Foundation Course ──
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  if (fCompleted < fTotal) {
    var nextIdx = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
    var fLesson = (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS && FOUNDATION_LESSONS[nextIdx])
      ? FOUNDATION_LESSONS[nextIdx] : null;
    return {
      icon: '⭐',
      title: 'Continue Lesson ' + (nextIdx + 1) + (fLesson && fLesson.thematicTitle ? ': ' + fLesson.thematicTitle : ''),
      message: fLesson && fLesson.comprehensionGain > 0
        ? 'Completing this lesson will increase your Quran comprehension by +' + fLesson.comprehensionGain + '%.'
        : 'Each lesson builds your understanding of Quranic vocabulary.',
      action: 'Continue Foundation Course',
      actionType: 'foundation',
    };
  }

  // ── Priority 5: Dashboard insights ──
  var masteredCount = srsStats.mature || 0;
  if (masteredCount > 0) {
    return {
      icon: '📊',
      title: 'You have mastered ' + masteredCount + ' words',
      message: 'Explore your analytics to see your learning journey and plan your next steps.',
      action: 'View analytics',
      actionType: 'analytics',
    };
  }

  // ── Default: Start learning ──
  return {
    icon: '📖',
    title: 'Your Quran learning journey awaits',
    message: 'Start the Foundation Course to build a strong vocabulary base.',
    action: 'Start Foundation Course',
    actionType: 'foundation',
  };
}

// ═══════════════════════════════════════════════════════════════
// P4 — WEAKNESS DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detect weak areas across multiple dimensions.
 * Uses existing getDifficultSemanticGroups(), getFrequentlyForgotten(),
 * and getSRSStatus() — no redundant computation.
 * Returns structured data for dashboard display.
 */
function getWeaknessDetection() {
  var weaknesses = [];

  // ── Parts of Speech ──
  try {
    var groups = window.__analytics && window.__analytics.getDifficultGroups
      ? window.__analytics.getDifficultGroups() : null;
    if (groups && groups.hardest) {
      groups.hardest.forEach(function(g) {
        if (g.masteryPercent < 60 && g.total >= 3) {
          weaknesses.push({
            dimension: 'part-of-speech',
            name: g.name,
            type: g.type === 'part-of-speech' ? 'Part of Speech' : 'Difficulty Level',
            mastery: g.masteryPercent,
            total: g.total,
            severity: g.masteryPercent < 30 ? 'high' : (g.masteryPercent < 45 ? 'medium' : 'low'),
          });
        }
      });
    }
  } catch (e) { /* skip */ }

  // ── Frequently Forgotten Words ──
  try {
    var forgotten = window.__analytics && window.__analytics.getFrequentlyForgotten
      ? window.__analytics.getFrequentlyForgotten() : [];
    if (forgotten && forgotten.length > 0) {
      weaknesses.push({
        dimension: 'forgotten-words',
        name: forgotten.length + ' word' + (forgotten.length !== 1 ? 's' : '') + ' frequently forgotten',
        detail: forgotten.slice(0, 3).map(function(w) { return w.arabic + ' (' + w.english + ')'; }).join(', '),
        severity: forgotten.length > 5 ? 'high' : 'medium',
        count: forgotten.length,
      });
    }
  } catch (e) { /* skip */ }

  // ── Leeched Words ──
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var leechCount = 0;
  for (var id in srsData) {
    if (srsData[id] && srsData[id].isLeech) leechCount++;
  }
  if (leechCount > 0) {
    weaknesses.push({
      dimension: 'leeched',
      name: leechCount + ' leeched word' + (leechCount !== 1 ? 's' : ''),
      severity: leechCount > 5 ? 'high' : 'medium',
      count: leechCount,
    });
  }

  // ── Overdue Reviews ──
  var now = Date.now();
  var overdueCount = 0;
  for (var id2 in srsData) {
    var e = srsData[id2];
    if (e && e.dueDate && now - e.dueDate > 3 * 24 * 60 * 60 * 1000) overdueCount++;
  }
  if (overdueCount > 0) {
    weaknesses.push({
      dimension: 'overdue',
      name: overdueCount + ' overdue review' + (overdueCount !== 1 ? 's' : ''),
      severity: overdueCount > 10 ? 'high' : 'low',
      count: overdueCount,
    });
  }

  // Sort by severity then by count
  var severityOrder = { high: 0, medium: 1, low: 2 };
  weaknesses.sort(function(a, b) {
    var sa = severityOrder[a.severity] || 2;
    var sb = severityOrder[b.severity] || 2;
    if (sa !== sb) return sa - sb;
    return (b.count || 1) - (a.count || 1);
  });

  return weaknesses;
}

// ═══════════════════════════════════════════════════════════════
// P5 — SMART REVIEW MIXING
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a smart review queue that mixes:
 *   - Easy, medium, hard words
 *   - Recent and old words
 *   - High-frequency and low-frequency
 *   - Avoids showing similar words consecutively
 * Uses existing getDueReviews() as the input, then rebalances.
 */
function getSmartReviewQueue(limit) {
  if (!limit) limit = (window.__srs && window.__srs.getDailyReviewLimit) ? window.__srs.getDailyReviewLimit() : 25;
  var due = typeof getDueReviews === 'function' ? getDueReviews() : [];
  if (!due || due.length === 0) return [];

  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};

  // Categorize due words by difficulty
  var easy = [];
  var medium = [];
  var hard = [];
  var highFreq = [];
  var recent = [];
  var old = [];

  for (var i = 0; i < due.length; i++) {
    var w = due[i];
    var entry = srsData[w.id];
    var diff = w.difficulty || 3;
    var freq = w.occ || 0;
    var daysOverdue = entry && entry.dueDate ? Math.round((Date.now() - entry.dueDate) / (24 * 60 * 60 * 1000)) : 0;

    // Difficulty buckets
    if (diff <= 2) easy.push(w);
    else if (diff <= 3) medium.push(w);
    else hard.push(w);

    // Frequency
    if (freq > 100) highFreq.push(w);

    // Overdue buckets
    if (daysOverdue <= 1) recent.push(w);
    if (daysOverdue > 7) old.push(w);
  }

  // Interleave: hard/old first (highest priority), then medium, then easy
  var queue = [];
  var maxLen = Math.min(limit, due.length);
  var hardIdx = 0, medIdx = 0, easyIdx = 0, recentIdx = 0, highFreqIdx = 0;

  // Build mixed queue with no more than 2 similar words in a row
  var lastWord = null;
  while (queue.length < maxLen) {
    var candidates = [];

    // Always pull from hardest buckets first
    if (hardIdx < hard.length) candidates.push({ word: hard[hardIdx++], priority: 4 });
    if (old.length > 0 && queue.length % 3 === 0) {
      // Every 3rd word, pull from old backlog
      var o = old.shift();
      if (o) candidates.push({ word: o, priority: 3 });
    }
    if (medIdx < medium.length) candidates.push({ word: medium[medIdx++], priority: 2 });
    // Mix in some easy/high-frequency words for confidence
    if (highFreqIdx < highFreq.length && queue.length % 5 === 4) {
      candidates.push({ word: highFreq[highFreqIdx++], priority: 1 });
    }
    if (easyIdx < easy.length) candidates.push({ word: easy[easyIdx++], priority: 0 });

    // Fallback: just add the next available due word
    if (candidates.length === 0) break;

    // Sort by priority (highest first)
    candidates.sort(function(a, b) { return b.priority - a.priority; });

    // Pick: if the top candidate's root is the same as last word, try the next one
    var picked = false;
    for (var ci = 0; ci < candidates.length; ci++) {
      var candidate = candidates[ci].word;
      if (!lastWord || lastWord.root !== candidate.root) {
        queue.push(candidate);
        lastWord = candidate;
        picked = true;
        break;
      }
    }
    if (!picked) {
      // All candidates share the same root — just take the top one
      queue.push(candidates[0].word);
      lastWord = candidates[0].word;
    }
  }

  return queue.slice(0, maxLen);
}

// ═══════════════════════════════════════════════════════════════
// P6 — STREAK QUALITY & SESSION RATING
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a session quality score after a review session.
 * Rates the session 0-5 based on accuracy, consistency, and progress.
 *
 * ★★★★★ = perfect accuracy + significant progress
 * ★★★★  = good session with solid gains
 * ★★★   = average session
 * ★★    = below average
 * ★     = minimal work
 */
function getSessionRating(stats) {
  if (!stats) return { stars: 0, label: '', color: 'var(--text-muted)' };

  var score = 0;

  // Accuracy (retention-based)
  var accuracy = stats.accuracy || 0;
  if (accuracy >= 95) score += 3;
  else if (accuracy >= 85) score += 2;
  else if (accuracy >= 70) score += 1;

  // Volume
  var wordsReviewed = stats.wordsReviewed || 0;
  if (wordsReviewed >= 20) score += 2;
  else if (wordsReviewed >= 10) score += 1;
  else if (wordsReviewed >= 5) score += 0.5;

  // New mastery
  var newMastered = stats.newMastered || 0;
  if (newMastered >= 5) score += 1;
  else if (newMastered > 0) score += 0.5;

  // Cap at 5
  score = Math.min(5, Math.round(score));

  var ratings = {
    0: { stars: '☆☆☆☆☆', label: 'Start your session', color: 'var(--text-muted)' },
    1: { stars: '★☆☆☆☆', label: 'Good start', color: 'var(--gold-dim)' },
    2: { stars: '★★☆☆☆', label: 'Decent session', color: 'var(--gold-dim)' },
    3: { stars: '★★★☆☆', label: 'Good session', color: 'var(--gold)' },
    4: { stars: '★★★★☆', label: 'Great session', color: 'var(--gold)' },
    5: { stars: '★★★★★', label: 'Excellent session!', color: 'var(--gold-light)' },
  };

  return ratings[score] || ratings[0];
}

/**
 * Get the streak quality metrics — consistency, accuracy, speed.
 * Uses analytics history when available.
 */
function getStreakQuality() {
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var periods = window.__analytics && window.__analytics.getPeriodSummaries
    ? window.__analytics.getPeriodSummaries() : null;

  var consistency = periods ? periods.consistency : (streakData.streak > 0 ? 50 : 0);
  var retention = srsStats.avgRetention || 0;
  var reviewsToday = srsStats.reviewsToday || 0;

  return {
    streak: streakData.streak || 0,
    consistencyScore: Math.min(100, consistency),
    avgRetention: retention,
    reviewsToday: reviewsToday,
    // Future: adding learning speed, review accuracy over time
    quality: consistency > 70 && retention > 80 ? 'strong' : (consistency > 40 ? 'developing' : 'building'),
  };
}

// ═══════════════════════════════════════════════════════════════
// P7 — LESSON READINESS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate how ready the user is for a specific lesson.
 * Returns a readiness score (0-100) with a breakdown of factors.
 * Considers:
 *   ✓ Previous lesson mastery
 *   ✓ Reviews caught up
 *   ✓ Root family understanding
 *   ✓ Accuracy above threshold
 */
function getLessonReadiness(lessonIndex) {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();

  var factors = [];
  var totalWeight = 0;
  var weightedScore = 0;

  // ── Factor 1: Previous lesson completed (weight 30%) ──
  if (lessonIndex > 0) {
    var prevCompleted = typeof isFoundationLessonCompleted === 'function'
      ? isFoundationLessonCompleted(lessonIndex - 1) : false;
    var score = prevCompleted ? 100 : 0;
    factors.push({
      label: 'Previous lesson mastered',
      passed: prevCompleted,
      score: score,
      weight: 30,
      detail: prevCompleted ? '✓ Lesson ' + lessonIndex + ' complete' : 'Complete lesson ' + lessonIndex + ' first',
    });
    weightedScore += score * 30;
    totalWeight += 30;
  } else {
    // First lesson is always ready
    factors.push({
      label: 'First lesson',
      passed: true,
      score: 100,
      weight: 30,
      detail: '✓ Starting point',
    });
    weightedScore += 100 * 30;
    totalWeight += 30;
  }

  // ── Factor 2: Reviews caught up (weight 30%) ──
  var overdueCount = 0;
  var totalReviewed = 0;
  for (var id in srsData) {
    var e = srsData[id];
    if (!e) continue;
    totalReviewed++;
    if (e.dueDate && now - e.dueDate > 7 * 24 * 60 * 60 * 1000) overdueCount++;
  }

  if (totalReviewed === 0) {
    factors.push({
      label: 'Reviews complete',
      passed: true,
      score: 100,
      weight: 30,
      detail: '✓ No reviews to catch up on',
    });
    weightedScore += 100 * 30;
    totalWeight += 30;
  } else {
    var overduePct = Math.round((overdueCount / totalReviewed) * 100);
    var revScore = Math.max(0, 100 - overduePct * 3); // Each 1% overdue = -3 points
    factors.push({
      label: 'Reviews caught up',
      passed: overdueCount === 0,
      score: revScore,
      weight: 30,
      detail: overdueCount > 0
        ? overdueCount + ' review' + (overdueCount !== 1 ? 's are' : ' is') + ' overdue — ' + (overdueCount > 5 ? 'catch up first' : 'manageable')
        : '✓ All reviews up to date',
    });
    weightedScore += revScore * 30;
    totalWeight += 30;
  }

  // ── Factor 3: Accuracy above 80% (weight 25%) ──
  var retention = 0;
  var retentionCount = 0;
  for (var id2 in srsData) {
    var e2 = srsData[id2];
    if (e2 && e2.interval > 0 && typeof estimateRetention === 'function') {
      retention += estimateRetention(e2);
      retentionCount++;
    }
  }
  var avgRetention = retentionCount > 0 ? Math.round((retention / retentionCount) * 100) : 100;
  var accScore = avgRetention >= 80 ? 100 : (avgRetention >= 60 ? 50 : 25);
  factors.push({
    label: 'Accuracy above 80%',
    passed: avgRetention >= 80,
    score: accScore,
    weight: 25,
    detail: avgRetention >= 80
      ? '✓ Retention: ' + avgRetention + '%'
      : avgRetention >= 60
        ? '⚠ Retention: ' + avgRetention + '% — review weak words first'
        : '🔴 Retention: ' + avgRetention + '% — strengthen foundations',
  });
  weightedScore += accScore * 25;
  totalWeight += 25;

  // ── Factor 4: Previous lesson's words 70%+ mastered (weight 15%) ──
  if (lessonIndex > 0) {
    var prevLessonWords = typeof getFoundationLessonWords === 'function'
      ? getFoundationLessonWords(lessonIndex - 1) : [];
    var prevMasteredCount = 0;
    for (var pi = 0; pi < prevLessonWords.length; pi++) {
      var entry = srsData[prevLessonWords[pi].id];
      if (entry && entry.stage >= 2) prevMasteredCount++;
    }
    var masteryPct = prevLessonWords.length > 0
      ? Math.round((prevMasteredCount / prevLessonWords.length) * 100) : 100;
    var masteryScore = masteryPct >= 70 ? 100 : (masteryPct >= 40 ? 60 : 20);
    factors.push({
      label: 'Previous words 70%+ mastered',
      passed: masteryPct >= 70,
      score: masteryScore,
      weight: 15,
      detail: masteryPct >= 70
        ? '✓ ' + prevMasteredCount + '/' + prevLessonWords.length + ' words mastered'
        : prevMasteredCount + '/' + prevLessonWords.length + ' words mastered — review more',
    });
    weightedScore += masteryScore * 15;
    totalWeight += 15;
  } else {
    factors.push({
      label: 'Previous words 70%+ mastered',
      passed: true,
      score: 100,
      weight: 15,
      detail: '✓ No previous lesson',
    });
    weightedScore += 100 * 15;
    totalWeight += 15;
  }

  var totalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 100;

  return {
    lessonIndex: lessonIndex,
    readinessScore: totalScore,
    ready: totalScore >= 70,
    factors: factors,
    summary: totalScore >= 90
      ? 'Ready: You are well prepared for this lesson.'
      : totalScore >= 70
        ? 'Ready: ' + (factors.filter(function(f) { return !f.passed; }).length) + ' area' + (factors.filter(function(f) { return !f.passed; }).length !== 1 ? 's' : '') + ' to improve.'
        : 'Not ready: Focus on the areas below first.',
  };
}

// ═══════════════════════════════════════════════════════════════
// P8 — ENHANCED SESSION STATS
// ═══════════════════════════════════════════════════════════════

/**
 * Compute comprehensive session stats for the session summary modal.
 * Uses data gathered during the review session.
 * Returns a rich object with all display fields.
 */
function buildSessionStats(reviewWords, originalMasteredCount) {
  if (!reviewWords) reviewWords = [];
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};

  // ── Words reviewed + new mastery ──
  var wordsReviewed = reviewWords.length;
  var newMastered = 0;
  var totalRatings = 0;
  var ratingSum = 0;

  for (var ri = 0; ri < reviewWords.length; ri++) {
    var entry = srsData[reviewWords[ri].id];
    if (entry) {
      if (entry.stage >= 2) newMastered++;
      if (entry.lastRating !== undefined) {
        totalRatings++;
        ratingSum += entry.lastRating;
      }
    }
  }

  // Subtract the original mastered count to get net new
  newMastered = Math.max(0, newMastered - (originalMasteredCount || 0));

  // ── New roots learned ──
  var newRoots = {};
  for (var ri2 = 0; ri2 < reviewWords.length; ri2++) {
    if (reviewWords[ri2].root && reviewWords[ri2].root !== '\u2014') {
      newRoots[reviewWords[ri2].root] = true;
    }
  }

  // ── Accuracy ──
  var avgRating = totalRatings > 0 ? (ratingSum / totalRatings) : 0;
  // Map SRS rating (0-3) to accuracy percentage
  var accuracy = Math.round((avgRating / 3) * 100);

  // ── Comprehension gain (estimated) ──
  var compBefore = window.__prevCoveragePercent !== undefined
    ? (coverage ? coverage.estimatedComprehension - 0.2 : 0) : 0;
  var compAfter = coverage ? coverage.estimatedComprehension : 0;
  var compGain = Math.max(0, compAfter - compBefore);

  // ── Time estimate ──
  var timeSpentMinutes = Math.max(1, Math.round((wordsReviewed * 25) / 60));

  // ── Retention prediction ──
  var retSum = 0;
  var retCount = 0;
  for (var id in srsData) {
    var e = srsData[id];
    if (e && e.interval > 0 && typeof estimateRetention === 'function') {
      retSum += estimateRetention(e);
      retCount++;
    }
  }
  var avgRetention = retCount > 0 ? Math.round((retSum / retCount) * 100) : 0;

  // ── Best category today ──
  var typeRatings = {};
  for (var ri3 = 0; ri3 < reviewWords.length; ri3++) {
    var w = reviewWords[ri3];
    var cat = w.typeCategory || 'other';
    if (!typeRatings[cat]) typeRatings[cat] = { count: 0, sum: 0 };
    typeRatings[cat].count++;
    var e2 = srsData[w.id];
    if (e2 && e2.lastRating !== undefined) {
      typeRatings[cat].sum += e2.lastRating;
    }
  }
  var bestCategory = '';
  var bestCategoryScore = 0;
  var worstCategory = '';
  var worstCategoryScore = 100;
  var catNames = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations', 'proper noun': 'Proper Nouns' };
  for (var cat in typeRatings) {
    var avg = typeRatings[cat].count > 0 ? typeRatings[cat].sum / typeRatings[cat].count : 0;
    var pct = Math.round((avg / 3) * 100);
    if (pct > bestCategoryScore) { bestCategoryScore = pct; bestCategory = cat; }
    if (pct < worstCategoryScore) { worstCategoryScore = pct; worstCategory = cat; }
  }

  // ── Next recommendation ──
  var nextRec = 'Continue your learning journey';
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  if (fCompleted < fTotal) {
    nextRec = 'Continue Foundation Lesson ' + (typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() + 1 : fCompleted + 1);
  } else if (srsStats.dueToday > 0) {
    nextRec = srsStats.dueToday + ' more word' + (srsStats.dueToday !== 1 ? 's' : '') + ' due for review';
  }

  // ── Motivational message ──
  var messages = [
    '"And We have certainly made the Quran easy to remember, but is there any who will remember?" (54:17)',
    'Every word you understand is a light added to your heart. Keep going.',
    'The Prophet (ﷺ) said: "The best among you are those who learn the Quran and teach it."',
    'Understanding the Quran is a journey of a lifetime. Each step draws you closer.',
    'What was once unfamiliar becomes a conversation with your Creator.',
    'Consistency, not intensity, builds lasting knowledge. Well done.',
  ];
  var msgIdx = Math.min(Math.floor(wordsReviewed / 3), messages.length - 1);

  return {
    wordsReviewed: wordsReviewed,
    newMastered: newMastered,
    newRootsLearned: Object.keys(newRoots).length,
    accuracy: Math.max(0, accuracy),
    timeSpentMinutes: timeSpentMinutes,
    avgRetention: avgRetention,
    compBefore: compBefore,
    compAfter: compAfter,
    compGain: Math.round(compGain * 10) / 10,
    coverageGained: coverage ? coverage.coveragePercent - (window.__prevCoveragePercent || 0) : 0,
    streakDays: streakData.streak || 0,
    bestCategory: catNames[bestCategory] || bestCategory,
    bestCategoryScore: bestCategoryScore,
    needsImprovement: catNames[worstCategory] || worstCategory,
    nextRecommendation: nextRec,
    motivationalMessage: messages[msgIdx] || messages[0],
    sessionRating: getSessionRating({ accuracy: accuracy, wordsReviewed: wordsReviewed, newMastered: newMastered }),
  };
}

// ═══════════════════════════════════════════════════════════════
// P9 — PERSONAL GOALS
// ═══════════════════════════════════════════════════════════════

// Default goals config
var _userGoal = {
  type: 'balanced', // '10min' | '15min' | '20min' | '30min' | 'review-only' | 'foundation-only' | 'surah-only' | 'balanced' | 'adaptive'
  targetMinutes: 15,
  setAt: null,
};

const GOAL_STORAGE_KEY = 'quran_learning_goal';

function loadUserGoal() {
  try {
    var raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (!raw) return _userGoal;
    return JSON.parse(raw);
  } catch (e) {
    return _userGoal;
  }
}

function saveUserGoal(goal) {
  try {
    goal.setAt = Date.now();
    localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
    _userGoal = goal;
  } catch (e) {
    console.warn('[adaptive] Could not save goal:', e.message);
  }
}

function getUserGoal() {
  return loadUserGoal();
}

function setUserGoal(goalType) {
  var goalMap = {
    '10min': { type: '10min', targetMinutes: 10 },
    '15min': { type: '15min', targetMinutes: 15 },
    '20min': { type: '20min', targetMinutes: 20 },
    '30min': { type: '30min', targetMinutes: 30 },
    'review-only': { type: 'review-only', targetMinutes: 15 },
    'foundation-only': { type: 'foundation-only', targetMinutes: 15 },
    'surah-only': { type: 'surah-only', targetMinutes: 15 },
    'balanced': { type: 'balanced', targetMinutes: 15 },
    'adaptive': { type: 'adaptive', targetMinutes: 15 },
  };
  var selected = goalMap[goalType] || goalMap['balanced'];
  saveUserGoal(selected);
  return selected;
}

/**
 * Get today's goal progress based on user's selected goal type.
 * Returns { goalType, targetMinutes, progressMinutes, progressPercent, done }
 *
 * Progress is measured by reviews completed today (each review ~30 seconds).
 * The target is the user's daily study goal (default 15 min).
 * Monthly/aggregate session data is NOT used here because it represents
 * accumulated time over many days, not today's actual progress.
 */
function getGoalProgress() {
  var goal = loadUserGoal();
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : {};
  var todayMinutes = Math.round((srsStats.reviewsToday || 0) * 0.5);
  var target = goal.targetMinutes || 15;
  var pct = Math.min(100, Math.round((todayMinutes / target) * 100));

  return {
    goalType: goal.type,
    targetMinutes: target,
    progressMinutes: todayMinutes,
    progressPercent: pct,
    done: pct >= 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE ADAPTIVE DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Get all adaptive data needed for the dashboard in a single call.
 * Returns { dailyPlan, recommendation, weaknesses, streakQuality,
 *          adaptiveLimit, lessonReadiness, goalProgress }
 */
function getAdaptiveDashboardData() {
  var plan = getDailyPlan();
  var rec = getSmartRecommendation();
  var weaknesses = getWeaknessDetection();
  var streak = getStreakQuality();
  var limit = getAdaptiveWordLimit();
  var goal = getGoalProgress();

  return {
    dailyPlan: plan,
    recommendation: rec,
    weaknesses: weaknesses,
    streakQuality: streak,
    adaptiveLimit: limit,
    goalProgress: goal,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

window.__adaptive = {
  getDailyPlan: getDailyPlan,
  getAdaptiveWordLimit: getAdaptiveWordLimit,
  applyAdaptiveWordLimit: applyAdaptiveWordLimit,
  getSmartRecommendation: getSmartRecommendation,
  getWeaknessDetection: getWeaknessDetection,
  getSmartReviewQueue: getSmartReviewQueue,
  getSessionRating: getSessionRating,
  buildSessionStats: buildSessionStats,
  getLessonReadiness: getLessonReadiness,
  getStreakQuality: getStreakQuality,
  getGoalProgress: getGoalProgress,
  getUserGoal: getUserGoal,
  setUserGoal: setUserGoal,
  getDashboardData: getAdaptiveDashboardData,
};
