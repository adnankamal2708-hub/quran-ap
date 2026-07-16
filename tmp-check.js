var fs = require('fs');
var cp = require('child_process');
// Get the previous commit's app.bundle.min.js
try {
  var buf = cp.execSync('git show HEAD:js/app.bundle.min.js', { encoding: 'buffer' });
  var prev = buf.toString('utf8');
  console.log('Previous build size:', prev.length);
  try {
    new Function(prev);
    console.log('PREVIOUS BUILD: PARSE OK');
  } catch(e) {
    console.log('PREVIOUS BUILD: SYNTAX ERROR:', e.message.substring(0,150));
  }
} catch(e) {
  console.log('Could not get previous build:', e.message);
}

// Check current build
var current = fs.readFileSync('js/app.bundle.min.js', 'utf8');
console.log('Current build size:', current.length);
try {
  new Function(current);
  console.log('CURRENT BUILD: PARSE OK');
} catch(e) {
  console.log('CURRENT BUILD: SYNTAX ERROR:', e.message.substring(0,150));
}
