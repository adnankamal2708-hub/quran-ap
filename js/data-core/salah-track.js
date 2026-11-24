// ── Salah track: lessons, madhab, words and progress ─────────────
// The 'salah' (Understand your prayer) track over js/salah/salah-lessons.js,
// with the shape the Qaida track gives the track screens:
//   level:  { level, lessons: [{ kind: 'salah', number, title, completed, ref }] }
// Screen levels are 0..3; the lesson data numbers them 1..4 (s1-1 is 1.1).
//
// Progress is its own key, SALAH_PROGRESS_KEY, synced as `salahProgress`:
//   { completed: { <lessonId>: { at, score } }, known: { <wordKey>: at },
//     review: { <wordKey>: { due, step } }, cleared: { <wordKey>: at },
//     madhab, madhabAt, updatedAt }
// known holds the prayer's words answered right; the track's % is their
// share of the words the learner's madhab says. A missed Quran word goes to
// the main word reviews (rateSRSWord); a word not in the Quran, or one the
// free gate refuses, goes to the Salah review queue instead.
// The madhab lives here, not in quran_settings, so guests keep it too.

var SALAH_TRACK_ID = 'salah';
var SALAH_PROGRESS_KEY = 'quran_salah_progress';

/** Share of a reading check's questions needed to pass it (as Qaida) */
var SALAH_CHECK_PASS = 0.8;

/** The madhab used for a learner who has not chosen one */
var SALAH_DEFAULT_MADHAB = 'unsure';

function _salahNumber(x) {
  return typeof x === 'number' && isFinite(x) ? x : 0;
}

function _isSalahWordKey(key) {
  return typeof key === 'string' && key.length > 0;
}

function normalizeSalahProgress(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var completed = {};
  var src = raw.completed && typeof raw.completed === 'object' ? raw.completed : {};
  Object.keys(src).forEach(function (id) {
    if (!getSalahLesson(id)) return;
    var rec = src[id] || {};
    completed[id] = { at: _salahNumber(rec.at),
      score: typeof rec.score === 'number' && isFinite(rec.score) ? Math.max(0, Math.min(1, rec.score)) : 1 };
  });
  var known = {};
  var srcKnown = raw.known && typeof raw.known === 'object' ? raw.known : {};
  Object.keys(srcKnown).forEach(function (key) {
    if (_isSalahWordKey(key) && typeof srcKnown[key] === 'number' && isFinite(srcKnown[key])) known[key] = srcKnown[key];
  });
  var cleared = normalizeClearedMap(raw.cleared, _isSalahWordKey);
  var madhab = SALAH_MADHABS.indexOf(raw.madhab) >= 0 ? raw.madhab : null;
  return { completed: completed, known: known,
    review: dropClearedReviews(normalizeReviewMap(raw.review, _isSalahWordKey), cleared), cleared: cleared,
    madhab: madhab, madhabAt: madhab ? _salahNumber(raw.madhabAt) : 0, updatedAt: _salahNumber(raw.updatedAt) };
}

function loadSalahProgress() {
  try {
    return normalizeSalahProgress(JSON.parse(localStorage.getItem(SALAH_PROGRESS_KEY) || 'null'));
  } catch (e) {
    return normalizeSalahProgress(null);
  }
}

