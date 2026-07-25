// Find CSS brace imbalance - 1893 open vs 1895 close (2 extra closing braces)
const fs = require('fs');
const css = fs.readFileSync('styles.css', 'utf8');
var lines = css.split('\n');

// Track brace balance per line to find anomalies
var balance = 0;
var anomalies = [];
for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  for (var c = 0; c < line.length; c++) {
    if (line[c] === '{') balance++;
    if (line[c] === '}') balance--;
  }
  if (balance < 0) {
    anomalies.push({ line: i + 1, text: line.trim(), balance: balance });
  }
}

console.log('Final balance:', balance); // should be 0
console.log('Anomalies found:', anomalies.length);
anomalies.forEach(function(a) {
  console.log('Line ' + a.line + ': balance=' + a.balance + ' | ' + a.text);
});

// Also check lines where balance goes negative
var bal = 0;
for (var i = 0; i < Math.min(lines.length, 4650); i++) {
  var line = lines[i];
  for (var c = 0; c < line.length; c++) {
    if (line[c] === '{') bal++;
    if (line[c] === '}') bal--;
  }
}

console.log('\nBalance at line 4650:', bal);

// Now let's find where the extra braces are in the toast section area
bal = 0;
var toastStart = 0;
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('Toast Notification System') >= 0) {
    toastStart = i;
    console.log('Toast section starts at line:', i + 1, 'balance:', bal);
  }
  for (var c = 0; c < lines[i].length; c++) {
    if (lines[i][c] === '{') bal++;
    if (lines[i][c] === '}') bal--;
  }
  if (i >= toastStart && toastStart > 0 && i <= toastStart + 60) {
    console.log('Line ' + (i + 1) + ': bal=' + bal + ' | ' + lines[i].trim().substring(0, 80));
  }
}
