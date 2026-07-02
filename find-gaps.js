// Find all optional metadata gaps using the validator's regex parser
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'js', 'data');

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch (e) { return ''; }
}

function extractWordsFromFile(content, fileName) {
  var words = [];
  try {
    var pushBlocks = content.match(/ALL_WORDS\.push\(([\s\S]*?)\);/g);
    if (!pushBlocks) return words;
    pushBlocks.forEach(function(block) {
      var inner = block.replace(/ALL_WORDS\.push\(/, '').replace(/\);$/, '').trim();
      var depth = 0, start = 0;
      for (var i = 0; i < inner.length; i++) {
        var ch = inner[i];
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') {
          depth--;
          if (depth === 0 && start < i) {
            var objStr = inner.substring(start, i + 1);
            try {
              var fn = new Function('return ' + objStr);
              var result = fn();
              if (result && typeof result === 'object') {
                result._sourceFile = fileName;
                words.push(result);
              }
            } catch (e2) { /* skip parse errors */ }
          }
        }
      }
    });
  } catch (e) { /* skip */ }
  return words;
}

var allFiles = fs.readdirSync(DATA_DIR).filter(function(f) { return /^words-.*\.js$/.test(f); });
allFiles.sort();

var parsedCount = 0;
var allWords = [];
var failedFiles = [];

allFiles.forEach(function(f) {
  var content = readFile(path.join(DATA_DIR, f));
  var words = extractWordsFromFile(content, f);
  if (words.length > 0) {
    parsedCount++;
  } else {
    failedFiles.push(f);
  }
  allWords = allWords.concat(words);
});

console.log('Total files: ' + allFiles.length);
console.log('Successfully parsed: ' + parsedCount);
console.log('Failed to parse: ' + failedFiles.length);
if (failedFiles.length > 0) {
  console.log('Failed files: ' + failedFiles.join(', '));
}
console.log('Total words extracted: ' + allWords.length);
console.log('');

// Check each optional field
var fieldsToCheck = ['pattern', 'similarWords', 'oppositeWords', 'relatedWords'];
var gaps = {};

fieldsToCheck.forEach(function(f) { gaps[f] = []; });

allWords.forEach(function(w) {
  var file = w._sourceFile || 'unknown';
  fieldsToCheck.forEach(function(f) {
    var val = w[f];
    // For optional fields: empty array, undefined, or null = gap
    var isGap = val === undefined || val === null || 
                (Array.isArray(val) && val.length === 0) ||
                (typeof val === 'string' && val.trim() === '');
    if (isGap) {
      gaps[f].push({
        file: file,
        arabic: w.arabic || '',
        translit: w.translit || '',
        english: w.english || '',
        id: w.id || 'unknown'
      });
    }
  });
});

console.log('=== GAPS FOUND ===');
var totalGaps = 0;
fieldsToCheck.forEach(function(f) {
  if (gaps[f].length > 0) {
    console.log('\n' + f + ': ' + gaps[f].length + ' gaps');
    totalGaps += gaps[f].length;
  }
});
console.log('\nTotal gaps: ' + totalGaps);
console.log('');

// Print all words with gaps grouped by file
var byFile = {};
fieldsToCheck.forEach(function(f) {
  gaps[f].forEach(function(g) {
    if (!byFile[g.file]) byFile[g.file] = {};
    if (!byFile[g.file][f]) byFile[g.file][f] = [];
    byFile[g.file][f].push(g.arabic || g.translit || g.english || '?');
  });
});

console.log('=== DETAILED BREAKDOWN BY FILE ===');
Object.keys(byFile).sort().forEach(function(file) {
  var fields = byFile[file];
  console.log('\n' + file + ':');
  Object.keys(fields).sort().forEach(function(f) {
    console.log('    ' + f + ' (' + fields[f].length + '): ' + fields[f].join(', '));
  });
});
