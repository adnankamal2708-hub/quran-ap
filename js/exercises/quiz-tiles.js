// ═══════════════════════════════════════════════════════════════
// quiz-tiles.js — the "Arabic from English" tiles question in the
// lesson quiz. A few words of a real ayah around the lesson word are
// shown as their checked word-by-word English meanings (verse.w, added
// at build time from data-sources/quran-wbw-en.json); the learner taps
// the Arabic words in order. Spare tiles are other words of the same
// ayah, so every tile is in the same script.
// Uses _quizVerseCandidates() from quiz-verse.js.
// ═══════════════════════════════════════════════════════════════

/** Question number 2, 6, 10, ... of a quiz is a tiles question. */
var QUIZ_TILES_EVERY = 4;
var QUIZ_TILES_OFFSET = 1;

/** Words in the phrase to build, and spare tiles added to them. */
var QUIZ_TILES_PHRASE = 3;
var QUIZ_TILES_SPARE = 2;

/** Pause marks (U+06D6–U+06DC) would show where a clause ends, so tiles drop them. */
var QUIZ_TILES_PAUSE_MARKS = /[\u06D6-\u06DC]/g;

/** True when question number `index` (0-based) should be a tiles question. */
function isQuizTilesSlot(index) {
  return index % QUIZ_TILES_EVERY === QUIZ_TILES_OFFSET;
}

/**
 * The ayah's words with their meanings. A token whose meaning is 0 belongs to
 * the word before it (e.g. بَعۡدَ مَا "after what"), so the two are one word.
 * `pause` marks a word that ends a clause. Null when any word has no meaning.
 * @returns {Array<{text: string, gloss: string, first: number, last: number, pause: boolean}>|null}
 */
function quizTilesWords(tokens, glosses) {
  if (!glosses || glosses.length !== tokens.length) return null;
  var words = [];
  for (var i = 0; i < tokens.length; i++) {
    var text = tokens[i].replace(QUIZ_TILES_PAUSE_MARKS, '');
    var pause = text !== tokens[i];
    if (glosses[i] === 0 && words.length) {
      var prev = words[words.length - 1];
      prev.text += ' ' + text;
      prev.last = i;
      prev.pause = prev.pause || pause;
      continue;
    }
    if (typeof glosses[i] !== 'string' || !glosses[i].trim() || !text) return null;
    words.push({ text: text, gloss: glosses[i].trim(), first: i, last: i, pause: pause });
  }
  return words;
}

/** Vowel and reading marks, so ٱللَّهَ and ٱللَّهُ count as the same spelling. */
var QUIZ_TILES_MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/** A meaning without its bracketed helper words: "(is) Allah" and "Allah" match. */
function _quizTilesGlossKey(gloss) {
  return String(gloss).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-z]+/g, ' ').trim();
}

function _quizTilesTextKey(text) { return String(text).replace(QUIZ_TILES_MARKS, ''); }

/** True when `w` could be mistaken for one of the words already taken. */
function _quizTilesClash(w, taken) {
  var g = _quizTilesGlossKey(w.gloss), t = _quizTilesTextKey(w.text);
  return !g || taken.some(function (x) { return x.g === g || x.t === t; });
}

/**
 * A tiles question from one occurrence of the word, or null when no loaded
 * ayah gives a fair one: the word once in the ayah, three words around it
 * with different meanings and spellings, and at least one spare tile.
 * @returns {{glosses: string[], answer: string[], tiles: string[], ref: string, translation: string}|null}
 */
function buildQuizTiles(word, loader) {
  if (!word || !loader || typeof _quizVerseCandidates !== 'function') return null;
  var candidates = _quizVerseCandidates(word);
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!loader.isSurahLoaded(c.surahId)) continue;
    var verse = loader.getVerse(c.surahId, c.ayah);
    var tokens = verse ? String(verse.text || '').split(/\s+/).filter(Boolean) : [];
    var at = tokens.indexOf(c.token);
    if (at < 0 || tokens.indexOf(c.token, at + 1) >= 0) continue;
    var words = quizTilesWords(tokens, verse.w);
    if (!words || words.length < QUIZ_TILES_PHRASE + 1) continue;
    var question = _quizTilesFrom(words, at);
    if (!question) continue;
    question.ref = c.surahId + ':' + c.ayah;
    question.translation = verse.translation || '';
    return question;
  }
  return null;
}

/**
 * Where the phrase starts: it holds token `at`, is centred on it where it can
 * be, and stays inside one clause (no pause mark before its last word).
 * -1 when every phrase holding the word crosses a pause.
 */
function _quizTilesStart(words, at) {
  var centre = 0;
  while (words[centre].last < at) centre++;
  var last = words.length - QUIZ_TILES_PHRASE;
  var tries = [centre - 1, centre, centre - 2];
  for (var t = 0; t < tries.length; t++) {
    var start = tries[t];
    if (start < 0 || start > last) continue;
    var crosses = words.slice(start, start + QUIZ_TILES_PHRASE - 1).some(function (w) { return w.pause; });
    if (!crosses) return start;
  }
  return -1;
}

/** The question for the phrase around token `at`, or null when no fair one fits. */
function _quizTilesFrom(words, at) {
  var start = _quizTilesStart(words, at);
  if (start < 0) return null;
  var phrase = words.slice(start, start + QUIZ_TILES_PHRASE);

  var taken = [];
  for (var i = 0; i < phrase.length; i++) {
    if (_quizTilesClash(phrase[i], taken)) return null;
    taken.push({ g: _quizTilesGlossKey(phrase[i].gloss), t: _quizTilesTextKey(phrase[i].text) });
  }

  // Spare tiles: the nearest other words of the ayah, never one that could
  // pass for a phrase word (same letters or same meaning).
  var spares = [];
  var others = words.slice(start + QUIZ_TILES_PHRASE).concat(words.slice(0, start).reverse());
  for (var j = 0; j < others.length && spares.length < QUIZ_TILES_SPARE; j++) {
    if (_quizTilesClash(others[j], taken)) continue;
    taken.push({ g: _quizTilesGlossKey(others[j].gloss), t: _quizTilesTextKey(others[j].text) });
    spares.push(others[j].text);
  }
  if (!spares.length) return null;

  var answer = phrase.map(function (p) { return p.text; });
  return {
    glosses: phrase.map(function (p) { return p.gloss; }),
    answer: answer,
    tiles: shuffleArray(answer.concat(spares)),
  };
}

/** True when the tiles were put in the phrase's order. */
function isQuizTilesCorrect(chosen, answer) {
  return chosen.length === answer.length && chosen.join(' ') === answer.join(' ');
}

/**
 * The tiles question for question `index`, or null when this is not a tiles
 * slot or no fair one can be built (then the quiz asks the meaning instead).
 */
function buildQuizTilesQuestion(word, index) {
  if (!isQuizTilesSlot(index)) return null;
  return buildQuizTiles(word, window.__quranLoader);
}

/** Starts loading the surahs the tiles questions need. Failures only mean fewer tiles questions. */
function preloadQuizTiles(words) {
  var loader = window.__quranLoader;
  if (!loader) return;
  var ids = [];
  words.forEach(function (word, i) {
    if (!isQuizTilesSlot(i)) return;
    _quizVerseCandidates(word).forEach(function (c) {
      if (ids.indexOf(c.surahId) < 0) ids.push(c.surahId);
    });
  });
  ids.forEach(function (id) { loader.loadSurah(id).catch(function () {}); });
}
