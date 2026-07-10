/**
 * R1: Replace emoji nav icons with consistent SVG icon system
 * Run: node scripts/polish-r1-nav-icons.js
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// SVG icon definitions with consistent stroke-width=1.5, viewBox="0 0 24 24"
// All 24x24, stroke="currentColor", fill="none", stroke-linecap="round", stroke-linejoin="round"

const svgIcons = {
  // Dashboard / Paths - Stacked books icon
  '📚': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/><path d="M14 2v7l-2-1.5L10 9V2"/></svg>',
  // Learn - Open book
  '📖': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  // Quiz - Pencil/edit
  '✏️': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  // Words - List
  '📋': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  // Stats - Bar chart
  '📊': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  // Analytics - Trending up
  '📈': '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  // User avatar (for user-btn)
  '👤': '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

// Replace nav tab icons
Object.keys(svgIcons).forEach(emoji => {
  const svg = svgIcons[emoji];
  // Only replace in nav-tab-icon spans within bottom-nav
  // Match: <span class="nav-tab-icon">{emoji}</span>
  const regex = new RegExp(`(<span class="nav-tab-icon">)${escapeRegex(emoji)}(</span>)`, 'g');
  html = html.replace(regex, `$1${svg}$2`);
});

// Replace user avatar emoji
const userBtnRegex = /(<span class="user-avatar-small">)👤(<\/span>)/;
html = html.replace(userBtnRegex, `$1${svgIcons['👤']}$2`);

// Update CSS for nav-tab-icon to handle SVG sizing
html = html.replace(
  '</head>',
  `<style>
  /* R1: SVG icon sizing for nav tabs */
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
</style>
</head>`
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ R1: Nav tab emoji icons replaced with SVG icons');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
