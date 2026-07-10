// ═══════════════════════════════════════════════════════════════
// validation.js — Interaction Validation & Regression Protection
//
// Provides:
//   • Route validation — verify switchView targets exist
//   • Element validation — verify DOM elements exist after render
//   • Handler validation — verify onclick/listener is attached
//   • Service validation — verify required services initialized
//   • Render validation — verify render functions produce output
//   • Development warnings for missing/broken functionality
// ═══════════════════════════════════════════════════════════════

window.__validation = (function() {

  // ── Route Registry (known valid routes) ─────────────────────

  /** Valid view names that switchView can navigate to */
  var VALID_ROUTES = [
    'dashboard', 'learn', 'quiz', 'list', 'stats',
    'analytics', 'explorer', 'auth', 'profile', 'settings',
  ];

  /** Map of route → required DOM element ID */
  var ROUTE_VIEWS = {
    dashboard: 'view-dashboard',
    learn: 'view-learn',
    quiz: 'view-quiz',
    list: 'view-list',
    stats: 'view-stats',
    analytics: 'view-analytics',
    explorer: 'view-explorer',
    auth: 'view-auth',
    profile: 'view-profile',
  };

  /** Map of route → render function name */
  var ROUTE_RENDERERS = {
    dashboard: 'renderDashboard',
    learn: 'updateWordCard',
    quiz: 'initQuiz',
    list: 'renderWordList',
    stats: 'renderStats',
    analytics: 'renderAnalytics',
    explorer: 'renderExplorer',
    profile: 'renderProfileView',
  };

  /** Bottom nav tab IDs */
  var NAV_IDS = [
    'tab-dashboard', 'tab-learn', 'tab-quiz',
    'tab-list', 'tab-stats', 'tab-analytics',
  ];

  /** Map of element IDs expected to have onclick handlers */
  var INTERACTIVE_ELEMENTS = {
    // Bottom nav
    'tab-dashboard': { purpose: 'Navigate to dashboard' },
    'tab-learn': { purpose: 'Navigate to learn view' },
    'tab-quiz': { purpose: 'Navigate to quiz' },
    'tab-list': { purpose: 'Navigate to word list' },
    'tab-stats': { purpose: 'Navigate to stats' },
    'tab-analytics': { purpose: 'Navigate to analytics' },
    // Card interactions (set dynamically)
  };

  // ── Validation Functions ────────────────────────────────────

  /**
   * Validate that a route (view name) is valid.
   * Checks: valid name, DOM element exists, render function exists.
   * @param {string} viewName - Route to validate
   * @returns {Object} { valid, viewEl, renderFn, warnings }
   */
  function validateRoute(viewName) {
    var result = {
      valid: false,
      viewName: viewName,
      viewEl: null,
      renderFn: null,
      warnings: [],
    };

    // Check route is known
    if (VALID_ROUTES.indexOf(viewName) < 0) {
      result.warnings.push('Unknown route: "' + viewName + '"');
      return result;
    }

    // Check view DOM element exists
    var viewId = ROUTE_VIEWS[viewName];
    if (viewId) {
      result.viewEl = document.getElementById(viewId);
      if (!result.viewEl) {
        result.warnings.push('View element "#' + viewId + '" not found for route "' + viewName + '"');
      }
    }

    // Check render function exists
    var renderFnName = ROUTE_RENDERERS[viewName];
    if (renderFnName) {
      result.renderFn = typeof window[renderFnName] === 'function';
      if (!result.renderFn) {
        result.warnings.push('Render function "' + renderFnName + '()" not found for route "' + viewName + '"');
      }
    }

    result.valid = result.warnings.length === 0;
    return result;
  }

  /**
   * Validate that an interactive element has a click handler attached.
   * @param {string} elementId - The element ID
   * @param {boolean} [report=true] - Whether to report via diagnostics
   * @returns {boolean} true if handler exists
   */
  function validateHandler(elementId, report) {
    var el = document.getElementById(elementId);
    var hasHandler = el && typeof el.onclick === 'function';
    
    if (!hasHandler && report !== false && window.__diag) {
      window.__diag.warn('Validation', 'validateHandler',
        'Interactive element "#' + elementId + '" has no onclick handler');
    }
    
    return hasHandler;
  }

  /**
   * Validate that required DOM elements exist.
   * @param {string} context - Context description for error reporting
   * @param {string[]} ids - Array of element IDs to check
   * @param {boolean} [report=true] - Whether to report via diagnostics
   * @returns {Object<string, boolean>} Map of id → exists
   */
  function validateElements(context, ids, report) {
    var results = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var exists = !!document.getElementById(id);
      results[id] = exists;
      if (!exists && report !== false && window.__diag) {
        window.__diag.warn('Validation', context,
          'Required element "#' + id + '" not found');
      }
    }
    return results;
  }

  /**
   * Validate navigation system integrity.
   * Checks all nav tabs exist and have onclick handlers.
   * @returns {Object} { valid, results }
   */
  function validateNavigation() {
    var results = [];
    var allValid = true;

    NAV_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      var exists = !!el;
      var hasHandler = el && typeof el.onclick === 'function';
      var valid = exists && hasHandler;
      if (!valid) allValid = false;
      results.push({ id: id, exists: exists, hasHandler: hasHandler, valid: valid });
    });

    if (!allValid && window.__diag) {
      window.__diag.warn('Validation', 'validateNavigation',
        'Navigation validation failed: ' +
        results.filter(function(r) { return !r.valid; }).map(function(r) { return r.id; }).join(', '));
    }

    return { valid: allValid, results: results };
  }

  /**
   * Validate that required services are initialized.
   * @returns {Object} { valid, services }
   */
  function validateServices() {
    var services = {
      'window.__srs': !!window.__srs,
      'window.__analytics': !!window.__analytics,
      'window.__diag': !!window.__diag,
      'typeof DOM': typeof DOM !== 'undefined',
      'typeof ALL_WORDS': typeof ALL_WORDS !== 'undefined',
    };
    var allValid = Object.keys(services).every(function(k) { return services[k]; });
    return { valid: allValid, services: services };
  }

  /**
   * Validate that a render function produces output without error.
   * @param {string} renderFnName - Name of the render function
   * @param {string} containerId - ID of the container element
   * @returns {Object} { success, error, hadContent }
   */
  function validateRender(renderFnName, containerId) {
    try {
      var fn = window[renderFnName];
      if (typeof fn !== 'function') {
        return { success: false, error: 'Function "' + renderFnName + '" not found' };
      }
      fn();
      var container = document.getElementById(containerId);
      var hadContent = container && container.innerHTML.length > 0;
      return { success: true, hadContent: hadContent };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Check for duplicate element IDs in the DOM.
   * Duplicate IDs break getElementById and cause subtle bugs.
   * @returns {Object} { hasDuplicates, duplicates }
   */
  function checkDuplicateIDs() {
    var allElements = document.querySelectorAll('[id]');
    var seen = {};
    var duplicates = [];

    allElements.forEach(function(el) {
      var id = el.id;
      if (seen[id]) {
        if (duplicates.indexOf(id) < 0) duplicates.push(id);
      } else {
        seen[id] = true;
      }
    });

    if (duplicates.length > 0 && window.__diag) {
      window.__diag.warn('Validation', 'checkDuplicateIDs',
        'Duplicate element IDs found: ' + duplicates.join(', '));
    }

    return { hasDuplicates: duplicates.length > 0, duplicates: duplicates };
  }

  /**
   * Run the full validation suite.
   * Reports all issues found.
   * @returns {Object} Complete validation results
   */
  function runFullValidation() {
    var results = {
      navigation: validateNavigation(),
      services: validateServices(),
      duplicateIDs: checkDuplicateIDs(),
      routes: {},
      timestamp: new Date().toISOString(),
    };

    // Validate all known routes
    VALID_ROUTES.forEach(function(route) {
      results.routes[route] = validateRoute(route);
    });

    var allPassed = results.navigation.valid && results.services.valid &&
      !results.duplicateIDs.hasDuplicates &&
      Object.keys(results.routes).every(function(r) { return results.routes[r].valid; });

    results.passed = allPassed;

    if (!allPassed && window.__diag) {
      window.__diag.warn('Validation', 'runFullValidation',
        'Full validation ' + (allPassed ? 'PASSED' : 'FAILED'));
    }

    return results;
  }

  /**
   * Auto-validate on route change.
   * Called by switchView to verify navigation targets are valid.
   * @param {string} viewName - The view being navigated to
   */
  function onRouteChange(viewName) {
    var route = validateRoute(viewName);
    if (!route.valid && window.__diag) {
      route.warnings.forEach(function(w) {
        window.__diag.warn('Validation', 'switchView:' + viewName, w);
      });
    }
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    validateRoute: validateRoute,
    validateHandler: validateHandler,
    validateElements: validateElements,
    validateNavigation: validateNavigation,
    validateServices: validateServices,
    validateRender: validateRender,
    checkDuplicateIDs: checkDuplicateIDs,
    runFullValidation: runFullValidation,
    onRouteChange: onRouteChange,
    VALID_ROUTES: VALID_ROUTES,
  };

})();

console.log('[validation] Loaded');
