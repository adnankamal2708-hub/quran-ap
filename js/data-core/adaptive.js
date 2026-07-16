function buildLearnerProfile() {
  var now = Date.now();
  if (_learnerProfile && (now - _profileTimestamp) < PROFILE_CACHE_TTL) {
    return _learnerProfile;
  }
  
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  if (!allWords || allWords.length === 0) {
    return { totalWords: 0, studiedWords: 0, masteryByDimension: {}, weakRoots: [], recommendations: [] };
  }
  
  // ── Dimension Analysis ──────────────────────────────────────
  // Analyze mastery across multiple vocabulary dimensions
  
  /** @type {Object.<string, {total: number, mastered: number, stageSum: number, dueCount: number, retentionSum: number, leechCount: number, lastReviewDate: number, avgLapses: number}>} */
  var byRoot = {};
  var byType = {};
  var byDifficulty = {};
  var byFrequency = {};
  
  var studiedCount = 0;
  var masteredCount = 0;
  var dueCount = 0;
  var leechCount = 0;
  var totalReviews = 0;
  var recentReviewCount = 0; // last 7 days
  var weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  var monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // For forgetting curve: track review recency by stage
  var stage0Count = 0;
  var stage1Count = 0;
  var stage2Count = 0;
  var stage3Count = 0;
  
  // For confused word analysis: words with high lapse rates
  var highLapseWords = [];
  
  // For weak root identification: roots with below-average mastery
  var rootMasteryScores = {};
  
  for (var i = 0; i < allWords.length; i++) {
    var w = allWords[i];
    var entry = srsData[w.id];
    
    // Track per dimension
    var dims = {
      root: w.root && w.root !== '\u2014' ? w.root : null,
      type: w.typeCategory || null,
      difficulty: String(w.difficulty || 3),
      frequency: w.frequency || 'medium',
    };
    
    // Initialize dimension accumulators
    var dimMap = {
      root: byRoot,
      type: byType,
      difficulty: byDifficulty,
      frequency: byFrequency,
    };
    
    Object.keys(dimMap).forEach(function(dimKey) {
      var val = dims[dimKey];
      if (!val) return;
      var map = dimMap[dimKey];
      if (!map[val]) {
        map[val] = { total: 0, mastered: 0, stageSum: 0, dueCount: 0, retentionSum: 0, leechCount: 0, lastReviewDate: 0, avgLapses: 0, lapsesSum: 0, entriesWithEntry: 0 };
      }
      map[val].total++;
      if (entry) {
        map[val].stageSum += entry.stage || 0;
        if (entry.stage >= 2) map[val].mastered++;
        if (entry.dueDate && now >= entry.dueDate) map[val].dueCount++;
        if (entry.isLeech) map[val].leechCount++;
        map[val].lapsesSum += entry.lapses || 0;
        map[val].entriesWithEntry++;
        if (entry.ratedAt && entry.ratedAt > map[val].lastReviewDate) {
          map[val].lastReviewDate = entry.ratedAt;
        }
      }
    });
    
    // Aggregate counts
    if (entry) {
      studiedCount++;
      totalReviews += entry.totalReviews || 0;
      if (entry.stage >= 2) masteredCount++;
      if (entry.dueDate && now >= entry.dueDate) dueCount++;
      if (entry.isLeech) leechCount++;
      if (entry.ratedAt && entry.ratedAt >= weekAgo) recentReviewCount++;
      
      // Stage distribution
      if (entry.stage === 0) stage0Count++;
      else if (entry.stage === 1) stage1Count++;
      else if (entry.stage === 2) stage2Count++;
      else stage3Count++;
      
      // High lapse detection
      var lapseRate = entry.totalReviews > 0 ? (entry.lapses || 0) / entry.totalReviews : 0;
      if (lapseRate > 0.4) {
        highLapseWords.push({
          word: w,
          lapseRate: lapseRate,
          lapses: entry.lapses || 0,
          totalReviews: entry.totalReviews || 0,
          isLeech: !!entry.isLeech,
        });
      }
    } else {
      stage0Count++;
    }
  }
  
  // Compute average lapse rate per root for weak root identification
  Object.keys(byRoot).forEach(function(root) {
    var r = byRoot[root];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    // Mastery score: 0-100, weighted by stage / 3 (max stage) * % studied
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
    rootMasteryScores[root] = r.masteryScore;
  });
  
  Object.keys(byType).forEach(function(t) {
    var r = byType[t];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  Object.keys(byDifficulty).forEach(function(d) {
    var r = byDifficulty[d];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  Object.keys(byFrequency).forEach(function(f) {
    var r = byFrequency[f];
    r.avgLapses = r.entriesWithEntry > 0 ? r.lapsesSum / r.entriesWithEntry : 0;
    var studiedPct = r.entriesWithEntry / Math.max(1, r.total);
    var avgStage = r.entriesWithEntry > 0 ? r.stageSum / r.entriesWithEntry : 0;
    r.masteryScore = Math.round((avgStage / 3) * studiedPct * 100);
  });
  
  // ── Identify Weakest Roots ──────────────────────────────────
  var weakRoots = Object.keys(byRoot)
    .filter(function(r) { return byRoot[r].total >= 2; }) // only roots with 2+ words
    .sort(function(a, b) { return byRoot[a].masteryScore - byRoot[b].masteryScore; })
    .slice(0, 10)
    .map(function(r) {
      return {
        root: r,
        rootMeaning: getRootMeaningForRoot(r),
        masteryScore: byRoot[r].masteryScore,
        total: byRoot[r].total,
        mastered: byRoot[r].mastered,
        avgLapses: Math.round(byRoot[r].avgLapses * 10) / 10,
        dueCount: byRoot[r].dueCount,
      };
    });
  
  // ── Identify Strongest Roots ────────────────────────────────
  var strongRoots = Object.keys(byRoot)
    .filter(function(r) { return byRoot[r].total >= 2; })
    .sort(function(a, b) { return byRoot[b].masteryScore - byRoot[a].masteryScore; })
    .slice(0, 5)
    .map(function(r) {
      return {
        root: r,
        rootMeaning: getRootMeaningForRoot(r),
        masteryScore: byRoot[r].masteryScore,
        total: byRoot[r].total,
        mastered: byRoot[r].mastered,
      };
    });
  
  // ── Identify Frequently Confused Words ──────────────────────
  var confusedWords = highLapseWords
    .sort(function(a, b) { return b.lapseRate - a.lapseRate; })
    .slice(0, 10)
    .map(function(h) {
      return {
        arabic: h.word.arabic,
        english: h.word.english,
        lapseRate: Math.round(h.lapseRate * 100),
        lapses: h.lapses,
        totalReviews: h.totalReviews,
        isLeech: h.isLeech,
        wordId: h.word.id,
      };
    });
  
  // ── Retention by Dimension ──────────────────────────────────
  var retentionByRoot = {};
  Object.keys(byRoot).forEach(function(r) {
    retentionByRoot[r] = byRoot[r].masteryScore;
  });
  var retentionByType = {};
  Object.keys(byType).forEach(function(t) {
    retentionByType[t] = byType[t].masteryScore;
  });
  var retentionByDifficulty = {};
  Object.keys(byDifficulty).forEach(function(d) {
    retentionByDifficulty[d] = byDifficulty[d].masteryScore;
  });
  
  // ── Forgetting Curve Analysis ───────────────────────────────
  // Analyze how many words are overdue by stage
  var totalDue = 0;
  var criticallyOverdue = 0; // overdue > 7 days
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.dueDate && now >= entry.dueDate) {
      totalDue++;
      if (now - entry.dueDate > 7 * 24 * 60 * 60 * 1000) {
        criticallyOverdue++;
      }
    }
  });
  
  // ── Quiz Performance ────────────────────────────────────────
  var quizHistory = typeof loadQuizHistory === 'function' ? loadQuizHistory() : null;
  var quizAccuracy = 0;
  var quizTotalAttempts = 0;
  var quizCorrect = 0;
  if (quizHistory) {
    quizCorrect = quizHistory.correct || 0;
    quizTotalAttempts = quizHistory.total || 0;
    quizAccuracy = quizTotalAttempts > 0 ? Math.round((quizCorrect / quizTotalAttempts) * 100) : 0;
  }
  
  // ── Build Profile ───────────────────────────────────────────
  var profile = {
    // Metadata
    computedAt: now,
    totalWords: allWords.length,
    studiedWords: studiedCount,
    masteredWords: masteredCount,
    
    // Performance metrics
    totalReviews: totalReviews,
    recentReviews: recentReviewCount,
    dueCount: dueCount,
    criticallyOverdue: criticallyOverdue,
    leechCount: leechCount,
    
    // Stage distribution
    stage0: stage0Count,
    stage1: stage1Count,
    stage2: stage2Count,
    stage3: stage3Count,
    
    // Quiz performance
    quizAccuracy: quizAccuracy,
    quizTotalAttempts: quizTotalAttempts,
    quizCorrect: quizCorrect,
    
    // Adaptive difficulty level
    adaptiveDifficulty: computeAdaptiveDifficulty(masteredCount, studiedCount, quizAccuracy),
    
    // Dimension mastery
    masteryByType: byType,
    masteryByDifficulty: byDifficulty,
    masteryByFrequency: byFrequency,
    masteryByRoot: byRoot,
    
    // Retention scores (0-100) by dimension
    retentionByRoot: retentionByRoot,
    retentionByType: retentionByType,
    retentionByDifficulty: retentionByDifficulty,
    
    // Insights
    weakRoots: weakRoots,
    strongRoots: strongRoots,
    confusedWords: confusedWords,
    
    // Coverage
    coverage: typeof calculateCoverage === 'function' ? calculateCoverage() : null,
  };
  
  _learnerProfile = profile;
  _profileTimestamp = now;
  return profile;
}

/**
 * Get the root meaning text for a root string.
 */
function getRootMeaningForRoot(rootStr) {
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  for (var ri = 0; ri < words.length; ri++) {
    if (words[ri].root === rootStr && words[ri].rootMeaning) {
      return words[ri].rootMeaning;
    }
  }
  return '';
}

/**
 * Compute the learner's adaptive difficulty level (1-5).
 * Uses mastery rate and quiz accuracy to determine appropriate challenge.
 * 1 = Easy (new learner, needs confidence building)
 * 5 = Expert (high mastery, needs challenge)
 */
function computeAdaptiveDifficulty(masteredCount, studiedCount, quizAccuracy) {
  var masterRate = studiedCount > 0 ? masteredCount / studiedCount : 0;
  var accuracyAdjusted = quizAccuracy > 0 ? quizAccuracy / 100 : masterRate;
  
  if (accuracyAdjusted >= 0.85 && studiedCount > 50) return 5;
  if (accuracyAdjusted >= 0.75 && studiedCount > 30) return 4;
  if (accuracyAdjusted >= 0.60) return 3;
  if (accuracyAdjusted >= 0.40) return 2;
  return 1;
}

/**
 * Get the cached or freshly computed learner profile.
 */
function getLearnerProfile() {
  return buildLearnerProfile();
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE LESSON GENERATOR — Dynamic, Personalized Lessons
//
// Generates lessons tailored to the learner's profile:
//   • ~40% Review (overdue + weak words)
//   • ~30% New (high-priority new vocabulary)
//   • ~20% Reinforcement (frequently confused or leeched words)
//   • ~10% Challenge (slightly harder words for growth)
//
// Word ordering within lessons follows a psychologically optimized
// sequence: review first (warm-up), then new (focus), then challenge.
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a personalized lesson for the learner.
 * @param {number} wordCount - Desired number of words (default: WORDS_PER_LESSON)
 * @param {Object} options - Optional constraints:
 *   - path: 'foundation'|'surah'|'root-family'|'difficulty'|null (null = all vocab)
 *   - sourceWords: Array of candidate words to pick from (for path-specific lessons)
 *   - includeReview: boolean (default: true)
 *   - includeNew: boolean (default: true)
 * @returns {Array} Ordered array of word objects
 */
function generateAdaptiveLesson(wordCount, options) {
  if (!wordCount || wordCount < 3) wordCount = WORDS_PER_LESSON;
  if (!options) options = {};
  
  var profile = buildLearnerProfile();
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var now = Date.now();
  
  // Determine candidate word pool
  var pool = options.sourceWords && options.sourceWords.length > 0
    ? options.sourceWords
    : ((typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
        ? getCanonicalWords() : ALL_WORDS);
  
  if (!pool || pool.length === 0) return [];
  
  // ── Categorize words ──
  var reviewWords = [];  // Overdue or due soon
  var weakWords = [];    // High lapse rate, low retention
  var newWords = [];     // Never studied
  var challengeWords = []; // Slightly harder, not yet studied
  var masteredWords = []; // Well-known, not needed
  
  for (var i = 0; i < pool.length; i++) {
    var w = pool[i];
    var entry = srsData[w.id];
    
    if (!entry || entry.stage === 0) {
      // Never studied: candidate for new or challenge
      var diff = w.difficulty || 3;
      var priority = w.learningPriority || 3;
      
      if (priority <= 2 && diff <= profile.adaptiveDifficulty + 1) {
        newWords.push(w);
      } else if (diff <= profile.adaptiveDifficulty + 1) {
        newWords.push(w);
      } else {
        challengeWords.push(w);
      }
    } else if (entry.dueDate && now >= entry.dueDate) {
      // Due for review
      reviewWords.push({ word: w, overdueMs: now - entry.dueDate, entry: entry });
      
      // Flag high-lapse words as weak
      var lapseRate = entry.totalReviews > 0 ? (entry.lapses || 0) / entry.totalReviews : 0;
      if (lapseRate > 0.3 || entry.isLeech) {
        weakWords.push({ word: w, lapseRate: lapseRate, entry: entry });
      }
    } else {
      masteredWords.push(w);
    }
  }
  
  // Sort review by urgency (most overdue + weakest first)
  reviewWords.sort(function(a, b) {
    if (a.entry.isLeech && !b.entry.isLeech) return -1;
    if (!a.entry.isLeech && b.entry.isLeech) return 1;
    return b.overdueMs - a.overdueMs;
  });
  
  // Sort weak by severity
  weakWords.sort(function(a, b) {
    return (b.lapseRate || 0) - (a.lapseRate || 0);
  });
  
  // Sort new by learning priority (highest first), then by frequency rank
  newWords.sort(function(a, b) {
    var aP = a.learningPriority || 5;
    var bP = b.learningPriority || 5;
    if (aP !== bP) return aP - bP;
    return (a.frequencyRank || 9999) - (b.frequencyRank || 9999);
  });
  
  // Sort challenge by difficulty (closest to adaptive + 1, but not too easy)
  challengeWords.sort(function(a, b) {
    var aDiff = Math.abs((a.difficulty || 3) - profile.adaptiveDifficulty - 1);
    var bDiff = Math.abs((b.difficulty || 3) - profile.adaptiveDifficulty - 1);
    return aDiff - bDiff;
  });
  
  // ── Compose lesson ─────────────────────────────────────────
  // Ratios based on learner profile
  // - New learners (adaptiveDifficulty = 1): focus on new words + reviews
  // - Intermediate (adaptiveDifficulty = 2-3): balanced mix
  // - Advanced (adaptiveDifficulty = 4-5): more challenge + weak areas
  
  var reviewRatio, newRatio, weakRatio, challengeRatio;
  
  if (profile.adaptiveDifficulty <= 1 && profile.studiedWords < 20) {
    // New learner: 50% new, 30% review, 10% weak, 10% challenge
    reviewRatio = 0.3; newRatio = 0.5; weakRatio = 0.1; challengeRatio = 0.1;
  } else if (profile.adaptiveDifficulty <= 2) {
    // Beginner: 35% review, 35% new, 15% weak, 15% challenge
    reviewRatio = 0.35; newRatio = 0.35; weakRatio = 0.15; challengeRatio = 0.15;
  } else if (profile.adaptiveDifficulty <= 3) {
    // Intermediate: 40% review, 25% new, 20% weak, 15% challenge
    reviewRatio = 0.4; newRatio = 0.25; weakRatio = 0.2; challengeRatio = 0.15;
  } else {
    // Advanced: 35% review, 15% new, 30% weak/reinforcement, 20% challenge
    reviewRatio = 0.35; newRatio = 0.15; weakRatio = 0.3; challengeRatio = 0.2;
  }
  
  // If no options, adjust: new learners without reviews get more new words
  if (!options.includeReview && !options.includeNew) {
    // Default: include both
  }
  if (options.includeReview === false) reviewRatio = 0;
  if (options.includeNew === false) newRatio = 0;
  
  // Normalize ratios
  var totalRatio = reviewRatio + newRatio + weakRatio + challengeRatio;
  if (totalRatio === 0) { reviewRatio = 0.5; newRatio = 0.5; totalRatio = 1; }
  
  var reviewCount = Math.min(reviewWords.length, Math.max(1, Math.round(wordCount * reviewRatio / totalRatio)));
  var weakCount = Math.min(weakWords.length, Math.max(0, Math.round(wordCount * weakRatio / totalRatio)));
  var newCount = Math.min(newWords.length, Math.max(0, Math.round(wordCount * newRatio / totalRatio)));
  var challengeCount = Math.min(challengeWords.length, Math.max(0, wordCount - reviewCount - weakCount - newCount));
  
  // Redistribute excess if any category is exhausted
  var remainingSlots = wordCount - reviewCount - weakCount - newCount - challengeCount;
  if (remainingSlots > 0) {
    // Add more reviews first, then new words
    var extraReview = Math.min(reviewWords.length - reviewCount, Math.round(remainingSlots * 0.6));
    reviewCount += extraReview;
    remainingSlots -= extraReview;
    if (remainingSlots > 0) {
      var extraNew = Math.min(newWords.length - newCount, remainingSlots);
      newCount += extraNew;
      remainingSlots -= extraNew;
    }
    if (remainingSlots > 0) {
      challengeCount += remainingSlots;
    }
  } else if (remainingSlots < 0) {
    // Trim from the end: challenge first, then weak, then new
    if (challengeCount > 0) {
      var trimChallenge = Math.min(challengeCount, -remainingSlots);
      challengeCount -= trimChallenge;
      remainingSlots += trimChallenge;
    }
    if (remainingSlots < 0 && weakCount > 0) {
      var trimWeak = Math.min(weakCount, -remainingSlots);
      weakCount -= trimWeak;
      remainingSlots += trimWeak;
    }
    if (remainingSlots < 0 && newCount > 0) {
      var trimNew = Math.min(newCount, -remainingSlots);
      newCount -= trimNew;
      remainingSlots += trimNew;
    }
    if (remainingSlots < 0 && reviewCount > 0) {
      var trimReview = Math.min(reviewCount, -remainingSlots);
      reviewCount -= trimReview;
      remainingSlots += trimReview;
    }
  }
  
  // ── Build lesson with optimal ordering ─────────────────────
  // Warm-up: 1-2 review/weak words
  // Focus: interleaved new + weak + review
  // Cool-down: 1 challenge word (optional)
  
  var lesson = [];
  var revIdx = 0;
  var weakIdx = 0;
  var newIdx = 0;
  var chalIdx = 0;
  
  // Warm-up: start with 1-2 strong review words to build confidence
  if (reviewCount > 0 && revIdx < reviewCount) {
    lesson.push(reviewWords[revIdx].word);
    revIdx++;
  }
  if (weakCount > 0 && weakIdx < weakCount && lesson.length < 2) {
    lesson.push(weakWords[weakIdx].word);
    weakIdx++;
  }
  
  // Main content: interleave categories for optimal learning
  var maxIterations = wordCount * 2; // safety limit
  var iterations = 0;
  while (lesson.length < wordCount && iterations < maxIterations) {
    iterations++;
    var added = false;
    
    // Add a weak word (high priority for improvement)
    if (weakIdx < weakCount && lesson.length < wordCount) {
      lesson.push(weakWords[weakIdx].word);
      weakIdx++;
      added = true;
    }
    
    // Add a new word
    if (newIdx < newCount && lesson.length < wordCount) {
      lesson.push(newWords[newIdx]);
      newIdx++;
      added = true;
    }
    
    // Add a review word (if not already included as weak)
    if (revIdx < reviewCount && lesson.length < wordCount) {
      var revWord = reviewWords[revIdx].word;
      // Avoid duplicating words already added from weak
      var alreadyInLesson = false;
      for (var li = 0; li < lesson.length; li++) {
        if (lesson[li].id === revWord.id) { alreadyInLesson = true; break; }
      }
      if (!alreadyInLesson) {
        lesson.push(revWord);
      }
      revIdx++;
      added = true;
    }
    
    // If nothing was added, break to avoid infinite loop
    if (!added) break;
  }
  
  // Cool-down: add a challenge word at the end if room
  if (chalIdx < challengeCount && lesson.length < wordCount) {
    lesson.push(challengeWords[chalIdx]);
    chalIdx++;
  }
  
  // If still short, pad with any remaining review words
  while (revIdx < reviewCount && lesson.length < wordCount) {
    var revWord = reviewWords[revIdx].word;
    var alreadyIn = false;
    for (var ri = 0; ri < lesson.length; ri++) {
      if (lesson[ri].id === revWord.id) { alreadyIn = true; break; }
    }
    if (!alreadyIn) lesson.push(revWord);
    revIdx++;
  }
  
  // If still short, pad with mastered words (least harm)
  if (lesson.length < wordCount) {
    var shuffledMastered = masteredWords.slice().sort(function() { return Math.random() - 0.5; });
    for (var mi = 0; mi < shuffledMastered.length && lesson.length < wordCount; mi++) {
      lesson.push(shuffledMastered[mi]);
    }
  }
  
  return lesson.slice(0, wordCount);
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENT RECOMMENDATION ENGINE
//
// Analyzes the learner profile to recommend the most impactful
// next learning action with an explanation of why.
// ═══════════════════════════════════════════════════════════════

/**
 * Get the personalized next-lesson recommendation with explanation.
 * Returns an object: { type, path, label, reason, details, action }
 */
function getAdaptiveRecommendation() {
  var profile = buildLearnerProfile();
  var now = Date.now();
  
  // ── Priority 1: Critically overdue reviews ─────────────────
  if (profile.criticallyOverdue >= 5) {
    var overdueRoots = findOverdueRoots(profile);
    var reason = 'You have ' + profile.criticallyOverdue + ' words overdue by more than a week. ' +
      'Review them now before they are completely forgotten. ' +
      (overdueRoots ? 'Focus on root: ' + overdueRoots : '');
    return {
      type: 'critical-review',
      path: 'mixedReview',
      label: 'Overdue Words Review',
      reason: reason,
      details: profile.criticallyOverdue + ' critically overdue words',
      action: 'startCriticalReview',
      urgency: 'high',
    };
  }
  
  // ── Priority 2: New user → Foundation Course ───────────────
  if (profile.studiedWords < 10 && typeof getFoundationLessonCount === 'function' && getFoundationLessonCount() > 0) {
    var foundationNext = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
    return {
      type: 'new-learner',
      path: 'foundation',
      label: 'Foundation Course',
      reason: 'Start your Quran vocabulary journey! The Foundation Course teaches the 100 most frequent words, covering ~84% of the Quran. ' +
        'Each lesson takes just a few minutes.',
      details: 'Continue with Foundation ' + (foundationNext + 1),
      action: 'startFoundation',
      urgency: 'medium',
    };
  }
  
  // ── Priority 3: Weak roots need strengthening ──────────────
  if (profile.weakRoots.length > 0 && profile.weakRoots[0].masteryScore < 30) {
    var weakest = profile.weakRoots[0];
    return {
      type: 'strengthen-roots',
      path: 'rootFamily',
      label: 'Strengthen Weak Root Family',
      reason: 'Your mastery of root ' + weakest.root + ' (' + weakest.rootMeaning + ') is only ' + weakest.masteryScore + '%. ' +
        'Strengthening this root family will help you recognize ' + weakest.total + ' related Quranic words.',
      details: 'Root: ' + weakest.root + ' (' + weakest.rootMeaning + ') — ' + weakest.total + ' words',
      action: 'strengthenRoot',
      rootKey: weakest.root,
      urgency: 'high',
    };
  }
  
  // ── Priority 4: Review backlog ──────────────────────────────
  if (profile.dueCount >= 5) {
    var pctOverdue = profile.studiedWords > 0 ? Math.round((profile.dueCount / profile.studiedWords) * 100) : 0;
    return {
      type: 'review-backlog',
      path: 'mixedReview',
      label: 'Clear Review Backlog',
      reason: 'You have ' + profile.dueCount + ' words due for review (' + pctOverdue + '% of studied vocabulary). ' +
        'Regular reviews are essential for long-term retention.',
      details: profile.dueCount + ' due · ' + profile.leechCount + ' leeched',
      action: 'startReview',
      urgency: 'medium',
    };
  }
  
  // ── Priority 5: Foundation Course progression ──────────────
  if (typeof getFoundationLessonCount === 'function' && getFoundationLessonCount() > 0) {
    var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
    var fTotal = getFoundationLessonCount();
    if (fCompleted < fTotal) {
      var nextF = typeof getNextIncompleteFoundationLesson === 'function' ? getNextIncompleteFoundationLesson() : 0;
      var progressPct = Math.round((fCompleted / fTotal) * 100);
      var completionBoost = (fCompleted + 1) <= fTotal ? getFoundationLessonWords(nextF) : [];
      var coverageGain = 0;
      if (completionBoost.length > 0) {
        for (var gi = 0; gi < completionBoost.length; gi++) {
          coverageGain += completionBoost[gi].occ || 0;
        }
      }
      var totalOcc = getTotalQuranOccurrences();
      var coverageBoostPct = totalOcc > 0 ? (coverageGain / totalOcc * 100).toFixed(1) : 0;
      
      return {
        type: 'foundation-progress',
        path: 'foundation',
        label: 'Continue Foundation Course',
        reason: 'Foundation Course ' + progressPct + '% complete. Next lesson adds ~' + coverageBoostPct + '% Quran coverage. ' +
          'Complete all ' + fTotal + ' lessons for ~84% coverage.',
        details: 'Foundation ' + (nextF + 1) + ' of ' + fTotal + ' · +' + coverageBoostPct + '% coverage',
        action: 'continueFoundation',
        lessonIndex: nextF,
        urgency: 'medium',
      };
    }
  }
  
  // ── Priority 6: Surah comprehension gaps ───────────────────
  if (typeof getAllSurahComprehension === 'function') {
    var allComp = getAllSurahComprehension();
    if (allComp && allComp.length > 0) {
      var worstSurah = null;
      for (var sci = 0; sci < allComp.length; sci++) {
        if (allComp[sci].estimatedComprehension < 50) {
          worstSurah = allComp[sci];
          break;
        }
      }
      if (worstSurah) {
        var surahInfo = typeof getSurahInfo === 'function' ? getSurahInfo(worstSurah.surahId) : null;
        return {
          type: 'surah-comprehension',
          path: 'surah',
          label: 'Improve Surah Comprehension',
          reason: 'Your comprehension of ' + (surahInfo ? surahInfo.name : 'Surah ' + worstSurah.surahId) +
            ' is only ' + worstSurah.estimatedComprehension + '%. Studying its vocabulary will boost your understanding.',
          details: worstSurah.surahId + '. ' + (surahInfo ? surahInfo.name : '') +
            ' · ' + worstSurah.masteredWords + '/' + worstSurah.totalWords + ' words mastered',
          action: 'studySurah',
          surahId: worstSurah.surahId,
          urgency: 'low',
        };
      }
    }
  }
  
  // ── Priority 7: Frequently confused words ──────────────────
  if (profile.confusedWords.length >= 3) {
    var topConfused = profile.confusedWords[0];
    return {
      type: 'confused-words',
      path: 'foundation',
      label: 'Reinforce Confused Words',
      reason: 'You often confuse ' + topConfused.arabic + ' (' + topConfused.english + ') — ' +
        topConfused.lapseRate + '% lapse rate. Dedicated practice will strengthen this.',
      details: topConfused.lapseRate + '% lapse rate · ' + topConfused.totalReviews + ' reviews',
      action: 'reviewConfused',
      wordId: topConfused.wordId,
      urgency: 'low',
    };
  }
  
  // ── Priority 8: Difficulty progression ─────────────────────
  if (profile.adaptiveDifficulty >= 3 && profile.masteredWords > 30) {
    var nextDifficulty = typeof getNextIncompleteDifficultyLevel === 'function' ? getNextIncompleteDifficultyLevel() : 1;
    return {
      type: 'difficulty-advance',
      path: 'difficulty',
      label: 'Advance Difficulty Level',
      reason: 'You are ready for harder vocabulary! Your mastery rate (' +
        Math.round((profile.masteredWords / Math.max(1, profile.studiedWords)) * 100) + '%) shows strong retention.',
      details: 'Next: Difficulty Level ' + nextDifficulty,
      action: 'advanceDifficulty',
      level: nextDifficulty,
      urgency: 'low',
    };
  }
  
  // ── Default: Mixed Review ───────────────────────────────────
  return {
    type: 'general-review',
    path: 'mixedReview',
    label: 'Mixed Review Session',
    reason: 'A balanced review session keeps your vocabulary strong. ' +
      'Includes due reviews, some new words, and targeted practice on weak areas.',
    details: profile.dueCount + ' due · ' + (profile.totalWords - profile.studiedWords) + ' unstudied',
    action: 'startMixedReview',
    urgency: 'low',
  };
}

/**
 * Find the root with the most overdue words for targeted review recommendations.
 */
function findOverdueRoots(profile) {
  if (!profile.weakRoots || profile.weakRoots.length === 0) return null;
  // Find weak root with highest due count
  var best = null;
  var bestDue = 0;
  for (var ri = 0; ri < profile.weakRoots.length; ri++) {
    var r = profile.weakRoots[ri];
    if (r.dueCount > bestDue) {
      bestDue = r.dueCount;
      best = r;
    }
  }
  return best ? best.root + ' (' + best.rootMeaning + ')' : null;
}

/**
 * Get learning insights summary for the personalized dashboard.
 */
function getLearningInsights() {
  var profile = buildLearnerProfile();
  var rec = getAdaptiveRecommendation();
  
  // Compute estimated coverage after next lesson
  var currentCoverage = profile.coverage ? profile.coverage.coveragePercent : 0;
  var estimatedNextCoverage = currentCoverage;
  
  if (rec.type === 'foundation-progress' && rec.lessonIndex !== undefined) {
    var fWords = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(rec.lessonIndex) : [];
    var gainOcc = 0;
    for (var fi = 0; fi < fWords.length; fi++) {
      gainOcc += fWords[fi].occ || 0;
    }
    var totalOcc = getTotalQuranOccurrences();
    var gainPct = totalOcc > 0 ? (gainOcc / totalOcc * 100) : 0;
    estimatedNextCoverage = Math.min(100, currentCoverage + gainPct);
  }
  
  // Predict time to Foundation completion
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var fRemaining = fTotal - fCompleted;
  var predictedDaysToFoundationCompletion = 0;
  if (fRemaining > 0) {
    var reviewsPerDay = profile.recentReviews > 0 ? Math.max(1, Math.round(profile.recentReviews / 7)) : 1;
    // Assume ~10 words per foundation lesson, requiring ~1 review session per lesson
    var sessionsPerWeek = reviewsPerDay;
    var lessonsPerSession = 1; // conservative estimate
    var weeksToComplete = fRemaining / Math.max(1, sessionsPerWeek * lessonsPerSession);
    predictedDaysToFoundationCompletion = Math.round(weeksToComplete * 7);
  }
  
  return {
    recommendation: rec,
    currentCoverage: currentCoverage,
    estimatedNextCoverage: estimatedNextCoverage,
    coverageGain: (estimatedNextCoverage - currentCoverage).toFixed(1),
    predictedDaysToFoundationCompletion: predictedDaysToFoundationCompletion,
    weakRoots: profile.weakRoots.slice(0, 3),
    strongRoots: profile.strongRoots.slice(0, 3),
    confusedWords: profile.confusedWords.slice(0, 5),
    reviewBacklog: profile.dueCount,
    adaptiveDifficulty: profile.adaptiveDifficulty,
    studiedWords: profile.studiedWords,
    masteredWords: profile.masteredWords,
    totalWords: profile.totalWords,
    totalReviews: profile.totalReviews,
    quizAccuracy: profile.quizAccuracy,
    criticallyOverdue: profile.criticallyOverdue,
  };
}
