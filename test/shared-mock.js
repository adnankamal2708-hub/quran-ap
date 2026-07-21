/**
 * test/shared-mock.js — Shared Mock Infrastructure
 *
 * Provides reusable mocks for DOM, localStorage, Date, console, and
 * common global functions used across the test suite.
 *
 * Usage:
 *   const mock = require('./shared-mock');
 *   mock.setup();
 *   // ... run tests ...
 *   mock.teardown();
 */

var assert = require('assert');

// ── Mock Storage ──
var _storage = {};

function clearStorage() { _storage = {}; }

function mockLocalStorage() {
  return {
    getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
    setItem: function(k, v) { _storage[k] = String(v); },
    removeItem: function(k) { delete _storage[k]; },
    clear: function() { _storage = {}; },
    _raw: _storage,
  };
}

// ── Mock DOM ──
var _elementsById = {};
var _allElements = [];
var _nextUid = 0;

function makeEl(tagName) {
  var el = {
    _uid: _nextUid++,
    _tag: tagName || 'div',
    _id: '',
    _className: '',
    _innerHTML: '',
    _style: {},
    _onclick: null,
    _onkeydown: null,
    textContent: '',
    children: [],
    attributes: {},
    parentNode: null,
    disabled: false,
    title: '',
    offsetHeight: 1,
    _clickHandlers: null,
    _keydownHandlers: null,

    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },

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
      if (typeof this._onclick === 'function') this._onclick();
      if (this._clickHandlers) {
        var ev = { target: this, bubbles: true, preventDefault: function() {} };
        for (var h = 0; h < this._clickHandlers.length; h++) {
          this._clickHandlers[h](ev);
        }
      }
      var p = this.parentNode;
      while (p) {
        if (p._clickHandlers) {
          var ev = { target: this, bubbles: true, preventDefault: function() {} };
          for (var h = 0; h < p._clickHandlers.length; h++) {
            p._clickHandlers[h](ev);
          }
        }
        p = p.parentNode;
      }
    },
    closest: function(selector) {
      var parts = selector.split('.');
      if (parts.length >= 2) {
        var tag = parts[0];
        var cls = parts[1];
        if ((tag === '' || this._tag === tag) && this._className && this._className.split(' ').indexOf(cls) >= 0) {
          return this;
        }
      }
      var el = this.parentNode;
      while (el) {
        var elParts = selector.split('.');
        if (elParts.length >= 2) {
          var elTag = elParts[0];
          var elCls = elParts[1];
          if ((elTag === '' || el._tag === elTag) && el._className && el._className.split(' ').indexOf(elCls) >= 0) {
            return el;
          }
        }
        el = el.parentNode;
      }
      return null;
    },
    addEventListener: function(type, handler) {
      if (!this['_' + type + 'Handlers']) {
        this['_' + type + 'Handlers'] = [];
      }
      this['_' + type + 'Handlers'].push(handler);
    },
    removeEventListener: function(type, handler) {
      var handlers = this['_' + type + 'Handlers'];
      if (!handlers) return;
      var idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    },
    dispatchEvent: function(event) {
      var handlers = this['_' + event.type + 'Handlers'];
      if (handlers) {
        event.target = this;
        for (var h = 0; h < handlers.length; h++) {
          handlers[h](event);
        }
      }
      if (event.bubbles !== false && this.parentNode) {
        this.parentNode.dispatchEvent(event);
      }
    },
  };
  _allElements.push(el);

  Object.defineProperty(el, 'id', {
    get: function() { return this._id; },
    set: function(v) { this._id = v; if (v) _elementsById[v] = this; },
  });
  Object.defineProperty(el, 'className', {
    get: function() { return this._className; },
    set: function(v) {
      this._className = v || '';
      // Sync classList._values from the raw string so that add/remove/toggle
      // are consistent with className assignments.
      var parts = this._className.split(' ').filter(Boolean);
      el.classList._values = {};
      for (var ci = 0; ci < parts.length; ci++) {
        el.classList._values[parts[ci]] = true;
      }
    },
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHTML; },
    set: function(v) {
      this._innerHTML = v || '';
      if (v) {
        var re = /id="([^"]+)"/g;
        var match;
        while ((match = re.exec(v)) !== null) {
          var foundId = match[1];
          if (foundId && !_elementsById[foundId]) {
            var child = makeEl('div');
            child.id = foundId;
            child.parentNode = el;
            el.children.push(child);
          }
        }
      }
    },
  });
  Object.defineProperty(el, 'style', {
    get: function() { return this._style; },
    set: function(v) { this._style = typeof v === 'object' ? v : {}; },
  });
  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
  });
  Object.defineProperty(el, 'onkeydown', {
    get: function() { return this._onkeydown; },
    set: function(fn) { this._onkeydown = fn; },
  });

  el.classList = {
    _values: {},
    add: function(c) { this._values[c] = true; el._className = Object.keys(this._values).join(' '); },
    remove: function(c) { delete this._values[c]; el._className = Object.keys(this._values).join(' '); },
    contains: function(c) { return !!this._values[c]; },
    toggle: function(c, force) {
      if (force === true) { this.add(c); return true; }
      if (force === false) { this.remove(c); return false; }
      if (this.contains(c)) { this.remove(c); return false; }
      this.add(c); return true;
    },
  };

  return el;
}

