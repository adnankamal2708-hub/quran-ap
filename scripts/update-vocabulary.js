#!/usr/bin/env node
/**
 * scripts/update-vocabulary.js
 *
 * Update ALL vocabulary words-*.js files with:
 *   occ       — Educational occurrence count (prefix+exact safe merge)
 *   occExact  — Exact normalized token match count (for validation/internal)
 *
 * SAFE: Uses position-aware word block parsing (brace counting) to ensure
 * each word's occ line is correctly identified regardless of duplicate values.
 * IDEMPOTENT: Checks for existing occExact field before modifying.
 *
 * Usage: node scripts/update-vocabulary.js
 * Generates: scripts/vocabulary-migration-report.txt
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var VOCAB_DIR = path.join(ROOT, 'js/data');
var QURAN_DATA_PATH = path.join(ROOT, 'js/quran/quran-data.js');
var REPORT_PATH = path.join(ROOT, 'scripts/vocabulary-migration-report.txt');

// ── Arabic Normalization ──
var DIAC = /[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g;

function norm(t) {
  if (!t) return '';
  return String(t)
    .replace(/\u0640/g, '').replace(DIAC, '').replace(/[\uFD3E\uFD3F]/g, '')
    .replace(/\u0671/g, '\u0627').replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0670/g, '\u0627').replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A').replace(/\u0624/g, '\u0648').replace(/\u0626/g, '\u064A')
    .replace(/[\u06E5\u06E6]/g, function(m) { return m === '\u06E5' ? '\u0648' : '\u064A'; })
    .replace(/\s+/g, ' ').trim();
}

var PREFIX_CHARS = ['\u0648', '\u0641', '\u0628', '\u0644', '\u0643', '\u0633'];
var LAM = '\u0644';
var ALIF_LAM = '\u0627\u0644';

// ── Load Quran Corpus ──
function loadQuran() {
  var code = fs.readFileSync(QURAN_DATA_PATH, 'utf8');
  var s = { window: {} };
  vm.runInContext(code, vm.createContext(s));
  return s.QURAN_TEXT;
}

// ── Build Token Index ──
function buildIndex(quranText) {
  var idx = {};
  for (var sid = 1; sid <= 114; sid++) {
    var s = quranText[sid];
    if (!s || !s.verses) continue;
    for (var vi = 0; vi < s.verses.length; vi++) {
      var v = s.verses[vi];
      if (!v || !v.text) continue;
      v.text.split(/\s+/).forEach(function(tok) {
        tok = tok.trim();
        if (!tok) return;
        var n = norm(tok);
        if (!n) return;
        idx[n] = (idx[n] || 0) + 1;
      });
    }
  }
  return idx;
}

// ── Compute Educational Count ──
function countEducational(normalized, quranIdx) {
  var exact = quranIdx[normalized] || 0;
  var prefixTotal = exact;

  PREFIX_CHARS.forEach(function(p) {
    var prefixed = p + normalized;
    prefixTotal += quranIdx[prefixed] || 0;

    if (normalized.indexOf(ALIF_LAM) !== 0) {
      var prefixedArt = p + ALIF_LAM + normalized;
      prefixTotal += quranIdx[prefixedArt] || 0;
    }
  });

  var lamDef = LAM + LAM + normalized;
  prefixTotal += quranIdx[lamDef] || 0;

  return { exact: exact, educational: prefixTotal };
}

// ── Position-Aware File Update Engine ──
// Uses brace counting to identify each word block's boundaries,
// then finds and replaces occ within each specific block only.

/**
 * Split a vocabulary file into word blocks by counting braces.
 * Returns array of { startLine, endLine, content, occLine, hasOccExact }
 * for each word block within ALL_WORDS.push(...)
 */
