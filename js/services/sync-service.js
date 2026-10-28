// ═══════════════════════════════════════════════════════════════
// sync-service.js — Cloud Data Synchronization (v12 Modular SDK)
//
// Syncs localStorage learning data to Firestore (and back).
// Strategy: Local-first — all writes go to localStorage immediately,
// then are debounced and uploaded to Firestore. On login, remote
// data is merged with local data.
//
// Offline behavior:
//   • All data saves locally as normal.
//   • Pending sync changes are queued in localStorage.
//   • On next online login, queued changes are pushed.
//
// Firebase v12 modular functions are accessed through
// window.__firebaseCore (provided by firebase-core.js module).
// ═══════════════════════════════════════════════════════════════

// ── Import Firebase functions from the core bridge ─────────────
// Declared here as vars and bound inside initSync() after Firebase core
// is confirmed ready. This avoids a race condition where the module-level
// destructuring runs before window.__firebaseCore is populated.
var _doc, _getDoc, _setDoc, _deleteDoc, _serverTimestamp;

/** @type {boolean} Whether Firestore is available */
let _syncReady = false;

/** Debounce timer for sync writes */
let _syncTimer = null;

/** Whether a sync is currently in progress */
let _syncing = false;

// ── Initialization ────────────────────────────────────────────

/**
 * Initialize the sync service. Must be called after Firebase core initializes.
 */
function initSync() {
  const coreOk = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
  if (!coreOk) {
    console.warn('[sync] Firebase core not available — sync disabled.');
    _syncReady = false;
    return false;
  }

  try {
    const db = window.__firebaseCore.getDb();
    if (!db) {
      console.warn('[sync] Firestore not available — sync disabled.');
      _syncReady = false;
      return false;
    }

    // Bind Firebase Firestore functions now that core is confirmed ready
    var _core = window.__firebaseCore;
    _doc             = _core.doc;
    _getDoc          = _core.getDoc;
    _setDoc          = _core.setDoc;
    _deleteDoc       = _core.deleteDoc;
    _serverTimestamp = _core.serverTimestamp;

    // NOTE: Offline persistence is already enabled in firebase-core.js initCore().
    // No need to enable it again here.

    _syncReady = true;
    console.log('[sync] Sync service initialized with v12 modular SDK.');
    return true;
  } catch (e) {
    console.warn('[sync] Init failed:', e.message);
    _syncReady = false;
    return false;
  }
}

/**
 * Check if sync service is ready.
 */
function isSyncReady() {
  return _syncReady;
}

// ── Data Export (localStorage → object) ───────────────────────

/**
 * Synced data keys → localStorage keys. Single source of truth for export
 * and import, so a key can never be uploaded but not restored. Every key
 * here must also be handled in mergeData(), or fullSync drops the cloud copy.
 */
var SYNC_KEY_MAP = {
  srsData: 'quran_srs_data',
  favorites: 'quran_favorites',
  notes: 'quran_notes',
  streak: 'quran_streak',
  quiz: 'quran_quiz',
  settings: 'quran_settings',
  lessonProgress: 'quran_lesson_progress',
  surahProgress: 'quran_surah_progress',
  foundationProgress: 'quran_foundation_progress',
  rootFamilyProgress: 'quran_root_family_progress',
  difficultyProgress: 'quran_difficulty_progress',
  quizHistory: 'quran_quiz_history',
  learningGoal: 'quran_learning_goal',
  analyticsHistory: 'quran_analytics_history',
  analyticsAchievements: 'quran_analytics_achievements',
  analyticsSessions: 'quran_analytics_sessions',
};

/**
 * Export all app data from localStorage as a single portable object.
 */
function exportLocalData() {
  var data = {};

  Object.keys(SYNC_KEY_MAP).forEach(function (key) {
    try {
      var raw = localStorage.getItem(SYNC_KEY_MAP[key]);
      if (raw) data[key] = JSON.parse(raw);
    } catch (e) { /* skip */ }
  });

  data._exportedAt = new Date().toISOString();
  return data;
}

/**
 * Import data into localStorage. Returns { imported: [keys], skipped: [keys] }
 */
function importLocalData(data) {
  var imported = [];
  var skipped = [];

  if (!data || typeof data !== 'object') {
    return { imported: [], skipped: [], error: 'Invalid data format.' };
  }

  Object.keys(SYNC_KEY_MAP).forEach(function (key) {
    if (data[key] === undefined) return;
    try {
      localStorage.setItem(SYNC_KEY_MAP[key], JSON.stringify(data[key]));
      imported.push(key);
    } catch (e) {
      skipped.push(key);
    }
  });

  return { imported: imported, skipped: skipped };
}

