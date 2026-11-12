#!/usr/bin/env node
/**
 * foundation-grammar-note.test.js — particle lessons don't get root/wazn advice.
 *
 * Run: node test/foundation-grammar-note.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'data-core', 'foundation-grammar-note.js'), 'utf8'));

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

test('a lesson of mostly rootless words gets the particle note', function () {
  var note = getFoundationGrammarNote([{ root: '—' }, { root: '' }, {}, { root: 'ق-و-ل' }]);
  assert.strictEqual(note, FOUNDATION_NOTE_PARTICLES);
  assert.ok(note.indexOf('wazn') < 0);
});

test('a lesson of mostly rooted words keeps the root note', function () {
  assert.strictEqual(getFoundationGrammarNote([{ root: 'ك-ت-ب' }, { root: 'ع-ل-م' }, { root: '—' }]), FOUNDATION_NOTE_ROOTS);
});

test('no words found falls back to the root note', function () {
  assert.strictEqual(getFoundationGrammarNote([null, undefined]), FOUNDATION_NOTE_ROOTS);
  assert.strictEqual(getFoundationGrammarNote(null), FOUNDATION_NOTE_ROOTS);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
