#!/usr/bin/env node
/**
 * quran-map-ui.test.js — the Quran map screen and page view
 * (js/ui/quran-map-markup.js, js/ui/quran-map-ui.js).
 *
 * Markup is tested as strings; the screen with a tiny fake DOM, the real
 * map data and stub loaders.
 *
 * Run: node test/quran-map-ui.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
global.window = globalThis;
function load(rel) { (0, eval)(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
load('js/i18n/strings-en.js');
global.escapeHtml = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
global.uiIcon = function (name) { return '<svg data-icon="' + name + '"></svg>'; };
load('js/data-core/quran-map.js');
load('js/ui/quran-map-markup.js');
load('js/ui/quran-map-ui.js');

var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/quran/quran-map-data.js'), 'utf8'), ctx);
var MAP = JSON.parse(JSON.stringify(ctx.window.__QURAN_MAP));

// ── Fake DOM and app stubs: only what the screen touches ──
var elements = {};
function el(id) {
  return elements[id] || (elements[id] = { id: id, innerHTML: '', focus: function () { this.focused = true; } });
}
global.document = { getElementById: function (id) { return elements[id] || null; } };
var views = [], panels = [], opened = [];
global.switchView = function (v) { views.push(v); if (v === 'quran-map') return renderQuranMap(); };
global.getMasteredWordIds = function () { return { cw_1: true, cw_2: true, cw_3: true, cw_4: true }; };
global.getCanonicalWords = function () {
  return [{ id: 'cw_1', arabic: 'قُلْ' }, { id: 'cw_2', arabic: 'هُوَ' }, { id: 'cw_3', arabic: 'اللَّهُ' }, { id: 'cw_4', arabic: 'أَحَدٌ' }];
};
global._getCoverageKeyFn = function () { return function (a) { return 'k:' + a; }; };
MAP.keys = MAP.keys.slice();
var verseKeys = MAP.ayahs[111][0].split(',').map(function (x) { return parseInt(x, 36); });
['قُلْ', 'هُوَ', 'اللَّهُ', 'أَحَدٌ'].forEach(function (a, i) { MAP.keys[verseKeys[i]] = 'k:' + a; });
global.loadQuranSurah = function () { return Promise.resolve(); };
global.getQuranSurahInfo = function (s) { return { transliteration: 'Surah ' + s }; };
global.getQuranVerse = function (s, a) {
  if (s === 112 && a === 1) return { text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', w: ['Say', 'He', 'Allah', 'is One'] };
  var n = String(MAP.ayahs[s - 1][a - 1]).split(',').length;
  return { text: new Array(n).fill('كَلِمَة').join(' '), w: new Array(n).fill('word') };
};
global.showQuranWordPanel = function (info) { panels.push(info); };
global.openSurahForReading = function (s) { opened.push(s); };

var passed = 0, failed = 0, pending = Promise.resolve();
function t(name, fn) {
  pending = pending.then(async function () {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
  });
}
function reset(map) {
  elements = {}; views = []; panels = []; opened = [];
  window.__QURAN_MAP = map; _quranMapLoad = null; _quranMapPage = null;
  el('view-quran-map'); el('quran-map-title');
}
function click(action, attrs) {
  attrs = attrs || {};
  var target = { getAttribute: function (a) { return a === 'data-action' ? action : attrs[a]; } };
  return _onQuranMapClick({ target: { closest: function () { return target; } } });
}
function count(html, re) { return (html.match(re) || []).length; }

console.log('\n📋 The map');
t('604 pages in 30 juz, each labelled', async function () {
  reset(MAP);
  await openQuranMap();
  var html = el('view-quran-map').innerHTML;
  assert.deepStrictEqual(views, ['quran-map']);
  assert.strictEqual(count(html, /data-action="page"/g), 604);
  assert.strictEqual(count(html, /class="qmap-juz"/g), 30);
  assert.ok(/aria-label="Page 1, juz 1, \d+% known"/.test(html), 'page 1 labelled');
  assert.ok(/aria-label="Page 604, juz 30, [1-9]\d?% known"/.test(html), 'page 604 shows its known share');
  assert.ok(el('quran-map-title').focused);
});
t('the map file fails to load: a message and a retry, no squares', async function () {
  reset(undefined);
  var realLoad = loadQuranMapData;
  global.loadQuranMapData = function () { return Promise.resolve(null); };
  await renderQuranMap();
  var html = el('view-quran-map').innerHTML;
  assert.strictEqual(count(html, /data-action="page"/g), 0);
  assert.ok(html.indexOf(global.t('quranMap.loadFailed')) >= 0);
  assert.ok(html.indexOf('data-action="retry"') >= 0);
  global.loadQuranMapData = realLoad;
});

console.log('\n📋 A page');
t('page 604: its surahs, known words lit', async function () {
  reset(MAP);
  await openQuranMapPage(604);
  var html = el('view-quran-map').innerHTML;
  assert.ok(html.indexOf('Surah 112') >= 0 && html.indexOf('Surah 114') >= 0);
  var first = html.slice(0, html.indexOf('﴿1﴾'));
  assert.strictEqual(count(first, /qmap-tok is-known/g), 4, '112:1 all known');
  assert.ok(count(html, /class="qmap-tok"/g) > 0, 'some words not known');
  assert.ok(html.indexOf('lang="ar" dir="rtl"') >= 0);
  assert.ok(html.indexOf('data-action="prev"') >= 0);
  assert.ok(html.indexOf('data-action="next"') < 0, 'no next page after 604');
});
t('tapping a word opens the word panel with its meaning', async function () {
  reset(MAP);
  await openQuranMapPage(604);
  click('word', { 'data-s': '112', 'data-a': '1', 'data-i': '3' });
  assert.strictEqual(panels.length, 1);
  assert.strictEqual(panels[0].verseKey, '112:1');
  assert.strictEqual(panels[0].wordNum, 4);
  assert.strictEqual(panels[0].arabic, 'أَحَدٌ');
  assert.strictEqual(panels[0].meaning, 'is One');
});
t('a word joined to the one before shares its meaning', function () {
  var words = quranMapVerseWords({ text: 'يَا أَيُّهَا النَّاسُ', w: ['O', 0, 'mankind'] });
  assert.deepStrictEqual(words.map(function (w) { return w.num; }), [1, 1, 2]);
  assert.strictEqual(words[1].meaning, 'O');
  assert.strictEqual(words[1].arabic, 'يَا أَيُّهَا');
});
t('prev, map and reader buttons', async function () {
  reset(MAP);
  await openQuranMapPage(604);
  await click('prev');
  assert.strictEqual(_quranMapPage, 603);
  await click('map');
  assert.strictEqual(_quranMapPage, null);
  assert.strictEqual(count(el('view-quran-map').innerHTML, /data-action="page"/g), 604);
  await openQuranMapPage(1);
  click('reader', { 'data-s': '1' });
  assert.deepStrictEqual(opened, [1]);
});

console.log('\n📋 Shading');
t('legend and squares use the five shades', function () {
  var html = quranMapGridMarkup([{ page: 1, juz: 1, known: 9, total: 10 }, { page: 2, juz: 1, known: 0, total: 10 }]);
  assert.ok(html.indexOf('qmap-page s4') >= 0);
  assert.ok(html.indexOf('qmap-page s0') >= 0);
  assert.strictEqual(count(html, /qmap-swatch s\d/g), 5);
});

pending.then(function () {
  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  process.exit(failed ? 1 : 0);
});
