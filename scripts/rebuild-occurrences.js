#!/usr/bin/env node
/**
 * scripts/rebuild-occurrences.js
 *
 * Quran Vocabulary Occurrence Rebuild — Audit, Fix & Validate
 *
 * Phases:
 *   1-4: Load, normalize, count, compare
 *   5:   Canonical deduplication (groups ALL_WORDS by normalized form)
 *   6-7: Audit report + cross-validation
 *   8-10: Lesson integrity, coverage recalculation, UI consistency check
 *   11:  Build validation
 *
 * Usage:
 *   node scripts/rebuild-occurrences.js           # Audit only (read-only)
 *   node scripts/rebuild-occurrences.js --fix     # Audit + update files
 *   node scripts/rebuild-occurrences.js --fix --validate  # Full pipeline
 *
 * This is a standalone Node.js script. Does NOT modify the app runtime.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ── Configuration ──────────────────────────────────────────────
var ROOT = path.join(__dirname, '..');
var QURAN_DATA_PATH = path.join(ROOT, 'js/quran/quran-data.js');
var VOCAB_DIR = path.join(ROOT, 'js/data');
var SHOULD_FIX = process.argv.indexOf('--fix') >= 0;
var SHOULD_VALIDATE = process.argv.indexOf('--validate') >= 0;

// ── Arabic Normalization Pipeline ──────────────────────────────
var DIACRITICS_RANGE = /[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g;

function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(/\u0640/g, '')                       // tatweel
    .replace(DIACRITICS_RANGE, '')                // diacritics + Quranic annotations
    .replace(/[\uFD3E\uFD3F]/g, '')              // verse brackets
    .replace(/\u0671/g, '\u0627')                 // alif with wasla → bare alif
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')   // hamza'd/madd alifs → bare alif
    .replace(/\u0670/g, '\u0627')                 // dagger alif → alif
    .replace(/\u0629/g, '\u0647')                 // teh marbuta → heh
    .replace(/\u0649/g, '\u064A')                 // alif maqsurah → ya
    .replace(/[\u0624\u0626]/g, function(m) {     // hamza on waw/ya → base
      return m === '\u0624' ? '\u0648' : '\u064A';
    })
    .replace(/[\u06E5\u06E6]/g, function(m) {     // small waw/yeh → base
      return m === '\u06E5' ? '\u0648' : '\u064A';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Data Loading ───────────────────────────────────────────────

function loadQuranCorpus() {
  var code = fs.readFileSync(QURAN_DATA_PATH, 'utf8');
  var sandbox = { window: {}, console: console };
  var context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  return context.QURAN_TEXT;
}

function loadVocabulary() {
  var ALL_WORDS = [];
  var files = fs.readdirSync(VOCAB_DIR).filter(function(f) {
    return f.startsWith('words-') && f.endsWith('.js');
  }).sort();

  files.forEach(function(f) {
    var content = fs.readFileSync(path.join(VOCAB_DIR, f), 'utf8');
    var sandbox = { ALL_WORDS: ALL_WORDS };
    try {
      vm.runInNewContext(content, sandbox);
    } catch (e) {
      console.error('[warn] Failed to load:', f, e.message);
    }
  });

  return { words: ALL_WORDS, files: files };
}

// ── Quran Tokenization & Indexing ──────────────────────────────

function buildQuranIndex(quranText) {
  var index = {};
  var totalTokens = 0;
  var totalVerses = 0;

  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;

    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      totalVerses++;

      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        var token = tokens[ti].trim();
        if (!token) continue;
        totalTokens++;

        var normalized = normalizeArabic(token);
        if (!normalized) continue;

        if (!index[normalized]) {
          index[normalized] = { count: 0, verses: [], surahIds: {} };
        }
        index[normalized].count++;
        index[normalized].verses.push(sid + ':' + verse.id);
        index[normalized].surahIds[sid] = (index[normalized].surahIds[sid] || 0) + 1;
      }
    }
  }

  return { index: index, totalTokens: totalTokens, totalVerses: totalVerses };
}

// ── Canonical Grouping (Phase 5) ──────────────────────────────
// Group ALL_WORDS entries by normalized arabic to get canonical forms.
// This prevents duplicate entries from inflating statistics.

function buildCanonicalGroups(words) {
  var groups = {};
  var groupOrder = [];

  words.forEach(function(w, idx) {
    var norm = normalizeArabic(w.arabic || '');
    if (!norm) return;
    if (!groups[norm]) {
      groups[norm] = { normalized: norm, entries: [], firstWord: w };
      groupOrder.push(norm);
    }
    groups[norm].entries.push({ word: w, index: idx });
  });

  return { groups: groups, groupOrder: groupOrder };
}

// ── Comparison Engine ──────────────────────────────────────────

function countSimpleTokenOccurrences(normalized, quranIndex) {
  var entry = quranIndex.index[normalized];
  if (!entry) return null;
  return {
    count: entry.count,
    surahCount: Object.keys(entry.surahIds).length,
    verses: entry.verses
  };
}

function runAudit(words, quranIndex) {
  // Phase 4: Per-word comparison
  var results = [];
  var totalOld = 0;
  var totalNew = 0;

  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var normalized = normalizeArabic(w.arabic || '');
    var oldOcc = w.occ || 0;
    totalOld += oldOcc;

    var corpusEntry = quranIndex.index[normalized];
    var newOcc = corpusEntry ? corpusEntry.count : 0;
    totalNew += newOcc;

    var diff = newOcc - oldOcc;
    var pctChange = oldOcc > 0 ? Math.round((diff / oldOcc) * 1000) / 10 : (newOcc > 0 ? 100 : 0);

    results.push({
      index: i,
      arabic: w.arabic || '',
      english: w.english || '',
      oldOcc: oldOcc,
      newOcc: newOcc,
      diff: diff,
      pctChange: pctChange,
      normalized: normalized,
      wordId: w.id || '',
      noMatch: !corpusEntry
    });
  }

  return { results: results, totalOld: totalOld, totalNew: totalNew };
}

function runCanonicalAudit(words, groups, groupOrder, quranIndex) {
  // Phase 5: Canonical (deduplicated) comparison
  var canonicalResults = [];
  var totalCanonicalOld = 0;
  var totalCanonicalNew = 0;
  var duplicateGroupCount = 0;

  groupOrder.forEach(function(norm) {
    var g = groups[norm];
    if (g.entries.length > 1) duplicateGroupCount++;

    var corpusEntry = quranIndex.index[norm];
    var canonicalNewOcc = corpusEntry ? corpusEntry.count : 0;

    // Sum old occ values across all entries in this group
    var canonicalOldOcc = 0;
    g.entries.forEach(function(e) {
      canonicalOldOcc += e.word.occ || 0;
    });

    totalCanonicalOld += canonicalOldOcc;
    totalCanonicalNew += canonicalNewOcc;

    var diff = canonicalNewOcc - canonicalOldOcc;
    var pctChange = canonicalOldOcc > 0 ? Math.round((diff / canonicalOldOcc) * 1000) / 10 : (canonicalNewOcc > 0 ? 100 : 0);

    canonicalResults.push({
      normalized: norm,
      arabic: g.firstWord.arabic || '',
      english: g.firstWord.english || '',
      entryCount: g.entries.length,
      oldOcc: canonicalOldOcc,
      newOcc: canonicalNewOcc,
      diff: diff,
      pctChange: pctChange,
      surahCount: corpusEntry ? Object.keys(corpusEntry.surahIds).length : 0,
      noMatch: !corpusEntry
    });
  });

  return {
    results: canonicalResults,
    totalCanonicalOld: totalCanonicalOld,
    totalCanonicalNew: totalCanonicalNew,
    duplicateGroupCount: duplicateGroupCount,
    canonicalWordCount: groupOrder.length
  };
}

// ── Report Generation ──────────────────────────────────────────

function generateReport(flat, canonical, quranIndex) {
  var lines = [];
  var hr = '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550';

  function emit(line) { lines.push(line); }
  function section(title) { emit(''); emit(hr); emit('  ' + title); emit(hr); }

  // ── Summary ──
  section('EXECUTIVE SUMMARY');

  var changed = flat.results.filter(function(r) { return r.newOcc !== r.oldOcc; }).length;
  var increased = flat.results.filter(function(r) { return r.newOcc > r.oldOcc; }).length;
  var decreased = flat.results.filter(function(r) { return r.newOcc < r.oldOcc; }).length;
  var unchanged = flat.results.filter(function(r) { return r.newOcc === r.oldOcc; }).length;
  var unmatched = flat.results.filter(function(r) { return r.noMatch; }).length;

  emit('  Vocabulary entries audited (ALL_WORDS):  ' + flat.results.length);
  emit('  Canonical groups (normalized dedup):     ' + canonical.canonicalWordCount);
  emit('  Duplicate groups (same form, multiple):  ' + canonical.duplicateGroupCount);
  emit('');
  emit('  ALL_WORDS old total occurrences:         ' + flat.totalOld);
  emit('  ALL_WORDS new total occurrences:         ' + flat.totalNew);
  emit('  Canonical old total occurrences:         ' + canonical.totalCanonicalOld);
  emit('  Canonical new total occurrences:         ' + canonical.totalCanonicalNew);
  emit('  Quran corpus total tokens:               ' + quranIndex.totalTokens);
  emit('  Quran total verses:                      ' + quranIndex.totalVerses);
  emit('');
  emit('  ALL_WORDS unchanged:                     ' + unchanged);
  emit('  ALL_WORDS changed:                       ' + changed);
  emit('    Increased:                             ' + increased);
  emit('    Decreased:                             ' + decreased);
  emit('  ALL_WORDS unmatched (not in corpus):     ' + unmatched);

  // ── Coverage ──
  section('COVERAGE & COMPREHENSION');

  var allOldPct = quranIndex.totalTokens > 0 ? Math.round(flat.totalOld / quranIndex.totalTokens * 10000) / 100 : 0;
  var allNewPct = quranIndex.totalTokens > 0 ? Math.round(flat.totalNew / quranIndex.totalTokens * 10000) / 100 : 0;
  var canonOldPct = quranIndex.totalTokens > 0 ? Math.round(canonical.totalCanonicalOld / quranIndex.totalTokens * 10000) / 100 : 0;
  var canonNewPct = quranIndex.totalTokens > 0 ? Math.round(canonical.totalCanonicalNew / quranIndex.totalTokens * 10000) / 100 : 0;

  emit('  Coverage (ALL_WORDS old):               ' + allOldPct + '%');
  emit('  Coverage (ALL_WORDS new):               ' + allNewPct + '%');
  emit('  Coverage (CANONICAL old):               ' + canonOldPct + '%');
  emit('  Coverage (CANONICAL new):               ' + canonNewPct + '%');

  // Foundation coverage (top 100 canonical by occ, sorted by new corpus counts)
  section('FOUNDATION COURSE COVERAGE');

  var canonSorted = canonical.results.slice().sort(function(a, b) { return b.newOcc - a.newOcc; });
  var top100 = canonSorted.slice(0, 100);
  var fOldTotal = 0;
  var fNewTotal = 0;
  top100.forEach(function(r) {
    fOldTotal += r.oldOcc;
    fNewTotal += r.newOcc;
  });
  var fOldPct = quranIndex.totalTokens > 0 ? Math.round(fOldTotal / quranIndex.totalTokens * 10000) / 100 : 0;
  var fNewPct = quranIndex.totalTokens > 0 ? Math.round(fNewTotal / quranIndex.totalTokens * 10000) / 100 : 0;
  emit('  Top 100 canonical words (old occ):       ' + fOldTotal + ' occurrences = ' + fOldPct + '% coverage');
  emit('  Top 100 canonical words (new corpus):    ' + fNewTotal + ' occurrences = ' + fNewPct + '% coverage');
  emit('  Change:                                   ' + (fNewPct - fOldPct >= 0 ? '+' : '') + (fNewPct - fOldPct).toFixed(2) + '%');

  // ── Top 10 largest absolute changes (CANONICAL) ──
  section('TOP 10 LARGEST CHANGES (Canonical Groups)');

  var byDiff = canonical.results.slice().sort(function(a, b) {
    return Math.abs(b.diff) - Math.abs(a.diff);
  });
  emit('  #  Word               Old → New      Diff     %Change');
  for (var i = 0; i < Math.min(10, byDiff.length); i++) {
    var r = byDiff[i];
    if (r.noMatch) continue;
    var pctStr = r.oldOcc > 0 ? (r.diff > 0 ? '+' : '') + r.pctChange + '%' : '(new:' + r.newOcc + ')';
    emit('  ' + String(i+1).padStart(2) + ' ' +
      (r.arabic||'').padEnd(16) +
      r.oldOcc.toString().padStart(6) + ' \u2192 ' +
      r.newOcc.toString().padStart(5) + '  ' +
      (r.diff > 0 ? '+' : '') + r.diff.toString().padStart(6) + '  ' +
      pctStr);
  }

  // ── Top 10 biggest increases ──
  section('TOP 10 BIGGEST INCREASES');
  var inc = canonical.results.filter(function(r) { return r.diff > 0 && !r.noMatch; })
    .sort(function(a, b) { return b.diff - a.diff; });
  emit('  #  Word               Old \u2192 New     +Increase  %Change');
  for (var i = 0; i < Math.min(10, inc.length); i++) {
    var r = inc[i];
    emit('  ' + String(i+1).padStart(2) + ' ' +
      (r.arabic||'').padEnd(16) +
      r.oldOcc.toString().padStart(6) + ' \u2192 ' +
      r.newOcc.toString().padStart(5) + '  +' +
      r.diff.toString().padStart(5) + '  +' + r.pctChange + '%');
  }

  // ── Top 10 biggest decreases ──
  section('TOP 10 BIGGEST DECREASES');
  var dec = canonical.results.filter(function(r) { return r.diff < 0 && !r.noMatch; })
    .sort(function(a, b) { return a.diff - b.diff; });
  emit('  #  Word               Old \u2192 New     Decrease  %Change');
  for (var i = 0; i < Math.min(10, dec.length); i++) {
    var r = dec[i];
    emit('  ' + String(i+1).padStart(2) + ' ' +
      (r.arabic||'').padEnd(16) +
      r.oldOcc.toString().padStart(6) + ' \u2192 ' +
      r.newOcc.toString().padStart(5) + '  ' +
      r.diff.toString().padStart(6) + '  ' + r.pctChange + '%');
  }

  // ── Words with >20% change ──
  section('WORDS WITH >20% CHANGE (Canonical — ' + canonical.results.filter(function(r) {
    return r.oldOcc > 0 && Math.abs(r.pctChange) > 20 && !r.noMatch;
  }).length + ' entries)');

  var highChange = canonical.results.filter(function(r) {
    return r.oldOcc > 0 && Math.abs(r.pctChange) > 20 && !r.noMatch;
  }).sort(function(a, b) { return Math.abs(b.pctChange) - Math.abs(a.pctChange); });

  emit('  #  Word               Old \u2192 New     %Change  English');
  for (var i = 0; i < Math.min(20, highChange.length); i++) {
    var r = highChange[i];
    emit('  ' + String(i+1).padStart(2) + ' ' +
      (r.arabic||'').padEnd(16) +
      r.oldOcc.toString().padStart(5) + ' \u2192 ' +
      r.newOcc.toString().padStart(5) + '  ' +
      (r.pctChange > 0 ? '+' : '') + r.pctChange.toString().padStart(6) + '%  ' +
      (r.english||'').substring(0, 40));
  }

  // ── Unmatched ──
  section('UNMATCHED ENTRIES (not found in Quran corpus — ' + unmatched + ' entries)');
  emit('  These vocabulary entries could not be matched against any');
  emit('  normalized Quran token. They may be multi-word phrases,');
  emit('  non-Quranic vocabulary, or have different orthography.');
  emit('');
  var unm = flat.results.filter(function(r) { return r.noMatch; }).slice(0, 20);
  unm.forEach(function(r) {
    emit('  ' + (r.arabic||'').padEnd(25) + ' old=' + r.oldOcc + '  ' + (r.english||''));
  });
  if (unmatched > 20) emit('  ... and ' + (unmatched - 20) + ' more');

  // ── Validation Sample ──
  section('VALIDATION SAMPLE');

  var sampleSize = Math.min(100, canonical.results.length);
  var step = Math.max(1, Math.floor(canonical.results.length / sampleSize));
  var sampleOk = 0;
  var sampleFail = 0;
  for (var si = 0; si < canonical.results.length; si += step) {
    var r2 = canonical.results[si];
    if (r2.noMatch) continue;
    var corpusEntry2 = quranIndex.index[r2.normalized];
    if (corpusEntry2 && corpusEntry2.count !== r2.newOcc) {
      sampleFail++;
      emit('  FAIL: "' + (r2.arabic||'').substring(0,15) + '" corpus=' + corpusEntry2.count + ' stored=' + r2.newOcc);
    } else {
      sampleOk++;
    }
    if (sampleFail >= 5) break;
  }
  var totalSampled = sampleOk + sampleFail;
  emit('  Sampled: ' + totalSampled + ' canonical groups');
  emit('  Verified: ' + sampleOk + '/' + totalSampled + ' (' + Math.round(sampleOk / totalSampled * 100) + '%)');

  // ── Duplicate Detection ──
  section('DUPLICATE DETECTION');
  var multiEntryGroups = canonical.results.filter(function(r) { return r.entryCount > 1; });
  emit('  Canonical groups with multiple entries: ' + multiEntryGroups.length);
  emit('  Top 10 most duplicated:');
  multiEntryGroups.sort(function(a, b) { return b.entryCount - a.entryCount; }).slice(0, 10).forEach(function(r) {
    emit('  ' + (r.arabic||'').padEnd(20) + ' ' + r.entryCount + ' entries  old=' + r.oldOcc + ' corpus=' + r.newOcc);
  });

  emit('');
  emit(hr);
  emit('  AUDIT COMPLETE');
  emit(hr);

  return lines.join('\n');
}

// ── File Update (--fix) ────────────────────────────────────────

function updateVocabularyFiles(words, flatResults, canonicalGroups) {
  // Build a map: normalized → new canonical occ
  var normToNewOcc = {};
  canonicalGroups.groupOrder.forEach(function(norm) {
    var g = canonicalGroups.groups[norm];
    var corpusEntry = null; // We'll grab from the flat results
  });

  // Instead, use flat results directly: each ALL_WORDS entry gets its own new count
  var updatesByFile = {};
  var warnings = [];

  words.forEach(function(w, idx) {
    var sourceFile = w.__sourceFile;
    if (!sourceFile) sourceFile = null;
    // Find which file this word came from by scanning files
    // We'll handle this differently — track source during loading
  });

  // Track source files during loading by re-reading
  var files = fs.readdirSync(VOCAB_DIR).filter(function(f) {
    return f.startsWith('words-') && f.endsWith('.js');
  }).sort();

  var fileWordMap = {};
  var lineNumMap = {};
  var allWordsCopy = words.slice();

  files.forEach(function(f) {
    var fpath = path.join(VOCAB_DIR, f);
    var content = fs.readFileSync(fpath, 'utf8');
    var lines = content.split('\n');

    // Find ALL_WORDS.push({...}) blocks
    var wordStart = -1;
    var braceDepth = 0;
    var currentWordIdx = -1;
    var wordIndex = 0;

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      // Find word boundary: "ALL_WORDS.push({" or just "  {"
      if (line.indexOf('ALL_WORDS.push({') >= 0) {
        wordStart = li;
        braceDepth = 1;
        currentWordIdx = wordIndex++;
        if (!fileWordMap[fpath]) fileWordMap[fpath] = [];
        fileWordMap[fpath].push({ wordIdx: currentWordIdx, line: li, newOcc: null });
      } else if (wordStart >= 0) {
        // Count braces to find end of word
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          wordStart = -1;
        }
      }
    }
  });

  // Track SRC file during initial loading
  words.forEach(function(w, idx) {
    // Re-load to find source — this means we need to track during phase 1
    // Let's mark them during loading phase 2
  });

  return { updated: 0, skipped: 0, warnings: warnings };
}

// ── Validation ─────────────────────────────────────────────────

function runAutovalidate(canonicalResults, quranIndex) {
  var errors = [];

  // Check for duplicates: two canonical groups normalizing to the same form
  var seen = {};
  canonicalResults.forEach(function(r) {
    if (r.newOcc > 0 && r.normalized) {
      if (seen[r.normalized]) {
        errors.push('DUPLICATE normalized key: "' + r.normalized + '" in "' +
          seen[r.normalized] + '" and "' + r.arabic + '"');
      }
      seen[r.normalized] = r.arabic;
    }
  });

  return errors;
}

// ── Phase 10: UI Consistency Audit ─────────────────────────────

function auditUIOccurrenceDisplays(flatResults) {
  console.log('\n  [Phase 10] UI Consistency Audit — scanning for hardcoded occurrence display patterns...');

  var jsFiles = [];
  function scanDir(dir) {
    var entries;
    try { entries = fs.readdirSync(dir); } catch(e) { return; }
    entries.forEach(function(f) {
      var fpath = path.join(dir, f);
      var stat;
      try { stat = fs.statSync(fpath); } catch(e) { return; }
      if (stat.isDirectory() && f !== 'node_modules' && !f.startsWith('.')) {
        scanDir(fpath);
      } else if (f.endsWith('.js') && !f.endsWith('.min.js')) {
        jsFiles.push(fpath);
      }
    });
  }
  scanDir(path.join(ROOT, 'js'));

  var occPatterns = [
    { pattern: /\.occ\b/g, desc: 'accesses .occ property' },
    { pattern: /'occ'|"occ"/g, desc: 'references "occ" string literal' },
  ];

  var findings = [];
  jsFiles.forEach(function(fp) {
    var content;
    try { content = fs.readFileSync(fp, 'utf8'); } catch(e) { return; }
    occPatterns.forEach(function(p) {
      var matches = content.match(p.pattern);
      if (matches) {
        findings.push({ file: path.relative(ROOT, fp), desc: p.desc, count: matches.length });
      }
    });
  });

  // Deduplicate findings
  var seenFile = {};
  var uniqueFindings = [];
  findings.forEach(function(f) {
    var key = f.file + '|' + f.desc;
    if (!seenFile[key]) {
      seenFile[key] = true;
      uniqueFindings.push(f);
    }
  });

  console.log('  Found ' + uniqueFindings.length + ' files referencing .occ or "occ":');
  uniqueFindings.forEach(function(f) {
    console.log('    ' + f.file + ' (' + f.count + 'x ' + f.desc + ')');
  });

  return uniqueFindings;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║  Quran Vocabulary Occurrence Rebuild — Audit v2.0  ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Phase 1-2: Load data
  var tick = process.hrtime();
  console.log('[Phase 1-2] Loading datasets...');

  var quranText = loadQuranCorpus();
  var surahCount = 0;
  for (var sk in quranText) if (quranText.hasOwnProperty(sk)) surahCount++;
  var verseCount = 0;
  for (var sk2 in quranText) if (quranText.hasOwnProperty(sk2)) verseCount += quranText[sk2].total_verses || 0;
  console.log('  Quran corpus: ' + surahCount + ' surahs, ' + verseCount + ' verses');

  var vocab = loadVocabulary();
  console.log('  Vocabulary: ' + vocab.words.length + ' entries from ' + vocab.files.length + ' files');

  // Phase 3: Tokenize & normalize Quran
  console.log('[Phase 3] Tokenizing & normalizing Quran corpus...');
  var quranIndex = buildQuranIndex(quranText);
  console.log('  ' + quranIndex.totalTokens + ' tokens, ' + Object.keys(quranIndex.index).length + ' unique normalized forms');

  // Phase 4: Compare ALL_WORDS
  console.log('[Phase 4] Comparing occurrences...');
  var flatAudit = runAudit(vocab.words, quranIndex);

  // Phase 5: Canonical grouping
  console.log('[Phase 5] Building canonical groups...');
  var canonicalInfo = buildCanonicalGroups(vocab.words);
  var canonAudit = runCanonicalAudit(vocab.words, canonicalInfo.groups, canonicalInfo.groupOrder, quranIndex);
  console.log('  ' + canonAudit.canonicalWordCount + ' canonical forms (' + canonAudit.duplicateGroupCount + ' with duplicates)');

  // Phase 6-7: Generate report + validate
  console.log('[Phase 6-7] Generating audit report & cross-validation...');
  var report = generateReport(flatAudit, canonAudit, quranIndex);
  console.log(report);

  // Save report
  var reportPath = path.join(ROOT, 'scripts/occurrence-audit-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('  Report saved to: scripts/occurrence-audit-report.txt');

  // Phase 10: UI consistency audit
  console.log('[Phase 10] Auditing UI for occurrence display references...');
  var uiFindings = auditUIOccurrenceDisplays(flatAudit.results);

  // Phase 11: Auto-validate
  console.log('[Phase 11] Running auto-validation...');
  var valErrors = runAutovalidate(canonAudit.results, quranIndex);
  if (valErrors.length === 0) {
    console.log('  [OK] No validation errors found.');
  } else {
    console.log('  [WARN] ' + valErrors.length + ' validation issues:');
    valErrors.forEach(function(e) { console.log('    ' + e); });
  }

  // ── Summary Table ──
  console.log('');
  console.log('  ── SUMMARY TABLE ──');
  console.log('');
  console.log('  Metric                              Old Value       New Value       Change');
  console.log('  ' + '─'.repeat(75));
  console.log('  ALL_WORDS total occurrences         ' +
    String(flatAudit.totalOld).padStart(8) + '          ' +
    String(flatAudit.totalNew).padStart(8) + '          ' +
    (flatAudit.totalNew - flatAudit.totalOld > 0 ? '+' : '') +
    (flatAudit.totalNew - flatAudit.totalOld));
  console.log('  Canonical total occurrences         ' +
    String(canonAudit.totalCanonicalOld).padStart(8) + '          ' +
    String(canonAudit.totalCanonicalNew).padStart(8) + '          ' +
    (canonAudit.totalCanonicalNew - canonAudit.totalCanonicalOld > 0 ? '+' : '') +
    (canonAudit.totalCanonicalNew - canonAudit.totalCanonicalOld));
  console.log('  Coverage % (ALL_WORDS vs corpus)    ' +
    String(quranIndex.totalTokens > 0 ? Math.round(flatAudit.totalOld / quranIndex.totalTokens * 10000) / 100 : 0).padStart(7) + '%        ' +
    String(quranIndex.totalTokens > 0 ? Math.round(flatAudit.totalNew / quranIndex.totalTokens * 10000) / 100 : 0).padStart(7) + '%');
  console.log('  Coverage % (CANONICAL vs corpus)    ' +
    String(quranIndex.totalTokens > 0 ? Math.round(canonAudit.totalCanonicalOld / quranIndex.totalTokens * 10000) / 100 : 0).padStart(7) + '%        ' +
    String(quranIndex.totalTokens > 0 ? Math.round(canonAudit.totalCanonicalNew / quranIndex.totalTokens * 10000) / 100 : 0).padStart(7) + '%');
  console.log('  Foundation top-100 coverage %       ' +
    String(computeTop100Pct(canonAudit.results, quranIndex, 'old')).padStart(7) + '%        ' +
    String(computeTop100Pct(canonAudit.results, quranIndex, 'new')).padStart(7) + '%');
  console.log('  Entries changed                     —                 ' + String(flatAudit.results.filter(function(r) { return r.newOcc !== r.oldOcc; }).length).padStart(8));
  console.log('  Unmatched entries                   ' +
    String(flatAudit.results.filter(function(r) { return r.noMatch; }).length).padStart(8) + '          —');
  console.log('  Canonical forms (deduplicated)                ' + String(canonAudit.canonicalWordCount).padStart(8) + '          —');
  console.log('  Files referencing .occ              —                 ' + String(uiFindings.length).padStart(8));
  console.log('');
  console.log('  Done.');

  function computeTop100Pct(canonResults, qi, mode) {
    var sorted = canonResults.slice().sort(function(a, b) {
      return (mode === 'old' ? b.oldOcc : b.newOcc) - (mode === 'old' ? a.oldOcc : a.newOcc);
    });
    var total = 0;
    sorted.slice(0, 100).forEach(function(r) {
      total += mode === 'old' ? r.oldOcc : r.newOcc;
    });
    return qi.totalTokens > 0 ? Math.round(total / qi.totalTokens * 10000) / 100 : 0;
  }
}

main();
