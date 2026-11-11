// ═══════════════════════════════════════════════════════════════
// qaida-exercises.js — Exercises for Qaida lessons and the Qaida
// placement test, generated from the letter, mark and lesson data
//
// buildQaidaLessonItems(lesson, seed, verses) → exercise items
// buildQaidaBank(attempt)                     → placement bank {0..3: items}
// buildConfusedLettersDrill(seed)             → one Practice drill question
// buildQaidaSkillItem(skill, seed)             → one review question on a skill
//
// Everything is deterministic for a given seed. Wrong options come from
// lookalike letters (same shape group) first, so a question tests the dots
// and marks a beginner actually confuses. Each item carries:
//   skill  the Qaida skill id it practises (for review scheduling)
//   tag    the skill group, for placement strengths and gaps
// Surah lessons need the surah's verses ({ <surahId>: [verse text] }),
// which the lesson screen loads first; without them they have no items.
// All English text comes from strings-en.js through t().
// ═══════════════════════════════════════════════════════════════

var QAIDA_SHORT_VOWELS = [
  { id: 'fatha', mark: 'َ', sound: 'a' },
  { id: 'kasra', mark: 'ِ', sound: 'i' },
  { id: 'damma', mark: 'ُ', sound: 'u' },
];
var QAIDA_TANWIN = [
  { id: 'fathatan', mark: 'ً', sound: 'an' },
  { id: 'kasratan', mark: 'ٍ', sound: 'in' },
  { id: 'dammatan', mark: 'ٌ', sound: 'un' },
];
// A long vowel is a short vowel followed by its letter of madd
var QAIDA_LONG_VOWELS = [
  { vowel: 'َ', letter: 'ا', sound: 'ā' },
  { vowel: 'ِ', letter: 'ي', sound: 'ī' },
  { vowel: 'ُ', letter: 'و', sound: 'ū' },
];

var QAIDA_ITEMS_PER_LESSON = 10;

// ── Small deterministic helpers ─────────────────────────────────

