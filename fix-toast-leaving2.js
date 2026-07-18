// Precisely fix the broken toast-leaving CSS section
const fs = require('fs');
var css = fs.readFileSync('styles.css', 'utf8');

// The exact problem area:
// Line 4631: }  (closing .toast-warning)
// Line 4632: (empty)
// Line 4633:   animation: fadeOut ...;
// Line 4634: }
// Line 4635: }
// Line 4636: (empty)
// Line 4637: /* ── Inline Style Replacement Utilities ── */

// We need to replace lines 4632-4635 with the proper .toast-leaving block

var fixed = css.replace(
  '}\n\n  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n}\n\n/* ── Inline Style Replacement Utilities ── */',
  '}\n\n.toast-container .toast.toast-leaving {\n  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n\n/* ── Inline Style Replacement Utilities ── */'
);

fs.writeFileSync('styles.css', fixed, 'utf8');
console.log('Done');

// Verify brace balance
var content = fs.readFileSync('styles.css', 'utf8');
var open = 0, close = 0;
for (var i = 0; i < content.length; i++) {
  if (content[i] === '{') open++;
  if (content[i] === '}') close++;
}
console.log('Open braces:', open, 'Close braces:', close, 'Balance:', open - close);

// Run regression test
var exec = require('child_process').execSync;
try {
  var result = exec('node test/regression.test.js 2>&1').toString();
  var lines = result.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('Results:') >= 0) {
      console.log(lines[i].trim());
    }
  }
} catch (e) {
  console.log('Regression test exit code:', e.status);
  console.log(e.stdout.toString().split('\n').filter(function(l) { 
    return l.indexOf('Results:') >= 0 || l.indexOf('brace') >= 0 || l.indexOf('FAIL') >= 0;
  }).join('\n'));
}
