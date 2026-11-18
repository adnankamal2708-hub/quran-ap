// recitation-timing.js — which word Al-Husary is saying at a given moment
// (pure; no DOM). The data (js/quran/recitation-timing.js,
// window.__RECITATION_TIMING) holds, per ayah, each word's start as a base-36
// delta in 10 ms units, '' for a word with no trustworthy time, then ';' and
// the ayah's end. See docs/superpowers/specs/2026-11-18-follow-along-design.md.

/** Added to the audio's time before the lookup; 0 unless measured otherwise. */
var RECITATION_LEAD_MS = 0;

var _recitationCache = { timing: null, ayahs: {} };

/**
 * One ayah's word times in ms: { starts: [ms or null per word], end: ms },
 * or null when the ayah has no timings.
 */
function recitationWordTimes(timing, surah, ayah) {
  var entry = timing && timing.ayahs && timing.ayahs[surah - 1] && timing.ayahs[surah - 1][ayah - 1];
  if (!entry) return null;
  if (_recitationCache.timing !== timing) _recitationCache = { timing: timing, ayahs: {} };
  var key = surah + ':' + ayah;
  if (!_recitationCache.ayahs[key]) {
    var unit = timing.unit, parts = entry.split(';'), at = 0;
    var starts = parts[0].split(',').map(function (d) {
      if (d === '') return null;
      at += parseInt(d, 36) * unit;
      return at;
    });
    _recitationCache.ayahs[key] = { starts: starts, end: at + parseInt(parts[1], 36) * unit };
  }
  return _recitationCache.ayahs[key];
}

/**
 * The 0-based word being recited at ms: the last timed word that has started.
 * -1 before the first word and from the ayah's end on.
 */
function recitationWordAt(times, ms) {
  if (!times || ms >= times.end) return -1;
  var found = -1;
  for (var i = 0; i < times.starts.length; i++) {
    var start = times.starts[i];
    if (start === null) continue;
    if (start > ms) break;
    found = i;
  }
  return found;
}
