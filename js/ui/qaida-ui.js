// ═══════════════════════════════════════════════════════════════
// qaida-ui.js — a Qaida lesson (#view-qaida-lesson)
//
// Three screens: the intro (what the lesson teaches: letters with their
// forms and a real word starting with each, marks with a note and real
// words, or a surah to read along with Al-Husary; words play quran.com's
// recording of them), the practice (exercises from js/qaida/qaida-exercises.js,
// drawn by the shared exercise UI) and the finish (score, and the share of
// the Quran the learner can now read). A reading check that scores below
// QAIDA_CHECK_PASS is not recorded and offers a retry.
//
// Clicks are handled by delegation on the view: every button carries a
// data-action, as in tracks-ui.js.
// ═══════════════════════════════════════════════════════════════

/**
 * The lesson in progress, or null:
 * { lesson, step, items, index, answered, correct, gained, passed, verses, seed }
 *   step: 'intro' | 'practice' | 'finish'
 */
var _qaidaRun = null;

function _qEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

function _qAr(text, className) {
  return '<span class="' + className + '" lang="ar" dir="rtl">' + _qEsc(text) + '</span>';
}

/** A play button for one sound, or several played in turn (a list of URLs). */
function _qPlay(url, label) {
  var urls = Array.isArray(url) ? url : [url];
  if (!urls.length || !urls[0]) return '';
  return '<button type="button" class="qaida-play" data-action="play" data-src="' + _qEsc(urls.join(' ')) + '"' +
    ' aria-label="' + _qEsc(t('audio.play') + ' ' + label) + '">' + uiIcon('play', true) + '</button>';
}

function _qHead() {
  return '<div class="qaida-head"><button type="button" class="qaida-back" data-action="back">' +
    uiIcon('chevron-left', true) + '<span>' + _qEsc(t('track.qaida.name')) + '</span></button></div>';
}

function _qTitle(text) {
  return '<h2 class="qaida-title" id="qaida-title" tabindex="-1">' + _qEsc(text) + '</h2>';
}

// ── Intro ───────────────────────────────────────────────────────

function _qLetterCard(letter) {
  var name = t('qaida.letter.' + letter.id + '.name');
  var h = '<li class="qaida-letter">';
  h += _qAr(letter.char, 'qaida-letter-char');
  h += '<span class="qaida-letter-name">' + _qEsc(name) + _qPlay(qaidaAudioUrl(letter.id), name) + '</span>';
  h += '<span class="qaida-forms" lang="ar" dir="rtl">';
  ['initial', 'medial', 'final'].forEach(function (p) { h += '<span>' + _qEsc(qaidaLetterForm(letter, p)) + '</span>'; });
  h += '</span>';
  // The letter heard at the start of a real word (quran.com's recording)
  var word = typeof QAIDA_LETTER_WORDS !== 'undefined' ? QAIDA_LETTER_WORDS[letter.id] : null;
  var urls = word ? qaidaWordAudioUrls(word) : [];
  if (urls.length) {
    h += '<span class="qaida-letter-word">' + _qEsc(t('qaida.intro.inWord')) + ' ' + _qAr(word, 'qaida-letter-word-ar') +
      _qPlay(urls, word) + '</span>';
  }
  h += '</li>';
  return h;
}

function _qMarkCard(markId, sample) {
  var name = t('qaida.mark.' + markId + '.name');
  return '<li class="qaida-mark">' + _qAr(sample, 'qaida-mark-sample') +
    '<span class="qaida-mark-name">' + _qEsc(name) + _qPlay(qaidaAudioUrl(markId), name) + '</span>' +
    '<span class="qaida-mark-desc">' + _qEsc(t('qaida.mark.' + markId + '.desc')) + '</span></li>';
}

function _qMarkSample(id) {
  for (var i = 0; i < QAIDA_MARKS.length; i++) if (QAIDA_MARKS[i].id === id) return QAIDA_MARKS[i].sample;
  return '';
}

/** A real Quran word in a lesson, with quran.com's recording of it when there is one. */
function _qWordItem(word) {
  return '<li>' + _qEsc(word) + _qPlay(qaidaWordAudioUrls(word), word) + '</li>';
}

function _qWords(words) {
  if (!words || !words.length) return '';
  return '<p class="qaida-words-label">' + _qEsc(t('qaida.intro.words')) + '</p><ul class="qaida-words" lang="ar" dir="rtl">' +
    words.slice(0, 8).map(_qWordItem).join('') + '</ul>';
}

function _qVerses(run) {
  var texts = run.verses[run.lesson.surah] || [];
  var h = '<ol class="qaida-verses">';
  texts.forEach(function (text, i) {
    h += '<li class="qaida-verse">' + _qAr(text, 'qaida-verse-text') +
      _qPlay(verseAudioUrl(run.lesson.surah, i + 1), t('qaida.intro.verseN', { n: i + 1 })) + '</li>';
  });
  return h + '</ol>' + audioCreditHtml();
}

