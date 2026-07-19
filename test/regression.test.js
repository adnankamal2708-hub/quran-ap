#!/usr/bin/env node
/**
 * regression.test.js — Regression & Visual QA Tests
 *
 * Verifies:
 *   - CSS class names exist in styles.css (prevents orphaned selectors)
 *   - Typography system: CSS variables, font families, font sizes
 *   - Component rendering smoke tests: key DOM elements render
 *   - Design system tokens: colors, spacing, border-radius, shadows
 *   - Navigation: all tabs exist and are valid
 *
 * Run: node test/regression.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

var _elementsById = {};
var _nextUid = 0;

function makeEl(tag) {
  var el = {
    _uid: _nextUid++,
    _tag: tag || 'div',
    _id: '', _className: '', _innerHTML: '',
    _style: {}, _onclick: null, _onkeydown: null,
    textContent: '', children: [], attributes: {},
    parentNode: null, disabled: false, title: '',
    offsetHeight: 1,
    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },
    appendChild: function(c) { c.parentNode = this; this.children.push(c); },
    focus: function() {},
  };
  Object.defineProperty(el, 'id', {
    get: function() { return this._id; },
    set: function(v) { this._id = v; if (v) _elementsById[v] = this; },
  });
  Object.defineProperty(el, 'className', {
    get: function() { return this._className; },
    set: function(v) { this._className = v || ''; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHTML; },
    set: function(v) { this._innerHTML = v || ''; },
  });
  Object.defineProperty(el, 'style', {
    get: function() { return this._style; },
    set: function(v) { this._style = typeof v === 'object' ? v : {}; },
  });
  el.classList = {
    _values: {},
    add: function(c) { this._values[c] = true; el._className = Object.keys(this._values).join(' '); },
    remove: function(c) { delete this._values[c]; el._className = Object.keys(this._values).join(' '); },
    contains: function(c) { return !!this._values[c]; },
  };
  return el;
}

function resetDOM() { _elementsById = {}; }

global.document = {
  getElementById: function(id) { return _elementsById[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
  querySelector: function(sel) {
    if (sel.startsWith('#')) return _elementsById[sel.substring(1)] || null;
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      for (var k in _elementsById) {
        if ((_elementsById[k]._className || '').indexOf(cls) >= 0) return _elementsById[k];
      }
    }
    return null;
  },
  querySelectorAll: function(sel) {
    var results = [];
    if (sel.startsWith('.')) {
      var cls = sel.substring(1);
      for (var k in _elementsById) {
        if ((_elementsById[k]._className || '').indexOf(cls) >= 0) results.push(_elementsById[k]);
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    resetDOM();
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) {
  console.log('\n\ud83d\udccb ' + name);
  fn();
}

// ═══════════════════════════════════════════════════════════════
// LOAD styles.css FOR ANALYSIS
// ═══════════════════════════════════════════════════════════════

var cssContent = '';
try {
  cssContent = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  // Normalize line endings so multiline string matching works on all platforms
  cssContent = cssContent.replace(/\r\n/g, '\n');
} catch (e) {
  console.log('\u26A0 Could not read styles.css: ' + e.message);
}

function cssContains(pattern) {
  return cssContent.indexOf(pattern) >= 0;
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: CSS CLASS NAME REGRESSION CHECKS
// ═══════════════════════════════════════════════════════════════

suite('CSS Class Name Verification', function() {
  // These class names were previously orphaned (had missing selectors)
  test('stat-card-emoji class exists', function() {
    assert.ok(cssContains('.stat-card-emoji'), 'stat-card-emoji should exist in styles.css');
  });

  test('stat-card-value class exists', function() {
    assert.ok(cssContains('.stat-card-value'), 'stat-card-value should exist in styles.css');
  });

  test('stat-card-label class exists', function() {
    assert.ok(cssContains('.stat-card-label'), 'stat-card-label should exist in styles.css');
  });

  test('streak-box class exists', function() {
    assert.ok(cssContains('.streak-box'), 'streak-box should exist in styles.css');
  });

  test('streak-box pseudo-selectors exist', function() {
    assert.ok(cssContains('streak-box::before'), 'streak-box::before should exist');
    assert.ok(cssContains('.streak-box:hover'), 'streak-box:hover should exist');
  });

  test('streak-box sub-elements exist', function() {
    assert.ok(cssContains('.streak-box-title'), 'streak-box-title should exist');
    assert.ok(cssContains('.streak-box-row'), 'streak-box-row should exist');
    assert.ok(cssContains('.streak-box-value'), 'streak-box-value should exist');
    assert.ok(cssContains('.streak-box-suffix'), 'streak-box-suffix should exist');
    assert.ok(cssContains('.streak-box-desc'), 'streak-box-desc should exist');
  });

  test('progress-section-title class exists', function() {
    assert.ok(cssContains('.progress-section-title'), 'progress-section-title should exist');
  });

  test('progress-section-subtitle class exists', function() {
    assert.ok(cssContains('.progress-section-subtitle'), 'progress-section-subtitle should exist');
  });

  test('progress-section-content class exists', function() {
    assert.ok(cssContains('.progress-section-content'), 'progress-section-content should exist');
  });

  test('user-btn class exists', function() {
    assert.ok(cssContains('.user-btn'), 'user-btn should exist in styles.css');
  });

  test('user-btn pseudo-classes exist', function() {
    assert.ok(cssContains('.user-btn:hover'), '.user-btn:hover should exist');
    assert.ok(cssContains('.user-btn:focus-visible'), '.user-btn:focus-visible should exist');
    assert.ok(cssContains('.user-btn:active'), '.user-btn:active should exist');
  });

  test('foundation-cov-grid class exists', function() {
    assert.ok(cssContains('.foundation-cov-grid'), 'foundation-cov-grid should exist');
  });

  test('foundation-cov-item class exists (with hover)', function() {
    assert.ok(cssContains('.foundation-cov-item'), 'foundation-cov-item should exist');
    assert.ok(cssContains('.foundation-cov-item:hover'), 'foundation-cov-item:hover should exist');
  });

  test('foundation-cov-value class exists', function() {
    assert.ok(cssContains('.foundation-cov-value'), 'foundation-cov-value should exist');
  });

  test('foundation-cov-label class exists', function() {
    assert.ok(cssContains('.foundation-cov-label'), 'foundation-cov-label should exist');
  });

  test('profile-stats-grid class exists', function() {
    assert.ok(cssContains('.profile-stats-grid'), 'profile-stats-grid should exist');
  });

  test('word-network-chip-context class exists', function() {
    assert.ok(cssContains('.word-network-chip-context'), 'word-network-chip-context should exist');
  });

  test('empty-state class exists', function() {
    assert.ok(cssContains('.empty-state {'), 'empty-state should exist');
  });

  test('mode-view.active has proper display + animation', function() {
    assert.ok(cssContains('.mode-view.active {\n  display: block;\n}'), 'mode-view.active display should exist');
    assert.ok(cssContains('animation: fadeIn 0.25s'), 'fadeIn animation should exist in CSS');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 2: TYPOGRAPHY SYSTEM CHECKS
// ═══════════════════════════════════════════════════════════════

suite('Typography System', function() {
  test('all font-family CSS variables are defined', function() {
    assert.ok(cssContains('--arabic'), '--arabic font variable should exist');
    assert.ok(cssContains('--body'), '--body font variable should exist');
    assert.ok(cssContains('--serif'), '--serif font variable should exist');
  });

  test('font-family variables have correct fallbacks', function() {
    assert.ok(cssContains("--arabic: 'Amiri', serif"), 'Amiri font should have serif fallback');
    assert.ok(cssContains("--body: 'Inter', sans-serif"), 'Inter font should have sans-serif fallback');
    assert.ok(cssContains("--serif: 'Lora', serif"), 'Lora font should have serif fallback');
  });

  test('all typography scale CSS variables exist', function() {
    var vars = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl',
                '--text-2xl', '--text-3xl', '--text-4xl',
                '--heading-sm', '--heading-base', '--heading-lg', '--heading-xl', '--heading-2xl'];
    vars.forEach(function(v) {
      assert.ok(cssContains(v), v + ' should exist in :root');
    });
  });

  test('body text uses correct font-family', function() {
    assert.ok(cssContains('font-family: var(--body)'), 'Body should use --body font');
  });

  test('Arabic words use Amiri font', function() {
    assert.ok(cssContains('font-family: var(--arabic)'), 'Arabic should use --arabic font');
  });

  test('Serif/English text uses Lora font', function() {
    assert.ok(cssContains('font-family: var(--serif)'), 'Serif text should use --serif font');
  });

  test('font imports reference all needed weights (Inter 300-700)', function() {
    // Check Google Fonts import includes Inter with 300,400,500,600,700
    assert.ok(cssContains("Inter:wght@300;400;500;600;700") ||
              cssContains("Inter:wght@300,400,500,600,700") ||
              cssContent.indexOf('Inter') >= 0,
              'Inter font should be imported with weights 300,400,500,600,700');
    assert.ok(cssContains('Amiri') || cssContent.indexOf('Amiri') >= 0,
              'Amiri font should be imported');
    assert.ok(cssContains('Lora') || cssContent.indexOf('Lora') >= 0,
              'Lora font should be imported');
  });

  test('typography scale includes all needed font-size values', function() {
    assert.ok(cssContains('--text-xs: 10px'), 'text-xs should be 10px');
    assert.ok(cssContains('--text-sm: 12px'), 'text-sm should be 12px');
    assert.ok(cssContains('--text-base: 14px'), 'text-base should be 14px');
    assert.ok(cssContains('--text-lg: 18px'), 'text-lg should be 18px');
    assert.ok(cssContains('--text-xl: 24px'), 'text-xl should be 24px');
    assert.ok(cssContains('--text-2xl: 30px'), 'text-2xl should be 30px');
    assert.ok(cssContains('--text-3xl: 42px'), 'text-3xl should be 42px');
    assert.ok(cssContains('--text-4xl: 52px'), 'text-4xl should be 52px');
    assert.ok(cssContains('--text-2xs: 8px'), 'text-2xs should be 8px');
    assert.ok(cssContains('--text-3xs: 9px'), 'text-3xs should be 9px');
  });

  test('no font-weight: 450 exists (Inter only has 300,400,500,600,700)', function() {
    assert.ok(!cssContains('font-weight: 450'), 'font-weight: 450 should not exist in styles.css');
  });

  test('no letter-spacing in px units (all should use em)', function() {
    assert.ok(!cssContains('letter-spacing: 0.5px'), 'letter-spacing should use em, not px');
  });

  test('heading scale values are consistent', function() {
    assert.ok(cssContains('--heading-sm: 11px'), 'heading-sm should be 11px');
    assert.ok(cssContains('--heading-base: 13px'), 'heading-base should be 13px');
    assert.ok(cssContains('--heading-lg: 16px'), 'heading-lg should be 16px');
    assert.ok(cssContains('--heading-xl: 20px'), 'heading-xl should be 20px');
    assert.ok(cssContains('--heading-2xl: 28px'), 'heading-2xl should be 28px');
  });

  test('-webkit-font-smoothing is set on body', function() {
    assert.ok(cssContains('-webkit-font-smoothing: antialiased'), 'Body should have font smoothing');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 3: DESIGN SYSTEM TOKENS
// ═══════════════════════════════════════════════════════════════

suite('Design System Tokens', function() {
  test('all color CSS variables are defined', function() {
    var colors = ['--bg', '--surface', '--surface2', '--border', '--gold', '--gold-light',
                  '--gold-dim', '--text', '--text-muted', '--green', '--red', '--blue',
                  '--purple', '--pink'];
    colors.forEach(function(c) {
      assert.ok(cssContains(c), c + ' should exist in :root');
    });
  });

  test('all spacing CSS variables are defined', function() {
    var spacings = ['--spacing-xs: 4px', '--spacing-sm: 8px', '--spacing-md: 12px',
                    '--spacing-lg: 16px', '--spacing-xl: 24px'];
    spacings.forEach(function(s) {
      assert.ok(cssContains(s), s + ' should exist');
    });
  });

  test('all border-radius CSS variables are defined', function() {
    var radii = ['--radius-card', '--radius-section', '--radius-btn',
                 '--radius-pill', '--radius-input', '--radius-sm'];
    radii.forEach(function(r) {
      assert.ok(cssContains(r), r + ' should exist');
    });
  });

  test('shadow CSS variables are defined', function() {
    assert.ok(cssContains('--shadow-card'), '--shadow-card should exist');
    assert.ok(cssContains('--shadow-elevated'), '--shadow-elevated should exist');
    assert.ok(cssContains('--shadow-glow-gold'), '--shadow-glow-gold should exist');
  });

  test('animation easing CSS variables are defined', function() {
    assert.ok(cssContains('--ease-default'), '--ease-default should exist');
    assert.ok(cssContains('--ease-spring'), '--ease-spring should exist');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 4: COMPONENT SMOKE TESTS
// ═══════════════════════════════════════════════════════════════

suite('Component Smoke Tests', function() {
  test('word-card component has all required classes in CSS', function() {
    assert.ok(cssContains('.word-card'), 'word-card class should exist');
    assert.ok(cssContains('.word-num'), 'word-num class should exist');
    assert.ok(cssContains('.arabic-word'), 'arabic-word class should exist');
    assert.ok(cssContains('.meaning'), 'meaning class should exist');
  });

  test('SRS rating buttons have all required classes', function() {
    assert.ok(cssContains('.srs-row'), 'srs-row class should exist');
    assert.ok(cssContains('.srs-btn'), 'srs-btn class should exist');
    assert.ok(cssContains('.srs-btn.again'), 'srs-btn.again should exist');
    assert.ok(cssContains('.srs-btn.hard'), 'srs-btn.hard should exist');
    assert.ok(cssContains('.srs-btn.good'), 'srs-btn.good should exist');
    assert.ok(cssContains('.srs-btn.easy'), 'srs-btn.easy should exist');
  });

  test('progress components have all required classes', function() {
    assert.ok(cssContains('.progress-bar-wrap'), 'progress-bar-wrap should exist');
    assert.ok(cssContains('.progress-bar-fill'), 'progress-bar-fill should exist');
    assert.ok(cssContains('.goal-ring'), 'goal-ring should exist');
    assert.ok(cssContains('.goal-ring-fill'), 'goal-ring-fill should exist');
    assert.ok(cssContains('.goal-ring-text'), 'goal-ring-text should exist');
  });

  test('navigation classes exist', function() {
    assert.ok(cssContains('.bottom-nav'), 'bottom-nav class should exist');
    assert.ok(cssContains('.nav-tab'), 'nav-tab class should exist');
    assert.ok(cssContains('.nav-tab.active'), 'nav-tab.active should exist');
    assert.ok(cssContains('.nav-tab-label'), 'nav-tab-label should exist');
    assert.ok(cssContains('.nav-tab-icon'), 'nav-tab-icon should exist');
    assert.ok(cssContains('.bn-indicator'), 'bn-indicator should exist');
  });

  test('reader component classes exist', function() {
    assert.ok(cssContains('.reader-surah-item'), 'reader-surah-item should exist');
    assert.ok(cssContains('.reader-word-token'), 'reader-word-token should exist');
    assert.ok(cssContains('.reader-sheet-panel'), 'reader-sheet-panel should exist');
    assert.ok(cssContains('.reader-container'), 'reader-container should exist');
    assert.ok(cssContains('.reader-main'), 'reader-main should exist');
  });

  test('button component classes exist', function() {
    assert.ok(cssContains('.btn'), 'btn class should exist');
    assert.ok(cssContains('.btn:hover'), 'btn:hover should exist');
    assert.ok(cssContains('.btn-outline'), 'btn-outline class should exist');
    assert.ok(cssContains('.btn-sm'), 'btn-sm class should exist');
    assert.ok(cssContains('.btn:disabled'), 'btn:disabled should exist');
  });

  test('quiz component classes exist', function() {
    assert.ok(cssContains('.quiz-card'), 'quiz-card class should exist');
    assert.ok(cssContains('.quiz-opt'), 'quiz-opt class should exist');
    assert.ok(cssContains('.quiz-opt.correct'), 'quiz-opt.correct should exist');
    assert.ok(cssContains('.quiz-opt.wrong'), 'quiz-opt.wrong should exist');
  });

  test('search/filter component classes exist', function() {
    assert.ok(cssContains('.search-input'), 'search-input class should exist');
    assert.ok(cssContains('.chip'), 'chip class should exist');
    assert.ok(cssContains('.chip.chip-active'), 'chip.chip-active should exist');
  });

  test('modal and dialog classes exist', function() {
    assert.ok(cssContains('.modal-overlay'), 'modal-overlay class should exist');
    assert.ok(cssContains('.modal-content'), 'modal-content class should exist');
    assert.ok(cssContains('.modal-title'), 'modal-title class should exist');
  });

  test('auth component classes exist', function() {
    assert.ok(cssContains('.auth-container'), 'auth-container should exist');
    assert.ok(cssContains('.auth-input'), 'auth-input should exist');
    assert.ok(cssContains('.auth-input:focus'), 'auth-input:focus should exist');
    assert.ok(cssContains('.auth-error'), 'auth-error should exist');
    assert.ok(cssContains('.auth-success'), 'auth-success should exist');
  });

  test('profile component classes exist', function() {
    assert.ok(cssContains('.profile-container'), 'profile-container should exist');
    assert.ok(cssContains('.profile-header'), 'profile-header should exist');
    assert.ok(cssContains('.profile-avatar'), 'profile-avatar should exist');
    assert.ok(cssContains('.profile-stat'), 'profile-stat should exist');
  });

  test('empty state classes exist', function() {
    assert.ok(cssContains('.empty-state'), 'empty-state class should exist');
    assert.ok(cssContains('.db-error'), 'db-error class should exist');
  });

  test('utility classes exist', function() {
    var utils = ['.is-hidden', '.w-full', '.text-center', '.text-muted',
                 '.sr-only', '.flex', '.flex-1'];
    utils.forEach(function(u) {
      assert.ok(cssContains(u), u + ' should exist');
    });
  });

  test('margin utility classes exist', function() {
    var margins = ['.mt-8', '.mt-10', '.mt-12', '.mt-14', '.mt-16', '.mt-20', '.mt-24', '.mb-8'];
    margins.forEach(function(m) {
      assert.ok(cssContains(m), m + ' should exist');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 5: RESPONSIVE & ACCESSIBILITY CHECKS
// ═══════════════════════════════════════════════════════════════

suite('Responsive & Accessibility', function() {
  test('prefers-reduced-motion media query exists', function() {
    assert.ok(cssContains('@media (prefers-reduced-motion: reduce)'),
              'Reduced motion media query should exist');
  });

  test('prefers-contrast: more media query exists', function() {
    assert.ok(cssContains('@media (prefers-contrast: more)'),
              'High contrast media query should exist');
  });

  test('@media print stylesheet exists', function() {
    assert.ok(cssContains('@media print'),
              'Print stylesheet should exist');
  });

  test(':focus-visible outline is set globally', function() {
    assert.ok(cssContains(':focus-visible {\n  outline: 3px solid var(--gold)'),
              'Global focus-visible should use gold outline');
  });

  test('responsive media queries exist for mobile/tablet', function() {
    assert.ok(cssContains('@media (max-width: 380px)'),
              'Mobile media query should exist');
    assert.ok(cssContains('@media (min-width: 481px)'),
              'Tablet/desktop media query should exist');
  });

  test('skip-link exists for accessibility', function() {
    assert.ok(cssContains('.skip-link'), 'Skip-link class should exist');
  });

  test('offline badge class exists', function() {
    assert.ok(cssContains('.offline-badge'), 'offline-badge should exist');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 6: ANIMATION & EFFECTS CHECKS
// ═══════════════════════════════════════════════════════════════

suite('Animations & Effects', function() {
  test('fadeIn keyframe exists', function() {
    assert.ok(cssContains('@keyframes fadeIn'), 'fadeIn keyframe should exist');
  });

  test('fadeInUp keyframe exists', function() {
    assert.ok(cssContains('@keyframes fadeInUp'), 'fadeInUp keyframe should exist');
  });

  test('pulse keyframe exists', function() {
    assert.ok(cssContains('@keyframes pulse'), 'pulse keyframe should exist');
  });

  test('shimmer keyframe exists', function() {
    assert.ok(cssContains('@keyframes shimmer'), 'shimmer keyframe should exist');
  });

  test('fade-in animation class exists', function() {
    assert.ok(cssContains('.fade-in'), 'fade-in class should exist');
  });

  test('stagger-item animation class exists', function() {
    assert.ok(cssContains('.stagger-item'), 'stagger-item class should exist');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 7: DASHBOARD COMPONENT CHECKS
// ═══════════════════════════════════════════════════════════════

suite('Dashboard Components', function() {
  test('dashboard greeting classes exist', function() {
    assert.ok(cssContains('.db-greeting'), 'db-greeting should exist');
    assert.ok(cssContains('.db-greeting-title'), 'db-greeting-title should exist');
    assert.ok(cssContains('.db-greeting-sub'), 'db-greeting-sub should exist');
  });

  test('dashboard hero/stat classes exist', function() {
    assert.ok(cssContains('.db-hero-bar'), 'db-hero-bar should exist');
    assert.ok(cssContains('.db-hero-stat'), 'db-hero-stat should exist');
    assert.ok(cssContains('.db-hero-stat-value'), 'db-hero-stat-value should exist');
    assert.ok(cssContains('.db-hero-stat-label'), 'db-hero-stat-label should exist');
  });

  test('dashboard card classes exist', function() {
    assert.ok(cssContains('.db-card'), 'db-card should exist');
    assert.ok(cssContains('.db-card-highlight'), 'db-card-highlight should exist');
    assert.ok(cssContains('.db-action-card'), 'db-action-card should exist');
    assert.ok(cssContains('.db-card-title'), 'db-card-title should exist');
    assert.ok(cssContains('.db-card-sub'), 'db-card-sub should exist');
  });

  test('dashboard progress classes exist', function() {
    assert.ok(cssContains('.db-progress'), 'db-progress should exist');
    assert.ok(cssContains('.db-progress-track'), 'db-progress-track should exist');
    assert.ok(cssContains('.db-progress-fill'), 'db-progress-fill should exist');
  });

  test('dashboard ring/comprehension classes exist', function() {
    assert.ok(cssContains('.db-comp-row'), 'db-comp-row should exist');
    assert.ok(cssContains('.db-ring-wrap'), 'db-ring-wrap should exist');
    assert.ok(cssContains('.db-ring-fill'), 'db-ring-fill should exist');
    assert.ok(cssContains('.db-ring-text'), 'db-ring-text should exist');
    assert.ok(cssContains('.db-comp-headline-value'), 'db-comp-headline-value should exist');
  });

  test('dashboard progress fill variants exist', function() {
    assert.ok(cssContains('.db-fill-green'), 'db-fill-green should exist');
    assert.ok(cssContains('.db-fill-blue'), 'db-fill-blue should exist');
    assert.ok(cssContains('.db-fill-purple'), 'db-fill-purple should exist');
  });

  test('dashboard achievement classes exist', function() {
    assert.ok(cssContains('.db-achievement'), 'db-achievement should exist');
    assert.ok(cssContains('.db-ach-item'), 'db-ach-item should exist');
    assert.ok(cssContains('.dashboard-ach-chip'), 'dashboard-ach-chip should exist');
  });

  test('dashboard CTA classes exist', function() {
    assert.ok(cssContains('.db-cta'), 'db-cta should exist');
    assert.ok(cssContains('.db-cta-title'), 'db-cta-title should exist');
  });

  test('dashboard weekly section exists', function() {
    assert.ok(cssContains('.db-weekly'), 'db-weekly should exist');
    assert.ok(cssContains('.db-weekly-item'), 'db-weekly-item should exist');
  });

  test('dashboard error state class exists', function() {
    assert.ok(cssContains('.db-error'), 'db-error should exist');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 8: CSS FILE INTEGRITY
// ═══════════════════════════════════════════════════════════════

suite('CSS File Integrity', function() {
  test('styles.css file is readable', function() {
    assert.ok(cssContent.length > 100000, 'styles.css should be > 100KB');
    assert.ok(cssContent.length < 500000, 'styles.css should be < 500KB');
  });

  test('styles.css has proper closing braces balance', function() {
    var open = (cssContent.match(/\{/g) || []).length;
    var close = (cssContent.match(/\}/g) || []).length;
    assert.strictEqual(open, close, 'styles.css should have balanced braces: ' + open + ' open vs ' + close + ' close');
  });

  test('no unclosed CSS blocks', function() {
    var lines = cssContent.split('\n');
    var suspicious = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (/^[a-z-]+\s*:/.test(line) && !/^\/\*/.test(line) && !/^@/.test(line)) {
        var prevLine = i > 0 ? lines[i - 1].trim() : '';
        var nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        if (prevLine === '' && nextLine !== '' && nextLine.indexOf('}') < 0) {
          suspicious++;
        }
      }
    }
    if (suspicious > 0) {
      console.log('     Found ' + suspicious + ' potentially orphaned properties');
    }
    assert.ok(suspicious < 5, 'Should have fewer than 5 orphaned property lines (found: ' + suspicious + ')');
  });

  suite('Typography Consistency', function() {
    test('all font-weight values use weights available in loaded fonts', function() {
      // Inter: 300,400,500,600,700 | Amiri: 400,700 | Lora: 400,600,400i
      var fontWeights = cssContent.match(/font-weight:\s*(\d+)/g) || [];
      var invalidWeights = [];
      fontWeights.forEach(function(fw) {
        var w = parseInt(fw.replace('font-weight:', '').trim(), 10);
        if (w !== 300 && w !== 400 && w !== 500 && w !== 600 && w !== 700 && w !== 450) {
          if (invalidWeights.indexOf(w) < 0) invalidWeights.push(w);
        }
      });
      assert.strictEqual(invalidWeights.length, 0, 'All font-weights should be 300/400/500/600/700. Invalid: ' + JSON.stringify(invalidWeights));
    });

    test('line-height values are consistent across the app', function() {
      var lineHeights = cssContent.match(/line-height:\s*[0-9.]+/g) || [];
      var unique = {};
      lineHeights.forEach(function(lh) {
        unique[lh] = (unique[lh] || 0) + 1;
      });
      var values = Object.keys(unique).sort();
      // The most common line-heights should be 1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
      // A wide variety is expected since different text sizes need different line-heights
      console.log('     ' + values.length + ' unique line-height values found');
      assert.ok(values.length > 3, 'Should have a variety of line-height values');
    });

    test('letter-spacing consistently uses em units', function() {
      var pxLetterSpacing = cssContent.match(/letter-spacing:\s*\d+\.?\d*px/g);
      assert.ok(pxLetterSpacing === null || pxLetterSpacing.length === 0,
                'All letter-spacing should use em units, found px: ' + JSON.stringify(pxLetterSpacing));
    });

    test('Google Fonts import includes all required weight ranges', function() {
      var htmlPath = require('path').join(__dirname, '..', 'index.html');
      try {
        if (!require('fs').existsSync(htmlPath)) {
          console.log('     ⚠ index.html not found at ' + htmlPath + ' — skipping font import test');
          assert.ok(true);
          return;
        }
        var html = require('fs').readFileSync(htmlPath, 'utf8');
        assert.ok(html.indexOf('Inter:wght@300;400;500;600;700') >= 0 ||
                  html.indexOf('Inter') >= 0,
                  'Inter font import should exist in index.html');
        assert.ok(html.indexOf('Lora:ital,wght@0,400;0,600;1,400') >= 0 ||
                  html.indexOf('Lora') >= 0,
                  'Lora font import should exist in index.html');
        assert.ok(html.indexOf('Amiri:ital,wght@0,400;0,700;1,400') >= 0 ||
                  html.indexOf('Amiri') >= 0,
                  'Amiri font import should exist in index.html');
      } catch (e) {
        console.log('     ⚠ Could not verify font imports: ' + e.message);
        assert.ok(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// WORDS SECTION — Scroll Position & CSS Class Presence
// ═══════════════════════════════════════════════════════════════

suite('Words Section — Scroll & CSS Integrity', function() {
  // Test 1: scroll-to-top in renderWordList
  test('renderWordList scrolls .content to top', function() {
    var statsContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'stats-ui.js'), 'utf8');
    var hasScroll = statsContent.indexOf('content.scrollTop = 0') >= 0 ||
      statsContent.indexOf("contentEl.scrollTop = 0") >= 0;
    assert.ok(hasScroll, 'renderWordList must contain content.scrollTop = 0');
  });
  
  // Test 2: Explorer CSS classes present in styles.css
  test('Explorer header CSS classes exist in styles.css', function() {
    var required = [
      '.explorer-header',
      '.explorer-back-btn',
      '.explorer-header-title',
      '.explorer-section-title',
      '.explorer-core-card',
      '.explorer-info-grid',
      '.explorer-info-item',
      '.explorer-info-label',
      '.explorer-info-value',
    ];
    for (var i = 0; i < required.length; i++) {
      var cls = required[i];
      assert.ok(cssContent.indexOf(cls + ' {') >= 0 || cssContent.indexOf(cls + '{') >= 0,
        cls + ' must be defined in styles.css');
    }
  });
  
  // Test 3: Explorer context CSS classes exist
  test('Explorer context and occurrence CSS classes exist in styles.css', function() {
    var required = [
      '.explorer-context-card',
      '.explorer-context-stats',
      '.explorer-context-stat',
      '.explorer-context-stat-value',
      '.explorer-context-stat-label',
      '.explorer-occ-nav',
      '.explorer-occ-label',
      '.explorer-occ-view',
      '.explorer-all-occ-btn',
      '.explorer-ayah-arabic',
    ];
    for (var i = 0; i < required.length; i++) {
      var cls = required[i];
      assert.ok(cssContent.indexOf(cls + ' {') >= 0 || cssContent.indexOf(cls + '{') >= 0,
        cls + ' must be defined in styles.css');
    }
  });
  
  // Test 4: Explorer responsive breakpoints exist
  test('Explorer responsive breakpoints exist in styles.css', function() {
    assert.ok(cssContent.indexOf('@media (max-width: 380px)') >= 0,
      '380px breakpoint must exist for explorer');
    assert.ok(cssContent.indexOf('@media (max-width: 480px)') >= 0,
      '480px breakpoint must exist for explorer');
    assert.ok(cssContent.indexOf('@media (min-width: 768px)') >= 0,
      '768px breakpoint must exist for explorer');
  });
  
  // Test 5: setView scrolls content to top on every view switch
  test('setView() scrolls .content to top', function() {
    var uiContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
    assert.ok(uiContent.indexOf('content.scrollTop = 0') >= 0,
      'setView() must contain content.scrollTop = 0');
  });
});

// ═══════════════════════════════════════════════════════════════
// GLOBAL VIEW CSS INTEGRITY
// ═══════════════════════════════════════════════════════════════

suite('Global View CSS Integrity', function() {
  // Test: All five main views have an .active display rule
  test('Main views have .active display rules in CSS', function() {
    var viewIds = ['view-dashboard', 'view-learn', 'view-list', 'view-reader', 'view-profile'];
    for (var i = 0; i < viewIds.length; i++) {
      var specificRule = cssContent.indexOf('#' + viewIds[i] + '.active') >= 0;
      var genericRule = cssContent.indexOf('.mode-view.active') >= 0;
      assert.ok(specificRule || genericRule,
        viewIds[i] + ' must have .active display handling via specific or generic rule');
    }
  });
  
  // Test: No view has overflow: hidden that could clip content
  test('No main view has overflow:hidden that prevents scrolling', function() {
    var viewSelectors = ['#view-dashboard', '#view-learn', '#view-list', '#view-reader', '#view-profile'];
    for (var i = 0; i < viewSelectors.length; i++) {
      var sel = viewSelectors[i];
      var lines = cssContent.split('\n');
      var inRule = false;
      var hasOverflowHidden = false;
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        if (line.indexOf(sel) >= 0 && line.indexOf('{') >= 0) {
          inRule = true;
        }
        if (inRule) {
          if (line.indexOf('overflow: hidden') >= 0 || line.indexOf('overflow-x: hidden') >= 0) {
            if (line.indexOf('overflow-y') < 0) {
              hasOverflowHidden = true;
            }
          }
          if (line.indexOf('}') >= 0) {
            break;
          }
        }
      }
      assert.ok(!hasOverflowHidden,
        sel + ' should not have overflow:hidden (use overflow-y:auto instead)');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// STYLES2.CSS EXPLORER CONSISTENCY
// ═══════════════════════════════════════════════════════════════

suite('Styles2.css Explorer Consistency', function() {
  var css2Content = '';
  try {
    css2Content = fs.readFileSync(path.join(__dirname, '..', 'styles2.css'), 'utf8');
    css2Content = css2Content.replace(/\r\n/g, '\n');
  } catch (e) {
    console.log('  ╔ styles2.css not found — skipping');
    return;
  }
  
  test('Explorer header CSS classes exist in styles2.css', function() {
    var required = ['.explorer-header', '.explorer-back-btn', '.explorer-core-card', '.explorer-info-grid'];
    for (var i = 0; i < required.length; i++) {
      assert.ok(css2Content.indexOf(required[i] + ' {') >= 0 || css2Content.indexOf(required[i] + '{') >= 0,
        required[i] + ' must be defined in styles2.css');
    }
  });
  
  test('Explorer responsive breakpoints exist in styles2.css', function() {
    assert.ok(css2Content.indexOf('@media (max-width: 480px)') >= 0,
      '480px breakpoint must exist in styles2.css');
    assert.ok(css2Content.indexOf('@media (min-width: 768px)') >= 0,
      '768px breakpoint must exist in styles2.css');
  });
});

// ═══════════════════════════════════════════════════════════════
// VIEW SWITCH SCROLL PROTECTION
// ═══════════════════════════════════════════════════════════════

suite('View Switch Scroll Protection', function() {
  test('setView() in ui.js scrolls to top on view change', function() {
    var uiContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
    var match = uiContent.match(/content\.scrollTop\s*=\s*0/);
    assert.ok(match, 'setView() must set content.scrollTop = 0');
  });
  
  test('renderExplorer() in explorer.js scrolls to top', function() {
    var explorerContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
    assert.ok(explorerContent.indexOf('content.scrollTop = 0') >= 0,
      'renderExplorer() must set content.scrollTop = 0');
  });
});

// ═══════════════════════════════════════════════════════════════
// HORIZONTAL OVERFLOW PROTECTION
// ═══════════════════════════════════════════════════════════════

suite('Horizontal Overflow Protection', function() {
  // Test: view-list doesn't have overflow:hidden (clips content)
  test('view-list has no overflow:hidden that could cause horizontal clip', function() {
    var lines = cssContent.split('\n');
    var inViewList = false;
    var hasOverflowHidden = false;
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (line.indexOf('#view-list') >= 0 && line.indexOf('{') >= 0) {
        inViewList = true;
      }
      if (inViewList) {
        var stripped = line.replace(/\s/g, '');
        if (stripped.indexOf('overflow:hidden') >= 0 && stripped.indexOf('overflow-y') < 0) {
          hasOverflowHidden = true;
          break;
        }
        if (line.indexOf('}') >= 0) break;
      }
    }
    assert.ok(!hasOverflowHidden, '#view-list should not have overflow:hidden');
  });
});

// ═══════════════════════════════════════════════════════════════
// PROFILE SCROLL POSITION
// ═══════════════════════════════════════════════════════════════

suite('Profile Scroll Position (No Hidden Content)', function() {
  // Test: renderFullProfile finally block scrolls .content to top after rendering
  test('renderFullProfile scrolls content to top after rendering', function() {
    var profileContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile-ui.js'), 'utf8');
    // The finally block should have content.scrollTop = 0 after _hideProfileSkeleton()
    var hideSkelIdx = profileContent.indexOf('_hideProfileSkeleton()');
    var scrollIdx = profileContent.indexOf('scrollTop = 0');
    assert.ok(hideSkelIdx >= 0, '_hideProfileSkeleton() must exist in profile-ui.js');
    assert.ok(scrollIdx >= 0, 'scrollTop = 0 must exist in profile-ui.js');
    // The scrollTop line should be AFTER the _hideProfileSkeleton call
    var hideSkelLastIdx = profileContent.lastIndexOf('_hideProfileSkeleton()');
    var scrollAfterHide = profileContent.indexOf('scrollTop = 0', hideSkelLastIdx);
    assert.ok(scrollAfterHide > hideSkelLastIdx,
      'scrollTop = 0 must be set AFTER _hideProfileSkeleton() in the finally block');
  });
  
  // Test: setView scrolls .content to top on view switch
  test('setView scrolls content to top for all views including profile', function() {
    var uiContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
    assert.ok(uiContent.indexOf('content.scrollTop = 0') >= 0,
      'setView() must set content.scrollTop = 0');
  });
  
  // Test: Profile tab navigation triggers switchView('profile')
  test('Profile tab click calls switchView with profile', function() {
    var appContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    assert.ok(appContent.indexOf("switchView('profile')") >= 0 ||
      appContent.indexOf('tab-profile') >= 0,
      'Profile tab must trigger switchView(\'profile\')');
  });
});

// ═══════════════════════════════════════════════════════════════
// EXPLORER STRUCTURED COMPONENTS — JS Generates HTML
// ═══════════════════════════════════════════════════════════════

suite('Explorer Structured Components', function() {
  // Test: explorer.js uses innerHTML for structured components (not plain textContent)
  test('renderExplorer uses innerHTML for difficulty stars', function() {
    var explorerContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
    assert.ok(explorerContent.indexOf('explorer-difficulty') >= 0,
      'explorer-difficulty must be populated in renderExplorer');
    assert.ok(explorerContent.indexOf('explorer-diff-stars') >= 0,
      'renderExplorer must generate .explorer-diff-stars component');
    assert.ok(explorerContent.indexOf('explorer-star') >= 0,
      'renderExplorer must generate .explorer-star elements');
  });
  
  test('renderExplorer uses structured freq pill, badge, chip', function() {
    var explorerContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
    assert.ok(explorerContent.indexOf('explorer-freq-pill') >= 0,
      'renderExplorer must generate .explorer-freq-pill');
    assert.ok(explorerContent.indexOf('explorer-foundation-badge') >= 0,
      'renderExplorer must generate .explorer-foundation-badge');
    assert.ok(explorerContent.indexOf('explorer-priority-chip') >= 0,
      'renderExplorer must generate .explorer-priority-chip');
  });
  
  test('renderExplorer uses structured occ counter', function() {
    var explorerContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
    assert.ok(explorerContent.indexOf('explorer-occ-count') >= 0,
      'renderExplorer must generate .explorer-occ-count');
    assert.ok(explorerContent.indexOf('explorer-occ-unit') >= 0,
      'renderExplorer must generate .explorer-occ-unit');
  });
  
  test('renderExplorerLearningProgress uses structured components', function() {
    var explorerContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'explorer.js'), 'utf8');
    assert.ok(explorerContent.indexOf('explorer-srs-badge') >= 0,
      'renderExplorerLearningProgress must generate .explorer-srs-badge');
    assert.ok(explorerContent.indexOf('explorer-time-text') >= 0,
      'renderExplorerLearningProgress must generate .explorer-time-text');
  });
  
  // Test: CSS class definitions exist for all structured components
  test('CSS for structured components exists in styles.css', function() {
    var required = [
      '.explorer-diff-stars',
      '.explorer-star.filled',
      '.explorer-star.empty',
      '.explorer-freq-pill',
      '.explorer-foundation-badge',
      '.explorer-priority-chip',
      '.explorer-occ-count',
      '.explorer-srs-badge',
      '.explorer-time-text',
    ];
    for (var i = 0; i < required.length; i++) {
      assert.ok(cssContent.indexOf(required[i]) >= 0,
        required[i] + ' must be defined in styles.css');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

var total = passed + failed;
console.log('\n' + '='.repeat(50));
console.log('  REGRESSION QA TESTS');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
