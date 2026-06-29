// ═══════════════════════════════════════════════════════════════
// srs.js — Production Spaced Repetition System
//
// Implements a modified SM-2 algorithm with:
//   • SM-2 ease factor adjustments
//   • Three learning stages (learning → young → mature)
//   • Leech detection (word persistently rated "again")
//   • Priority scheduling (overdue first, then due soon)
//   • Daily review limits
//   • Retention estimation
//   • Automatic migration from legacy data format
// ═══════════════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────────────

const SRS_STORAGE_KEY = 'quran_srs_data';

/** Maximum reviews per day */
const DAILY_REVIEW_LIMIT = 25;

/** Minimum ease factor (SM-2 standard) */
const MIN_EASE = 1.3;

/** Maximum ease factor */
const MAX_EASE = 3.0;

/** Default starting ease factor (SM-2 standard) */
const DEFAULT_EASE = 2.5;

/** Consecutive "again" ratings before leech flagging */
const LEECH_THRESHOLD = 3;

/** Good ratings needed to clear leech flag */
const LEECH_RECOVERY = 3;

/** Reviews in learning stage before graduating to young */
const LEARNING_GRADUATION = 3;

/** Total reviews before graduating to mature */
const YOUNG_GRADUATION = 6;

/** Interval threshold (days) for young → mature graduation */
const YOUNG_MAX_INTERVAL = 21;

/** Shift interval to ensure today's items appear as "due today" even if hours overdue */
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Learning Stage Intervals (days) ──────────────────────────
// After N failed attempts within learning, use the Nth element

const STAGE1_AGAIN =  [0.007, 0.04,  0.17];   // 10min, 1hr, 4hr
const STAGE1_HARD =   [0.04,  0.17,  1];       // 1hr, 4hr, 1d
const STAGE1_GOOD =   [1,     2,     4];       // 1d, 2d, 4d
const STAGE1_EASY =   [2,     4,     8];       // 2d, 4d, 8d

// ── Data Format ────────────────────────────────────────────────
//
// Modern entry:
//   { dueDate, interval, lastRating, ratedAt, stage, reps,
//     totalReviews, lapses, easeFactor, leechCount, isLeech }
//
// Legacy entry (auto-migrated on load):
//   { dueDate, interval, lastRating, ratedAt }
//   → stage is inferred from interval

// ── Storage ────────────────────────────────────────────────────

/**
 * Load SRS data with automatic migration from legacy format.
 */
function loadSRS() {
  try {
    var raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('SRS data malformed, resetting.');
      return {};
    }
    // Migrate any legacy entries
    var needsSave = false;
    Object.keys(parsed).forEach(function (key) {
      var entry = parsed[key];
      if (entry.stage === undefined) {
        entry = migrateLegacy(entry);
        parsed[key] = entry;
        needsSave = true;
      }
    });
    if (needsSave) saveSRS(parsed);
    return parsed;
  } catch (e) {
    console.warn('Could not load SRS data:', e.message);
    return {};
  }
}

/**
 * Migrate a legacy SRS entry (interval/dueDate only) to the modern format.
 */
function migrateLegacy(entry) {
  var interval = entry.interval || 0;
  var stage = 1; // default to learning
  if (interval >= YOUNG_MAX_INTERVAL) {
    stage = 3; // mature
  } else if (interval >= 3) {
    stage = 2; // young
  }
  return {
    dueDate: entry.dueDate || Date.now(),
    interval: interval,
    lastRating: entry.lastRating !== undefined ? entry.lastRating : 2,
    ratedAt: entry.ratedAt || Date.now(),
    stage: stage,
    reps: 0,
    totalReviews: 0,
    lapses: 0,
    easeFactor: DEFAULT_EASE,
    leechCount: 0,
    isLeech: false,
  };
}

/**
 * Save SRS data to localStorage.
 */
function saveSRS(data) {
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save SRS data:', e.message);
  }
}

