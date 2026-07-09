// ═══════════════════════════════════════════════════════════════
// run-edu-validation.js — Educational Consistency Validation v3
// ═══════════════════════════════════════════════════════════════

console.log('=== Bayan Educational Consistency Validation ===\n');

const fs = require('fs');
const path = require('path');

// Set up minimal browser environment
global.window = global;
global.document = { getElementById: function() { return null; } };
global.localStorage = { _d: {}, getItem: function(k) { return this._d[k] || null; }, setItem: function(k,v) { this._d[k] = v; } };

// Load SURAH_INFO — it uses const so we must capture it via the file
var surahJs = fs.readFileSync(path.join(__dirname, 'js/data/surahs.js'), 'utf8');
// Manually extract SURAH_INFO object
var surahMatch = surahJs.match(/const SURAH_INFO\s*=\s*({[\s\S]*?})\s*;/);
if (surahMatch) {
  global.SURAH_INFO = eval('(' + surahMatch[1] + ')');
  console.log('  ✓ SURAH_INFO loaded: ' + Object.keys(global.SURAH_INFO).length + ' surahs');
} else {
  // Try var or let
  surahMatch = surahJs.match(/(?:var|let)\s+SURAH_INFO\s*=\s*({[\s\S]*?})\s*;/);
  if (surahMatch) {
    global.SURAH_INFO = eval('(' + surahMatch[1] + ')');
    console.log('  ✓ SURAH_INFO loaded: ' + Object.keys(global.SURAH_INFO).length + ' surahs');
  } else {
    console.log('  ✗ Could not extract SURAH_INFO');
    global.SURAH_INFO = {};
  }
}

// Load word data — each file pushes to ALL_WORDS
global.ALL_WORDS = [];
var wordFiles = fs.readdirSync(path.join(__dirname, 'js/data')).filter(function(f) {
  return f.match(/^words-.+\.js$/);
});
console.log('  Loading ' + wordFiles.length + ' word data files...');

wordFiles.forEach(function(f) {
  try {
    var code = fs.readFileSync(path.join(__dirname, 'js/data', f), 'utf8');
    // Use indirect eval so ALL_WORDS is in global scope
    var fn = new Function('ALL_WORDS', code + '\n//# sourceURL=' + f);
    fn(global.ALL_WORDS);
  } catch(e) {
    console.log('  ✗ Error in ' + f + ': ' + e.message.substring(0, 80));
  }
});
console.log('  ✓ Total words loaded: ' + global.ALL_WORDS.length);

// Load data.js functions (this defines ALL_WORDS, CANONICAL_WORDS, functions, etc.)
var dataJsContent = fs.readFileSync(path.join(__dirname, 'js/data.js'), 'utf8');

// data.js uses const for ALL_WORDS, CANONICAL_WORDS, etc.
// We need to evaluate it in a scope where these are captured
try {
  // Execute in global context so ALL_WORDS is available
  eval(dataJsContent);
  console.log('  ✓ data.js loaded');
  if (typeof CANONICAL_WORDS !== 'undefined') {
    console.log('    CANONICAL_WORDS: ' + CANONICAL_WORDS.length);
  }
  if (typeof FOUNDATION_LESSONS !== 'undefined') {
    console.log('    FOUNDATION_LESSONS: ' + FOUNDATION_LESSONS.length);
  }
} catch(e) {
  console.log('  ✗ data.js error: ' + e.message.substring(0, 100));
}

// Helper: get words regardless of canonical pipeline
function getWords() {
  if (typeof CANONICAL_WORDS !== 'undefined' && CANONICAL_WORDS && CANONICAL_WORDS.length > 0) {
    return CANONICAL_WORDS;
  }
  return global.ALL_WORDS || [];
}

var words = getWords();
console.log('  Using word pool: ' + words.length + ' words\n');

// ═════════════════════════════════════════════════════════
// 1. Missing Required Fields
// ═════════════════════════════════════════════════════════
console.log('─── 1. Missing Required Fields ───');

var requiredFields = ['arabic', 'english', 'translit', 'meaning', 'type', 'typeCategory', 'difficulty', 'occ'];
var missing = {};
requiredFields.forEach(function(f) { missing[f] = []; });

