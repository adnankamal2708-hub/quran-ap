var fs = require('fs');
var c = fs.readFileSync('js/profile-ui.js', 'utf8');

// Simulate the build.js comment stripping
var stripped = c
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/\n{3,}/g, '\n\n');

// Check if any URLs were damaged
var lines = stripped.split('\n');
for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  // Look for lines that have "https://" or "http://" that got truncated
  if (line.indexOf('https') >= 0 || line.indexOf('http') >= 0) {
    console.log('Line ' + (i+1) + ': ' + line.substring(0, 150));
  }
  // Also check for damaged lines (missing closing of string)
  if (line.indexOf('github') >= 0) {
    console.log('LINE with github: ' + JSON.stringify(line.substring(0, 100)));
  }
}
