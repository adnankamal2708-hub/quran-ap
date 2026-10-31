// ═══════════════════════════════════════════════════════════════
// root-lesson-ui.js — "Study by root" (#view-root-lesson)
//
// With no lesson running the view lists every root, most frequent first.
// Opening a root runs a lesson, one screen per part: the root (letters,
// meaning, how often it appears), the family (words grouped by pattern),
// the practice exercises (drawn by the shared exercise UI) and the finish.
//
// The lesson comes from js/exercises/root-lesson.js. Every read-choose
// answer updates that word's SRS entry (2 correct, 0 wrong, as quiz.js
// does). The root is completed and the Quran percentage gained is shown on
// the finish. The spot exercise needs ayah text: it is fetched after the
// lesson opens and joins the practice when it arrives, so nothing waits.
//
// Clicks are handled by delegation on the view: every button carries a
// data-action, as in tracks-ui.js.
// ═══════════════════════════════════════════════════════════════

/**
 * The lesson in progress, or null (the view then shows the root list):
 * { rootKey, lesson, step, index, answered, correct, gained }
 *   step: 'root' | 'family' | 'practice' | 'finish'
 */
var _rootRun = null;

function _rlEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

/** lang/dir attributes for text that is Arabic (the root, a pattern, a word). */
function _rlArabicAttrs(text) {
  return /[؀-ۿ]/.test(text) ? ' lang="ar" dir="rtl"' : '';
}

function _rlBack(action, labelKey) {
  return '<button type="button" class="root-back" data-action="' + action + '">' +
    uiIcon('chevron-left', true) + '<span>' + _rlEsc(t(labelKey)) + '</span></button>';
}

function _rlTitle(textKey) {
  return '<h2 class="root-title" id="root-title" tabindex="-1">' + _rlEsc(t(textKey)) + '</h2>';
}

// ── Root list ───────────────────────────────────────────────────

function _rootRowMarkup(family, done) {
  var h = '<li><button type="button" class="root-row' + (done ? ' is-done' : '') + '"' +
    ' data-action="open-root" data-root="' + _rlEsc(family.root) + '">';
  h += '<span class="root-row-letters" lang="ar" dir="rtl">' + _rlEsc(family.root) + '</span>';
  h += '<span class="root-row-main">';
  h += '<span class="root-row-meaning">' + _rlEsc(family.rootMeaning) + '</span>';
  h += '<span class="root-row-meta">' +
    _rlEsc(t('root.row.meta', { words: family.wordCount, n: family.totalFrequency })) + '</span>';
  h += '</span>';
  if (done) {
    h += '<span class="root-row-state">' + uiIcon('check', true) +
      '<span class="sr-only">' + _rlEsc(t('tracks.finished')) + '</span></span>';
  }
  h += '</button></li>';
  return h;
}

function _listMarkup() {
  var h = '<div class="root-screen">';
  h += '<div class="root-head">' + _rlBack('back-to-path', 'root.back') + '</div>';
  h += _rlTitle('tracks.roots');
  h += '<ol class="root-list">';
  // Read the finished roots once: asking per row would rebuild the families 600+ times.
  var completed = loadRootFamilyProgress().completedRoots;
  getRootFamilyLessons().forEach(function(family) {
    h += _rootRowMarkup(family, completed.indexOf(family.root) !== -1);
  });
  h += '</ol></div>';
  return h;
}

// ── Lesson screens ──────────────────────────────────────────────

function _lessonHead() {
  return '<div class="root-head">' + _rlBack('list', 'tracks.roots') + '</div>';
}

