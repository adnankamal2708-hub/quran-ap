// ═══════════════════════════════════════════════════════════════
// salah-ui.js — a Salah lesson (#view-salah-lesson)
//
// A learner with no madhab chooses one first (js/ui/salah-madhab-ui.js).
// Then three screens, laid out like a Qaida lesson: the intro (each phrase
// with the figure in its position, the Arabic, transliteration, the words
// one by one, the meaning and where the wording comes from; the walkthrough,
// js/ui/salah-walk-ui.js, plays a whole prayer), the practice (exercises from
// js/salah/salah-exercises.js) and the finish (score and the share of the
// prayer's words understood). A reading check below SALAH_CHECK_PASS is not
// recorded and offers a retry; a lesson with nothing to ask ends on Done.
//
// Clicks are handled by delegation on the view: every button carries a
// data-action.
// ═══════════════════════════════════════════════════════════════

/**
 * The screen in progress, or null:
 * { step: 'madhab', onDone } or
 * { step: 'intro' | 'practice' | 'finish', lesson, madhab, items, index,
 *   answered, correct, gained, passed, seed }
 */
var _salahRun = null;

/** The moving figure on the walkthrough intro, or null */
var _salahFig = null;

/** Levels (as the lesson data numbers them) whose content awaits a teacher's review */
var SALAH_REVIEW_LEVELS = [3, 4];

function _sEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

function _sAr(text, className) {
  return '<span class="' + className + '" lang="ar" dir="rtl">' + _sEsc(text) + '</span>';
}

function _sHead() {
  return '<div class="qaida-head"><button type="button" class="qaida-back" data-action="back">' +
    uiIcon('chevron-left', true) + '<span>' + _sEsc(t('track.salah.name')) + '</span></button></div>';
}

function _sTitle(text) {
  return '<h2 class="qaida-title" id="salah-title" tabindex="-1">' + _sEsc(text) + '</h2>';
}

function _sNote(key, extra) {
  return '<p class="qaida-note' + (extra || '') + '">' + _sEsc(t(key, { pct: Math.round(SALAH_CHECK_PASS * 100) })) + '</p>';
}

// ── Intro ───────────────────────────────────────────────────────

function _sSources(phrase) {
  var list = phrase.sources.map(function (s) { return s.book + ' ' + s.number; }).join(' · ');
  return '<p class="salah-sources">' + _sEsc(t('salah.sources', { list: list })) + '</p>';
}

function _sPhraseCard(phrase, madhab, showFigure) {
  var h = '<li class="salah-phrase">';
  if (showFigure) h += '<div class="salah-phrase-fig">' + salahFigureSvg(phrase.step, madhab) + '</div>';
  h += _sAr(phrase.ar, 'salah-phrase-ar');
  h += '<p class="salah-phrase-tr">' + _sEsc(phrase.tr) + '</p>';
  h += '<ol class="salah-words">';
  phrase.words.forEach(function (w) {
    h += '<li>' + _sAr(w.ar, 'salah-word-ar') + '<span class="salah-word-tr">' + _sEsc(w.tr) + '</span>' +
      '<span class="salah-word-en">' + _sEsc(w.en) + '</span></li>';
  });
  h += '</ol><p class="salah-phrase-en">' + _sEsc(phrase.en) + '</p>' + _sSources(phrase);
  return h + '</li>';
}

/** How the learner's madhab does this lesson's position, from the walkthrough's captions. */
function _sHow(lesson, madhab) {
  if (!lesson.how) return '';
  var head = madhab === 'unsure' ? t('salah.howCommon') : t('salah.how', { name: t('salah.madhab.' + madhab) });
  return '<p class="qaida-kicker">' + _sEsc(head) + '</p>' + salahHowKeys(lesson.how, madhab).map(function (k) {
    return '<p class="qaida-note salah-lesson-note">' + _sEsc(t(k)) + '</p>';
  }).join('');
}

