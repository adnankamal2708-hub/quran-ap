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
    'percent.qaida': "{p}% of the Quran's words you can read",
    'percent.qaida.gained': "+{p}% of the Quran's words you can read",

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

    // ── Qaida: letter and mark names ──
    'qaida.letter.alif.name': 'Alif',
    'qaida.letter.ba.name': 'Bā',
    'qaida.letter.ta.name': 'Tā',
    'qaida.letter.tha.name': 'Thā',
    'qaida.letter.jim.name': 'Jīm',
    'qaida.letter.hha.name': 'Ḥā',
    'qaida.letter.kha.name': 'Khā',
    'qaida.letter.dal.name': 'Dāl',
    'qaida.letter.dhal.name': 'Dhāl',
    'qaida.letter.ra.name': 'Rā',
    'qaida.letter.zay.name': 'Zāy',
    'qaida.letter.sin.name': 'Sīn',
    'qaida.letter.shin.name': 'Shīn',
    'qaida.letter.sad.name': 'Ṣād',
    'qaida.letter.dad.name': 'Ḍād',
    'qaida.letter.tta.name': 'Ṭā',
    'qaida.letter.zza.name': 'Ẓā',
    'qaida.letter.ain.name': 'ʿAyn',
    'qaida.letter.ghayn.name': 'Ghayn',
    'qaida.letter.fa.name': 'Fā',
    'qaida.letter.qaf.name': 'Qāf',
    'qaida.letter.kaf.name': 'Kāf',
    'qaida.letter.lam.name': 'Lām',
    'qaida.letter.mim.name': 'Mīm',
    'qaida.letter.nun.name': 'Nūn',
    'qaida.letter.ha.name': 'Hā',
    'qaida.letter.waw.name': 'Wāw',
    'qaida.letter.ya.name': 'Yā',
    'qaida.mark.hamza.name': 'Hamzah',
    'qaida.mark.hamza.desc': 'A small letter for a catch in the throat, written alone or on alif, wāw or yā',
    'qaida.mark.ta-marbuta.name': 'Tā marbūṭah',
    'qaida.mark.ta-marbuta.desc': 'Comes at the end of a word: read as t when the reading continues, h when you stop',
    'qaida.mark.alif-maqsura.name': 'Alif maqṣūrah',
    'qaida.mark.alif-maqsura.desc': 'Looks like yā without dots and comes at the end of a word; it lengthens the a before it',
    'qaida.mark.fatha.name': 'Fatḥah',
    'qaida.mark.fatha.desc': 'A short stroke above the letter: read it with a short a',
    'qaida.mark.kasra.name': 'Kasrah',
    'qaida.mark.kasra.desc': 'A short stroke below the letter: read it with a short i',
    'qaida.mark.damma.name': 'Ḍammah',
    'qaida.mark.damma.desc': 'A small wāw above the letter: read it with a short u',
    'qaida.mark.fathatan.name': 'Fatḥatān',
    'qaida.mark.fathatan.desc': 'Two strokes above the letter: read it with an',
    'qaida.mark.kasratan.name': 'Kasratān',
    'qaida.mark.kasratan.desc': 'Two strokes below the letter: read it with in',
    'qaida.mark.dammatan.name': 'Ḍammatān',
    'qaida.mark.dammatan.desc': 'Two ḍammahs above the letter: read it with un',
    'qaida.mark.long-vowels.name': 'Long vowels',
    'qaida.mark.long-vowels.desc': 'Alif after a fatḥah, wāw after a ḍammah and yā after a kasrah stretch the vowel to twice its length. A small alif, wāw or yā does the same',
    'qaida.mark.sukun.name': 'Sukūn',
    'qaida.mark.sukun.desc': 'A small circle or head above the letter: the letter has no vowel and joins the one before it',
    'qaida.mark.shadda.name': 'Shaddah',
    'qaida.mark.shadda.desc': 'A small w-shaped mark: the letter is read twice, first without a vowel, then with the vowel shown',
    'qaida.mark.maddah.name': 'Maddah',
    'qaida.mark.maddah.desc': 'A wavy line above a letter: stretch the sound longer than a normal long vowel',
    'qaida.mark.wasl.name': 'Hamzat al-waṣl',
    'qaida.mark.wasl.desc': 'Alif with a small ṣād: silent when you read on from the word before, read when you start from it',
    'qaida.mark.silent.name': 'Silent letters',
    'qaida.mark.silent.desc': 'A letter with a small oval or with no mark at all is written but not read',

    // ── Qaida: lesson titles ──
    'qaida.lesson.q0-1.title': 'Letters alif to khā',
    'qaida.lesson.q0-2.title': 'Letters dāl to ṣād',
    'qaida.lesson.q0-3.title': 'Letters ḍād to qāf',
    'qaida.lesson.q0-4.title': 'Letters kāf to yā, and hamzah',
    'qaida.lesson.q0-5.title': 'Letters that share a shape',
    'qaida.lesson.q0-6.title': 'Joined letters and word endings',
    'qaida.lesson.q0-7.title': "Letters that don't join forward",
    'qaida.lesson.q0-8.title': 'The opening letters of surahs',
    'qaida.lesson.q0-9.title': 'Reading check: letters',
    'qaida.lesson.q1-1.title': 'Fatḥah',
    'qaida.lesson.q1-2.title': 'Kasrah',
    'qaida.lesson.q1-3.title': 'Ḍammah',
    'qaida.lesson.q1-4.title': 'Short vowels together',
    'qaida.lesson.q1-5.title': 'Fatḥatān',
    'qaida.lesson.q1-6.title': 'Kasratān',
    'qaida.lesson.q1-7.title': 'Ḍammatān',
    'qaida.lesson.q1-8.title': 'Long vowels',
    'qaida.lesson.q1-9.title': 'Reading check: vowels',
    'qaida.lesson.q2-1.title': 'Sukūn',
    'qaida.lesson.q2-2.title': 'Shaddah',
    'qaida.lesson.q2-3.title': 'Sukūn and shaddah together',
    'qaida.lesson.q2-4.title': 'Maddah',
    'qaida.lesson.q2-5.title': 'Hamzat al-waṣl',
    'qaida.lesson.q2-6.title': 'Silent letters',
    'qaida.lesson.q2-7.title': 'Reading check: joining words',
    'qaida.lesson.q3-1.title': 'Reading whole words',
    'qaida.lesson.q3-2.title': 'Read Al-Fātiḥah',
    'qaida.lesson.q3-3.title': 'Read An-Nās',
    'qaida.lesson.q3-4.title': 'Read Al-Falaq',
    'qaida.lesson.q3-5.title': 'Read Al-Ikhlāṣ',
    'qaida.lesson.q3-6.title': 'Read Al-Masad',
    'qaida.lesson.q3-7.title': 'Read An-Naṣr',
    'qaida.lesson.q3-8.title': 'Read Al-Kāfirūn',
    'qaida.lesson.q3-9.title': 'Read Al-Kawthar',
    'qaida.lesson.q3-10.title': 'Reading check: verses',

    // ── Qaida: exercises ──
    'qaida.ex.whichName': 'What is this called?',
    'qaida.ex.whichLetter': 'Which letter is {name}?',
    'qaida.ex.tapEvery': 'Tap every {name}',
    'qaida.ex.whichForm': 'Which is {name} at the {position} of a word?',
    'qaida.ex.position.initial': 'start',
    'qaida.ex.position.medial': 'middle',
    'qaida.ex.position.final': 'end',
    'qaida.ex.whichNoJoin': 'Which letter never joins the letter after it?',
    'qaida.ex.whichLetters': 'Which letters are these, in reading order?',
    'qaida.ex.howRead': 'How is this read?',
    'qaida.ex.whichMark': 'What is this mark called?',
    'qaida.ex.tapWith': 'Tap the words with {mark}',
    'qaida.ex.orderVerse': 'Put the words of verse {n} in order',

    // ── Audio ──
    'audio.credit.husary': 'Recitation: Al-Husary',
    'audio.play': 'Play',

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
    'upnext.start': 'Start',
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
    'onboarding.tracks.required': 'Choose at least one track. Word meanings is available now.',
    'onboarding.group.tracks': 'Tracks',
    'onboarding.group.extras': 'Also',

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
    'root.alsoWritten': 'Also written',
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
