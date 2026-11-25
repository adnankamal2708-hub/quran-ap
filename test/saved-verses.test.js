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

console.log('\n📋 Save button and Saved verses list');

load('js/ui/saved-verses-ui.js');
global.t = function (k, v) { return k + (v ? ' ' + JSON.stringify(v) : ''); };
global.uiIcon = function (name) { return '<svg data-icon="' + name + '"></svg>'; };
global.escapeHtml = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
global._getSurahInfo = function (id) { return id === 2 ? { name: 'Al-Baqarah' } : null; };
function FakeButton(verse) {
  this.attrs = { 'data-verse': String(verse) };
  this.getAttribute = function (k) { return this.attrs[k]; };
  this.setAttribute = function (k, v) { this.attrs[k] = v; };
}
var buttons, toasts;
global.document = { querySelectorAll: function () { return buttons; } };
global.showToast = function (msg) { toasts.push(msg); };

test('nothing saved: no list at all', function () {
  assert.strictEqual(savedVersesListHtml(), '');
});

test('the Save button shows whether its verse is saved, and a tap changes it', function () {
  global._quranSurahId = 2;
  buttons = [new FakeButton(255), new FakeButton(256)];
  toggleVerseSave(255);
  assert.strictEqual(isVerseSaved('2:255'), true);
  assert.strictEqual(buttons[0].attrs['aria-pressed'], 'true');
  assert.strictEqual(buttons[1].attrs['aria-pressed'], 'false');
  assert.ok(buttons[0].attrs['aria-label'].indexOf('reader.unsaveVerse') === 0);
  toggleVerseSave(255);
  assert.strictEqual(buttons[0].attrs['aria-pressed'], 'false');
});

test('a full free account gets a message and the verse is not saved', function () {
  toasts = [];
  global._quranSurahId = 2;
  buttons = [new FakeButton(11)];
  for (var i = 1; i <= 10; i++) toggleSavedVerse('3:' + i);
  toggleVerseSave(11);
  assert.strictEqual(isVerseSaved('2:11'), false);
  assert.strictEqual(toasts.length, 1);
  assert.ok(toasts[0].indexOf('reader.saveLimit') === 0 && toasts[0].indexOf('10') > 0);
});

test('the list is newest first and names the surah', function () {
  toggleSavedVerse('2:255');
  toggleSavedVerse('112:1');
  var html = savedVersesListHtml();
  assert.ok(html.indexOf('112:1') < html.indexOf('2:255'), 'newest first');
  assert.ok(html.indexOf('&quot;surah&quot;:&quot;Al-Baqarah&quot;') > 0, 'surah name');
  assert.ok(html.indexOf('saved.surah') > 0, 'a surah not loaded yet still gets a name');
});

test('a tap on a saved verse opens the reader at it', function () {
  var opened = [];
  global.openSurahForReading = function (id) { opened.push(id); };
  global._quranScrollVerse = null;
  openSavedVerse('2:255');
  assert.deepStrictEqual(opened, [2]);
  assert.strictEqual(_quranScrollVerse, '2:255');
});

Date.now = realNow;
console.log('\n' + '='.repeat(50));
console.log('  saved-verses.test.js');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
