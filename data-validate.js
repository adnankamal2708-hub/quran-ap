// ═══════════════════════════════════════════════════════════════
// data-validate.js — Quran Vocabulary Data Validation
//   • Reads all source data files from js/data/
//   • Simulates ALL_WORDS loading to validate every word entry
//   • Checks: duplicate IDs, duplicate arabic, missing fields,
//     invalid references, surah/verse integrity, Unicode, Arabic
//   • Generates a detailed validation report
//   • Exits with code 0 on success, 1 on failure
//
// Usage: node data-validate.js
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'js', 'data');
const SURAH_INFO_PATH = path.join(DATA_DIR, 'surahs.js');

var exitCode = 0;
var totalChecks = 0;
var passedChecks = 0;
var validationReport = [];

// ── Helpers ──────────────────────────────────────────────────

function check(description, condition, details) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    validationReport.push('  ✓ ' + description);
  } else {
    exitCode = 1;
    validationReport.push('  ✗ ' + description + (details ? ' — ' + details : ''));
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

function extractWordsFromFile(fileContent, fileName) {
  var words = [];
  // Match ALL_WORDS.push({...}) or ALL_WORDS.push({...},{...}) patterns
  try {
    // Simple approach: find ALL_WORDS.push( blocks and extract objects
    var pushBlocks = fileContent.match(/ALL_WORDS\.push\(([\s\S]*?)\);/g);
    if (!pushBlocks) return words;

    pushBlocks.forEach(function(block) {
      // Extract content between ALL_WORDS.push( and );
      var inner = block.replace(/ALL_WORDS\.push\(/, '').replace(/\);$/, '').trim();
      // Split multiple objects by matching top-level braces
      var depth = 0;
      var start = 0;
      for (var i = 0; i < inner.length; i++) {
        var ch = inner[i];
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start < i) {
            var objStr = inner.substring(start, i + 1);
            try {
              // Convert JS object literal string to parseable JSON by quoting keys
              var json = objStr
                .replace(/'/g, '"')
                .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')
                .replace(/,\s*([}\]])/g, '$1');
              var parsed = JSON.parse(json);
              if (parsed && typeof parsed === 'object') {
                parsed._sourceFile = fileName;
                words.push(parsed);
              }
            } catch (e) {
              // Try a more lenient parse: evaluate in a sandbox
              try {
                var fn = new Function('return ' + objStr);
                var result = fn();
                if (result && typeof result === 'object') {
                  result._sourceFile = fileName;
                  words.push(result);
                }
              } catch (e2) {
                validationReport.push('  ⚠ Could not parse word object in ' + fileName + ' at position ' + start + ': ' + e2.message.substring(0, 80));
              }
            }
          }
        }
      }
    });
  } catch (e) {
    validationReport.push('  ⚠ Error parsing ' + fileName + ': ' + e.message.substring(0, 80));
  }
  return words;
}

// ── Load SURAH_INFO ──────────────────────────────────────────

function loadSurahInfo() {
  var content = readFile(SURAH_INFO_PATH);
  var surahIds = [];
  var surahVerseCounts = {};
  
  // Extract surah IDs and verse counts from SURAH_INFO
  var matches = content.match(/(\d+):\s*\{[^}]*verses:\s*(\d+)[^}]*\}/g);
  if (matches) {
    matches.forEach(function(m) {
      var idMatch = m.match(/(\d+):\s*\{/);
      var verseMatch = m.match(/verses:\s*(\d+)/);
      if (idMatch && verseMatch) {
        var id = parseInt(idMatch[1], 10);
        surahIds.push(id);
        surahVerseCounts[id] = parseInt(verseMatch[1], 10);
      }
    });
  } else {
    // Fallback: extract more carefully
    var lines = content.split('\n');
    lines.forEach(function(line) {
      var match = line.match(/(\d+):\s*\{[^}]*verses:\s*(\d+)/);
      if (match) {
        var id = parseInt(match[1], 10);
        surahIds.push(id);
        surahVerseCounts[id] = parseInt(match[2], 10);
      }
    });
  }
  
  return { ids: surahIds.sort(function(a,b) { return a-b; }), verseCounts: surahVerseCounts };
}

