// ═══════════════════════════════════════════════════════════════
// quran-validate.js — Quran Data Integrity Validation
//
// Run: node test/quran-data.test.js
//
// Verifies:
//   • All 114 Surahs exist
//   • All 6236 verses exist
//   • Verse numbering is sequential within each surah
//   • Surah metadata matches expectations
//   • No duplicated verses
//   • No missing verses
//   • Arabic text is non-empty for every verse
//   • Translation is non-empty for every verse
//
// Can be used both at build time and as a standalone test.
// ═══════════════════════════════════════════════════════════════

/**
 * Validate the Quran text dataset.
 *
 * @param {Object} quranText - window.__QURAN_TEXT
 * @returns {{ valid: boolean, totalSurahs: number, totalVerses: number, errors: string[], warnings: string[] }}
 */
function validateQuranData(quranText) {
  var result = {
    valid: true,
    totalSurahs: 0,
    totalVerses: 0,
    errors: [],
    warnings: [],
  };

  if (!quranText) {
    result.valid = false;
    result.errors.push('Quran data is null or undefined');
    return result;
  }

  var surahIds = Object.keys(quranText).map(Number).sort(function (a, b) { return a - b; });
  result.totalSurahs = surahIds.length;

  // 1. Check 114 surahs
  if (surahIds.length !== 114) {
    result.valid = false;
    result.errors.push('Expected 114 surahs, found ' + surahIds.length);
  }

  // 2. Check surah IDs are 1-114
  var expectedIds = [];
  for (var ei = 1; ei <= 114; ei++) expectedIds.push(ei);
  var missingIds = expectedIds.filter(function (id) { return surahIds.indexOf(id) < 0; });
  if (missingIds.length > 0) {
    result.valid = false;
    result.errors.push('Missing surah IDs: ' + missingIds.join(', '));
  }

  var extraIds = surahIds.filter(function (id) { return id < 1 || id > 114; });
  if (extraIds.length > 0) {
    result.valid = false;
    result.errors.push('Extra surah IDs outside 1-114: ' + extraIds.join(', '));
  }

  // 3. Validate each surah
  var totalVerses = 0;
  var seenGlobalVerses = {};

  surahIds.forEach(function (sid) {
    var surah = quranText[sid];

    // Check required fields
    if (!surah.name) {
      result.errors.push('Surah ' + sid + ' missing name');
    }
    if (!surah.verses || !Array.isArray(surah.verses)) {
      result.valid = false;
      result.errors.push('Surah ' + sid + ' missing verses array');
      return;
    }

    // Check total_verses matches array length
    if (surah.total_verses !== surah.verses.length) {
      result.valid = false;
      result.errors.push('Surah ' + sid + ' total_verses=' + surah.total_verses + ' but array length=' + surah.verses.length);
    }

    // Check verse numbering
    surah.verses.forEach(function (v, idx) {
      var expectedId = idx + 1;

      if (v.id !== expectedId) {
        result.valid = false;
        result.errors.push('Surah ' + sid + ' verse ' + expectedId + ' has id=' + v.id);
      }

      if (!v.text || v.text.trim() === '') {
        result.warnings.push('Surah ' + sid + ' verse ' + v.id + ' has empty Arabic text');
      }

      if (!v.translation || v.translation.trim() === '') {
        result.warnings.push('Surah ' + sid + ' verse ' + v.id + ' has empty translation');
      }

      // Check for duplicates (by surahId + verseId)
      var globalKey = sid + ':' + v.id;
      if (seenGlobalVerses[globalKey]) {
        result.errors.push('Duplicate verse ' + globalKey);
      }
      seenGlobalVerses[globalKey] = true;

      totalVerses++;
    });
  });

  result.totalVerses = totalVerses;

  // 4. Check total verse count
  if (totalVerses !== 6236) {
    result.warnings.push('Expected 6236 total verses, found ' + totalVerses + ' (non-critical — verify' +
      ' against expected total)');
  }

  // 5. Check for known surah verse counts
  var expectedVerseCounts = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
    21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
    31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
    41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
    51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
    61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
    81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
    91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
    101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6
  };

  surahIds.forEach(function (sid) {
    var surah = quranText[sid];
    if (!surah) return;
    var expected = expectedVerseCounts[sid];
    if (expected !== undefined && surah.total_verses !== expected) {
      result.warnings.push('Surah ' + sid + ' has ' + surah.total_verses + ' verses, expected ' + expected);
    }
  });

  return result;
}

// ── Export ──
window.__quranValidate = {
  validate: validateQuranData,
};

// If running in Node (test environment), also export via module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateQuranData: validateQuranData };
}
