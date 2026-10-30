#!/usr/bin/env node
/**
 * drill-ui.test.js — running a Practice drill in #rc-drill-host (js/ui/drill-ui.js)
 *
 * Tests: the loading line, the "learn words first" and failure messages, the
 * first question, the "New drill" button after an answer, retrying with every
 * drill surah when the first few hold no learned word, and a slow load not
 * overwriting a newer drill. The builders, loader and exercise renderer are
 * stubbed; their own behaviour is tested elsewhere.
 *
 * Run: node test/drill-ui.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;

function makeEl(tag) {
  var el = {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    children: [],
    attrs: {},
    listeners: {},
    setAttribute: function(k, v) { el.attrs[k] = String(v); },
    appendChild: function(child) { el.children.push(child); return child; },
    addEventListener: function(type, fn) { el.listeners[type] = fn; },
    focus: function() {},
  };
  // Like a real element, assigning textContent drops the children.
  var text = '';
  Object.defineProperty(el, 'textContent', {
    get: function() { return text; },
    set: function(v) { text = v; el.children = []; },
  });
  return el;
}
global.document = { createElement: makeEl };

function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
load('js/i18n/strings-en.js');
load('js/exercises/word-drills.js');
load('js/ui/drill-ui.js');

// ── Stubs (replace the real functions word-drills.js and exercise-ui.js define) ──
var _learned = true;
var _items = [];                 // what the builders return next, in order
var _loads = [];                 // surah id lists asked of the loader
var _loadResult = true;
var _rendered = [];              // { body, item, onAnswer }
var _gate = null;                // a promise the loader waits for

global.exerciseEl = function(tag, className, text) {
  var el = makeEl(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
global.hasLearnedWords = function() { return _learned; };
global.buildSpotDrill = function() { return _items.length ? _items.shift() : null; };
global.buildVerseBuildDrill = global.buildSpotDrill;
global.renderExercise = function(body, item, onAnswer) { _rendered.push({ body: body, item: item, onAnswer: onAnswer }); };
global.__quranLoader = {
  load: function() { return _gate ? _gate.then(function() { return true; }) : Promise.resolve(true); },
  loadSurahs: async function(ids) {
    _loads.push(ids.slice());
    return ids.map(function() { return _loadResult; });
  },
};

var SPOT = { type: 'spot', prompt: { text: 'Tap' }, tokens: ['a', 'b', 'c'], answer: [1], tag: 'drill' };
var BUILD = { type: 'build', prompt: { text: 'Translation' }, pieces: ['b', 'a', 'c'], answer: ['a', 'b', 'c'], tag: 'drill' };

function reset() {
  _learned = true; _items = []; _loads = []; _loadResult = true; _rendered = []; _gate = null;
}

function messageOf(host) {
  var p = host.children.filter(function(c) { return c.className === 'drill-message'; })[0];
  return p ? p.textContent : null;
}

var passed = 0, failed = 0;
async function test(name, fn) {
  reset();
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + '\n     ' + e.message.split('\n')[0]);
  }
}

async function run() {
  console.log('\n📋 startWordDrill');

  await test('shows a loading line while the text loads, then the question', async function() {
    var host = makeEl('div');
    var release;
    _gate = new Promise(function(resolve) { release = resolve; });
    _items = [SPOT];
    var done = startWordDrill('spot', host);
    assert.strictEqual(messageOf(host), t('drill.loading'));
    release();
    await done;
    assert.strictEqual(_rendered.length, 1);
    assert.strictEqual(_rendered[0].item, SPOT);
    assert.strictEqual(messageOf(host), null, 'the loading line is gone');
  });

  await test('Spot with nothing learned says so and loads nothing', async function() {
    var host = makeEl('div');
    _learned = false;
    await startWordDrill('spot', host);
    assert.strictEqual(messageOf(host), t('drill.needWords'));
    assert.strictEqual(_loads.length, 0);
  });

  await test('Build does not need learned words', async function() {
    var host = makeEl('div');
    _learned = false;
    _items = [BUILD];
    await startWordDrill('build', host);
    assert.strictEqual(_rendered[0].item, BUILD);
  });

  await test('Build shows its instruction above the question', async function() {
    var host = makeEl('div');
    _items = [BUILD];
    await startWordDrill('build', host);
    assert.strictEqual(host.children[0].textContent, t('drill.build.prompt'));
  });

  await test('loads Al-Fatihah and a few Juz Amma surahs first', async function() {
    var host = makeEl('div');
    _items = [SPOT];
    await startWordDrill('spot', host);
    assert.strictEqual(_loads.length, 1);
    assert.strictEqual(_loads[0][0], 1);
    assert.strictEqual(_loads[0].length, 1 + DRILL_FIRST_LOAD_SURAH_COUNT);
    _loads[0].slice(1).forEach(function(id) { assert.ok(id >= 78 && id <= 114); });
  });

  await test('Spot retries with every drill surah when the first few hold no learned word', async function() {
    var host = makeEl('div');
    _items = [null, SPOT];
    await startWordDrill('spot', host);
    assert.strictEqual(_loads.length, 2);
    assert.deepStrictEqual(_loads[1], DRILL_SURAH_IDS);
    assert.strictEqual(_rendered[0].item, SPOT);
  });

  await test('Spot says none of the words fit when even every surah has none', async function() {
    var host = makeEl('div');
    _items = [null, null];
    await startWordDrill('spot', host);
    assert.strictEqual(messageOf(host), t('drill.noMatch'));
    assert.strictEqual(_rendered.length, 0);
  });

  await test('a failed load says the text is unavailable', async function() {
    var host = makeEl('div');
    _loadResult = false;
    await startWordDrill('build', host);
    assert.strictEqual(messageOf(host), t('drill.unavailable'));
  });

  await test('a loader that throws says the text is unavailable', async function() {
    var host = makeEl('div');
    var saved = window.__quranLoader.load;
    window.__quranLoader.load = function() { return Promise.reject(new Error('offline')); };
    try {
      await startWordDrill('build', host);
    } finally {
      window.__quranLoader.load = saved;
    }
    assert.strictEqual(messageOf(host), t('drill.unavailable'));
  });

  await test('answering adds a New drill button that starts the next question', async function() {
    var host = makeEl('div');
    _items = [BUILD, SPOT];
    await startWordDrill('build', host);
    assert.strictEqual(host.children.filter(function(c) { return c.className.indexOf('drill-again') >= 0; }).length, 0);
    _rendered[0].onAnswer(true, []);
    var again = host.children.filter(function(c) { return c.className.indexOf('drill-again') >= 0; })[0];
    assert.strictEqual(again.textContent, t('drill.again'));
    again.listeners.click();
    await new Promise(function(resolve) { setTimeout(resolve, 0); });
    assert.strictEqual(_rendered.length, 2);
    assert.strictEqual(_rendered[1].item, SPOT);
  });

  await test('a slow earlier load does not overwrite a newer drill', async function() {
    var host = makeEl('div');
    var release;
    _gate = new Promise(function(resolve) { release = resolve; });
    var first = startWordDrill('build', host);
    _gate = null;
    _items = [SPOT];
    await startWordDrill('spot', host);
    release();
    await first;
    assert.strictEqual(_rendered.length, 1, 'only the newer drill is drawn');
    assert.strictEqual(_rendered[0].item.type, 'spot');
  });

  await test('ignores an unknown kind and a missing host', async function() {
    await startWordDrill('nope', makeEl('div'));
    await startWordDrill('spot', null);
    assert.strictEqual(_loads.length, 0);
  });

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  process.exit(failed ? 1 : 0);
}

run();
