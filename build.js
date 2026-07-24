// ═══════════════════════════════════════════════════════════════
// build.js — Production Build Script
//   • Auto-discovers all data files from js/data/ directory
//   • Concatenates all JS files into data + app bundles
//   • Minifies both bundles using terser
//   • Minifies CSS and inlines it into the HTML
//   • Generates optimized dist/ folder
//   • Updates service worker to precache production assets
//
// ARCHITECTURE: Production-first (single deployment architecture).
// Source index.html loads only production bundles (data.bundle.min.js
// + app.bundle.min.js). No individual script tags in development.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ── AUTO-DISCOVERY ────────────────────────────────────────────────
// Data files are discovered automatically from js/data/ directory.
// Adding a new words-surah-NN-name.js file will be picked up without
// editing this build script.
//
// LOADING ORDER (preserved for backward compatibility):
//   1. js/data.js (core vocabulary engine)
//   2. js/data/surahs.js (surah metadata)
//   3. Thematic word files (words-al-fatiha.js, words-ikhlas.js, etc.)
//      sorted alphabetically among themselves
//   4. Per-surah word files (words-surah-NN-name.js) sorted by surah number
//
// This stable ordering ensures ALL_WORDS array indices (and thus w_N IDs)
// remain consistent across builds when no new files are added.
const DATA_FILES = (function () {
  var dataDir = path.join(ROOT, 'js', 'data');
  var dataCoreDir = path.join(ROOT, 'js', 'data-core');
  
  var files = [];

  // 1. Core data engine modules (split from the monolithic data.js)
  //    Loaded first because they define ALL_WORDS, CANONICAL_WORDS, etc.
  var coreModules = [
    'js/data-core/vocab-data.js',
    'js/data-core/surah-org.js',
    'js/data-core/foundation.js',
    'js/data-core/lesson-system.js',
    'js/data-core/progress-aggregator.js',
    'js/data-core/adaptive.js',
    'js/data-core/quiz-history.js',
    'js/data-core/surah-progress.js',
  ];
  if (fs.existsSync(dataCoreDir)) {
    files = files.concat(coreModules);
  }
  
  // Fallback: if data-core directory is missing, use the monolithic data.js
  if (files.length === 0) {
    files = ['js/data.js'];
    console.log('  ⚠ js/data-core/ not found — falling back to monolithic data.js');
  }

  // 2. Word data files from js/data/
  if (!fs.existsSync(dataDir)) return files;

  var entries = fs.readdirSync(dataDir).filter(function (f) { return f.endsWith('.js'); });

  var surahMeta = [];
  var thematic = [];
  var perSurah = [];

  entries.forEach(function (f) {
    var fullPath = 'js/data/' + f;
    if (fullPath === 'js/data.js') return;
    if (fullPath === 'js/data/surahs.js') {
      surahMeta.push(fullPath);
    } else if (/^words-surah-\d+-/.test(f)) {
      perSurah.push(fullPath);
    } else {
      thematic.push(fullPath);
    }
  });

  // Sort per-surah files by surah number extracted from filename
  perSurah.sort(function (a, b) {
    var numA = parseInt(a.match(/words-surah-(\d+)/)[1], 10);
    var numB = parseInt(b.match(/words-surah-(\d+)/)[1], 10);
    return numA - numB;
  });

  // Sort thematic files alphabetically (stable for backward compat)
  thematic.sort();

  return files.concat(surahMeta).concat(thematic).concat(perSurah);
})();

// firebase-core.js is NOT included in the bundle — it is loaded as a
// separate ES module (<script type="module">) so that CDN imports work.
const UI_FILES = (function () {
  var uiDir = path.join(ROOT, 'js', 'ui');
  if (fs.existsSync(uiDir)) {
    // Load UI modules in dependency order
    return [
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
    ];
  }
  return ['js/ui.js']; // Fallback to monolithic file
})();

const APP_FILES = [
  'js/services/config.js',
  'js/services/auth-service.js',
  'js/services/sync-service.js',
  'js/services/user-service.js',
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
  'js/ux-polish.js',
  'js/ui/navigation.js',
  'js/ui/review.js',
  'js/ui/review-center.js',
  'js/ui/keyboard.js',
  'js/app.js',
]);

// Validate that all referenced files exist
UI_FILES.forEach(function(f) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.warn('  ⚠ UI file not found: ' + f + ' — check js/ui/ directory');
  }
});
DATA_FILES.forEach(function(f) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.warn('  ⚠ Data file not found: ' + f);
  }
});

