// ═══════════════════════════════════════════════════════════════
// quiz-length.js — how many questions a lesson quiz asks.
// The learner picks Short, Normal or Long; the choice is kept on this
// device. A quiz never asks fewer questions than the lesson has words,
// and fills the rest by asking lesson words again.
// ═══════════════════════════════════════════════════════════════

var QUIZ_LENGTHS = { short: 10, normal: 15, long: 25 };
var QUIZ_LENGTH_DEFAULT = 'normal';
var QUIZ_LENGTH_KEY = 'quran_quiz_length';

/** The chosen length: 'short', 'normal' or 'long'. */
function getQuizLength() {
  try {
    var saved = localStorage.getItem(QUIZ_LENGTH_KEY);
    if (QUIZ_LENGTHS.hasOwnProperty(saved)) return saved;
  } catch (e) { /* storage blocked: use the default */ }
  return QUIZ_LENGTH_DEFAULT;
}

/** Saves a length. Returns false for an unknown one. */
function setQuizLength(length) {
  if (!QUIZ_LENGTHS.hasOwnProperty(length)) return false;
  try { localStorage.setItem(QUIZ_LENGTH_KEY, length); } catch (e) { /* kept for this visit only */ }
  return true;
}

/**
 * The words to ask, in order: every lesson word once, then more rounds of
 * the lesson words until there are `count` questions. The same word is never
 * asked twice in a row.
 * @param {Array} words - the lesson's words
 * @param {number} count - questions wanted
 * @param {function(Array): Array} shuffle - returns a shuffled copy
 */
function buildQuizRounds(words, count, shuffle) {
  if (!words || words.length === 0) return [];
  var total = Math.max(count, words.length);
  var list = shuffle(words);
  while (list.length < total) {
    var round = shuffle(words);
    if (round.length > 1 && round[0] === list[list.length - 1]) round.push(round.shift());
    list = list.concat(round);
  }
  return list.slice(0, total);
}
