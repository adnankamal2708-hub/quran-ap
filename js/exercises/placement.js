/**
 * placement.js — adaptive placement test and the Word meanings question bank.
 *
 * Pure and deterministic: scoring depends only on whether each answer was
 * correct, so the same answers always give the same result. No DOM, no AI.
 * Bank: { 0: Item[], 1: Item[], 2: Item[], 3: Item[] } of exercise items
 * (see exercise-engine.js). Depends on vocabulary.js, foundation.js and
 * exercise-engine.js at call time. The screen lives in a later task.
 *
 * PlacementState (treat as immutable; answerPlacementItem returns a copy):
 *   { bank, level, cursor:[n x4], perLevel:[{asked,correct} x4],
 *     tags:{ tag:{asked,correct} } }
 *   level  = the band the next question comes from
 *   cursor = how many items of each band have been served
 */

var PLACEMENT_MIN = 10;
var PLACEMENT_MAX = 20;
var PLACEMENT_START_LEVEL = 1;

var PLACEMENT_LEVELS = 4;
var PLACEMENT_PASS_MIN_ASKED = 2;
var PLACEMENT_PASS_RATIO = 2 / 3;
var PLACEMENT_SETTLED_MIN_ASKED = 3;       // asks needed at the result level before stopping early
var PLACEMENT_BEGINNER_MIN_ASKED = 4;      // asks at level 0 that confirm a beginner (rule R5)
var PLACEMENT_TAG_MIN_ASKED = 2;
var PLACEMENT_STRENGTH_RATIO = 0.75;
var PLACEMENT_GAP_RATIO = 0.5;

// Upper rank of each Word meanings band; the last band is open-ended.
var WORD_MEANINGS_BAND_MAX_RANKS = [100, 300, 700, Infinity];
var WORD_MEANINGS_OPTIONS = 4;
var WORD_MEANINGS_ROTATION_STEP = 3;

function createPlacementTest(bank) {
  return {
    bank: bank,
    level: PLACEMENT_START_LEVEL,
    cursor: [0, 0, 0, 0],
    perLevel: [0, 1, 2, 3].map(function() { return { asked: 0, correct: 0 }; }),
    tags: {},
  };
}

function totalPlacementAsked(state) {
  return state.perLevel.reduce(function(sum, entry) { return sum + entry.asked; }, 0);
}

function levelPasses(entry) {
  return entry.asked >= PLACEMENT_PASS_MIN_ASKED && entry.correct / entry.asked >= PLACEMENT_PASS_RATIO;
}

/** The highest passing level, or 0 when none passes. */
function getPlacementLevel(state) {
  for (var level = PLACEMENT_LEVELS - 1; level > 0; level--) {
    if (levelPasses(state.perLevel[level])) return level;
  }
  return 0;
}

function nextPlacementItem(state) {
  if (isPlacementFinished(state)) return null;
  return state.bank[state.level][state.cursor[state.level]];
}

function isBandExhausted(state) {
  var band = state.bank[state.level] || [];
  return state.cursor[state.level] >= band.length;
}

function isResultSettled(state) {
  var level = getPlacementLevel(state);
  if (state.perLevel[level].asked < PLACEMENT_SETTLED_MIN_ASKED) return false;
  if (level === PLACEMENT_LEVELS - 1) return true;
  return state.perLevel[level + 1].asked >= PLACEMENT_PASS_MIN_ASKED;
}

function isConfirmedBeginner(state) {
  return state.perLevel.every(function(entry) { return !levelPasses(entry); }) &&
    state.perLevel[0].asked >= PLACEMENT_BEGINNER_MIN_ASKED;
}

function isPlacementFinished(state) {
  var asked = totalPlacementAsked(state);
  if (asked >= PLACEMENT_MAX) return true;
  if (isBandExhausted(state)) return true;
  if (asked < PLACEMENT_MIN) return false;
  return isResultSettled(state) || isConfirmedBeginner(state);
}

function addAnswer(entry, correct) {
  return { asked: entry.asked + 1, correct: entry.correct + (correct ? 1 : 0) };
}

