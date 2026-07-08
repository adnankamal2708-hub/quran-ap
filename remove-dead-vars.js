var fs = require('fs');
var path = require('path');
var filepath = path.join(process.cwd().replace(/\\/g, '/'), 'js/ui.js');
var c = fs.readFileSync(filepath, 'utf8');
var lines = c.split(/\r?\n/);
var newLines = [];
for (var i = 0; i < lines.length; i++) {
  var trimmed = lines[i].trim();
  // Skip dead variable lines
  if (trimmed.indexOf('$coveragePct =') >= 0 && trimmed.indexOf('var $coveragePct') >= 0) continue;
  if (trimmed.indexOf('$nextLessonIdx =') >= 0 && trimmed.indexOf('var $nextLessonIdx') >= 0) continue;
  newLines.push(lines[i]);
}
var result = newLines.join('\n');
// Clean up blank lines left by removal
result = result.replace(/\n\n\n+/g, '\n\n');
fs.writeFileSync(filepath, result, 'utf8');
console.log('OK: ' + (lines.length - newLines.length) + ' lines removed, new length: ' + result.length);
