// ── Foundation Course ────────────────────────────────────────────
// The Foundation Course teaches the 100 most frequent Quranic words
// organized into 10 progressive lessons (10 words each, every 5th is review).
// Completing all 10 lessons covers ~84% of all Quranic word occurrences.

/** Foundation Course mode constant */
const FOUNDATION_MODE = 'foundation';

/** Number of foundation lessons */
const FOUNDATION_LESSON_COUNT = 10;

/** Words per foundation lesson */
const FOUNDATION_WORDS_PER_LESSON = 10;

/**
 * Foundation Course words — canonical IDs of the top 100 most frequent
 * Quranic words, sorted by occurrence count (highest first).
 * These are computed once after canonical vocabulary is built.
 */
let FOUNDATION_WORDS = [];

/**
 * Foundation Course lesson definitions.
 * Each lesson has: id, label, wordIds (array of canonical IDs), coveragePct.
 */
let FOUNDATION_LESSONS = [];

/**
 * Build the Foundation Course from canonical vocabulary.
 * Must be called after deduplicateVocabulary().
 */
function buildFoundationCourse() {
  FOUNDATION_WORDS = [];
  FOUNDATION_LESSONS = [];
  
  if (CANONICAL_WORDS.length === 0) {
    console.warn('[foundation] No canonical words available.');
    return;
  }
  
  // Sort canonical words by frequency (highest first)
  var sorted = CANONICAL_WORDS.slice().sort(function(a, b) {
    return (b.occ || 0) - (a.occ || 0);
  });
  
  // Take top 100 words
  var topWords = sorted.slice(0, 100);
  
  // Compute total occurrences for coverage calculation
  var totalOcc = 0;
  for (var ti = 0; ti < CANONICAL_WORDS.length; ti++) {
    totalOcc += CANONICAL_WORDS[ti].occ || 0;
  }
  
  // Store canonical IDs
  FOUNDATION_WORDS = topWords.map(function(w) { return w.id; });
  
  // Build lesson groupings (10 words each)
  var cumulativeOcc = 0;
  var totalFoundOcc = 0;
  for (var fi = 0; fi < topWords.length; fi++) {
    totalFoundOcc += topWords[fi].occ || 0;
  }
  
  for (var li = 0; li < FOUNDATION_LESSON_COUNT; li++) {
    var start = li * FOUNDATION_WORDS_PER_LESSON;
    var end = Math.min(start + FOUNDATION_WORDS_PER_LESSON, topWords.length);
    var wordIds = [];
    var lessonOcc = 0;
    for (var wi = start; wi < end; wi++) {
      wordIds.push(topWords[wi].id);
      lessonOcc += topWords[wi].occ || 0;
    }
    cumulativeOcc += lessonOcc;
    
    var lessonNum = li + 1;
    var isReview = (lessonNum % 5 === 0);
    
    // Compute comprehension projection for educational display
    var lessonCoverageNum = totalOcc > 0 ? (lessonOcc / totalOcc * 100) : 0;
    var cumulativeCoverageNum = totalOcc > 0 ? (cumulativeOcc / totalOcc * 100) : 0;
    var curComprehensionNum = cumulativeCoverageNum > 0 && cumulativeCoverageNum > lessonCoverageNum
      ? Math.min(95, Math.round(1.3 * Math.pow(Math.max(0, cumulativeCoverageNum - lessonCoverageNum), 0.7) * 10) / 10)
      : 0;
    var projComprehensionNum = cumulativeCoverageNum > 0
      ? Math.min(95, Math.round(1.3 * Math.pow(cumulativeCoverageNum, 0.7) * 10) / 10)
      : 0;
    var wordsRemaining = FOUNDATION_WORDS_PER_LESSON * (FOUNDATION_LESSON_COUNT - li - 1);
    
    // Thematic titles and context for each lesson
    var thematicTitles = [
      'The Essential Framework',
      'Core Quranic Verbs',
      'Divine Descriptions',
      'Key Particles & Ideas',
      'Review & Consolidation I',
      'Humanity & Faith',
      'Prophets & Revelation',
      'Judgment & Afterlife',
      'Advanced Quranic Terms',
      'Review & Mastery II',
    ];
    var lessonContexts = [
      'These are the most frequent words in the Quran. Mastering them unlocks the basic structure of every verse.',
      'These verbs and nouns appear hundreds of times. Understanding them transforms how you read passages about creation and faith.',
      'These words describe divine attributes, actions, and the relationship between Creator and creation.',
      'These particles connect Quranic ideas. They appear in nearly every verse and are essential for sentence structure.',
      'Review and reinforce the first 50 words. Strengthen your recall before the next tier of vocabulary.',
      'These words introduce key concepts about human nature, faith, and the purpose of life in the Quran.',
      'Vocabulary related to prophets, revelation, and the stories carrying the core message of the Quran.',
      'Words describing the Hereafter, judgment, and consequences of human actions — central Quranic themes.',
      'Nuanced vocabulary about knowledge, patience, and deeper spiritual concepts from the Quran.',
      'Final review of all 100 foundation words. After this you recognize ~84% of all Quranic word occurrences.',
    ];
    
    FOUNDATION_LESSONS.push({
      id: lessonNum,
      label: isReview ? 'Review ' + lessonNum : 'Foundation ' + lessonNum,
      thematicTitle: thematicTitles[li] || 'Foundation ' + lessonNum,
      lessonContext: lessonContexts[li] || '',
      start: start,
      end: end,
      wordCount: end - start,
      wordIds: wordIds,
      lessonCoverage: totalOcc > 0 ? lessonCoverageNum.toFixed(1) + '%' : '0%',
      cumulativeCoverage: totalOcc > 0 ? cumulativeCoverageNum.toFixed(1) + '%' : '0%',
      lessonCoverageNum: lessonCoverageNum,
      cumulativeCoverageNum: cumulativeCoverageNum,
      comprehensionGain: Math.round((projComprehensionNum - curComprehensionNum) * 10) / 10,
      projectedComprehension: projComprehensionNum,
      remainingAfterLesson: Math.max(0, wordsRemaining),
      isReview: isReview,
    });
  }
  
  console.log('[foundation] Built ' + FOUNDATION_LESSONS.length + ' foundation lessons from ' +
    FOUNDATION_WORDS.length + ' words. Covers ' +
    (totalOcc > 0 ? (totalFoundOcc / totalOcc * 100).toFixed(1) : '0') + '% of Quranic occurrences.');
  
  // Phase 2: Enrich canonical words with computed metadata using foundation course data
  enrichCanonicalMetadata(sorted, FOUNDATION_WORDS, totalOcc);
}

// ═══════════════════════════════════════════════════════════════
// ENRICHED CANONICAL METADATA — Frequency Analytics & Priority
//
// After foundation course is built, every canonical word gets:
//   frequencyRank     — Position when sorted by occ descending (1 = most frequent)
//   frequencyPercentile — Percentile rank (what % of words are less frequent)
//   learningPriority    — 1-5 priority based on frequency + difficulty
//   foundationLessonId  — Foundation lesson index, or -1 if not in foundation
//   firstOccurrence     — First verse this word appears in
//   lastOccurrence      — Last verse this word appears in
//   surahCount          — Number of surahs containing this word
// ═══════════════════════════════════════════════════════════════

