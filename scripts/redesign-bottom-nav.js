const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// ============================================================
// REPLACEMENT 1: .bottom-nav container
// ============================================================
const oldBottomNav = `.bottom-nav {
  flex-shrink: 0;
  border-top: 1px solid rgba(46,43,36,0.6);
  background: rgba(15,14,12,0.85);
  -webkit-backdrop-filter: blur(16px) saturate(1.8);
  backdrop-filter: blur(16px) saturate(1.8);
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  display: flex;
  gap: 2px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.2);
  position: relative;
  z-index: 10;
}`;

const newBottomNav = `.bottom-nav {
  flex-shrink: 0;
  border-top: 1px solid rgba(46,43,36,0.5);
  background: rgba(12,11,10,0.92);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  backdrop-filter: blur(20px) saturate(1.6);
  padding: 4px 6px calc(4px + env(safe-area-inset-bottom));
  display: flex;
  align-items: stretch;
  gap: 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.3);
  position: relative;
  z-index: 10;
  min-height: 56px;
}`;

if (css.includes(oldBottomNav)) {
  css = css.replace(oldBottomNav, newBottomNav);
  console.log('✅ Replaced .bottom-nav');
} else {
  console.log('⚠️ Could not find .bottom-nav block');
}

// ============================================================
// REPLACEMENT 2: Entire nav-tab section + nav-brand section
// (from "/* ── Bottom Nav Tabs ── */" through nav-brand end)
// ============================================================
const oldNavSection = `/* ── Bottom Nav Tabs ───────────────────────────────────────── */
.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px;
  min-height: 48px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--body);
  position: relative;
}

.nav-tab::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--gold);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-tab:hover {
  color: var(--text);
  background: var(--surface2);
}

.nav-tab:focus-visible {
  outline: 2px solid var(--gold-dim);
  outline-offset: 2px;
}

.nav-tab.active {
  color: var(--gold);
}

.nav-tab.active::after {
  width: 24px;
}

.nav-tab-icon {
  font-size: 17px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.nav-tab.active .nav-tab-icon {
  transform: scale(1.1);
}

.nav-tab-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.8;
}

@media (max-width: 380px) {
  .nav-tab { padding: 5px 3px; }
  .nav-tab-icon { font-size: 15px; }
  .nav-tab-label { font-size: 8px; }
/* ── Bottom Nav Brand Watermark ──────────────────────────── */
.nav-brand {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  flex-shrink: 0;
  pointer-events: none;
  user-select: none;
  opacity: 0.18;
  transition: opacity 0.35s ease;
}

.bottom-nav:hover .nav-brand {
  opacity: 0.45;
}

.nav-brand-icon {
  font-size: 11px;
  line-height: 1;
}

.nav-brand-text {
  font-size: 8px;
  font-family: var(--serif);
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 500;
}

@media (max-width: 380px) {
  .nav-brand { padding: 3px 4px; }
  .nav-brand-icon { font-size: 9px; }
  .nav-brand-text { font-size: 7px; }
}

}`;

const newNavSection = `/* ── Bottom Nav Tabs ───────────────────────────────────────── */
/* Sliding gold pill indicator */
.bn-indicator {
  position: absolute;
  top: 4px;
  left: 0;
  width: calc(100% / 6);
  height: calc(100% - 8px - env(safe-area-inset-bottom, 0px));
  background: rgba(201,168,76,0.10);
  border: 1px solid rgba(201,168,76,0.15);
  border-radius: 12px;
  pointer-events: none;
  transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1),
              opacity 0.25s ease;
  z-index: 0;
  will-change: transform;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 2px 4px;
  min-height: 48px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--body);
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
}

.nav-tab:hover {
  color: var(--text);
}

.nav-tab:focus-visible {
  outline: 2px solid var(--gold-dim);
  outline-offset: 1px;
  border-radius: 12px;
}

.nav-tab.active {
  color: var(--gold);
}

.nav-tab-icon {
  font-size: 18px;
  line-height: 1;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              filter 0.2s ease;
  filter: saturate(0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.nav-tab.active .nav-tab-icon {
  transform: scale(1.15);
  filter: saturate(1);
}

.nav-tab-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.75;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.2;
}

.nav-tab.active .nav-tab-label {
  opacity: 1;
  font-weight: 600;
}

/* Responsive: narrow screens */
@media (max-width: 380px) {
  .bottom-nav {
    padding: 3px 4px calc(3px + env(safe-area-inset-bottom));
    min-height: 50px;
  }
  .nav-tab {
    padding: 4px 2px 3px;
    min-height: 42px;
  }
  .nav-tab-icon {
    font-size: 16px;
    width: 20px;
    height: 20px;
  }
  .nav-tab-label {
    font-size: 8px;
    letter-spacing: 0.04em;
  }
  .bn-indicator {
    top: 3px;
    border-radius: 10px;
  }
}

/* Responsive: larger screens / tablets */
@media (min-width: 481px) {
  .bottom-nav {
    padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
    min-height: 64px;
  }
  .nav-tab {
    gap: 2px;
    padding: 8px 4px 6px;
  }
  .nav-tab-icon {
    font-size: 20px;
    width: 28px;
    height: 28px;
  }
  .nav-tab-label {
    font-size: 10px;
  }
  .bn-indicator {
    border-radius: 14px;
  }
}

/* Reduced motion: disable animations */
@media (prefers-reduced-motion: reduce) {
  .bn-indicator {
    transition: none;
  }
  .nav-tab-icon {
    transition: none;
  }
  .nav-tab.active .nav-tab-icon {
    transform: none;
  }
}`;

if (css.includes(oldNavSection)) {
  css = css.replace(oldNavSection, newNavSection);
  console.log('✅ Replaced nav-tab + nav-brand section');
} else {
  console.log('⚠️ Could not find nav-tab/nav-brand section - searching for partial match...');
  // Fallback: try with modified whitespace
  if (css.includes('Bottom Nav Tabs')) {
    // Find the start and end of the section
    const startMarker = '/* ── Bottom Nav Tabs ──';
    const endMarker = '/* ── Quiz ──';
    const startIdx = css.indexOf(startMarker);
    const endIdx = css.indexOf(endMarker);
    if (startIdx >= 0 && endIdx > startIdx) {
      const oldSection = css.substring(startIdx, endIdx);
      css = css.replace(oldSection, newNavSection);
      console.log('✅ Replaced nav-tab section via fallback');
    }
  }
}

// ============================================================
// Write the modified CSS back
// ============================================================
fs.writeFileSync(cssPath, css, 'utf8');
console.log('\n✅ styles.css updated successfully');
console.log('File size:', css.length, 'bytes');