function saveSalahProgress(progress) {
  progress.updatedAt = Date.now();
  try { localStorage.setItem(SALAH_PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage full or blocked */ }
  queueTracksSync();
}

// ── Madhab ──────────────────────────────────────────────────────

/** The chosen madhab id, or null until the learner picks one. */
function getSalahMadhab() {
  return loadSalahProgress().madhab;
}

/** Choose a madhab (one of SALAH_MADHABS). Progress is kept as it is. */
function setSalahMadhab(id) {
  if (SALAH_MADHABS.indexOf(id) < 0) return false;
  var progress = loadSalahProgress();
  progress.madhab = id;
  progress.madhabAt = Date.now();
  saveSalahProgress(progress);
  return true;
}

function _salahMadhabOrDefault() {
  return getSalahMadhab() || SALAH_DEFAULT_MADHAB;
}

// ── Lessons and levels ──────────────────────────────────────────

/**
 * Record a finished lesson. A reading check only counts when the score
 * reaches SALAH_CHECK_PASS. True if newly finished; a better score on a
 * repeat is kept without counting as new.
 */
function completeSalahLesson(id, score) {
  var lesson = getSalahLesson(id);
  if (!lesson) return false;
  if (lesson.kind === 'check' && !(score >= SALAH_CHECK_PASS)) return false;
  var progress = loadSalahProgress();
  var prev = progress.completed[id];
  if (prev && prev.score >= score) return false;
  progress.completed[id] = { at: prev ? prev.at : Date.now(), score: score };
  saveSalahProgress(progress);
  return !prev;
}

function salahLessonTitle(lesson) {
  return typeof t === 'function' ? t(lesson.titleKey) : lesson.titleKey;
}

/** The four levels of the Salah track (screen levels 0..3), each with its lessons. */
function getSalahLevels() {
  var done = loadSalahProgress().completed;
  var levels = [];
  for (var level = 0; level < TRACK_LEVEL_COUNT; level++) {
    levels.push({
      level: level,
      lessons: getSalahLevelLessons(level + 1).map(function (l) {
        return { kind: 'salah', number: l.number, title: salahLessonTitle(l), completed: !!done[l.id], ref: l.id };
      }),
    });
  }
  return levels;
}

function _isSalahLevelPassed(level, done) {
  var lessons = getSalahLevelLessons(level + 1);
  return lessons.length > 0 && !!done[lessons[lessons.length - 1].id];
}

/** Why a screen level can't be opened: null (open) or 'progress'. All of Salah is free. */
function getSalahLevelLock(level) {
  if (level <= 0) return null;
  return _isSalahLevelPassed(level - 1, loadSalahProgress().completed) ? null : 'progress';
}

/** The number of passed reading checks: the screen level the learner is on. */
function getSalahLevel() {
  var done = loadSalahProgress().completed;
  var passed = 0;
  while (passed < TRACK_LEVEL_COUNT - 1 && _isSalahLevelPassed(passed, done)) passed++;
  return passed;
}

/** A lesson opens when its level is open and the lesson before it is done. */
function isSalahLessonUnlocked(id) {
  var lesson = getSalahLesson(id);
  if (!lesson || getSalahLevelLock(lesson.level - 1) !== null) return false;
  if (lesson.number === 1) return true;
  var prev = getSalahLevelLessons(lesson.level)[lesson.number - 2];
  return !!loadSalahProgress().completed[prev.id];
}

// ── Words and percentage ────────────────────────────────────────

/** A word's progress key: its vocabulary id, or its Arabic when not in the Quran. */
function salahWordKey(word) {
  return word.wordId || 'salah:' + word.ar;
}

function _salahQueueAnswer(progress, key, correct, now) {
  var next = scheduleReviewAnswer(progress.review[key], correct, now);
  if (next === undefined) return;
  if (next === null) {
    delete progress.review[key];
    progress.cleared[key] = now;
  } else {
    progress.review[key] = next;
  }
}

/**
 * Record an answer about one word of the prayer. Right: the word is known
 * (and a queued word moves on a step). Wrong: it is no longer known and goes
 * to review, the main word reviews for a Quran word, else the Salah queue.
 */
function recordSalahWord(word, correct, now) {
  if (!word || !word.ar) return;
  now = typeof now === 'number' ? now : Date.now();
  var key = salahWordKey(word);
  var progress = loadSalahProgress();
  if (correct) {
    progress.known[key] = now;
    _salahQueueAnswer(progress, key, true, now);
  } else {
    delete progress.known[key];
    var rated = word.wordId && typeof rateSRSWord === 'function' ? rateSRSWord(word.wordId, 0) !== false : false;
    if (!rated) _salahQueueAnswer(progress, key, false, now);
  }
  saveSalahProgress(progress);
}

/** Word keys due in the Salah review queue, most overdue first. */
function getDueSalahWords(now) {
  now = typeof now === 'number' ? now : Date.now();
  return dueReviewIds(loadSalahProgress().review, now);
}

/** Every distinct word key the learner's madhab says, over all lessons. */
function _salahWordKeys(madhab) {
  var keys = {};
  SALAH_LESSONS.forEach(function (l) {
    salahLessonPhrases(l, madhab).forEach(function (p) {
      p.words.forEach(function (w) { keys[salahWordKey(w)] = true; });
    });
  });
  return Object.keys(keys);
}

/** Share of the prayer's words the learner knows, 0..100 to one decimal. */
function getSalahPercent() {
  var known = loadSalahProgress().known;
  var keys = _salahWordKeys(_salahMadhabOrDefault());
  if (!keys.length) return 0;
  var count = keys.filter(function (k) { return !!known[k]; }).length;
  return Math.round((count / keys.length) * 1000) / 10;
}

/** Record the current percentage into the track's high-water mark. */
function refreshSalahPercent() {
  return recordTrackPercent(SALAH_TRACK_ID, getSalahPercent());
}

/**
 * Merge local and cloud Salah progress: the union of finished lessons (earliest
 * time, best score) and known words (latest time), the review queues by
 * mergeReviewQueues, and the madhab chosen last.
 */
function mergeSalahProgress(local, cloud) {
  var a = normalizeSalahProgress(local);
  var b = normalizeSalahProgress(cloud);
  var queue = mergeReviewQueues(a, b);
  var pick = b.madhabAt > a.madhabAt ? b : a;
  var out = { completed: {}, known: {}, review: queue.review, cleared: queue.cleared,
    madhab: pick.madhab, madhabAt: pick.madhabAt, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
  [a, b].forEach(function (src) {
    Object.keys(src.completed).forEach(function (id) {
      var prev = out.completed[id];
      var rec = src.completed[id];
      out.completed[id] = prev
        ? { at: Math.min(prev.at || rec.at, rec.at || prev.at), score: Math.max(prev.score, rec.score) }
        : { at: rec.at, score: rec.score };
    });
    Object.keys(src.known).forEach(function (key) {
      out.known[key] = Math.max(out.known[key] || 0, src.known[key]);
    });
  });
  return out;
}