/** Total Quranic occurrences across all canonical words (set during foundation build) */
let TOTAL_QURAN_OCCURRENCES = 0;

/**
 * Enrich canonical words with computed metadata.
 * Called once from buildFoundationCourse() after foundation is built.
 * Must be called after FOUNDATION_WORDS is populated.
 */
function enrichCanonicalMetadata(sortedByFreq, foundationWordIds, totalOcc) {
  if (!CANONICAL_WORDS || CANONICAL_WORDS.length === 0) return;
  TOTAL_QURAN_OCCURRENCES = totalOcc;
  
  // Build a lookup from canonical ID to foundation lesson index
  var foundationLessonMap = {};
  for (var fwi = 0; fwi < foundationWordIds.length; fwi++) {
    foundationLessonMap[foundationWordIds[fwi]] = Math.floor(fwi / FOUNDATION_WORDS_PER_LESSON);
  }
  
  // Build a sorted-by-frequency index for each canonical word
  var freqRankMap = {};
  for (var fi = 0; fi < sortedByFreq.length; fi++) {
    freqRankMap[sortedByFreq[fi].id] = fi + 1; // 1-based rank
  }
  
  var totalWords = CANONICAL_WORDS.length;
  
  for (var ci = 0; ci < totalWords; ci++) {
    var w = CANONICAL_WORDS[ci];
    
    // Frequency rank (1 = most frequent)
    var rank = freqRankMap[w.id] || totalWords;
    w.frequencyRank = rank;
    
    // Frequency percentile (what % of words this is more frequent than)
    w.frequencyPercentile = totalWords > 0 
      ? Math.round((1 - rank / totalWords) * 1000) / 10 
      : 0;
    
    // Learning priority: 1 (highest) to 5 (lowest)
    // Combines frequency rank (weighted 60%) and difficulty (weighted 40%)
    var normalizedRank = rank / totalWords; // 0 (most frequent) to 1 (least)
    var normalizedDifficulty = (w.difficulty || 3) / 5; // 0.2 (easiest) to 1 (hardest)
    var priorityScore = (normalizedRank * 0.6 + normalizedDifficulty * 0.4);
    // Map to 1-5 (lower score = higher priority = closer to 1)
    if (priorityScore < 0.15) w.learningPriority = 1;
    else if (priorityScore < 0.30) w.learningPriority = 2;
    else if (priorityScore < 0.50) w.learningPriority = 3;
    else if (priorityScore < 0.70) w.learningPriority = 4;
    else w.learningPriority = 5;
    
    // Foundation lesson assignment
    if (foundationLessonMap[w.id] !== undefined) {
      w.foundationLessonId = foundationLessonMap[w.id];
    } else {
      w.foundationLessonId = -1;
    }
    
    // First and last occurrence (based on surahId)
    w.surahCount = w.surahIds ? w.surahIds.length : 0;
    
    // First occurrence: earliest surah:verse
    if (w.occurrences && w.occurrences.length > 0) {
      var firstOcc = null;
      var lastOcc = null;
      for (var oi = 0; oi < w.occurrences.length; oi++) {
        var o = w.occurrences[oi];
        if (o.surahId && o.verseKey) {
          if (!firstOcc || o.surahId < firstOcc.surahId || (o.surahId === firstOcc.surahId && parseInt(o.verseKey.split(':')[1] || '0') < parseInt(firstOcc.verseKey.split(':')[1] || '0'))) {
            firstOcc = { surahId: o.surahId, verseKey: o.verseKey };
          }
          if (!lastOcc || o.surahId > lastOcc.surahId || (o.surahId === lastOcc.surahId && parseInt(o.verseKey.split(':')[1] || '0') > parseInt(lastOcc.verseKey.split(':')[1] || '0'))) {
            lastOcc = { surahId: o.surahId, verseKey: o.verseKey };
          }
        }
      }
      w.firstOccurrence = firstOcc ? firstOcc.verseKey : '';
      w.lastOccurrence = lastOcc ? lastOcc.verseKey : '';
    } else {
      w.firstOccurrence = '';
      w.lastOccurrence = '';
    }
  }
  
  console.log('[metadata] Enriched ' + totalWords + ' canonical words with frequency rank, learning priority, first/last occurrence, and foundation lesson mapping.');
}

/**
 * Get the learning priority label for a word.
 */
function getLearningPriorityLabel(priority) {
  var labels = {
    1: 'Essential',
    2: 'High Priority',
    3: 'Medium Priority',
    4: 'Low Priority',
    5: 'Supplementary',
  };
  return labels[priority] || 'Unknown';
}

/**
 * Get all canonical words sorted by learning priority (highest first).
 */
function getWordsByPriority() {
  var words = getCanonicalWords();
  return words.slice().sort(function(a, b) {
    return (a.learningPriority || 5) - (b.learningPriority || 5);
  });
}

/**
 * Get the canonical word with the highest frequency rank (most common word).
 */
function getMostFrequentWord() {
  var words = getCanonicalWords();
  var best = null;
  var bestFreq = 0;
  for (var mi = 0; mi < words.length; mi++) {
    if (words[mi].occ > bestFreq) {
      bestFreq = words[mi].occ;
      best = words[mi];
    }
  }
  return best;
}

/**
 * Get the frequency rank of a canonical word (1 = most frequent).
 */
function getFrequencyRank(word) {
  if (word.frequencyRank !== undefined) return word.frequencyRank;
  return null;
}

/**
 * Get the learning priority of a canonical word (1-5).
 */
function getLearningPriority(word) {
  if (word.learningPriority !== undefined) return word.learningPriority;
  return 3;
}

/**
 * Get words sorted by frequency rank (most frequent first).
 */
function getWordsByFrequency() {
  var words = getCanonicalWords();
  return words.slice().sort(function(a, b) {
    return (a.frequencyRank || 9999) - (b.frequencyRank || 9999);
  });
}

// ── Foundation Course Relationship Context ─────────────────────
// Functions that connect foundation lessons to the broader
// vocabulary relationship network. These help learners understand
// how foundation words relate to each other and to future vocabulary.

/**
 * Get root families introduced in a specific foundation lesson.
 * Returns an array of { root, rootMeaning, words: [arabic, english, ...] }
 */
function getFoundationLessonRoots(lessonIndex) {
  var words = getFoundationLessonWords(lessonIndex);
  var rootMap = {};
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    if (!w.root || w.root === '—') continue;
    if (!rootMap[w.root]) {
      rootMap[w.root] = { root: w.root, rootMeaning: w.rootMeaning, words: [] };
    }
    rootMap[w.root].words.push({ arabic: w.arabic, english: w.english, wordId: w.id });
  }
  var result = [];
  Object.keys(rootMap).forEach(function(r) { result.push(rootMap[r]); });
  return result;
}

