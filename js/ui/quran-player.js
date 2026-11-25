// ═══════════════════════════════════════════════════════════════
// quran-player.js — Al-Husary's recitation in the Quran reader
//
// Two ways to listen: "Listen" in the reader's top bar plays the whole
// surah from the first verse (after the basmala, except for Al-Fatihah,
// where it is verse 1, and At-Tawbah, which has none), and the play
// button on a verse plays that verse alone. Tapping a verse (not a word)
// plays the surah on from it. Speed and Repeat
// (js/ui/quran-player-options.js) apply to both. The verse being recited is
// highlighted and, for the whole surah, kept in view; within it, the word
// being recited lights up (js/ui/quran-follow-along.js).
//
// Sound comes from js/services/audio.js (verseAudioUrl, playAudio);
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
  stopFollowAlong();
  syncQuranPlayer();
}

/**
 * What to play after a verse ends: the same verse again until it has been
 * recited `repeat` times, then the next one. Repeat is read as each verse
 * ends, so a change applies at once.
 * @param {number[]} verses
 * @param {number} index - the verse that just ended
 * @param {number} played - how many times it has now been recited
 * @param {number} repeat
 * @returns {{index: number, played: number}|null} null when done
 */
function quranNextPlay(verses, index, played, repeat) {
  if (played < repeat) return { index: index, played: played + 1 };
  if (index + 1 < verses.length) return { index: index + 1, played: 1 };
  return null;
}

/**
 * Play verses of the open surah in order, each as many times as Repeat says.
 * @param {number[]} verses
 * @param {'surah'|'verse'} mode
 */
function _quranRecite(verses, mode) {
  var surah = typeof _quranSurahId !== 'undefined' ? _quranSurahId : null;
  if (!surah || !verses.length) return;
  // The basmala is recited only before a surah's first verse.
  var withBasmala = mode === 'surah' && verses[0] === 1 && QURAN_NO_BASMALA.indexOf(surah) < 0;
  stopAudio();
  loadRecitationTiming(surah); // word timings for the highlight; playback never waits for them
  var rec = { surah: surah, mode: mode, verse: null };
  _quranRecitation = rec;
  syncQuranPlayer();
  var ended = function () { _quranRecitationEnded(rec); };

  function playVerse(index, played) {
    if (_quranRecitation !== rec) return;
    var verse = verses[index];
    _quranReciting(verse, mode === 'surah' && played === 1);
    startFollowAlong(surah, verse);
    playAudio(verseAudioUrl(surah, verse), function () {
      var next = quranNextPlay(verses, index, played, quranPlayerOptions().repeat);
      if (next) playVerse(next.index, next.played); else ended();
    }, ended, quranPlayerOptions().rate);
    // Fetch the next verse while this one plays, so it starts without a wait.
    if (index + 1 < verses.length) cacheAudio([verseAudioUrl(surah, verses[index + 1])]);
  }

  if (!withBasmala) { playVerse(0, 1); return; }
  // The basmala clip has no words on the page: nothing is highlighted.
  playAudio(verseAudioUrl(QURAN_BASMALA_SURAH, 1), function () { playVerse(0, 1); }, ended, quranPlayerOptions().rate);
  cacheAudio([verseAudioUrl(surah, verses[0])]);
}

/** "Listen": play the whole surah, or stop it if it is playing. */
function toggleSurahRecitation() {
  if (_quranRecitation && _quranRecitation.mode === 'surah') { stopQuranRecitation(); return; }
  _quranRecite(_quranVerseNumbers(), 'surah');
}

/** A tap on a verse: play the surah on from that verse (a jump if it is playing). */
function reciteSurahFrom(verse) {
  _quranRecite(_quranVerseNumbers().filter(function (n) { return n >= verse; }), 'surah');
}

/** A verse's play button: play that verse, or stop it if it is playing. */
function toggleVerseRecitation(verse) {
  if (_quranRecitation && _quranRecitation.verse === verse) { stopQuranRecitation(); return; }
  _quranRecite([verse], 'verse');
}

function stopQuranRecitation() {
  if (!_quranRecitation) return;
  _quranRecitation = null;
  stopFollowAlong();
  stopAudio();
  syncQuranPlayer();
}
