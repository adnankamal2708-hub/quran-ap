// ═══════════════════════════════════════════════════════════════
// quran-map-markup.js — markup for the Quran map (pure, no DOM)
//
// The map (604 squares in 30 juz rows) and one page's Arabic with known
// words lit. quran-map-ui.js decides which to draw and handles the clicks
// (every button carries a data-action).
// ═══════════════════════════════════════════════════════════════

function _qmEsc(text) {
  return escapeHtml(String(text == null ? '' : text));
}

function _qmHeader(backAction, backLabel, title, sub) {
  return '<button class="root-back" type="button" data-action="' + backAction + '">' +
    uiIcon('chevron-left', true) + _qmEsc(backLabel) + '</button>' +
    '<h2 class="qmap-title" id="quran-map-title" tabindex="-1">' + _qmEsc(title) + '</h2>' +
    '<p class="qmap-sub">' + _qmEsc(sub) + '</p>';
}

/** The small button beside the Quran tab's surah search that opens the map. */
function quranMapButtonMarkup() {
  return '<button class="qmap-open" type="button" id="quran-map-btn" aria-label="' + _qmEsc(t('quranMap.title')) + '">' +
    uiIcon('layers', true) + _qmEsc(t('quranMap.button')) + '</button>';
}

/** The map: stats from quranMapPageStats(). */
function quranMapGridMarkup(stats) {
  var h = _qmHeader('quran', t('quranMap.back'), t('quranMap.title'), t('quranMap.sub'));
  h += '<div class="qmap-legend" aria-hidden="true"><span>' + _qmEsc(t('quranMap.legendLow')) + '</span>';
  for (var s = 0; s <= QURAN_MAP_SHADES; s++) h += '<span class="qmap-swatch s' + s + '"></span>';
  h += '<span>' + _qmEsc(t('quranMap.legendHigh')) + '</span></div>';
  var juz = 0;
  stats.forEach(function (p) {
    if (p.juz !== juz) {
      if (juz) h += '</div></div>';
      juz = p.juz;
      var label = t('quranMap.juz', { n: juz });
      h += '<div class="qmap-juz"><span class="qmap-juz-num" aria-hidden="true">' + juz + '</span>' +
        '<div class="qmap-pages" role="group" aria-label="' + _qmEsc(label) + '">';
    }
    var pct = p.total ? Math.round(p.known / p.total * 100) : 0;
    h += '<button class="qmap-page s' + quranMapShade(p.known, p.total) + '" type="button" data-action="page" data-page="' + p.page + '" ' +
      'aria-label="' + _qmEsc(t('quranMap.pageLabel', { page: p.page, juz: p.juz, p: pct })) + '"></button>';
  });
  if (juz) h += '</div></div>';
  return h;
}

/**
 * One page. view: { page, juz, known, total, ayahs: [{ surah, ayah, surahName,
 * words: [{ text, known }] }] } — one word per whitespace token.
 */
function quranMapPageMarkup(view) {
  var h = _qmHeader('map', t('quranMap.backToMap'), t('quranMap.page', { page: view.page }),
    t('quranMap.pageSub', { juz: view.juz, n: view.known, total: view.total }));
  h += '<p class="qmap-hint">' + _qmEsc(t('quranMap.tapHint')) + '</p>';
  h += '<div class="qmap-text" lang="ar" dir="rtl">';
  view.ayahs.forEach(function (a) {
    if (a.ayah === 1) h += '<p class="qmap-surah" lang="en" dir="ltr">' + _qmEsc(a.surahName) + '</p>';
    h += '<span class="qmap-ayah">';
    a.words.forEach(function (w, i) {
      h += '<button class="qmap-tok' + (w.known ? ' is-known' : '') + '" type="button" data-action="word" ' +
        'data-s="' + a.surah + '" data-a="' + a.ayah + '" data-i="' + i + '">' + _qmEsc(w.text) + '</button> ';
    });
    h += '<span class="qmap-ayah-num">﴿' + a.ayah + '﴾</span></span> ';
  });
  h += '</div><div class="qmap-nav">';
  if (view.page > 1) h += '<button class="btn btn-outline" type="button" data-action="prev">' + _qmEsc(t('quranMap.prev')) + '</button>';
  if (view.page < QURAN_MAP_PAGES) h += '<button class="btn btn-outline" type="button" data-action="next">' + _qmEsc(t('quranMap.next')) + '</button>';
  var first = view.ayahs[0];
  h += '<button class="btn" type="button" data-action="reader" data-s="' + first.surah + '">' +
    _qmEsc(t('quranMap.reader', { surah: first.surahName })) + '</button></div>';
  return h;
}

function quranMapLoadingMarkup() {
  return '<p class="qmap-sub" id="quran-map-title" tabindex="-1">' + _qmEsc(t('quranMap.loading')) + '</p>';
}

function quranMapErrorMarkup() {
  return _qmHeader('quran', t('quranMap.back'), t('quranMap.title'), t('quranMap.loadFailed')) +
    '<button class="btn" type="button" data-action="retry">' + _qmEsc(t('quranMap.retry')) + '</button>';
}