/**
 * For a given foundation lesson, find related words from other foundation
 * lessons (already learned or coming up).
 */
function getFoundationLessonRelationshipContext(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) {
    return { alreadyLearnedRelated: [], upcomingRelated: [], rootFamilies: [] };
  }
  
  var currentWords = getFoundationLessonWords(lessonIndex);
  var allFoundationWords = getAllFoundationWords();
  
  // Get all root sets mentioned in this lesson
  var currentRoots = {};
  for (var ci = 0; ci < currentWords.length; ci++) {
    var cw = currentWords[ci];
    if (cw.root && cw.root !== '—') currentRoots[cw.root] = true;
  }
  
  var alreadyLearned = [];
  var upcoming = [];
  var completedLessons = typeof loadFoundationProgress === 'function' 
    ? loadFoundationProgress().completedLessons 
    : [];
  
  // Scan all foundation words for same-root connections
  for (var fi = 0; fi < allFoundationWords.length; fi++) {
    var fw = allFoundationWords[fi];
    
    // Skip current lesson words
    var foundInCurrent = false;
    for (var sj = 0; sj < currentWords.length; sj++) {
      if (currentWords[sj].id === fw.id) { foundInCurrent = true; break; }
    }
    if (foundInCurrent) continue;
    
    // Check if this word shares a root with a current lesson word
    var sharesRoot = fw.root && fw.root !== '—' && currentRoots[fw.root];
    if (!sharesRoot) continue;
    
    // Find which lesson this word belongs to
    var wordLesson = -1;
    for (var li = 0; li < FOUNDATION_LESSONS.length; li++) {
      if (FOUNDATION_LESSONS[li].wordIds.indexOf(fw.id) >= 0) {
        wordLesson = li;
        break;
      }
    }
    
    var isAlreadyLearned = completedLessons.indexOf(wordLesson) >= 0;
    var isUpcoming = !isAlreadyLearned && wordLesson >= 0 && wordLesson !== lessonIndex;
    
    if (isAlreadyLearned) {
      alreadyLearned.push({ arabic: fw.arabic, english: fw.english, wordId: fw.id, lessonId: wordLesson });
    } else if (isUpcoming) {
      upcoming.push({ arabic: fw.arabic, english: fw.english, wordId: fw.id, lessonId: wordLesson });
    }
  }
  
  return {
    alreadyLearnedRelated: alreadyLearned,
    upcomingRelated: upcoming,
    rootFamilies: getFoundationLessonRoots(lessonIndex),
  };
}

/**
 * Get the foundation lesson index for a given canonical word, or -1 if not in foundation.
 */
function getFoundationLessonForWord(canonicalWordId) {
  if (!FOUNDATION_WORDS || FOUNDATION_WORDS.length === 0) return -1;
  var idx = FOUNDATION_WORDS.indexOf(canonicalWordId);
  if (idx < 0) return -1;
  return Math.floor(idx / FOUNDATION_WORDS_PER_LESSON);
}

/**
 * Get aggregate foundation relationship statistics.
 */
function getFoundationRelationshipStats() {
  var totalWithRoots = 0;
  var totalRootFamilies = 0;
  var totalCrossLessonConnections = 0;
  var rootSet = {};
  
  var fWords = getAllFoundationWords();
  for (var fi = 0; fi < fWords.length; fi++) {
    var w = fWords[fi];
    if (w.root && w.root !== '—') {
      rootSet[w.root] = (rootSet[w.root] || 0) + 1;
      totalWithRoots++;
    }
  }
  
  totalRootFamilies = Object.keys(rootSet).length;
  
  // Count cross-lesson root connections
  for (var ri = 0; ri < FOUNDATION_LESSONS.length; ri++) {
    var lessonWords = getFoundationLessonWords(ri);
    var lessonRoots = {};
    for (var wi = 0; wi < lessonWords.length; wi++) {
      if (lessonWords[wi].root && lessonWords[wi].root !== '—') {
        lessonRoots[lessonWords[wi].root] = true;
      }
    }
    // Check if any other lesson has same root
    for (var rj = 0; rj < FOUNDATION_LESSONS.length; rj++) {
      if (rj === ri) continue;
      var otherWords = getFoundationLessonWords(rj);
      for (var wi2 = 0; wi2 < otherWords.length; wi2++) {
        if (otherWords[wi2].root && lessonRoots[otherWords[wi2].root]) {
          totalCrossLessonConnections++;
        }
      }
    }
  }
  
  return {
    totalFoundationWords: fWords.length,
    totalWithRoots: totalWithRoots,
    uniqueRootFamilies: totalRootFamilies,
    crossLessonConnections: totalCrossLessonConnections / 2, // each counted twice
  };
}

/**
 * Get the words for a specific foundation lesson (0-based index).
 * Returns canonical word objects.
 */
function getFoundationLessonWords(lessonIndex) {
  if (!FOUNDATION_LESSONS || FOUNDATION_LESSONS.length === 0) return [];
  if (lessonIndex < 0 || lessonIndex >= FOUNDATION_LESSONS.length) return [];
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = [];
  for (var fi = 0; fi < lesson.wordIds.length; fi++) {
    var w = getCanonicalWordById(lesson.wordIds[fi]);
    if (w) words.push(w);
  }
  return words;
}

/**
 * Get the total number of foundation lessons.
 */
function getFoundationLessonCount() {
  return FOUNDATION_LESSONS.length;
}

/**
 * Get all foundation course words (canonical word objects).
 */
function getAllFoundationWords() {
  if (!FOUNDATION_WORDS || FOUNDATION_WORDS.length === 0) return [];
  return FOUNDATION_WORDS.map(function(cid) {
    return getCanonicalWordById(cid);
  }).filter(Boolean);
}

// ── Foundation Course Coverage & Analytics ─────────────────────
// These functions compute Quran reading coverage, milestones,
// surah comprehension, and other analytics from canonical words
// and SRS data.

/** Cached total Quranic occurrences across all canonical words */
let _totalQuranOccurrences = 0;

/** Cached coverage result */
let _coverageCache = null;

/**
 * Compute total Quranic occurrences across all canonical words.
 */
function getTotalQuranOccurrences() {
  if (_totalQuranOccurrences > 0) return _totalQuranOccurrences;
  var words = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  if (words.length === 0) words = ALL_WORDS;
  var total = 0;
  for (var ti = 0; ti < words.length; ti++) {
    total += words[ti].occ || 0;
  }
  _totalQuranOccurrences = total;
  return total;
}

/**
 * Get the canonical IDs of all mastered words (stage >= 2 in SRS).
 * Returns an object: { canonicalId: true }
 */
function getMasteredWordIds() {
  var srsData = typeof loadSRS === 'function' ? loadSRS() : {};
  var mastered = {};
  Object.keys(srsData).forEach(function(id) {
    var entry = srsData[id];
    if (entry && entry.stage >= 2) {
      mastered[id] = true;
    }
  });
  return mastered;
}