function qaidaRandom(seed) {
  var a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function qaidaShuffle(list, rnd) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rnd() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function _qaidaUnique(list) {
  return list.filter(function (x, i) { return list.indexOf(x) === i; });
}

/** A read-choose item whose options are the answer plus distractors, shuffled. */
function _qaidaChoice(prompt, answer, distractors, rnd, extra) {
  var options = qaidaShuffle(_qaidaUnique([answer].concat(distractors.filter(function (d) { return d !== answer; }))).slice(0, 4), rnd);
  if (options.indexOf(answer) < 0) options[0] = answer;
  var item = { type: 'read-choose', prompt: prompt, options: options, answer: options.indexOf(answer) };
  Object.keys(extra || {}).forEach(function (k) { item[k] = extra[k]; });
  return item;
}

function _qaidaLetterName(letter) { return t('qaida.letter.' + letter.id + '.name'); }
function _qaidaMarkName(id) { return t('qaida.mark.' + id + '.name'); }

/** Other letters a learner might mistake for this one: its shape group first. */
function _qaidaLookalikes(letter, pool, rnd) {
  var same = QAIDA_LETTERS.filter(function (l) { return l.group === letter.group && l !== letter; });
  var rest = qaidaShuffle(pool.filter(function (l) { return l.group !== letter.group; }), rnd);
  return same.concat(rest);
}

function _qaidaLettersOf(ids) {
  return ids.map(getQaidaLetter).filter(Boolean);
}

// Letters that take vowels in syllable drills (alif carries hamzah instead)
function _qaidaSyllableLetters() {
  return QAIDA_LETTERS.filter(function (l) { return l.id !== 'alif'; });
}

// ── Letters ─────────────────────────────────────────────────────

function _qaidaNameItem(letter, pool, rnd) {
  var others = _qaidaLookalikes(letter, pool, rnd).map(_qaidaLetterName);
  return _qaidaChoice({ ask: t('qaida.ex.whichName'), arabic: letter.char }, _qaidaLetterName(letter), others, rnd,
    { skill: letter.id, tag: 'letters' });
}

function _qaidaPickLetterItem(letter, pool, rnd) {
  var others = _qaidaLookalikes(letter, pool, rnd).map(function (l) { return l.char; });
  return _qaidaChoice({ text: t('qaida.ex.whichLetter', { name: _qaidaLetterName(letter) }) }, letter.char, others, rnd,
    { skill: letter.id, tag: letter.group === 'alif' ? 'letters' : 'shapes' });
}

/** Tap every copy of one letter among lookalikes. */
function _qaidaSpotLetterItem(letter, pool, rnd) {
  var others = _qaidaLookalikes(letter, pool, rnd).slice(0, 3);
  var tokens = qaidaShuffle([letter, letter, letter].concat(others, others.slice(0, 2)), rnd).map(function (l) { return l.char; });
  var answer = [];
  tokens.forEach(function (c, i) { if (c === letter.char) answer.push(i); });
  return { type: 'spot', prompt: { text: t('qaida.ex.tapEvery', { name: _qaidaLetterName(letter) }) },
    tokens: tokens, answer: answer, skill: letter.id, tag: 'shapes' };
}

function _qaidaHamzaItem(rnd) {
  return _qaidaChoice({ ask: t('qaida.ex.whichName'), arabic: 'ء' }, _qaidaMarkName('hamza'),
    [_qaidaLetterName(getQaidaLetter('alif')), _qaidaLetterName(getQaidaLetter('ain')), _qaidaLetterName(getQaidaLetter('ha'))], rnd,
    { skill: 'hamza', tag: 'letters' });
}

function _qaidaLetterItems(lesson, rnd) {
  var letters = _qaidaLettersOf(lesson.teaches);
  var items = [];
  letters.forEach(function (letter, i) {
    items.push(i % 2 === 0 ? _qaidaNameItem(letter, letters, rnd) : _qaidaPickLetterItem(letter, letters, rnd));
  });
  // Hamzah is taught with the last letters: name it like a letter
  if (lesson.teaches.indexOf('hamza') >= 0) items.push(_qaidaHamzaItem(rnd));
  qaidaShuffle(letters, rnd).slice(0, 2).forEach(function (letter) {
    items.push(_qaidaSpotLetterItem(letter, letters, rnd));
  });
  return items;
}

function _qaidaShapeItems(rnd) {
  var groups = {};
  QAIDA_LETTERS.forEach(function (l) { (groups[l.group] = groups[l.group] || []).push(l); });
  var items = [];
  Object.keys(groups).forEach(function (g) {
    if (groups[g].length < 2) return;
    var letter = groups[g][Math.floor(rnd() * groups[g].length)];
    items.push(_qaidaChoice({ text: t('qaida.ex.whichLetter', { name: _qaidaLetterName(letter) }) }, letter.char,
      groups[g].map(function (l) { return l.char; }), rnd, { skill: letter.id, tag: 'shapes' }));
  });
  items.push(_qaidaSpotLetterItem(getQaidaLetter('ba'), QAIDA_LETTERS, rnd));
  return items;
}

function _qaidaFormItems(rnd) {
  var items = [];
  var joining = qaidaShuffle(QAIDA_LETTERS.filter(function (l) { return l.joins; }), rnd).slice(0, 6);
  var positions = ['initial', 'medial', 'final'];
  joining.forEach(function (letter, i) {
    var position = positions[i % 3];
    var forms = ['isolated', 'initial', 'medial', 'final'].map(function (p) { return qaidaLetterForm(letter, p); });
    items.push(_qaidaChoice({ text: t('qaida.ex.whichForm', { name: _qaidaLetterName(letter), position: t('qaida.ex.position.' + position) }) },
      qaidaLetterForm(letter, position), forms, rnd, { skill: letter.id, tag: 'shapes' }));
  });
  [['ة', 'ta-marbuta', ['tta', 'ha']], ['ى', 'alif-maqsura', ['ya', 'alif']]].forEach(function (e) {
    var others = e[2].map(function (id) { return _qaidaLetterName(getQaidaLetter(id)); });
    items.push(_qaidaChoice({ ask: t('qaida.ex.whichName'), arabic: e[0] }, _qaidaMarkName(e[1]), others, rnd,
      { skill: e[1], tag: 'shapes' }));
  });
  return items;
}

function _qaidaNonJoiningItems(rnd) {
  var nonJoining = QAIDA_LETTERS.filter(function (l) { return !l.joins; });
  var joining = QAIDA_LETTERS.filter(function (l) { return l.joins; });
  return nonJoining.map(function (letter) {
    var others = qaidaShuffle(joining, rnd).slice(0, 3).map(function (l) { return l.char; });
    return _qaidaChoice({ text: t('qaida.ex.whichNoJoin') }, letter.char, others, rnd, { skill: letter.id, tag: 'shapes' });
  });
}

function _qaidaMuqattaatItems(lesson, rnd) {
  return lesson.examples.map(function (word) {
    var letters = Array.from(word).map(function (c) {
      for (var i = 0; i < QAIDA_LETTERS.length; i++) if (QAIDA_LETTERS[i].char === c) return QAIDA_LETTERS[i];
      return null;
    }).filter(Boolean);
    var names = letters.map(_qaidaLetterName);
    var answer = names.join(' · ');
    var distractors = [];
    if (letters.length > 1) distractors.push(names.slice().reverse().join(' · '));
    letters.forEach(function (letter, i) {
      var alike = _qaidaLookalikes(letter, QAIDA_LETTERS, rnd)[0];
      var swapped = names.slice();
      swapped[i] = _qaidaLetterName(alike);
      distractors.push(swapped.join(' · '));
    });
    return _qaidaChoice({ ask: t('qaida.ex.whichLetters'), arabic: word }, answer, qaidaShuffle(distractors, rnd), rnd,
      { skill: letters[0].id, tag: 'letters' });
  });
}

// ── Marks ───────────────────────────────────────────────────────

/** The vowel and tanwin marks a learner knows by this lesson. */
function _qaidaKnownVowels(known) {
  return QAIDA_SHORT_VOWELS.concat(QAIDA_TANWIN).filter(function (v) { return known.indexOf(v.id) >= 0; });
}

/** How is this syllable read? Wrong options use lookalike letters and other known vowels. */
function _qaidaSyllableItem(vowel, known, rnd) {
  var letters = _qaidaSyllableLetters();
  var letter = letters[Math.floor(rnd() * letters.length)];
  var answer = letter.sound + vowel.sound;
  var options = [];
  _qaidaKnownVowels(known).forEach(function (v) { if (v !== vowel) options.push(letter.sound + v.sound); });
  _qaidaLookalikes(letter, letters, rnd).slice(0, 3).forEach(function (l) { options.push(l.sound + vowel.sound); });
  return _qaidaChoice({ ask: t('qaida.ex.howRead'), arabic: letter.char + vowel.mark }, answer, qaidaShuffle(options, rnd), rnd,
    { skill: vowel.id, tag: vowel.sound.length > 1 ? 'tanwin' : 'vowels' });
}

function _qaidaLongVowelItem(rnd) {
  var letters = _qaidaSyllableLetters();
  var letter = letters[Math.floor(rnd() * letters.length)];
  var long = QAIDA_LONG_VOWELS[Math.floor(rnd() * 3)];
  var short = QAIDA_SHORT_VOWELS.map(function (v) { return letter.sound + v.sound; });
  var others = QAIDA_LONG_VOWELS.filter(function (l) { return l !== long; }).map(function (l) { return letter.sound + l.sound; });
  return _qaidaChoice({ ask: t('qaida.ex.howRead'), arabic: letter.char + long.vowel + long.letter },
    letter.sound + long.sound, qaidaShuffle(others.concat(short), rnd), rnd, { skill: 'long-vowels', tag: 'long' });
}

/** Two letters: the second with sukun (بَتْ → bat) or shaddah (بَتَّ → batta). */
function _qaidaClusterItem(kind, rnd) {
  var letters = _qaidaSyllableLetters();
  var a = letters[Math.floor(rnd() * letters.length)];
  var b = letters[Math.floor(rnd() * letters.length)];
  var arabic, answer, others;
  if (kind === 'sukun') {
    arabic = a.char + 'َ' + b.char + 'ْ';
    answer = a.sound + 'a' + b.sound;
    others = [a.sound + 'a' + b.sound + 'a', a.sound + 'a' + b.sound + 'i', b.sound + 'a' + a.sound];
  } else {
    arabic = a.char + 'َ' + b.char + 'َّ';
    answer = a.sound + 'a' + b.sound + b.sound + 'a';
    others = [a.sound + 'a' + b.sound + 'a', a.sound + 'a' + b.sound, a.sound + a.sound + 'a' + b.sound + 'a'];
  }
  return _qaidaChoice({ ask: t('qaida.ex.howRead'), arabic: arabic }, answer, others, rnd, { skill: kind, tag: kind });
}

function _qaidaWhichMarkItem(markId, known, rnd) {
  var mark = null;
  QAIDA_MARKS.forEach(function (m) { if (m.id === markId) mark = m; });
  var others = QAIDA_MARKS.filter(function (m) { return m.id !== markId && known.indexOf(m.id) >= 0 && m.id.indexOf('-') < 0; })
    .map(function (m) { return _qaidaMarkName(m.id); });
  ['fatha', 'kasra', 'damma', 'sukun', 'shadda'].forEach(function (id) { if (id !== markId) others.push(_qaidaMarkName(id)); });
  return _qaidaChoice({ ask: t('qaida.ex.whichMark'), arabic: mark.sample }, _qaidaMarkName(markId), qaidaShuffle(_qaidaUnique(others), rnd), rnd,
    { skill: markId, tag: _qaidaMarkTag(markId) });
}

function _qaidaMarkTag(markId) {
  if (markId === 'fatha' || markId === 'kasra' || markId === 'damma') return 'vowels';
  if (markId.indexOf('tan') > 0) return 'tanwin';
  if (markId === 'long-vowels' || markId === 'maddah') return 'long';
  if (markId === 'sukun' || markId === 'shadda') return markId;
  return 'joining';
}

/** Tap the words that use a mark, among real Quran words with and without it. */
function _qaidaSpotWordsItem(markId, words, rnd) {
  var withIt = words.filter(function (w) { return qaidaWordSkills(w).indexOf(markId) >= 0; });
  var without = words.filter(function (w) { return qaidaWordSkills(w).indexOf(markId) < 0; });
  if (withIt.length === 0 || without.length === 0) return null;
  var tokens = qaidaShuffle(qaidaShuffle(withIt, rnd).slice(0, 3).concat(qaidaShuffle(without, rnd).slice(0, 3)), rnd);
  var answer = [];
  tokens.forEach(function (w, i) { if (qaidaWordSkills(w).indexOf(markId) >= 0) answer.push(i); });
  return { type: 'spot', prompt: { text: t('qaida.ex.tapWith', { mark: _qaidaMarkName(markId) }) },
    tokens: tokens, answer: answer, skill: markId, tag: _qaidaMarkTag(markId) };
}

/** Real words for a lesson: its own examples plus earlier ones, for contrast. */
function _qaidaWordsFor(lesson) {
  var out = [];
  var ex = typeof QAIDA_EXAMPLES !== 'undefined' ? QAIDA_EXAMPLES : {};
  for (var i = 0; i < QAIDA_LESSONS.length; i++) {
    if (ex[QAIDA_LESSONS[i].id]) out = out.concat(ex[QAIDA_LESSONS[i].id]);
    if (QAIDA_LESSONS[i].id === lesson.id) break;
  }
  return _qaidaUnique(out);
}

function _qaidaMarkItems(lesson, rnd) {
  var known = getQaidaSkillsThrough(lesson.id);
  var words = _qaidaWordsFor(lesson);
  var items = [];
  lesson.teaches.forEach(function (markId) {
    items.push(_qaidaWhichMarkItem(markId, known, rnd));
    var vowel = null;
    QAIDA_SHORT_VOWELS.concat(QAIDA_TANWIN).forEach(function (v) { if (v.id === markId) vowel = v; });
    for (var i = 0; i < 6; i++) {
      if (vowel) items.push(_qaidaSyllableItem(vowel, known, rnd));
      else if (markId === 'long-vowels') items.push(_qaidaLongVowelItem(rnd));
      else if (markId === 'sukun' || markId === 'shadda') items.push(_qaidaClusterItem(markId, rnd));
    }
    for (var j = 0; j < 3; j++) {
      var spot = _qaidaSpotWordsItem(markId, words, rnd);
      if (spot) items.push(spot);
    }
  });
  return items;
}

// ── Review, surahs and checks ───────────────────────────────────

/** Items from the earlier lessons of the same level, mixed. */
function _qaidaReviewItems(lesson, rnd, verses) {
  var items = [];
  getQaidaLevelLessons(lesson.level).forEach(function (l) {
    if (l.number >= lesson.number || l.kind === 'review' || l.kind === 'check') return;
    items = items.concat(_qaidaItemsFor(l, Math.floor(rnd() * 1e9), verses));
  });
  if (lesson.level === 3 || items.length === 0) {
    // Advanced review: every mark, on real words
    var words = _qaidaWordsFor(getQaidaLesson('q2-7'));
    ['shadda', 'sukun', 'wasl', 'maddah', 'long-vowels', 'dammatan', 'kasratan', 'fathatan'].forEach(function (m) {
      var spot = _qaidaSpotWordsItem(m, words, rnd);
      if (spot) items.push(spot);
    });
  }
  return qaidaShuffle(items, rnd);
}

/** Put a verse's words in order; the verse audio plays alongside on the lesson screen. */
function _qaidaVerseItems(surahId, verseTexts, rnd) {
  var items = [];
  verseTexts.forEach(function (text, i) {
    var words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 8 || _qaidaUnique(words).length !== words.length) return;
    items.push({ type: 'build', prompt: { text: t('qaida.ex.orderVerse', { n: i + 1 }) },
      pieces: qaidaShuffle(words, rnd), answer: words, skill: 'wasl', tag: 'reading', surah: surahId, verse: i + 1 });
  });
  var all = [];
  verseTexts.forEach(function (text) { all = all.concat(text.split(/\s+/).filter(Boolean)); });
  ['shadda', 'sukun', 'long-vowels'].forEach(function (m) {
    var spot = _qaidaSpotWordsItem(m, _qaidaUnique(all), rnd);
    if (spot) items.push(spot);
  });
  return items;
}

