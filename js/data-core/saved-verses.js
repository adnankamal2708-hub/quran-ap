// ═══════════════════════════════════════════════════════════════
// saved-verses.js — Verses the learner keeps for later
//
// Stored on this device as { "2:255": savedAtMs, ... } under
// SAVED_VERSES_KEY and synced with the account as `savedVerses`
// (js/services/sync-service.js), where the newest save or unsave of a verse
// wins. Kept apart from saved words (quran_favorites): that list's loader
// rewrites every key that is not a word id.
//
// Free accounts can save APP_FACTS.limits.savedVerses verses; Premium
// (unlimited bookmarks) has no limit. Verses kept past the limit, for example
// after a Premium plan ends, stay saved: the limit only blocks new saves.
// ═══════════════════════════════════════════════════════════════

var SAVED_VERSES_KEY = 'quran_saved_verses';

/** All saved verses: { "surah:verse": savedAtMs }. Corrupt storage → {}. */
function loadSavedVerses() {
  try {
    var data = JSON.parse(localStorage.getItem(SAVED_VERSES_KEY) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) {
    return {};
  }
}

function isVerseSaved(key) {
  return !!loadSavedVerses()[key];
}

function _savedVersesUnlimited() {
  var p = typeof window !== 'undefined' ? window.__premium : null;
  return !!(p && p.hasFeature && p.hasFeature(p.FEATURES.UNLIMITED_BOOKMARKS));
}

/**
 * Save a verse, or unsave it if it is saved.
 * @param {string} key - "surah:verse", e.g. "2:255"
 * @returns {'saved'|'removed'|'limit'} 'limit' when a free account is full
 */
function toggleSavedVerse(key) {
  var saved = loadSavedVerses();
  var on = !saved[key];
  if (on && !_savedVersesUnlimited() && Object.keys(saved).length >= APP_FACTS.limits.savedVerses) {
    return 'limit';
  }
  if (on) saved[key] = Date.now(); else delete saved[key];
  try {
    localStorage.setItem(SAVED_VERSES_KEY, JSON.stringify(saved));
  } catch (e) {
    return on ? 'limit' : 'removed';
  }
  // Timestamp the change so an unsave syncs instead of being undone
  if (typeof markSyncChange === 'function') markSyncChange('verses', key, on);
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var sync = typeof window !== 'undefined' ? window.__sync : null;
  if (user && sync && sync.queueSync) sync.queueSync(user.uid);
  return on ? 'saved' : 'removed';
}

/** Saved verse keys, newest first. */
function savedVerseList() {
  var saved = loadSavedVerses();
  return Object.keys(saved).sort(function (a, b) { return (saved[b] || 0) - (saved[a] || 0); });
}