for (var i = 0; i < words.length; i++) {
  var w = words[i];
  requiredFields.forEach(function(f) {
    if (f === 'difficulty' && (w[f] === undefined || w[f] === null)) missing[f].push(w.arabic || w.id || ('#'+i));
    else if (f === 'occ' && w[f] === undefined) missing[f].push(w.arabic || w.id || ('#'+i));
    else if (f === 'root' && (!w[f] || w[f] === '—')) missing[f].push(w.arabic || w.id || ('#'+i));
    else if (f !== 'difficulty' && f !== 'occ' && !w[f]) missing[f].push(w.arabic || w.id || ('#'+i));
  });
}

var totalMissing = 0;
Object.keys(missing).forEach(function(f) {
  if (missing[f].length > 0) {
    console.log('  ✗ ' + f + ': ' + missing[f].length + ' missing (e.g. ' + missing[f].slice(0,3).join(', ') + ')');
    totalMissing += missing[f].length;
  }
});
if (totalMissing === 0) console.log('  ✓ All required fields present');
else console.log('  Total missing field instances: ' + totalMissing);

// ═════════════════════════════════════════════════════════
// 2. Difficulty Distribution
// ═════════════════════════════════════════════════════════
console.log('\n─── 2. Difficulty Distribution ───');

var diffs = {};
for (var di = 0; di < words.length; di++) {
  var d = words[di].difficulty || 3;
  diffs[d] = (diffs[d] || 0) + 1;
}
Object.keys(diffs).sort(function(a,b){return a-b}).forEach(function(d) {
  console.log('  Level ' + d + ': ' + diffs[d] + ' (' + Math.round(diffs[d]/words.length*100) + '%)');
});

// ═════════════════════════════════════════════════════════
// 3. Type Category Distribution
// ═════════════════════════════════════════════════════════
console.log('\n─── 3. Type Category Distribution ───');

var cats = {};
for (var ci = 0; ci < words.length; ci++) {
  var c = words[ci].typeCategory || 'unknown';
  cats[c] = (cats[c] || 0) + 1;
}
Object.keys(cats).sort().forEach(function(c) {
  console.log('  ' + c + ': ' + cats[c]);
});

// ═════════════════════════════════════════════════════════
// 4. Foundation Lesson Analysis
// ═════════════════════════════════════════════════════════
console.log('\n─── 4. Foundation Lesson Analysis ───');

if (typeof FOUNDATION_LESSONS !== 'undefined' && FOUNDATION_LESSONS && FOUNDATION_LESSONS.length > 0) {
  for (var li = 0; li < FOUNDATION_LESSONS.length; li++) {
    var lesson = FOUNDATION_LESSONS[li];
    var lw = [];
    for (var fi = 0; fi < lesson.wordIds.length; fi++) {
      var wid = lesson.wordIds[fi];
      for (var cj = 0; cj < words.length; cj++) {
        if (words[cj].id === wid) { lw.push(words[cj]); break; }
      }
    }
    if (lw.length === 0) { console.log('  ' + lesson.label + ': NO WORDS FOUND'); continue; }
    var ds = lw.map(function(x) { return x.difficulty || 3; });
    var mn = Math.min.apply(null, ds);
    var mx = Math.max.apply(null, ds);
    var avg = Math.round(ds.reduce(function(s,v){return s+v},0)/ds.length*10)/10;
    console.log('  ' + lesson.label + ' — ' + (lesson.thematicTitle||'') + ': diff ' + mn + '-' + mx + ' (avg ' + avg + '), ' + lw.length + ' words');
  }
} else {
  console.log('  ⚠ Foundation lessons not built');
}

// ═════════════════════════════════════════════════════════
// 5. Relationship Field Coverage
// ═════════════════════════════════════════════════════════
console.log('\n─── 5. Relationship Field Coverage ───');

var relFields = ['similarWords', 'oppositeWords', 'contrastWords', 'rootFamily', 'tags', 'relatedWords'];
relFields.forEach(function(f) {
  var count = 0, total = 0;
  for (var ri = 0; ri < words.length; ri++) {
    var val = words[ri][f];
    if (val && Array.isArray(val) && val.length > 0) { count++; total += val.length; }
  }
  console.log('  ' + f + ': ' + count + '/' + words.length + ' words (' + Math.round(count/words.length*100) + '%), ' + total + ' entries');
});

