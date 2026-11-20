// ═══════════════════════════════════════════════════════════════
// share-progress.js — what the shareable progress card says
//
// The card shows the share of the Quran's words the learner understands
// and, when there is one, a short ayah whose every word they know. It
// leaves out the streak, word counts and the learner's name on purpose:
// it is about the Quran, not a score to compare.
//
// A word is known as Today's ayah counts it (describeDailyAyah in
// daily-ayah.js: its lesson word mastered, SRS stage 2+), against the same
// ayah index (js/quran/ayah-readability.js). js/ui/share-card.js draws it.
// ═══════════════════════════════════════════════════════════════

var SHARE_AYAH_MAX_WORDS = 10; // longer ayahs don't fit the card at a readable size

function _shareRefOrder(a, b) {
  var x = a.split(':').map(Number), y = b.split(':').map(Number);
  return (x[0] - y[0]) || (x[1] - y[1]);
}

/**
 * The ayah to show: every word known and short enough for the card,
 * preferring the one with the most recently mastered word, then the
 * earlier ayah in the Quran. Null when none. Pure.
 *   index  { "s:a": entries } from ayah-readability.js
 *   srs    SRS entries by word id ({ stage, ratedAt })
 */
function pickShareAyah(index, srs) {
  var best = null;
  Object.keys(index).forEach(function (ref) {
    var entries = index[ref];
    if (entries.length > SHARE_AYAH_MAX_WORDS) return;
    var a = describeDailyAyah(ref, entries, srs);
    if (a.hints.length) return;
    if (!best || a.newest > best.newest || (a.newest === best.newest && _shareRefOrder(ref, best.ref) < 0)) best = a;
  });
  return best ? best.ref : null;
}

/** "12.4%": one decimal place, none when it is whole. */
function _sharePercentText(percent) {
  return String(Math.round(percent * 10) / 10) + '%';
}

/** There is something to share once any of the Quran's words are understood. */
function canShareProgress(percent) {
  return typeof percent === 'number' && percent > 0;
}

/**
 * Everything written on the card.
 *   percent    share of the Quran's words understood (0..100)
 *   ayah       { ref, verse: { text, translation } } or null
 *   surahName  the ayah's surah, e.g. "Al-Fatihah"
 */
function shareCardContent(percent, ayah, surahName) {
  return {
    percent: _sharePercentText(percent),
    claim: t('share.claim'),
    footer: t('share.footer'),
    ayah: ayah ? {
      intro: t('share.ayahIntro'),
      arabic: ayah.verse.text,
      translation: ayah.verse.translation,
      source: t('share.source', { surah: surahName, ref: ayah.ref }),
    } : null,
  };
}

/** The text sent with the card. */
function shareProgressMessage(percent, url) {
  return t('share.message', { p: _sharePercentText(percent), url: url });
}
