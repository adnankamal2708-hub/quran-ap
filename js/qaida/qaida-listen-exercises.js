// ═══════════════════════════════════════════════════════════════
// qaida-listen-exercises.js — Word recordings and listening questions
// for Qaida lessons
//
// Uses quran.com's recording of real Quran words (QAIDA_WORD_REFS in
// js/qaida/qaida-word-audio.js, played through js/services/audio.js):
//   • letters lessons: hear a word, pick the letter it starts with, among
//     the letters the lesson teaches;
//   • marks lessons: hear a word, pick it among the lesson's words.
// Only words recorded as a single clip are asked, so every question plays
// exactly the word in its options. Same seed, same questions.
// ═══════════════════════════════════════════════════════════════

var QAIDA_LISTEN_PER_LESSON = 2;

/** quran.com's recordings of a word shown in the Qaida, or [] if it has none. */
function qaidaWordAudioUrls(word) {
  var ref = typeof QAIDA_WORD_REFS !== 'undefined' ? QAIDA_WORD_REFS[word] : null;
  if (!ref) return [];
  return ref[2].map(function (n) { return wordAudioUrl(ref[0], ref[1], n); });
}

/** The word recordings a lesson plays, fetched on open so it works offline. */
function qaidaLessonWordAudio(lesson) {
  var words = (lesson.kind === 'muqattaat' ? lesson.examples : []).slice();
  if (typeof QAIDA_EXAMPLES !== 'undefined' && QAIDA_EXAMPLES[lesson.id]) words = words.concat(QAIDA_EXAMPLES[lesson.id]);
  if (typeof QAIDA_LETTER_WORDS !== 'undefined') {
    lesson.teaches.forEach(function (id) { if (QAIDA_LETTER_WORDS[id]) words.push(QAIDA_LETTER_WORDS[id]); });
  }
  return words.reduce(function (urls, w) { return urls.concat(qaidaWordAudioUrls(w)); }, []);
}

function _qaidaOneClip(word) {
  return qaidaWordAudioUrls(word).length === 1;
}

function _qaidaListenItem(ask, word, answer, others, rnd, skill, tag) {
  var options = qaidaShuffle([answer].concat(others), rnd);
  return { type: 'listen-choose', prompt: { audio: qaidaWordAudioUrls(word)[0], ask: ask },
    options: options, answer: options.indexOf(answer), skill: skill, tag: tag };
}

function _qaidaListenLetterItems(lesson, rnd) {
  var letters = lesson.teaches.map(getQaidaLetter).filter(function (l) {
    return l && typeof QAIDA_LETTER_WORDS !== 'undefined' && _qaidaOneClip(QAIDA_LETTER_WORDS[l.id]);
  });
  if (letters.length < 2) return [];
  return qaidaShuffle(letters, rnd).slice(0, QAIDA_LISTEN_PER_LESSON).map(function (letter) {
    var others = qaidaShuffle(letters.filter(function (l) { return l !== letter; }), rnd).slice(0, 3)
      .map(function (l) { return l.char; });
    return _qaidaListenItem(t('qaida.ex.listenLetter'), QAIDA_LETTER_WORDS[letter.id], letter.char, others, rnd,
      letter.id, 'letters');
  });
}

function _qaidaListenWordItems(lesson, rnd) {
  var own = typeof QAIDA_EXAMPLES !== 'undefined' ? QAIDA_EXAMPLES[lesson.id] || [] : [];
  var words = own.filter(_qaidaOneClip);
  if (words.length < 4) return [];
  return qaidaShuffle(words, rnd).slice(0, QAIDA_LISTEN_PER_LESSON).map(function (word) {
    var others = qaidaShuffle(words.filter(function (w) { return w !== word; }), rnd).slice(0, 3);
    var skill = lesson.teaches.filter(function (s) { return qaidaWordSkills(word).indexOf(s) >= 0; })[0] || lesson.teaches[0];
    return _qaidaListenItem(t('qaida.ex.listenWord'), word, word, others, rnd, skill, _qaidaMarkTag(skill));
  });
}

/**
 * The listening questions for a lesson ([] for kinds without them).
 * @param {object} lesson - from QAIDA_LESSONS
 * @param {number} seed
 */
function buildQaidaListenItems(lesson, seed) {
  var rnd = qaidaRandom(seed * 31 + 7);
  if (lesson.kind === 'letters') return _qaidaListenLetterItems(lesson, rnd);
  if (lesson.kind === 'marks') return _qaidaListenWordItems(lesson, rnd);
  return [];
}
