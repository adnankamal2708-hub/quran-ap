// Fix CSS toast section: properly close @media block and remove extra brace

const fs = require('fs');
const css = fs.readFileSync('styles.css', 'utf8');

// Fix 1: Remove the stray 'n}' and replace with proper closing of @media block
// The @media (max-width: 380px) should contain: dashboard-hero-stats, onboarding-card, onboarding-icon
// Then close. The toast rules should be standalone.

// Find the problematic pattern and fix it
var fixed = css;

// Fix the stray 'n}' in the @media block
fixed = fixed.replace(
  '.dashboard-hero-stats { grid-template-columns: repeat(2, 1fr); }\nn}\n\n/* ── Toast Notification System ── */\n  .onboarding-card',
  '.dashboard-hero-stats { grid-template-columns: repeat(2, 1fr); }\n}\n\n/* ── Toast Notification System ── */\n.onboarding-card'
);

// Fix the indented onboarding rules that ended up outside the @media
fixed = fixed.replace(
  '\n  .onboarding-card { padding: 28px 20px 24px; }\n  .onboarding-icon { font-size: 44px; }\n  .onboarding-title { font-size: 17px; }\n  .toast-container {',
  '\n.onboarding-card { padding: 28px 20px 24px; }\n.onboarding-icon { font-size: 44px; }\n.onboarding-title { font-size: 17px; }\n.toast-container {'
);

// Fix the double closing brace after toast-leaving animation
fixed = fixed.replace(
  '  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n}\n\n/* ── Inline Style Replacement Utilities ──*/',
  '  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n\n/* ── Inline Style Replacement Utilities ──*/'
);

// Also try variant without space before */
fixed = fixed.replace(
  '  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n}\n\n/* ── Inline Style Replacement Utilities ── */',
  '  animation: fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;\n}\n\n/* ── Inline Style Replacement Utilities ── */'
);

fs.writeFileSync('styles.css', fixed, 'utf8');
console.log('CSS fixed successfully');

// Verify the fix
var content = fs.readFileSync('styles.css', 'utf8');
var lines = content.split('\n');
console.log('\nVerification:');
for (var i = 4575; i < Math.min(4610, lines.length); i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
