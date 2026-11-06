// ═══════════════════════════════════════════════════════════════
// tajweed-lessons.js — The Tajweed Beginner lessons
//
// Content to be checked by the owner before release.
//
// Data only. Each lesson's title is strings-en.js tajweed.lesson.<id>.title.
// Exercises are generated from these fields and js/tajweed/tajweed-makharij.js.
//
//   id         stable id, also the progress key: tj<level>-<number>
//   level      0 Beginner (the only level with lessons so far)
//   number     1-based within the level
//   kind       'lesson', or 'check' for the level's reading check
//   topic      what the lesson practises:
//                areas      the five areas of articulation
//                points     the points of one area, and their letters
//                qualities  the letter qualities named in `qualities`
//                confused   the pairs in TAJWEED_CONFUSED_PAIRS
//                check      the reading check; passing it completes the level
//   letters    letter ids the lesson practises (QAIDA_LETTERS ids, or hamza)
//   qualities  for topic 'qualities': keys of TAJWEED_QUALITIES
// ═══════════════════════════════════════════════════════════════

/** Letters with any of these qualities, in the order of the points. */
function _tajweedLettersWith(qualities) {
  return TAJWEED_MAKHARIJ.map(function (m) { return m.letter; }).filter(function (id) {
    return qualities.some(function (q) { return TAJWEED_QUALITIES[q].indexOf(id) >= 0; });
  });
}

/** Every letter of the confused pairs, once each. */
function _tajweedPairLetters() {
  var out = [];
  TAJWEED_CONFUSED_PAIRS.forEach(function (pair) {
    pair.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
  });
  return out;
}

var TAJWEED_LESSONS = [
  { id: 'tj0-1', level: 0, number: 1, kind: 'lesson', topic: 'areas', letters: [] },
  { id: 'tj0-2', level: 0, number: 2, kind: 'lesson', topic: 'points', letters: ['hamza', 'ha', 'ain', 'hha', 'ghayn', 'kha'] },
  { id: 'tj0-3', level: 0, number: 3, kind: 'lesson', topic: 'points', letters: ['qaf', 'kaf'] },
  { id: 'tj0-4', level: 0, number: 4, kind: 'lesson', topic: 'points', letters: ['jim', 'shin', 'ya'] },
  { id: 'tj0-5', level: 0, number: 5, kind: 'lesson', topic: 'points', letters: ['dad', 'lam', 'nun', 'ra'] },
  { id: 'tj0-6', level: 0, number: 6, kind: 'lesson', topic: 'points',
    letters: ['ta', 'dal', 'tta', 'tha', 'dhal', 'zza', 'sad', 'sin', 'zay'] },
  { id: 'tj0-7', level: 0, number: 7, kind: 'lesson', topic: 'points', letters: ['fa', 'ba', 'mim', 'waw'] },
  { id: 'tj0-8', level: 0, number: 8, kind: 'lesson', topic: 'points', letters: ['alif'] },
  { id: 'tj0-9', level: 0, number: 9, kind: 'lesson', topic: 'qualities', qualities: ['heavy', 'whispered'],
    letters: _tajweedLettersWith(['heavy', 'whispered']) },
  { id: 'tj0-10', level: 0, number: 10, kind: 'lesson', topic: 'qualities', qualities: ['qalqalah', 'whistling', 'nasal'],
    letters: _tajweedLettersWith(['qalqalah', 'whistling', 'nasal']) },
  { id: 'tj0-11', level: 0, number: 11, kind: 'lesson', topic: 'confused', letters: _tajweedPairLetters() },
  { id: 'tj0-12', level: 0, number: 12, kind: 'check', topic: 'check', letters: [] },
];

/** @returns {Object|null} the lesson with this id */
function getTajweedLesson(id) {
  for (var i = 0; i < TAJWEED_LESSONS.length; i++) {
    if (TAJWEED_LESSONS[i].id === id) return TAJWEED_LESSONS[i];
  }
  return null;
}

/** @returns {Object[]} the lessons of one level, in order */
function getTajweedLevelLessons(level) {
  return TAJWEED_LESSONS.filter(function (l) { return l.level === level; });
}
