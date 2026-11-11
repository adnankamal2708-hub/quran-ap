/**
 * word-meanings.js — line up the word-by-word meanings with the app's text
 *
 * Reads data-sources/quran-wbw-en.json (see data-sources/README.md) and
 * gives each word of the app's own Quran text (js/quran/quran-data.js)
 * its meaning in that verse. Used by build.js, which attaches the result
 * to each verse as `w`, and by test/word-meanings.test.js.
 *
 * Every word must be matched with certainty; anything else is an error and
 * the build stops. A word is never given a guessed meaning.
 *
 * Result per verse: an array as long as the verse's words (split on
 * spaces). Each entry is the meaning, or 0 when the word continues the
 * word before it (the source counts the two as one word, e.g. بَعۡدَ مَا).
 * Also per verse, the app words the source counts as more than one
 * ({appIndex: sourceWords}, e.g. مَالِيَ = مَا + لِيَ), so a word's
 * quran.com number (for its recording) can be worked out.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var SOURCE_PATH = path.join(ROOT, 'data-sources', 'quran-wbw-en.json');
var SOURCE_SHA256 = '1aa128241580f830c948f6bb1a67e228a96417c911c1d273f78298055bf0342d';

// Places where the app's text and the source split a word in a way that
// spelling alone can't confirm. Key: "surah:verse:appWord" (1-based).
var WORD_SPLIT_EXCEPTIONS = {
  // The app spells the hamza of فَٱدَّٰرَٰٔتُمۡ differently from the source's
  // فَٱدَّٰرَٰءۡتُمۡ; it is the same word.
  '2:72:4': { appWords: 1, sourceWords: 1 },
};

function loadSource() {
  var raw = fs.readFileSync(SOURCE_PATH);
  var sum = crypto.createHash('sha256').update(raw).digest('hex');
  if (sum !== SOURCE_SHA256) {
    throw new Error('data-sources/quran-wbw-en.json has changed (sha256 ' + sum + '); check it and update SOURCE_SHA256');
  }
  return JSON.parse(raw.toString('utf8'));
}

function _flat(norm, s) { return norm(s).replace(/\s+/g, ''); }

function _joinMeanings(list) {
  var out = [];
  list.forEach(function (m) { if (out[out.length - 1] !== m) out.push(m); });
  return out.join(' ');
}

/**
 * Line up one verse. Returns {meanings} or {error}.
 * @param {string} key "surah:verse"
 * @param {string[]} appWords the app's words
 * @param {Array<[string,string]>} source [arabic, meaning] per source word
 * @param {function} norm OCCURRENCE_INDEX_NORM
 */
function alignVerse(key, appWords, source, norm, exceptions) {
  exceptions = exceptions || WORD_SPLIT_EXCEPTIONS;
  var meanings = [];
  var splits = {};
  var i = 0, j = 0;
  while (i < appWords.length && j < source.length) {
    var ex = exceptions[key + ':' + (i + 1)];
    var a = _flat(norm, appWords[i]);
    var s = _flat(norm, source[j][0]);
    var m = String(source[j][1] || '').trim();
    if (!m) return { error: key + ': source word ' + (j + 1) + ' has no meaning' };
    if (ex) {
      meanings.push(_joinMeanings(source.slice(j, j + ex.sourceWords).map(function (w) { return w[1].trim(); })));
      for (var c = 1; c < ex.appWords; c++) meanings.push(0);
      if (ex.appWords === 1 && ex.sourceWords > 1) splits[i] = ex.sourceWords;
      i += ex.appWords; j += ex.sourceWords;
    } else if (a && a === s) {
      meanings.push(m); i++; j++;
    } else if (j + 1 < source.length && a === s + _flat(norm, source[j + 1][0])) {
      // One app word is two source words (e.g. مَالِيَ = مَا + لِيَ)
      meanings.push(_joinMeanings([m, String(source[j + 1][1] || '').trim()]));
      splits[i] = 2; i++; j += 2;
    } else if (i + 1 < appWords.length && a + _flat(norm, appWords[i + 1]) === s) {
      // Two app words are one source word (e.g. بَعۡدَ مَا)
      meanings.push(m, 0); i += 2; j++;
    } else {
      return { error: key + ': word ' + (i + 1) + ' (' + appWords[i] + ') does not match source word ' + (j + 1) + ' (' + source[j][0] + ')' };
    }
  }
  if (i !== appWords.length || j !== source.length) {
    return { error: key + ': ' + appWords.length + ' words in the app, ' + source.length + ' in the source' };
  }
  return { meanings: meanings, splits: splits };
}

/**
 * Line up the whole Quran.
 * @returns {{bySurah: Object<number, Array<Array<string|0>>>, splitsBySurah: Object<number, Array<Object>>, errors: string[], words: number}}
 */
function alignWordMeanings(quranText, source, norm) {
  var bySurah = {}, splitsBySurah = {}, errors = [], words = 0;
  for (var sid = 1; sid <= 114; sid++) {
    var surah = quranText[sid];
    if (!surah) { errors.push('surah ' + sid + ' missing'); continue; }
    var splitsList = splitsBySurah[sid] = [];
    bySurah[sid] = surah.verses.map(function (v) {
      var key = sid + ':' + v.id;
      var appWords = v.text.split(/\s+/).filter(Boolean);
      words += appWords.length;
      if (!source[key]) { errors.push(key + ': not in the source'); splitsList.push(null); return null; }
      var r = alignVerse(key, appWords, source[key], norm);
      splitsList.push(r.splits && Object.keys(r.splits).length ? r.splits : null);
      if (r.error) { errors.push(r.error); return null; }
      return r.meanings;
    });
  }
  return { bySurah: bySurah, splitsBySurah: splitsBySurah, errors: errors, words: words };
}

module.exports = {
  loadSource: loadSource,
  alignVerse: alignVerse,
  alignWordMeanings: alignWordMeanings,
  WORD_SPLIT_EXCEPTIONS: WORD_SPLIT_EXCEPTIONS,
};