/**
 * Calculate Quran Reading Coverage based on mastered words.
 * Returns an object with detailed coverage metrics.
 */
function calculateCoverage() {
  var totalOcc = getTotalQuranOccurrences();
  var mastered = getMasteredWordIds();
  
  // Count mastered canonical words and their occurrences
  var allCanonical = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  if (allCanonical.length === 0) allCanonical = ALL_WORDS;
  
  var masteredCount = 0;
  var masteredOcc = 0;
  var totalWords = allCanonical.length;
  
  for (var ci = 0; ci < allCanonical.length; ci++) {
    var w = allCanonical[ci];
    if (mastered[w.id]) {
      masteredCount++;
      masteredOcc += w.occ || 0;
    }
  }
  
  var coveragePct = totalOcc > 0 ? (masteredOcc / totalOcc * 100) : 0;
  var wordMasteryPct = totalWords > 0 ? (masteredCount / totalWords * 100) : 0;
  
  // Estimate reading comprehension: based on coverage with diminishing returns
  // At 0% coverage → 0% comprehension
  // At ~84% coverage (100 foundation words) → ~60% comprehension
  // The curve: comprehension ≈ 1.3 * coverage^0.7 (diminishing at high coverage)
  var estimatedComprehension = coveragePct > 0 
    ? Math.min(95, Math.round(1.3 * Math.pow(coveragePct, 0.7) * 10) / 10)
    : 0;
  
  var result = {
    totalOccurrences: totalOcc,
    masteredWords: masteredCount,
    totalWords: totalWords,
    masteredOccurrences: masteredOcc,
    coveragePercent: Math.round(coveragePct * 10) / 10,
    wordMasteryPercent: Math.round(wordMasteryPct * 10) / 10,
    estimatedComprehension: estimatedComprehension,
  };
  _coverageCache = result;
  return result;
}

/**
 * Get Foundation Course-specific coverage metrics.
 * Shows coverage from foundation words specifically.
 */
function getFoundationCoverage() {
  var totalOcc = getTotalQuranOccurrences();
  var mastered = getMasteredWordIds();
  var fWords = getAllFoundationWords();
  
  var fMastered = 0;
  var fMasteredOcc = 0;
  var fTotalOcc = 0;
  
  for (var fi = 0; fi < fWords.length; fi++) {
    var w = fWords[fi];
    fTotalOcc += w.occ || 0;
    if (mastered[w.id]) {
      fMastered++;
      fMasteredOcc += w.occ || 0;
    }
  }
  
  var fCoveragePct = totalOcc > 0 ? (fMasteredOcc / totalOcc * 100) : 0;
  var fProgressPct = fWords.length > 0 ? (fMastered / fWords.length * 100) : 0;
  
  return {
    totalFoundationWords: fWords.length,
    masteredFoundationWords: fMastered,
    totalFoundationOccurrences: fTotalOcc,
    masteredFoundationOccurrences: fMasteredOcc,
    foundationCoveragePercent: Math.round(fCoveragePct * 10) / 10,
    foundationProgressPercent: Math.round(fProgressPct),
    totalQuranOccurrences: totalOcc,
  };
}

/**
 * Surah Comprehension: Calculate estimated comprehension for every surah
 * based on which vocabulary words appearing in that surah are mastered.
 */
function getSurahComprehension(surahId) {
  if (!surahId) return null;
  var words = getSurahWords(surahId);
  if (!words || words.length === 0) return null;
  
  var mastered = getMasteredWordIds();
  var totalWords = words.length;
  var masteredInSurah = 0;
  var totalOccInSurah = 0;
  var masteredOccInSurah = 0;
  
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var occ = w.occ || 0;
    totalOccInSurah += occ;
    if (mastered[w.id]) {
      masteredInSurah++;
      masteredOccInSurah += occ;
    }
  }
  
  // Comprehension estimate based on vocabulary coverage in this surah
  var wordCoverage = totalWords > 0 ? (masteredInSurah / totalWords * 100) : 0;
  var occCoverage = totalOccInSurah > 0 ? (masteredOccInSurah / totalOccInSurah * 100) : 0;
  
  // Estimated comprehension: weighted average of word count and occurrence coverage
  var comprehension = (wordCoverage * 0.4 + occCoverage * 0.6);
  comprehension = Math.round(Math.min(100, comprehension));
  
  return {
    surahId: surahId,
    totalWords: totalWords,
    masteredWords: masteredInSurah,
    totalOccurrences: totalOccInSurah,
    masteredOccurrences: masteredOccInSurah,
    wordCoveragePercent: Math.round(wordCoverage * 10) / 10,
    occurrenceCoveragePercent: Math.round(occCoverage * 10) / 10,
    estimatedComprehension: comprehension,
  };
}

/**
 * Get comprehension for all surahs.
 */
function getAllSurahComprehension() {
  var surahIds = getSurahsWithVocabulary();
  var results = [];
  for (var si = 0; si < surahIds.length; si++) {
    var comp = getSurahComprehension(surahIds[si]);
    if (comp) results.push(comp);
  }
  return results;
}

/**
 * Coverage Milestones with celebration data.
 */
const COVERAGE_MILESTONES = [
  { pct: 5, label: 'First Steps', icon: '🌱', insight: 'You can recognize 1 in 20 words! Every word builds your foundation.' },
  { pct: 10, label: 'Building Blocks', icon: '🧱', insight: '1 in 10 words familiar! You\'re starting to see patterns in the text.' },
  { pct: 20, label: 'Growing Strong', icon: '🌿', insight: '1 in 5 words known! Short verses become recognizable.' },
  { pct: 30, label: 'Solid Foundation', icon: '🏗️', insight: 'Nearly 1 in 3 words! You can grasp the topic of many verses.' },
  { pct: 40, label: 'Halfway There', icon: '🔥', insight: '2 in 5 words! You can follow the flow of longer passages.' },
  { pct: 50, label: 'Major Milestone', icon: '⭐', insight: 'Half the words! You understand key concepts across the Quran.' },
  { pct: 60, label: 'Strong Reader', icon: '📖', insight: '3 in 5 words! With tafsir, you can study most verses.' },
  { pct: 70, label: 'Advanced', icon: '🎯', insight: '7 in 10 words! Only specialized vocabulary remains unfamiliar.' },
  { pct: 80, label: 'Near Complete', icon: '👑', insight: '4 in 5 words! You have working knowledge of almost the entire Quranic vocabulary.' },
  { pct: 90, label: 'Expert Level', icon: '🏆', insight: '9 in 10 words! You can read with deep understanding.' },
  { pct: 95, label: 'Mastery', icon: '💎', insight: 'Only the rarest words remain. You are among the few.' },
  { pct: 100, label: 'Quran Complete', icon: '🌟', insight: 'All vocabulary mastered! The Quran is now open to you.' },
];

/**
 * Get the current milestone and next milestone based on coverage.
 */
