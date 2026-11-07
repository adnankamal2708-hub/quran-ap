// ═══════════════════════════════════════════════════════════════
// tajweed-ui.js — a Tajweed lesson and verse practice (#view-tajweed-lesson)
//
// A lesson has three screens, as in qaida-ui.js: the intro (what the
// lesson teaches, with a practice card per letter), the exercises (from
// js/tajweed/tajweed-exercises.js, drawn by the shared exercise UI) and the
// finish (how many of the 28 letters are now covered). A reading check
// that scores below TAJWEED_CHECK_PASS is not recorded and offers a retry.
//
// Verse practice shows one verse at a time, in the order of
// getNextTajweedVerse: Listen to Al-Husary's teaching recitation, Record,
// Compare, then Smooth or Not yet.
//
// renderTajweedPracticeCard draws the card both screens share (and the
// Practice tab's review): Play or Listen, Record, Compare and the marks.
// Recordings stay in memory (recorder.js), and the microphone is asked for
// only when Record is tapped.
//
// Clicks are handled by delegation, as in qaida-ui.js: the view handles
// the screen's buttons, each card its own (their actions start with "tj-").
// ═══════════════════════════════════════════════════════════════

/**
 * The screen in progress, or null:
 *   { mode: 'lesson', lesson, step, items, index, answered, correct, passed, seed }
 *     step: 'intro' | 'practice' | 'finish'
 *   { mode: 'verses', verse: { surah, ayah } | null (every verse is smooth) }
 */
var _tajweedRun = null;

/**
 * Practice cards on screen:
 * { id, host, onMarked, letter, verse, refUrl, text, note, marked, gain }
 *   text:   a verse's text; undefined while loading, null when it can't load
 *   note:   'denied' or 'unsupported' after a Record tap that failed
 *   marked: null, or true (Got it / Smooth) or false (Not yet)
 */
var _tajweedCards = [];

/**
 * The recorder as the cards see it: the card recording and its state
 * ('idle' | 'starting' | 'recording' | 'stopping'), and the card that
 * holds the take. gen is bumped so a result that arrives late is ignored.
 */
var _tajweedRec = { card: null, state: 'idle', take: null, gen: 0 };

function _tjEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

function _tjAr(text, className, tag) {
  tag = tag || 'span';
  return '<' + tag + ' class="' + className + '" lang="ar" dir="rtl">' + _tjEsc(text) + '</' + tag + '>';
}

/** A button; `label` is markup, already escaped. */
function _tjButton(action, label, className, extra) {
  return '<button type="button" class="btn ' + className + '" data-action="' + action + '"' + (extra || '') + '>' + label + '</button>';
}

function _tjNote(text) {
  return '<p class="qaida-note">' + _tjEsc(text) + '</p>';
}

/**
 * "+x%" for a verse marked smooth. One verse is often a few thousandths of
 * a percent, so the gain is rounded to 2 decimals first: '' when that is
 * 0.00, 2 decimals while it is under 0.1, else 1.
 */
function _tajweedGainText(gain) {
  var rounded = Math.round(gain * 100) / 100;
  if (!(rounded > 0)) return '';
  return t('percent.tajweed.gained', { p: rounded < 0.1 ? rounded.toFixed(2) : gain.toFixed(1) });
}

// ── Recording ───────────────────────────────────────────────────

/** Drop any recording or take and stop playback: on moving to the next card. */
function _tjStopRecorder() {
  _tajweedRec.gen++;
  _tajweedRec.card = null;
  _tajweedRec.state = 'idle';
  _tajweedRec.take = null;
  discardRecording();
  stopAudio();
}

/** On leaving a screen (or redrawing it whole): stop as above and let go of its cards. */
function _tjLeaveScreen() {
  _tjStopRecorder();
  _tajweedCards = [];
}

function _tjRenderAll() {
  _tajweedCards.forEach(_tjRenderCard);
}

function _tjFocus(card, action) {
  var button = card.host.querySelector ? card.host.querySelector('[data-action="' + action + '"]') : null;
  if (button) button.focus();
}

