// ═══════════════════════════════════════════════════════════════
// quran-loader.js — Progressive Quran Text Loader
//
// Loads Quran data lazily in two stages:
//   1. Surah Index (metadata only, ~20 KB) — loaded when entering
//      the Read section. Contains surah names, verse counts, types.
//   2. Per-surah verse data — loaded on demand when the user
//      opens a specific surah. Each surah file is ~1-180 KB.
//
// This avoids loading the full 2.4 MB Quran dataset upfront.
// ═══════════════════════════════════════════════════════════════

/** @type {boolean} Whether surah index has been loaded */
var _indexLoaded = false;

/** @type {boolean} Whether a load is in progress */
var _loading = false;

/** @type {Object<number, Promise>} Per-surah load promises */
var _surahLoads = {};

/** @type {Array<Function>} Pending callbacks for index load */
var _callbacks = [];

/**
 * Load the surah index (metadata only).
 * Must be called before loading individual surahs.
 * @returns {Promise<boolean>}
 */
function loadQuranText() {
  if (_indexLoaded && window.__QURAN_INDEX) {
    return Promise.resolve(true);
  }

  if (_loading) {
    return new Promise(function (resolve) {
      _callbacks.push(resolve);
    });
  }

  _loading = true;

  return new Promise(function (resolve) {
    if (window.__QURAN_INDEX) {
      _indexLoaded = true;
      _loading = false;
      resolve(true);
      return;
    }

    // Initialize __QURAN_TEXT container (populated by individual surah scripts)
    if (!window.__QURAN_TEXT) {
      window.__QURAN_TEXT = {};
    }

    var script = document.createElement('script');
    script.src = './js/quran/surah-index.min.js';
    script.async = true;
    script.onload = function () {
      _indexLoaded = true;
      _loading = false;
      resolve(true);
      for (var i = 0; i < _callbacks.length; i++) {
        _callbacks[i](true);
      }
      _callbacks = [];
    };
    script.onerror = function () {
      // Fallback: try loading the monolithic bundle (legacy)
      _loading = false;
      loadMonolithicBundle().then(function (ok) {
        resolve(ok);
        for (var i = 0; i < _callbacks.length; i++) {
          _callbacks[i](ok);
        }
        _callbacks = [];
      });
    };
    document.head.appendChild(script);
  });
}

/**
 * Fallback: load the complete monolithic Quran bundle.
 * Used when per-surah files are not available.
 * @returns {Promise<boolean>}
 */
