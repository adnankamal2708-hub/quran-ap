#!/usr/bin/env node
/**
 * tooltip-verify.js — Programmatic verification of contextual tooltip system
 *
 * Tests: showTooltip once-per-tip logic, showContextualTooltips view routing,
 * positioning, resetTooltips, close/dismiss behavior, and navigation.js wiring.
 *
 * Run: node test/tooltip-verify.js
 */

var assert = require('assert');

// ═══════════════════════════════════════════════════════════════
// FULL DOM MOCK — supports innerHTML parsing for querySelector
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};

function clearStorage() { _storage = {}; }

var _elById = {};
var _bodyKids = [];
var _uidCounter = 0;
var _timeoutCbs = {};
var _timeoutNext = [null];

// ── Single mock element factory ──
function createMockEl(tag) {
  var kids = [];
  var clsMap = {};
  var e = {
    tag: tag,
    uid: _uidCounter++,
    _id: '',
    _cls: '',
    _html: '',
    _onclick: null,
    _dismissTimer: null,
    parentNode: null,
    children: kids,
    attributes: {},
    textContent: '',
    style: {},
    disabled: false,

    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },

    appendChild: function(c) { c.parentNode = this; kids.push(c); },
    removeChild: function(c) {
      var i = kids.indexOf(c);
      if (i >= 0) { kids.splice(i, 1); c.parentNode = null; }
    },

    focus: function() {},
    click: function() { if (typeof this._onclick === 'function') this._onclick(); },

    getBoundingClientRect: function() {
      return { top: 100, bottom: 200, left: 50, right: 150, width: 100, height: 100 };
    },

    // querySelector searches direct children by class
    querySelector: function(sel) {
      if (sel.indexOf('.') === 0) {
        var cls = sel.substring(1);
        for (var ci = 0; ci < kids.length; ci++) {
          var k = kids[ci];
          if (k._cls && k._cls.split(' ').indexOf(cls) >= 0) return k;
        }
      }
      return null;
    },

    querySelectorAll: function(sel) {
      var res = [];
      if (sel.indexOf('.') === 0) {
        var cls = sel.substring(1);
        for (var ci = 0; ci < kids.length; ci++) {
          var k = kids[ci];
          if (k._cls && k._cls.split(' ').indexOf(cls) >= 0) res.push(k);
        }
      }
      return res;
    },
  };

  // id
  Object.defineProperty(e, 'id', {
    get: function() { return this._id; },
    set: function(v) { this._id = v; if (v) _elById[v] = e; },
  });

  // className (syncs with classList)
  Object.defineProperty(e, 'className', {
    get: function() { return this._cls; },
    set: function(v) {
      this._cls = v || '';
      clsMap = {};
      if (v) v.split(' ').forEach(function(c) { if (c) clsMap[c] = true; });
    },
  });

  // classList
  e.classList = {
    _clsMap: clsMap,
    _owner: e,
    add: function(c) { clsMap[c] = true; this._owner._cls = Object.keys(clsMap).join(' '); },
    remove: function(c) { delete clsMap[c]; this._owner._cls = Object.keys(clsMap).join(' '); },
    contains: function(c) { return !!clsMap[c]; },
  };

  // innerHTML — parse into children
  Object.defineProperty(e, 'innerHTML', {
    get: function() { return this._html; },
    set: function(v) {
      this._html = v || '';
      // Clear existing children
      kids.length = 0;
      if (!v) return;
      // Parse HTML for class/id patterns to create child elements
      var re = /<(\w+)\s([^>]*)>/g;
      var match;
      while ((match = re.exec(v)) !== null) {
        var child = createMockEl(match[1]);
        var attrs = match[2];
        // Extract class
        var cm = /class="([^"]*)"/.exec(attrs);
        if (cm) child.className = cm[1];
        // Extract id
        var im = /id="([^"]*)"/.exec(attrs);
        if (im) child.id = im[1];
        child.parentNode = e;
        kids.push(child);
      }
    },
  });

  return e;
}