function _tjRecord(card) {
  var rec = _tajweedRec;
  if (rec.state !== 'idle') return;
  discardRecording();
  rec.take = null;
  rec.card = card;
  rec.state = 'starting';
  card.note = null;
  var gen = ++rec.gen;
  _tjRenderAll();
  _tjFocus(card, 'tj-stop');
  startRecording().then(function (result) {
    if (gen !== rec.gen) return;
    if (result === 'recording') {
      rec.state = 'recording';
    } else {
      rec.state = 'idle';
      rec.card = null;
      card.note = result;
    }
    _tjRenderAll();
    _tjFocus(card, result === 'recording' ? 'tj-stop' : 'tj-ok');
  });
}

function _tjStop(card) {
  var rec = _tajweedRec;
  if (rec.card !== card) return;
  if (rec.state === 'starting') {
    // Still waiting on the permission prompt: cancel it.
    rec.gen++;
    rec.card = null;
    rec.state = 'idle';
    stopRecording();
    _tjRenderAll();
    return;
  }
  if (rec.state !== 'recording') return;
  rec.state = 'stopping';
  var gen = rec.gen;
  _tjRenderAll();
  stopRecording().then(function (url) {
    if (gen !== rec.gen) return;
    rec.state = 'idle';
    rec.card = null;
    rec.take = url ? card : null;
    _tjRenderAll();
    _tjFocus(card, rec.take && card.refUrl ? 'tj-compare' : 'tj-record');
  });
}

// ── The practice card ───────────────────────────────────────────

function _tjLetterHead(letter) {
  var m = getTajweedMakhraj(letter.id);
  var h = '<div class="tajweed-card-head">' + _tjAr(letter.char, 'tajweed-char') +
    '<span class="tajweed-name">' + _tjEsc(t(letter.nameKey)) + '</span></div>';
  if (m) {
    h += '<p class="tajweed-makhraj"><span class="tajweed-area">' + _tjEsc(t('tajweed.area.' + m.area + '.name')) + '</span>' +
      _tjEsc(t('tajweed.point.' + m.point)) + '</p>';
  }
  return h;
}

function _tjMarks(card) {
  if (card.marked === null) {
    return '<div class="tajweed-marks">' +
      _tjButton('tj-ok', _tjEsc(t(card.verse ? 'tajweed.smooth' : 'tajweed.gotIt')), 'btn-sm') +
      _tjButton('tj-miss', _tjEsc(t('tajweed.notYet')), 'btn-outline btn-sm') + '</div>';
  }
  if (card.marked && card.gain > 0) return '<p class="tajweed-gain" role="status">' + _tjEsc(_tajweedGainText(card.gain)) + '</p>';
  var key = !card.marked ? 'tajweed.marked.notYet' : card.verse ? 'tajweed.marked.smooth' : 'tajweed.marked.gotIt';
  return '<p class="tajweed-marked" role="status">' + _tjEsc(t(key)) + '</p>';
}

/** Play or Listen, Record (or Stop), Compare once there is a take, the recorder's note, and the marks. */
function _tjCardTools(card) {
  var rec = _tajweedRec;
  var mine = rec.card === card;
  var canRecord = isRecordingSupported() && card.note !== 'unsupported';
  var h = '<div class="tajweed-tools">';
  if (card.refUrl) {
    h += _tjButton('tj-play', uiIcon('play') + _tjEsc(t(card.verse ? 'tajweed.listen' : 'audio.play')), 'btn-outline btn-sm',
      ' data-src="' + _tjEsc(card.refUrl) + '"');
  }
  if (canRecord && mine && (rec.state === 'starting' || rec.state === 'recording')) {
    h += _tjButton('tj-stop', _tjEsc(t('tajweed.stop')), 'btn-outline btn-sm');
  } else if (canRecord) {
    h += _tjButton('tj-record', _tjEsc(t('tajweed.record')), 'btn-outline btn-sm', rec.state === 'idle' ? '' : ' disabled');
  }
  if (card.refUrl && rec.take === card && rec.state === 'idle') {
    h += _tjButton('tj-compare', _tjEsc(t('tajweed.compare')), 'btn-outline btn-sm');
  }
  h += '</div>';
  if (card.verse) h += audioCreditHtml();
  var note = !canRecord ? 'unsupported' : card.note === 'denied' ? 'denied' : mine && rec.state === 'recording' ? 'recording' : null;
  if (note) h += '<p class="tajweed-note" role="status">' + _tjEsc(t('tajweed.record.' + note)) + '</p>';
  return h + _tjMarks(card);
}

