#!/usr/bin/env node
/**
 * saved-verses.test.js — saving verses for later (js/data-core/saved-verses.js):
 * save and unsave, the free limit, newest first, corrupt storage, and the
 * change record that lets an unsave sync.
 *
 * Run: node test/saved-verses.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = globalThis;
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
};
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
global.APP_FACTS = { limits: { savedVerses: 10 } };
load('js/data-core/saved-verses.js');

var changes, now, premium;
global.markSyncChange = function (kind, key, on) { changes.push([kind, key, on]); };
var realNow = Date.now;
Date.now = function () { return now++; };
global.__premium = {
  FEATURES: { UNLIMITED_BOOKMARKS: 'unlimitedBookmarks' },
  hasFeature: function (f) { return premium && f === 'unlimitedBookmarks'; },
};

var passed = 0, failed = 0;
function test(name, fn) {
  store = {}; changes = []; now = 1000; premium = false;
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e)); }
}

console.log('\n📋 Saved verses');

test('a tap saves a verse and a second tap unsaves it', function () {
  assert.strictEqual(isVerseSaved('2:255'), false);
  assert.strictEqual(toggleSavedVerse('2:255'), 'saved');
  assert.strictEqual(isVerseSaved('2:255'), true);
  assert.strictEqual(toggleSavedVerse('2:255'), 'removed');
  assert.strictEqual(isVerseSaved('2:255'), false);
  assert.deepStrictEqual(changes, [['verses', '2:255', true], ['verses', '2:255', false]]);
});

test('the list is newest first', function () {
  toggleSavedVerse('1:1');
  toggleSavedVerse('2:255');
  toggleSavedVerse('112:1');
  assert.deepStrictEqual(savedVerseList(), ['112:1', '2:255', '1:1']);
});

test('a free account can save 10 verses; the 11th is refused and not stored', function () {
  for (var i = 1; i <= 10; i++) assert.strictEqual(toggleSavedVerse('2:' + i), 'saved');
  assert.strictEqual(toggleSavedVerse('2:11'), 'limit');
  assert.strictEqual(isVerseSaved('2:11'), false);
  assert.strictEqual(changes.length, 10, 'a refused save records no change');
  assert.strictEqual(toggleSavedVerse('2:1'), 'removed', 'unsaving still works when full');
});

test('Premium has no limit', function () {
  premium = true;
  for (var i = 1; i <= 12; i++) assert.strictEqual(toggleSavedVerse('3:' + i), 'saved');
  assert.strictEqual(savedVerseList().length, 12);
});

test('verses kept past the limit stay saved', function () {
  var many = {};
  for (var i = 1; i <= 12; i++) many['4:' + i] = i;
  store[SAVED_VERSES_KEY] = JSON.stringify(many);
  assert.strictEqual(savedVerseList().length, 12);
  assert.strictEqual(toggleSavedVerse('4:13'), 'limit');
});

test('corrupt or odd storage reads as nothing saved', function () {
  store[SAVED_VERSES_KEY] = '{oops';
  assert.deepStrictEqual(loadSavedVerses(), {});
  store[SAVED_VERSES_KEY] = '[1,2]';
  assert.deepStrictEqual(loadSavedVerses(), {});
  assert.strictEqual(toggleSavedVerse('1:1'), 'saved', 'and saving works again');
});

Date.now = realNow;
console.log('\n' + '='.repeat(50));
console.log('  saved-verses.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
