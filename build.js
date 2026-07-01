// ═══════════════════════════════════════════════════════════════
// build.js — Production Build Script
//   • Concatenates all JS files into data + app bundles
//   • Minifies both bundles using terser
//   • Minifies CSS
//   • Generates optimized dist/ folder
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const DATA_FILES = [
  'js/data.js',
  'js/data/surahs.js',
  'js/data/words-al-fatiha.js',
  'js/data/words-ikhlas.js',
  'js/data/words-attributes.js',
  'js/data/words-baqarah.js',
  'js/data/words-common.js',
  'js/data/words-expanded.js',
  'js/data/words-names-of-allah.js',
  'js/data/words-surah-3-imran.js',
  'js/data/words-surah-4-nisa.js',
  'js/data/words-surah-5-maidah.js',
  'js/data/words-surah-6-anam.js',
  'js/data/words-surah-7-araf.js',
  'js/data/words-surah-8-anfal.js',
  'js/data/words-surah-9-tawbah.js',
  'js/data/words-surah-10-yunus.js',
  'js/data/words-surah-11-hud.js',
  'js/data/words-surah-12-yusuf.js',
  'js/data/words-surah-13-rad.js',
  'js/data/words-surah-14-ibrahim.js',
  'js/data/words-surah-15-hijr.js',
  'js/data/words-surah-16-nahl.js',
  'js/data/words-surah-17-isra.js',
  'js/data/words-surah-18-kahf.js',
  'js/data/words-surah-19-maryam.js',
  'js/data/words-surah-20-taha.js',
];

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

async function build() {
  console.log('\n  Building Quranic Vocabulary — Production Build\n');

  // Clean dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });

  // 1. Concat data files
  console.log('  1. Concatenating data files...');
  var dataBundle = '';
  DATA_FILES.forEach(function (f) {
    var content = readFile(f);
    if (content) dataBundle += content + '\n';
  });
  writeFile('js/data.bundle.js', basicMinify(stripComments(dataBundle)));

  // 2. Concat app files
  console.log('  2. Concatenating app files...');
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
    var dataRaw = readFile('dist/js/data.bundle.js');
    writeFile('js/data.bundle.min.js', dataRaw);
    var appRaw = readFile('dist/js/app.bundle.js');
    writeFile('js/app.bundle.min.js', appRaw);
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

  // 5. Copy Firebase core module (must be at the SAME relative path for module resolution)
  console.log('  5. Copying Firebase core module...');
  var coreSrc = readFile('js/services/firebase-core.js');
  if (coreSrc) {
    writeFile('js/services/firebase-core.js', coreSrc);
    console.log('     firebase-core.js copied as standalone module');
  }

  // 6. Copy SW and manifest
  console.log('  6. Copying service worker & assets...');
  var sw = readFile('sw.js');
  // Update SW precache list to use bundled files
  sw = sw.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    "const PRECACHE_URLS = [\n  './',\n  './dist/index.html',\n  './dist/styles.min.css',\n  './dist/js/data.bundle.min.js',\n  './dist/js/app.bundle.min.js',\n  './dist/js/services/firebase-core.js',\n  './dist/manifest.json',\n  './dist/favicon.ico',\n];"
  );
  writeFile('sw.js', sw);
  writeFile('manifest.json', readFile('manifest.json'));
  writeFile('favicon.ico', readFile('favicon.ico') || '');

  // 7. Create optimized index.html
  console.log('  6. Generating optimized page...');
  var minCSS = readFile('dist/styles.min.css');
  var html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="theme-color" content="#c9a84c">',
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E📖%3C/text%3E%3C/svg%3E">',
    '<link rel="manifest" href="manifest.json">',
    '<meta name="description" content="Learn Quranic Arabic vocabulary with spaced repetition.">',
    '<title>Quranic Vocabulary</title>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Amiri:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">',
    '<style>' + minCSS + '</style>',
    '</head>',
    '<body>',
    '<a href="#content" class="skip-link">Skip to content</a>',
    '<div class="app" role="application">',
    '<header class="top-bar" role="banner">',
    '<div class="top-primary-row">',
    '<div class="top-left-group"><div class="bismillah" aria-hidden="true">بِسْمِ اللَّهِ</div><span class="offline-badge" id="offline-badge" aria-live="polite">✓ Offline ready</span><span class="guest-badge" id="guest-badge" style="display:none">👤 Guest</span></div>',
    '<div class="top-right-group"><button class="user-btn" id="user-btn" type="button" title="Account"><span class="user-avatar-small">👤</span></button></div>',
    '</div>',
    '<div class="top-meta-row">',
    '<div class="top-info-group"><span class="lesson-label" id="lesson-label">Lesson 1 of 16</span><span class="top-meta-sep" aria-hidden="true">·</span><span class="top-meta-stat" id="stat-learned">0</span><span class="top-meta-stat-label">Learned</span><span class="top-meta-sep" aria-hidden="true">·</span><span class="top-meta-stat" id="stat-review">0</span><span class="top-meta-stat-label">Due</span><span class="top-meta-sep" aria-hidden="true">·</span><span class="top-meta-stat" id="stat-score">—</span><span class="top-meta-stat-label">Quiz</span>',
    '<div class="goal-ring-wrap" id="goal-ring-wrap" title="Daily review goal" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">',
    '<svg class="goal-ring" viewBox="0 0 36 36"><path class="goal-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="goal-ring-fill" id="goal-ring-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="0,100"/><text class="goal-ring-text" id="goal-ring-text" x="18" y="20.5">0</text></svg>',
    '</div></div></div>',
    '<div class="progress-row" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar-wrap"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div><span class="progress-label" id="progress-text">Word 1 / 20</span></div>',
    '</header>',
    '<main class="content" id="content" tabindex="-1">',
    '</main>',
    '<nav class="bottom-nav" role="navigation">',
    '<button class="nav-tab active" id="tab-learn" type="button"><span class="nav-tab-icon">📖</span><span class="nav-tab-label">Learn</span></button>',
    '<button class="nav-tab" id="tab-quiz" type="button"><span class="nav-tab-icon">✏️</span><span class="nav-tab-label">Quiz</span></button>',
    '<button class="nav-tab" id="tab-list" type="button"><span class="nav-tab-icon">📋</span><span class="nav-tab-label">Words</span></button>',
    '<button class="nav-tab" id="tab-stats" type="button"><span class="nav-tab-icon">📊</span><span class="nav-tab-label">Stats</span></button>',
    '</nav>',
    '</div>',
    '<script type="module" src="js/services/firebase-core.js"></script>',
    '<script defer src="js/data.bundle.min.js"></script>',
    '<script defer src="js/app.bundle.min.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');
  writeFile('index.html', html);

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
