/**
 * load-vocabulary.js — load the real vocabulary word list for tests.
 *
 * Evaluates js/data-core/vocab-data.js (which declares ALL_WORDS) plus every
 * word file in js/data/, the same sources build.js bundles, then runs the
 * same id assignment + deduplication the app does (lesson-system.js) and
 * returns getCanonicalWords() — the list the app actually uses, with ids
 * and occurrences.
 *
 * Replaces a copied loader that prepended `var ALL_WORDS = []` to the legacy
 * js/data.js: that redeclared a const, the eval threw, the error was
 * swallowed, and the vocabulary-alignment tests silently ran with zero words.
 * This loader throws instead, so a broken load fails loudly.
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SKIP = { 'juz-data.js': true, 'surahs.js': true };

function loadVocabularyWords() {
  var dataDir = path.join(ROOT, 'js', 'data');
  var code = fs.readFileSync(path.join(ROOT, 'js', 'data-core', 'vocab-data.js'), 'utf8');
  fs.readdirSync(dataDir).sort().forEach(function (f) {
    if (f.endsWith('.js') && !SKIP[f]) code += '\n' + fs.readFileSync(path.join(dataDir, f), 'utf8');
  });
  // The word lists are consts inside the evaluated code; hand out the
  // canonical list explicitly
  code += '\n;assignWordIds(); globalThis.__loadVocabularyWords = getCanonicalWords();';
  (0, eval)(code);
  var words = globalThis.__loadVocabularyWords;
  delete globalThis.__loadVocabularyWords;
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('load-vocabulary: no words loaded');
  }
  return words;
}

module.exports = { loadVocabularyWords: loadVocabularyWords };