function _rootStepMarkup(lesson) {
  var h = '<div class="root-screen">' + _lessonHead() + _rlTitle('root.letters');
  h += '<ul class="root-letters" lang="ar" dir="rtl">';
  lesson.letters.forEach(function(letter) {
    h += '<li class="root-letter' + (letter === '/' ? ' is-sep' : '') + '">' + _rlEsc(letter) + '</li>';
  });
  h += '</ul>';
  if (lesson.meaning) h += '<p class="root-lesson-meaning">' + _rlEsc(lesson.meaning) + '</p>';
  if (lesson.note) h += '<p class="root-note" dir="ltr">' + _rlEsc(lesson.note) + '</p>';
  h += '<p class="root-appears">' + _rlEsc(t('root.appears', { n: lesson.occurrences })) + '</p>';
  h += '<button type="button" class="btn root-continue" data-action="continue">' + _rlEsc(t('root.continue')) + '</button>';
  return h + '</div>';
}

function _familyGroupMarkup(group) {
  var h = '<section class="root-group">';
  h += '<h3 class="root-group-title"' + _rlArabicAttrs(group.pattern) + '>' + _rlEsc(group.pattern) + '</h3>';
  h += '<ul class="root-words">';
  group.words.forEach(function(word) {
    var also = group.alsoWritten && group.alsoWritten[word.id];
    h += '<li class="root-lesson-word"><span class="root-lesson-word-ar" lang="ar" dir="rtl">' + _rlEsc(word.arabic) + '</span>' +
      '<span class="root-lesson-word-en">' + _rlEsc(word.english);
    if (also) {
      h += '<small class="root-lesson-word-also">' + _rlEsc(t('root.alsoWritten')) + ' ' +
        also.map(function(a) { return '<span lang="ar" dir="rtl">' + _rlEsc(a) + '</span>'; }).join(' · ') + '</small>';
    }
    h += '</span></li>';
  });
  return h + '</ul></section>';
}

function _familyStepMarkup(lesson) {
  var h = '<div class="root-screen">' + _lessonHead() + _rlTitle('root.family');
  h += '<div class="root-groups">';
  lesson.groups.forEach(function(group) { h += _familyGroupMarkup(group); });
  h += '</div>';
  h += '<button type="button" class="btn root-continue" data-action="continue">' + _rlEsc(t('root.continue')) + '</button>';
  return h + '</div>';
}

function _practiceStepMarkup(run) {
  var h = '<div class="root-screen">' + _lessonHead() + _rlTitle('root.practice');
  h += '<p class="root-progress" role="status">' +
    _rlEsc(t('root.progress', { n: run.index + 1, total: run.lesson.exercises.length })) + '</p>';
  h += '<div class="root-body" id="root-exercise"></div>';
  h += '<div class="root-actions" id="root-next"></div>';
  return h + '</div>';
}

function _finishStepMarkup(run) {
  var total = run.lesson.exercises.length;
  var h = '<div class="root-screen root-finish">' + _rlTitle('root.done');
  if (total > 0) h += '<p class="root-score">' + _rlEsc(t('root.score', { n: run.correct, total: total })) + '</p>';
  h += '<p class="root-gain' + (run.gained > 0 ? '' : ' is-none') + '" role="status">' +
    _rlEsc(run.gained > 0 ? t('percent.words.gained', { p: run.gained }) : t('root.noGain')) + '</p>';
  h += '<button type="button" class="btn root-continue" data-action="list">' + _rlEsc(t('root.all')) + '</button>';
  return h + '</div>';
}

/** Render the root-lesson view: the root list, or the current part of the lesson. */
function renderRootLesson() {
  var view = document.getElementById('view-root-lesson');
  if (!view) return;
  view.onclick = _onRootClick;

  var run = _rootRun;
  if (!run) view.innerHTML = _listMarkup();
  else if (run.step === 'root') view.innerHTML = _rootStepMarkup(run.lesson);
  else if (run.step === 'family') view.innerHTML = _familyStepMarkup(run.lesson);
  else if (run.step === 'finish') view.innerHTML = _finishStepMarkup(run);
  else {
    view.innerHTML = _practiceStepMarkup(run);
    renderExercise(document.getElementById('root-exercise'), run.lesson.exercises[run.index], _onRootAnswer);
  }

  var title = document.getElementById('root-title');
  if (title) title.focus();
}

// ── Lesson flow ─────────────────────────────────────────────────

