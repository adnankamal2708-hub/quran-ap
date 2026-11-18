// ═══════════════════════════════════════════════════════════════
// quran-follow-along.js — the word Al-Husary is saying lights up
//
// While a verse plays in the reader, each animation frame reads the audio's
// position and moves the `is-recited` class to the word being recited
// (timings: js/data-core/recitation-timing.js). quran-player.js starts it as
// each verse begins and stops it when the recitation ends.
//
// It never shows a wrong word: nothing is lit unless the audio playing is
// this very verse and the verse's words on screen match the timings, and
// nothing is lit while the sound is paused.
// ═══════════════════════════════════════════════════════════════

var RECITATION_TIMING_URL = './js/quran/recitation-timing.min.js';
var _recitationTimingLoad = null;

/** The word timings, loaded the first time they are asked for. */
function loadRecitationTiming() {
  if (window.__RECITATION_TIMING) return Promise.resolve(window.__RECITATION_TIMING);
  if (_recitationTimingLoad) return _recitationTimingLoad;
  _recitationTimingLoad = new Promise(function (resolve) {
    var script = document.createElement('script');
    script.src = RECITATION_TIMING_URL;
    script.async = true;
    script.onload = function () { resolve(window.__RECITATION_TIMING || null); };
    script.onerror = function () { _recitationTimingLoad = null; resolve(null); };
    document.head.appendChild(script);
  });
  return _recitationTimingLoad;
}

/** What is being followed: { surah, verse, url, frame, lit } or null. */
var _followAlong = null;

function _followAyahEl(f) {
  return document.getElementById('quran-ayah-' + f.surah + '-' + f.verse);
}

/** The words on screen, one per whitespace word of the verse text. */
function _followWordCount(ayahEl) {
  var spans = ayahEl.querySelectorAll('[data-n]');
  var text = [];
  for (var i = 0; i < spans.length; i++) text.push(spans[i].textContent);
  return text.join(' ').split(/\s+/).filter(Boolean).length;
}

/** The span showing word `index` (0-based); a merged span covers the words after its own. */
function _followSpan(ayahEl, index) {
  for (var n = index + 1; n >= 1; n--) {
    var span = ayahEl.querySelector('[data-n="' + n + '"]');
    if (span) return span;
  }
  return null;
}

function _followLight(span) {
  var f = _followAlong;
  if (!f || f.lit === span) return;
  if (f.lit && f.lit.classList) f.lit.classList.remove('is-recited');
  if (span) span.classList.add('is-recited');
  f.lit = span;
}

function _followFrame() {
  var f = _followAlong;
  if (!f) return;
  f.frame = requestAnimationFrame(_followFrame);
  var audio = typeof currentAudioElement === 'function' ? currentAudioElement() : null;
  var times = recitationWordTimes(window.__RECITATION_TIMING, f.surah, f.verse);
  var ayahEl = _followAyahEl(f);
  var playingThis = audio && !audio.paused && !audio.ended && audio.src === f.url;
  if (!times || !ayahEl || !playingThis) { _followLight(null); return; }
  if (f.words == null) f.words = _followWordCount(ayahEl);
  if (f.words !== times.starts.length) { _followLight(null); return; }
  var index = recitationWordAt(times, audio.currentTime * 1000 + RECITATION_LEAD_MS);
  _followLight(index < 0 ? null : _followSpan(ayahEl, index));
}

/** Clear the highlight and stop watching the audio. */
function stopFollowAlong() {
  var f = _followAlong;
  if (f && f.frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(f.frame);
  _followLight(null);
  _followAlong = null;
  var lit = document.querySelectorAll ? document.querySelectorAll('#quran-verses .is-recited') : [];
  for (var i = 0; i < lit.length; i++) lit[i].classList.remove('is-recited');
}

/** Follow one verse as it plays. Does nothing for a verse with no timings. */
function startFollowAlong(surah, verse) {
  stopFollowAlong();
  if (typeof requestAnimationFrame !== 'function') return;
  _followAlong = { surah: surah, verse: verse, url: verseAudioUrl(surah, verse), frame: null, lit: null, words: null };
  if (window.__RECITATION_TIMING && !recitationWordTimes(window.__RECITATION_TIMING, surah, verse)) {
    _followAlong = null;
    return;
  }
  _followAlong.frame = requestAnimationFrame(_followFrame);
}