// ── Status ─────────────────────────────────────────────────────

/**
 * Get the review status of a word.
 * Returns { status: 'new'|'review'|'mastered', stage, dueDate,
 *          interval, easeFactor, isLeech, retention, daysUntilDue }
 */
function getSRSStatus(arabic) {
  var data = loadSRS();
  var entry = data[arabic];

  if (!entry || entry.stage === 0) {
    return {
      status: 'new',
      stage: 0,
      dueDate: null,
      interval: 0,
      easeFactor: DEFAULT_EASE,
      isLeech: false,
      retention: 1,
      daysUntilDue: null,
    };
  }

  var now = Date.now();
  var daysUntilDue = (entry.dueDate - now) / DAY_MS;
  var isDue = now >= entry.dueDate;

  // Calculate retention estimate
  var retention = estimateRetention(entry);

  if (isDue) {
    return {
      status: 'review',
      stage: entry.stage,
      dueDate: entry.dueDate,
      interval: entry.interval,
      easeFactor: entry.easeFactor,
      isLeech: !!entry.isLeech,
      retention: retention,
      daysUntilDue: -Math.max(0, Math.round(-daysUntilDue)),
    };
  }

  return {
    status: 'mastered',
    stage: entry.stage,
    dueDate: entry.dueDate,
    interval: entry.interval,
    easeFactor: entry.easeFactor,
    isLeech: !!entry.isLeech,
    retention: retention,
    daysUntilDue: Math.round(daysUntilDue),
  };
}

// ── Retention Estimation ───────────────────────────────────────

/**
 * Estimate how well a word is retained (0-1).
 * Uses a simplified forgetting curve: retention = 0.9 ^ (daysSinceReview / (interval * 0.5))
 */
function estimateRetention(entry) {
  if (!entry || !entry.interval || entry.interval <= 0) return 1;
  var daysSinceReview = (Date.now() - (entry.ratedAt || entry.dueDate)) / DAY_MS;
  if (daysSinceReview <= 0) return 0.99;
  var halfLife = entry.interval * 0.5;
  var retention = Math.pow(0.9, daysSinceReview / halfLife);
  // Clamp to realistic range
  return Math.max(0.6, Math.min(0.99, retention));
}

/**
 * Estimate retention for display (0-100%).
 */
function getRetentionPercent(arabic) {
  var srs = getSRSStatus(arabic);
  return Math.round(srs.retention * 100);
}

// ── Rating / Scheduling ────────────────────────────────────────

/**
 * Record a rating for a word and compute the next review schedule.
 * rating: 0=again, 1=hard, 2=good, 3=easy
 *
 * Uses a modified SM-2 algorithm with three learning stages.
 */
