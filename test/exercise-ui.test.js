#!/usr/bin/env node
/**
 * exercise-ui.test.js — keyboard handling of renderExercise
 *
 * An exercise's document-level keydown listener must ignore keys while the
 * exercise is not on screen (its view hidden but still in the DOM), without
 * swallowing them, and still check on Enter when it is visible.
 *
 * Run: node test/exercise-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MINIMAL FAKE DOM (just what renderExercise touches)
// ═══════════════════════════════════════════════════════════════

function makeEl(tag) {
  var el = {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    children: [],
    attrs: {},
    listeners: {},
    disabled: false,
    visible: true,          // false = rendered nowhere (display:none somewhere above)
    isConnected: true,
    classList: { add: function(c) { el.className += ' ' + c; } },
    setAttribute: function(k, v) { el.attrs[k] = String(v); },
    getAttribute: function(k) { return k in el.attrs ? el.attrs[k] : null; },
    removeAttribute: function(k) { delete el.attrs[k]; },
    appendChild: function(child) { el.children.push(child); child.parent = el; return child; },
    addEventListener: function(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelectorAll: function() { return []; },
    contains: function(other) {
      for (var node = other; node; node = node.parent) if (node === el) return true;
      return false;
    },
    getClientRects: function() {
      for (var node = el; node; node = node.parent) if (!node.visible) return [];
      return [{}];
    },
  };
  return el;
}

var documentListeners = [];
global.document = {
  body: makeEl('body'),
  createElement: makeEl,
  addEventListener: function(type, fn) { if (type === 'keydown') documentListeners.push(fn); },
  removeEventListener: function(type, fn) { documentListeners = documentListeners.filter(function(f) { return f !== fn; }); },
};
global.window = {};

function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
load('js/i18n/strings-en.js');
load('js/exercises/exercise-engine.js');
load('js/ui/exercise-ui.js');

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  documentListeners = [];
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

var ITEM = { type: 'read-choose', prompt: { arabic: 'x' }, options: ['a', 'b', 'c'], answer: 1 };

/** Render ITEM into a container (inside a view), return the pieces. */
function setup() {
  var view = makeEl('section');
  var container = makeEl('div');
  view.appendChild(container);
  var answers = [];
  renderExercise(container, ITEM, function(correct) { answers.push(correct); });
  var root = container.children[0];
  return { view: view, root: root, answers: answers };
}

function press(key, target) {
  var event = { key: key, target: target || document.body, prevented: false, preventDefault: function() { this.prevented = true; } };
  documentListeners.slice().forEach(function(fn) { fn(event); });
  return event;
}

console.log('\nKeyboard');

test('a visible exercise takes a digit and Enter, and checks', function() {
  var s = setup();
  assert.strictEqual(press('2').prevented, true);
  assert.strictEqual(press('Enter').prevented, true);
  assert.deepStrictEqual(s.answers, [true]);
});

test('a hidden view keeps the exercise connected but ignores digits and Enter without swallowing them', function() {
  var s = setup();
  s.view.visible = false;
  assert.strictEqual(s.root.isConnected, true);
  var digit = press('2');
  var enter = press('Enter');
  assert.strictEqual(digit.prevented, false, 'digit not swallowed');
  assert.strictEqual(enter.prevented, false, 'Enter not swallowed');
  assert.deepStrictEqual(s.answers, [], 'nothing was checked');
});

test('the exercise works again when its view is shown again', function() {
  var s = setup();
  s.view.visible = false;
  press('2');
  s.view.visible = true;
  press('2');
  press('Enter');
  assert.deepStrictEqual(s.answers, [true]);
});

test('Enter on a focused button outside the exercise is left alone (Quit, tabs, cards)', function() {
  var s = setup();
  var quit = makeEl('button');
  s.view.appendChild(quit);
  var tab = makeEl('button');
  press('2');
  var onQuit = press('Enter', quit);
  var onTab = press('Enter', tab);
  assert.strictEqual(onQuit.prevented, false, 'Quit keeps its Enter');
  assert.strictEqual(onTab.prevented, false, 'a bottom tab keeps its Enter');
  assert.deepStrictEqual(s.answers, [], 'nothing was checked');
});

test('Enter on a focused option inside the exercise still checks', function() {
  var s = setup();
  var option = makeEl('button');
  s.root.appendChild(option);
  press('2');
  assert.strictEqual(press('Enter', option).prevented, true);
  assert.deepStrictEqual(s.answers, [true]);
});

test('a disconnected exercise removes its listener', function() {
  var s = setup();
  s.root.isConnected = false;
  press('Enter');
  assert.strictEqual(documentListeners.length, 0);
  assert.deepStrictEqual(s.answers, []);
});

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
