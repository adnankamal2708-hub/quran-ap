// ── Word forms: one spelling, different words ─────────────────────
// OCCURRENCE_INDEX_NORM strips the vowel marks, so on its own it reads
// إِنَّ and أَن, مِنْ and مَنْ, عَلِمَ and عِلْم, ٱلۡجَنَّة and ٱلۡجِنَّة as one
// word. arabicSameWord() looks at the marks the two spellings share and
// says whether a Quran token is the lesson word or another word written
// with the same letters.
//
// It errs towards "same": a mark one spelling leaves out never splits,
// and the case ending (last letter, or the letter before an attached
// pronoun or an -an alif) is ignored. Checked against the Quranic Arabic
// Corpus lemmas it agrees on 99% of the Quran's lesson-word tokens; verb
// forms that differ only in vowels (أَنزَلَ / أُنزِلَ) count as different.
//
// Used by scripts/build-occurrence-index.js (counts and verse lists) and at
// runtime by the reader, the occurrence highlighter and the word drills.

var WORD_FORM_VOWELS = {
  'َ': 'a', 'ِ': 'i', 'ُ': 'u', 'ْ': '0', 'ۡ': '0',
  // tanwin (case ending)
  'ً': 'N', 'ٌ': 'N', 'ٍ': 'N', 'ࣰ': 'N', 'ࣱ': 'N', 'ࣲ': 'N',
  'ٖ': 'N', 'ٗ': 'N', 'ٞ': 'N',
};

// Letters the normalizer folds into a plainer one: [plain letter, hamza seat]
var WORD_FORM_SEATS = {
  'أ': ['ا', 'up'], 'إ': ['ا', 'down'], 'آ': ['ا', 'madd'],
  'ٱ': ['ا', 'wasl'], 'ؤ': ['و', 'up'], 'ئ': ['ي', 'up'],
  'ة': ['ه', ''], 'ى': ['ي', ''],
};

// Attached pronouns and the vowel on their first letter: before them the
// case ending sits inside the word (رَبُّنَا / رَبِّنَا)
var WORD_FORM_SUFFIXES = [
  ['هما', 'ui'], ['كما', 'u'], ['هم', 'ui'], ['هن', 'ui'],
  ['كم', 'u'], ['كن', 'u'], ['نا', 'a'], ['ها', 'a'],
  ['ه', 'ui'], ['ك', 'aiu'],
];

var WORD_FORM_OTHER_MARKS = /[ً-ٟؐ-ؚۖ-ۭ﴾﴿]/;

/**
 * The letters of a word as the normalizer counts them, each with its marks:
 * { b: plain letter, h: hamza seat, v: vowel, sh: shadda }. Null for a phrase.
 */
function wordFormLetters(text) {
  var letters = [];
  var hamza = '';
  var s = String(text || '').replace(/ـ/g, '');
  for (var k = 0; k < s.length; k++) {
    var c = s[k];
    var prev = letters[letters.length - 1];
    if (/\s/.test(c)) return null;
    if (WORD_FORM_VOWELS[c] !== undefined) { if (prev) prev.v = WORD_FORM_VOWELS[c]; continue; }
    if (c === 'ّ') { if (prev) prev.sh = true; continue; }
    if (c === 'ٰ') { // dagger alif: a letter, except in ىٰ
      if (!prev || prev.raw !== 'ى') letters.push({ b: 'ا', h: '', raw: c });
      continue;
    }
    if (c === 'ٔ' || c === 'ٕ') { hamza = c === 'ٔ' ? 'up' : 'down'; continue; } // seats the next alif
    if ((c === 'ۢ' || c === 'ۭ') && prev && prev.v) { prev.v = 'N'; continue; } // -an as vowel + small meem
    if (c === 'ٓ') { if (prev && prev.h === 'up') prev.h = 'madd'; continue; } // أٓ is آ
    if (WORD_FORM_OTHER_MARKS.test(c)) continue;
    if (c === 'ء') { // ءَا is one long alif (آ), as the normalizer reads it
      if (s[k + 1] === 'ا') { letters.push({ b: 'ا', h: 'madd', raw: c }); k++; }
      else if (s[k + 1] === 'َ' && s[k + 2] === 'ا') { letters.push({ b: 'ا', h: 'madd', v: 'a', raw: c }); k += 2; }
      else letters.push({ b: 'ا', h: 'up', raw: c });
      hamza = '';
      continue;
    }
    var seat = WORD_FORM_SEATS[c];
    letters.push({ b: seat ? seat[0] : c, h: seat ? seat[1] : (c === 'ا' ? hamza : ''), raw: c });
    hamza = '';
  }
  return letters;
}

// Hamza above vs below vs a joining alif; inside a word, a hamza vs a plain
// long alif (كَانَ / كَأَن). آ after a letter is also how the Quran text
// writes a plain long ā (ٱلضَّآلِّينَ), so it never splits.
function _wordFormHamzaClash(x, y, i) {
  if (x.h === y.h) return false;
  if (x.h && y.h) return true;
  var seat = x.h || y.h;
  return i > 0 && x.b === 'ا' && seat !== 'wasl' && seat !== 'madd';
}

function _wordFormSuffixLength(a, b) {
  var skeleton = a.map(function(x) { return x.b; }).join('');
  for (var i = 0; i < WORD_FORM_SUFFIXES.length; i++) {
    var suffix = WORD_FORM_SUFFIXES[i][0], vowels = WORD_FORM_SUFFIXES[i][1];
    var at = skeleton.length - suffix.length;
    if (at < 2 || skeleton.slice(at) !== suffix) continue;
    if ((!a[at].v || vowels.indexOf(a[at].v) >= 0) && (!b[at].v || vowels.indexOf(b[at].v) >= 0)) return suffix.length;
  }
  return 0;
}

function _wordFormBareAlif(x) { return x.b === 'ا' && !x.h && !x.v && !x.sh; }

/**
 * True unless the marks show that `token` (a Quran word) is a different
 * word from `word` (a lesson word) with the same letters.
 */
function arabicSameWord(word, token) {
  var a = wordFormLetters(word), b = wordFormLetters(token);
  if (!a || !b || a.length !== b.length) return true;
  for (var i = 0; i < a.length; i++) if (a[i].b !== b[i].b) return true; // the normalizer's call
  var end = a.length - 1 - _wordFormSuffixLength(a, b); // the case-ending letter
  // -an + silent alif (قَلِيلٗا): the ending is the letter before the alif,
  // where إِذٗا ("then") and إِذَا ("when") differ
  if (end === a.length - 1 && end > 0 && _wordFormBareAlif(a[end]) && _wordFormBareAlif(b[end]) &&
      (a[end - 1].v === 'N' || b[end - 1].v === 'N')) {
    var p = a[end - 1].v, q = b[end - 1].v;
    if (p && q && p !== q) return false;
    end--;
  }
  for (var j = 0; j < a.length; j++) {
    var x = a[j], y = b[j];
    if (_wordFormHamzaClash(x, y, j)) return false;
    if (j > end) continue;
    // Shadda, except on a first letter (مِّن, assimilated from the word
    // before). The Quran text always writes it, so its absence there counts.
    if (j > 0 && x.sh && !y.sh) return false;
    if (j > 0 && y.sh && !x.sh && x.v) return false;
    if (j === end) continue;
    if (x.v && y.v && x.v !== y.v && x.v !== 'N' && y.v !== 'N') return false;
  }
  return true;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { arabicSameWord: arabicSameWord, wordFormLetters: wordFormLetters };
