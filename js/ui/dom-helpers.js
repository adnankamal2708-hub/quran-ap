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
  var views = ['dashboard', 'learn', 'quiz', 'list', 'stats', 'analytics', 'explorer', 'auth', 'profile', 'settings', 'reader', 'review-center'];
  for (var i = 0; i < views.length; i++) {
    var name = views[i];
    var viewEl = DOM.get('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (name === 'dashboard' || name === 'learn' || name === 'quiz' || name === 'list' || name === 'stats' || name === 'analytics' || name === 'reader') {
      var tabEl = DOM.get('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  }
  // Update the sliding bn-indicator position to match the active tab
  var indicator = document.getElementById('bn-indicator');
  if (indicator) {
    var activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
      var tabs = document.querySelectorAll('.nav-tab');
      var activeIdx = Array.prototype.indexOf.call(tabs, activeTab);
      if (activeIdx >= 0) {
        indicator.style.transform = 'translateX(' + (activeIdx * 100) + '%)';
      }
    }
  }

  // Update aria-current on nav tabs for accessibility
  var navTabs = ['dashboard', 'learn', 'quiz', 'list', 'stats', 'analytics', 'reader'];
  for (var ti = 0; ti < navTabs.length; ti++) {
    var tabEl = DOM.get('tab-' + navTabs[ti]);
    if (tabEl) {
      if (navTabs[ti] === viewName) {
        tabEl.setAttribute('aria-current', 'page');
      } else {
        tabEl.removeAttribute('aria-current');
      }
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

/**
 * Initialize the bn-indicator position on first render.
 * Called once after DOM is ready, before the first setView().
 */
function initBNIndicator() {
  var indicator = document.getElementById('bn-indicator');
  if (!indicator) return;
  var activeTab = document.querySelector('.nav-tab.active');
  if (activeTab) {
    var tabs = document.querySelectorAll('.nav-tab');
    var activeIdx = Array.prototype.indexOf.call(tabs, activeTab);
    if (activeIdx >= 0) {
      indicator.style.transform = 'translateX(' + (activeIdx * 100) + '%)';
    }
  }
}

/** Track current occurrence index when viewing a canonical word */
let _currentOccurrenceIdx = 0;

/**
 * Render the word card for a given word at the given position.
 * Supports canonical words with multiple occurrences.
 */