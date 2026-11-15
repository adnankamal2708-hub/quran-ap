// ═══════════════════════════════════════════════════════════════
// daily-ayah-steps.js — markup for Today's ayah (pure, no DOM)
//
// The Home card and the three screens of #view-daily-ayah: the new words,
// the ayah on its own, then the check. daily-ayah-ui.js decides which to
// draw and handles the clicks (every button carries a data-action).
//
// A run, built by buildDailyAyahRun():
//   { ref, surah, ayah, surahName, translation, words, hints, hintIndex, step }
//   words: [{ text, meaning, root, hint }]   step: 'words' | 'ayah' | 'check'
// ═══════════════════════════════════════════════════════════════

function _daEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

/**
 * The run for a pick, or null when the verse's words don't line up with
 * the index (e.g. verse.w missing), so a wrong word is never shown.
 *   rootOf(entry) → the lesson word's root for an index entry, or ''
 */
function buildDailyAyahRun(pick, verse, surahName, rootOf) {
  if (!pick || !verse || !Array.isArray(verse.w)) return null;
  var words = dailyAyahWords(verse.text, verse.w);
  if (words.length !== pick.entries.length) return null;
  var p = pick.ref.split(':');
  return {
    ref: pick.ref, surah: Number(p[0]), ayah: Number(p[1]), surahName: surahName || '',
    translation: verse.translation || '',
    words: words.map(function (w, i) {
      var hint = pick.hints.indexOf(i) >= 0;
      return { text: w.text, meaning: w.meaning, hint: hint, root: hint && pick.entries[i] !== null ? rootOf(pick.entries[i]) : '' };
    }),
    hints: pick.hints.slice(),
    hintIndex: 0,
    step: pick.hints.length ? 'words' : 'ayah',
  };
}

/** The Home card: today's ayah, or once read, the running total. */
function dailyAyahCardMarkup(pick, surahName, doneToday, readCount) {
  var label = surahName + ' ' + pick.ref;
  if (doneToday) {
    var sub = readCount > 0
      ? t(readCount === 1 ? 'dailyAyah.readCount.one' : 'dailyAyah.readCount', { n: readCount })
      : label;
    return '<div class="db-card db-daily-ayah is-done">' +
      '<div class="db-card-row"><div class="db-card-icon db-icon-green-faint">' + uiIcon('check-circle', true) + '</div>' +
      '<div class="db-card-body"><div class="db-card-title">' + _daEsc(t('dailyAyah.doneTitle')) + '</div>' +
      '<div class="db-card-sub">' + _daEsc(sub) + '</div></div></div></div>';
  }
  var know = t('dailyAyah.know', { n: pick.known, total: pick.total });
  return '<div class="db-card db-action-card db-daily-ayah" data-action="open" tabindex="0" role="button" ' +
    'aria-label="' + _daEsc(t('dailyAyah.title') + ', ' + label + ', ' + know) + '">' +
    '<div class="db-card-row"><div class="db-card-icon db-icon-gold-faint">' + uiIcon('book-open', true) + '</div>' +
    '<div class="db-card-body"><div class="db-card-title">' + _daEsc(t('dailyAyah.title')) + '</div>' +
    '<div class="db-card-sub">' + _daEsc(know) + ' · ' + _daEsc(label) + '</div></div>' +
    '<span class="db-arrow" aria-hidden="true">' + uiIcon('chevron-right', true) + '</span></div></div>';
}

function _daHead() {
  return '<div class="root-head"><button type="button" class="root-back" data-action="home">' +
    uiIcon('chevron-left', true) + '<span>' + _daEsc(t('dailyAyah.back')) + '</span></button></div>';
}

function _daTitle(text) {
  return '<h2 class="root-title" id="daily-ayah-title" tabindex="-1">' + _daEsc(text) + '</h2>';
}

function _daButton(action, key, extra) {
  return '<button type="button" class="btn root-continue' + (extra || '') + '" data-action="' + action + '">' + _daEsc(t(key)) + '</button>';
}

function _wordStepMarkup(run) {
  var word = run.words[run.hints[run.hintIndex]];
  var h = '<div class="root-screen daily-ayah">' + _daHead() + _daTitle(t('dailyAyah.newWords'));
  h += '<p class="root-progress" role="status">' + _daEsc(t('dailyAyah.newWord', { n: run.hintIndex + 1, total: run.hints.length })) + '</p>';
  h += '<div class="daily-ayah-word"><p class="daily-ayah-word-ar" lang="ar" dir="rtl">' + _daEsc(word.text) + '</p>';
  h += '<p class="daily-ayah-word-en">' + _daEsc(word.meaning) + '</p>';
  if (word.root) h += '<p class="daily-ayah-word-root">' + _daEsc(t('dailyAyah.root')) + ' <span lang="ar" dir="rtl">' + _daEsc(word.root) + '</span></p>';
  h += '</div>';
  var last = run.hintIndex + 1 >= run.hints.length;
  return h + _daButton('next', last ? 'dailyAyah.readIt' : 'dailyAyah.next') + '</div>';
}

function _readStepMarkup(run) {
  var h = '<div class="root-screen daily-ayah">' + _daHead() + _daTitle(t('dailyAyah.readIt'));
  var tip = t('dailyAyah.tapHint') + (run.hints.length ? ' ' + t('dailyAyah.hintNote') : '');
  h += '<p class="daily-ayah-tip">' + _daEsc(tip) + '</p>';
  h += '<p class="daily-ayah-text" lang="ar" dir="rtl">';
  run.words.forEach(function (w, i) {
    h += '<button type="button" class="daily-ayah-tok' + (w.hint ? ' is-hint' : '') + '" data-action="word" data-i="' + i + '"' +
      ' lang="ar" dir="rtl">' + _daEsc(w.text) + '</button> ';
  });
  h += '</p>';
  h += '<p class="daily-ayah-meaning" id="daily-ayah-meaning" role="status" aria-live="polite"></p>';
  h += '<div class="daily-ayah-actions">' + _daButton('understood', 'dailyAyah.understood') +
    _daButton('translation', 'dailyAyah.showTranslation', ' btn-outline') + '</div>';
  return h + '</div>';
}

function _checkStepMarkup(run, canPlay) {
  var h = '<div class="root-screen daily-ayah">' + _daHead() + _daTitle(run.surahName + ' ' + run.ref);
  h += '<p class="daily-ayah-text is-small" lang="ar" dir="rtl">' +
    _daEsc(run.words.map(function (w) { return w.text; }).join(' ')) + '</p>';
  h += '<p class="daily-ayah-translation">' + _daEsc(run.translation) + '</p>';
  if (canPlay) {
    h += '<button type="button" class="btn btn-outline daily-ayah-play" data-action="play">' +
      uiIcon('volume-2') + _daEsc(t('dailyAyah.play')) + '</button>' + audioCreditHtml();
  }
  return h + _daButton('home', 'dailyAyah.done') + '</div>';
}

/** The current screen of the run. */
function dailyAyahStepMarkup(run, canPlay) {
  if (run.step === 'words') return _wordStepMarkup(run);
  if (run.step === 'ayah') return _readStepMarkup(run);
  return _checkStepMarkup(run, canPlay);
}
