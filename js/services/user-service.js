// ═══════════════════════════════════════════════════════════════
// user-service.js — User Profile & Account Management (v12 Modular SDK)
//
// Manages user profiles in Firestore, including name, email,
// join date, avatar, learning statistics, and settings.
//
// Profile schema (Firestore):
//   profiles/{userId}:
//     displayName: string
//     email: string
//     createdAt: timestamp (server)
//     updatedAt: timestamp (server)
//     avatarUrl: string (optional)
//     settings: {
//       dailyReviewLimit: number (default 25)
//       sessionSize: number (default 20)
//       autoImportOnLogin: boolean (default true)
//     }
//     lastSync: timestamp (server)
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

/** @type {boolean} Ready flag */
let _userReady = false;

// ── Initialization ────────────────────────────────────────────

function initUserService() {
  const coreOk = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
  if (!coreOk) {
    console.warn('[user] Firebase core not available.');
    _userReady = false;
    return false;
  }

  const db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
  if (!db) {
    console.warn('[user] Firestore not available.');
    _userReady = false;
    return false;
  }

  _userReady = true;
  return true;
}

function isUserServiceReady() {
  return _userReady;
}

// ── Profile CRUD ──────────────────────────────────────────────

/**
 * Create or update a user profile document.
 */
async function saveProfile(userId, profileData) {
  if (!_userReady) {
    console.warn('[user] Cannot save profile — service not ready.');
    return false;
  }
  if (!userId) return false;

  try {
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) return false;
    var docRef = _doc(db, FIRESTORE_PROFILE_COLLECTION, userId);

    var data = {
      updatedAt: _serverTimestamp(),
    };

    if (profileData.displayName !== undefined) data.displayName = profileData.displayName;
    if (profileData.email !== undefined) data.email = profileData.email;
    if (profileData.avatarUrl !== undefined) data.avatarUrl = profileData.avatarUrl;
    if (profileData.settings !== undefined) data.settings = profileData.settings;

    await _setDoc(docRef, data, { merge: true });
    return true;
  } catch (e) {
    console.warn('[user] Save profile failed:', e.message);
    return false;
  }
}

/**
 * Read a user profile from Firestore.
 * Returns the profile object or null.
 */
async function loadProfile(userId) {
  if (!_userReady) {
    console.warn('[user] Cannot load profile — service not ready.');
    return null;
  }
  if (!userId) return null;

  try {
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) return null;
    var docRef = _doc(db, FIRESTORE_PROFILE_COLLECTION, userId);
    var snap = await _getDoc(docRef);

    if (!snap.exists()) return null;

    return snap.data();
  } catch (e) {
    console.warn('[user] Load profile failed:', e.message);
    return null;
  }
}

/**
 * Delete a user's profile document from Firestore.
 */
async function deleteProfile(userId) {
  if (!_userReady) return false;
  if (!userId) return false;

  try {
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) return false;

    // Delete profile
    await _deleteDoc(_doc(db, FIRESTORE_PROFILE_COLLECTION, userId));

    // Delete learning data
    await _deleteDoc(_doc(db, FIRESTORE_LEARNING_COLLECTION, userId));

    return true;
  } catch (e) {
    console.warn('[user] Delete profile failed:', e.message);
    return false;
  }
}

// ── Settings ──────────────────────────────────────────────────

/**
 * Get default settings for a new user.
 */
function getDefaultSettings() {
  return {
    dailyReviewLimit: 25,
    sessionSize: 20,
    autoImportOnLogin: true,
  };
}

/**
 * Merge user settings with defaults.
 */
function mergeSettings(saved) {
  var defaults = getDefaultSettings();
  if (!saved || typeof saved !== 'object') return defaults;

  var result = {};
  Object.keys(defaults).forEach(function (key) {
    result[key] = (saved[key] !== undefined) ? saved[key] : defaults[key];
  });
  return result;
}

// ── Compute Learning Stats from SRS Data ──────────────────────

/**
 * Generate a summary of the user's learning progress (for profile display).
 */
function computeLearningSummary() {
  var srsStats = typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, totalReviews: 0 };
  var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };

  return {
    totalWords: srsStats.total || 0,
    wordsMastered: srsStats.mature || 0,
    totalReviews: srsStats.totalReviews || 0,
    streak: streakData.streak || 0,
    averageRetention: srsStats.avgRetention || 0,
  };
}

// ── Export / Import Full Account Data ────────────────────────

/**
 * Export all user data (profile + learning data) as a downloadable JSON blob.
 */
async function exportAccountData(userId) {
  // Premium gate enforced inside the function itself (not just in the UI
  // handler) so a free user cannot call window.__user.exportAccount()
  // directly from the console to bypass the gate.
  if (window.__premium && window.__premium.hasFeature &&
      !window.__premium.hasFeature(window.__premium.FEATURES.DATA_EXPORT)) {
    if (typeof window.__premium.requestUpgrade === 'function') {
      window.__premium.requestUpgrade('data-export');
    }
    return null;
  }

  var data = {
    exportedAt: new Date().toISOString(),
    version: 1,
  };

  // Add profile
  try {
    var profile = await loadProfile(userId);
    if (profile) data.profile = profile;
  } catch (e) { /* skip */ }

  // Add learning data
  try {
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (db) {
      var snap = await _getDoc(_doc(db, FIRESTORE_LEARNING_COLLECTION, userId));
      if (snap.exists()) {
        data.learningData = snap.data().learningData;
      }
    }
  } catch (e) { /* skip */ }

  // Add local data as fallback
  try {
    if (typeof exportLocalData === 'function') {
      var local = exportLocalData();
      if (local) data.localData = local;
    }
  } catch (e) { /* skip */ }

  return data;
}

