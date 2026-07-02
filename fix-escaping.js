// Fix double-backslash escaping issues in surah data files
const fs = require('fs');

// Read all 20 files and fix translit values with double backslash
for (let i = 61; i <= 80; i++) {
  const dir = fs.readdirSync('js/data').filter(f => f.startsWith('words-surah-' + i + '-'));
  if (dir.length === 0) continue;
  
  const f = 'js/data/' + dir[0];
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;

  // Find all translit lines with double backslash and fix them
  // The pattern in the file is: translit: 'Fas\\'aw',
  // We need to change it to: translit: "Fas'aw",
  
  // Use a simple per-line approach
  const lines = content.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    
    // Match translit: '...\\'...',
    if (trimmed.startsWith('translit:') && trimmed.includes("\\\\'")) {
      // Extract the value between outer single quotes after "translit: "
      const match = trimmed.match(/^translit:\s+'(.*)'\s*,$/);
      if (match) {
        const oldVal = match[1];
        // Replace double backslash followed by quote with just the quote
        const newVal = oldVal.replace(/\\\\'/g, "'");
        // Create new line with double quotes
        const indent = line.substring(0, line.indexOf('translit'));
        const newLine = indent + 'translit: "' + newVal + '",';
        lines[li] = newLine;
      }
    }
  }
  
  content = lines.join('\n');
  
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed: ' + dir[0]);
  } else {
    console.log('OK: ' + dir[0]);
  }
}

console.log('\nDone');
