// ═══════════════════════════════════════════════════════════════
// diagnostics.js — Structured Error & Diagnostics System
//
// Provides:
//   • Centralized error reporting with component context
//   • Development-mode diagnostics with file/function/line info
//   • Production-mode clean user-friendly messages
//   • Error severity levels (error, warning, info)
//   • Error history for debugging sessions
//   • Diagnostic assertion system
// ═══════════════════════════════════════════════════════════════

// ── Diagnostics Namespace ─────────────────────────────────────
window.__diag = (function() {

  /** @type {boolean} Whether we are in development mode */
  var isDev = location.href.indexOf('.min.') < 0 && location.href.indexOf('bundle.') < 0 && location.href.indexOf('/dist/') < 0;

  /** @type {Array} Full error history for this session */
  var errorLog = [];

  /** @type {number} Max errors to keep in memory */
  var MAX_ERRORS = 200;

  // ── Severity Levels ─────────────────────────────────────────

  var SEVERITY = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
  };

  // ── Core Reporting ──────────────────────────────────────────

  /**
   * Report an error with full context.
   * In production: logs clean user message + console detail.
   * In development: logs full diagnostics to console.
   *
   * @param {Object} options
   * @param {string}  options.component  - Component name (e.g. 'Analytics', 'Dashboard')
   * @param {string}  options.fn         - Function name (e.g. 'renderAnalyticsInsightsPage')
   * @param {string}  options.file       - Source file path (e.g. 'js/ui/analytics-ui.js')
   * @param {string}  [options.message]  - Human-readable error description
   * @param {Error}   [options.error]    - The original Error object (if any)
   * @param {string}  [options.severity] - 'error', 'warning', or 'info'
   * @param {Object}  [options.state]    - Relevant application state snapshot
   * @param {boolean} [options.userVisible] - Whether to show a user-friendly message
   * @returns {Object} The error report object
   */
  function reportError(options) {
    try {
      var error = options.error || new Error();
      var stack = error.stack || '';
      var lineMatch = stack.match(/:(\d+):(\d+)/);
      var lineNumber = lineMatch ? lineMatch[1] : '?';
      var columnNumber = lineMatch ? lineMatch[2] : '?';

      var report = {
        timestamp: new Date().toISOString(),
        component: options.component || 'Unknown',
        fn: options.fn || 'unknown',
        file: options.file || extractFileFromStack(stack),
        line: lineNumber,
        column: columnNumber,
        message: options.message || (error.message || 'Unknown error'),
        severity: options.severity || SEVERITY.ERROR,
        stack: stack,
        state: options.state || null,
        userVisible: options.userVisible !== false,
      };

      // Store in error history
      errorLog.push(report);
      if (errorLog.length > MAX_ERRORS) {
        errorLog.shift();
      }

      // Log appropriate level to console
      if (isDev) {
        logDev(report);
      } else {
        logProd(report);
      }

      return report;
    } catch (e) {
      // Last-resort fallback: never let diagnostics itself crash
      try {
        console.error('[diag] Fatal: Error reporter threw:', e.message, 'Original:', options && options.message);
      } catch (e2) {
        // Silent
      }
      return null;
    }
  }

  /**
   * Extract the calling file from a stack trace.
   */
  function extractFileFromStack(stack) {
    if (!stack) return 'unknown';
    // Look for the second stack frame (first caller after diagnostics)
    var lines = stack.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/(https?:\/\/[^:]+|js\/[^:]+)/);
      if (match) {
        var path = match[1];
        // Simplify URL to relative path
        var idx = path.indexOf('js/');
        if (idx >= 0) return path.substring(idx);
        return path;
      }
    }
    return 'unknown';
  }

  /**
   * Development mode logging — rich, verbose, easy to inspect.
   */
  function logDev(report) {
    var prefix = '[' + report.component + ']';

    if (report.severity === SEVERITY.ERROR) {
      console.groupCollapsed(
        '%c✗ ' + prefix + ' ' + report.message,
        'color:#ef4444;font-weight:bold'
      );
    } else if (report.severity === SEVERITY.WARNING) {
      console.groupCollapsed(
        '%c⚠ ' + prefix + ' ' + report.message,
        'color:#f59e0b;font-weight:bold'
      );
    } else {
      console.groupCollapsed(
        '%cℹ ' + prefix + ' ' + report.message,
        'color:#3b82f6'
      );
    }

    console.log('Component:', report.component);
    console.log('Function:', report.fn);
    console.log('File:', report.file);
    console.log('Line:', report.line + ':' + report.column);
    console.log('Severity:', report.severity);
    console.log('Timestamp:', report.timestamp);
    if (report.error) console.log('Error:', report.error);
    console.log('Stack:', report.stack);
    if (report.state) console.log('State:', report.state);
    console.groupEnd();
  }

  /**
   * Production mode logging — clean user message, detailed console but less noisy.
   */
  function logProd(report) {
    var prefix = '[' + report.component + ']';

    if (report.severity === SEVERITY.ERROR) {
      console.error(prefix, report.message, '|', report.fn, '|', report.file + ':' + report.line);
      if (report.stack) console.error('  ↳', report.stack.split('\n')[1] || '');
    } else if (report.severity === SEVERITY.WARNING) {
      console.warn(prefix, report.message, '|', report.fn);
    } else {
      console.log(prefix, report.message);
    }
  }

  // ── Convenience Methods ─────────────────────────────────────

  /**
   * Report an error (severity: error).
   */
  function error(component, fn, message, error, state) {
    return reportError({
      component: component,
      fn: fn,
      message: message,
      error: error,
      severity: SEVERITY.ERROR,
      state: state,
    });
  }

  /**
   * Report a warning (severity: warning).
   */
  function warn(component, fn, message, state) {
    return reportError({
      component: component,
      fn: fn,
      message: message,
      severity: SEVERITY.WARNING,
      state: state,
    });
  }

  /**
   * Report an info message (severity: info).
   */
  function info(component, fn, message, state) {
    return reportError({
      component: component,
      fn: fn,
      message: message,
      severity: SEVERITY.INFO,
      state: state,
    });
  }

  /**
   * Report an error from a catch block with automatic file/function extraction.
   * @param {string} component - Component name
   * @param {string} fn - Function name
   * @param {string} file - Source file
   * @param {Error} error - The caught error
   * @param {Object} [state] - Optional state snapshot
   */
  function catchError(component, fn, file, error, state) {
    return reportError({
      component: component,
      fn: fn,
      file: file,
      message: error ? error.message : 'Unknown error',
      error: error,
      severity: SEVERITY.ERROR,
      state: state,
    });
  }

  // ── Diagnostics: Function Existence Checks ──────────────────

  /**
   * Verify that a set of functions exist and are callable.
   * Reports warnings for missing functions.
   * @param {string} component - Component name for reporting
   * @param {Object<string, string>} fns - Map of function names to their purpose
   * @returns {boolean} true if ALL functions exist
   */
  function checkFunctions(component, fns) {
    var allExist = true;
    for (var fnName in fns) {
      if (fns.hasOwnProperty(fnName)) {
        var exists = typeof window[fnName] === 'function';
        if (!exists) {
          warn(component, 'checkFunctions', 'Required function "' + fnName + '" is not defined (' + fns[fnName] + ')');
          allExist = false;
        }
      }
    }
    return allExist;
  }

  /**
   * Verify that a set of DOM elements exist.
   * Reports warnings for missing elements.
   * @param {string} component - Component name for reporting
   * @param {string[]} ids - Array of element IDs to check
   * @returns {Object<string, boolean>} Map of id → exists
   */
  function checkDOM(component, ids) {
    var results = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var el = document.getElementById(id);
      results[id] = !!el;
      if (!el) {
        warn(component, 'checkDOM', 'Required DOM element "#' + id + '" not found');
      }
    }
    return results;
  }

  /**
   * Verify app initialization state.
   * Checks key services, data, and DOM elements.
   * @returns {Object} Validation results
   */
  function validateInit() {
    var results = { passed: true, checks: [] };

    // Check core data
    results.checks.push({
      name: 'ALL_WORDS',
      passed: typeof ALL_WORDS !== 'undefined' && ALL_WORDS.length > 0,
      detail: typeof ALL_WORDS !== 'undefined' ? ALL_WORDS.length + ' words loaded' : 'undefined',
    });

    // Check services
    var serviceChecks = [
      { name: 'window.__srs', expr: window.__srs },
      { name: 'window.__analytics', expr: window.__analytics },
      { name: 'DOM.get', expr: typeof DOM !== 'undefined' && typeof DOM.get === 'function' },
    ];
    serviceChecks.forEach(function(svc) {
      results.checks.push({
        name: svc.name,
        passed: !!svc.expr,
        detail: svc.expr ? 'initialized' : 'missing',
      });
    });

    // Check navigation
    var navIds = ['tab-dashboard', 'tab-learn', 'tab-quiz', 'tab-list', 'tab-stats', 'tab-analytics'];
    var navOk = 0;
    navIds.forEach(function(id) {
      if (document.getElementById(id)) navOk++;
    });
    results.checks.push({
      name: 'Bottom navigation',
      passed: navOk === navIds.length,
      detail: navOk + '/' + navIds.length + ' tabs present',
    });

    // Check view containers
    var viewIds = ['view-dashboard', 'view-learn', 'view-quiz', 'view-list', 'view-stats', 'view-analytics'];
    var viewOk = 0;
    viewIds.forEach(function(id) {
      if (document.getElementById(id)) viewOk++;
    });
    results.checks.push({
      name: 'View containers',
      passed: viewOk === viewIds.length,
      detail: viewOk + '/' + viewIds.length + ' views present',
    });

    results.passed = results.checks.every(function(c) { return c.passed; });
    return results;
  }

  // ── Report History ──────────────────────────────────────────

  /**
   * Get all stored error reports for this session.
   */
  function getErrorLog() {
    return errorLog.slice();
  }

  /**
   * Clear the error log.
   */
  function clearErrorLog() {
    errorLog.length = 0;
  }

  /**
   * Get error count by severity.
   */
  function getErrorStats() {
    var stats = { error: 0, warning: 0, info: 0 };
    for (var i = 0; i < errorLog.length; i++) {
      var sev = errorLog[i].severity;
      if (stats[sev] !== undefined) stats[sev]++;
    }
    return stats;
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    reportError: reportError,
    error: error,
    warn: warn,
    info: info,
    catchError: catchError,

    checkFunctions: checkFunctions,
    checkDOM: checkDOM,
    validateInit: validateInit,

    getErrorLog: getErrorLog,
    clearErrorLog: clearErrorLog,
    getErrorStats: getErrorStats,

    // Expose constants
    SEVERITY: SEVERITY,
    isDev: isDev,
  };

})();

// Auto-run initialization validation on load
if (document.readyState === 'complete') {
  window.__diag.validateInit();
} else {
  document.addEventListener('DOMContentLoaded', function() {
    window.__diag.validateInit();
  });
}

console.log('[diagnostics] Loaded (' + (window.__diag.isDev ? 'development' : 'production') + ' mode)');
