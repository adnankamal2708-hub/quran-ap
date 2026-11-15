#!/usr/bin/env node
/**
 * ayah-readability.test.js — the index behind Today's ayah.
 *
 * js/quran/ayah-readability.js tags each word of an ayah with the lesson
 * word it is (N = cw_N), وَ/فَ plus a lesson word ("+N"), or null (the
 * learner gets a hint). A word is tagged only when the matcher that credits
 * % of the Quran credits it to exactly one lesson word.
 *
 * Run: node test/ayah-readability.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'js/quran/ayah-readability.js');
var arabicSameWord = require('../js/data-core/word-forms.js').arabicSameWord;
var builder = require('../scripts/build-ayah-readability.js');
var occ = require('../scripts/build-occurrence-index.js');

var passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + '\n     ' + (e.message || e).split('\n')[0]); }
}

var realLog = console.log;
console.log = function () {};
var inputs = builder.loadInputs();
console.log = realLog;
var built = builder.buildAyahReadability(inputs.quranText, inputs.words, inputs.meanings);
var ctx = { window: {} };
vm.createContext(ctx);
var src = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
vm.runInContext(src, ctx);
var index = ctx.window.__AYAH_READABILITY || {};
var forms = occ.buildFormKeys(inputs.quranText, inputs.words);
var byId = {};
inputs.words.forEach(function (w) { byId[w.id] = w; });
function keyOf(form) { return forms.formKeys[form] || occ.normalizeArabic(form); }

console.log('\n📋 Vowel check');
t('script differences still match', function () {
  assert.ok(arabicSameWord('إِلَى', 'إِلَىٰ'));
  assert.ok(arabicSameWord('اللَّهُ', 'ٱللَّهِ'));
  assert.ok(arabicSameWord('غَفُورٌ', 'غَفُورٞ'));
});
t('إِنَّ never matches أَن, أَنَّ or إِن', function () {
  ['أَن', 'أَنَّ', 'إِن'].forEach(function (tok) { assert.ok(!arabicSameWord('إِنَّ', tok), tok); });
});

console.log('\n📋 The index');
t('the committed file is up to date', function () {
  assert.strictEqual(src.replace(/\r\n/g, '\n'), builder.generateFile(built));
});
t('under 80 KB', function () {
  assert.ok(Buffer.byteLength(src) < 80 * 1024, Buffer.byteLength(src) + ' bytes');
});
t('112:1 is قُلْ هُوَ اللَّهُ أَحَدٌ, every word a lesson word', function () {
  var arabic = (index['112:1'] || []).map(function (n) { return byId['cw_' + n].arabic; });
  assert.strictEqual(arabic.length, 4);
  ['قل', 'هو', 'الله', 'احد'].forEach(function (bare, i) {
    assert.strictEqual(occ.normalizeArabic(arabic[i]).replace(/ٱ/g, 'ا'), bare);
  });
});
t('every ayah has 4+ words, at least half knowable and at most 3 hints', function () {
  Object.keys(index).forEach(function (ref) {
    var e = index[ref];
    assert.ok(e.length >= 4, ref);
    var known = e.filter(function (x) { return x !== null; }).length;
    assert.ok(known * 2 >= e.length, ref);
    assert.ok(e.length - known <= 3, ref);
  });
});
t('every tagged word really is that lesson word at that place', function () {
  Object.keys(index).forEach(function (ref) {
    var p = ref.split(':');
    var tokens = builder.ayahWords(inputs.quranText[p[0]].verses[p[1] - 1], inputs.meanings[p[0]][p[1] - 1]);
    assert.strictEqual(tokens.length, index[ref].length, ref);
    index[ref].forEach(function (e, i) {
      if (e === null) return;
      var tok = tokens[i];
      if (typeof e === 'string') { assert.ok(/^[وف]َ/.test(tok), ref + ' ' + tok); tok = tok.slice(2); }
      var w = byId['cw_' + Number(e)];
      assert.ok(w, ref + ' cw_' + e);
      assert.strictEqual(keyOf(w.arabic), forms.tokenKey(tok), ref + ' ' + tok);
      assert.ok(arabicSameWord(w.arabic, tok), ref + ' ' + tok + ' ≠ ' + w.arabic);
    });
  });
});
t('a form shared by two lesson words is never tagged (هَوَىٰ)', function () {
  var hawa = inputs.words.filter(function (w) { return w.arabic === 'هَوَىٰ'; }).map(function (w) { return Number(w.id.slice(3)); });
  assert.ok(hawa.length >= 2);
  Object.keys(index).forEach(function (ref) {
    index[ref].forEach(function (e) { if (e !== null) assert.ok(hawa.indexOf(Number(e)) < 0, ref); });
  });
});
t('وَ/فَ words are tagged only when the meaning starts with and/so/then', function () {
  var plus = 0;
  Object.keys(index).forEach(function (ref) {
    var p = ref.split(':');
    var m = builder.ayahMeanings(inputs.meanings[p[0]][p[1] - 1]);
    index[ref].forEach(function (e, i) {
      if (typeof e !== 'string') return;
      plus++;
      assert.ok(/^(and|so|then)\b/i.test(m[i]), ref + ': ' + m[i]);
    });
  });
  assert.ok(plus > 0);
});

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
process.exit(failed ? 1 : 0);
