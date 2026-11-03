// ═══════════════════════════════════════════════════════════════
// audio.js — Playing recitation and Qaida recordings
//
// One shared <audio> element, so starting a sound stops the one before.
// Sources:
//   • Verses: Mahmoud Khalil Al-Husary's murattal from everyayah.com,
//     used under its stated terms (credit with a link back), shown under
//     every player by audioCreditHtml().
//   • Letters and marks: files listed in QAIDA_AUDIO_MANIFEST, served from
//     assets/audio/qaida/ (none yet).
// sw.js keeps both in a long-lived cache once played, so they work offline.
// ═══════════════════════════════════════════════════════════════

var AUDIO_VERSE_BASE = 'https://everyayah.com/data/Husary_128kbps/';
var AUDIO_QAIDA_BASE = 'assets/audio/qaida/';

var _audioEl = null;

function _pad3(n) {
  return ('00' + n).slice(-3);
}

/** Al-Husary's recitation of one verse, e.g. 1:1 → .../001001.mp3 */
function verseAudioUrl(surah, ayah) {
  return AUDIO_VERSE_BASE + _pad3(surah) + _pad3(ayah) + '.mp3';
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
 * @returns {Promise<boolean>}
 */
function playAudio(url, onEnd) {
  stopAudio();
  if (!url || typeof Audio === 'undefined') return Promise.resolve(false);
  _audioEl = new Audio(url);
  if (onEnd) _audioEl.addEventListener('ended', onEnd);
  return Promise.resolve(_audioEl.play()).then(function () { return true; }, function () { return false; });
}

function stopAudio() {
  if (!_audioEl) return;
  _audioEl.pause();
  _audioEl = null;
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