// ── Global mocks ──
var _listeners = {};
global.document = {
  createElement: function(tag) { return createMockEl(tag); },
  getElementById: function(id) { return _elById[id] || null; },
  body: (function() {
    var bc = { _set: {}, add: function(c) { this._set[c] = true; }, remove: function(c) { delete this._set[c]; } };
    return { style: {}, classList: bc, appendChild: function(el) { _bodyKids.push(el); el.parentNode = this; } };
  })(),
  addEventListener: function(e, h) { if (!_listeners[e]) _listeners[e] = []; _listeners[e].push(h); },
  removeEventListener: function(e, h) {
    if (!_listeners[e]) return;
    var i = _listeners[e].indexOf(h);
    if (i >= 0) _listeners[e].splice(i, 1);
  },
  querySelector: function(sel) {
    if (sel.indexOf('#') === 0) return _elById[sel.substring(1)] || null;
    return null;
  },
  querySelectorAll: function(sel) {
    var res = [];
    if (sel.indexOf('.') === 0) {
      var cls = sel.substring(1);
      for (var id in _elById) {
        var el = _elById[id];
        if (el._cls && el._cls.split(' ').indexOf(cls) >= 0) res.push(el);
      }
    }
    return res;
  },
};

global.window = { innerWidth: 1024, innerHeight: 768, getComputedStyle: function(el) { return { display: el.style.display || 'flex' }; } };
global.navigator = { onLine: true };
global.requestAnimationFrame = function(fn) { fn(); return 0; };

global.setTimeout = function(fn) {
  var id = _timeoutNext.length;
  _timeoutNext.push(id);
  _timeoutCbs[id] = fn;
  return id;
};
global.clearTimeout = function(id) { delete _timeoutCbs[id]; };

function flushTimeouts() {
  var ids = Object.keys(_timeoutCbs);
  ids.sort(function(a,b) { return parseInt(a,10)-parseInt(b,10); });
  ids.forEach(function(id) {
    if (_timeoutCbs[id]) { _timeoutCbs[id](); delete _timeoutCbs[id]; }
  });
}

global.escapeHtml = function(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c;
  });
};

// ── Load ux-polish module ──
var fs = require('fs');
var path = require('path');
var uxCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ux-polish.js'), 'utf8');
try { eval(uxCode); } catch (e) { console.error('Load failed:', e.message); process.exit(1); }

var ux = global.window.__ux;
if (!ux) { console.error('window.__ux not set'); process.exit(1); }

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function resetAll() {
  clearStorage();
  _elById = {};
  _bodyKids = [];
  _timeoutCbs = {};
  _timeoutNext = [null];
  global._onboardingIdx = 0;
  global._selectedGoal = null;
  global._selectedLevel = null;
  global._selectedNotify = null;
}

function addTarget(id) {
  var el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

function countTimeouts() { return Object.keys(_timeoutCbs).length; }

var pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  \u2705 ' + name); }
  catch (e) { fail++; console.log('  \u274C ' + name + ' — ' + e.message.split('\n')[0]); }
}
function s(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

s('Basic showTooltip', function() {
  t('returns early for null/undefined tipId', function() {
    resetAll();
    ux.showTooltip(null);
    ux.showTooltip(undefined);
    ux.showTooltip('fake');
    assert.strictEqual(_bodyKids.length, 0);
  });

  t('returns early when target element missing', function() {
    resetAll();
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 0);
  });

  t('creates tooltip when target exists', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 1);
    var tip = _bodyKids[0];
    assert.ok(tip._cls.indexOf('ux-tooltip') >= 0, 'has ux-tooltip class');
    assert.ok(tip._cls.indexOf('ux-tooltip-bottom') >= 0, 'has position class');
  });

  t('includes header, body, and close button in HTML', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    var html = _bodyKids[0]._html;
    assert.ok(html.indexOf('ux-tooltip-header') >= 0);
    assert.ok(html.indexOf('ux-tooltip-body') >= 0);
    assert.ok(html.indexOf('ux-tooltip-close') >= 0);
    assert.ok(html.indexOf('Interactive Reading') >= 0);
    assert.ok(html.indexOf('Tap any colored word') >= 0);
  });

  t('sets role=tooltip', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids[0].getAttribute('role'), 'tooltip');
  });

  t('sets left and top style for positioning', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    var tip = _bodyKids[0];
    assert.ok(typeof tip.style.left === 'string' && tip.style.left.length > 0);
    assert.ok(typeof tip.style.top === 'string' && tip.style.top.length > 0);
  });
});

