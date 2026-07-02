// Fix ALL lines with odd single quotes by switching to double-quote delimiters
const fs = require('fs');

for (let i = 61; i <= 80; i++) {
  const dir = fs.readdirSync('js/data').filter(f => f.startsWith('words-surah-' + i + '-'));
  if (dir.length === 0) continue;
  
  const f = 'js/data/' + dir[0];
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;

  const lines = content.split('\n');
  let fixedCount = 0;
  
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    
    // Skip comment lines and blank lines
    if (trimmed.startsWith('//') || trimmed === '') continue;
    
    // Count single quotes (excluding those in comments at end of line)
    const qCount = (trimmed.match(/'/g) || []).length;
    
    // If odd number of quotes, the string is broken
    if (qCount > 0 && qCount % 2 !== 0) {
      // Extract indent
      const indent = line.substring(0, line.length - line.trimLeft().length);
      
      // Find the key (text before first single quote)
      const firstQuoteIdx = trimmed.indexOf("'");
      if (firstQuoteIdx < 0) continue;
      
      const beforeQuote = trimmed.substring(0, firstQuoteIdx);
      const afterQuote = trimmed.substring(firstQuoteIdx);
      
      // The value is everything between first and last single quote
      const lastQuoteIdx = trimmed.lastIndexOf("'");
      if (lastQuoteIdx <= firstQuoteIdx) continue;
      
      const value = trimmed.substring(firstQuoteIdx + 1, lastQuoteIdx);
      const suffix = trimmed.substring(lastQuoteIdx + 1);
      
      // Reconstruct with double quotes
      const newLine = indent + beforeQuote + '"' + value + '"' + suffix;
      lines[li] = newLine;
      fixedCount++;
    }
  }
  
  content = lines.join('\n');
  
  if (fixedCount > 0) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed ' + fixedCount + ' lines in: ' + dir[0]);
  }
}

console.log('\nDone');
