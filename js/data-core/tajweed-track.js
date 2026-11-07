// ── Tajweed track: lessons, locks, verses and progress ──────────
// The 'tajweed' track over the lesson data in
// js/tajweed/tajweed-lessons.js, in the same shape the Qaida track gives
// the track screens:
//   level:  { level, lessons: [{ kind: 'tajweed', number, title, completed, ref }] }
//   ref:    the lesson id (tj<level>-<number>)
//
// Progress is its own key, TAJWEED_PROGRESS_KEY, synced as
// `tajweedProgress` alongside the existing fields (nothing existing changes):
//   { completed: { <lessonId>: { at, score } },
//     review: { <id>: { due, step } }, cleared: { <id>: at },
//     smooth: { "<surah>:<ayah>": at }, updatedAt }
// review ids are tj-letter:<letterId> and tj-verse:<surah>:<ayah>, on the
// shared schedule (js/data-core/review-schedule.js); cleared holds when
// each id last left the queue, so a sync can't bring it back. smooth holds the
// verses marked "Smooth" in verse practice; the track's percent is the
// share of the Quran's words in them. Only Beginner has lessons so far;
// the levels above it show as coming later.

var TAJWEED_TRACK_ID = 'tajweed';
var TAJWEED_PROGRESS_KEY = 'quran_tajweed_progress';

/** Share of a reading check's questions needed to pass it */
var TAJWEED_CHECK_PASS = 0.8;

/** Surahs in verse-practice order: Al-Fātiḥah, Juz ʿAmma from an-Nās back to an-Nabaʾ, then Al-Baqarah onward */
var TAJWEED_VERSE_ORDER = (function () {
  var order = [1];
  for (var s = 114; s >= 78; s--) order.push(s);
  for (s = 2; s <= 77; s++) order.push(s);
  return order;
})();

/**
 * A letter the Tajweed lessons teach: one of the 28 QAIDA_LETTERS, or
 * hamza, which Qaida teaches as a mark.
 * @returns {{id: string, char: string, nameKey: string}|null}
 */
function getTajweedLetter(id) {
  if (id === 'hamza') return { id: 'hamza', char: 'ء', nameKey: 'qaida.mark.hamza.name' };
  var letter = getQaidaLetter(id);
  return letter ? { id: letter.id, char: letter.char, nameKey: 'qaida.letter.' + letter.id + '.name' } : null;
}

function _tajweedParseVerseKey(key) {
  var m = /^(\d+):(\d+)$/.exec(key);
  return m && verseWordCount(+m[1], +m[2]) > 0 ? { surah: +m[1], ayah: +m[2] } : null;
}

/** The one spelling of a verse key ("1:1", never "01:1"), or null for a verse that doesn't exist */
function _tajweedVerseKey(key) {
  var v = _tajweedParseVerseKey(key);
  return v ? v.surah + ':' + v.ayah : null;
}

/** A review id this track schedules: tj-letter:<letter or hamza> or tj-verse:<surah>:<ayah> */
function _isTajweedReviewId(id) {
  if (typeof id !== 'string') return false;
  if (id.indexOf('tj-letter:') === 0) return !!getTajweedLetter(id.slice('tj-letter:'.length));
  if (id.indexOf('tj-verse:') === 0) return !!_tajweedParseVerseKey(id.slice('tj-verse:'.length));
  return false;
}

function _tajweedValidTime(at) {
  return typeof at === 'number' && isFinite(at) ? at : 0;
}

/** A valid review id with its verse key in canonical form */
function _canonicalTajweedId(id) {
  return id.indexOf('tj-verse:') === 0 ? 'tj-verse:' + _tajweedVerseKey(id.slice('tj-verse:'.length)) : id;
}

/** Rewrite tj-verse ids to canonical form; when two collapse, keep the less advanced copy. */
function _canonicalTajweedReview(review) {
  var out = {};
  Object.keys(review).forEach(function (id) {
    var canon = _canonicalTajweedId(id);
    var prev = out[canon];
    var rec = review[id];
    if (!prev || rec.step < prev.step || (rec.step === prev.step && rec.due < prev.due)) out[canon] = rec;
  });
  return out;
}