function parseWordBlocks(lines) {
  var blocks = [];
  var inPush = false;
  var braceDepth = 0;
  var blockStart = -1;

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];

    // Detect ALL_WORDS.push({
    if (!inPush && line.indexOf('ALL_WORDS.push({') >= 0) {
      inPush = true;
      braceDepth = 1;
      blockStart = li;
      continue;
    }

    if (!inPush) continue;

    // Count braces to track word boundaries
    for (var ci = 0; ci < line.length; ci++) {
      if (line[ci] === '{') braceDepth++;
      if (line[ci] === '}') braceDepth--;
    }

    // When braceDepth returns to 1, we've closed one word object
    // When braceDepth returns to 0, the entire ALL_WORDS.push() is done
    if (braceDepth <= 0) {
      inPush = false;
      // The last block ends here
    }
  }

  // Now re-scan with a different strategy: find each "  {" or "{\n" pattern
  // within the ALL_WORDS.push(...) block
  inPush = false;
  braceDepth = 0;
  blockStart = -1;
  var currentBlockLines = [];

  for (var li2 = 0; li2 < lines.length; li2++) {
    var line2 = lines[li2];

    if (!inPush && line2.indexOf('ALL_WORDS.push(') >= 0) {
      inPush = true;
      braceDepth = 1;
      continue;
    }

    if (!inPush) continue;

    // Track brace depth
    for (var cj = 0; cj < line2.length; cj++) {
      if (line2[cj] === '{') braceDepth++;
      if (line2[cj] === '}') braceDepth--;
    }

    if (braceDepth <= 0) {
      inPush = false;
      break;
    }
  }

  // After finding bounds of ALL_WORDS.push, split by word boundaries
  // by tracking when braceDepth goes from N to N+1 (word start) and N+1 to N (word end)
  inPush = false;
  braceDepth = 0;
  blockStart = -1;
  var wordStartLine = -1;
  var wordBraceDepth = 0;

  for (var li3 = 0; li3 < lines.length; li3++) {
    var line3 = lines[li3];

    if (!inPush && line3.indexOf('ALL_WORDS.push(') >= 0) {
      inPush = true;
      braceDepth = 1;
      continue;
    }

    if (!inPush) continue;

    var prevDepth = braceDepth;

    for (var ck = 0; ck < line3.length; ck++) {
      if (line3[ck] === '{') braceDepth++;
      if (line3[ck] === '}') braceDepth--;
    }

    // Word starts when braceDepth goes from 1 to 2 (the opening { of a word)
    if (prevDepth === 1 && braceDepth > prevDepth && wordStartLine === -1) {
      wordStartLine = li3;
      wordBraceDepth = braceDepth;
    }

    // Word ends when braceDepth returns to 1 (closing } of a word)
    if (wordStartLine >= 0 && prevDepth > 1 && braceDepth <= 1) {
      // This word block ends at li3
      blocks.push({ startLine: wordStartLine, endLine: li3 });
      wordStartLine = -1;
    }
  }

  // Process each block to find occ field
  blocks.forEach(function(b) {
    b.occLine = -1;
    b.occValue = -1;
    b.hasOccExact = false;

    for (var bli = b.startLine; bli <= b.endLine; bli++) {
      var bline = lines[bli];
      if (bline.indexOf('occExact:') >= 0) {
        b.hasOccExact = true;
      }
      var occMatch = bline.match(/occ\s*:\s*(\d+)\b/);
      if (occMatch && bline.indexOf('occExact:') < 0 && bline.indexOf('occEducational:') < 0) {
        b.occLine = bli;
        b.occValue = parseInt(occMatch[1], 10);
      }
    }
  });

  return blocks;
}

/**
 * Update a single vocabulary file with position-aware word block editing.
 * Returns { modified: bool, changes: int }
 */
