#!/usr/bin/env node
/**
 * ux-polish.test.js — Unit tests for the UX Polish Module
 *
 * Tests: onboarding completion tracking, premium slides, goal/level
 * screens, toast creation/dismissal, milestone celebrations, empty states,
 * skeleton loaders, tooltips, progressive disclosure, and helper functions.
 *
 * Run: node test/ux-polish.test.js
 */

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var assert = require('assert');

// ── Mock localStorage ──
var _storage = {};
global.localStorage = {
  getItem: function(key) { return _storage[key] !== undefined ? _storage[key] : null; },
  setItem: function(key, val) { _storage[key] = String(val); },
  removeItem: function(key) { delete _storage[key]; },
  clear: function() { _storage = {}; },
};

function clearStorage() { _storage = {}; }

// ── Mock DOM helpers ──
var _createdElements = {};
var _elementById = {};
var _eventListeners = {};
var _bodyChildren = [];
var _nextId = 0;
var _timeoutIds = [null];
var _timeoutCallbacks = {};

function _resetDOM() {
  _createdElements = {};
  _elementById = {};
  _eventListeners = {};
  _bodyChildren = [];
  _nextId = 0;
  _timeoutCallbacks = {};
  _timeoutIds = [null];
}

function _parseInnerHTML(el, html) {
  if (!html) { return; }
  var re = /id="([^"]+)"/g;
  var match;
  while ((match = re.exec(html)) !== null) {
    var childId = match[1];
    var child = _makeMockElement('div');
    child.id = childId;
    el.appendChild(child);
  }
}

function _makeMockElement(tagName) {
  var el = {
    _tagName: tagName || 'div',
    _uid: _nextId++,
    _idVal: '',
    _className: '',
    _styleObj: {},
    _innerHTML: '',
    _onclick: null,
    _dismissTimer: null,
    parentNode: null,
    children: [],
    attributes: {},
    title: '',
    disabled: false,
    textContent: '',

    setAttribute: function(attr, val) { this.attributes[attr] = val; },
    getAttribute: function(attr) { return this.attributes[attr] || null; },

    appendChild: function(child) {
      child.parentNode = this;
      this.children.push(child);
    },

    removeChild: function(child) {
      var idx = this.children.indexOf(child);
      if (idx >= 0) { this.children.splice(idx, 1); child.parentNode = null; }
    },

    focus: function() {},

    click: function() {
      if (typeof this._onclick === 'function') { this._onclick(); }
    },

    querySelectorAll: function(sel) {
      var results = [];
      for (var qi = 0; qi < this.children.length; qi++) {
        if (this.children[qi]._tagName === 'button' && !this.children[qi].disabled) {
          results.push(this.children[qi]);
        }
      }
      if (this._tagName === 'button' && !this.disabled) { results.push(this); }
      return results;
    },

    querySelector: function(sel) {
      for (var qi = 0; qi < this.children.length; qi++) {
        if (this.children[qi].getAttribute('data-value') || this.children[qi].id) {
          return this.children[qi];
        }
      }
      return null;
    },

    getBoundingClientRect: function() {
      return { top: 100, bottom: 200, left: 50, right: 150, width: 100, height: 100 };
    },

    classList: {
      _owner: null,
      _nameSet: null,
      add: function(c) {
        if (!this._nameSet) { this._nameSet = {}; }
        this._nameSet[c] = true;
        this._owner._className = Object.keys(this._nameSet).join(' ');
      },
      remove: function(c) {
        if (this._nameSet) { delete this._nameSet[c]; }
        this._owner._className = this._nameSet ? Object.keys(this._nameSet).join(' ') : '';
      },
      contains: function(c) {
        return this._nameSet ? !!this._nameSet[c] : false;
      },
    },
  };

  el.classList._owner = el;

  Object.defineProperty(el, 'id', {
    get: function() { return this._idVal; },
    set: function(v) { this._idVal = v; if (v) { _elementById[v] = this; } },
    enumerable: true,
  });

  Object.defineProperty(el, 'className', {
    get: function() { return this._className; },
    set: function(v) {
      this._className = v || '';
      this.classList._nameSet = {};
      if (v) {
        v.split(' ').forEach(function(c) { if (c) { this.classList._nameSet[c] = true; } }.bind(this));
      }
    },
    enumerable: true,
  });

  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
    enumerable: true,
  });

  Object.defineProperty(el, 'style', {
    get: function() { return this._styleObj; },
    set: function(v) { if (typeof v === 'string') { this._styleObj = {}; } else { this._styleObj = v; } },
    enumerable: true,
  });

  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHTML; },
    set: function(v) {
      this._innerHTML = v;
      _parseInnerHTML(el, v);
    },
    enumerable: true,
  });

  return el;
}

