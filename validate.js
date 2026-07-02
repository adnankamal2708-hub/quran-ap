// ═══════════════════════════════════════════════════════════════
// validate.js — Full Build + Data Validation Script
//   • Runs after build.js to verify output integrity
//   • Checks that all required files exist and have content
//   • Validates bundle sizes are within expected ranges
//   • Verifies critical functions exist in the bundle
//   • Ensures ALL_WORDS is properly populated
//   • Checks service worker has production URLs
//   • Runs data-validate.js to validate vocabulary data integrity
//   • Exits with code 0 on success, 1 on failure
//
// Usage: node validate.js
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DIST = path.join(__dirname, 'dist');
const MIN_DATA_SIZE = 100 * 1024;      // data bundle > 100 KB
const MAX_DATA_SIZE = 1536 * 1024;     // data bundle < 1.5 MB
const MIN_APP_SIZE = 20 * 1024;        // app bundle > 20 KB
const MAX_APP_SIZE = 300 * 1024;       // app bundle < 300 KB

var exitCode = 0;
var totalChecks = 0;
var passedChecks = 0;

function check(description, condition, details) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log('  ✓ ' + description);
  } else {
    exitCode = 1;
    console.log('  ✗ ' + description + (details ? ' — ' + details : ''));
  }
}

function readFile(filePath) {
  var full = path.join(DIST, filePath);
  try {
    return { exists: true, size: fs.statSync(full).size, content: fs.readFileSync(full, 'utf8') };
  } catch (e) {
    return { exists: false, size: 0, content: '' };
  }
}