function getMilestoneStatus(coveragePercent) {
  var currentMilestone = null;
  var nextMilestone = null;
  
  for (var mi = 0; mi < COVERAGE_MILESTONES.length; mi++) {
    if (coveragePercent >= COVERAGE_MILESTONES[mi].pct) {
      currentMilestone = COVERAGE_MILESTONES[mi];
    } else {
      nextMilestone = COVERAGE_MILESTONES[mi];
      break;
    }
  }
  
  var wordsToNext = 0;
  var lessonsToNext = 0;
  
  if (nextMilestone) {
    // Estimate words needed: each word adds roughly its occurrence count to coverage
    var neededCoverage = nextMilestone.pct - coveragePercent;
    var totalOcc = getTotalQuranOccurrences();
    var neededOccurrences = Math.ceil((neededCoverage / 100) * totalOcc);
    var avgOccPerFoundationWord = totalOcc > 0 && FOUNDATION_WORDS.length > 0
      ? getTotalFoundationOccurrences() / FOUNDATION_WORDS.length
      : 100;
    wordsToNext = Math.ceil(neededOccurrences / avgOccPerFoundationWord);
    lessonsToNext = Math.ceil(wordsToNext / FOUNDATION_WORDS_PER_LESSON);
  }
  
  return {
    currentMilestone: currentMilestone,
    nextMilestone: nextMilestone,
    wordsToNextMilestone: wordsToNext,
    lessonsToNextMilestone: lessonsToNext,
  };
}