s('Once-per-tip (localStorage)', function() {
  t('first call creates tooltip', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 1);
  });

  t('second call does NOT create another tooltip', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 1);
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 1, 'still only 1 tooltip');
  });

  t('sets localStorage seen flag', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    assert.strictEqual(localStorage.getItem('quran_tooltip_seen_reader-mode'), 'true');
  });

  t('different tip IDs are independent', function() {
    resetAll();
    addTarget('view-reader');
    addTarget('qa-show-more');
    ux.showTooltip('reader-mode');
    ux.showTooltip('word-details');
    assert.strictEqual(_bodyKids.length, 2);
    assert.strictEqual(localStorage.getItem('quran_tooltip_seen_reader-mode'), 'true');
    assert.strictEqual(localStorage.getItem('quran_tooltip_seen_word-details'), 'true');
  });

  t('resetTooltips clears all flags', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    var before = Object.keys(_storage).length;
    assert.ok(before > 0);
    ux.resetTooltips();
    assert.strictEqual(Object.keys(_storage).length, 0);
  });

  t('after reset, tooltip can be shown again (flags cleared)', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    ux.resetTooltips();
    _bodyKids = []; // reset DOM
    ux.showTooltip('reader-mode');
    assert.strictEqual(_bodyKids.length, 1);
  });
});

s('Close button', function() {
  t('close button click removes visible class', function() {
    resetAll();
    addTarget('view-reader');
    ux.showTooltip('reader-mode');
    var tip = _bodyKids[0];
    // Find close button among children
    var closeBtn = null;
    for (var ci = 0; ci < tip.children.length; ci++) {
      if (tip.children[ci]._cls && tip.children[ci]._cls.indexOf('ux-tooltip-close') >= 0) {
        closeBtn = tip.children[ci];
        break;
      }
    }
    assert.ok(closeBtn !== null, 'close button exists among children');
    // Click it
    if (closeBtn._onclick) closeBtn._onclick();
    assert.ok(tip._cls.indexOf('ux-tooltip-visible') < 0, 'visible class removed');
  });

  t('auto-dismiss timeout is set', function() {
    resetAll();
    addTarget('view-reader');
    var before = countTimeouts();
    ux.showTooltip('reader-mode');
    var after = countTimeouts();
    assert.ok(after >= before + 1, 'at least one timeout was created');
  });
});

s('Per-view tooltips', function() {
  t('word-details uses ux-tooltip-top', function() {
    resetAll();
    addTarget('qa-show-more');
    ux.showTooltip('word-details');
    assert.ok(_bodyKids[0]._cls.indexOf('ux-tooltip-top') >= 0);
  });

  t('word-details title contains Word Details', function() {
    resetAll();
    addTarget('qa-show-more');
    ux.showTooltip('word-details');
    assert.ok(_bodyKids[0]._html.indexOf('Word Details') >= 0);
  });

  t('review-center title contains Review Center', function() {
    resetAll();
    addTarget('db-review-center-prompt');
    ux.showTooltip('review-center');
    assert.ok(_bodyKids[0]._html.indexOf('Review Center') >= 0);
  });

  t('paths tip targets #tab-paths', function() {
    resetAll();
    addTarget('tab-paths');
    ux.showTooltip('paths');
    assert.strictEqual(_bodyKids.length, 1);
    assert.ok(_bodyKids[0]._html.indexOf('Learning Paths') >= 0);
  });

  t('dashboard tip targets #tab-dashboard', function() {
    resetAll();
    addTarget('tab-dashboard');
    ux.showTooltip('dashboard');
    assert.strictEqual(_bodyKids.length, 1);
    assert.ok(_bodyKids[0]._html.indexOf('Dashboard') >= 0);
  });
});

