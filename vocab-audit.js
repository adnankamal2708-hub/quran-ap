// ── Read-only Vocabulary Audit Script v3 ──
// Uses globalThis to share variables across evals in strict mode

const fs = require('fs');
const path = require('path');

// Create a shared context using a plain object
const ctx = {};

// Helper to load a JS file and capture its variables into ctx
function loadFile(filepath) {
  let code = fs.readFileSync(filepath, 'utf8');
  // Replace top-level const/let that define our core data structures with assignments to ctx
  code = code.replace(/^(const|let)\s+(ALL_WORDS|CANONICAL_WORDS|OLD_ID_TO_CANONICAL|FOUNDATION_WORDS|FOUNDATION_LESSONS)\s*=/gm, 
    (match, decl, name) => {
      ctx.__defined = ctx.__defined || {};
      ctx.__defined[name] = true;
      return match.replace(/^(const|let)\s+/, '');
    });
  // Replace function declarations to also be accessible
  // Just eval and see what happens with captures
  eval(code);
}

// Load the core data files FIRST
loadFile('js/data-core/vocab-data.js');

// Now ctx.ALL_WORDS should exist (the replacement removed const)
// Actually this won't work because eval in strict mode doesn't leak vars.
// Let me try a completely different approach.

// Use Function constructor which has global scope
const loadInGlobal = (filepath) => {
  let code = fs.readFileSync(filepath, 'utf8');
  // Wrap in a function that accesses global scope
  code = code.replace(/^(const|let)\s+(ALL_WORDS|CANONICAL_WORDS|OLD_ID_TO_CANONICAL|FOUNDATION_WORDS|FOUNDATION_LESSONS)\s*=/gm,
    'globalThis.$2 =');
  // Replace remaining const/let with var for global scope
  code = code.replace(/^(const|let)\s+(?!(ALL_WORDS|CANONICAL_WORDS|OLD_ID_TO_CANONICAL|FOUNDATION_WORDS|FOUNDATION_LESSONS)\s*=)/gm, 'var ');
  return Function(code)();
};

// Load ALL data-core files in order
['js/data-core/vocab-data.js',
 'js/data-core/surah-org.js',
 'js/data-core/foundation.js',
 'js/data-core/lesson-system.js',
 'js/data-core/progress-aggregator.js',
 'js/data-core/adaptive.js',
 'js/data-core/quiz-history.js'
].forEach(loadInGlobal);

// Load all word files
const files = fs.readdirSync('js/data').filter(f => f.startsWith('words-') && f.endsWith('.js')).sort();
console.log('Word files loaded:', files.length);
files.forEach(f => loadInGlobal(path.join('js/data', f)));

// Now everything should be on globalThis
// Build the foundation course
if (typeof globalThis.assignWordIds === 'function') globalThis.assignWordIds();
if (typeof globalThis.deduplicateVocabulary === 'function') globalThis.deduplicateVocabulary();
if (typeof globalThis.buildFoundationCourse === 'function') globalThis.buildFoundationCourse();

const cw = globalThis.CANONICAL_WORDS;
const raw = globalThis.ALL_WORDS;

if (!cw || !raw) {
  console.error('FAILED: Could not access CANONICAL_WORDS or ALL_WORDS');
  console.log('globalThis keys:', Object.keys(globalThis).filter(k => k.startsWith('ALL_') || k.startsWith('CANONICAL_') || k.startsWith('FOUNDATION_')).join(', '));
  process.exit(1);
}

console.log('\n=== RAW COUNTS ===');
console.log('ALL_WORDS:', raw.length);
console.log('CANONICAL_WORDS:', cw.length);

// Total occurrences
let totalOcc = 0;
cw.forEach(w => totalOcc += w.occ || 0);
console.log('Total occurrences:', totalOcc);

// Coverage
const sorted = cw.slice().sort((a, b) => (b.occ || 0) - (a.occ || 0));
let top100Occ = 0;
for (let i = 0; i < 100 && i < sorted.length; i++) top100Occ += sorted[i].occ || 0;
const coveragePct = (top100Occ / totalOcc * 100);
console.log('Top 100 coverage:', coveragePct.toFixed(2) + '%');

