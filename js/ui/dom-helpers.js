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

// Views that belong to a lesson. Only these show the header's lesson strip
// (lesson title, Learned/Due/Quiz stats and word progress).
var LESSON_VIEWS = ['learn', 'quiz'];

/**
 * Set active view, switching visible tab content and nav tab highlight.
 */
function setView(viewName) {
  // All possible views — both main content and overlay views
  var views = ['dashboard', 'tracks', 'track', 'learn', 'quiz', 'list', 'explorer', 'auth', 'profile', 'settings', 'quran', 'review-center'];
  for (var i = 0; i < views.length; i++) {
    var name = views[i];
    var viewEl = DOM.get('view-' + name);
    if (viewEl) viewEl.classList.toggle('active', name === viewName);

    // Only toggle tab highlights for main nav tabs
    if (name === 'dashboard' || name === 'learn' || name === 'quiz' || name === 'list' || name === 'quran') {
      var tabEl = DOM.get('tab-' + name);
      if (tabEl) tabEl.classList.toggle('active', name === viewName);
    }
  }
  positionNavIndicator();

  // Update aria-current on nav tabs for accessibility
  var navTabs = ['dashboard', 'learn', 'quiz', 'list', 'quran'];
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

  // Outside a lesson the header collapses to the brand row, so the lesson
  // strip doesn't take a quarter of a phone screen on every tab.
  var topBar = DOM.get('top-bar');
  if (topBar) topBar.classList.toggle('top-bar-compact', LESSON_VIEWS.indexOf(viewName) < 0);

  var content = DOM.get('content');
  if (content) content.scrollTop = 0;
}

/**
 * Move the bottom-nav highlight onto the active tab, matching its measured
 * position and width. Tabs aren't equal widths ("Dashboard" is wider) and
 * the nav has side padding, so a fixed 1/5-width slot started at the screen
 * edge and drifted off the tabs. On wide screens the nav is a vertical
 * sidebar, so the highlight also takes the tab's height and top.
 */
function positionNavIndicator() {
  var indicator = document.getElementById('bn-indicator');
  var activeTab = document.querySelector('.nav-tab.active');
  if (!indicator || !activeTab) return;
  var vertical = getComputedStyle(activeTab.parentNode).flexDirection === 'column';
  indicator.style.width = activeTab.offsetWidth + 'px';
  if (vertical) {
    indicator.style.height = activeTab.offsetHeight + 'px';
    indicator.style.transform = 'translate(' + activeTab.offsetLeft + 'px, ' + activeTab.offsetTop + 'px)';
  } else {
    indicator.style.height = ''; // the stylesheet's height for the bottom bar
    indicator.style.transform = 'translateX(' + activeTab.offsetLeft + 'px)';
  }
}

/** Track current occurrence index when viewing a canonical word */
let _currentOccurrenceIdx = 0;

/**
 * Render the word card for a given word at the given position.
 * Supports canonical words with multiple occurrences.
 */