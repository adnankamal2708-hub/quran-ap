// ═══════════════════════════════════════════════════════════════
// salah-lessons.js — The Salah track's path: four levels of lessons
//
// Each lesson: { id 's<level>-<number>', level, number, kind, titleKey,
// phrases, part?, noteKey? }. kind is 'walkthrough' (the figure only),
// 'lesson' or 'check' (the level's reading check, last in each level).
// part picks one part of a phrase taught over several lessons. A lesson
// lists every school's version; salahLessonPhrases keeps the learner's.
// ═══════════════════════════════════════════════════════════════

var SALAH_LESSON_PLAN = {
  1: [
    { kind: 'walkthrough', phrases: [] },
    { phrases: ['takbir'] },
    { phrases: ['taawwudh', 'basmalah'], noteKey: 'salah.note.malikiBasmalah' },
    { phrases: ['ruku-tasbih'] },
    { phrases: ['tasmi', 'tahmid'] },
    { phrases: ['sujud-tasbih'] },
    { phrases: ['between-sajdah'] },
    { phrases: ['taslim'] },
  ],
  2: [
    { phrases: ['fatiha'], part: 0 },
    { phrases: ['fatiha'], part: 1 },
    { phrases: ['fatiha'], part: 2 },
    { phrases: ['ikhlas'] },
    { phrases: ['kawthar'] },
    { phrases: ['asr'] },
    { phrases: ['falaq'] },
    { phrases: ['nas'] },
  ],
  3: [
    { phrases: ['thana-subhanaka', 'thana-wajjahtu'], noteKey: 'salah.note.malikiThana' },
    { phrases: ['tashahhud-ibn-masud', 'tashahhud-ibn-abbas', 'tashahhud-umar'], part: 0 },
    { phrases: ['tashahhud-ibn-masud', 'tashahhud-ibn-abbas', 'tashahhud-umar'], part: 1 },
    { phrases: [], noteKey: 'salah.note.finger' },
    { phrases: [], noteKey: 'salah.note.sittings' },
  ],
  4: [
    { phrases: ['salawat-ibrahimiyyah'], part: 0 },
    { phrases: ['salawat-ibrahimiyyah'], part: 1 },
    { phrases: ['dua-abu-bakr'] },
    { phrases: ['refuge-four'] },
    { phrases: ['qunut-hadini', 'qunut-nastainuka'], part: 0, noteKey: 'salah.note.qunut' },
    { phrases: ['qunut-hadini', 'qunut-nastainuka'], part: 1 },
  ],
};

var SALAH_LESSONS = (function() {
  var out = [];
  Object.keys(SALAH_LESSON_PLAN).forEach(function(key) {
    var level = Number(key);
    var taught = [];
    SALAH_LESSON_PLAN[key].forEach(function(spec, i) {
      var id = 's' + level + '-' + (i + 1);
      var lesson = { id: id, level: level, number: i + 1, kind: spec.kind || 'lesson',
        titleKey: 'salah.lesson.' + id, phrases: spec.phrases };
      if (spec.part !== undefined) lesson.part = spec.part;
      if (spec.noteKey) lesson.noteKey = spec.noteKey;
      out.push(lesson);
      spec.phrases.forEach(function(p) { if (taught.indexOf(p) < 0) taught.push(p); });
    });
    var checkId = 's' + level + '-check';
    out.push({ id: checkId, level: level, number: SALAH_LESSON_PLAN[key].length + 1, kind: 'check',
      titleKey: 'salah.lesson.check', phrases: taught });
  });
  return out;
})();

/** The lesson with this id, or null. */
function getSalahLesson(id) {
  for (var i = 0; i < SALAH_LESSONS.length; i++) {
    if (SALAH_LESSONS[i].id === id) return SALAH_LESSONS[i];
  }
  return null;
}

/** The lessons of one level, in order, its check last. */
function getSalahLevelLessons(level) {
  return SALAH_LESSONS.filter(function(l) { return l.level === level; });
}

/** One part of a phrase as a phrase of its own: its words and meaning. */
function _salahPhrasePart(phrase, index) {
  var part = phrase.parts[index];
  var words = phrase.words.slice(part.from, part.to);
  var copy = {};
  Object.keys(phrase).forEach(function(k) { copy[k] = phrase[k]; });
  copy.words = words;
  copy.ar = words.map(function(w) { return w.ar; }).join(' ');
  copy.tr = words.map(function(w) { return w.tr; }).join(' ');
  copy.en = part.en;
  copy.part = index;
  return copy;
}

/** The phrase records a learner of this madhab meets in the lesson. */
function salahLessonPhrases(lesson, madhab) {
  var says = salahPhraseFor(madhab);
  return lesson.phrases.filter(says).map(function(id) {
    var p = getSalahPhrase(id);
    return lesson.part !== undefined ? _salahPhrasePart(p, lesson.part) : p;
  });
}