function loadMonolithicBundle() {
  return new Promise(function (resolve) {
    if (window.__QURAN_TEXT && Object.keys(window.__QURAN_TEXT).length >= 114) {
      resolve(true);
      return;
    }
    var script = document.createElement('script');
    script.src = './js/quran/quran.bundle.min.js';
    script.async = true;
    script.onload = function () {
      resolve(true);
    };
    script.onerror = function () {
      console.warn('[quran] Failed to load Quran data');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Load verse data for a specific surah (1-114).
 * Requires the surah index to be loaded first.
 * @param {number} surahId
 * @returns {Promise<boolean>}
 */
function loadQuranSurah(surahId) {
  // Validate surah ID
  if (surahId < 1 || surahId > 114) {
    return Promise.reject(new Error('Invalid surah ID: ' + surahId));
  }

  // Already loaded
  if (window.__QURAN_TEXT && window.__QURAN_TEXT[surahId]) {
    return Promise.resolve(true);
  }

  // Already loading this surah
  if (_surahLoads[surahId]) {
    return _surahLoads[surahId];
  }

  // Ensure index is loaded first
  if (!_indexLoaded && !window.__QURAN_INDEX) {
    var promise = loadQuranText().then(function (ok) {
      if (!ok) return false;
      return loadSingleSurah(surahId);
    });
    _surahLoads[surahId] = promise;
    return promise;
  }

  var p = loadSingleSurah(surahId);
  _surahLoads[surahId] = p;
  return p;
}

/**
 * Internal: load a single surah script.
 * @param {number} surahId
 * @returns {Promise<boolean>}
 */
function loadSingleSurah(surahId) {
  return new Promise(function (resolve) {
    if (window.__QURAN_TEXT && window.__QURAN_TEXT[surahId]) {
      resolve(true);
      return;
    }

    var script = document.createElement('script');
    script.src = './js/quran/surah-' + surahId + '.min.js';
    script.async = true;
    script.onload = function () {
      resolve(true);
    };
    script.onerror = function () {
      // Fallback: try loading from the monolithic bundle
      console.warn('[quran] Per-surah file for ' + surahId + ' failed to load, trying monolithic fallback');
      loadMonolithicBundle().then(function (ok) {
        if (ok && window.__QURAN_TEXT && window.__QURAN_TEXT[surahId]) {
          resolve(true);
        } else {
          console.warn('[quran] Failed to load surah ' + surahId + ' from fallback either');
          resolve(false);
        }
      });
    };
    document.head.appendChild(script);
  });
}

/**
 * Check if Quran index has been loaded.
 * @returns {boolean}
 */
function isQuranLoaded() {
  return _indexLoaded && !!window.__QURAN_INDEX;
}

/**
 * Check if a specific surah's verse data has been loaded.
 * @param {number} surahId
 * @returns {boolean}
 */
function isQuranSurahLoaded(surahId) {
  return !!(window.__QURAN_TEXT && window.__QURAN_TEXT[surahId]);
}

/**
 * Get surah info from the index (no verse data needed).
 * @param {number} surahId
 * @returns {Object|null}
 */
function getQuranSurahInfo(surahId) {
  if (window.__QURAN_INDEX_GET) {
    return window.__QURAN_INDEX_GET(surahId);
  }
  if (!window.__QURAN_INDEX) return null;
  return window.__QURAN_INDEX[surahId - 1] || null;
}

/**
 * Search surah index by name.
 * @param {string} query
 * @returns {Object[]}
 */
function searchQuranSurahs(query) {
  if (window.__QURAN_INDEX_SEARCH) {
    return window.__QURAN_INDEX_SEARCH(query);
  }
  if (!query || !window.__QURAN_INDEX) return [];
  var q = query.toLowerCase();
  return window.__QURAN_INDEX.filter(function(s) {
    return s.name.indexOf(q) >= 0 ||
      s.transliteration.toLowerCase().indexOf(q) >= 0 ||
      s.englishName.toLowerCase().indexOf(q) >= 0;
  });
}

/**
 * Get full surah data (requires per-surah load).
 * @param {number} surahId
 * @returns {Object|null}
 */
function getQuranSurah(surahId) {
  if (!window.__QURAN_TEXT) return null;
  return window.__QURAN_TEXT[surahId] || null;
}

/**
 * Get a specific verse by surah and verse number.
 * @param {number} surahId
 * @param {number} verseId
 * @returns {Object|null}
 */
function getQuranVerse(surahId, verseId) {
  var surah = getQuranSurah(surahId);
  if (!surah || !surah.verses) return null;
  return surah.verses[verseId - 1] || null;
}

/**
 * Get the global verse index (1-6236) for a surah+verse.
 * Only available after the monolithic bundle or after all surahs are loaded.
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
 * @returns {string}
 */
function getQuranArabic(surahId, verseId) {
  var verse = getQuranVerse(surahId, verseId);
  return verse ? verse.text : '';
}

/**
 * Get the English translation for a specific verse.
 * @param {number} surahId
 * @param {number} verseId
 * @returns {string}
 */
function getQuranTranslation(surahId, verseId) {
  var verse = getQuranVerse(surahId, verseId);
  return verse ? verse.translation : '';
}

/**
 * Get total verse count for a surah (from index, no data load needed).
 * @param {number} surahId
 * @returns {number}
 */
function getQuranSurahVerseCount(surahId) {
  var info = getQuranSurahInfo(surahId);
  return info ? info.total_verses : 0;
}

/**
 * List all surah IDs (from index, no data load needed).
 * @returns {number[]}
 */
function getQuranSurahIds() {
  if (!window.__QURAN_INDEX) return [];
  return window.__QURAN_INDEX.map(function(s) { return s.id; });
}

/**
 * Load multiple surahs in parallel (useful for reading multiple surahs).
 * @param {number[]} surahIds
 * @returns {Promise<boolean[]>}
 */
function loadQuranSurahs(surahIds) {
  var promises = surahIds.map(function(id) {
    return loadQuranSurah(id);
  });
  return Promise.all(promises);
}

// ── Export ──
window.__quranLoader = {
  load: loadQuranText,
  loadSurah: loadQuranSurah,
  loadSurahs: loadQuranSurahs,
  isLoaded: isQuranLoaded,
  isSurahLoaded: isQuranSurahLoaded,
  getSurah: getQuranSurah,
  getSurahInfo: getQuranSurahInfo,
  getVerse: getQuranVerse,
  getGlobalVerse: getQuranGlobalVerse,
  getArabic: getQuranArabic,
  getTranslation: getQuranTranslation,
  getSurahVerseCount: getQuranSurahVerseCount,
  getSurahIds: getQuranSurahIds,
  searchSurahs: searchQuranSurahs,
};