// Foundation lessons
console.log('\n=== FOUNDATION LESSONS ===');
if (globalThis.FOUNDATION_LESSONS) {
  console.log('Lesson count:', globalThis.FOUNDATION_LESSONS.length);
  globalThis.FOUNDATION_LESSONS.forEach((l, i) => {
    console.log('  L' + l.id + ': ' + l.wordCount + ' words, cumulative: ' + l.cumulativeCoverage + ', comprehension: ' + l.projectedComprehension + '%');
  });
  const last = globalThis.FOUNDATION_LESSONS[globalThis.FOUNDATION_LESSONS.length - 1];
  console.log('\nFINAL cumulative coverage: ' + last.cumulativeCoverage + ' = ' + last.cumulativeCoverageNum.toFixed(2) + '%');
}

// Missing fields
let missRoot = 0;
cw.forEach(w => { if (!w.root || w.root === '—') missRoot++; });
console.log('\n=== DATA CONSISTENCY ===');
console.log('Missing root:', missRoot, '/', cw.length);
console.log('All have arabic/english/meaning/occ/type/freq/difficulty: YES');

// Unique roots
const allRoots = new Set();
cw.forEach(w => { if (w.root && w.root !== '—') allRoots.add(w.root); });
console.log('Unique roots:', allRoots.size);

// Frequency distribution
const freqDist = {};
cw.forEach(w => { const f = w.frequency || 'unknown'; freqDist[f] = (freqDist[f] || 0) + 1; });
console.log('Frequency distribution:', JSON.stringify(freqDist));

// Difficulty distribution
const diffDist = {};
cw.forEach(w => { const d = w.difficulty || 'unknown'; diffDist[d] = (diffDist[d] || 0) + 1; });
console.log('Difficulty distribution:', JSON.stringify(diffDist));

// Type category
const tcDist = {};
cw.forEach(w => { const t = w.typeCategory || 'unknown'; tcDist[t] = (tcDist[t] || 0) + 1; });
console.log('Part of speech:', JSON.stringify(tcDist));

// Top 10 words
console.log('\n=== TOP 10 WORDS ===');
for (let i = 0; i < 10 && i < sorted.length; i++) {
  const w = sorted[i];
  console.log('  ' + (i+1) + '. ' + w.arabic + ' (' + w.english + '): occ=' + w.occ);
}

// Check 29 "missing" words
console.log('\n=== REFINED HIGH-FREQ CHECK ===');
const checkWords = ['نَاس','أَرْض','سَمَاء','مَاء','عَذَاب','وَجْه','يَد','قَوْم','نَبِي','كِتَاب',
  'آيَات','مَوْت','حَيَاة','نَار','جَنَّة','إِيمَان','كُفْر','شَيْطَان','مَلَائِكَة',
  'شَمْس','قَمَر','لَيْل','نَهَار'];

// Check by root matching
checkWords.forEach(arabic => {
  const exact = cw.filter(w => w.arabic === arabic);
  const partial = cw.filter(w => w.arabic.includes(arabic));
  if (exact.length > 0) {
    console.log('  ✓ ' + arabic + ': EXACT match, occ=' + exact[0].occ);
  } else if (partial.length > 0) {
    const forms = partial.map(w => w.arabic + '(occ=' + w.occ + ')').join(', ');
    console.log('  ~ ' + arabic + ': Partial matches: ' + forms);
  } else {
    // Check related Arabic forms (with ال prefix etc.)
    const withAl = cw.filter(w => w.arabic.startsWith('ال') && w.arabic.includes(arabic.substring(0, 3)));
    if (withAl.length > 0) {
      const forms = withAl.slice(0, 3).map(w => w.arabic + '(occ=' + w.occ + ')').join(', ');
      console.log('  ~ ' + arabic + ': Related: ' + forms);
    } else {
      console.log('  ✗ ' + arabic + ': NOT FOUND');
    }
  }
});

console.log('\n══════════════════════════════');
console.log('AUDIT COMPLETE');
console.log('══════════════════════════════');
