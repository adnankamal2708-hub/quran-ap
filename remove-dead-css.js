var fs = require('fs');
var c = fs.readFileSync('styles.css', 'utf8');

// Section boundaries (byte offsets in the file)
var sections = [
  // 1. Modern Dashboard Hero: from its comment to just before "Reduced motion preference"
  { start: 55665, end: 61575, name: 'Modern Dashboard Hero (dh-*)' },
  // 2. Learning Path Dashboard: from its header to just before "Splash Screen"
  { start: 73083, end: 78493, name: 'Learning Path Dashboard' },
  // 3. Personalized Learning Insights: from its header to just before "LEARNING ANALYTICS"
  { start: 83658, end: 86484, name: 'Personalized Learning Insights (insights-*)' },
];

// Remove sections in reverse order to preserve byte offsets
var result = c;
sections.sort(function(a, b) { return b.start - a.start; });
sections.forEach(function(s) {
  var before = result.substring(0, s.start);
  var after = result.substring(s.end);
  result = before + after;
  console.log('Removed ' + s.name + ' (' + (s.end - s.start) + ' bytes)');
});

// Clean up any resulting double newline artifacts
result = result.replace(/\n\n\n+/g, '\n\n');

fs.writeFileSync('styles.css', result, 'utf8');
console.log('Done. New length: ' + result.length + ' (was ' + c.length + ', removed ' + (c.length - result.length) + ' bytes)');
