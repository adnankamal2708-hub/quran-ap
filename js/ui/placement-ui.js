// ═══════════════════════════════════════════════════════════════
// placement-ui.js — the Word meanings placement test (#view-test)
//
// One question at a time, rendered by the shared exercise UI
// (renderExercise); the adaptive logic lives in js/exercises/placement.js.
// Leaving mid-test saves nothing except the attempt count, which moves at
// start so a retake gets different words. When the test ends the learner's
// level is raised (never lowered) and the result is shown.
//
// Clicks are handled by delegation on the view: every button carries a
// data-action, as in tracks-ui.js.
// ═══════════════════════════════════════════════════════════════

/** Label key for each part of speech the result names; any other tag is "Other words" */
var PLACEMENT_TAG_LABELS = {
  noun: 'test.tag.noun',
  verb: 'test.tag.verb',
  adjective: 'test.tag.adjective',
  pronoun: 'test.tag.pronoun',
  adverb: 'test.tag.adverb',
  particle: 'test.tag.particle',
};
var PLACEMENT_OTHER_TAG_LABEL = 'test.tag.other';

/** View the learner returns to when the test is left without a known origin */
var PLACEMENT_DEFAULT_RETURN_VIEW = 'tracks';

/**
 * The test in progress, or null:
 * { state, returnView, result } — result stays null until the last answer.
 */
var _placement = null;

function _plEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

/** The view the test was started from (never the test view itself). */
function _placementOriginView() {
  var current = typeof currentView === 'string' ? currentView : '';
  return current && current !== 'test' ? current : PLACEMENT_DEFAULT_RETURN_VIEW;
}

/**
 * Start the placement test for a track and open it. Only 'words' has one in
 * Phase 1. The attempt count moves here, so quitting still counts the try.
 */
function startPlacementTest(trackId) {
  if (trackId !== WORDS_TRACK_ID) return;
  var bank = buildWordMeaningsBank(nextPlacementAttempt(trackId));
  _placement = {
    state: createPlacementTest(bank),
    returnView: _placementOriginView(),
    result: null,
  };
  switchView('test');
}

// ── Result ──────────────────────────────────────────────────────

/**
 * Raise the stored level to the placed one and keep what the screen needs.
 * The level compared and shown is the effective one, so a Foundation
 * graduate is never told they are a Beginner.
 */
function _finishPlacement() {
  var placed = getPlacementResult(_placement.state);
  var earned = getWordMeaningsLevel();
  raiseTrackLevel(WORDS_TRACK_ID, placed.level);
  _placement.result = {
    // Only a lower result is a "level stays"; an equal one is simply the level (R9).
    kept: placed.level < earned,
    // After a lower result the learner keeps the level already earned.
    level: getWordMeaningsLevel(),
    strengths: placed.strengths,
    gaps: placed.gaps,
  };
}

function _lessonLabel(lesson) {
  return lesson.kind === 'foundation' ? t('test.start.foundation', { n: lesson.number }) : lesson.title;
}

/** Chip labels for part-of-speech tags, each label once. */
function _tagLabels(tags) {
  var labels = [];
  tags.forEach(function(tag) {
    var label = t(PLACEMENT_TAG_LABELS[tag] || PLACEMENT_OTHER_TAG_LABEL);
    if (labels.indexOf(label) < 0) labels.push(label);
  });
  return labels;
}

function _chipGroup(titleKey, tags, kind) {
  if (tags.length === 0) return '';
  var h = '<section class="placement-group">';
  h += '<h3 class="placement-group-title">' + _plEsc(t(titleKey)) + '</h3>';
  h += '<ul class="placement-chips">';
  _tagLabels(tags).forEach(function(label) {
    h += '<li class="placement-chip is-' + kind + '">' + _plEsc(label) + '</li>';
  });
  h += '</ul></section>';
  return h;
}

