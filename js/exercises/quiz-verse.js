// ═══════════════════════════════════════════════════════════════
// quiz-verse.js — the verse fill-in question in the lesson quiz.
// A real ayah is shown with one word blanked out and its English
// meaning in the gap; the learner picks the Arabic word that fits.
// The ayah always comes from the Quran text (js/quran), never from a
// word's hand-written excerpt, and is used only when the word appears
// exactly once in it.
// ═══════════════════════════════════════════════════════════════

/** Every this-many questions, one is a verse fill-in (4th, 8th, ...). */
var QUIZ_VERSE_EVERY = 4;

/** Words shown on each side of the blank before the ayah is cut with "…". */
var QUIZ_VERSE_CONTEXT = 7;

/** Occurrences tried per word, so a quiz loads only a few surah files. */
var QUIZ_VERSE_TRIES = 2;

var QUIZ_VERSE_OPTIONS = 4;
var QUIZ_VERSE_MIN_OPTIONS = 3;

/** True when question number `index` (0-based) should be a verse fill-in. */
function isQuizVerseSlot(index) {
  return index % QUIZ_VERSE_EVERY === QUIZ_VERSE_EVERY - 1;
}

/** The occurrences of a word that can be blanked: one highlighted token and a verse key. */
function _quizVerseCandidates(word) {
  var out = [];
  (word.occurrences || []).forEach(function (o) {
    if (out.length >= QUIZ_VERSE_TRIES || !o.verseKey || !o.ayahA) return;
    var m = /<span class="ayah-highlight">([^<]*)<\/span>/.exec(o.ayahA);
    var token = m ? m[1].trim() : '';
    if (!token || /\s/.test(token)) return;
    var parts = String(o.verseKey).split(':');
    var surahId = Number(parts[0]);
    var ayah = Number(parts[1]);
    if (surahId && ayah) out.push({ surahId: surahId, ayah: ayah, token: token });
  });
  return out;
}

/** Surah ids to load so the verse questions of this quiz can be built. */
function quizVerseSurahIds(words) {
  var ids = [];
  words.forEach(function (word, i) {
    if (!isQuizVerseSlot(i)) return;
    _quizVerseCandidates(word).forEach(function (c) {
      if (ids.indexOf(c.surahId) < 0) ids.push(c.surahId);
    });
  });
  return ids;
}

/**
 * The ayah around one occurrence of the word, or null when no occurrence's
 * surah is loaded or the word isn't exactly one token of the ayah.
 * @returns {{before: string, after: string, token: string, ref: string, translation: string}|null}
 */
function buildQuizVerse(word, loader) {
  if (!word || !loader) return null;
  var candidates = _quizVerseCandidates(word);
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!loader.isSurahLoaded(c.surahId)) continue;
    var verse = loader.getVerse(c.surahId, c.ayah);
    var tokens = verse ? String(verse.text || '').split(/\s+/).filter(Boolean) : [];
    var at = tokens.indexOf(c.token);
    if (at < 0 || tokens.indexOf(c.token, at + 1) >= 0) continue;
    var start = Math.max(0, at - QUIZ_VERSE_CONTEXT);
    var end = Math.min(tokens.length, at + 1 + QUIZ_VERSE_CONTEXT);
    return {
      before: (start > 0 ? '… ' : '') + tokens.slice(start, at).join(' '),
      after: tokens.slice(at + 1, end).join(' ') + (end < tokens.length ? ' …' : ''),
      token: c.token,
      ref: c.surahId + ':' + c.ayah,
      translation: verse.translation || '',
    };
  }
  return null;
}

/**
 * Arabic options for the blank: the word plus up to three words with a
 * different form and meaning, taken first from the lesson, then from
 * related words. Null when fewer than three options can be made.
 */
function buildQuizVerseOptions(word, lessonWords, related) {
  var meaning = getShortMeaning(word.meaning);
  var options = [word.arabic];
  var meanings = [meaning];
  lessonWords.concat(related || []).forEach(function (w) {
    if (options.length >= QUIZ_VERSE_OPTIONS || !w || w === word || !w.arabic) return;
    var m = getShortMeaning(w.meaning);
    if (options.indexOf(w.arabic) >= 0 || meanings.indexOf(m) >= 0) return;
    if (sharesQuizSense(word, w)) return;
    options.push(w.arabic);
    meanings.push(m);
  });
  return options.length >= QUIZ_VERSE_MIN_OPTIONS ? shuffleArray(options) : null;
}

/** Related words offered to the option picker after the lesson's own words. */
var QUIZ_VERSE_RELATED = 6;

/**
 * The verse question for question `index`, or null when this is not a verse
 * slot or no fair one can be built (then the quiz asks the meaning instead).
 * @returns {{verse: Object, options: string[]}|null}
 */
function buildQuizVerseQuestion(word, index, lessonWords) {
  if (!isQuizVerseSlot(index)) return null;
  var verse = buildQuizVerse(word, window.__quranLoader);
  if (!verse) return null;
  var related = typeof getDistractors === 'function' ? getDistractors(word, QUIZ_VERSE_RELATED) : [];
  var options = buildQuizVerseOptions(word, lessonWords, related);
  return options ? { verse: verse, options: options } : null;
}

/** Starts loading the surahs the verse questions need. Failures only mean fewer verse questions. */
function preloadQuizVerses(words) {
  var loader = window.__quranLoader;
  if (!loader) return;
  quizVerseSurahIds(words).forEach(function (id) {
    loader.loadSurah(id).catch(function () {});
  });
}
