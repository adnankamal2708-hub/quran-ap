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

// Production flag - set to false to suppress debug logging
const SRS_STORAGE_KEY = 'quran_srs_data';

/** Default maximum reviews per day (can be overridden by user settings) */
const DEFAULT_DAILY_REVIEW_LIMIT = 25;

/** Used as the active limit — may be updated from user settings */
var DAILY_REVIEW_LIMIT = DEFAULT_DAILY_REVIEW_LIMIT;

/**
 * Update the daily review limit from user settings.
 * Call this after auth is initialized and settings are loaded.
 */
function updateDailyReviewLimit(limit) {
  if (typeof limit === 'number' && limit >= 5 && limit <= 1000) {
    DAILY_REVIEW_LIMIT = limit;
  }
}

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
 * Load SRS data with automatic migration:
 * 1. Legacy format → modern format
 * 2. Arabic-based keys → id-based keys (w_N)
 * 3. Old IDs (w_N) → canonical IDs (cw_N) after deduplication
 * 4. Merge duplicate entries that map to the same canonical ID
 */
/** Memory cache: avoid repeated JSON.parse of SRS data */
var _srsCache = null;
function loadSRS() {
  try {
    if (_srsCache !== null) return _srsCache;
    var raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      window.__DEV__ && console.warn('SRS data malformed, resetting.');
      return {};
    }
    
    var needsSave = false;
    var migrated = {};
    
    // Build arabic→firstId lookup for migration
    var arabicToFirstId = {};
    for (var mi = 0; mi < ALL_WORDS.length; mi++) {
      var mw = ALL_WORDS[mi];
      if (!arabicToFirstId[mw.arabic]) {
        arabicToFirstId[mw.arabic] = mw.id;
      }
    }
    
    // First pass: migrate all keys to canonical IDs
    var tempEntries = {}; // canonicalId → { entries: [], counts: {...} }
    
    Object.keys(parsed).forEach(function (key) {
      var entry = parsed[key];
      
      // Skip special keys (handle _leechRecovery separately)
      if (key === '_leechRecovery') {
        // Will handle this after main entry migration
        return;
      }
      
      // Migrate legacy entry format (stage missing)
      if (entry.stage === undefined) {
        entry = migrateLegacy(entry);
        needsSave = true;
      }
      
      // Determine the canonical key for this entry
      var canonicalKey = null;
      
      if (key.indexOf('cw_') === 0) {
        // Already a canonical key
        canonicalKey = key;
      } else if (key.indexOf('w_') === 0) {
        // Old ID-based key — map to canonical
        canonicalKey = (typeof getCanonicalIdForOldId === 'function') 
          ? getCanonicalIdForOldId(key) : null;
      } else {
        // Arabic-based key — convert to old ID first, then to canonical
        var oldId = arabicToFirstId[key];
        if (oldId) {
          canonicalKey = (typeof getCanonicalIdForOldId === 'function')
            ? getCanonicalIdForOldId(oldId) : null;
        }
      }
      
      if (!canonicalKey) {
        // Word not found in current vocabulary — keep the old key as fallback
        // to preserve user progress until the word data is available
        canonicalKey = key;
      }
      
      // Group entries by canonical key for merging
      if (!tempEntries[canonicalKey]) {
        tempEntries[canonicalKey] = [];
      }
      tempEntries[canonicalKey].push(entry);
    });
    
    // Second pass: merge entries for each canonical ID
    Object.keys(tempEntries).forEach(function (cid) {
      var entries = tempEntries[cid];
      if (entries.length === 1) {
        migrated[cid] = entries[0];
      } else {
        // Merge multiple entries - take highest stage, best stats
        migrated[cid] = mergeSRSEntries(entries);
        needsSave = true;
        window.__DEV__ && console.log('[srs] Merged ' + entries.length + ' SRS entries into canonical ID: ' + cid);
      }
    });
    
    // Handle _leechRecovery migration
    if (parsed._leechRecovery) {
      migrated._leechRecovery = migrateLeechRecoveryToCanonical(parsed._leechRecovery);
      if (JSON.stringify(migrated._leechRecovery) !== JSON.stringify(parsed._leechRecovery)) {
        needsSave = true;
      }
    }
    
    if (needsSave) saveSRS(migrated);
    return migrated;
  } catch (e) {
    window.__DEV__ && console.warn('Could not load SRS data:', e.message);
    return {};
  }
}

/**
 * Merge multiple SRS entries for the same canonical word.
 * Takes the highest stage, most recent review, best ease factor,
 * and accumulates review counts.
 */
function mergeSRSEntries(entries) {
  var best = {
    stage: 0,
    dueDate: 0,
    interval: 0,
    lastRating: 2,
    ratedAt: 0,
    reps: 0,
    totalReviews: 0,
    lapses: 0,
    easeFactor: DEFAULT_EASE,
    leechCount: 0,
    isLeech: false,
  };
  
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    // Take highest stage
    if (e.stage > best.stage) {
      best.stage = e.stage;
      best.dueDate = e.dueDate;
      best.interval = e.interval;
      best.lastRating = e.lastRating;
      best.ratedAt = e.ratedAt;
    } else if (e.stage === best.stage && e.ratedAt > best.ratedAt) {
      // Same stage, take most recent review
      best.dueDate = e.dueDate;
      best.interval = e.interval;
      best.lastRating = e.lastRating;
      best.ratedAt = e.ratedAt;
    }
    // Accumulate review counts
    best.reps += e.reps || 0;
    best.totalReviews += e.totalReviews || 0;
    best.lapses += e.lapses || 0;
    // Take best ease factor (highest, but cap at MAX_EASE)
    if (e.easeFactor && e.easeFactor > best.easeFactor && e.easeFactor <= MAX_EASE) {
      best.easeFactor = e.easeFactor;
    }
    // Leech: if any entry is leeched, canonical is leeched
    if (e.isLeech) {
      best.isLeech = true;
    }
    best.leechCount += (e.leechCount || 0);
  }
  
  return best;
}

