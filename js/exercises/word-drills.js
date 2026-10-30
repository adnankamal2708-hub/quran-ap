/**
 * word-drills.js — builders for the audio-free Practice drills.
 *
 * "Spot the word" asks the learner to tap, in an ayah, the word that means a
 * word they have learned. "Build the verse" asks them to put the words of a
 * short ayah back in order. Both return a shared exercise item (see
 * exercise-engine.js) or null when no fair question can be made.
 *
 * Ayahs come from Al-Fatihah and Juz Amma through window.__quranLoader; only
 * surahs whose text is already loaded are used (the drill screen loads them
 * first). Pass a random() returning [0, 1) to make a pick repeatable.
 * Depends on exercise-engine.js, i18n (t), srs.js (loadSRS) and
 * vocabulary (getCanonicalWords) at call time.
 */

var DRILL_JUZ_AMMA_FIRST_SURAH = 78;
var DRILL_JUZ_AMMA_LAST_SURAH = 114;
var DRILL_SURAH_IDS = (function() {
  var ids = [1];
  for (var id = DRILL_JUZ_AMMA_FIRST_SURAH; id <= DRILL_JUZ_AMMA_LAST_SURAH; id++) ids.push(id);
  return ids;
})();

var DRILL_LEARNED_MIN_STAGE = 1;
var DRILL_SPOT_MIN_TOKENS = 3;
var DRILL_SPOT_MAX_TOKENS = 12;
var DRILL_BUILD_MIN_WORDS = 3;
var DRILL_BUILD_MAX_WORDS = 5;
var DRILL_SHUFFLE_ATTEMPTS = 10;
var DRILL_TAG = 'drill';

function drillNormalize(text) {
  return typeof window.OCCURRENCE_INDEX_NORM === 'function' ? window.OCCURRENCE_INDEX_NORM(text) : '';
}

function drillPick(list, random) {
  var index = Math.floor((random || Math.random)() * list.length);
  return list[Math.min(index, list.length - 1)];
}

function drillSameOrder(left, right) {
  return left.every(function(value, i) { return value === right[i]; });
}

function drillWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

/** Every ayah of the drill surahs whose text is loaded: [{ words, translation }]. */
function loadedDrillAyahs() {
  var loader = window.__quranLoader;
  var ayahs = [];
  if (!loader) return ayahs;
  DRILL_SURAH_IDS.forEach(function(surahId) {
    if (!loader.isSurahLoaded(surahId)) return;
    var count = loader.getSurahVerseCount(surahId);
    for (var verseId = 1; verseId <= count; verseId++) {
      var verse = loader.getVerse(surahId, verseId);
      if (verse) ayahs.push({ words: drillWords(verse.text), translation: verse.translation || '' });
    }
  });
  return ayahs;
}

/** True when the learner has learned at least one word (SRS stage >= 1). */
function hasLearnedWords() {
  var srs = loadSRS();
  return Object.keys(srs).some(function(id) {
    return srs[id] && srs[id].stage >= DRILL_LEARNED_MIN_STAGE;
  });
}

/**
 * Learned words that have one clear meaning, keyed by normalized form.
 * A form shared by words with different meanings (e.g. ٱلدِّينِ) is left out:
 * the question "which word means X" would have no single right answer.
 */
function learnedWordsByForm() {
  var srs = loadSRS();
  var meaningsByForm = {};
  var words = getCanonicalWords();
  words.forEach(function(word) {
    var form = drillNormalize(word.arabic);
    if (!form || !word.english) return;
    meaningsByForm[form] = meaningsByForm[form] || {};
    meaningsByForm[form][word.english] = true;
  });
  var learned = {};
  words.forEach(function(word) {
    var entry = srs[word.id];
    var form = drillNormalize(word.arabic);
    if (!entry || entry.stage < DRILL_LEARNED_MIN_STAGE || !form || !word.english) return;
    if (Object.keys(meaningsByForm[form]).length === 1 && !learned[form]) learned[form] = word;
  });
  return learned;
}

function spotCandidates(ayahs, learned) {
  var candidates = [];
  ayahs.forEach(function(ayah) {
    if (ayah.words.length < DRILL_SPOT_MIN_TOKENS || ayah.words.length > DRILL_SPOT_MAX_TOKENS) return;
    var answers = {};
    ayah.words.forEach(function(token, index) {
      var form = drillNormalize(token);
      if (!learned[form]) return;
      answers[form] = answers[form] || [];
      answers[form].push(index);
    });
    Object.keys(answers).forEach(function(form) {
      // An answer covering the whole ayah would give the question away.
      if (answers[form].length < ayah.words.length) {
        candidates.push({ tokens: ayah.words, answer: answers[form], word: learned[form] });
      }
    });
  });
  return candidates;
}

/**
 * A spot item: tap every token of an ayah that is the learned word. Null when
 * nothing is learned or no loaded ayah holds a learned word.
 */
function buildSpotDrill(random) {
  if (!hasLearnedWords()) return null;
  var candidates = spotCandidates(loadedDrillAyahs(), learnedWordsByForm());
  if (candidates.length === 0) return null;
  var pick = drillPick(candidates, random);
  var item = {
    type: 'spot',
    prompt: { text: t('drill.spot.prompt', { meaning: pick.word.english }) },
    tokens: pick.tokens,
    answer: pick.answer,
    tag: DRILL_TAG,
  };
  return validateExercise(item) === null ? item : null;
}

/** The words in a random order that is never the answer order. */
function shuffleOutOfOrder(words, random) {
  var rand = random || Math.random;
  for (var attempt = 0; attempt < DRILL_SHUFFLE_ATTEMPTS; attempt++) {
    var pieces = words.slice();
    for (var i = pieces.length - 1; i > 0; i--) {
      var j = Math.min(i, Math.floor(rand() * (i + 1)));
      var swap = pieces[i];
      pieces[i] = pieces[j];
      pieces[j] = swap;
    }
    if (!drillSameOrder(pieces, words)) return pieces;
  }
  // Unlucky shuffles: a rotation differs unless every word is the same.
  for (var shift = 1; shift < words.length; shift++) {
    var rotated = words.slice(shift).concat(words.slice(0, shift));
    if (!drillSameOrder(rotated, words)) return rotated;
  }
  return null;
}

/**
 * A build item: the words of a 3-5 word ayah to put in order, prompted by its
 * translation. Null when no loaded ayah fits.
 */
function buildVerseBuildDrill(random) {
  var candidates = loadedDrillAyahs().filter(function(ayah) {
    var distinct = ayah.words.filter(function(word, i) { return ayah.words.indexOf(word) === i; });
    return ayah.translation && distinct.length > 1 &&
      ayah.words.length >= DRILL_BUILD_MIN_WORDS && ayah.words.length <= DRILL_BUILD_MAX_WORDS;
  });
  if (candidates.length === 0) return null;
  var ayah = drillPick(candidates, random);
  var pieces = shuffleOutOfOrder(ayah.words, random);
  if (!pieces) return null;
  var item = { type: 'build', prompt: { text: ayah.translation }, pieces: pieces, answer: ayah.words, tag: DRILL_TAG };
  return validateExercise(item) === null ? item : null;
}
