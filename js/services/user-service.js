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
};
