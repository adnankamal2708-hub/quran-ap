// ═══════════════════════════════════════════════════════════════
// vocabulary.js — Vocabulary Service Layer
// Query, search, filter, and distractor selection.
// All application logic uses this service; data files in js/data/ store words.
// ═══════════════════════════════════════════════════════════════

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



// ═══════════════════════════════════════════════════════════════
// ADVANCED SEARCH SYSTEM — Indexed, Multi-Dimensional Search
//
// Builds a pre-computed search index for O(1) field lookups.
// Supports: Arabic (diacritic-insensitive), English, translit,
// root, pattern, typeCategory, difficulty, frequency, tags,
// foundation lesson, surah IDs, occurrences, and fuzzy matching.
// ═══════════════════════════════════════════════════════════════

/** @type {Object|null} Advanced search index */
var _advancedSearchIndex = null;

/** @type {boolean} Whether the index has been built */
var _searchIndexBuilt = false;

/**
 * Normalize an Arabic text string by removing diacritical marks
 * (tashkeel) for diacritic-insensitive matching.
 * Removes: fatha, damma, kasra, sukun, shadda, tanween, etc.
 */
function normalizeArabic(str) {
  if (!str) return '';
  return str.replace(/[\u064B-\u0652\u0670]/g, '');
}

/**
 * Normalize a transliteration/English string for fuzzy search.
 * Strips diacritics, special chars, and lowercases.
 */
