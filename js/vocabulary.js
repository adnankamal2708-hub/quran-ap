// ═══════════════════════════════════════════════════════════════
// vocabulary.js — Vocabulary Service Layer
// Query, search, filter, and distractor selection.
// All application logic uses this service; data files in js/data/ store words.
// ═══════════════════════════════════════════════════════════════

// ── Type Categories ────────────────────────────────────────────

const TYPE_CATEGORIES = {
  noun: 'Nouns',
  verb: 'Verbs',
  particle: 'Particles',
  adjective: 'Adjectives',
  pronoun: 'Pronouns',
  exclamation: 'Exclamations',
};

// ── Word Lookup ────────────────────────────────────────────────

// ── Word lookup indices ────────────────────────────────────────
// Build an index of ALL_WORDS by ID for O(1) lookups.
// Maintain a secondary arabic→IDs map for arabic-based searches.
var _wordIndex = null;
var _arabicToIds = null;

function buildWordIndex() {
  _wordIndex = {};
  _arabicToIds = {};
  for (var i = 0; i < ALL_WORDS.length; i++) {
    var w = ALL_WORDS[i];
    // Primary index by unique ID
    _wordIndex[w.id] = w;
    // Secondary index: arabic text → array of IDs
    if (!_arabicToIds[w.arabic]) _arabicToIds[w.arabic] = [];
    _arabicToIds[w.arabic].push(w.id);
  }
}

/**
 * Find a word object by its unique ID using cached index.
 * Returns the word object or undefined.
 */
function findWordById(id) {
  if (!_wordIndex) buildWordIndex();
  return _wordIndex[id];
}

/**
 * Find a word object by its Arabic text (exact match) using cached index.
 * If there are multiple words with the same Arabic text (across Surahs),
 * returns the first one found. For unambiguous lookups, use findWordById().
 * Returns the word object or undefined.
 */
function findWordByArabic(arabic) {
  if (!_arabicToIds) buildWordIndex();
  var ids = _arabicToIds[arabic];
  if (ids && ids.length > 0) {
    return findWordById(ids[0]) || undefined;
  }
  return undefined;
}

/**
 * Get all unique IDs for a given Arabic text (handles duplicate words
 * across different Surahs). Returns an array of word objects.
 */
function findWordsByArabic(arabic) {
  if (!_arabicToIds) buildWordIndex();
  var ids = _arabicToIds[arabic] || [];
  return ids.map(function(id) { return findWordById(id); }).filter(Boolean);
}

/**
 * Find word objects matching a list of Arabic texts.
 * Returns an array of found word objects (preserving order, skipping missing).
 * If a single Arabic text matches multiple words, returns the first match.
 */
function findWordsByArabicList(arabicList) {
  var result = [];
  if (!arabicList || !arabicList.length) return result;
  for (var i = 0; i < arabicList.length; i++) {
    var words = findWordsByArabic(arabicList[i]);
    // Use the first match for display (similar/opposite word navigation)
    if (words.length > 0) result.push(words[0]);
  }
  return result;
}



// ── Search ─────────────────────────────────────────────────────

/**
 * Search all words by Arabic text, English meaning, root, tags, pattern, type, or surah.
 * Returns words matching the query string.
 */
function searchWords(query) {
  if (!query || query.trim() === '') return ALL_WORDS;
  const q = query.trim().toLowerCase();
  return ALL_WORDS.filter(function (w) {
    // Also search by surah name
    var surahName = w.surahId ? getSurahEnglishName(w.surahId).toLowerCase() : '';
    var surahNameSimple = w.surahId ? getSurahNameSimple(w.surahId).toLowerCase() : '';
    return (
      w.arabic.includes(q) ||
      w.translit.toLowerCase().includes(q) ||
      w.english.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q) ||
      w.root.includes(q) ||
      (w.pattern && w.pattern.includes(q)) ||
      (w.tags || []).some(function (t) { return t.includes(q); }) ||
      w.type.toLowerCase().includes(q) ||
      surahName.includes(q) ||
      surahNameSimple.includes(q)
    );
  });
}

// ── Filters ────────────────────────────────────────────────────

/**
 * Filter words by type category (noun, verb, particle, adjective, pronoun, exclamation).
 */
function filterByCategory(words, category) {
  if (!category || category === 'all') return words;
  return words.filter(function (w) { return w.typeCategory === category; });
}

/**
 * Filter words by difficulty level (1-5).
 */
function filterByDifficulty(words, difficulty) {
  if (!difficulty) return words;
  return words.filter(function (w) { return w.difficulty === difficulty; });
}

/**
 * Filter words by Surah ID.
 */
function filterBySurah(words, surahId) {
  if (!surahId || surahId === 'all') return words;
  return words.filter(function (w) { return w.surahId === surahId; });
}

/**
 * Filter words by tag.
 */
function filterByTag(words, tag) {
  if (!tag || tag === 'all') return words;
  return words.filter(function (w) {
    return (w.tags || []).indexOf(tag) >= 0;
  });
}

/**
 * Filter words by SRS learning status using the enhanced SRS engine.
 * statusFilter: 'new', 'learning', 'mastered', 'all'
 */
function filterByStatus(words, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return words;
  return words.filter(function (w) {
    var srs = getSRSStatus(w.id);
    if (statusFilter === 'new') return srs.status === 'new';
    if (statusFilter === 'learning') return srs.status === 'review';
    if (statusFilter === 'mastered') return srs.status === 'mastered';
    return true;
  });
}