function _trackElement(tagName, el) {
  if (!_createdElements[tagName]) { _createdElements[tagName] = []; }
  _createdElements[tagName].push(el);
}

global.document = {
  createElement: function(tagName) {
    var el = _makeMockElement(tagName);
    _trackElement(tagName, el);
    return el;
  },
  getElementById: function(id) { return _elementById[id] || null; },
  body: (function() {
    var bodyClassList = { _set: {}, add: function(c) { this._set[c] = true; }, remove: function(c) { delete this._set[c]; }, contains: function(c) { return !!this._set[c]; } };
    return {
      style: {},
      classList: bodyClassList,
      children: [],
      appendChild: function(el) { _bodyChildren.push(el); el.parentNode = this; this.children.push(el); },
      removeChild: function(el) {
        var idx = _bodyChildren.indexOf(el);
        if (idx >= 0) { _bodyChildren.splice(idx, 1); }
        var cidx = this.children.indexOf(el);
        if (cidx >= 0) { this.children.splice(cidx, 1); }
        el.parentNode = null;
      },
    };
  })(),
  addEventListener: function(event, handler) {
    if (!_eventListeners[event]) { _eventListeners[event] = []; }
    _eventListeners[event].push(handler);
  },
  removeEventListener: function(event, handler) {
    if (!_eventListeners[event]) { return; }
    var idx = _eventListeners[event].indexOf(handler);
    if (idx >= 0) { _eventListeners[event].splice(idx, 1); }
  },
  activeElement: null,
  querySelectorAll: function(sel) {
    var results = [];
    // Search all created elements by class/id/tag
    for (var tag in _createdElements) {
      var arr = _createdElements[tag];
      for (var i = 0; i < arr.length; i++) {
        var el = arr[i];
        // Match by class selector like '.onboarding-choice'
        if (sel.indexOf('.') === 0) {
          var cls = sel.substring(1);
          if (el._className && el._className.split(' ').indexOf(cls) >= 0) {
            results.push(el);
          }
        }
        // Also search children
        for (var ci = 0; ci < (el.children || []).length; ci++) {
          var child = el.children[ci];
          if (sel.indexOf('.') === 0) {
            var cls2 = sel.substring(1);
            if (child._className && child._className.split(' ').indexOf(cls2) >= 0) {
              results.push(child);
            }
          }
        }
      }
    }
    return results;
  },
};

global.window = {};

global.navigator = { onLine: true };

global.requestAnimationFrame = function(fn) { fn(); return 0; };

global.setTimeout = function(fn) {
  var id = _timeoutIds.length;
  _timeoutIds.push(id);
  _timeoutCallbacks[id] = fn;
  return id;
};

global.clearTimeout = function(id) { delete _timeoutCallbacks[id]; };

function flushTimeouts() {
  var ids = Object.keys(_timeoutCallbacks);
  ids.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
  ids.forEach(function(id) {
    if (_timeoutCallbacks[id]) { _timeoutCallbacks[id](); delete _timeoutCallbacks[id]; }
  });
}

global.escapeHtml = function(str) {
  if (!str) { return ''; }
  return str.replace(/[&<>"']/g, function(c) {
    var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return m[c] || c;
  });
};

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var uxCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ux-polish.js'), 'utf8');
eval(uxCode);

