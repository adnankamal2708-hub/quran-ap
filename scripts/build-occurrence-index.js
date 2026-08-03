#!/usr/bin/env node
/**
 * scripts/build-occurrence-index.js
 *
 * Builds js/data/occurrence-index.js — a dedicated occurrence index
 * derived directly from the Quran corpus (js/quran/quran-data.js).
 *
 * The index maps each vocabulary word's NORMALIZED Arabic form to the
 * list of verse references ("surah:verse") where that exact normalized
 * token occurs. Only verse references are stored — no Arabic text,
 * translations, tafsir, or other data is duplicated here.
 *
 * The normalization pipeline is IDENTICAL to the one used by
 * scripts/rebuild-occurrences.js (see the normalizeArabic function
 * below — it is copied verbatim and MUST stay in sync).
 *
 * The generated file is bundled into the app by build.js (it is
 * auto-discovered from js/data/), and the runtime renderer
 * (renderExplorerAllOccurrences) merges these refs with each word's
 * existing rich word.occurrences entries, hydrating verse text lazily
 * from the Quran loader.
 *
 * Usage:
 *   node scripts/build-occurrence-index.js          # Generate (overwrite)
 *
 * This is a standalone Node.js script. It does NOT modify app runtime.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

// ── Configuration ──────────────────────────────────────────────
var ROOT = path.join(__dirname, '..');
var QURAN_DATA_PATH = path.join(ROOT, 'js/quran/quran-data.js');
var VOCAB_DIR = path.join(ROOT, 'js/data');
var OUT_PATH = path.join(ROOT, 'js/data/occurrence-index.js');

// ── Arabic Normalization Pipeline ──────────────────────────────
// ⚠️ MUST stay byte-identical to scripts/rebuild-occurrences.js.
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

/** Load ALL vocabulary word entries (words-*.js) — same selection as rebuild-occurrences.js. */
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

  return ALL_WORDS;
}

// ── Index Builder ──────────────────────────────────────────────

/**
 * Scan the Quran corpus token-by-token (same tokenization as
 * rebuild-occurrences.js: split on \s+, normalize each token) and,
 * for every normalized token that matches a vocabulary word, record a
 * UNIQUE verse reference. The array for each key is deduplicated
 * (a word appearing twice in one verse yields one verse ref) and
 * sorted in corpus order.
 */
function buildOccurrenceIndex(quranText, vocabNormalizedSet) {
  var index = {};   // normalized -> { refs: [], seen: {} }
  var totalTokens = 0;
  var matchedTokens = 0;
  var totalRefs = 0;

  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;

    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;

      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        var token = tokens[ti].trim();
        if (!token) continue;
        totalTokens++;

        var normalized = normalizeArabic(token);
        if (!normalized) continue;
        if (!vocabNormalizedSet[normalized]) continue;

        matchedTokens++;
        if (!index[normalized]) {
          index[normalized] = { refs: [], seen: {} };
        }
        var entry = index[normalized];
        var ref = sid + ':' + verse.id;
        if (!entry.seen[ref]) {
          entry.seen[ref] = true;
          entry.refs.push(ref);
          totalRefs++;
        }
      }
    }
  }

  return { index: index, totalTokens: totalTokens, matchedTokens: matchedTokens, totalRefs: totalRefs };
}

// ── Validation ─────────────────────────────────────────────────

/**
 * Validate the built index against the corpus:
 *  - every verse ref exists and is well-formed
 *  - no duplicate refs within any key
 *  - random-sample re-count: for N random keys, rescan the corpus and
 *    confirm the number of distinct verses matches the index
 */
function validateIndex(quranText, index, vocabNormalizedSet) {
  var errors = [];

  // Well-formed + existing refs + no duplicates
  Object.keys(index).forEach(function(key) {
    var refs = index[key].refs;
    var seen = {};
    for (var i = 0; i < refs.length; i++) {
      var parts = String(refs[i]).split(':');
      var sid = parseInt(parts[0], 10);
      var vid = parseInt(parts[1], 10);
      if (parts.length !== 2 || !sid || !vid || sid < 1 || sid > 114) {
        errors.push('Malformed ref "' + refs[i] + '" for key "' + key + '"');
        continue;
      }
      var surah = quranText[sid];
      var verse = surah && surah.verses ? surah.verses[vid - 1] : null;
      if (!verse) {
        errors.push('Ref "' + refs[i] + '" does not exist for key "' + key + '"');
      }
      if (seen[refs[i]]) {
        errors.push('Duplicate ref "' + refs[i] + '" for key "' + key + '"');
      }
      seen[refs[i]] = true;
    }
  });

  // Random sample re-count (up to 40 keys)
  var keys = Object.keys(index);
  var step = Math.max(1, Math.floor(keys.length / 40));
  for (var ki = 0; ki < keys.length; ki += step) {
    var norm = keys[ki];
    var expected = countDistinctVerses(quranText, norm);
    if (expected !== index[norm].refs.length) {
      errors.push('Count mismatch for "' + norm + '": index=' + index[norm].refs.length + ' corpus=' + expected);
      if (errors.length >= 10) break;
    }
  }

  return errors;
}