// ── Tafsir Daily Limit (Firestore-backed) ────────────────────
// The free 5/day tafsir cap was previously tracked only in localStorage, so
// clearing browser storage (or incognito) reset it instantly. This mirrors the
// counter to the user's Firestore profile doc: the synchronous decision uses a
// local mirror for speed, while async hydration/write-through keep the
// authoritative count in Firestore so clearing browser storage no longer resets
// the cap. (Partial mitigation — a full server-side counter is a possible
// follow-up for stronger enforcement.)

var _tafsirUsageCache = null;   // { date, count } — in-memory mirror
var _tafsirUsageCacheUid = null; // uid the cache belongs to

function _tafsirUsageToday() {
  return new Date().toISOString().slice(0, 10);
}

function _tafsirUsageUid() {
  try {
    var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (u && u.uid) return u.uid;
  } catch (e) { /* ignore */ }
  try {
    var a = window.__auth && typeof window.__auth.getCurrentUser === 'function' ? window.__auth.getCurrentUser() : null;
    if (a && a.uid) return a.uid;
  } catch (e) { /* ignore */ }
  return null;
}

function _tafsirUsageLocal() {
  var today = _tafsirUsageToday();
  try {
    var raw = JSON.parse(localStorage.getItem('quran_tafsir_usage') || '{}');
    if (raw && raw.date === today && typeof raw.count === 'number') return raw;
  } catch (e) { /* ignore */ }
  return { date: today, count: 0 };
}

function _tafsirUsagePersistLocal(usage) {
  try { localStorage.setItem('quran_tafsir_usage', JSON.stringify(usage)); } catch (e) { /* ignore */ }
}

// Async: merge the Firestore count into the local mirror (higher count wins,
// so clearing one store can't game the cap). Also warms the in-memory cache.
async function _tafsirUsageHydrate() {
  try {
    var uid = _tafsirUsageUid();
    if (!uid) return;
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) return;
    var snap = await _getDoc(_doc(db, FIRESTORE_PROFILE_COLLECTION, uid));
    var cloud = (snap.exists() && snap.data() && snap.data().tafsirUsage) || null;
    var local = _tafsirUsageLocal();
    var today = _tafsirUsageToday();
    if (cloud && cloud.date === today && typeof cloud.count === 'number' && cloud.count > local.count) {
      _tafsirUsagePersistLocal(cloud);
    }
    _tafsirUsageCache = _tafsirUsageLocal();
    _tafsirUsageCacheUid = uid;
  } catch (e) { /* non-fatal */ }
}

// Async: write today's usage to the user's profile doc.
async function _tafsirUsagePersistCloud(usage) {
  try {
    var uid = _tafsirUsageUid();
    if (!uid) return;
    var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
    if (!db) return;
    await _setDoc(_doc(db, FIRESTORE_PROFILE_COLLECTION, uid), { tafsirUsage: usage }, { merge: true });
  } catch (e) { /* non-fatal */ }
}

/**
 * Check (and increment) the daily tafsir limit for free users.
 * Returns a Promise<boolean>: true if the tafsir load may proceed;
 * false if the 5/day cap is hit.
 * On a cold cache (fresh session / private window / cleared storage) this
 * AWAITS the authoritative Firestore count before deciding, so clearing
 * browser storage can no longer reset the cap. Warm-cache calls resolve on
 * the local mirror without a network read.
 */
async function checkTafsirLimit() {
  if (window.__premium && window.__premium.hasFeature &&
      window.__premium.hasFeature(window.__premium.FEATURES.UNLIMITED_TAFSIR)) {
    return true;
  }
  var uid = _tafsirUsageUid();
  var today = _tafsirUsageToday();
  if (!_tafsirUsageCache || _tafsirUsageCache.date !== today || _tafsirUsageCacheUid !== uid) {
    // Cold cache: block the decision until the Firestore mirror is loaded so
    // the cap is enforced immediately (no pre-hydration window to exploit).
    await _tafsirUsageHydrate();
    if (!_tafsirUsageCache || _tafsirUsageCache.date !== today || _tafsirUsageCacheUid !== uid) {
      _tafsirUsageCache = _tafsirUsageLocal();
      _tafsirUsageCacheUid = uid;
    }
  }
  if (_tafsirUsageCache.count >= 5) {
    return false;
  }
  _tafsirUsageCache.count++;
  _tafsirUsagePersistLocal(_tafsirUsageCache);
  _tafsirUsagePersistCloud(_tafsirUsageCache); // async write-through
  return true;
}

/** Reset the in-memory tafsir cache (used on sign-out / tests). */
function resetTafsirLimitCache() {
  _tafsirUsageCache = null;
  _tafsirUsageCacheUid = null;
}

// Keep the tafsir limit cache warm across sign-ins so a fresh session picks up
// the Firestore count immediately (safe no-op when auth isn't loaded yet).
if (typeof onAuthChange === 'function') {
  try {
    onAuthChange(function () { _tafsirUsageHydrate(); });
  } catch (e) { /* ignore */ }
}

// ── Export ────────────────────────────────────────────────────

window.__user = {
  init: initUserService,
  isReady: isUserServiceReady,
  saveProfile: saveProfile,
  loadProfile: loadProfile,
  deleteProfile: deleteProfile,
  getDefaultSettings: getDefaultSettings,
  mergeSettings: mergeSettings,
  computeLearningSummary: computeLearningSummary,
  exportAccount: exportAccountData,
  checkTafsirLimit: checkTafsirLimit,
  resetTafsirLimitCache: resetTafsirLimitCache,
};