// ── Cloud Upload ──────────────────────────────────────────────

/**
 * Upload all local learning data to Firestore for the current user.
 * Data is stored in a single document per user under FIRESTORE_LEARNING_COLLECTION.
 * Includes retry logic with exponential backoff for transient failures.
 */
async function uploadToCloud(userId, retryCount) {
  if (retryCount == null) retryCount = 0;

  // Premium gate enforced inside the function itself (not just at UI call
  // sites) so a free user cannot self-grant sync by calling
  // window.__sync.uploadToCloud() directly from the console.
  if (!(await _isSyncAllowed())) {
    console.log('[sync] Cloud sync is a premium feature. Skipping upload for free user.');
    if (window.__premium && typeof window.__premium.requestUpgrade === 'function') {
      window.__premium.requestUpgrade('cloud-sync');
    }
    return false;
  }

  if (!_syncReady) {
    console.warn('[sync] Cannot upload — sync not initialized.');
    return false;
  }
  if (!userId) {
    console.warn('[sync] Cannot upload — no user ID.');
    return false;
  }

  try {
    var data = exportLocalData();
    delete data._exportedAt;

    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) {
      console.warn('[sync] Firestore not available.');
      return false;
    }

    var docRef = _doc(db, FIRESTORE_LEARNING_COLLECTION, userId);

    await _setDoc(docRef, {
      learningData: data,
      updatedAt: _serverTimestamp(),
    }, { merge: true });

    console.log('[sync] Data uploaded to cloud.');
    return true;
  } catch (e) {
    // Retry with exponential backoff for transient errors (network, rate-limit)
    if (retryCount < 3 && _isRetryableError(e)) {
      var delayMs = Math.pow(2, retryCount) * 1000;
      console.warn('[sync] Upload failed (attempt ' + (retryCount + 1) + '), retrying in ' + delayMs + 'ms:', e.message);
      await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
      return uploadToCloud(userId, retryCount + 1);
    }
    console.warn('[sync] Upload failed:', e.message);
    return false;
  }
}

/**
 * Check if a Firestore error is transient and should be retried.
 */
function _isRetryableError(error) {
  var code = error.code || '';
  return code === 'unavailable' ||
         code === 'resource-exhausted' ||
         code === 'deadline-exceeded' ||
         code === 'aborted' ||
         (error.message && error.message.indexOf('network') >= 0);
}

/**
 * Download learning data from Firestore for the current user.
 * Returns the data object or null.
 * Includes retry logic with exponential backoff.
 */
async function downloadFromCloud(userId, retryCount) {
  if (retryCount == null) retryCount = 0;
  if (!_syncReady) {
    console.warn('[sync] Cannot download — sync not initialized.');
    return null;
  }
  if (!userId) {
    console.warn('[sync] Cannot download — no user ID.');
    return null;
  }

  try {
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) {
      console.warn('[sync] Firestore not available.');
      return null;
    }

    var docRef = _doc(db, FIRESTORE_LEARNING_COLLECTION, userId);
    var snap = await _getDoc(docRef);

    if (!snap.exists()) {
      console.log('[sync] No cloud data found for user.');
      return null;
    }

    var result = snap.data();
    return result.learningData || null;
  } catch (e) {
    // Retry with exponential backoff for transient errors
    if (retryCount < 3 && _isRetryableError(e)) {
      var delayMs = Math.pow(2, retryCount) * 1000;
      console.warn('[sync] Download failed (attempt ' + (retryCount + 1) + '), retrying in ' + delayMs + 'ms:', e.message);
      await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
      return downloadFromCloud(userId, retryCount + 1);
    }
    console.warn('[sync] Download failed:', e.message);
    return null;
  }
}

// ── Merge Strategy ────────────────────────────────────────────

/** Union of two arrays, preserving order (a first) without duplicates. */
function _unionArray(a, b) {
  var out = [];
  [].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []).forEach(function (v) {
    if (out.indexOf(v) < 0) out.push(v);
  });
  return out;
}

/** OR-merge of { key: bool } maps — a pass on either device counts. */
function _mergePassed(a, b) {
  var out = {};
  [a || {}, b || {}].forEach(function (src) {
    Object.keys(src).forEach(function (k) { out[k] = !!(out[k] || src[k]); });
  });
  return out;
}

