// Fix ALL escaping issues in surah 61-80 files
const fs = require('fs');

for (let i = 61; i <= 80; i++) {
  const dir = fs.readdirSync('js/data').filter(f => f.startsWith('words-surah-' + i + '-'));
  if (dir.length === 0) continue;
  
  const f = 'js/data/' + dir[0];
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;

  // Replace all escaped double quotes \" with just " 
  content = content.replace(/\\"/g, '"');
  
  // Replace escaped single quotes \' with just '
  // But only within single-quoted string contexts - this is tricky
  // Since all string delimiters are now proper quotes, just replace \' with '
  content = content.replace(/\\'/g, "'");
  
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed: ' + dir[0]);
  }
}

console.log('\nDone');
