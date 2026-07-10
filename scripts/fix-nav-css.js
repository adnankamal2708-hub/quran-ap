const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Fix the bounce curve — reduce overshoot to be safe
css = css.replace(
  'transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1),\n              opacity 0.25s ease;',
  'transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),\n              opacity 0.25s ease;'
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ Fixed bounce curve');
