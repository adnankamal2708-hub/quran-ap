// Find unbalanced braces in test/analytics.test.js
const fs = require('fs');
const lines = fs.readFileSync('test/analytics.test.js', 'utf8').split('\n');

const stack = [];
for (let i = 0; i < lines.length; i++) {
  for (let j = 0; j < lines[i].length; j++) {
    const ch = lines[i][j];
    if ('{(['.includes(ch)) {
      stack.push({ ch, line: i + 1, col: j });
    } else if ('})]'.includes(ch)) {
      if (stack.length === 0) {
        console.log(`EXTRA closing '${ch}' at line ${i+1}, col ${j}: ${lines[i].trim().substring(0, 60)}`);
      } else {
        const expected = {'}':'{', ']':'[', ')':'('}[ch];
        const last = stack.pop();
        if (last.ch !== expected) {
          console.log(`MISMATCH: expected '${expected}' but found '${ch}' at line ${i+1}: ${lines[i].trim().substring(0, 60)}`);
          console.log(`  Last opened: '${last.ch}' at line ${last.line}`);
        }
      }
    }
  }
}

console.log(`\nTotal lines: ${lines.length}`);
console.log(`Unclosed constructs: ${stack.length}`);
for (const s of stack) {
  const snippet = lines[s.line - 1].trim().substring(0, 80);
  console.log(`  Unclosed '${s.ch}' at line ${s.line}, col ${s.col}: ${snippet}`);
}
