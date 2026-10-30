// ═══════════════════════════════════════════════════════════════
// tracks-ui.js — the Learn tab
//
// #view-tracks  the learner's tracks as cards (main track first), then
//               "Add a track" with the tracks not joined yet.
// #view-track   one track's path: four levels of numbered lessons with
//               locks, and a footer row of other ways to learn.
//
// Both views are rendered as HTML (data text escaped) and handle clicks
// by delegation on the view: every interactive element carries a
// data-action. Lessons and footer items reuse the existing openers
// (goToFoundationLesson, openGuidedSurah, openRootFamilies, ...).
// ═══════════════════════════════════════════════════════════════

/** Track whose path renderTrackPath() shows when called without an id */
var _pathTrackId = null;

/** Upgrade reason per premium-locked level, as the existing locked items use */
var TRACK_LEVEL_UPGRADE_REASONS = { 1: 'guided-reading', 2: 'guided-reading', 3: 'vocabulary-expansion' };

function _trEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

/**
 * The track's share of the Quran (refreshing the stored high-water mark),
 * or null when the track has no percentage yet (only Word meanings has one
 * in Phase 1).
 */
function _trackPercent(trackId) {
  if (trackId !== 'words') return null;
  return refreshWordMeaningsPercent().percent;
}

// ── Track cards ─────────────────────────────────────────────────

function _joinedTrackCard(trackId, isMain, canLeave) {
  var name = t('track.' + trackId + '.name');
  var percent = _trackPercent(trackId);
  var meta = t('level.' + getTrackLevel(trackId));
  if (percent !== null) meta += ' · ' + t('percent.words', { p: percent });

  var h = '<article class="track-card is-joined' + (isMain ? ' is-main' : '') + '">';
  h += '<button type="button" class="track-card-open" data-action="open" data-track="' + trackId + '">';
  if (isMain) h += '<span class="track-card-badge">' + _trEsc(t('tracks.main')) + '</span>';
  h += '<span class="track-card-name">' + _trEsc(name) + '</span>';
  h += '<span class="track-card-desc">' + _trEsc(t('track.' + trackId + '.desc')) + '</span>';
  h += '<span class="track-card-meta">' + _trEsc(meta) + '</span>';
  if (percent !== null) {
    h += '<span class="track-card-bar" aria-hidden="true"><span style="width:' + Math.min(100, percent) + '%"></span></span>';
  }
  h += '</button>';
  h += '<button type="button" class="track-card-more" data-action="menu" aria-haspopup="menu" aria-expanded="false"' +
    ' aria-label="' + _trEsc(t('tracks.menu', { track: name })) + '">⋯</button>';
  h += '<div class="track-menu" role="menu" hidden>';
  h += '<button type="button" role="menuitem" class="track-menu-item track-menu-main" data-action="make-main" data-track="' + trackId + '"' +
    (isMain ? ' disabled' : '') + '>' + _trEsc(t('tracks.makeMain')) + '</button>';
  h += '<button type="button" role="menuitem" class="track-menu-item track-menu-leave" data-action="leave" data-track="' + trackId + '"' +
    (canLeave ? '' : ' disabled') + '>' + _trEsc(t('tracks.leave')) + '</button>';
  h += '</div>';
  h += '</article>';
  return h;
}

// A released track that isn't joined can't occur in Phase 1 (only Word
// meanings is released, and the last joined track can't be left), so
// unjoined cards have no join action yet.
function _unjoinedTrackCard(trackId) {
  var h = '<article class="track-card is-soon">';
  h += '<span class="track-card-name">' + _trEsc(t('track.' + trackId + '.name')) + '</span>';
  h += '<span class="track-card-desc">' + _trEsc(t('track.' + trackId + '.desc')) + '</span>';
  if (!isTrackReleased(trackId)) {
    h += '<span class="track-card-soon">' + _trEsc(t('tracks.comingSoon')) + '</span>';
  }
  h += '</article>';
  return h;
}