function readFile(filePath) {
  var full = path.join(ROOT, filePath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function writeFile(filePath, content) {
  var full = path.join(DIST, filePath);
  var dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function basicMinify(code) {
  return code
    .replace(/\n\s*\n/g, '\n')
    .replace(/^[ \t]+/gm, '')
    .replace(/\s+$/gm, '')
    .trim();
}

function minifyHTML(html) {
  return html
    .replace(/\n\s+/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Duplicate Declaration Validation ────────────────────────────
// Scans all source JS files before building to detect duplicate
// `const`, `let`, `var`, or `function` declarations at the top level.
// Fails fast with a clear report — this prevents the exact class of
// error that previously blocked the entire application from loading.
// ────────────────────────────────────────────────────────────────

function validateNoDuplicateDeclarations() {
  var allFiles = DATA_FILES.concat(APP_FILES);
  var seen = {};  // name → { firstFile, firstLine }
  var duplicates = [];

  allFiles.forEach(function (file) {
    var content = readFile(file);
    if (!content) return;
    var lines = content.split('\n');

    lines.forEach(function (line, idx) {
      var lineNum = idx + 1;
      var trimmed = line.trim();

      // Only track TOP-LEVEL declarations (no leading whitespace).
      // Indented declarations are inside function bodies or blocks and
      // are locally scoped — they do NOT cause global duplicate errors
      // when concatenated into bundles.
      if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) return;

      // Skip comment lines and empty lines
      if (trimmed.indexOf('//') === 0 || trimmed.indexOf('/*') === 0 || trimmed === '') return;

      // Match top-level declarations on their own line
      var match;
      if ((match = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=/))) {
        checkDeclaration(match[1], file, lineNum);
      } else if ((match = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/))) {
        checkDeclaration(match[1], file, lineNum);
      }
    });
  });

  function checkDeclaration(name, file, lineNum) {
    if (seen[name]) {
      duplicates.push({
        name: name,
        firstFile: seen[name].file,
        firstLine: seen[name].line,
        secondFile: file,
        secondLine: lineNum,
      });
    } else {
      seen[name] = { file: file, line: lineNum };
    }
  }

  if (duplicates.length > 0) {
    console.error('');
    console.error('  ✗ DUPLICATE DECLARATION' + (duplicates.length > 1 ? 'S' : '') + ' FOUND — Build aborted.\n');
    duplicates.forEach(function (d) {
      console.error('    "' + d.name + '" declared in:');
      console.error('      • ' + d.firstFile + ':' + d.firstLine);
      console.error('      • ' + d.secondFile + ':' + d.secondLine);
    });
    console.error('');
    console.error('  Duplicate const/let/var/function declarations cause JavaScript parse errors');
    console.error('  that can block the entire application from loading. Remove or rename the');
    console.error('  duplicate(s) before building.\n');
    process.exit(1);
  }

  console.log('  ✓ No duplicate declarations across ' + allFiles.length + ' JS files.');
}

async function build() {
  console.log('\n  Building Bayan — Production Build\n');

  // 0. Validate source file quality before building
  console.log('  0. Validating source files...');
  validateNoDuplicateDeclarations();

  // 0b. Run comment lint to catch malformed comment patterns
  //     (e.g., a line comment with an unclosed block-comment opener on the same line)
  console.log('  0b. Checking for malformed comment patterns...');
  try {
    var lintResult = cp.execSync('node test/comment-lint.js', {
      cwd: ROOT,
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(lintResult.stdout || lintResult);
    console.log('     Comment lint passed.');
  } catch (e) {
    // Print the actual lint output so developers know what to fix
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    throw new Error('Comment lint failed — fix issues above and re-run.');
  }

  // Clean dist — handle locked directories gracefully
  if (fs.existsSync(DIST)) {
    try {
      fs.rmSync(DIST, { recursive: true, force: true });
    } catch (e) {
      console.log('  ℹ Could not remove dist/ directory (may be locked by another process). Writing files directly.');
      // Remove individual files inside dist to avoid directory-level lock issues
      if (fs.existsSync(path.join(DIST, 'js'))) {
        try { fs.rmSync(path.join(DIST, 'js'), { recursive: true, force: true }); } catch (e2) { /* skip */ }
      }
    }
  }
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  if (!fs.existsSync(path.join(DIST, 'js'))) fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
  if (!fs.existsSync(path.join(DIST, 'js', 'services'))) fs.mkdirSync(path.join(DIST, 'js', 'services'), { recursive: true });

  // 1. Concat data files
  console.log('  1. Concatenating data files (' + DATA_FILES.length + ' files)...');
  var dataBundle = '';
  DATA_FILES.forEach(function (f) {
    var content = readFile(f);
    if (content) {
      content = content.replace(/\r\n/g, '\n'); // Normalize line endings
      dataBundle += content + '\n';
    }
  });
  writeFile('js/data.bundle.js', basicMinify(stripComments(dataBundle)));

  // 2. Concat app files
  console.log('  2. Concatenating app files (' + APP_FILES.length + ' files)...');
  var appBundle = '';
  APP_FILES.forEach(function (f) {
    var content = readFile(f);
    if (content) {
      content = content.replace(/\r\n/g, '\n'); // Normalize line endings
      appBundle += content + '\n';
    }
  });
  writeFile('js/app.bundle.js', basicMinify(stripComments(appBundle)));

  // 3. Minify JS with terser
  console.log('  3. Minifying JavaScript...');
  try {
    var terser = require('terser');
    var dataResult = await terser.minify(readFile('dist/js/data.bundle.js'), {
      compress: { passes: 2, drop_console: true, booleans: true, comparisons: true, reduce_vars: false, side_effects: true },
      mangle: { reserved: ['ALL_WORDS', 'SURAH_INFO', 'LESSONS'] },
      output: { comments: false },
    });
    if (dataResult.code) writeFile('js/data.bundle.min.js', dataResult.code);

    var appResult = await terser.minify(readFile('dist/js/app.bundle.js'), {
      compress: { passes: 2, drop_console: true, booleans: true, comparisons: true, reduce_vars: false, side_effects: true },
      mangle: { reserved: ['ALL_WORDS', 'SURAH_INFO', 'LESSONS'] },
      output: { comments: false },
    });
    if (appResult.code) writeFile('js/app.bundle.min.js', appResult.code);
    console.log('     JS minification complete');
  } catch (e) {
    console.warn('     Warning: terser minification failed, using unminified: ' + e.message);
    writeFile('js/data.bundle.min.js', readFile('dist/js/data.bundle.js'));
    writeFile('js/app.bundle.min.js', readFile('dist/js/app.bundle.js'));
  }

  // 4. Minify CSS
  console.log('  4. Minifying CSS...');
  var css = readFile('styles.css');
  var origCSSLen = css.length;
  css = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([,{:;}])\s*/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
  writeFile('styles.min.css', css);
  var reduction = Math.round((1 - css.length / origCSSLen) * 100);
  console.log('     ' + (origCSSLen / 1024).toFixed(1) + ' KB -> ' + (css.length / 1024).toFixed(1) + ' KB (' + reduction + '% reduction)');

    // 4b. Split Quran data into per-surah files for progressive loading
  //    Wrapped in try-catch so that any failure in this step does NOT
  //    prevent steps 5-8 (HTML generation, SW, assets) from running.
  //    If splitting fails, the monolithic fallback is used at runtime.
  console.log('  4b. Splitting Quran text into per-surah files...');
  try {
    var quranDataPath = path.join(ROOT, 'js', 'quran', 'quran-data.js');
    var surahIndexPath = path.join(ROOT, 'js', 'quran', 'surah-index.js');
    var quranDir = path.join(DIST, 'js', 'quran');

    if (fs.existsSync(quranDataPath)) {
      // Create dist/js/quran/ directory
      if (!fs.existsSync(quranDir)) {
        fs.mkdirSync(quranDir, { recursive: true });
      }

      // Read and eval the full Quran data to get the object
      var quranContent = readFile('js/quran/quran-data.js');
      global.window = global.window || {};

      // Extract and eval just the QURAN_TEXT object
      var objStart = quranContent.indexOf('var QURAN_TEXT = {');
      var objEnd = quranContent.lastIndexOf('};', quranContent.indexOf('window.__QURAN_TEXT'));

      var quranSplitOk = false;
      if (objStart >= 0 && objEnd >= 0) {
        var objStr = quranContent.substring(objStart, objEnd + 2);
        try {
          eval(objStr);
          quranSplitOk = (typeof QURAN_TEXT !== 'undefined');
        } catch (evalErr) {
          console.warn('     Warning: Could not eval QURAN_TEXT: ' + evalErr.message);
        }
      } else {
        console.warn('     Warning: Could not locate QURAN_TEXT object in quran-data.js');
      }

      if (quranSplitOk) {
        // 4b-i. Write surah-index.min.js (metadata only)
        if (fs.existsSync(surahIndexPath)) {
          var indexSrc = readFile('js/quran/surah-index.js');
          writeFile('js/quran/surah-index.js', basicMinify(stripComments(indexSrc)));
          try {
            var idxResult = await terser.minify(readFile('dist/js/quran/surah-index.js'), {
              compress: { passes: 2, drop_console: true },
              output: { comments: false },
            });
            if (idxResult.code) writeFile('js/quran/surah-index.min.js', idxResult.code);
            var idxSize = fs.statSync(path.join(DIST, 'js/quran/surah-index.min.js')).size;
            console.log('     surah-index.min.js: ' + (idxSize / 1024).toFixed(1) + ' KB');
          } catch (e) {
            console.warn('     Warning: terser failed for surah-index: ' + e.message);
            writeFile('js/quran/surah-index.min.js', readFile('dist/js/quran/surah-index.js'));
          }
        }

        // 4b-ii. Write per-surah files (surah-1.min.js through surah-114.min.js)
        var totalRawSize = 0;
        var totalMinSize = 0;
        var minSurahCount = 0;
        var bigSurahs = [];

        for (var si = 1; si <= 114; si++) {
          var s = QURAN_TEXT[si];
          if (!s) {
            console.warn('     Warning: Surah ' + si + ' not found in QURAN_TEXT');
            continue;
          }

          var surahJs = JSON.stringify(s);
          var wrapped = '(function(){if(!window.__QURAN_TEXT)window.__QURAN_TEXT={};window.__QURAN_TEXT[' + si + ']=' + surahJs + ';})();\n';
          var rawSize = Buffer.byteLength(wrapped, 'utf8');
          totalRawSize += rawSize;

          var surahFilename = 'js/quran/surah-' + si + '.js';
          writeFile(surahFilename, wrapped);

          try {
            var minResult = await terser.minify(wrapped, {
              compress: { passes: 2, drop_console: true },
              output: { comments: false },
            });
            if (minResult.code) {
              var minFilename = 'js/quran/surah-' + si + '.min.js';
              writeFile(minFilename, minResult.code);
              var minSize = Buffer.byteLength(minResult.code, 'utf8');
              totalMinSize += minSize;
              minSurahCount++;
              if (minSize > 30000) {
                bigSurahs.push({ id: si, name: s.name, size: minSize });
              }
            }
          } catch (e) {
            console.warn('     Warning: terser failed for surah ' + si + ': ' + e.message);
            writeFile('js/quran/surah-' + si + '.min.js', wrapped);
            totalMinSize += rawSize;
            minSurahCount++;
          }

          // Progress indicator for large surahs
          if (si % 20 === 0 || si === 114) {
            console.log('     Processed ' + si + '/114 surahs...');
          }
        }

        var savings = totalRawSize > 0 ? Math.round((1 - totalMinSize / totalRawSize) * 100) : 0;
        console.log('     ' + minSurahCount + ' surah files created (' + (totalRawSize / 1024).toFixed(1) + ' KB -> ' + (totalMinSize / 1024).toFixed(1) + ' KB, ' + savings + '% reduction)');
        if (bigSurahs.length > 0) {
          console.log('     Biggest: ' + bigSurahs.slice(-3).map(function(b) { return b.name + ' (' + (b.size / 1024).toFixed(1) + ' KB)'; }).join(', '));
        }

        // Also keep a monolithic fallback bundle for legacy support
        var fullBundle = '';
        fullBundle += 'var QURAN_TOTAL_SURAHS=' + 114 + ';var QURAN_TOTAL_VERSES=' + 6236 + ';';
        fullBundle += 'var QURAN_VERSE_INDEX=[null];';
        fullBundle += 'var QURAN_TEXT=' + JSON.stringify(QURAN_TEXT) + ';';
        fullBundle += '(function(){var vi=1;for(var sid=1;sid<=114;sid++){var sv=QURAN_TEXT[sid];if(!sv)continue;for(var v=0;v<sv.verses.length;v++){QURAN_VERSE_INDEX[vi]={surahId:sid,verseId:sv.verses[v].id};vi++;}})();';
        fullBundle += 'window.__QURAN_TEXT=QURAN_TEXT;window.__QURAN_VERSE_INDEX=QURAN_VERSE_INDEX;window.__QURAN_TOTAL_VERSES=QURAN_TOTAL_VERSES;';
        writeFile('js/quran.bundle.js', basicMinify(stripComments(fullBundle)));
        try {
          var fbResult = await terser.minify(readFile('dist/js/quran.bundle.js'), {
            compress: { passes: 2, drop_console: true },
            output: { comments: false },
          });
          if (fbResult.code) {
            writeFile('js/quran.bundle.min.js', fbResult.code);
            var fbSize = fs.statSync(path.join(DIST, 'js/quran.bundle.min.js')).size;
            console.log('     Monolithic fallback: ' + (Buffer.byteLength(fullBundle, 'utf8') / 1024).toFixed(1) + ' KB -> ' + (fbSize / 1024).toFixed(1) + ' KB');
          }
        } catch (e) {
          writeFile('js/quran.bundle.min.js', basicMinify(stripComments(fullBundle)));
        }
      } else {
        // quranSplitOk === false — eval failed or QURAN_TEXT undefined
        // Generate monolithic fallback from the raw file content
        console.log('     Quran splitting not possible — generating monolithic fallback bundle');
        writeFile('js/quran.bundle.js', basicMinify(stripComments(quranContent)));
        try {
          var qr = await terser.minify(readFile('dist/js/quran.bundle.js'), {
            compress: { passes: 2, drop_console: true },
            output: { comments: false },
          });
          if (qr.code) writeFile('js/quran.bundle.min.js', qr.code);
        } catch (e2) {
          writeFile('js/quran.bundle.min.js', readFile('dist/js/quran.bundle.js'));
        }
      }
    } else {
      console.log('     No quran-data.js found — skipping');
    }
  } catch (e) {
    // Catch-all safety net: if step 4b throws for any reason,
    // log the error and continue. Steps 5-8 MUST still run.
    console.warn('     Warning: Quran splitting step failed: ' + (e.message || e));
    console.log('     Continuing build without per-surah files (monolithic fallback may be absent)');
  }

// 5. Generate production HTML from source index.html
  //    The source index.html already uses production bundle references
  //    (data.bundle.min.js + app.bundle.min.js), so we just:
  //    1) Inline the CSS
  //    2) Minify the HTML
  console.log('  5. Generating optimized page from source index.html...');
  var devHtml = readFile('index.html');
  if (!devHtml) {
    console.error('     ERROR: Could not read index.html');
    return;
  }

  // Step A: Replace external CSS link with inline <style>
  var cssLinkRegex = /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/?>/;
  devHtml = devHtml.replace(cssLinkRegex, '<style>' + css + '</style>');

  // Step B: Inline safeguards.js into the inline <script> block
  // The source index.html already has an inline <script> block as a placeholder.
  // We replace it with the fresh source content so js/safeguards.js is the
  // single source of truth and the build always gets the latest version.
  var safeguardsSrc = readFile('js/safeguards.js');
  if (safeguardsSrc) {
    // Remove comments from safeguards for smaller inline footprint
    safeguardsSrc = stripComments(safeguardsSrc);
    // Match ONLY the JS safeguards script block (from the "(loads BEFORE" comment to </script>).
    // The CSS fallback style block uses a DIFFERENT <!-- SAFEGUARDS comment and must NOT be matched.
    var inlineSafeguardsRegex = /<!-- ── SAFEGUARDS: Error detection[\s\S]*?<\/script>/;
    devHtml = devHtml.replace(inlineSafeguardsRegex,
      '<!-- ── SAFEGUARDS: Error detection & prevention (inlined from js/safeguards.js) ── -->\n' +
      '  <script>' + safeguardsSrc + '</script>'
    );
    console.log('     safeguards.js inlined into production HTML (' + safeguardsSrc.length + ' bytes)');
  } else {
    console.warn('     Warning: js/safeguards.js not found — inline safeguards block left as-is');
  }

  // Step C: Basic HTML minification
  devHtml = minifyHTML(devHtml);

  writeFile('index.html', devHtml);
  console.log('     Production HTML generated (' + (devHtml.length / 1024).toFixed(1) + ' KB)');

  // 6. Copy Firebase core module (must be at the SAME relative path for module resolution)
  console.log('  6. Copying Firebase core module...');
  var coreSrc = readFile('js/services/firebase-core.js');
  if (coreSrc) {
    writeFile('js/services/firebase-core.js', coreSrc);
    console.log('     firebase-core.js copied as standalone module');
  }

  // 6b. Copy ux-polish.js (loaded separately from bundles for timing independence)
  var uxPolish = readFile('js/ux-polish.js');
  if (uxPolish) {
    writeFile('js/ux-polish.js', uxPolish);
    console.log('     ux-polish.js copied');
  }

  // 7. Copy SW and manifest
  console.log('  7. Copying service worker & assets...');
  var sw = readFile('sw.js');
  // Update SW precache list to use bundled files (include Quran bundle if exists)
  var precacheItems = [
    "'./'",
    "'./index.html'",
    "'./styles.min.css'",
    "'./js/data.bundle.min.js'",
    "'./js/app.bundle.min.js'",
    "'./js/services/firebase-core.js'",
    "'./js/ux-polish.js'",
    "'./manifest.json'",
    "'./favicon.ico'",
  ];
  // Add Quran assets to precache if they exist
  if (fs.existsSync(path.join(DIST, 'js/quran', 'surah-index.min.js'))) {
    precacheItems.push("'./js/quran/surah-index.min.js'");
  }
  if (fs.existsSync(path.join(DIST, 'js/quran.bundle.min.js'))) {
    precacheItems.push("'./js/quran.bundle.min.js'");
  }
  sw = sw.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    "const PRECACHE_URLS = [\n  " + precacheItems.join(",\n  ") + ",\n];"
  );
  // Bump cache version so service worker detects changes and replaces old cache
  sw = sw.replace(
    /CACHE_NAME = 'quran-vocab-v\d+'/,
    "CACHE_NAME = 'quran-vocab-v" + Date.now() + "'"
  );
  writeFile('sw.js', sw);
  writeFile('manifest.json', readFile('manifest.json'));
  writeFile('favicon.ico', readFile('favicon.ico') || '');

  // 8. Copy build artifacts to root directory so source index.html and sw.js work
  //    (source index.html references js/data.bundle.min.js + js/app.bundle.min.js)
  //    (root sw.js precaches styles.min.css + service worker must match dist version)
  console.log('  8. Syncing build artifacts to root directory...');
  var artifactsToSync = [
    'js/data.bundle.min.js',
    'js/app.bundle.min.js',
    'styles.min.css',
    'sw.js',
  ];
  if (fs.existsSync(path.join(DIST, 'js/quran.bundle.min.js'))) {
    artifactsToSync.push('js/quran.bundle.min.js');
  }
  artifactsToSync.forEach(function (relPath) {
    var srcPath = path.join(DIST, relPath);
    var destPath = path.join(ROOT, relPath);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      var size = fs.statSync(destPath).size;
      console.log('     Synced ' + relPath + ' (' + (size / 1024).toFixed(1) + ' KB)');
    }
  });

  // Stats
  console.log('\n  Build Complete!\n');
  var origJSSize = 0;
  DATA_FILES.concat(APP_FILES).forEach(function (f) {
    origJSSize += Buffer.byteLength(readFile(f), 'utf8');
  });
  var dbSize = fs.existsSync(path.join(DIST, 'js/data.bundle.min.js'))
    ? fs.statSync(path.join(DIST, 'js/data.bundle.min.js')).size : 0;
  var abSize = fs.existsSync(path.join(DIST, 'js/app.bundle.min.js'))
    ? fs.statSync(path.join(DIST, 'js/app.bundle.min.js')).size : 0;

  console.log('  JavaScript: ' + (origJSSize / 1024).toFixed(1) + ' KB -> ' + ((dbSize + abSize) / 1024).toFixed(1) + ' KB (' + Math.round((1 - (dbSize+abSize)/origJSSize)*100) + '% reduction)');
  console.log('  CSS: ' + (origCSSLen / 1024).toFixed(1) + ' KB -> ' + (css.length / 1024).toFixed(1) + ' KB (' + reduction + '% reduction)');
  console.log('  HTTP requests: ~30 -> 5 (1 Firebase module + 1 data bundle + 1 app bundle + 1 inline CSS + 1 manifest)');
  console.log('');
}

build().catch(function (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
});