/**
 * Merge two progress objects whose `listKey` array holds completed items.
 * Other fields come from the side with more completions (local on ties);
 * the completed list is the union of both, so no completion is ever lost.
 */
function _mergeCompletion(local, cloud, listKey) {
  local = local || {};
  cloud = cloud || {};
  var localCount = Array.isArray(local[listKey]) ? local[listKey].length : 0;
  var cloudCount = Array.isArray(cloud[listKey]) ? cloud[listKey].length : 0;
  var out = Object.assign({}, localCount >= cloudCount ? local : cloud);
  out[listKey] = _unionArray(local[listKey], cloud[listKey]);
  return out;
}

/** Lesson/foundation progress: union completions, OR quiz passes, furthest current lesson. */
function _mergeLessonProgress(local, cloud) {
  var out = _mergeCompletion(local, cloud, 'completedLessons');
  out.quizPassed = _mergePassed((local || {}).quizPassed, (cloud || {}).quizPassed);
  out.currentLesson = Math.max((local || {}).currentLesson || 0, (cloud || {}).currentLesson || 0);
  return out;
}

/**
 * Quiz history: per word, the record with more attempts wins. Totals take
 * the max rather than the sum — after a sync both devices share the same
 * base counts, so summing would double-count.
 */
function _mergeQuizHistory(local, cloud) {
  local = local || {};
  cloud = cloud || {};
  var byWordId = Object.assign({}, cloud.byWordId || {});
  var localByWord = local.byWordId || {};
  Object.keys(localByWord).forEach(function (id) {
    var c = byWordId[id];
    if (!c || (localByWord[id].total || 0) >= (c.total || 0)) byWordId[id] = localByWord[id];
  });
  return {
    correct: Math.max(local.correct || 0, cloud.correct || 0),
    total: Math.max(local.total || 0, cloud.total || 0),
    byWordId: byWordId,
  };
}

/**
 * Merge two arrays of records keyed by `field`. When both sides hold a
 * record with the same key, `pick(local, cloud)` chooses one. The result
 * is sorted ascending by key (date / start time) like the app stores it.
 */
function _mergeKeyedArray(local, cloud, field, pick) {
  var byKey = {};
  (Array.isArray(cloud) ? cloud : []).forEach(function (r) {
    if (r && r[field] != null) byKey[r[field]] = r;
  });
  (Array.isArray(local) ? local : []).forEach(function (r) {
    if (!r || r[field] == null) return;
    var other = byKey[r[field]];
    byKey[r[field]] = other ? pick(r, other) : r;
  });
  return Object.keys(byKey).map(function (k) { return byKey[k]; }).sort(function (a, b) {
    return a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
  });
}

/** Achievements ({ id: { date, ... } }): union by id, keeping the earliest earned date. */
function _mergeAchievements(local, cloud) {
  var out = Object.assign({}, cloud || {});
  Object.keys(local || {}).forEach(function (id) {
    var l = local[id];
    var c = out[id];
    if (!c || (l && l.date && (!c.date || l.date < c.date))) out[id] = l;
  });
  return out;
}

/**
 * Merge local and cloud data key by key. Progress is merged so that work
 * done on either device is never lost (unions for completions, the more
 * studied record for per-word data).
 *
 * @param {Object} localData - Data from localStorage
 * @param {Object} cloudData - Data from Firestore
 * @returns {Object} Merged data
 */
