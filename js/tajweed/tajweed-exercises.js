// ═══════════════════════════════════════════════════════════════
// tajweed-exercises.js — Exercises for the Tajweed lessons and the
// Tajweed placement test, generated from the makharij and lesson data
//
// buildTajweedLessonItems(lesson, seed) → exercise items
// buildTajweedBank(attempt)             → placement bank {0..3: items}
//
// Everything is deterministic for a given seed. Each item carries:
//   skill  tj-letter:<id>, the letter the question is about (for review)
//   tag    areas · points · qualities · confused, for placement strengths and gaps
// Wrong options are fair: points come from the answer's own area first, and a
// quality question never offers a second letter with that quality. The nose
// has no letters, so it is never asked. Wāw and yā also sound from the cavity
// as long vowels, so they are never set against the cavity.
// Listening items exist only for letters that have a recording (qaidaAudioUrl).
// Reuses the Qaida helpers (qaidaRandom, qaidaShuffle, _qaidaChoice).
// All English text comes from strings-en.js through t().
// ═══════════════════════════════════════════════════════════════

var TAJWEED_ITEMS_PER_LESSON = 12;
var TAJWEED_CHECK_ITEMS = 16;
var TAJWEED_CHECK_ITEMS_PER_LESSON = 2;
var TAJWEED_AREA_ITEMS = 8;
var TAJWEED_QUALITY_ITEMS_PER_QUALITY = 3;
var TAJWEED_BANK_ITEMS_PER_KIND = 4;
var TAJWEED_BANK_SEED_STEP = 6151;
var TAJWEED_MADD_LETTERS = ['waw', 'ya'];
var TAJWEED_BANK_QUALITIES = ['heavy', 'whispered', 'qalqalah', 'whistling'];

// ── Letters and where they come from ────────────────────────────

function _tajweedAllLetters() {
  return TAJWEED_MAKHARIJ.map(function (m) { return m.letter; });
}

function _tajweedMakhraj(id) {
  for (var i = 0; i < TAJWEED_MAKHARIJ.length; i++) {
    if (TAJWEED_MAKHARIJ[i].letter === id) return TAJWEED_MAKHARIJ[i];
  }
  return null;
}

function _tajweedChar(id) { return getTajweedLetter(id).char; }
function _tajweedLetterName(id) { return t(getTajweedLetter(id).nameKey); }
function _tajweedSkill(id) { return 'tj-letter:' + id; }

/** The letters paired with this one in TAJWEED_CONFUSED_PAIRS. */
function _tajweedPartners(id) {
  var out = [];
  TAJWEED_CONFUSED_PAIRS.forEach(function (pair) {
    if (pair[0] === id) out.push(pair[1]);
    else if (pair[1] === id) out.push(pair[0]);
  });
  return out;
}

/** Letters easiest to mix up with this one: its pairs, then its area, then the rest. */
function _tajweedNeighbours(id, rnd) {
  var area = _tajweedMakhraj(id).area;
  var others = _tajweedAllLetters().filter(function (l) { return l !== id; });
  var partners = _tajweedPartners(id);
  var sameArea = qaidaShuffle(others.filter(function (l) { return partners.indexOf(l) < 0 && _tajweedMakhraj(l).area === area; }), rnd);
  var rest = qaidaShuffle(others.filter(function (l) { return partners.indexOf(l) < 0 && _tajweedMakhraj(l).area !== area; }), rnd);
  return partners.concat(sameArea, rest);
}

/** Areas with letters, without the cavity for wāw and yā. */
function _tajweedAreasFor(id) {
  return TAJWEED_AREAS.filter(function (a) {
    return a !== 'nose' && !(a === 'cavity' && TAJWEED_MADD_LETTERS.indexOf(id) >= 0);
  });
}

function _tajweedPointOk(point, id) {
  return point.id !== 'nose' && !(point.id === 'cavity' && TAJWEED_MADD_LETTERS.indexOf(id) >= 0);
}

// ── Item kinds ──────────────────────────────────────────────────

/** Where does this letter come from? Options are the areas. */
function _tajweedAreaItem(id, rnd) {
  var area = _tajweedMakhraj(id).area;
  var others = qaidaShuffle(_tajweedAreasFor(id).filter(function (a) { return a !== area; }), rnd);
  var names = others.map(function (a) { return t('tajweed.area.' + a + '.name'); });
  return _qaidaChoice({ ask: t('tajweed.ex.whichArea'), arabic: _tajweedChar(id) }, t('tajweed.area.' + area + '.name'), names, rnd,
    { skill: _tajweedSkill(id), tag: 'areas' });
}