function _tjCardMarkup(card) {
  if (card.letter) return _tjLetterHead(card.letter) + _tjCardTools(card);
  if (!card.verse) return '';
  var v = card.verse;
  var info = typeof getSurahInfo === 'function' ? getSurahInfo(v.surah) : null;
  var h = '<p class="tajweed-verse-ref">' +
    _tjEsc(t('tajweed.verse.ref', { surah: info ? info.nameSimple : v.surah, ref: v.surah + ':' + v.ayah })) + '</p>';
  if (card.text === undefined) return h + '<p class="qaida-note" role="status">' + _tjEsc(t('drill.loading')) + '</p>';
  if (card.text === null) return h + '<p class="qaida-note" role="status">' + _tjEsc(t('drill.unavailable')) + '</p>';
  return h + _tjAr(card.text, 'tajweed-verse-text', 'p') + _tjCardTools(card);
}

function _tjRenderCard(card) {
  card.host.innerHTML = _tjCardMarkup(card);
}

function _tjNewCard(host, id, onMarked) {
  var card = { id: id, host: host, onMarked: onMarked, letter: null, verse: null, refUrl: null,
    text: undefined, note: null, marked: null, gain: 0 };
  var verse = /^tj-verse:(\d+):(\d+)$/.exec(id);
  if (id.indexOf('tj-letter:') === 0) {
    card.letter = getTajweedLetter(id.slice('tj-letter:'.length));
    card.refUrl = card.letter ? qaidaAudioUrl(card.letter.id) : null;
  } else if (verse) {
    card.verse = { surah: +verse[1], ayah: +verse[2] };
    card.refUrl = teachingVerseAudioUrl(card.verse.surah, card.verse.ayah);
  }
  return card;
}

/** Fill in a verse card's text from the Quran loader, loading its surah if needed. */
async function _tjLoadVerseText(card) {
  var loader = window.__quranLoader;
  var v = card.verse;
  var verse = null;
  if (loader) {
    try {
      verse = loader.getVerse(v.surah, v.ayah);
      if (!verse) {
        await loader.load();
        await loader.loadSurahs([v.surah]);
        verse = loader.getVerse(v.surah, v.ayah);
      }
    } catch (e) {
      verse = null;
    }
  }
  if (_tajweedCards.indexOf(card) < 0) return;
  card.text = verse && verse.text ? verse.text : null;
  _tjRenderCard(card);
  if (card.text === null && card.onMarked) card.onMarked(null);
}

function _tjMark(card, ok) {
  if (card.marked !== null) return;
  // A take still running on this card is dropped, so the microphone never outlives its card
  var recording = _tajweedRec.card === card;
  if (recording) _tjStopRecorder();
  if (card.verse) {
    var before = getTajweedPercent();
    markTajweedVerse(card.verse.surah, card.verse.ayah, ok);
    if (ok) {
      refreshTajweedPercent();
      card.gain = getTajweedPercent() - before;
    }
  } else if (card.letter) {
    recordTajweedReview(card.id, ok);
  }
  card.marked = ok;
  if (recording) _tjRenderAll();
  else _tjRenderCard(card);
  if (card.onMarked) card.onMarked(ok);
}

function _onTajweedCardClick(card, e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  if (action === 'tj-play') playAudio(card.refUrl);
  else if (action === 'tj-record') _tjRecord(card);
  else if (action === 'tj-stop') _tjStop(card);
  else if (action === 'tj-compare' && card.refUrl) playComparison(card.refUrl);
  else if (action === 'tj-ok') _tjMark(card, true);
  else if (action === 'tj-miss') _tjMark(card, false);
}

