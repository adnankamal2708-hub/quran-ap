// ── Qaida track: lessons, locks and progress ─────────────────────
// The 'qaida' (Read Arabic from zero) track over the lesson data in
// js/qaida/qaida-lessons.js, with the same shape the Word meanings track
// gives the track screens:
//   level:  { level, lessons: [{ kind: 'qaida', number, title, completed, ref }] }
//   ref:    the lesson id (q<level>-<number>)
//
// Progress is its own key, QAIDA_PROGRESS_KEY, synced as `qaidaProgress`
// alongside the existing fields (nothing existing changes):
//   { completed: { <lessonId>: { at, score } }, updatedAt }
// Lessons open in order; a level opens once the previous level's reading
// check is passed, or when placement put the learner at that level.

var QAIDA_TRACK_ID = 'qaida';
var QAIDA_PROGRESS_KEY = 'quran_qaida_progress';

/** Share of a reading check's questions needed to pass it */
var QAIDA_CHECK_PASS = 0.8;

function normalizeQaidaProgress(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var completed = {};
  var src = raw.completed && typeof raw.completed === 'object' ? raw.completed : {};
  Object.keys(src).forEach(function (id) {
    if (!getQaidaLesson(id)) return;
    var rec = src[id] || {};
    completed[id] = {
      at: typeof rec.at === 'number' && isFinite(rec.at) ? rec.at : 0,
      score: typeof rec.score === 'number' && isFinite(rec.score) ? Math.max(0, Math.min(1, rec.score)) : 1,
    };
  });
  return { completed: completed, updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0 };
}

function loadQaidaProgress() {
  try {
    return normalizeQaidaProgress(JSON.parse(localStorage.getItem(QAIDA_PROGRESS_KEY) || 'null'));
  } catch (e) {
    return normalizeQaidaProgress(null);
  }
}

function saveQaidaProgress(progress) {
  progress.updatedAt = Date.now();
  try { localStorage.setItem(QAIDA_PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage full or blocked */ }
}

function isQaidaLessonCompleted(id) {
  return !!loadQaidaProgress().completed[id];
}

/**
 * Record a finished lesson. A reading check only counts as finished when
 * the score reaches QAIDA_CHECK_PASS. Returns true if the lesson is newly
 * finished; a better score on a repeat is kept without counting as new.
 * @param {string} id - lesson id
 * @param {number} score - share of questions right, 0..1
 */
function completeQaidaLesson(id, score) {
  var lesson = getQaidaLesson(id);
  if (!lesson) return false;
  if (lesson.kind === 'check' && !(score >= QAIDA_CHECK_PASS)) return false;
  var progress = loadQaidaProgress();
  var prev = progress.completed[id];
  if (prev && prev.score >= score) return false;
  progress.completed[id] = { at: prev ? prev.at : Date.now(), score: score };
  saveQaidaProgress(progress);
  queueTracksSync();
  return !prev;
}

function qaidaLessonTitle(id) {
  var key = 'qaida.lesson.' + id + '.title';
  return typeof t === 'function' ? t(key) : key;
}

/** The four levels of the Qaida track, each with its lessons. */
function getQaidaLevels() {
  var done = loadQaidaProgress().completed;
  var levels = [];
  for (var level = 0; level < TRACK_LEVEL_COUNT; level++) {
    levels.push({
      level: level,
      lessons: getQaidaLevelLessons(level).map(function (l) {
        return { kind: 'qaida', number: l.number, title: qaidaLessonTitle(l.id), completed: !!done[l.id], ref: l.id };
      }),
    });
  }
  return levels;
}

function isQaidaLevelPassed(level, done) {
  var lessons = getQaidaLevelLessons(level);
  return lessons.length > 0 && !!done[lessons[lessons.length - 1].id];
}

/**
 * Why a level can't be opened: null (open) or 'progress' (pass the
 * previous level's reading check first, or place into this one). All of
 * Qaida is free, so there is no 'premium' lock.
 */
function getQaidaLevelLock(level) {
  if (level <= 0 || getTrackLevel(QAIDA_TRACK_ID) >= level) return null;
  return isQaidaLevelPassed(level - 1, loadQaidaProgress().completed) ? null : 'progress';
}

/** The placed level, or the number of passed reading checks, whichever is higher. */
function getQaidaLevel() {
  var done = loadQaidaProgress().completed;
  var passed = 0;
  while (passed < TRACK_LEVEL_COUNT - 1 && isQaidaLevelPassed(passed, done)) passed++;
  return Math.max(getTrackLevel(QAIDA_TRACK_ID), passed);
}

/** A lesson opens when its level is open and the lesson before it in the level is done. */
function isQaidaLessonUnlocked(id) {
  var lesson = getQaidaLesson(id);
  if (!lesson || getQaidaLevelLock(lesson.level) !== null) return false;
  if (lesson.number === 1) return true;
  var prev = getQaidaLevelLessons(lesson.level)[lesson.number - 2];
  return isQaidaLessonCompleted(prev.id);
}

/**
 * The first unfinished, open lesson at or above `level`, with its `level`
 * added; null when the next level with something left is locked or
 * nothing is left.
 */
function getQaidaNextLesson(level) {
  var levels = getQaidaLevels();
  for (var l = Math.max(0, level); l < levels.length; l++) {
    if (getQaidaLevelLock(l) !== null) return null;
    var lessons = levels[l].lessons;
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].completed) continue;
      lessons[i].level = l;
      return lessons[i];
    }
  }
  return null;
}

/**
 * Skills the learner has learned: those taught by finished lessons, plus
 * everything taught below the placed level.
 * @returns {string[]}
 */
function getLearnedQaidaSkills() {
  var done = loadQaidaProgress().completed;
  var placed = getTrackLevel(QAIDA_TRACK_ID);
  var out = [];
  QAIDA_LESSONS.forEach(function (l) {
    if (done[l.id] || l.level < placed) out = out.concat(l.teaches);
  });
  return out;
}

/**
 * Merge local and cloud Qaida progress: the union of finished lessons,
 * each keeping its earliest finish time and best score.
 */
function mergeQaidaProgress(local, cloud) {
  var a = normalizeQaidaProgress(local);
  var b = normalizeQaidaProgress(cloud);
  var out = { completed: {}, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
  [a.completed, b.completed].forEach(function (src) {
    Object.keys(src).forEach(function (id) {
      var prev = out.completed[id];
      var rec = src[id];
      out.completed[id] = prev
        ? { at: Math.min(prev.at || rec.at, rec.at || prev.at), score: Math.max(prev.score, rec.score) }
        : { at: rec.at, score: rec.score };
    });
  });
  return out;
}
