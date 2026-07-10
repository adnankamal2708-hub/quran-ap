/**
 * R8: Production cleanup - wrap console.log behind __DEV__ flag
 * Run: node scripts/polish-r8-production-cleanup.js
 * 
 * Wraps console.log calls behind a development flag in key files.
 * Keeps console.warn and console.error as is (important for debugging production issues).
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

let totalReplaced = 0;

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${relPath} not found, skipping`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add __DEV__ flag at the top of the file if console.log is used
  if (content.includes('console.log(') && !content.includes('__DEV__')) {
    // Add after the first line or header comment
    const lines = content.split('\n');
    let insertIdx = 0;
    
    // Skip initial comments to find the first meaningful line
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (lines[i].trim().startsWith('//') || lines[i].trim() === '') {
        insertIdx = i + 1;
      } else {
        break;
      }
    }
    
    // Check if there's already a window.__DEV__ reference
    if (!content.includes('window.__DEV__') && !content.includes('__DEV__')) {
      lines.splice(insertIdx, 0, '// Production flag - set to false to suppress debug logging');
      lines.splice(insertIdx + 1, 0, 'var __DEV__ = window.__DEV__ !== false;');
      content = lines.join('\n');
    }
  }
  
  // Replace standalone console.log( with guarded version
  // Match: console.log(...) but not console.log( inside strings
  // Simple approach: wrap each console.log( with if(__DEV__) 
  // But we need to handle multi-line statements
  
  // Pattern: console.log( ... ); — match full statements
  // More robust: replace console.log( with __DEV__ && console.log(
  // This is a safe transformation since && short-circuits
  const before = content;
  content = content.replace(
    /([^a-zA-Z0-9_$])console\.log\(/g,
    '$1__DEV__ && console.log('
  );
  
  const replaced = before !== content;
  if (replaced) {
    const count = (content.match(/__DEV__ \&\& console\.log\(/g) || []).length;
    totalReplaced += count;
    console.log(`✅ ${relPath}: ${count} console.log calls wrapped`);
  }
  
  // Ensure __DEV__ is defined at the top if we added guards
  // (the initial insertion above should handle this)
  
  fs.writeFileSync(fullPath, content, 'utf8');
});

console.log(`\n✅ R8: Total ${totalReplaced} console.log calls wrapped behind __DEV__ flag`);
console.log('   Set window.__DEV__ = false to suppress debug logging');