/**
 * Draw a practice card into `host`, replacing the card that was there (and
 * its recording). Letters: the letter, its name and makhraj, Play (only
 * with a recording), Record, Compare and Got it / Not yet, which go to the
 * review queue. Verses: the text (loaded first), Listen with the credit,
 * Record, Compare and Smooth / Not yet (markTajweedVerse).
 * @param {Element} host
 * @param {string} id - tj-letter:<letterId> or tj-verse:<surah>:<ayah>
 * @param {Function} [onMarked] - called with true or false once a mark is
 *   recorded, or null when a verse's text can't load (nothing to mark)
 */
function renderTajweedPracticeCard(host, id, onMarked) {
  if (!host) return;
  _tajweedCards = _tajweedCards.filter(function (c) {
    var gone = c.host === host || c.host.isConnected === false;
    if (gone && (_tajweedRec.card === c || _tajweedRec.take === c)) _tjStopRecorder();
    return !gone;
  });
  var card = _tjNewCard(host, String(id), onMarked);
  _tajweedCards.push(card);
  host.onclick = function (e) { _onTajweedCardClick(card, e); };
  _tjRenderCard(card);
  if (card.verse) _tjLoadVerseText(card);
}

// ── Lesson: intro ───────────────────────────────────────────────

function _tjHead() {
  return '<div class="qaida-head"><button type="button" class="qaida-back" data-action="back">' +
    uiIcon('chevron-left', true) + '<span>' + _tjEsc(t('track.tajweed.name')) + '</span></button></div>';
}

function _tjTitle(text) {
  return '<h2 class="qaida-title" id="tajweed-title" tabindex="-1">' + _tjEsc(text) + '</h2>';
}

/** Names with a line each, e.g. the five areas or a lesson's qualities. */
function _tjInfoList(keys) {
  return '<ul class="qaida-marks">' + keys.map(function (key) {
    return '<li class="qaida-mark"><span class="qaida-mark-name">' + _tjEsc(t(key + '.name')) + '</span>' +
      '<span class="qaida-mark-desc">' + _tjEsc(t(key + '.desc')) + '</span></li>';
  }).join('') + '</ul>';
}

function _tjIntroBody(lesson) {
  if (lesson.topic === 'areas') {
    return _tjNote(t('tajweed.intro.areas')) + _tjInfoList(TAJWEED_AREAS.map(function (a) { return 'tajweed.area.' + a; }));
  }
  if (lesson.kind === 'check') return _tjNote(t('tajweed.intro.check', { pct: Math.round(TAJWEED_CHECK_PASS * 100) }));
  var h = '';
  if (lesson.topic === 'qualities') h += _tjInfoList(lesson.qualities.map(function (q) { return 'tajweed.quality.' + q; }));
  if (lesson.topic === 'confused') {
    h += _tjNote(t('tajweed.intro.confused')) + '<ul class="qaida-words" lang="ar" dir="rtl">' +
      TAJWEED_CONFUSED_PAIRS.map(function (pair) {
        return '<li>' + _tjEsc(getTajweedLetter(pair[0]).char + ' / ' + getTajweedLetter(pair[1]).char) + '</li>';
      }).join('') + '</ul>';
  }
  h += _tjNote(t('tajweed.intro.cards')) + '<ul class="tajweed-cards">';
  lesson.letters.forEach(function (id) { h += '<li class="tajweed-card" id="tajweed-card-' + _tjEsc(id) + '"></li>'; });
  return h + '</ul>';
}

function _tjIntroMarkup(run) {
  var lesson = run.lesson;
  var h = '<div class="qaida-screen">' + _tjHead();
  h += '<p class="qaida-kicker">' + _tjEsc(t('level.' + lesson.level) + ' · ' + t('tracks.lessonN', { n: lesson.number })) + '</p>';
  h += _tjTitle(tajweedLessonTitle(lesson.id));
  h += _tjIntroBody(lesson);
  h += '<button type="button" class="btn qaida-continue" data-action="practice">' + _tjEsc(t('qaida.practice')) + '</button>';
  return h + '</div>';
}

