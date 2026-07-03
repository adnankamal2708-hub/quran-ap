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
// Use `var` (not `const`) so that when build.js concatenates multiple
// service files, the same variable names can be safely re-declared.
var {
  doc: _doc,
  getDoc: _getDoc,
  setDoc: _setDoc,
  deleteDoc: _deleteDoc,
  serverTimestamp: _serverTimestamp,
} = window.__firebaseCore || {};

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
 * Export all app data from localStorage as a single portable object.
 */
function exportLocalData() {
  var data = {};

  function tryParse(key, lsKey) {
    try {
      var raw = localStorage.getItem(lsKey || key);
      if (raw) data[key] = JSON.parse(raw);
    } catch (e) { /* skip */ }
  }

  tryParse('srsData', 'quran_srs_data');
  tryParse('favorites', 'quran_favorites');
  tryParse('notes', 'quran_notes');
  tryParse('streak', 'quran_streak');
  tryParse('quiz', 'quran_quiz');
  tryParse('settings', 'quran_settings');
  tryParse('lessonProgress', 'quran_lesson_progress');
  tryParse('surahProgress', 'quran_surah_progress');
  tryParse('foundationProgress', 'quran_foundation_progress');

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

  function trySet(key, lsKey, value) {
    try {
      localStorage.setItem(lsKey || key, JSON.stringify(value));
      imported.push(key);
    } catch (e) {
      skipped.push(key);
    }
  }

  var mappings = {
    srsData: 'quran_srs_data',
    favorites: 'quran_favorites',
    notes: 'quran_notes',
    streak: 'quran_streak',
    quiz: 'quran_quiz',
    settings: 'quran_settings',
    lessonProgress: 'quran_lesson_progress',
    surahProgress: 'quran_surah_progress',
    foundationProgress: 'quran_foundation_progress',
  };

  Object.keys(mappings).forEach(function (key) {
    if (data[key] !== undefined) {
      trySet(key, mappings[key], data[key]);
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

/**
 * Merge local and cloud data, preferring the most recently used data per key.
 * Strategy: For each data category, compare timestamps or keep the one with
 * more reviews if timestamps aren't available.
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

  // Streak: keep the higher streak value, but use most recent date
  if (localData.streak || cloudData.streak) {
    var localStreak = localData.streak || { streak: 0, lastDate: null };
    var cloudStreak = cloudData.streak || { streak: 0, lastDate: null };
    merged.streak = (localStreak.streak >= cloudStreak.streak) ? localStreak : cloudStreak;
  }

  // Settings: local preferred (most recent)
  merged.settings = localData.settings || cloudData.settings || null;

  // Quiz history: sum
  if (localData.quiz || cloudData.quiz) {
    var localQuiz = localData.quiz || { correct: 0, total: 0 };
    var cloudQuiz = cloudData.quiz || { correct: 0, total: 0 };
    merged.quiz = {
      correct: Math.max(localQuiz.correct || 0, cloudQuiz.correct || 0),
      total: Math.max(localQuiz.total || 0, cloudQuiz.total || 0),
    };
  }

  // Surah progress: take the one with more completed surahs
  if (localData.surahProgress || cloudData.surahProgress) {
    var localSP = localData.surahProgress || { completedSurahs: [], quizPassed: {} };
    var cloudSP = cloudData.surahProgress || { completedSurahs: [], quizPassed: {} };
    merged.surahProgress = (localSP.completedSurahs.length >= cloudSP.completedSurahs.length) ? localSP : cloudSP;
  }

  // Foundation progress: take the one with more completed lessons
  if (localData.foundationProgress || cloudData.foundationProgress) {
    var localFP = localData.foundationProgress || { completedLessons: [], quizPassed: {}, currentLesson: 0 };
    var cloudFP = cloudData.foundationProgress || { completedLessons: [], quizPassed: {}, currentLesson: 0 };
    merged.foundationProgress = (localFP.completedLessons.length >= cloudFP.completedLessons.length) ? localFP : cloudFP;
  }

  return merged;
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
