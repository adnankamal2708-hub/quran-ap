// ═══════════════════════════════════════════════════════════════
// build.js — Production Build Script
//   • Concatenates all JS files into data + app bundles
//   • Minifies both bundles using terser
//   • Minifies CSS and inlines it into the HTML
//   • Generates optimized dist/ folder
//
// IMPORTANT: The production HTML is derived from the DEVELOPMENT
// index.html by replacing script tags and inlining CSS. This
// ensures ALL UI sections, modals, keyboard hints, and other
// content are preserved in the production build.
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

function minifyHTML(html) {
  return html
    .replace(/\n\s+/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
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

  // 5. Generate production HTML from DEV index.html
  //    This ensures ALL UI content (sections, modals, keyboard hints) is preserved.
  console.log('  5. Generating optimized page from dev index.html...');
  var devHtml = readFile('index.html');
  if (!devHtml) {
    console.error('     ERROR: Could not read index.html');
    return;
  }

  // Step A: Replace external CSS link (<link rel="stylesheet" href="styles.css">) with inline <style>
  var cssLinkRegex = /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/?>/;
  devHtml = devHtml.replace(cssLinkRegex, '<style>' + css + '</style>');

  // Step B: Remove all <script> tags (both regular and module), then append bundle scripts
  // Remove module script (firebase-core.js)
  devHtml = devHtml.replace(/<script\s+type="module"\s+src="js\/services\/firebase-core\.js"><\/script>\s*/g, '');
  // Remove all individual <script defer src="..."> tags
  devHtml = devHtml.replace(/<script\s+defer\s+src="[^"]*"><\/script>\s*/g, '');

  // Step C: Append the production script tags before </body>
  var prodScripts =
    '  <script type="module" src="js/services/firebase-core.js"></script>\n' +
    '  <script defer src="js/data.bundle.min.js"></script>\n' +
    '  <script defer src="js/app.bundle.min.js"></script>\n';
  devHtml = devHtml.replace('</body>', prodScripts + '</body>');

  // Basic HTML minification
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
  // NOTE: Paths are relative to site root (deploy dist/ as root, so NO /dist/ prefix)
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