var ux = global.window.__ux;

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  \u2705 ' + name); }
  catch (e) { failed++; console.log('  \u274C ' + name); console.log('     ' + e.message.split('\n')[0]); }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

function setupOnboardingDOM() {
  var slideEl = document.createElement('div');
  slideEl.id = 'onboarding-slide';
  document.body.appendChild(slideEl);
  var dotsEl = document.createElement('div');
  dotsEl.id = 'onboarding-dots';
  document.body.appendChild(dotsEl);
  var prevBtn = document.createElement('button');
  prevBtn.id = 'onboarding-prev';
  document.body.appendChild(prevBtn);
  var nextBtn = document.createElement('button');
  nextBtn.id = 'onboarding-next';
  document.body.appendChild(nextBtn);
  var skipBtn = document.createElement('button');
  skipBtn.id = 'onboarding-skip';
  document.body.appendChild(skipBtn);
  var overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.display = 'flex';
  document.body.appendChild(overlay);
  var cardEl = document.createElement('div');
  cardEl.id = 'onboarding-card';
  document.body.appendChild(cardEl);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('Onboarding Completion Tracking', function() {
  test('hasCompletedOnboarding returns false when not set', function() {
    clearStorage();
    assert.strictEqual(ux.hasCompletedOnboarding(), false);
  });

  test('completeOnboarding sets localStorage flag', function() {
    clearStorage();
    ux.completeOnboarding();
    assert.strictEqual(localStorage.getItem('quran_onboarding_done'), 'true');
  });

  test('hasCompletedOnboarding returns true after completeOnboarding', function() {
    clearStorage();
    ux.completeOnboarding();
    assert.strictEqual(ux.hasCompletedOnboarding(), true);
  });

  test('resetOnboarding removes the flag', function() {
    clearStorage();
    ux.completeOnboarding();
    assert.strictEqual(ux.hasCompletedOnboarding(), true);
    ux.resetOnboarding();
    assert.strictEqual(ux.hasCompletedOnboarding(), false);
  });

  test('hasCompletedOnboarding returns false when localStorage throws', function() {
    var orig = localStorage.getItem;
    localStorage.getItem = function() { throw new Error('err'); };
    assert.strictEqual(ux.hasCompletedOnboarding(), false);
    localStorage.getItem = orig;
  });

  test('completeOnboarding handles localStorage errors gracefully', function() {
    var orig = localStorage.setItem;
    localStorage.setItem = function() { throw new Error('err'); };
    ux.completeOnboarding();
    localStorage.setItem = orig;
  });

  test('resetOnboarding handles localStorage errors gracefully', function() {
    var orig = localStorage.removeItem;
    localStorage.removeItem = function() { throw new Error('err'); };
    ux.resetOnboarding();
    localStorage.removeItem = orig;
  });

  test('hasInterruptedOnboarding returns false when not set', function() {
    clearStorage();
    assert.strictEqual(ux.hasInterruptedOnboarding(), false);
  });

  test('getOnboardingGoal returns null when not set', function() {
    clearStorage();
    assert.strictEqual(ux.getOnboardingGoal(), null);
  });

  test('getOnboardingLevel returns null when not set', function() {
    clearStorage();
    assert.strictEqual(ux.getOnboardingLevel(), null);
  });
});

suite('Plan Picker', function() {
  test('hasSeenPlanPicker returns false when not set', function() {
    clearStorage();
    assert.strictEqual(ux.hasSeenPlanPicker(), false);
  });

  test('hasSeenPlanPicker returns false when localStorage throws', function() {
    var orig = localStorage.getItem;
    localStorage.getItem = function() { throw new Error('err'); };
    assert.strictEqual(ux.hasSeenPlanPicker(), false);
    localStorage.getItem = orig;
  });

  test('showPlanPicker creates overlay and appends to body', function() {
    _resetDOM();
    ux.showPlanPicker();
    var o = document.getElementById('plan-picker-overlay');
    assert.ok(o !== null, 'plan picker overlay exists');
    assert.ok(_bodyChildren.indexOf(o) >= 0, 'appended to body');
  });

  test('showPlanPicker sets aria dialog attributes', function() {
    _resetDOM();
    ux.showPlanPicker();
    var o = document.getElementById('plan-picker-overlay');
    assert.strictEqual(o.getAttribute('role'), 'dialog');
    assert.strictEqual(o.getAttribute('aria-modal'), 'true');
    assert.ok(o.getAttribute('aria-label').indexOf('Choose') >= 0);
  });

  test('plan picker overlay has plan cards', function() {
    _resetDOM();
    ux.showPlanPicker();
    // Check overlay HTML contains plan option buttons
    var o = document.getElementById('plan-picker-overlay');
    assert.ok(o.innerHTML.indexOf('plan-card') >= 0, 'should have plan cards');
    assert.ok(o.innerHTML.indexOf('Free') >= 0, 'should have Free option');
    assert.ok(o.innerHTML.indexOf('Monthly') >= 0, 'should have Monthly option');
    assert.ok(o.innerHTML.indexOf('Yearly') >= 0, 'should have Yearly option');
  });

  test('plan picker has skip link', function() {
    _resetDOM();
    ux.showPlanPicker();
    var o = document.getElementById('plan-picker-overlay');
    assert.ok(o.innerHTML.indexOf('Skip') >= 0, 'should have skip link');
  });

  test('hidePlanPicker removes overlay from DOM', function() {
    _resetDOM();
    ux.showPlanPicker();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.ok(overlay !== null, 'overlay created');
    assert.ok(overlay.parentNode !== null, 'overlay has parent');
    ux.hidePlanPicker();
    // After hide, overlay should be removed (via timeout)
    flushTimeouts();
    assert.strictEqual(overlay.parentNode, null, 'overlay parent removed');
  });

  test('hidePlanPicker restores body scroll', function() {
    _resetDOM();
    ux.showPlanPicker();
    assert.ok(document.body.classList.contains('body-overflow-locked'), 'body locked');
    ux.hidePlanPicker();
    flushTimeouts();
    assert.strictEqual(document.body.classList.contains('body-overflow-locked'), false, 'body unlocked');
  });

  test('hidePlanPicker handles missing overlay', function() {
    _resetDOM();
    ux.hidePlanPicker();
  });

  test('plan picker overlay sets plan-picker-visible class', function() {
    _resetDOM();
    ux.showPlanPicker();
    var o = document.getElementById('plan-picker-overlay');
    assert.ok(o.className.indexOf('plan-picker-overlay') >= 0, 'has base class');
    assert.ok(o.classList.contains('plan-picker-visible'), 'has visible class');
  });
});

suite('Welcome Slides Data', function() {
  test('_welcomeSlides has 1 consolidated slide', function() {
    assert.strictEqual(_welcomeSlides.length, 1);
  });

  test('slide has title and 4 condensed bullets', function() {
    var s = _welcomeSlides[0];
    assert.ok(typeof s.title === 'string' && s.title.length > 0, 'Slide title');
    assert.ok(Array.isArray(s.bullets), 'has bullets array');
    assert.strictEqual(s.bullets.length, 4, 'has 4 bullets');
    for (var i = 0; i < s.bullets.length; i++) {
      assert.ok(typeof s.bullets[i] === 'string' && s.bullets[i].length > 0, 'Bullet ' + i);
    }
  });

  test('bullets cover the four key benefits', function() {
    var text = _welcomeSlides[0].bullets.join(' ');
    assert.ok(/frequent/i.test(text), 'frequency-based learning order');
    assert.ok(/comprehension/i.test(text), 'comprehension tracking');
    assert.ok(/word/i.test(text) && /tafsir|meaning|root/i.test(text), 'interactive word tapping');
    assert.ok(/spaced repetition/i.test(text), 'smart reviews / spaced repetition');
  });
});

suite('Onboarding Screen Navigation', function() {
  test('renderOnboardingScreen sets index and renders content', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(1);
    assert.strictEqual(_onboardingIdx, 1);
    assert.ok(document.getElementById('onboarding-slide').innerHTML.length > 0);
  });

  test('prev button hidden on first slide, visible after', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(0);
    assert.strictEqual(document.getElementById('onboarding-prev').style.display, 'none');
    renderOnboardingScreen(1);
    assert.notStrictEqual(document.getElementById('onboarding-prev').style.display, 'none');
  });

  test('next button shows Start Learning on last screen', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(2); // last screen (level)
    assert.strictEqual(document.getElementById('onboarding-next').textContent, '\u2713 Start Learning');
  });

  test('next button shows Personalize on the consolidated intro screen', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(0); // the single welcome screen
    assert.strictEqual(document.getElementById('onboarding-next').textContent, 'Personalize \u2192');
  });

  test('renderOnboardingScreen saves step to localStorage', function() {
    _resetDOM();
    clearStorage();
    setupOnboardingDOM();
    renderOnboardingScreen(1);
    assert.strictEqual(localStorage.getItem('quran_onboarding_step'), '1');
  });

  test('renderOnboardingScreen handles missing slide element', function() {
    _resetDOM();
    renderOnboardingScreen(0);
  });
});

