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
  if (!fs.existsSync(dataDir)) return ['js/data.js'];

  var entries = fs.readdirSync(dataDir).filter(function (f) { return f.endsWith('.js'); });

  var core = ['js/data.js'];
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

  return core.concat(surahMeta).concat(thematic).concat(perSurah);
})();

// firebase-core.js is NOT included in the bundle — it is loaded as a
// separate ES module (<script type="module">) so that CDN imports work.
const APP_FILES = [
  'js/services/config.js',
  'js/services/auth-service.js',
  'js/services/sync-service.js',
  'js/services/user-service.js',
  'js/vocabulary.js',
  'js/srs.js',
  'js/ui.js',
  'js/quiz.js',
  'js/auth-ui.js',
  'js/profile-ui.js',
  'js/app.js',
];

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

async function build() {
  console.log('\n  Building Quranic Vocabulary — Production Build\n');

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
    if (content) dataBundle += content + '\n';
  });
  writeFile('js/data.bundle.js', basicMinify(stripComments(dataBundle)));

  // 2. Concat app files
  console.log('  2. Concatenating app files (' + APP_FILES.length + ' files)...');
  var appBundle = '';
  APP_FILES.forEach(function (f) {
    var content = readFile(f);
    if (content) appBundle += content + '\n';
  });
  writeFile('js/app.bundle.js', basicMinify(stripComments(appBundle)));

  // 3. Minify JS with terser
  console.log('  3. Minifying JavaScript...');
  try {
    var terser = require('terser');
    var dataResult = await terser.minify(readFile('dist/js/data.bundle.js'), {
      compress: { passes: 2, drop_console: false },
      mangle: { reserved: ['ALL_WORDS', 'SURAH_INFO', 'LESSONS'] },
      output: { comments: false },
    });
    if (dataResult.code) writeFile('js/data.bundle.min.js', dataResult.code);

    var appResult = await terser.minify(readFile('dist/js/app.bundle.js'), {
      compress: { passes: 2, drop_console: false },
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

  // Step B: Basic HTML minification
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

  // 7. Copy SW and manifest
  console.log('  7. Copying service worker & assets...');
  var sw = readFile('sw.js');
  // Update SW precache list to use bundled files
  sw = sw.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    "const PRECACHE_URLS = [\n  './',\n  './index.html',\n  './styles.min.css',\n  './js/data.bundle.min.js',\n  './js/app.bundle.min.js',\n  './js/services/firebase-core.js',\n  './manifest.json',\n  './favicon.ico',\n];"
  );
  writeFile('sw.js', sw);
  writeFile('manifest.json', readFile('manifest.json'));
  writeFile('favicon.ico', readFile('favicon.ico') || '');

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