function updateFile(filePath, wordList) {
  var content = fs.readFileSync(filePath, 'utf8');
  var lines = content.split('\n');
  var blocks = parseWordBlocks(lines);
  var modified = false;
  var changeCount = 0;

  // If fewer blocks than words, something is wrong with the parsing
  // But we still try our best
  if (blocks.length !== wordList.length) {
    console.warn('  [WARN] Block count mismatch: ' + filePath + ' has ' + blocks.length + ' blocks but ' + wordList.length + ' words. Using fallback.');
    // Fallback: use regex-based replacement for this file (targeting first occ in each block)
    return updateFileFallback(filePath, wordList);
  }

  wordList.forEach(function(w, idx) {
    var block = blocks[idx];
    if (!block) return;

    if (block.hasOccExact) {
      // Already has occExact — this is idempotent, skip
      return;
    }

    if (block.occLine < 0) {
      console.warn('  [WARN] No occ line found in block ' + idx + ' of ' + filePath);
      return;
    }

    var oldLine = lines[block.occLine];
    var newLine = oldLine.replace(
      /(occ\s*:\s*)\d+\b/,
      '$1' + w.newOcc + ', occExact: ' + w.newExact + ', occEducational: ' + w.newOcc
    );
    lines[block.occLine] = newLine;
    modified = true;
    if (w.changed) changeCount++;
  });

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }

  return { modified: modified, changes: changeCount };
}

/**
 * Fallback: use regex replacement for files where block parsing failed.
 * Each replacement is done sequentially and only replaces the first match
 * of occ: <oldValue> in the remaining content.
 */
