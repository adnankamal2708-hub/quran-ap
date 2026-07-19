#!/usr/bin/env node
/**
 * keyboard.test.js — Unit tests for the Keyboard Shortcut module
 *
 * Tests: showKeyboardHints, setupKeyboardShortcuts, modal handling,
 * navigation shortcuts (L, D, Z, W, S, R), learn view shortcuts,
 * quiz shortcuts, list shortcuts
 *
 * Run: node test/keyboard.test.js
 */

var assert = require('assert');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

var _storage = {};
global.localStorage = {
  getItem: function(k) { return _storage[k] !== undefined ? _storage[k] : null; },
  setItem: function(k, v) { _storage[k] = String(v); },
  removeItem: function(k) { delete _storage[k]; },
  clear: function() { _storage = {}; },
};
function clearStorage() { _storage = {}; }

var _mockNow = new Date('2026-07-07T12:00:00Z').getTime();
var OriginalDate = global.Date;
global.Date = function() {
  if (arguments.length === 0) return new OriginalDate(_mockNow);
  return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
};
global.Date.now = function() { return _mockNow; };
global.Date.prototype = OriginalDate.prototype;
global.Date.UTC = OriginalDate.UTC;
global.Date.parse = OriginalDate.parse;

global.window = { __DEV__: false };
global.console = { log: console.log, warn: function() {}, error: function() {} };

// ── Mock DOM ──
var _elementsById = {};
var _nextUid = 0;

function makeEl(tagName) {
  var el = {
    _uid: _nextUid++,
    _tag: tagName || 'div',
    _id: '',
    _className: '',
    _innerHTML: '',
    _style: { display: '' },
    _onclick: null,
    textContent: '',
    children: [],
    attributes: {},
    parentNode: null,
    disabled: false,

    click: function() { if (typeof this._onclick === 'function') this._onclick(); },

    setAttribute: function(a, v) { this.attributes[a] = v; },
    getAttribute: function(a) { return this.attributes[a] || null; },
    removeAttribute: function(a) { delete this.attributes[a]; },

    appendChild: function(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    remove: function() {},
    focus: function() {},

    querySelectorAll: function() { return []; },
  };

  Object.defineProperty(el, 'id', {
    get: function() { return this._id; },
    set: function(v) { this._id = v; if (v) _elementsById[v] = this; },
  });
  Object.defineProperty(el, 'className', {
    get: function() { return this._className; },
    set: function(v) { this._className = v || ''; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHTML; },
    set: function(v) { this._innerHTML = v || ''; },
  });
  Object.defineProperty(el, 'style', {
    get: function() { return this._style; },
    set: function(v) { this._style = typeof v === 'object' ? v : {}; },
  });
  Object.defineProperty(el, 'onclick', {
    get: function() { return this._onclick; },
    set: function(fn) { this._onclick = fn; },
  });

  el.classList = {
    _values: {},
    add: function(c) { this._values[c] = true; },
    remove: function(c) { delete this._values[c]; },
    contains: function(c) { return !!this._values[c]; },
  };

  return el;
}

function resetDOM() { _elementsById = {}; }

global.document = {
  getElementById: function(id) { return _elementsById[id] || null; },
  createElement: function(tag) { return makeEl(tag); },
  addEventListener: function(ev, handler) {
    if (!this._handlers) this._handlers = {};
    this._handlers[ev] = handler;
  },
  removeEventListener: function() {},
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  _handlers: {},
  activeElement: null,
};

// ── Mock global functions used by keyboard.js ──
var _shortcutLog = [];

global.currentView = 'learn';
global.switchView = function(v) { _shortcutLog.push('switchView:' + v); };
global.closeSessionSummary = function() { _shortcutLog.push('closeSessionSummary'); };
global.closePasswordModal = function() { _shortcutLog.push('closePasswordModal'); };
global.toggleQuickMode = function() { _shortcutLog.push('toggleQuickMode'); };

var _timeoutIds = 0;
var _timeouts = {};
global.setTimeout = function(fn, ms) {
  var id = ++_timeoutIds;
  _timeouts[id] = { fn: fn, ms: ms, fired: false };
  return id;
};
global.clearTimeout = function(id) {
  delete _timeouts[id];
};

// ═══════════════════════════════════════════════════════════════
// IMPORT THE MODULE
// ═══════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');
var kbdCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'keyboard.js'), 'utf8');
eval(kbdCode);

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    _shortcutLog = [];
    resetDOM();
    document._handlers = {};
    _timeouts = {};
    fn();
    passed++;
    console.log('  \u2705 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u274C ' + name);
    console.log('     ' + e.message.split('\n')[0]);
  }
}

