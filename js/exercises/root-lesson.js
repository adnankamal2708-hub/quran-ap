/**
 * root-lesson.js — builds a "Study by root" lesson from the vocabulary.
 *
 * Pure: no DOM, no storage. A RootLesson is
 *   { root, letters:string[], meaning, note, occurrences,
 *     groups:[{ pattern, words:Word[], sameMeaning, alsoWritten }], exercises:Item[] }
 * Only data already in the app is shown; pattern labels are exactly as stored.
 *   letters      the root's letters ('/' separates alternative roots)
 *   note         the first non-empty rootPattern among the family's words
 *   groups       the family by stored pattern, most frequent first; words
 *                with no pattern end up in a last group, "Other forms"
 *   exercises    up to 4 read-choose items (distractors come from the same
 *                family first) and, when the ayah text is loaded, one spot
 *                item; read-choose items carry the `wordId` they rate.
 * The screen is js/ui/root-lesson-ui.js. Depends on lesson-system.js,
 * vocabulary.js, placement.js, exercise-engine.js, word-drills.js and i18n at
 * call time; the Quran text comes from window.__quranLoader.
 */

var ROOT_LESSON_MAX_READ_ITEMS = 4;
var ROOT_LESSON_SPOT_MAX_SURAHS = 3;     // surahs fetched while looking for a spot ayah
var ROOT_LESSON_NO_PATTERN = '—';   // what the data stores for "no pattern"
var ROOT_LESSON_TAG = 'root';

/** The root's letters; roots are stored with dashes or spaces between them. */
function splitRootLetters(root) {
  return String(root || '').split(/[\s\-‐-―]+/).filter(Boolean);
}

function findRootFamily(rootKey) {
  var families = getRootFamilyLessons();
  for (var i = 0; i < families.length; i++) {
    if (families[i].root === rootKey) return families[i];
  }
  return null;
}

function rootWordHasPattern(word) {
  return !!word.pattern && word.pattern !== ROOT_LESSON_NO_PATTERN;
}

function rootWordsByFrequency(words) {
  return words.slice().sort(function(a, b) { return (b.occ || 0) - (a.occ || 0); });
}

/**
 * One row per meaning. The data keeps each spelling as its own word (إِلَٰهٍ
 * and إِلَٰهَ both count towards coverage), so the most frequent one is shown
 * and the rest are merged into it: `sameMeaning[id]` holds the merged words,
 * `alsoWritten[id]` their spellings whose letters differ from the shown one
 * (a different case ending alone is not listed).
 */
function mergeSameMeaningWords(words) {
  var rows = [];
  var rowByMeaning = {};
  rootWordsByFrequency(words).forEach(function(word) {
    var meaning = word.english ? normalizeMeaning(word.english) : null;
    var row = meaning !== null ? rowByMeaning[meaning] : null;
    if (row) {
      row.merged.push(word);
      var form = drillNormalize(word.arabic);
      if (row.forms.indexOf(form) === -1) {
        row.forms.push(form);
        row.alsoWritten.push(word.arabic);
      }
      return;
    }
    row = { word: word, merged: [], alsoWritten: [], forms: [drillNormalize(word.arabic)] };
    rows.push(row);
    if (meaning !== null) rowByMeaning[meaning] = row;
  });
  return rows;
}

function groupRootWords(words) {
  var byPattern = {};
  var patterns = [];
  var other = { pattern: t('root.otherForms'), words: [], sameMeaning: {}, alsoWritten: {} };
  mergeSameMeaningWords(words).forEach(function(row) {
    var word = row.word;
    var group = other;
    if (rootWordHasPattern(word)) {
      if (!byPattern[word.pattern]) {
        byPattern[word.pattern] = { pattern: word.pattern, words: [], sameMeaning: {}, alsoWritten: {} };
        patterns.push(word.pattern);
      }
      group = byPattern[word.pattern];
    }
    group.words.push(word);
    if (row.merged.length > 0) group.sameMeaning[word.id] = row.merged;
    if (row.alsoWritten.length > 0) group.alsoWritten[word.id] = row.alsoWritten;
  });
  var groups = patterns.map(function(pattern) { return byPattern[pattern]; });
  if (other.words.length > 0) groups.push(other);
  return groups;
}

// ── Read-choose items ──

/**
 * The words to ask about: the most frequent ones, each with a different
 * Arabic form and a different meaning, so no two questions are the same.
 */
function pickRootReadWords(words) {
  var forms = [];
  var meanings = [];
  var picked = [];
  rootWordsByFrequency(words).forEach(function(word) {
    if (picked.length >= ROOT_LESSON_MAX_READ_ITEMS || !word.arabic || !word.english) return;
    var form = drillNormalize(word.arabic);
    var meaning = normalizeMeaning(word.english);
    if (forms.indexOf(form) !== -1 || meanings.indexOf(meaning) !== -1) return;
    forms.push(form);
    meanings.push(meaning);
    picked.push(word);
  });
  return picked;
}

