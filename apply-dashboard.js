var fs = require('fs');
var cwd = process.cwd().replace(/\\/g, '/');
var c = fs.readFileSync(cwd + '/js/ui.js', 'utf8');
var newFn = fs.readFileSync(cwd + '/renderDashboard-replacement.js', 'utf8');

// Find renderDashboard function boundaries
var fnIdx = c.indexOf('function renderDashboard()');
if (fnIdx < 0) { console.log('ERROR: renderDashboard not found'); process.exit(1); }

var brace = c.indexOf('{', fnIdx);
var depth = 1;
var end = brace;
for (var i = brace + 1; i < c.length && depth > 0; i++) {
  if (c[i] === '{') depth++;
  else if (c[i] === '}') { depth--; if (depth === 0) end = i; }
}

var parts = [
  c.substring(0, fnIdx),       // before function
  newFn,                        // new function
  c.substring(end + 1)          // after function
];
var result = parts.join('');

fs.writeFileSync(cwd + '/js/ui.js', result, 'utf8');
console.log('OK: replacement done, new length: ' + result.length);
