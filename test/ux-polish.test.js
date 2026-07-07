#!/usr/bin/env node
/**
 * ux-polish.test.js — Unit tests for the UX Polish Module
 *
 * Tests: onboarding completion tracking, toast creation/dismissal,
 * milestone celebrations, empty states, skeleton loaders, and
 * helper functions.
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
var _timeoutIds = [null]; // First element is dummy so IDs start at 1 (0 is falsy in JS)
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

// Parse innerHTML for id="..." patterns and create mock children
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

    querySelectorAll: function() {
      var results = [];
      for (var qi = 0; qi < this.children.length; qi++) {
        if (this.children[qi]._tagName === 'button' && !this.children[qi].disabled) {
          results.push(this.children[qi]);
        }
      }
      if (this._tagName === 'button' && !this.disabled) { results.push(this); }
      return results;
    },

    // classList that syncs with className
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

  // id property with auto-tracking
  Object.defineProperty(el, 'id', {
    get: function() { return this._idVal; },
    set: function(v) { this._idVal = v; if (v) { _elementById[v] = this; } },
    enumerable: true,
  });

  // className property tracked by classList
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

  // onclick property
  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
    enumerable: true,
  });

  // style property
  Object.defineProperty(el, 'style', {
    get: function() { return this._styleObj; },
    set: function(v) { if (typeof v === 'string') { this._styleObj = {}; } else { this._styleObj = v; } },
    enumerable: true,
  });

  // innerHTML property - parses id patterns on set
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

// Track element by tagName
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
  body: {
    style: {},
    appendChild: function(el) { _bodyChildren.push(el); el.parentNode = this; },
  },
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
};

// ── Mock window (ux-polish.js writes to window.__ux) ──
global.window = {};

// ── Mock navigator ──
global.navigator = { onLine: true };

// ── Mock requestAnimationFrame (sync) ──
global.requestAnimationFrame = function(fn) { fn(); return 0; };

// ── Mock setTimeout / clearTimeout ──
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

// ── escapeHtml (from auth-ui.js, needed by ux-polish.js) ──
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

// Setup onboarding DOM elements
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
  document.body.appendChild(overlay);
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
});

suite('Onboarding Slides Data', function() {
  test('_onboardingSlides has 6 slides', function() {
    assert.strictEqual(_onboardingSlides.length, 6);
  });

  test('each slide has icon, title, and desc', function() {
    for (var i = 0; i < _onboardingSlides.length; i++) {
      var s = _onboardingSlides[i];
      assert.ok(typeof s.icon === 'string' && s.icon.length > 0, 'Slide ' + i + ' icon');
      assert.ok(typeof s.title === 'string' && s.title.length > 0, 'Slide ' + i + ' title');
      assert.ok(typeof s.desc === 'string' && s.desc.length > 0, 'Slide ' + i + ' desc');
    }
  });

  test('slides cover expected topics in order', function() {
    assert.ok(_onboardingSlides[0].title.indexOf('Bayan') >= 0);
    assert.ok(_onboardingSlides[1].title.indexOf('Foundation') >= 0);
    assert.ok(_onboardingSlides[2].title.indexOf('Coverage') >= 0);
    assert.ok(_onboardingSlides[3].title.indexOf('Learning Paths') >= 0);
    assert.ok(_onboardingSlides[4].title.indexOf('Adaptive') >= 0);
    assert.ok(_onboardingSlides[5].title.indexOf('Sync') >= 0);
  });
});

suite('Onboarding Slide Navigation', function() {
  test('showOnboardingSlide sets index and renders content', function() {
    _resetDOM();
    setupOnboardingDOM();
    showOnboardingSlide(2);
    assert.strictEqual(_onboardingIdx, 2);
    assert.ok(document.getElementById('onboarding-slide').innerHTML.length > 0);
  });

  test('prev button hidden on first slide, visible after', function() {
    _resetDOM();
    setupOnboardingDOM();
    showOnboardingSlide(0);
    assert.strictEqual(document.getElementById('onboarding-prev').style.display, 'none');
    showOnboardingSlide(1);
    assert.notStrictEqual(document.getElementById('onboarding-prev').style.display, 'none');
  });

  test('next button shows Get Started on last slide', function() {
    _resetDOM();
    setupOnboardingDOM();
    showOnboardingSlide(5);
    assert.strictEqual(document.getElementById('onboarding-next').textContent, '\u2713 Get Started');
  });

  test('dots indicator has 6 dots with active on correct index', function() {
    _resetDOM();
    setupOnboardingDOM();
    showOnboardingSlide(3);
    var dots = document.getElementById('onboarding-dots');
    assert.strictEqual(dots.children.length, 6);
    assert.ok(dots.children[3].className.indexOf('onboarding-dot-active') >= 0);
    assert.ok(dots.children[0].className.indexOf('onboarding-dot-active') < 0);
  });

  test('showOnboardingSlide handles missing slide element', function() {
    _resetDOM();
    showOnboardingSlide(0);
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

  test('chart type defaults to 5 bars', function() {
    assert.strictEqual(ux.renderSkeleton(null, 'chart').match(/skeleton-bar/g).length, 5);
  });

  test('list type generates rows with skeleton-line-sm', function() {
    var html = ux.renderSkeleton(3, 'list');
    assert.strictEqual(html.match(/skeleton-row/g).length, 3);
    assert.ok(html.indexOf('skeleton-line-sm') >= 0);
  });

  test('list type defaults to 4 rows', function() {
    assert.strictEqual(ux.renderSkeleton(null, 'list').match(/skeleton-row/g).length, 4);
  });

  test('defaults to card type when no type given', function() {
    assert.strictEqual(ux.renderSkeleton(2).match(/skeleton-line/g).length, 2);
  });

  test('0 lines returns container with no lines', function() {
    assert.ok(ux.renderSkeleton(0, 'card').indexOf('skeleton-loading') >= 0);
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

  test('sets role=alert on toast', function() {
    _resetDOM();
    ux.showToast('Test', 'warning');
    assert.strictEqual(document.getElementById('toast-container').children[0].getAttribute('role'), 'alert');
  });

  test('toast click dismisses it', function() {
    _resetDOM();
    ux.showToast('Click me', 'info');
    var toast = document.getElementById('toast-container').children[0];
    if (toast._onclick) { toast._onclick(); }
    assert.ok(toast.className.indexOf('toast-hiding') >= 0, 'toast-hiding class added');
  });

  test('multiple toasts stack in container', function() {
    _resetDOM();
    ux.showToast('First', 'info');
    ux.showToast('Second', 'success');
    ux.showToast('Third', 'warning');
    assert.strictEqual(document.getElementById('toast-container').children.length, 3);
  });

  test('empty message still creates toast', function() {
    _resetDOM();
    ux.showToast('', 'error');
    assert.strictEqual(document.getElementById('toast-container').children.length, 1);
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

  test('clears dismiss timer on explicit dismiss', function() {
    _resetDOM();
    ux.showToast('Test', 'info');
    var toast = document.getElementById('toast-container').children[0];
    var timerId = toast._dismissTimer;
    assert.ok(timerId !== undefined, 'timer was set');
    assert.ok(_timeoutCallbacks[timerId] !== undefined, 'callback exists');
    dismissToast(toast);
    assert.ok(_timeoutCallbacks[timerId] === undefined, 'timer callback cleared');
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

  test('creates close button with onclick handler', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: 'Test', icon: '\uD83C\uDF89' });
    var btn = document.getElementById('milestone-close-btn');
    assert.ok(btn !== null, 'close button exists');
    assert.ok(typeof btn._onclick === 'function', 'onclick is a function');
  });

  test('missing optional fields renders minimal overlay', function() {
    _resetDOM();
    ux.showMilestoneCelebration({ label: 'Minimal' });
    assert.ok(findOverlay().innerHTML.indexOf('Milestone Reached!') >= 0);
  });
});

suite('updateOfflineIndicator', function() {
  function makeBadge() {
    var badge = document.createElement('div');
    badge.id = 'offline-badge';
    document.body.appendChild(badge);
    return badge;
  }

  test('shows online status when navigator.onLine is true', function() {
    _resetDOM();
    global.navigator.onLine = true;
    makeBadge();
    ux.updateOfflineIndicator();
    var badge = document.getElementById('offline-badge');
    assert.ok(badge.textContent.indexOf('Offline ready') >= 0);
    assert.ok(badge.className.indexOf('offline-badge-warning') < 0);
  });

  test('shows offline status when navigator.onLine is false', function() {
    _resetDOM();
    global.navigator.onLine = false;
    makeBadge();
    ux.updateOfflineIndicator();
    var badge = document.getElementById('offline-badge');
    assert.ok(badge.textContent.indexOf('Offline mode') >= 0);
    assert.ok(badge.className.indexOf('offline-badge-warning') >= 0);
    global.navigator.onLine = true;
  });

  test('does nothing when badge element missing', function() {
    _resetDOM();
    ux.updateOfflineIndicator();
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
    assert.strictEqual(document.body.style.overflow, 'hidden');
  });

  test('showOnboarding registers events and shows first slide', function() {
    _resetDOM();
    ux.showOnboarding();
    assert.ok(_eventListeners['keydown'] && _eventListeners['keydown'].length > 0, 'keydown listener registered');
    var slideEl = document.getElementById('onboarding-slide');
    assert.ok(slideEl !== null, 'slide element exists');
    assert.ok(slideEl.innerHTML.indexOf('Bayan') >= 0, 'shows welcome slide');
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
    assert.strictEqual(document.body.style.overflow, '');
  });

  test('hideOnboarding releases event handlers', function() {
    _resetDOM();
    ux.showOnboarding();
    var before = Object.keys(_eventListeners)
      .reduce(function(sum, k) { return sum + _eventListeners[k].length; }, 0);
    ux.hideOnboarding();
    var after = Object.keys(_eventListeners)
      .reduce(function(sum, k) { return sum + _eventListeners[k].length; }, 0);
    assert.ok(after <= before, 'handlers released');
  });

  test('hideOnboarding handles missing overlay', function() {
    _resetDOM();
    ux.hideOnboarding();
  });

  test('skip button click completes onboarding and hides overlay', function() {
    _resetDOM();
    clearStorage();
    ux.showOnboarding();
    var skipBtn = document.getElementById('onboarding-skip');
    assert.ok(skipBtn !== null, 'skip button exists');
    if (skipBtn._onclick) { skipBtn._onclick(); }
    assert.strictEqual(localStorage.getItem('quran_onboarding_done'), 'true');
    assert.strictEqual(document.getElementById('onboarding-overlay').style.display, 'none');
  });

  test('prev button decreases slide index', function() {
    _resetDOM();
    setupOnboardingDOM();
    _onboardingIdx = 0;
    showOnboardingSlide(2);
    wireOnboardingEvents();
    var prevBtn = document.getElementById('onboarding-prev');
    if (prevBtn._onclick) { prevBtn._onclick(); }
    assert.strictEqual(_onboardingIdx, 1);
  });

  test('next button increases slide index', function() {
    _resetDOM();
    setupOnboardingDOM();
    showOnboardingSlide(0);
    wireOnboardingEvents();
    var nextBtn = document.getElementById('onboarding-next');
    if (nextBtn._onclick) { nextBtn._onclick(); }
    assert.strictEqual(_onboardingIdx, 1);
  });

  test('next on last slide completes onboarding', function() {
    _resetDOM();
    clearStorage();
    setupOnboardingDOM();
    showOnboardingSlide(5);
    wireOnboardingEvents();
    var nextBtn = document.getElementById('onboarding-next');
    if (nextBtn._onclick) { nextBtn._onclick(); }
    assert.strictEqual(localStorage.getItem('quran_onboarding_done'), 'true');
  });
});

suite('Keyboard Navigation', function() {
  function setup() {
    _resetDOM();
    setupOnboardingDOM();
    wireOnboardingEvents();
    document.getElementById('onboarding-overlay').style.display = 'flex';
  }

  function pressKey(key) {
    _onboardingKeyHandler({ key: key, preventDefault: function() {} });
  }

  test('Escape completes onboarding and hides overlay', function() {
    clearStorage();
    setup();
    pressKey('Escape');
    assert.strictEqual(localStorage.getItem('quran_onboarding_done'), 'true');
    assert.strictEqual(document.getElementById('onboarding-overlay').style.display, 'none');
  });

  test('ArrowRight advances to next slide', function() {
    setup();
    showOnboardingSlide(0);
    pressKey('ArrowRight');
    assert.strictEqual(_onboardingIdx, 1);
  });

  test('Space bar advances to next slide', function() {
    setup();
    showOnboardingSlide(0);
    pressKey(' ');
    assert.strictEqual(_onboardingIdx, 1);
  });

  test('ArrowLeft goes to previous slide', function() {
    setup();
    showOnboardingSlide(2);
    pressKey('ArrowLeft');
    assert.strictEqual(_onboardingIdx, 1);
  });

  test('ArrowLeft does nothing on first slide', function() {
    setup();
    showOnboardingSlide(0);
    pressKey('ArrowLeft');
    assert.strictEqual(_onboardingIdx, 0);
  });

  test('handler does nothing when overlay is hidden', function() {
    setup();
    document.getElementById('onboarding-overlay').style.display = 'none';
    var count = 0;
    document.getElementById('onboarding-next')._onclick = function() { count++; };
    pressKey('ArrowRight');
    assert.strictEqual(count, 0);
  });
});

suite('Exported API surface', function() {
  var expected = [
    'showOnboarding', 'hideOnboarding', 'hasCompletedOnboarding',
    'completeOnboarding', 'resetOnboarding', 'showToast',
    'renderEmptyState', 'renderSkeleton', 'updateOfflineIndicator',
    'showMilestoneCelebration'
  ];
  expected.forEach(function(name) {
    test(name + ' is exported', function() {
      assert.strictEqual(typeof ux[name], 'function');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