function _resultMarkup() {
  var result = _placement.result;
  var levelName = t('level.' + result.level);
  var lesson = getWordMeaningsNextLesson(result.level);

  var h = '<div class="placement placement-result">';
  h += _headMarkup(t('test.words.title'), 'test.close');
  h += '<p class="placement-level" role="status">' +
    _plEsc(t(result.kept ? 'test.result.kept' : 'test.result.level', { level: levelName })) + '</p>';
  h += _chipGroup('test.result.strengths', result.strengths, 'strength');
  h += _chipGroup('test.result.gaps', result.gaps, 'gap');
  h += '<button type="button" class="btn placement-start" data-action="start-lesson">' +
    _plEsc(t('test.result.start', { lesson: lesson ? _lessonLabel(lesson) : levelName })) + '</button>';
  h += '</div>';
  return h;
}

// ── Screens ─────────────────────────────────────────────────────

function _headMarkup(title, quitKey) {
  return '<div class="placement-head"><h2 class="placement-title">' + _plEsc(title) + '</h2>' +
    '<button type="button" class="placement-quit" data-action="quit">' + _plEsc(t(quitKey)) + '</button></div>';
}

function _introMarkup() {
  var h = '<div class="placement">';
  h += '<h2 class="placement-title">' + _plEsc(t('test.words.title')) + '</h2>';
  h += '<p class="placement-desc">' + _plEsc(t('test.words.desc')) + '</p>';
  h += '<button type="button" class="btn placement-start" data-action="begin">' + _plEsc(t('test.begin')) + '</button>';
  h += '</div>';
  return h;
}

function _questionMarkup(number) {
  var h = '<div class="placement">';
  h += _headMarkup(t('test.question', { n: number }), 'test.quit');
  h += '<div class="placement-body" id="placement-exercise"></div>';
  h += '<div class="placement-actions" id="placement-next"></div>';
  h += '</div>';
  return h;
}

/** Called by the exercise once the learner has checked an answer. */
function _onPlacementAnswer(correct) {
  if (!_placement) return;
  _placement.state = answerPlacementItem(_placement.state, correct);
  if (isPlacementFinished(_placement.state)) _finishPlacement();

  var slot = document.getElementById('placement-next');
  if (!slot) return;
  slot.innerHTML = '<button type="button" class="btn placement-next" data-action="next">' + _plEsc(t('test.next')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.placement-next') : null;
  if (button) button.focus();
}

function _renderQuestion(view) {
  var item = nextPlacementItem(_placement.state);
  view.innerHTML = _questionMarkup(totalPlacementAsked(_placement.state) + 1);
  renderExercise(document.getElementById('placement-exercise'), item, _onPlacementAnswer);
}

/** Render the placement test view: intro, the current question, or the result. */
function renderPlacementTest() {
  var view = document.getElementById('view-test');
  if (!view) return;
  view.onclick = _onPlacementClick;

  if (!_placement) view.innerHTML = _introMarkup();
  else if (_placement.result) view.innerHTML = _resultMarkup();
  else _renderQuestion(view);
}

// ── Actions ─────────────────────────────────────────────────────

/**
 * End the test session and empty the view, so the finished exercise is
 * disconnected and its keyboard listener goes with it.
 */
function _endPlacement() {
  _placement = null;
  var view = document.getElementById('view-test');
  if (view) view.innerHTML = '';
}

/** Leave the test (mid-way or from the result) for the view it was started from. */
function _leavePlacement() {
  var returnView = _placement ? _placement.returnView : PLACEMENT_DEFAULT_RETURN_VIEW;
  _endPlacement();
  switchView(returnView);
}

/**
 * Open the learner's next lesson (the first unfinished one at or above their
 * level) through the Learn path's opener. A premium-locked level opens the
 * track path instead, so the learner sees the lock and the upgrade prompt.
 */
function _startPlacedLesson() {
  var level = _placement.result.level;
  var lesson = getWordMeaningsNextLesson(level);
  _endPlacement();
  if (!lesson || getWordMeaningsLevelLock(level) === 'premium') switchView('track', { trackId: WORDS_TRACK_ID });
  else _openPathLesson(lesson.kind, lesson.ref);
}

function _onPlacementClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');

  if (action === 'begin') startPlacementTest(WORDS_TRACK_ID);
  else if (action === 'next') renderPlacementTest();
  else if (action === 'quit') _leavePlacement();
  else if (action === 'start-lesson') _startPlacedLesson();
}

window.__placement = { start: startPlacementTest };
