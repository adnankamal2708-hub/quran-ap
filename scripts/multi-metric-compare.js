#!/usr/bin/env node
/**
 * scripts/multi-metric-compare.js
 *
 * Second Validation Phase — Compare Multiple Counting Metrics
 *
 * Metrics:
 *   1. EXACT     — Exact normalized token match (current method)
 *   2. PREFIX    — Safe prefix-aware: count corpus tokens that start with
 *                  و,ف,ب,ل,ك,س followed by the exact vocab form
 *   3. ARTICLE   — Definite-article variants (forms with/without ال)
 *   4. FAMILY    — Educational root-family count: sum exact counts of all
 *                  vocabulary words sharing the same root field
 *
 * Safety rules:
 *   - Never strip from a token without verifying the remainder exactly
 *     matches a known vocabulary form
 *   - Prefix matching only when token[1:] === vocab normalized form
 *   - Article matching only when difference is exactly "ال" prefix
 *   - Family counting uses the existing vocabulary root field
 *
 * External reference: Quranic Arabic Corpus (corpus.quran.com) lemma frequencies
 *
 * Usage: node scripts/multi-metric-compare.js
 * No modifications to vocabulary files are made.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

// ── Normalization (same pipeline) ──
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

// Arabic prefix characters (one-letter particles)
var PREFIXES = {
  '\u0648': 'waw',   // و
  '\u0641': 'fa',    // ف
  '\u0628': 'ba',    // ب
  '\u0644': 'lam',   // ل
  '\u0643': 'kaf',   // ك
  '\u0633': 'seen',  // س
};

// ── Data loading ──
function loadQuran() {
  var code = fs.readFileSync(path.join(ROOT, 'js/quran/quran-data.js'), 'utf8');
  var s = { window: {} };
  vm.runInContext(code, vm.createContext(s));
  return s.QURAN_TEXT;
}

function loadVocab() {
  var ALL_WORDS = [];
  fs.readdirSync(path.join(ROOT, 'js/data')).filter(function(f) {
    return f.startsWith('words-') && f.endsWith('.js');
  }).sort().forEach(function(f) {
    try { vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data', f), 'utf8'), { ALL_WORDS: ALL_WORDS }); } catch(e) {}
  });
  return ALL_WORDS;
}

// ── Build token index from Quran ──
function buildTokenIndex(quranText) {
  // index: normalized token → { exactCount, rawExamples: [...] }
  // Also store raw tokens grouped by normalized form for prefix analysis
  var idx = {};      // normed → count
  var rawMap = {};   // normed → [raw tokens]

  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah || !surah.verses) continue;
    for (var vi = 0; vi < surah.verses.length; vi++) {
      var verse = surah.verses[vi];
      if (!verse || !verse.text) continue;
      verse.text.split(/\s+/).forEach(function(token) {
        token = token.trim();
        if (!token) return;
        var n = norm(token);
        if (!n) return;
        idx[n] = (idx[n] || 0) + 1;
        if (!rawMap[n]) rawMap[n] = {};
        rawMap[n][token] = (rawMap[n][token] || 0) + 1;
      });
    }
  }
  return { index: idx, rawMap: rawMap };
}

// ── External frequency reference (Quranic Arabic Corpus lemmas) ──
// Source: https://corpus.quran.com/lemmas.jsp
// These are LEMMA counts — they include ALL morphological forms of each lemma
// (prefixes, suffixes, definite articles, etc.)
var CORPUS_LEMMAS = [
  { lemma: 'مِنْ', translit: 'min', count: 3226, pos: 'Preposition' },
  { lemma: 'ٱللَّه', translit: 'Allah', count: 2699, pos: 'Proper Noun' },
  { lemma: 'فِى', translit: 'fi', count: 1701, pos: 'Preposition' },
  { lemma: 'إِنّ', translit: 'inna', count: 1682, pos: 'Accusative Particle' },
  { lemma: 'عَلَىٰ', translit: 'ala', count: 1445, pos: 'Preposition' },
  { lemma: 'ٱلَّذِى', translit: 'alladhi', count: 1442, pos: 'Relative Pronoun' },
  { lemma: 'لَا', translit: 'la', count: 1364, pos: 'Negative Particle' },
  { lemma: 'مَا', translit: 'ma', count: 1266, pos: 'Relative Pronoun' },
  { lemma: 'رَبّ', translit: 'rabb', count: 975, pos: 'Noun' },
  { lemma: 'إِلَىٰ', translit: 'ila', count: 742, pos: 'Preposition' },
  { lemma: 'مَن', translit: 'man', count: 606, pos: 'Relative Pronoun' },
  { lemma: 'أَن', translit: 'an', count: 578, pos: 'Subordinating Conjunction' },
  { lemma: 'إِلَّا', translit: 'illa', count: 558, pos: 'Restriction Particle' },
  { lemma: 'ذَٰلِكَ', translit: 'dhalika', count: 520, pos: 'Demonstrative Pronoun' },
  { lemma: 'عَنْ', translit: 'an', count: 465, pos: 'Preposition' },
  { lemma: 'أَرْض', translit: 'ard', count: 461, pos: 'Noun' },
  { lemma: 'قَدْ', translit: 'qad', count: 406, pos: 'Particle' },
  { lemma: 'إِذَا', translit: 'idha', count: 405, pos: 'Time Adverb' },
  { lemma: 'قَوْم', translit: 'qawm', count: 383, pos: 'Noun' },
  { lemma: 'آيَة', translit: 'aya', count: 382, pos: 'Noun' },
  { lemma: 'كُلّ', translit: 'kull', count: 358, pos: 'Noun' },
  { lemma: 'لَمْ', translit: 'lam', count: 353, pos: 'Negative Particle' },
  { lemma: 'ثُمَّ', translit: 'thumma', count: 338, pos: 'Coordinating Conjunction' },
  { lemma: 'رَسُول', translit: 'rasul', count: 332, pos: 'Noun' },
  { lemma: 'لَا', translit: 'la (proh)', count: 327, pos: 'Prohibition Particle' },
  { lemma: 'يَوْم', translit: 'yawm', count: 325, pos: 'Noun' },
  { lemma: 'عَذَاب', translit: 'adhab', count: 322, pos: 'Noun' },
  { lemma: 'هَٰذَا', translit: 'hadha', count: 317, pos: 'Demonstrative Pronoun' },
  { lemma: 'سَمَاء', translit: 'sama', count: 310, pos: 'Noun' },
  { lemma: 'نَفْس', translit: 'nafs', count: 295, pos: 'Noun' },
  { lemma: 'شَيْء', translit: 'shay', count: 283, pos: 'Noun' },
  { lemma: 'أَوْ', translit: 'aw', count: 280, pos: 'Coordinating Conjunction' },
  { lemma: 'كِتَاب', translit: 'kitab', count: 260, pos: 'Noun' },
  { lemma: 'بَيْنَ', translit: 'bayna', count: 243, pos: 'Location Adverb' },
  { lemma: 'حَقّ', translit: 'haqq', count: 242, pos: 'Noun' },
  { lemma: 'نَّاس', translit: 'nas', count: 241, pos: 'Noun' },
  { lemma: 'إِذْ', translit: 'idh', count: 239, pos: 'Time Adverb' },
  { lemma: 'أُولَٰئِكَ', translit: 'ulaika', count: 204, pos: 'Demonstrative Pronoun' },
  { lemma: 'قَبْلَ', translit: 'qabla', count: 197, pos: 'Noun' },
  { lemma: 'مُؤْمِن', translit: 'mumin', count: 195, pos: 'Noun' },
  { lemma: 'لَوْ', translit: 'law', count: 184, pos: 'Conditional Particle' },
  { lemma: 'مَن', translit: 'man (cond)', count: 184, pos: 'Conditional Particle' },
  { lemma: 'سَبِيل', translit: 'sabil', count: 176, pos: 'Noun' },
  { lemma: 'أَمْر', translit: 'amr', count: 166, pos: 'Noun' },
  { lemma: 'عِندَ', translit: 'inda', count: 160, pos: 'Location Adverb' },
  { lemma: 'مَعَ', translit: 'maa', count: 159, pos: 'Location Adverb' },
  { lemma: 'بَعْض', translit: 'bad', count: 157, pos: 'Noun' },
  { lemma: 'كَانَ', translit: 'kana', count: 156, pos: 'Verb' },
  { lemma: 'قَالَ', translit: 'qala', count: 155, pos: 'Verb' },
  { lemma: 'جَعَلَ', translit: 'jaala', count: 154, pos: 'Verb' },
];

// ── Build reference index from external data ──
// Normalize each lemma so we can match against our vocabulary
function buildReferenceIndex() {
  var ref = {};
  CORPUS_LEMMAS.forEach(function(l) {
    var n = norm(l.lemma);
    if (n) {
      // Some lemmas map to the same normalized form (e.g., two لَا entries)
      // Sum them
      ref[n] = (ref[n] || 0) + l.count;
    }
  });
  return ref;
}

// ═══════════════════════════════════════════════════════════════
// COMPARISON ENGINE
// ═══════════════════════════════════════════════════════════════

function computeMetrics(vocabWords, quranIndex) {
  // Build a set of all normalized vocab forms for safe variant checking
  var vocabNormSet = {};
  vocabWords.forEach(function(w) {
    var nn = norm(w.arabic || '');
    if (nn) vocabNormSet[nn] = true;
  });

  var results = [];

  vocabWords.forEach(function(w, idx) {
    var arabic = w.arabic || '';
    var english = w.english || '';
    var root = w.root || '';
    var oldOcc = w.occ || 0;
    var n = norm(arabic);
    if (!n) return;

    // METRIC 1: Exact token count
    var exactCount = quranIndex.index[n] || 0;

    // METRIC 2: Safe prefix-aware count
    // Count corpus tokens that start with a prefix followed by the exact vocab form.
    // Safe: we verify token === p + n exactly — never strip from unknown forms.
    var prefixCount = 0;
    var prefixBreakdown = {};

    Object.keys(PREFIXES).forEach(function(p) {
      var prefixedForm = p + n;
      var c = quranIndex.index[prefixedForm];
      if (c && c > 0) {
        prefixCount += c;
        prefixBreakdown[PREFIXES[p] + '-' + p + n] = c;
      }
      // Also handle prefix + ال + bare form (e.g., فالحمد = ف + ال + حمد)
      // Only if vocab form is bare (doesn't start with ال)
      if (n.indexOf('\u0627\u0644') !== 0) {
        var prefixedArticleForm = p + '\u0627\u0644' + n;
        var pac = quranIndex.index[prefixedArticleForm] || 0;
        if (pac > 0) {
          prefixCount += pac;
          prefixBreakdown[PREFIXES[p] + '-al-' + n] = pac;
        }
      }
    });

    // Also handle لل (lam + definite article): "لل" + X
    var lamDefinite = '\u0644\u0644' + n;
    var lamDefCount = quranIndex.index[lamDefinite] || 0;
    if (lamDefCount > 0) {
      prefixCount += lamDefCount;
      prefixBreakdown['lam-def-' + lamDefinite] = lamDefCount;
    }

    // METRIC 3: Definite article variants — SAFE VERSION
    // Only count article variants when the target form is ALSO a known vocabulary entry
    // This prevents false positives like stripping ال from الله and matching له (to him)
    var articleCount = 0;

    if (n.indexOf('\u0627\u0644') === 0) {
      // Vocab has ال: only count bare form if ITSELF is in the vocabulary
      var bareForm = n.substring(2);
      if (bareForm && vocabNormSet[bareForm]) {
        var bareCount = quranIndex.index[bareForm] || 0;
        articleCount += bareCount;
      }
    } else {
      // Vocab is bare: only count ال+form if ITSELF is in the vocabulary
      var withArticle = '\u0627\u0644' + n;
      if (vocabNormSet[withArticle]) {
        var withArticleCount = quranIndex.index[withArticle] || 0;
        articleCount += withArticleCount;
      }
    }

    // METRIC 4: Educational family count (root-based) — DEDUPLICATED
    // Sum exact counts of all vocabulary words sharing the same root,
    // but deduplicate by normalized form to avoid double-counting.
    var familyCount = 0;
    var familyMembers = [];
    var seenFamilyNorm = {};

    if (root && root !== '\u2014' && root !== '—') {
      vocabWords.forEach(function(other) {
        var otherRoot = other.root || '';
        if (otherRoot === root && other.arabic) {
          var otherNorm = norm(other.arabic);
          if (otherNorm && !seenFamilyNorm[otherNorm]) {
            seenFamilyNorm[otherNorm] = true;
            var otherCount = quranIndex.index[otherNorm] || 0;
            familyCount += otherCount;
            familyMembers.push({ arabic: other.arabic, english: other.english, count: otherCount });
          }
        }
      });
    }

    results.push({
      idx: idx,
      arabic: arabic,
      english: english,
      root: root,
      oldOcc: oldOcc,
      normalized: n,
      exactCount: exactCount,
      prefixCount: prefixCount,
      prefixTotal: exactCount + prefixCount,
      prefixBreakdown: prefixBreakdown,
      articleCount: articleCount,
      articleTotal: exactCount + articleCount,
      familyCount: familyCount,
      familyMembers: familyMembers,
      familyMemberCount: familyMembers.length,
    });
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════

function generateReport(results, refIndex) {
  var lines = [];
  function emit(l) { lines.push(l); }
  function hr() { emit('\u2500'.repeat(78)); }

  emit('');
  emit('  Multi-Metric Occurrence Comparison Report');
  emit('  =========================================');
  emit('');

  // Sort by old occ descending, take top 200
  var sorted = results.slice().sort(function(a, b) { return b.oldOcc - a.oldOcc; }).slice(0, 200);

  // ── Header ──
  hr();
  emit('  METRIC LEGEND:');
  emit('    EXACT    = Normalized exact token match (current method)');
  emit('    PREFIX   = Safe prefix-aware (و,ف,ب,ل,ك,س + exact form)');
  emit('    ARTICLE  = Definite article variants (with/without ال)');
  emit('    FAMILY   = Root-family sum (all vocab words sharing same root)');
  emit('    LEMMA    = Quranic Arabic Corpus lemma count (external reference)');
  emit('    OLD      = Manually stored occ value (currently in vocabulary)');
  hr();
  emit('');
  emit('  Top 200 entries (sorted by old occ descending):');
  emit('');
  emit('  #  Word'.padEnd(32) + 'Old   Exact  P+Ex  Art+Ex Family Lemma  Best');
  emit('  ' + '\u2500'.repeat(78));

  // Track totals for summary
  var totals = { old: 0, exact: 0, prefixPlusExact: 0, articlePlusExact: 0, family: 0, refSum: 0 };
  var hasRef = 0;
  var refMatchExact = 0;
  var refMatchPrefix = 0;
  var refMatchArticle = 0;
  var refMatchFamily = 0;
  var refBest = { exact: 0, prefix: 0, article: 0, family: 0 };
  var refCount = 0;

  sorted.forEach(function(r, rank) {
    var refLemmaCount = refIndex[r.normalized] || 0;

    totals.old += r.oldOcc;
    totals.exact += r.exactCount;
    totals.prefixPlusExact += r.prefixTotal;
    totals.articlePlusExact += r.articleTotal;
    totals.family += r.familyCount;

    if (refLemmaCount > 0) {
      totals.refSum += refLemmaCount;
      refCount++;
      // Find which metric is closest to reference
      var exactErr = Math.abs(r.exactCount - refLemmaCount) / refLemmaCount;
      var prefixErr = Math.abs(r.prefixTotal - refLemmaCount) / refLemmaCount;
      var articleErr = Math.abs(r.articleTotal - refLemmaCount) / refLemmaCount;
      var familyErr = Math.abs(r.familyCount - refLemmaCount) / refLemmaCount;

      if (exactErr <= prefixErr && exactErr <= articleErr && exactErr <= familyErr) { refMatchExact++; refBest.exact++; }
      else if (prefixErr <= exactErr && prefixErr <= articleErr && prefixErr <= familyErr) { refMatchPrefix++; refBest.prefix++; }
      else if (articleErr <= exactErr && articleErr <= prefixErr && articleErr <= familyErr) { refMatchArticle++; refBest.article++; }
      else { refMatchFamily++; refBest.family++; }
    }

    // Determine best metric (closest to reference, or if no reference, closest to old)
    var bestMetric = 'exact';
    var bestCount = r.exactCount;
    if (Math.abs(r.prefixTotal - refLemmaCount) < Math.abs(bestCount - refLemmaCount)) {
      bestMetric = 'prefix'; bestCount = r.prefixTotal;
    }
    if (Math.abs(r.articleTotal - refLemmaCount) < Math.abs(bestCount - refLemmaCount)) {
      bestMetric = 'article'; bestCount = r.articleTotal;
    }
    if (r.familyCount > 0 && Math.abs(r.familyCount - refLemmaCount) < Math.abs(bestCount - refLemmaCount)) {
      bestMetric = 'family'; bestCount = r.familyCount;
    }
    // If no reference, fall back to prefix+exact
    if (!refLemmaCount && bestCount === 0) {
      bestCount = r.prefixTotal > 0 ? r.prefixTotal : r.exactCount;
      bestMetric = r.prefixTotal > 0 ? 'prefix' : 'exact';
    }

    var refStr = refLemmaCount > 0 ? String(refLemmaCount).padStart(5) : '  — ';

    emit('  ' + String(rank + 1).padStart(2) + ' ' +
      (r.arabic || '').padEnd(18) +
      String(r.oldOcc).padStart(5) + ' ' +
      String(r.exactCount).padStart(5) + ' ' +
      String(r.prefixTotal).padStart(5) + ' ' +
      String(r.articleTotal).padStart(5) + ' ' +
      String(r.familyCount > 0 ? r.familyCount : '—').padStart(5) + ' ' +
      refStr + ' ' +
      bestMetric.substring(0, 4));
  });

  // ── Summary ──
  emit('');
  hr();
  emit('  SUMMARY');
  hr();
  emit('');
  emit('  Metric                   Total Count    vs Old    vs Reference');
  emit('  ' + '\u2500'.repeat(60));
  emit('  Old (stored)             ' + String(totals.old).padStart(12) + '      —%      ' +
    (totals.refSum > 0 ? Math.round(totals.old / totals.refSum * 100) + '%' : '—%'));
  emit('  Exact (current method)  ' + String(totals.exact).padStart(12) + '     ' +
    Math.round(totals.exact / totals.old * 100) + '%      ' +
    (totals.refSum > 0 ? Math.round(totals.exact / totals.refSum * 100) + '%' : '—%'));
  emit('  Prefix+Exact            ' + String(totals.prefixPlusExact).padStart(12) + '     ' +
    Math.round(totals.prefixPlusExact / totals.old * 100) + '%      ' +
    (totals.refSum > 0 ? Math.round(totals.prefixPlusExact / totals.refSum * 100) + '%' : '—%'));
  emit('  Article+Exact           ' + String(totals.articlePlusExact).padStart(12) + '     ' +
    Math.round(totals.articlePlusExact / totals.old * 100) + '%      ' +
    (totals.refSum > 0 ? Math.round(totals.articlePlusExact / totals.refSum * 100) + '%' : '—%'));
  emit('  Root Family             ' + String(totals.family).padStart(12) + '     ' +
    Math.round(totals.family / totals.old * 100) + '%      ' +
    (totals.refSum > 0 ? Math.round(totals.family / totals.refSum * 100) + '%' : '—%'));
  emit('  Reference (Corpus lemma) ' + String(totals.refSum).padStart(12) + '      —%      —%');

  // ── Reference matching analysis ──
  emit('');
  emit('  Reference matching (' + refCount + ' words found in external reference):');
  emit('    Exact match is closest:                  ' + String(refMatchExact).padStart(3) + '/' + refCount + ' (' +
    Math.round(refMatchExact / refCount * 100) + '%)');
  emit('    Prefix+Exact is closest:                 ' + String(refMatchPrefix).padStart(3) + '/' + refCount + ' (' +
    Math.round(refMatchPrefix / refCount * 100) + '%)');
  emit('    Article+Exact is closest:                ' + String(refMatchArticle).padStart(3) + '/' + refCount + ' (' +
    Math.round(refMatchArticle / refCount * 100) + '%)');
  emit('    Root Family is closest:                  ' + String(refMatchFamily).padStart(3) + '/' + refCount + ' (' +
    Math.round(refMatchFamily / refCount * 100) + '%)');

  // ── Top words comparison table ──
  emit('');
  hr();
  emit('  DETAILED COMPARISON — Words with Reference Data');
  emit('');
  emit('  Word'.padEnd(22) + 'Old   Exact  P+Ex   Ref Lemma  BestMetric  Error%');
  emit('  ' + '\u2500'.repeat(70));

  var withRef = sorted.filter(function(r) {
    return refIndex[r.normalized] > 0;
  }).slice(0, 50);

  withRef.forEach(function(r) {
    var refLemmaCount = refIndex[r.normalized] || 0;

    // Find which metric is closest
    var metrics = [
      { name: 'exact', value: r.exactCount, err: Math.abs(r.exactCount - refLemmaCount) / refLemmaCount },
      { name: 'prefix', value: r.prefixTotal, err: Math.abs(r.prefixTotal - refLemmaCount) / refLemmaCount },
      { name: 'article', value: r.articleTotal, err: Math.abs(r.articleTotal - refLemmaCount) / refLemmaCount },
    ];
    if (r.familyCount > 0) {
      metrics.push({ name: 'family', value: r.familyCount, err: Math.abs(r.familyCount - refLemmaCount) / refLemmaCount });
    }
    metrics.sort(function(a, b) { return a.err - b.err; });
    var best = metrics[0];
    var errPct = Math.round(best.err * 100);

    emit('  ' + (r.arabic || '').padEnd(18) +
      String(r.oldOcc).padStart(5) + ' ' +
      String(r.exactCount).padStart(5) + ' ' +
      String(r.prefixTotal).padStart(5) + '  ' +
      String(refLemmaCount).padStart(5) + '    ' +
      best.name.substring(0, 6).padEnd(6) + '   ' + errPct + '%');
  });

  // ── Recommendation ──
  emit('');
  hr();
  emit('  RECOMMENDATION');
  hr();
  emit('');

  if (refMatchPrefix + refMatchArticle > refMatchExact) {
    emit('  RECOMMENDED INTERNAL METRIC: PREFIX-AWARE (safe merge)');
    emit('  RECOMMENDED DISPLAY METRIC:  PREFIX-AWARE (safe merge)');
    emit('');
    emit('  Rationale: The prefix-aware count matches the external lemma');
    emit('  reference most closely for ' + (refMatchPrefix + refMatchArticle) + ' of ' + refCount + ' words.');
    emit('  This reflects how knowing a root word helps a learner understand');
    emit('  prefixed variants of the same word in the Quran.');
  } else if (refMatchExact >= refMatchPrefix) {
    emit('  RECOMMENDED INTERNAL METRIC: EXACT TOKEN MATCH');
    emit('  RECOMMENDED DISPLAY METRIC:  PREFIX-AWARE (for learners) / EXACT (for accuracy)');
    emit('');
    emit('  Rationale: The exact token match is the most accurate method and');
    emit('  matches the external reference most closely for ' + refMatchExact + ' of ' + refCount + ' words.');
    emit('  However, for educational display (showing learners word occurrences),');
    emit('  the prefix-aware count better represents how the word family appears');
    emit('  in the Quran.');
  }

  emit('');
  emit('  RECOMMENDED DISPLAY FOR LEARNERS:');
  emit('    Word Detail: Show prefix-aware count with note "includes prefixed forms"');
  emit('    Foundation ordering: Use prefix-aware count for frequency ranking');
  emit('    Coverage calculation: Use exact token match (conservative baseline)');
  emit('    Dashboard: Show exact match for "words mastered" statistics');

  // ── Old vs New comparison summary ──
  emit('');
  hr();
  emit('  OLD VS NEW COMPARISON');
  hr();
  emit('');

  var totalOld = 0, totalNew = 0;
  results.forEach(function(r) {
    totalOld += r.oldOcc;
    totalNew += r.prefixTotal;
  });
  emit('  Total (all ' + results.length + ' words):');
  emit('    Old stored:     ' + totalOld);
  emit('    New (exact):    ' + totals.exact);
  emit('    New (prefix):   ' + totals.prefixPlusExact);
  emit('    Coverage (exact, % of 77,429 tokens):  ' + Math.round(totals.exact / 77429 * 10000) / 100 + '%');
  emit('    Coverage (prefix, % of 77,429 tokens): ' + Math.round(totals.prefixPlusExact / 77429 * 10000) / 100 + '%');

  emit('');
  hr();

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('');
  console.log('  Multi-Metric Occurrence Comparison');
  console.log('  =================================\n');

  console.log('[1/4] Loading Quran corpus...');
  var quranText = loadQuran();

  console.log('[2/4] Loading vocabulary...');
  var words = loadVocab();
  console.log('  ' + words.length + ' entries loaded.');

  console.log('[3/4] Building token index and computing metrics...');
  var quranIndex = buildTokenIndex(quranText);
  var results = computeMetrics(words, quranIndex);
  console.log('  Metrics computed for ' + results.length + ' entries.');

  console.log('[4/4] Loading external reference and generating report...');
  var refIndex = buildReferenceIndex();
  console.log('  ' + Object.keys(refIndex).length + ' reference lemmas loaded.');

  var report = generateReport(results, refIndex);
  console.log(report);

  var reportPath = path.join(ROOT, 'scripts/multi-metric-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('\n  Report saved to: scripts/multi-metric-report.txt');
  console.log('  No files were modified.\n');
}

main();
