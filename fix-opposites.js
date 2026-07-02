// Debug: find words missing oppositeWords and report what fields they have
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'js', 'data');

var allFiles = fs.readdirSync(DATA_DIR).filter(function(f) { return /^words-.*\.js$/.test(f); });
allFiles.sort();

var totalMissing = 0;

allFiles.forEach(function(file) {
  var content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');

  // Extract word objects using a simple approach
  // Count opening braces and find matching pairs
  var words = [];
  var depth = 0;
  var wordStart = -1;

  for (var i = 0; i < content.length; i++) {
    var ch = content[i];
    if (ch === '{') {
      if (depth === 0) wordStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && wordStart >= 0) {
        words.push({ start: wordStart, end: i + 1, text: content.substring(wordStart, i + 1) });
        wordStart = -1;
      }
    }
  }

  // For words within ALL_WORDS.push(...)
  var pushIdx = -1;
  var wordEntries = [];
  do {
    pushIdx = content.indexOf('ALL_WORDS.push(', pushIdx + 1);
    if (pushIdx >= 0) {
      var pdepth = 0;
      for (var i = pushIdx; i < content.length; i++) {
        if (content[i] === '(') pdepth++;
        else if (content[i] === ')') {
          pdepth--;
          if (pdepth === 0) {
            // Find all top-level objects in this push block
            var blockText = content.substring(pushIdx, i + 1);
            var odepth = 0;
            var ostart = -1;
            for (var j = 0; j < blockText.length; j++) {
              if (blockText[j] === '{') {
                if (odepth === 0) ostart = j;
                odepth++;
              } else if (blockText[j] === '}') {
                odepth--;
                if (odepth === 0 && ostart >= 0) {
                  var objText = blockText.substring(ostart, j + 1);
                  // Check if it has oppositeWords
                  if (objText.indexOf('oppositeWords') < 0) {
                    var arabic = (objText.match(/arabic:\s*'([^']*)'/) || [])[1] || '?';
                    console.log('MISSING: ' + file + ' - ' + arabic);
                    totalMissing++;
                  }
                  ostart = -1;
                }
              }
            }
            break;
          }
        }
      }
    }
  } while (pushIdx >= 0);
});

console.log('\nTotal words missing oppositeWords: ' + totalMissing);