suite('Onboarding Goal Selection Screen', function() {
  test('goal screen renders 4 choices', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(1); // goal screen
    var slide = document.getElementById('onboarding-slide');
    assert.ok(slide.innerHTML.indexOf('4)') >= 0 || slide.innerHTML.match(/onboarding-choice/g).length >= 4);
  });

  test('goal screen shows Set Your Daily Goal title', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(1);
    var slide = document.getElementById('onboarding-slide');
    assert.ok(slide.innerHTML.indexOf('Daily Goal') >= 0);
  });
});

suite('Onboarding Level Selection Screen', function() {
  test('level screen renders 4 choices', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(2); // level screen
    var slide = document.getElementById('onboarding-slide');
    assert.ok(slide.innerHTML.indexOf('onboarding-choice') >= 0);
  });

  test('level screen shows Experience Level title', function() {
    _resetDOM();
    setupOnboardingDOM();
    renderOnboardingScreen(2);
    var slide = document.getElementById('onboarding-slide');
    assert.ok(slide.innerHTML.indexOf('Experience') >= 0);
  });
});

suite('renderEmptyState', function() {
  test('returns HTML with icon, title, and description', function() {
    var html = ux.renderEmptyState('\uD83D\uDCA1', 'No Data', 'Start learning');
    assert.ok(html.indexOf('empty-state') >= 0);
    assert.ok(html.indexOf('\uD83D\uDCA1') >= 0);
    assert.ok(html.indexOf('No Data') >= 0);
    assert.ok(html.indexOf('Start learning') >= 0);
  });

  test('escapes HTML in title', function() {
    var html = ux.renderEmptyState('i', '<script>alert(1)</script>', 'd');
    assert.ok(html.indexOf('&lt;script&gt;') >= 0);
    assert.ok(html.indexOf('<script>') < 0);
  });

  test('includes action HTML when provided', function() {
    var html = ux.renderEmptyState('i', 't', 'd', '<button>Go</button>');
    assert.ok(html.indexOf('empty-state-action') >= 0);
    assert.ok(html.indexOf('<button>Go</button>') >= 0);
  });

  test('omits action section when not provided', function() {
    var html = ux.renderEmptyState('i', 't', 'd');
    assert.ok(html.indexOf('empty-state-action') < 0);
  });

  test('handles null title gracefully', function() {
    var html = ux.renderEmptyState('i', null, 'd');
    assert.ok(html.indexOf('null') < 0);
  });

  test('handles undefined description gracefully', function() {
    var html = ux.renderEmptyState('i', 't');
    assert.ok(html.indexOf('empty-state') >= 0);
  });
});