/**
 * Migrate _leechRecovery keys from old IDs to canonical IDs.
 */
function migrateLeechRecoveryToCanonical(recovery) {
  if (!recovery || typeof recovery !== 'object') return recovery || {};
  var result = {};
  Object.keys(recovery).forEach(function (key) {
    var value = recovery[key];
    // Extract the word ID from the key (format: "leech_<id>")
    var idPart = key.replace(/^leech_/, '');
    var canonicalId = null;
    
    if (idPart.indexOf('cw_') === 0) {
      canonicalId = idPart;
    } else if (typeof getCanonicalIdForOldId === 'function') {
      canonicalId = getCanonicalIdForOldId(idPart);
    }
    
    if (canonicalId) {
      // If multiple old IDs map to same canonical, sum their recovery counts
      var newKey = 'leech_' + canonicalId;
      result[newKey] = (result[newKey] || 0) + value;
    }
  });
  return result;
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
    _srsCache = null;
    if (typeof invalidateCoverageCache === "function") invalidateCoverageCache();
    if (typeof invalidateReviewForecast === "function") invalidateReviewForecast();
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    window.__DEV__ && console.warn('Could not save SRS data:', e.message);
  }
}

// ── Status ─────────────────────────────────────────────────────

/**
 * Get the review status of a word by its unique ID.
 * Returns { status: 'new'|'review'|'mastered', stage, dueDate,
 *          interval, easeFactor, isLeech, retention, daysUntilDue }
 */
function getSRSStatus(wordId) {
  var data = loadSRS();
  var entry = data[wordId];

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
function getRetentionPercent(wordId) {
  var srs = getSRSStatus(wordId);
  return Math.round(srs.retention * 100);
}

// ── Rating / Scheduling ────────────────────────────────────────

/**
 * Record a rating for a word by its unique ID and compute the next review schedule.
 * rating: 0=again, 1=hard, 2=good, 3=easy
 *
 * Uses a modified SM-2 algorithm with three learning stages.
 */
function rateSRSWord(wordId, rating) {
  if (!wordId) return;
  var data = loadSRS();
  var entry = data[wordId];

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
    data[wordId] = entry;
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
    var recoveryKey = 'leech_' + wordId;
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
    delete data._leechRecovery['leech_' + wordId];
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

  data[wordId] = entry;
  saveSRS(data);
}

/**
 * Compute interval for learning stage (stage 1).
 */
function computeLearningInterval(rating, prevInterval, entry) {
  // Number of lapses (again ratings) determines interval progression
  var attemptCount = Math.min((entry.lapses || 0), 2);

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
 * Supports both lesson mode and surah mode.
 */
function getDueReviews() {
  var data = loadSRS();
  var now = Date.now();
  var due = [];

  // Use active words (respects surah mode and lesson mode)
  var words = (typeof getActiveLessonWords === 'function') ? getActiveLessonWords() : ALL_WORDS;
  if (!words || words.length === 0) words = ALL_WORDS;

  words.forEach(function (w) {
    var entry = data[w.id];
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
 * Supports both lesson mode and surah mode.
 */
function getNewWords() {
  var data = loadSRS();
  // Use active words (respects surah mode and lesson mode)
  var words = (typeof getActiveLessonWords === 'function') ? getActiveLessonWords() : ALL_WORDS;
  if (!words || words.length === 0) words = ALL_WORDS;
  return words.filter(function (w) {
    var entry = data[w.id];
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
    var entry = data[w.id];
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

// ── Performance: SRS stats caching ────────────────────────────

let _cachedStats = null;
let _lastStatsTime = 0;
const STATS_CACHE_TTL = 2000; // 2 seconds

/**
 * Get SRS stats with caching to avoid recomputing on every word card update.
 */
function getSRSStatsCached() {
  var now = Date.now();
  if (_cachedStats && (now - _lastStatsTime) < STATS_CACHE_TTL) {
    return _cachedStats;
  }
  _cachedStats = getSRSStats();
  _lastStatsTime = now;
  return _cachedStats;
}

/**
 * Invalidate all stats caches (call after SRS ratings).
 * Also invalidates the type/difficulty count caches in ui.js.
 */
function invalidateStatsCache() {
  _cachedStats = null;
  _lastStatsTime = 0;
  if (typeof invalidateStatsCaches === 'function') {
    invalidateStatsCaches();
  }
}

// ── Export ────────────────────────────────────────────────────

function invalidateSRSMemoryCache() { _srsCache = null; }

window.__srs = {
  loadSRS: loadSRS,
  saveSRS: saveSRS,
  getSRSStatus: getSRSStatus,
  rateWord: rateSRSWord,
  getDueReviews: getDueReviews,
  getNewWords: getNewWords,
  getStats: getSRSStatsCached,
  getRetention: getRetentionPercent,
  estimateRetention: estimateRetention,
  updateDailyReviewLimit: updateDailyReviewLimit,
  getDailyReviewLimit: function() { return DAILY_REVIEW_LIMIT; },
  invalidateStatsCache: invalidateStatsCache,
};
