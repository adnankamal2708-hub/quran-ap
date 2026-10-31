// ═══════════════════════════════════════════════════════════════
// account-progress.js — Keep an account's progress out of the guest view
//
// Signing in merges the device's progress with the account's, so the
// device's storage then holds the account's progress. Signing out used to
// leave it there, and the guest saw it. Now, when a session ends, the
// account's progress is put aside under a per-account key and the app
// reloads as a clean guest; when that account signs in again, it comes
// back (merged with anything the guest learned meanwhile).
//
// Nothing is deleted: cloud sync is Premium-only, so for a free account
// this device's copy is the only one. Device settings (theme, reader size,
// tours seen) are not anyone's progress and stay where they are.
// Deleting the account clears storage itself (profile-ui.js), so that sign-
// out skips the stash (skipNextSignOutStash).
// ═══════════════════════════════════════════════════════════════

/** Prefix of the key an account's progress is put aside under. */
var ACCOUNT_STASH_PREFIX = 'bayan_account_progress_';

/**
 * Keys holding a person's progress: everything cloud sync carries, plus the
 * local-only progress kept beside it.
 */
var ACCOUNT_PROGRESS_LOCAL_KEYS = [
  'quran_sync_pending',
  'quran_mixed_review_state',
  'quran_quran_last',
  'quran_progressive_unlocked',
  'quran_onboarding_goal',
  'quran_onboarding_level',
  'quran_tafsir_usage',
  'bayan_guided_reading',
  'bayan_learning_momentum',
  'bayan_dismissed_cards',
  'bayan_grad_seen',
];

function accountProgressKeys() {
  var synced = Object.keys(SYNC_KEY_MAP).map(function (k) { return SYNC_KEY_MAP[k]; });
  return synced.concat(ACCOUNT_PROGRESS_LOCAL_KEYS);
}

/** Replaced in tests; reloads into the sign-in screen after a sign-out. */
var accountProgressReload = function () {
  window.location.replace(window.location.pathname + '?auth=login');
};

function _readStash(uid) {
  try {
    var parsed = JSON.parse(localStorage.getItem(ACCOUNT_STASH_PREFIX + uid) || 'null');
    return parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
  } catch (e) {
    return null;
  }
}

/** The sync-shaped object mergeData() takes, built from raw stored values. */
function _syncShape(raw) {
  var out = {};
  Object.keys(SYNC_KEY_MAP).forEach(function (key) {
    var value = raw[SYNC_KEY_MAP[key]];
    if (value === undefined || value === null) return;
    try { out[key] = JSON.parse(value); } catch (e) { /* unreadable copy is skipped */ }
  });
  return out;
}

function _currentRaw() {
  var raw = {};
  accountProgressKeys().forEach(function (k) {
    var value = localStorage.getItem(k);
    if (value !== null) raw[k] = value;
  });
  return raw;
}

/**
 * Merge two raw copies of the progress keys. Synced keys go through the
 * same merge as cloud sync; other keys take `preferred` when it has them.
 */
function _mergeRaw(base, preferred) {
  var merged = {};
  var synced = mergeData(_syncShape(base), _syncShape(preferred));
  Object.keys(SYNC_KEY_MAP).forEach(function (key) {
    if (synced[key] !== undefined && synced[key] !== null) merged[SYNC_KEY_MAP[key]] = JSON.stringify(synced[key]);
  });
  ACCOUNT_PROGRESS_LOCAL_KEYS.forEach(function (k) {
    if (preferred[k] !== undefined) merged[k] = preferred[k];
    else if (base[k] !== undefined) merged[k] = base[k];
  });
  return merged;
}

/** Put this account's progress aside and leave a clean guest view. */
function stashAccountProgress(uid) {
  if (!uid) return;
  var current = _currentRaw();
  var existing = _readStash(uid);
  var data = existing ? _mergeRaw(existing, current) : current;
  try {
    localStorage.setItem(ACCOUNT_STASH_PREFIX + uid, JSON.stringify({ savedAt: Date.now(), data: data }));
  } catch (e) {
    // Without room to put it aside, keep the progress where it is.
    console.warn('[account-progress] Could not put progress aside:', e.message);
    return;
  }
  accountProgressKeys().forEach(function (k) { localStorage.removeItem(k); });
}

/** Bring back this account's put-aside progress. Returns true if there was any. */
function restoreAccountProgress(uid) {
  var stash = uid ? _readStash(uid) : null;
  if (!stash) return false;
  var merged = _mergeRaw(_currentRaw(), stash);
  Object.keys(merged).forEach(function (k) { localStorage.setItem(k, merged[k]); });
  localStorage.removeItem(ACCOUNT_STASH_PREFIX + uid);
  refreshAfterProgressChange();
  return true;
}

/** Drop in-memory copies so every screen reads the progress just written. */
function refreshAfterProgressChange() {
  if (typeof invalidateSRSMemoryCache === 'function') invalidateSRSMemoryCache();
  if (typeof invalidateStatsCache === 'function') invalidateStatsCache();
  if (typeof invalidateReviewCenterCache === 'function') invalidateReviewCenterCache();
}

// ── Auth changes ───────────────────────────────────────────────

var _signedInUid = null;
var _skipNextStash = false;

/** Account deletion clears storage itself: its sign-out must not stash or reload. */
function skipNextSignOutStash(on) {
  _skipNextStash = !!on;
}

function handleAccountAuthChange(user) {
  if (user && user.uid) {
    if (_signedInUid === user.uid) return;
    _signedInUid = user.uid;
    restoreAccountProgress(user.uid);
    return;
  }
  if (!_signedInUid) return;
  var uid = _signedInUid;
  _signedInUid = null;
  if (_skipNextStash) {
    _skipNextStash = false;
    return;
  }
  stashAccountProgress(uid);
  accountProgressReload();
}

/** Test helper: forget who is signed in. */
function resetAccountProgressState() {
  _signedInUid = null;
  _skipNextStash = false;
}

if (typeof onAuthChange === 'function') onAuthChange(handleAccountAuthChange);

window.__accountProgress = {
  stash: stashAccountProgress,
  restore: restoreAccountProgress,
  refresh: refreshAfterProgressChange,
  skipNextSignOutStash: skipNextSignOutStash,
};
