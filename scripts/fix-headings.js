// Fix semantic heading hierarchy in app.js
var fs = require('fs');
var path = require('path');

var appPath = path.join(__dirname, '..', 'js', 'app.js');
var content = fs.readFileSync(appPath, 'utf8');

// 1. Fix foundation unlock titles (3 occurrences: foundation, surah, lesson modes)
content = content.replace(
  /<div class="foundation-unlock-title" style="font-size:11px;color:var\(--gold\);font-weight:500;margin-bottom:6px">([^<]+)<\/div>/g,
  '<h3 class="foundation-unlock-title" style="font-size:11px;color:var(--gold);font-weight:500;margin:0 0 6px 0">$1</h3>'
);

// 2. Fix "Your Journey" headings (3 occurrences: foundation, surah, lesson modes)
content = content.replace(
  /<div style="font-size:11px;font-weight:500;color:var\(--text\);margin-bottom:8px">([^<]+)<\/div>/g,
  '<h4 style="font-size:11px;font-weight:500;color:var(--text);margin:0 0 8px 0">$1</h4>'
);

fs.writeFileSync(appPath, content, 'utf8');
console.log('✓ Fixed semantic headings in app.js');