/** Count distinct verses where a normalized token occurs (re-scan). */
function countDistinctVerses(quranText, normalized) {
  var verses = {};
  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        if (normalizeArabic(tokens[ti].trim()) === normalized) {
          verses[sid + ':' + verse.id] = true;
          break;
        }
      }
    }
  }
  return Object.keys(verses).length;
}

// ── Output Generation ──────────────────────────────────────────

function generateFile(index, totalRefs, keyCount) {
  var keys = Object.keys(index).sort();
  var lines = [];
  lines.push('// ═══════════════════════════════════════════════════════════════');
  lines.push('// occurrence-index.js — AUTO-GENERATED — DO NOT EDIT MANUALLY.');
  lines.push('// Generated by scripts/build-occurrence-index.js');
  lines.push('//');
  lines.push('// Maps each vocabulary word\'s NORMALIZED Arabic form to the list');
  lines.push('// of unique verse references ("surah:verse") where that token');
  lines.push('// occurs in the Quran. Normalization matches');
  lines.push('// scripts/rebuild-occurrences.js exactly.');
  lines.push('//');
  lines.push('// ' + keyCount + ' keys / ' + totalRefs + ' verse references.');
  lines.push('// ═══════════════════════════════════════════════════════════════');
  lines.push('(function () {');
  lines.push('  var T = (typeof window !== \'undefined\') ? window : (typeof globalThis !== \'undefined\' ? globalThis : {});');
  lines.push('  // Normalization used to build this index — must match rebuild-occurrences.js.');
  // DIACRITICS_RANGE is a free variable inside normalizeArabic (copied verbatim
  // from rebuild-occurrences.js). The serialized function references it, so it
  // MUST be defined in the generated scope too, or lookups throw ReferenceError.
  lines.push('  var DIACRITICS_RANGE = /[\\u064B-\\u065F\\u0610-\\u061A\\u06D6-\\u06ED]/g;');
  lines.push('  T.OCCURRENCE_INDEX_NORM = ' + normalizeArabic.toString() + ';');
  lines.push('  T.OCCURRENCE_INDEX = {');
  keys.forEach(function(k, idx) {
    var comma = idx < keys.length - 1 ? ',' : '';
    lines.push('    ' + JSON.stringify(k) + ': ' + JSON.stringify(index[k].refs) + comma);
  });
  lines.push('  };');
  lines.push('})();');
  lines.push('');
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║  Quran Vocabulary Occurrence Index Builder         ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  console.log('[1/4] Loading Quran corpus...');
  var quranText = loadQuranCorpus();
  var surahCount = 0;
  for (var sk in quranText) if (quranText.hasOwnProperty(sk)) surahCount++;
  console.log('  Quran: ' + surahCount + ' surahs');

  console.log('[2/4] Loading vocabulary...');
  var words = loadVocabulary();
  var vocabNormalizedSet = {};
  words.forEach(function(w) {
    var norm = normalizeArabic(w.arabic || '');
    if (norm) vocabNormalizedSet[norm] = true;
  });
  console.log('  Vocabulary: ' + words.length + ' entries -> ' + Object.keys(vocabNormalizedSet).length + ' normalized forms');

  console.log('[3/4] Scanning corpus & building index...');
  var result = buildOccurrenceIndex(quranText, vocabNormalizedSet);
  console.log('  Tokens scanned: ' + result.totalTokens);
  console.log('  Tokens matched vocab: ' + result.matchedTokens);
  console.log('  Unique verse refs: ' + result.totalRefs);
  console.log('  Index keys: ' + Object.keys(result.index).length);

  console.log('[4/4] Validating index...');
  var errors = validateIndex(quranText, result.index, vocabNormalizedSet);
  if (errors.length > 0) {
    console.error('  ✗ VALIDATION FAILED:');
    errors.forEach(function(e) { console.error('    • ' + e); });
    process.exit(1);
  }
  console.log('  ✓ All verse refs exist, no duplicates, random-sample counts match.');

  var output = generateFile(result.index, result.totalRefs, Object.keys(result.index).length);
  fs.writeFileSync(OUT_PATH, output, 'utf8');
  var kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
  console.log('');
  console.log('  ✓ Wrote js/data/occurrence-index.js (' + kb + ' KB)');
  console.log('  Done.');
}

main();