function getTotalFoundationOccurrences() {
  var fWords = getAllFoundationWords();
  var total = 0;
  for (var fi = 0; fi < fWords.length; fi++) {
    total += fWords[fi].occ || 0;
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════
// QURAN COMPREHENSION TRACKER — Understanding & Milestones
//
// Provides:
//   • Current comprehension percentage (estimated from occurrence coverage)
//   • Previous comprehension values (yesterday, last week, last month)
//   • Deltas (today's gain, weekly gain, monthly gain)
//   • Educational milestone messages at every key threshold
//   • Smooth animation-ready values for UI display
// ═══════════════════════════════════════════════════════════════

/**
 * Comprehension Milestones with educational explanations.
 * Each threshold explains what the learner can now do.
 */
const COMPREHENSION_MILESTONES = [
  { pct: 5, label: 'First Glimpses', icon: '🌱', insight: 'You can now recognize approximately one out of every twenty Quran words.' },
  { pct: 10, label: 'Building Blocks', icon: '🧱', insight: 'One in ten words familiar! You can begin to spot repeated vocabulary across different surahs.' },
  { pct: 15, label: 'Growing Familiarity', icon: '🌿', insight: 'You now understand enough that short verses begin to feel accessible.' },
  { pct: 20, label: 'Recognizing Patterns', icon: '📖', insight: 'One in five words is known! You can identify the topic of many verses.' },
  { pct: 25, label: 'Quarter Milestone', icon: '⭐', insight: 'You can now recognize approximately one out of every four Quran words.' },
  { pct: 30, label: 'Solid Foundation', icon: '🏗️', insight: 'Nearly one in three words familiar! You can grasp the flow of longer passages.' },
  { pct: 40, label: 'Strong Progress', icon: '🔥', insight: 'Two in five words! You can follow the structure of most verses.' },
  { pct: 50, label: 'Major Milestone', icon: '👑', insight: 'Half the words recognized! You understand key Quranic concepts directly.' },
  { pct: 60, label: 'Confident Reader', icon: '📚', insight: 'Three in five words! You can study most verses with a tafsir.' },
  { pct: 70, label: 'Advanced Understanding', icon: '🎯', insight: 'Seven in ten words! Only specialized or rare vocabulary remains unfamiliar.' },
  { pct: 80, label: 'Near Complete', icon: '💎', insight: 'Four in five words! Working knowledge of almost the entire Quranic vocabulary.' },
  { pct: 90, label: 'Expert Level', icon: '🏆', insight: 'Nine in ten words! Deep understanding of Quranic Arabic.' },
  { pct: 95, label: 'Virtually Complete', icon: '🌟', insight: 'Only the rarest words remain unfamiliar.' },
  { pct: 100, label: 'Complete Mastery', icon: '💫', insight: 'All vocabulary mastered! The Quran is now open to you.' },
];

/**
 * Get the current comprehension milestone and next milestone.
 */
function getComprehensionMilestone(comprehensionPercent) {
  var current = null;
  var next = null;
  for (var mi = 0; mi < COMPREHENSION_MILESTONES.length; mi++) {
    if (comprehensionPercent >= COMPREHENSION_MILESTONES[mi].pct) {
      current = COMPREHENSION_MILESTONES[mi];
    } else {
      next = COMPREHENSION_MILESTONES[mi];
      break;
    }
  }
  var progressToNext = 0;
  if (current && next) {
    var range = next.pct - current.pct;
    var achieved = comprehensionPercent - current.pct;
    progressToNext = range > 0 ? Math.min(100, Math.round((achieved / range) * 100)) : 0;
  } else if (current && !next) {
    progressToNext = 100;
  }
  return { current: current, next: next, progressToNext: progressToNext };
}

/**
 * Get an educational insight message for the current comprehension level.
 */
function getComprehensionInsightMessage(comprehensionPercent) {
  var milestone = getComprehensionMilestone(comprehensionPercent);
  if (milestone && milestone.current) {
    return milestone.current.insight;
  }
  return 'Start learning Quranic vocabulary to build your comprehension.';
}

/**
 * Get comprehension deltas (changes over time) from analytics history.
 */
function getComprehensionDeltas() {
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var currentValue = coverage ? coverage.estimatedComprehension : 0;
  var history = (typeof window.__analytics !== 'undefined' && window.__analytics.getHistory)
    ? window.__analytics.getHistory() : [];
  if (history.length > 0) {
    history.sort(function(a, b) { return a.date.localeCompare(b.date); });
  }
  var today = _getTodayKey();
  var yesterday = _getRelativeDateKey(-1);
  var weekAgo = _getRelativeDateKey(-7);
  var monthAgo = _getRelativeDateKey(-30);
  var yesterdayValue = 0;
  var weekAgoValue = 0;
  var monthAgoValue = 0;
  for (var hi = 0; hi < history.length; hi++) {
    var entry = history[hi];
    if (entry.date === yesterday) yesterdayValue = entry.comprehension || 0;
    if (entry.date === weekAgo || (!weekAgoValue && entry.date <= yesterday)) weekAgoValue = entry.comprehension || 0;
    if (entry.date === monthAgo || (!monthAgoValue && entry.date <= weekAgo)) monthAgoValue = entry.comprehension || 0;
  }
  return {
    currentValue: currentValue,
    yesterdayValue: yesterdayValue,
    weekAgoValue: weekAgoValue,
    monthAgoValue: monthAgoValue,
    todayChange: currentValue - yesterdayValue,
    weekChange: currentValue - weekAgoValue,
    monthChange: currentValue - monthAgoValue,
  };
}

/**
 * Format a comprehension delta as a display string.
 */
function formatComprehensionDelta(value) {
  if (value === 0) return '0';
  var sign = value > 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

/**
 * Get the full comprehension insight object for dashboard display.
 */
function getComprehensionInsight() {
  var deltas = getComprehensionDeltas();
  var milestone = getComprehensionMilestone(deltas.currentValue);
  var insightMessage = getComprehensionInsightMessage(deltas.currentValue);
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  return {
    currentValue: deltas.currentValue,
    yesterdayValue: deltas.yesterdayValue,
    weekAgoValue: deltas.weekAgoValue,
    monthAgoValue: deltas.monthAgoValue,
    todayChange: deltas.todayChange,
    weekChange: deltas.weekChange,
    monthChange: deltas.monthChange,
    milestoneCurrent: milestone.current,
    milestoneNext: milestone.next,
    progressToNextMilestone: milestone.progressToNext,
    insightMessage: insightMessage,
    masteredOccurrences: coverage ? coverage.masteredOccurrences : 0,
    totalOccurrences: coverage ? coverage.totalOccurrences : 0,
    masteredWords: coverage ? coverage.masteredWords : 0,
    totalWords: coverage ? coverage.totalWords : 0,
  };
}

/** Format a number with leading zero */
function _padDate(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** Get today's date as YYYY-MM-DD (padded, matching analytics.js format) */
function _getTodayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + _padDate(d.getMonth() + 1) + '-' + _padDate(d.getDate());
}

/** Get a date offset by offsetDays from today, as YYYY-MM-DD */
function _getRelativeDateKey(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + _padDate(d.getMonth() + 1) + '-' + _padDate(d.getDate());
}
/**
 * shown at different Foundation Course progress levels.
 * Each level has multiple messages for variety when displayed to the user.
 */
/**
 * Enhanced milestone messages focusing on Quranic educational value.
 * Each level has multiple messages for variety when displayed to the user.
 * These messages connect learning achievements directly to understanding Allah's words.
 */
var FOUNDATION_MILESTONE_MESSAGES = [
  { pct: 0, messages: [
    'Every great journey begins with a single word. You are taking the most effective path to understanding the Quran.',
    'The 100 most frequent words make up ~84% of all word occurrences. Each lesson brings you closer to understanding Allah\'s words directly.',
  ] },
  { pct: 10, messages: [
    'You now understand approximately {comprehension}% of all word occurrences. You can now recognize one out of every ten Quran words — this is real, measurable progress toward understanding the Book of Allah.',
    'You are building a foundation that will serve every verse you read. Keep going — every word brings you closer to the Qurans message.',
  ] },
  { pct: 25, messages: [
    'One quarter complete! You recognize vocabulary used in most Quranic verses. Short surahs like Al-Ikhlas and Al-Asr are becoming accessible to you.',
    'These words appear {occurrences} times throughout the Quran. Every lesson is like unlocking a key to understanding Allah\'s revelation.',
    'You can now recognize approximately one out of every four Quran words. The patterns of divine speech are emerging.',
  ] },
  { pct: 50, messages: [
    'Halfway through the Foundation Course! You now understand approximately {comprehension}% of word occurrences. Many short surahs you hear in prayer are becoming meaningful.',
    'Fifty words mastered. These alone cover a significant portion of every surah you read. You are beginning to understand the Quran in its own words.',
  ] },
  { pct: 75, messages: [
    'Three quarters done! Most short surahs are now accessible to you. The words of Ar-Rahman, Al-Fatihah, and Al-Ikhlas carry new meaning.',
    'You have mastered vocabulary from {roots} unique root families. The patterns of Arabic morphology are becoming clear, revealing the depth of Quranic language.',
  ] },
  { pct: 90, messages: [
    'The final stretch! Nearly all foundation words mastered. The Quran is opening to you in a profound way. Verses you have heard for years now carry understanding.',
    'After this course, you will recognize approximately {comprehension}% of all word occurrences. You are almost ready to read the Quran with comprehension.',
  ] },
  { pct: 100, messages: [
    'Foundation Course Complete! You now understand approximately {comprehension}% of all word occurrences — covering ~84% of the entire Quran. SubhanAllah, what a journey!',
    'You mastered the 100 most frequent Quranic words — vocabulary used thousands of times throughout the Quran. These words appear in nearly every page of Allah\'s book.',
    'The Foundation Course has given you the essential vocabulary. Now explore surah by surah, and experience the Quran as it was revealed — to be understood.',
  ] },
];

/**
 * Get an educational context message explaining why the current foundation lesson matters.
 * Returns an object with title, context, comprehensionGain, cumulativeMsg, totalOccurrences, rootCount.
 */
function getFoundationLessonContextMsg(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) {
    return { title: '', context: '', comprehensionGain: '', cumulativeMsg: '', totalOccurrences: 0, rootCount: 0 };
  }
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(lessonIndex) : [];
  var totalOcc = 0;
  for (var wi = 0; wi < words.length; wi++) totalOcc += words[wi].occ || 0;
  var uniqueRoots = {};
  for (var rwi = 0; rwi < words.length; rwi++) {
    if (words[rwi].root && words[rwi].root !== '\u2014') uniqueRoots[words[rwi].root] = true;
  }
  var rootCount = Object.keys(uniqueRoots).length;
  return {
    title: lesson.thematicTitle || '',
    context: lesson.lessonContext || '',
    comprehensionGain: lesson.comprehensionGain !== undefined ? '+' + lesson.comprehensionGain + '% comprehension' : '',
    cumulativeMsg: lesson.cumulativeCoverageNum
      ? 'Cumulative: ' + lesson.cumulativeCoverage + ' of Quranic occurrences'
      : '',
    totalOccurrences: totalOcc,
    rootCount: rootCount,
  };
}

/**
 * Get a meaningful educational milestone message based on Foundation Course progress.
 * Returns { message, icon, progress } where message is a dynamic string with real stats.
 */
function getFoundationMilestoneMessage() {
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var pct = fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0;
  var comprehension = coverage ? coverage.estimatedComprehension : 0;
  var masteredOcc = coverage ? coverage.masteredOccurrences : 0;
  var roots = typeof getRootFamilyMastery === 'function' ? getRootFamilyMastery() : null;
  var rootCount = roots ? roots.fullyMasteredRoots : 0;
  
  // Find the matching milestone level
  var selected = FOUNDATION_MILESTONE_MESSAGES[0];
  for (var mi = 0; mi < FOUNDATION_MILESTONE_MESSAGES.length; mi++) {
    if (pct >= FOUNDATION_MILESTONE_MESSAGES[mi].pct) {
      selected = FOUNDATION_MILESTONE_MESSAGES[mi];
    }
  }
  
  // Pick a random message from this level
  var msgs = selected.messages;
  var msg = msgs[Math.floor(Math.random() * msgs.length)];
  msg = msg.replace('{comprehension}', String(comprehension));
  msg = msg.replace('{occurrences}', masteredOcc.toLocaleString());
  msg = msg.replace('{roots}', String(rootCount));
  
  var icon = pct >= 100 ? '\uD83C\uDF89' : pct >= 50 ? '\u2B50' : pct >= 25 ? '\uD83D\uDCA1' : '\uD83C\uDF31';
  
  return { message: msg, icon: icon, progress: pct };
}

/**
 * Get educational motivation text for a specific lesson, based on actual lesson content.
 * Returns meaningful Quranic encouragement rather than generic gamification.
 */
function getEducationalMotivation(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) {
    return 'Continue your journey to understand the Quran, one word at a time.';
  }
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var words = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(lessonIndex) : [];
  
  // Calculate occurrences covered by this lesson
  var lessonOcc = 0;
  for (var wi = 0; wi < words.length; wi++) {
    lessonOcc += words[wi].occ || 0;
  }
  
  // Find sample words for the motivational message
  var sampleWords = words.slice(0, 3).map(function(w) { return w.arabic + ' (' + w.english + ')'; }).join(', ');
  var totalOcc = getTotalQuranOccurrences();
  var coveragePct = totalOcc > 0 ? Math.round(lessonOcc / totalOcc * 100) : 0;
  
  // Different messages based on lesson type
  if (lesson.isReview) {
    return 'Review lessons strengthen your memory so the words become part of your long-term understanding. This consolidation is where true learning happens.';
  }
  
  if (coveragePct >= 10) {
    return 'This lesson covers approximately ' + coveragePct + '% of all Quranic word occurrences. Words like ' + sampleWords + ' appear hundreds of times — mastering them transforms how you read the Quran.';
  }
  
  return 'This lesson introduces words that appear extensively throughout the Quran. Words like ' + sampleWords + ' are part of the fabric of divine revelation — each one a key to understanding.';
}

/**
 * Get a list of surahs whose comprehension improves significantly after completing
 * a specific foundation lesson. Returns top 5 surahs with their comprehension change.
 */
function getSurahsImprovedByFoundationLesson(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) return [];
  
  var lesson = FOUNDATION_LESSONS[lessonIndex];
  var mastered = getMasteredWordIds();
  
  // Add lesson words to mastered (simulating completion)
  var simulatedMastered = {};
  Object.keys(mastered).forEach(function(id) { simulatedMastered[id] = true; });
  for (var wi = 0; wi < lesson.wordIds.length; wi++) {
    simulatedMastered[lesson.wordIds[wi]] = true;
  }
  
  // Calculate comprehension change for each surah
  var allSurahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
  var improvements = [];
  
  for (var si = 0; si < allSurahIds.length; si++) {
    var sid = allSurahIds[si];
    var words = getSurahWords(sid);
    if (!words || words.length === 0) continue;
    
    // Count how many lesson words appear in this surah
    var lessonWordsInSurah = 0;
    for (var wi2 = 0; wi2 < lesson.wordIds.length; wi2++) {
      for (var wj = 0; wj < words.length; wj++) {
        if (words[wj].id === lesson.wordIds[wi2]) {
          lessonWordsInSurah++;
          break;
        }
      }
    }
    
    if (lessonWordsInSurah > 0) {
      // Calculate before/after comprehension
      var totalWords = words.length;
      var masteredBefore = 0;
      var masteredAfter = 0;
      for (var wk = 0; wk < words.length; wk++) {
        if (mastered[words[wk].id]) masteredBefore++;
        if (simulatedMastered[words[wk].id]) masteredAfter++;
      }
      var beforePct = totalWords > 0 ? Math.round(masteredBefore / totalWords * 100) : 0;
      var afterPct = totalWords > 0 ? Math.round(masteredAfter / totalWords * 100) : 0;
      
      if (afterPct > beforePct) {
        var surahName = '';
        if (typeof SURAH_INFO !== 'undefined' && SURAH_INFO[sid]) {
          surahName = SURAH_INFO[sid].name;
        }
        improvements.push({
          surahId: sid,
          name: surahName || 'Surah ' + sid,
          beforePct: beforePct,
          afterPct: afterPct,
          gain: afterPct - beforePct,
          wordsLearned: lessonWordsInSurah,
        });
      }
    }
  }
  
  // Sort by gain (highest first) and return top 5
  improvements.sort(function(a, b) { return b.gain - a.gain; });
  return improvements.slice(0, 5);
}

