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
// (goToFoundationLesson, openGuidedSurah, openRootList, ...).
// ═══════════════════════════════════════════════════════════════

/** Track whose path renderTrackPath() shows when called without an id */
var _pathTrackId = null;

/** Upgrade reason per premium-locked level, as the existing locked items use */
var TRACK_LEVEL_UPGRADE_REASONS = { 1: 'guided-reading', 2: 'guided-reading', 3: 'vocabulary-expansion' };

function _trEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

/**
 * What the Learn screens need from each released track: its levels and
 * lessons, the lock on a level, the learner's level, its share of the
 * Quran (refreshing the stored high-water mark) and how that share reads.
 */
var TRACK_PATHS = {
  words: {
    levels: function() { return getWordMeaningsLevels(); },
    lock: function(level) { return getWordMeaningsLevelLock(level); },
    level: function() { return getWordMeaningsLevel(); },
    percent: function() { return refreshWordMeaningsPercent().percent; },
    percentKey: 'percent.words',
    // Words count once a review remembers them, so a finished lesson can still read 0%
    note: function(p) { return p === 0 && typeof loadSRS === 'function' && Object.keys(loadSRS()).length ? 'percent.words.pending' : null; },
  },
  qaida: {
    levels: function() { return getQaidaLevels(); },
    lock: function(level) { return getQaidaLevelLock(level); },
    level: function() { return getQaidaLevel(); },
    percent: function() { return refreshQaidaPercent().percent; },
    percentKey: 'percent.qaida',
    note: 'qaida.reviewNote',
  },
  tajweed: {
    levels: function() { return getTajweedLevels(); },
    lock: function(level) { return getTajweedLevelLock(level); },
    level: function() { return getTajweedLevel(); },
    percent: function() { return _roundTajweedPercent(refreshTajweedPercent().percent); },
    percentKey: 'percent.tajweed',
  },
};

/**
 * One smooth verse is often a few thousandths of a percent, so the Tajweed
 * share keeps 2 decimals while it is under 0.1, then 1 like the others.
 */
function _roundTajweedPercent(percent) {
  return percent < 0.1 ? Math.round(percent * 100) / 100 : Math.round(percent * 10) / 10;
}

/** The track's share of the Quran, or null for a track without a path yet. */
function _trackPercent(trackId) {
  return TRACK_PATHS[trackId] ? TRACK_PATHS[trackId].percent() : null;
}

/** How the track's share reads, e.g. "12% of the Quran's words you can read". */
function _trackPercentText(trackId, percent) {
  return t(TRACK_PATHS[trackId].percentKey, { p: percent });
}

// ── Track cards ─────────────────────────────────────────────────

function _joinedTrackCard(trackId, isMain, canLeave) {
  var name = t('track.' + trackId + '.name');
  var percent = _trackPercent(trackId);
  var meta = t('level.' + (TRACK_PATHS[trackId] ? TRACK_PATHS[trackId].level() : getTrackLevel(trackId)));
  if (percent !== null) meta += ' · ' + _trackPercentText(trackId, percent);

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

// A released track the learner hasn't joined offers Join
function _unjoinedTrackCard(trackId) {
  var h = '<article class="track-card is-open">';
  h += '<span class="track-card-name">' + _trEsc(t('track.' + trackId + '.name')) + '</span>';
  h += '<span class="track-card-desc">' + _trEsc(t('track.' + trackId + '.desc')) + '</span>';
  h += '<button type="button" class="btn btn-sm btn-outline track-card-join" data-action="join" data-track="' + trackId + '">' +
    _trEsc(t('tracks.join')) + '</button>';
  h += '</article>';
  return h;
}

/** Render the Learn tab's track list into #view-tracks. */
function renderTracks() {
  var view = document.getElementById('view-tracks');
  if (!view) return;

  var joined = getJoinedTrackIds();
  var mainId = joined[0];
  // Tracks not released yet are left out: a "Coming soon" card is one more
  // thing to read that a beginner can't use
  var unjoined = TRACK_IDS.filter(function(id) { return joined.indexOf(id) < 0 && isTrackReleased(id); });

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

// ── Track path (its pieces are in track-path-parts.js) ──────────

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
  if (percent !== null) h += '<p class="track-path-percent">' + _trEsc(_trackPercentText(id, percent)) + '</p>';
  var path = TRACK_PATHS[id];
  var note = path && (typeof path.note === 'function' ? path.note(percent) : path.note);
  if (note) h += '<p class="track-path-note">' + _trEsc(t(note)) + '</p>';
  h += '</div>';

  if (path) path.levels().forEach(function(levelData) { h += _levelSection(levelData, path); });
  if (id === 'words') {
    h += '<nav class="track-path-footer" aria-label="' + _trEsc(t('tracks.more')) + '">';
    h += _pathFooterItem('all-words', 'list', 'tracks.allWords');
    h += _pathFooterItem('roots', 'leaf', 'tracks.roots', typeof _hasVocabularyExpansion === 'function' && !_hasVocabularyExpansion());
    h += _pathFooterItem('difficulty', 'target', 'tracks.difficulty');
    h += _pathFooterItem('quiz', 'bolt', 'tracks.quiz');
    h += '</nav>';
  } else if (id === 'tajweed') {
    h += '<nav class="track-path-footer" aria-label="' + _trEsc(t('tracks.more')) + '">';
    h += _pathFooterItem('verses', 'volume-2', 'tajweed.verses.title');
    h += '</nav>';
  } else if (!path) {
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
  else if (kind === 'root-families') openRootList();
  else if (kind === 'qaida') startQaidaLesson(ref);
  else if (kind === 'tajweed') startTajweedLesson(ref);
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
  else if (action === 'join') { joinTrack(trackId); switchView('track', { trackId: trackId }); }
  else if (action === 'back') switchView('tracks');
  else if (action === 'lesson') _openPathLesson(el.getAttribute('data-kind'), el.getAttribute('data-ref'));
  else if (action === 'upgrade') {
    if (window.__premium) window.__premium.requestUpgrade(TRACK_LEVEL_UPGRADE_REASONS[el.getAttribute('data-level')]);
  }
  else if (action === 'all-words') switchView('list');
  else if (action === 'roots') openRootList();
  else if (action === 'difficulty') openNextDifficultyLevel();
  else if (action === 'quiz') switchView('quiz');
  else if (action === 'verses') startTajweedVersePractice();
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
