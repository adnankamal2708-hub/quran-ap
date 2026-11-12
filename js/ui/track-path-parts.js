// ═══════════════════════════════════════════════════════════════
// track-path-parts.js — pieces of a track's path (#view-track):
// a level with its lock, its numbered lesson buttons, and the footer
// links. renderTrackPath() in tracks-ui.js puts them together.
// ═══════════════════════════════════════════════════════════════

/** True when a lesson in an open level is locked by an earlier lesson. */
function _isLessonLocked(lesson, levelLock) {
  return levelLock === 'progress' ||
    (lesson.kind === 'foundation' && !isFoundationLessonUnlocked(lesson.ref)) ||
    (lesson.kind === 'qaida' && !lesson.completed && !isQaidaLessonUnlocked(lesson.ref)) ||
    (lesson.kind === 'tajweed' && !lesson.completed && !isTajweedLessonUnlocked(lesson.ref));
}

/**
 * @param {string} [reason] - short text saying why the lesson is locked,
 *   shown in place of the plain lock icon
 */
function _lessonButton(lesson, level, levelLock, reason) {
  // Level 3 entries are open-ended: their `completed` means "started" (R8).
  var done = lesson.completed && level !== 3;
  var locked = _isLessonLocked(lesson, levelLock);
  var attrs = levelLock === 'premium'
    ? ' data-action="upgrade" data-level="' + level + '"'
    : ' data-action="lesson" data-kind="' + lesson.kind + '"' + (lesson.ref == null ? '' : ' data-ref="' + lesson.ref + '"');

  var h = '<li><button type="button" class="track-lesson' + (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + '"' +
    attrs + (locked ? ' disabled' : '') + '>';
  h += '<span class="track-lesson-num">' + lesson.number + '</span>';
  h += '<span class="track-lesson-title">' + _trEsc(lesson.title) + '</span>';
  if (done) h += '<span class="track-lesson-state">' + uiIcon('check', true) + '<span class="sr-only">' + _trEsc(t('tracks.finished')) + '</span></span>';
  else if (reason) h += '<span class="track-lesson-state track-lesson-reason">' + uiIcon('lock', true) + '<span>' + _trEsc(reason) + '</span></span>';
  else if (locked || levelLock === 'premium') {
    h += '<span class="track-lesson-state">' + uiIcon('lock', true) +
      (levelLock === 'premium' ? '<span class="sr-only">' + _trEsc(t('tracks.premium')) + '</span>' : '') + '</span>';
  }
  h += '</button></li>';
  return h;
}

function _levelSection(levelData, path) {
  var level = levelData.level;
  var lock = path.lock(level);
  var h = '<section class="track-level' + (lock ? ' is-locked' : '') + '" aria-labelledby="track-level-' + level + '">';
  h += '<div class="track-level-head">';
  h += '<h3 class="track-level-name" id="track-level-' + level + '">' + _trEsc(t('level.' + level)) + '</h3>';
  if (lock === 'premium') {
    h += '<button type="button" class="track-level-lock is-premium" data-action="upgrade" data-level="' + level + '">' +
      uiIcon('lock', true) + '<span>' + _trEsc(t('tracks.premium')) + '</span></button>';
  } else if (lock === 'progress') {
    h += '<span class="track-level-lock">' + uiIcon('lock', true) +
      '<span>' + _trEsc(t('tracks.locked', { level: t('level.' + (level - 1)) })) + '</span></span>';
  } else if (lock === 'coming') {
    h += '<span class="track-level-lock">' + _trEsc(t('tracks.comingLater')) + '</span>';
  }
  h += '</div>';
  h += '<ol class="track-lessons">';
  // In an open level, the first locked lesson says which lesson opens it.
  var explained = !!lock;
  levelData.lessons.forEach(function(lesson, i) {
    var reason = null;
    if (!explained && i > 0 && !lesson.completed && _isLessonLocked(lesson, lock)) {
      reason = t('tracks.lessonLocked', { n: levelData.lessons[i - 1].number });
      explained = true;
    }
    h += _lessonButton(lesson, level, lock, reason);
  });
  h += '</ol>';
  h += '</section>';
  return h;
}

/** @param {boolean} [premium] - shows a lock: the item opens the upgrade prompt */
function _pathFooterItem(action, icon, labelKey, premium) {
  return '<button type="button" class="track-path-link" data-action="' + action + '">' +
    uiIcon(icon, true) + '<span>' + _trEsc(t(labelKey)) + '</span>' +
    (premium ? uiIcon('lock', true) + '<span class="sr-only">' + _trEsc(t('tracks.premium')) + '</span>' : '') + '</button>';
}