// ── Lesson: practice and finish ─────────────────────────────────

function _tjPracticeMarkup(run) {
  var h = '<div class="qaida-screen">' + _tjHead();
  h += '<p class="qaida-progress" role="status">' + _tjEsc(t('root.progress', { n: run.index + 1, total: run.items.length })) + '</p>';
  h += '<div class="qaida-body" id="tajweed-exercise"></div>';
  h += '<div class="qaida-actions" id="tajweed-next"></div>';
  return h + '</div>';
}

function _tjFinishMarkup(run) {
  var lesson = run.lesson;
  var title = run.passed
    ? t('tajweed.done', { title: tajweedLessonTitle(lesson.id), n: getTajweedLettersCovered(), total: QAIDA_LETTERS.length })
    : t('qaida.notYet');
  var h = '<div class="qaida-screen qaida-finish">' + _tjTitle(title);
  h += '<p class="qaida-score">' + _tjEsc(t('root.score', { n: run.correct, total: run.items.length })) + '</p>';
  if (!run.passed) {
    h += '<p class="qaida-note" role="status">' + _tjEsc(t('qaida.checkFailed', { pct: Math.round(TAJWEED_CHECK_PASS * 100) })) + '</p>';
    h += '<div class="qaida-finish-actions"><button type="button" class="btn" data-action="retry">' + _tjEsc(t('qaida.retry')) + '</button>';
  } else {
    var next = getTajweedNextLesson(lesson.level);
    h += '<div class="qaida-finish-actions">';
    if (next) h += '<button type="button" class="btn" data-action="next-lesson" data-ref="' + _tjEsc(next.ref) + '">' + _tjEsc(t('qaida.nextLesson')) + '</button>';
  }
  h += '<button type="button" class="btn btn-outline" data-action="back">' + _tjEsc(t('qaida.toPath')) + '</button></div>';
  return h + '</div>';
}

