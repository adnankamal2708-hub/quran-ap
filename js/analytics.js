// ═══════════════════════════════════════════════════════════════
// analytics.js — Advanced Learning Analytics Engine
//
// Provides:
//   • Daily Progress Snapshots (auto-recorded)
//   • Progress Trends (daily, weekly, monthly, all-time)
//   • Forecasts & Predictions (estimated completion, milestones)
//   • Achievements System (meaningful milestones)
//   • Learning Insights (strongest/weakest, most improved, trends)
//
// All analytics are computed from existing SRS, lesson progress,
// and quiz data — no duplication of learning state.
// Fully offline-compatible via localStorage persistence.
// ═══════════════════════════════════════════════════════════════

// ── Storage Keys ──────────────────────────────────────────────

// Production flag - set to false to suppress debug logging
const ANALYTICS_HISTORY_KEY = 'quran_analytics_history';
const ANALYTICS_ACHIEVEMENTS_KEY = 'quran_analytics_achievements';
const ANALYTICS_SESSION_LOG_KEY = 'quran_analytics_sessions';

// ── Daily Progress Snapshot ───────────────────────────────────

/**
 * Record a daily progress snapshot. Called once per day or on key events.
 * Stores: date, masteredCount, studiedCount, coveragePercent,
 *         comprehension, reviewsDone, quizAccuracy, streak,
 *         foundationCompleted, rootFamiliesMastered, avgRetention
 */
function recordDailySnapshot() {
  var history = loadAnalyticsHistory();
  var today = getDateKeyAnalytics();
  
  // Check if we already have a snapshot for today
  for (var hi = 0; hi < history.length; hi++) {
    if (history[hi].date === today) {
      // Update today's entry
      updateSnapshotEntry(history[hi]);
      saveAnalyticsHistory(history);
      return;
    }
  }
  
  // Create new snapshot for today
  var snapshot = { date: today };
  updateSnapshotEntry(snapshot);
  history.push(snapshot);
  
  // Keep only the last 365 days
  if (history.length > 365) {
    history = history.slice(history.length - 365);
  }
  
  saveAnalyticsHistory(history);
}

/**
 * Fill a snapshot entry with current metrics.
 */
function updateSnapshotEntry(entry) {
  var srsData = loadSRS();
  var now = Date.now();
  var todayStart = getTodayStartAnalytics();
  
  // Count mastered, studied
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  var masteredCount = 0;
  var studiedCount = 0;
  var reviewsToday = 0;
  var totalRetention = 0;
  var retentionCount = 0;
  
  for (var i = 0; i < allWords.length; i++) {
    var entry2 = srsData[allWords[i].id];
    if (entry2) {
      studiedCount++;
      if (entry2.stage >= 2) masteredCount++;
      if (entry2.ratedAt && entry2.ratedAt >= todayStart) reviewsToday++;
      if (entry2.interval > 0 && typeof estimateRetention === 'function') {
        totalRetention += estimateRetention(entry2);
        retentionCount++;
      }
    }
  }
  
  // Coverage
  var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
  
  // Quiz accuracy from adaptive engine
  var quizHistory = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
  var quizAccuracy = 0;
  if (quizHistory && quizHistory.total > 0) {
    quizAccuracy = Math.round((quizHistory.correct / quizHistory.total) * 100);
  }
  
  // Foundation progress
  var fCompleted = (typeof getCompletedFoundationLessonCount === 'function') 
    ? getCompletedFoundationLessonCount() : 0;
  var fTotal = (typeof getFoundationLessonCount === 'function')
    ? getFoundationLessonCount() : 0;
  
  // Streak
  var streakData = loadStreakDataAnalytics();
  
  entry.masteredCount = masteredCount;
  entry.studiedCount = studiedCount;
  entry.coveragePercent = coverage ? coverage.coveragePercent : 0;
  entry.comprehension = coverage ? coverage.estimatedComprehension : 0;
  entry.reviewsDone = reviewsToday;
  entry.quizAccuracy = quizAccuracy;
  entry.streak = streakData.streak || 0;
  entry.foundationCompleted = fCompleted;
  entry.foundationTotal = fTotal;
  entry.avgRetention = retentionCount > 0 ? Math.round((totalRetention / retentionCount) * 100) : 0;
}

// ── Trends ─────────────────────────────────────────────────────

/**
 * Load the daily analytics history.
 */