/**
 * The family's other words in random order, as preferred distractors. A word
 * written like the asked one is left out: it would be a second right answer.
 */
function rootDistractorPool(word, familyWords) {
  var form = drillNormalize(word.arabic);
  return shuffleArray(familyWords.filter(function(other) {
    return other !== word && other.english && drillNormalize(other.arabic) !== form;
  }));
}

function buildRootReadItems(family) {
  var items = [];
  pickRootReadWords(family.words).forEach(function(word) {
    var item = buildMeaningItem(word, rootDistractorPool(word, family.words));
    item.wordId = word.id;
    item.tag = ROOT_LESSON_TAG;
    if (validateExercise(item) === null) items.push(item);
  });
  return items;
}

// ── Spot item ──

/** Every ayah reference of the family's words, most frequent word first. */
function rootVerseKeys(family) {
  var keys = [];
  function add(key) {
    if (typeof key === 'string' && keys.indexOf(key) === -1) keys.push(key);
  }
  rootWordsByFrequency(family.words).forEach(function(word) {
    add(word.verseKey);
    (word.occurrences || []).forEach(function(occurrence) { add(occurrence && occurrence.verseKey); });
  });
  return keys;
}

/** The first surahs of the family's ayahs, each once: what the screen loads. */
function rootSpotSurahIds(rootKey) {
  var family = findRootFamily(rootKey);
  if (!family) return [];
  var ids = [];
  rootVerseKeys(family).forEach(function(key) {
    var surahId = Number(key.split(':')[0]);
    if (surahId >= 1 && ids.indexOf(surahId) === -1) ids.push(surahId);
  });
  return ids.slice(0, ROOT_LESSON_SPOT_MAX_SURAHS);
}

/** Normalized forms of the family's words: { form: true }. */
function rootFamilyForms(family) {
  var forms = {};
  family.words.forEach(function(word) {
    var form = drillNormalize(word.arabic);
    if (form) forms[form] = true;
  });
  return forms;
}

/**
 * Family forms that a word of another root is also written as (the particle
 * مِنْ, say). Such a token cannot be said to belong to this family, so an
 * ayah holding one is not used for the spot question.
 */
function rootAmbiguousForms(family, forms) {
  var ambiguous = {};
  getCanonicalWords().forEach(function(word) {
    var form = drillNormalize(word.arabic);
    if (word.root !== family.root && forms[form]) ambiguous[form] = true;
  });
  return ambiguous;
}

function rootSpotAnswer(tokens, forms) {
  var answer = [];
  tokens.forEach(function(token, index) {
    if (forms[drillNormalize(token)]) answer.push(index);
  });
  return answer;
}

function buildRootSpot(family) {
  var loader = window.__quranLoader;
  if (!loader) return null;
  var forms = rootFamilyForms(family);
  var ambiguous = rootAmbiguousForms(family, forms);
  var keys = rootVerseKeys(family);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(':');
    var surahId = Number(parts[0]);
    if (!loader.isSurahLoaded(surahId)) continue;
    var verse = loader.getVerse(surahId, Number(parts[1]));
    var tokens = verse ? drillWords(verse.text) : [];
    if (tokens.length < DRILL_SPOT_MIN_TOKENS || tokens.length > DRILL_SPOT_MAX_TOKENS) continue;
    var answer = rootSpotAnswer(tokens, forms);
    // No match gives nothing to find; every token matching gives the answer away.
    if (answer.length === 0 || answer.length === tokens.length) continue;
    // A token the learner could fairly tap, but that would be marked wrong: skip the ayah.
    if (tokens.some(function(token) { return ambiguous[drillNormalize(token)]; })) continue;
    if (drillHasPrefixedToken(tokens, answer, forms)) continue;
    var item = {
      type: 'spot',
      prompt: { text: t('root.spot.prompt') },
      tokens: tokens,
      answer: answer,
      tag: ROOT_LESSON_TAG,
    };
    if (validateExercise(item) === null) return item;
  }
  return null;
}

/**
 * A spot item over an ayah of this root, or null when none of the family's
 * ayahs is loaded yet (see rootSpotSurahIds) or fits.
 */
function buildRootSpotItem(rootKey) {
  var family = findRootFamily(rootKey);
  return family ? buildRootSpot(family) : null;
}

// ── Lesson ──

/** The lesson for a root, or null for an unknown root. */
function buildRootLesson(rootKey) {
  var family = findRootFamily(rootKey);
  if (!family) return null;

  var exercises = buildRootReadItems(family);
  var spot = buildRootSpot(family);
  if (spot) exercises.push(spot);

  var note = '';
  var occurrences = 0;
  family.words.forEach(function(word) {
    if (!note && word.rootPattern) note = word.rootPattern;
    occurrences += word.occ || 0;
  });

  return {
    root: family.root,
    letters: splitRootLetters(family.root),
    meaning: family.rootMeaning,
    note: note,
    occurrences: occurrences,
    groups: groupRootWords(family.words),
    exercises: exercises,
  };
}