function _qIntroBody(run) {
  var lesson = run.lesson;
  var letters = lesson.teaches.map(getQaidaLetter).filter(Boolean);
  if (lesson.kind === 'letters') {
    var h = '<p class="qaida-note">' + _qEsc(t('qaida.intro.letters')) + '</p>' +
      '<ul class="qaida-letters">' + letters.map(_qLetterCard).join('');
    if (lesson.teaches.indexOf('hamza') >= 0) h += _qMarkCard('hamza', 'ء');
    return h + '</ul>';
  }
  if (lesson.kind === 'shapes' || lesson.kind === 'nonjoining') {
    var shown = lesson.kind === 'shapes'
      ? QAIDA_LETTERS.filter(function (l) { return QAIDA_LETTERS.some(function (o) { return o !== l && o.group === l.group; }); })
      : QAIDA_LETTERS.filter(function (l) { return !l.joins; });
    return '<p class="qaida-note">' + _qEsc(t('qaida.intro.' + lesson.kind)) + '</p>' +
      '<ul class="qaida-letters">' + shown.map(_qLetterCard).join('') + '</ul>';
  }
  if (lesson.kind === 'forms') {
    return '<p class="qaida-note">' + _qEsc(t('qaida.intro.forms')) + '</p><ul class="qaida-letters">' +
      ['ba', 'jim', 'ain', 'ha'].map(getQaidaLetter).map(_qLetterCard).join('') +
      _qMarkCard('ta-marbuta', 'ة') + _qMarkCard('alif-maqsura', 'ى') + '</ul>';
  }
  if (lesson.kind === 'muqattaat') {
    return '<p class="qaida-note">' + _qEsc(t('qaida.intro.muqattaat')) + '</p>' +
      '<ul class="qaida-words" lang="ar" dir="rtl">' + lesson.examples.map(_qWordItem).join('') + '</ul>';
  }
  if (lesson.kind === 'marks') {
    return '<ul class="qaida-marks">' + lesson.teaches.map(function (id) { return _qMarkCard(id, _qMarkSample(id)); }).join('') + '</ul>' +
      _qWords(typeof QAIDA_EXAMPLES !== 'undefined' ? QAIDA_EXAMPLES[lesson.id] : null);
  }
  if (lesson.kind === 'surah') return _qVerses(run);
  if (lesson.kind === 'check') {
    return '<p class="qaida-note">' + _qEsc(t('qaida.intro.check', { pct: Math.round(QAIDA_CHECK_PASS * 100) })) + '</p>';
  }
  return '<p class="qaida-note">' + _qEsc(t('qaida.intro.review')) + '</p>';
}

function _qIntroMarkup(run) {
  var h = '<div class="qaida-screen">' + _qHead();
  h += '<p class="qaida-kicker">' + _qEsc(t('level.' + run.lesson.level) + ' · ' + t('tracks.lessonN', { n: run.lesson.number })) + '</p>';
  h += _qTitle(t('qaida.lesson.' + run.lesson.id + '.title'));
  h += _qIntroBody(run);
  if (run.items.length > 0) {
    h += '<button type="button" class="btn qaida-continue" data-action="practice">' + _qEsc(t('qaida.practice')) + '</button>';
  } else {
    h += '<p class="qaida-note">' + _qEsc(t('qaida.offline')) + '</p>';
  }
  return h + '</div>';
}

// ── Practice and finish ─────────────────────────────────────────

function _qPracticeMarkup(run) {
  var item = run.items[run.index];
  var h = '<div class="qaida-screen">' + _qHead();
  h += '<p class="qaida-progress" role="status">' + _qEsc(t('root.progress', { n: run.index + 1, total: run.items.length })) + '</p>';
  if (item && item.surah) {
    h += '<div class="qaida-listen">' + _qPlay(verseAudioUrl(item.surah, item.verse), t('qaida.intro.verseN', { n: item.verse })) +
      '<span>' + _qEsc(t('qaida.listen')) + '</span></div>';
  }
  h += '<div class="qaida-body" id="qaida-exercise"></div>';
  h += '<div class="qaida-actions" id="qaida-next"></div>';
  return h + '</div>';
}

function _qFinishMarkup(run) {
  var total = run.items.length;
  var h = '<div class="qaida-screen qaida-finish">' + _qTitle(t(run.passed ? 'qaida.done' : 'qaida.notYet'));
  h += '<p class="qaida-score">' + _qEsc(t('root.score', { n: run.correct, total: total })) + '</p>';
  if (!run.passed) {
    h += '<p class="qaida-note" role="status">' + _qEsc(t('qaida.checkFailed', { pct: Math.round(QAIDA_CHECK_PASS * 100) })) + '</p>';
    h += '<div class="qaida-finish-actions"><button type="button" class="btn" data-action="retry">' + _qEsc(t('qaida.retry')) + '</button>';
  } else {
    h += '<p class="qaida-gain' + (run.gained > 0 ? '' : ' is-none') + '" role="status">' + _qEsc(run.gained > 0
      ? t('percent.qaida.gained', { p: run.gained })
      : t(getQaidaPercent() > 0 ? 'qaida.noGain' : 'qaida.noGainYet')) + '</p>';
    var next = getQaidaNextLesson(run.lesson.level);
    h += '<div class="qaida-finish-actions">';
    if (next) h += '<button type="button" class="btn" data-action="next-lesson" data-ref="' + _qEsc(next.ref) + '">' + _qEsc(t('qaida.nextLesson')) + '</button>';
  }
  h += '<button type="button" class="btn btn-outline" data-action="back">' + _qEsc(t('qaida.toPath')) + '</button></div>';
  return h + '</div>';
}