function rateSRSWord(arabic, rating) {
  var data = loadSRS();
  var entry = data[arabic];

  // Create entry if new
  if (!entry) {
    entry = {
      dueDate: Date.now(),
      interval: 0,
      lastRating: rating,
      ratedAt: Date.now(),
      stage: 1,
      reps: 0,
      totalReviews: 0,
      lapses: 0,
      easeFactor: DEFAULT_EASE,
      leechCount: 0,
      isLeech: false,
    };
    data[arabic] = entry;
  }

  // Track total reviews
  entry.totalReviews = (entry.totalReviews || 0) + 1;

  // Track lapses (again ratings)
  if (rating === 0) {
    entry.lapses = (entry.lapses || 0) + 1;
    entry.leechCount = (entry.leechCount || 0) + 1;
  } else {
    // Reduce leech count on non-again ratings
    entry.leechCount = Math.max(0, (entry.leechCount || 0) - 1);
  }

  // Leech detection
  if (entry.leechCount >= LEECH_THRESHOLD) {
    entry.isLeech = true;
  } else if (entry.isLeech && rating >= 2) {
    // Check if we've had enough consecutive good reviews
    data._leechRecovery = data._leechRecovery || {};
    var recoveryKey = 'leech_' + arabic;
    data._leechRecovery[recoveryKey] = (data._leechRecovery[recoveryKey] || 0) + 1;
    if (data._leechRecovery[recoveryKey] >= LEECH_RECOVERY) {
      entry.isLeech = false;
      entry.leechCount = 0;
      delete data._leechRecovery[recoveryKey];
      if (Object.keys(data._leechRecovery).length === 0) {
        delete data._leechRecovery;
      }
    }
  } else if (entry.isLeech && rating < 2) {
    // Bad rating resets recovery progress
    data._leechRecovery = data._leechRecovery || {};
    delete data._leechRecovery['leech_' + arabic];
    if (Object.keys(data._leechRecovery).length === 0) {
      delete data._leechRecovery;
    }
  }

  // Track successful reviews (good/easy) for graduation
  if (rating >= 2) {
    entry.reps = (entry.reps || 0) + 1;
  }

  // Update ease factor (SM-2 algorithm)
  var ef = entry.easeFactor || DEFAULT_EASE;
  if (rating === 0) ef = Math.max(MIN_EASE, ef - 0.20);
  else if (rating === 1) ef = Math.max(MIN_EASE, ef - 0.15);
  else if (rating === 3) ef = Math.min(MAX_EASE, ef + 0.15);
  entry.easeFactor = ef;

  // Compute next interval based on stage
  var prevInterval = entry.interval || 0;
  var stage = entry.stage;
  var newInterval = 0;
  var newStage = stage;

  switch (stage) {
    case 1: // Learning
      newInterval = computeLearningInterval(rating, prevInterval, entry);
      // Graduate to young after enough learning reps
      if (entry.totalReviews >= LEARNING_GRADUATION && rating >= 2) {
        newStage = 2;
      }
      // Reset to beginning of learning on again
      if (rating === 0) {
        // Stay in learning, but reset the interval progression
      }
      break;

    case 2: // Young
      if (rating === 0) {
        // Reset to learning
        newStage = 1;
        newInterval = computeLearningInterval(rating, 0, entry);
      } else if (rating === 1) {
        newInterval = Math.max(1, prevInterval * 1.2);
      } else if (rating === 2) {
        newInterval = prevInterval * ef;
      } else { // rating === 3
        newInterval = prevInterval * ef * 1.3;
      }
      // Graduate to mature
      if (entry.reps >= YOUNG_GRADUATION && newInterval >= YOUNG_MAX_INTERVAL) {
        newStage = 3;
      }
      break;

    case 3: // Mature
      if (rating === 0) {
        // Reset to young
        newStage = 2;
        newInterval = 1;
      } else if (rating === 1) {
        newInterval = Math.max(7, prevInterval * 1.2);
      } else if (rating === 2) {
        newInterval = prevInterval * ef;
      } else { // rating === 3
        newInterval = prevInterval * ef * 1.3;
      }
      break;

    default: // Stage 0 or unknown
      newInterval = computeLearningInterval(rating, 0, entry);
      newStage = 1;
  }

  // Leech cap: interval max of 7 days for leeched words
  if (entry.isLeech) {
    newInterval = Math.min(newInterval, 7);
  }

  // Round to 1 decimal for cleanliness
  newInterval = Math.round(newInterval * 10) / 10;

  var dueDate = Date.now() + Math.round(newInterval * DAY_MS);

  entry.interval = newInterval;
  entry.dueDate = dueDate;
  entry.lastRating = rating;
  entry.ratedAt = Date.now();
  entry.stage = newStage;

  data[arabic] = entry;
  saveSRS(data);
}

/**
 * Compute interval for learning stage (stage 1).
 */
