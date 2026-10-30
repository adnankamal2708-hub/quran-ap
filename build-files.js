/**
 * build-files.js — the ordered source file lists for the two bundles.
 *
 * Single source of truth shared by build.js (which concatenates them),
 * test/dry-load.js (which executes them) and test/comment-lint.js (which
 * scans them). These used to be three hand-copied lists that drifted: the
 * test copies still pointed at the removed js/data.js and js/ui.js
 * monoliths, so they checked dead code instead of what ships.
 *
 * getBuildFiles() returns fresh arrays each call (build.js appends to
 * DATA_FILES).
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Core data engine modules — first, because they define ALL_WORDS,
// CANONICAL_WORDS, etc. that the word files push into.
const DATA_CORE_FILES = [
  'js/data-core/vocab-data.js',
  'js/data-core/surah-org.js',
  'js/data-core/foundation.js',
  'js/data-core/lesson-system.js',
  'js/data-core/progress-aggregator.js',
  'js/data-core/adaptive.js',
  'js/data-core/quiz-history.js',
  'js/data-core/surah-progress.js',
  'js/data-core/tracks.js',
];

// UI modules in dependency order
const UI_FILES = [
  'js/ui/dom-helpers.js',
  'js/ui/components.js',
  'js/ui/word-card.js',
  'js/ui/stats-ui.js',
  'js/ui/quiz-ui.js',
  'js/ui/explorer.js',
  'js/ui/analytics-ui.js',
  'js/ui/dashboard.js',
  'js/quran/quran-loader.js',
  'js/ui/quran.js',
  'js/ui/learn-screen.js',
  'js/ui/theme.js',
];

// firebase-core.js is NOT in the bundle — it is loaded as a separate ES
// module (<script type="module">) so its CDN imports work.
const APP_FILES = [
  'js/services/config.js',
  'js/services/auth-service.js',
  'js/services/sync-service.js',
  'js/services/user-service.js',
  'js/services/feedback.js',
  'js/services/premium.js',
  'js/vocabulary.js',
  'js/srs.js',
].concat(UI_FILES).concat([
  'js/quiz.js',
  'js/auth-ui.js',
  'js/profile-ui.js',
  'js/diagnostics.js',
  'js/validation.js',
  'js/analytics.js',
  'js/adaptive-engine.js',
  'js/smart-learning-engine.js',
  // NOTE: ux-polish.js MUST stay in the bundle, positioned before app.js:
  // app.js calls init() at top-level and requires window.__ux to already be
  // defined. It must NOT also be loaded as a separate <script> tag — that
  // used to execute it twice (and the standalone copy was the only one
  // missing when the bundle ran).
  'js/ux-polish.js',
  'js/learner-profile-bridge.js',
  'js/learning-journey.js',
  'js/phase2-surahs.js',
  'js/phase2.js',
  'js/recommendation-slot.js',
  'js/ui/navigation.js',
  'js/ui/review.js',
  'js/ui/review-center.js',
  'js/ui/keyboard.js',
  'js/app.js',
]);

/**
 * Data bundle order:
 *   1. js/data-core/ modules
 *   2. js/data/surahs.js (surah metadata)
 *   3. Other js/data/ files (thematic word files etc.), alphabetical
 *   4. Per-surah word files (words-surah-NN-name.js) by surah number
 *
 * This stable ordering keeps ALL_WORDS indices (and thus w_N IDs)
 * consistent across builds when no files are added. Word files are
 * auto-discovered — adding words-surah-NN-name.js needs no edit here.
 */
function discoverDataFiles() {
  var dataDir = path.join(ROOT, 'js', 'data');
  var surahMeta = [];
  var thematic = [];
  var perSurah = [];

  fs.readdirSync(dataDir).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
    var rel = 'js/data/' + f;
    if (f === 'surahs.js') surahMeta.push(rel);
    else if (/^words-surah-\d+-/.test(f)) perSurah.push(rel);
    else thematic.push(rel);
  });

  perSurah.sort(function (a, b) {
    return parseInt(a.match(/words-surah-(\d+)/)[1], 10) - parseInt(b.match(/words-surah-(\d+)/)[1], 10);
  });
  thematic.sort();

  return DATA_CORE_FILES.concat(surahMeta, thematic, perSurah);
}

function getBuildFiles() {
  return {
    DATA_FILES: discoverDataFiles(),
    UI_FILES: UI_FILES.slice(),
    APP_FILES: APP_FILES.slice(),
  };
}

module.exports = { getBuildFiles: getBuildFiles };