function _hasNextExercise(run) {
  return run.index + 1 < run.lesson.exercises.length;
}

function _renderNextButton(run) {
  var slot = document.getElementById('root-next');
  if (!slot) return;
  slot.innerHTML = '<button type="button" class="btn root-next" data-action="next">' +
    _rlEsc(t(_hasNextExercise(run) ? 'root.next' : 'root.finish')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.root-next') : null;
  if (button) button.focus();
}

/** Called by the exercise once the learner has checked an answer. */
function _onRootAnswer(correct) {
  var run = _rootRun;
  if (!run || run.step !== 'practice') return;
  var item = run.lesson.exercises[run.index];
  if (correct) run.correct += 1;
  if (item.wordId) rateSRSWord(item.wordId, correct ? 2 : 0);
  run.answered = true;
  _renderNextButton(run);
}

function _finishRoot(run) {
  run.step = 'finish';
  run.gained = typeof refreshWordMeaningsPercent === 'function' ? refreshWordMeaningsPercent().gained : 0;
  completeRootFamily(run.rootKey);
  renderRootLesson();
}

function _startPractice(run) {
  run.index = 0;
  run.answered = false;
  if (run.lesson.exercises.length === 0) {
    _finishRoot(run);
    return;
  }
  run.step = 'practice';
  renderRootLesson();
}

function _continueRootLesson() {
  var run = _rootRun;
  if (!run) return;
  if (run.step === 'root') {
    run.step = 'family';
    renderRootLesson();
  } else if (run.step === 'family') {
    _startPractice(run);
  }
}

function _nextExercise() {
  var run = _rootRun;
  if (!run || run.step !== 'practice' || !run.answered) return;
  if (!_hasNextExercise(run)) {
    _finishRoot(run);
    return;
  }
  run.index += 1;
  run.answered = false;
  renderRootLesson();
}

/**
 * Fetches ayah text until a spot exercise can be built, and adds it to the
 * lesson. Failures and slow loads only mean the lesson has no spot exercise.
 */
async function _loadRootSpot(run) {
  var loader = window.__quranLoader;
  if (!loader) return;
  // Already built with the lesson, because the surah was in memory.
  if (run.lesson.exercises.some(function(item) { return item.type === 'spot'; })) return;
  var surahIds = rootSpotSurahIds(run.rootKey);
  for (var i = 0; i < surahIds.length; i++) {
    try {
      await loader.loadSurah(surahIds[i]);
    } catch (e) {
      continue;
    }
    if (_rootRun !== run || run.step === 'finish') return;
    var spot = buildRootSpotItem(run.rootKey);
    if (spot) {
      run.lesson.exercises.push(spot);
      // The last answered question offered "Finish": now it leads on.
      if (run.step === 'practice' && run.answered) _renderNextButton(run);
      return;
    }
  }
}

// ── Entry points and clicks ─────────────────────────────────────

/** Open the root list. */
function showRootList() {
  _rootRun = null;
  switchView('root-lesson');
}

/**
 * Open the lesson for a root. Resolves once the optional spot exercise has
 * been looked for; the lesson is already on screen by then.
 */
async function startRootLesson(rootKey) {
  var lesson = buildRootLesson(rootKey);
  if (!lesson) return;
  // Take the Quran-percentage baseline, so the finish shows only this lesson's gain.
  if (typeof refreshWordMeaningsPercent === 'function') refreshWordMeaningsPercent();
  var run = { rootKey: rootKey, lesson: lesson, step: 'root', index: 0, answered: false, correct: 0, gained: 0 };
  _rootRun = run;
  switchView('root-lesson');
  await _loadRootSpot(run);
}

function _onRootClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');

  if (action === 'open-root') startRootLesson(el.getAttribute('data-root'));
  else if (action === 'back-to-path') switchView('track', { trackId: WORDS_TRACK_ID });
  else if (action === 'list') showRootList();
  else if (action === 'continue') _continueRootLesson();
  else if (action === 'next') _nextExercise();
}
