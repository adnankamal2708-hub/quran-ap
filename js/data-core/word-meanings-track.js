// ── Word meanings track: level map ───────────────────────────────
// Maps today's content onto the four levels of the 'words' track:
//   Level 0  the Foundation Course lessons
//   Level 1  guided-reading surahs with difficulty <= 2
//   Level 2  guided-reading surahs with difficulty >= 3
//   Level 3  surah study and root families
//
// Lesson shape: { kind, number, title, completed, ref }
//   kind: 'foundation' (ref = lesson index) | 'guided-surah' (ref = surahId)
//         | 'surah-study' | 'root-families'
//   number: 1-based within the level
//
// This file loads in the data bundle, before the app bundle that holds
// phase2-surahs.js, phase2.js and premium.js, so those are only touched
// inside functions (at call time), never at load time.

var WORDS_TRACK_ID = 'words';

/** Highest guided-surah difficulty that belongs to level 1 */
var WORDS_LEVEL_1_MAX_DIFFICULTY = 2;

function wordsPremiumHas(featureName) {
  var premium = typeof window !== 'undefined' ? window.__premium : null;
  if (!premium || !premium.FEATURES) return false;
  return premium.hasFeature(premium.FEATURES[featureName]);
}

function buildFoundationLevelLessons() {
  var total = typeof getFoundationLessonCount === 'function' ? getFoundationLessonCount() : 0;
  var lessons = [];
  for (var i = 0; i < total; i++) {
    var title = typeof getFoundationLessonThematicTitle === 'function' ? getFoundationLessonThematicTitle(i) : '';
    lessons.push({
      kind: 'foundation',
      number: i + 1,
      title: title || 'Lesson ' + (i + 1),
      completed: isFoundationLessonCompleted(i),
      ref: i,
    });
  }
  return lessons;
}

function guidedSurahTitle(surahId) {
  var info = typeof SURAH_INFO !== 'undefined' ? SURAH_INFO[surahId] : null;
  return info && info.nameSimple ? info.nameSimple : 'Surah ' + surahId;
}

function buildGuidedLevelLessons(keepSurah) {
  var guided = typeof PHASE2_GUIDED_SURAHS !== 'undefined' ? PHASE2_GUIDED_SURAHS : [];
  var lessons = [];
  guided.forEach(function(surah) {
    if (!keepSurah(surah)) return;
    lessons.push({
      kind: 'guided-surah',
      number: lessons.length + 1,
      title: guidedSurahTitle(surah.surahId),
      completed: isGuidedSurahCompleted(surah.surahId),
      ref: surah.surahId,
    });
  });
  return lessons;
}

function buildStudyLevelLessons() {
  var studied = typeof getCompletedSurahCount === 'function' ? getCompletedSurahCount() : 0;
  var roots = typeof getCompletedRootFamilyCount === 'function' ? getCompletedRootFamilyCount() : 0;
  return [
    { kind: 'surah-study', number: 1, title: 'Surah study', completed: studied > 0, ref: null },
    { kind: 'root-families', number: 2, title: 'Root families', completed: roots > 0, ref: null },
  ];
}

/** The four levels of the Word meanings track, each with its lessons. */
function getWordMeaningsLevels() {
  return [
    { level: 0, lessons: buildFoundationLevelLessons() },
    { level: 1, lessons: buildGuidedLevelLessons(function(s) { return s.difficulty <= WORDS_LEVEL_1_MAX_DIFFICULTY; }) },
    { level: 2, lessons: buildGuidedLevelLessons(function(s) { return s.difficulty > WORDS_LEVEL_1_MAX_DIFFICULTY; }) },
    { level: 3, lessons: buildStudyLevelLessons() },
  ];
}

function levelLessonsDone(lessons) {
  return lessons.length > 0 && lessons.every(function(lesson) { return lesson.completed; });
}

function isWordMeaningsLevelComplete(level) {
  return levelLessonsDone(getWordMeaningsLevels()[level].lessons);
}

/**
 * Why a level can't be opened: null (open), 'premium' (needs a plan) or
 * 'progress' (finish the previous level first, or place into this one).
 */
function getWordMeaningsLevelLock(level) {
  if (level <= 0) return null;
  var feature = level === 3 ? 'VOCABULARY_EXPANSION' : 'GUIDED_READING';
  if (!wordsPremiumHas(feature)) return 'premium';
  if (getTrackLevel(WORDS_TRACK_ID) >= level) return null;
  return isWordMeaningsLevelComplete(level - 1) ? null : 'progress';
}

/**
 * The learner's level in this track: the placed (stored) level, or the
 * highest level whose earlier levels are all finished, whichever is higher.
 * Finishing levels never writes the stored level; this only reads.
 */
function getWordMeaningsLevel() {
  var levels = getWordMeaningsLevels();
  var finished = 0;
  while (finished < levels.length - 1 && levelLessonsDone(levels[finished].lessons)) finished++;
  return Math.max(getTrackLevel(WORDS_TRACK_ID), finished);
}

function isLessonOpenToStart(lesson, level) {
  // Level 3 entries are open-ended: `completed` means "started" (R8).
  if (level === 3) return true;
  if (lesson.completed) return false;
  if (lesson.kind !== 'foundation' || typeof isFoundationLessonUnlocked !== 'function') return true;
  return isFoundationLessonUnlocked(lesson.ref);
}

/**
 * The first unfinished lesson at or above `level` that this learner can
 * open, with its `level` added; null when the next level with something
 * left is locked (premium or progress) or nothing is left.
 */
function getWordMeaningsNextLesson(level) {
  var levels = getWordMeaningsLevels();
  for (var l = Math.max(0, level); l < levels.length; l++) {
    if (getWordMeaningsLevelLock(l) !== null) return null;
    var lessons = levels[l].lessons;
    for (var i = 0; i < lessons.length; i++) {
      if (!isLessonOpenToStart(lessons[i], l)) continue;
      lessons[i].level = l;
      return lessons[i];
    }
  }
  return null;
}

/** True once a learner may start guided reading: graduate, or placed at level 1+. */
function hasReachedGuidedReading() {
  var graduated = typeof isFoundationGraduate === 'function' && isFoundationGraduate();
  return graduated || getTrackLevel(WORDS_TRACK_ID) >= 1;
}

/** Share of the Quran's words the learner currently understands (0..100). */
function getWordMeaningsPercent() {
  return calculateCoverage().coveragePercent;
}

/** Record the current percentage into the track's high-water mark. */
function refreshWordMeaningsPercent() {
  return recordTrackPercent(WORDS_TRACK_ID, getWordMeaningsPercent());
}