function updateFileFallback(filePath, wordList) {
  var content = fs.readFileSync(filePath, 'utf8');
  var modified = false;
  var changeCount = 0;

  wordList.forEach(function(w) {
    if (!w.changed && !w.forceUpdate) return;

    // Check if occExact already exists (idempotent)
    if (content.indexOf('occExact:') >= 0) {
      // Already processed, skip entire file
      modified = false;
      return;
    }

    var occRegex = new RegExp('(occ\\s*:\\s*)' + w.oldOcc + '\\b');
    var match = content.match(occRegex);

    if (match) {
      var replacement = '$1' + w.newOcc + ', occExact: ' + w.newExact + ', occEducational: ' + w.newOcc;
      content = content.replace(occRegex, replacement);
      modified = true;
      if (w.changed) changeCount++;
    } else {
      console.warn('  [WARN] Could not find occ: ' + w.oldOcc + ' in ' + path.basename(filePath) + ' for "' + (w.arabic || '').substring(0, 20) + '". Skipping.');
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified: modified, changes: changeCount };
}

// ── Load Vocab with Source Tracking ──
function loadVocabWithSources() {
  var entries = [];
  var files = fs.readdirSync(VOCAB_DIR).filter(function(f) {
    return f.startsWith('words-') && f.endsWith('.js');
  }).sort();

  files.forEach(function(f) {
    var fpath = path.join(VOCAB_DIR, f);
    var content = fs.readFileSync(fpath, 'utf8');

    var sandbox = { ALL_WORDS: [] };
    try { vm.runInNewContext(content, sandbox); } catch(e) {
      console.error('  [SKIP] Failed to eval ' + f + ': ' + e.message);
      return;
    }

    sandbox.ALL_WORDS.forEach(function(w, idx) {
      entries.push({
        word: w,
        sourceFile: f,
        arabic: w.arabic || '',
        oldOcc: w.occ || 0,
        normalized: norm(w.arabic || ''),
      });
    });
  });

  return entries;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║  Quran Vocabulary Update — occExact + occEducational ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  // Step 1: Load Quran corpus
  console.log('[Step 1] Loading Quran corpus...');
  var quranText = loadQuran();
  var quranIdx = buildIndex(quranText);
  var tokenTotal = 0;
  for (var tk in quranIdx) tokenTotal += quranIdx[tk];
  console.log('  Tokenized: ' + Object.keys(quranIdx).length + ' unique forms, ' + tokenTotal + ' total tokens');

  // Step 2: Load vocabulary
  console.log('[Step 2] Loading vocabulary entries...');
  var entries = loadVocabWithSources();
  console.log('  Loaded: ' + entries.length + ' entries from ' + Object.keys(groupBy(entries, 'sourceFile')).length + ' files');

  // Step 3: Compute new counts
  console.log('[Step 3] Computing occurrence counts...');
  var totalOld = 0;
  var totalNewEduc = 0;
  var totalNewExact = 0;
  var changed = 0;
  var unchanged = 0;
  var unmatched = 0;
  var changes = [];

  // Check for files already updated (idempotency)
  var alreadyUpdatedFiles = {};
  var files = fs.readdirSync(VOCAB_DIR).filter(function(f) { return f.startsWith('words-') && f.endsWith('.js'); }).sort();
  files.forEach(function(f) {
    var fpath = path.join(VOCAB_DIR, f);
    var content = fs.readFileSync(fpath, 'utf8');
    if (content.indexOf('occExact:') >= 0) {
      alreadyUpdatedFiles[f] = true;
    }
  });

  if (Object.keys(alreadyUpdatedFiles).length > 0) {
    console.log('  [INFO] ' + Object.keys(alreadyUpdatedFiles).length + ' files already have occExact — skipping update.');
  }

  entries.forEach(function(e) {
    var counts = countEducational(e.normalized, quranIdx);
    e.newExact = counts.exact;
    e.newOcc = counts.educational;
    e.changed = counts.educational !== e.oldOcc;
    e.forceUpdate = false;

    totalOld += e.oldOcc;
    totalNewEduc += counts.educational;
    totalNewExact += counts.exact;

    if (counts.educational !== e.oldOcc) {
      changed++;
      changes.push({
        arabic: e.arabic,
        english: e.word.english || '',
        source: e.sourceFile,
        oldOcc: e.oldOcc,
        newOcc: counts.educational,
        newExact: counts.exact,
        diff: counts.educational - e.oldOcc,
        pctChange: e.oldOcc > 0 ? Math.round((counts.educational - e.oldOcc) / e.oldOcc * 1000) / 10 : 100,
        noMatch: counts.exact === 0 && counts.educational === 0,
      });
    } else {
      unchanged++;
      // Even unchanged words need occExact added if file isn't already updated
      if (!alreadyUpdatedFiles[e.sourceFile]) {
        e.changed = true; // Mark as needing update to add occExact field
        e.forceUpdate = true;
      }
    }

    if (counts.exact === 0 && counts.educational === 0) unmatched++;
  });

  console.log('  Old occ:       ' + totalOld);
  console.log('  New educational: ' + totalNewEduc);
  console.log('  New exact:     ' + totalNewExact);
  console.log('  Changed:       ' + changed + ' words');
  console.log('  Unchanged:     ' + unchanged + ' words (occExact added to unchanged)');

  // Step 4: Group by source file
  console.log('[Step 4] Grouping by source file...');
  var fileGroups = {};
  entries.forEach(function(e) {
    if (!fileGroups[e.sourceFile]) fileGroups[e.sourceFile] = [];
    fileGroups[e.sourceFile].push(e);
  });

  // Step 5: Update files
  console.log('[Step 5] Updating vocabulary files...');
  var updatedCount = 0;
  var totalChanged = 0;

  Object.keys(fileGroups).sort().forEach(function(f) {
    if (alreadyUpdatedFiles[f]) {
      console.log('  [SKIP] ' + f + ' (already has occExact)');
      return;
    }

    var fpath = path.join(VOCAB_DIR, f);
    var result = updateFile(fpath, fileGroups[f], quranIdx);

    if (result.modified) {
      updatedCount++;
      totalChanged += result.changes;
      var changedWords = fileGroups[f].filter(function(w) { return w.changed; });
      console.log('  Updated: ' + f + ' (' + (result.changes > 0 ? result.changes + ' changed' : 'occExact added') + ')');
    } else {
      console.log('  [SKIP] ' + f + ' (no changes needed)');
    }
  });

  console.log('\n  Files updated: ' + updatedCount);
  console.log('  Words changed: ' + totalChanged);

  // Step 6: Generate migration report
  console.log('[Step 6] Generating migration report...');
  var reportLines = [];
  function r(l) { reportLines.push(l); }
  var hr = '══════════════════════════════════════════════════════════════════════';

  r('');
  r('  Quran Vocabulary Migration Report');
  r('  ================================');
  r('');
  r(hr);
  r('  EXECUTIVE SUMMARY');
  r(hr);
  r('');
  r('  Total entries processed:         ' + entries.length);
  r('  Entries changed (occ value):     ' + changed);
  r('  Entries unchanged (occExact):    ' + unchanged);
  r('  Unmatched (0 in corpus):         ' + unmatched);
  r('');
  r('  Old occurrence sum:              ' + totalOld);
  r('  New educational sum:             ' + totalNewEduc);
  r('  New exact sum:                   ' + totalNewExact);
  r('  Change (old to educational):     ' + (totalNewEduc > totalOld ? '+' : '') + (totalNewEduc - totalOld));
  r('  Change (old to exact):           ' + (totalNewExact > totalOld ? '+' : '') + (totalNewExact - totalOld));
  r('');
  r('  Educational coverage:            ' + Math.round(totalNewEduc / tokenTotal * 10000) / 100 + '% of ' + tokenTotal + ' tokens');
  r('  Exact coverage:                  ' + Math.round(totalNewExact / tokenTotal * 10000) / 100 + '% of ' + tokenTotal + ' tokens');

  // Top changes
  r('');
  r(hr);
  r('  TOP 20 LARGEST CHANGES');
  r(hr);
  r('');
  changes.sort(function(a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
  r('  #  Word                  Old -> New       Diff     %Change');
  changes.slice(0, 20).forEach(function(c, i) {
    if (c.noMatch) return;
    r('  ' + String(i+1).padStart(2) + ' ' +
      (c.arabic || '').padEnd(18) +
      String(c.oldOcc).padStart(6) + ' -> ' +
      String(c.newOcc).padStart(5) + '   ' +
      (c.diff > 0 ? '+' : '') + String(c.diff).padStart(6) + '  ' +
      (c.pctChange > 0 ? '+' : '') + String(c.pctChange).padStart(6) + '%');
  });

  // Decreases
  r('');
  r(hr);
  r('  TOP 10 DECREASES');
  r(hr);
  r('');
  var decreases = changes.filter(function(c) { return c.diff < 0; }).sort(function(a, b) { return a.diff - b.diff; });
  decreases.slice(0, 10).forEach(function(c, i) {
    r('  ' + String(i+1).padStart(2) + ' ' +
      (c.arabic || '').padEnd(18) +
      String(c.oldOcc).padStart(6) + ' -> ' +
      String(c.newOcc).padStart(5) + '   ' +
      String(c.diff).padStart(6) + '  ' +
      c.pctChange + '%  ' + (c.english || '').substring(0, 20));
  });

  // Increases
  r('');
  r(hr);
  r('  TOP 10 INCREASES');
  r(hr);
  r('');
  var increases = changes.filter(function(c) { return c.diff > 0; }).sort(function(a, b) { return b.pctChange - a.pctChange; });
  increases.slice(0, 10).forEach(function(c, i) {
    r('  ' + String(i+1).padStart(2) + ' ' +
      (c.arabic || '').padEnd(18) +
      String(c.oldOcc).padStart(6) + ' -> ' +
      String(c.newOcc).padStart(6) + '  +' +
      String(c.diff).padStart(5) + '  +' +
      c.pctChange + '%  ' + (c.english || '').substring(0, 20));
  });

  r('');
  r(hr);
  r('  MIGRATION COMPLETE');
  r(hr);
  r('');
  r('  occ  - Educational count (prefix+exact safe merge) — used for display, ordering, coverage');
  r('  occExact - Exact normalized token match — preserved for validation and internal analytics');
  r('  occEducational - Same as occ — added for clarity and future use');
  r('');

  var reportText = reportLines.join('\n');
  fs.writeFileSync(REPORT_PATH, reportText, 'utf8');
  console.log('  Report saved to: ' + REPORT_PATH);
  console.log(reportText);
  console.log('  Done.\n');
}

// Helper
function groupBy(arr, key) {
  var g = {};
  arr.forEach(function(item) { var k = item[key]; if (!g[k]) g[k] = []; g[k].push(item); });
  return g;
}

main();