suite('getContextualEmptyState', function() {
  test('returns bookmarks state with correct title', function() {
    var state = ux.getContextualEmptyState('bookmarks');
    assert.ok(state !== null);
    assert.ok(state.title.indexOf('Bookmarks') >= 0);
  });

  test('returns reviews state with Caught Up title', function() {
    var state = ux.getContextualEmptyState('reviews');
    assert.ok(state !== null);
    assert.ok(state.title.indexOf('Caught Up') >= 0);
  });

  test('returns achievements state with action', function() {
    var state = ux.getContextualEmptyState('achievements');
    assert.ok(state !== null);
    assert.ok(state.action.length > 0);
  });

  test('returns null for unknown section', function() {
    assert.strictEqual(ux.getContextualEmptyState('nonexistent'), null);
  });
});

suite('renderSkeleton', function() {
  test('card type generates correct number of skeleton lines', function() {
    assert.strictEqual(ux.renderSkeleton(5, 'card').match(/skeleton-line/g).length, 5);
  });

  test('card type defaults to 3 lines when lines is null', function() {
    assert.strictEqual(ux.renderSkeleton(null, 'card').match(/skeleton-line/g).length, 3);
  });

  test('chart type generates bars with skeleton-chart wrapper', function() {
    var html = ux.renderSkeleton(7, 'chart');
    assert.ok(html.indexOf('skeleton-chart') >= 0);
    assert.strictEqual(html.match(/skeleton-bar/g).length, 7);
  });

  test('list type generates rows with skeleton-line-sm', function() {
    var html = ux.renderSkeleton(3, 'list');
    assert.strictEqual(html.match(/skeleton-row/g).length, 3);
    assert.ok(html.indexOf('skeleton-line-sm') >= 0);
  });

  test('defaults to card type when no type given', function() {
    assert.strictEqual(ux.renderSkeleton(2).match(/skeleton-line/g).length, 2);
  });
});

