// ═══════════════════════════════════════════════════════════════
// juz-data.js — Juz' (Part) Definitions for the 30 Juz' of the Quran
//
// Provides canonical surah ranges, verse boundaries, and names
// for each of the 30 ajza' (plural of juz').
//
// Each juz has:
//   - id: Juz number (1-30)
//   - name: Arabic name
//   - nameSimple: Simple transliteration
//   - english: English name / description
//   - startSurah: First surah ID
//   - startVerse: First verse in the start surah (1-indexed)
//   - endSurah: Last surah ID
//   - endVerse: Last verse in the end surah
//
// These correspond to the standard Hizb divisions used by
// most Quran prints worldwide (Egyptian standard).
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} JuzInfo
 * @property {number} id - Juz number (1-30)
 * @property {string} name - Arabic name
 * @property {string} nameSimple - Simple transliteration
 * @property {string} english - English description
 * @property {number} startSurah - First surah ID in this juz
 * @property {number} startVerse - First verse in startSurah (1-indexed)
 * @property {number} endSurah - Last surah ID in this juz
 * @property {number} endVerse - Last verse in endSurah
 */

/** @type {Object<number, JuzInfo>} */
const JUZ_INFO = {
  1:  { id: 1,  name: 'الم',                nameSimple: 'Alif Lam Meem',     english: 'Al-Fatiha + Al-Baqarah (1)',     startSurah: 1,  startVerse: 1,   endSurah: 2,  endVerse: 141 },
  2:  { id: 2,  name: 'سيقول',              nameSimple: 'Sayaqool',          english: 'Al-Baqarah (2)',                  startSurah: 2,  startVerse: 142, endSurah: 2,  endVerse: 252 },
  3:  { id: 3,  name: 'تلك الرسل',           nameSimple: 'Tilka Ar-Rusul',    english: 'Al-Baqarah (3)',                  startSurah: 2,  startVerse: 253, endSurah: 3,  endVerse: 92 },
  4:  { id: 4,  name: 'لن تنالوا',           nameSimple: 'Lan Tanalu',        english: "Aal-e-Imran (4) + An-Nisa'",     startSurah: 3,  startVerse: 93,  endSurah: 4,  endVerse: 23 },
  5:  { id: 5,  name: 'والمحصنات',           nameSimple: 'Wal-Muhsanat',      english: "An-Nisa' (5)",                     startSurah: 4,  startVerse: 24,  endSurah: 4,  endVerse: 147 },
  6:  { id: 6,  name: 'لا يحب الله',          nameSimple: 'La Yuhibb Allah',   english: "An-Nisa' (6) + Al-Ma'idah",       startSurah: 4,  startVerse: 148, endSurah: 5,  endVerse: 81 },
  7:  { id: 7,  name: 'وإذا سمعوا',          nameSimple: 'Wa Itha Sami\'u',   english: "Al-Ma'idah (7) + Al-An'am",       startSurah: 5,  startVerse: 82,  endSurah: 6,  endVerse: 110 },
  8:  { id: 8,  name: 'ولو أننا',            nameSimple: 'Wa Law Annana',     english: "Al-An'am (8) + Al-A'raf",         startSurah: 6,  startVerse: 111, endSurah: 7,  endVerse: 87 },
  9:  { id: 9,  name: 'قال الملأ',           nameSimple: 'Qala Al-Mala\'u',   english: "Al-A'raf (9) + Al-Anfal",         startSurah: 7,  startVerse: 88,  endSurah: 8,  endVerse: 40 },
  10: { id: 10, name: 'واعلموا',             nameSimple: 'Wa A\'lamu',        english: 'Al-Anfal (10) + At-Tawbah',       startSurah: 8,  startVerse: 41,  endSurah: 9,  endVerse: 92 },
  11: { id: 11, name: 'يعتذرون',             nameSimple: 'Ya\'tadhirun',      english: 'At-Tawbah (11) + Yunus',          startSurah: 9,  startVerse: 93,  endSurah: 11, endVerse: 5 },
  12: { id: 12, name: 'وما من دابة',          nameSimple: 'Wa Ma Min Da\'bbah', english: 'Hud (12) + Yusuf',              startSurah: 11, startVerse: 6,   endSurah: 12, endVerse: 52 },
  13: { id: 13, name: 'وما أبرئ',            nameSimple: 'Wa Ma Ubari\'u',    english: 'Yusuf (13) + Ibrahim',            startSurah: 12, startVerse: 53,  endSurah: 14, endVerse: 52 },
  14: { id: 14, name: 'الحجر',               nameSimple: 'Al-Hijr',           english: 'Al-Hijr + An-Nahl',              startSurah: 15, startVerse: 1,   endSurah: 16, endVerse: 128 },
  15: { id: 15, name: 'سبحان',               nameSimple: 'Subhan',            english: "Al-Isra' + Al-Kahf (1)",         startSurah: 17, startVerse: 1,   endSurah: 18, endVerse: 74 },
  16: { id: 16, name: 'قل أوحي',             nameSimple: 'Qul Oohi',          english: 'Al-Kahf (2) + Ta-Ha',            startSurah: 18, startVerse: 75,  endSurah: 20, endVerse: 135 },
  17: { id: 17, name: 'اقترب',               nameSimple: 'Iqtaraba',          english: "Al-Anbiya' + Al-Hajj",           startSurah: 21, startVerse: 1,   endSurah: 22, endVerse: 78 },
  18: { id: 18, name: 'قد أفلح',             nameSimple: 'Qad Aflaha',        english: "Al-Mu'minun + Al-Furqan (1)",    startSurah: 23, startVerse: 1,   endSurah: 25, endVerse: 20 },
  19: { id: 19, name: 'وقال الذين',          nameSimple: 'Wa Qalalladhina',   english: 'Al-Furqan (2) + An-Naml (1)',     startSurah: 25, startVerse: 21,  endSurah: 27, endVerse: 55 },
  20: { id: 20, name: 'أمن خلق',             nameSimple: 'A Man Khalaqa',     english: 'An-Naml (2) + Al-Ankabut (1)',    startSurah: 27, startVerse: 56,  endSurah: 29, endVerse: 45 },
  21: { id: 21, name: 'اتل ما أوحي',          nameSimple: 'Utlu Ma Oohiya',   english: 'Al-Ankabut (2) + Al-Ahzab (1)',   startSurah: 29, startVerse: 46,  endSurah: 33, endVerse: 30 },
  22: { id: 22, name: 'ومن يقنت',            nameSimple: 'Wa Ma Yaqnut',      english: 'Al-Ahzab (2) + Ya-Sin (1)',       startSurah: 33, startVerse: 31,  endSurah: 36, endVerse: 27 },
  23: { id: 23, name: 'وما لي',              nameSimple: 'Wa Ma Liya',        english: 'Ya-Sin (2) + Az-Zumar (1)',       startSurah: 36, startVerse: 28,  endSurah: 39, endVerse: 31 },
  24: { id: 24, name: 'فمن أظلم',            nameSimple: 'Fa Man Azlamu',     english: 'Az-Zumar (2) + Fussilat',         startSurah: 39, startVerse: 32,  endSurah: 41, endVerse: 46 },
  25: { id: 25, name: 'إليه يرد',            nameSimple: 'Ilayhi Yuraddu',    english: 'Fussilat (2) + Al-Jathiyah',      startSurah: 41, startVerse: 47,  endSurah: 45, endVerse: 37 },
  26: { id: 26, name: 'حم',                  nameSimple: 'Ha Meem',           english: 'Al-Ahqaf + Adh-Dhariyat (1)',     startSurah: 46, startVerse: 1,   endSurah: 51, endVerse: 30 },
  27: { id: 27, name: 'قال فما خطبكم',       nameSimple: 'Qala Fa Ma Khatbukum', english: 'Adh-Dhariyat (2) + Al-Hadid',   startSurah: 51, startVerse: 31,  endSurah: 57, endVerse: 29 },
  28: { id: 28, name: 'قد سمع',              nameSimple: 'Qad Sami\'a',       english: 'Al-Mujadilah + At-Tahrim',        startSurah: 58, startVerse: 1,   endSurah: 66, endVerse: 12 },
  29: { id: 29, name: 'تبارك',               nameSimple: 'Tabarak',           english: 'Al-Mulk + Al-Mursalat',           startSurah: 67, startVerse: 1,   endSurah: 77, endVerse: 50 },
  30: { id: 30, name: 'عم',                  nameSimple: '\'Amma',            english: "An-Naba' — An-Nas",               startSurah: 78, startVerse: 1,   endSurah: 114, endVerse: 6 },
};

