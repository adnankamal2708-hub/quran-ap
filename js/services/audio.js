// ═══════════════════════════════════════════════════════════════
// audio.js — Playing recitation and Qaida recordings
//
// One shared <audio> element, so starting a sound stops the one before.
// Sources:
//   • Verses: Mahmoud Khalil Al-Husary's murattal from everyayah.com,
//     used under its stated terms (credit with a link back), shown under
//     every player by audioCreditHtml().
//   • Teaching: Al-Husary's slow Muallim recitation of a verse, same site.
//   • Words: quran.com's word-by-word recording of every Quran word
//     (audio.qurancdn.com), one clip per word, numbered as quran.com
//     numbers the words of a verse (quranWordPositions).
//   • Letters and marks: files listed in QAIDA_AUDIO_MANIFEST, served from
//     assets/audio/qaida/ (none yet).
// sw.js keeps both in a long-lived cache once played, so they work offline.
// ═══════════════════════════════════════════════════════════════

var AUDIO_VERSE_BASE = 'https://everyayah.com/data/Husary_128kbps/';
var AUDIO_TEACHING_BASE = 'https://everyayah.com/data/Husary_Muallim_128kbps/';
var AUDIO_QAIDA_BASE = 'assets/audio/qaida/';
var AUDIO_WORD_BASE = 'https://audio.qurancdn.com/wbw/';

// One element, reused: phones only let a page start sound after a tap, and
// a reused element keeps that permission, so a surah plays on verse after
// verse without another tap.
var _audioEl = null;
var _audioOnStop = null;
var _audioPlayId = 0; // which playAudio call is current

function _pad3(n) {
  return ('00' + n).slice(-3);
}

/** Al-Husary's recitation of one verse, e.g. 1:1 → .../001001.mp3 */
function verseAudioUrl(surah, ayah) {
  return AUDIO_VERSE_BASE + _pad3(surah) + _pad3(ayah) + '.mp3';
}

/** Al-Husary's slow teaching recitation of one verse, e.g. 1:1 → .../001001.mp3 */
function teachingVerseAudioUrl(surah, ayah) {
  return AUDIO_TEACHING_BASE + _pad3(surah) + _pad3(ayah) + '.mp3';
}

/** quran.com's recording of one word, e.g. 2:286 word 1 → .../002_286_001.mp3 */
function wordAudioUrl(surah, ayah, position) {
  return AUDIO_WORD_BASE + _pad3(surah) + '_' + _pad3(ayah) + '_' + _pad3(position) + '.mp3';
}

/**
 * quran.com's word numbers for each of the app's words in one verse.
 * The two texts split a few words differently: a word whose meaning is 0
 * continues the word before it (no number of its own), and `splits` lists
 * app words that quran.com counts as two (build.js, from
 * scripts/word-meanings.js).
 * @param {number} count - the app's words in the verse
 * @param {Array<string|0>|null} meanings - the verse's `w`
 * @param {Object<number, number>|null} splits - the verse's `ws`
 * @returns {number[][]} per app word, its quran.com word numbers
 */
function quranWordPositions(count, meanings, splits) {
  var out = [];
  var next = 1;
  for (var i = 0; i < count; i++) {
    var positions = [];
    if (!meanings || meanings[i] !== 0) {
      var n = (splits && splits[i]) || 1;
      for (var k = 0; k < n; k++) positions.push(next++);
    }
    out.push(positions);
  }
  return out;
}

/** The recording for a Qaida skill, or null while it has none. */
function qaidaAudioUrl(skillId) {
  var manifest = typeof QAIDA_AUDIO_MANIFEST !== 'undefined' ? QAIDA_AUDIO_MANIFEST : {};
  return manifest[skillId] ? AUDIO_QAIDA_BASE + manifest[skillId] : null;
}

/**
 * Play a sound, stopping any other. Resolves true once playing starts and
 * false when it can't (offline and not cached, or blocked by the browser).
 * @param {string} url
 * @param {Function} [onEnd] - called when the sound finishes
 * @param {Function} [onStop] - called if another sound or stopAudio() cuts it off
 * @returns {Promise<boolean>}
 */
function playAudio(url, onEnd, onStop) {
  stopAudio();
  if (!url || typeof Audio === 'undefined') return Promise.resolve(false);
  if (!_audioEl) _audioEl = new Audio();
  var el = _audioEl;
  el.src = url;
  el.onended = function () {
    _audioOnStop = null;
    if (onEnd) onEnd();
  };
  _audioOnStop = onStop || null;
  var id = ++_audioPlayId;
  return Promise.resolve(el.play()).then(function () { return true; }, function () {
    // Could not play (offline, not cached): it counts as stopped.
    if (id === _audioPlayId && _audioOnStop) { var stopped = _audioOnStop; _audioOnStop = null; stopped(); }
    return false;
  });
}

/**
 * Play several sounds one after another (a word quran.com splits in two,
 * or a run of verses). onEach(i) is called as sound i starts.
 * @param {string[]} urls
 * @param {{onEach?: Function, onEnd?: Function, onStop?: Function}} [opts]
 */
function playAudioQueue(urls, opts) {
  opts = opts || {};
  var list = (urls || []).filter(Boolean);
  function playAt(i) {
    if (i >= list.length) { if (opts.onEnd) opts.onEnd(); return; }
    if (opts.onEach) opts.onEach(i);
    playAudio(list[i], function () { playAt(i + 1); }, opts.onStop);
  }
  playAt(0);
}

function stopAudio() {
  if (!_audioEl) return;
  _audioEl.onended = null;
  _audioEl.pause();
  var onStop = _audioOnStop;
  _audioOnStop = null;
  if (onStop) onStop();
}

/**
 * Fetch sounds ahead so they play offline later (the service worker keeps
 * them). Failures are ignored: playing will simply try the network.
 * @param {string[]} urls
 */
function cacheAudio(urls) {
  if (typeof fetch !== 'function') return;
  (urls || []).forEach(function (url) {
    if (url) fetch(url, { mode: 'cors' }).catch(function () {});
  });
}

/** The credit line shown under every verse player. */
function audioCreditHtml() {
  return '<p class="audio-credit">' + escapeHtml(t('audio.credit.husary')) + ' · ' +
    '<a href="https://everyayah.com" target="_blank" rel="noopener">everyayah.com</a></p>';
}
