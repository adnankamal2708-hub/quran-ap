/**
 * strings-en.js — English UI strings and the t() lookup.
 *
 * STRINGS.en is a flat key -> string map, grouped by comment headers. Values
 * may contain {name} placeholders, filled from the vars object passed to t().
 * Add new keys here; render new UI text only through t().
 */

var STRINGS = {
  en: {
    // ── Learning tracks ──
    'track.qaida.name': 'Read Arabic from zero',
    'track.tajweed.name': 'Tajweed',
    'track.words.name': 'Word meanings',
    'track.understanding.name': 'Understanding',
    'track.qaida.desc': 'Learn to read the Arabic letters and marks',
    'track.tajweed.desc': 'Recite with correct pronunciation and rules',
    'track.words.desc': "Learn the meanings of the Quran's words",
    'track.understanding.desc': 'Translation and the grammar behind it',

    // ── Levels ──
    'level.0': 'Beginner',
    'level.1': 'Elementary',
    'level.2': 'Intermediate',
    'level.3': 'Advanced',

    // ── Quran progress ──
    'percent.words': "{p}% of the Quran's words understood",
    'percent.words.gained': "+{p}% of the Quran's words",

    // ── Learn and track menus ──
    'tracks.comingSoon': 'Coming soon',
    'tracks.add': 'Add a track',
    'tracks.makeMain': 'Make main track',
    'tracks.leave': 'Leave track',
    'tracks.main': 'Main track',
    'tracks.allWords': 'All words',
    'tracks.roots': 'Roots',
    'tracks.difficulty': 'Difficulty',
    'tracks.quiz': 'Quiz',
    'tracks.yours': 'Your tracks',
    'tracks.menu': 'Options for {track}',
    'tracks.back': 'All tracks',
    'tracks.premium': 'Premium',
    'tracks.locked': 'Finish {level} to unlock',
    'tracks.finished': 'Finished',
    'tracks.more': 'More ways to learn',
    'tracks.lessonN': 'Lesson {n}',
    'tracks.surahN': 'Surah {n}',
    'tracks.surahStudy': 'Surah study',
    'tracks.rootFamilies': 'Root families',

    // ── Practice tab ──
    'practice.due': 'Due today',
    'practice.drills': 'Drills',
    'practice.tests': 'Tests',

    // ── Placement test ──
    'test.words.title': 'Word meanings placement test',
    'test.words.desc': 'About 5 minutes · finds your level',
    'test.result.level': 'Your level: {level}',
    'test.result.kept': "You're already at {level}; your level stays.",
    'test.result.strengths': 'Strengths',
    'test.result.gaps': 'To work on',
    'test.result.start': 'Start at {lesson}',
    'test.start.foundation': 'Foundation lesson {n}',
    'upnext.continue': 'Continue',
    'test.question': 'Question {n}',
    'test.begin': 'Start the test',
    'test.next': 'Next',
    'test.quit': 'Quit',
    'test.close': 'Close',
    'test.tag.noun': 'Nouns',
    'test.tag.verb': 'Verbs',
    'test.tag.adjective': 'Adjectives',
    'test.tag.pronoun': 'Pronouns',
    'test.tag.adverb': 'Adverbs',
    'test.tag.particle': 'Particles',
    'test.tag.other': 'Other words',

    // ── Onboarding ──
    'onboarding.tracks.title': 'What do you want to learn?',
    'onboarding.tracks.desc': 'Pick one or more. You can change this any time.',
    'onboarding.new': "I'm completely new",
    'onboarding.new.desc': 'Start from the very beginning',
    'onboarding.test': 'Take a short test',
    'onboarding.test.desc': 'Find your level in about 5 minutes',
    'onboarding.tracks.required': 'Pick at least one thing to learn.',

    // ── Drills ──
    'drill.spot.title': 'Spot the word',
    'drill.spot.prompt': 'Tap every word that means “{meaning}”',
    'drill.build.title': 'Build the verse',
    'drill.build.prompt': 'Put the words in order',
    'drill.spot.desc': 'Find a word you know in an ayah',
    'drill.build.desc': 'Put an ayah back in order',
    'drill.needWords': 'Learn a few words first',
    'drill.noMatch': 'None of your words are in these ayahs yet. Learn a few more.',
    'drill.loading': 'Loading the ayahs…',
    'drill.unavailable': 'The Quran text could not be loaded. Check your connection and try again.',
    'drill.again': 'New drill',

    // ── Root lessons ──
    'root.letters': 'The root',
    'root.appears': 'Appears {n} times in the Quran',
    'root.family': 'The family',
    'root.otherForms': 'Other forms',
    'root.practice': 'Practice',
    'root.done': 'Root complete',
    'root.spot.prompt': 'Tap every word from this family',
    'root.progress': 'Question {n} of {total}',
    'root.row.meta': '{words} in family · {n} in the Quran',
    'root.continue': 'Continue',
    'root.next': 'Next',
    'root.finish': 'Finish',
    'root.score': '{n} of {total} correct',
    'root.noGain': 'Nothing new counted yet. Words count once they stick in review.',
    'root.all': 'All roots',
    'root.back': 'Back',

    // ── Exercises ──
    'exercise.check': 'Check',
    'exercise.correct': 'Correct',
    'exercise.incorrect': 'Not quite',
  },
};

/**
 * Look up an English string and fill its {name} placeholders from vars.
 * A missing key returns the key itself and reports it via __diag when present.
 */
function t(key, vars) {
  var table = STRINGS.en;
  if (!Object.prototype.hasOwnProperty.call(table, key)) {
    var diag = typeof window !== 'undefined' ? window.__diag : null;
    if (diag && typeof diag.warn === 'function') {
      diag.warn('i18n', 't', 'Missing string key: ' + key);
    }
    return key;
  }
  return table[key].replace(/\{(\w+)\}/g, function(match, name) {
    return vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
  });
}