// ═════════════════════════════════════════════════════════
// 6. Reference Validation (similar/opposite/contrast refs)
// ═════════════════════════════════════════════════════════
console.log('\n─── 6. Reference Validation ───');

var arabicSet = {};
for (var ai = 0; ai < words.length; ai++) {
  if (words[ai].arabic) arabicSet[words[ai].arabic] = true;
}

['similarWords', 'oppositeWords', 'contrastWords'].forEach(function(f) {
  var broken = 0, total = 0;
  var examples = [];
  for (var bi = 0; bi < words.length; bi++) {
    var refs = words[bi][f];
    if (refs && Array.isArray(refs)) {
      total += refs.length;
      for (var rj = 0; rj < refs.length; rj++) {
        if (!arabicSet[refs[rj]]) {
          broken++;
          if (examples.length < 5) examples.push(words[bi].arabic + ' → ' + refs[rj]);
        }
      }
    }
  }
  if (broken > 0) {
    console.log('  ✗ ' + f + ': ' + broken + '/' + total + ' broken refs (e.g. ' + examples.join('; ') + ')');
  } else if (total > 0) {
    console.log('  ✓ ' + f + ': all ' + total + ' refs valid');
  } else {
    console.log('  - ' + f + ': no data');
  }
});

// ═════════════════════════════════════════════════════════
// 7. Root Family Reference Validation
// ═════════════════════════════════════════════════════════
console.log('\n─── 7. Root Family References ───');

var rfBroken = 0, rfTotal = 0;
var rfExamples = [];
for (var rfi = 0; rfi < words.length; rfi++) {
  var rf = words[rfi].rootFamily;
  if (rf && Array.isArray(rf)) {
    for (var rfj = 0; rfj < rf.length; rfj++) {
      rfTotal++;
      if (rf[rfj].a && !arabicSet[rf[rfj].a]) {
        rfBroken++;
        if (rfExamples.length < 5) rfExamples.push(words[rfi].arabic + ' → ' + rf[rfj].a);
      }
    }
  }
}
if (rfBroken > 0) {
  console.log('  ✗ ' + rfBroken + '/' + rfTotal + ' broken refs (e.g. ' + rfExamples.join('; ') + ')');
} else {
  console.log('  ✓ All ' + rfTotal + ' root family refs valid');
}

// ═════════════════════════════════════════════════════════
// 8. Contrast Words Status
// ═════════════════════════════════════════════════════════
console.log('\n─── 8. Contrast Words Status ───');

var cc = 0;
for (var cci = 0; cci < words.length; cci++) {
  if (words[cci].contrastWords && Array.isArray(words[cci].contrastWords) && words[cci].contrastWords.length > 0) cc++;
}
console.log('  Words with contrast data: ' + cc + '/' + words.length);
if (cc > 0) {
  // Show some examples
  for (var exi = 0; exi < words.length && exi < 5; exi++) {
    if (words[exi].contrastWords && words[exi].contrastWords.length > 0) {
      console.log('    ' + words[exi].arabic + ' contrasts: ' + words[exi].contrastWords.join(', '));
    }
  }
} else {
  console.log('  ⚠ No contrast data found — feature is wired up but needs data entries');
}

// ═════════════════════════════════════════════════════════
// 9. Frequency Distribution
// ═════════════════════════════════════════════════════════
console.log('\n─── 9. Frequency Distribution ───');

var freqs = {};
for (var fi = 0; fi < words.length; fi++) {
  var f = words[fi].frequency || 'unknown';
  freqs[f] = (freqs[f] || 0) + 1;
}
Object.keys(freqs).forEach(function(f) {
  console.log('  ' + f + ': ' + freqs[f]);
});

// ═════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log('  VALIDATION SUMMARY');
console.log('═══════════════════════════════════════════════');
console.log('  Words: ' + words.length);
console.log('  Missing field instances: ' + totalMissing);
console.log('  Foundation lessons: ' + (FOUNDATION_LESSONS ? FOUNDATION_LESSONS.length : 0));
console.log('  Words with contrast data: ' + cc);
console.log('  Broken root family refs: ' + rfBroken + '/' + rfTotal);
console.log('═══════════════════════════════════════════════');

// Clean up temp script
try { fs.unlinkSync(path.join(__dirname, 'run-edu-validation.js')); } catch(e) {}
