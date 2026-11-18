// recitation-timing.js — which word Al-Husary is saying at a given moment
// (pure; no DOM). The data (js/quran/recitation-timing.js,
// window.__RECITATION_TIMING) holds, per ayah, each word's start as a base-36
// delta in 10 ms units ('.' and the word's length when a pause follows it),
// '' for a word with no trustworthy time, then ';' and the ayah's end. See docs/superpowers/specs/2026-11-18-follow-along-design.md.

/** Added to the audio's time before the lookup; 0 unless measured otherwise. */
var RECITATION_LEAD_MS = 0;

var _recitationCache = { timing: null, ayahs: {} };

/**
 * One ayah's word times in ms: { starts: [ms or null per word], stops: [ms
 * where a word ends before a pause, else null], end: ms }, or null when the
 * ayah has no timings.
 */
function recitationWordTimes(timing, surah, ayah) {
  var entry = timing && timing.ayahs && timing.ayahs[surah - 1] && timing.ayahs[surah - 1][ayah - 1];
  if (!entry) return null;
  if (_recitationCache.timing !== timing) _recitationCache = { timing: timing, ayahs: {} };
  var key = surah + ':' + ayah;
  if (!_recitationCache.ayahs[key]) {
    var unit = timing.unit, parts = entry.split(';'), at = 0, starts = [], stops = [];
    parts[0].split(',').forEach(function (field) {
      var d = field.split('.');
      if (d[0] === '') { starts.push(null); stops.push(null); return; }
      at += parseInt(d[0], 36) * unit;
      starts.push(at);
      stops.push(d.length > 1 ? at + parseInt(d[1], 36) * unit : null);
    });
    _recitationCache.ayahs[key] = { starts: starts, stops: stops, end: at + parseInt(parts[1], 36) * unit };
  }
  return _recitationCache.ayahs[key];
}

/**
 * The 0-based word being recited at ms: the last timed word that has started.
 * -1 before the first word, during a pause after a word, and from the ayah's end on.
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
  if (found >= 0 && times.stops[found] !== null && ms >= times.stops[found]) return -1;
  return found;
}