function resetDOM() { _elementsById = {}; _allElements = []; }

function queryElements(selector) {
  // Support simple id (#id), class (.class), tag, and attribute selectors
  var results = [];
  
  if (selector.charAt(0) === '#') {
    var id = selector.slice(1);
    return _elementsById[id] ? [_elementsById[id]] : [];
  }
  
  // Parse attribute selector: [attr="val"] or [attr]
  var attrMatch = selector.match(/^\[(\w+)(?:="([^"]*)")?\]$/);
  
  // Parse compound selector like: tag.cls or .cls or tag
  var tagName = '';
  var className = '';
  var attrName = '';
  var attrVal = '';
  
  if (attrMatch) {
    attrName = attrMatch[1];
    attrVal = attrMatch[2] !== undefined ? attrMatch[2] : '';
  } else if (selector.indexOf('.') >= 0) {
    var parts = selector.split('.');
    tagName = parts[0] || '';
    className = parts[1] || '';
  } else {
    tagName = selector;
  }
  
  for (var i = 0; i < _allElements.length; i++) {
    var el = _allElements[i];
    var match = true;
    
    if (tagName && el._tag !== tagName) match = false;
    if (className) {
      if (!el._className || el._className.split(' ').indexOf(className) < 0) match = false;
    }
    if (attrName) {
      var actual = el.getAttribute(attrName);
      if (attrVal !== '') {
        if (actual !== attrVal) match = false;
      } else {
        if (actual === null) match = false;
      }
    }
    
    if (match) results.push(el);
  }
  return results;
}

function mockDocument() {
  return {
    getElementById: function(id) { return _elementsById[id] || null; },
    createElement: function(tag) { return makeEl(tag); },
    querySelector: function(selector) {
      var results = queryElements(selector);
      return results.length > 0 ? results[0] : null;
    },
    querySelectorAll: function(selector) {
      return queryElements(selector);
    },
    body: {
      style: {},
      appendChild: function(el) { el.parentNode = this; },
      dispatchEvent: function() {},
    },
    addEventListener: function() {},
  };
}

// ── Mock Date (deterministic) ──
var OriginalDate = global.Date;
var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();

function setMockDate(dateStr) {
  _mockNow = new Date(dateStr).getTime();
}

function mockDate() {
  var MockDate = function() {
    if (arguments.length === 0) return new OriginalDate(_mockNow);
    return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
  };
  MockDate.now = function() { return _mockNow; };
  MockDate.prototype = OriginalDate.prototype;
  MockDate.UTC = OriginalDate.UTC;
  MockDate.parse = OriginalDate.parse;
  return MockDate;
}

// ── Mock console (silence during tests) ──
function mockConsole() {
  var _orig = {};
  return {
    install: function() {
      _orig.log = console.log;
      _orig.warn = console.warn;
      _orig.error = console.error;
      console.log = function() {};
      console.warn = function() {};
      console.error = function() {};
    },
    restore: function() {
      console.log = _orig.log;
      console.warn = _orig.warn;
      console.error = _orig.error;
    },
  };
}

// ── Setup / Teardown ──
var _origGlobals = {};

function setup() {
  _origGlobals.localStorage = global.localStorage;
  _origGlobals.document = global.document;
  _origGlobals.Date = global.Date;
  _origGlobals.window = global.window;

  clearStorage();
  resetDOM();

  global.localStorage = mockLocalStorage();
  global.document = mockDocument();
  global.Date = mockDate();
  global.window = global.window || {};
  global.console = console;

  // Common global mocks
  global.parseInt = global.parseInt || parseInt;
  global.parseFloat = global.parseFloat || parseFloat;
  global.isNaN = global.isNaN || isNaN;
  global.ALL_WORDS = global.ALL_WORDS || [];

  return {
    makeEl: makeEl,
    resetDOM: resetDOM,
    clearStorage: clearStorage,
    setMockDate: setMockDate,
    _elementsById: _elementsById,
  };
}

function teardown() {
  global.localStorage = _origGlobals.localStorage;
  global.document = _origGlobals.document;
  global.Date = _origGlobals.Date;
  global.window = _origGlobals.window;
}

// ── Test helpers ──
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
  console.log('\n\uD83D\uDCCB ' + name);
  fn();
}

function printSummary(name) {
  var total = passed + failed;
  console.log('\n' + '='.repeat(50));
  console.log('  ' + name);
  console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  console.log('='.repeat(50));
  return { passed: passed, failed: failed, total: total };
}

module.exports = {
  setup: setup,
  teardown: teardown,
  makeEl: makeEl,
  resetDOM: resetDOM,
  clearStorage: clearStorage,
  setMockDate: setMockDate,
  test: test,
  suite: suite,
  printSummary: printSummary,
  get results() { return { passed: passed, failed: failed }; },
  _storage: _storage,
  _elementsById: _elementsById,
};