/** Render the Qaida lesson view for the lesson in progress. */
function renderQaidaLesson() {
  var view = document.getElementById('view-qaida-lesson');
  if (!view) return;
  view.onclick = _onQaidaClick;
  var run = _qaidaRun;
  if (!run) { view.innerHTML = ''; return; }
  if (run.step === 'intro') view.innerHTML = _qIntroMarkup(run);
  else if (run.step === 'finish') view.innerHTML = _qFinishMarkup(run);
  else {
    view.innerHTML = _qPracticeMarkup(run);
    renderExercise(document.getElementById('qaida-exercise'), run.items[run.index], _onQaidaAnswer);
  }
  var title = document.getElementById('qaida-title');
  if (title) title.focus();
}

function _onQaidaAnswer(correct) {
  var run = _qaidaRun;
  if (!run || run.step !== 'practice' || run.answered) return;
  if (typeof recordQaidaAnswer === 'function') recordQaidaAnswer(run.items[run.index].skill, correct);
  if (correct) run.correct += 1;
  run.answered = true;
  var slot = document.getElementById('qaida-next');
  if (!slot) return;
  var last = run.index + 1 >= run.items.length;
  slot.innerHTML = '<button type="button" class="btn qaida-next" data-action="next">' + _qEsc(t(last ? 'root.finish' : 'root.next')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.qaida-next') : null;
  if (button) button.focus();
}

function _finishQaida(run) {
  var score = run.items.length ? run.correct / run.items.length : 1;
  run.passed = run.lesson.kind !== 'check' || score >= QAIDA_CHECK_PASS;
  if (run.passed) {
    completeQaidaLesson(run.lesson.id, score);
    run.gained = refreshQaidaPercent().gained;
  }
  stopAudio();
  run.step = 'finish';
  renderQaidaLesson();
}

function _nextQaidaItem() {
  var run = _qaidaRun;
  if (!run || run.step !== 'practice' || !run.answered) return;
  if (run.index + 1 >= run.items.length) { _finishQaida(run); return; }
  run.index += 1;
  run.answered = false;
  renderQaidaLesson();
}

// ── Entry points and clicks ─────────────────────────────────────

/** Verse texts for the surahs a lesson reads, loading them first. */
async function _loadQaidaVerses(lesson) {
  var out = {};
  var loader = window.__quranLoader;
  var surahs = getQaidaLessonSurahs(lesson);
  if (!loader || surahs.length === 0) return out;
  try { await loader.loadSurahs(surahs); } catch (e) { return out; }
  surahs.forEach(function (s) {
    var surah = loader.getSurah(s);
    if (surah && surah.verses) out[s] = surah.verses.map(function (v) { return v.text; });
  });
  return out;
}

/**
 * Open a Qaida lesson at its intro. Surah lessons load their verses first
 * and fetch the recitation ahead, so it plays offline later.
 * @param {string} lessonId
 * @param {number} [seed] - fixed for tests; otherwise a new set each time
 */
async function startQaidaLesson(lessonId, seed) {
  var lesson = getQaidaLesson(lessonId);
  if (!lesson) return;
  refreshQaidaPercent();
  var verses = await _loadQaidaVerses(lesson);
  var s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1e9);
  _qaidaRun = { lesson: lesson, step: 'intro', items: buildQaidaLessonItems(lesson, s, verses), index: 0,
    answered: false, correct: 0, gained: 0, passed: false, verses: verses, seed: s };
  if (lesson.kind === 'surah') {
    cacheAudio((verses[lesson.surah] || []).map(function (_, i) { return verseAudioUrl(lesson.surah, i + 1); }));
  }
  cacheAudio(qaidaLessonWordAudio(lesson));
  switchView('qaida-lesson');
}

function _leaveQaida() {
  stopAudio();
  _qaidaRun = null;
  switchView('track', { trackId: QAIDA_TRACK_ID });
}

function _onQaidaClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  var run = _qaidaRun;

  if (action === 'play') playAudioQueue(el.getAttribute('data-src').split(' '));
  else if (action === 'back') _leaveQaida();
  else if (action === 'practice' && run) { run.step = 'practice'; run.index = 0; run.answered = false; renderQaidaLesson(); }
  else if (action === 'next') _nextQaidaItem();
  else if (action === 'retry' && run) startQaidaLesson(run.lesson.id, run.seed + 1);
  else if (action === 'next-lesson') startQaidaLesson(el.getAttribute('data-ref'));
}