function normalizeTranslit(str) {
  if (!str) return '';
  var s = str.toLowerCase()
    .replace(/[āáǎàâäǎă]/g, 'a')
    .replace(/[ēéěèêëĕ]/g, 'e')
    .replace(/[īíǐìîïĭ]/g, 'i')
    .replace(/[ōóǒòôöŏ]/g, 'o')
    .replace(/[ūúǔùûüŭ]/g, 'u')
    .replace(/[ḥḥḥ]/g, 'h')
    .replace(/[ḍḍḍ]/g, 'd')
    .replace(/[ṣṣṣ]/g, 's')
    .replace(/[ṭṭṭ]/g, 't')
    .replace(/[ẓẓẓ]/g, 'z')
    .replace(/[ʾ']/g, '')
    .replace(/[ʿ]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  return s;
}

/**
 * Build a comprehensive search index from canonical words.
 * Pre-computes normalized text and dimension lookups for O(1) filtering.
 */
function buildAdvancedSearchIndex() {
  if (_searchIndexBuilt) return;
  
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  var idx = {
    byNormalizedArabic: {},  // normalized arabic -> [word objects]
    byNormalizedTranslit: {}, // normalized translit -> [word objects]
    byRoot: {},              // root -> [word objects]
    byDifficulty: {},        // difficulty -> [word objects]
    byFrequency: {},         // frequency -> [word objects]
    byPattern: {},           // pattern -> [word objects]
    byTypeCategory: {},      // typeCategory -> [word objects]
    byTag: {},               // tag -> [word objects]
    bySurahId: {},           // surahId -> [word objects]
    byFoundationLesson: {},  // foundationLessonId -> [word objects]
    allWords: words,         // reference to all words
    arabicPrefixCache: {},   // first 3 chars of normalized arabic -> [word objects]
  };
  
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    
    // Normalized Arabic (diacritic-stripped)
    if (w.arabic) {
      var normAr = normalizeArabic(w.arabic);
      if (!idx.byNormalizedArabic[normAr]) idx.byNormalizedArabic[normAr] = [];
      idx.byNormalizedArabic[normAr].push(w);
      
      // Prefix cache for partial Arabic matching
      var prefix = normAr.substring(0, Math.min(3, normAr.length));
      if (prefix && prefix.length >= 2) {
        if (!idx.arabicPrefixCache[prefix]) idx.arabicPrefixCache[prefix] = [];
        idx.arabicPrefixCache[prefix].push(w);
      }
    }
    
    // Normalized transliteration
    if (w.translit) {
      var normTr = w.translit.toLowerCase();
      if (!idx.byNormalizedTranslit[normTr]) idx.byNormalizedTranslit[normTr] = [];
      idx.byNormalizedTranslit[normTr].push(w);
    }
    
    // Root
    if (w.root && w.root !== '\u2014') {
      if (!idx.byRoot[w.root]) idx.byRoot[w.root] = [];
      idx.byRoot[w.root].push(w);
    }
    
    // Difficulty
    if (w.difficulty) {
      if (!idx.byDifficulty[w.difficulty]) idx.byDifficulty[w.difficulty] = [];
      idx.byDifficulty[w.difficulty].push(w);
    }
    
    // Frequency
    if (w.frequency) {
      if (!idx.byFrequency[w.frequency]) idx.byFrequency[w.frequency] = [];
      idx.byFrequency[w.frequency].push(w);
    }
    
    // Pattern
    if (w.pattern && w.pattern !== '\u2014') {
      if (!idx.byPattern[w.pattern]) idx.byPattern[w.pattern] = [];
      idx.byPattern[w.pattern].push(w);
    }
    
    // TypeCategory
    if (w.typeCategory) {
      if (!idx.byTypeCategory[w.typeCategory]) idx.byTypeCategory[w.typeCategory] = [];
      idx.byTypeCategory[w.typeCategory].push(w);
    }
    
    // Tags
    if (w.tags) {
      for (var ti = 0; ti < w.tags.length; ti++) {
        var tag = w.tags[ti];
        if (!idx.byTag[tag]) idx.byTag[tag] = [];
        idx.byTag[tag].push(w);
      }
    }
    
    // Surah IDs (from canonical surahIds array)
    var surahIds = w.surahIds || (w.surahId ? [w.surahId] : []);
    for (var si = 0; si < surahIds.length; si++) {
      var sid = surahIds[si];
      if (!idx.bySurahId[sid]) idx.bySurahId[sid] = [];
      idx.bySurahId[sid].push(w);
    }
    
    // Foundation lesson
    if (w.foundationLessonId !== undefined && w.foundationLessonId >= 0) {
      var fl = w.foundationLessonId;
      if (!idx.byFoundationLesson[fl]) idx.byFoundationLesson[fl] = [];
      idx.byFoundationLesson[fl].push(w);
    }
  }
  
  _advancedSearchIndex = idx;
  _searchIndexBuilt = true;
  console.log('[search] Built advanced search index from ' + words.length + ' words.');
}

/**
 * Search all words using the advanced index.
 * Supports: Arabic (diacritic-insensitive), English, transliteration,
 * root, root family, pattern, part of speech, tags, surah, and verse.
 * Falls back to linear scan if index is not available.
 */
function searchWords(query) {
  if (!query || query.trim() === '') {
    // Return canonical words if available, otherwise fall back to ALL_WORDS
    return (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0) 
      ? getCanonicalWords() : ALL_WORDS;
  }
  const q = query.trim().toLowerCase();
  
  // Search canonical vocabulary
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : ALL_WORDS;
  
  return words.filter(function (w) {
    // Check canonical fields
    var matches = (
      w.arabic.includes(q) ||
      w.translit.toLowerCase().includes(q) ||
      w.english.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q) ||
      w.root.includes(q) ||
      (w.pattern && w.pattern.includes(q)) ||
      (w.tags || []).some(function (t) { return t.includes(q); }) ||
      w.type.toLowerCase().includes(q)
    );
    
    // Search relationship fields (derived forms, related words, root family)
    if (!matches) {
      // Check rootFamily
      if (w.rootFamily && Array.isArray(w.rootFamily)) {
        for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
          if (w.rootFamily[rfi].e && w.rootFamily[rfi].e.toLowerCase().includes(q)) {
            matches = true;
            break;
          }
        }
      }
      // Check relatedWords (resolved through relationship engine)
      if (!matches && typeof getRelatedWordObjects === 'function') {
        var relWords = getRelatedWordObjects(w);
        for (var rwi = 0; rwi < relWords.length; rwi++) {
          if (relWords[rwi].english && relWords[rwi].english.toLowerCase().includes(q)) {
            matches = true;
            break;
          }
        }
      }
      // Check derived forms
      if (!matches && typeof getDerivedForms === 'function') {
        var dForms = getDerivedForms(w);
        for (var dfi = 0; dfi < dForms.length; dfi++) {
          if ((dForms[dfi].english && dForms[dfi].english.toLowerCase().includes(q)) ||
              (dForms[dfi].formName && dForms[dfi].formName.toLowerCase().includes(q))) {
            matches = true;
            break;
          }
        }
      }
    }
    
    // Also search occurrence fields (ayah text, tafsir, references)
    if (!matches && w.occurrences) {
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        var occ = w.occurrences[oi];
        if (
          (occ.ayahA && occ.ayahA.includes(q)) ||
          (occ.ayahT && occ.ayahT.toLowerCase().includes(q)) ||
          (occ.tafsir && occ.tafsir.toLowerCase().includes(q)) ||
          (occ.verseKey && occ.verseKey.includes(q))
        ) {
          matches = true;
          break;
        }
        // Search surah name for this occurrence
        if (occ.surahId) {
          var surahName = getSurahEnglishName(occ.surahId).toLowerCase();
          var surahNameSimple = getSurahNameSimple(occ.surahId).toLowerCase();
          if (surahName.includes(q) || surahNameSimple.includes(q)) {
            matches = true;
            break;
          }
        }
      }
    }
    
    return matches;
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

/**
 * Advanced multi-dimensional filter. Applies all specified filters
 * to a set of words. filterState can contain:
 *   difficulty: number or null
 *   frequency: string (very-high|high|medium|low) or null
 *   foundationLesson: number or null
 *   rootFamilyFilter: string (root letters to match) or null
 *   isBookmarked: boolean
 *   reviewDue: string ('due', 'today', 'soon') or null
 *   occurrenceRange: [min, max] or null
 *   learnedOnly: boolean
 *   unlearnedOnly: boolean
 */
function advancedFilterWords(words, filterState) {
  if (!filterState || !words || words.length === 0) return words;
  
  var srsData = typeof loadSRS === 'function' ? loadSRS() : null;
  var favs = typeof loadFavorites === 'function' ? loadFavorites() : null;
  var now = Date.now();
  
  return words.filter(function (w) {
    // Difficulty filter
    if (filterState.difficulty !== undefined && filterState.difficulty !== null && filterState.difficulty !== '') {
      if (w.difficulty !== Number(filterState.difficulty)) return false;
    }
    
    // Frequency filter
    if (filterState.frequency && filterState.frequency !== 'all') {
      if (w.frequency !== filterState.frequency) return false;
    }
    
    // Foundation lesson filter
    if (filterState.foundationLesson !== undefined && filterState.foundationLesson !== null && filterState.foundationLesson !== '') {
      var fl = Number(filterState.foundationLesson);
      var wordFl = (w.foundationLessonId !== undefined) ? w.foundationLessonId : -1;
      if (filterState.foundationLesson === '-1' && wordFl >= 0) return false;
      if (filterState.foundationLesson !== '-1' && wordFl !== fl) return false;
      if (filterState.foundationLesson === 'any' && wordFl < 0) return false;
    }
    
    // Root family filter
    if (filterState.rootFamilyFilter && filterState.rootFamilyFilter.trim() !== '') {
      var rootQ = filterState.rootFamilyFilter.trim().toLowerCase();
      var matchesRoot = w.root && w.root.toLowerCase().indexOf(rootQ) >= 0;
      var matchesRootFamily = false;
      if (!matchesRoot && w.rootFamily && Array.isArray(w.rootFamily)) {
        for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
          if (w.rootFamily[rfi].a && w.rootFamily[rfi].a.toLowerCase().indexOf(rootQ) >= 0) {
            matchesRootFamily = true;
            break;
          }
        }
      }
      if (!matchesRoot && !matchesRootFamily) return false;
    }
    
    // Bookmark filter
    if (filterState.isBookmarked) {
      if (!favs || !favs[w.id]) return false;
    }
    
    // Review due filter
    if (filterState.reviewDue && filterState.reviewDue !== 'all') {
      if (!srsData || !srsData[w.id]) {
        if (filterState.reviewDue !== 'all') return false;
      } else {
        var entry = srsData[w.id];
        if (filterState.reviewDue === 'due' && (!entry.dueDate || entry.dueDate > now)) return false;
        if (filterState.reviewDue === 'today' && (!entry.dueDate || entry.dueDate > now + 86400000)) return false;
        if (filterState.reviewDue === 'soon' && (!entry.dueDate || entry.dueDate > now + 604800000)) return false;
      }
    }
    
    // Learned/unlearned filter
    if (filterState.learnedOnly || filterState.unlearnedOnly) {
      var learned = srsData && srsData[w.id] && srsData[w.id].stage && srsData[w.id].stage >= 1;
      if (filterState.learnedOnly && !learned) return false;
      if (filterState.unlearnedOnly && learned) return false;
    }
    
    // Occurrence range filter
    if (filterState.occMin !== undefined && filterState.occMin !== null && filterState.occMin !== '') {
      if ((w.occ || 0) < Number(filterState.occMin)) return false;
    }
    if (filterState.occMax !== undefined && filterState.occMax !== null && filterState.occMax !== '') {
      if ((w.occ || 0) > Number(filterState.occMax)) return false;
    }
    
    // Surah filter
    if (filterState.surahId !== undefined && filterState.surahId !== null && filterState.surahId !== '' && filterState.surahId !== 'all') {
      var sid = Number(filterState.surahId);
      var hasSurah = false;
      if (w.surahIds && w.surahIds.indexOf(sid) >= 0) hasSurah = true;
      if (!hasSurah && w.surahId === sid) hasSurah = true;
      if (!hasSurah) return false;
    }
    
    // Frequency rank range
    if (filterState.freqRankMax !== undefined && filterState.freqRankMax !== null && filterState.freqRankMax !== '') {
      var maxRank = Number(filterState.freqRankMax);
      if (w.frequencyRank !== undefined && w.frequencyRank > maxRank) return false;
    }
    
    // Part of speech / typeCategory filter
    if (filterState.typeCategory && filterState.typeCategory !== '') {
      if (w.typeCategory !== filterState.typeCategory) return false;
    }
    
    return true;
  });
}

/**
 * Advanced search with multi-dimensional filtering.
 * Combines text search with all advanced filters in a single call.
 * filterState is passed to advancedFilterWords.
 */
function advancedSearch(query, filterState) {
  // Build search index if needed
  buildAdvancedSearchIndex();
  
  // Get matching words from text search
  var matched = searchWords(query);
  
  // Apply advanced filters
  if (filterState) {
    matched = advancedFilterWords(matched, filterState);
  }
  
  // Sort by relevance: exact Arabic matches first, then by frequency rank
  if (query && query.trim() !== '') {
    var q = query.trim().toLowerCase();
    var normQ = normalizeArabic(q);
    
    matched.sort(function(a, b) {
      // Exact Arabic match tops
      var aExact = a.arabic && (a.arabic === q || normalizeArabic(a.arabic) === normQ) ? 1 : 0;
      var bExact = b.arabic && (b.arabic === q || normalizeArabic(b.arabic) === normQ) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      
      // Exact English match
      var aEng = a.english && a.english.toLowerCase() === q ? 1 : 0;
      var bEng = b.english && b.english.toLowerCase() === q ? 1 : 0;
      if (aEng !== bEng) return bEng - aEng;
      
      // Exact root match
      var aRoot = a.root && a.root.toLowerCase() === q ? 1 : 0;
      var bRoot = b.root && b.root.toLowerCase() === q ? 1 : 0;
      if (aRoot !== bRoot) return bRoot - aRoot;
      
      // Sort by frequency rank (lower = more frequent = higher priority)
      var aRank = a.frequencyRank || 9999;
      var bRank = b.frequencyRank || 9999;
      return aRank - bRank;
    });
  }
  
  return matched;
}

/**
 * Get all available foundation lessons for filter display.
 */
function getFoundationLessonOptions() {
  var options = [];
  if (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS) {
    for (var fi = 0; fi < FOUNDATION_LESSONS.length; fi++) {
      options.push({
        value: fi,
        label: 'Foundation ' + (fi + 1) + (FOUNDATION_LESSONS[fi].isReview ? ' (Review)' : ''),
      });
    }
  }
  return options;
}

// Export advanced search for cross-module access
window.__advancedSearch = {
  search: advancedSearch,
  filter: advancedFilterWords,
  normalizeArabic: normalizeArabic,
  normalizeTranslit: normalizeTranslit,
  buildIndex: buildAdvancedSearchIndex,
  getFoundationLessonOptions: getFoundationLessonOptions,
};

// ── Educational Distractors ────────────────────────────────────

/**
 * Select educational distractors for a quiz question.
 * Picks distractors using relationship-aware priority:
 * 1. Confused-with words (from relationship inference)
 * 2. Contextual equivalents (same type + difficulty)
 * 3. Same type category
 * 4. Same root (but different meaning)
 * 5. Random other words
 *
 * This creates genuinely educational and challenging multiple-choice options.
 */
function getDistractors(correctWord, count) {
  if (count == null) count = 3;
  
  // Build relationship cache if needed
  buildRelationsCache();
  
  // Determine which lessons are current/completed to avoid future unseen distractors
  var completedLessonIds = [];
  var currentLessonId = -1;
  try {
    if (typeof getOrganizationMode === 'function' && getOrganizationMode() === 'foundation') {
      if (typeof getCompletedFoundationLessonCount === 'function' && typeof getFoundationLessonCount === 'function') {
        for (var cli = 0; cli < getFoundationLessonCount(); cli++) {
          if (typeof isFoundationLessonCompleted === 'function' && isFoundationLessonCompleted(cli)) {
            completedLessonIds.push(cli);
          }
        }
      }
      currentLessonId = (typeof getFoundationLessonForWord === 'function') ? getFoundationLessonForWord(correctWord.id) : -1;
      if (currentLessonId >= 0 && completedLessonIds.indexOf(currentLessonId) < 0) {
        // Include current lesson (in progress) in eligible pool
      }
    }
  } catch (e) { /* non-critical */ }
  
  // Build pool: prefer words from current + completed lessons, then same category, then all words
  var pool = [];
  var eligibleLessonIds = completedLessonIds.slice();
  if (currentLessonId >= 0 && eligibleLessonIds.indexOf(currentLessonId) < 0) {
    eligibleLessonIds.push(currentLessonId);
  }
  
  // First, collect words from eligible lessons
  var lessonWords = [];
  var otherWords = [];
  for (var pi = 0; pi < ALL_WORDS.length; pi++) {
    if (ALL_WORDS[pi] === correctWord) continue;
    var wLessonId = (ALL_WORDS[pi].foundationLessonId !== undefined) ? ALL_WORDS[pi].foundationLessonId : -1;
    if (wLessonId >= 0) {
      if (eligibleLessonIds.indexOf(wLessonId) >= 0) {
        lessonWords.push(ALL_WORDS[pi]);
      } else {
        otherWords.push(ALL_WORDS[pi]);
      }
    } else {
      otherWords.push(ALL_WORDS[pi]);
    }
  }
  
  // Prioritize: lesson words first, then other words
  pool = lessonWords.concat(otherWords);
  
  var distractors = [];
  var used = {};

  function addCandidate(candidate) {
    if (distractors.length >= count) return;
    if (!candidate) return;
    var key = candidate.arabic + '|' + candidate.english;
    if (used[key]) return;
    if (candidate.english === correctWord.english) return;
    // Avoid obviously impossible answers (completely different languages)
    var cShort = (candidate.meaning || candidate.english || '').split('\u2014')[0].trim();
    var wShort = (correctWord.meaning || correctWord.english || '').split('\u2014')[0].trim();
    if (cShort === wShort) return;
    used[key] = true;
    distractors.push(candidate);
  }
  
  function findDistractorWord(arabic) {
    if (!arabic) return null;
    var found = findWordByArabic(arabic);
    return found && found !== correctWord ? found : null;
  }

  // Priority 1: Confused-with words (from relationship inference)
  var rels = _relCache && _relCache.byId[correctWord.id];
  if (rels && rels.confusedWith) {
    for (var ci = 0; ci < rels.confusedWith.length; ci++) {
      var cw = findDistractorWord(rels.confusedWith[ci].arabic);
      if (cw) addCandidate(cw);
    }
  }
  
  // Priority 2: Same grammatical category + similar meaning
  var sameCat = [];
  for (var sti = 0; sti < pool.length; sti++) {
    if (pool[sti].typeCategory === correctWord.typeCategory) sameCat.push(pool[sti]);
  }
  shuffleArray(sameCat).forEach(addCandidate);
  
  // Priority 3: Same root (different meaning)
  if (correctWord.root && correctWord.root !== '—') {
    var sameRoot = [];
    for (var sri = 0; sri < pool.length; sri++) {
      if (pool[sri].root === correctWord.root && pool[sri].typeCategory !== correctWord.typeCategory) sameRoot.push(pool[sri]);
    }
    shuffleArray(sameRoot).forEach(addCandidate);
  }
  
  // Priority 4: Visually similar Arabic (same first 2-3 letters)
  if (correctWord.arabic && correctWord.arabic.length >= 2) {
    var visSimilar = [];
    var arPrefix = correctWord.arabic.substring(0, Math.min(2, correctWord.arabic.length));
    for (var vi = 0; vi < pool.length; vi++) {
      if (pool[vi].arabic && pool[vi].arabic.indexOf(arPrefix) === 0 && pool[vi].arabic !== correctWord.arabic) {
        visSimilar.push(pool[vi]);
      }
    }
    shuffleArray(visSimilar).forEach(addCandidate);
  }
  
  // Priority 5: Another word from same lesson (educational connection)
  shuffleArray(lessonWords).forEach(addCandidate);
  
  // Fallback: any word from pool
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

// ═══════════════════════════════════════════════════════════════
// Vocabulary Relationship Inference Engine
//
// Computes word relationships dynamically from existing data fields.
// All functions cache results for O(1) lookups after first call.
// ═══════════════════════════════════════════════════════════════

/** @type {Object|null} Cached relationship index */
let _relCache = null;

/**
 * Build the relationship cache from ALL_WORDS data.
 * Creates indices by root, tags, typeCategory, and transliteration pattern.
 */
function buildRelationsCache() {
  if (_relCache) return;
  
  var cache = {
    byId: {},           // wordId → { derivedForms, semanticGroups, confusedWith, contextualEquivalents, morphRelations, relatedWords }
    byRoot: {},         // root → [word objects]
    byTag: {},          // tag → [word objects]
    byTypeCat: {},      // typeCategory → [word objects]
    byDifficulty: {},   // difficulty → [word objects]
    byFrequency: {},    // frequency → [word objects]
    similarTranslit: {}, // first translit char → [{ word, translit }] for confusion detection
    difficultyById: {}, // wordId → difficulty (for O(1) lookups in sort)
  };
  
  // Build difficulty lookup (ES5-compatible)
  for (var di = 0; di < ALL_WORDS.length; di++) {
    cache.difficultyById[ALL_WORDS[di].id] = ALL_WORDS[di].difficulty || 3;
  }
  
  // Phase 1: Group all words by root, tag, typeCategory, difficulty, frequency
  for (var i = 0; i < ALL_WORDS.length; i++) {
    var w = ALL_WORDS[i];
    
    // By root
    if (w.root && w.root !== '—') {
      if (!cache.byRoot[w.root]) cache.byRoot[w.root] = [];
      cache.byRoot[w.root].push(w);
    }
    
    // By tag
    if (w.tags) {
      for (var ti = 0; ti < w.tags.length; ti++) {
        if (!cache.byTag[w.tags[ti]]) cache.byTag[w.tags[ti]] = [];
        cache.byTag[w.tags[ti]].push(w);
      }
    }
    
    // By typeCategory
    if (w.typeCategory) {
      if (!cache.byTypeCat[w.typeCategory]) cache.byTypeCat[w.typeCategory] = [];
      cache.byTypeCat[w.typeCategory].push(w);
    }
    
    // By difficulty
    if (w.difficulty) {
      if (!cache.byDifficulty[w.difficulty]) cache.byDifficulty[w.difficulty] = [];
      cache.byDifficulty[w.difficulty].push(w);
    }
    
    // By frequency
    if (w.frequency) {
      if (!cache.byFrequency[w.frequency]) cache.byFrequency[w.frequency] = [];
      cache.byFrequency[w.frequency].push(w);
    }
    
    // By first transliteration character (for confusion detection)
    if (w.translit && w.translit.length > 0) {
      var firstChar = w.translit[0].toLowerCase();
      if (!cache.similarTranslit[firstChar]) cache.similarTranslit[firstChar] = [];
      cache.similarTranslit[firstChar].push({ word: w, translit: w.translit.toLowerCase() });
    }
  }
  
  // Phase 2: For each word, compute all relationship types
  for (var j = 0; j < ALL_WORDS.length; j++) {
    var word = ALL_WORDS[j];
    var rels = {
      derivedForms: computeDerivedForms(word, cache),
      semanticGroups: computeSemanticGroups(word, cache),
      confusedWith: computeConfusedWith(word, cache),
      contextualEquivalents: computeContextualEquivalents(word, cache),
      morphRelations: computeMorphologicalRelations(word, cache),
      relatedWords: computeRelatedWordObjects(word),
    };
    cache.byId[word.id] = rels;
  }
  
  _relCache = cache;
}

/**
 * Compute derived forms: words sharing the same root with different patterns.
 */
function computeDerivedForms(word, cache) {
  if (!word.root || word.root === '—' || !cache.byRoot[word.root]) return [];
  var siblings = cache.byRoot[word.root];
  var results = [];
  var seen = {};
  
  for (var si = 0; si < siblings.length; si++) {
    var sib = siblings[si];
    if (sib.arabic === word.arabic) continue;
    if (seen[sib.arabic]) continue;
    seen[sib.arabic] = true;
    
    var formName = getDerivedFormName(sib.pattern, sib.typeCategory, sib.type);
    results.push({
      arabic: sib.arabic,
      english: sib.english,
      pattern: sib.pattern || '—',
      formName: formName,
      wordId: sib.id,
    });
  }
  
  // Sort by closest difficulty (uses pre-built difficultyById lookup, no ES6 find() needed)
  var wordDiff = word.difficulty || 3;
  results.sort(function(a, b) {
    var diffA = Math.abs((cache.difficultyById[a.wordId] || 3) - wordDiff);
    var diffB = Math.abs((cache.difficultyById[b.wordId] || 3) - wordDiff);
    return diffA - diffB;
  });
  
  return results.slice(0, 8);
}

/**
 * Map pattern + type to a human-readable derived form name.
 */
function getDerivedFormName(pattern, typeCategory, type) {
  if (!pattern || pattern === '—') return type || 'Related form';
  
  var patternNames = {
    'فَاعِل': 'Active Participle',
    'مَفْعُول': 'Passive Participle',
    'فَعَّال': 'Intensive Form',
    'فِعْل': 'Noun Form',
    'فَعْل': 'Verbal Noun',
    'فِعَال': 'Measure/Type',
    'فَعُول': 'Characteristic',
    'فَعِيل': 'Adjective/Noun',
    'فَعْلَة': 'Instance Noun',
    'فِعْلَة': 'Manner/Type',
    'فُعْل': 'Verbal Noun',
    'فُعُول': 'Plural Pattern',
    'فَعَلَ': 'Form I Verb',
    'فَعِلَ': 'Form I Verb (State)',
    'يَفْعَلَ': 'Imperfect Verb',
    'يَفْعُلُ': 'Imperfect Verb',
    'يَفْعِلُ': 'Imperfect Verb',
    'مُفَعِّل': 'Form II Active Participle',
    'مُفَعَّل': 'Form II Passive Participle',
    'مُفَاعِل': 'Form III Active Participle',
    'مُفَاعَل': 'Form III Passive Participle',
    'مُفْعِل': 'Form IV Active Participle',
    'مُفْعَل': 'Form IV Passive Participle',
    'مُتَفَعِّل': 'Form V Active Participle',
    'مُتَفَاعِل': 'Form VI Active Participle',
    'مُنْفَعِل': 'Form VII Active Participle',
    'مُفْتَعِل': 'Form VIII Active Participle',
    'فَعَّلَ': 'Form II Verb',
    'فَاعَلَ': 'Form III Verb',
    'أَفْعَلَ': 'Form IV Verb',
    'تَفَعَّلَ': 'Form V Verb',
    'تَفَاعَلَ': 'Form VI Verb',
    'انْفَعَلَ': 'Form VII Verb',
    'افْتَعَلَ': 'Form VIII Verb',
    'اِفْعَلَّ': 'Form IX Verb',
    'اِسْتَفْعَلَ': 'Form X Verb',
    'فَاعِلَة': 'Active Participle (f)',
    'مَفْعَلَة': 'Place/Instance Noun',
    'مِفْعَال': 'Instrument Noun',
    'مِفْعَل': 'Instrument Noun',
    'فُعْلَىٰ': 'Female/Abstract Noun',
    'فِعْلَىٰ': 'Female/Abstract Noun',
    'أَفْعَال': 'Broken Plural',
    'فُعُول': 'Broken Plural',
    'فِعَال': 'Broken Plural',
    'فُعَلاء': 'Broken Plural',
    'فَعَلَات': 'Feminine Plural',
    'فَعِلَات': 'Feminine Plural',
    'فُعْلَان': 'Verbal Noun',
    'فَيْعُول': 'Morphological Variant',
    'فِعْلَوْن': 'Extended Noun',
    'فُعْلُل': 'Onomatopoeic',
    'مُسْتَفْعِل': 'Form X Active Participle',
    'يَفْعُلَانِ': 'Dual Imperfect Verb',
    'يَفْعَلُونَ': 'Plural Imperfect Verb',
    'فَعَلْنَا': 'We-Perfect Verb',
    'فُعِّلَتْ': 'Form II Pass. Perfect',
  };
  
  if (patternNames[pattern]) return patternNames[pattern];
  if (typeCategory === 'verb') return 'Verb Form';
  if (typeCategory === 'noun') return 'Noun Form';
  if (typeCategory === 'adjective') return 'Adjectival Form';
  return 'Related Form';
}

/**
 * Compute semantic groups: thematic clusters from tags and typeCategory.
 */
function computeSemanticGroups(word, cache) {
  var groups = [];
  var seen = {};
  
  if (word.tags && word.tags.length > 0) {
    for (var ti = 0; ti < Math.min(word.tags.length, 3); ti++) {
      var tag = word.tags[ti];
      if (!seen[tag] && cache.byTag[tag]) {
        seen[tag] = true;
        var tagWords = cache.byTag[tag].filter(function(tw) { return tw.arabic !== word.arabic; });
        groups.push({
          group: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' '),
          count: tagWords.length,
          sampleWords: tagWords.slice(0, 3).map(function(tw) { return tw.arabic; }),
        });
      }
    }
  }
  
  if (word.typeCategory && cache.byTypeCat[word.typeCategory]) {
    var sameType = cache.byTypeCat[word.typeCategory].filter(function(tw) { return tw.arabic !== word.arabic; });
    if (sameType.length > 0) {
      var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
      groups.push({
        group: typeLabels[word.typeCategory] || word.typeCategory,
        count: sameType.length,
        sampleWords: sameType.slice(0, 3).map(function(tw) { return tw.arabic; }),
      });
    }
  }
  
  return groups.slice(0, 4);
}

/**
 * Compute confused-with words: similar transliteration or root but different meaning.
 */
function computeConfusedWith(word, cache) {
  if (!word.translit) return [];
  var confused = [];
  var seen = {};
  var wordLower = word.translit.toLowerCase();
  
  var firstChar = wordLower[0];
  var candidates = cache.similarTranslit[firstChar] || [];
  
  for (var ci = 0; ci < candidates.length; ci++) {
    var cand = candidates[ci];
    if (cand.word.arabic === word.arabic) continue;
    if (cand.word.english === word.english) continue;
    if (seen[cand.word.arabic]) continue;
    
    var diff = Math.abs(cand.translit.length - wordLower.length);
    if (diff > 3) continue;
    
    var minLen = Math.min(cand.translit.length, wordLower.length);
    var prefixLen = 0;
    for (var pi = 0; pi < minLen; pi++) {
      if (cand.translit[pi] === wordLower[pi]) prefixLen++;
      else break;
    }
    
    if (prefixLen >= 2 && cand.word.root !== word.root) {
      seen[cand.word.arabic] = true;
      confused.push({
        arabic: cand.word.arabic,
        english: cand.word.english,
        similarity: prefixLen >= 4 ? 'high' : 'medium',
        reason: prefixLen >= 4 ? 'similar pronunciation' : 'similar spelling',
      });
    }
  }
  
  // Also check same root but different typeCategory
  if (word.root && word.root !== '—' && cache.byRoot[word.root]) {
    var siblings = cache.byRoot[word.root];
    for (var si = 0; si < siblings.length; si++) {
      var sib = siblings[si];
      if (sib.arabic === word.arabic) continue;
      if (seen[sib.arabic]) continue;
      if (sib.typeCategory !== word.typeCategory && sib.english !== word.english) {
        seen[sib.arabic] = true;
        confused.push({
          arabic: sib.arabic,
          english: sib.english,
          similarity: 'medium',
          reason: 'same root, different form',
        });
      }
    }
  }
  
  return confused.slice(0, 5);
}

/**
 * Compute contextual equivalents: words with same typeCategory, similar difficulty and frequency.
 */
function computeContextualEquivalents(word, cache) {
  if (!word.typeCategory) return [];
  var equivalents = [];
  var seen = {};
  
  var sameType = cache.byTypeCat[word.typeCategory] || [];
  var wordDiff = word.difficulty || 3;
  var wordFreq = word.frequency || 'medium';
  var freqOrder = { 'low': 0, 'medium': 1, 'high': 2, 'very-high': 3 };
  var wordFreqOrder = freqOrder[wordFreq] || 1;
  
  for (var et = 0; et < sameType.length; et++) {
    var eq = sameType[et];
    if (eq.arabic === word.arabic) continue;
    if (seen[eq.arabic]) continue;
    
    var eqDiff = eq.difficulty || 3;
    var eqFreqOrder = freqOrder[eq.frequency] || 1;
    
    if (Math.abs(eqDiff - wordDiff) <= 1 && eqFreqOrder === wordFreqOrder) {
      var sharedTag = false;
      if (word.tags && eq.tags) {
        for (var tagi = 0; tagi < word.tags.length; tagi++) {
          if (eq.tags.indexOf(word.tags[tagi]) >= 0) {
            sharedTag = true;
            break;
          }
        }
      }
      if (sharedTag) {
        seen[eq.arabic] = true;
        equivalents.push({
          arabic: eq.arabic,
          english: eq.english,
          difficulty: eqDiff,
        });
      }
    }
  }
  
  return equivalents.slice(0, 6);
}

/**
 * Compute morphological relationships: pattern-based relationships from same root.
 */
function computeMorphologicalRelations(word, cache) {
  if (!word.root || word.root === '—' || !cache.byRoot[word.root]) return [];
  var siblings = cache.byRoot[word.root];
  var results = [];
  var seen = {};
  
  for (var si = 0; si < siblings.length; si++) {
    var sib = siblings[si];
    if (sib.arabic === word.arabic) continue;
    if (seen[sib.arabic]) continue;
    seen[sib.arabic] = true;
    
    var relType = null;
    
    if (word.typeCategory === 'verb' && sib.typeCategory === 'noun' && sib.pattern && sib.pattern.indexOf('فَعْل') === 0) {
      relType = 'Verb → Verbal Noun';
    } else if (sib.typeCategory === 'verb' && word.typeCategory === 'noun' && word.pattern && word.pattern.indexOf('فَعْل') === 0) {
      relType = 'Verbal Noun → Verb';
    } else if (word.pattern === 'فَاعِل' && sib.pattern === 'مَفْعُول') {
      relType = 'Active ↔ Passive Participle';
    } else if (word.pattern === 'مَفْعُول' && sib.pattern === 'فَاعِل') {
      relType = 'Passive ↔ Active Participle';
    } else if ((word.pattern === 'فَعَلَ' || word.pattern === 'فَعِلَ') && sib.pattern === 'فَعَّلَ') {
      relType = 'Simple → Intensive';
    } else if (word.pattern === 'فَعَّلَ' && (sib.pattern === 'فَعَلَ' || sib.pattern === 'فَعِلَ')) {
      relType = 'Intensive → Simple';
    } else if ((word.pattern === 'فَعَلَ' || word.pattern === 'فَعِلَ') && sib.pattern === 'أَفْعَلَ') {
      relType = 'Simple → Causative';
    } else if (sib.pattern === 'أَفْعَلَ' && (word.pattern === 'فَعَلَ' || word.pattern === 'فَعِلَ')) {
      relType = 'Causative → Simple';
    } else if (sib.pattern !== word.pattern) {
      relType = 'Different Form (Root: ' + word.root + ')';
    } else {
      continue;
    }
    
    results.push({
      arabic: sib.arabic,
      english: sib.english,
      relationshipType: relType,
    });
  }
  
  return results.slice(0, 6);
}

/**
 * Resolve relatedWords arabic texts to word objects.
 */
function computeRelatedWordObjects(word) {
  if (!word.relatedWords || !word.relatedWords.length) return [];
  return word.relatedWords.map(function(arabic) {
    var found = findWordByArabic(arabic);
    return found ? { arabic: found.arabic, english: found.english, wordId: found.id } : null;
  }).filter(Boolean);
}

// ── Public API ──────────────────────────────────────────────────

function getDerivedForms(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.derivedForms : [];
}

function getSemanticGroups(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.semanticGroups : [];
}

function getConfusedWith(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.confusedWith : [];
}

function getContextualEquivalents(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.contextualEquivalents : [];
}

function getMorphologicalRelationships(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.morphRelations : [];
}

function getRelatedWordObjects(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return [];
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels ? rels.relatedWords : [];
}

function getAllRelationships(word) {
  if (typeof word === 'string') word = findWordByArabic(word) || findWordById(word);
  if (!word) return {};
  buildRelationsCache();
  var rels = _relCache.byId[word.id];
  return rels || {};
}

function invalidateRelationsCache() {
  _relCache = null;
}

function getRelationshipStats() {
  buildRelationsCache();
  var stats = {
    totalWords: ALL_WORDS.length,
    wordsWithDerivedForms: 0,
    wordsWithSemanticGroups: 0,
    wordsWithConfusedWith: 0,
    wordsWithContextualEquivalents: 0,
    wordsWithMorphRelations: 0,
    wordsWithRelatedWords: 0,
  };
  
  Object.keys(_relCache.byId).forEach(function(id) {
    var rels = _relCache.byId[id];
    if (rels.derivedForms.length > 0) stats.wordsWithDerivedForms++;
    if (rels.semanticGroups.length > 0) stats.wordsWithSemanticGroups++;
    if (rels.confusedWith.length > 0) stats.wordsWithConfusedWith++;
    if (rels.contextualEquivalents.length > 0) stats.wordsWithContextualEquivalents++;
    if (rels.morphRelations.length > 0) stats.wordsWithMorphRelations++;
    if (rels.relatedWords.length > 0) stats.wordsWithRelatedWords++;
  });
  
  return stats;
}

window.__vocabularyRelations = {
  getDerivedForms: getDerivedForms,
  getSemanticGroups: getSemanticGroups,
  getConfusedWith: getConfusedWith,
  getContextualEquivalents: getContextualEquivalents,
  getMorphologicalRelationships: getMorphologicalRelationships,
  getRelatedWordObjects: getRelatedWordObjects,
  getAllRelationships: getAllRelationships,
  invalidateCache: invalidateRelationsCache,
  getStats: getRelationshipStats,
};
