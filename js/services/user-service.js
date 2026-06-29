// ═══════════════════════════════════════════════════════════════
// user-service.js — User Profile & Account Management
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
// ═══════════════════════════════════════════════════════════════

/** @type {firebase.firestore.Firestore|null} */
let _userDb = null;

/** @type {boolean} Ready flag */
let _userReady = false;

// ── Initialization ────────────────────────────────────────────

function initUserService() {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('[user] Firestore not available.');
    _userReady = false;
    return false;
  }
  try {
    _userDb = firebase.firestore();
    _userReady = true;
    return true;
  } catch (e) {
    console.warn('[user] Init failed:', e.message);
    _userReady = false;
    return false;
  }
}

function isUserServiceReady() {
  return _userReady;
}

// ── Profile CRUD ──────────────────────────────────────────────

/**
 * Create or update a user profile document.
 */
async function saveProfile(userId, profileData) {
  if (!_userReady || !_userDb) {
    console.warn('[user] Cannot save profile — service not ready.');
    return false;
  }
  if (!userId) return false;

  try {
    var docRef = _userDb.collection(FIRESTORE_PROFILE_COLLECTION).doc(userId);

    var data = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (profileData.displayName !== undefined) data.displayName = profileData.displayName;
    if (profileData.email !== undefined) data.email = profileData.email;
    if (profileData.avatarUrl !== undefined) data.avatarUrl = profileData.avatarUrl;
    if (profileData.settings !== undefined) data.settings = profileData.settings;

    await docRef.set(data, { merge: true });
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
  if (!_userReady || !_userDb) {
    console.warn('[user] Cannot load profile — service not ready.');
    return null;
  }
  if (!userId) return null;

  try {
    var docRef = _userDb.collection(FIRESTORE_PROFILE_COLLECTION).doc(userId);
    var doc = await docRef.get();

    if (!doc.exists) return null;

    return doc.data();
  } catch (e) {
    console.warn('[user] Load profile failed:', e.message);
    return null;
  }
}

/**
 * Delete a user's profile document from Firestore.
 */
async function deleteProfile(userId) {
  if (!_userReady || !_userDb) return false;
  if (!userId) return false;

  try {
    // Delete profile
    await _userDb.collection(FIRESTORE_PROFILE_COLLECTION).doc(userId).delete();

    // Delete learning data
    await _userDb.collection(FIRESTORE_LEARNING_COLLECTION).doc(userId).delete();

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
  var srsStats = getSRSStats ? getSRSStats() : { total: 0, mature: 0, totalReviews: 0 };
  var streakData = loadStreakData ? loadStreakData() : { streak: 0 };

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
    var learningDoc = await _userDb.collection(FIRESTORE_LEARNING_COLLECTION).doc(userId).get();
    if (learningDoc.exists) {
      data.learningData = learningDoc.data().learningData;
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