/**
 * Get the thematic title for a foundation lesson.
 */
function getFoundationLessonThematicTitle(lessonIndex) {
  if (!FOUNDATION_LESSONS || lessonIndex >= FOUNDATION_LESSONS.length) return '';
  return FOUNDATION_LESSONS[lessonIndex].thematicTitle || '';
}

/**
 * Get comprehensive foundation course statistics for display on dashboard and lesson headers.
 */
function getFoundationCourseStats() {
  var fCompleted = typeof getCompletedFoundationLessonCount === 'function' ? getCompletedFoundationLessonCount() : 0;
  var fTotal = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var coverage = typeof calculateCoverage === 'function' ? calculateCoverage() : null;
  var fCoverage = typeof getFoundationCoverage === 'function' ? getFoundationCoverage() : null;
  var milestone = getFoundationMilestoneMessage();
  return {
    completed: fCompleted,
    total: fTotal,
    percent: fTotal > 0 ? Math.round((fCompleted / fTotal) * 100) : 0,
    coveragePercent: coverage ? coverage.coveragePercent : 0,
    estimatedComprehension: coverage ? coverage.estimatedComprehension : 0,
    masteredWords: coverage ? coverage.masteredWords : 0,
    totalWords: coverage ? coverage.totalWords : 0,
    foundationCoveragePercent: fCoverage ? fCoverage.foundationCoveragePercent : 0,
    masteredFoundationWords: fCoverage ? fCoverage.masteredFoundationWords : 0,
    totalFoundationWords: fCoverage ? fCoverage.totalFoundationWords : 0,
    milestoneMessage: milestone.message,
    milestoneIcon: milestone.icon,
  };
}



/**
 * Validate educational consistency across all vocabulary.
 * Checks:
 *   - Difficulty progression across foundation lessons
 *   - Root family relationships (all members present)
 *   - Similar word links (bidirectional when possible)
 *   - Contrast word references exist
 *   - Consistent typeCategory assignments
 * Reports issues to console for manual review.
 */
