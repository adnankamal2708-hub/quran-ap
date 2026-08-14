// ── Surah-based Organization ────────────────────────────────────
// Words can be organized by Surah (surahId) or by sequential lessons.
// The system supports both modes: users can study by Surah or by
// traditional sequential lessons.

/** @type {'surah'|'lesson'|'foundation'} Current organization mode */
// The Foundation Course is the app's primary learning path, so it is the
// default — NOT the legacy sequential 16-lesson track (whose "Lesson N of 16"
// header mislabeled the actual course on every fresh load).
let _orgMode = 'foundation';

/**
 * Set the organization mode.
 */
function setOrganizationMode(mode) {
  if (mode === 'surah' || mode === 'lesson' || mode === 'foundation' || mode === 'root-family' || mode === 'difficulty') {
    _orgMode = mode;
  }
}

/**
 * Get the current organization mode.
 */
function getOrganizationMode() {
  return _orgMode;
}

/** @type {number|null} Current active Surah ID (when in surah mode) */
let _activeSurahId = null;

/**
 * Set the active Surah ID for study.
 */
function setActiveSurahId(surahId) {
  _activeSurahId = surahId;
}

/**
 * Get the active Surah ID.
 */
function getActiveSurahId() {
  return _activeSurahId;
}

// ── Surah-based Word Functions ──────────────────────────────────

/**
 * Get all canonical words belonging to a specific Surah.
 * Searches both the old surahId field (for backward compat) and
 * the surahIds array on canonical entries.
 */
function getSurahWords(surahId) {
  if (!surahId) return [];
  var words = getCanonicalWords();
  return words.filter(function (w) {
    return (
      w.surahId === surahId ||
      (w.surahIds && w.surahIds.indexOf(surahId) >= 0)
    );
  });
}

/**
 * Get an array of surah IDs that have vocabulary entries.
 */
function getSurahsWithVocabulary() {
  var surahIds = {};
  // Check canonical words first
  var words = CANONICAL_WORDS.length > 0 ? CANONICAL_WORDS : ALL_WORDS;
  for (var si = 0; si < words.length; si++) {
    var w = words[si];
    if (w.surahIds) {
      w.surahIds.forEach(function(sid) { surahIds[sid] = true; });
    } else if (w.surahId) {
      surahIds[w.surahId] = true;
    }
  }
  return Object.keys(surahIds).map(Number).sort(function(a,b) { return a - b; });
}

/**
 * Get the highest surah ID that currently has vocabulary data.
 *
 * THIS VALUE DRIVES EVERY BETA-SCOPE LABEL IN THE APP.
 * It is derived directly from the vocabulary data at runtime and
 * should NEVER be hardcoded anywhere. When more surah vocabulary
 * is added to the project (new ALL_WORDS entries with surahIds),
 * this function automatically returns a higher value and all
 * UI labels update with zero code changes.
 *
 * @returns {number} The highest surah ID with vocabulary, or 0 if none.
 */
function getMaxCoveredSurah() {
  var surahIds = getSurahsWithVocabulary();
  return surahIds.length > 0 ? surahIds[surahIds.length - 1] : 0;
}

/**
 * Populate the Beta badge in the top bar with the dynamically
 * derived coverage range. Safe to call early (data must be loaded).
 */
function populateBetaBadge() {
  var badge = document.getElementById('beta-badge');
  if (!badge) return;
  try {
    var maxSurah = getMaxCoveredSurah();
    if (maxSurah > 0) {
      badge.textContent = 'Beta';
      badge.title = 'Beta \u00B7 Surahs 1\u2013' + maxSurah + ' available now, more added regularly';
      if (badge.style.display === 'none') {
        badge.style.display = 'inline-flex';
      }
    }
  } catch (e) {
    // Silently fail — badge hidden by default is a safe fallback
  }
}
