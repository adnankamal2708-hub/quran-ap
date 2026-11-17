// quran-map.js — the logic behind the Quran map (pure; reads, never writes).
// The map data (js/quran/quran-map-data.js, window.__QURAN_MAP) gives the
// Madinah page and juz starts and, per ayah, each word's occurrence-index key.
// A word is known exactly when it counts toward "% of the Quran": its key
// belongs to a mastered lesson word. See docs/superpowers/specs/2026-11-17-quran-map-design.md.

var QURAN_MAP_PAGES = 604;
var QURAN_MAP_SHADES = 4;

/** Key indexes of the mastered words, as { index: true }. */
function quranMapKnownKeys(map, mastered, words, keyFn) {
  var indexOf = {};
  map.keys.forEach(function (key, i) { indexOf[key] = i; });
  var known = {};
  (words || []).forEach(function (w) {
    if (!w || !mastered[w.id] || !w.arabic) return;
    var i = indexOf[keyFn(w.arabic)];
    if (i !== undefined) known[i] = true;
  });
  return known;
}

/** One ayah's words as key indexes, -1 for a word that is no lesson word. */
function _quranMapAyahKeys(map, surah, ayah) {
  return String(map.ayahs[surah - 1][ayah - 1]).split(',')
    .map(function (x) { return x === '' ? -1 : parseInt(x, 36); });
}

function _quranMapBefore(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** The [surah, ayah] refs on a page, in reading order. */
function _quranMapPageRefs(map, page) {
  var refs = [], end = map.pages[page];
  var s = map.pages[page - 1][0], a = map.pages[page - 1][1];
  while (_quranMapBefore([s, a], end)) {
    refs.push([s, a]);
    if (a < map.ayahs[s - 1].length) a++;
    else { s++; a = 1; }
  }
  return refs;
}

function _quranMapJuz(map, page) {
  var start = map.pages[page - 1], juz = 1;
  while (juz < map.juz.length - 1 && !_quranMapBefore(start, map.juz[juz])) juz++;
  return juz;
}

/** Every page as { page, juz, known, total } (word counts). */
function quranMapPageStats(map, known) {
  var stats = [];
  for (var page = 1; page <= QURAN_MAP_PAGES; page++) {
    var k = 0, total = 0;
    _quranMapPageRefs(map, page).forEach(function (ref) {
      _quranMapAyahKeys(map, ref[0], ref[1]).forEach(function (i) {
        total++;
        if (i >= 0 && known[i]) k++;
      });
    });
    stats.push({ page: page, juz: _quranMapJuz(map, page), known: k, total: total });
  }
  return stats;
}

/** Shade step 0..4: equal 20% bands of the share known; 0 for an empty page. */
function quranMapShade(known, total) {
  if (!total) return 0;
  return Math.min(QURAN_MAP_SHADES, Math.floor(known / total * 5));
}

/** A page's ayahs as { surah, ayah, known: [bool per word] }. */
function quranMapPageAyahs(map, page, known) {
  return _quranMapPageRefs(map, page).map(function (ref) {
    return {
      surah: ref[0],
      ayah: ref[1],
      known: _quranMapAyahKeys(map, ref[0], ref[1]).map(function (i) { return i >= 0 && !!known[i]; }),
    };
  });
}