/**
 * Filter words by favorite/bookmarked status.
 */
function filterByFavorites(words) {
  var favs = loadFavorites();
  return words.filter(function (w) { return favs[w.id]; });
}

// ── Educational Distractors ────────────────────────────────────

/**
 * Select educational distractors for a quiz question.
 * Picks distractors from words with the SAME TYPE CATEGORY first,
 * then same root, then random. This creates genuinely educational
 * multiple-choice options.
 */
function getDistractors(correctWord, count) {
  if (count == null) count = 3;
  var pool = ALL_WORDS.filter(function (w) { return w !== correctWord; });

  // Priority 1: Same type category
  var sameType = pool.filter(function (w) { return w.typeCategory === correctWord.typeCategory; });

  // Priority 2: Same root (but different meaning)
  var sameRoot = pool.filter(function (w) { return w.root === correctWord.root && w.typeCategory !== correctWord.typeCategory; });

  // Priority 3: Any other words
  var other = pool.filter(function (w) {
    return w.typeCategory !== correctWord.typeCategory && w.root !== correctWord.root;
  });

  var distractors = [];
  var used = {};

  function addCandidate(candidate) {
    if (distractors.length >= count) return;
    var key = candidate.arabic + '|' + candidate.english;
    if (used[key]) return;
    if (candidate.english === correctWord.english) return;
    used[key] = true;
    distractors.push(candidate);
  }

  shuffleArray(sameType).forEach(addCandidate);
  shuffleArray(sameRoot).forEach(addCandidate);
  shuffleArray(other).forEach(addCandidate);

  if (distractors.length < count) {
    shuffleArray(pool).forEach(addCandidate);
  }

  return distractors.slice(0, count);
}

// ── Utility ────────────────────────────────────────────────────

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Get all unique tags across the vocabulary.
 */
function getAllTags() {
  var tags = {};
  ALL_WORDS.forEach(function (w) {
    (w.tags || []).forEach(function (t) { tags[t] = true; });
  });
  return Object.keys(tags).sort();
}

/**
 * Get all unique type categories with labels.
 */
function getTypeCategories() {
  return TYPE_CATEGORIES;
}

/**
 * Get stats summary of the vocabulary (uses enhanced SRS engine).
 */
function getVocabularyStats() {
  return getSRSStats();
}

// ── Favorites (bookmarks) ──────────────────────────────────────

const FAVORITES_KEY = 'quran_favorites';

/**
 * Load favorites, migrating from arabic-based keys to id-based keys.
 */
function loadFavorites() {
  try {
    var raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return {};
    var data = JSON.parse(raw);
    // Migrate: if keys look like Arabic text (not "w_" prefix), convert to IDs
    return _migrateLegacyKeys(data, false);
  } catch (e) {
    return {};
  }
}

/**
 * Generic migration helper: convert storage keys from arabic-based to id-based.
 * @param {Object} data - Storage data with legacy keys
 * @param {boolean} keepValue - Whether to keep the original value (true for notes,
 *   false for favorites where the value is just `true`)
 * @returns {Object} Migrated data with id-based keys
 */
function _migrateLegacyKeys(data, keepValue) {
  if (!data || typeof data !== 'object') return {};
  var keys = Object.keys(data);
  var needsMigration = keys.some(function(k) { return k && k.indexOf('w_') !== 0; });
  if (!needsMigration) return data;
  
  var arabicToFirstId = {};
  for (var j = 0; j < ALL_WORDS.length; j++) {
    var w = ALL_WORDS[j];
    if (!arabicToFirstId[w.arabic]) {
      arabicToFirstId[w.arabic] = w.id;
    }
  }
  
  var migrated = {};
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key.indexOf('w_') === 0) {
      migrated[key] = data[key];
    } else {
      var id = arabicToFirstId[key];
      if (id) {
        migrated[id] = keepValue ? data[key] : true;
      }
    }
  }
  return migrated;
}

function saveFavorites(data) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save favorites:', e.message);
  }
}

function toggleFavorite(wordId) {
  var favs = loadFavorites();
  if (favs[wordId]) {
    delete favs[wordId];
  } else {
    favs[wordId] = true;
  }
  saveFavorites(favs);
  return !!favs[wordId];
}

function isFavorite(wordId) {
  var favs = loadFavorites();
  return !!favs[wordId];
}

// ── Personal Notes ────────────────────────────────────────────

const NOTES_KEY = 'quran_notes';

/**
 * Load notes, migrating from arabic-based keys to id-based keys.
 */
function loadNotes() {
  try {
    var raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    var data = JSON.parse(raw);
    return migrateNotesIfNeeded(data);
  } catch (e) {
    return {};
  }
}

/**
 * Migrate notes from arabic-based keys to id-based keys.
 * Delegates to the shared _migrateLegacyKeys helper with keepValue=true.
 */
function migrateNotesIfNeeded(notes) {
  return _migrateLegacyKeys(notes, true);
}

function saveNotes(data) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save notes:', e.message);
  }
}

function getNote(wordId) {
  var notes = loadNotes();
  return notes[wordId] || '';
}

function setNote(wordId, text) {
  var notes = loadNotes();
  notes[wordId] = text;
  saveNotes(notes);
}