function _sIntroBody(run) {
  var lesson = run.lesson;
  if (lesson.kind === 'walkthrough') return salahWalkMarkup(run.madhab);
  if (lesson.kind === 'check') return _sNote('salah.intro.check');
  var lastStep = null;
  var cards = salahLessonPhrases(lesson, run.madhab).map(function (p) {
    var card = _sPhraseCard(p, run.madhab, p.step !== lastStep);
    lastStep = p.step;
    return card;
  });
  return cards.length ? '<ol class="salah-phrases">' + cards.join('') + '</ol>' : '';
}

function _sIntroMarkup(run) {
  var lesson = run.lesson;
  var h = '<div class="qaida-screen salah-screen">' + _sHead();
  h += '<p class="qaida-kicker">' + _sEsc(t('level.' + (lesson.level - 1)) + ' · ' + t('tracks.lessonN', { n: lesson.number })) + '</p>';
  h += _sTitle(t(lesson.titleKey));
  if (!SALAH_TEACHER_REVIEWED && SALAH_REVIEW_LEVELS.indexOf(lesson.level) >= 0) h += _sNote('salah.teacherReview', ' salah-review-note');
  if (lesson.noteKey) h += _sNote(lesson.noteKey, ' salah-lesson-note');
  h += _sHow(lesson, run.madhab);
  h += _sIntroBody(run);
  var action = run.items.length ? 'practice' : 'done';
  return h + '<button type="button" class="btn qaida-continue" data-action="' + action + '">' +
    _sEsc(t(run.items.length ? 'qaida.practice' : 'salah.done')) + '</button></div>';
}

// ── Practice and finish ─────────────────────────────────────────

function _sPracticeMarkup(run) {
  var item = run.items[run.index];
  var h = '<div class="qaida-screen salah-screen">' + _sHead();
  h += '<p class="qaida-progress" role="status">' + _sEsc(t('root.progress', { n: run.index + 1, total: run.items.length })) + '</p>';
  if (item.figure) h += '<div class="salah-walk-fig">' + salahFigureSvg(item.figure, run.madhab) + '</div>';
  h += '<div class="qaida-body" id="salah-exercise"></div>';
  return h + '<div class="qaida-actions" id="salah-next"></div></div>';
}

function _sNextLesson(lesson) {
  var i = SALAH_LESSONS.indexOf(lesson);
  var next = SALAH_LESSONS[i + 1];
  return next && isSalahLessonUnlocked(next.id) ? next : null;
}

function _sFinishMarkup(run) {
  var h = '<div class="qaida-screen qaida-finish">' + _sTitle(t(run.passed ? 'qaida.done' : 'qaida.notYet'));
  if (run.items.length) h += '<p class="qaida-score">' + _sEsc(t('root.score', { n: run.correct, total: run.items.length })) + '</p>';
  var actions = '';
  if (!run.passed) {
    h += '<p class="qaida-note" role="status">' + _sEsc(t('qaida.checkFailed', { pct: Math.round(SALAH_CHECK_PASS * 100) })) + '</p>';
    actions += '<button type="button" class="btn" data-action="retry">' + _sEsc(t('qaida.retry')) + '</button>';
  } else {
    var gain = run.gained > 0 ? t('percent.salah.gained', { p: run.gained }) : t('salah.noGain');
    h += '<p class="qaida-gain' + (run.gained > 0 ? '' : ' is-none') + '" role="status">' + _sEsc(gain) + '</p>';
    var next = _sNextLesson(run.lesson);
    if (next) actions += '<button type="button" class="btn" data-action="next-lesson" data-ref="' + next.id + '">' + _sEsc(t('qaida.nextLesson')) + '</button>';
  }
  return h + '<div class="qaida-finish-actions">' + actions +
    '<button type="button" class="btn btn-outline" data-action="back">' + _sEsc(t('qaida.toPath')) + '</button></div></div>';
}

