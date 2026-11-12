#!/usr/bin/env node
/**
 * quiz-ui.test.js — the quiz never offers a wrong answer that is also right.
 *
 * The audit found "No" offered as a wrong answer for مَا, which can mean "not".
 *
 * Run: node test/quiz-ui.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var words = require('./load-vocabulary').loadVocabularyWords();

var ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'quiz-ui.js'), 'utf8'), ctx);

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function byArabic(a) {
  for (var i = 0; i < words.length; i++) if (words[i].arabic === a) return words[i];
  throw new Error('no word ' + a);
}

test('"No" (لَا) is not a wrong answer for مَا', function () {
  assert.strictEqual(ctx.sharesQuizSense(byArabic('مَا'), byArabic('لَا')), true);
});

test('an unrelated word is still a fair distractor', function () {
  assert.strictEqual(ctx.sharesQuizSense(byArabic('مَا'), byArabic('مِنْ')), false);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
