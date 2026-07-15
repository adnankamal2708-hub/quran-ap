// ═══════════════════════════════════════════════════════════════
// validate.js — Post-Build Validation
// Runs after build.js in CI to verify the production output.
// If this script exits non-zero, the artifact is NOT uploaded
// and the deployment is aborted.
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var DIST = path.join(ROOT, 'dist');

var exitCode = 0;
var results = [];

function check(name, ok, detail) {
  results.push({ name: name, ok: ok, detail: detail });
  if (!ok) {
    console.error('  ✗ ' + name + ': ' + detail);
    exitCode = 1;
  } else {
    console.log('  ✓ ' + name + (detail ? ': ' + detail : ''));
  }
}

console.log('\n  Validating build output...\n');

// 1. Required files exist
var requiredFiles = [
  { path: 'index.html', label: 'Production HTML' },
  { path: 'js/data.bundle.min.js', label: 'Data bundle' },
  { path: 'js/app.bundle.min.js', label: 'App bundle' },
  { path: 'styles.min.css', label: 'Minified CSS' },
  { path: 'sw.js', label: 'Service worker' },
  { path: 'manifest.json', label: 'Web manifest' },
  { path: 'js/services/firebase-core.js', label: 'Firebase core module' },
];

requiredFiles.forEach(function (f) {
  var full = path.join(DIST, f.path);
  var exists = fs.existsSync(full);
  var size = exists ? fs.statSync(full).size : 0;
  check(f.label + ' exists', exists, exists ? (size / 1024).toFixed(1) + ' KB' : 'MISSING');
});

// 2. Verify index.html is well-formed (contains expected production markers)
var html = '';
var htmlPath = path.join(DIST, 'index.html');
if (fs.existsSync(htmlPath)) {
  html = fs.readFileSync(htmlPath, 'utf8');
  check('HTML contains inline CSS', html.indexOf('<style>') >= 0, '');
  check('HTML contains inlined safeguards', html.indexOf('SAFEGUARDS') >= 0, '');
  check('HTML has fonts-failed class logic', html.indexOf('fonts-failed') >= 0, '');
  check('HTML references production bundles', html.indexOf('app.bundle.min.js') >= 0, '');
}

// 3. Verify bundle sizes are within expected limits
var dbPath = path.join(DIST, 'js/data.bundle.min.js');
if (fs.existsSync(dbPath)) {
  var dbSize = fs.statSync(dbPath).size;
  check('Data bundle size', dbSize >= 102400 && dbSize <= 1572864,
    (dbSize / 1024).toFixed(1) + ' KB (limit: 100 KB – 1.5 MB)');
}

var abPath = path.join(DIST, 'js/app.bundle.min.js');
if (fs.existsSync(abPath)) {
  var abSize = fs.statSync(abPath).size;
  check('App bundle size', abSize >= 20480 && abSize <= 614400,
    (abSize / 1024).toFixed(1) + ' KB (limit: 20 KB – 600 KB)');
}

// 4. Verify service worker has production configuration
var swPath = path.join(DIST, 'sw.js');
if (fs.existsSync(swPath)) {
  var sw = fs.readFileSync(swPath, 'utf8');
  check('SW has production precache URLs', sw.indexOf('PRECACHE_URLS') >= 0, '');
  check('SW has versioned cache name', sw.indexOf('quran-vocab-v') >= 0, '');
}

console.log('\n  ' + (exitCode === 0 ? '✓ All checks passed.' : '✗ Some checks failed.'));
console.log('');
process.exit(exitCode);
