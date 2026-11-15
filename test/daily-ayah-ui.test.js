#!/usr/bin/env node
/**
 * daily-ayah-ui.test.js — Today's ayah on Home and its screens
 * (js/ui/daily-ayah-steps.js, js/ui/daily-ayah-ui.js).
 *
 * Markup is tested as strings. The card and click tests use a tiny fake DOM
 * and stub loaders, so they can see what is shown, saved and counted.
 *
 * Run: node test/daily-ayah-ui.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var store = {};
global.window = globalThis;
global.localStorage = {
  getItem: function (k) { return store.hasOwnProperty(k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
};
function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
load('js/i18n/strings-en.js');
global.escapeHtml = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
global.uiIcon = function (name) { return '<svg data-icon="' + name + '"></svg>'; };
global.audioCreditHtml = function () { return '<p class="credit">Recitation</p>'; };
load('js/data-core/daily-ayah.js');
load('js/ui/daily-ayah-steps.js');
load('js/ui/daily-ayah-ui.js');

// ── Fake DOM: only what the UI touches ──
var elements = {};
function el(id) {
  return elements[id] || (elements[id] = { id: id, hidden: false, innerHTML: '', textContent: '', focus: function () { this.focused = true; } });
}
global.document = { getElementById: function (id) { return elements[id] || null; } };
var views = [];
global.switchView = function (v) { views.push(v); if (v === 'daily-ayah') renderDailyAyah(); };
global.getQuranSurahInfo = function () { return { transliteration: 'Al-Ikhlas' }; };
global.loadQuranText = function () { return Promise.resolve(); };
global.loadQuranSurah = function () { return Promise.resolve(); };
var VERSE = { text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', w: ['Say', 'He', 'Allah', 'is One'], translation: 'Say, He is Allah, One.' };
global.getQuranVerse = function () { return VERSE; };
global.getCanonicalWordById = function (id) { return id === 'cw_4' ? { root: 'أ ح د' } : null; };
var SRS = { cw_1: { stage: 2, ratedAt: 1 }, cw_2: { stage: 2, ratedAt: 1 }, cw_3: { stage: 2, ratedAt: 1 } };
global.loadSRS = function () { return SRS; };
window.__AYAH_READABILITY = { '112:1': [1, 2, 3, 4] };

var passed = 0, failed = 0, pending = Promise.resolve();
function t(name, fn) {
  pending = pending.then(async function () {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
  });
}
function reset() { store = {}; elements = {}; views = []; _dailyRun = null; }
var PICK = { ref: '112:1', entries: [1, 2, 3, 4], known: 3, total: 4, hints: [3] };

t('card: today\'s ayah with what is known, opens on Enter', function () {
  var h = dailyAyahCardMarkup(PICK, 'Al-Ikhlas', false, 0);
  assert.ok(h.indexOf('You know 3 of 4 words') >= 0);
  assert.ok(h.indexOf('Al-Ikhlas 112:1') >= 0);
  assert.ok(/data-action="open"[^>]*role="button"/.test(h));
});
t('card once read: the plain total, "1 ayah" and "12 ayahs"', function () {
  assert.ok(dailyAyahCardMarkup(PICK, 'Al-Ikhlas', true, 1).indexOf('1 ayah read on your own') >= 0);
  var h = dailyAyahCardMarkup(PICK, 'Al-Ikhlas', true, 12);
  assert.ok(h.indexOf('12 ayahs read on your own') >= 0);
  assert.ok(h.indexOf('Read today ✓') >= 0);
  assert.ok(h.indexOf('data-action="open"') < 0, 'a read card does not reopen');
});
t('card once read with a count of 0 shows the ayah instead', function () {
  assert.ok(dailyAyahCardMarkup(PICK, 'Al-Ikhlas', true, 0).indexOf('Al-Ikhlas 112:1') >= 0);
});

t('run: null when the verse words do not line up with the index', function () {
  assert.strictEqual(buildDailyAyahRun(PICK, { text: 'a b', w: ['x', 'y'] }, '', function () { return ''; }), null);
  assert.strictEqual(buildDailyAyahRun(PICK, { text: VERSE.text }, '', function () { return ''; }), null);
});
t('screens: the new word with its root, then the ayah, then the check', function () {
  var run = buildDailyAyahRun(PICK, VERSE, 'Al-Ikhlas', _dailyRootOf);
  assert.strictEqual(run.step, 'words');
  var h = dailyAyahStepMarkup(run, true);
  assert.ok(h.indexOf('أَحَدٌ') >= 0 && h.indexOf('is One') >= 0 && h.indexOf('أ ح د') >= 0);
  run.step = 'ayah';
  h = dailyAyahStepMarkup(run, true);
  assert.strictEqual((h.match(/data-action="word"/g) || []).length, 4);
  assert.strictEqual((h.match(/is-hint/g) || []).length, 1);
  assert.ok(h.indexOf('Say, He is Allah') < 0, 'no translation while reading');
  assert.ok(h.indexOf('Underlined words are the new ones') >= 0);
  var noHints = buildDailyAyahRun({ ref: '112:1', entries: [1, 2, 3, 4], known: 4, total: 4, hints: [] }, VERSE, '', _dailyRootOf);
  assert.strictEqual(noHints.step, 'ayah');
  assert.ok(dailyAyahStepMarkup(noHints, true).indexOf('Underlined') < 0, 'no underline note without new words');
  run.step = 'check';
  h = dailyAyahStepMarkup(run, true);
  assert.ok(h.indexOf('Say, He is Allah, One.') >= 0 && h.indexOf('data-action="play"') >= 0);
  assert.ok(dailyAyahStepMarkup(run, false).indexOf('data-action="play"') < 0);
});
t('every Arabic element is marked lang="ar"', function () {
  var run = buildDailyAyahRun(PICK, VERSE, 'Al-Ikhlas', _dailyRootOf);
  ['words', 'ayah', 'check'].forEach(function (step) {
    run.step = step;
    var tags = dailyAyahStepMarkup(run, true).match(/<[^>]+>[^<]*[؀-ۿ][^<]*/g) || [];
    tags.forEach(function (tag) { assert.ok(/lang="ar"/.test(tag), step + ': ' + tag.slice(0, 60)); });
  });
});

