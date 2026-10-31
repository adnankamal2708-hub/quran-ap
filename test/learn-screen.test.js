#!/usr/bin/env node
/**
 * learn-screen.test.js — the old Learn header's action items
 *
 * Tests: wireLearnScreenEvents() wiring of the learning-path items
 * (the Foundation item opens the next unfinished Foundation lesson).
 *
 * Run: node test/learn-screen.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════

// Every id resolves to a plain element so wireLearnScreenEvents can wire it.
var _els = {};
global.document = {
  getElementById: function(id) {
    if (!_els[id]) _els[id] = { id: id, onclick: null, onkeydown: null };
    return _els[id];
  },
};
global.window = {};

var nextFoundationLesson = 0;
global.getNextIncompleteFoundationLesson = function() { return nextFoundationLesson; };

var calls = [];
global.goToFoundationLesson = function(i) { calls.push('goToFoundationLesson:' + i); };
global.switchView = function(view) { calls.push('switchView:' + view); };

require('./load-components')();
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'learn-screen.js'), 'utf8'));

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

var passed = 0;
var failed = 0;

function test(name, fn) {
  _els = {};
  calls = [];
  nextFoundationLesson = 0;
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

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\n📚 Learn header — Foundation path item');

test('clicking Foundation opens the next unfinished Foundation lesson', function() {
  nextFoundationLesson = 3;
  wireLearnScreenEvents();
  _els['ls-path-foundation'].onclick();
  assert.deepStrictEqual(calls, ['goToFoundationLesson:3']);
});

test('Enter on Foundation opens the same lesson', function() {
  nextFoundationLesson = 5;
  wireLearnScreenEvents();
  _els['ls-path-foundation'].onkeydown({ key: 'Enter', preventDefault: function() {} });
  assert.deepStrictEqual(calls, ['goToFoundationLesson:5']);
});

test('the lesson is looked up at click time, not when wired', function() {
  nextFoundationLesson = 1;
  wireLearnScreenEvents();
  nextFoundationLesson = 4;
  _els['ls-path-foundation'].onclick();
  assert.deepStrictEqual(calls, ['goToFoundationLesson:4']);
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) process.exit(1);
