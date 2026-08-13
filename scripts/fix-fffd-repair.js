// One-off repair script (not part of the build).
//
// Fixes U+FFFD (replacement character) corruption in the Quran corpus:
//   - js/quran/quran-data.js  : 48 verses have a pair of U+FFFD where a single
//     Arabic character was lost during a bad encoding round-trip.
//   - js/data/words-expanded.js, words-hf-batch1.js, words-hf-batch2.js :
//     one corrupted ayahA string each (same corruption).
//
// Repair source: risan/quran-json v3.1.2 (data/quran.json) — the exact corpus
// this project credits in its quran-data.js header. All 6,188 non-corrupted
// verses already match canonical byte-for-byte, so canonical is authoritative.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CANONICAL_PATH = process.argv[2] || path.join(ROOT, 'quran-canonical.json');

if (!fs.existsSync(CANONICAL_PATH)) {
  console.error('Canonical data not found at ' + CANONICAL_PATH);
  console.error('Download it first:');
  console.error('  curl -sL https://raw.githubusercontent.com/risan/quran-json/v3.1.2/data/quran.json -o quran-canonical.json');
  process.exit(1);
}

const canonical = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));

// ── 1. Repair quran-data.js ──────────────────────────────────────────
const dataPath = path.join(ROOT, 'js', 'quran', 'quran-data.js');
let src = fs.readFileSync(dataPath, 'utf8');

global.window = {};
eval(src); // defines QURAN_TEXT

const replacements = [];
let affected = 0;
let fffdBefore = 0;
for (const sid in QURAN_TEXT) {
  for (const v of QURAN_TEXT[sid].verses) {
    if (!v.text.includes('\uFFFD')) continue;
    affected++;
    for (const ch of v.text) if (ch === '\uFFFD') fffdBefore++;
    const canonText = canonical[sid][v.id - 1].text;
    if (!canonText) {
      console.error('No canonical text for ' + sid + ':' + v.id + ' — aborting');
      process.exit(1);
    }
    replacements.push({ from: "text: '" + v.text + "'", to: "text: '" + canonText + "'" });
  }
}

console.log('Affected verses: ' + affected + ' | U+FFFD before: ' + fffdBefore);

for (const r of replacements) {
  const count = src.split(r.from).length - 1;
  if (count !== 1) {
    console.error('Expected exactly 1 occurrence of corrupted text, found ' + count + ' — aborting');
    console.error(JSON.stringify(r.from.slice(0, 80)));
    process.exit(1);
  }
  src = src.split(r.from).join(r.to);
}

fs.writeFileSync(dataPath, src, 'utf8');

// Verify the repair
global.window = {};
eval(src);
let exact = 0, mismatches = 0, fffdAfter = 0, total = 0;
for (const sid in QURAN_TEXT) {
  for (const v of QURAN_TEXT[sid].verses) {
    total++;
    if (v.text.includes('\uFFFD')) fffdAfter++;
    if (v.text === canonical[sid][v.id - 1].text) exact++;
    else mismatches++;
  }
}
console.log('quran-data.js after repair: ' + total + ' verses | exact-vs-canonical: ' + exact + ' | mismatches: ' + mismatches + ' | U+FFFD remaining: ' + fffdAfter);
if (mismatches > 0 || fffdAfter > 0) {
  console.error('REPAIR VERIFICATION FAILED');
  process.exit(1);
}
console.log('quran-data.js repaired OK.');

// ── 2. Repair vocabulary word files ──────────────────────────────────
// Each file has exactly one corrupted ayahA: a pair of U+FFFD that replaced
// a single Arabic character. The correct character is derived from the
// canonical verse text.
const wordFileFixes = [
  {
    file: 'js/data/words-expanded.js',
    // 42:43 "وَغَفَرَ <FFFD><FFFD>ِنَّ" -> "وَغَفَرَ إِنَّ"
    // Corruption lost only the hamza-alef إ (U+0625); the kasra after it survived.
    from: '\u0648\u064E\u063A\u064E\u0641\u064E\u0631\u064E \uFFFD\uFFFD\u0650\u0646\u0651\u064E',
    to: '\u0648\u064E\u063A\u064E\u0641\u064E\u0631\u064E \u0625\u0650\u0646\u0651\u064E',
  },
  {
    file: 'js/data/words-hf-batch1.js',
    // 10:29 "كُنّ<FFFD><FFFD>ا" -> "كُنَّا"  (َ = U+064E)
    from: 'كُنّ\uFFFD\uFFFDا',
    to: 'كُنَّا',
  },
  {
    file: 'js/data/words-hf-batch2.js',
    // 2:60 "ٱسۡت<FFFD><FFFD>سۡقَىٰ" -> "ٱسۡتَسۡقَىٰ"  (َ = U+064E)
    from: 'ٱسۡت\uFFFD\uFFFDسۡقَىٰ',
    to: 'ٱسۡتَسۡقَىٰ',
  },
];

for (const fix of wordFileFixes) {
  const p = path.join(ROOT, fix.file);
  let content = fs.readFileSync(p, 'utf8');
  const count = content.split(fix.from).length - 1;
  if (count !== 1) {
    console.error(fix.file + ': expected 1 occurrence, found ' + count + ' — aborting');
    process.exit(1);
  }
  content = content.split(fix.from).join(fix.to);
  fs.writeFileSync(p, content, 'utf8');
  if (content.includes('\uFFFD')) {
    console.error(fix.file + ': U+FFFD still present — aborting');
    process.exit(1);
  }
  console.log(fix.file + ' repaired OK.');
}

console.log('All repairs complete.');
