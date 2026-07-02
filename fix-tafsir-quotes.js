// Fix broken tafsir fields: switch single-quoted strings to double-quoted
// when they contain unescaped single quotes.
const fs = require('fs');

for (let i = 61; i <= 80; i++) {
  const dir = fs.readdirSync('js/data').filter(f => f.startsWith('words-surah-' + i + '-'));
  if (dir.length === 0) continue;
  
  const f = 'js/data/' + dir[0];
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;

  // Fix tafsir lines: 'tafsir: '...''  ->  tafsir: "..."
  // Find lines starting with tafsir: that have odd quotes
  const lines = content.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('tafsir:')) {
      // Count single quotes in the line
      const matches = [...trimmed.matchAll(/'/g)];
      const quoteCount = matches.length;
      
      // If odd number of quotes, the string is broken
      // A properly quoted line would have 2 quotes (opening and closing) -> even
      if (quoteCount % 2 !== 0 && quoteCount > 0) {
        // Extract the value between first and last single quote
        const firstQ = trimmed.indexOf("'");
        const lastQ = trimmed.lastIndexOf("'");
        if (firstQ >= 0 && lastQ > firstQ) {
          const value = trimmed.substring(firstQ + 1, lastQ);
          // Switch to double quotes
          const indent = line.substring(0, line.indexOf('tafsir'));
          const newLine = indent + 'tafsir: "' + value + '",';
          lines[li] = newLine;
        }
      }
    }
    
    // Also check meaning fields (some might have ' in them)
    if (trimmed.startsWith('meaning:')) {
      const matches = [...trimmed.matchAll(/'/g)];
      const quoteCount = matches.length;
      
      if (quoteCount % 2 !== 0 && quoteCount > 0) {
        const firstQ = trimmed.indexOf("'");
        const lastQ = trimmed.lastIndexOf("'");
        if (firstQ >= 0 && lastQ > firstQ) {
          const value = trimmed.substring(firstQ + 1, lastQ);
          const indent = line.substring(0, line.indexOf('meaning'));
          const newLine = indent + 'meaning: "' + value + '",';
          lines[li] = newLine;
        }
      }
    }
  }
  
  content = lines.join('\n');
  
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed: ' + dir[0]);
  }
}

console.log('\nDone');