/** Render the Salah lesson view for the screen in progress. */
function renderSalahLesson() {
  var view = document.getElementById('view-salah-lesson');
  if (!view) return;
  view.onclick = _onSalahClick;
  if (_salahFig) { _salahFig.destroy(); _salahFig = null; }
  var run = _salahRun;
  if (!run) { view.innerHTML = ''; return; }
  if (run.step === 'madhab') view.innerHTML = salahPickerMarkup();
  else if (run.step === 'intro') view.innerHTML = _sIntroMarkup(run);
  else if (run.step === 'finish') view.innerHTML = _sFinishMarkup(run);
  else {
    view.innerHTML = _sPracticeMarkup(run);
    renderExercise(document.getElementById('salah-exercise'), run.items[run.index], _onSalahAnswer);
  }
  if (run.step === 'intro' && run.lesson.kind === 'walkthrough') _salahFig = mountSalahWalk(run.madhab);
  var title = document.getElementById('salah-title');
  if (title) title.focus();
}

function _onSalahAnswer(correct) {
  var run = _salahRun;
  if (!run || run.step !== 'practice' || run.answered) return;
  var item = run.items[run.index];
  if (item.word) recordSalahWord(item.word, correct);
  if (correct) run.correct += 1;
  run.answered = true;
  var slot = document.getElementById('salah-next');
  if (!slot) return;
  var last = run.index + 1 >= run.items.length;
  slot.innerHTML = '<button type="button" class="btn qaida-next" data-action="next">' + _sEsc(t(last ? 'root.finish' : 'root.next')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.qaida-next') : null;
  if (button) button.focus();
}

function _finishSalah(run) {
  var score = run.items.length ? run.correct / run.items.length : 1;
  run.passed = run.lesson.kind !== 'check' || score >= SALAH_CHECK_PASS;
  if (run.passed) {
    completeSalahLesson(run.lesson.id, score);
    run.gained = refreshSalahPercent().gained;
  }
  run.step = 'finish';
  renderSalahLesson();
}

function _nextSalahItem() {
  var run = _salahRun;
  if (!run || run.step !== 'practice' || !run.answered) return;
  if (run.index + 1 >= run.items.length) { _finishSalah(run); return; }
  run.index += 1;
  run.answered = false;
  renderSalahLesson();
}

// ── Entry points and clicks ─────────────────────────────────────

/**
 * Open a Salah lesson at its intro, after the madhab picker when the
 * learner has not chosen one.
 * @param {string} lessonId
 * @param {number} [seed] - fixed for tests; otherwise a new set each time
 */
function startSalahLesson(lessonId, seed) {
  var lesson = getSalahLesson(lessonId);
  if (!lesson) return;
  var madhab = getSalahMadhab();
  if (!madhab) { openSalahMadhabPicker(function () { startSalahLesson(lessonId, seed); }); return; }
  var s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1e9);
  _salahRun = { step: 'intro', lesson: lesson, madhab: madhab, items: buildSalahLessonItems(lesson, s, madhab), index: 0,
    answered: false, correct: 0, gained: 0, passed: false, seed: s };
  switchView('salah-lesson');
}

function _leaveSalah() {
  if (_salahFig) { _salahFig.destroy(); _salahFig = null; }
  stopAudio();
  _salahRun = null;
  if (getSalahMadhab()) switchView('track', { trackId: SALAH_TRACK_ID });
  else switchView('tracks');
}

function _onSalahClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  var run = _salahRun;

  if (action === 'back') _leaveSalah();
  else if (action === 'madhab') _chooseSalahMadhab(el.getAttribute('data-madhab'));
  else if (action === 'pose' && _salahFig) _salahFig.show(el.getAttribute('data-pose'));
  else if ((action === 'walk-prev' || action === 'walk-next') && _salahFig) _salahFig.move(action === 'walk-next' ? 1 : -1);
  else if (action === 'walk-toggle' && _salahFig) _salahFig[el.textContent === t('salah.walk.pause') ? 'pause' : 'play']();
  else if (action === 'practice' && run) { run.step = 'practice'; run.index = 0; run.answered = false; renderSalahLesson(); }
  else if (action === 'done' && run) _finishSalah(run);
  else if (action === 'next') _nextSalahItem();
  else if (action === 'retry' && run) startSalahLesson(run.lesson.id, run.seed + 1);
  else if (action === 'next-lesson') startSalahLesson(el.getAttribute('data-ref'));
}
