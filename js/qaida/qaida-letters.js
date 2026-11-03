// ═══════════════════════════════════════════════════════════════
// qaida-letters.js — The 28 Arabic letters, in Noorani Qaida order
//
// Data only. Names and descriptions live in strings-en.js under
// qaida.letter.<id>.name, so another language needs no change here.
//
//   id     stable skill id (also the strings key)
//   char   the letter on its own
//   joins  false for the six letters that never join the letter after them
//   group  letters that share one body shape (told apart by their dots)
//   sound  Latin hint for the letter's sound, used in "pick its sound"
//
// Letter forms are drawn with joiners (qaidaLetterForm), never with the
// Arabic presentation-form code points, which test/corpus-characters
// rejects as unrenderable.
// ═══════════════════════════════════════════════════════════════

var QAIDA_LETTERS = [
  { id: 'alif',  char: 'ا', joins: false, group: 'alif',  sound: 'a' },
  { id: 'ba',    char: 'ب', joins: true,  group: 'ba',    sound: 'b' },
  { id: 'ta',    char: 'ت', joins: true,  group: 'ba',    sound: 't' },
  { id: 'tha',   char: 'ث', joins: true,  group: 'ba',    sound: 'th' },
  { id: 'jim',   char: 'ج', joins: true,  group: 'jim',   sound: 'j' },
  { id: 'hha',   char: 'ح', joins: true,  group: 'jim',   sound: 'ḥ' },
  { id: 'kha',   char: 'خ', joins: true,  group: 'jim',   sound: 'kh' },
  { id: 'dal',   char: 'د', joins: false, group: 'dal',   sound: 'd' },
  { id: 'dhal',  char: 'ذ', joins: false, group: 'dal',   sound: 'dh' },
  { id: 'ra',    char: 'ر', joins: false, group: 'ra',    sound: 'r' },
  { id: 'zay',   char: 'ز', joins: false, group: 'ra',    sound: 'z' },
  { id: 'sin',   char: 'س', joins: true,  group: 'sin',   sound: 's' },
  { id: 'shin',  char: 'ش', joins: true,  group: 'sin',   sound: 'sh' },
  { id: 'sad',   char: 'ص', joins: true,  group: 'sad',   sound: 'ṣ' },
  { id: 'dad',   char: 'ض', joins: true,  group: 'sad',   sound: 'ḍ' },
  { id: 'tta',   char: 'ط', joins: true,  group: 'tta',   sound: 'ṭ' },
  { id: 'zza',   char: 'ظ', joins: true,  group: 'tta',   sound: 'ẓ' },
  { id: 'ain',   char: 'ع', joins: true,  group: 'ain',   sound: 'ʿ' },
  { id: 'ghayn', char: 'غ', joins: true,  group: 'ain',   sound: 'gh' },
  { id: 'fa',    char: 'ف', joins: true,  group: 'fa',    sound: 'f' },
  { id: 'qaf',   char: 'ق', joins: true,  group: 'fa',    sound: 'q' },
  { id: 'kaf',   char: 'ك', joins: true,  group: 'kaf',   sound: 'k' },
  { id: 'lam',   char: 'ل', joins: true,  group: 'lam',   sound: 'l' },
  { id: 'mim',   char: 'م', joins: true,  group: 'mim',   sound: 'm' },
  { id: 'nun',   char: 'ن', joins: true,  group: 'nun',   sound: 'n' },
  { id: 'ha',    char: 'ه', joins: true,  group: 'ha',    sound: 'h' },
  { id: 'waw',   char: 'و', joins: false, group: 'waw',   sound: 'w' },
  { id: 'ya',    char: 'ي', joins: true,  group: 'ya',    sound: 'y' },
];

var _ZWJ = '‍';

/**
 * A letter as it looks at a position in a word, drawn with zero-width
 * joiners so the font picks the joined shape. A letter that never joins
 * forward looks the same at the start as on its own, and the same in the
 * middle as at the end.
 * @param {Object} letter - an entry of QAIDA_LETTERS
 * @param {'isolated'|'initial'|'medial'|'final'} position
 * @returns {string}
 */
function qaidaLetterForm(letter, position) {
  var c = letter.char;
  if (position === 'initial') return letter.joins ? c + _ZWJ : c;
  if (position === 'medial') return letter.joins ? _ZWJ + c + _ZWJ : _ZWJ + c;
  if (position === 'final') return _ZWJ + c;
  return c;
}

/** @returns {Object|null} the letter with this id */
function getQaidaLetter(id) {
  for (var i = 0; i < QAIDA_LETTERS.length; i++) {
    if (QAIDA_LETTERS[i].id === id) return QAIDA_LETTERS[i];
  }
  return null;
}