function normalizeTajweedProgress(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var completed = {};
  var src = raw.completed && typeof raw.completed === 'object' ? raw.completed : {};
  Object.keys(src).forEach(function (id) {
    if (!getTajweedLesson(id)) return;
    var rec = src[id] || {};
    completed[id] = {
      at: _tajweedValidTime(rec.at),
      score: typeof rec.score === 'number' && isFinite(rec.score) ? Math.max(0, Math.min(1, rec.score)) : 1,
    };
  });
  var smooth = {};
  var verses = raw.smooth && typeof raw.smooth === 'object' ? raw.smooth : {};
  Object.keys(verses).forEach(function (key) {
    var canon = _tajweedVerseKey(key);
    if (!canon) return;
    var at = _tajweedValidTime(verses[key]);
    smooth[canon] = smooth[canon] === undefined ? at : Math.min(smooth[canon] || at, at || smooth[canon]);
  });
  var stored = normalizeClearedMap(raw.cleared, _isTajweedReviewId);
  var cleared = {};
  Object.keys(stored).forEach(function (id) {
    var canon = _canonicalTajweedId(id);
    if (!(cleared[canon] >= stored[id])) cleared[canon] = stored[id];
  });
  return { completed: completed,
    review: dropClearedReviews(_canonicalTajweedReview(normalizeReviewMap(raw.review, _isTajweedReviewId)), cleared),
    cleared: cleared, smooth: smooth,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0 };
}

function loadTajweedProgress() {
  try {
    return normalizeTajweedProgress(JSON.parse(localStorage.getItem(TAJWEED_PROGRESS_KEY) || 'null'));
  } catch (e) {
    return normalizeTajweedProgress(null);
  }
}