/** Surahs a lesson reads from (its own, or a sample for the last check). */
function getQaidaLessonSurahs(lesson) {
  if (lesson.kind === 'surah') return [lesson.surah];
  if (lesson.kind === 'check' && lesson.level === 3) return [1, 112, 113, 114];
  return [];
}

function _qaidaCheckItems(lesson, rnd, verses) {
  if (lesson.level === 3) {
    var items = [];
    getQaidaLessonSurahs(lesson).forEach(function (s) {
      if (verses && verses[s]) items = items.concat(_qaidaVerseItems(s, verses[s], rnd).slice(0, 3));
    });
    return qaidaShuffle(items, rnd);
  }
  var picked = [];
  getQaidaLevelLessons(lesson.level).forEach(function (l) {
    if (l.kind === 'check' || l.kind === 'review') return;
    picked = picked.concat(qaidaShuffle(_qaidaItemsFor(l, Math.floor(rnd() * 1e9), verses), rnd).slice(0, 2));
  });
  return qaidaShuffle(picked, rnd);
}

function _qaidaItemsFor(lesson, seed, verses) {
  var rnd = qaidaRandom(seed);
  if (lesson.kind === 'letters') return _qaidaLetterItems(lesson, rnd);
  if (lesson.kind === 'shapes') return _qaidaShapeItems(rnd);
  if (lesson.kind === 'forms') return _qaidaFormItems(rnd);
  if (lesson.kind === 'nonjoining') return _qaidaNonJoiningItems(rnd);
  if (lesson.kind === 'muqattaat') return _qaidaMuqattaatItems(lesson, rnd);
  if (lesson.kind === 'marks') return _qaidaMarkItems(lesson, rnd);
  if (lesson.kind === 'review') return _qaidaReviewItems(lesson, rnd, verses);
  if (lesson.kind === 'surah') return verses && verses[lesson.surah] ? _qaidaVerseItems(lesson.surah, verses[lesson.surah], rnd) : [];
  if (lesson.kind === 'check') return _qaidaCheckItems(lesson, rnd, verses);
  return [];
}