t('Home card shows and is saved as today\'s pick', async function () {
  reset();
  var slot = el('db-daily-ayah');
  await renderDailyAyahCard(slot);
  assert.strictEqual(slot.hidden, false);
  assert.ok(slot.innerHTML.indexOf('You know 3 of 4 words') >= 0);
  assert.strictEqual(loadDailyAyahState().ref, '112:1');
});
t('Home card stays hidden when no ayah fits', async function () {
  reset();
  var saved = SRS; SRS = {};
  var slot = el('db-daily-ayah');
  await renderDailyAyahCard(slot);
  SRS = saved;
  assert.strictEqual(slot.hidden, true);
  assert.strictEqual(slot.innerHTML, '');
});
t('Home card stays hidden when the index cannot load', async function () {
  reset();
  var idx = window.__AYAH_READABILITY;
  window.__AYAH_READABILITY = null;
  global.document.createElement = function () { return {}; };
  global.document.head = { appendChild: function (s) { s.onerror(); } };
  var slot = el('db-daily-ayah');
  await renderDailyAyahCard(slot);
  window.__AYAH_READABILITY = idx;
  assert.strictEqual(slot.hidden, true);
});

function click(action) {
  _onDailyAyahClick({ target: { closest: function () { return { getAttribute: function (a) { return a === 'data-action' ? action : '3'; } }; } } });
}
t('"I understood it" marks the ayah read and adds 1 to the count', async function () {
  reset();
  el('view-daily-ayah'); el('daily-ayah-title');
  await openDailyAyah();
  assert.deepStrictEqual(views, ['daily-ayah']);
  click('next');
  assert.strictEqual(_dailyRun.step, 'ayah');
  click('understood');
  assert.strictEqual(_dailyRun.step, 'check');
  var s = loadDailyAyahState();
  assert.deepStrictEqual(s.done, ['112:1']);
  assert.strictEqual(s.readCount, 1);
  click('home');
  assert.strictEqual(_dailyRun, null);
  assert.strictEqual(views[views.length - 1], 'dashboard');
});
t('"Show translation" marks it read but does not count it', async function () {
  reset();
  el('view-daily-ayah');
  await openDailyAyah();
  click('next');
  click('translation');
  var s = loadDailyAyahState();
  assert.deepStrictEqual(s.done, ['112:1']);
  assert.strictEqual(s.readCount, 0);
});
t('tapping a word shows its meaning', async function () {
  reset();
  el('view-daily-ayah'); var out = el('daily-ayah-meaning');
  await openDailyAyah();
  click('next');
  click('word');
  assert.strictEqual(out.textContent, 'is One');
});

pending.then(function () {
  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  process.exit(failed ? 1 : 0);
});
