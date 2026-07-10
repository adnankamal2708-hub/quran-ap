/**
 * Fix __DEV__ default to OFF (opt-in) for production.
 * Change window.__DEV__ = window.__DEV__ !== false → window.__DEV__ === true
 */
const fs = require('fs');
const path = require('path');

const files = ['js/app.js', 'js/data.js'];

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(
    'window.__DEV__ = window.__DEV__ !== false',
    'window.__DEV__ = window.__DEV__ === true'
  );
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ ${relPath}: __DEV__ defaults to OFF (opt-in)`);
});

console.log('\n✅ Set window.__DEV__ = true in browser console to enable debug logging');
