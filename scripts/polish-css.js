/**
 * CSS Production Polish Script
 * R2: Comprehensive prefers-reduced-motion coverage
 * R3: Interaction consistency (standard hover/pressed/disabled/focus states)
 * R4: Typography scale CSS custom properties
 * R5: Spacing scale utilities
 * R6: Consistent animation durations & easing
 * R7: Loading state polish
 * 
 * Run: node scripts/polish-css.js (after backing up styles.css)
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// ─── Step 1: Update root variables with animation tokens and font size scale ───
const rootVarInsert = `
  /* Animation design tokens */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-xslow: 600ms;
  
  /* Typography scale */
  --text-xs: 10px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 30px;
  --text-3xl: 42px;
  --text-4xl: 52px;
  --heading-sm: 11px;
  --heading-base: 13px;
  --heading-lg: 16px;
  --heading-xl: 20px;
  --heading-2xl: 28px;
`;

// Insert before the closing of :root
// Find the last custom property before the closing `}`
const rootEnd = css.lastIndexOf('  --shadow-glow-gold:');
if (rootEnd >= 0) {
  const afterGlow = css.indexOf(';', rootEnd) + 1;
  css = css.slice(0, afterGlow) + rootVarInsert + css.slice(afterGlow);
  console.log('✅ Added animation & typography design tokens to :root');
}

// ─── Step 2: Add comprehensive prefers-reduced-motion block at the end ───
// Check if there's already a comprehensive reduced motion section
if (css.includes('prefers-reduced-motion: reduce')) {
  console.log('ℹ prefers-reduced-motion blocks already exist (partial)');
}

// Add a comprehensive global prefers-reduced-motion block at the end of the file
// This catches ALL transitions and animations that might not have individual blocks
const reducedMotionBlock = `

