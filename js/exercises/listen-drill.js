/**
 * listen-drill.js — "Hear the word": a Practice drill that plays quran.com's
 * recording of a word the learner has learned and asks what it means.
 *
 * Fairness: only a word recorded as one clip of its own is asked (not one
 * quran.com splits in two, nor one whose clip runs on into the next word),
 * and no wrong option has the same meaning as the answer. Words come from
 * the ayahs word-drills.js uses (Al-Fatihah and Juz Amma, once loaded).
 * Pass a random() returning [0, 1) to make a pick repeatable.
 * Depends on word-drills.js, audio.js (wordAudioUrl, quranWordPositions),
 * exercise-engine.js and i18n (t) at call time.
 */

var LISTEN_DRILL_OPTION_COUNT = 4;

/** Every loaded drill ayah with its word meanings: [{ surah, ayah, tokens, w, ws }]. */
function _listenDrillAyahs() {
  var loader = window.__quranLoader;
  var ayahs = [];
  if (!loader) return ayahs;
  DRILL_SURAH_IDS.forEach(function(surah) {
    if (!loader.isSurahLoaded(surah)) return;
    var count = loader.getSurahVerseCount(surah);
    for (var ayah = 1; ayah <= count; ayah++) {
      var verse = loader.getVerse(surah, ayah);
      if (verse) ayahs.push({ surah: surah, ayah: ayah, tokens: drillWords(verse.text), w: verse.w, ws: verse.ws });
    }
  });
  return ayahs;
}

/**
 * The recording of each learned word, keyed as learnedWordsByForm() keys
 * them: { key: [url, ...] }. Only words that are one clip of their own.
 */
function _listenDrillClips(ayahs, learned) {
  var keysByNorm = {};
  Object.keys(learned).forEach(function(key) {
    var norm = drillNormalize(learned[key].arabic);
    (keysByNorm[norm] = keysByNorm[norm] || []).push(key);
  });
  var clips = {};
  ayahs.forEach(function(a) {
    // Without a meaning per word, quran.com's numbering can't be trusted.
    if (!Array.isArray(a.w) || a.w.length !== a.tokens.length) return;
    var positions = quranWordPositions(a.tokens.length, a.w, a.ws || null);
    a.tokens.forEach(function(token, i) {
      if (positions[i].length !== 1 || a.w[i + 1] === 0) return;
      (keysByNorm[drillNormalize(token)] || []).forEach(function(key) {
        if (!drillSameWord(learned[key].arabic, token)) return;
        (clips[key] = clips[key] || []).push(wordAudioUrl(a.surah, a.ayah, positions[i][0]));
      });
    });
  });
  return clips;
}

/** A meaning reduced for comparing: "(the) Lord" and "Lord" are the same. */
function _listenDrillMeaningKey(meaning) {
  return String(meaning).toLowerCase().replace(/[()[\]]/g, '').replace(/^\s*the\s+/, '').replace(/\s+/g, ' ').trim();
}

function _listenDrillShuffle(list, random) {
  var out = list.slice();
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.min(i, Math.floor(random() * (i + 1)));
    var swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/** Three meanings of other words, none the same as the answer or each other. */
function _listenDrillWrongOptions(answer, random) {
  var taken = {};
  taken[_listenDrillMeaningKey(answer)] = true;
  var pool = [];
  getCanonicalWords().forEach(function(word) {
    var key = word.english ? _listenDrillMeaningKey(word.english) : '';
    if (!key || taken[key]) return;
    taken[key] = true;
    pool.push(word.english);
  });
  return _listenDrillShuffle(pool, random).slice(0, LISTEN_DRILL_OPTION_COUNT - 1);
}

/**
 * A listen-choose item: hear a learned word, pick its meaning. Null when
 * nothing is learned or no loaded ayah has a clip of a learned word.
 */
function buildListenDrill(random) {
  var rand = random || Math.random;
  if (!hasLearnedWords()) return null;
  var clips = _listenDrillClips(_listenDrillAyahs(), learnedWordsByForm());
  var keys = Object.keys(clips).sort();
  if (keys.length === 0) return null;
  var key = drillPick(keys, rand);
  var word = learnedWordsByForm()[key];
  var wrong = _listenDrillWrongOptions(word.english, rand);
  if (wrong.length < LISTEN_DRILL_OPTION_COUNT - 1) return null;
  var at = Math.min(Math.floor(rand() * LISTEN_DRILL_OPTION_COUNT), LISTEN_DRILL_OPTION_COUNT - 1);
  var options = wrong.slice(0, at).concat([word.english], wrong.slice(at));
  var item = {
    type: 'listen-choose',
    prompt: { audio: drillPick(clips[key], rand), ask: t('drill.listen.prompt') },
    options: options,
    answer: at,
    tag: DRILL_TAG,
  };
  return validateExercise(item) === null ? item : null;
}
