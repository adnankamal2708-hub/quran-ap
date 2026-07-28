// Temporary investigation script — compare Arabic character sets
var fs = require('fs');
var path = require('path');
var vm = require('vm');

// Create a sandbox with window global
var sandbox = { window: {}, console: console };
var context = vm.createContext(sandbox);

// Load Quran corpus
var quranCode = fs.readFileSync(path.join(__dirname, 'js/quran/quran-data.js'), 'utf8');
vm.runInContext(quranCode, context);
var QURAN_TEXT = context.QURAN_TEXT;

// Load vocabulary files
var ALL_WORDS = [];
var vocabDir = path.join(__dirname, 'js/data');
var vocabFiles = fs.readdirSync(vocabDir).filter(function(f) { return f.startsWith('words-') && f.endsWith('.js'); });
vocabFiles.forEach(function(f) {
  var content = fs.readFileSync(path.join(vocabDir, f), 'utf8');
  try {
    var vSandbox = { ALL_WORDS: ALL_WORDS };
    vm.runInNewContext(content, vSandbox);
  } catch(e) {}
});

console.log('Loaded', Object.keys(QURAN_TEXT).length, 'surahs from Quran corpus');
console.log('Loaded', ALL_WORDS.length, 'vocabulary entries\n');

// Collect all unique Arabic characters from Quran text
var quranChars = {};
for (var sid = 1; sid <= 114; sid++) {
  var surah = QURAN_TEXT[sid];
  if (!surah) continue;
  for (var vi = 0; vi < surah.verses.length; vi++) {
    var text = surah.verses[vi].text;
    if (!text) continue;
    for (var ci = 0; ci < text.length; ci++) {
      var cp = text.charCodeAt(ci);
      if (cp >= 0x0600 && cp <= 0x06FF || cp >= 0x0750 && cp <= 0x077F || cp >= 0x08A0 && cp <= 0x08FF) {
        quranChars[cp] = (quranChars[cp] || 0) + 1;
      }
    }
  }
}

// Collect all unique Arabic characters from vocabulary words
var vocabChars = {};
ALL_WORDS.forEach(function(w) {
  if (!w.arabic) return;
  var text = w.arabic;
  for (var ci = 0; ci < text.length; ci++) {
    var cp = text.charCodeAt(ci);
    if (cp >= 0x0600 && cp <= 0x06FF || cp >= 0x0750 && cp <= 0x077F || cp >= 0x08A0 && cp <= 0x08FF) {
      vocabChars[cp] = (vocabChars[cp] || 0) + 1;
    }
  }
});

// Print characters that are in Quran corpus but not in vocabulary
console.log('=== CHARACTERS IN QURAN CORPUS BUT NOT IN VOCABULARY (potential Uthmani variants) ===');
var quranOnly = [];
Object.keys(quranChars).forEach(function(cp) {
  if (!vocabChars[cp]) {
    quranOnly.push({ cp: parseInt(cp), count: quranChars[cp] });
  }
});
quranOnly.sort(function(a,b) { return b.count - a.count; });
quranOnly.forEach(function(item) {
  var c = String.fromCharCode(item.cp);
  console.log('U+' + item.cp.toString(16).toUpperCase().padStart(4,'0') + ' ' + c + '  (' + item.count + ' occurrences)');
});

console.log('\n=== CHARACTERS IN VOCABULARY BUT NOT IN QURAN ===');
var vocabOnly = [];
Object.keys(vocabChars).forEach(function(cp) {
  if (!quranChars[cp]) {
    vocabOnly.push({ cp: parseInt(cp), count: vocabChars[cp] });
  }
});
vocabOnly.sort(function(a,b) { return b.count - a.count; });
vocabOnly.forEach(function(item) {
  var c = String.fromCharCode(item.cp);
  console.log('U+' + item.cp.toString(16).toUpperCase().padStart(4,'0') + ' ' + c + '  (' + item.count + ' occurrences in vocab)');
});

console.log('\n=== TOP 10 VOCABULARY WORDS (by stored occ) ===');
ALL_WORDS.sort(function(a,b) { return (b.occ||0) - (a.occ||0); });
for (var i = 0; i < 10; i++) {
  var w = ALL_WORDS[i];
  console.log('occ=' + w.occ + ' "' + w.arabic + '" = ' + (w.english||''));
}

console.log('\n=== Matching attempt: Bismillah vocabulary word vs Quran verse ===');
// Find a word that we expect to match (like "الله" or "اللَّهِ")
var sampleWord = null;
for (var i = 0; i < ALL_WORDS.length; i++) {
  if (ALL_WORDS[i].arabic.indexOf('الله') >= 0 || ALL_WORDS[i].arabic.indexOf('اللَّهِ') >= 0) {
    sampleWord = ALL_WORDS[i];
    break;
  }
}
if (!sampleWord) sampleWord = ALL_WORDS[0];

console.log('Word: "' + sampleWord.arabic + '" (occ=' + sampleWord.occ + ')');
var verse = QURAN_TEXT[1].verses[0].text;
console.log('Quran 1:1: "' + verse + '"');

// Raw match
var found = verse.indexOf(sampleWord.arabic);
if (found >= 0) {
  console.log('✓ DIRECT MATCH at index', found);
} else {
  console.log('✗ NO DIRECT MATCH');
  
  // Analyze the verse tokens
  var tokens = verse.split(' ');
  console.log('\nVerse tokens:');
  tokens.forEach(function(t, i) {
    var chars = [];
    for (var ci = 0; ci < t.length; ci++) {
      chars.push('U+' + t.charCodeAt(ci).toString(16).toUpperCase().padStart(4,'0'));
    }
    console.log('  ['+i+'] "' + t + '"  chars: ' + chars.join(' '));
  });
  
  console.log('\nVocabulary word character breakdown:');
  for (var ci = 0; ci < sampleWord.arabic.length; ci++) {
    var c = sampleWord.arabic[ci];
    console.log('  ['+ci+'] U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0') + ' = ' + c);
  }
}