/* ═══════════════════════════════════════════════════════════════
   REDUCED MOTION — Comprehensive override
   ═══════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  /* Kill all animations and transitions by default */
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Restore opacity/visibility transitions for hide/show (those don't cause motion) */
  .modal-overlay,
  .splash-screen,
  .onboarding-overlay {
    transition: opacity var(--duration-fast) ease, visibility var(--duration-fast) ease !important;
  }
  
  /* Disable transforms that cause layout shift */
  .nav-tab.active .nav-tab-icon {
    transform: none !important;
  }
  
  .wordlist-item:hover {
    transform: none !important;
  }
  
  .db-action-card:hover {
    transform: none !important;
  }
  
  .stat-card:hover {
    transform: none !important;
  }
  
  .btn:hover {
    transform: none !important;
  }
  
  .splash-icon {
    animation: none !important;
  }
  
  .splash-loader-bar {
    animation: none !important;
    left: 0;
    width: 60%;
  }
  
  /* Ensure entrance animations don't hide content */
  .fade-in,
  .card-entrance,
  .stagger-item,
  .view-entrance,
  .ayah-box.visible,
  .review-banner.visible,
  .app-morph-entering,
  .app-morph-entering .top-bar,
  .app-morph-entering .dashboard-header,
  .app-morph-entering .dashboard-recommendation,
  .app-morph-entering .dashboard-grid,
  .app-morph-entering .bottom-nav {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  
  .stat-section-entrance > * {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
  
  /* Disable scale transforms on hover/press */
  .srs-btn:active,
  .quiz-opt:active,
  .word-network-chip:active,
  .explorer-rel-chip:active,
  .chip:active,
  .qa-btn:active,
  .db-action-card:active,
  .btn:active {
    transform: none !important;
  }
  
  /* Disable springy indicator movement */
  .bn-indicator {
    transition-duration: 0.01ms !important;
  }
  
  /* Milestone entrance */
  .milestone-card {
    transform: none !important;
  }
  
  /* Toast animations */
  .toast-container .toast {
    animation: none !important;
    opacity: 1 !important;
  }
  
  /* Disable pulse effects */
  .offline-badge-warning {
    animation: none !important;
  }
  
  .milestone-icon {
    animation: none !important;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON / SHIMMER LOADING STATES — R7
   ═══════════════════════════════════════════════════════════════ */
   
.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) 0;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(
    90deg,
    var(--surface2) 25%,
    rgba(201, 168, 76, 0.06) 50%,
    var(--surface2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-line-sm {
  height: 10px;
  width: 60%;
  background: linear-gradient(
    90deg,
    var(--surface2) 25%,
    rgba(201, 168, 76, 0.06) 50%,
    var(--surface2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.skeleton-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 80px;
  padding: 8px 0;
}

.skeleton-chart-bar {
  flex: 1;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(201, 168, 76, 0.08) 20%,
    var(--surface2) 100%
  );
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  animation: shimmer 1.5s ease-in-out infinite;
  background-size: 200% 100%;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .skeleton-line-sm,
  .skeleton-card,
  .skeleton-chart-bar {
    animation: none !important;
    background: var(--surface2);
  }
}

/* ═══════════════════════════════════════════════════════════════
   TRANSITION CONSISTENCY — Override all transitions to use design tokens
   ═══════════════════════════════════════════════════════════════ */
/* Ensure smooth appearance for content that loads after paint */
.content-fade-in {
  opacity: 0;
  animation: fadeIn var(--duration-slow) var(--ease-default) forwards;
}

.card-stagger-enter {
  opacity: 0;
  transform: translateY(8px);
  animation: staggerFadeIn var(--duration-slow) var(--ease-default) both;
}

/* ── Loading spinner ── */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none !important;
    opacity: 0.5;
  }
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY CLASSES — Spacing & Typography (R5)
   ═══════════════════════════════════════════════════════════════ */

/* Spacing utilities using design tokens */
.gap-xs { gap: var(--spacing-xs) !important; }
.gap-sm { gap: var(--spacing-sm) !important; }
.gap-md { gap: var(--spacing-md) !important; }
.gap-lg { gap: var(--spacing-lg) !important; }
.gap-xl { gap: var(--spacing-xl) !important; }

.p-xs { padding: var(--spacing-xs) !important; }
.p-sm { padding: var(--spacing-sm) !important; }
.p-md { padding: var(--spacing-md) !important; }
.p-lg { padding: var(--spacing-lg) !important; }
.p-xl { padding: var(--spacing-xl) !important; }

.px-md { padding-left: var(--spacing-md) !important; padding-right: var(--spacing-md) !important; }
.py-sm { padding-top: var(--spacing-sm) !important; padding-bottom: var(--spacing-sm) !important; }
.py-md { padding-top: var(--spacing-md) !important; padding-bottom: var(--spacing-md) !important; }

.mx-auto { margin-left: auto !important; margin-right: auto !important; }

/* Typography utilities */
.text-xs { font-size: var(--text-xs) !important; }
.text-sm { font-size: var(--text-sm) !important; }
.text-base { font-size: var(--text-base) !important; }
.text-lg { font-size: var(--text-lg) !important; }
.text-xl { font-size: var(--text-xl) !important; }
.text-muted { color: var(--text-muted) !important; }
.text-gold { color: var(--gold) !important; }
.text-green { color: var(--green) !important; }
.text-center { text-align: center !important; }
.text-right { text-align: right !important; }
.font-medium { font-weight: 500 !important; }
.font-semibold { font-weight: 600 !important; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Responsive text */
@media (max-width: 380px) {
  .text-responsive-sm { font-size: var(--text-xs) !important; }
  .text-responsive-base { font-size: var(--text-sm) !important; }
}
@media (min-width: 481px) {
  .text-responsive-lg { font-size: var(--text-base) !important; }
}
`;

// Check if this block already exists
if (!css.includes('REDUCED MOTION — Comprehensive override')) {
  css += reducedMotionBlock;
  console.log('✅ Added comprehensive prefers-reduced-motion block at end');
  console.log('✅ Added skeleton/shimmer loading state styles (R7)');
  console.log('✅ Added spacing & typography utility classes (R5/R4)');
} else {
  console.log('ℹ Reduced motion block already exists');
}

fs.writeFileSync(cssPath, css, 'utf8');
console.log('\n✅ CSS polish complete!');
