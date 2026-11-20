#!/usr/bin/env node
/**
 * share-card.test.js — the progress card's button and drawing
 * (js/ui/share-card.js)
 *
 * Run: node test/share-card.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.window = global;
function load(rel) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
load('js/i18n/strings-en.js');
load('js/data-core/daily-ayah.js');
load('js/data-core/share-progress.js');
load('js/ui/components.js');
load('js/ui/share-card.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

/** A canvas context that measures 10px per character and records what is drawn. */
function fakeCtx() {
  var drawn = [];
  return {
    drawn: drawn,
    measureText: function (s) { return { width: s.length * 10 }; },
    fillText: function (s, x, y) { drawn.push({ text: s, x: x, y: y, font: this.font, dir: this.direction }); },
    fillRect: function () {}, strokeRect: function () {}, drawImage: function () {},
  };
}

var percentNow = 0;
global.refreshWordMeaningsPercent = function () { return { percent: percentNow, gained: 0 }; };

console.log('\n📋 shareWrapLines');

test('keeps words whole and lines within the width', function () {
  var lines = shareWrapLines(fakeCtx(), 'aaa bbb ccc ddd', 75);
  assert.deepStrictEqual(lines, ['aaa bbb', 'ccc ddd']);
});

test('a word wider than the line gets a line of its own, never dropped', function () {
  assert.deepStrictEqual(shareWrapLines(fakeCtx(), 'a bbbbbbbbbbbb c', 50), ['a', 'bbbbbbbbbbbb', 'c']);
});

test('empty text gives no lines', function () {
  assert.deepStrictEqual(shareWrapLines(fakeCtx(), '  ', 50), []);
});

console.log('\n📋 shareProgressButtonMarkup');

test('no button at 0%', function () {
  percentNow = 0;
  assert.strictEqual(shareProgressButtonMarkup(), '');
});

test('a button marked for the shared click handler once there is progress', function () {
  percentNow = 3.2;
  var h = shareProgressButtonMarkup('w-full');
  assert.ok(/data-share-progress/.test(h), h);
  assert.ok(/class="btn btn-outline share-progress-btn w-full"/.test(h), h);
  assert.ok(h.indexOf('Share my progress') !== -1, h);
  assert.ok(/aria-hidden="true"/.test(h), 'the icon is decorative');
});

console.log('\n📋 drawShareCard');

var CONTENT = shareCardContent(12.4, {
  ref: '1:2', verse: { text: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ', translation: '[All] praise is [due] to Allah, Lord of the worlds -' },
}, 'Al-Fatihah');

test('draws the %, the claim, the ayah, its source and the footer', function () {
  var ctx = fakeCtx();
  drawShareCard(ctx, CONTENT, null);
  var all = ctx.drawn.map(function (d) { return d.text; }).join('\n');
  ['12.4%', CONTENT.claim, CONTENT.ayah.intro, CONTENT.ayah.source, CONTENT.footer].forEach(function (s) {
    assert.ok(all.indexOf(s) !== -1, 'missing ' + s);
  });
  assert.ok(all.indexOf('ٱلۡحَمۡدُ') !== -1, 'the Arabic is drawn');
});

test('the Arabic is drawn right-to-left in the Quran font; the rest left-to-right', function () {
  var ctx = fakeCtx();
  drawShareCard(ctx, CONTENT, null);
  ctx.drawn.forEach(function (d) {
    var arabic = /[؀-ۿ]/.test(d.text);
    assert.strictEqual(d.dir === 'rtl', arabic, d.text);
    if (arabic) assert.ok(/Scheherazade/.test(d.font), d.font);
  });
});

test('everything sits inside the card, top to bottom in order', function () {
  var ctx = fakeCtx();
  drawShareCard(ctx, CONTENT, null);
  var ys = ctx.drawn.map(function (d) { return d.y; });
  ys.forEach(function (y) { assert.ok(y > SHARE_CARD.margin && y <= SHARE_CARD.height - SHARE_CARD.margin, 'y ' + y); });
  for (var i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1], 'line ' + i + ' is below the one before');
});

test('the longest ayah the card allows shrinks to fit rather than running off it', function () {
  // SHARE_AYAH_MAX_WORDS long words, and a long translation (~45 words)
  var long = shareCardContent(40, { ref: '2:255', verse: {
    text: Array(SHARE_AYAH_MAX_WORDS + 1).join('فَسَيَكۡفِيكَهُمُ '),
    translation: Array(6).join('Allah - there is no deity except Him, the Ever-Living, ') } }, 'Al-Baqarah');
  var ctx = fakeCtx();
  drawShareCard(ctx, long, null);
  var footer = ctx.drawn[ctx.drawn.length - 1];
  var above = ctx.drawn[ctx.drawn.length - 2];
  assert.strictEqual(footer.text, long.footer);
  assert.ok(above.y < footer.y, 'the source sits above the footer');
});

test('an ayah too long to fit at any size is left off, never drawn over the footer', function () {
  var huge = shareCardContent(40, { ref: '2:282', verse: {
    text: Array(80).join('فَسَيَكۡفِيكَهُمُ '), translation: Array(40).join('and do not be weary to write it, ') } }, 'Al-Baqarah');
  var ctx = fakeCtx();
  drawShareCard(ctx, huge, null);
  assert.deepStrictEqual(ctx.drawn.map(function (d) { return d.text; }), ['40%', huge.claim, huge.footer]);
});

test('without an ayah the card shows the % alone, no ayah text', function () {
  var ctx = fakeCtx();
  drawShareCard(ctx, shareCardContent(5, null, ''), null);
  assert.deepStrictEqual(ctx.drawn.map(function (d) { return d.text; }), ['5%', CONTENT.claim, CONTENT.footer]);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