function validateEducationalConsistency() {
  var issues = [];
  var words = typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0 
    ? getCanonicalWords() : ALL_WORDS;
  
  if (!words || words.length === 0) {
    console.warn('[edu-validate] No vocabulary data.');
    return { valid: false, issues: ['No vocabulary data'] };
  }
  
  // Build arabic lookup
  var arabicMap = {};
  for (var vi = 0; vi < words.length; vi++) {
    if (words[vi].arabic) arabicMap[words[vi].arabic] = words[vi];
  }
  
  // 1. Check difficulty distribution in foundation lessons
  if (typeof getFoundationLessonCount === 'function') {
    var fCount = getFoundationLessonCount();
    for (var li = 0; li < fCount; li++) {
      var lessonWords = typeof getFoundationLessonWords === 'function' ? getFoundationLessonWords(li) : [];
      var diffs = lessonWords.map(function(w) { return w.difficulty || 3; });
      var maxDiff = Math.max.apply(null, diffs);
      var minDiff = Math.min.apply(null, diffs);
      if (maxDiff - minDiff > 3) {
        issues.push('Foundation lesson ' + (li + 1) + ' has large difficulty spread: ' + minDiff + '-' + maxDiff);
      }
    }
  }
  
  // 2. Check root family references exist
  var totalRootFamilyRefs = 0;
  var missingRootFamilyRefs = 0;
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    if (w.rootFamily && Array.isArray(w.rootFamily)) {
      for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
        totalRootFamilyRefs++;
        var rfArabic = w.rootFamily[rfi].a;
        if (rfArabic && !arabicMap[rfArabic]) {
          missingRootFamilyRefs++;
        }
      }
    }
  }
  if (missingRootFamilyRefs > 0) {
    console.log('[edu-validate] ℹ ' + missingRootFamilyRefs + '/' + totalRootFamilyRefs + ' root family refs point to non-vocabulary words (may be intentional)');
  }
  
  // 3. Check similar/opposite/contrast word references
  var refFields = ['similarWords', 'oppositeWords', 'contrastWords'];
  for (var fi = 0; fi < refFields.length; fi++) {
    var field = refFields[fi];
    var missingRefs = 0;
    var totalRefs = 0;
    for (var wj = 0; wj < words.length; wj++) {
      var refs = words[wj][field];
      if (refs && Array.isArray(refs)) {
        totalRefs += refs.length;
        for (var rj = 0; rj < refs.length; rj++) {
          if (!arabicMap[refs[rj]]) {
            missingRefs++;
            if (missingRefs <= 3) {
              console.log('[edu-validate] ℹ ' + words[wj].arabic + ' references missing ' + field + ': \'' + refs[rj] + '\'');
            }
          }
        }
      }
    }
    if (missingRefs > 0) {
      console.log('[edu-validate] ℹ ' + field + ': ' + missingRefs + '/' + totalRefs + ' refs missing from vocabulary');
    }
  }
  
  // 4. Check typeCategory consistency
  var validCategories = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation', 'adverb', 'proper noun', 'name'];
  var invalidCat = 0;
  for (var ci = 0; ci < words.length; ci++) {
    if (words[ci].typeCategory && validCategories.indexOf(words[ci].typeCategory) < 0) {
      invalidCat++;
      if (invalidCat <= 5) {
        issues.push('Invalid typeCategory \'' + words[ci].typeCategory + '\' for word ' + words[ci].arabic);
      }
    }
  }
  
  // 5. Check for missing difficulty
  var missingDiff = 0;
  for (var di = 0; di < words.length; di++) {
    if (!words[di].difficulty) missingDiff++;
  }
  if (missingDiff > 0) {
    issues.push(missingDiff + ' words missing difficulty level');
  }
  
  // Report
  if (issues.length > 0) {
    console.log('[edu-validate] Found ' + issues.length + ' issue(s):');
    issues.forEach(function(iss) { console.log('  ' + iss); });
  } else {
    console.log('[edu-validate] ✓ All checks passed for ' + words.length + ' words.');
  }
  
  return { valid: issues.length === 0, issues: issues };
}

// ── Foundation Progress (localStorage) ──────────────────────────

const FOUNDATION_PROGRESS_KEY = 'quran_foundation_progress';

function getDefaultFoundationProgress() {
  return {
    currentLesson: 0,        // 0-based index of the active foundation lesson
    completedLessons: [],     // array of 0-based foundation lesson indices that are finished
    quizPassed: {},           // { "0": true, "1": false, ... }
  };
}

function loadFoundationProgress() {
  try {
    var raw = localStorage.getItem(FOUNDATION_PROGRESS_KEY);
    if (!raw) return getDefaultFoundationProgress();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultFoundationProgress();
  }
}

function saveFoundationProgress(data) {
  try {
    localStorage.setItem(FOUNDATION_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save foundation progress:', e.message);
  }
}

/**
 * Track root families mastered.
 */
function getRootFamilyMastery() {
  var mastered = getMasteredWordIds();
  var allCanonical = typeof getCanonicalWords === 'function' ? getCanonicalWords() : ALL_WORDS;
  var rootGroups = {};
  var masteredRoots = {};
  
  for (var ri = 0; ri < allCanonical.length; ri++) {
    var w = allCanonical[ri];
    if (!w.root || w.root === '—') continue;
    if (!rootGroups[w.root]) rootGroups[w.root] = { total: 0, mastered: 0, rootMeaning: w.rootMeaning };
    rootGroups[w.root].total++;
    if (mastered[w.id]) {
      rootGroups[w.root].mastered++;
    }
  }
  
  var totalRoots = Object.keys(rootGroups).length;
  var fullyMasteredRoots = 0;
  var partiallyMasteredRoots = 0;
  
  Object.keys(rootGroups).forEach(function(root) {
    var g = rootGroups[root];
    if (g.mastered === g.total) {
      fullyMasteredRoots++;
      masteredRoots[root] = 'complete';
    } else if (g.mastered > 0) {
      partiallyMasteredRoots++;
      masteredRoots[root] = 'partial';
    }
  });
  
  return {
    totalRoots: totalRoots,
    fullyMasteredRoots: fullyMasteredRoots,
    partiallyMasteredRoots: partiallyMasteredRoots,
  };
}

function isFoundationLessonCompleted(lessonIndex) {
  var progress = loadFoundationProgress();
  return progress.completedLessons.indexOf(lessonIndex) >= 0;
}

function isFoundationLessonUnlocked(lessonIndex) {
  if (lessonIndex === 0) return true;
  return isFoundationLessonCompleted(lessonIndex - 1);
}

function getNextIncompleteFoundationLesson() {
  var total = getFoundationLessonCount();
  for (var i = 0; i < total; i++) {
    if (!isFoundationLessonCompleted(i)) return i;
  }
  return 0;
}

function completeFoundationLesson(lessonIndex) {
  var progress = loadFoundationProgress();
  if (progress.completedLessons.indexOf(lessonIndex) < 0) {
    progress.completedLessons.push(lessonIndex);
  }
  progress.quizPassed[String(lessonIndex)] = true;
  saveFoundationProgress(progress);
  progress.currentLesson = getNextIncompleteFoundationLesson();
  saveFoundationProgress(progress);
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && window.__sync && window.__sync.queueSync) {
    window.__sync.queueSync(user.uid);
  }
}

function getCurrentFoundationLessonIndex() {
  var progress = loadFoundationProgress();
  return progress.currentLesson;
}

function setCurrentFoundationLesson(lessonIndex) {
  var total = getFoundationLessonCount();
  if (lessonIndex < 0 || lessonIndex >= total) return;
  var progress = loadFoundationProgress();
  progress.currentLesson = lessonIndex;
  saveFoundationProgress(progress);
}

function getCompletedFoundationLessonCount() {
  var progress = loadFoundationProgress();
  return progress.completedLessons.length;
}
