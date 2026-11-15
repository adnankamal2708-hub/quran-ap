// ═══════════════════════════════════════════════════════════════
// daily-ayah-ui.js — Today's ayah on Home and in #view-daily-ayah
//
// Home asks renderDailyAyahCard() to fill its slot. The card loads the
// ayah index (js/quran/ayah-readability.min.js) on first use, picks today's
// ayah (js/data-core/daily-ayah.js) and stays hidden when there is none or
// anything fails to load, so Home never waits on it or breaks.
//
// Opening the card loads that surah's text and checked word meanings and
// runs the screens drawn by daily-ayah-steps.js. Either button on the ayah
// marks it done; only "I understood it" adds to the read count.
// ═══════════════════════════════════════════════════════════════

var AYAH_READABILITY_URL = './js/quran/ayah-readability.min.js';
var _ayahReadabilityLoad = null;
var _dailyRun = null;

/** The ayah index, loaded once; resolves null when it can't be loaded. */
function loadAyahReadability() {
  if (window.__AYAH_READABILITY) return Promise.resolve(window.__AYAH_READABILITY);
  if (_ayahReadabilityLoad) return _ayahReadabilityLoad;
  _ayahReadabilityLoad = new Promise(function (resolve) {
    var script = document.createElement('script');
    script.src = AYAH_READABILITY_URL;
    script.async = true;
    script.onload = function () { resolve(window.__AYAH_READABILITY || null); };
    script.onerror = function () { _ayahReadabilityLoad = null; resolve(null); };
    document.head.appendChild(script);
  });
  return _ayahReadabilityLoad;
}

function _dailySurahName(surahId) {
  var info = typeof getQuranSurahInfo === 'function' ? getQuranSurahInfo(surahId) : null;
  return info ? info.transliteration : '';
}

/** Today's pick, saved as today's so it holds until midnight. */
function _todaysDailyAyah(index) {
  var state = loadDailyAyahState();
  var today = dailyAyahDateKey(new Date());
  var pick = pickDailyAyah(index, typeof loadSRS === 'function' ? loadSRS() : {}, state, today);
  if (pick && (state.date !== today || state.ref !== pick.ref)) {
    state.date = today;
    state.ref = pick.ref;
    saveDailyAyahState(state);
  }
  return { pick: pick, state: state, doneToday: !!pick && state.done.indexOf(pick.ref) >= 0 };
}

/** Fill Home's slot with the card, or leave it hidden. */
function renderDailyAyahCard(container) {
  if (!container) return Promise.resolve();
  container.hidden = true;
  return loadAyahReadability().then(function (index) {
    if (!index) return;
    var today = _todaysDailyAyah(index);
    if (!today.pick) return;
    return loadQuranText().then(function () {
      var name = _dailySurahName(Number(today.pick.ref.split(':')[0]));
      container.innerHTML = dailyAyahCardMarkup(today.pick, name, today.doneToday, today.state.readCount);
      container.hidden = false;
      container.onclick = function (e) { if (e.target.closest('[data-action="open"]')) openDailyAyah(); };
      container.onkeydown = function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-action="open"]')) { e.preventDefault(); openDailyAyah(); }
      };
    });
  }).catch(function (err) {
    container.hidden = true;
    if (window.__diag) window.__diag.warn('DailyAyah', 'card', String(err && err.message || err));
  });
}

function _dailyRootOf(entry) {
  var word = typeof getCanonicalWordById === 'function' ? getCanonicalWordById('cw_' + Number(String(entry).replace('+', ''))) : null;
  return word && word.root ? word.root : '';
}

/** Load today's ayah and open its screens. */
function openDailyAyah() {
  return loadAyahReadability().then(function (index) {
    var today = index && _todaysDailyAyah(index);
    if (!today || !today.pick) return;
    var p = today.pick.ref.split(':');
    return loadQuranSurah(Number(p[0])).then(function () {
      var run = buildDailyAyahRun(today.pick, getQuranVerse(Number(p[0]), Number(p[1])), _dailySurahName(Number(p[0])), _dailyRootOf);
      if (!run) return;
      _dailyRun = run;
      switchView('daily-ayah');
    });
  }).catch(function (err) {
    if (window.__diag) window.__diag.warn('DailyAyah', 'open', String(err && err.message || err));
  });
}

/** Render #view-daily-ayah for the current run (Home when there is none). */
function renderDailyAyah() {
  var view = document.getElementById('view-daily-ayah');
  if (!view) return;
  if (!_dailyRun) { switchView('dashboard'); return; }
  view.onclick = _onDailyAyahClick;
  view.innerHTML = dailyAyahStepMarkup(_dailyRun, typeof verseAudioUrl === 'function');
  var title = document.getElementById('daily-ayah-title');
  if (title) title.focus();
}

/** Mark today's ayah done; `understood` adds it to the read count. */
function finishDailyAyah(run, understood) {
  saveDailyAyahState(completeDailyAyah(loadDailyAyahState(), run.ref, understood));
  run.step = 'check';
}

function _onDailyAyahClick(e) {
  var btn = e.target.closest('[data-action]');
  var run = _dailyRun;
  if (!btn || !run) return;
  var action = btn.getAttribute('data-action');
  if (action === 'word') {
    var word = run.words[Number(btn.getAttribute('data-i'))];
    var out = document.getElementById('daily-ayah-meaning');
    if (word && out) out.textContent = word.meaning;
    return;
  }
  if (action === 'play') { playAudio(verseAudioUrl(run.surah, run.ayah)); return; }
  if (action === 'home') {
    if (typeof stopAudio === 'function') stopAudio();
    _dailyRun = null;
    switchView('dashboard');
    return;
  }
  if (action === 'next') {
    if (run.hintIndex + 1 < run.hints.length) run.hintIndex++;
    else run.step = 'ayah';
  } else if (action === 'understood' || action === 'translation') {
    finishDailyAyah(run, action === 'understood');
  }
  renderDailyAyah();
}
