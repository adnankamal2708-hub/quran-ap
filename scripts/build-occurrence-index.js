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
var arabicSameWord = require('../js/data-core/word-forms.js').arabicSameWord;

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
    .replace(/\u0649\u0670/g, '\u064A')           // alif maqsurah + dagger alif → ya (عَلَىٰ → عَلَى)
    .replace(/\u0670/g, '\u0627')                 // dagger alif → alif
    .replace(/\u0629/g, '\u0647')                 // teh marbuta → heh
    .replace(/\u0649/g, '\u064A')                 // alif maqsurah → ya
    .replace(/[\u0624\u0626]/g, function(m) {     // hamza on waw/ya → base
      return m === '\u0624' ? '\u0648' : '\u064A';
    })
    .replace(/[\u06E5\u06E6]/g, function(m) {     // small waw/yeh → base
      return m === '\u06E5' ? '\u0648' : '\u064A';
    })
    .replace(/\u0621\u0627/g, '\u0627')           // standalone hamza + alif → alif (ءَامَنُوا → آمَنُوا)
    .replace(/\u0621/g, '\u0627')                 // remaining standalone hamza → alif
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

// ── Word Forms ─────────────────────────────────────────────────

/**
 * Lesson forms that share a normalized spelling but are different words
 * (إِنَّ / أَن, مِنْ / مَنْ) get their own index keys. Forms of one
 * normalized spelling are grouped with arabicSameWord(); the group that
 * matches the most Quran tokens keeps the plain normalized key and each
 * other group gets "norm|firstForm". Returns:
 *   tokenKey(token) — the index key a Quran token counts under, or ''
 *                     when it is none of the lesson words
 *   formKeys        — { lessonForm: key } for forms whose key isn't the
 *                     plain normalized one (read at runtime)
 */
function buildFormKeys(quranText, words) {
  var formsByNorm = {};
  words.forEach(function(w) {
    var form = String(w.arabic || '').trim();
    var norm = normalizeArabic(form);
    if (!norm || /\s/.test(form)) return; // phrases never match one token
    var forms = formsByNorm[norm] = formsByNorm[norm] || [];
    if (forms.indexOf(form) < 0) forms.push(form);
  });

  var groupsByNorm = {};
  Object.keys(formsByNorm).forEach(function(norm) {
    var groups = [];
    formsByNorm[norm].sort().forEach(function(form) {
      var group = groups.find(function(g) {
        return g.forms.some(function(m) { return arabicSameWord(m, form) && arabicSameWord(form, m); });
      });
      if (group) group.forms.push(form);
      else groups.push({ forms: [form], tokens: 0, key: norm });
    });
    groupsByNorm[norm] = groups;
  });

  var groupCache = {};
  function tokenGroup(token) {
    if (groupCache.hasOwnProperty(token)) return groupCache[token];
    var groups = groupsByNorm[normalizeArabic(token)] || [];
    var found = groups.find(function(g) {
      return g.forms.some(function(form) { return arabicSameWord(form, token); });
    }) || null;
    groupCache[token] = found;
    return found;
  }

  forEachToken(quranText, function(token) {
    var group = tokenGroup(token);
    if (group) group.tokens++;
  });

  var formKeys = {};
  Object.keys(groupsByNorm).forEach(function(norm) {
    var groups = groupsByNorm[norm];
    if (groups.length < 2) return;
    var primary = groups.reduce(function(best, g) { return g.tokens > best.tokens ? g : best; });
    groups.forEach(function(g) {
      if (g === primary) return;
      g.key = norm + '|' + g.forms[0];
      g.forms.forEach(function(form) { formKeys[form] = g.key; });
    });
  });

  return {
    tokenKey: function(token) { var g = tokenGroup(token); return g ? g.key : ''; },
    formKeys: formKeys,
  };
}

function forEachToken(quranText, fn) {
  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    surah.verses.forEach(function(verse) {
      if (!verse || !verse.text) return;
      verse.text.split(/\s+/).forEach(function(t) { if (t.trim()) fn(t.trim()); });
    });
  }
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
function buildOccurrenceIndex(quranText, tokenKey) {
  var index = {};   // normalized -> { refs: [], seen: {} }
  var tokenCounts = {}; // normalized -> total TOKEN count in corpus (used for real coverage)
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

        var normalized = tokenKey(token);
        if (!normalized) continue;

        matchedTokens++;
        tokenCounts[normalized] = (tokenCounts[normalized] || 0) + 1;
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

  return { index: index, tokenCounts: tokenCounts, totalTokens: totalTokens, matchedTokens: matchedTokens, totalRefs: totalRefs };
}