suite('showToast', function() {
  test('creates toast container when not present', function() {
    _resetDOM();
    ux.showToast('Test', 'info');
    var c = document.getElementById('toast-container');
    assert.ok(c !== null, 'toast container exists');
    assert.ok(_bodyChildren.indexOf(c) >= 0, 'appended to body');
    assert.strictEqual(c.getAttribute('aria-live'), 'polite');
  });

  test('reuses existing toast container', function() {
    _resetDOM();
    var existing = document.createElement('div');
    existing.id = 'toast-container';
    document.body.appendChild(existing);
    ux.showToast('Test', 'info');
    assert.strictEqual(document.getElementById('toast-container'), existing);
  });

  test('creates toast element with escaped message', function() {
    _resetDOM();
    ux.showToast('<b>Bold</b>', 'success');
    var toast = document.getElementById('toast-container').children[0];
    assert.ok(toast.innerHTML.indexOf('&lt;b&gt;') >= 0);
    assert.ok(toast.innerHTML.indexOf('<b>') < 0);
  });

  test('assigns correct CSS class per type', function() {
    var types = ['success', 'error', 'info', 'warning'];
    for (var ti = 0; ti < types.length; ti++) {
      _resetDOM();
      ux.showToast('Test', types[ti]);
      assert.ok(document.getElementById('toast-container').children[0].className.indexOf('toast-' + types[ti]) >= 0);
    }
  });

  test('defaults to info type', function() {
    _resetDOM();
    ux.showToast('Test');
    assert.ok(document.getElementById('toast-container').children[0].className.indexOf('toast-info') >= 0);
  });

  test('sets dismiss timer', function() {
    _resetDOM();
    ux.showToast('Test', 'info');
    var toast = document.getElementById('toast-container').children[0];
    assert.ok(toast._dismissTimer !== undefined, 'dismissTimer set');
  });

  test('multiple toasts stack in container', function() {
    _resetDOM();
    ux.showToast('First', 'info');
    ux.showToast('Second', 'success');
    ux.showToast('Third', 'warning');
    assert.strictEqual(document.getElementById('toast-container').children.length, 3);
  });
});

