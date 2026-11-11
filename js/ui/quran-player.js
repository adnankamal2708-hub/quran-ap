// ═══════════════════════════════════════════════════════════════
// quran-player.js — Al-Husary's recitation in the Quran reader
//
// Two ways to listen: "Listen" in the reader's top bar plays the whole
// surah from the first verse (after the basmala, except for Al-Fatihah,
// where it is verse 1, and At-Tawbah, which has none), and the play
// button on a verse plays that verse alone. The verse being recited is
// highlighted and, for the whole surah, kept in view.
//
// Sound comes from js/services/audio.js (verseAudioUrl, playAudioQueue);
// starting any other sound, such as a word's recording, stops the
// recitation. The reader (js/ui/quran.js) calls syncQuranPlayer() after
// it redraws the verses and stopQuranRecitation() when it leaves a surah.
// ═══════════════════════════════════════════════════════════════

/** The recitation in progress, or null: { surah, mode: 'surah'|'verse', verse } */
var _quranRecitation = null;

var QURAN_BASMALA_SURAH = 1; // the basmala is recited from Al-Fatihah 1:1
var QURAN_NO_BASMALA = [1, 9]; // Al-Fatihah (its own verse 1), At-Tawbah

function _quranVerseNumbers() {
  return (typeof _quranVerseKeys !== 'undefined' ? _quranVerseKeys : []).map(function (key) {
    return parseInt(key.split(':')[1], 10);
  }).filter(function (n) { return n > 0; });
}

function _quranAyahEl(verse) {
  if (!_quranRecitation) return null;
  return document.getElementById('quran-ayah-' + _quranRecitation.surah + '-' + verse);
}

function _quranPlayIcon(playing) {
  if (playing) return '<svg class="ui-icon ui-icon-only" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
  return uiIcon('play', true);
}

/** Draw the buttons and highlight to match what is playing. */
function syncQuranPlayer() {
  var rec = _quranRecitation;
  var listen = document.getElementById('reader-listen');
  if (listen) {
    var whole = !!rec && rec.mode === 'surah';
    listen.setAttribute('aria-pressed', whole ? 'true' : 'false');
    listen.textContent = t(whole ? 'reader.stop' : 'reader.listen');
  }
  var buttons = document.querySelectorAll('#quran-verses .quran-ayah-play');
  for (var i = 0; i < buttons.length; i++) {
    var verse = parseInt(buttons[i].getAttribute('data-verse'), 10);
    var playing = !!rec && rec.verse === verse;
    buttons[i].innerHTML = _quranPlayIcon(playing);
    buttons[i].setAttribute('aria-label', t(playing ? 'reader.stopVerse' : 'reader.playVerse', { n: verse }));
    var ayah = buttons[i].closest('.quran-ayah');
    if (ayah) ayah.classList.toggle('is-reciting', playing);
  }
}

function _quranReciting(verse, follow) {
  if (!_quranRecitation) return;
  _quranRecitation.verse = verse;
  syncQuranPlayer();
  var el = follow ? _quranAyahEl(verse) : null;
  if (el && el.scrollIntoView) {
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
  }
}

function _quranRecitationEnded(rec) {
  if (_quranRecitation !== rec) return; // a newer recitation took over
  _quranRecitation = null;
  syncQuranPlayer();
}

/**
 * Play verses of the open surah in order.
 * @param {number[]} verses
 * @param {'surah'|'verse'} mode
 */
function _quranRecite(verses, mode) {
  var surah = typeof _quranSurahId !== 'undefined' ? _quranSurahId : null;
  if (!surah || !verses.length) return;
  var urls = verses.map(function (v) { return verseAudioUrl(surah, v); });
  var withBasmala = mode === 'surah' && QURAN_NO_BASMALA.indexOf(surah) < 0;
  if (withBasmala) urls.unshift(verseAudioUrl(QURAN_BASMALA_SURAH, 1));
  stopAudio();
  var rec = { surah: surah, mode: mode, verse: null };
  _quranRecitation = rec;
  syncQuranPlayer();
  playAudioQueue(urls, {
    onEach: function (i) {
      var at = withBasmala ? i - 1 : i;
      if (_quranRecitation === rec && at >= 0) _quranReciting(verses[at], mode === 'surah');
    },
    onEnd: function () { _quranRecitationEnded(rec); },
    onStop: function () { _quranRecitationEnded(rec); },
  });
}

/** "Listen": play the whole surah, or stop it if it is playing. */
function toggleSurahRecitation() {
  if (_quranRecitation && _quranRecitation.mode === 'surah') { stopQuranRecitation(); return; }
  _quranRecite(_quranVerseNumbers(), 'surah');
}

/** A verse's play button: play that verse, or stop it if it is playing. */
function toggleVerseRecitation(verse) {
  if (_quranRecitation && _quranRecitation.verse === verse) { stopQuranRecitation(); return; }
  _quranRecite([verse], 'verse');
}

function stopQuranRecitation() {
  if (!_quranRecitation) return;
  _quranRecitation = null;
  stopAudio();
  syncQuranPlayer();
}
