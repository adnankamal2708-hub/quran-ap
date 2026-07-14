// ═══════════════════════════════════════════════════════════════
// safeguards.js — Error Prevention & Startup Guardrails
// Loads BEFORE app.bundle.min.js to catch early failures.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Internal state ──────────────────────────────────────────
  var _safeguardResults = { dom: [], css: [], fonts: [] };
  var _hasRenderedFallback = false;
  var _fontCheckStarted = false;
  var _fontRetryCount = 0;
  var _fontMaxRetries = 3;
  var _fontPrimaryCheckDone = false;

  // ══════════════════════════════════════════════════════════════
  // 1. DOM ELEMENT DETECTION
  // ══════════════════════════════════════════════════════════════

  /**
   * All critical DOM elements checked at startup.
   * Missing elements are logged and trigger the fallback UI.
   */
  var CHECKED_ELEMENTS = [
    // Core layout
    { id: 'splash-screen',     name: 'Splash screen' },
    { id: 'content',           name: 'Content container' },
    { id: 'dashboard-grid',    name: 'Dashboard grid' },
    { id: 'view-dashboard',    name: 'Dashboard view' },
    { id: 'view-learn',        name: 'Learn view' },
    { id: 'view-quiz',         name: 'Quiz view' },
    { id: 'view-list',         name: 'Word list view' },
    { id: 'view-reader',       name: 'Reader view' },
    { id: 'view-auth',         name: 'Auth view' },
    { id: 'view-profile',      name: 'Profile view' },
    // Nav tabs
    { id: 'tab-dashboard',     name: 'Dashboard nav tab' },
    { id: 'tab-paths',         name: 'Paths nav tab' },
    { id: 'tab-list',          name: 'Words nav tab' },
    { id: 'tab-reader',        name: 'Reader nav tab' },
    { id: 'tab-profile',       name: 'Profile nav tab' },
    // Top bar stats
    { id: 'stat-learned',      name: 'Learned stat display' },
    { id: 'stat-review',       name: 'Review stat display' },
    { id: 'progress-fill',     name: 'Progress bar fill' },
    { id: 'progress-text',     name: 'Progress text' },
    { id: 'lesson-label',      name: 'Lesson label' },
    // Word card & learn area
    { id: 'word-card',         name: 'Word card' },
    { id: 'arabic-word',       name: 'Arabic word display' },
    { id: 'transliteration',   name: 'Transliteration' },
    { id: 'meaning',           name: 'Meaning display' },
    { id: 'word-type',         name: 'Word type badge' },
    { id: 'sr-pill',           name: 'SRS status pill' },
    { id: 'btn-prev',          name: 'Previous button' },
    { id: 'btn-next',          name: 'Next button' },
    { id: 'srs-row',           name: 'SRS rating row' },
    { id: 'root-box',          name: 'Root box' },
    { id: 'root-arabic-big',   name: 'Root Arabic display' },
    { id: 'root-family',       name: 'Root family container' },
    // List & review
    { id: 'search-input',      name: 'Search input' },
    { id: 'wordlist-container',name: 'Word list container' },
    { id: 'review-banner',     name: 'Review banner' },
    { id: 'session-summary-modal', name: 'Session summary modal' },
  ];

  /** Check that DOM elements exist. Returns array of missing names. */
  function checkDomElements() {
    var missing = [];
    for (var i = 0; i < CHECKED_ELEMENTS.length; i++) {
      var el = CHECKED_ELEMENTS[i];
      if (!document.getElementById(el.id)) {
        missing.push(el.name + ' (#' + el.id + ')');
      }
    }

    if (missing.length > 0) {
      _safeguardResults.dom = missing;
      console.warn('[safeguards] ⚠ Missing DOM elements (' + missing.length + '): ' + missing.join(', '));
    } else {
      window.__DEV__ && console.log('[safeguards] ✓ All checked DOM elements present');
    }

    return missing;
  }

  // ══════════════════════════════════════════════════════════════
  // 2. CSS VARIABLE DETECTION
  // ══════════════════════════════════════════════════════════════

  /**
   * CSS custom properties that the entire design system depends on.
   */
  var REQUIRED_CSS_VARS = [
    '--bg',
    '--surface',
    '--gold',
    '--text',
    '--text-muted',
    '--border',
    '--body',
    '--arabic',
    '--serif',
    '--radius-card',
    '--spacing-md',
  ];

  /**
   * Check that required CSS variables resolve to real values.
   * Uses getComputedStyle on document.documentElement directly — no DOM mutation.
   * This is simpler, faster, and more reliable across browsers.
   * Returns missing var names.
   */
  function checkCssVariables() {
    var missing = [];

    // Guard: if the stylesheet hasn't loaded yet, CSS vars won't resolve
    // Match both dev (styles.css) and production (styles.min.css) filenames.
    var linkEl = document.querySelector('link[href$=".css"]');
    if (linkEl && !linkEl.sheet) {
      window.__DEV__ && console.log('[safeguards] ℹ stylesheet not yet loaded — skipping CSS var check');
      return [];
    }

    // Use getComputedStyle on the root element directly.
    // This is more reliable than creating a temporary element because:
    // - No DOM mutation needed
    // - CSS vars inherit from :root to all descendants
    // - Works consistently in Chrome, Firefox, Safari, and Edge
    var computed = getComputedStyle(document.documentElement);
    for (var i = 0; i < REQUIRED_CSS_VARS.length; i++) {
      var v = REQUIRED_CSS_VARS[i];
      var val = computed.getPropertyValue(v).trim();
      if (!val) {
        missing.push(v);
      }
    }

    if (missing.length > 0) {
      _safeguardResults.css = missing;
      console.warn('[safeguards] ⚠ Missing CSS variables (' + missing.length + '): ' + missing.join(', '));
    } else {
      window.__DEV__ && console.log('[safeguards] ✓ All required CSS variables resolve correctly');
    }

    return missing;
  }

  // ══════════════════════════════════════════════════════════════
  // 3. FONT LOADING DETECTION
  // ══════════════════════════════════════════════════════════════
  //
  // DESIGN PRINCIPLES:
  // 1. Never permanently mark fonts as failed — web fonts can load asynchronously
  // 2. Use self-healing: if fonts were marked failed but later load, REMOVE the class
  // 3. Multiple detection strategies: Font Loading API + polling as fallback
  // 4. Actionable diagnostics: report exactly which font, why it failed, and timing
  // ══════════════════════════════════════════════════════════════

  var REQUIRED_FONTS = [
    { family: 'Inter',  fallback: 'sans-serif', usage: 'Body text (--body)' },
    { family: 'Amiri',  fallback: 'serif',      usage: 'Arabic text (--arabic)' },
    { family: 'Lora',   fallback: 'serif',      usage: 'Headings & serif (--serif)' },
  ];

  /**
   * Check if a specific font is loaded using the Font Loading API.
   * Tries multiple font sizes and quote styles for cross-browser compatibility.
   * @param {string} family - The font family name
   * @returns {boolean} true if the font is available
   */
  function isFontLoaded(family) {
    try {
      // Try with quoted family name (standard CSS syntax)
      if (document.fonts.check('1em "' + family + '"')) return true;
      // Try without quotes (works for single-word family names)
      if (document.fonts.check('1em ' + family)) return true;
      // Try with explicit font-weight:400 (safari sometimes needs this)
      if (document.fonts.check('400 1em "' + family + '"')) return true;
      // Try with italic variant (for fonts like Lora that have italic faces)
      if (document.fonts.check('italic 1em "' + family + '"')) return true;
      // Try with different size (some browsers have edge cases with 1em)
      if (document.fonts.check('16px "' + family + '"')) return true;
      // Try with 16px + italic (covers edge cases with italic-only font faces)
      if (document.fonts.check('italic 16px "' + family + '"')) return true;
    } catch (e) {
      // Font check threw an exception — font is not available
      return false;
    }
    return false;
  }

  /**
   * Check all required fonts and return array of failed font info objects.
   * Each failed object includes: family, reason, status
   */
  function checkAllFonts() {
    var failed = [];
    var fsStatus = document.fonts ? document.fonts.status : 'unavailable';

    for (var fi = 0; fi < REQUIRED_FONTS.length; fi++) {
      var f = REQUIRED_FONTS[fi];
      if (!isFontLoaded(f.family)) {
        failed.push({
          family: f.family,
          fallback: f.fallback,
          usage: f.usage,
          reason: 'check_failed',
          status: fsStatus,
        });
      }
    }
    return failed;
  }

  /**
   * Apply the fonts-failed state: add class and update results.
   */
  function applyFontsFailed(failed) {
    if (failed.length === 0) return;

    // Build detailed failure report
    _safeguardResults.fonts = failed.map(function (f) {
      return f.family + ' (' + f.reason + ', status: ' + f.status + ')';
    });

    console.warn('[safeguards] ⚠ Fonts failed to load (' + failed.length + '):');
    for (var i = 0; i < failed.length; i++) {
      var f = failed[i];
      console.warn('  [' + f.family + '] reason=' + f.reason + ' status=' + f.status + ' usage=' + f.usage);
    }

    document.documentElement.classList.add('fonts-failed');
  }

  /**
   * Remove the fonts-failed state: remove class, update results.
   * Called when fonts eventually load after being marked as failed (self-healing).
   */
  function clearFontsFailed() {
    if (!document.documentElement.classList.contains('fonts-failed')) return;

    document.documentElement.classList.remove('fonts-failed');
    _safeguardResults.fonts = [];

    console.log('[safeguards] 🔄 Self-healing: Fonts that were previously marked as failed have now loaded.');
    console.log('[safeguards] fonts-failed class removed — theme restored to full typography.');
  }

  /**
   * Retry font check with delay. If fonts now load, self-heal.
   * This handles the race condition where document.fonts.ready fires
   * before font data is fully available for document.fonts.check().
   */
  function retryFontCheck() {
    if (_fontRetryCount >= _fontMaxRetries) return;
    _fontRetryCount++;

    var delay = _fontRetryCount * 2000; // 2s, 4s, 6s

    setTimeout(function () {
      var stillFailed = checkAllFonts();

      if (stillFailed.length === 0 && document.documentElement.classList.contains('fonts-failed')) {
        // Fonts loaded successfully now — self-heal
        clearFontsFailed();
      }
    }, delay);
  }

  /**
   * Install a MutationObserver to detect when loading completes.
   * This catches font loading changes that the Font Loading API might miss.
   */
  function installFontLoadingObserver() {
    if (!document.fonts || typeof document.fonts.addEventListener !== 'function') return;

    try {
      document.fonts.addEventListener('loadingdone', function (e) {
        if (document.documentElement.classList.contains('fonts-failed')) {
          // Font loading completed — check if our fonts are now available
          var stillFailed = checkAllFonts();
          if (stillFailed.length === 0) {
            clearFontsFailed();
          } else {
            // Schedule retry — some fonts may still be loading
            retryFontCheck();
          }
        }
      });

      document.fonts.addEventListener('loadingerr', function () {
        // Some fonts failed to load — the initial check will handle this
        // But we might still get a loadingdone later for successful fonts
      });
    } catch (e) {
      // Font Loading API events not supported
    }
  }

  /** Monitor font loading with self-healing capability. */
  function checkFonts() {
    return new Promise(function (resolve) {
      if (!document.fonts || !document.fonts.ready) {
        console.log('[safeguards] ℹ Font Loading API not available — skipping font check');
        resolve([]);
        return;
      }

      _fontCheckStarted = true;

      // Install event listeners for ongoing font loading changes
      installFontLoadingObserver();

      // Safety timeout reference for cleanup
      var safetyTimeout = null;

      // Primary check: use document.fonts.ready + check()
      document.fonts.ready.then(function () {
        // Guard against double-apply (race with safety timeout)
        if (_fontPrimaryCheckDone) return;
        _fontPrimaryCheckDone = true;
        // Clear the safety timeout since primary check completed
        if (safetyTimeout) { clearTimeout(safetyTimeout); safetyTimeout = null; }
        var failed = checkAllFonts();

        if (failed.length > 0) {
          applyFontsFailed(failed);

          // Schedule retry checks — fonts may still be loading
          // document.fonts.ready can fire before all font data is queryable
          retryFontCheck();

          // Final fallback timeout: if fonts haven't loaded by now,
          // they're genuinely unavailable (not just slow)
          setTimeout(function () {
            var stillFailed = checkAllFonts();
            if (stillFailed.length === 0) {
              clearFontsFailed();
            }
          }, 12000);
        } else {
          window.__DEV__ && console.log('[safeguards] ✓ All web fonts loaded successfully');
        }

        resolve(_safeguardResults.fonts);
      }).catch(function () {
        // document.fonts.ready rejected — fonts unavailable
        var failed = checkAllFonts();
        if (failed.length > 0) {
          applyFontsFailed(failed);
        }
        resolve(_safeguardResults.fonts);
      });

      // Safety timeout: if document.fonts.ready never resolves (very rare),
      // check fonts manually after 10 seconds
      safetyTimeout = setTimeout(function () {
        var failed = checkAllFonts();
        if (failed.length > 0) {
          applyFontsFailed(failed);
          // Retry later — fonts might still load
          retryFontCheck();
        }
        resolve(_safeguardResults.fonts);
      }, 10000);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 4. RENDERING ERROR BOUNDARY
  // ══════════════════════════════════════════════════════════════

  /**
   * Wrap a rendering function with a safe error boundary.
   * If the function throws, we catch the error, log it,
   * and render a fallback in the target container (if provided).
   *
   * @param {Function} fn       - The rendering function to wrap
   * @param {string}   name     - Human-readable name for logging
   * @param {string}   [target] - Optional element ID to show fallback in
   * @param {string}   [fallbackHTML] - Optional custom fallback HTML
   * @returns {Function} A wrapped function that never throws
   */
  function createSafeRenderer(fn, name, target, fallbackHTML) {
    return function safeRender() {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        console.error('[safeguards] ✗ Rendering error in "' + name + '":', e.message);

        if (target) {
          var el = document.getElementById(target);
          if (el && !el.hasAttribute('data-safeguard-fallback')) {
            el.setAttribute('data-safeguard-fallback', 'true');
            el.innerHTML = fallbackHTML ||
              '<div style="text-align:center;padding:20px;color:var(--text-muted, #8a8070);font-size:12px">' +
              '⚠️ <strong>' + name + '</strong> encountered an error. ' +
              'Other sections should still work.' +
              '</div>';
          }
        }
        return null;
      }
    };
  }

  /**
   * Cross-browser null/undefined detection in error messages.
   * Chrome: "Cannot read properties of null"
   * Firefox: "can't access property ... of null"
   * Safari: "null is not an object"
   */
  function isDomAccessError(msg) {
    if (!msg) return false;
    var patterns = [
      'Cannot read properties of null',
      'Cannot read properties of undefined',
      "can't access property",
      'is not an object',
      'is not a function',
      'is not defined',
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (msg.indexOf(patterns[i]) >= 0) return true;
    }
    return false;
  }

  /**
   * Global error handler — catches unhandled rendering exceptions via
   * window.onerror and unhandled Promise rejections.
   */
  function installGlobalErrorHandler() {
    window.addEventListener('error', function (e) {
      if (e.error && e.error.message && isDomAccessError(e.error.message)) {
        console.warn('[safeguards] ⚠ Global error caught:', e.error.message);
        var splash = document.getElementById('splash-screen');
        if (splash && !splash.classList.contains('splash-hidden')) {
          ensureFallbackUI();
        }
      }
    });

    window.addEventListener('unhandledrejection', function (e) {
      var reason = e.reason;
      if (reason && reason.message && isDomAccessError(reason.message)) {
        console.warn('[safeguards] ⚠ Unhandled Promise rejection:', reason.message);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 5. FALLBACK UI
  // ══════════════════════════════════════════════════════════════

  /** Render a visible fallback notification in the dashboard area */
  function ensureFallbackUI() {
    if (_hasRenderedFallback) return;
    _hasRenderedFallback = true;

    var grid = document.getElementById('dashboard-grid');
    if (!grid || grid.children.length > 0) return;

    var issueCount = getIssues().length;

    grid.innerHTML =
      '<div style="text-align:center;padding:24px 16px">' +
        '<div style="font-size:40px;margin-bottom:12px">📖</div>' +
        '<h2 style="font-size:16px;color:var(--gold-light, #e8c97a);margin:0 0 6px">Bayan</h2>' +
        '<p style="font-size:12px;color:var(--text-muted, #8a8070);line-height:1.5;margin:0 0 16px">' +
          'Loading your learning experience\u2026' +
        '</p>' +
        '<button class="btn btn-sm" onclick="window.location.reload()" ' +
          'style="min-height:36px;padding:8px 20px;font-size:12px">\u21BB Reload</button>' +
        (issueCount > 0
          ? '<div style="margin-top:12px;font-size:10px;color:var(--text-muted, #8a8070);opacity:0.5">' +
            issueCount + ' startup issue(s) detected. See console for details.</div>'
          : '') +
      '</div>';
  }

  // ══════════════════════════════════════════════════════════════
  // 6. PUBLIC API
  // ══════════════════════════════════════════════════════════════

  /** Run all checks and return results */
  function runAll() {
    var missingDom = checkDomElements();
    var missingCss = checkCssVariables();
    var domOk = missingDom.length === 0;
    var cssOk = missingCss.length === 0;

    checkFonts().then(function (fontIssues) {
      if (fontIssues && fontIssues.length > 0) {
        console.log('[safeguards] Initial font check found ' + fontIssues.length + ' issue(s). Self-healing will re-check.');
      }
    });

    if (!domOk || !cssOk) {
      setTimeout(ensureFallbackUI, 500);
    }

    window.__DEV__ && console.log('[safeguards] \u2713 Initial checks complete. dom=' + domOk + ' css=' + cssOk);
  }

  /**
   * Get a human-readable list of all issues found.
   * Returns an array of objects: { type, detail }
   */
  function getIssues() {
    var issues = [];
    _safeguardResults.dom.forEach(function (name) {
      issues.push({ type: 'dom', detail: 'Missing element: ' + name });
    });
    _safeguardResults.css.forEach(function (v) {
      issues.push({ type: 'css', detail: 'Missing variable: ' + v });
    });
    _safeguardResults.fonts.forEach(function (f) {
      issues.push({ type: 'fonts', detail: 'Font load failure: ' + f });
    });
    return issues;
  }

  /**
   * Get a formatted HTML report of all issues (for debug views).
   */
  function getIssuesHTML() {
    var issues = getIssues();
    if (issues.length === 0) {
      return '<div style="color:var(--green, #4a9e6b);font-size:11px">\u2713 No startup issues detected.</div>';
    }
    var html = '<div style="font-size:10px;color:var(--gold-dim, #7a6530);margin-bottom:4px">' +
      issues.length + ' startup issue(s):</div>';
    for (var i = 0; i < issues.length; i++) {
      var icon = issues[i].type === 'dom' ? '\uD83D\uDD32' : issues[i].type === 'css' ? '\uD83C\uDFA8' : '\uD83D\uDD24';
      html += '<div style="font-size:10px;color:var(--text-muted, #8a8070);padding:2px 0">' +
        icon + ' ' + issues[i].detail + '</div>';
    }
    return html;
  }

  // ══════════════════════════════════════════════════════════════
  // 7. BOOTSTRAP
  // ══════════════════════════════════════════════════════════════

  installGlobalErrorHandler();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    runAll();
  }

  window.__safeguards = {
    getIssues: getIssues,       // Array<{type,detail}>
    issues: getIssues,          // alias for consistency
    issuesHTML: getIssuesHTML,
    createSafeRenderer: createSafeRenderer,
    getResults: function () { return _safeguardResults; },
  };

})();
