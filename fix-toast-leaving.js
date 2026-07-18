// Fix the toast-leaving CSS block that got mangled during extraction
const fs = require('fs');
var css = fs.readFileSync('styles.css', 'utf8');

// The problem: after the .toast-warning closing brace, there's
// an orphaned animation property and two extra closing braces.
// The correct structure should have .toast-container .toast.toast-leaving { ... }

// Fix: Replace the orphaned block with a proper toast-leaving rule
var fixed = css.replace(
  '  border-left: 3px solid var(--gold);\n}\n\n  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n}\n\n/* ── Inline Style Replacement Utilities ── */',
  '  border-left: 3px solid var(--gold);\n}\n\n.toast-container .toast.toast-leaving {\n  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n\n/* ── Inline Style Replacement Utilities ── */'
);

fs.writeFileSync('styles.css', fixed, 'utf8');
console.log('Fixed toast-leaving CSS block');

// Verify by running the regression test
var exec = require('child_process').execSync;
var result = exec('node test/regression.test.js 2>&1').toString();
var lines = result.split('\n');
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('Results:') >= 0 || lines[i].indexOf('CSS') >= 0 || lines[i].indexOf('brace') >= 0) {
    console.log(lines[i]);
  }
}