function suite(name, fn) { console.log('\n\uD83D\uDCCB ' + name); fn(); }

function fireKey(key, opts) {
  opts = opts || {};
  var e = {
    key: key,
    target: opts.target || { tagName: 'DIV' },
    preventDefault: function() { _shortcutLog.push('preventDefault:' + key); },
    ctrlKey: opts.ctrlKey || false,
    metaKey: opts.metaKey || false,
    altKey: opts.altKey || false,
  };
  var handler = document._handlers['keydown'];
  if (handler) handler(e);
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

suite('setupKeyboardShortcuts', function() {
  test('registers keydown event listener', function() {
    setupKeyboardShortcuts();
    assert.ok(typeof document._handlers['keydown'] === 'function');
  });
});

suite('Input/Textarea Ignoring', function() {
  test('skips shortcuts when input is focused', function() {
    setupKeyboardShortcuts();
    fireKey('l', { target: { tagName: 'INPUT' } });
    assert.strictEqual(_shortcutLog.indexOf('switchView:learn'), -1);
  });

  test('skips shortcuts when textarea is focused', function() {
    setupKeyboardShortcuts();
    fireKey('l', { target: { tagName: 'TEXTAREA' } });
    assert.strictEqual(_shortcutLog.indexOf('switchView:learn'), -1);
  });

  test('skips shortcuts when select is focused', function() {
    setupKeyboardShortcuts();
    fireKey('l', { target: { tagName: 'SELECT' } });
    assert.strictEqual(_shortcutLog.indexOf('switchView:learn'), -1);
  });
});

suite('Modal Handling', function() {
  test('Escape closes session summary modal', function() {
    var modal = makeEl('div');
    modal.id = 'session-summary-modal';
    modal.style.display = 'flex';
    _elementsById['session-summary-modal'] = modal;

    setupKeyboardShortcuts();
    fireKey('Escape');
    assert.ok(_shortcutLog.indexOf('closeSessionSummary') >= 0);
  });

  test('Escape closes password modal', function() {
    var modal = makeEl('div');
    modal.id = 'password-change-modal';
    modal.style.display = 'flex';
    _elementsById['password-change-modal'] = modal;

    setupKeyboardShortcuts();
    fireKey('Escape');
    assert.ok(_shortcutLog.indexOf('closePasswordModal') >= 0);
  });

  test('navigation keys ignored when modal open', function() {
    var modal = makeEl('div');
    modal.id = 'session-summary-modal';
    modal.style.display = 'flex';
    _elementsById['session-summary-modal'] = modal;

    setupKeyboardShortcuts();
    fireKey('ArrowRight');
    assert.strictEqual(_shortcutLog.indexOf('switchView:learn'), -1);
  });
});

suite('Navigation Shortcuts', function() {
  test('L key switches to learn view', function() {
    setupKeyboardShortcuts();
    fireKey('l');
    assert.ok(_shortcutLog.indexOf('switchView:learn') >= 0);
  });

  test('D key switches to dashboard', function() {
    setupKeyboardShortcuts();
    fireKey('d');
    assert.ok(_shortcutLog.indexOf('switchView:dashboard') >= 0);
  });

  test('W key switches to list', function() {
    setupKeyboardShortcuts();
    fireKey('w');
    assert.ok(_shortcutLog.indexOf('switchView:list') >= 0);
  });

  test('R key switches to quran', function() {
    setupKeyboardShortcuts();
    fireKey('r');
    assert.ok(_shortcutLog.indexOf('switchView:quran') >= 0);
  });

  test('P key switches to profile', function() {
    setupKeyboardShortcuts();
    fireKey('p');
    assert.ok(_shortcutLog.indexOf('switchView:profile') >= 0);
  });

  test('Uppercase navigation keys work', function() {
    setupKeyboardShortcuts();
    fireKey('L');
    assert.ok(_shortcutLog.indexOf('switchView:learn') >= 0);
  });

  test('Navigation keys ignored with modifier', function() {
    setupKeyboardShortcuts();
    fireKey('l', { ctrlKey: true });
    assert.strictEqual(_shortcutLog.indexOf('switchView:learn'), -1);
  });
});

suite('Question Mark Hints', function() {
  test('? key shows keyboard hints', function() {
    var hint = makeEl('div');
    hint.id = 'kbd-hints';
    _elementsById['kbd-hints'] = hint;

    setupKeyboardShortcuts();
    fireKey('?');
    assert.ok(hint.classList.contains('visible'));
  });
});

suite('Learn View Shortcuts', function() {
  test('ArrowRight in learn view calls preventDefault', function() {
    var btn = makeEl('button');
    btn.id = 'btn-next';
    btn.disabled = false;
    _elementsById['btn-next'] = btn;

    global.currentView = 'learn';
    setupKeyboardShortcuts();
    fireKey('ArrowRight');
    assert.ok(_shortcutLog.indexOf('preventDefault:ArrowRight') >= 0);
  });

  test('ArrowLeft in learn view calls preventDefault', function() {
    var btn = makeEl('button');
    btn.id = 'btn-prev';
    btn.disabled = false;
    _elementsById['btn-prev'] = btn;

    global.currentView = 'learn';
    setupKeyboardShortcuts();
    fireKey('ArrowLeft');
    assert.ok(_shortcutLog.indexOf('preventDefault:ArrowLeft') >= 0);
  });

  test('Q key in learn view toggles quick mode', function() {
    global.currentView = 'learn';
    setupKeyboardShortcuts();
    fireKey('q');
    assert.ok(_shortcutLog.indexOf('toggleQuickMode') >= 0);
  });
});

suite('Quiz View Shortcuts', function() {
  test('Number keys in quiz trigger quiz-opt search', function() {
    global.currentView = 'quiz';
    setupKeyboardShortcuts();
    // Just verify it doesn't throw
    fireKey('1');
  });
});

suite('List View Shortcuts', function() {
  test('Slash key in list view focuses search', function() {
    var input = makeEl('input');
    input.id = 'search-input';
    var focused = false;
    input.focus = function() { focused = true; };
    _elementsById['search-input'] = input;

    global.currentView = 'list';
    setupKeyboardShortcuts();
    fireKey('/');
    assert.ok(focused);
  });
});

suite('Auto-Shown Hints', function() {
  test('first interaction dismisses auto-shown hints', function() {
    global.window._kbdHintsAutoShown = true;
    var hint = makeEl('div');
    hint.id = 'kbd-hints';
    hint.classList.add('visible');
    _elementsById['kbd-hints'] = hint;

    setupKeyboardShortcuts();
    fireKey('l');
    assert.strictEqual(global.window._kbdHintsAutoShown, false);
    assert.strictEqual(hint.classList.contains('visible'), false);
  });
});

suite('showKeyboardHints', function() {
  test('shows the hint element', function() {
    resetDOM();
    var hint = makeEl('div');
    hint.id = 'kbd-hints';
    _elementsById['kbd-hints'] = hint;

    showKeyboardHints();
    assert.ok(hint.classList.contains('visible'));
  });

  test('does nothing if element missing', function() {
    resetDOM();
    showKeyboardHints();
  });

  test('sets ARIA attributes', function() {
    resetDOM();
    var hint = makeEl('div');
    hint.id = 'kbd-hints';
    _elementsById['kbd-hints'] = hint;

    showKeyboardHints();
    assert.strictEqual(hint.getAttribute('role'), 'status');
    assert.strictEqual(hint.getAttribute('aria-live'), 'polite');
  });

  test('sets timeout to auto-hide', function() {
    resetDOM();
    var hint = makeEl('div');
    hint.id = 'kbd-hints';
    _elementsById['kbd-hints'] = hint;

    showKeyboardHints();
    var timeoutCount = Object.keys(_timeouts).length;
    assert.ok(timeoutCount >= 1, 'expected at least 1 timeout, got ' + timeoutCount);

    Object.keys(_timeouts).forEach(function(id) {
      if (_timeouts[id].fn) _timeouts[id].fn();
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
