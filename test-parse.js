// Test parsing with detailed error
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'js/data/words-surah-62-jumuah.js';
const src = fs.readFileSync(file, 'utf8');

try {
  const script = new vm.Script(src, { filename: file });
  const context = vm.createContext({ ALL_WORDS: [] });
  script.runInContext(context);
  console.log('OK: ' + context.ALL_WORDS.length + ' words');
} catch (e) {
  console.log('Error: ' + e.message);
  if (e.stack) {
    // Extract line from stack
    const match = e.stack.match(new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+):(\\d+)'));
    if (match) {
      const line = parseInt(match[1]);
      const col = parseInt(match[2]);
      console.log('Line ' + line + ', column ' + col);
      const lines = src.split('\n');
      console.log('Content: ' + lines[line - 1]);
      console.log('Context:');
      for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 2); i++) {
        console.log((i + 1) + ': ' + lines[i]);
      }
    }
  }
}
