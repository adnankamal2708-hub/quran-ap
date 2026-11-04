#!/usr/bin/env node
/**
 * qaida-ui.test.js — answers in a Qaida lesson feed the review queue
 *
 * Tests: a missed question puts its skill in the queue, a right one is
 * passed on too, and a second answer to the same question is ignored.
 * recordQaidaAnswer is stubbed; the queue itself is tested in
 * qaida-track.test.js.
 *
 * Run: node test/qaida-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
global.document = { getElementById: function() { return null; } };

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
load('js/ui/qaida-ui.js');

var _recorded = [];
global.recordQaidaAnswer = function(skill, correct) { _recorded.push([skill, correct]); };

var passed = 0;
var failed = 0;

function test(name, fn) {
  _recorded = [];
  _qaidaRun = { lesson: { id: 'q0-1', kind: 'lesson' }, step: 'practice', index: 0, answered: false, correct: 0,
    items: [{ type: 'read-choose', skill: 'ba' }, { type: 'read-choose', skill: 'ta' }] };
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e));
  }
}

console.log('\n📋 Qaida lesson answers');

test('a missed question puts its skill in the review queue', function () {
  _onQaidaAnswer(false);
  assert.deepStrictEqual(_recorded, [['ba', false]]);
});

test('a right answer is recorded too, so a due skill moves on', function () {
  _qaidaRun.index = 1;
  _onQaidaAnswer(true);
  assert.deepStrictEqual(_recorded, [['ta', true]]);
});

test('a second answer to the same question is ignored', function () {
  _onQaidaAnswer(false);
  _onQaidaAnswer(true);
  assert.deepStrictEqual(_recorded, [['ba', false]]);
});

console.log('\n' + '='.repeat(50));
console.log('  qaida-ui.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