function loadAnalyticsHistory() {
  try {
    var raw = localStorage.getItem(ANALYTICS_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveAnalyticsHistory(data) {
  try {
    localStorage.setItem(ANALYTICS_HISTORY_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[analytics] Could not save history:', e.message);
  }
}

/**
 * Get progress trends for a specified period.
 * @param {string} period - '7days', '30days', '90days', 'all'
 * @returns {Object} { labels, mastered, coverage, reviews, accuracy, daysActive, startMastered, endMastered, startCoverage, endCoverage, gainMastered, gainCoverage, totalReviews, avgAccuracy }
 */
function getProgressTrends(period) {
  var history = loadAnalyticsHistory();
  if (history.length === 0) return null;
  
  // Sort by date ascending
  history.sort(function(a, b) { return a.date.localeCompare(b.date); });
  
  // Determine slice
  var days = period === '7days' ? 7 : period === '30days' ? 30 : period === '90days' ? 90 : history.length;
  var slice = history.slice(Math.max(0, history.length - days));
  
  if (slice.length < 2) return null;
  
  var labels = [];
  var mastered = [];
  var coverage = [];
  var reviews = [];
  var accuracy = [];
  var daysActive = 0;
  var totalReviews = 0;
  
  for (var i = 0; i < slice.length; i++) {
    var s = slice[i];
    labels.push(formatDateLabel(s.date));
    mastered.push(s.masteredCount || 0);
    coverage.push(s.coveragePercent || 0);
    reviews.push(s.reviewsDone || 0);
    accuracy.push(s.quizAccuracy || 0);
    if (s.reviewsDone > 0) daysActive++;
    totalReviews += s.reviewsDone || 0;
  }
  
  var first = slice[0];
  var last = slice[slice.length - 1];
  
  var avgAccuracy = accuracy.length > 0
    ? Math.round(accuracy.reduce(function(a, b) { return a + b; }, 0) / accuracy.length)
    : 0;
  
  return {
    labels: labels,
    mastered: mastered,
    coverage: coverage,
    reviews: reviews,
    accuracy: accuracy,
    daysActive: daysActive,
    startMastered: first.masteredCount || 0,
    endMastered: last.masteredCount || 0,
    gainMastered: (last.masteredCount || 0) - (first.masteredCount || 0),
    startCoverage: first.coveragePercent || 0,
    endCoverage: last.coveragePercent || 0,
    gainCoverage: ((last.coveragePercent || 0) - (first.coveragePercent || 0)).toFixed(1),
    totalReviews: totalReviews,
    avgAccuracy: avgAccuracy,
    avgReviewsPerDay: days > 0 ? Math.round(totalReviews / days) : 0,
  };
}

// ── Forecasts ──────────────────────────────────────────────────

/**
 * Predict the date when the learner will reach a target coverage or mastery.
 * Uses simple linear regression on recent progress.
 */
function getForecasts() {
  var history = loadAnalyticsHistory();
  if (history.length < 3) return null;
  
  // Sort by date ascending
  history.sort(function(a, b) { return a.date.localeCompare(b.date); });
  
  var recent = history.slice(Math.max(0, history.length - 30)); // last 30 days
  var n = recent.length;
  
  // Linear regression: y = a + b*x where x = day index, y = mastered count
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    sumX += i;
    sumY += recent[i].masteredCount || 0;
    sumXY += i * (recent[i].masteredCount || 0);
    sumX2 += i * i;
  }
  
  var bMastered = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  var aMastered = (sumY - bMastered * sumX) / n;
  
  // Also compute coverage regression
  var sumY2 = 0, sumXY2 = 0;
  for (var ci = 0; ci < n; ci++) {
    sumY2 += recent[ci].coveragePercent || 0;
    sumXY2 += ci * (recent[ci].coveragePercent || 0);
  }
  var bCoverage = (n * sumXY2 - sumX * sumY2) / (n * sumX2 - sumX * sumX);
  var aCoverage = (sumY2 - bCoverage * sumX) / n;
  
  var lastEntry = recent[n - 1];
  var lastMastered = lastEntry.masteredCount || 0;
  var lastCoverage = lastEntry.coveragePercent || 0;
  
  // Total words for 100% completion estimate
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : [];
  var totalWords = allWords.length || 316;
  
  // Foundation course completion
  var fCompleted = (typeof getCompletedFoundationLessonCount === 'function')
    ? getCompletedFoundationLessonCount() : 0;
  var fTotal = (typeof getFoundationLessonCount === 'function')
    ? getFoundationLessonCount() : 0;
  
  // Estimate days to Foundation completion
  var daysToFoundationCompletion = 0;
  if (fCompleted < fTotal) {
    // Estimate based on recent lesson completion rate
    var completedToday = lastEntry.foundationCompleted || 0;
    var completedBefore = recent.length > 1 ? recent[0].foundationCompleted || 0 : 0;
    var lessonsPerDay = n > 1 ? Math.max(0.01, (completedToday - completedBefore) / n) : 0.1;
    var remaining = fTotal - fCompleted;
    daysToFoundationCompletion = Math.ceil(remaining / lessonsPerDay);
  }
  
  // Estimate days to next coverage milestone
  var daysToNextMilestone = 0;
  var nextMilestonePct = 0;
  var milestones = [
    { pct: 10 }, { pct: 20 }, { pct: 30 }, { pct: 40 }, { pct: 50 },
    { pct: 60 }, { pct: 70 }, { pct: 80 }, { pct: 90 }, { pct: 95 }
  ];
  for (var mi = 0; mi < milestones.length; mi++) {
    if (lastCoverage < milestones[mi].pct) {
      nextMilestonePct = milestones[mi].pct;
      break;
    }
  }
  
  if (nextMilestonePct > 0 && bCoverage > 0) {
    daysToNextMilestone = Math.ceil((nextMilestonePct - lastCoverage) / bCoverage);
  }
  
  // Predict mastered count in 7, 30, 90 days
  var predictedMastered = {
    '7': Math.round(aMastered + bMastered * (n + 7)),
    '30': Math.round(aMastered + bMastered * (n + 30)),
    '90': Math.round(aMastered + bMastered * (n + 90)),
  };
  
  // Predicted coverage
  var predictedCoverage = {
    '7': Math.min(100, Math.round((aCoverage + bCoverage * (n + 7)) * 10) / 10),
    '30': Math.min(100, Math.round((aCoverage + bCoverage * (n + 30)) * 10) / 10),
    '90': Math.min(100, Math.round((aCoverage + bCoverage * (n + 90)) * 10) / 10),
  };
  
  var today = new Date();
  var completionDate = null;
  if (bMastered > 0) {
    var daysToComplete = Math.ceil((totalWords - lastMastered) / bMastered);
    if (daysToComplete > 0 && daysToComplete < 36500) {
      var date = new Date(today);
      date.setDate(date.getDate() + daysToComplete);
      completionDate = date;
    }
  }
  
  return {
    currentMastered: lastMastered,
    totalWords: totalWords,
    currentCoverage: lastCoverage,
    nextMilestonePct: nextMilestonePct,
    daysToNextMilestone: daysToNextMilestone > 0 && daysToNextMilestone < 36500 ? daysToNextMilestone : null,
    daysToFoundationCompletion: daysToFoundationCompletion > 0 && daysToFoundationCompletion < 36500 ? daysToFoundationCompletion : null,
    predictedMastered: predictedMastered,
    predictedCoverage: predictedCoverage,
    completionDate: completionDate,
    masteryRatePerDay: Math.round(bMastered * 10) / 10,
    coverageGainPerDay: Math.round(bCoverage * 100) / 100,
  };
}

// ── Weekly / Monthly Summaries ─────────────────────────────────

/**
 * Get aggregated progress for weekly, monthly, and all-time periods.
 */
function getPeriodSummaries() {
  var history = loadAnalyticsHistory();
  if (history.length === 0) return null;
  
  history.sort(function(a, b) { return a.date.localeCompare(b.date); });
  
  function summarizeSlice(slice) {
    if (!slice || slice.length === 0) return null;
    var first = slice[0];
    var last = slice[slice.length - 1];
    var totalReviews = 0;
    var daysActive = 0;
    
    for (var i = 0; i < slice.length; i++) {
      totalReviews += slice[i].reviewsDone || 0;
      if (slice[i].reviewsDone > 0) daysActive++;
    }
    
    return {
      daysTracked: slice.length,
      daysActive: daysActive,
      totalReviews: totalReviews,
      startMastered: first.masteredCount || 0,
      endMastered: last.masteredCount || 0,
      gainMastered: (last.masteredCount || 0) - (first.masteredCount || 0),
      startCoverage: first.coveragePercent || 0,
      endCoverage: last.coveragePercent || 0,
      gainCoverage: ((last.coveragePercent || 0) - (first.coveragePercent || 0)).toFixed(1),
      avgReviewsPerDay: slice.length > 0 ? Math.round(totalReviews / slice.length) : 0,
    };
  }
  
  var now = new Date();
  var weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  var monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  
  var weekData = history.filter(function(s) { return s.date >= formatDateKey(weekAgo); });
  var monthData = history.filter(function(s) { return s.date >= formatDateKey(monthAgo); });
  
  // Calculate consistency (what % of tracked days had reviews)
  var consistency = history.length > 0
    ? Math.round((history.filter(function(s) { return s.reviewsDone > 0; }).length / history.length) * 100)
    : 0;
  
  return {
    week: summarizeSlice(weekData),
    month: summarizeSlice(monthData),
    allTime: summarizeSlice(history),
    consistency: consistency,
  };
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Achievement definitions.
 * Each has: id, title, description, icon, category, check function.
 * Categories: foundation, coverage, mastery, streak, review, quiz, root
 */
var ACHIEVEMENT_DEFINITIONS = [
  // ── Foundation ──
  {
    id: 'foundation_first',
    title: 'First Steps',
    description: 'Complete your first Foundation Course lesson',
    icon: '🌱',
    category: 'foundation',
    check: function() {
      return (typeof getCompletedFoundationLessonCount === 'function')
        ? getCompletedFoundationLessonCount() >= 1 : false;
    },
  },
  {
    id: 'foundation_half',
    title: 'Halfway There',
    description: 'Complete 5 Foundation Course lessons',
    icon: '🔥',
    category: 'foundation',
    check: function() {
      return (typeof getCompletedFoundationLessonCount === 'function')
        ? getCompletedFoundationLessonCount() >= 5 : false;
    },
  },
  {
    id: 'foundation_complete',
    title: 'Foundation Master',
    description: 'Complete all 10 Foundation Course lessons',
    icon: '👑',
    category: 'foundation',
    check: function() {
      var fTotal = (typeof getFoundationLessonCount === 'function') ? getFoundationLessonCount() : 0;
      var fCompleted = (typeof getCompletedFoundationLessonCount === 'function') ? getCompletedFoundationLessonCount() : 0;
      return fTotal > 0 && fCompleted >= fTotal;
    },
  },
  
  // ── Coverage ──
  {
    id: 'coverage_10',
    title: 'Building Blocks',
    description: 'Reach 10% Quran Reading Coverage',
    icon: '🧱',
    category: 'coverage',
    check: function() {
      var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
      return coverage && coverage.coveragePercent >= 10;
    },
  },
  {
    id: 'coverage_25',
    title: 'Quarter Way',
    description: 'Reach 25% Quran Reading Coverage',
    icon: '📖',
    category: 'coverage',
    check: function() {
      var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
      return coverage && coverage.coveragePercent >= 25;
    },
  },
  {
    id: 'coverage_50',
    title: 'Major Milestone',
    description: 'Reach 50% Quran Reading Coverage',
    icon: '⭐',
    category: 'coverage',
    check: function() {
      var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
      return coverage && coverage.coveragePercent >= 50;
    },
  },
  {
    id: 'coverage_75',
    title: 'Near Complete',
    description: 'Reach 75% Quran Reading Coverage',
    icon: '💎',
    category: 'coverage',
    check: function() {
      var coverage = (typeof calculateCoverage === 'function') ? calculateCoverage() : null;
      return coverage && coverage.coveragePercent >= 75;
    },
  },
  
  // ── Mastery ──
  {
    id: 'mastery_10',
    title: 'First Ten',
    description: 'Master 10 Quranic words',
    icon: '🌟',
    category: 'mastery',
    check: function() {
      var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
      return profile && profile.masteredWords >= 10;
    },
  },
  {
    id: 'mastery_50',
    title: 'Vocab Builder',
    description: 'Master 50 Quranic words',
    icon: '📚',
    category: 'mastery',
    check: function() {
      var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
      return profile && profile.masteredWords >= 50;
    },
  },
  {
    id: 'mastery_100',
    title: 'Century Club',
    description: 'Master 100 Quranic words',
    icon: '🏆',
    category: 'mastery',
    check: function() {
      var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
      return profile && profile.masteredWords >= 100;
    },
  },
  {
    id: 'mastery_200',
    title: 'Vocabulary Scholar',
    description: 'Master 200 Quranic words',
    icon: '🎓',
    category: 'mastery',
    check: function() {
      var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
      return profile && profile.masteredWords >= 200;
    },
  },
  
  // ── Streak ──
  {
    id: 'streak_7',
    title: 'Weekly Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    category: 'streak',
    check: function() {
      var streak = loadStreakDataAnalytics();
      return streak && streak.streak >= 7;
    },
  },
  {
    id: 'streak_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: '💪',
    category: 'streak',
    check: function() {
      var streak = loadStreakDataAnalytics();
      return streak && streak.streak >= 30;
    },
  },
  {
    id: 'streak_100',
    title: 'Century Streak',
    description: 'Maintain a 100-day learning streak',
    icon: '🌟',
    category: 'streak',
    check: function() {
      var streak = loadStreakDataAnalytics();
      return streak && streak.streak >= 100;
    },
  },
  
  // ── Review ──
  {
    id: 'review_100',
    title: 'Dedicated Student',
    description: 'Complete 100 total word reviews',
    icon: '📝',
    category: 'review',
    check: function() {
      var stats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
      return stats && stats.totalReviews >= 100;
    },
  },
  {
    id: 'review_500',
    title: 'Review Machine',
    description: 'Complete 500 total word reviews',
    icon: '⚡',
    category: 'review',
    check: function() {
      var stats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
      return stats && stats.totalReviews >= 500;
    },
  },
  {
    id: 'review_1000',
    title: 'Thousand Reviews',
    description: 'Complete 1,000 total word reviews',
    icon: '🏅',
    category: 'review',
    check: function() {
      var stats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
      return stats && stats.totalReviews >= 1000;
    },
  },
  
  // ── Quiz ──
  {
    id: 'quiz_perfect',
    title: 'Perfect Score',
    description: 'Get 100% on any quiz',
    icon: '🎯',
    category: 'quiz',
    check: function() {
      var history = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
      return history && history.total >= 5 && history.correct === history.total;
    },
  },
  {
    id: 'quiz_10',
    title: 'Quiz Pro',
    description: 'Complete 10 quiz questions with 80%+ accuracy',
    icon: '🧠',
    category: 'quiz',
    check: function() {
      var history = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
      return history && history.total >= 10 && (history.correct / history.total) >= 0.8;
    },
  },
  
  // ── Root ──
  {
    id: 'root_5',
    title: 'Root Explorer',
    description: 'Fully master 5 root families',
    icon: '🌿',
    category: 'root',
    check: function() {
      var roots = (typeof getRootFamilyMastery === 'function') ? getRootFamilyMastery() : null;
      return roots && roots.fullyMasteredRoots >= 5;
    },
  },
  {
    id: 'root_20',
    title: 'Root Scholar',
    description: 'Fully master 20 root families',
    icon: '🌳',
    category: 'root',
    check: function() {
      var roots = (typeof getRootFamilyMastery === 'function') ? getRootFamilyMastery() : null;
      return roots && roots.fullyMasteredRoots >= 20;
    },
  },
  
  // ── Learning Path ──
  {
    id: 'path_surah_first',
    title: 'Surah Explorer',
    description: 'Complete your first surah study',
    icon: '📖',
    category: 'path',
    check: function() {
      return (typeof getCompletedSurahCount === 'function') ? getCompletedSurahCount() >= 1 : false;
    },
  },
  {
    id: 'path_difficulty_all',
    title: 'Difficulty Conqueror',
    description: 'Complete all 5 difficulty levels',
    icon: '🗡️',
    category: 'path',
    check: function() {
      return (typeof getCompletedDifficultyLevelCount === 'function') ? getCompletedDifficultyLevelCount() >= 5 : false;
    },
  },
  
  // ── Consistency ──
  {
    id: 'consistency_7',
    title: 'Week of Learning',
    description: 'Study for 7 consecutive days',
    icon: '📅',
    category: 'consistency',
    check: function() {
      var history = loadAnalyticsHistory();
      if (history.length < 7) return false;
      history.sort(function(a, b) { return a.date.localeCompare(b.date); });
      var recent = history.slice(-7);
      for (var ci = 0; ci < recent.length; ci++) {
        if (recent[ci].reviewsDone === 0) return false;
      }
      return true;
    },
  },
];

/**
 * Check and award achievements. Returns newly earned achievements.
 */
function checkAchievements() {
  var earned = loadEarnedAchievements();
  var newlyEarned = [];
  
  for (var i = 0; i < ACHIEVEMENT_DEFINITIONS.length; i++) {
    var ach = ACHIEVEMENT_DEFINITIONS[i];
    if (earned[ach.id]) continue; // Already earned
    try {
      if (ach.check()) {
        earned[ach.id] = {
          date: new Date().toISOString().split('T')[0],
          title: ach.title,
          description: ach.description,
          icon: ach.icon,
          category: ach.category,
        };
        newlyEarned.push(ach);
      }
    } catch (e) {
      // Silently skip if check fails
    }
  }
  
  if (newlyEarned.length > 0) {
    saveEarnedAchievements(earned);
  }
  
  return newlyEarned;
}

function loadEarnedAchievements() {
  try {
    var raw = localStorage.getItem(ANALYTICS_ACHIEVEMENTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveEarnedAchievements(data) {
  try {
    localStorage.setItem(ANALYTICS_ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[analytics] Could not save achievements:', e.message);
  }
}

/**
 * Get all achievements with earned status.
 */
function getAllAchievements() {
  var earned = loadEarnedAchievements();
  return ACHIEVEMENT_DEFINITIONS.map(function(ach) {
    return {
      id: ach.id,
      title: ach.title,
      description: ach.description,
      icon: ach.icon,
      category: ach.category,
      earned: !!earned[ach.id],
      earnedDate: earned[ach.id] ? earned[ach.id].date : null,
    };
  });
}

/**
 * Get achievement stats.
 */
function getAchievementStats() {
  var earned = loadEarnedAchievements();
  var total = ACHIEVEMENT_DEFINITIONS.length;
  var earnedCount = Object.keys(earned).length;
  
  // Count by category
  var byCategory = {};
  for (var i = 0; i < ACHIEVEMENT_DEFINITIONS.length; i++) {
    var cat = ACHIEVEMENT_DEFINITIONS[i].category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, earned: 0 };
    byCategory[cat].total++;
    if (earned[ACHIEVEMENT_DEFINITIONS[i].id]) byCategory[cat].earned++;
  }
  
  return {
    earnedCount: earnedCount,
    totalCount: total,
    progressPercent: total > 0 ? Math.round((earnedCount / total) * 100) : 0,
    byCategory: byCategory,
  };
}

// ═══════════════════════════════════════════════════════════════
// FREQUENTLY FORGOTTEN VOCABULARY
// ═══════════════════════════════════════════════════════════════

/**
 * Identify vocabulary that the learner frequently forgets.
 * Looks for: lowest retention rates, highest leech counts,
 * most review failures (stage resets), and words stuck in learning.
 */
function getFrequentlyForgotten() {
  var srsData = loadSRS();
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  var candidates = [];
  
  for (var i = 0; i < allWords.length; i++) {
    var entry = srsData[allWords[i].id];
    if (!entry) continue;
    
    var score = 0;
    var reasons = [];
    
    // Leeched words are frequently forgotten
    if (entry.isLeech) {
      score += 30;
      reasons.push('leeched');
    }
    
    // Low retention
    if (entry.interval > 0 && typeof estimateRetention === 'function') {
      var retention = estimateRetention(entry);
      if (retention < 0.5) {
        score += 25;
        reasons.push('low retention (' + Math.round(retention * 100) + '%)');
      }
    }
    
    // Stuck in learning stage (many reviews but still stage 0-1)
    if (entry.stage <= 1 && entry.totalReviews >= 5) {
      score += 20;
      reasons.push('stuck in learning');
    }
    
    // Frequently reset (many reviews with low average rating)
    if (entry.totalReviews >= 3 && entry.averageRating && entry.averageRating < 1.5) {
      score += 15;
      reasons.push('low ratings');
    }
    
    // Overdue words that keep getting postponed
    if (entry.dueDate && entry.dueDate < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      score += 10;
      reasons.push('persistently overdue');
    }
    
    if (score > 0) {
      candidates.push({
        id: allWords[i].id,
        arabic: allWords[i].arabic,
        english: allWords[i].english,
        translit: allWords[i].translit,
        stage: entry.stage || 0,
        retention: entry.interval > 0 && typeof estimateRetention === 'function' ? Math.round(estimateRetention(entry) * 100) : null,
        totalReviews: entry.totalReviews || 0,
        isLeech: !!entry.isLeech,
        isOverdue: entry.dueDate && entry.dueDate < Date.now(),
        forgottenScore: score,
        reasons: reasons,
      });
    }
  }
  
  candidates.sort(function(a, b) { return b.forgottenScore - a.forgottenScore; });
  return candidates.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// MOST IMPROVED VOCABULARY
// ═══════════════════════════════════════════════════════════════

/**
 * Identify vocabulary that has shown the most improvement.
 * Looks for words that moved from low stage to high stage,
 * or showed significant retention improvement.
 */
function getMostImproved() {
  var srsData = loadSRS();
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  var candidates = [];
  
  for (var i = 0; i < allWords.length; i++) {
    var entry = srsData[allWords[i].id];
    if (!entry || !entry.totalReviews || entry.totalReviews < 2) continue;
    if (entry.stage < 2) continue; // Only count mastered or young
    
    var improvementScore = 0;
    
    // High stage with many reviews shows improvement journey
    improvementScore += entry.stage * 10;
    
    // High retention despite being a difficult word
    if (entry.interval > 0 && typeof estimateRetention === 'function') {
      var retention = estimateRetention(entry);
      if (retention > 0.8) improvementScore += 15;
    }
    
    // Words that had low ratings early on but high recent ratings
    if (entry.averageRating && entry.averageRating >= 2.5 && entry.totalReviews >= 3) {
      improvementScore += 10;
    }
    
    // Recently matured (was new/learning recently, now mastered)
    if (entry.stage >= 2 && entry.ratedAt && entry.ratedAt > Date.now() - 30 * 24 * 60 * 60 * 1000) {
      improvementScore += 5;
    }
    
    if (improvementScore > 0) {
      candidates.push({
        id: allWords[i].id,
        arabic: allWords[i].arabic,
        english: allWords[i].english,
        translit: allWords[i].translit,
        stage: entry.stage || 0,
        retention: entry.interval > 0 && typeof estimateRetention === 'function' ? Math.round(estimateRetention(entry) * 100) : null,
        totalReviews: entry.totalReviews || 0,
        improvementScore: improvementScore,
      });
    }
  }
  
  candidates.sort(function(a, b) { return b.improvementScore - a.improvementScore; });
  return candidates.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// DIFFICULT SEMANTIC GROUPS
// ═══════════════════════════════════════════════════════════════

/**
 * Identify semantic groups where the learner has the lowest average mastery.
 */
function getDifficultSemanticGroups() {
  var srsData = loadSRS();
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  // Build type-based groups (part of speech categories)
  var groups = {};
  var groupNames = {
    noun: 'Nouns',
    verb: 'Verbs',
    particle: 'Particles',
    adjective: 'Adjectives',
    pronoun: 'Pronouns',
    exclamation: 'Exclamations',
  };
  
  for (var i = 0; i < allWords.length; i++) {
    var w = allWords[i];
    var cat = w.typeCategory || 'other';
    if (!groups[cat]) {
      groups[cat] = { total: 0, mastered: 0, retentionSum: 0, retentionCount: 0, label: groupNames[cat] || cat };
    }
    groups[cat].total++;
    
    var entry = srsData[w.id];
    if (entry) {
      if (entry.stage >= 2) groups[cat].mastered++;
      if (entry.interval > 0 && typeof estimateRetention === 'function') {
        groups[cat].retentionSum += estimateRetention(entry);
        groups[cat].retentionCount++;
      }
    }
  }
  
  // Also compute difficulty-based groups
  var diffGroups = {};
  var diffLabels = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Complex', 5: 'Advanced' };
  for (var di = 0; di < allWords.length; di++) {
    var w2 = allWords[di];
    var d = w2.difficulty || 3;
    if (!diffGroups[d]) {
      diffGroups[d] = { total: 0, mastered: 0, retentionSum: 0, retentionCount: 0, label: diffLabels[d] || 'Level ' + d };
    }
    diffGroups[d].total++;
    
    var e2 = srsData[w2.id];
    if (e2) {
      if (e2.stage >= 2) diffGroups[d].mastered++;
      if (e2.interval > 0 && typeof estimateRetention === 'function') {
        diffGroups[d].retentionSum += estimateRetention(e2);
        diffGroups[d].retentionCount++;
      }
    }
  }
  
  // Compute mastery percentage for each group
  var result = [];
  Object.keys(groups).forEach(function(cat) {
    var g = groups[cat];
    var masteryPct = g.total > 0 ? Math.round((g.mastered / g.total) * 100) : 0;
    var avgRet = g.retentionCount > 0 ? Math.round((g.retentionSum / g.retentionCount) * 100) : null;
    result.push({
      name: g.label,
      type: 'part-of-speech',
      total: g.total,
      mastered: g.mastered,
      masteryPercent: masteryPct,
      avgRetention: avgRet,
    });
  });
  
  Object.keys(diffGroups).forEach(function(d) {
    var g = diffGroups[d];
    var masteryPct = g.total > 0 ? Math.round((g.mastered / g.total) * 100) : 0;
    var avgRet = g.retentionCount > 0 ? Math.round((g.retentionSum / g.retentionCount) * 100) : null;
    result.push({
      name: g.label,
      type: 'difficulty',
      total: g.total,
      mastered: g.mastered,
      masteryPercent: masteryPct,
      avgRetention: avgRet,
    });
  });
  
  // Sort by mastery ascending (hardest first)
  result.sort(function(a, b) { return a.masteryPercent - b.masteryPercent; });
  
  return {
    hardest: result.slice(0, 5),
    easiest: result.slice(-5).reverse(),
  };
}

// ═══════════════════════════════════════════════════════════════
// AVERAGE LESSON ACCURACY
// ═══════════════════════════════════════════════════════════════

/**
 * Compute average accuracy per lesson based on SRS ratings.
 * Lessons where the user consistently rates higher indicate easier content.
 */
function getAverageLessonAccuracy() {
  var srsData = loadSRS();
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  // Group words by foundation lesson
  var lessons = {};
  
  for (var i = 0; i < allWords.length; i++) {
    var w = allWords[i];
    var lessonId = w.foundationLessonId;
    if (lessonId === undefined || lessonId < 0) continue;
    
    if (!lessons[lessonId]) {
      lessons[lessonId] = { totalWords: 0, reviewedWords: 0, ratingSum: 0, masteredCount: 0 };
    }
    lessons[lessonId].totalWords++;
    
    var entry = srsData[w.id];
    if (entry) {
      lessons[lessonId].reviewedWords++;
      if (entry.averageRating) lessons[lessonId].ratingSum += entry.averageRating;
      if (entry.stage >= 2) lessons[lessonId].masteredCount++;
    }
  }
  
  var result = [];
  Object.keys(lessons).forEach(function(lid) {
    var l = lessons[lid];
    var avgRating = l.reviewedWords > 0 ? Math.round((l.ratingSum / l.reviewedWords) * 10) / 10 : 0;
    var masteryRate = l.totalWords > 0 ? Math.round((l.masteredCount / l.totalWords) * 100) : 0;
    result.push({
      lessonId: parseInt(lid, 10),
      totalWords: l.totalWords,
      reviewedWords: l.reviewedWords,
      avgRating: avgRating,
      masteryPercent: masteryRate,
    });
  });
  
  result.sort(function(a, b) { return a.lessonId - b.lessonId; });
  
  return {
    overall: result,
    averageMasteryRate: result.length > 0
      ? Math.round(result.reduce(function(s, r) { return s + r.masteryPercent; }, 0) / result.length)
      : 0,
    weakestLesson: result.length > 0 ? result.reduce(function(a, b) { return a.masteryPercent < b.masteryPercent ? a : b; }) : null,
    strongestLesson: result.length > 0 ? result.reduce(function(a, b) { return a.masteryPercent > b.masteryPercent ? a : b; }) : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// SESSION LOG — Study Time Tracking
// ═══════════════════════════════════════════════════════════════

/**
 * Log a study session with start time and duration.
 */
function logStudySession() {
  var sessions = loadStudySessions();
  var now = Date.now();
  var today = getDateKeyAnalytics();
  
  // Check if there's an active session to close
  var activeIdx = -1;
  for (var si = 0; si < sessions.length; si++) {
    if (!sessions[si].endTime) {
      activeIdx = si;
      break;
    }
  }
  
  if (activeIdx >= 0) {
    // Close the active session
    sessions[activeIdx].endTime = now;
    sessions[activeIdx].duration = Math.round((now - sessions[activeIdx].startTime) / 60000); // minutes
    sessions[activeIdx].date = today;
  } else {
    // Start a new session
    sessions.push({
      startTime: now,
      endTime: null,
      duration: 0,
      date: today,
    });
  }
  
  // Keep only last 90 days of sessions
  var cutoff = now - 90 * 24 * 60 * 60 * 1000;
  sessions = sessions.filter(function(s) { return s.startTime > cutoff; });
  
  saveStudySessions(sessions);
}

function loadStudySessions() {
  try {
    var raw = localStorage.getItem(ANALYTICS_SESSION_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveStudySessions(data) {
  try {
    localStorage.setItem(ANALYTICS_SESSION_LOG_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[analytics] Could not save sessions:', e.message);
  }
}

/**
 * Compute average study time for different periods.
 */
function getAverageStudyTime() {
  var sessions = loadStudySessions();
  if (sessions.length === 0) return null;
  
  var now = Date.now();
  var dayMs = 24 * 60 * 60 * 1000;
  
  var weekSessions = sessions.filter(function(s) { return s.startTime > now - 7 * dayMs && s.duration > 0; });
  var monthSessions = sessions.filter(function(s) { return s.startTime > now - 30 * dayMs && s.duration > 0; });
  var allSessions = sessions.filter(function(s) { return s.duration > 0; });
  
  function avgDuration(arr) {
    if (arr.length === 0) return 0;
    var total = arr.reduce(function(s, s2) { return s + s2.duration; }, 0);
    return Math.round(total / arr.length);
  }
  
  function totalDuration(arr) {
    return arr.reduce(function(s, s2) { return s + s2.duration; }, 0);
  }
  
  return {
    weeklyAvgMinutes: avgDuration(weekSessions),
    monthlyAvgMinutes: avgDuration(monthSessions),
    overallAvgMinutes: avgDuration(allSessions),
    weeklyTotalMinutes: totalDuration(weekSessions),
    monthlyTotalMinutes: totalDuration(monthSessions),
    sessionCountWeek: weekSessions.length,
    sessionCountMonth: monthSessions.length,
    sessionCountOverall: allSessions.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// ACTIONABLE RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate personalized, actionable recommendations based on learning data.
 * Analyzes weaknesses and suggests specific actions.
 */
function getRecommendations() {
  var recommendations = [];
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
  var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
  var periods = getPeriodSummaries();
  var forgottenWords = getFrequentlyForgotten();
  var difficultGroups = getDifficultSemanticGroups();
  var lessonAccuracy = getAverageLessonAccuracy();
  var sessions = loadStudySessions();
  var streakData = loadStreakDataAnalytics();
  
  // 1. Overdue reviews
  if (srsStats && srsStats.overdue > 0) {
    var severity = srsStats.overdue > 20 ? 'high' : srsStats.overdue > 10 ? 'medium' : 'low';
    recommendations.push({
      priority: severity,
      category: 'review',
      icon: '⏰',
      title: 'Overdue Reviews: ' + srsStats.overdue + ' words',
      description: 'You have ' + srsStats.overdue + ' words past their due date. Reviewing them now will strengthen your memory.',
      action: 'Start review session',
      actionType: 'review',
    });
  }
  
  // 2. Frequently forgotten words
  if (forgottenWords.length >= 3) {
    recommendations.push({
      priority: forgottenWords[0].forgottenScore > 25 ? 'high' : 'medium',
      category: 'focus',
      icon: '🔁',
      title: 'Words Needing Extra Attention: ' + forgottenWords.length,
      description: 'Some words need extra practice: ' + forgottenWords.slice(0, 3).map(function(w) { return w.arabic + ' (' + w.english + ')'; }).join(', ') + '.',
      action: 'Review difficult words',
      actionType: 'review-difficult',
      words: forgottenWords.slice(0, 3),
    });
  }
  
  // 3. Consistency
  if (periods && periods.consistency < 70) {
    recommendations.push({
      priority: periods.consistency < 40 ? 'high' : 'medium',
      category: 'consistency',
      icon: '📅',
      title: 'Improve Learning Consistency',
      description: 'You study on ' + periods.consistency + '% of days. Studying at least 5 minutes daily builds stronger long-term memory.',
      action: 'Set a daily review reminder',
      actionType: 'goal',
    });
  }
  
  // 4. Weak part of speech
  if (difficultGroups.hardest && difficultGroups.hardest.length > 0) {
    var hardest = difficultGroups.hardest[0];
    if (hardest.masteryPercent < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'vocabulary',
        icon: '📚',
        title: 'Focus on ' + hardest.name,
        description: 'You have only mastered ' + hardest.masteryPercent + '% of ' + hardest.name.toLowerCase() + '. Practice these word types more.',
        action: 'Study ' + hardest.name,
        actionType: 'focus-group',
      });
    }
  }
  
  // 5. Study time
  if (sessions.length > 0) {
    var recentSessions = sessions.filter(function(s) { return s.startTime > Date.now() - 7 * 24 * 60 * 60 * 1000; });
    var totalMinutes = recentSessions.reduce(function(sum, s) { return sum + (s.duration || 0); }, 0);
    if (totalMinutes < 30 && recentSessions.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'study-habits',
        icon: '⏱️',
        title: 'Increase Study Time',
        description: 'You studied ' + totalMinutes + ' minutes this week. Aim for 10-15 minutes per session for optimal learning.',
        action: 'Extend study sessions',
        actionType: 'goal',
      });
    }
  }
  
  // 6. Quiz performance
  var quizHistory = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
  if (quizHistory && quizHistory.total >= 10) {
    var accuracy = (quizHistory.correct / quizHistory.total) * 100;
    if (accuracy < 70) {
      recommendations.push({
        priority: 'high',
        category: 'quiz',
        icon: '📝',
        title: 'Quiz Accuracy: ' + Math.round(accuracy) + '%',
        description: 'Your quiz accuracy is below 70%. Review the words you missed and try again.',
        action: 'Take a quiz',
        actionType: 'quiz',
      });
    }
  }
  
  // 7. Leeches
  if (srsStats && srsStats.leechCount > 0) {
    recommendations.push({
      priority: srsStats.leechCount > 5 ? 'high' : 'low',
      category: 'focus',
      icon: '💢',
      title: 'Leeched Words: ' + srsStats.leechCount,
      description: srsStats.leechCount + ' words are marked as leeches (persistently difficult). Give them extra attention with focused review.',
      action: 'Review leeched words',
      actionType: 'review-leeches',
    });
  }
  
  // 8. Streak encouragement
  if (streakData && streakData.streak > 0 && streakData.streak < 7) {
    var daysTo7 = 7 - streakData.streak;
    if (daysTo7 > 0) {
      recommendations.push({
        priority: 'low',
        category: 'streak',
        icon: '🔥',
        title: streakData.streak + '-Day Streak!',
        description: 'You\'re on a ' + streakData.streak + '-day streak! ' + daysTo7 + ' more days to reach a 7-day streak milestone.',
        action: 'Keep studying daily',
        actionType: 'streak',
      });
    }
  }
  
  // Sort by priority
  var priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort(function(a, b) { return priorityOrder[a.priority] - priorityOrder[b.priority]; });
  
  return recommendations;
}

// ═══════════════════════════════════════════════════════════════
// REMAINING REVIEW WORKLOAD
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the remaining review workload for upcoming periods.
 */
function getReviewWorkload() {
  var srsData = loadSRS();
  var now = Date.now();
  var dayMs = 24 * 60 * 60 * 1000;
  
  var periods = [
    { label: 'Today', days: 0 },
    { label: 'Tomorrow', days: 1 },
    { label: 'This Week', days: 7 },
    { label: 'Next 2 Weeks', days: 14 },
    { label: 'This Month', days: 30 },
  ];
  
  var allWords = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  
  var workload = [];
  
  for (var pi = 0; pi < periods.length; pi++) {
    var p = periods[pi];
    var cutoff = now + p.days * dayMs;
    var count = 0;
    
    for (var wi = 0; wi < allWords.length; wi++) {
      var entry = srsData[allWords[wi].id];
      if (entry && entry.dueDate && entry.dueDate <= cutoff) {
        count++;
      }
    }
    
    var prevCutoff = now + (pi > 0 ? periods[pi - 1].days : -1) * dayMs;
    var newCount = 0;
    for (var wi2 = 0; wi2 < allWords.length; wi2++) {
      var e2 = srsData[allWords[wi2].id];
      if (e2 && e2.dueDate && e2.dueDate > prevCutoff && e2.dueDate <= cutoff) {
        newCount++;
      }
    }
    
    workload.push({
      label: p.label,
      totalDue: count,
      newDue: newCount,
    });
  }
  
  return workload;
}

// ═══════════════════════════════════════════════════════════════
// PERSONALIZED GOALS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate personalized daily and weekly learning goals.
 */
function getPersonalizedGoals() {
  var forecasts = getForecasts();
  var periods = getPeriodSummaries();
  var srsStats = (window.__srs && window.__srs.getStats) ? window.__srs.getStats() : null;
  var streakData = loadStreakDataAnalytics();
  
  var goals = [];
  
  // Daily review goal based on current pace
  var avgDailyReviews = 0;
  if (periods && periods.week && periods.week.avgReviewsPerDay) {
    avgDailyReviews = periods.week.avgReviewsPerDay;
  } else if (periods && periods.month && periods.month.avgReviewsPerDay) {
    avgDailyReviews = periods.month.avgReviewsPerDay;
  }
  
  var suggestedDailyReviews = Math.max(5, Math.min(50, Math.round(avgDailyReviews * 1.2)));
  goals.push({
    type: 'daily',
    title: 'Daily Reviews: ' + suggestedDailyReviews,
    description: 'Review ' + suggestedDailyReviews + ' words per day to maintain your current learning pace and build lasting retention.',
    target: suggestedDailyReviews,
    current: srsStats ? srsStats.reviewsToday || 0 : 0,
    unit: 'reviews',
  });
  
  // Weekly mastery goal
  if (forecasts && forecasts.masteryRatePerDay) {
    var weeklyGoal = Math.max(3, Math.round(forecasts.masteryRatePerDay * 7));
    goals.push({
      type: 'weekly',
      title: 'Weekly Mastery: ' + weeklyGoal + ' words',
      description: 'Aim to master ' + weeklyGoal + ' new words this week at your current pace of ' + forecasts.masteryRatePerDay + ' words/day.',
      target: weeklyGoal,
      unit: 'words mastered',
    });
  }
  
  // Streak goal
  if (streakData) {
    var currentStreak = streakData.streak || 0;
    var nextMilestone = 0;
    var milestones = [7, 14, 30, 50, 100, 365];
    for (var mi = 0; mi < milestones.length; mi++) {
      if (currentStreak < milestones[mi]) {
        nextMilestone = milestones[mi];
        break;
      }
    }
    if (nextMilestone > 0) {
      goals.push({
        type: 'streak',
        title: 'Streak: ' + currentStreak + ' → ' + nextMilestone + ' days',
        description: 'You are ' + (nextMilestone - currentStreak) + ' days away from a ' + nextMilestone + '-day learning streak. Study daily to reach it!',
        target: nextMilestone,
        current: currentStreak,
        unit: 'days',
      });
    }
  }
  
  // Foundation completion goal
  var fCompleted = (typeof getCompletedFoundationLessonCount === 'function') ? getCompletedFoundationLessonCount() : 0;
  var fTotal = (typeof getFoundationLessonCount === 'function') ? getFoundationLessonCount() : 0;
  if (fCompleted < fTotal && forecasts && forecasts.daysToFoundationCompletion) {
    goals.push({
      type: 'milestone',
      title: 'Foundation Course: ' + fCompleted + '/' + fTotal,
      description: 'Estimated completion in ~' + forecasts.daysToFoundationCompletion + ' days at your current pace.',
      target: fTotal,
      current: fCompleted,
      unit: 'lessons',
    });
  }
  
  // Accuracy goal
  var quizHistory = (typeof loadQuizHistory === 'function') ? loadQuizHistory() : null;
  if (quizHistory && quizHistory.total >= 5) {
    var accuracy = Math.round((quizHistory.correct / quizHistory.total) * 100);
    if (accuracy < 90) {
      goals.push({
        type: 'accuracy',
        title: 'Quiz Accuracy: ' + accuracy + '%',
        description: 'Push your quiz accuracy above 90% by reviewing missed words before retaking quizzes.',
        target: 90,
        current: accuracy,
        unit: '%',
      });
    }
  }
  
  return goals;
}

// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE LEARNING INSIGHTS
// ═══════════════════════════════════════════════════════════════

/**
 * Get comprehensive learning insights combining all analytics.
 */
function getComprehensiveInsights() {
  var profile = (typeof getLearnerProfile === 'function') ? getLearnerProfile() : null;
  var trends = getProgressTrends('30days');
  var forecasts = getForecasts();
  var periods = getPeriodSummaries();
  var achievements = getAchievementStats();
  
  return {
    profile: profile,
    trends: trends,
    forecasts: forecasts,
    periods: periods,
    achievements: achievements,
    frequentlyForgotten: getFrequentlyForgotten(),
    mostImproved: getMostImproved(),
    difficultGroups: getDifficultSemanticGroups(),
    lessonAccuracy: getAverageLessonAccuracy(),
    studyTime: getAverageStudyTime(),
    recommendations: getRecommendations(),
    reviewWorkload: getReviewWorkload(),
    goals: getPersonalizedGoals(),
  };
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the analytics engine. Call once at app startup.
 * Takes a daily snapshot and checks achievements.
 */
function initAnalytics() {
  // Record today's snapshot
  recordDailySnapshot();
  
  // Log study session start
  logStudySession();
  
  // Check achievements
  var newlyEarned = checkAchievements();
  if (newlyEarned.length > 0) {
    window.__DEV__ && console.log('[analytics] 🎉 New achievements earned:', newlyEarned.map(function(a) { return a.title; }).join(', '));
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function getDateKeyAnalytics() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function getTodayStartAnalytics() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDateKey(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function formatDateLabel(dateStr) {
  // "2024-3-15" → "Mar 15"
  var parts = dateStr.split('-');
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var month = parseInt(parts[1], 10) - 1;
  return monthNames[month] + ' ' + parseInt(parts[2], 10);
}

function loadStreakDataAnalytics() {
  try {
    var raw = localStorage.getItem('quran_streak');
    if (!raw) return { streak: 0, lastDate: null };
    return JSON.parse(raw);
  } catch (e) {
    return { streak: 0, lastDate: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT (via window for non-module compatibility)
// ═══════════════════════════════════════════════════════════════

window.__analytics = {
  init: initAnalytics,
  recordDailySnapshot: recordDailySnapshot,
  logSession: logStudySession,
  getTrends: getProgressTrends,
  getForecasts: getForecasts,
  getPeriodSummaries: getPeriodSummaries,
  getComprehensiveInsights: getComprehensiveInsights,
  getAllAchievements: getAllAchievements,
  getAchievementStats: getAchievementStats,
  checkAchievements: checkAchievements,
  getHistory: loadAnalyticsHistory,
  getFrequentlyForgotten: getFrequentlyForgotten,
  getMostImproved: getMostImproved,
  getDifficultGroups: getDifficultSemanticGroups,
  getLessonAccuracy: getAverageLessonAccuracy,
  getStudyTime: getAverageStudyTime,
  getRecommendations: getRecommendations,
  getReviewWorkload: getReviewWorkload,
  getGoals: getPersonalizedGoals,
};