/** Get juz info by ID (1-30). Returns JuzInfo or null. */
function getJuzInfo(juzId) {
  return JUZ_INFO[juzId] || null;
}

/** Get all juz IDs in order (1-30). */
function getAllJuzIds() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
}

/**
 * Get an array of surah IDs that belong to a given juz.
 * Uses the startSurah/endSurah range from JUZ_INFO.
 * Returns empty array if juzId is invalid.
 */
function getSurahIdsForJuz(juzId) {
  var info = JUZ_INFO[juzId];
  if (!info) return [];
  var ids = [];
  for (var sid = info.startSurah; sid <= info.endSurah; sid++) {
    if (typeof SURAH_INFO !== 'undefined' && SURAH_INFO[sid]) {
      ids.push(sid);
    }
  }
  return ids;
}

/**
 * Get all words that fall within a given juz.
 * Requires getSurahWords to be defined (data.js).
 * @param {number} juzId - Juz number (1-30)
 * @returns {Array} Words from surahs in this juz
 */
function getJuzWords(juzId) {
  if (typeof getSurahWords !== 'function') return [];
  var surahIds = getSurahIdsForJuz(juzId);
  var allWords = [];
  var seen = {};
  for (var si = 0; si < surahIds.length; si++) {
    var words = getSurahWords(surahIds[si]);
    for (var wi = 0; wi < words.length; wi++) {
      var w = words[wi];
      if (!seen[w.id]) {
        seen[w.id] = true;
        allWords.push(w);
      }
    }
  }
  return allWords;
}