/**
 * The exercises for one lesson. Reading checks use every item they draw;
 * other lessons use at most QAIDA_ITEMS_PER_LESSON, keeping their order
 * (new material first, then spotting), with listening questions mixed in.
 * @param {Object} lesson - from QAIDA_LESSONS
 * @param {number} seed
 * @param {Object} [verses] - { <surahId>: string[] } for surah lessons
 * @returns {Object[]} exercise items
 */
function buildQaidaLessonItems(lesson, seed, verses) {
  if (!lesson) return [];
  var items = _qaidaItemsFor(lesson, seed, verses);
  if (lesson.kind === 'check') return items.slice(0, 16);
  // Listening questions (js/qaida/qaida-listen-exercises.js) take the 3rd
  // and 7th places, so the lesson stays the same length.
  var listen = typeof buildQaidaListenItems === 'function' ? buildQaidaListenItems(lesson, seed) : [];
  items = items.slice(0, QAIDA_ITEMS_PER_LESSON - listen.length);
  listen.forEach(function (item, i) { items.splice(Math.min(items.length, 2 + i * 4), 0, item); });
  return items;
}

// ── Placement test bank ─────────────────────────────────────────

/**
 * The Qaida placement bank, one list per level:
 *   0 letters and shapes · 1 vowels, tanwin and long vowels ·
 *   2 sukun, shaddah and marks · 3 marks on real Quran words.
 * The attempt number seeds it, so a retake asks different questions.
 */