/** Render the Learn tab's track list into #view-tracks. */
function renderTracks() {
  var view = document.getElementById('view-tracks');
  if (!view) return;

  var joined = getJoinedTrackIds();
  var mainId = joined[0];
  var unjoined = TRACK_IDS.filter(function(id) { return joined.indexOf(id) < 0; });

  var h = '<div class="track-list">';
  h += '<h2 class="track-section-title">' + _trEsc(t('tracks.yours')) + '</h2>';
  joined.forEach(function(id) {
    h += _joinedTrackCard(id, id === mainId, joined.length > 1);
  });
  if (unjoined.length > 0) {
    h += '<h2 class="track-section-title">' + _trEsc(t('tracks.add')) + '</h2>';
    unjoined.forEach(function(id) { h += _unjoinedTrackCard(id); });
  }
  h += '</div>';

  view.innerHTML = h;
  view.onclick = _onLearnViewClick;
  view.onkeydown = _onLearnViewKeydown;
}

// ── Track path ──────────────────────────────────────────────────

function _lessonButton(lesson, level, levelLock) {
  // Level 3 entries are open-ended: their `completed` means "started" (R8).
  var done = lesson.completed && level !== 3;
  var locked = levelLock === 'progress' ||
    (lesson.kind === 'foundation' && !isFoundationLessonUnlocked(lesson.ref));
  var attrs = levelLock === 'premium'
    ? ' data-action="upgrade" data-level="' + level + '"'
    : ' data-action="lesson" data-kind="' + lesson.kind + '"' + (lesson.ref == null ? '' : ' data-ref="' + lesson.ref + '"');

  var h = '<li><button type="button" class="track-lesson' + (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + '"' +
    attrs + (locked ? ' disabled' : '') + '>';
  h += '<span class="track-lesson-num">' + lesson.number + '</span>';
  h += '<span class="track-lesson-title">' + _trEsc(lesson.title) + '</span>';
  if (done) h += '<span class="track-lesson-state">' + uiIcon('check', true) + '<span class="sr-only">' + _trEsc(t('tracks.finished')) + '</span></span>';
  else if (locked || levelLock === 'premium') h += '<span class="track-lesson-state">' + uiIcon('lock', true) + '</span>';
  h += '</button></li>';
  return h;
}

function _levelSection(levelData) {
  var level = levelData.level;
  var lock = getWordMeaningsLevelLock(level);
  var h = '<section class="track-level' + (lock ? ' is-locked' : '') + '" aria-labelledby="track-level-' + level + '">';
  h += '<div class="track-level-head">';
  h += '<h3 class="track-level-name" id="track-level-' + level + '">' + _trEsc(t('level.' + level)) + '</h3>';
  if (lock === 'premium') {
    h += '<button type="button" class="track-level-lock is-premium" data-action="upgrade" data-level="' + level + '">' +
      uiIcon('lock', true) + '<span>' + _trEsc(t('tracks.premium')) + '</span></button>';
  } else if (lock === 'progress') {
    h += '<span class="track-level-lock">' + uiIcon('lock', true) +
      '<span>' + _trEsc(t('tracks.locked', { level: t('level.' + (level - 1)) })) + '</span></span>';
  }
  h += '</div>';
  h += '<ol class="track-lessons">';
  levelData.lessons.forEach(function(lesson) { h += _lessonButton(lesson, level, lock); });
  h += '</ol>';
  h += '</section>';
  return h;
}

function _pathFooterItem(action, icon, labelKey) {
  return '<button type="button" class="track-path-link" data-action="' + action + '">' +
    uiIcon(icon, true) + '<span>' + _trEsc(t(labelKey)) + '</span></button>';
}

/**
 * Render a track's path into #view-track. Without an id it shows the last
 * opened track, or the main track.
 */
function renderTrackPath(trackId) {
  if (trackId) _pathTrackId = trackId;
  var id = _pathTrackId || getMainTrackId();
  var view = document.getElementById('view-track');
  if (!view) return;

  var percent = _trackPercent(id);
  var h = '<div class="track-path">';
  h += '<div class="track-path-head">';
  h += '<button type="button" class="track-path-back" data-action="back">' + uiIcon('chevron-left', true) +
    '<span>' + _trEsc(t('tracks.back')) + '</span></button>';
  h += '<h2 class="track-path-title">' + _trEsc(t('track.' + id + '.name')) + '</h2>';
  if (percent !== null) h += '<p class="track-path-percent">' + _trEsc(t('percent.words', { p: percent })) + '</p>';
  h += '</div>';

  if (id === 'words') {
    getWordMeaningsLevels().forEach(function(levelData) { h += _levelSection(levelData); });
    h += '<nav class="track-path-footer" aria-label="' + _trEsc(t('tracks.more')) + '">';
    h += _pathFooterItem('all-words', 'list', 'tracks.allWords');
    h += _pathFooterItem('roots', 'leaf', 'tracks.roots');
    h += _pathFooterItem('difficulty', 'target', 'tracks.difficulty');
    h += _pathFooterItem('quiz', 'bolt', 'tracks.quiz');
    h += '</nav>';
  } else {
    h += '<p class="track-path-soon">' + _trEsc(t('tracks.comingSoon')) + '</p>';
  }
  h += '</div>';

  view.innerHTML = h;
  view.onclick = _onLearnViewClick;
  view.onkeydown = _onLearnViewKeydown;
}

// ── Actions ─────────────────────────────────────────────────────

function _openPathLesson(kind, ref) {
  if (kind === 'foundation') goToFoundationLesson(Number(ref));
  else if (kind === 'guided-surah') openGuidedSurah(Number(ref));
  else if (kind === 'surah-study') openSurahStudy();
  else if (kind === 'root-families') openRootFamilies();
}

function _closeTrackMenus(view) {
  if (!view || !view.querySelectorAll) return;
  var open = view.querySelectorAll('.track-card-more[aria-expanded="true"]');
  for (var i = 0; i < open.length; i++) {
    open[i].setAttribute('aria-expanded', 'false');
    var menu = open[i].parentNode.querySelector('.track-menu');
    if (menu) menu.hidden = true;
  }
}

function _toggleTrackMenu(toggle, view) {
  var wasOpen = toggle.getAttribute('aria-expanded') === 'true';
  _closeTrackMenus(view);
  if (wasOpen) return;
  toggle.setAttribute('aria-expanded', 'true');
  var menu = toggle.parentNode.querySelector('.track-menu');
  if (!menu) return;
  menu.hidden = false;
  var first = menu.querySelector('.track-menu-item:not([disabled])');
  if (first) first.focus();
}

/** Run the action of a clicked element (one carrying data-action). */
function _runLearnAction(el, view) {
  var action = el.getAttribute('data-action');
  var trackId = el.getAttribute('data-track');
  if (action !== 'menu') _closeTrackMenus(view);

  if (action === 'menu') _toggleTrackMenu(el, view);
  else if (action === 'open') switchView('track', { trackId: trackId });
  else if (action === 'make-main') { setMainTrack(trackId); renderTracks(); }
  else if (action === 'leave') { leaveTrack(trackId); renderTracks(); }
  else if (action === 'back') switchView('tracks');
  else if (action === 'lesson') _openPathLesson(el.getAttribute('data-kind'), el.getAttribute('data-ref'));
  else if (action === 'upgrade') {
    if (window.__premium) window.__premium.requestUpgrade(TRACK_LEVEL_UPGRADE_REASONS[el.getAttribute('data-level')]);
  }
  else if (action === 'all-words') switchView('list');
  else if (action === 'roots') openRootFamilies();
  else if (action === 'difficulty') openNextDifficultyLevel();
  else if (action === 'quiz') switchView('quiz');
}

function _onLearnViewClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (el) _runLearnAction(el, this);
  else _closeTrackMenus(this);
}

/** Escape closes an open "⋯" menu and returns focus to its button. */
function _onLearnViewKeydown(e) {
  if (e.key !== 'Escape') return;
  var toggle = this.querySelector && this.querySelector('.track-card-more[aria-expanded="true"]');
  if (!toggle) return;
  _closeTrackMenus(this);
  toggle.focus();
}
