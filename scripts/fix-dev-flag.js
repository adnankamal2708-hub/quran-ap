/**
 * Fix duplicate __DEV__ declarations.
 * Uses window.__DEV__ instead of per-file var declarations.
 * Declares window.__DEV__ only once in app.js init().
 */
const fs = require('fs');
const path = require('path');

const files = [
  'js/app.js',
  'js/analytics.js',
  'js/ui.js',
  'js/data.js',
  'js/srs.js',
  'js/vocabulary.js',
  'js/data-core/foundation.js',
  'js/data-core/lesson-system.js',
  'js/ui/analytics-ui.js',
  'js/ui/dashboard.js',
];

let changed = 0;

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${relPath} not found, skipping`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Remove var __DEV__ declarations
  const declRegex = /var __DEV__ = window\.__DEV__ !== false;\n/g;
  content = content.replace(declRegex, '');
  
  // 2. Change __DEV__ && to window.__DEV__ &&
  content = content.replace(/__DEV__ \&\& console\.log\(/g, 'window.__DEV__ && console.log(');
  
  if (content.includes('window.__DEV__ && console.log(')) {
    changed++;
  }
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ ${relPath}: fixed __DEV__ references`);
});

// 3. Add window.__DEV__ declaration to app.js init()
const appPath = path.join(__dirname, '..', 'js/app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// Add window.__DEV__ declaration inside init() function
// Find the init function start
if (!appContent.includes("window.__DEV__ =")) {
  appContent = appContent.replace(
    '  console.log(\'[startup] [1] init() called\');',
    '  // Production debug flag — set window.__DEV__ = false to suppress console.log\n  window.__DEV__ = window.__DEV__ !== false;\n  console.log(\'[startup] [1] init() called\');'
  );
  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('✅ js/app.js: added window.__DEV__ declaration in init()');
}

// 4. Also add window.__DEV__ to data.js top-level
const dataPath = path.join(__dirname, '..', 'js/data.js');
let dataContent = fs.readFileSync(dataPath, 'utf8');
if (!dataContent.includes("window.__DEV__ =")) {
  // Add after the header comment block
  dataContent = dataContent.replace(
    '// ═══════════════════════════════════════════════════════════════\n// data.js — Bayan Quranic Vocabulary Data Schema & Constants',
    '// ═══════════════════════════════════════════════════════════════\n// data.js — Bayan Quranic Vocabulary Data Schema & Constants\n// Production debug flag — set window.__DEV__ = false to suppress console.log\nwindow.__DEV__ = window.__DEV__ !== false;'
  );
  fs.writeFileSync(dataPath, dataContent, 'utf8');
  console.log('✅ js/data.js: added window.__DEV__ declaration');
}

console.log(`\n✅ Fixed ${changed} files — all use window.__DEV__ now`);
console.log('Set window.__DEV__ = false to suppress debug logging');
