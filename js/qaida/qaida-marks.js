// ═══════════════════════════════════════════════════════════════
// qaida-marks.js — The marks and extra letter shapes a reader must know,
// and which skills a written word needs
//
// Data only; names live in strings-en.js under qaida.mark.<id>.name.
//
//   QAIDA_MARKS        the non-letter skills, in the order they are taught
//   QAIDA_SKILL_IDS    every skill (28 letters, then the marks), in a
//                      fixed order: a skill's index is its bit in the
//                      readability masks (js/qaida/qaida-readability.js)
//   qaidaWordSkills()  the skills needed to read one word of the Quran
//                      text (Uthmani script, as in js/quran/quran-data.js)
//
// Depends on: qaida-letters.js
// ═══════════════════════════════════════════════════════════════

// sample: the mark shown on a carrier letter; sound: what it adds to the
// letter's sound in "pick its sound" exercises (empty when it adds none).
var QAIDA_MARKS = [
  { id: 'hamza',        sample: 'ء',             sound: 'ʾ' },
  { id: 'ta-marbuta',   sample: 'ة',             sound: 'h' },
  { id: 'alif-maqsura', sample: 'ى',             sound: 'ā' },
  { id: 'fatha',        sample: 'بَ',       sound: 'a' },
  { id: 'kasra',        sample: 'بِ',       sound: 'i' },
  { id: 'damma',        sample: 'بُ',       sound: 'u' },
  { id: 'fathatan',     sample: 'بً',       sound: 'an' },
  { id: 'kasratan',     sample: 'بٍ',       sound: 'in' },
  { id: 'dammatan',     sample: 'بٌ',       sound: 'un' },
  { id: 'long-vowels',  sample: 'بَا', sound: 'ā' },
  { id: 'sukun',        sample: 'بْ',       sound: '' },
  { id: 'shadda',       sample: 'بّ',       sound: '' },
  { id: 'maddah',       sample: 'آ',             sound: 'ā' },
  { id: 'wasl',         sample: 'ٱ',             sound: '' },
  { id: 'silent',       sample: 'ا۠',       sound: '' },
];

var QAIDA_SKILL_IDS = QAIDA_LETTERS.map(function (l) { return l.id; })
  .concat(QAIDA_MARKS.map(function (m) { return m.id; }));

// Every Arabic code point in the Quran text, mapped to the skills it needs.
// Letters map through QAIDA_LETTERS; the entries below cover the rest.
// Code points not listed and not letters are pause, sajdah and tajweed
// signs (U+06D6–U+06ED, tatweel): they don't change how a word is read
// aloud at the reading stage, so they need no skill.
var _QAIDA_EXTRA_CHARS = {
  'ء': ['hamza'],
  'آ': ['alif', 'maddah'],
  'أ': ['alif', 'hamza'],
  'إ': ['alif', 'hamza'],
  'ؤ': ['waw', 'hamza'],
  'ئ': ['ya', 'hamza'],
  'ٔ': ['hamza'],
  'ٕ': ['hamza'],
  'ة': ['ta-marbuta'],
  'ى': ['alif-maqsura'],
  'َ': ['fatha'],
  'ِ': ['kasra'],
  'ُ': ['damma'],
  // Open tanwin is written with these in this edition of the text
  'ً': ['fathatan'], 'ٞ': ['fathatan'],
  'ٍ': ['kasratan'], 'ٖ': ['kasratan'],
  'ٌ': ['dammatan'], 'ٗ': ['dammatan'],
  'ْ': ['sukun'], 'ۡ': ['sukun'],
  'ّ': ['shadda'],
  'ٓ': ['maddah'], 'ۤ': ['maddah'],
  'ٰ': ['long-vowels'], 'ۥ': ['long-vowels'], 'ۦ': ['long-vowels'], 'ۧ': ['long-vowels'],
  'ٱ': ['wasl'],
  '۠': ['silent'],
};

var _QAIDA_CHAR_SKILLS = (function () {
  var map = {};
  QAIDA_LETTERS.forEach(function (l) { map[l.char] = [l.id]; });
  Object.keys(_QAIDA_EXTRA_CHARS).forEach(function (c) { map[c] = _QAIDA_EXTRA_CHARS[c]; });
  return map;
})();

// Marks that sit on a letter (vowels, tanwin, sukun, shadda, maddah)
var _QAIDA_ON_LETTER = /[ً-ٖٓٗٞۡ]/;

/**
 * The skills needed to read a word: its letters and marks, plus
 * long-vowels when ا, و, ي or ى follows a letter without a mark of its own
 * (a letter of madd, as in قَالَ).
 * @param {string} word - one word of Quran text
 * @returns {string[]} skill ids, each once
 */
function qaidaWordSkills(word) {
  var seen = {};
  var out = [];
  function add(id) { if (!seen[id]) { seen[id] = true; out.push(id); } }
  var chars = Array.from(String(word || ''));
  for (var i = 0; i < chars.length; i++) {
    var c = chars[i];
    var skills = _QAIDA_CHAR_SKILLS[c];
    if (!skills) continue;
    skills.forEach(add);
    var isMaddLetter = c === 'ا' || c === 'و' || c === 'ي' || c === 'ى';
    if (isMaddLetter && i > 0 && !_QAIDA_ON_LETTER.test(chars[i + 1] || '')) add('long-vowels');
  }
  return out;
}
