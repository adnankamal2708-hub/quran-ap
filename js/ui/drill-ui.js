/**
 * drill-ui.js — runs one Practice drill ("Spot the word" or "Build the verse")
 * inside #rc-drill-host on the Practice tab.
 *
 * The question comes from js/exercises/word-drills.js and is drawn by the
 * shared exercise UI (renderExercise). The Quran text is fetched on demand
 * and never blocks the rest of Practice: the host shows a loading line first.
 * Practice drills do not touch SRS data.
 */

/** Juz Amma surahs fetched before the first question; the rest only if none of them fits */
var DRILL_FIRST_LOAD_SURAH_COUNT = 5;

/** Bumped on every start, so a slow load cannot overwrite a newer drill. */
var _drillRun = 0;

function _drillBuilder(kind) {
  if (kind === 'spot') return buildSpotDrill;
  if (kind === 'build') return buildVerseBuildDrill;
  return null;
}

function _drillShowMessage(host, key) {
  host.textContent = '';
  host.appendChild(exerciseEl('p', 'drill-message', t(key))).setAttribute('role', 'status');
}

/** Al-Fatihah plus a few random Juz Amma surahs, or every drill surah. */
function _drillSurahsToLoad(all) {
  if (all) return DRILL_SURAH_IDS;
  var juzAmma = DRILL_SURAH_IDS.slice(1)
    .map(function(id) { return { id: id, order: Math.random() }; })
    .sort(function(a, b) { return a.order - b.order; })
    .slice(0, DRILL_FIRST_LOAD_SURAH_COUNT)
    .map(function(entry) { return entry.id; });
  return [DRILL_SURAH_IDS[0]].concat(juzAmma);
}

/** Loads Quran text for the surahs; true when at least one arrived. */
async function _drillLoadText(surahIds) {
  var loader = window.__quranLoader;
  if (!loader) return false;
  try {
    await loader.load();
    var loaded = await loader.loadSurahs(surahIds);
    return loaded.some(Boolean);
  } catch (e) {
    return false;
  }
}

function _drillShowItem(host, kind, item) {
  host.textContent = '';
  if (kind === 'build') host.appendChild(exerciseEl('p', 'drill-hint', t('drill.build.prompt')));
  var body = exerciseEl('div', 'drill-body');
  host.appendChild(body);
  renderExercise(body, item, function() {
    var again = exerciseEl('button', 'btn drill-again', t('drill.again'));
    again.type = 'button';
    again.addEventListener('click', function() { startWordDrill(kind, host); });
    host.appendChild(again);
    again.focus();
  });
}

/** Starts a drill of the given kind ('spot' or 'build') in the host element. */
async function startWordDrill(kind, host) {
  var buildItem = _drillBuilder(kind);
  if (!host || !buildItem) return;
  var run = ++_drillRun;
  if (kind === 'spot' && !hasLearnedWords()) {
    _drillShowMessage(host, 'drill.needWords');
    return;
  }
  _drillShowMessage(host, 'drill.loading');

  var gotText = await _drillLoadText(_drillSurahsToLoad(false));
  var item = gotText ? buildItem() : null;
  if (!item && gotText && kind === 'spot') {
    gotText = await _drillLoadText(_drillSurahsToLoad(true));
    item = buildItem();
  }
  if (run !== _drillRun) return;

  if (item) _drillShowItem(host, kind, item);
  else _drillShowMessage(host, gotText && kind === 'spot' ? 'drill.noMatch' : 'drill.unavailable');
}