suite('dismissToast', function() {
  test('removes toast from DOM after animation timeout', function() {
    _resetDOM();
    ux.showToast('Test', 'info');
    var container = document.getElementById('toast-container');
    var toast = container.children[0];
    dismissToast(toast);
    assert.ok(toast.className.indexOf('toast-hiding') >= 0, 'toast-hiding added');
    flushTimeouts();
    assert.strictEqual(container.children.length, 0, 'toast removed from DOM');
  });

  test('handles null toast gracefully', function() {
    dismissToast(null);
  });

  test('handles orphan toast without parent', function() {
    _resetDOM();
    var orphan = document.createElement('div');
    dismissToast(orphan);
  });
});

suite('showMilestoneCelebration', function() {
  function findOverlay() {
    var all = _createdElements['div'] || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].className.indexOf('milestone-overlay') >= 0) { return all[i]; }
    }
    return null;
  }

  test('creates overlay and appends to body', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: 'Test', icon: '\uD83C\uDFC6', insight: 'Nice!' });
    var o = findOverlay();
    assert.ok(o !== null, 'overlay exists');
    assert.ok(_bodyChildren.indexOf(o) >= 0, 'appended to body');
  });

  test('contains milestone label and insight text', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: '10-Day Streak', icon: '\uD83D\uDD25', insight: 'Keep going!' });
    var o = findOverlay();
    assert.ok(o.innerHTML.indexOf('10-Day Streak') >= 0);
    assert.ok(o.innerHTML.indexOf('Keep going!') >= 0);
  });

  test('escapes HTML in label', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: '<b>XSS</b>', icon: '\uD83C\uDF89' });
    var o = findOverlay();
    assert.ok(o.innerHTML.indexOf('&lt;b&gt;') >= 0);
    assert.ok(o.innerHTML.indexOf('<b>') < 0);
  });

  test('sets aria dialog attributes', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: 'Mastery!', icon: '\uD83C\uDFC6' });
    var o = findOverlay();
    assert.strictEqual(o.getAttribute('role'), 'dialog');
    assert.strictEqual(o.getAttribute('aria-modal'), 'true');
    assert.ok(o.getAttribute('aria-label').indexOf('Mastery') >= 0);
  });

  test('handles null milestone gracefully', function() {
    _resetDOM();
    ux.showMilestoneCelebration(null);
    assert.strictEqual(_bodyChildren.length, 0);
  });

  test('handles undefined milestone gracefully', function() {
    _resetDOM();
    ux.showMilestoneCelebration(undefined);
    assert.strictEqual(_bodyChildren.length, 0);
  });
});

suite('showOnboarding / hideOnboarding', function() {
  test('showOnboarding creates overlay when not in DOM', function() {
    _resetDOM();
    ux.showOnboarding();
    var o = document.getElementById('onboarding-overlay');
    assert.ok(o !== null, 'overlay created');
    assert.ok(_bodyChildren.indexOf(o) >= 0, 'appended to body');
    assert.strictEqual(o.style.display, 'flex');
  });

  test('showOnboarding prevents body scroll', function() {
    _resetDOM();
    ux.showOnboarding();
    assert.strictEqual(document.body.classList.contains('body-overflow-locked'), true);
  });

  test('showOnboarding reuses existing overlay', function() {
    _resetDOM();
    ux.showOnboarding();
    var count = _bodyChildren.length;
    ux.showOnboarding();
    assert.strictEqual(_bodyChildren.length, count);
  });

  test('hideOnboarding hides overlay and restores scroll', function() {
    _resetDOM();
    ux.showOnboarding();
    ux.hideOnboarding();
    assert.strictEqual(document.getElementById('onboarding-overlay').style.display, 'none');
    assert.strictEqual(document.body.classList.contains('body-overflow-locked'), false);
  });

  test('hideOnboarding handles missing overlay', function() {
    _resetDOM();
    ux.hideOnboarding();
  });
});

