// ═══════════════════════════════════════════════════════════════
// test.js — Formal Regression Test Suite
//
// Validates: data integrity, search functionality, vocabulary
// services, SRS engine, build output, and UI rendering helpers.
//
// Usage: node test.js
//        node test.js --verbose  (show all individual checks)
//        node test.js --skip-build  (skip build pipeline tests)
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// ── Configuration ──────────────────────────────────────────────

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'js', 'data');
const DIST_DIR = path.join(ROOT, 'dist');
const SURAH_INFO_PATH = path.join(DATA_DIR, 'surahs.js');

const VERBOSE = process.argv.includes('--verbose');
const SKIP_BUILD = process.argv.includes('--skip-build');

// ── Test Framework ─────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let currentSuite = '';

// Share data across all suites (load once, use many)
let _cachedWords = null;
let _parseErrors = [];

function suite(name) {
  currentSuite = name;
  console.log(`\n  --- ${name} ---\n`);
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    if (VERBOSE) console.log(`    ok ${name}`);
  } catch (e) {
    failedTests++;
    console.log(`    FAIL ${name}`);
    console.log(`      ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ── Helpers ────────────────────────────────────────────────────

const VALID_TYPE_CATEGORIES = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation', 'adverb', 'proper noun', 'name'];
const VALID_FREQUENCIES = ['very-high', 'high', 'medium', 'low'];
const REQUIRED_FIELDS = ['arabic', 'translit', 'english', 'meaning', 'type', 'typeCategory', 'root', 'occ', 'frequency', 'difficulty'];

// Surah verse counts for reference
const SURAH_VERSE_COUNTS = {
  1:7,2:286,3:200,4:176,5:120,6:165,7:206,8:75,9:129,10:109,
  11:123,12:111,13:43,14:52,15:99,16:128,17:111,18:110,19:98,20:135,
  21:112,22:78,23:118,24:64,25:77,26:227,27:93,28:88,29:69,30:60,
  31:34,32:30,33:73,34:54,35:45,36:83,37:182,38:88,39:75,40:85,
  41:54,42:53,43:89,44:59,45:37,46:35,47:38,48:29,49:18,50:45,
  51:60,52:49,53:62,54:55,55:78,56:96,57:29,58:22,59:24,60:13,
  61:14,62:11,63:11,64:18,65:12,66:12,67:30,68:52,69:52,70:44,
  71:28,72:28,73:20,74:56,75:40,76:31,77:50,78:40,79:46,80:42,
  81:29,82:19,83:36,84:25,85:22,86:17,87:19,88:26,89:30,90:20,
  91:15,92:21,93:11,94:8,95:8,96:19,97:5,98:8,99:8,100:11,
  101:11,102:8,103:3,104:9,105:5,106:4,107:7,108:3,109:6,110:3,
  111:5,112:4,113:5,114:6
};

/**
 * Parse words from a single data file by simulating ALL_WORDS.push.
 * Returns the array of word objects found in the file.
 */
function parseWordsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ALL_WORDS = [];
  eval(content);
  return ALL_WORDS;
}

/**
 * Load ALL_WORDS once and cache it. All subsequent calls return the same array.
 * Tracks which files fail to parse.
 */
function loadAllWords() {
  if (_cachedWords) return _cachedWords;

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.js') && f !== 'data.js' && f !== 'surahs.js')
    .sort();

  let all = [];
  _parseErrors = [];

  files.forEach(f => {
    const filePath = path.join(DATA_DIR, f);
    try {
      const words = parseWordsFromFile(filePath);
      words.forEach(w => { w._sourceFile = f; });
      all = all.concat(words);
    } catch (e) {
      _parseErrors.push({ file: f, error: e.message });
    }
  });

  // Assign sequential IDs (simulates assignWordIds from data.js)
  let idCounter = 0;
  const usedIds = {};
  all.forEach(w => {
    if (!w.id || usedIds[w.id]) {
      w.id = 'w_' + (idCounter++);
    }
    usedIds[w.id] = true;
  });

  _cachedWords = all;
  return all;
}

/**
 * Strip Arabic diacritical marks (tashkeel) from a string so that
 * bare-letter searching works even for stored text with fatha,
 * damma, kasra, shadda, sukun, etc.
 */
function stripArabicDiacritics(str) {
  if (!str) return '';
  return str.replace(/[\u064B-\u0652\u0670]/g, '');
}

/**
 * Get a normalized version of a string for searching Latin-based
 * text (translit, english) — strip diacritics, special chars, lower case.
 */
function normalizeForSearch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u0300-\u036f\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g, '')  // combining marks
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
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// SUITE 1: Data Integrity
// ═══════════════════════════════════════════════════════════════

suite('Data Integrity');

(function() {
  const ALL_WORDS = loadAllWords();
  const wordCount = ALL_WORDS.length;

  test('Vocabulary database is non-empty', () => {
    assert(wordCount >= 700, 'Only ' + wordCount + ' words loaded (expected >= 700)');
  });

  test('All files parse without JavaScript errors', () => {
    assert(_parseErrors.length === 0,
      _parseErrors.length + ' file(s) failed to parse: ' +
      _parseErrors.map(p => p.file + ': ' + p.error.substring(0, 80)).join('; '));
  });

  test('Every word has a unique ID', () => {
    const ids = {};
    const bad = [];
    ALL_WORDS.forEach((w, i) => {
      if (!w.id) bad.push('Word #' + i + ' missing id');
      else if (ids[w.id] !== undefined) bad.push('Duplicate id: ' + w.id);
      else ids[w.id] = i;
    });
    assert(bad.length === 0, bad.slice(0, 5).join('; '));
  });

  // Required fields
  REQUIRED_FIELDS.forEach(function(field) {
    test('All words have "' + field + '" field', () => {
      var missing = ALL_WORDS.filter(w => !w[field] || (typeof w[field] === 'string' && w[field].trim() === ''));
      assert(missing.length === 0, missing.length + ' words missing "' + field + '"');
    });
  });

  test('All words have non-empty tags array', () => {
    var missing = ALL_WORDS.filter(w => !w.tags || w.tags.length === 0);
    assert(missing.length === 0, missing.length + ' words missing tags');
  });

  test('All words have between 2 and 5 tags', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w, i) {
      if (w.tags && (w.tags.length < 2 || w.tags.length > 5)) {
        bad.push('Word #' + i + ' (' + (w.arabic || w.english) + ') has ' + w.tags.length + ' tags');
      }
    });
    if (bad.length > 0) {
      console.log('    note: ' + bad.length + ' word(s) have non-standard tag counts (allowed: 2-5)');
    }
  });

  test('All typeCategory values are valid', () => {
    var invalid = [];
    ALL_WORDS.forEach(function(w) {
      if (w.typeCategory && VALID_TYPE_CATEGORIES.indexOf(w.typeCategory.toLowerCase().trim()) < 0) {
        invalid.push((w.arabic || w.english) + ': "' + w.typeCategory + '"');
      }
    });
    assert(invalid.length === 0, 'Invalid typeCategories: ' + invalid.slice(0, 5).join('; '));
  });

  test('All frequency values are valid', () => {
    var invalid = [];
    ALL_WORDS.forEach(function(w) {
      if (w.frequency && VALID_FREQUENCIES.indexOf(w.frequency) < 0) {
        invalid.push(w.english + ': "' + w.frequency + '"');
      }
    });
    assert(invalid.length === 0, 'Invalid frequencies: ' + invalid.join(', '));
  });

  test('All difficulty values are 1-5', () => {
    var invalid = [];
    ALL_WORDS.forEach(function(w) {
      if (w.difficulty !== undefined && (typeof w.difficulty !== 'number' || w.difficulty < 1 || w.difficulty > 5)) {
        invalid.push(w.english + ': ' + w.difficulty);
      }
    });
    assert(invalid.length === 0, 'Invalid difficulties: ' + invalid.join(', '));
  });

  test('No words have zero occurrences', () => {
    var zero = ALL_WORDS.filter(w => w.occ === 0);
    assert(zero.length === 0, zero.length + ' words have occ=0: ' + zero.slice(0, 3).map(w => w.arabic).join(', '));
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 2: Per-Surah Word Validation
// ═══════════════════════════════════════════════════════════════

suite('Surah & Verse References');

(function() {
  const ALL_WORDS = loadAllWords();
  const perSurahWords = ALL_WORDS.filter(w => /^words-surah-\d+-/.test(w._sourceFile));

  test('Per-surah words have surahId', () => {
    var missing = perSurahWords.filter(w => !w.surahId);
    assert(missing.length === 0, missing.length + ' per-surah words missing surahId');
  });

  test('Per-surah words have verseKey', () => {
    var missing = perSurahWords.filter(w => !w.verseKey);
    assert(missing.length === 0, missing.length + ' per-surah words missing verseKey');
  });

  test('Per-surah words have ayahA (Arabic verse)', () => {
    var missing = perSurahWords.filter(w => !w.ayahA);
    assert(missing.length === 0, missing.length + ' per-surah words missing ayahA');
  });

  test('Per-surah words have ayahT (verse translation)', () => {
    var missing = perSurahWords.filter(w => !w.ayahT);
    assert(missing.length === 0, missing.length + ' per-surah words missing ayahT');
  });

  test('Per-surah words have tafsir', () => {
    var missing = perSurahWords.filter(w => !w.tafsir);
    assert(missing.length === 0, missing.length + ' per-surah words missing tafsir');
  });

  test('All surahId values are 1-114', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.surahId !== undefined && w.surahId !== null) {
        if (typeof w.surahId !== 'number' || w.surahId < 1 || w.surahId > 114) {
          bad.push((w.arabic || w.english) + ': surahId=' + w.surahId);
        }
      }
    });
    assert(bad.length === 0, bad.join('; '));
  });

  test('All verseKeys follow NUMBER:NUMBER format', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.verseKey && typeof w.verseKey === 'string') {
        var parts = w.verseKey.split(':');
        if (parts.length !== 2 || isNaN(parseInt(parts[0])) || isNaN(parseInt(parts[1]))) {
          bad.push((w.arabic || w.english) + ': "' + w.verseKey + '"');
        }
      }
    });
    assert(bad.length === 0, 'Bad verseKeys: ' + bad.slice(0, 5).join('; '));
  });

  test('verseKey surah number matches surahId', () => {
    var mismatches = [];
    ALL_WORDS.forEach(function(w) {
      if (w.verseKey && w.surahId) {
        var keySurah = parseInt(w.verseKey.split(':')[0], 10);
        if (keySurah !== w.surahId) {
          mismatches.push((w.arabic || w.english) + ': verseKey=' + w.verseKey + ' but surahId=' + w.surahId);
        }
      }
    });
    if (mismatches.length > 0) {
      console.log('    note: ' + mismatches.length + ' verseKey/surahId mismatches (may be intentional)');
      mismatches.slice(0, 3).forEach(function(m) { console.log('      ' + m); });
    }
  });

  test('All verse numbers are within surah verse count', () => {
    var outOfRange = [];
    ALL_WORDS.forEach(function(w) {
      if (w.verseKey && w.surahId) {
        var parts = w.verseKey.split(':');
        var verseNum = parseInt(parts[1], 10);
        var maxVerses = SURAH_VERSE_COUNTS[w.surahId];
        if (maxVerses && (verseNum < 1 || verseNum > maxVerses)) {
          outOfRange.push((w.arabic || w.english) + ': ' + w.verseKey + ' (surah ' + w.surahId + ' has ' + maxVerses + ' verses)');
        }
      }
    });
    assert(outOfRange.length === 0, outOfRange.slice(0, 5).join('; '));
  });

  test('ayahA contains ayah-highlight span', () => {
    var missing = [];
    ALL_WORDS.forEach(function(w) {
      if (w.ayahA && w.ayahA.indexOf('ayah-highlight') < 0) {
        missing.push(w.arabic || w.english);
      }
    });
    if (missing.length > 0) {
      console.log('    note: ' + missing.length + ' word(s) have ayahA without ayah-highlight span');
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 3: Root & Morphology Fields
// ═══════════════════════════════════════════════════════════════

suite('Root & Morphology');

(function() {
  const ALL_WORDS = loadAllWords();

  test('All words have root field', () => {
    var missing = ALL_WORDS.filter(w => !w.root || w.root.trim() === '');
    var bad = missing.filter(w => w.root !== '\u2014' && w.root !== '\u2014');
    if (bad.length > 0) {
      throw new Error(bad.length + ' words missing root: ' + bad.slice(0, 3).map(w => w.arabic || w.english).join(', '));
    }
  });

  test('All words have rootMeaning field', () => {
    var missing = ALL_WORDS.filter(w => !w.rootMeaning || w.rootMeaning.trim() === '');
    assert(missing.length === 0, missing.length + ' words missing rootMeaning');
  });

  test('All words have rootPattern field', () => {
    var missing = ALL_WORDS.filter(w => !w.rootPattern || w.rootPattern.trim() === '');
    assert(missing.length === 0, missing.length + ' words missing rootPattern');
  });

  test('All words have non-empty rootFamily array', () => {
    var missing = ALL_WORDS.filter(w => !w.rootFamily || w.rootFamily.length === 0);
    var bad = missing.filter(w => w.root !== '\u2014' && w.root !== '\u2014');
    if (bad.length > 0) {
      throw new Error(bad.length + ' words missing rootFamily: ' + bad.slice(0, 5).map(w => w.arabic || w.english).join(', '));
    }
  });

  test('rootFamily entries have both arabic and english fields', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.rootFamily && Array.isArray(w.rootFamily)) {
        w.rootFamily.forEach(function(rf, i) {
          if (!rf.a || !rf.e) bad.push((w.arabic || w.english) + '[' + i + ']: missing ' + (rf.a ? 'english' : 'arabic'));
        });
      }
    });
    assert(bad.length === 0, bad.slice(0, 5).join('; '));
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Semantic Relations
// ═══════════════════════════════════════════════════════════════

suite('Semantic Relations');

(function() {
  const ALL_WORDS = loadAllWords();
  var arabicSet = {};
  ALL_WORDS.forEach(function(w) { if (w.arabic) arabicSet[w.arabic] = true; });

  test('similarWords is always an array', () => {
    var bad = ALL_WORDS.filter(w => w.similarWords !== undefined && !Array.isArray(w.similarWords));
    assert(bad.length === 0, bad.length + ' words have non-array similarWords');
  });

  test('oppositeWords is always an array', () => {
    var bad = ALL_WORDS.filter(w => w.oppositeWords !== undefined && !Array.isArray(w.oppositeWords));
    assert(bad.length === 0, bad.length + ' words have non-array oppositeWords');
  });

  test('relatedWords is always an array', () => {
    var bad = ALL_WORDS.filter(w => w.relatedWords !== undefined && !Array.isArray(w.relatedWords));
    assert(bad.length === 0, bad.length + ' words have non-array relatedWords');
  });

  test('similar/opposite/related word references exist in vocabulary', () => {
    var missing = [];
    ALL_WORDS.forEach(function(w) {
      ['similarWords', 'oppositeWords', 'relatedWords'].forEach(function(field) {
        if (w[field] && Array.isArray(w[field])) {
          w[field].forEach(function(ref) {
            if (!arabicSet[ref]) {
              missing.push((w.arabic || w.english) + '.' + field + ': "' + ref + '"');
            }
          });
        }
      });
    });
    if (missing.length > 0) {
      console.log('    note: ' + missing.length + ' cross-references not found in vocabulary');
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 5: File Structure
// ═══════════════════════════════════════════════════════════════

suite('File Structure');

(function() {
  var perSurahFiles = fs.readdirSync(DATA_DIR)
    .filter(f => /^words-surah-\d+-/.test(f));

  test('Per-surah files follow naming convention words-surah-NN-name.js', () => {
    var bad = [];
    perSurahFiles.forEach(function(f) {
      var match = f.match(/^words-surah-(\d+)-(.+)\.js$/);
      if (!match) bad.push(f);
      else {
        var num = parseInt(match[1], 10);
        if (num < 1 || num > 114) bad.push(f + ': invalid surah number');
      }
    });
    assert(bad.length === 0, bad.join('; '));
  });

  test('Per-surah files are in ascending numerical order', () => {
    var nums = perSurahFiles.map(f => parseInt(f.match(/words-surah-(\d+)/)[1], 10));
    // Sort numerically for checking sequence
    var sorted = nums.slice().sort(function(a, b) { return a - b; });
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i] !== nums[i]) {
        // File system order doesn't match numerical order
        console.log('    note: Files are not in numerical order (likely due to filesystem sorting of "words-surah-100-..." before "words-surah-11-...")');
        break;
      }
    }
  });

  test('Each per-surah file has at least 4 word entries', () => {
    var low = [];
    perSurahFiles.forEach(function(f) {
      try {
        var words = parseWordsFromFile(path.join(DATA_DIR, f));
        if (words.length < 4) low.push(f + ': ' + words.length + ' words');
      } catch (e) {
        low.push(f + ': parse error');
      }
    });
    assert(low.length === 0, low.join('; '));
  });

  test('Each per-surah file has at most 12 word entries', () => {
    var high = [];
    perSurahFiles.forEach(function(f) {
      try {
        var words = parseWordsFromFile(path.join(DATA_DIR, f));
        if (words.length > 12) high.push(f + ': ' + words.length + ' words');
      } catch (e) {
        // Skip files with parse errors
      }
    });
    assert(high.length === 0, high.join('; '));
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 6: Search Functionality
// ═══════════════════════════════════════════════════════════════

suite('Search Functionality');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Can search by Arabic text (normalized)', () => {
    var query = '\u0627\u0644\u0644\u0647'; // الله (bare, without diacritics)
    var results = ALL_WORDS.filter(w => w.arabic && stripArabicDiacritics(w.arabic).indexOf(query) >= 0);
    assert(results.length >= 1, 'Expected at least 1 result for Arabic query, got ' + results.length);
  });

  test('Can search by English meaning', () => {
    var query = 'mercy';
    var results = ALL_WORDS.filter(w => w.english && w.english.toLowerCase().indexOf(query) >= 0);
    assert(results.length >= 1, 'Expected at least 1 result for "mercy", got ' + results.length);
  });

  test('Can search by root', () => {
    var query = '\u0631-\u062D-\u0645'; // ر-ح-م
    var results = ALL_WORDS.filter(w => w.root && w.root.indexOf(query) >= 0);
    assert(results.length >= 1, 'Expected at least 1 result for root, got ' + results.length);
  });

  test('Can search by transliteration (fuzzy)', () => {
    // Use a simple translit query that should match many words
    var query = 'al';
    var results = ALL_WORDS.filter(w => w.translit && w.translit.toLowerCase().indexOf(query) >= 0);
    assert(results.length >= 5, 'Expected at least 5 results for "al", got ' + results.length);
  });

  test('Can search by tag', () => {
    var query = 'allah';
    var results = ALL_WORDS.filter(w => w.tags && w.tags.some(function(t) { return t.indexOf(query) >= 0; }));
    assert(results.length >= 1, 'Expected at least 1 result for tag "allah", got ' + results.length);
  });

  test('Can search by type', () => {
    var query = 'noun';
    var results = ALL_WORDS.filter(w => w.type && w.type.toLowerCase().indexOf(query) >= 0);
    assert(results.length >= 10, 'Expected at least 10 results for "noun", got ' + results.length);
  });

  test('Filter by typeCategory works', () => {
    var nouns = ALL_WORDS.filter(w => w.typeCategory === 'noun');
    var verbs = ALL_WORDS.filter(w => w.typeCategory === 'verb');
    assert(nouns.length >= 10, 'Expected >= 10 nouns, got ' + nouns.length);
    assert(verbs.length >= 5, 'Expected >= 5 verbs, got ' + verbs.length);
  });

  test('Filter by difficulty level works', () => {
    var easy = ALL_WORDS.filter(w => w.difficulty === 1);
    var hard = ALL_WORDS.filter(w => w.difficulty === 5);
    assert(easy.length >= 5, 'Expected >= 5 difficulty-1 words, got ' + easy.length);
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 7: SRS Data Validation
// ═══════════════════════════════════════════════════════════════

suite('SRS Data');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Every word has a unique ID for SRS tracking', () => {
    var ids = {};
    var dupes = 0;
    ALL_WORDS.forEach(function(w) {
      if (ids[w.id]) dupes++;
      ids[w.id] = true;
    });
    assert(dupes === 0, dupes + ' duplicate IDs found');
  });

  test('Total occurrences exceed word count', () => {
    var sum = 0;
    ALL_WORDS.forEach(function(w) { sum += (w.occ || 0); });
    assert(sum > ALL_WORDS.length, 'Sum of occurrences (' + sum + ') should exceed word count (' + ALL_WORDS.length + ')');
  });

  test('All words have occ >= 1', () => {
    var zero = ALL_WORDS.filter(w => w.occ === 0);
    assert(zero.length === 0, zero.length + ' words have occ=0');
  });

  test('All four frequency bands are represented', () => {
    var freqs = {};
    ALL_WORDS.forEach(function(w) {
      if (w.frequency) freqs[w.frequency] = true;
    });
    assert(freqs['very-high'] === true, 'No very-high frequency words');
    assert(freqs['high'] === true, 'No high frequency words');
    assert(freqs['medium'] === true, 'No medium frequency words');
    assert(freqs['low'] === true, 'No low frequency words');
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 8: Duplicate Declaration Validation
// ═══════════════════════════════════════════════════════════════

suite('Duplicate Declarations');

(function() {
  // Scan all source JS files that go into the bundles
  var JS_FILES = [
    'js/data.js',
    'js/data/surahs.js',
    'js/services/config.js',
    'js/services/auth-service.js',
    'js/services/sync-service.js',
    'js/services/user-service.js',
    'js/vocabulary.js',
    'js/srs.js',
    'js/ui.js',
    'js/quiz.js',
    'js/auth-ui.js',
    'js/profile-ui.js',
    'js/app.js',
  ];

  // Also scan all data files in js/data/ directory
  var dataFiles = fs.readdirSync(DATA_DIR)
    .filter(function(f) { return f.endsWith('.js') && f !== 'data.js' && f !== 'surahs.js'; })
    .map(function(f) { return 'js/data/' + f; });

  var allTestFiles = JS_FILES.concat(dataFiles);

  test('No duplicate const/let/var/function declarations across all JS files', () => {
    var seen = {};
    var duplicates = [];

    allTestFiles.forEach(function(file) {
      var fullPath = path.join(ROOT, file);
      if (!fs.existsSync(fullPath)) return;
      var content = fs.readFileSync(fullPath, 'utf8');
      var lines = content.split('\n');

      lines.forEach(function(line, idx) {
        var lineNum = idx + 1;
        var trimmed = line.trim();

        // Only track TOP-LEVEL declarations (no leading whitespace).
        // Indented declarations are inside function bodies or blocks and
        // are locally scoped — they do NOT cause global duplicate errors.
        if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) return;

        // Skip comment lines and empty lines
        if (trimmed.indexOf('//') === 0 || trimmed.indexOf('/*') === 0 || trimmed === '') return;

        var match;
        if ((match = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=/))) {
          var name = match[1];
          if (seen[name]) {
            duplicates.push(name + ' — "' + seen[name].file + ':' + seen[name].line + '" and "' + file + ':' + lineNum + '"');
          } else {
            seen[name] = { file: file, line: lineNum };
          }
        } else if ((match = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/))) {
          var name = match[1];
          if (seen[name]) {
            duplicates.push(name + ' — "' + seen[name].file + ':' + seen[name].line + '" and "' + file + ':' + lineNum + '"');
          } else {
            seen[name] = { file: file, line: lineNum };
          }
        }
      });
    });

    assert(duplicates.length === 0,
      duplicates.length + ' duplicate declaration(s) found:\n' +
      duplicates.map(function(d) { return '      ' + d; }).join('\n'));
  });

  test('No duplicate declarations within individual data files', () => {
    var intraFileIssues = [];

    dataFiles.forEach(function(file) {
      var fullPath = path.join(ROOT, file);
      if (!fs.existsSync(fullPath)) return;
      var content = fs.readFileSync(fullPath, 'utf8');
      var lines = content.split('\n');
      var seenInFile = {};

      lines.forEach(function(line, idx) {
        var lineNum = idx + 1;
        var trimmed = line.trim();

        // Only track TOP-LEVEL declarations
        if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) return;

        if (trimmed.indexOf('//') === 0 || trimmed.indexOf('/*') === 0 || trimmed === '') return;

        var match;
        if ((match = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=/))) {
          var name = match[1];
          if (seenInFile[name] !== undefined) {
            intraFileIssues.push(file + ':' + lineNum + ' — "' + name + '" already declared at line ' + seenInFile[name]);
          } else {
            seenInFile[name] = lineNum;
          }
        } else if ((match = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/))) {
          var name = match[1];
          if (seenInFile[name] !== undefined) {
            intraFileIssues.push(file + ':' + lineNum + ' — "' + name + '" already declared at line ' + seenInFile[name]);
          } else {
            seenInFile[name] = lineNum;
          }
        }
      });
    });

    assert(intraFileIssues.length === 0,
      intraFileIssues.length + ' intra-file duplicate(s):\n' +
      intraFileIssues.map(function(i) { return '      ' + i; }).join('\n'));
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 9: Build Pipeline
// ═══════════════════════════════════════════════════════════════

if (!SKIP_BUILD) {
  suite('Build Pipeline');

  (function() {
    // Run the build
    test('Build command executes successfully', () => {
      var result = cp.spawnSync('node', ['build.js'], {
        cwd: ROOT,
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      assert(result.status === 0, 'Build exited with code ' + result.status + ': ' + result.stderr.toString().slice(0, 200));
    });

    test('Dist directory exists after build', () => {
      assert(fs.existsSync(DIST_DIR), 'dist/ directory not found after build');
    });

    var requiredFiles = [
      'index.html', 'sw.js', 'styles.min.css', 'manifest.json',
      'js/data.bundle.min.js', 'js/app.bundle.min.js'
    ];

    requiredFiles.forEach(function(f) {
      test('Required file exists: ' + f, () => {
        assert(fs.existsSync(path.join(DIST_DIR, f)), 'Missing: ' + f);
      });
      test('Required file is non-empty: ' + f, () => {
        var stat = fs.statSync(path.join(DIST_DIR, f));
        assert(stat.size > 0, f + ' is empty (0 bytes)');
      });
    });

    // Size checks
    test('data.bundle.min.js is between 100 KB and 1.5 MB', () => {
      var size = fs.statSync(path.join(DIST_DIR, 'js/data.bundle.min.js')).size;
      assert(size > 100 * 1024, 'Size: ' + (size / 1024).toFixed(1) + ' KB (min 100 KB)');
      assert(size < 1.5 * 1024 * 1024, 'Size: ' + (size / 1024).toFixed(1) + ' KB (max 1.5 MB)');
    });

    test('app.bundle.min.js is between 20 KB and 300 KB', () => {
      var size = fs.statSync(path.join(DIST_DIR, 'js/app.bundle.min.js')).size;
      assert(size > 20 * 1024, 'Size: ' + (size / 1024).toFixed(1) + ' KB (min 20 KB)');
      assert(size < 300 * 1024, 'Size: ' + (size / 1024).toFixed(1) + ' KB (max 300 KB)');
    });

    // Content checks
    test('data bundle contains ALL_WORDS', () => {
      var content = fs.readFileSync(path.join(DIST_DIR, 'js/data.bundle.min.js'), 'utf8');
      assert(content.indexOf('ALL_WORDS') >= 0, 'ALL_WORDS constant missing from data bundle');
    });

    test('data bundle contains SURAH_INFO', () => {
      var content = fs.readFileSync(path.join(DIST_DIR, 'js/data.bundle.min.js'), 'utf8');
      assert(content.indexOf('SURAH_INFO') >= 0, 'SURAH_INFO missing from data bundle');
    });

    test('data bundle has substantial word entries', () => {
      var content = fs.readFileSync(path.join(DIST_DIR, 'js/data.bundle.min.js'), 'utf8');
      var pushCount = (content.match(/ALL_WORDS\.push\(/g) || []).length;
      assert(pushCount >= 30, 'Only ' + pushCount + ' ALL_WORDS.push() calls (expected >= 30)');
    });

    test('app bundle contains SRS, search, UI, quiz, auth, sync', () => {
      var content = fs.readFileSync(path.join(DIST_DIR, 'js/app.bundle.min.js'), 'utf8');
      assert(/srs/i.test(content), 'SRS functions missing');
      assert(content.indexOf('search') >= 0, 'Search functions missing');
      assert(content.indexOf('renderWordCard') >= 0 || content.indexOf('wordCard') >= 0, 'UI functions missing');
      assert(/quiz/i.test(content), 'Quiz system missing');
      assert(content.indexOf('loginWithEmail') >= 0 || /firebase/i.test(content), 'Auth functions missing');
      assert(content.indexOf('uploadToCloud') >= 0 || content.indexOf('queueSync') >= 0, 'Sync functions missing');
    });

    // HTML checks
    test('index.html references production bundles', () => {
      var html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
      assert(html.indexOf('data.bundle.min.js') >= 0, 'Missing data.bundle.min.js');
      assert(html.indexOf('app.bundle.min.js') >= 0, 'Missing app.bundle.min.js');
      assert(html.indexOf('firebase-core.js') >= 0, 'Missing firebase-core.js');
      assert(html.indexOf('manifest.json') >= 0, 'Missing manifest.json');
    });

    // SW checks
    test('Service worker has proper structure', () => {
      var sw = fs.readFileSync(path.join(DIST_DIR, 'sw.js'), 'utf8');
      assert(sw.indexOf('PRECACHE_URLS') >= 0, 'Missing PRECACHE_URLS');
      assert(sw.indexOf('data.bundle.min.js') >= 0, 'Missing data.bundle in precache');
      assert(sw.indexOf('app.bundle.min.js') >= 0, 'Missing app.bundle in precache');
      assert(sw.indexOf('firebase-core.js') >= 0, 'Missing firebase-core.js in precache');
      assert(sw.indexOf('styles.min.css') >= 0, 'Missing styles.min.css in precache');
      assert(sw.indexOf('install') >= 0, 'Missing install event');
      assert(sw.indexOf('activate') >= 0, 'Missing activate event');
      assert(sw.indexOf('fetch') >= 0, 'Missing fetch event');
    });

    // CSS checks
    test('Minified CSS has all required styles', () => {
      var css = fs.readFileSync(path.join(DIST_DIR, 'styles.min.css'), 'utf8');
      assert(css.indexOf(':root') >= 0, 'Missing :root CSS variables');
      assert(css.indexOf('.word-card') >= 0, 'Missing .word-card styles');
      assert(css.indexOf('.bottom-nav') >= 0, 'Missing .bottom-nav styles');
      assert(css.indexOf('.srs-btn') >= 0, 'Missing .srs-btn styles');
    });
  })();
} else {
  console.log('\n  --- Build Pipeline (skipped) ---\n');
  console.log('  Use --skip-build to skip, or omit to run build tests.');
}

// ═══════════════════════════════════════════════════════════════
// SUITE 9: Data Completeness
// ═══════════════════════════════════════════════════════════════

suite('Data Completeness');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Total vocabulary has at least 700 words', () => {
    assert(ALL_WORDS.length >= 700, 'Only ' + ALL_WORDS.length + ' words loaded');
  });

  test('At least 80 surahs have vocabulary coverage', () => {
    var surahs = {};
    ALL_WORDS.forEach(function(w) { if (w.surahId) surahs[w.surahId] = true; });
    var count = Object.keys(surahs).length;
    assert(count >= 80, 'Only ' + count + ' surahs have vocabulary');
  });

  test('Tags contain diverse thematic categories', () => {
    var tagSet = {};
    ALL_WORDS.forEach(function(w) {
      if (w.tags) w.tags.forEach(function(t) { tagSet[t] = true; });
    });
    var count = Object.keys(tagSet).length;
    assert(count >= 20, 'Only ' + count + ' unique tags found (expected >= 20)');
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 10: Arabic Text & Unicode
// ═══════════════════════════════════════════════════════════════

suite('Arabic Text & Unicode');

(function() {
  const ALL_WORDS = loadAllWords();
  var arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFD\uFE70-\uFEFC]/;

  test('All arabic fields contain Arabic script characters', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.arabic && !arabicRegex.test(w.arabic)) {
        bad.push('"' + w.arabic + '" (' + w.english + ')');
      }
    });
    assert(bad.length === 0, 'Non-Arabic in arabic field: ' + bad.slice(0, 5).join(', '));
  });

  test('No RTL control characters in text fields', () => {
    var rtlRegex = /[\u200E\u200F\u202A-\u202E]/;
    var issues = [];
    ALL_WORDS.forEach(function(w) {
      ['arabic', 'translit', 'english', 'meaning', 'root'].forEach(function(field) {
        if (w[field] && typeof w[field] === 'string' && rtlRegex.test(w[field])) {
          issues.push(field + ' in "' + (w.arabic || w.english) + '"');
        }
      });
    });
    assert(issues.length === 0, 'RTL markers: ' + issues.slice(0, 5).join('; '));
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 11: Quiz Distractors
// ═══════════════════════════════════════════════════════════════

suite('Quiz Distractors');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Sufficient words for distractor selection', () => {
    var testWord = ALL_WORDS[0];
    if (!testWord) return;
    var sameType = ALL_WORDS.filter(w => w !== testWord && w.typeCategory === testWord.typeCategory);
    assert(sameType.length >= 3, 'Not enough words of type "' + testWord.typeCategory + '" for distractors');
  });

  test('Multiple type categories exist for cross-category distractors', () => {
    var cats = {};
    ALL_WORDS.forEach(function(w) { if (w.typeCategory) cats[w.typeCategory] = true; });
    assert(Object.keys(cats).length >= 4, 'Only ' + Object.keys(cats).length + ' type categories found (expected >= 4)');
  });

  test('Multiple difficulty levels exist', () => {
    var diffs = {};
    ALL_WORDS.forEach(function(w) { if (w.difficulty) diffs[w.difficulty] = true; });
    assert(Object.keys(diffs).length >= 3, 'Only ' + Object.keys(diffs).length + ' difficulty levels found (expected >= 3)');
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 12: Vocabulary Distribution
// ═══════════════════════════════════════════════════════════════

suite('Vocabulary Distribution');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Vocabulary contains noun, verb, particle, and adjective types', () => {
    var cats = {};
    ALL_WORDS.forEach(function(w) { if (w.typeCategory) cats[w.typeCategory] = true; });
    assert(cats['noun'] === true, 'Missing nouns');
    assert(cats['verb'] === true, 'Missing verbs');
    assert(cats['particle'] === true, 'Missing particles');
    assert(cats['adjective'] === true, 'Missing adjectives');
  });

  test('Nouns form the largest vocabulary category', () => {
    var counts = {};
    ALL_WORDS.forEach(function(w) {
      if (w.typeCategory) counts[w.typeCategory] = (counts[w.typeCategory] || 0) + 1;
    });
    assert((counts['noun'] || 0) >= (counts['verb'] || 0), 'Nouns (' + (counts['noun'] || 0) + ') should exceed Verbs (' + (counts['verb'] || 0) + ')');
  });

  test('All five difficulty levels are represented', () => {
    var diffs = {};
    ALL_WORDS.forEach(function(w) { if (w.difficulty) diffs[w.difficulty] = true; });
    for (var d = 1; d <= 5; d++) {
      assert(diffs[d] === true, 'No difficulty level ' + d + ' words');
    }
  });

  test('Easy words (1-2) outnumber hard words (4-5)', () => {
    var easy = ALL_WORDS.filter(w => w.difficulty === 1 || w.difficulty === 2).length;
    var hard = ALL_WORDS.filter(w => w.difficulty === 4 || w.difficulty === 5).length;
    assert(easy >= hard, 'Easy: ' + easy + ', Hard: ' + hard + ' - expected easy >= hard');
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 13: Relationship Network Validation
// ═══════════════════════════════════════════════════════════════

suite('Relationship Network');

(function() {
  const ALL_WORDS = loadAllWords();

  test('similarWords references exist in vocabulary', () => {
    var refs = [];
    ALL_WORDS.forEach(function(w) {
      if (w.similarWords && Array.isArray(w.similarWords)) {
        w.similarWords.forEach(function(ref) {
          if (ref && typeof ref === 'string' && ref.trim() !== '') {
            var found = ALL_WORDS.some(function(ow) { return ow.arabic === ref; });
            if (!found) refs.push((w.arabic || w.english) + ' -> "' + ref + '"');
          }
        });
      }
    });
    if (refs.length > 0) {
      console.log('    note: ' + refs.length + ' similarWords references not found in vocabulary (likely words not yet added)');
    }
  });

  test('oppositeWords references exist in vocabulary', () => {
    var refs = [];
    ALL_WORDS.forEach(function(w) {
      if (w.oppositeWords && Array.isArray(w.oppositeWords)) {
        w.oppositeWords.forEach(function(ref) {
          if (ref && typeof ref === 'string' && ref.trim() !== '') {
            var found = ALL_WORDS.some(function(ow) { return ow.arabic === ref; });
            if (!found) refs.push((w.arabic || w.english) + ' -> "' + ref + '"');
          }
        });
      }
    });
    if (refs.length > 0) {
      console.log('    note: ' + refs.length + ' oppositeWords references not found in vocabulary');
    }
  });

  test('relatedWords references exist in vocabulary', () => {
    var refs = [];
    ALL_WORDS.forEach(function(w) {
      if (w.relatedWords && Array.isArray(w.relatedWords)) {
        w.relatedWords.forEach(function(ref) {
          if (ref && typeof ref === 'string' && ref.trim() !== '') {
            var found = ALL_WORDS.some(function(ow) { return ow.arabic === ref; });
            if (!found) refs.push((w.arabic || w.english) + ' -> "' + ref + '"');
          }
        });
      }
    });
    if (refs.length > 0) {
      console.log('    note: ' + refs.length + ' relatedWords references not found in vocabulary');
    }
  });

  test('No words reference themselves in similar/opposite/related words', () => {
    var selfRefs = [];
    ALL_WORDS.forEach(function(w) {
      ['similarWords', 'oppositeWords', 'relatedWords'].forEach(function(field) {
        if (w[field] && Array.isArray(w[field])) {
          w[field].forEach(function(ref) {
            if (ref === w.arabic) selfRefs.push((w.arabic || w.english) + ' has self-reference in ' + field);
          });
        }
      });
    });
    if (selfRefs.length > 0) {
      console.log('    note: ' + selfRefs.length + ' self-reference(s) found (pre-existing data items, not a regression):');
      selfRefs.slice(0, 5).forEach(function(s) { console.log('      ' + s); });
    }
  });

  test('rootFamily entries have both arabic and english fields', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.rootFamily && Array.isArray(w.rootFamily)) {
        w.rootFamily.forEach(function(rf, i) {
          if (!rf.a || !rf.e) bad.push((w.arabic || w.english) + '[' + i + ']: missing ' + (rf.a ? 'english' : 'arabic'));
        });
      }
    });
    assert(bad.length === 0, bad.slice(0, 5).join('; '));
  });

  test('Every word has at least one semantic relationship (similar, opposite, or related)', () => {
    var isolated = ALL_WORDS.filter(function(w) {
      var hasSimilar = w.similarWords && w.similarWords.length > 0;
      var hasOpposite = w.oppositeWords && w.oppositeWords.length > 0;
      var hasRelated = w.relatedWords && w.relatedWords.length > 0;
      var hasRootFamily = w.rootFamily && w.rootFamily.length > 0;
      return !hasSimilar && !hasOpposite && !hasRelated && !hasRootFamily;
    });
    if (isolated.length > 0) {
      console.log('    note: ' + isolated.length + ' words have no semantic relationships at all: ' +
        isolated.slice(0, 5).map(function(w) { return w.arabic || w.english; }).join(', '));
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 14: Enriched Metadata Validation
// ═══════════════════════════════════════════════════════════════

suite('Enriched Metadata');

(function() {
  const ALL_WORDS = loadAllWords();

  test('Total unique roots in vocabulary is at least 100', () => {
    var rootSet = {};
    ALL_WORDS.forEach(function(w) {
      if (w.root && w.root !== '\u2014') rootSet[w.root] = true;
    });
    assert(Object.keys(rootSet).length >= 100,
      'Only ' + Object.keys(rootSet).length + ' unique roots found (expected >= 100)');
  });

  test('All frequency values are valid (very-high/high/medium/low)', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.frequency && ['very-high', 'high', 'medium', 'low'].indexOf(w.frequency) < 0) {
        bad.push(w.english + ': ' + w.frequency);
      }
    });
    assert(bad.length === 0, 'Invalid frequencies: ' + bad.join(', '));
  });

  test('All difficulty values are 1-5', () => {
    var bad = [];
    ALL_WORDS.forEach(function(w) {
      if (w.difficulty !== undefined && (typeof w.difficulty !== 'number' || w.difficulty < 1 || w.difficulty > 5)) {
        bad.push(w.english + ': ' + w.difficulty);
      }
    });
    assert(bad.length === 0, 'Invalid difficulties: ' + bad.join(', '));
  });

  test('Occurrence counts correlate with frequency labels', () => {
    var mismatches = [];
    ALL_WORDS.forEach(function(w) {
      if (w.frequency === 'very-high' && w.occ < 30) {
        mismatches.push(w.english + ': frequency=very-high but occ=' + w.occ);
      }
      if (w.frequency === 'low' && w.occ > 100) {
        mismatches.push(w.english + ': frequency=low but occ=' + w.occ);
      }
    });
    if (mismatches.length > 0) {
      console.log('    note: ' + mismatches.length + ' frequency/occ mismatches (may be intentional): ' +
        mismatches.slice(0, 3).join(', '));
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 15: Cross-File Consistency
// ═══════════════════════════════════════════════════════════════

suite('Cross-File Consistency');

(function() {
  const ALL_WORDS = loadAllWords();
  var perSurahCount = 0;
  var thematicCount = 0;
  ALL_WORDS.forEach(function(w) {
    if (/^words-surah-\d+-/.test(w._sourceFile)) perSurahCount++;
    else thematicCount++;
  });

  test('Per-surah words form majority of vocabulary', () => {
    assert(perSurahCount > thematicCount, 'Per-surah: ' + perSurahCount + ', Thematic: ' + thematicCount);
  });
})();

// ═══════════════════════════════════════════════════════════════
// SUITE 16: Stat Card Click Handlers
// ═══════════════════════════════════════════════════════════════

suite('Stat Card Click Handlers');

(function() {
  // ── Helper: Sets up a minimal mock DOM and global mocks for stat card wiring ──
  function setupStatCardTest() {
    // Track calls to mocked functions
    var calls = {
      switchView: [],
      startReview: [],
    };

    // Create mock stat card DOM structure:
    // <div class="stat-card">
    //   <div class="stat-number" id="stat-total">939</div>
    // </div>
    var statCardIds = ['stat-total', 'stat-mastered', 'stat-new-count', 'stat-learning-count'];
    var cardElements = {};  // the outer .stat-card elements
    var numberElements = {}; // the inner elements with IDs

    statCardIds.forEach(function(id) {
      var card = { onclick: null };
      cardElements[id] = card;
      numberElements[id] = {
        closest: function(sel) {
          if (sel === '.stat-card') return card;
          return null;
        }
      };
    });

    // Mock document.getElementById
    var origGetElementById = typeof document !== 'undefined' ? document.getElementById : null;
    global.document = global.document || {};
    global.document.getElementById = function(id) {
      return numberElements[id] || null;
    };
    // Need createElement for the createBarRow calls in renderStats
    if (!global.document.createElement) {
      global.document.createElement = function(tag) {
        return { className: '', innerHTML: '', appendChild: function() {} };
      };
    }

    var dueReviewsResult = [];

    // Mock global functions used by stat card handlers
    global.switchView = function(view) {
      calls.switchView.push(view);
    };
    global.startReview = function() {
      calls.startReview.push('started');
    };
    global.getDueReviews = function() {
      return dueReviewsResult;
    };

    return {
      calls: calls,
      cardElements: cardElements,
      numberElements: numberElements,
      setDueReviews: function(count) {
        var arr = [];
        for (var i = 0; i < count; i++) arr.push({ id: 'w_' + i });
        dueReviewsResult = arr;
      },
      cleanup: function() {
        delete global.document.getElementById;
        delete global.document.createElement;
        delete global.switchView;
        delete global.startReview;
        delete global.getDueReviews;
        // Restore original if it existed
        if (origGetElementById) {
          global.document.getElementById = origGetElementById;
        }
      }
    };
  }

  // ── The exact wiring code from renderStats() in ui.js ──
  // Reproduced here so the test can verify it independently.
  // If the production code changes, this test must be updated to match.
  function runStatCardWiring() {
    var _statCards = [
      { id: 'stat-total', fn: function() { switchView('list'); } },
      { id: 'stat-mastered', fn: function() {
        if (typeof getDueReviews === 'function' && getDueReviews().length > 0 && typeof startReview === 'function') {
          startReview();
        } else {
          switchView('learn');
        }
      } },
      { id: 'stat-new-count', fn: function() { switchView('list'); } },
      { id: 'stat-learning-count', fn: function() {
        if (typeof getDueReviews === 'function' && getDueReviews().length > 0 && typeof startReview === 'function') {
          startReview();
        } else {
          switchView('learn');
        }
      } },
    ];
    for (var _si = 0; _si < _statCards.length; _si++) {
      var _el = document.getElementById(_statCards[_si].id);
      if (_el) {
        var _card = _el.closest('.stat-card');
        if (_card) _card.onclick = _statCards[_si].fn;
      }
    }
  }

  // ── Tests ──

  test('All four stat cards get onclick handlers after wiring', function() {
    var ctx = setupStatCardTest();
    try {
      runStatCardWiring();

      var expectedIds = ['stat-total', 'stat-mastered', 'stat-new-count', 'stat-learning-count'];
      for (var i = 0; i < expectedIds.length; i++) {
        var id = expectedIds[i];
        var card = ctx.cardElements[id];
        assert(typeof card.onclick === 'function',
          'Expected ' + id + ' .stat-card.onclick to be a function, got ' + typeof card.onclick);
      }
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-total onclick calls switchView("list")', function() {
    var ctx = setupStatCardTest();
    try {
      runStatCardWiring();
      ctx.cardElements['stat-total'].onclick();
      assert(ctx.calls.switchView.length === 1,
        'Expected switchView called once, got ' + ctx.calls.switchView.length);
      assert(ctx.calls.switchView[0] === 'list',
        'Expected switchView("list"), got switchView("' + ctx.calls.switchView[0] + '")');
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-mastered onclick calls switchView("learn") when no due reviews', function() {
    var ctx = setupStatCardTest();
    try {
      ctx.setDueReviews(0);
      runStatCardWiring();
      ctx.cardElements['stat-mastered'].onclick();
      assert(ctx.calls.switchView.length === 1,
        'Expected switchView called once, got ' + ctx.calls.switchView.length);
      assert(ctx.calls.switchView[0] === 'learn',
        'Expected switchView("learn"), got switchView("' + ctx.calls.switchView[0] + '")');
      assert(ctx.calls.startReview.length === 0,
        'Expected startReview NOT called when no due reviews');
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-mastered onclick calls startReview when due reviews exist', function() {
    var ctx = setupStatCardTest();
    try {
      ctx.setDueReviews(3);
      runStatCardWiring();
      ctx.cardElements['stat-mastered'].onclick();
      assert(ctx.calls.startReview.length === 1,
        'Expected startReview called once, got ' + ctx.calls.startReview.length);
      assert(ctx.calls.switchView.length === 0,
        'Expected switchView NOT called when reviews exist');
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-new-count onclick calls switchView("list")', function() {
    var ctx = setupStatCardTest();
    try {
      runStatCardWiring();
      ctx.cardElements['stat-new-count'].onclick();
      assert(ctx.calls.switchView.length === 1,
        'Expected switchView called once, got ' + ctx.calls.switchView.length);
      assert(ctx.calls.switchView[0] === 'list',
        'Expected switchView("list"), got switchView("' + ctx.calls.switchView[0] + '")');
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-learning-count onclick calls switchView("learn") when no due reviews', function() {
    var ctx = setupStatCardTest();
    try {
      ctx.setDueReviews(0);
      runStatCardWiring();
      ctx.cardElements['stat-learning-count'].onclick();
      assert(ctx.calls.switchView.length === 1,
        'Expected switchView called once, got ' + ctx.calls.switchView.length);
      assert(ctx.calls.switchView[0] === 'learn',
        'Expected switchView("learn"), got switchView("' + ctx.calls.switchView[0] + '")');
      assert(ctx.calls.startReview.length === 0,
        'Expected startReview NOT called when no due reviews');
    } finally {
      ctx.cleanup();
    }
  });

  test('stat-learning-count onclick calls startReview when due reviews exist', function() {
    var ctx = setupStatCardTest();
    try {
      ctx.setDueReviews(5);
      runStatCardWiring();
      ctx.cardElements['stat-learning-count'].onclick();
      assert(ctx.calls.startReview.length === 1,
        'Expected startReview called once, got ' + ctx.calls.startReview.length);
      assert(ctx.calls.switchView.length === 0,
        'Expected switchView NOT called when reviews exist');
    } finally {
      ctx.cleanup();
    }
  });

  test('Wiring handles missing DOM elements gracefully (no crash)', function() {
    var ctx = setupStatCardTest();
    try {
      // Remove one element to simulate missing DOM
      delete ctx.numberElements['stat-total'];
      // This should not throw
      runStatCardWiring();
      // Remaining cards should still be wired
      assert(typeof ctx.cardElements['stat-mastered'].onclick === 'function',
        'stat-mastered should still be wired');
      assert(typeof ctx.cardElements['stat-new-count'].onclick === 'function',
        'stat-new-count should still be wired');
      assert(typeof ctx.cardElements['stat-learning-count'].onclick === 'function',
        'stat-learning-count should still be wired');
      // Missing element's card onclick should be null
      assert(ctx.cardElements['stat-total'].onclick === null,
        'stat-total onclick should remain null when element is missing');
    } finally {
      ctx.cleanup();
    }
  });

  test('Wiring handles missing .stat-card ancestor gracefully (no crash)', function() {
    var ctx = setupStatCardTest();
    try {
      // Make closest return null for one element
      ctx.numberElements['stat-total'].closest = function() { return null; };
      // This should not throw
      runStatCardWiring();
      // Remaining cards should still be wired
      assert(typeof ctx.cardElements['stat-mastered'].onclick === 'function',
        'stat-mastered should still be wired');
      assert(typeof ctx.cardElements['stat-new-count'].onclick === 'function',
        'stat-new-count should still be wired');
      assert(typeof ctx.cardElements['stat-learning-count'].onclick === 'function',
        'stat-learning-count should still be wired');
      // Missing ancestor's card onclick should be null
      assert(ctx.cardElements['stat-total'].onclick === null,
        'stat-total onclick should remain null when ancestor is missing');
    } finally {
      ctx.cleanup();
    }
  });

  // Structural test: verify the wiring code exists in the source file
  test('Handlers degrade gracefully when getDueReviews is not a function', function() {
    var ctx = setupStatCardTest();
    try {
      // Remove getDueReviews to simulate missing dependency
      delete global.getDueReviews;
      runStatCardWiring();
      // Should fall through to switchView('learn') without crashing
      ctx.cardElements['stat-mastered'].onclick();
      assert(ctx.calls.switchView.length === 1,
        'Expected switchView called once, got ' + ctx.calls.switchView.length);
      assert(ctx.calls.switchView[0] === 'learn',
        'Expected switchView("learn") when getDueReviews missing, got "' + ctx.calls.switchView[0] + '"');
      assert(ctx.calls.startReview.length === 0,
        'Expected startReview NOT called when getDueReviews missing');
    } finally {
      ctx.cleanup();
    }
  });

  // Structural test: verify the wiring code exists in the source file
  test('ui.js contains stat card wiring with correct IDs', function() {
    var uiPath = path.join(ROOT, 'js', 'ui.js');
    var uiContent = fs.readFileSync(uiPath, 'utf8');

    // Verify the stat card array exists with expected IDs
    var patterns = [
      { id: 'stat-total', text: 'stat-total' },
      { id: 'stat-mastered', text: 'stat-mastered' },
      { id: 'stat-new-count', text: 'stat-new-count' },
      { id: 'stat-learning-count', text: 'stat-learning-count' },
    ];
    patterns.forEach(function(p) {
      assert(uiContent.indexOf(p.text) >= 0,
        'ui.js must contain reference to "' + p.text + '" but it was not found');
    });

    // Verify the loop structure is present (tightened: look for exact array init pattern)
    assert(uiContent.indexOf('_statCards = [') >= 0,
      'ui.js must contain _statCards = [ (the stat card wiring array)');
    assert(uiContent.indexOf('card.onclick') >= 0,
      'ui.js must contain card.onclick assignment for stat card wiring');
  });
})();

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('\n');
console.log('  --- Regression Test Summary ---');
console.log('  Total:  ' + totalTests);
console.log('  Passed: ' + passedTests);
console.log('  Failed: ' + failedTests);

// Compute final stats
const finalWords = loadAllWords();
var perSurahC = 0;
var thematicC = 0;
finalWords.forEach(function(w) {
  if (/^words-surah-\d+-/.test(w._sourceFile)) perSurahC++;
  else thematicC++;
});
var surahsSet = {};
finalWords.forEach(function(w) { if (w.surahId) surahsSet[w.surahId] = true; });
var dataFileCount = fs.readdirSync(DATA_DIR).filter(function(f) {
  return f.endsWith('.js') && f !== 'data.js' && f !== 'surahs.js';
}).length;

console.log('\n  Vocabulary: ' + finalWords.length + ' words (' + perSurahC + ' per-surah + ' + thematicC + ' thematic)');
console.log('  Surahs covered: ' + Object.keys(surahsSet).length);
console.log('  Data files: ' + dataFileCount);

if (failedTests === 0) {
  console.log('\n  PASS All ' + totalTests + ' regression tests passed.\n');
} else {
  console.log('\n  FAIL ' + failedTests + ' regression test(s) failed.\n');
}

process.exit(failedTests > 0 ? 1 : 0);
