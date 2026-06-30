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

// ── Word lookup cache ─────────────────────────────────────────
// Build an index of ALL_WORDS by arabic key for O(1) lookups
var _wordIndex = null;

function buildWordIndex() {
  _wordIndex = {};
  for (var i = 0; i < ALL_WORDS.length; i++) {
    _wordIndex[ALL_WORDS[i].arabic] = ALL_WORDS[i];
  }
}

/**
 * Find a word object by its Arabic text (exact match) using cached index.
 * Returns the word object or undefined.
 */
function findWordByArabic(arabic) {
  if (!_wordIndex) buildWordIndex();
  return _wordIndex[arabic];
}

/**
 * Find word objects matching a list of Arabic texts.
 * Returns an array of found word objects (preserving order, skipping missing).
 */
function findWordsByArabicList(arabicList) {
  var result = [];
  if (!arabicList || !arabicList.length) return result;
  for (var i = 0; i < arabicList.length; i++) {
    var w = findWordByArabic(arabicList[i]);
    if (w) result.push(w);
  }
  return result;
}

// ── Search ─────────────────────────────────────────────────────

/**
 * Search all words by Arabic text, English meaning, root, tags, pattern, or type.
 * Returns words matching the query string.
 */
function searchWords(query) {
  if (!query || query.trim() === '') return ALL_WORDS;
  const q = query.trim().toLowerCase();
  return ALL_WORDS.filter(function (w) {
    return (
      w.arabic.includes(q) ||
      w.translit.toLowerCase().includes(q) ||
      w.english.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q) ||
      w.root.includes(q) ||
      (w.pattern && w.pattern.includes(q)) ||
      (w.tags || []).some(function (t) { return t.includes(q); }) ||
      w.type.toLowerCase().includes(q)
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
    var srs = getSRSStatus(w.arabic);
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
  return words.filter(function (w) { return favs[w.arabic]; });
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

function loadFavorites() {
  try {
    var raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveFavorites(data) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save favorites:', e.message);
  }
}

function toggleFavorite(arabic) {
  var favs = loadFavorites();
  if (favs[arabic]) {
    delete favs[arabic];
  } else {
    favs[arabic] = true;
  }
  saveFavorites(favs);
  return !!favs[arabic];
}

function isFavorite(arabic) {
  var favs = loadFavorites();
  return !!favs[arabic];
}

// ── Personal Notes ────────────────────────────────────────────

const NOTES_KEY = 'quran_notes';

function loadNotes() {
  try {
    var raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveNotes(data) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save notes:', e.message);
  }
}

function getNote(arabic) {
  var notes = loadNotes();
  return notes[arabic] || '';
}

function setNote(arabic, text) {
  var notes = loadNotes();
  notes[arabic] = text;
  saveNotes(notes);
}