function mergeData(localData, cloudData) {
  if (!cloudData) return localData || {};
  if (!localData) return cloudData || {};

  var merged = {};

  // Merge SRS data: keep the entry with more total reviews (active data wins)
  if (localData.srsData || cloudData.srsData) {
    var localSRS = localData.srsData || {};
    var cloudSRS = cloudData.srsData || {};
    merged.srsData = {};

    // Collect all word keys from both sources
    var allKeys = new Set();
    Object.keys(localSRS).forEach(function (k) { allKeys.add(k); });
    Object.keys(cloudSRS).forEach(function (k) { allKeys.add(k); });

    allKeys.forEach(function (key) {
      var local = localSRS[key];
      var cloud = cloudSRS[key];

      if (!local) {
        merged.srsData[key] = cloud;
      } else if (!cloud) {
        merged.srsData[key] = local;
      } else {
        // Keep the one with more total reviews (more studied)
        var localReviews = local.totalReviews || 0;
        var cloudReviews = cloud.totalReviews || 0;
        merged.srsData[key] = localReviews >= cloudReviews ? local : cloud;
      }
    });
  }

  // Merge favorites: union (keep if favorited in either)
  if (localData.favorites || cloudData.favorites) {
    merged.favorites = {};
    var localFav = localData.favorites || {};
    var cloudFav = cloudData.favorites || {};
    Object.keys(localFav).forEach(function (k) { merged.favorites[k] = true; });
    Object.keys(cloudFav).forEach(function (k) { merged.favorites[k] = true; });
  }

  // Merge notes: local preferred (most recent edits)
  if (localData.notes || cloudData.notes) {
    merged.notes = {};
    var localNotes = localData.notes || {};
    var cloudNotes = cloudData.notes || {};
    // Start with cloud, overlay local (local wins)
    Object.keys(cloudNotes).forEach(function (k) { merged.notes[k] = cloudNotes[k]; });
    Object.keys(localNotes).forEach(function (k) { merged.notes[k] = localNotes[k]; });
  }

  // Streak: keep the highest streak count, and the most recent lastDate independently.
  // Picking the whole object by streak count alone could pair a high streak with a stale
  // lastDate from another device, which would break the next-day continuation check.
  if (localData.streak || cloudData.streak) {
    var localStreak = localData.streak || { streak: 0, lastDate: null };
    var cloudStreak = cloudData.streak || { streak: 0, lastDate: null };
    merged.streak = {
      streak: Math.max(localStreak.streak || 0, cloudStreak.streak || 0),
      lastDate: (localStreak.lastDate || '') > (cloudStreak.lastDate || '')
        ? localStreak.lastDate
        : cloudStreak.lastDate,
    };
  }

  // Settings: local preferred (most recent)
  merged.settings = localData.settings || cloudData.settings || null;

  // Quiz totals: max, not sum (see _mergeQuizHistory)
  if (localData.quiz || cloudData.quiz) {
    var localQuiz = localData.quiz || { correct: 0, total: 0 };
    var cloudQuiz = cloudData.quiz || { correct: 0, total: 0 };
    merged.quiz = {
      correct: Math.max(localQuiz.correct || 0, cloudQuiz.correct || 0),
      total: Math.max(localQuiz.total || 0, cloudQuiz.total || 0),
    };
  }

  // Lesson-style progress: union of completions on both devices
  if (localData.lessonProgress || cloudData.lessonProgress) {
    merged.lessonProgress = _mergeLessonProgress(localData.lessonProgress, cloudData.lessonProgress);
  }
  if (localData.foundationProgress || cloudData.foundationProgress) {
    merged.foundationProgress = _mergeLessonProgress(localData.foundationProgress, cloudData.foundationProgress);
  }
  if (localData.surahProgress || cloudData.surahProgress) {
    merged.surahProgress = _mergeCompletion(localData.surahProgress, cloudData.surahProgress, 'completedSurahs');
    merged.surahProgress.quizPassed = _mergePassed(
      (localData.surahProgress || {}).quizPassed, (cloudData.surahProgress || {}).quizPassed);
  }
  if (localData.rootFamilyProgress || cloudData.rootFamilyProgress) {
    merged.rootFamilyProgress = _mergeCompletion(
      localData.rootFamilyProgress, cloudData.rootFamilyProgress, 'completedRoots');
  }
  if (localData.difficultyProgress || cloudData.difficultyProgress) {
    merged.difficultyProgress = _mergeCompletion(
      localData.difficultyProgress, cloudData.difficultyProgress, 'completedLevels');
    merged.difficultyProgress.currentDifficulty = Math.max(
      (localData.difficultyProgress || {}).currentDifficulty || 1,
      (cloudData.difficultyProgress || {}).currentDifficulty || 1);
  }

  if (localData.quizHistory || cloudData.quizHistory) {
    merged.quizHistory = _mergeQuizHistory(localData.quizHistory, cloudData.quizHistory);
  }

  // Learning goal: the most recently set goal wins (saveUserGoal stamps setAt)
  if (localData.learningGoal || cloudData.learningGoal) {
    var localGoal = localData.learningGoal;
    var cloudGoal = cloudData.learningGoal;
    merged.learningGoal = (!cloudGoal || (localGoal && (localGoal.setAt || 0) >= (cloudGoal.setAt || 0)))
      ? localGoal : cloudGoal;
  }

  // Analytics: daily snapshots keyed by date (the busier day wins),
  // sessions keyed by start time (the longer one wins), achievements by id.
  if (localData.analyticsHistory || cloudData.analyticsHistory) {
    merged.analyticsHistory = _mergeKeyedArray(
      localData.analyticsHistory, cloudData.analyticsHistory, 'date',
      function (l, c) {
        if ((l.reviewsDone || 0) !== (c.reviewsDone || 0)) {
          return (l.reviewsDone || 0) > (c.reviewsDone || 0) ? l : c;
        }
        return (l.masteredCount || 0) >= (c.masteredCount || 0) ? l : c;
      });
  }
  if (localData.analyticsSessions || cloudData.analyticsSessions) {
    merged.analyticsSessions = _mergeKeyedArray(
      localData.analyticsSessions, cloudData.analyticsSessions, 'startTime',
      function (l, c) { return (l.duration || 0) >= (c.duration || 0) ? l : c; });
  }
  if (localData.analyticsAchievements || cloudData.analyticsAchievements) {
    merged.analyticsAchievements = _mergeAchievements(
      localData.analyticsAchievements, cloudData.analyticsAchievements);
  }

  return merged;
}