function computeLearningInterval(rating, prevInterval, entry) {
  // Number of previous again/hard ratings in this learning span
  var attemptCount = Math.min(entry.totalReviews || 0, 2);

  switch (rating) {
    case 0: // Again
      return STAGE1_AGAIN[attemptCount] || STAGE1_AGAIN[2];
    case 1: // Hard
      return STAGE1_HARD[attemptCount] || STAGE1_HARD[2];
    case 2: // Good
      return STAGE1_GOOD[attemptCount] || STAGE1_GOOD[2];
    case 3: // Easy
      return STAGE1_EASY[attemptCount] || STAGE1_EASY[2];
    default:
      return 1;
  }
}

// ── Review Queue ───────────────────────────────────────────────

/**
 * Get all session words that are due for review, sorted by priority:
 * 1. Leeched words (due)
 * 2. Most overdue first
 * 3. Due today
 * 4. Due within 3 days
 * Respects daily review limit.
 */
function getDueReviews() {
  var data = loadSRS();
  var now = Date.now();
  var due = [];

  var lessonIndex = getCurrentLessonIndex();
  var words = getLessonWords(lessonIndex);
  if (!words || words.length === 0) words = ALL_WORDS;

  words.forEach(function (w) {
    var entry = data[w.arabic];
    if (!entry) return;
    if (now >= entry.dueDate) {
      due.push({
        word: w,
        entry: entry,
        overdueMs: now - entry.dueDate,
      });
    }
  });

  // Priority sort: leeched first, then most overdue
  due.sort(function (a, b) {
    // Leeched items first
    if (a.entry.isLeech && !b.entry.isLeech) return -1;
    if (!a.entry.isLeech && b.entry.isLeech) return 1;
    // Then most overdue first
    return b.overdueMs - a.overdueMs;
  });

  // Apply daily limit
  var limit = Math.min(DAILY_REVIEW_LIMIT, due.length);
  return due.slice(0, limit).map(function (d) { return d.word; });
}

/**
 * Get all session words that have not been reviewed yet.
 */
function getNewWords() {
  var data = loadSRS();
  var lessonIndex = getCurrentLessonIndex();
  var words = getLessonWords(lessonIndex);
  if (!words || words.length === 0) words = ALL_WORDS;
  return words.filter(function (w) {
    var entry = data[w.arabic];
    return !entry || entry.stage === 0;
  });
}

function getTodayStart() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── Learning Statistics ────────────────────────────────────────

/**
 * Get detailed SRS statistics.
 */
function getSRSStats() {
  var data = loadSRS();
  var now = Date.now();
  var stats = {
    total: 0,
    newCount: 0,
    learning: 0,
    young: 0,
    mature: 0,
    leechCount: 0,
    dueToday: 0,
    overdue: 0,
    totalReviews: 0,
    avgRetention: 0,
    avgEaseFactor: 0,
    reviewsToday: 0,
  };

  var todayStart = getTodayStart();
  var retentionSum = 0;
  var retentionCount = 0;
  var efSum = 0;
  var efCount = 0;

  ALL_WORDS.forEach(function (w) {
    stats.total++;
    var entry = data[w.arabic];
    if (!entry || entry.stage === 0) {
      stats.newCount++;
      return;
    }
    if (entry.stage === 1) stats.learning++;
    else if (entry.stage === 2) stats.young++;
    else if (entry.stage >= 3) stats.mature++;

    if (entry.isLeech) stats.leechCount++;
    if (now >= entry.dueDate) {
      stats.dueToday++;
      if (now - entry.dueDate > DAY_MS) stats.overdue++;
    }
    stats.totalReviews += entry.totalReviews || 0;

    if (entry.ratedAt && entry.ratedAt >= todayStart) {
      stats.reviewsToday++;
    }

    if (entry.interval > 0) {
      retentionSum += estimateRetention(entry);
      retentionCount++;
    }
    if (entry.easeFactor) {
      efSum += entry.easeFactor;
      efCount++;
    }
  });

  stats.avgRetention = retentionCount > 0 ? Math.round((retentionSum / retentionCount) * 100) : 100;
  stats.avgEaseFactor = efCount > 0 ? Math.round((efSum / efCount) * 100) / 100 : DEFAULT_EASE;

  return stats;
}
