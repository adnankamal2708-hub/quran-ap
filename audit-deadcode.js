// ═══════════════════════════════════════════════════════════════
// audit-deadcode.js — Dead Code Audit
// Scans all source JS files, finds every top-level declaration,
// and counts how many times each is referenced.
// Reports symbols with 0 or 1 references (the declaration itself).
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE_FILES = [
  'js/data.js',
  'js/vocabulary.js',
  'js/srs.js',
  'js/ui.js',
  'js/quiz.js',
  'js/app.js',
  'js/auth-ui.js',
  'js/profile-ui.js',
  'js/services/config.js',
  'js/services/auth-service.js',
  'js/services/sync-service.js',
  'js/services/user-service.js',
];

// Also discover all data files
const DATA_DIR = path.join(ROOT, 'js', 'data');
const dataFiles = fs.readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.js') && f !== 'data.js' && f !== 'surahs.js')
  .map(f => 'js/data/' + f);

const ALL_FILES = SOURCE_FILES.concat(dataFiles);

// Step 1: Collect all top-level declarations (column 0, not indented)
var declMap = {}; // name -> [{ file, line }]
var allContent = {}; // file -> content

ALL_FILES.forEach(function(file) {
  var fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return;
  var content = fs.readFileSync(fullPath, 'utf8');
  allContent[file] = content;
  var lines = content.split('\n');

  lines.forEach(function(line, idx) {
    // Only match lines that start at column 0 (top-level)
    if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) return;
    var trimmed = line.trim();
    if (trimmed === '' || trimmed.indexOf('//') === 0 || trimmed.indexOf('/*') === 0) return;

    var m;
    if ((m = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=/))) {
      if (!declMap[m[1]]) declMap[m[1]] = [];
      declMap[m[1]].push({ file: file, line: idx + 1 });
    } else if ((m = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/))) {
      if (!declMap[m[1]]) declMap[m[1]] = [];
      declMap[m[1]].push({ file: file, line: idx + 1 });
    } else if ((m = trimmed.match(/^const\s+(\w+)\s*=/))) {
      if (!declMap[m[1]]) declMap[m[1]] = [];
      declMap[m[1]].push({ file: file, line: idx + 1 });
    }
  });
});

// Step 2: Count references to each symbol across ALL files
var refCounts = {};
Object.keys(declMap).forEach(function(name) {
  refCounts[name] = 0;
  ALL_FILES.forEach(function(file) {
    var content = allContent[file];
    if (!content) return;
    // Count occurrences of the word in the file
    var re = new RegExp('\\b' + name + '\\b', 'g');
    var match;
    while ((match = re.exec(content)) !== null) {
      refCounts[name]++;
      if (refCounts[name] > 10) break; // early stop, we know it's used
    }
  });
});

// Step 3: Find symbols with 0 or 1 reference (only their own declaration)
console.log('=== DEAD CODE CANDIDATES (0 or 1 reference) ===\n');

var candidates = [];
Object.keys(declMap).sort().forEach(function(name) {
  var count = refCounts[name];
  if (count <= 1) {
    var decls = declMap[name].map(function(d) {
      return d.file + ':' + d.line;
    }).join(', ');
    candidates.push({ name: name, refs: count, location: decls });
    console.log(name + ': ' + count + ' reference(s) — ' + decls);
  }
});

// Step 4: Also check window.__ exports that might not be consumed
console.log('\n=== WINDOW EXPORTS (check if consumed elsewhere) ===\n');

var windowExports = {};
ALL_FILES.forEach(function(file) {
  var content = allContent[file];
  if (!content) return;
  var lines = content.split('\n');
  lines.forEach(function(line, idx) {
    var m = line.match(/window\.__(\w+)\s*=\s*\{/);
    if (m) {
      // Extract all keys from this export object
      var inBlock = false;
      windowExports[m[1]] = { file: file, line: idx + 1 };
    }
  });
});

Object.keys(windowExports).sort().forEach(function(name) {
  var exp = windowExports[name];
  console.log('window.__' + name + ' — ' + exp.file + ':' + exp.line);
});

console.log('\n=== AUDIT SUMMARY ===');
console.log('Files scanned: ' + ALL_FILES.length);
console.log('Total declarations: ' + Object.keys(declMap).length);
console.log('Dead code candidates: ' + candidates.length);
console.log('\nNote: Candidates marked with 1 reference are just their own declaration line.');
console.log('Review manually — some may be exported via window.__ objects or event handlers.\n');