function saveTajweedProgress(progress) {
  progress.updatedAt = Date.now();
  try { localStorage.setItem(TAJWEED_PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage full or blocked */ }
}

function isTajweedLessonCompleted(id) {
  return !!loadTajweedProgress().completed[id];
}

/**
 * Record a finished lesson. A reading check only counts as finished when
 * the score reaches TAJWEED_CHECK_PASS. Returns true if the lesson is
 * newly finished; a better score on a repeat is kept without counting as new.
 * @param {string} id - lesson id
 * @param {number} score - share of questions right, 0..1
 */
function completeTajweedLesson(id, score) {
  var lesson = getTajweedLesson(id);
  if (!lesson) return false;
  if (lesson.kind === 'check' && !(score >= TAJWEED_CHECK_PASS)) return false;
  var progress = loadTajweedProgress();
  var prev = progress.completed[id];
  if (prev && prev.score >= score) return false;
  progress.completed[id] = { at: prev ? prev.at : Date.now(), score: score };
  saveTajweedProgress(progress);
  queueTracksSync();
  return !prev;
}

function tajweedLessonTitle(id) {
  var key = 'tajweed.lesson.' + id + '.title';
  return typeof t === 'function' ? t(key) : key;
}

/** The four levels of the Tajweed track, each with its lessons (none yet above Beginner). */
function getTajweedLevels() {
  var done = loadTajweedProgress().completed;
  var levels = [];
  for (var level = 0; level < TRACK_LEVEL_COUNT; level++) {
    levels.push({
      level: level,
      lessons: getTajweedLevelLessons(level).map(function (l) {
        return { kind: 'tajweed', number: l.number, title: tajweedLessonTitle(l.id), completed: !!done[l.id], ref: l.id };
      }),
    });
  }
  return levels;
}

function isTajweedLevelPassed(level, done) {
  var lessons = getTajweedLevelLessons(level);
  return lessons.length > 0 && !!done[lessons[lessons.length - 1].id];
}

/**
 * Why a level can't be opened: null (open), 'coming' (it has no lessons
 * yet) or 'progress' (pass the previous level's reading check first, or
 * place into this one). All of Tajweed is free, so there is no 'premium'
 * lock.
 */
function getTajweedLevelLock(level) {
  if (level <= 0) return null;
  if (getTajweedLevelLessons(level).length === 0) return 'coming';
  if (getTrackLevel(TAJWEED_TRACK_ID) >= level) return null;
  return isTajweedLevelPassed(level - 1, loadTajweedProgress().completed) ? null : 'progress';
}

/** The placed level, or the number of passed reading checks, whichever is higher. */
function getTajweedLevel() {
  var done = loadTajweedProgress().completed;
  var passed = 0;
  while (passed < TRACK_LEVEL_COUNT - 1 && isTajweedLevelPassed(passed, done)) passed++;
  return Math.max(getTrackLevel(TAJWEED_TRACK_ID), passed);
}

/** A lesson opens when its level is open and the lesson before it in the level is done. */
function isTajweedLessonUnlocked(id) {
  var lesson = getTajweedLesson(id);
  if (!lesson || getTajweedLevelLock(lesson.level) !== null) return false;
  if (lesson.number === 1) return true;
  var prev = getTajweedLevelLessons(lesson.level)[lesson.number - 2];
  return isTajweedLessonCompleted(prev.id);
}

/**
 * The first unfinished, open lesson at or above `level`, with its `level`
 * added; null when the next level with something left is locked or
 * nothing is left.
 */
function getTajweedNextLesson(level) {
  var levels = getTajweedLevels();
  for (var l = Math.max(0, level); l < levels.length; l++) {
    if (getTajweedLevelLock(l) !== null) return null;
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
 * How many of the 28 letters (QAIDA_LETTERS; hamza is extra) the learner
 * has covered: those in finished lessons, or all of them once placed
 * above Beginner.
 */
function getTajweedLettersCovered() {
  if (getTrackLevel(TAJWEED_TRACK_ID) > 0) return QAIDA_LETTERS.length;
  var done = loadTajweedProgress().completed;
  var covered = {};
  TAJWEED_LESSONS.forEach(function (l) {
    if (!done[l.id]) return;
    l.letters.forEach(function (id) { if (getQaidaLetter(id)) covered[id] = true; });
  });
  return Object.keys(covered).length;
}

// ── Verse practice ──────────────────────────────────────────────

/**
 * Record a verse-practice mark. "Smooth" adds the verse to the smooth
 * set (keeping its first time) and takes it out of the review queue;
 * "Not yet" schedules it as a miss. Verses that don't exist are ignored.
 * @param {number} surah
 * @param {number} ayah
 * @param {boolean} smooth
 * @param {number} [now]
 */
function markTajweedVerse(surah, ayah, smooth, now) {
  surah = +surah;
  ayah = +ayah;
  if (!(verseWordCount(surah, ayah) > 0)) return;
  now = typeof now === 'number' ? now : Date.now();
  var key = surah + ':' + ayah;
  var progress = loadTajweedProgress();
  if (smooth) {
    if (progress.smooth[key] === undefined) progress.smooth[key] = now;
    delete progress.review['tj-verse:' + key];
    progress.cleared['tj-verse:' + key] = now;
  } else {
    progress.review['tj-verse:' + key] = scheduleReviewAnswer(progress.review['tj-verse:' + key], false, now);
  }
  saveTajweedProgress(progress);
  queueTracksSync();
}

/**
 * The first verse in TAJWEED_VERSE_ORDER not yet marked smooth, or null
 * when all are. With `after`, the search starts at the verse after it (so
 * verse practice can move past a verse marked Not yet); null past the end
 * of the order or for a verse that doesn't exist.
 * @param {{surah: number, ayah: number}} [after]
 */
function getNextTajweedVerse(after) {
  var smooth = loadTajweedProgress().smooth;
  var i = 0;
  var ayah = 1;
  if (after) {
    if (!(verseWordCount(+after.surah, +after.ayah) > 0)) return null;
    i = TAJWEED_VERSE_ORDER.indexOf(+after.surah);
    ayah = +after.ayah + 1;
  }
  for (; i < TAJWEED_VERSE_ORDER.length; i++, ayah = 1) {
    var surah = TAJWEED_VERSE_ORDER[i];
    for (; ayah <= VERSE_WORD_COUNTS[surah].length; ayah++) {
      if (smooth[surah + ':' + ayah] === undefined) return { surah: surah, ayah: ayah };
    }
  }
  return null;
}

/**
 * Share of the Quran's words in verses marked smooth (0..100), unrounded:
 * one verse is often under 0.1%, so the screens round it for display.
 */
function getTajweedPercent() {
  var words = 0;
  Object.keys(loadTajweedProgress().smooth).forEach(function (key) {
    var v = _tajweedParseVerseKey(key);
    words += verseWordCount(v.surah, v.ayah);
  });
  return words / QURAN_WORD_TOTAL * 100;
}

/** Record the current percentage into the track's high-water mark. */
function refreshTajweedPercent() {
  return recordTrackPercent(TAJWEED_TRACK_ID, getTajweedPercent());
}

/**
 * Merge local and cloud Tajweed progress: the union of finished lessons
 * (earliest finish time and best score each), of smooth verses (earliest
 * time each) and of the review queue (the less advanced copy of each, less
 * the records scheduled before the id last left the queue on either side).
 */
function mergeTajweedProgress(local, cloud) {
  var a = normalizeTajweedProgress(local);
  var b = normalizeTajweedProgress(cloud);
  var cleared = mergeClearedMaps(a.cleared, b.cleared);
  var out = { completed: {}, review: mergeReviewMaps(dropClearedReviews(a.review, cleared), dropClearedReviews(b.review, cleared)),
    cleared: cleared, smooth: {}, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
  [a, b].forEach(function (src) {
    Object.keys(src.completed).forEach(function (id) {
      var prev = out.completed[id];
      var rec = src.completed[id];
      out.completed[id] = prev
        ? { at: Math.min(prev.at || rec.at, rec.at || prev.at), score: Math.max(prev.score, rec.score) }
        : { at: rec.at, score: rec.score };
    });
    Object.keys(src.smooth).forEach(function (key) {
      var prev = out.smooth[key];
      var at = src.smooth[key];
      out.smooth[key] = prev === undefined ? at : Math.min(prev || at, at || prev);
    });
  });
  return out;
}

// ── Review queue ────────────────────────────────────────────────

/**
 * Record an answer about a letter or verse. A miss puts it in the queue
 * (or back at its start); a right answer when it is due spaces it out,
 * and after the last step it leaves (scheduleReviewAnswer).
 * @param {string} id - tj-letter:<letterId> or tj-verse:<surah>:<ayah>
 * @param {boolean} ok
 * @param {number} [now]
 */
function recordTajweedReview(id, ok, now) {
  if (!_isTajweedReviewId(id)) return;
  now = typeof now === 'number' ? now : Date.now();
  var progress = loadTajweedProgress();
  var next = scheduleReviewAnswer(progress.review[id], ok, now);
  if (next === undefined) return;
  if (next === null) {
    delete progress.review[id];
    progress.cleared[id] = now;
  } else {
    progress.review[id] = next;
  }
  saveTajweedProgress(progress);
  queueTracksSync();
}

/**
 * Letters and verses due for review, most overdue first.
 * @param {number} [now]
 * @returns {string[]}
 */
function getDueTajweedItems(now) {
  now = typeof now === 'number' ? now : Date.now();
  return dueReviewIds(loadTajweedProgress().review, now);
}

// ── Release ─────────────────────────────────────────────────────

/**
 * True once every one of the 28 letters has a recording
 * (QAIDA_AUDIO_MANIFEST); the track is released then. hamza's recording
 * is optional.
 */
function areLetterRecordingsComplete() {
  if (typeof qaidaAudioUrl !== 'function') return false;
  return QAIDA_LETTERS.every(function (l) { return !!qaidaAudioUrl(l.id); });
}
