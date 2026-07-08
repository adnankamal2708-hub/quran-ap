const fs = require('fs');
const c = fs.readFileSync('js/ui.js', 'utf8');
// Remove $coveragePct line
const c1 = c.replace(/\n  var \$coveragePct = [^;]+;\n/g, '\n\n');
// Remove $nextLessonIdx line
const c2 = c1.replace(/\n  var \$nextLessonIdx = [^;]+;\n/g, '\n\n');
// Clean triple blank lines
const c3 = c2.replace(/\n\n\n+/g, '\n\n');
fs.writeFileSync('js/ui.js', c3, 'utf8');
console.log('Done. Has coveragePct:', c3.includes('coveragePct'));
console.log('Has nextLessonIdx:', c3.includes('nextLessonIdx'));
