// ═══════════════════════════════════════════════════════════════
// salah-exercises.js — Exercise items for the Salah track's lessons
//
// Every item is a read-choose (js/exercises/exercise-engine.js) with four
// options, built from a seed so the same lesson and seed give the same
// questions:
//   word item    { prompt: { arabic, ask }, word }    pick the word's meaning
//   phrase item  { prompt: { arabic, ask }, phrase }  pick the phrase's meaning
//   figure item  { prompt: { text }, figure }         name the position shown
// Wrong options never share or contain the right meaning's words, so no
// question has two right answers.
// ═══════════════════════════════════════════════════════════════

/** Questions in a level's reading check */
var SALAH_CHECK_ITEMS = 20;

/** Options per question: the answer and three others */
var SALAH_OPTION_COUNT = 4;

/** A meaning's words, lower case and padded with spaces. */
function _salahPadded(text) {
  return ' ' + String(text).toLowerCase().replace(/[^a-zĀ-ɏḀ-ỿ']+/g, ' ').trim() + ' ';
}

/**
 * Two meanings too close to both be offered: the same words, or one's
 * words inside the other's ("Allah" and "O Allah").
 */
function _salahTooClose(a, b) {
  var x = _salahPadded(a);
  var y = _salahPadded(b);
  return x.indexOf(y) >= 0 || y.indexOf(x) >= 0;
}

/** A read-choose item: the answer plus the first distinct others, shuffled. */
function _salahChoice(prompt, answer, pool, rnd, extra) {
  var options = [answer];
  qaidaShuffle(pool, rnd).forEach(function (x) {
    if (options.length >= SALAH_OPTION_COUNT) return;
    if (!options.some(function (o) { return _salahTooClose(o, x); })) options.push(x);
  });
  options = qaidaShuffle(options, rnd);
  var item = { type: 'read-choose', prompt: prompt, options: options, answer: options.indexOf(answer) };
  Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
  return item;
}

var _salahWordMeanings = null;

/** Every distinct word meaning in the prayer data. */
function _salahAllWordMeanings() {
  if (_salahWordMeanings) return _salahWordMeanings;
  var seen = {};
  _salahWordMeanings = [];
  SALAH_PHRASES.forEach(function (p) {
    p.words.forEach(function (w) {
      var k = w.en.trim().toLowerCase();
      if (!seen[k]) { seen[k] = true; _salahWordMeanings.push(w.en); }
    });
  });
  return _salahWordMeanings;
}

/** The meanings of whole phrases and of each taught part. */
function _salahAllPhraseMeanings() {
  var out = [];
  SALAH_PHRASES.forEach(function (p) {
    if (p.parts) p.parts.forEach(function (part) { out.push(part.en); });
    else out.push(p.en);
  });
  return out;
}

function _salahWordItem(word, rnd) {
  return _salahChoice({ arabic: word.ar, ask: t('salah.ex.wordMeaning') }, word.en,
    _salahAllWordMeanings(), rnd, { word: word });
}

function _salahPhraseItem(phrase, rnd) {
  return _salahChoice({ arabic: phrase.ar, ask: t('salah.ex.phraseMeaning') }, phrase.en,
    _salahAllPhraseMeanings(), rnd, { phrase: phrase });
}

function _salahFigureItem(step, rnd) {
  var names = SALAH_STEP_IDS.map(function (s) { return t('salah.step.' + s); });
  return _salahChoice({ text: t('salah.figure.which') }, t('salah.step.' + step), names, rnd, { figure: step });
}

/** The distinct words of some phrases, in reading order. */
function _salahDistinctWords(phrases) {
  var words = [];
  phrases.forEach(function (p) {
    p.words.forEach(function (w) {
      if (!words.some(function (x) { return x.ar === w.ar && x.en === w.en; })) words.push(w);
    });
  });
  return words;
}

/**
 * The questions of one lesson for a learner of this madhab: a lesson asks
 * each of its words, then each phrase; the walkthrough names each position;
 * a check asks up to SALAH_CHECK_ITEMS of its level's words.
 */
function buildSalahLessonItems(lesson, seed, madhab) {
  var rnd = qaidaRandom(seed);
  if (lesson.kind === 'walkthrough') {
    return SALAH_STEP_IDS.map(function (s) { return _salahFigureItem(s, rnd); });
  }
  if (lesson.kind === 'check') {
    var phrases = [];
    getSalahLevelLessons(lesson.level).forEach(function (l) {
      if (l.kind === 'lesson') phrases = phrases.concat(salahLessonPhrases(l, madhab));
    });
    return qaidaShuffle(_salahDistinctWords(phrases), rnd).slice(0, SALAH_CHECK_ITEMS)
      .map(function (w) { return _salahWordItem(w, rnd); });
  }
  var own = salahLessonPhrases(lesson, madhab);
  return _salahDistinctWords(own).map(function (w) { return _salahWordItem(w, rnd); })
    .concat(own.map(function (p) { return _salahPhraseItem(p, rnd); }));
}

/** A question about the word with this progress key (salahWordKey), or null. */
function buildSalahReviewItem(key, seed) {
  for (var i = 0; i < SALAH_PHRASES.length; i++) {
    var words = SALAH_PHRASES[i].words;
    for (var j = 0; j < words.length; j++) {
      if (salahWordKey(words[j]) === key) return _salahWordItem(words[j], qaidaRandom(seed));
    }
  }
  return null;
}