/** Records the answer to the current item and returns a new state. */
function answerPlacementItem(state, correct) {
  var item = nextPlacementItem(state);
  if (!item) return state;
  var level = state.level;

  var perLevel = state.perLevel.slice();
  perLevel[level] = addAnswer(perLevel[level], correct);

  var cursor = state.cursor.slice();
  cursor[level] += 1;

  var tags = Object.assign({}, state.tags);
  tags[item.tag] = addAnswer(tags[item.tag] || { asked: 0, correct: 0 }, correct);

  return {
    bank: state.bank,
    level: correct ? Math.min(PLACEMENT_LEVELS - 1, level + 1) : Math.max(0, level - 1),
    cursor: cursor,
    perLevel: perLevel,
    tags: tags,
  };
}

function tagsWhere(state, matches) {
  return Object.keys(state.tags).filter(function(tag) {
    var entry = state.tags[tag];
    return entry.asked >= PLACEMENT_TAG_MIN_ASKED && matches(entry);
  }).sort();
}

function getPlacementResult(state) {
  return {
    level: getPlacementLevel(state),
    perLevel: state.perLevel.map(function(entry) { return { asked: entry.asked, correct: entry.correct }; }),
    strengths: tagsWhere(state, function(entry) { return entry.correct / entry.asked >= PLACEMENT_STRENGTH_RATIO; }),
    gaps: tagsWhere(state, function(entry) { return entry.correct / entry.asked <= PLACEMENT_GAP_RATIO; }),
  };
}

// ── Word meanings bank ──

function wordMeaningsBandFor(rank) {
  for (var level = 0; level < WORD_MEANINGS_BAND_MAX_RANKS.length; level++) {
    if (rank <= WORD_MEANINGS_BAND_MAX_RANKS[level]) return level;
  }
  return PLACEMENT_LEVELS - 1;
}

// Moves the first `steps` items to the end, so retakes start on other words.
function rotateList(list, steps) {
  if (list.length === 0) return list;
  var shift = ((steps % list.length) + list.length) % list.length;
  return list.slice(shift).concat(list.slice(0, shift));
}

// "The Earth" and "Earth" (or "The One" and "One") are the same answer, so
// options are compared with case and a leading article/"to" removed.
function normalizeMeaning(english) {
  return english.trim().toLowerCase().replace(/^(the|a|an|to) /, '');
}

// Appends candidates whose meaning is not on the list yet, up to the option count.
function addMeaningOptions(options, seen, candidates) {
  candidates.forEach(function(candidate) {
    var form = normalizeMeaning(candidate.english);
    if (options.length < WORD_MEANINGS_OPTIONS && seen.indexOf(form) === -1) {
      options.push(candidate.english);
      seen.push(form);
    }
  });
}

/**
 * English meanings: the correct one plus up to 3 distractors with distinct
 * meanings. `preferred` (optional) is a list of words to take distractors
 * from first, e.g. the other words of a root; getDistractors fills the rest.
 */
function pickMeaningOptions(word, preferred) {
  var options = [word.english];
  var seen = [normalizeMeaning(word.english)];
  addMeaningOptions(options, seen, preferred || []);
  if (options.length < WORD_MEANINGS_OPTIONS) {
    // Ask for spare distractors: several can share a meaning.
    addMeaningOptions(options, seen, getDistractors(word, WORD_MEANINGS_OPTIONS * 2));
  }
  return options;
}

function buildMeaningItem(word, preferred) {
  var options = shuffleArray(pickMeaningOptions(word, preferred));
  return {
    type: 'read-choose',
    prompt: { arabic: word.arabic },
    options: options,
    answer: options.indexOf(word.english),
    tag: word.typeCategory || 'other',
  };
}

/**
 * Builds the placement bank for the Word meanings track. `attempt` is the
 * stored count of earlier placement tests; it rotates each band so a retake
 * does not open with the same words.
 */
function buildWordMeaningsBank(attempt) {
  var ranked = getCanonicalWords().filter(function(word) {
    return getFrequencyRank(word) !== null;
  }).sort(function(a, b) {
    return getFrequencyRank(a) - getFrequencyRank(b);
  });

  var bands = [[], [], [], []];
  ranked.forEach(function(word) {
    bands[wordMeaningsBandFor(getFrequencyRank(word))].push(word);
  });

  var bank = {};
  bands.forEach(function(words, level) {
    bank[level] = rotateList(words, (attempt || 0) * WORD_MEANINGS_ROTATION_STEP)
      .map(function(word) { return buildMeaningItem(word); })
      .filter(function(item) { return validateExercise(item) === null; });
  });
  return bank;
}
