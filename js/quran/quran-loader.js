// ═══════════════════════════════════════════════════════════════
// quran-loader.js — Lazy Loader for Quran Text Data
//
// Loads the complete Quran text + English translation ONLY when
// the user enters the Read section. After first load, caches the
// data in memory for subsequent navigation.
//
// The actual text data lives in quran-data.js, which is built as
// a separate bundle (quran.bundle.min.js) and NOT included in the
// main app bundle to avoid increasing startup time.
//
// After loading, data is available via window.__QURAN_TEXT and
// utility functions exported below.
// ═══════════════════════════════════════════════════════════════

/** @type {boolean} Whether Quran data has been loaded */
let _quranLoaded = false;

/** @type {boolean} Whether a load is currently in progress */
let _quranLoading = false;

/** @type {Array<Function>} Pending callbacks waiting for load */
let _quranCallbacks = [];

/**
 * Load Quran text data dynamically.
 *
 * Injects a <script> tag pointing to the production bundle
 * (quran.bundle.min.js) which sets window.__QURAN_TEXT.
 *
 * After loading, the data is cached in memory. Subsequent calls
 * resolve immediately from the cache.
 *
 * @returns {Promise<boolean>} Resolves true when Quran data is ready
 */
function loadQuranText() {
  // Already loaded — resolve immediately
  if (_quranLoaded && window.__QURAN_TEXT) {
    return Promise.resolve(true);
  }

  // Already loading — queue callback
  if (_quranLoading) {
    return new Promise(function (resolve) {
      _quranCallbacks.push(resolve);
    });
  }

  _quranLoading = true;

  return new Promise(function (resolve) {
    // Check if data is already available (e.g., loaded by another script)
    if (window.__QURAN_TEXT) {
      _quranLoaded = true;
      _quranLoading = false;
      resolve(true);
      return;
    }

    var script = document.createElement('script');
    script.src = './js/quran.bundle.min.js';
    script.async = true;
    script.onload = function () {
      _quranLoaded = true;
      _quranLoading = false;
      resolve(true);
      // Flush pending callbacks
      for (var i = 0; i < _quranCallbacks.length; i++) {
        _quranCallbacks[i](true);
      }
      _quranCallbacks = [];
    };
    script.onerror = function () {
      _quranLoading = false;
      console.warn('[quran] Failed to load Quran text bundle');
      resolve(false);
      for (var i = 0; i < _quranCallbacks.length; i++) {
        _quranCallbacks[i](false);
      }
      _quranCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

/**
 * Check if Quran data has been loaded.
 * @returns {boolean}
 */
function isQuranLoaded() {
  return _quranLoaded && !!window.__QURAN_TEXT;
}

/**
 * Get surah info and verses by surah ID (1-114).
 * @param {number} surahId
 * @returns {Object|null} Surah object with { id, name, transliteration, type, total_verses, verses[] }
 */
function getQuranSurah(surahId) {
  if (!window.__QURAN_TEXT) return null;
  return window.__QURAN_TEXT[surahId] || null;
}

/**
 * Get a specific verse by surah and verse number.
 * @param {number} surahId
 * @param {number} verseId
 * @returns {Object|null} Verse object with { id, text, translation }
 */
function getQuranVerse(surahId, verseId) {
  var surah = getQuranSurah(surahId);
  if (!surah || !surah.verses) return null;
  // verses are 1-indexed
  return surah.verses[verseId - 1] || null;
}

/**
 * Get the global verse index (1-6236) for a surah+verse.
 * Returns { surahId, verseId }
 * @param {number} globalVerseNumber
 * @returns {Object|null}
 */
function getQuranGlobalVerse(globalVerseNumber) {
  if (!window.__QURAN_VERSE_INDEX) return null;
  return window.__QURAN_VERSE_INDEX[globalVerseNumber] || null;
}

/**
 * Get the Arabic text for a specific verse.
 * @param {number} surahId
 * @param {number} verseId
 * @returns {string} Arabic text or empty string
 */
function getQuranArabic(surahId, verseId) {
  var verse = getQuranVerse(surahId, verseId);
  return verse ? verse.text : '';
}

/**
 * Get the English translation for a specific verse.
 * @param {number} surahId
 * @param {number} verseId
 * @returns {string} Translation text or empty string
 */
function getQuranTranslation(surahId, verseId) {
  var verse = getQuranVerse(surahId, verseId);
  return verse ? verse.translation : '';
}

/**
 * Get total verse count for a surah.
 * @param {number} surahId
 * @returns {number}
 */
function getQuranSurahVerseCount(surahId) {
  var surah = getQuranSurah(surahId);
  return surah ? surah.total_verses : 0;
}

/**
 * List all surah IDs.
 * @returns {number[]}
 */
function getQuranSurahIds() {
  if (!window.__QURAN_TEXT) return [];
  return Object.keys(window.__QURAN_TEXT).map(Number).sort(function (a, b) { return a - b; });
}

// ── Export ──
window.__quranLoader = {
  load: loadQuranText,
  isLoaded: isQuranLoaded,
  getSurah: getQuranSurah,
  getVerse: getQuranVerse,
  getGlobalVerse: getQuranGlobalVerse,
  getArabic: getQuranArabic,
  getTranslation: getQuranTranslation,
  getSurahVerseCount: getQuranSurahVerseCount,
  getSurahIds: getQuranSurahIds,
};
