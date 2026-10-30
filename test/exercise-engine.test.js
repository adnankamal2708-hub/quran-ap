#!/usr/bin/env node
/**
 * exercise-engine.test.js — Unit tests for the shared exercise engine
 *
 * Tests: checkExercise (one correct and one wrong response per item type)
 * and validateExercise (every invalid case), plus the exercise UI strings.
 *
 * Run: node test/exercise-engine.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

// Indirect eval so the modules' top-level declarations become globals.
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n', 'strings-en.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'exercises', 'exercise-engine.js'), 'utf8'));

var passed = 0;
var failed = 0;

function test(name, fn) {
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

function suite(name, fn) {
  console.log('\n' + name);
  fn();
}

function readChoose(overrides) {
  return Object.assign({
    type: 'read-choose',
    prompt: { arabic: 'كتاب' },
    options: ['book', 'door', 'water'],
    answer: 0,
    tag: 'nouns',
  }, overrides || {});
}

function build(overrides) {
  return Object.assign({
    type: 'build',
    prompt: { text: 'Put the words in order' },
    pieces: ['b', 'a', 'c'],
    answer: ['a', 'b', 'c'],
    tag: 'order',
  }, overrides || {});
}

function spot(overrides) {
  return Object.assign({
    type: 'spot',
    prompt: { text: 'Tap the verbs' },
    tokens: ['w0', 'w1', 'w2', 'w3'],
    answer: [1, 3],
    tag: 'verbs',
  }, overrides || {});
}

suite('checkExercise', function() {
  test('read-choose: the answer index is correct', function() {
    assert.strictEqual(checkExercise(readChoose(), 0), true);
  });
  test('read-choose: another index is wrong', function() {
    assert.strictEqual(checkExercise(readChoose(), 2), false);
  });
  test('read-choose: a non-number response is wrong', function() {
    assert.strictEqual(checkExercise(readChoose(), '0'), false);
    assert.strictEqual(checkExercise(readChoose(), null), false);
  });
  test('build: the exact order is correct', function() {
    assert.strictEqual(checkExercise(build(), ['a', 'b', 'c']), true);
  });
  test('build: a different order is wrong', function() {
    assert.strictEqual(checkExercise(build(), ['b', 'a', 'c']), false);
  });
  test('build: a shorter or non-array response is wrong', function() {
    assert.strictEqual(checkExercise(build(), ['a', 'b']), false);
    assert.strictEqual(checkExercise(build(), 'abc'), false);
  });
  test('spot: all answer indexes in any order are correct', function() {
    assert.strictEqual(checkExercise(spot(), [3, 1]), true);
  });
  test('spot: a missing index is wrong', function() {
    assert.strictEqual(checkExercise(spot(), [1]), false);
  });
  test('spot: an extra index is wrong', function() {
    assert.strictEqual(checkExercise(spot(), [1, 2, 3]), false);
  });
  test('spot: the response array is not mutated', function() {
    var response = [3, 1];
    checkExercise(spot(), response);
    assert.deepStrictEqual(response, [3, 1]);
  });
  test('an unknown type or missing item is wrong', function() {
    assert.strictEqual(checkExercise({ type: 'nope' }, 0), false);
    assert.strictEqual(checkExercise(null, 0), false);
  });
});

suite('validateExercise', function() {
  test('valid items of every type return null', function() {
    assert.strictEqual(validateExercise(readChoose()), null);
    assert.strictEqual(validateExercise(build()), null);
    assert.strictEqual(validateExercise(spot()), null);
  });
  test('read-choose: answer out of range', function() {
    assert.ok(typeof validateExercise(readChoose({ answer: 3 })) === 'string');
    assert.ok(typeof validateExercise(readChoose({ answer: -1 })) === 'string');
  });
  test('read-choose: duplicated options', function() {
    assert.ok(typeof validateExercise(readChoose({ options: ['book', 'door', 'book'] })) === 'string');
  });
  test('build: pieces are not a permutation of the answer', function() {
    assert.ok(typeof validateExercise(build({ pieces: ['a', 'b', 'x'] })) === 'string');
    assert.ok(typeof validateExercise(build({ pieces: ['a', 'b'] })) === 'string');
    assert.ok(typeof validateExercise(build({ pieces: ['a', 'a', 'b'] })) === 'string');
  });
  test('build: repeated words are fine when both sides repeat them', function() {
    assert.strictEqual(validateExercise(build({ pieces: ['a', 'a', 'b'], answer: ['a', 'b', 'a'] })), null);
  });
  test('spot: empty answer', function() {
    assert.ok(typeof validateExercise(spot({ answer: [] })) === 'string');
  });
  test('spot: answer index out of range', function() {
    assert.ok(typeof validateExercise(spot({ answer: [1, 4] })) === 'string');
  });
  test('an unknown type or non-object is invalid', function() {
    assert.ok(typeof validateExercise({ type: 'nope' }) === 'string');
    assert.ok(typeof validateExercise(null) === 'string');
  });
  test('spot: duplicate answer indexes are invalid', function() {
    assert.ok(typeof validateExercise(spot({ answer: [1, 1] })) === 'string');
    assert.ok(typeof validateExercise(spot({ answer: [1, 3, 1] })) === 'string');
  });
  test('read-choose: fewer than 2 options is invalid', function() {
    assert.ok(typeof validateExercise(readChoose({ options: ['book'], answer: 0 })) === 'string');
    assert.ok(typeof validateExercise(readChoose({ options: [], answer: 0 })) === 'string');
  });
  test('build: no pieces is invalid', function() {
    assert.ok(typeof validateExercise(build({ pieces: [], answer: [] })) === 'string');
  });
  test('a missing prompt is invalid for every type', function() {
    assert.ok(typeof validateExercise(readChoose({ prompt: undefined })) === 'string');
    assert.ok(typeof validateExercise(build({ prompt: undefined })) === 'string');
    assert.ok(typeof validateExercise(spot({ prompt: undefined })) === 'string');
    assert.ok(typeof validateExercise(readChoose({ prompt: null })) === 'string');
  });
  test('read-choose without prompt.arabic is invalid', function() {
    assert.ok(typeof validateExercise(readChoose({ prompt: {} })) === 'string');
    assert.ok(typeof validateExercise(readChoose({ prompt: { arabic: '' } })) === 'string');
    assert.ok(typeof validateExercise(readChoose({ prompt: { text: 'x' } })) === 'string');
  });
  test('build and spot without prompt.text are invalid', function() {
    assert.ok(typeof validateExercise(build({ prompt: {} })) === 'string');
    assert.ok(typeof validateExercise(build({ prompt: { text: '' } })) === 'string');
    assert.ok(typeof validateExercise(spot({ prompt: {} })) === 'string');
    assert.ok(typeof validateExercise(spot({ prompt: { arabic: 'x' } })) === 'string');
  });
});

suite('exercise strings', function() {
  test('the renderer strings exist', function() {
    assert.strictEqual(t('exercise.check'), 'Check');
    assert.strictEqual(t('exercise.correct'), 'Correct');
    assert.strictEqual(t('exercise.incorrect'), 'Not quite');
  });
});

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed > 0 ? 1 : 0);
