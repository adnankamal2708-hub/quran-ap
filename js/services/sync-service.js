// ═══════════════════════════════════════════════════════════════
// sync-service.js — Cloud Data Synchronization
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
// ═══════════════════════════════════════════════════════════════

/** @type {firebase.firestore.Firestore|null} */
let _db = null;

/** @type {boolean} Whether Firestore is available */
let _syncReady = false;

/** Debounce timer for sync writes */
let _syncTimer = null;

/** Whether a sync is currently in progress */
let _syncing = false;

// ── Initialization ────────────────────────────────────────────

/**
 * Initialize the sync service. Must be called after Firebase SDK loads.
 */
function initSync() {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('[sync] Firestore SDK not loaded — sync disabled.');
    _syncReady = false;
    return false;
  }

  try {
    _db = firebase.firestore();

    _db.enablePersistence({ synchronizeTabs: true })
      .then(function () {
        console.log('[sync] Offline persistence enabled.');
      })
      .catch(function (err) {
        if (err.code === 'failed-precondition') {
          console.warn('[sync] Multiple tabs open — persistence in one tab only.');
        } else if (err.code === 'unimplemented') {
          console.warn('[sync] Browser does not support persistence.');
        }
      });

    _syncReady = true;
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

  // SRS data
  try {
    var srsRaw = localStorage.getItem('quran_srs_data');
    if (srsRaw) data.srsData = JSON.parse(srsRaw);
  } catch (e) { /* skip */ }

  // Favorites
  try {
    var favRaw = localStorage.getItem('quran_favorites');
    if (favRaw) data.favorites = JSON.parse(favRaw);
  } catch (e) { /* skip */ }

  // Notes
  try {
    var notesRaw = localStorage.getItem('quran_notes');
    if (notesRaw) data.notes = JSON.parse(notesRaw);
  } catch (e) { /* skip */ }

  // Streak
  try {
    var streakRaw = localStorage.getItem('quran_streak');
    if (streakRaw) data.streak = JSON.parse(streakRaw);
  } catch (e) { /* skip */ }

  // Quiz history (if any)
  try {
    var quizRaw = localStorage.getItem('quran_quiz');
    if (quizRaw) data.quiz = JSON.parse(quizRaw);
  } catch (e) { /* skip */ }

  // Settings
  try {
    var settingsRaw = localStorage.getItem('quran_settings');
    if (settingsRaw) data.settings = JSON.parse(settingsRaw);
  } catch (e) { /* skip */ }

  // Lesson progress
  try {
    var lessonRaw = localStorage.getItem('quran_lesson_progress');
    if (lessonRaw) data.lessonProgress = JSON.parse(lessonRaw);
  } catch (e) { /* skip */ }

  // Surah progress
  try {
    var surahRaw = localStorage.getItem('quran_surah_progress');
    if (surahRaw) data.surahProgress = JSON.parse(surahRaw);
  } catch (e) { /* skip */ }

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

  function trySet(key, subKey, value) {
    try {
      localStorage.setItem(subKey || key, JSON.stringify(value));
      imported.push(key);
    } catch (e) {
      skipped.push(key);
    }
  }

  if (data.srsData) trySet('srsData', 'quran_srs_data', data.srsData);
  if (data.favorites) trySet('favorites', 'quran_favorites', data.favorites);
  if (data.notes) trySet('notes', 'quran_notes', data.notes);
  if (data.streak) trySet('streak', 'quran_streak', data.streak);
  if (data.quiz) trySet('quiz', 'quran_quiz', data.quiz);
  if (data.settings) trySet('settings', 'quran_settings', data.settings);
  if (data.lessonProgress) trySet('lessonProgress', 'quran_lesson_progress', data.lessonProgress);
  if (data.surahProgress) trySet('surahProgress', 'quran_surah_progress', data.surahProgress);

  return { imported: imported, skipped: skipped };
}

// ── Cloud Upload ──────────────────────────────────────────────

/**
 * Upload all local learning data to Firestore for the current user.
 * Data is stored in a single document per user under FIRESTORE_LEARNING_COLLECTION.
 */
async function uploadToCloud(userId) {
  if (!_syncReady || !_db) {
    console.warn('[sync] Cannot upload — Firestore not initialized.');
    return false;
  }
  if (!userId) {
    console.warn('[sync] Cannot upload — no user ID.');
    return false;
  }

  try {
    var data = exportLocalData();

    // Remove the export timestamp before saving to cloud
    delete data._exportedAt;

    var docRef = _db.collection(FIRESTORE_LEARNING_COLLECTION).doc(userId);

    await docRef.set({
      learningData: data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('[sync] Data uploaded to cloud.');
    return true;
  } catch (e) {
    console.warn('[sync] Upload failed:', e.message);
    return false;
  }
}

/**
 * Download learning data from Firestore for the current user.
 * Returns the data object or null.
 */
async function downloadFromCloud(userId) {
  if (!_syncReady || !_db) {
    console.warn('[sync] Cannot download — Firestore not initialized.');
    return null;
  }
  if (!userId) {
    console.warn('[sync] Cannot download — no user ID.');
    return null;
  }

  try {
    var docRef = _db.collection(FIRESTORE_LEARNING_COLLECTION).doc(userId);
    var doc = await docRef.get();

    if (!doc.exists) {
      console.log('[sync] No cloud data found for user.');
      return null;
    }

    var result = doc.data();
    return result.learningData || null;
  } catch (e) {
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
  if (!_syncReady || !_db || !userId) return;

  if (_syncTimer) {
    clearTimeout(_syncTimer);
  }

  _syncTimer = setTimeout(function () {
    // Don't sync if already syncing
    if (_syncing) return;

    uploadToCloud(userId)
      .then(function (ok) {
        if (ok) {
          // Clear any pending sync flag
          try { localStorage.removeItem(PENDING_SYNC_KEY); } catch (e) { /* ignore */ }
        }
      })
      .catch(function (e) {
        console.warn('[sync] Debounced sync failed:', e.message);
        // Mark that there are pending changes
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
    user: getCurrentUser() ? getCurrentUser().uid : null,
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