function buildQaidaBank(attempt) {
  var rnd = qaidaRandom(7919 * (attempt + 1));
  var bank = { 0: [], 1: [], 2: [], 3: [] };
  qaidaShuffle(QAIDA_LETTERS, rnd).slice(0, 8).forEach(function (letter, i) {
    bank[0].push(i % 2 === 0 ? _qaidaNameItem(letter, QAIDA_LETTERS, rnd) : _qaidaPickLetterItem(letter, QAIDA_LETTERS, rnd));
  });
  var vowels = ['fatha', 'kasra', 'damma', 'fathatan', 'kasratan', 'dammatan'];
  QAIDA_SHORT_VOWELS.concat(QAIDA_TANWIN).forEach(function (v) { bank[1].push(_qaidaSyllableItem(v, vowels, rnd)); });
  bank[1].push(_qaidaLongVowelItem(rnd), _qaidaLongVowelItem(rnd));
  var all = QAIDA_SKILL_IDS;
  bank[2].push(_qaidaClusterItem('sukun', rnd), _qaidaClusterItem('sukun', rnd), _qaidaClusterItem('shadda', rnd),
    _qaidaClusterItem('shadda', rnd), _qaidaWhichMarkItem('sukun', all, rnd), _qaidaWhichMarkItem('shadda', all, rnd),
    _qaidaWhichMarkItem('maddah', all, rnd), _qaidaWhichMarkItem('wasl', all, rnd));
  var words = _qaidaWordsFor(getQaidaLesson('q2-7'));
  ['wasl', 'shadda', 'sukun', 'maddah', 'silent', 'long-vowels', 'dammatan', 'kasratan'].forEach(function (m) {
    var spot = _qaidaSpotWordsItem(m, words, rnd);
    if (spot) bank[3].push(spot);
  });
  return bank;
}

