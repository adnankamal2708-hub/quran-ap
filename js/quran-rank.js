/**
 * quran-rank.js — a word's place among the lesson words by how often it
 * occurs in the Quran.
 *
 * The rank uses getQuranCount (the count shown on the card), so "#N most
 * frequent" always agrees with "Appears N times". frequencyRank is a
 * different thing: it orders lessons and the free vocabulary by the
 * stored occ figure, and is left alone.
 */

var QURAN_RANK_TOP_SHOWN = 50; // "top X%" is shown only for the top half

var _quranRankCounts = null;

/** Every ranked word's Quran count, highest first (built once). */
function _getRankedCounts() {
  if (_quranRankCounts) return _quranRankCounts;
  var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
    ? getCanonicalWords() : (typeof ALL_WORDS !== 'undefined' ? ALL_WORDS : []);
  _quranRankCounts = [];
  for (var i = 0; i < words.length; i++) {
    var c = getQuranCount(words[i]);
    if (c > 0) _quranRankCounts.push(c);
  }
  _quranRankCounts.sort(function (a, b) { return b - a; });
  return _quranRankCounts;
}

/**
 * The word's rank by Quran count: { rank, total, topPercent } or null.
 * Words with the same count share a rank. topPercent is null outside the
 * top half, where "top 80%" would read oddly.
 */
function getQuranRank(w) {
  var count = getQuranCount(w);
  if (!count || count <= 0) return null;
  var counts = _getRankedCounts();
  var higher = 0;
  while (higher < counts.length && counts[higher] > count) higher++;
  var rank = higher + 1;
  var pct = Math.max(0.1, Math.round(rank / counts.length * 1000) / 10);
  return { rank: rank, total: counts.length, topPercent: pct <= QURAN_RANK_TOP_SHOWN ? pct : null };
}