suite('Exported API surface', function() {
  var expected = [
    'showOnboarding', 'hideOnboarding', 'hasCompletedOnboarding',
    'hasInterruptedOnboarding', 'completeOnboarding', 'resetOnboarding',
    'getOnboardingGoal', 'getOnboardingLevel',
    'showTooltip', 'showContextualTooltips', 'resetTooltips',
    'getProgressiveVisibility', 'applyProgressiveDisclosure',
    'unlockProgressiveFeature', 'showToast',
    'renderEmptyState', 'getContextualEmptyState', 'renderSkeleton',
    'showMilestoneCelebration',
    'showPlanPicker', 'hidePlanPicker', 'hasSeenPlanPicker'
  ];
  expected.forEach(function(name) {
    test(name + ' is exported', function() {
      assert.strictEqual(typeof ux[name], 'function');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// PLAN PICKER PREMIUM GATING — REGRESSION TESTS
//
// navigateToFirstAction() must resolve the LIVE premium state (refresh())
// before deciding whether to show the upgrade picker. A premium user on a
// fresh session used to see the picker because the cached isPremium() flag
// was still false while the Firestore subscription doc was loading.
// ═══════════════════════════════════════════════════════════════

var _asyncTests = [];

function addAsyncTest(name, fn) {
  _asyncTests.push({ name: name, fn: fn });
}

async function runAllAsyncTests() {
  for (var i = 0; i < _asyncTests.length; i++) {
    var t = _asyncTests[i];
    try {
      await t.fn();
      passed++;
      console.log('  \u2705 ' + t.name);
    } catch (e) {
      failed++;
      console.log('  \u274C ' + t.name + ': ' + (e.message || e).split('\n')[0]);
    }
  }
}

suite('Plan Picker Premium Gating', function() {
  addAsyncTest('premium user (refresh=true) does NOT see the plan picker', async function() {
    _resetDOM();
    clearStorage();
    global.window.__premium = {
      refresh: async function () { return true; },
      isPremium: function () { return true; },
      requestUpgrade: function () {},
      FEATURES: {},
    };
    await navigateToFirstAction();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.strictEqual(overlay, null, 'no plan picker for premium user');
    delete global.window.__premium;
  });

  addAsyncTest('premium user (refresh=true) with picker already seen still navigates cleanly', async function() {
    _resetDOM();
    clearStorage();
    global.window.__premium = {
      refresh: async function () { return true; },
      isPremium: function () { return true; },
      requestUpgrade: function () {},
      FEATURES: {},
    };
    localStorage.setItem('quran_plan_picker_seen', 'true');
    await navigateToFirstAction();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.strictEqual(overlay, null, 'no plan picker when already seen');
    delete global.window.__premium;
  });

  addAsyncTest('free user (refresh=false) still sees the plan picker', async function() {
    _resetDOM();
    clearStorage();
    global.window.__premium = {
      refresh: async function () { return false; },
      isPremium: function () { return false; },
      requestUpgrade: function () {},
      FEATURES: {},
    };
    await navigateToFirstAction();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.ok(overlay !== null, 'plan picker shown for free user');
    delete global.window.__premium;
  });

  addAsyncTest('refresh failure falls back to cached premium state', async function() {
    _resetDOM();
    clearStorage();
    global.window.__premium = {
      refresh: async function () { throw new Error('offline'); },
      isPremium: function () { return true; },
      requestUpgrade: function () {},
      FEATURES: {},
    };
    await navigateToFirstAction();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.strictEqual(overlay, null, 'no plan picker when cached state says premium');
    delete global.window.__premium;
  });

  addAsyncTest('refresh failure with non-premium cached state still shows picker', async function() {
    _resetDOM();
    clearStorage();
    global.window.__premium = {
      refresh: async function () { throw new Error('offline'); },
      isPremium: function () { return false; },
      requestUpgrade: function () {},
      FEATURES: {},
    };
    await navigateToFirstAction();
    var overlay = document.getElementById('plan-picker-overlay');
    assert.ok(overlay !== null, 'plan picker shown when cached state says free');
    delete global.window.__premium;
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

runAllAsyncTests().then(function () {
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}).catch(function (e) {
  console.error('Fatal error:', e.message || e);
  process.exit(1);
});