/**
 * Premium gate for cloud sync.
 * Returns a Promise<boolean>: true only when the user has an active
 * premium subscription (CLOUD_SYNC feature). A former free-sync backdoor
 * was removed (it could be self-triggered by writing one's own
 * learning/{uid} doc), so there is deliberately no alternate free path.
 * Shared by fullSync and uploadToCloud so the gate cannot be bypassed by
 * calling window.__sync.uploadToCloud() directly.
 */
async function _isSyncAllowed() {
  return !!(window.__premium && typeof window.__premium.hasFeature === 'function' &&
    window.__premium.hasFeature(window.__premium.FEATURES.CLOUD_SYNC));
}

/**
 * Full sync operation: download cloud data, merge with local, save merged
 * result to both localStorage and Firestore.
 */
async function fullSync(userId) {
  if (!userId) {
    console.warn('[sync] Full sync requires a user ID.');
    return false;
  }

  // Premium gate (shared check — same as uploadToCloud)
  if (!(await _isSyncAllowed())) {
    console.log('[sync] Cloud sync is a premium feature. Skipping sync for free user.');
    return false;
  }

  _syncing = true;

  try {
    // 1. Export current local data
    var localData = exportLocalData();

    // 2. Download cloud data
    var cloudData = await downloadFromCloud(userId);

    // 3. Merge
    var merged = mergeData(localData, cloudData);

    // 4. Write merged data to localStorage
    var result = importLocalData(merged);
    console.log('[sync] Merged data written to localStorage:', result.imported.length, 'keys');

    // 5. Upload merged data to cloud
    var uploadOk = await uploadToCloud(userId);

    _syncing = false;
    return uploadOk;
  } catch (e) {
    console.warn('[sync] Full sync failed:', e.message);
    _syncing = false;
    return false;
  }
}

// ── Debounced Sync ────────────────────────────────────────────

/**
 * Queue a data sync. Writes to localStorage immediately, then debounces
 * the Firestore upload. Call this after any SRS action, bookmark, or note change.
 */
function queueSync(userId) {
  if (!_syncReady || !userId) return;

  // Premium gate (no alternate free path)
  var _premium = window.__premium && typeof window.__premium.hasFeature === 'function' &&
    window.__premium.hasFeature(window.__premium.FEATURES.CLOUD_SYNC);
  if (!_premium) return;

  if (_syncTimer) {
    clearTimeout(_syncTimer);
  }

  _syncTimer = setTimeout(function () {
    // Don't sync if already syncing
    if (_syncing) return;

    uploadToCloud(userId)
      .then(function (ok) {
        if (ok) {
          try { localStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* ignore */ }
        }
      })
      .catch(function (e) {
        console.warn('[sync] Debounced sync failed:', e.message);
        try { localStorage.setItem(PENDING_SYNC_KEY, 'true'); } catch (e) { /* ignore */ }
      });
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Check if there are pending unsynchronized changes.
 */
function hasPendingSync() {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Get sync status info.
 */
function getSyncStatus() {
  return {
    ready: _syncReady,
    syncing: _syncing,
    pending: hasPendingSync(),
    user: typeof getCurrentUser === 'function' ? getCurrentUser()?.uid : null,
  };
}

// ── Export ────────────────────────────────────────────────────

window.__sync = {
  init: initSync,
  isReady: isSyncReady,
  exportData: exportLocalData,
  importData: importLocalData,
  uploadToCloud: uploadToCloud,
  downloadFromCloud: downloadFromCloud,
  mergeData: mergeData,
  fullSync: fullSync,
  queueSync: queueSync,
  hasPending: hasPendingSync,
  getStatus: getSyncStatus,
};
