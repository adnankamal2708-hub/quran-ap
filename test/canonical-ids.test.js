#!/usr/bin/env node
/**
 * canonical-ids.test.js — word ids never move
 *
 * Saved progress is keyed by cw_N. Each word in js/data/ carries its frozen
 * id as `cid` (see js/data-core/vocab-data.js), so correcting a word's Arabic, root or meaning cannot renumber the
 * words after it.
 *
 * Run: node test/canonical-ids.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name); console.log('     ' + (e.message || e).split('\n')[0]); }
}

global.window = global;
var realLog = console.log;
console.log = function () {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/data-core/vocab-data.js'), 'utf8'));
require('../build-files.js').getBuildFiles().DATA_FILES
  .filter(function (f) { return /^js\/data\//.test(f); })
  .forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); });
var state = vm.runInThisContext(
  'assignWordIds(); deduplicateVocabulary();' +
  '({ words: ALL_WORDS, canonical: CANONICAL_WORDS, map: OLD_ID_TO_CANONICAL })');
state.frozen = state.words.map(function (w) { return w.cid; });
console.log = realLog;

// The table as first frozen (10 November 2026). A different hash means ids
// moved: do not update this value unless words were only added at the end.
var FROZEN_SHA256 = crypto.createHash('sha256').update(state.frozen.slice(0, 1251).join(',')).digest('hex');
var EXPECTED_SHA256 = 'e47368419c8cad93fdb411ef290935750f6d489e39dcc349d44b98f452a036e8';

console.log('\n📋 Frozen word ids');
t('every word carries a frozen id', function () {
  assert.ok(state.words.length >= 1251);
  state.words.forEach(function (w, i) { assert.strictEqual(typeof w.cid, 'number', 'word ' + i + ' ' + w.arabic); });
});
t('the first 1,251 ids are the ones frozen on 10 November 2026', function () {
  assert.strictEqual(FROZEN_SHA256, EXPECTED_SHA256);
});
t('every word has the id the table gives it', function () {
  state.words.forEach(function (w, i) {
    assert.strictEqual(state.map[w.id], 'cw_' + state.frozen[i], 'word ' + i);
  });
});
t('ids are unique per entry and none is skipped', function () {
  var ids = state.canonical.map(function (c) { return c.id; });
  assert.strictEqual(new Set(ids).size, ids.length);
  var max = Math.max.apply(null, state.frozen);
  assert.strictEqual(ids.length, max + 1);
});
t('correcting a word does not move any id', function () {
  var before = JSON.stringify(state.words.map(function (w) { return state.map[w.id]; }));
  var w = state.words[0];
  var saved = { arabic: w.arabic, root: w.root, meaning: w.meaning };
  w.arabic = 'zzz'; w.root = 'x-y-z'; w.meaning = 'changed';
  console.log = function () {};
  var after = vm.runInThisContext('deduplicateVocabulary(); JSON.stringify(ALL_WORDS.map(function (w) { return OLD_ID_TO_CANONICAL[w.id]; }))');
  w.arabic = saved.arabic; w.root = saved.root; w.meaning = saved.meaning;
  vm.runInThisContext('deduplicateVocabulary()');
  console.log = realLog;
  assert.strictEqual(after, before);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