/** Which point does this letter come from? Points of its own area come first among the wrong options. */
function _tajweedPointItem(id, rnd) {
  var mk = _tajweedMakhraj(id);
  var others = TAJWEED_POINTS.filter(function (p) { return p.id !== mk.point && _tajweedPointOk(p, id); });
  var sameArea = qaidaShuffle(others.filter(function (p) { return p.area === mk.area; }), rnd);
  var rest = qaidaShuffle(others.filter(function (p) { return p.area !== mk.area; }), rnd);
  var names = sameArea.concat(rest).map(function (p) { return t('tajweed.point.' + p.id); });
  return _qaidaChoice({ ask: t('tajweed.ex.whichPoint'), arabic: _tajweedChar(id) }, t('tajweed.point.' + mk.point), names, rnd,
    { skill: _tajweedSkill(id), tag: 'points' });
}

/** Which letter comes from this point? The wrong options come from other points, the same area first. */
function _tajweedFromPointItem(id, rnd) {
  var mk = _tajweedMakhraj(id);
  var others = _tajweedAllLetters().filter(function (l) {
    var m = _tajweedMakhraj(l);
    return m.point !== mk.point && !(mk.point === 'cavity' && TAJWEED_MADD_LETTERS.indexOf(l) >= 0);
  });
  var sameArea = qaidaShuffle(others.filter(function (l) { return _tajweedMakhraj(l).area === mk.area; }), rnd);
  var rest = qaidaShuffle(others.filter(function (l) { return _tajweedMakhraj(l).area !== mk.area; }), rnd);
  return _qaidaChoice({ text: t('tajweed.ex.whichFrom', { point: t('tajweed.point.' + mk.point) }) }, _tajweedChar(id),
    sameArea.concat(rest).map(_tajweedChar), rnd, { skill: _tajweedSkill(id), tag: 'points' });
}

/** Hear a letter, pick it. Null while the letter has no recording. */
function _tajweedListenItem(id, rnd, tag) {
  var url = qaidaAudioUrl(id);
  if (!url) return null;
  var item = _qaidaChoice({ ask: t('tajweed.ex.whichHeard'), audio: url }, _tajweedChar(id),
    _tajweedNeighbours(id, rnd).map(_tajweedChar), rnd, { skill: _tajweedSkill(id), tag: tag });
  item.type = 'listen-choose';
  return item;
}

/** Name a letter among the letters it is mixed up with. */
function _tajweedPickLetterItem(id, rnd) {
  return _qaidaChoice({ text: t('qaida.ex.whichLetter', { name: _tajweedLetterName(id) }) }, _tajweedChar(id),
    _tajweedNeighbours(id, rnd).map(_tajweedChar), rnd, { skill: _tajweedSkill(id), tag: 'confused' });
}

/** The letter of a confused pair, heard when it has a recording and read otherwise. */
function _tajweedConfusedItem(id, listen, rnd) {
  return (listen && _tajweedListenItem(id, rnd, 'confused')) || _tajweedPickLetterItem(id, rnd);
}

/** Which of these letters has the quality? The wrong options are letters without it, its pairs first. */
function _tajweedQualityItem(quality, id, rnd) {
  var having = TAJWEED_QUALITIES[quality];
  var without = _tajweedNeighbours(id, rnd).filter(function (l) { return having.indexOf(l) < 0; });
  return _qaidaChoice({ text: t('tajweed.ex.which.' + quality) }, _tajweedChar(id), without.map(_tajweedChar), rnd,
    { skill: _tajweedSkill(id), tag: 'qualities' });
}

// ── Lessons ─────────────────────────────────────────────────────

function _tajweedRandomItem(list, rnd) {
  return list[Math.floor(rnd() * list.length)];
}

/** One letter from each area that has letters, then more at random. */
function _tajweedAreaItems(letters, rnd) {
  var picked = [];
  TAJWEED_AREAS.forEach(function (area) {
    var inArea = letters.filter(function (l) { return _tajweedMakhraj(l).area === area; });
    if (inArea.length > 0) picked.push(_tajweedRandomItem(inArea, rnd));
  });
  qaidaShuffle(letters.filter(function (l) { return picked.indexOf(l) < 0; }), rnd).forEach(function (l) {
    if (picked.length < TAJWEED_AREA_ITEMS) picked.push(l);
  });
  return qaidaShuffle(picked, rnd).map(function (l) { return _tajweedAreaItem(l, rnd); });
}

/** Each letter's point, then each letter picked (or heard) from its point, then its area. */
function _tajweedPointItems(letters, rnd) {
  var items = letters.map(function (l) { return _tajweedPointItem(l, rnd); });
  qaidaShuffle(letters, rnd).forEach(function (l) {
    items.push(_tajweedListenItem(l, rnd, 'points') || _tajweedFromPointItem(l, rnd));
  });
  qaidaShuffle(letters, rnd).forEach(function (l) { items.push(_tajweedAreaItem(l, rnd)); });
  return items;
}