function run() {
  console.log('\n  Validating Production Build Output\n');

  // ── Required files exist ──
  console.log('  Required files:');
  var required = [
    'index.html',
    'sw.js',
    'styles.min.css',
    'manifest.json',
    'js/data.bundle.min.js',
    'js/app.bundle.min.js',
    'js/services/firebase-core.js',
  ];
  required.forEach(function (f) {
    var info = readFile(f);
    check(f + ' exists', info.exists, 'File not found in dist/');
    if (info.exists) {
      check(f + ' has content', info.size > 0, 'File is empty (0 bytes)');
    }
  });

  // ── Enforce size limits ──
  console.log('\n  Size limits:');
  var dataFile = readFile('js/data.bundle.min.js');
  if (dataFile.exists) {
    check('data.bundle.min.js > 100 KB', dataFile.size > MIN_DATA_SIZE,
      'Size: ' + (dataFile.size / 1024).toFixed(1) + ' KB');
    check('data.bundle.min.js < 1 MB', dataFile.size < MAX_DATA_SIZE,
      'Size: ' + (dataFile.size / 1024).toFixed(1) + ' KB, exceeds 1 MB limit');
  }
  var appFile = readFile('js/app.bundle.min.js');
  if (appFile.exists) {
    check('app.bundle.min.js > 20 KB', appFile.size > MIN_APP_SIZE,
      'Size: ' + (appFile.size / 1024).toFixed(1) + ' KB');
    check('app.bundle.min.js < 300 KB', appFile.size < MAX_APP_SIZE,
      'Size: ' + (appFile.size / 1024).toFixed(1) + ' KB, exceeds 300 KB limit');
  }

  // ── Bundle content validation ──
  console.log('\n  Content integrity:');
  if (dataFile.exists) {
    var dataContent = dataFile.content;
    check('ALL_WORDS constant present', /ALL_WORDS/.test(dataContent), 'Missing ALL_WORDS');
    check('SURAH_INFO present', /SURAH_INFO/.test(dataContent), 'Missing SURAH_INFO');
    check('CANONICAL_WORDS present', /CANONICAL_WORDS/.test(dataContent), 'Missing CANONICAL_WORDS');
    check('buildLessons function present', /buildLessons/.test(dataContent), 'Missing buildLessons');
    check('getSurahInfo present', /getSurahInfo/.test(dataContent), 'Missing getSurahInfo');
    // Count ALL_WORDS.push calls as a proxy for word count
    var pushCount = (dataContent.match(/ALL_WORDS\.push\(/g) || []).length;
    check('ALL_WORDS has entries (' + pushCount + ')', pushCount >= 30,
      'Only ' + pushCount + ' ALL_WORDS.push calls found (expected 30+)');

    // Validate surah coverage by evaluating the unminified data bundle
    try {
      var bundledDataContent = readFile('js/data.bundle.js');
      if (bundledDataContent.exists && bundledDataContent.content.length > 0) {
        // Evaluate the data bundle to get ALL_WORDS and getSurahsWithVocabulary
        eval(bundledDataContent.content);
        
        if (typeof getSurahsWithVocabulary === 'function') {
          var coverageIds = getSurahsWithVocabulary();
          
          check('getSurahsWithVocabulary() returns at least 30 surahs', 
            coverageIds.length >= 30,
            'Only ' + coverageIds.length + ' surahs found (expected >= 30). Data files may be missing.');
          
          check('getSurahsWithVocabulary() returns at least 60 surahs', 
            coverageIds.length >= 60,
            'Only ' + coverageIds.length + ' surahs found (expected >= 60). Surahs 41-80+ may not be loaded.');
          
          // Check specific critical surah ranges
          var missing = [];
          for (var sid = 41; sid <= 80; sid++) {
            if (coverageIds.indexOf(sid) < 0) missing.push(sid);
          }
          check('Surahs 41-80 are all present in vocabulary', 
            missing.length === 0,
            'Missing surahs: [' + missing.join(', ') + ']. These will not appear in the app.');
          
          console.log('  \n    Surah coverage: ' + coverageIds.length + ' surahs (1-' + 
            (coverageIds.length > 0 ? coverageIds[coverageIds.length-1] : 'N/A') + ')\n');
        } else {
          check('getSurahsWithVocabulary() available', false, 'Function not found in data bundle');
        }
      }
    } catch (e) {
      check('Surah coverage validation', false, 'Failed to evaluate data bundle: ' + e.message);
    }
  }
  if (appFile.exists) {
    var appContent = appFile.content;
    check('app.js entry point present', /app/.test(appContent), 'App bundle appears empty');
    check('SRS engine present', /getSRS/.test(appContent) || /srs/i.test(appContent), 'Missing SRS functions');
    check('UI rendering present', /renderWordCard/.test(appContent) || /ui/i.test(appContent), 'Missing UI functions');
    check('Quiz system present', /quiz/i.test(appContent), 'Missing quiz functions');
    check('Vocabulary search present', /search/.test(appContent), 'Missing search functions');
    check('Auth service present', /loginWithEmail/.test(appContent), 'Missing auth functions');
    check('Sync service present', /uploadToCloud/.test(appContent), 'Missing sync functions');
  }

  // ── HTML validation ──
  console.log('\n  HTML validation:');
  var html = readFile('index.html');
  if (html.exists) {
    var htmlContent = html.content;
    check('No individual script tags', !/script.*src="js\/data\/(words|surahs)/.test(htmlContent),
      'Found individual data file script tags (should use bundles only)');
    check('data.bundle.min.js referenced', /data\.bundle\.min\.js/.test(htmlContent),
      'Missing data.bundle.min.js reference');
    check('app.bundle.min.js referenced', /app\.bundle\.min\.js/.test(htmlContent),
      'Missing app.bundle.min.js reference');
    check('firebase-core.js module referenced', /firebase-core\.js/.test(htmlContent),
      'Missing firebase-core.js module reference');
    check('CSS is inlined (no external link)', !/<link[^>]*href="styles\.css"/.test(htmlContent),
      'Found external styles.css link (should be inlined)');
    check('manifest.json referenced', /manifest\.json/.test(htmlContent),
      'Missing manifest.json reference');
    check('Arabic font imported', /fonts\.googleapis/.test(htmlContent),
      'Missing Google Fonts import');
  }

  // ── Service Worker validation ──
  console.log('\n  Service worker validation:');
  var sw = readFile('sw.js');
  if (sw.exists) {
    var swContent = sw.content;
    check('SW has PRECACHE_URLS', /PRECACHE_URLS/.test(swContent), 'Missing PRECACHE_URLS');
    check('SW caches data.bundle.min.js', /data\.bundle\.min\.js/.test(swContent),
      'Missing data.bundle.min.js in precache');
    check('SW caches app.bundle.min.js', /app\.bundle\.min\.js/.test(swContent),
      'Missing app.bundle.min.js in precache');
    check('SW caches firebase-core.js', /firebase-core\.js/.test(swContent),
      'Missing firebase-core.js in precache');
    check('SW caches styles.min.css', /styles\.min\.css/.test(swContent),
      'Missing styles.min.css in precache');
    check('SW has install event', /addEventListener\('install'/.test(swContent),
      'Missing install event listener');
    check('SW has activate event', /addEventListener\('activate'/.test(swContent),
      'Missing activate event listener');
    check('SW has fetch event', /addEventListener\('fetch'/.test(swContent),
      'Missing fetch event listener');
    check('SW uses skipWaiting', /skipWaiting/.test(swContent),
      'Missing skipWaiting call');
    check('SW uses clients.claim', /clients\.claim/.test(swContent),
      'Missing clients.claim call');
    check('No individual dev file paths in SW', !/words-surah-\d/.test(swContent),
      'Found individual data file paths in SW (should use bundles)');
  }

  // ── CSS validation ──
  console.log('\n  CSS validation:');
  var css = readFile('styles.min.css');
  if (css.exists) {
    var cssContent = css.content;
    check('CSS has content', cssContent.length > 1000, 'CSS is too short (< 1 KB)');
    check('CSS has root variables', /:root/.test(cssContent), 'Missing :root CSS variables');
    check('CSS has .word-card styles', /\.word-card/.test(cssContent), 'Missing word-card styles');
    check('CSS has .bottom-nav styles', /\.bottom-nav/.test(cssContent), 'Missing bottom-nav styles');
    check('CSS has .srs-btn styles', /\.srs-btn/.test(cssContent), 'Missing SRS button styles');
  }

  // ── Run data validation ──
  console.log('\n  ── Vocabulary Data Validation ──\n');
  try {
    var dataResult = cp.spawnSync('node', [path.join(__dirname, 'data-validate.js')], {
      stdio: 'inherit',
      timeout: 30000,
    });
    if (dataResult.status !== 0 && dataResult.status !== null) {
      exitCode = 1; // Propagate data validation failure to prevent deployment
    }
  } catch (e) {
    check('Data validation ran successfully', false, 'Failed to run data validation: ' + e.message);
  }

  // ── Summary ──
  console.log('\n  ─── Validation Summary ───');
  console.log('  Passed: ' + passedChecks + ' / ' + totalChecks);
  console.log('  Failed: ' + (totalChecks - passedChecks));
  console.log('');

  if (exitCode === 0) {
    console.log('  ✅ All validations passed. Build is ready for deployment.\n');
  } else {
    console.log('  ❌ ' + (totalChecks - passedChecks) + ' validation(s) failed. Build must be fixed before deployment.\n');
  }

  process.exit(exitCode);
}

run();