// ── Practice drill ──────────────────────────────────────────────

/**
 * One "Confused letters" question for Practice: a letter that shares its
 * shape with others, asked among them (pick it, or tap every copy of it).
 * @param {number} seed
 * @returns {Object} exercise item
 */
function buildConfusedLettersDrill(seed) {
  var rnd = qaidaRandom(seed);
  var confusable = QAIDA_LETTERS.filter(function (l) {
    return QAIDA_LETTERS.some(function (o) { return o !== l && o.group === l.group; });
  });
  var letter = confusable[Math.floor(rnd() * confusable.length)];
  return rnd() < 0.5 ? _qaidaPickLetterItem(letter, QAIDA_LETTERS, rnd) : _qaidaSpotLetterItem(letter, QAIDA_LETTERS, rnd);
}

/**
 * One review question on a skill, for the Qaida review queue: letters are
 * named or picked among lookalikes, vowels and marks read on a syllable,
 * and the other marks named. Null for an unknown skill.
 * @param {string} skill - a QAIDA_SKILL_IDS id
 * @param {number} seed
 * @returns {Object|null} exercise item
 */
function buildQaidaSkillItem(skill, seed) {
  var rnd = qaidaRandom(seed);
  var letter = getQaidaLetter(skill);
  if (letter) {
    return rnd() < 0.5 ? _qaidaNameItem(letter, QAIDA_LETTERS, rnd) : _qaidaPickLetterItem(letter, QAIDA_LETTERS, rnd);
  }
  if (QAIDA_SKILL_IDS.indexOf(skill) < 0) return null;
  var vowel = null;
  QAIDA_SHORT_VOWELS.concat(QAIDA_TANWIN).forEach(function (v) { if (v.id === skill) vowel = v; });
  if (vowel) return _qaidaSyllableItem(vowel, QAIDA_SKILL_IDS, rnd);
  if (skill === 'hamza') return _qaidaHamzaItem(rnd);
  if (skill === 'long-vowels') return _qaidaLongVowelItem(rnd);
  if (skill === 'sukun' || skill === 'shadda') return _qaidaClusterItem(skill, rnd);
  return _qaidaWhichMarkItem(skill, QAIDA_SKILL_IDS, rnd);
}
