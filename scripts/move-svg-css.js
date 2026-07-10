/**
 * Move SVG sizing CSS from index.html <head> inline style block to styles.css
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const cssPath = path.join(__dirname, '..', 'styles.css');

let html = fs.readFileSync(htmlPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

// Remove the injected style block from index.html
const styleRegex = /<style>\s*\/\* R1: SVG icon sizing for nav tabs \*\/\s*\.nav-tab-icon svg \{[\s\S]*?@media[\s\S]*?\}\s*<\/style>\s*\n?/;
html = html.replace(styleRegex, '');

// Add the SVG sizing rules to styles.css before the responsive section
const svgCss = `
/* ── Nav tab SVG icon sizing ─────────────────────────────── */
.nav-tab-icon svg {
  width: 20px;
  height: 20px;
  display: block;
}
.user-avatar-small svg {
  width: 16px;
  height: 16px;
}
@media (max-width: 380px) {
  .nav-tab-icon svg { width: 18px; height: 18px; }
}
@media (min-width: 481px) {
  .nav-tab-icon svg { width: 22px; height: 22px; }
}
`;

// Insert before the "Responsive: narrow screens" section or at a good location
// Let's insert it right after the nav-tab styles section
css = css.replace(
  '/* Responsive: narrow screens */',
  svgCss + '\n/* Responsive: narrow screens */'
);

fs.writeFileSync(htmlPath, html, 'utf8');
fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ SVG sizing CSS moved from index.html to styles.css');
console.log('✅ Removed inline style block from index.html');