s('showContextualTooltips view routing', function() {
  t('reader view triggers reader-mode tooltip', function() {
    resetAll();
    addTarget('view-reader');
    ux.showContextualTooltips('reader');
    assert.strictEqual(_bodyKids.length, 1);
    assert.ok(_bodyKids[0]._html.indexOf('Interactive Reading') >= 0);
  });

  t('learn view triggers word-details (immediate) then paths (delayed)', function() {
    resetAll();
    addTarget('qa-show-more');
    addTarget('tab-paths');
    ux.showContextualTooltips('learn');
    assert.strictEqual(_bodyKids.length, 1, 'word-details shown immediately');
    assert.ok(_bodyKids[0]._html.indexOf('Word Details') >= 0);
    flushTimeouts();
    assert.strictEqual(_bodyKids.length, 2, 'paths also shown after timeout');
    assert.ok(_bodyKids[1]._html.indexOf('Learning Paths') >= 0);
  });

  t('dashboard view triggers dashboard then review-center (both delayed)', function() {
    resetAll();
    addTarget('tab-dashboard');
    addTarget('db-review-center-prompt');
    ux.showContextualTooltips('dashboard');
    assert.strictEqual(_bodyKids.length, 0, 'no immediate tooltips');
    flushTimeouts();
    assert.strictEqual(_bodyKids.length, 2, 'both shown after timeouts');
  });

  t('other views do nothing', function() {
    resetAll();
    ux.showContextualTooltips('quiz');
    ux.showContextualTooltips('list');
    ux.showContextualTooltips('profile');
    ux.showContextualTooltips('analytics');
    assert.strictEqual(_bodyKids.length, 0);
  });

  t('no tooltips when onboarding is completed', function() {
    resetAll();
    addTarget('view-reader');
    localStorage.setItem('quran_onboarding_done', 'true');
    ux.showContextualTooltips('reader');
    assert.strictEqual(_bodyKids.length, 0);
  });
});

s('All 5 tip definitions exist', function() {
  t('reader-mode with bottom position', function() {
    assert.ok(_tooltips['reader-mode']);
    assert.strictEqual(_tooltips['reader-mode'].position, 'bottom');
  });
  t('word-details with top position', function() {
    assert.ok(_tooltips['word-details']);
    assert.strictEqual(_tooltips['word-details'].position, 'top');
  });
  t('review-center with top position', function() {
    assert.ok(_tooltips['review-center']);
    assert.strictEqual(_tooltips['review-center'].position, 'top');
  });
  t('paths with top position', function() {
    assert.ok(_tooltips['paths']);
    assert.strictEqual(_tooltips['paths'].position, 'top');
  });
  t('dashboard with top position', function() {
    assert.ok(_tooltips['dashboard']);
    assert.strictEqual(_tooltips['dashboard'].position, 'top');
  });
});

s('Navigation.js wiring (static check)', function() {
  var navCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'navigation.js'), 'utf8');
  t('calls applyProgressiveDisclosure', function() {
    assert.ok(navCode.indexOf('applyProgressiveDisclosure') >= 0);
  });
  t('calls showContextualTooltips', function() {
    assert.ok(navCode.indexOf('showContextualTooltips') >= 0);
  });
  t('guards with hasCompletedOnboarding', function() {
    assert.ok(navCode.indexOf('hasCompletedOnboarding') >= 0);
  });
  t('uses setTimeout for delay', function() {
    assert.ok(navCode.indexOf('setTimeout') >= 0);
  });
});

s('CSS class coverage', function() {
  var css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  t('ux-tooltip class exists in CSS', function() { assert.ok(css.indexOf('.ux-tooltip') >= 0); });
  t('ux-tooltip-top class exists', function() { assert.ok(css.indexOf('.ux-tooltip-top') >= 0); });
  t('ux-tooltip-bottom class exists', function() { assert.ok(css.indexOf('.ux-tooltip-bottom') >= 0); });
  t('ux-tooltip-visible class exists', function() { assert.ok(css.indexOf('.ux-tooltip-visible') >= 0); });
  t('ux-tooltip-close class exists', function() { assert.ok(css.indexOf('.ux-tooltip-close') >= 0); });
  t('ux-tooltip-header class exists', function() { assert.ok(css.indexOf('.ux-tooltip-header') >= 0); });
  t('ux-tooltip-body class exists', function() { assert.ok(css.indexOf('.ux-tooltip-body') >= 0); });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + pass + ' passed, ' + fail + ' failed, ' + (pass + fail) + ' total');
console.log('='.repeat(50));

process.exit(fail > 0 ? 1 : 0);
