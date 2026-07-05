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
  
  // Check achievements
  var newlyEarned = checkAchievements();
  if (newlyEarned.length > 0) {
    console.log('[analytics] 🎉 New achievements earned:', newlyEarned.map(function(a) { return a.title; }).join(', '));
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getDateKeyAnalytics() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function getTodayStartAnalytics() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDateKey(date) {
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
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
  getTrends: getProgressTrends,
  getForecasts: getForecasts,
  getPeriodSummaries: getPeriodSummaries,
  getComprehensiveInsights: getComprehensiveInsights,
  getAllAchievements: getAllAchievements,
  getAchievementStats: getAchievementStats,
  checkAchievements: checkAchievements,
  getHistory: loadAnalyticsHistory,
};