/**
 * Calculate occurrence-weighted comprehension for a juz.
 * Reuses word-level SRS data to derive juz-level comprehension.
 * @param {number} juzId - Juz number (1-30)
 * @param {Object} [srsData] - Optional SRS data (will loadSRS if not provided)
 * @returns {Object|null} { pct, known, learning, unknown, total, totalWords, masteredWords } or null
 */
function getJuzComprehension(juzId, srsData) {
  if (!srsData && typeof loadSRS === 'function') {
    srsData = loadSRS();
  }
  if (!srsData) return null;
  
  var words = getJuzWords(juzId);
  if (words.length === 0) return null;
  
  var totalWeight = 0;
  var knownWeight = 0;
  var learningWeight = 0;
  var masteredCount = 0;
  
  for (var wi = 0; wi < words.length; wi++) {
    var w = words[wi];
    var weight = w.occ || (w.occurrences ? w.occurrences.length : 1);
    if (weight < 1) weight = 1;
    totalWeight += weight;
    
    var entry = srsData[w.id];
    if (entry) {
      if (entry.stage >= 3) {
        // Mastered
        knownWeight += weight;
        masteredCount++;
      } else if (entry.stage >= 2) {
        // Well known
        knownWeight += weight;
      } else if (entry.stage >= 1) {
        // Learning
        learningWeight += weight;
      }
    }
  }
  
  var pct = totalWeight > 0 ? Math.round(((knownWeight + learningWeight * 0.5) / totalWeight) * 100) : 0;
  
  return {
    pct: pct,
    known: knownWeight,
    learning: learningWeight,
    unknown: totalWeight - knownWeight - learningWeight,
    total: totalWeight,
    totalWords: words.length,
    masteredWords: masteredCount,
  };
}

/**
 * Get reading insights specifically for a juz.
 * @param {number} juzId - Juz number (1-30)
 * @returns {Object|null} Insights object or null
 */
function getJuzReadingInsights(juzId) {
  if (typeof getSurahReadingInsights !== 'function') return null;
  
  var surahIds = getSurahIdsForJuz(juzId);
  var combined = {
    newWordsEncountered: 0,
    knownWordsReinforced: 0,
    mostRepeatedRoots: {},
    recommendation: '',
    coverageGained: 0,
  };
  
  for (var si = 0; si < surahIds.length; si++) {
    var insights = getSurahReadingInsights(surahIds[si]);
    if (!insights) continue;
    combined.newWordsEncountered += insights.newWordsEncountered || 0;
    combined.knownWordsReinforced += insights.knownWordsReinforced || 0;
    if (insights.mostRepeatedRoots) {
      for (var ri = 0; ri < insights.mostRepeatedRoots.length; ri++) {
        var r = insights.mostRepeatedRoots[ri];
        combined.mostRepeatedRoots[r.root] = (combined.mostRepeatedRoots[r.root] || 0) + (r.count || 0);
      }
    }
  }
  
  // Sort roots
  var rootEntries = Object.keys(combined.mostRepeatedRoots).map(function(k) {
    return { root: k, count: combined.mostRepeatedRoots[k] };
  }).sort(function(a, b) { return b.count - a.count; });
  combined.mostRepeatedRoots = rootEntries.slice(0, 5);
  
  // Generate recommendation
  var comp = getJuzComprehension(juzId);
  if (comp && comp.pct < 30) {
    combined.recommendation = '📘 This juz has ' + comp.totalWords + ' unique vocabulary words — start with Foundation Course lessons to improve comprehension.';
  } else if (comp && comp.pct >= 70) {
    combined.recommendation = '🌟 You understand most of this juz! Consider a full quiz session to test your knowledge.';
  } else {
    var unknownWords = comp ? comp.totalWords - comp.masteredWords : 0;
    combined.recommendation = '📖 Reading through this juz will reinforce ' + unknownWords + ' words you are learning.';
  }
  
  return combined;
}

// ── Export ──────────────────────────────────────────────────────
window.__juz = {
  getInfo: getJuzInfo,
  getSurahIds: getSurahIdsForJuz,
  getWords: getJuzWords,
  getComprehension: getJuzComprehension,
  getInsights: getJuzReadingInsights,
};