// ── Validation ─────────────────────────────────────────────────

/**
 * Validate the built index against the corpus:
 *  - every verse ref exists and is well-formed
 *  - no duplicate refs within any key
 *  - random-sample re-count: for N random keys, rescan the corpus and
 *    confirm the number of distinct verses matches the index
 */
function validateIndex(quranText, index, tokenKey) {
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
    var expected = countDistinctVerses(quranText, norm, tokenKey);
    if (expected !== index[norm].refs.length) {
      errors.push('Count mismatch for "' + norm + '": index=' + index[norm].refs.length + ' corpus=' + expected);
      if (errors.length >= 10) break;
    }
  }

  return errors;
}

/** Count distinct verses where a token with this key occurs (re-scan). */
function countDistinctVerses(quranText, normalized, tokenKey) {
  var verses = {};
  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      var tokens = verse.text.split(/\s+/);
      for (var ti = 0; ti < tokens.length; ti++) {
        if (tokenKey(tokens[ti].trim()) === normalized) {
          verses[sid + ':' + verse.id] = true;
          break;
        }
      }
    }
  }
  return Object.keys(verses).length;
}

// ── Output Generation ──────────────────────────────────────────

function generateFile(index, totalRefs, keyCount, tokenCounts, totalTokens, formKeys) {
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
  // Real token-level coverage data: total corpus tokens and per-key token counts
  // (normalized forms matching vocabulary words). Used by calculateCoverage() &
  // related functions instead of the inflated legacy w.occ formula.
  // Lesson forms that are a different word from others with the same
  // letters (إِنَّ / أَن) have their own key; OCCURRENCE_INDEX_KEY gives
  // the key for any lesson word. Tokens are matched with arabicSameWord().
  lines.push('  T.OCCURRENCE_INDEX_FORM_KEYS = ' + JSON.stringify(formKeys, Object.keys(formKeys).sort(), 0) + ';');
  lines.push('  T.OCCURRENCE_INDEX_KEY = function (arabic) {');
  lines.push('    var form = String(arabic || \'\').trim();');
  lines.push('    return T.OCCURRENCE_INDEX_FORM_KEYS[form] || T.OCCURRENCE_INDEX_NORM(form);');
  lines.push('  };');
  lines.push('  T.OCCURRENCE_INDEX_TOTAL_TOKENS = ' + totalTokens + ';');
  lines.push('  T.OCCURRENCE_INDEX_TOKEN_COUNTS = {');
  var countKeys = Object.keys(tokenCounts).sort();
  countKeys.forEach(function(k, idx) {
    var comma = idx < countKeys.length - 1 ? ',' : '';
    lines.push('    ' + JSON.stringify(k) + ': ' + tokenCounts[k] + comma);
  });
  lines.push('  };');
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
  var forms = buildFormKeys(quranText, words);
  console.log('  Vocabulary: ' + words.length + ' entries; ' + Object.keys(forms.formKeys).length + ' forms keyed apart from a look-alike');

  console.log('[3/4] Scanning corpus & building index...');
  var result = buildOccurrenceIndex(quranText, forms.tokenKey);
  console.log('  Tokens scanned: ' + result.totalTokens);
  console.log('  Tokens matched vocab: ' + result.matchedTokens);
  console.log('  Unique verse refs: ' + result.totalRefs);
  console.log('  Index keys: ' + Object.keys(result.index).length);

  console.log('[4/4] Validating index...');
  var errors = validateIndex(quranText, result.index, forms.tokenKey);
  if (errors.length > 0) {
    console.error('  ✗ VALIDATION FAILED:');
    errors.forEach(function(e) { console.error('    • ' + e); });
    process.exit(1);
  }
  console.log('  ✓ All verse refs exist, no duplicates, random-sample counts match.');

  var output = generateFile(result.index, result.totalRefs, Object.keys(result.index).length, result.tokenCounts, result.totalTokens, forms.formKeys);
  fs.writeFileSync(OUT_PATH, output, 'utf8');
  var kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
  console.log('');
  console.log('  ✓ Wrote js/data/occurrence-index.js (' + kb + ' KB)');
  console.log('  Done.');
}

main();
