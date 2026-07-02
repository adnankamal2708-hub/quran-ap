// Analyze missing OPTIONAL metadata fields
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'js', 'data');

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch (e) { return ''; }
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

// Load all word files
var allFiles = fs.readdirSync(DATA_DIR).filter(function(f) { return /^words-.*\.js$/.test(f); });
allFiles.sort();

var allWords = [];
allFiles.forEach(function(f) {
  var content = readFile(path.join(DATA_DIR, f));
  var words = extractWordsFromFile(content, f);
  allWords = allWords.concat(words);
});

// Focus on optional fields
var optFields = ['pattern', 'similarWords', 'oppositeWords', 'relatedWords'];
var optFieldLabels = {
  pattern: 'Morphological pattern',
  similarWords: 'Similar words array',
  oppositeWords: 'Opposite words array',
  relatedWords: 'Related words array'
};

console.log('Total words: ' + allWords.length + '\n');

var missingByField = {};
optFields.forEach(function(f) { missingByField[f] = 0; });

// Track files with gaps
var fileGaps = {};

allWords.forEach(function(w) {
  var file = w._sourceFile || 'unknown';
  if (!fileGaps[file]) fileGaps[file] = {};
  
  optFields.forEach(function(f) {
    var val = w[f];
    var isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
    if (isEmpty) {
      missingByField[f]++;
      if (!fileGaps[file][f]) fileGaps[file][f] = [];
      fileGaps[file][f].push(w.arabic || w.translit || w.english || '?');
    }
  });
});

console.log('=== MISSING OPTIONAL FIELDS SUMMARY ===');
var totalMissing = 0;
optFields.forEach(function(f) {
  console.log('  ' + optFieldLabels[f] + ' (' + f + '): ' + missingByField[f] + ' missing');
  totalMissing += missingByField[f];
});
console.log('  Total: ' + totalMissing);

console.log('\n=== WORDS WITH GAPS (by file) ===');
Object.keys(fileGaps).sort().forEach(function(file) {
  var fields = fileGaps[file];
  var fileTotal = 0;
  Object.keys(fields).forEach(function(f) { fileTotal += fields[f].length; });
  if (fileTotal > 0) {
    console.log('\n' + file + ' (' + fileTotal + ' missing):');
    Object.keys(fields).forEach(function(f) {
      var words = fields[f];
      console.log('  ' + f + ' [' + words.length + ']: ' + words.join(', '));
    });
  }
});
