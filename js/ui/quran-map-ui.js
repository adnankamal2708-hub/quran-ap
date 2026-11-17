// ═══════════════════════════════════════════════════════════════
// quran-map-ui.js — the Quran map in #view-quran-map
//
// Opened from the card at the top of the Quran tab and from Home's
// percentage. Loads the map data (js/quran/quran-map-data.min.js) on first
// use, shades the 604 pages by the mastered words (js/data-core/quran-map.js)
// and opens a page with its known words lit; tapping a word shows its
// meaning in the reader's word panel. If the data can't load, the screen
// says so and offers a retry.
// ═══════════════════════════════════════════════════════════════

var QURAN_MAP_URL = './js/quran/quran-map-data.min.js';
var _quranMapLoad = null;
var _quranMapPage = null;   // null: the map; a number: that page

/** The map data, loaded once; resolves null when it can't be loaded. */
function loadQuranMapData() {
  if (window.__QURAN_MAP) return Promise.resolve(window.__QURAN_MAP);
  if (_quranMapLoad) return _quranMapLoad;
  _quranMapLoad = new Promise(function (resolve) {
    var script = document.createElement('script');
    script.src = QURAN_MAP_URL;
    script.async = true;
    script.onload = function () { resolve(window.__QURAN_MAP || null); };
    script.onerror = function () { _quranMapLoad = null; resolve(null); };
    document.head.appendChild(script);
  });
  return _quranMapLoad;
}

function openQuranMap() {
  _quranMapPage = null;
  return switchView('quran-map');
}

function openQuranMapPage(page) {
  _quranMapPage = page;
  return switchView('quran-map');
}

/**
 * A verse's whitespace words, each with the reader's word it belongs to:
 * a meaning of 0 in verse.w joins a token to the word before it.
 */
function quranMapVerseWords(verse) {
  var words = [], tokens = [];
  String(verse.text).split(/\s+/).filter(Boolean).forEach(function (tok, i) {
    var m = verse.w ? verse.w[i] : '';
    if (m === 0 && words.length) words[words.length - 1].arabic += ' ' + tok;
    else words.push({ arabic: tok, meaning: m || '' });
    tokens.push({ text: tok, num: words.length });
  });
  return tokens.map(function (tok) {
    var word = words[tok.num - 1];
    return { text: tok.text, num: tok.num, arabic: word.arabic, meaning: word.meaning };
  });
}

function _quranMapKnown(map) {
  var words = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
  return quranMapKnownKeys(map, getMasteredWordIds(), words, _getCoverageKeyFn());
}

function _quranMapSurahName(surah) {
  var info = typeof getQuranSurahInfo === 'function' ? getQuranSurahInfo(surah) : null;
  return info ? info.transliteration : String(surah);
}

/** The page view's data, after loading the page's surahs. */
function _quranMapPageView(map, page, known) {
  var ayahs = quranMapPageAyahs(map, page, known);
  var surahs = ayahs.map(function (a) { return a.surah; }).filter(function (s, i, all) { return all.indexOf(s) === i; });
  return Promise.all(surahs.map(function (s) { return loadQuranSurah(s); })).then(function () {
    var stats = quranMapPageStats(map, known)[page - 1];
    return {
      page: page, juz: stats.juz, known: stats.known, total: stats.total,
      ayahs: ayahs.map(function (a) {
        var words = quranMapVerseWords(getQuranVerse(a.surah, a.ayah));
        var lined = words.length === a.known.length;
        return {
          surah: a.surah, ayah: a.ayah, surahName: _quranMapSurahName(a.surah),
          words: words.map(function (w, i) { return { text: w.text, known: lined && a.known[i] }; }),
        };
      }),
    };
  });
}

/** Render #view-quran-map: the map, or the open page. */
function renderQuranMap() {
  var view = document.getElementById('view-quran-map');
  if (!view) return Promise.resolve();
  view.onclick = _onQuranMapClick;
  view.innerHTML = quranMapLoadingMarkup();
  var page = _quranMapPage;
  return loadQuranMapData().then(function (map) {
    if (!map) { view.innerHTML = quranMapErrorMarkup(); return; }
    var known = _quranMapKnown(map);
    if (page === null) { view.innerHTML = quranMapGridMarkup(quranMapPageStats(map, known)); return; }
    return _quranMapPageView(map, page, known).then(function (pageView) {
      if (_quranMapPage === page) view.innerHTML = quranMapPageMarkup(pageView);
    });
  }).catch(function (err) {
    view.innerHTML = quranMapErrorMarkup();
    if (window.__diag) window.__diag.warn('QuranMap', 'render', String(err && err.message || err));
  }).then(function () {
    var title = document.getElementById('quran-map-title');
    if (title) title.focus();
  });
}

function _onQuranMapClick(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.getAttribute('data-action');
  if (action === 'quran') return switchView('quran');
  if (action === 'map' || action === 'retry') return action === 'map' ? openQuranMap() : renderQuranMap();
  if (action === 'page') return openQuranMapPage(Number(btn.getAttribute('data-page')));
  if (action === 'prev' || action === 'next') return openQuranMapPage(_quranMapPage + (action === 'next' ? 1 : -1));
  var surah = Number(btn.getAttribute('data-s'));
  if (action === 'reader') return openSurahForReading(surah);
  if (action === 'word') {
    var ayah = Number(btn.getAttribute('data-a'));
    var word = quranMapVerseWords(getQuranVerse(surah, ayah))[Number(btn.getAttribute('data-i'))];
    if (!word) return;
    showQuranWordPanel({
      verseKey: surah + ':' + ayah, wordNum: word.num, arabic: word.arabic,
      meaning: word.meaning, audioUrls: null, onOpenLesson: null,
    });
  }
}
