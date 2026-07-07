const fs = require('fs');
const cssPath = 'styles.css';
let c = fs.readFileSync(cssPath, 'utf8');
const before = 'animation: appEntrance 0.65s cubic-bezier(0.35, 0, 0.15, 1) forwards;';
const after = 'animation: appEntrance 0.65s cubic-bezier(0.35, 0, 0.15, 1) forwards;\n  overflow: clip;';
if (c.includes(before)) {
  c = c.replace(before, after);
  fs.writeFileSync(cssPath, c);
  console.log('Fixed: overflow:clip added to .app-morph-entering');
} else {
  console.log('Pattern not found.');
  process.exit(1);
}