function _onTajweedAnswer(correct) {
  var run = _tajweedRun;
  if (!run || run.mode !== 'lesson' || run.step !== 'practice' || run.answered) return;
  var item = run.items[run.index];
  if (item.skill) recordTajweedReview(item.skill, correct);
  if (correct) run.correct += 1;
  run.answered = true;
  var slot = document.getElementById('tajweed-next');
  if (!slot) return;
  var last = run.index + 1 >= run.items.length;
  slot.innerHTML = '<button type="button" class="btn qaida-next" data-action="next">' + _tjEsc(t(last ? 'root.finish' : 'root.next')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.qaida-next') : null;
  if (button) button.focus();
}

function _finishTajweed(run) {
  var score = run.items.length ? run.correct / run.items.length : 1;
  run.passed = run.lesson.kind !== 'check' || score >= TAJWEED_CHECK_PASS;
  if (run.passed) completeTajweedLesson(run.lesson.id, score);
  stopAudio();
  run.step = 'finish';
  renderTajweedLesson();
}

function _startTajweedPractice(run) {
  _tjLeaveScreen();
  if (run.items.length === 0) { _finishTajweed(run); return; }
  run.step = 'practice';
  run.index = 0;
  run.answered = false;
  renderTajweedLesson();
}

function _nextTajweedItem() {
  var run = _tajweedRun;
  if (!run || run.mode !== 'lesson' || run.step !== 'practice' || !run.answered) return;
  if (run.index + 1 >= run.items.length) { _finishTajweed(run); return; }
  run.index += 1;
  run.answered = false;
  renderTajweedLesson();
}

// ── Verse practice ──────────────────────────────────────────────

function _tjVersesMarkup(run) {
  var h = '<div class="qaida-screen">' + _tjHead() + _tjTitle(t('tajweed.verses.title'));
  if (!run.verse) return h + '<p class="qaida-note" role="status">' + _tjEsc(t('tajweed.verses.done')) + '</p></div>';
  h += _tjNote(t('tajweed.verses.intro'));
  h += '<div class="tajweed-card" id="tajweed-verse-card"></div>';
  h += '<div class="qaida-actions" id="tajweed-next"></div>';
  return h + '</div>';
}

function _onTajweedVerseMarked() {
  var slot = document.getElementById('tajweed-next');
  if (!slot) return;
  slot.innerHTML = '<button type="button" class="btn qaida-next" data-action="verse-next">' + _tjEsc(t('tajweed.verses.next')) + '</button>';
  var button = slot.querySelector ? slot.querySelector('.qaida-next') : null;
  if (button) button.focus();
}

function _nextTajweedVerse() {
  var run = _tajweedRun;
  if (!run || run.mode !== 'verses' || !run.verse) return;
  _tjLeaveScreen();
  run.verse = getNextTajweedVerse(run.verse) || getNextTajweedVerse();
  renderTajweedLesson();
}

// ── Rendering, entry points and clicks ──────────────────────────

/** Render the Tajweed view for the lesson or verse practice in progress. */
function renderTajweedLesson() {
  var view = document.getElementById('view-tajweed-lesson');
  if (!view) return;
  view.onclick = _onTajweedClick;
  var run = _tajweedRun;
  if (!run) { view.innerHTML = ''; return; }
  if (run.mode === 'verses') {
    view.innerHTML = _tjVersesMarkup(run);
    if (run.verse) {
      renderTajweedPracticeCard(document.getElementById('tajweed-verse-card'),
        'tj-verse:' + run.verse.surah + ':' + run.verse.ayah, _onTajweedVerseMarked);
    }
  } else if (run.step === 'intro') {
    view.innerHTML = _tjIntroMarkup(run);
    run.lesson.letters.forEach(function (id) {
      renderTajweedPracticeCard(document.getElementById('tajweed-card-' + id), 'tj-letter:' + id);
    });
  } else if (run.step === 'finish') {
    view.innerHTML = _tjFinishMarkup(run);
  } else {
    view.innerHTML = _tjPracticeMarkup(run);
    renderExercise(document.getElementById('tajweed-exercise'), run.items[run.index], _onTajweedAnswer);
  }
  var title = document.getElementById('tajweed-title');
  if (title) title.focus();
}

/**
 * Open a Tajweed lesson at its intro, fetching its letters' recordings
 * ahead so they play offline later.
 * @param {string} lessonId
 * @param {number} [seed] - fixed for tests; otherwise a new set each time
 */
function startTajweedLesson(lessonId, seed) {
  var lesson = getTajweedLesson(lessonId);
  if (!lesson) return;
  _tjLeaveScreen();
  var s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1e9);
  _tajweedRun = { mode: 'lesson', lesson: lesson, step: 'intro', items: buildTajweedLessonItems(lesson, s), index: 0,
    answered: false, correct: 0, passed: false, seed: s };
  cacheAudio(lesson.letters.map(qaidaAudioUrl).filter(Boolean));
  switchView('tajweed-lesson');
}

/** Open verse practice at the first verse not yet marked smooth. */
function startTajweedVersePractice() {
  _tjLeaveScreen();
  _tajweedRun = { mode: 'verses', verse: getNextTajweedVerse() };
  switchView('tajweed-lesson');
}

/** Stop recording and playback when the learner leaves the view by other means (navigation.js). */
function stopTajweedPractice() {
  _tjLeaveScreen();
}

function _leaveTajweed() {
  _tjLeaveScreen();
  _tajweedRun = null;
  switchView('track', { trackId: TAJWEED_TRACK_ID });
}

function _onTajweedClick(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  var run = _tajweedRun;

  if (action === 'back') _leaveTajweed();
  else if (action === 'practice' && run && run.mode === 'lesson') _startTajweedPractice(run);
  else if (action === 'next') _nextTajweedItem();
  else if (action === 'retry' && run && run.lesson) startTajweedLesson(run.lesson.id, run.seed + 1);
  else if (action === 'next-lesson') startTajweedLesson(el.getAttribute('data-ref'));
  else if (action === 'verse-next') _nextTajweedVerse();
}