function _tajweedQualityItems(lesson, rnd) {
  var items = [];
  lesson.qualities.forEach(function (quality) {
    qaidaShuffle(TAJWEED_QUALITIES[quality], rnd).slice(0, TAJWEED_QUALITY_ITEMS_PER_QUALITY).forEach(function (l) {
      items.push(_tajweedQualityItem(quality, l, rnd));
    });
  });
  return items;
}

function _tajweedConfusedItems(rnd) {
  return TAJWEED_CONFUSED_PAIRS.map(function (pair, i) {
    return _tajweedConfusedItem(pair[rnd() < 0.5 ? 0 : 1], i % 2 === 0, rnd);
  });
}

/** Two items from each earlier lesson of the level, mixed. */
function _tajweedCheckItems(lesson, rnd) {
  var picked = [];
  getTajweedLevelLessons(lesson.level).forEach(function (l) {
    if (l.kind === 'check') return;
    var items = qaidaShuffle(_tajweedItemsFor(l, Math.floor(rnd() * 1e9)), rnd);
    picked = picked.concat(items.slice(0, TAJWEED_CHECK_ITEMS_PER_LESSON));
  });
  return qaidaShuffle(picked, rnd);
}

function _tajweedItemsFor(lesson, seed) {
  var rnd = qaidaRandom(seed);
  var letters = lesson.letters.length > 0 ? lesson.letters : _tajweedAllLetters();
  if (lesson.topic === 'areas') return _tajweedAreaItems(letters, rnd);
  if (lesson.topic === 'points') return _tajweedPointItems(letters, rnd);
  if (lesson.topic === 'qualities') return _tajweedQualityItems(lesson, rnd);
  if (lesson.topic === 'confused') return _tajweedConfusedItems(rnd);
  if (lesson.kind === 'check') return _tajweedCheckItems(lesson, rnd);
  return [];
}

/**
 * The exercises for one lesson. The reading check uses up to
 * TAJWEED_CHECK_ITEMS; other lessons keep their order (new material first)
 * and use at most TAJWEED_ITEMS_PER_LESSON.
 * @param {Object} lesson - from TAJWEED_LESSONS
 * @param {number} seed
 * @returns {Object[]} exercise items
 */
function buildTajweedLessonItems(lesson, seed) {
  if (!lesson) return [];
  var items = _tajweedItemsFor(lesson, seed);
  return items.slice(0, lesson.kind === 'check' ? TAJWEED_CHECK_ITEMS : TAJWEED_ITEMS_PER_LESSON);
}

// ── Placement test bank ─────────────────────────────────────────

/**
 * The Tajweed placement bank, one list per level:
 *   0 areas and qualities · 1 points and confused letters ·
 *   2 and 3 empty (the track has only the Beginner level so far).
 * The attempt number seeds it, so a retake asks different questions.
 */
function buildTajweedBank(attempt) {
  var rnd = qaidaRandom(TAJWEED_BANK_SEED_STEP * (attempt + 1));
  var letters = _tajweedAllLetters();
  var bank = { 0: [], 1: [], 2: [], 3: [] };

  TAJWEED_AREAS.filter(function (a) { return a !== 'nose'; }).forEach(function (area) {
    var inArea = letters.filter(function (l) { return _tajweedMakhraj(l).area === area; });
    bank[0].push(_tajweedAreaItem(_tajweedRandomItem(inArea, rnd), rnd));
  });
  TAJWEED_BANK_QUALITIES.forEach(function (quality) {
    bank[0].push(_tajweedQualityItem(quality, _tajweedRandomItem(TAJWEED_QUALITIES[quality], rnd), rnd));
  });

  qaidaShuffle(TAJWEED_POINTS.filter(function (p) { return p.letters.length > 0; }), rnd)
    .slice(0, TAJWEED_BANK_ITEMS_PER_KIND).forEach(function (point) {
      bank[1].push(_tajweedPointItem(_tajweedRandomItem(point.letters, rnd), rnd));
    });
  qaidaShuffle(TAJWEED_CONFUSED_PAIRS, rnd).slice(0, TAJWEED_BANK_ITEMS_PER_KIND).forEach(function (pair) {
    bank[1].push(_tajweedConfusedItem(pair[rnd() < 0.5 ? 0 : 1], true, rnd));
  });

  bank[0] = qaidaShuffle(bank[0], rnd);
  bank[1] = qaidaShuffle(bank[1], rnd);
  return bank;
}
