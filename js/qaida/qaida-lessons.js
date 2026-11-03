// ═══════════════════════════════════════════════════════════════
// qaida-lessons.js — The Qaida lessons, in Noorani Qaida order
//
// Data only. Each lesson's title is strings-en.js qaida.lesson.<id>.title.
// Exercises are generated from these fields (js/qaida/qaida-exercises.js),
// never written out item by item.
//
//   id       stable id, also the progress key: q<level>-<number>
//   level    0 Beginner, 1 Elementary, 2 Intermediate, 3 Advanced
//   number   1-based within the level
//   kind     what the lesson practises:
//              letters    new letters on their own
//              shapes     letters told apart only by their dots
//              forms      letters at the start, middle and end of a word
//              nonjoining the six letters that never join forward
//              muqattaat  the separate letters that open some surahs
//              marks      new marks on letters and real Quran words
//              review     earlier skills mixed, nothing new
//              surah      reading a whole short surah, with its audio
//              check      the level's reading check; passing opens the next
//   teaches  skill ids (QAIDA_SKILL_IDS) learned in this lesson
//   surah    for kind 'surah': the surah number
//   examples for kind 'muqattaat': the opening letters, without the marks
//            that sit on them in the muṣḥaf (taught later)
// ═══════════════════════════════════════════════════════════════

var QAIDA_LESSONS = [
  // ── Beginner: letters, shapes, joined letters ──
  { id: 'q0-1', level: 0, number: 1, kind: 'letters', teaches: ['alif', 'ba', 'ta', 'tha', 'jim', 'hha', 'kha'] },
  { id: 'q0-2', level: 0, number: 2, kind: 'letters', teaches: ['dal', 'dhal', 'ra', 'zay', 'sin', 'shin', 'sad'] },
  { id: 'q0-3', level: 0, number: 3, kind: 'letters', teaches: ['dad', 'tta', 'zza', 'ain', 'ghayn', 'fa', 'qaf'] },
  { id: 'q0-4', level: 0, number: 4, kind: 'letters', teaches: ['kaf', 'lam', 'mim', 'nun', 'ha', 'waw', 'ya', 'hamza'] },
  { id: 'q0-5', level: 0, number: 5, kind: 'shapes', teaches: [] },
  { id: 'q0-6', level: 0, number: 6, kind: 'forms', teaches: ['ta-marbuta', 'alif-maqsura'] },
  { id: 'q0-7', level: 0, number: 7, kind: 'nonjoining', teaches: [] },
  { id: 'q0-8', level: 0, number: 8, kind: 'muqattaat', teaches: [],
    examples: ['الم', 'الر', 'كهيعص', 'طه', 'طسم', 'يس', 'حم', 'عسق', 'ص', 'ق', 'ن'] },
  { id: 'q0-9', level: 0, number: 9, kind: 'check', teaches: [] },

  // ── Elementary: short vowels, tanwin, long vowels ──
  { id: 'q1-1', level: 1, number: 1, kind: 'marks', teaches: ['fatha'] },
  { id: 'q1-2', level: 1, number: 2, kind: 'marks', teaches: ['kasra'] },
  { id: 'q1-3', level: 1, number: 3, kind: 'marks', teaches: ['damma'] },
  { id: 'q1-4', level: 1, number: 4, kind: 'review', teaches: [] },
  { id: 'q1-5', level: 1, number: 5, kind: 'marks', teaches: ['fathatan'] },
  { id: 'q1-6', level: 1, number: 6, kind: 'marks', teaches: ['kasratan'] },
  { id: 'q1-7', level: 1, number: 7, kind: 'marks', teaches: ['dammatan'] },
  { id: 'q1-8', level: 1, number: 8, kind: 'marks', teaches: ['long-vowels'] },
  { id: 'q1-9', level: 1, number: 9, kind: 'check', teaches: [] },

  // ── Intermediate: sukun, shaddah, joining words ──
  { id: 'q2-1', level: 2, number: 1, kind: 'marks', teaches: ['sukun'] },
  { id: 'q2-2', level: 2, number: 2, kind: 'marks', teaches: ['shadda'] },
  { id: 'q2-3', level: 2, number: 3, kind: 'review', teaches: [] },
  { id: 'q2-4', level: 2, number: 4, kind: 'marks', teaches: ['maddah'] },
  { id: 'q2-5', level: 2, number: 5, kind: 'marks', teaches: ['wasl'] },
  { id: 'q2-6', level: 2, number: 6, kind: 'marks', teaches: ['silent'] },
  { id: 'q2-7', level: 2, number: 7, kind: 'check', teaches: [] },

  // ── Advanced: reading whole verses, Al-Fatihah and Juz ʿAmma ──
  { id: 'q3-1', level: 3, number: 1, kind: 'review', teaches: [] },
  { id: 'q3-2', level: 3, number: 2, kind: 'surah', teaches: [], surah: 1 },
  { id: 'q3-3', level: 3, number: 3, kind: 'surah', teaches: [], surah: 114 },
  { id: 'q3-4', level: 3, number: 4, kind: 'surah', teaches: [], surah: 113 },
  { id: 'q3-5', level: 3, number: 5, kind: 'surah', teaches: [], surah: 112 },
  { id: 'q3-6', level: 3, number: 6, kind: 'surah', teaches: [], surah: 111 },
  { id: 'q3-7', level: 3, number: 7, kind: 'surah', teaches: [], surah: 110 },
  { id: 'q3-8', level: 3, number: 8, kind: 'surah', teaches: [], surah: 109 },
  { id: 'q3-9', level: 3, number: 9, kind: 'surah', teaches: [], surah: 108 },
  { id: 'q3-10', level: 3, number: 10, kind: 'check', teaches: [] },
];

/** @returns {Object|null} the lesson with this id */
function getQaidaLesson(id) {
  for (var i = 0; i < QAIDA_LESSONS.length; i++) {
    if (QAIDA_LESSONS[i].id === id) return QAIDA_LESSONS[i];
  }
  return null;
}

/** @returns {Object[]} the lessons of one level, in order */
function getQaidaLevelLessons(level) {
  return QAIDA_LESSONS.filter(function (l) { return l.level === level; });
}

/**
 * Skills taught up to and including a lesson: what a learner who reached
 * it is expected to read. Used to choose fair example words.
 * @param {string} id - lesson id
 * @returns {string[]}
 */
function getQaidaSkillsThrough(id) {
  var out = [];
  for (var i = 0; i < QAIDA_LESSONS.length; i++) {
    out = out.concat(QAIDA_LESSONS[i].teaches);
    if (QAIDA_LESSONS[i].id === id) break;
  }
  return out;
}