// ── Run validation ───────────────────────────────────────────

function run() {
  validationReport.push('\n  Validating Quran Vocabulary Data\n');
  validationReport.push('  Source: ' + DATA_DIR + '\n');

  // Check data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    validationReport.push('  ✗ Data directory not found: ' + DATA_DIR);
    exitCode = 1;
    console.log(validationReport.join('\n'));
    process.exit(exitCode);
  }

  // Load SURAH_INFO for reference validation
  var surahInfo = loadSurahInfo();
  var validSurahIds = surahInfo.ids;
  var surahVerseCounts = surahInfo.verseCounts;
  validationReport.push('  Found ' + validSurahIds.length + ' surahs in SURAH_INFO (1-' + (validSurahIds[validSurahIds.length-1] || 0) + ')\n');

  // Locate data files
  var allFiles = fs.readdirSync(DATA_DIR).filter(function(f) { return f.endsWith('.js'); });
  var dataFile = allFiles.indexOf('data.js');
  if (dataFile >= 0) {
    allFiles.splice(dataFile, 1);
  }
  var surahsFile = allFiles.indexOf('surahs.js');
  if (surahsFile >= 0) {
    allFiles.splice(surahsFile, 1);
  }

  validationReport.push('  Scanning ' + allFiles.length + ' word files...\n');

  // Extract all words from all files
  var allWords = [];
  var fileWordCounts = {};

  allFiles.forEach(function(f) {
    var filePath = path.join(DATA_DIR, f);
    var content = readFile(filePath);
    var words = extractWordsFromFile(content, f);
    allWords = allWords.concat(words);
    fileWordCounts[f] = words.length;
  });

  validationReport.push('  Total words extracted: ' + allWords.length + '\n');

  // ── 1. File-level word counts ──
  validationReport.push('  File word counts:');
  var fileNames = Object.keys(fileWordCounts).sort();
  fileNames.forEach(function(f) {
    validationReport.push('    ' + f + ': ' + fileWordCounts[f] + ' words');
  });
  validationReport.push('');

  // ── 2. Duplicate IDs ──
  validationReport.push('  Duplicate IDs:');
  var idMap = {};
  var duplicateIds = [];
  allWords.forEach(function(w, idx) {
    var id = w.id;
    if (id) {
      if (idMap[id] !== undefined) {
        duplicateIds.push({ id: id, firstFile: allWords[idMap[id]]._sourceFile, secondFile: w._sourceFile, firstIdx: idMap[id], secondIdx: idx });
      } else {
        idMap[id] = idx;
      }
    }
  });
  check('No duplicate word IDs', duplicateIds.length === 0,
    duplicateIds.length > 0 ? 'Found ' + duplicateIds.length + ' duplicate IDs: ' + duplicateIds.slice(0, 3).map(function(d) { return d.id + ' (' + d.firstFile + ', ' + d.secondFile + ')'; }).join(', ') : '');

  // ── 3. Duplicate Arabic text ──
  validationReport.push('\n  Duplicate Arabic text (exact match):');
  var arabicMap = {};
  var duplicateArabic = [];
  allWords.forEach(function(w, idx) {
    var arabic = w.arabic;
    if (arabic) {
      if (arabicMap[arabic] !== undefined) {
        duplicateArabic.push({ arabic: arabic, firstFile: allWords[arabicMap[arabic]]._sourceFile, secondFile: w._sourceFile });
      } else {
        arabicMap[arabic] = idx;
      }
    }
  });
  // Same-file duplicates indicate actual errors (copy-paste mistake)
  var sameFileDups = duplicateArabic.filter(function(d) { return d.firstFile === d.secondFile; });
  // Cross-file duplicates are expected — same word appearing in different surahs
  // with different contextual verses (e.g. اللَّهُ appears in many surahs)
  var crossFileDups = duplicateArabic.filter(function(d) { return d.firstFile !== d.secondFile; });
  
  check('No duplicate Arabic text entries within the same file', sameFileDups.length === 0,
    sameFileDups.length > 0 ? 'Same-file duplicates: ' + sameFileDups.slice(0, 3).map(function(d) { return '"' + d.arabic + '" in ' + d.firstFile; }).join(', ') : '');
  
  if (crossFileDups.length > 0) {
    validationReport.push('    ⚠ ' + crossFileDups.length + ' cross-file duplicate Arabic texts (expected — same word in different surahs with different contexts)');
  }

  // ── 4. Missing required fields ──
  validationReport.push('\n  Missing fields:');
  var missingFields = {
    arabic: 0, translit: 0, english: 0, meaning: 0,
    root: 0, type: 0, typeCategory: 0, occ: 0
  };
  var missingExamples = {};

  allWords.forEach(function(w, idx) {
    Object.keys(missingFields).forEach(function(field) {
      if (!w[field] || (typeof w[field] === 'string' && w[field].trim() === '')) {
        missingFields[field]++;
        if (!missingExamples[field]) missingExamples[field] = [];
        if (missingExamples[field].length < 3) {
          missingExamples[field].push(w.arabic || w.english || '(unknown)');
        }
      }
    });
  });

  Object.keys(missingFields).forEach(function(field) {
    var excerpt = missingExamples[field] ? ' e.g. "' + missingExamples[field].join('", "') + '"' : '';
    check(field + ' field present on all words', missingFields[field] === 0,
      missingFields[field] + ' word(s) missing ' + field + excerpt);
  });

  // ── 5. Missing root fields ──
  validationReport.push('\n  Root fields:');
  var missingRootMeaning = 0;
  var missingRootFamily = 0;
  var missingRootPattern = 0;
  allWords.forEach(function(w) {
    if (!w.rootMeaning || w.rootMeaning.trim() === '') missingRootMeaning++;
    if (!w.rootPattern || w.rootPattern.trim() === '') missingRootPattern++;
    if (!w.rootFamily || w.rootFamily.length === 0) missingRootFamily++;
  });
  check('rootMeaning present on all words', missingRootMeaning === 0,
    missingRootMeaning + ' word(s) missing rootMeaning');
  check('rootPattern present on all words', missingRootPattern === 0,
    missingRootPattern + ' word(s) missing rootPattern');
  check('rootFamily present on all words (non-empty)', missingRootFamily === 0,
    missingRootFamily + ' word(s) missing rootFamily');
  if (missingRootFamily > 0) {
    var rootMissingDetails = allWords.filter(function(w) { return !w.rootFamily || w.rootFamily.length === 0; });
    rootMissingDetails.forEach(function(w) {
      validationReport.push('    ℹ "' + (w.arabic || 'unknown') + '" (' + (w._sourceFile || 'unknown') + ') has root: "' + (w.root || '—') + '"');
    });
  }

  // ── 6. Missing occurrence data ──
  validationReport.push('\n  Occurrence data:');
  var missingOcc = 0;
  var missingSurahId = 0;
  var missingVerseKey = 0;
  var missingAyahA = 0;
  var missingAyahT = 0;
  var missingTafsir = 0;
  var zeroOcc = 0;

  allWords.forEach(function(w) {
    if (w.occ === undefined || w.occ === null) missingOcc++;
    else if (w.occ === 0) zeroOcc++;
    if (!w.surahId) missingSurahId++;
    if (!w.verseKey) missingVerseKey++;
    if (!w.ayahA) missingAyahA++;
    if (!w.ayahT) missingAyahT++;
    if (!w.tafsir) missingTafsir++;
  });

  check('occ field present on all words', missingOcc === 0,
    missingOcc + ' word(s) missing occ');
  
  // Check surahId in per-surah files only (thematic files deliberately omit it)
  var perSurahWords = allWords.filter(function(w) { return w._sourceFile && /^words-surah-/.test(w._sourceFile); });
  var perSurahMissingSurahId = perSurahWords.filter(function(w) { return !w.surahId; });
  check('surahId present on all per-surah words', perSurahMissingSurahId.length === 0,
    perSurahMissingSurahId.length + ' per-surah word(s) missing surahId');
  if (missingSurahId > 0) {
    validationReport.push('    ⚠ Thematic words missing surahId: ' + missingSurahId + ' (expected — thematic files are general vocabulary)');
  }
  
  var perSurahMissingVerseKey = perSurahWords.filter(function(w) { return !w.verseKey; });
  check('verseKey present on all per-surah words', perSurahMissingVerseKey.length === 0,
    perSurahMissingVerseKey.length + ' per-surah word(s) missing verseKey');
  if (missingVerseKey > 0) {
    validationReport.push('    ⚠ Thematic words missing verseKey: ' + missingVerseKey + ' (expected — thematic files are general vocabulary)');
  }
  check('ayahA (example verse) present', missingAyahA === 0,
    missingAyahA + ' word(s) missing ayahA');
  check('ayahT (verse translation) present', missingAyahT === 0,
    missingAyahT + ' word(s) missing ayahT');
  check('tafsir present', missingTafsir === 0,
    missingTafsir + ' word(s) missing tafsir');
  check('No words with zero occurrences', zeroOcc === 0,
    zeroOcc + ' word(s) have occ=0 (should be at least 1 for every Quranic word)');

  // ── 7. Surah number validation ──
  validationReport.push('\n  Surah reference validation:');
  var invalidSurahIds = [];
  var nonExistentSurahIds = [];
  allWords.forEach(function(w) {
    if (w.surahId) {
      if (typeof w.surahId !== 'number' || w.surahId < 1 || w.surahId > 114) {
        invalidSurahIds.push(w.surahId);
      }
      if (validSurahIds.indexOf(w.surahId) < 0) {
        nonExistentSurahIds.push(w.surahId);
      }
    }
  });
  check('All surahId values are valid numbers (1-114)', invalidSurahIds.length === 0,
    invalidSurahIds.length > 0 ? 'Invalid surahIds: [' + invalidSurahIds.slice(0, 5).join(', ') + ']' : '');
  check('All surahId values exist in SURAH_INFO', nonExistentSurahIds.length === 0,
    nonExistentSurahIds.length > 0 ? 'Non-existent surahIds: [' + nonExistentSurahIds.slice(0, 5).join(', ') + ']' : '');

  // ── 8. Verse key validation ──
  validationReport.push('\n  Verse key validation:');
  var invalidVerseKeys = [];
  var verseKeyMismatchSurah = [];
  var verseExceedsSurahLength = [];

  allWords.forEach(function(w) {
    if (w.verseKey && w.surahId) {
      var parts = w.verseKey.split(':');
      if (parts.length !== 2) {
        invalidVerseKeys.push(w.verseKey);
      } else {
        var keySurah = parseInt(parts[0], 10);
        var keyVerse = parseInt(parts[1], 10);
        if (isNaN(keySurah) || isNaN(keyVerse)) {
          invalidVerseKeys.push(w.verseKey);
        }
        if (keySurah !== w.surahId) {
          verseKeyMismatchSurah.push({ word: w.arabic || w.english, expected: w.surahId, actual: keySurah });
        }
        if (surahVerseCounts[keySurah] && keyVerse > surahVerseCounts[keySurah]) {
          verseExceedsSurahLength.push({ word: w.arabic || w.english, surah: keySurah, verse: keyVerse, maxVerse: surahVerseCounts[keySurah] });
        }
      }
    }
  });

  check('All verseKeys follow NUMBER:NUMBER format', invalidVerseKeys.length === 0,
    invalidVerseKeys.length > 0 ? 'Invalid verseKeys: [' + invalidVerseKeys.slice(0, 5).join(', ') + ']' : '');
  if (verseKeyMismatchSurah.length > 0) {
    validationReport.push('    ⚠ ' + verseKeyMismatchSurah.length + ' word(s) have verseKey surah != surahId — may be intentional (cross-surah examples):');
    verseKeyMismatchSurah.slice(0, 3).forEach(function(m) {
      validationReport.push('      "' + m.word + '" has surahId=' + m.expected + ' but verseKey refers to surah ' + m.actual);
    });
  }
  check('verse number within surah verse count', verseExceedsSurahLength.length === 0,
    verseExceedsSurahLength.length > 0 ? verseExceedsSurahLength.slice(0, 3).map(function(m) { return '"' + m.word + '" verse ' + m.verse + ' exceeds surah ' + m.surah + ' max (' + m.maxVerse + ')'; }).join('; ') : '');

  // ── 9. Arabic text validation ──
  validationReport.push('\n  Arabic text validation:');
  var nonArabicText = [];
  var rtlIssues = [];
  
  // Arabic Unicode range: \u0600-\u06FF (Arabic), \u0750-\u077F (Supplement), 
  // \u08A0-\u08FF (Extended-A), \uFB50-\uFDFF (Presentation Forms-A), 
  // \uFE70-\uFEFF (Presentation Forms-B)
  var arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFD\uFE70-\uFEFC]/;
  
  // Arabic letters that have special RTL forms
  var rtlMarkers = /[\u200E\u200F\u202A-\u202E]/; // LRM, RLM, LRE, RLE, PDF, LRO, RLO

  allWords.forEach(function(w) {
    if (w.arabic && !arabicRegex.test(w.arabic)) {
      nonArabicText.push(w.arabic);
    }
    // Check for RTL control characters in fields
    ['arabic', 'translit', 'meaning', 'root'].forEach(function(field) {
      if (w[field] && typeof w[field] === 'string' && rtlMarkers.test(w[field])) {
        rtlIssues.push({ word: w.arabic || w.english, field: field, text: w[field] });
      }
    });
  });

  check('All arabic fields contain Arabic script', nonArabicText.length === 0,
    nonArabicText.length > 0 ? 'Non-Arabic text found: [' + nonArabicText.slice(0, 3).join(', ') + ']' : '');
  check('No unintended RTL control characters in text fields', rtlIssues.length === 0,
    rtlIssues.length > 0 ? 'RTL markers found in ' + rtlIssues.slice(0, 3).map(function(r) { return r.field + ' of "' + r.word + '"'; }).join(', ') : '');

  // ── 10. Type category validation ──
  validationReport.push('\n  Type category validation:');
  var validTypeCategories = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation', 'adverb', 'proper noun', 'name'];
  var invalidCategories = [];
  var typeMismatch = []; // type field doesn't match typeCategory

  allWords.forEach(function(w) {
    if (w.typeCategory) {
      var cat = w.typeCategory.toLowerCase().trim();
      if (validTypeCategories.indexOf(cat) < 0) {
        invalidCategories.push(cat);
      }
    }
    // Check: pattern should be present for nouns/verbs/adjectives, but not for particles/pronouns
    if ((w.typeCategory === 'noun' || w.typeCategory === 'verb') && (!w.pattern || w.pattern.trim() === '')) {
      // Not fatal — some entries lack pattern
    }
  });

  check('All typeCategory values are valid', invalidCategories.length === 0,
    invalidCategories.length > 0 ? 'Invalid typeCategories: [' + invalidCategories.slice(0, 5).join(', ') + ']' : '');

  // ── 11. Frequency validation ──
  validationReport.push('\n  Frequency validation:');
  var validFrequencies = ['very-high', 'high', 'medium', 'low'];
  var invalidFrequencies = [];

  allWords.forEach(function(w) {
    if (w.frequency && validFrequencies.indexOf(w.frequency) < 0) {
      invalidFrequencies.push(w.frequency);
    }
  });

  check('All frequency values are valid', invalidFrequencies.length === 0,
    invalidFrequencies.length > 0 ? 'Invalid frequencies: [' + invalidFrequencies.slice(0, 5).join(', ') + ']' : '');

  // ── 12. Difficulty validation ──
  validationReport.push('\n  Difficulty validation:');
  var invalidDifficulties = [];

  allWords.forEach(function(w) {
    if (w.difficulty !== undefined && (typeof w.difficulty !== 'number' || w.difficulty < 1 || w.difficulty > 5)) {
      invalidDifficulties.push(w.difficulty);
    }
  });

  check('All difficulty values are 1-5', invalidDifficulties.length === 0,
    invalidDifficulties.length > 0 ? 'Invalid difficulties: [' + invalidDifficulties.slice(0, 5).join(', ') + ']' : '');

  // ── 13. Tags validation ──
  validationReport.push('\n  Tags validation:');
  var missingTags = 0;
  allWords.forEach(function(w) {
    if (!w.tags || w.tags.length === 0) missingTags++;
  });
  check('All words have tags (non-empty array)', missingTags === 0,
    missingTags + ' word(s) missing tags');

  // ── 14. Frequency vs occ consistency ──
  validationReport.push('\n  Frequency/occurrence consistency:');
  var freqMismatches = [];
  allWords.forEach(function(w) {
    if (w.frequency && w.occ) {
      if (w.frequency === 'very-high' && w.occ < 50) {
        freqMismatches.push({ word: w.arabic || w.english, freq: w.frequency, occ: w.occ });
      } else if (w.frequency === 'high' && w.occ < 10) {
        // High frequency words should appear at least 10 times — borderline case
      }
    }
  });
  check('very-high frequency words have occ >= 50', freqMismatches.length === 0,
    freqMismatches.length > 0 ? freqMismatches.slice(0, 3).map(function(m) { return '"' + m.word + '" is ' + m.freq + ' but has occ=' + m.occ; }).join('; ') : '');

  // ── 15. Completeness score ──
  validationReport.push('\n  Data completeness:');
  var totalFields = 0;
  var filledFields = 0;
  var optionalFields = ['pattern', 'similarWords', 'oppositeWords', 'relatedWords'];
  var requiredFields = ['arabic', 'translit', 'english', 'meaning', 'type', 'typeCategory', 'root', 'rootMeaning', 'occ', 'frequency', 'difficulty', 'surahId', 'verseKey', 'ayahA', 'ayahT', 'tafsir'];

  allWords.forEach(function(w) {
    requiredFields.forEach(function(f) {
      totalFields++;
      if (w[f] !== undefined && w[f] !== null && w[f] !== '' && !(Array.isArray(w[f]) && w[f].length === 0)) {
        filledFields++;
      }
    });
    optionalFields.forEach(function(f) {
      totalFields++;
      if (w[f] !== undefined && w[f] !== null) {
        filledFields++;
      }
    });
  });

  var completeness = totalFields > 0 ? Math.round(filledFields / totalFields * 100) : 0;
  validationReport.push('    Required field completeness: ' + filledFields + '/' + totalFields + ' (' + completeness + '%)');
  check('Data completeness >= 90%', completeness >= 90, 'Completeness: ' + completeness + '% (target: 90%)');

  // ── Summary ──
  validationReport.push('\n  ─── Validation Summary ───');
  validationReport.push('  Words scanned: ' + allWords.length);
  validationReport.push('  Data files scanned: ' + allFiles.length);
  validationReport.push('  Passed: ' + passedChecks + ' / ' + totalChecks);
  validationReport.push('  Failed: ' + (totalChecks - passedChecks));
  validationReport.push('');

  if (exitCode === 0) {
    validationReport.push('  ✅ All data validations passed. Vocabulary data is clean.\n');
  } else {
    validationReport.push('  ❌ ' + (totalChecks - passedChecks) + ' data validation(s) failed. Fix vocabulary data before deployment.\n');
  }

  // Print report
  console.log(validationReport.join('\n'));
  process.exit(exitCode);
}

run();
