// ═══════════════════════════════════════════════════════════════
// ui.js — UI Rendering Module
// All DOM manipulation functions — no application state here
// ═══════════════════════════════════════════════════════════════

// ── DOM element cache ─────────────────────────────────────────
// Cache frequently accessed DOM elements to avoid repeated getElementById calls
const DOM = {
  _cache: {},
  get: function(id) {
    if (!this._cache[id]) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  }
};

/**
 * Extract the short meaning from a full meaning string.
 * Many meanings follow the format "Short meaning — Additional context".
 */
function getShortMeaning(meaning) {
  return (meaning || '').split('\u2014')[0].trim();
}

/**
 * Set active view, switching visible tab content and nav tab highlight.
 */
function setView(viewName) {
  // All possible views — both main content and overlay views
  var views = ['dashboard', 'learn', 'quiz', 'list', 'stats', 'analytics', 'explorer', 'auth', 'profile', 'settings'];
  for (var i = 0; i < views.length; i++) {
    var name = views[i];
    var viewEl = DOM.get('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (name === 'dashboard' || name === 'learn' || name === 'quiz' || name === 'list' || name === 'stats' || name === 'analytics') {
      var tabEl = DOM.get('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  }
  // Animate the newly activated view (skip on first render to avoid flicker)
  if (window.__viewHasBeenSet) {
    var viewEl = DOM.get('view-' + viewName);
    if (viewEl) {
      viewEl.classList.remove('view-entrance');
      void viewEl.offsetHeight;
      viewEl.classList.add('view-entrance');
    }
  } else {
    window.__viewHasBeenSet = true;
  }

  var content = DOM.get('content');
  if (content) content.scrollTop = 0;
}

/** Track current occurrence index when viewing a canonical word */
let _currentOccurrenceIdx = 0;

/**
 * Render the word card for a given word at the given position.
 * Supports canonical words with multiple occurrences.
 */